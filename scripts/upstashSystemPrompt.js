// upstashSystemPrompt.js — Upstash Redis System Prompt & Rules Access Layer
const fs = require('fs');
const path = require('path');

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

function getLocalSeedStore() {
  try {
    const seedPath = path.join(__dirname, '..', 'seed_system_prompt.json');
    if (fs.existsSync(seedPath)) {
      return JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    }
  } catch (err) {
    console.warn('[SYSTEM-PROMPT-STORE] Failed to read local seed file:', err.message);
  }
  return {
    system_prompt: '',
    features: { fixFormat: true, autoLineBreak: true },
    shorter_rules: [],
    keyremind_rules: [],
    trigger_rules: []
  };
}

/**
 * Fetches the complete System Prompt & Rules JSON object from Upstash Redis or local seed.
 */
async function fetchRemoteSystemPromptStore() {
  const config = getUpstashConfig();
  if (!config) {
    return getLocalSeedStore();
  }

  try {
    const res = await fetch(`${config.url}/get/system_prompt_store`, {
      headers: { Authorization: `Bearer ${config.token}` }
    });
    if (!res.ok) return getLocalSeedStore();
    const data = await res.json();
    if (!data || data.result === null || data.result === undefined) {
      return getLocalSeedStore();
    }
    const store = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
    return store && typeof store === 'object' ? store : getLocalSeedStore();
  } catch (err) {
    console.warn('[SYSTEM-PROMPT-STORE] Upstash fetch error, using seed fallback:', err.message);
    return getLocalSeedStore();
  }
}

/**
 * Saves the complete System Prompt & Rules JSON object to Upstash Redis.
 */
async function saveRemoteSystemPromptStore(storeData) {
  const config = getUpstashConfig();
  if (!config) {
    throw new Error('Upstash Redis credentials (UPSTASH_REDIS_REST_URL / KV_REST_API_URL) are not configured.');
  }

  const payload = typeof storeData === 'string' ? storeData : JSON.stringify(storeData);

  const res = await fetch(`${config.url}/set/system_prompt_store`, {
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
  fetchRemoteSystemPromptStore,
  saveRemoteSystemPromptStore,
  getUpstashConfig,
  getLocalSeedStore
};
