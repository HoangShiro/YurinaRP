// upstashChatHistory.js — Data Access Layer for Upstash Redis Chat History & Summary
const fs = require('fs');
const path = require('path');

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

// Memory fallback if Redis is not configured or fails
let memoryChatHistory = [];
let memoryChatSummary = '';

/**
 * Fetches the latest chat history array from Upstash Redis.
 */
async function fetchChatHistory() {
  const config = getUpstashConfig();
  if (!config) {
    return memoryChatHistory;
  }

  try {
    const res = await fetch(`${config.url}/get/chat_history`, {
      headers: { Authorization: `Bearer ${config.token}` }
    });
    if (!res.ok) return memoryChatHistory;
    const data = await res.json();
    if (!data || data.result === null || data.result === undefined) return memoryChatHistory;
    const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
    return Array.isArray(parsed) ? parsed : memoryChatHistory;
  } catch (err) {
    console.warn('[UPSTASH-HISTORY] Failed to fetch chat history:', err.message);
    return memoryChatHistory;
  }
}

/**
 * Overwrites the entire chat history array on Upstash Redis.
 */
async function saveChatHistory(messages) {
  if (!Array.isArray(messages)) return false;
  memoryChatHistory = messages;

  const config = getUpstashConfig();
  if (!config) return true;

  try {
    const payload = JSON.stringify(messages);
    const res = await fetch(`${config.url}/set/chat_history`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch (err) {
    console.warn('[UPSTASH-HISTORY] Failed to save chat history:', err.message);
    return false;
  }
}

/**
 * Fetches the latest chat summary text from Upstash Redis.
 */
async function fetchChatSummary() {
  const config = getUpstashConfig();
  if (!config) {
    return memoryChatSummary;
  }

  try {
    const res = await fetch(`${config.url}/get/chat_summary`, {
      headers: { Authorization: `Bearer ${config.token}` }
    });
    if (!res.ok) return memoryChatSummary;
    const data = await res.json();
    if (!data || data.result === null || data.result === undefined) return memoryChatSummary;
    return typeof data.result === 'string' ? data.result : String(data.result);
  } catch (err) {
    console.warn('[UPSTASH-HISTORY] Failed to fetch chat summary:', err.message);
    return memoryChatSummary;
  }
}

/**
 * Overwrites the chat summary text on Upstash Redis.
 */
async function saveChatSummary(summaryText) {
  const text = typeof summaryText === 'string' ? summaryText : '';
  memoryChatSummary = text;

  const config = getUpstashConfig();
  if (!config) return true;

  try {
    const res = await fetch(`${config.url}/set/chat_summary`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(text)
    });
    return res.ok;
  } catch (err) {
    console.warn('[UPSTASH-HISTORY] Failed to save chat summary:', err.message);
    return false;
  }
}

module.exports = {
  fetchChatHistory,
  saveChatHistory,
  fetchChatSummary,
  saveChatSummary
};
