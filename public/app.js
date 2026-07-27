// app.js — Frontend Application Engine for Lorebook & World State Control Center
// Standardized in 100% English

(function () {
  'use strict';

  // State Management
  const state = {
    authKey: localStorage.getItem('CLIENT_AUTH_KEY') || '',
    lorebookStore: { lorebooks: [] },
    selectedLbId: null,
    selectedLoreId: null,
    currentSubTab: 'definition',
    collapsedLbIds: new Set(JSON.parse(localStorage.getItem('yuri_collapsed_lbs') || '[]')),
    collapsedGroupKeys: new Set(JSON.parse(localStorage.getItem('yuri_collapsed_groups') || '[]')),
    treeScrollTop: 0
  };

  function saveCollapsedStates() {
    localStorage.setItem('yuri_collapsed_lbs', JSON.stringify(Array.from(state.collapsedLbIds)));
    localStorage.setItem('yuri_collapsed_groups', JSON.stringify(Array.from(state.collapsedGroupKeys)));
  }

  // DOM Elements
  const el = {
    // Navigation
    navButtons: document.querySelectorAll('[data-tab]'),
    tabPages: document.querySelectorAll('.tab-page'),
    pageTitle: document.getElementById('pageTitle'),
    mobileNavToggle: document.getElementById('mobileNavToggle'),
    sidebarBackdrop: document.getElementById('sidebarBackdrop'),
    sidebar: document.querySelector('.sidebar'),

    // Global Buttons
    btnSaveStore: document.getElementById('btnSaveStore'),
    btnExportDb: document.getElementById('btnExportDb'),
    btnImportDb: document.getElementById('btnImportDb'),
    btnAddLorebook: document.getElementById('btnAddLorebook'),

    // Tree
    treeContainer: document.getElementById('treeContainer'),

    // Views
    lorebookEditorView: document.getElementById('lorebookEditorView'),
    loreEditorView: document.getElementById('loreEditorView'),
    emptyEditorView: document.getElementById('emptyEditorView'),

    // Lorebook Form
    lbEditTitle: document.getElementById('lbEditTitle'),
    lbStatusSelect: document.getElementById('lbStatusSelect'),
    lbNameInput: document.getElementById('lbNameInput'),
    lbInsertionSelect: document.getElementById('lbInsertionSelect'),
    lbDescInput: document.getElementById('lbDescInput'),
    lbPatternsInput: document.getElementById('lbPatternsInput'),
    lbDepthInput: document.getElementById('lbDepthInput'),
    btnSaveLbSettings: document.getElementById('btnSaveLbSettings'),
    btnAddLoreUnderLb: document.getElementById('btnAddLoreUnderLb'),
    btnDeleteLorebook: document.getElementById('btnDeleteLorebook'),

    // Lore Form
    loreEditTitle: document.getElementById('loreEditTitle'),
    loreEditSubtitle: document.getElementById('loreEditSubtitle'),
    loreGroupHeadCheckbox: document.getElementById('loreGroupHeadCheckbox'),
    loreNameInput: document.getElementById('loreNameInput'),
    loreGroupInput: document.getElementById('loreGroupInput'),
    loreKeywordsInput: document.getElementById('loreKeywordsInput'),
    loreRateInput: document.getElementById('loreRateInput'),
    subTabs: document.querySelectorAll('.sub-tab'),
    subTabContents: document.querySelectorAll('.sub-tab-content'),
    loreDefInput: document.getElementById('loreDefInput'),
    btnAddCatalogItem: document.getElementById('btnAddCatalogItem'),
    catalogTableBody: document.getElementById('catalogTableBody'),
    catalogCalcPreview: document.getElementById('catalogCalcPreview'),
    btnAddStaffRow: document.getElementById('btnAddStaffRow'),
    staffKvContainer: document.getElementById('staffKvContainer'),
    btnAddPolicyRow: document.getElementById('btnAddPolicyRow'),
    policyKvContainer: document.getElementById('policyKvContainer'),
    btnAddCustomRow: document.getElementById('btnAddCustomRow'),
    customKvContainer: document.getElementById('customKvContainer'),
    btnSaveLoreEntry: document.getElementById('btnSaveLoreEntry'),
    btnDeleteLoreEntry: document.getElementById('btnDeleteLoreEntry'),

    // Simulator
    simSampleText: document.getElementById('simSampleText'),
    btnRunSimulation: document.getElementById('btnRunSimulation'),
    simCompiledOutput: document.getElementById('simCompiledOutput'),
    simOutDay: document.getElementById('simOutDay'),
    simOutCount: document.getElementById('simOutCount'),
    simOutTarget: document.getElementById('simOutTarget'),
    btnCopyCompiledPrompt: document.getElementById('btnCopyCompiledPrompt'),

    // Auth & Logs
    btnAuthSettings: document.getElementById('btnAuthSettings'),
    authStatusText: document.getElementById('authStatusText'),
    authModal: document.getElementById('authModal'),
    authForm: document.getElementById('authForm'),
    inputAuthKeyModal: document.getElementById('inputAuthKeyModal'),
    btnToggleAuthVisibilityModal: document.getElementById('btnToggleAuthVisibilityModal'),
    authErrorMessage: document.getElementById('authErrorMessage'),
    btnSubmitAuth: document.getElementById('btnSubmitAuth'),
    inputAuthKey: document.getElementById('inputAuthKey'),
    btnToggleAuthVisibility: document.getElementById('btnToggleAuthVisibility'),
    btnSaveAuthKey: document.getElementById('btnSaveAuthKey'),
    logConsole: document.getElementById('logConsole'),

    // Modal
    jsonModal: document.getElementById('jsonModal'),
    modalTitle: document.getElementById('modalTitle'),
    jsonModalArea: document.getElementById('jsonModalArea'),
    btnCloseModal: document.getElementById('btnCloseModal'),
    btnSubmitModalJson: document.getElementById('btnSubmitModalJson')
  };

  // Helper Functions
  function log(msg, type = 'info') {
    if (!el.logConsole) return;
    const div = document.createElement('div');
    div.className = `log-entry ${type}`;
    const timestamp = new Date().toLocaleTimeString();
    div.textContent = `[${timestamp}] ${msg}`;
    el.logConsole.appendChild(div);
    el.logConsole.scrollTop = el.logConsole.scrollHeight;
  }

  function generateId(prefix = 'id') {
    return `${prefix}_${Math.random().toString(36).substring(2, 9)}`;
  }

  function getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (state.authKey) {
      headers['Authorization'] = `Bearer ${state.authKey}`;
    }
    return headers;
  }

  // --- TAB NAVIGATION ---
  function switchTab(tabId) {
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    el.tabPages.forEach(page => {
      page.classList.toggle('active', page.id === `page-${tabId}`);
    });
    if (el.pageTitle) {
      const titles = {
        lorebooks: 'Lorebook Database Management',
        simulator: 'Context Simulation & Dry-Run Engine',
        worldstate: 'World State & Financial Ledger',
        settings: 'Authentication & System Audit Log'
      };
      el.pageTitle.textContent = titles[tabId] || 'Control Center';
    }
    if (window.innerWidth <= 768 && el.sidebar) {
      el.sidebar.classList.remove('open');
      if (el.sidebarBackdrop) el.sidebarBackdrop.classList.remove('show');
    }
  }

  // --- API CALLS & AUTHENTICATION ---
  async function verifyAuthKey(candidateKey) {
    try {
      const headers = {};
      if (candidateKey) {
        headers['Authorization'] = `Bearer ${candidateKey}`;
      }
      const res = await fetch('/v1/auth/verify', { headers });
      const data = await res.json();

      if (res.status === 401) {
        log('CLIENT_AUTH_KEY not set on server environment variables.', 'warn');
        if (el.authStatusText) el.authStatusText.textContent = 'No Server Key';
        if (el.authModal) el.authModal.classList.add('hidden');
        return true;
      }

      if (res.ok) {
        state.authKey = candidateKey;
        localStorage.setItem('CLIENT_AUTH_KEY', candidateKey);
        if (el.authStatusText) el.authStatusText.textContent = 'Key Verified';
        if (el.authModal) el.authModal.classList.add('hidden');
        if (el.authErrorMessage) el.authErrorMessage.classList.add('hidden');
        log('CLIENT_AUTH_KEY verified successfully.', 'success');
        return true;
      } else {
        if (el.authStatusText) el.authStatusText.textContent = 'Auth Failed';
        if (el.authErrorMessage) {
          el.authErrorMessage.textContent = data.message || 'Invalid CLIENT_AUTH_KEY password!';
          el.authErrorMessage.classList.remove('hidden');
        }
        if (el.authModal) el.authModal.classList.remove('hidden');
        log(`Authentication failed: ${data.message}`, 'error');
        return false;
      }
    } catch (err) {
      log(`Auth verification error: ${err.message}`, 'error');
      if (el.authModal) el.authModal.classList.remove('hidden');
      return false;
    }
  }

  async function loadLorebookStore() {
    try {
      log('Fetching LorebookStore from server...', 'info');
      const res = await fetch('/v1/lorebooks', { headers: getHeaders() });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      if (data && data.store && Array.isArray(data.store.lorebooks)) {
        state.lorebookStore = data.store;
        log(`Loaded ${state.lorebookStore.lorebooks.length} Lorebook(s) successfully.`, 'success');
      } else {
        log('Server returned empty store format.', 'warn');
      }
      renderHierarchyTree();
    } catch (err) {
      log(`Failed to fetch LorebookStore: ${err.message}`, 'error');
    }
  }

  async function saveLorebookStore() {
    try {
      log('Saving LorebookStore to server...', 'info');
      const res = await fetch('/v1/lorebooks', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(state.lorebookStore)
      });
      if (!res.ok) throw new Error(`Save failed with HTTP ${res.status}`);
      const data = await res.json();
      log(data.message || 'LorebookStore saved successfully!', 'success');
    } catch (err) {
      log(`Save LorebookStore error: ${err.message}`, 'error');
    }
  }

  function addLoreUnderLb(lbId) {
    const lb = state.lorebookStore.lorebooks.find(b => b.id === lbId);
    if (!lb) return;

    const newLore = {
      id: generateId('lore'),
      name: 'New Lore Entry',
      group: 'General',
      is_group_head: false,
      trigger: {
        keywords: ['new lore'],
        trigger_rate: 100
      },
      prompt_area: {
        definition: 'Enter definition here...',
        catalog: [],
        staff: {},
        policy: {},
        custom_data: {}
      }
    };

    if (!Array.isArray(lb.lores)) lb.lores = [];
    lb.lores.push(newLore);
    state.collapsedLbIds.delete(lbId);
    saveCollapsedStates();
    selectLoreEntry(lb.id, newLore.id);
  }

  // --- TREE RENDERING (Discord Channel List Style) ---
  function renderHierarchyTree() {
    if (!el.treeContainer) return;
    
    // Save scroll position before DOM update
    state.treeScrollTop = el.treeContainer.scrollTop;
    el.treeContainer.innerHTML = '';

    const lorebooks = state.lorebookStore.lorebooks || [];

    if (lorebooks.length === 0) {
      el.treeContainer.innerHTML = `<div class="text-sub p-4 text-center">No lorebooks available. Click "+ New Book" to create one.</div>`;
      return;
    }

    lorebooks.forEach(lb => {
      const isLbCollapsed = state.collapsedLbIds.has(lb.id);
      const isLbActive = state.selectedLbId === lb.id && !state.selectedLoreId;

      const catNode = document.createElement('div');
      catNode.className = 'tree-cat-node';

      const badgeClass = `badge-status-${(lb.status || 'Active').toLowerCase()}`;

      catNode.innerHTML = `
        <div class="discord-cat-header ${isLbCollapsed ? 'collapsed' : ''} ${isLbActive ? 'active-cat' : ''}" data-lbid="${lb.id}">
          <div class="cat-title-left">
            <i data-lucide="chevron-down" class="cat-chevron"></i>
            <i data-lucide="book" class="cat-icon"></i>
            <span class="cat-name">${lb.name || 'Untitled Lorebook'}</span>
          </div>
          <div class="cat-right-actions">
            <span class="badge ${badgeClass}">${lb.status || 'Active'}</span>
            <button class="btn-cat-add" title="Add lore under ${lb.name}">
              <i data-lucide="plus"></i>
            </button>
          </div>
        </div>
      `;

      // Group Lores Container
      const loresGroup = document.createElement('div');
      loresGroup.className = `discord-lores-group ${isLbCollapsed ? 'collapsed' : ''}`;

      const groupsMap = new Map();
      (lb.lores || []).forEach(lore => {
        const grp = lore.group || 'General';
        if (!groupsMap.has(grp)) groupsMap.set(grp, []);
        groupsMap.get(grp).push(lore);
      });

      groupsMap.forEach((loresList, grpName) => {
        const grpKey = `${lb.id}:${grpName}`;
        const isGrpCollapsed = state.collapsedGroupKeys.has(grpKey);

        const grpHeader = document.createElement('div');
        grpHeader.className = `discord-group-header ${isGrpCollapsed ? 'collapsed' : ''}`;
        grpHeader.innerHTML = `
          <i data-lucide="chevron-down" class="grp-chevron"></i>
          <i data-lucide="folder" class="grp-icon"></i>
          <span>${grpName} (${loresList.length})</span>
        `;

        grpHeader.addEventListener('click', (e) => {
          e.stopPropagation();
          if (state.collapsedGroupKeys.has(grpKey)) {
            state.collapsedGroupKeys.delete(grpKey);
          } else {
            state.collapsedGroupKeys.add(grpKey);
          }
          saveCollapsedStates();
          renderHierarchyTree();
        });

        const grpChildren = document.createElement('div');
        grpChildren.className = `discord-group-children ${isGrpCollapsed ? 'collapsed' : ''}`;

        loresList.forEach(lore => {
          const isLoreActive = state.selectedLoreId === lore.id;
          const loreItem = document.createElement('div');
          loreItem.className = `discord-channel-entry ${isLoreActive ? 'active' : ''}`;
          loreItem.dataset.lbid = lb.id;
          loreItem.dataset.loreid = lore.id;

          const headBadge = lore.is_group_head ? `<i data-lucide="crown" class="group-head-crown" title="Group Head"></i>` : '';

          loreItem.innerHTML = `
            <div class="channel-title-group">
              <i data-lucide="hash" class="channel-hash-icon"></i>
              <span class="channel-name">${lore.name || 'Untitled Lore'}</span>
              ${headBadge}
            </div>
          `;

          loreItem.addEventListener('click', (e) => {
            e.stopPropagation();
            selectLoreEntry(lb.id, lore.id);
          });

          grpChildren.appendChild(loreItem);
        });

        loresGroup.appendChild(grpHeader);
        loresGroup.appendChild(grpChildren);
      });

      // Category Header Event Listeners
      const catHeader = catNode.querySelector('.discord-cat-header');
      const btnAdd = catNode.querySelector('.btn-cat-add');

      if (btnAdd) {
        btnAdd.addEventListener('click', (e) => {
          e.stopPropagation();
          addLoreUnderLb(lb.id);
        });
      }

      catHeader.addEventListener('click', (e) => {
        if (e.target.closest('.btn-cat-add')) return;
        
        // Toggle collapse state
        if (state.collapsedLbIds.has(lb.id)) {
          state.collapsedLbIds.delete(lb.id);
        } else {
          state.collapsedLbIds.add(lb.id);
        }
        saveCollapsedStates();
        selectLorebook(lb.id);
      });

      catNode.appendChild(loresGroup);
      el.treeContainer.appendChild(catNode);
    });

    if (window.lucide) window.lucide.createIcons();

    // Restore scroll position
    el.treeContainer.scrollTop = state.treeScrollTop;
  }

  // --- SELECTION & EDITOR MANAGERS ---
  function selectLorebook(lbId) {
    state.selectedLbId = lbId;
    state.selectedLoreId = null;
    renderHierarchyTree();

    const lb = state.lorebookStore.lorebooks.find(b => b.id === lbId);
    if (!lb) return;

    el.emptyEditorView.classList.add('hidden');
    el.loreEditorView.classList.add('hidden');
    el.lorebookEditorView.classList.remove('hidden');

    el.lbEditTitle.textContent = `Lorebook Settings: ${lb.name}`;
    el.lbStatusSelect.value = lb.status || 'Active';
    el.lbNameInput.value = lb.name || '';
    el.lbInsertionSelect.value = lb.settings?.insertion_mode || 'context';
    el.lbDescInput.value = lb.description || '';
    el.lbPatternsInput.value = (lb.settings?.day_trigger_patterns || []).join('\n');
    el.lbDepthInput.value = lb.settings?.depth_scan || 2;
  }

  function selectLoreEntry(lbId, loreId) {
    state.selectedLbId = lbId;
    state.selectedLoreId = loreId;
    renderHierarchyTree();

    const lb = state.lorebookStore.lorebooks.find(b => b.id === lbId);
    if (!lb) return;
    const lore = (lb.lores || []).find(l => l.id === loreId);
    if (!lore) return;

    el.emptyEditorView.classList.add('hidden');
    el.lorebookEditorView.classList.add('hidden');
    el.loreEditorView.classList.remove('hidden');

    el.loreEditTitle.textContent = `Edit Lore Entry: ${lore.name}`;
    el.loreEditSubtitle.textContent = `Lorebook: ${lb.name} | Group: ${lore.group || 'General'}`;
    el.loreGroupHeadCheckbox.checked = !!lore.is_group_head;
    el.loreNameInput.value = lore.name || '';
    el.loreGroupInput.value = lore.group || 'General';

    el.loreKeywordsInput.value = (lore.trigger?.keywords || []).join(', ');
    el.loreRateInput.value = typeof lore.trigger?.trigger_rate === 'number' ? lore.trigger.trigger_rate : 100;

    const area = lore.prompt_area || {};
    el.loreDefInput.value = area.definition || '';

    renderCatalogTable(area.catalog || []);
    renderKvContainer(el.staffKvContainer, area.staff || {});
    renderKvContainer(el.policyKvContainer, area.policy || {});
    renderKvContainer(el.customKvContainer, area.custom_data || {});
  }

  // --- CATALOG TABLE & CALCULATION ---
  function renderCatalogTable(catalog) {
    el.catalogTableBody.innerHTML = '';
    catalog.forEach((item, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" class="form-input form-input-sm cat-name" value="${item.name || ''}" placeholder="Item Name"></td>
        <td>
          <select class="form-select form-select-sm cat-type">
            <option value="retail" ${item.type === 'retail' ? 'selected' : ''}>Retail Item</option>
            <option value="ticket" ${item.type === 'ticket' ? 'selected' : ''}>Ticket</option>
            <option value="food" ${item.type === 'food' ? 'selected' : ''}>Food / Beverage</option>
            <option value="fee_revenue_share" ${item.type === 'fee_revenue_share' ? 'selected' : ''}>Fee / Revenue Share</option>
          </select>
        </td>
        <td><input type="number" class="form-input form-input-sm cat-price" value="${item.price_copper || 0}"></td>
        <td><input type="number" class="form-input form-input-sm cat-cost" value="${item.unit_cost_copper || 0}"></td>
        <td><input type="number" class="form-input form-input-sm cat-sold" value="${item.daily_units_sold || 0}"></td>
        <td><input type="text" class="form-input form-input-sm cat-val" value="${item.value || ''}" placeholder="e.g. -50% or -5000"></td>
        <td>
          <button class="btn-icon btn-icon-danger btn-delete-cat" data-index="${index}" title="Remove Item">
            <i data-lucide="trash"></i>
          </button>
        </td>
      `;
      el.catalogTableBody.appendChild(tr);
    });

    if (window.lucide) window.lucide.createIcons();
    updateCatalogPreview(catalog);
  }

  function getCatalogFromForm() {
    const catalog = [];
    const rows = el.catalogTableBody.querySelectorAll('tr');
    rows.forEach(tr => {
      const name = tr.querySelector('.cat-name').value.trim();
      const type = tr.querySelector('.cat-type').value;
      const price_copper = parseInt(tr.querySelector('.cat-price').value, 10) || 0;
      const unit_cost_copper = parseInt(tr.querySelector('.cat-cost').value, 10) || 0;
      const daily_units_sold = parseInt(tr.querySelector('.cat-sold').value, 10) || 0;
      const value = tr.querySelector('.cat-val').value.trim();

      if (name) {
        catalog.push({
          id: generateId('item'),
          name,
          type,
          price_copper,
          unit_cost_copper,
          daily_units_sold,
          monthly_units_sold: daily_units_sold * 30,
          sold_out: false,
          start_date: 1,
          branches: 1,
          value,
          description: type === 'fee_revenue_share' ? 'Dynamic fee/revenue sharing formula' : ''
        });
      }
    });
    return catalog;
  }

  function updateCatalogPreview(catalog) {
    let gross = 0;
    let cost = 0;
    let fees = 0;

    catalog.forEach(item => {
      if (item.type === 'fee_revenue_share') return;
      const p = item.price_copper || 0;
      const c = item.unit_cost_copper || 0;
      const s = item.daily_units_sold || 0;
      gross += p * s;
      cost += c * s;
    });

    catalog.forEach(item => {
      if (item.type !== 'fee_revenue_share') return;
      const valStr = String(item.value || '0').trim();
      if (valStr.endsWith('%')) {
        const pct = parseFloat(valStr.replace('%', '')) || 0;
        fees += Math.round(gross * (pct / 100));
      } else {
        fees += parseInt(valStr, 10) || 0;
      }
    });

    const net = gross - cost + fees;

    el.catalogCalcPreview.innerHTML = `
      <div class="calc-metric-card">
        <span class="label">Total Daily Gross</span>
        <span class="val text-success">${gross.toLocaleString()} Copper</span>
      </div>
      <div class="calc-metric-card">
        <span class="label">Operational Costs</span>
        <span class="val text-warning">${cost.toLocaleString()} Copper</span>
      </div>
      <div class="calc-metric-card">
        <span class="label">Fees & Revenue Share</span>
        <span class="val ${fees >= 0 ? 'text-success' : 'text-danger'}">${fees >= 0 ? '+' : ''}${fees.toLocaleString()} Copper</span>
      </div>
      <div class="calc-metric-card">
        <span class="label">Daily Net Surplus</span>
        <span class="val text-primary">${net.toLocaleString()} Copper</span>
      </div>
    `;
  }

  // --- KEY-VALUE DICTIONARY HELPERS ---
  function renderKvContainer(container, dict) {
    container.innerHTML = '';
    Object.entries(dict || {}).forEach(([key, val]) => {
      addKvRow(container, key, typeof val === 'object' ? JSON.stringify(val) : val);
    });
  }

  function addKvRow(container, key = '', val = '') {
    const row = document.createElement('div');
    row.className = 'kv-row mt-2';
    row.innerHTML = `
      <input type="text" class="form-input form-input-sm kv-key" value="${key}" placeholder="Key / Title">
      <input type="text" class="form-input form-input-sm kv-val" value="${val}" placeholder="Value / Content">
      <button class="btn-icon btn-icon-danger btn-delete-kv"><i data-lucide="trash"></i></button>
    `;
    row.querySelector('.btn-delete-kv').addEventListener('click', () => row.remove());
    container.appendChild(row);
    if (window.lucide) window.lucide.createIcons();
  }

  function getDictFromKvContainer(container) {
    const dict = {};
    const rows = container.querySelectorAll('.kv-row');
    rows.forEach(row => {
      const k = row.querySelector('.kv-key').value.trim();
      const v = row.querySelector('.kv-val').value.trim();
      if (k) dict[k] = v;
    });
    return dict;
  }

  // --- EVENT LISTENERS ---
  function bindEvents() {
    // Navigation
    el.navButtons.forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    if (el.mobileNavToggle) {
      el.mobileNavToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        el.sidebar.classList.toggle('open');
        if (el.sidebarBackdrop) el.sidebarBackdrop.classList.toggle('show');
      });
    }

    if (el.sidebarBackdrop) {
      el.sidebarBackdrop.addEventListener('click', () => {
        el.sidebar.classList.remove('open');
        el.sidebarBackdrop.classList.remove('show');
      });
    }

    // Close mobile sidebar on tap outside anywhere
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 && el.sidebar && el.sidebar.classList.contains('open')) {
        const isInsideSidebar = el.sidebar.contains(e.target);
        const isToggleBtn = el.mobileNavToggle && el.mobileNavToggle.contains(e.target);
        if (!isInsideSidebar && !isToggleBtn) {
          el.sidebar.classList.remove('open');
          if (el.sidebarBackdrop) el.sidebarBackdrop.classList.remove('show');
        }
      }
    });

    // Save Store
    el.btnSaveStore.addEventListener('click', saveLorebookStore);

    // Export & Import
    el.btnExportDb.addEventListener('click', () => {
      window.location.href = '/v1/lorebooks/export';
    });

    el.btnImportDb.addEventListener('click', () => {
      el.modalTitle.textContent = 'Import JSON Database';
      el.jsonModalArea.value = JSON.stringify(state.lorebookStore, null, 2);
      el.jsonModal.classList.remove('hidden');
    });

    el.btnCloseModal.addEventListener('click', () => el.jsonModal.classList.add('hidden'));

    el.btnSubmitModalJson.addEventListener('click', async () => {
      try {
        const json = JSON.parse(el.jsonModalArea.value);
        if (!json || !Array.isArray(json.lorebooks)) {
          throw new Error('JSON payload must contain a "lorebooks" array.');
        }
        state.lorebookStore = json;
        await saveLorebookStore();
        renderHierarchyTree();
        el.jsonModal.classList.add('hidden');
        log('Database imported successfully!', 'success');
      } catch (err) {
        alert(`Invalid JSON format: ${err.message}`);
      }
    });

    // Add Lorebook
    el.btnAddLorebook.addEventListener('click', () => {
      const newLb = {
        id: generateId('lb'),
        name: 'New Lorebook',
        description: 'Lorebook collection description...',
        status: 'Active',
        settings: {
          day_trigger_patterns: ['\\[\\s*🕒?\\s*Day\\s+(\\d+)', '\\[Day\\s+(\\d+)'],
          depth_scan: 2,
          insertion_mode: 'context'
        },
        lores: []
      };
      state.lorebookStore.lorebooks.push(newLb);
      selectLorebook(newLb.id);
    });

    // Apply Lorebook Settings
    el.btnSaveLbSettings.addEventListener('click', () => {
      const lb = state.lorebookStore.lorebooks.find(b => b.id === state.selectedLbId);
      if (!lb) return;

      lb.name = el.lbNameInput.value.trim() || 'Untitled Lorebook';
      lb.status = el.lbStatusSelect.value;
      lb.description = el.lbDescInput.value.trim();
      lb.settings = {
        insertion_mode: el.lbInsertionSelect.value,
        depth_scan: parseInt(el.lbDepthInput.value, 10) || 2,
        day_trigger_patterns: el.lbPatternsInput.value.split('\n').map(p => p.trim()).filter(Boolean)
      };

      log(`Updated Lorebook settings: ${lb.name}`, 'success');
      renderHierarchyTree();
    });

    // Add Lore under Lorebook
    el.btnAddLoreUnderLb.addEventListener('click', () => {
      const lb = state.lorebookStore.lorebooks.find(b => b.id === state.selectedLbId);
      if (!lb) return;

      const newLore = {
        id: generateId('lore'),
        name: 'New Lore Entry',
        group: 'General',
        is_group_head: false,
        trigger: {
          keywords: ['new lore'],
          trigger_rate: 100
        },
        prompt_area: {
          definition: 'Enter definition here...',
          catalog: [],
          staff: {},
          policy: {},
          custom_data: {}
        }
      };

      lb.lores.push(newLore);
      selectLoreEntry(lb.id, newLore.id);
    });

    // Delete Lorebook
    el.btnDeleteLorebook.addEventListener('click', () => {
      if (!confirm('Are you sure you want to delete this entire Lorebook?')) return;
      state.lorebookStore.lorebooks = state.lorebookStore.lorebooks.filter(b => b.id !== state.selectedLbId);
      state.selectedLbId = null;
      state.selectedLoreId = null;
      renderHierarchyTree();
      el.lorebookEditorView.classList.add('hidden');
      el.emptyEditorView.classList.remove('hidden');
      log('Deleted Lorebook.', 'info');
    });

    // Sub-Tabs in Lore Entry Editor
    el.subTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        el.subTabs.forEach(b => b.classList.remove('active'));
        el.subTabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`subtab-${btn.dataset.subtab}`).classList.add('active');
      });
    });

    // Dynamic Row Buttons for Catalog & Key-Value
    el.btnAddCatalogItem.addEventListener('click', () => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" class="form-input form-input-sm cat-name" placeholder="Item Name"></td>
        <td>
          <select class="form-select form-select-sm cat-type">
            <option value="retail">Retail Item</option>
            <option value="ticket">Ticket</option>
            <option value="food">Food / Beverage</option>
            <option value="fee_revenue_share">Fee / Revenue Share</option>
          </select>
        </td>
        <td><input type="number" class="form-input form-input-sm cat-price" value="1000"></td>
        <td><input type="number" class="form-input form-input-sm cat-cost" value="200"></td>
        <td><input type="number" class="form-input form-input-sm cat-sold" value="50"></td>
        <td><input type="text" class="form-input form-input-sm cat-val" placeholder="e.g. -50%"></td>
        <td>
          <button class="btn-icon btn-icon-danger btn-delete-cat"><i data-lucide="trash"></i></button>
        </td>
      `;
      tr.querySelector('.btn-delete-cat').addEventListener('click', () => {
        tr.remove();
        updateCatalogPreview(getCatalogFromForm());
      });
      el.catalogTableBody.appendChild(tr);
      if (window.lucide) window.lucide.createIcons();
    });

    el.btnAddStaffRow.addEventListener('click', () => addKvRow(el.staffKvContainer));
    el.btnAddPolicyRow.addEventListener('click', () => addKvRow(el.policyKvContainer));
    el.btnAddCustomRow.addEventListener('click', () => addKvRow(el.customKvContainer));

    // Save Lore Entry
    el.btnSaveLoreEntry.addEventListener('click', () => {
      const lb = state.lorebookStore.lorebooks.find(b => b.id === state.selectedLbId);
      if (!lb) return;
      const lore = (lb.lores || []).find(l => l.id === state.selectedLoreId);
      if (!lore) return;

      lore.name = el.loreNameInput.value.trim() || 'Untitled Lore';
      lore.group = el.loreGroupInput.value.trim() || 'General';
      lore.is_group_head = el.loreGroupHeadCheckbox.checked;

      // Ensure only one group head per group if designated
      if (lore.is_group_head) {
        lb.lores.forEach(l => {
          if (l.group === lore.group && l.id !== lore.id) {
            l.is_group_head = false;
          }
        });
      }

      const keywords = el.loreKeywordsInput.value.split(',').map(k => k.trim()).filter(Boolean);
      const trigger_rate = parseInt(el.loreRateInput.value, 10) || 100;

      lore.trigger = { keywords, trigger_rate };
      lore.prompt_area = {
        definition: el.loreDefInput.value.trim(),
        catalog: getCatalogFromForm(),
        staff: getDictFromKvContainer(el.staffKvContainer),
        policy: getDictFromKvContainer(el.policyKvContainer),
        custom_data: getDictFromKvContainer(el.customKvContainer)
      };

      log(`Saved Lore Entry: ${lore.name}`, 'success');
      renderHierarchyTree();
    });

    // Delete Lore Entry
    el.btnDeleteLoreEntry.addEventListener('click', () => {
      if (!confirm('Are you sure you want to delete this Lore entry?')) return;
      const lb = state.lorebookStore.lorebooks.find(b => b.id === state.selectedLbId);
      if (!lb) return;
      lb.lores = lb.lores.filter(l => l.id !== state.selectedLoreId);
      state.selectedLoreId = null;
      selectLorebook(lb.id);
      log('Deleted Lore entry.', 'info');
    });

    // Simulator Runner
    el.btnRunSimulation.addEventListener('click', async () => {
      try {
        const text = el.simSampleText.value.trim();
        log('Running context simulation dry-run...', 'info');

        const res = await fetch('/v1/lorebooks/compile', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            store: state.lorebookStore,
            sampleText: text
          })
        });

        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const data = await res.json();

        el.simCompiledOutput.textContent = data.compiled_prompt || '(Empty prompt returned)';
        el.simOutDay.textContent = `Extracted Day: ${data.current_day !== null ? `Day ${data.current_day}` : 'None'}`;
        el.simOutCount.textContent = `Active Lores: ${data.active_count}`;
        el.simOutTarget.textContent = `Target: ${data.insertion_mode === 'user_msg' ? 'User Message' : 'System Context'}`;

        log(`Simulation finished. Active Lores: ${data.active_count}`, 'success');
      } catch (err) {
        log(`Simulation error: ${err.message}`, 'error');
      }
    });

    el.btnCopyCompiledPrompt.addEventListener('click', () => {
      navigator.clipboard.writeText(el.simCompiledOutput.textContent);
      log('Copied compiled prompt to clipboard!', 'info');
    });

    // Auth Key Handling & Modal
    const btnQuickAuth = document.getElementById('btnQuickAuth');
    if (btnQuickAuth) {
      btnQuickAuth.addEventListener('click', () => {
        if (el.inputAuthKeyModal) el.inputAuthKeyModal.value = state.authKey || '';
        if (el.authErrorMessage) el.authErrorMessage.classList.add('hidden');
        if (el.authModal) el.authModal.classList.remove('hidden');
      });
    }

    if (el.btnAuthSettings) {
      el.btnAuthSettings.addEventListener('click', () => {
        if (el.inputAuthKeyModal) el.inputAuthKeyModal.value = state.authKey || '';
        if (el.authErrorMessage) el.authErrorMessage.classList.add('hidden');
        if (el.authModal) el.authModal.classList.remove('hidden');
      });
    }

    if (el.authForm) {
      el.authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const candidate = el.inputAuthKeyModal ? el.inputAuthKeyModal.value.trim() : '';
        const ok = await verifyAuthKey(candidate);
        if (ok) {
          loadLorebookStore();
        }
      });
    }

    if (el.btnToggleAuthVisibilityModal) {
      el.btnToggleAuthVisibilityModal.addEventListener('click', () => {
        if (el.inputAuthKeyModal) {
          const type = el.inputAuthKeyModal.type === 'password' ? 'text' : 'password';
          el.inputAuthKeyModal.type = type;
        }
      });
    }

    if (el.inputAuthKey) el.inputAuthKey.value = state.authKey;

    if (el.btnToggleAuthVisibility) {
      el.btnToggleAuthVisibility.addEventListener('click', () => {
        const type = el.inputAuthKey.type === 'password' ? 'text' : 'password';
        el.inputAuthKey.type = type;
      });
    }

    if (el.btnSaveAuthKey) {
      el.btnSaveAuthKey.addEventListener('click', async () => {
        const candidate = el.inputAuthKey.value.trim();
        await verifyAuthKey(candidate);
      });
    }
  }

  // --- INITIALIZATION ---
  async function init() {
    bindEvents();
    const isAuth = await verifyAuthKey(state.authKey);
    if (isAuth) {
      loadLorebookStore();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
