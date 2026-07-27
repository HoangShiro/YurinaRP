// stateTracker.js — Secondary LLM Mutation Tracker
const axios = require('axios');
const { fetchFullWorldState, saveFullWorldState } = require('./upstashWorldState');
const { processWorldStateTick, getNestedValue, setNestedValue } = require('./worldStateEngine');

const NIM_API_BASE = process.env.NIM_API_BASE || 'https://integrate.api.nvidia.com/v1';
const NIM_API_KEY = process.env.NIM_API_KEY;
const TRACKER_MODEL = process.env.TRACKER_MODEL || 'deepseek-ai/deepseek-v4-flash';

const TRACKER_SYSTEM_PROMPT = `You are the World State Tracker Engine for Yuri Systems (Stagaia).
Your task is to analyze the latest roleplay interaction turn and identify any structural, financial, infrastructure, or personnel changes in the world.

SUPPORTED MUTATION ACTIONS:
1. UPDATE_VAR: Modify numeric or string variables.
   - Example: { "action": "UPDATE_VAR", "path": "financials.reserves.store_liquid_platinum", "op": "ADD", "value": -50 }
2. UPSERT_ENTITY: Add or update an entity/item/facility/branch.
   - Example: { "action": "UPSERT_ENTITY", "domain": "facilities", "key": "yuri_cosmetics_branch_4", "data": { "name": "Khaldor Branch", "status": "active" } }
3. DELETE_ENTITY: Remove an entity/item/branch.
   - Example: { "action": "DELETE_ENTITY", "domain": "catalog", "key": "item_id" }

OUTPUT FORMAT:
Return ONLY valid JSON matching this schema:
{
  "has_changes": boolean,
  "reason": "Brief explanation",
  "mutations": [ ... ]
}
If no world state metrics changed, return: { "has_changes": false }`;

/**
 * Runs asynchronously after a completion turn to detect state mutations
 */
async function analyzeAndUpdateState(userMessages, assistantResponse) {
  if (!NIM_API_KEY) return;

  try {
    const currentState = await fetchFullWorldState();
    if (!currentState) return;

    const recentTurnText = `[USER PROMPT]\n${getLastUserText(userMessages)}\n\n[ASSISTANT RESPONSE]\n${assistantResponse}`;

    const payload = {
      model: TRACKER_MODEL,
      messages: [
        { role: 'system', content: TRACKER_SYSTEM_PROMPT },
        { role: 'user', content: recentTurnText }
      ],
      temperature: 0.1,
      max_tokens: 1000
    };

    const res = await axios.post(`${NIM_API_BASE}/chat/completions`, payload, {
      headers: {
        Authorization: `Bearer ${NIM_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 20000
    });

    const replyContent = res.data?.choices?.[0]?.message?.content || '';
    const jsonMatch = replyContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const trackerResult = JSON.parse(jsonMatch[0]);

    if (!trackerResult.has_changes || !Array.isArray(trackerResult.mutations) || trackerResult.mutations.length === 0) {
      return;
    }

    console.log(`[STATE-TRACKER] Detected ${trackerResult.mutations.length} state mutation(s). Reason: ${trackerResult.reason || 'N/A'}`);

    let stateModified = false;

    for (const mut of trackerResult.mutations) {
      if (mut.action === 'UPDATE_VAR' && mut.path) {
        let currentVal = getNestedValue(currentState, mut.path) || 0;
        if (mut.op === 'ADD') {
          currentVal += mut.value;
        } else if (mut.op === 'SUB') {
          currentVal -= mut.value;
        } else {
          currentVal = mut.value;
        }
        setNestedValue(currentState, mut.path, currentVal);
        stateModified = true;
        console.log(`[STATE-TRACKER] ✓ UPDATE_VAR '${mut.path}' = ${currentVal}`);
      } else if (mut.action === 'UPSERT_ENTITY' && mut.domain && mut.key) {
        if (!currentState[mut.domain]) currentState[mut.domain] = {};
        currentState[mut.domain][mut.key] = mut.data;
        stateModified = true;
        console.log(`[STATE-TRACKER] ✓ UPSERT_ENTITY '${mut.domain}.${mut.key}'`);
      } else if (mut.action === 'DELETE_ENTITY' && mut.domain && mut.key) {
        if (currentState[mut.domain] && currentState[mut.domain][mut.key]) {
          delete currentState[mut.domain][mut.key];
          stateModified = true;
          console.log(`[STATE-TRACKER] ✓ DELETE_ENTITY '${mut.domain}.${mut.key}'`);
        }
      }
    }

    if (stateModified) {
      await saveFullWorldState(currentState);
      await processWorldStateTick(); // Recalculate financial expressions with new variables
      console.log('[STATE-TRACKER] ✓ World State mutations saved to Upstash Redis.');
    }

  } catch (err) {
    console.warn('[STATE-TRACKER] Background mutation tracker failed:', err.message);
  }
}

function getLastUserText(messages) {
  if (!Array.isArray(messages)) return '';
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      return typeof messages[i].content === 'string' ? messages[i].content : JSON.stringify(messages[i].content);
    }
  }
  return '';
}

module.exports = { analyzeAndUpdateState };
