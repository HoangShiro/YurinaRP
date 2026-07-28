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
 * Calculates dynamic values, maintenance costs, and subscription revenues for infrastructure/scale metrics.
 */
function calculateInfrastructureMetrics(infrastructure, currentDay, options = {}) {
  if (!Array.isArray(infrastructure) || infrastructure.length === 0) {
    return { calculatedItems: [], metricsMap: new Map(), totalMaintenanceCost: 0, totalSubscriptionRevenue: 0 };
  }

  const defaultCurrency = options.currency || 'Copper';
  let totalMaintenanceCost = 0;
  let totalSubscriptionRevenue = 0;
  const calculatedItems = [];
  const metricsMap = new Map();

  infrastructure.forEach(item => {
    const itemCurrency = item.currency || defaultCurrency;
    const baseValue = Number(item.base_value) || 0;
    const startDate = Number(item.start_date) || 1;
    const dailyGrowth = Number(item.daily_growth) || 0;
    
    let currentValue = baseValue;

    // Calculate daily growth if currentDay is past start_date
    if (currentDay !== null && currentDay >= startDate && dailyGrowth > 0) {
      const elapsedDays = currentDay - startDate;
      currentValue += elapsedDays * dailyGrowth;
    }

    // Evaluate milestone overrides if defined
    let activeMilestone = null;
    if (Array.isArray(item.milestones) && currentDay !== null) {
      const sortedMilestones = [...item.milestones].sort((a, b) => b.day - a.day);
      const reached = sortedMilestones.find(m => currentDay >= m.day);
      if (reached) {
        activeMilestone = reached;
        if (typeof reached.value === 'number') {
          currentValue = reached.value;
        }
      }
    }

    // Financial calculations
    const maintenanceRate = Number(item.maintenance_cost_per_unit) || 0;
    const subscriptionRate = Number(item.subscription_revenue_per_unit) || 0;

    const maintenanceCost = Math.round(currentValue * maintenanceRate);
    const subscriptionRevenue = Math.round(currentValue * subscriptionRate);

    totalMaintenanceCost += maintenanceCost;
    totalSubscriptionRevenue += subscriptionRevenue;

    const computedObj = {
      ...item,
      currency: itemCurrency,
      calculated_value: currentValue,
      active_milestone: activeMilestone,
      calculated_maintenance_cost: maintenanceCost,
      calculated_subscription_revenue: subscriptionRevenue
    };

    calculatedItems.push(computedObj);

    if (item.id) {
      metricsMap.set(item.id, computedObj);
    }
  });

  return {
    calculatedItems,
    metricsMap,
    totalMaintenanceCost,
    totalSubscriptionRevenue
  };
}

/**
 * Calculates dynamic business metrics for catalog items based on current day and linked infrastructure metrics.
 */
