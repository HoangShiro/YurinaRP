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
    fallback_models: [],
    model_registry: [],
    thinking_start_tag: '<think>',
    thinking_end_tag: '</think>'
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
      if (!Array.isArray(store.fallback_models)) store.fallback_models = [];
      if (!Array.isArray(store.model_registry)) store.model_registry = [];
      if (!store.thinking_start_tag) store.thinking_start_tag = '<think>';
      if (!store.thinking_end_tag) store.thinking_end_tag = '</think>';
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
  getDefaultModelConfig
};
