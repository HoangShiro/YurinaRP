// scripts/upstashModelConfig.js — Upstash Redis Model Config Access Layer
const fs = require('fs');
const path = require('path');

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

function getDefaultModelConfig() {
  return {
    fallback_enabled: false,
    thinking_enabled: true,
    fallback_models: [],
    recent_models: [],
    model_capabilities: {}
  };
}

function addRecentModel(config, modelId) {
  if (!modelId || typeof modelId !== 'string') return false;
  if (!Array.isArray(config.recent_models)) {
    config.recent_models = [];
  }
  const cleanId = modelId.trim();
  const existingIdx = config.recent_models.indexOf(cleanId);
  if (existingIdx === 0) return false; // Already at top
  
  if (existingIdx > 0) {
    config.recent_models.splice(existingIdx, 1);
  }
  config.recent_models.unshift(cleanId);
  if (config.recent_models.length > 10) {
    config.recent_models = config.recent_models.slice(0, 10);
  }
  return true;
}

function setModelCapability(config, modelId, capData) {
  if (!modelId || typeof modelId !== 'string') return;
  if (!config.model_capabilities || typeof config.model_capabilities !== 'object') {
    config.model_capabilities = {};
  }
  config.model_capabilities[modelId] = {
    supports_thinking: !!capData.supports_thinking,
    strategy: capData.strategy || 'none', // 'thinking' | 'thinking_mode' | 'reasoning_effort' | 'none'
    tested_at: Date.now()
  };
}

async function fetchRemoteModelConfigStore() {
  const config = getUpstashConfig();
  if (!config) return getDefaultModelConfig();

  try {
    const res = await fetch(`${config.url}/get/model_config_store`, {
      headers: { Authorization: `Bearer ${config.token}` }
    });
    if (!res.ok) return getDefaultModelConfig();
    const data = await res.json();
    if (!data || data.result === null || data.result === undefined) {
      return getDefaultModelConfig();
    }
    const store = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
    if (store && typeof store === 'object') {
      // Ensure defaults for missing keys
      if (typeof store.thinking_enabled !== 'boolean') store.thinking_enabled = true;
      if (!Array.isArray(store.recent_models)) store.recent_models = [];
      if (!store.model_capabilities || typeof store.model_capabilities !== 'object') store.model_capabilities = {};
      return store;
    }
    return getDefaultModelConfig();
  } catch (err) {
    console.warn('[MODEL-CONFIG-STORE] Upstash fetch error, using default config:', err.message);
    return getDefaultModelConfig();
  }
}

async function saveRemoteModelConfigStore(storeData) {
  const config = getUpstashConfig();
  if (!config) {
    throw new Error('Upstash Redis credentials (UPSTASH_REDIS_REST_URL / KV_REST_API_URL) are not configured.');
  }

  const payload = typeof storeData === 'string' ? storeData : JSON.stringify(storeData);

  const res = await fetch(`${config.url}/set/model_config_store`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json'
    },
    body: payload
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Upstash error status ${res.status}: ${errText}`);
  }

  return await res.json();
}

module.exports = {
  fetchRemoteModelConfigStore,
  saveRemoteModelConfigStore,
  getUpstashConfig,
  getDefaultModelConfig,
  addRecentModel,
  setModelCapability
};

