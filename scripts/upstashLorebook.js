// upstashLorebook.js — Upstash Redis Remote Lorebook Integration for NIM Proxy

/**
 * Helper to get Upstash Redis REST API credentials from environment variables.
 * Supports both custom UPSTASH_* and standard Vercel KV_* variable names.
 */
function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

/**
 * Fetches the global remote lorebook content from Upstash Redis.
 */
async function fetchRemoteLorebook() {
  const config = getUpstashConfig();
  if (!config) return '';

  try {
    const res = await fetch(`${config.url}/get/global_lorebook`, {
      headers: { Authorization: `Bearer ${config.token}` }
    });
    if (!res.ok) return '';
    const data = await res.json();
    return data?.result || '';
  } catch (err) {
    console.warn('[UPSTASH] Failed to fetch remote lorebook:', err.message);
    return '';
  }
}

/**
 * Saves or updates the global remote lorebook content in Upstash Redis.
 */
async function saveRemoteLorebook(content) {
  const config = getUpstashConfig();
  if (!config) {
    throw new Error('Upstash environment variables (UPSTASH_REDIS_REST_URL / KV_REST_API_URL) not configured');
  }

  const loreContent = typeof content === 'string' ? content : JSON.stringify(content);

  const res = await fetch(`${config.url}/set/global_lorebook`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'text/plain'
    },
    body: loreContent
  });
  
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Upstash error status ${res.status}: ${errText}`);
  }

  return await res.json();
}

module.exports = {
  fetchRemoteLorebook,
  saveRemoteLorebook,
  getUpstashConfig
};
