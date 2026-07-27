// scripts/uploadWorldState.js — Upload seed_world_state.json to Upstash Redis
const fs = require('fs');
const path = require('path');

// Load .env variables
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  envText.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value.trim();
    }
  });
}

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

async function uploadWorldState(customConfig = null) {
  const config = customConfig || getUpstashConfig();
  if (!config || !config.url || !config.token) {
    console.error('[ERROR] Upstash credentials missing! Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.');
    process.exit(1);
  }

  const seedPath = path.join(__dirname, '..', 'seed_world_state.json');
  if (!fs.existsSync(seedPath)) {
    console.error(`[ERROR] seed_world_state.json not found at ${seedPath}`);
    process.exit(1);
  }

  const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

  console.log(`[UPLOAD] Starting World State upload to Upstash Redis at ${config.url}...`);

  const domains = ['meta', 'organizations', 'systems', 'facilities', 'specifications', 'personnel', 'catalog', 'financials'];

  for (const domain of domains) {
    if (!seedData[domain]) continue;

    const key = `world:${domain}`;
    const value = JSON.stringify(seedData[domain]);

    try {
      const res = await fetch(`${config.url}/set/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json'
        },
        body: value
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[UPLOAD] ✗ Failed to upload key '${key}': ${res.status} - ${errText}`);
      } else {
        const result = await res.json();
        console.log(`[UPLOAD] ✓ Key '${key}' uploaded successfully.`);
      }
    } catch (err) {
      console.error(`[UPLOAD] ✗ Exception uploading key '${key}':`, err.message);
    }
  }

  // Also save a compiled global snapshot key: world:snapshot
  try {
    const res = await fetch(`${config.url}/set/world:full_state`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(seedData)
    });
    if (res.ok) {
      console.log('[UPLOAD] ✓ Key \'world:full_state\' uploaded successfully.');
    }
  } catch (err) {
    console.error('[UPLOAD] ✗ Failed to set full_state key:', err.message);
  }

  console.log('[UPLOAD] World State upload completed!');
}

if (require.main === module) {
  uploadWorldState();
}

module.exports = { uploadWorldState };
