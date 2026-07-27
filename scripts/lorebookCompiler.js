// lorebookCompiler.js — Tiered Lorebook Engine & Context Compiler
// Supports statuses: All, Active, Summary, Off

/**
 * Extracts current day integer from conversation messages using regex patterns.
 */
function extractCurrentDay(messages, patterns, depthScan = 2) {
  if (!Array.isArray(messages) || messages.length === 0) return null;

  const defaultPatterns = [
    /\[\s*🕒?\s*Day\s+(\d+)/i,
    /\[Day\s+(\d+)/i
  ];

  const regexes = (patterns && patterns.length > 0)
    ? patterns.map(p => new RegExp(p, 'i'))
    : defaultPatterns;

  const maxMessages = Math.min(messages.length, depthScan * 2);
  const recentMessages = messages.slice(-maxMessages);

  for (let i = recentMessages.length - 1; i >= 0; i--) {
    const msg = recentMessages[i];
    let text = '';
    if (typeof msg.content === 'string') {
      text = msg.content;
    } else if (Array.isArray(msg.content)) {
      text = msg.content
        .filter(part => part && part.type === 'text' && typeof part.text === 'string')
        .map(part => part.text)
        .join(' ');
    }

    if (!text) continue;

    for (const rx of regexes) {
      const match = text.match(rx);
      if (match && match[1]) {
        const dayNum = parseInt(match[1], 10);
        if (!isNaN(dayNum)) return dayNum;
      }
    }
  }

  return null;
}

/**
 * Calculates dynamic business metrics for catalog items based on current day.
 */
function calculateCatalogMetrics(catalog, currentDay) {
  if (!Array.isArray(catalog) || catalog.length === 0) {
    return { calculatedItems: [], totalGrossCopper: 0, totalNetCopper: 0 };
  }

  let totalGrossCopper = 0;
  let totalCostCopper = 0;
  const calculatedItems = [];
  const feeItems = [];

  // Pass 1: Standard Retail & Ticket Items
  catalog.forEach(item => {
    if (item.type === 'fee_revenue_share') {
      feeItems.push(item);
      return;
    }

    const price = Number(item.price_copper) || 0;
    const unitCost = Number(item.unit_cost_copper) || 0;
    const dailySold = (item.sold_out || (currentDay !== null && item.start_date && currentDay < item.start_date))
      ? 0
      : (Number(item.daily_units_sold) || 0);

    const gross = price * dailySold;
    const cost = unitCost * dailySold;
    const profit = gross - cost;
    const monthlySold = dailySold * 30;

    totalGrossCopper += gross;
    totalCostCopper += cost;

    calculatedItems.push({
      ...item,
      effective_daily_units_sold: dailySold,
      calculated_daily_gross: gross,
      calculated_daily_cost: cost,
      calculated_daily_profit: profit,
      calculated_monthly_units_sold: monthlySold
    });
  });

  // Pass 2: Fee & Revenue Share Items
  let totalFeesCopper = 0;
  feeItems.forEach(item => {
    let feeAmount = 0;
    const valStr = String(item.value || '0').trim();

    if (valStr.endsWith('%')) {
      const pct = parseFloat(valStr.replace('%', '')) || 0;
      feeAmount = Math.round(totalGrossCopper * (pct / 100));
    } else {
      feeAmount = parseInt(valStr, 10) || 0;
    }

    totalFeesCopper += feeAmount;

    calculatedItems.push({
      ...item,
      calculated_fee_amount: feeAmount
    });
  });

  const totalNetCopper = totalGrossCopper - totalCostCopper + totalFeesCopper;

  return {
    calculatedItems,
    totalGrossCopper,
    totalCostCopper,
    totalFeesCopper,
    totalNetCopper
  };
}

/**
 * Formats full detail text for a single Lore item.
 */
function formatLoreDetailedText(lore, currentDay) {
  const lines = [];
  const area = lore.prompt_area || {};

  lines.push(`--- LORE DETAILED: ${lore.name} ---`);
  if (lore.group) lines.push(`Group: ${lore.group}`);
  if (area.definition) lines.push(`Definition: ${area.definition}`);

  // Catalog Formatting
  if (Array.isArray(area.catalog) && area.catalog.length > 0) {
    const calc = calculateCatalogMetrics(area.catalog, currentDay);
    lines.push(`\n[CATALOG & BUSINESS METRICS${currentDay ? ` (Day ${currentDay})` : ''}]`);

    calc.calculatedItems.forEach(item => {
      if (item.type === 'fee_revenue_share') {
        lines.push(`- ${item.name} (${item.value}): ${item.calculated_fee_amount >= 0 ? '+' : ''}${item.calculated_fee_amount.toLocaleString()} Copper (${item.description || ''})`);
      } else {
        lines.push(`- ${item.name}: Price ${item.price_copper?.toLocaleString()} Copper | Daily Sold: ${item.effective_daily_units_sold} | Daily Gross: ${item.calculated_daily_gross?.toLocaleString()} Copper`);
      }
    });

    lines.push(`* Total Daily Gross: ${calc.totalGrossCopper.toLocaleString()} Copper`);
    lines.push(`* Net Daily Surplus: ${calc.totalNetCopper.toLocaleString()} Copper`);
  }

  // Staff Formatting
  if (area.staff && Object.keys(area.staff).length > 0) {
    lines.push(`\n[STAFF ROSTER]`);
    Object.entries(area.staff).forEach(([k, v]) => {
      lines.push(`- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
    });
  }

  // Policy Formatting
  if (area.policy && Object.keys(area.policy).length > 0) {
    lines.push(`\n[POLICIES & RULES]`);
    Object.entries(area.policy).forEach(([k, v]) => {
      lines.push(`- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
    });
  }

  // Custom Data
  if (area.custom_data && Object.keys(area.custom_data).length > 0) {
    lines.push(`\n[ADDITIONAL DATA]`);
    Object.entries(area.custom_data).forEach(([k, v]) => {
      lines.push(`- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
    });
  }

  return lines.join('\n');
}

/**
 * Checks whether a Lore item should trigger based on keyword search and trigger rate.
 */
function isLoreTriggered(lore, conversationText) {
  if (!lore.trigger) return true;

  const keywords = lore.trigger.keywords || [];
  if (keywords.length === 0) return true; // Empty keywords array = Always Active

  const textLower = (conversationText || '').toLowerCase();
  const matched = keywords.some(kw => textLower.includes(kw.toLowerCase()));

  if (!matched) return false;

  const rate = typeof lore.trigger.trigger_rate === 'number' ? lore.trigger.trigger_rate : 100;
  if (rate >= 100) return true;
  if (rate <= 0) return false;

  const roll = Math.floor(Math.random() * 100) + 1;
  return roll <= rate;
}

/**
 * Compiles a single Lorebook object into Markdown prompt context based on its status.
 */
function compileLorebook(lorebook, messages) {
  const status = (lorebook.status || 'Active').trim();
  if (status === 'Off' || status === 'None') {
    return { prompt: '', triggeredCount: 0, status };
  }

  const settings = lorebook.settings || {};
  const depthScan = settings.depth_scan || 2;
  const currentDay = extractCurrentDay(messages, settings.day_trigger_patterns, depthScan);

  const lores = Array.isArray(lorebook.lores) ? lorebook.lores : [];
  if (lores.length === 0) {
    return { prompt: '', triggeredCount: 0, status };
  }

  // Build Group map and resolve Group Head
  const groupsMap = new Map();
  lores.forEach(lore => {
    const grpName = lore.group || 'General';
    if (!groupsMap.has(grpName)) {
      groupsMap.set(grpName, {
        name: grpName,
        headLore: null,
        lores: []
      });
    }

    const grp = groupsMap.get(grpName);
    grp.lores.push(lore);
    if (lore.is_group_head || !grp.headLore) {
      grp.headLore = lore;
    }
  });

  // Mode 1: ALL — Full dump of all lores without trigger checks
  if (status === 'All') {
    const lines = [];
    lines.push(`[LOREBOOK: ${lorebook.name}]`);
    if (lorebook.description) lines.push(`Description: ${lorebook.description}`);
    if (currentDay !== null) lines.push(`Current System Date: Day ${currentDay}`);

    groupsMap.forEach(grp => {
      lines.push(`\n== GROUP: ${grp.name} ==`);
      if (grp.headLore && grp.headLore.prompt_area?.definition) {
        lines.push(`Group Definition: ${grp.headLore.prompt_area.definition}`);
      }

      grp.lores.forEach(lore => {
        lines.push(`\n${formatLoreDetailedText(lore, currentDay)}`);
      });
    });

    return { prompt: lines.join('\n'), triggeredCount: lores.length, status };
  }

  // Build text context for keyword scanning
  const recentMessages = messages.slice(- (depthScan * 2));
  const conversationText = recentMessages
    .map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '')))
    .join(' ');

  // Identify triggered lores
  const triggeredLores = [];
  lores.forEach(lore => {
    if (isLoreTriggered(lore, conversationText)) {
      triggeredLores.push(lore);
    }
  });

  // Mode 2: ACTIVE & Mode 3: SUMMARY
  const lines = [];
  lines.push(`[LOREBOOK: ${lorebook.name}]`);
  lines.push(`* Description: ${lorebook.description || 'N/A'}`);
  lines.push(`* Groups: ${Array.from(groupsMap.keys()).join(', ')}`);
  if (currentDay !== null) lines.push(`* Current System Date: Day ${currentDay}`);

  groupsMap.forEach(grp => {
    lines.push(`\n[GROUP: ${grp.name}]`);
    const groupDef = grp.headLore?.prompt_area?.definition || 'No group definition available.';
    lines.push(`* Group Definition: ${groupDef}`);

    if (status === 'Active') {
      lines.push(`* Lores in Group:`);
      grp.lores.forEach(l => {
        lines.push(`  - ${l.name}: ${l.prompt_area?.definition || 'No definition.'}`);
      });
    } else if (status === 'Summary') {
      const loreNames = grp.lores.map(l => l.name).join(', ');
      lines.push(`* Lores in Group: ${loreNames}`);
    }
  });

  // Append Triggered Lores Details
  if (triggeredLores.length > 0) {
    lines.push(`\n=== TRIGGERED LORE DETAILS ===`);
    triggeredLores.forEach(lore => {
      lines.push(`\n${formatLoreDetailedText(lore, currentDay)}`);
    });
  }

  return {
    prompt: lines.join('\n'),
    triggeredCount: triggeredLores.length,
    status
  };
}

/**
 * Main Entry Point: Compiles entire LorebookStore object against conversation messages.
 */
function compileLorebookStore(store, messages) {
  if (!store || !Array.isArray(store.lorebooks)) {
    return { compiledPrompt: '', insertionMode: 'context', activeCount: 0 };
  }

  const compiledSections = [];
  let insertionMode = 'context';
  let activeCount = 0;

  store.lorebooks.forEach(lb => {
    const res = compileLorebook(lb, messages);
    if (res.prompt && res.prompt.trim()) {
      compiledSections.push(res.prompt);
      activeCount += res.triggeredCount;
      if (lb.settings?.insertion_mode === 'user_msg') {
        insertionMode = 'user_msg';
      }
    }
  });

  return {
    compiledPrompt: compiledSections.join('\n\n---\n\n'),
    insertionMode,
    activeCount
  };
}

/**
 * Checks if at least one Lorebook in the store is operational (not 'Off' or 'None').
 */
function isLorebookStoreActive(store) {
  if (!store || !Array.isArray(store.lorebooks) || store.lorebooks.length === 0) {
    return false;
  }
  return store.lorebooks.some(lb => {
    const status = (lb.status || 'Active').trim();
    return status !== 'Off' && status !== 'None';
  });
}

module.exports = {
  extractCurrentDay,
  calculateCatalogMetrics,
  formatLoreDetailedText,
  isLoreTriggered,
  compileLorebook,
  compileLorebookStore,
  isLorebookStoreActive
};
