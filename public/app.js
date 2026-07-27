// app.js — Frontend Application Logic for Yuri Systems World State Manager

let stateData = null;
let currentSelectedDomain = 'meta';

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();

  initNavigation();
  initDomainSelector();
  initEventListeners();
  loadWorldState();
});

// Navigation Setup
function initNavigation() {
  const navButtons = document.querySelectorAll('.nav-item, .mobile-nav-item');
  const pages = document.querySelectorAll('.tab-page');
  const pageTitle = document.getElementById('pageTitle');

  const pageTitles = {
    dashboard: 'Dashboard & Time Simulation',
    lorebook: 'Lorebook & World State Engine',
    catalog: 'Product Catalog & Dynamic Pricing',
    mutations: 'State Mutations & Upstash Redis'
  };

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabTarget = btn.getAttribute('data-tab');

      navButtons.forEach(b => {
        if (b.getAttribute('data-tab') === tabTarget) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });

      pages.forEach(p => {
        if (p.id === `page-${tabTarget}`) {
          p.classList.add('active');
        } else {
          p.classList.remove('active');
        }
      });

      if (pageTitle && pageTitles[tabTarget]) {
        pageTitle.textContent = pageTitles[tabTarget];
      }
    });
  });

  // Mobile sidebar toggle
  const mobileToggle = document.getElementById('mobileNavToggle');
  const sidebar = document.querySelector('.sidebar');
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }
}

// Domain Chip Selector
function initDomainSelector() {
  const chips = document.querySelectorAll('.chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      currentSelectedDomain = chip.getAttribute('data-domain');
      document.getElementById('selectedDomainTitle').textContent = currentSelectedDomain;

      renderSelectedDomainJson();
    });
  });
}

// Event Listeners
function initEventListeners() {
  document.getElementById('btnQuickRefresh').addEventListener('click', loadWorldState);

  document.getElementById('btnAdvanceTime').addEventListener('click', executeTimeAdvance);

  document.getElementById('btnSaveCatalog').addEventListener('click', saveCatalogData);

  document.getElementById('btnSaveDomainJson').addEventListener('click', saveDomainJsonData);

  document.getElementById('btnExecuteMutation').addEventListener('click', executeManualMutation);

  document.getElementById('btnCopySnapshot').addEventListener('click', () => {
    const text = document.getElementById('previewSnapshot').textContent;
    navigator.clipboard.writeText(text);
    logConsole('success', 'Copied prompt snapshot to clipboard!');
  });
}

// Load Full World State from Proxy API (/v1/worldstate)
async function loadWorldState() {
  try {
    logConsole('info', 'Fetching World State from Proxy Server...');
    const res = await fetch('/v1/worldstate');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (data.status !== 'ok') throw new Error('API returned non-ok status');

    stateData = data.state;

    // Update Header Badges
    const currentDay = stateData.meta?.current_day || 242;
    const leyLinePt = stateData.financials?.reserves?.ley_line_platinum || 308744.5;

    document.getElementById('headerCurrentDay').textContent = `Day ${currentDay}`;
    document.getElementById('headerPlatinumReserves').textContent = `${leyLinePt.toLocaleString()} Pt`;

    // Render Tab 1 Dashboard
    renderDashboard(data.snapshot);

    // Render Tab 2 Lorebook JSON
    renderSelectedDomainJson();

    // Render Tab 3 Catalog
    renderCatalogTable();

    logConsole('success', `Loaded World State successfully (Day ${currentDay}, Ley Line: ${leyLinePt.toLocaleString()} Pt)`);
  } catch (err) {
    logConsole('error', `Failed to load World State: ${err.message}`);
  }
}

