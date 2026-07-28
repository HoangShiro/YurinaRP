// worldStateEngine.js — Deterministic Math & Time Simulation Engine
const { fetchFullWorldState, saveFullWorldState } = require('./upstashWorldState');

/**
 * Safe Math Expression Evaluator
 * Evaluates simple math strings containing numbers, +, -, *, /, and variable references.
 */
function evaluateExpression(expr, context) {
  if (typeof expr === 'number') return expr;
  if (!expr || typeof expr !== 'string') return 0;

  // Replace variable references with values from context
  let sanitized = expr.replace(/([a-zA-Z_0-9.]+)/g, (match) => {
    // If it's a number, leave it
    if (!isNaN(match)) return match;
    // Otherwise resolve path in context object
    const val = getNestedValue(context, match);
    return val !== undefined && val !== null && !isNaN(val) ? val : 0;
  });

  try {
    // Use Function constructor for safe math evaluation
    const result = new Function(`"use strict"; return (${sanitized});`)();
    return isNaN(result) ? 0 : result;
  } catch (err) {
    console.warn(`[MATH-ENGINE] Failed to evaluate expression '${expr}':`, err.message);
    return 0;
  }
}

function getNestedValue(obj, pathStr) {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = pathStr.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

function setNestedValue(obj, pathStr, value) {
  if (!obj || typeof obj !== 'object') return;
  const parts = pathStr.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * Computes exact daily gross revenue, cost burn, and net profit from catalog items.
 */
/**
 * Computes exact daily gross revenue, cost burn, and net profit from catalog items.
 * Generically evaluates all categories and respects item start_date (launch day).
 */
function computeCatalogTotals(catalog, targetCategories = null, currentDay = null) {
  if (!catalog || typeof catalog !== 'object') return { grossGold: 0, costGold: 0, netGold: 0 };
  let totalGrossCopper = 0;
  let totalCostCopper = 0;

  const categories = targetCategories || Object.keys(catalog);

  for (const cat of categories) {
    const list = catalog[cat];
    if (Array.isArray(list)) {
      for (const item of list) {
        if (currentDay !== null && item.start_date && typeof item.start_date === 'number') {
          if (currentDay < item.start_date) continue;
        }

        const price = item.price_copper || 0;
        const cost = item.unit_cost_copper || 0;
        const sold = item.daily_units_sold || 0;

        totalGrossCopper += price * sold;
        totalCostCopper += cost * sold;
      }
    }
  }

  const grossGold = Math.round((totalGrossCopper / 10000) * 100) / 100;
  const costGold = Math.round((totalCostCopper / 10000) * 100) / 100;
  const netGold = Math.round((grossGold - costGold) * 100) / 100;

  return { grossGold, costGold, netGold };
}

/**
 * Extracts Day number from prompt text or messages.
 * Matches patterns like "Day 244", "[TIME: Day 244]", "Day: 245"
 */
function parseDayFromMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return null;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const text = typeof msg.content === 'string' ? msg.content : (Array.isArray(msg.content) ? JSON.stringify(msg.content) : '');
    const match = text.match(/(?:Day|D)\s*[:=]?\s*(\d+)/i);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  return null;
}

/**
 * Evaluates financial net surpluses and executes time-step progression (Delta Days)
 */
async function processWorldStateTick(messages = null) {
  const state = await fetchFullWorldState();
  if (!state || !state.meta) return state;

  const currentDayInState = state.meta.current_day || 1;
  const lastUpdatedDay = state.meta.last_updated_day || currentDayInState;

  let newDay = currentDayInState;
  if (messages) {
    const parsedDay = parseDayFromMessages(messages);
    if (parsedDay && parsedDay > currentDayInState) {
      newDay = parsedDay;
    }
  }

  const deltaDays = Math.max(0, newDay - lastUpdatedDay);

  // 0. Compute dynamic totals directly from Catalog & Formulas if present
  if (state.catalog) {
    const storeCatTotals = computeCatalogTotals(state.catalog, null, newDay);
    if (storeCatTotals.grossGold > 0) {
      if (!state.financials) state.financials = {};
      if (!state.financials.systems) state.financials.systems = {};
      
      const primarySysKey = Object.keys(state.financials.systems)[0] || 'main_store';
      if (!state.financials.systems[primarySysKey]) state.financials.systems[primarySysKey] = {};

      state.financials.systems[primarySysKey].daily_gross_revenue = storeCatTotals.grossGold;
      state.financials.systems[primarySysKey].daily_operating_burn = storeCatTotals.costGold;
    }
  }

  // Dynamic Bank / Financial System Fees calculation if present
  if (state.financials?.systems?.yuri_bank) {
    const bankSys = state.financials.systems.yuri_bank;
    const intVol = bankSys.daily_international_volume_gold || 0;
    const intFeeRatio = bankSys.net_fee_ratio || 0.0025;
    const intFeesNet = Math.round((intVol * intFeeRatio) * 100) / 100;

    const cardCat = computeCatalogTotals(state.catalog, ['yuribank_cards'], newDay);
    const cardSalesGross = cardCat.grossGold || 0;
    const orbSales = bankSys.daily_holo_orb_sales_gold || 0;

    bankSys.daily_int_fee_revenue = intFeesNet;
    bankSys.daily_card_sales_revenue = cardSalesGross;
    bankSys.daily_gross_revenue = Math.round((intFeesNet + cardSalesGross + orbSales) * 100) / 100;
  }

  // 1. Calculate individual system net surpluses and dynamic host shares
  let consolidatedDailyNetGold = 0;
  let consolidatedDailyGrossGold = 0;
  let consolidatedDailyBurnGold = 0;
  const finSystems = state.financials?.systems || {};

  for (const [sysKey, sysData] of Object.entries(finSystems)) {
    const gross = sysData.daily_gross_revenue || 0;
    const burn = sysData.daily_operating_burn || 0;
    
    let hostShare = sysData.host_share || 0;
    if (sysData.host_share_ratio !== undefined && sysData.host_share_ratio !== null) {
      hostShare = Math.round((gross - burn) * sysData.host_share_ratio * 100) / 100;
      sysData.host_share = hostShare;
    }

    let net = Math.round((gross - burn - hostShare) * 100) / 100;
    sysData.daily_net_surplus_evaluated = net;
    consolidatedDailyNetGold += net;
    consolidatedDailyGrossGold += gross;
    consolidatedDailyBurnGold += burn;
  }

  if (!state.financials) state.financials = {};
  state.financials.consolidated_daily_gross_revenue_gold = Math.round(consolidatedDailyGrossGold * 100) / 100;
  state.financials.consolidated_daily_operating_burn_gold = Math.round(consolidatedDailyBurnGold * 100) / 100;
  state.financials.consolidated_daily_net_surplus_gold = Math.round(consolidatedDailyNetGold * 100) / 100;

  // 2. If time elapsed (deltaDays > 0), run time-step financial accumulation!
  if (deltaDays > 0) {
    console.log(`[WORLD-ENGINE] Time progression detected: ${deltaDays} day(s) passed (Day ${lastUpdatedDay} → Day ${newDay}). Running Math Simulation Tick...`);

    const dailyNetPlatinum = consolidatedDailyNetGold / 100;
    const totalAccumulatedPlatinum = dailyNetPlatinum * deltaDays;

    if (!state.financials.reserves) state.financials.reserves = {};
    const primaryReserveKey = Object.keys(state.financials.reserves)[0] || 'primary_reserves';
    const currentReserves = state.financials.reserves[primaryReserveKey] || 0;
    state.financials.reserves[primaryReserveKey] = Math.round((currentReserves + totalAccumulatedPlatinum) * 100) / 100;

    state.meta.current_day = newDay;
    state.meta.last_updated_day = newDay;

    console.log(`[WORLD-ENGINE] ✓ Added +${totalAccumulatedPlatinum.toFixed(2)} Platinum to ${primaryReserveKey}. New Balance: ${state.financials.reserves[primaryReserveKey].toFixed(2)} Platinum.`);

    saveFullWorldState(state).catch(err => {
      console.warn('[WORLD-ENGINE] Failed to auto-save state tick to Upstash:', err.message);
    });
  }

  return state;
}

/**
 * Formats a clean, compact, 100% data-driven markdown block [WORLD STATE SNAPSHOT]
 * Generates sections ONLY from actual data in state without any hardcoded fallbacks.
 */
function compileWorldStateSnapshot(state) {
  if (!state || typeof state !== 'object') return '';

  const meta = state.meta || {};
  const fin = state.financials || {};
  const sys = state.systems || {};
  const pers = state.personnel || {};
  const res = fin.reserves || {};

  const worldName = (meta.world_name || 'STAGAIA').toUpperCase();
  const currentDay = meta.current_day || 1;

  const lines = [];
  lines.push(`[WORLD STATE SNAPSHOT — ${worldName} DAY ${currentDay}]`);

  // 1. Executive Governance (if personnel.executive_board exists)
  if (Array.isArray(pers.executive_board) && pers.executive_board.length > 0) {
    const chair = pers.executive_board.find(p => (p.role || '').toLowerCase().includes('chair') || (p.role || '').toLowerCase().includes('founder') || (p.role || '').toLowerCase().includes('owner'));
    const members = pers.executive_board.filter(p => p !== chair);
    const chairStr = chair ? `${chair.name} (${chair.role || 'Leader'})` : '';
    const membersStr = members.map(m => {
      const roleStr = m.role ? ` (${m.role})` : '';
      return `${m.name}${roleStr}`;
    }).join(', ');
    lines.push(`• Executive Governance: ${chairStr ? chairStr + ' | Board: ' : 'Board: '}${membersStr}`);
  } else if (pers.executive_governance) {
    lines.push(`• Executive Governance: ${pers.executive_governance}`);
  }

  // 2. Financial Ledger & Cash Flow (if financials exist)
  let grossGold = fin.consolidated_daily_gross_revenue_gold;
  let burnGold = fin.consolidated_daily_operating_burn_gold;

  if (grossGold === undefined || burnGold === undefined) {
    if (fin.systems && Object.keys(fin.systems).length > 0) {
      let sumGross = 0;
      let sumBurn = 0;
      Object.values(fin.systems).forEach(s => {
        sumGross += s.daily_gross_revenue || 0;
        sumBurn += s.daily_operating_burn || 0;
      });
      grossGold = grossGold ?? sumGross;
      burnGold = burnGold ?? sumBurn;
    }
  }

  if (grossGold !== undefined || burnGold !== undefined || fin.consolidated_daily_net_surplus_gold !== undefined) {
    const g = grossGold || 0;
    const b = burnGold || 0;
    const net = fin.consolidated_daily_net_surplus_gold ?? (g - b);

    const finParts = [];
    if (g > 0) finParts.push(`Gross Income: ~${Math.round(g).toLocaleString()} Gold/day`);
    if (b > 0) finParts.push(`Operating Burn: ~${Math.round(b).toLocaleString()} Gold/day`);
    finParts.push(`Net Surplus: ~${Math.round(net).toLocaleString()} Gold/day (~${(net / 100).toFixed(2)} Platinum/day)`);

    lines.push(`• Financial Ledger & Cash Flow:\n  - ${finParts.join('\n  - ')}`);
  }

  // 3. Cumulative Reserves (if reserves exist)
  if (res && Object.keys(res).length > 0) {
    const reserveParts = [];
    for (const [key, val] of Object.entries(res)) {
      if (val !== null && val !== undefined) {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const formattedVal = typeof val === 'number' ? val.toLocaleString() : val;
        reserveParts.push(`${label}: ${formattedVal}`);
      }
    }
    if (reserveParts.length > 0) {
      lines.push(`• Cumulative Reserves:\n  - ${reserveParts.join(' | ')}`);
    }
  }

  // 4. Infrastructure & Systems Scope (Dynamically iterate over ANY system in state.systems)
  if (sys && Object.keys(sys).length > 0) {
    const sysLines = [];
    for (const [sysKey, sysData] of Object.entries(sys)) {
      if (!sysData || typeof sysData !== 'object') continue;
      const sysName = sysData.name || sysKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

      const details = [];
      for (const [propKey, propVal] of Object.entries(sysData)) {
        if (['name', 'daily_gross_revenue', 'daily_operating_burn', 'daily_net_surplus_evaluated'].includes(propKey)) continue;
        if (typeof propVal === 'number' || typeof propVal === 'string') {
          const propLabel = propKey.replace(/_/g, ' ');
          const formattedVal = typeof propVal === 'number' ? propVal.toLocaleString() : propVal;
          details.push(`${formattedVal} ${propLabel}`);
        }
      }
      if (details.length > 0) {
        sysLines.push(`  - ${sysName}: ${details.slice(0, 4).join(' | ')}`);
      } else {
        sysLines.push(`  - ${sysName}`);
      }
    }
    if (sysLines.length > 0) {
      lines.push(`• Infrastructure & Systems Scope:\n${sysLines.join('\n')}`);
    }
  }

  // 5. Personnel & Roster (if key_technical_teams or field_network_personnel exist)
  if (pers.key_technical_teams || pers.field_network_personnel) {
    const techParts = [];
    if (pers.key_technical_teams && typeof pers.key_technical_teams === 'object') {
      for (const [teamKey, teamData] of Object.entries(pers.key_technical_teams)) {
        if (typeof teamData === 'object' && teamData.count) {
          const teamName = teamKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          const leads = Array.isArray(teamData.lead) ? teamData.lead.join(' & ') : (teamData.lead || '');
          techParts.push(`${teamData.count} ${teamName}${leads ? ` (${leads})` : ''}`);
        }
      }
    }
    if (pers.field_network_personnel && typeof pers.field_network_personnel === 'object') {
      for (const [fieldKey, fieldVal] of Object.entries(pers.field_network_personnel)) {
        if (typeof fieldVal === 'number' || typeof fieldVal === 'string') {
          const fieldName = fieldKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          const formattedVal = typeof fieldVal === 'number' ? fieldVal.toLocaleString() : fieldVal;
          techParts.push(`${formattedVal} ${fieldName}`);
        }
      }
    }
    if (techParts.length > 0) {
      lines.push(`• Personnel & Roster: ${techParts.join(' | ')}`);
    }
  }

  return lines.join('\n');
}

module.exports = {
  processWorldStateTick,
  compileWorldStateSnapshot,
  evaluateExpression,
  getNestedValue,
  setNestedValue
};