function calculateCatalogMetrics(catalog, currentDay, options = {}, resolvedMetricsMap = new Map()) {
  if (!Array.isArray(catalog) || catalog.length === 0) {
    return { calculatedItems: [], totalGrossCopper: 0, totalNetCopper: 0, totalGross: 0, totalCost: 0, totalFees: 0, totalNet: 0, currency: options.currency || 'Copper' };
  }

  const defaultDaysPerMonth = options.daysPerMonth || 30;
  const defaultCurrency = options.currency || 'Copper';

  let totalGross = 0;
  let totalCost = 0;
  const calculatedItems = [];
  const feeItems = [];

  // Pass 1: Standard Retail & Ticket Items
  catalog.forEach(item => {
    const itemCurrency = item.currency || defaultCurrency;
    const daysInMonth = Number(item.days_per_month) || defaultDaysPerMonth;

    if (item.type === 'fee_revenue_share' || item.type === 'fee') {
      feeItems.push(item);
      return;
    }

    const price = Number(item.price ?? item.price_copper) || 0;
    const unitCost = Number(item.unit_cost ?? item.unit_cost_copper) || 0;
    
    // Base daily units sold
    let baseDailySold = (item.sold_out || (currentDay !== null && item.start_date && currentDay < item.start_date))
      ? 0
      : (Number(item.daily_units_sold) || 0);

    let demandBoostedUnits = baseDailySold;
    let demandBoostInfo = null;

    // Apply Demand Binding (if linked to an infrastructure/scale metric)
    if (item.demand_binding && item.demand_binding.metric_id && baseDailySold > 0) {
      const metricObj = resolvedMetricsMap.get(item.demand_binding.metric_id);
      if (metricObj) {
        const metricVal = metricObj.calculated_value || 0;
        const boostPer1k = Number(item.demand_binding.boost_per_1k_units) || 0;
        const boostPct = (metricVal / 1000) * boostPer1k;
        demandBoostedUnits = Math.round(baseDailySold * (1 + boostPct));
        demandBoostInfo = {
          metric_name: metricObj.name || item.demand_binding.metric_id,
          metric_value: metricVal,
          boost_pct: Math.round(boostPct * 100)
        };
      }
    }

    let effectiveDailySold = demandBoostedUnits;
    let capacityInfo = null;

    // Apply Capacity Binding (if capped by an infrastructure/scale metric)
    if (item.capacity_binding && item.capacity_binding.metric_id) {
      const metricObj = resolvedMetricsMap.get(item.capacity_binding.metric_id);
      if (metricObj) {
        const metricVal = metricObj.calculated_value || 0;
        const unitsPerMetric = Number(item.capacity_binding.units_per_metric) || 0;
        const capacityCap = Math.round(metricVal * unitsPerMetric);
        
        const isCapped = demandBoostedUnits > capacityCap;
        effectiveDailySold = Math.min(demandBoostedUnits, capacityCap);

        capacityInfo = {
          metric_name: metricObj.name || item.capacity_binding.metric_id,
          metric_value: metricVal,
          capacity_cap: capacityCap,
          is_capped: isCapped
        };
      }
    }

    const gross = price * effectiveDailySold;
    const cost = unitCost * effectiveDailySold;
    const profit = gross - cost;
    const monthlySold = effectiveDailySold * daysInMonth;

    totalGross += gross;
    totalCost += cost;

    calculatedItems.push({
      ...item,
      price,
      unit_cost: unitCost,
      currency: itemCurrency,
      base_daily_units_sold: baseDailySold,
      effective_daily_units_sold: effectiveDailySold,
      demand_boost_info: demandBoostInfo,
      capacity_info: capacityInfo,
      calculated_daily_gross: gross,
      calculated_daily_cost: cost,
      calculated_daily_profit: profit,
      calculated_monthly_units_sold: monthlySold
    });
  });

  // Pass 2: Fee & Revenue Share Items
  let totalFees = 0;
  feeItems.forEach(item => {
    const itemCurrency = item.currency || defaultCurrency;
    let feeAmount = 0;
    const valStr = String(item.value || '0').trim();

    if (valStr.endsWith('%')) {
      const pct = parseFloat(valStr.replace('%', '')) || 0;
      feeAmount = Math.round(totalGross * (pct / 100));
    } else {
      feeAmount = parseInt(valStr, 10) || 0;
    }

    totalFees += feeAmount;

    calculatedItems.push({
      ...item,
      currency: itemCurrency,
      calculated_fee_amount: feeAmount
    });
  });

  const totalNet = totalGross - totalCost + totalFees;

  return {
    calculatedItems,
    totalGrossCopper: totalGross,
    totalCostCopper: totalCost,
    totalFeesCopper: totalFees,
    totalNetCopper: totalNet,
    totalGross,
    totalCost,
    totalFees,
    totalNet,
    currency: defaultCurrency
  };
}

/**
 * Formats full detail text for a single Lore item.
 */