// Render Tab 1 Dashboard Components
function renderDashboard(snapshotText) {
  if (!stateData) return;

  const fin = stateData.financials || {};
  const res = fin.reserves || {};
  const sys = fin.systems || {};

  document.getElementById('dashLeyLinePt').textContent = `${(res.ley_line_platinum || 308744.5).toLocaleString()} Pt`;
  document.getElementById('dashDailyNetGold').textContent = `${(fin.consolidated_daily_net_surplus_gold || 300513).toLocaleString()} Gold/day`;
  
  let grossGoldSum = 0;
  let hostShareSum = 0;
  for (const s of Object.values(sys)) {
    grossGoldSum += (s.daily_gross_revenue || 0);
    hostShareSum += (s.host_share || 0);
  }

  document.getElementById('dashDailyGrossGold').textContent = `${Math.round(grossGoldSum).toLocaleString()} Gold/day`;
  document.getElementById('dashHostShareGold').textContent = `${Math.round(hostShareSum).toLocaleString()} Gold/day`;

  // Render Prompt Snapshot Text
  document.getElementById('previewSnapshot').textContent = snapshotText || '';

  // Render Systems Financial Breakdown Cards
  const container = document.getElementById('systemsGridContainer');
  container.innerHTML = '';

  const systemNames = {
    yuri_store: 'YuriStore Main & Retail',
    yuri_cosmetics: 'YuriCosmetics Network',
    yuri_station: 'YuriStation Transit',
    yuri_train: 'YuriTrain Railway System',
    wand_leasing: 'YuriConstruct Wand Leasing',
    yuri_bank: 'YuriBank Ley Line Infrastructure'
  };

  for (const [key, s] of Object.entries(sys)) {
    const title = systemNames[key] || key;
    const gross = s.daily_gross_revenue || 0;
    const burn = s.daily_operating_burn || 0;
    const hostShare = s.host_share || 0;
    const net = s.daily_net_surplus_evaluated !== undefined ? s.daily_net_surplus_evaluated : (gross - burn - hostShare);

    const card = document.createElement('div');
    card.className = 'system-card glass';
    card.innerHTML = `
      <div class="system-card-header">
        <span class="system-card-title">${title}</span>
        <span class="badge ${net >= 0 ? 'badge-day' : 'badge-platinum'}">${net >= 0 ? '+' : ''}${Math.round(net).toLocaleString()} G/day</span>
      </div>
      <div class="system-metrics">
        <div class="metric-row">
          <span>Daily Gross Income:</span>
          <span>${Math.round(gross).toLocaleString()} Gold</span>
        </div>
        <div class="metric-row">
          <span>Operating Burn / Cost:</span>
          <span>${Math.round(burn).toLocaleString()} Gold</span>
        </div>
        ${hostShare > 0 ? `
        <div class="metric-row">
          <span>Host Nations Profit Share (50%):</span>
          <span>${Math.round(hostShare).toLocaleString()} Gold</span>
        </div>` : ''}
        <div class="metric-row highlight">
          <span>YuriStore Net Surplus:</span>
          <span>${Math.round(net).toLocaleString()} Gold/day</span>
        </div>
      </div>
    `;
    container.appendChild(card);
  }
}

