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
function computeCatalogTotals(catalog, targetCategories = null) {
  if (!catalog) return { grossGold: 0, costGold: 0, netGold: 0 };
  let totalGrossCopper = 0;
  let totalCostCopper = 0;

  const categories = targetCategories || ['retail_items', 'fast_food_menu', 'restaurant_menu', 'cosmetics_and_perfumes', 'yuribank_cards'];

  for (const cat of categories) {
    const list = catalog[cat];
    if (Array.isArray(list)) {
      for (const item of list) {
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
  if (!state || !state.meta || !state.financials) return state;

  const currentDayInState = state.meta.current_day || 242;
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
    const storeCatTotals = computeCatalogTotals(state.catalog, ['retail_items', 'fast_food_menu', 'restaurant_menu']);
    if (storeCatTotals.grossGold > 0) {
      if (!state.financials.systems) state.financials.systems = {};
      if (!state.financials.systems.yuri_store) state.financials.systems.yuri_store = {};
      
      // Dynamically set yuri_store figures using catalog sum
      state.financials.systems.yuri_store.daily_gross_revenue = storeCatTotals.grossGold;
      state.financials.systems.yuri_store.daily_operating_burn = storeCatTotals.costGold;
    }
  }

  // Dynamic YuriBank Revenue Formula (Int Fees + Cards + Holo Orbs)
  if (state.financials?.systems?.yuri_bank) {
    const bankSys = state.financials.systems.yuri_bank;
    const intVol = bankSys.daily_international_volume_gold || 39200000;
    const intFeeRatio = bankSys.net_fee_ratio || 0.0025; // 0.25% net YuriBank share
    const intFeesNet = Math.round((intVol * intFeeRatio) * 100) / 100; // ~98,000 Gold

    const cardCat = computeCatalogTotals(state.catalog, ['yuribank_cards']);
    const cardSalesGross = cardCat.grossGold || 135000;
    const orbSales = bankSys.daily_holo_orb_sales_gold || 3000;

    bankSys.daily_int_fee_revenue = intFeesNet;
    bankSys.daily_card_sales_revenue = cardSalesGross;
    bankSys.daily_gross_revenue = Math.round((intFeesNet + cardSalesGross + orbSales) * 100) / 100;
  }

  // 1. Calculate individual system net surpluses and dynamic host shares
  let consolidatedDailyNetGold = 0;
  const finSystems = state.financials?.systems || {};

  for (const [sysKey, sysData] of Object.entries(finSystems)) {
    const gross = sysData.daily_gross_revenue || 0;
    const burn = sysData.daily_operating_burn || 0;
    
    // Dynamic Host Nation Profit Share calculation if ratio exists
    let hostShare = sysData.host_share || 0;
    if (sysData.host_share_ratio !== undefined && sysData.host_share_ratio !== null) {
      hostShare = Math.round((gross - burn) * sysData.host_share_ratio * 100) / 100;
      sysData.host_share = hostShare; // Update dynamic host share
    }

    let net = Math.round((gross - burn - hostShare) * 100) / 100;
    sysData.daily_net_surplus_evaluated = net;
    consolidatedDailyNetGold += net;
  }

  state.financials.consolidated_daily_net_surplus_gold = Math.round(consolidatedDailyNetGold * 100) / 100;

  // 2. If time elapsed (deltaDays > 0), run time-step financial accumulation!
  if (deltaDays > 0) {
    console.log(`[WORLD-ENGINE] Time progression detected: ${deltaDays} day(s) passed (Day ${lastUpdatedDay} → Day ${newDay}). Running Math Simulation Tick...`);

    const dailyNetPlatinum = consolidatedDailyNetGold / 100;
    const totalAccumulatedPlatinum = dailyNetPlatinum * deltaDays;

    if (!state.financials.reserves) state.financials.reserves = {};
    const currentReserves = state.financials.reserves.ley_line_platinum || 308744.5;
    state.financials.reserves.ley_line_platinum = Math.round((currentReserves + totalAccumulatedPlatinum) * 100) / 100;

    // Update state meta days
    state.meta.current_day = newDay;
    state.meta.last_updated_day = newDay;

    console.log(`[WORLD-ENGINE] ✓ Added +${totalAccumulatedPlatinum.toFixed(2)} Platinum to Ley Line Reserves. New Balance: ${state.financials.reserves.ley_line_platinum.toFixed(2)} Platinum.`);

    // Persist updated state to Upstash Redis asynchronously
    saveFullWorldState(state).catch(err => {
      console.warn('[WORLD-ENGINE] Failed to auto-save state tick to Upstash:', err.message);
    });
  }

  return state;
}

/**
 * Formats a clean, compact markdown block [WORLD STATE SNAPSHOT] for System Prompt injection
 */
function compileWorldStateSnapshot(state) {
  if (!state || !state.meta || !state.financials) return '';

  const meta = state.meta;
  const fin = state.financials;
  const sys = state.systems || {};
  const pers = state.personnel || {};
  const res = fin.reserves || {};

  const consolidatedGold = fin.consolidated_daily_net_surplus_gold || 300513;
  const leyLinePlatinum = res.ley_line_platinum || 308744.5;

  return `[WORLD STATE SNAPSHOT — STAGAIA DAY ${meta.current_day || 242}]
• Executive Governance: Chairwoman Yurina Shirayuki | Board: Lyra (Finance), Seraphina (Affairs), Lillith (Transport), Elara (Health)
• Financial Ledger & Cash Flow (Daily):
  - Consolidated Daily Gross Income: ~389,104 Gold/day
  - Consolidated Daily Operating Burn: ~88,591 Gold/day
  - Consolidated Daily Net Surplus: ~${consolidatedGold.toLocaleString()} Gold/day (~${(consolidatedGold / 100).toFixed(2)} Platinum/day)
• Cumulative Reserves:
  - Ley Line Net Reserves: ~${leyLinePlatinum.toLocaleString()} Platinum (~${(leyLinePlatinum / 1000).toFixed(2)} Million Gold equivalent)
  - YuriStore Liquid Reserve: ~${res.store_liquid_platinum || 1225} Platinum | Guild Escrow: ~${res.guild_escrow_platinum || 260.15} Platinum
  - Material Reserves: Levium ${res.levium_reserve_kg || 320} kg | Yurium Superalloy ${res.yurium_reserve_kg || 70} kg
• Infrastructure & Network Scope:
  - YuriStation Transit: ${sys.yuri_station?.total_stations || 16277} Stations across 7 nations | ${sys.yuri_station?.road_network_km || 103000} km Highways
  - YuriTrain Railway: ${sys.yuri_train?.rail_network_km || 14000} km Rail | 6 Corridors | 200–450 km/h (50% Host Profit Share)
  - YuriAerial Network: ${sys.yuri_aerial?.phase_1_fleet_total || 101} Aircraft Fleet (Express 1,800km/h, Passenger, Cargo) across 16,277 airports
  - YuriBank & Holo Orb: ${sys.yuri_bank?.atms || 21277} ATMs | ${sys.yuri_bank?.branches || 21797} Branches | ${sys.yuri_bank?.cardholders_total || 88200000} Cardholders | ${sys.yuri_bank?.holo_orbs_deployed || 11247} Holo Orbs
  - Wand Leasing: ${sys.wand_leasing?.builder_wands_leased || 350} Builder Wands + ${sys.wand_leasing?.forging_stabilizer_pairs_leased || 26} Forging/Stabilizer Wand Pairs leased globally
• Core Technical Team: 30 Khaldor Master Engineers (Bruni & Durinn) | 59 Interior Specialists | 32 HQ Staff | 2,975 YuriERS Medical Staff`;
}

module.exports = {
  processWorldStateTick,
  compileWorldStateSnapshot,
  evaluateExpression,
  getNestedValue,
  setNestedValue
};
