// upstashWorldState.js — Data Access Layer for Upstash Redis World State
const fs = require('fs');
const path = require('path');

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

const DOMAINS = ['meta', 'organizations', 'systems', 'facilities', 'specifications', 'personnel', 'catalog', 'financials'];

/**
 * Fetches a single domain state from Upstash Redis.
 */
async function fetchWorldDomain(domain) {
  const config = getUpstashConfig();
  if (!config) {
    // Fallback to local seed_world_state.json if Upstash is not configured
    return getLocalSeedDomain(domain);
  }

  try {
    const res = await fetch(`${config.url}/get/world:${encodeURIComponent(domain)}`, {
      headers: { Authorization: `Bearer ${config.token}` }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.result === null || data.result === undefined) return null;
    return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
  } catch (err) {
    console.warn(`[UPSTASH-WORLD] Failed to fetch domain '${domain}':`, err.message);
    return getLocalSeedDomain(domain);
  }
}

/**
 * Fetches the entire 7-domain World State object from Upstash Redis.
 */
async function fetchFullWorldState() {
  const config = getUpstashConfig();
  if (!config) {
    return getLocalFullSeed();
  }

  try {
    const results = await Promise.all(DOMAINS.map(d => fetchWorldDomain(d)));
    const fullState = {};
    let hasData = false;

    DOMAINS.forEach((domain, idx) => {
      if (results[idx]) {
        fullState[domain] = results[idx];
        hasData = true;
      }
    });

    if (!hasData) {
      console.warn('[UPSTASH-WORLD] Upstash returned empty data, using local seed fallback.');
      return getLocalFullSeed();
    }

    return fullState;
  } catch (err) {
    console.warn('[UPSTASH-WORLD] Error fetching full world state:', err.message);
    return getLocalFullSeed();
  }
}

/**
 * Saves a single domain state to Upstash Redis.
 */
async function saveWorldDomain(domain, data) {
  const config = getUpstashConfig();
  if (!config) {
    console.warn('[UPSTASH-WORLD] Cannot save, Upstash credentials not set.');
    return null;
  }

  const payload = typeof data === 'string' ? data : JSON.stringify(data);

  const res = await fetch(`${config.url}/set/world:${encodeURIComponent(domain)}`, {
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

/**
 * Saves all 7 domains and the master snapshot key back to Upstash Redis.
 */
async function saveFullWorldState(fullState) {
  const config = getUpstashConfig();
  if (!config) return null;

  const savePromises = DOMAINS.map(domain => {
    if (fullState[domain]) {
      return saveWorldDomain(domain, fullState[domain]);
    }
    return Promise.resolve();
  });

  await Promise.all(savePromises);

  // Update master full_state key
  try {
    await fetch(`${config.url}/set/world:full_state`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fullState)
    });
  } catch (err) {
    console.warn('[UPSTASH-WORLD] Failed to update full_state key:', err.message);
  }
}

/** Local seed fallbacks */
function getLocalSeedDomain(domain) {
  const seed = getLocalFullSeed();
  return seed ? seed[domain] || null : null;
}

function getLocalFullSeed() {
  try {
    const seedPath = path.join(__dirname, '..', 'seed_world_state.json');
    if (fs.existsSync(seedPath)) {
      return JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    }
  } catch (err) {
    console.warn('[UPSTASH-WORLD] Local seed fallback failed:', err.message);
  }
  return null;
}

module.exports = {
  fetchWorldDomain,
  fetchFullWorldState,
  saveWorldDomain,
  saveFullWorldState,
  getUpstashConfig
};