// Execute Time Progression (&Delta;t Tick)
async function executeTimeAdvance() {
  const deltaDaysInput = document.getElementById('inputDeltaDays');
  const deltaDays = parseInt(deltaDaysInput.value, 10) || 1;

  try {
    logConsole('warn', `Executing Time Advance by +${deltaDays} day(s)...`);
    const res = await fetch('/v1/worldstate/tick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta_days: deltaDays })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    logConsole('success', `Advanced simulation by +${deltaDays} day(s). Current Day: Day ${data.current_day}`);
    
    await loadWorldState();
  } catch (err) {
    logConsole('error', `Time advance failed: ${err.message}`);
  }
}

// Render Domain JSON in Editor
function renderSelectedDomainJson() {
  if (!stateData) return;
  const domainData = stateData[currentSelectedDomain] || {};
  document.getElementById('jsonEditorDomain').value = JSON.stringify(domainData, null, 2);
}

// Save Domain JSON Data back to Upstash
async function saveDomainJsonData() {
  try {
    const rawJson = document.getElementById('jsonEditorDomain').value;
    const parsedData = JSON.parse(rawJson);

    logConsole('info', `Saving domain '${currentSelectedDomain}' to Upstash Redis...`);

    const res = await fetch('/v1/worldstate/save_domain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: currentSelectedDomain, data: parsedData })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    logConsole('success', `Saved domain '${currentSelectedDomain}' to Upstash Redis!`);
    await loadWorldState();
  } catch (err) {
    logConsole('error', `Failed to save domain '${currentSelectedDomain}': ${err.message}`);
  }
}

// Render Tab 3 Product Catalog Table
function renderCatalogTable() {
  if (!stateData || !stateData.catalog) return;

  const catalog = stateData.catalog;
  const tbody = document.getElementById('catalogTableBody');
  tbody.innerHTML = '';

  const categories = [
    { key: 'retail_items', label: 'Retail Goods' },
    { key: 'fast_food_menu', label: 'Fast Food' },
    { key: 'restaurant_menu', label: 'Restaurant' },
    { key: 'yuribank_cards', label: 'YuriBank Cards' }
  ];

  categories.forEach(cat => {
    const items = catalog[cat.key];
    if (Array.isArray(items)) {
      items.forEach((item, idx) => {
        const priceCopper = item.price_copper || 0;
        const costCopper = item.unit_cost_copper || 0;
        const sold = item.daily_units_sold || 0;

        const grossGold = Math.round((priceCopper * sold / 10000) * 100) / 100;
        const costGold = Math.round((costCopper * sold / 10000) * 100) / 100;
        const netGold = Math.round((grossGold - costGold) * 100) / 100;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="chip">${cat.label}</span></td>
          <td><strong>${item.name || item.id}</strong></td>
          <td><input type="number" class="form-input table-input input-price" data-cat="${cat.key}" data-idx="${idx}" value="${priceCopper}"></td>
          <td><input type="number" class="form-input table-input input-cost" data-cat="${cat.key}" data-idx="${idx}" value="${costCopper}"></td>
          <td><input type="number" class="form-input table-input input-sold" data-cat="${cat.key}" data-idx="${idx}" value="${sold}"></td>
          <td>${grossGold.toLocaleString()} G</td>
          <td>${costGold.toLocaleString()} G</td>
          <td class="positive-profit">${netGold.toLocaleString()} G</td>
        `;
        tbody.appendChild(tr);
      });
    }
  });

  // Attach live change listeners for inputs
  document.querySelectorAll('.table-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const cat = e.target.getAttribute('data-cat');
      const idx = parseInt(e.target.getAttribute('data-idx'), 10);
      const row = e.target.closest('tr');

      const price = parseFloat(row.querySelector('.input-price').value) || 0;
      const cost = parseFloat(row.querySelector('.input-cost').value) || 0;
      const sold = parseFloat(row.querySelector('.input-sold').value) || 0;

      const gross = Math.round((price * sold / 10000) * 100) / 100;
      const totalCost = Math.round((cost * sold / 10000) * 100) / 100;
      const net = Math.round((gross - totalCost) * 100) / 100;

      row.cells[5].textContent = `${gross.toLocaleString()} G`;
      row.cells[6].textContent = `${totalCost.toLocaleString()} G`;
      row.cells[7].textContent = `${net.toLocaleString()} G`;

      // Update stateData model locally
      if (stateData.catalog[cat] && stateData.catalog[cat][idx]) {
        stateData.catalog[cat][idx].price_copper = price;
        stateData.catalog[cat][idx].unit_cost_copper = cost;
        stateData.catalog[cat][idx].daily_units_sold = sold;
      }
    });
  });
}

// Save Catalog Data to Upstash Redis
async function saveCatalogData() {
  if (!stateData || !stateData.catalog) return;

  try {
    logConsole('info', 'Saving updated Product Catalog to Upstash Redis...');
    const res = await fetch('/v1/worldstate/save_domain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'catalog', data: stateData.catalog })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    logConsole('success', 'Catalog updated! YuriStore daily surplus recalculated automatically.');
    await loadWorldState();
  } catch (err) {
    logConsole('error', `Failed to save catalog: ${err.message}`);
  }
}

// Execute Manual State Mutation
async function executeManualMutation() {
  const action = document.getElementById('mutationAction').value;
  const path = document.getElementById('mutationPath').value;
  const op = document.getElementById('mutationOp').value;
  const rawVal = document.getElementById('mutationValue').value;

  if (!path) {
    alert('Please enter a target path or domain!');
    return;
  }

  let value = rawVal;
  try {
    value = JSON.parse(rawVal);
  } catch (e) {
    // Leave as string or number if not JSON
    if (!isNaN(rawVal) && rawVal.trim() !== '') {
      value = parseFloat(rawVal);
    }
  }

  const mutation = { action, path, op, value };

  try {
    logConsole('warn', `Executing Manual Mutation: ${JSON.stringify(mutation)}...`);

    const res = await fetch('/v1/worldstate/mutate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mutations: [mutation] })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    logConsole('success', 'Mutation executed and applied to Upstash Redis!');
    await loadWorldState();
  } catch (err) {
    logConsole('error', `Mutation failed: ${err.message}`);
  }
}

// Utility: Log Console Output
function logConsole(type, msg) {
  const consoleEl = document.getElementById('logConsole');
  if (!consoleEl) return;

  const timeStr = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${timeStr}] ${msg}`;

  consoleEl.appendChild(entry);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}
