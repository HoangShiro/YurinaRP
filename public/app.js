// app.js — Frontend Application Engine for Lorebook & World State Control Center
// Standardized in 100% English

(function () {
  'use strict';

  // State Management
  const state = {
    authKey: localStorage.getItem('CLIENT_AUTH_KEY') || '',
    lorebookStore: { lorebooks: [] },
    systemPromptStore: { system_prompt: '', features: { fixFormat: true, autoLineBreak: true }, shorter_rules: [], keyremind_rules: [], trigger_rules: [] },
    selectedLbId: null,
    selectedLoreId: null,
    selectedSpItem: 'sp_base',
    currentSubTab: 'definition',
    collapsedLbIds: new Set(JSON.parse(localStorage.getItem('yuri_collapsed_lbs') || '[]')),
    collapsedGroupKeys: new Set(JSON.parse(localStorage.getItem('yuri_collapsed_groups') || '[]')),
    treeScrollTop: 0
  };

  function saveCollapsedStates() {
    localStorage.setItem('yuri_collapsed_lbs', JSON.stringify(Array.from(state.collapsedLbIds)));
    localStorage.setItem('yuri_collapsed_groups', JSON.stringify(Array.from(state.collapsedGroupKeys)));
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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

    // System Prompt Elements
    spTreeContainer: document.getElementById('spTreeContainer'),
    btnAddSpRule: document.getElementById('btnAddSpRule'),
    spBaseView: document.getElementById('spBaseView'),
    spFeaturesView: document.getElementById('spFeaturesView'),
    spRuleEditorView: document.getElementById('spRuleEditorView'),
    spEmptyView: document.getElementById('spEmptyView'),

    spBasePromptInput: document.getElementById('spBasePromptInput'),
    btnSaveSpBase: document.getElementById('btnSaveSpBase'),

    spToggleFixFormat: document.getElementById('spToggleFixFormat'),
    spToggleAutoLineBreak: document.getElementById('spToggleAutoLineBreak'),
    btnSaveSpFeatures: document.getElementById('btnSaveSpFeatures'),

    spRuleTitle: document.getElementById('spRuleTitle'),
    spRuleSubtitle: document.getElementById('spRuleSubtitle'),
    spRuleEnabledCheckbox: document.getElementById('spRuleEnabledCheckbox'),
    spRuleNameInput: document.getElementById('spRuleNameInput'),
    spRuleTypeSelect: document.getElementById('spRuleTypeSelect'),

    spParamsShorter: document.getElementById('spParamsShorter'),
    spParamsKeyremind: document.getElementById('spParamsKeyremind'),
    spParamsTrigger: document.getElementById('spParamsTrigger'),

    spParamMaxLength: document.getElementById('spParamMaxLength'),
    spParamKey: document.getElementById('spParamKey'),
    spParamKeywords: document.getElementById('spParamKeywords'),
    spParamDepth: document.getElementById('spParamDepth'),
    spParamInsertion: document.getElementById('spParamInsertion'),

    spRulePromptInput: document.getElementById('spRulePromptInput'),
    btnSaveSpRule: document.getElementById('btnSaveSpRule'),
    btnDeleteSpRule: document.getElementById('btnDeleteSpRule'),

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
        systemprompt: 'System Prompt & Prompt Rules Management',
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

  async function loadSystemPromptStore() {
    try {
      log('Fetching SystemPromptStore from server...', 'info');
      const res = await fetch('/v1/system-prompt', { headers: getHeaders() });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      if (data && data.store) {
        state.systemPromptStore = data.store;
        log('Loaded System Prompt & Rules successfully.', 'success');
      }
      renderSystemPromptTree();
    } catch (err) {
      log(`Failed to fetch SystemPromptStore: ${err.message}`, 'error');
    }
  }

  async function saveSystemPromptStore() {
    try {
      log('Saving SystemPromptStore to Upstash...', 'info');
      const res = await fetch('/v1/system-prompt', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(state.systemPromptStore)
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      log('System Prompt & Rules saved successfully to Upstash Redis!', 'success');
    } catch (err) {
      log(`Failed to save SystemPromptStore: ${err.message}`, 'error');
      alert(`Save failed: ${err.message}`);
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

  // --- SYSTEM PROMPT TREE & EDITOR MANAGERS ---
  function renderSystemPromptTree() {
    if (!el.spTreeContainer) return;

    const store = state.systemPromptStore || {};
    const shorterRules = store.shorter_rules || [];
    const keyremindRules = store.keyremind_rules || [];
    const triggerRules = store.trigger_rules || [];

    let html = '';

    // Base System Prompt Item
    const isBaseActive = state.selectedSpItem === 'sp_base' ? 'active' : '';
    html += `
      <div class="tree-item tree-channel ${isBaseActive}" data-sp-item="sp_base">
        <i data-lucide="terminal" class="tree-icon text-accent"></i>
        <span class="tree-label">Base System Prompt</span>
      </div>
    `;

    // Feature Switches Item
    const isFeaturesActive = state.selectedSpItem === 'sp_features' ? 'active' : '';
    html += `
      <div class="tree-item tree-channel ${isFeaturesActive}" data-sp-item="sp_features">
        <i data-lucide="sliders" class="tree-icon text-info"></i>
        <span class="tree-label">Global Formatting Features</span>
      </div>
    `;

    // Shorter Rules Group
    html += `
      <div class="tree-group mt-3">
        <div class="tree-group-header">
          <i data-lucide="scissors" class="group-icon"></i>
          <span class="group-title">Shorter Rules (${shorterRules.length})</span>
        </div>
        <div class="tree-group-children">
    `;
    if (shorterRules.length === 0) {
      html += `<div class="text-sub px-4 py-1 text-xs">No shorter rules</div>`;
    } else {
      shorterRules.forEach(r => {
        const isActive = state.selectedSpItem === r.id ? 'active' : '';
        const offBadge = r.enabled === false ? ' <span class="badge badge-off">Off</span>' : '';
        html += `
          <div class="tree-item tree-lore ${isActive}" data-sp-item="${r.id}">
            <i data-lucide="scissors" class="tree-icon text-warning"></i>
            <span class="tree-label">${escapeHtml(r.name || 'Shorter Rule')}${offBadge}</span>
          </div>
        `;
      });
    }
    html += `</div></div>`;

    // KeyRemind Rules Group
    html += `
      <div class="tree-group mt-2">
        <div class="tree-group-header">
          <i data-lucide="bell" class="group-icon"></i>
          <span class="group-title">KeyRemind Rules (${keyremindRules.length})</span>
        </div>
        <div class="tree-group-children">
    `;
    if (keyremindRules.length === 0) {
      html += `<div class="text-sub px-4 py-1 text-xs">No keyword reminder rules</div>`;
    } else {
      keyremindRules.forEach(r => {
        const isActive = state.selectedSpItem === r.id ? 'active' : '';
        const offBadge = r.enabled === false ? ' <span class="badge badge-off">Off</span>' : '';
        html += `
          <div class="tree-item tree-lore ${isActive}" data-sp-item="${r.id}">
            <i data-lucide="bell" class="tree-icon text-purple"></i>
            <span class="tree-label">${escapeHtml(r.name || 'KeyRemind Rule')}${offBadge}</span>
          </div>
        `;
      });
    }
    html += `</div></div>`;

    // Keyword Trigger Rules Group
    html += `
      <div class="tree-group mt-2">
        <div class="tree-group-header">
          <i data-lucide="zap" class="group-icon"></i>
          <span class="group-title">Trigger Rules (${triggerRules.length})</span>
        </div>
        <div class="tree-group-children">
    `;
    if (triggerRules.length === 0) {
      html += `<div class="text-sub px-4 py-1 text-xs">No trigger rules</div>`;
    } else {
      triggerRules.forEach(r => {
        const isActive = state.selectedSpItem === r.id ? 'active' : '';
        const offBadge = r.enabled === false ? ' <span class="badge badge-off">Off</span>' : '';
        html += `
          <div class="tree-item tree-lore ${isActive}" data-sp-item="${r.id}">
            <i data-lucide="zap" class="tree-icon text-success"></i>
            <span class="tree-label">${escapeHtml(r.name || 'Trigger Rule')}${offBadge}</span>
          </div>
        `;
      });
    }
    html += `</div></div>`;

    el.spTreeContainer.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();

    el.spTreeContainer.querySelectorAll('[data-sp-item]').forEach(item => {
      item.addEventListener('click', () => selectSpItem(item.dataset.spItem));
    });
  }

  function selectSpItem(itemId) {
    state.selectedSpItem = itemId;
    renderSystemPromptTree();

    if (!el.spBaseView) return;

    el.spBaseView.classList.add('hidden');
    el.spFeaturesView.classList.add('hidden');
    el.spRuleEditorView.classList.add('hidden');
    el.spEmptyView.classList.add('hidden');

    const store = state.systemPromptStore || {};

    if (itemId === 'sp_base') {
      el.spBaseView.classList.remove('hidden');
      if (el.spBasePromptInput) {
        el.spBasePromptInput.value = store.system_prompt || '';
      }
      return;
    }

    if (itemId === 'sp_features') {
      el.spFeaturesView.classList.remove('hidden');
      if (el.spToggleFixFormat) el.spToggleFixFormat.checked = !!store.features?.fixFormat;
      if (el.spToggleAutoLineBreak) el.spToggleAutoLineBreak.checked = !!store.features?.autoLineBreak;
      return;
    }

    let foundRule = null;
    let ruleType = 'shorter';

    if (Array.isArray(store.shorter_rules)) {
      foundRule = store.shorter_rules.find(r => r.id === itemId);
      if (foundRule) ruleType = 'shorter';
    }
    if (!foundRule && Array.isArray(store.keyremind_rules)) {
      foundRule = store.keyremind_rules.find(r => r.id === itemId);
      if (foundRule) ruleType = 'keyremind';
    }
    if (!foundRule && Array.isArray(store.trigger_rules)) {
      foundRule = store.trigger_rules.find(r => r.id === itemId);
      if (foundRule) ruleType = 'trigger';
    }

    if (foundRule) {
      el.spRuleEditorView.classList.remove('hidden');
      if (el.spRuleTitle) el.spRuleTitle.textContent = foundRule.name || 'Edit Rule';
      if (el.spRuleSubtitle) el.spRuleSubtitle.textContent = `ID: ${foundRule.id}`;
      if (el.spRuleEnabledCheckbox) el.spRuleEnabledCheckbox.checked = foundRule.enabled !== false;
      if (el.spRuleNameInput) el.spRuleNameInput.value = foundRule.name || '';
      if (el.spRuleTypeSelect) el.spRuleTypeSelect.value = ruleType;
      if (el.spRulePromptInput) el.spRulePromptInput.value = foundRule.prompt || '';

      updateSpParamVisibility(ruleType);

      if (ruleType === 'shorter' && el.spParamMaxLength) {
        el.spParamMaxLength.value = Number(foundRule.max_length || foundRule.length) || 500;
      } else if (ruleType === 'keyremind' && el.spParamKey) {
        el.spParamKey.value = foundRule.key || '';
      } else if (ruleType === 'trigger') {
        if (el.spParamKeywords) {
          el.spParamKeywords.value = Array.isArray(foundRule.keywords) ? foundRule.keywords.join(', ') : (foundRule.keywords || '');
        }
        if (el.spParamDepth) el.spParamDepth.value = Number(foundRule.depth_scan) || 2;
        if (el.spParamInsertion) el.spParamInsertion.value = foundRule.insertion || 'context';
      }
    } else {
      el.spEmptyView.classList.remove('hidden');
    }
  }

  function updateSpParamVisibility(ruleType) {
    if (el.spParamsShorter) el.spParamsShorter.classList.toggle('hidden', ruleType !== 'shorter');
    if (el.spParamsKeyremind) el.spParamsKeyremind.classList.toggle('hidden', ruleType !== 'keyremind');
    if (el.spParamsTrigger) el.spParamsTrigger.classList.toggle('hidden', ruleType !== 'trigger');
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
    renderKvContainer(el.staffKvContainer, area.staff || {}, 'Staff Name / Role (e.g. Yurina)', 'Duties, Schedule, Salary, Description');
    renderKvContainer(el.policyKvContainer, area.policy || {}, 'Policy Name (e.g. Return Policy)', 'Policy terms & details');
    renderKvContainer(el.customKvContainer, area.custom_data || {}, 'Metadata Key', 'Value / Description');
  }

  // --- CURRENCY PARSER & FORMATTERS ---
  function parseCurrencyToCopper(valStr) {
    if (typeof valStr === 'number') return valStr;
    if (!valStr) return 0;

    const str = String(valStr).trim();
    if (!str) return 0;

    // Pure number check (e.g. "1000")
    if (/^-?\d+(\.\d+)?$/.test(str)) {
      return Math.round(parseFloat(str));
    }

    let totalCopper = 0;
    const isNegative = str.startsWith('-');

    // Match expressions like "1G", "50S", "20c", "1.5 Gold", "50 Silver", etc.
    const regex = /(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/g;
    let match;
    let foundMatch = false;

    while ((match = regex.exec(str)) !== null) {
      foundMatch = true;
      const num = parseFloat(match[1]) || 0;
      const unit = match[2].toLowerCase();

      if (unit === 'g' || unit === 'gold' || unit === 'golds') {
        totalCopper += Math.round(num * 10000);
      } else if (unit === 's' || unit === 'silver' || unit === 'silvers') {
        totalCopper += Math.round(num * 100);
      } else if (unit === 'c' || unit === 'copper' || unit === 'coppers') {
        totalCopper += Math.round(num);
      }
    }

    if (!foundMatch) {
      const numOnly = parseFloat(str.replace(/[^0-9.-]/g, ''));
      return isNaN(numOnly) ? 0 : Math.round(numOnly);
    }

    return isNegative && totalCopper > 0 ? -totalCopper : totalCopper;
  }

  function formatCopperToGold(copperAmount) {
    const isNegative = copperAmount < 0;
    const absVal = Math.abs(copperAmount);
    const goldVal = absVal / 10000;

    const g = Math.floor(absVal / 10000);
    const s = Math.floor((absVal % 10000) / 100);
    const c = absVal % 100;

    const goldFormatted = goldVal.toLocaleString(undefined, {
      minimumFractionDigits: Number.isInteger(goldVal) ? 0 : 2,
      maximumFractionDigits: 4
    });

    const sign = isNegative ? '-' : '';

    if (g > 0 || absVal === 0) {
      return `${sign}${goldFormatted} Gold <span class="text-sub">(${sign}${g}G ${s}S ${c}C)</span>`;
    } else {
      return `${sign}${goldFormatted} Gold <span class="text-sub">(${sign}${s}S ${c}C)</span>`;
    }
  }

  function formatCopperForInput(copper) {
    if (!copper) return '0';
    const g = Math.floor(copper / 10000);
    const s = Math.floor((copper % 10000) / 100);
    const c = copper % 100;

    const parts = [];
    if (g > 0) parts.push(`${g}G`);
    if (s > 0) parts.push(`${s}S`);
    if (c > 0 || parts.length === 0) parts.push(`${c}C`);
    return parts.join(' ');
  }

  // --- CATALOG TABLE & CALCULATION ---
  function renderCatalogTable(catalog) {
    el.catalogTableBody.innerHTML = '';
    catalog.forEach((item, index) => {
      const tr = document.createElement('tr');
      const displayPrice = item.price_raw || (typeof item.price_copper === 'number' ? formatCopperForInput(item.price_copper) : '0');
      const displayCost = item.cost_raw || (typeof item.unit_cost_copper === 'number' ? formatCopperForInput(item.unit_cost_copper) : '0');
      const startDate = typeof item.start_date === 'number' ? item.start_date : (parseInt(item.start_date, 10) || 1);

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
        <td><input type="text" class="form-input form-input-sm cat-price" value="${displayPrice}" placeholder="e.g. 1G 50S or 50s"></td>
        <td><input type="text" class="form-input form-input-sm cat-cost" value="${displayCost}" placeholder="e.g. 2S or 200c"></td>
        <td><input type="number" class="form-input form-input-sm cat-sold" value="${item.daily_units_sold || 0}"></td>
        <td><input type="number" min="1" class="form-input form-input-sm cat-start-date" value="${startDate}" placeholder="Day 1"></td>
        <td><input type="text" class="form-input form-input-sm cat-val" value="${item.value || ''}" placeholder="e.g. -50% or -5S"></td>
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
      const price_raw = tr.querySelector('.cat-price').value.trim();
      const cost_raw = tr.querySelector('.cat-cost').value.trim();
      const price_copper = parseCurrencyToCopper(price_raw);
      const unit_cost_copper = parseCurrencyToCopper(cost_raw);
      const daily_units_sold = parseInt(tr.querySelector('.cat-sold').value, 10) || 0;
      const start_date_val = tr.querySelector('.cat-start-date') ? (parseInt(tr.querySelector('.cat-start-date').value, 10) || 1) : 1;
      const value = tr.querySelector('.cat-val').value.trim();

      if (name) {
        catalog.push({
          id: generateId('item'),
          name,
          type,
          price_raw,
          cost_raw,
          price_copper,
          unit_cost_copper,
          daily_units_sold,
          monthly_units_sold: daily_units_sold * 30,
          sold_out: false,
          start_date: start_date_val,
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
      const p = parseCurrencyToCopper(item.price_raw || item.price_copper || 0);
      const c = parseCurrencyToCopper(item.cost_raw || item.unit_cost_copper || 0);
      const s = parseInt(item.daily_units_sold, 10) || 0;
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
        fees += parseCurrencyToCopper(valStr);
      }
    });

    const net = gross - cost + fees;

    el.catalogCalcPreview.innerHTML = `
      <div class="calc-metric-card">
        <span class="label">Total Daily Gross</span>
        <span class="val text-success">${formatCopperToGold(gross)}</span>
      </div>
      <div class="calc-metric-card">
        <span class="label">Operational Costs</span>
        <span class="val text-warning">${formatCopperToGold(cost)}</span>
      </div>
      <div class="calc-metric-card">
        <span class="label">Fees & Revenue Share</span>
        <span class="val ${fees >= 0 ? 'text-success' : 'text-danger'}">${fees >= 0 ? '+' : ''}${formatCopperToGold(fees)}</span>
      </div>
      <div class="calc-metric-card">
        <span class="label">Daily Net Surplus</span>
        <span class="val text-primary">${formatCopperToGold(net)}</span>
      </div>
    `;
  }

  // --- KEY-VALUE DICTIONARY HELPERS ---
  function renderKvContainer(container, dict, keyPlaceholder = 'Key / Title', valPlaceholder = 'Value / Content') {
    container.innerHTML = '';
    Object.entries(dict || {}).forEach(([key, val]) => {
      addKvRow(container, key, typeof val === 'object' ? JSON.stringify(val) : val, keyPlaceholder, valPlaceholder);
    });
  }

  function addKvRow(container, key = '', val = '', keyPlaceholder = 'Key / Title', valPlaceholder = 'Value / Content') {
    const row = document.createElement('div');
    row.className = 'kv-row mt-2';
    row.innerHTML = `
      <input type="text" class="form-input form-input-sm kv-key" value="${key}" placeholder="${keyPlaceholder}">
      <input type="text" class="form-input form-input-sm kv-val" value="${val}" placeholder="${valPlaceholder}">
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
    el.btnSaveLbSettings.addEventListener('click', async () => {
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
      await saveLorebookStore();
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
    el.btnDeleteLorebook.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to delete this entire Lorebook?')) return;
      state.lorebookStore.lorebooks = state.lorebookStore.lorebooks.filter(b => b.id !== state.selectedLbId);
      state.selectedLbId = null;
      state.selectedLoreId = null;
      renderHierarchyTree();
      el.lorebookEditorView.classList.add('hidden');
      el.emptyEditorView.classList.remove('hidden');
      log('Deleted Lorebook.', 'info');
      await saveLorebookStore();
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
        <td><input type="text" class="form-input form-input-sm cat-price" value="10S" placeholder="e.g. 1G 50S or 50s"></td>
        <td><input type="text" class="form-input form-input-sm cat-cost" value="2S" placeholder="e.g. 2S or 200c"></td>
        <td><input type="number" class="form-input form-input-sm cat-sold" value="50"></td>
        <td><input type="number" min="1" class="form-input form-input-sm cat-start-date" value="1" placeholder="Day 1"></td>
        <td><input type="text" class="form-input form-input-sm cat-val" placeholder="e.g. -50% or -5S"></td>
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
      updateCatalogPreview(getCatalogFromForm());
    });

    if (el.catalogTableBody) {
      el.catalogTableBody.addEventListener('input', () => {
        updateCatalogPreview(getCatalogFromForm());
      });
      el.catalogTableBody.addEventListener('change', () => {
        updateCatalogPreview(getCatalogFromForm());
      });
    }

    el.btnAddStaffRow.addEventListener('click', () => addKvRow(el.staffKvContainer, '', '', 'Staff Name / Role (e.g. Yurina)', 'Duties, Schedule, Salary, Description'));
    el.btnAddPolicyRow.addEventListener('click', () => addKvRow(el.policyKvContainer, '', '', 'Policy Name (e.g. Return Policy)', 'Policy terms & details'));
    el.btnAddCustomRow.addEventListener('click', () => addKvRow(el.customKvContainer, '', '', 'Metadata Key', 'Value / Description'));

    // Save Lore Entry
    el.btnSaveLoreEntry.addEventListener('click', async () => {
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
      await saveLorebookStore();
    });

    // Delete Lore Entry
    el.btnDeleteLoreEntry.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to delete this Lore entry?')) return;
      const lb = state.lorebookStore.lorebooks.find(b => b.id === state.selectedLbId);
      if (!lb) return;
      lb.lores = lb.lores.filter(l => l.id !== state.selectedLoreId);
      state.selectedLoreId = null;
      selectLorebook(lb.id);
      log('Deleted Lore entry.', 'info');
      await saveLorebookStore();
    });

    // Simulator Runner
    el.btnRunSimulation.addEventListener('click', async () => {
      try {
        const text = el.simSampleText ? el.simSampleText.value.trim() : '';
        const prevAssistant = document.getElementById('simPrevAssistantText')?.value || '';
        log('Running full context simulation dry-run...', 'info');

        const res = await fetch('/v1/lorebooks/compile', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            store: state.lorebookStore,
            systemPromptStore: state.systemPromptStore,
            sampleText: text,
            previousAssistantText: prevAssistant
          })
        });

        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const data = await res.json();

        el.simCompiledOutput.textContent = data.compiled_prompt || '(Empty prompt returned)';
        if (el.simOutDay) el.simOutDay.textContent = `Extracted Day: ${data.current_day !== null ? `Day ${data.current_day}` : 'None'}`;
        if (el.simOutCount) el.simOutCount.textContent = `Active Lores: ${data.active_count}`;

        const simOutRules = document.getElementById('simOutRules');
        if (simOutRules) simOutRules.textContent = `Triggered Rules: ${data.triggered_rules_count || 0}`;

        const simOutFixFormat = document.getElementById('simOutFixFormat');
        if (simOutFixFormat) simOutFixFormat.textContent = `FixFormat: ${data.fix_format ? 'On' : 'Off'} | AutoLB: ${data.auto_line_break ? 'On' : 'Off'}`;

        log(`Simulation finished. Active Lores: ${data.active_count}, Triggered Rules: ${data.triggered_rules_count || 0}`, 'success');
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

    // System Prompt & Rules Event Handlers
    if (el.spRuleTypeSelect) {
      el.spRuleTypeSelect.addEventListener('change', (e) => {
        updateSpParamVisibility(e.target.value);
      });
    }

    if (el.btnSaveSpBase) {
      el.btnSaveSpBase.addEventListener('click', async () => {
        state.systemPromptStore.system_prompt = el.spBasePromptInput.value.trim();
        await saveSystemPromptStore();
      });
    }

    if (el.btnSaveSpFeatures) {
      el.btnSaveSpFeatures.addEventListener('click', async () => {
        state.systemPromptStore.features = {
          fixFormat: !!el.spToggleFixFormat.checked,
          autoLineBreak: !!el.spToggleAutoLineBreak.checked
        };
        await saveSystemPromptStore();
      });
    }

    if (el.btnSaveSpRule) {
      el.btnSaveSpRule.addEventListener('click', async () => {
        const ruleId = state.selectedSpItem;
        if (!ruleId || ruleId === 'sp_base' || ruleId === 'sp_features') return;

        const store = state.systemPromptStore;
        let ruleType = el.spRuleTypeSelect.value;
        
        store.shorter_rules = (store.shorter_rules || []).filter(r => r.id !== ruleId);
        store.keyremind_rules = (store.keyremind_rules || []).filter(r => r.id !== ruleId);
        store.trigger_rules = (store.trigger_rules || []).filter(r => r.id !== ruleId);

        const updatedRule = {
          id: ruleId,
          name: el.spRuleNameInput.value.trim() || 'Untitled Rule',
          enabled: el.spRuleEnabledCheckbox.checked,
          prompt: el.spRulePromptInput.value.trim()
        };

        if (ruleType === 'shorter') {
          updatedRule.max_length = Number(el.spParamMaxLength.value) || 500;
          store.shorter_rules.push(updatedRule);
        } else if (ruleType === 'keyremind') {
          updatedRule.key = el.spParamKey.value.trim();
          store.keyremind_rules.push(updatedRule);
        } else if (ruleType === 'trigger') {
          updatedRule.keywords = el.spParamKeywords.value.split(',').map(k => k.trim()).filter(Boolean);
          updatedRule.depth_scan = Number(el.spParamDepth.value) || 2;
          updatedRule.insertion = el.spParamInsertion.value || 'context';
          store.trigger_rules.push(updatedRule);
        }

        await saveSystemPromptStore();
        renderSystemPromptTree();
        selectSpItem(ruleId);
      });
    }

    if (el.btnDeleteSpRule) {
      el.btnDeleteSpRule.addEventListener('click', async () => {
        const ruleId = state.selectedSpItem;
        if (!ruleId || ruleId === 'sp_base' || ruleId === 'sp_features') return;
        if (!confirm('Are you sure you want to delete this prompt rule?')) return;

        const store = state.systemPromptStore;
        store.shorter_rules = (store.shorter_rules || []).filter(r => r.id !== ruleId);
        store.keyremind_rules = (store.keyremind_rules || []).filter(r => r.id !== ruleId);
        store.trigger_rules = (store.trigger_rules || []).filter(r => r.id !== ruleId);

        await saveSystemPromptStore();
        selectSpItem('sp_base');
      });
    }

    if (el.btnAddSpRule) {
      el.btnAddSpRule.addEventListener('click', async () => {
        const newId = `rule_${Date.now()}`;
        const newRule = {
          id: newId,
          name: 'New Prompt Rule',
          enabled: true,
          max_length: 500,
          prompt: '[Rule Prompt]: ...'
        };
        if (!Array.isArray(state.systemPromptStore.shorter_rules)) {
          state.systemPromptStore.shorter_rules = [];
        }
        state.systemPromptStore.shorter_rules.push(newRule);
        await saveSystemPromptStore();
        renderSystemPromptTree();
        selectSpItem(newId);
      });
    }
  }

  // --- INITIALIZATION ---
  async function init() {
    bindEvents();
    const isAuth = await verifyAuthKey(state.authKey);
    if (isAuth) {
      loadLorebookStore();
      loadSystemPromptStore();
      selectSpItem('sp_base');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