function formatLoreDetailedText(lore, currentDay, options = {}) {
  const lines = [];
  const area = lore.prompt_area || {};
  const currency = area.currency || options.currency || 'Copper';
  const daysPerMonth = area.days_per_month || options.daysPerMonth || 30;

  lines.push(`--- LORE DETAILED: ${lore.name} ---`);
  if (lore.group) lines.push(`Group: ${lore.group}`);
  if (area.definition) lines.push(`Definition: ${area.definition}`);

  // 1. Infrastructure & Scale Metrics Formatting
  let infraMetricsMap = new Map();
  let infraCalc = null;
  const infraArray = area.infrastructure || area.scale_metrics;
  if (Array.isArray(infraArray) && infraArray.length > 0) {
    infraCalc = calculateInfrastructureMetrics(infraArray, currentDay, { currency });
    infraMetricsMap = infraCalc.metricsMap;

    lines.push(`\n[INFRASTRUCTURE & SCALE METRICS${currentDay ? ` (Day ${currentDay})` : ''}]`);
    infraCalc.calculatedItems.forEach(item => {
      const unitStr = item.unit ? ` ${item.unit}` : '';
      const growthStr = item.daily_growth ? ` (+${item.daily_growth}${unitStr}/day)` : '';
      const milestoneStr = item.active_milestone?.label ? ` (Milestone Day ${item.active_milestone.day}: ${item.active_milestone.label})` : '';
      
      let finNote = '';
      if (item.calculated_maintenance_cost > 0) {
        finNote += ` | Maintenance Cost: -${item.calculated_maintenance_cost.toLocaleString()} ${currency}/day`;
      }
      if (item.calculated_subscription_revenue > 0) {
        finNote += ` | Subscription Income: +${item.calculated_subscription_revenue.toLocaleString()} ${currency}/day`;
      }

      lines.push(`- ${item.name}: ${item.calculated_value.toLocaleString()}${unitStr}${growthStr}${milestoneStr}${finNote}${item.description ? ` (${item.description})` : ''}`);
    });

    if (infraCalc.totalMaintenanceCost > 0) {
      lines.push(`* Total Infrastructure Maintenance: -${infraCalc.totalMaintenanceCost.toLocaleString()} ${currency}/day`);
    }
    if (infraCalc.totalSubscriptionRevenue > 0) {
      lines.push(`* Total Infrastructure Subscription Income: +${infraCalc.totalSubscriptionRevenue.toLocaleString()} ${currency}/day`);
    }
  }

  // 2. Catalog Formatting (with Infrastructure metrics binding)
  if (Array.isArray(area.catalog) && area.catalog.length > 0) {
    const calc = calculateCatalogMetrics(area.catalog, currentDay, { currency, daysPerMonth }, infraMetricsMap);
    lines.push(`\n[CATALOG & BUSINESS METRICS${currentDay ? ` (Day ${currentDay})` : ''}]`);

    calc.calculatedItems.forEach(item => {
      const itemCurrency = item.currency || currency;
      if (item.type === 'fee_revenue_share' || item.type === 'fee') {
        lines.push(`- ${item.name} (${item.value}): ${item.calculated_fee_amount >= 0 ? '+' : ''}${item.calculated_fee_amount.toLocaleString()} ${itemCurrency} (${item.description || ''})`);
      } else {
        const itemPrice = item.price ?? item.price_copper;
        let noteStr = '';
        if (item.capacity_info?.is_capped) {
          noteStr += ` [⚠️ CAPPED by ${item.capacity_info.metric_name}: max ${item.capacity_info.capacity_cap.toLocaleString()} units]`;
        } else if (item.demand_boost_info?.boost_pct > 0) {
          noteStr += ` [📈 BOOSTED +${item.demand_boost_info.boost_pct}% by ${item.demand_boost_info.metric_name}]`;
        }

        lines.push(`- ${item.name}: Price ${itemPrice?.toLocaleString()} ${itemCurrency} | Daily Sold: ${item.effective_daily_units_sold.toLocaleString()}${noteStr} | Daily Gross: ${item.calculated_daily_gross?.toLocaleString()} ${itemCurrency}`);
      }
    });

    // Net accounting including infra maintenance & subscription
    const infraMaint = infraCalc ? infraCalc.totalMaintenanceCost : 0;
    const infraSub = infraCalc ? infraCalc.totalSubscriptionRevenue : 0;
    const netSurplusWithInfra = calc.totalNet - infraMaint + infraSub;

    lines.push(`* Catalog Daily Gross: ${calc.totalGross.toLocaleString()} ${currency}`);
    lines.push(`* Net Daily Surplus: ${netSurplusWithInfra.toLocaleString()} ${currency}`);
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
 * Builds a hierarchical parent-child tree structure from an array of lore items.
 * A lore can reference a parent lore via parent_id, parent_name, or group matching another lore's id/name.
 */
function buildLoreHierarchy(lores) {
  if (!Array.isArray(lores) || lores.length === 0) {
    return { rootNodes: [], nodeMap: new Map(), loreMap: new Map(), flatGroupsMap: new Map() };
  }

  const loreMap = new Map();
  const nodeMap = new Map();

  // Index all lores by id and name
  lores.forEach(l => {
    if (l.id) loreMap.set(String(l.id).toLowerCase().trim(), l);
    if (l.name) loreMap.set(String(l.name).toLowerCase().trim(), l);

    nodeMap.set(l, {
      lore: l,
      children: [],
      parentNode: null,
      path: []
    });
  });

  const rootNodes = [];
  const flatGroupsMap = new Map();

  lores.forEach(l => {
    const node = nodeMap.get(l);
    const parentRef = (l.parent_id || l.parent_name || l.group || '').trim().toLowerCase();

    // Check if parentRef matches an existing Lore
    const parentLore = parentRef ? loreMap.get(parentRef) : null;

    if (parentLore && parentLore !== l) {
      const parentNode = nodeMap.get(parentLore);
      if (parentNode) {
        parentNode.children.push(node);
        node.parentNode = parentNode;
      } else {
        rootNodes.push(node);
      }
    } else {
      const grpName = l.group || 'General';
      if (!flatGroupsMap.has(grpName)) {
        flatGroupsMap.set(grpName, []);
      }
      flatGroupsMap.get(grpName).push(node);

      // Only add as root if it doesn't have a parent
      if (!node.parentNode) {
        rootNodes.push(node);
      }
    }
  });

  // Calculate breadcrumb paths
  function computePaths(node, currentPath = []) {
    const nameStr = node.lore.name || node.lore.id || 'Lore';
    if (currentPath.includes(nameStr)) return; // Prevent infinite loops on cyclic refs
    const newPath = [...currentPath, nameStr];
    node.path = newPath;
    node.children.forEach(child => computePaths(child, newPath));
  }

  // Deduplicate root nodes while preserving order
  const uniqueRoots = Array.from(new Set(rootNodes.filter(n => !n.parentNode)));

  uniqueRoots.forEach(node => computePaths(node, []));

  return {
    rootNodes: uniqueRoots,
    nodeMap,
    loreMap,
    flatGroupsMap
  };
}

/**
 * Helper to recursively format a lore tree node for Markdown output.
 */
function formatLoreTreeNode(node, depth, status) {
  const lines = [];
  const indent = '  '.repeat(depth);
  const prefix = depth === 0 ? '📁 ' : (node.children.length > 0 ? '📂 ' : '📄 ');
  const lore = node.lore;

  if (status === 'Active') {
    lines.push(`${indent}- ${prefix}${lore.name}`);
    if (lore.prompt_area?.definition) {
      lines.push(`${indent}  * Definition: ${lore.prompt_area.definition}`);
    }
  } else if (status === 'Summary' || status === 'All') {
    lines.push(`${indent}- ${prefix}${lore.name}`);
  }

  node.children.forEach(child => {
    lines.push(...formatLoreTreeNode(child, depth + 1, status));
  });

  return lines;
}

/**
 * Formats full detail text for a single Lore item.
 */
function formatLoreDetailedText(lore, currentDay, options = {}, hierarchyNode = null) {
  const lines = [];
  const area = lore.prompt_area || {};
  const currency = area.currency || options.currency || 'Copper';
  const daysPerMonth = area.days_per_month || options.daysPerMonth || 30;

  lines.push(`--- LORE DETAILED: ${lore.name} ---`);
  if (hierarchyNode && hierarchyNode.path && hierarchyNode.path.length > 1) {
    lines.push(`Hierarchy Path: ${hierarchyNode.path.join(' > ')}`);
  }
  if (lore.group) lines.push(`Group: ${lore.group}`);
  if (area.definition) lines.push(`Definition: ${area.definition}`);

  // 1. Infrastructure & Scale Metrics Formatting
  let infraMetricsMap = new Map();
  let infraCalc = null;
  const infraArray = area.infrastructure || area.scale_metrics;
  if (Array.isArray(infraArray) && infraArray.length > 0) {
    infraCalc = calculateInfrastructureMetrics(infraArray, currentDay, { currency });
    infraMetricsMap = infraCalc.metricsMap;

    lines.push(`\n[INFRASTRUCTURE & SCALE METRICS${currentDay ? ` (Day ${currentDay})` : ''}]`);
    infraCalc.calculatedItems.forEach(item => {
      const unitStr = item.unit ? ` ${item.unit}` : '';
      const growthStr = item.daily_growth ? ` (+${item.daily_growth}${unitStr}/day)` : '';
      const milestoneStr = item.active_milestone?.label ? ` (Milestone Day ${item.active_milestone.day}: ${item.active_milestone.label})` : '';
      
      let finNote = '';
      if (item.calculated_maintenance_cost > 0) {
        finNote += ` | Maintenance Cost: -${item.calculated_maintenance_cost.toLocaleString()} ${currency}/day`;
      }
      if (item.calculated_subscription_revenue > 0) {
        finNote += ` | Subscription Income: +${item.calculated_subscription_revenue.toLocaleString()} ${currency}/day`;
      }

      lines.push(`- ${item.name}: ${item.calculated_value.toLocaleString()}${unitStr}${growthStr}${milestoneStr}${finNote}${item.description ? ` (${item.description})` : ''}`);
    });

    if (infraCalc.totalMaintenanceCost > 0) {
      lines.push(`* Total Infrastructure Maintenance: -${infraCalc.totalMaintenanceCost.toLocaleString()} ${currency}/day`);
    }
    if (infraCalc.totalSubscriptionRevenue > 0) {
      lines.push(`* Total Infrastructure Subscription Income: +${infraCalc.totalSubscriptionRevenue.toLocaleString()} ${currency}/day`);
    }
  }

  // 2. Catalog Formatting (with Infrastructure metrics binding)
  if (Array.isArray(area.catalog) && area.catalog.length > 0) {
    const calc = calculateCatalogMetrics(area.catalog, currentDay, { currency, daysPerMonth }, infraMetricsMap);
    lines.push(`\n[CATALOG & BUSINESS METRICS${currentDay ? ` (Day ${currentDay})` : ''}]`);

    calc.calculatedItems.forEach(item => {
      const itemCurrency = item.currency || currency;
      if (item.type === 'fee_revenue_share' || item.type === 'fee') {
        lines.push(`- ${item.name} (${item.value}): ${item.calculated_fee_amount >= 0 ? '+' : ''}${item.calculated_fee_amount.toLocaleString()} ${itemCurrency} (${item.description || ''})`);
      } else {
        const itemPrice = item.price ?? item.price_copper;
        let noteStr = '';
        if (item.capacity_info?.is_capped) {
          noteStr += ` [⚠️ CAPPED by ${item.capacity_info.metric_name}: max ${item.capacity_info.capacity_cap.toLocaleString()} units]`;
        } else if (item.demand_boost_info?.boost_pct > 0) {
          noteStr += ` [📈 BOOSTED +${item.demand_boost_info.boost_pct}% by ${item.demand_boost_info.metric_name}]`;
        }

        lines.push(`- ${item.name}: Price ${itemPrice?.toLocaleString()} ${itemCurrency} | Daily Sold: ${item.effective_daily_units_sold.toLocaleString()}${noteStr} | Daily Gross: ${item.calculated_daily_gross?.toLocaleString()} ${itemCurrency}`);
      }
    });

    // Net accounting including infra maintenance & subscription
    const infraMaint = infraCalc ? infraCalc.totalMaintenanceCost : 0;
    const infraSub = infraCalc ? infraCalc.totalSubscriptionRevenue : 0;
    const netSurplusWithInfra = calc.totalNet - infraMaint + infraSub;

    lines.push(`* Catalog Daily Gross: ${calc.totalGross.toLocaleString()} ${currency}`);
    lines.push(`* Net Daily Surplus: ${netSurplusWithInfra.toLocaleString()} ${currency}`);
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

  // Build Hierarchical Tree
  const hierarchy = buildLoreHierarchy(lores);

  // Mode 1: ALL — Full dump of all lores without trigger checks
  if (status === 'All') {
    const lines = [];
    lines.push(`[LOREBOOK: ${lorebook.name}]`);
    if (lorebook.description) lines.push(`Description: ${lorebook.description}`);
    if (currentDay !== null) lines.push(`Current System Date: Day ${currentDay}`);

    lines.push(`\n== LORE HIERARCHY STRUCTURE ==`);
    hierarchy.rootNodes.forEach(root => {
      lines.push(...formatLoreTreeNode(root, 0, 'Summary'));
    });

    lores.forEach(lore => {
      const hNode = hierarchy.nodeMap.get(lore);
      lines.push(`\n${formatLoreDetailedText(lore, currentDay, settings, hNode)}`);
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
  if (currentDay !== null) lines.push(`* Current System Date: Day ${currentDay}`);

  lines.push(`\n[HIERARCHICAL GROUPS & LORE STRUCTURE]`);
  hierarchy.rootNodes.forEach(root => {
    lines.push(...formatLoreTreeNode(root, 0, status));
  });

  // Append Triggered Lores Details
  if (triggeredLores.length > 0) {
    lines.push(`\n=== TRIGGERED LORE DETAILS ===`);
    triggeredLores.forEach(lore => {
      const hNode = hierarchy.nodeMap.get(lore);
      lines.push(`\n${formatLoreDetailedText(lore, currentDay, settings, hNode)}`);
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

/**
 * Checks if World State Snapshot should be included based on active Lorebooks.
 * World State is included IF at least one active Lorebook (status !== 'Off')
 * explicitly has settings.include_world_state !== false (defaults to true).
 */
function shouldIncludeWorldState(store) {
  if (!store || !Array.isArray(store.lorebooks) || store.lorebooks.length === 0) {
    return false;
  }
  return store.lorebooks.some(lb => {
    const status = (lb.status || 'Active').trim();
    if (status === 'Off' || status === 'None') return false;
    
    if (typeof lb.settings?.include_world_state === 'boolean') {
      return lb.settings.include_world_state;
    }
    return true;
  });
}

module.exports = {
  extractCurrentDay,
  buildLoreHierarchy,
  calculateInfrastructureMetrics,
  calculateCatalogMetrics,
  formatLoreDetailedText,
  isLoreTriggered,
  compileLorebook,
  compileLorebookStore,
  isLorebookStoreActive,
  shouldIncludeWorldState
};
