// eventTriggers.js — Event Trigger Evaluator & HTML Tag Cleaner for NIM Proxy

/**
 * Cleans HTML trigger tags from text content.
 */
function cleanTextFromTags(text) {
  if (typeof text !== 'string') return text;
  
  // Remove <shorter>...</shorter>
  text = text.replace(/<shorter[\s\S]*?<\/shorter>/gi, '');
  // Remove <keyremind>...</keyremind>
  text = text.replace(/<keyremind[\s\S]*?<\/keyremind>/gi, '');
  // Remove <lorebook>...</lorebook>
  text = text.replace(/<lorebook[\s\S]*?<\/lorebook>/gi, '');
  // Remove <fixformat>...</fixformat>
  text = text.replace(/<fixformat[\s\S]*?<\/fixformat>/gi, '');
  // Remove <autolinebreak>...</autolinebreak>
  text = text.replace(/<autolinebreak[\s\S]*?<\/autolinebreak>/gi, '');

  // Clean up excess blank lines leftover from tag removals
  text = text.replace(/\n\s*\n\s*\n+/g, '\n\n');
  return text.trim();
}

/**
 * Helper to get full text from a message object.
 */
function getMsgText(msg) {
  if (!msg || !msg.content) return '';
  if (typeof msg.content === 'string') return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter(part => part && part.type === 'text' && typeof part.text === 'string')
      .map(part => part.text)
      .join('\n');
  }
  return '';
}

/**
 * Evaluates triggers from System Prompt Store (JSON) as well as legacy HTML tags in messages.
 * Strips all HTML tags from message context.
 */
function processEventTriggers(messages, systemPromptStore = null) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { messages: messages || [], fixFormat: false, autoLineBreak: false, triggeredPrompts: [] };
  }

  let fixFormat = systemPromptStore?.features?.fixFormat ?? false;
  let autoLineBreak = systemPromptStore?.features?.autoLineBreak ?? false;

  const shorterRules = [];
  const keyremindRules = [];
  const triggerRules = [];

  // Load rules from systemPromptStore (JSON)
  if (systemPromptStore) {
    if (Array.isArray(systemPromptStore.shorter_rules)) {
      systemPromptStore.shorter_rules.forEach(r => {
        if (r && r.enabled !== false && r.prompt) {
          shorterRules.push({
            length: Number(r.max_length || r.length) || 500,
            prompt: r.prompt
          });
        }
      });
    }

    if (Array.isArray(systemPromptStore.keyremind_rules)) {
      systemPromptStore.keyremind_rules.forEach(r => {
        if (r && r.enabled !== false && r.key && r.prompt) {
          keyremindRules.push({
            key: r.key,
            prompt: r.prompt
          });
        }
      });
    }

    if (Array.isArray(systemPromptStore.trigger_rules)) {
      systemPromptStore.trigger_rules.forEach(r => {
        if (r && r.enabled !== false && r.prompt) {
          const kws = Array.isArray(r.keywords) ? r.keywords : (r.keywords || '').split(',').map(k => k.trim()).filter(Boolean);
          if (kws.length > 0) {
            triggerRules.push({
              depth_scan: Number(r.depth_scan) || 2,
              insertion: r.insertion || 'context',
              keywords: kws,
              prompt: r.prompt
            });
          }
        }
      });
    }
  }

  // Step 1: Scan for legacy HTML tags across all messages (fallback compatibility)
  messages.forEach(msg => {
    const text = getMsgText(msg);
    if (!text) return;

    // Legacy <fixformat>
    const fixMatches = text.match(/<fixformat>([\s\S]*?)<\/fixformat>/gi);
    if (fixMatches) {
      fixMatches.forEach(m => {
        const val = m.replace(/<\/?fixformat>/gi, '').trim().toLowerCase();
        if (val === 'on' || val === 'true' || val === '1') fixFormat = true;
      });
    }

    // Legacy <autolinebreak>
    const autoLbMatches = text.match(/<autolinebreak>([\s\S]*?)<\/autolinebreak>/gi);
    if (autoLbMatches) {
      autoLbMatches.forEach(m => {
        const val = m.replace(/<\/?autolinebreak>/gi, '').trim().toLowerCase();
        if (val === 'on' || val === 'true' || val === '1') autoLineBreak = true;
      });
    }

    // Legacy <shorter>
    const shorterMatches = text.match(/<shorter[\s\S]*?<\/shorter>/gi);
    if (shorterMatches) {
      shorterMatches.forEach(block => {
        const lenMatch = block.match(/<length>(\d+)<\/length>/i);
        const promptMatch = block.match(/<prompt>([\s\S]*?)<\/prompt>/i);
        if (lenMatch && promptMatch) {
          shorterRules.push({
            length: parseInt(lenMatch[1], 10),
            prompt: promptMatch[1].trim()
          });
        }
      });
    }

    // Legacy <keyremind>
    const keyremindMatches = text.match(/<keyremind[\s\S]*?<\/keyremind>/gi);
    if (keyremindMatches) {
      keyremindMatches.forEach(block => {
        const keyRegex = /<key((?!remind)\w*)>([\s\S]*?)<\/key\1>/gi;
        let kMatch;
        while ((kMatch = keyRegex.exec(block)) !== null) {
          const suffix = kMatch[1];
          const keyValue = kMatch[2].trim();
          
          const promptRegex = new RegExp(`<prompt${suffix}>([\\s\\S]*?)<\\/prompt${suffix}>`, 'i');
          const pMatch = block.match(promptRegex);
          if (pMatch && keyValue) {
            keyremindRules.push({
              key: keyValue,
              prompt: pMatch[1].trim()
            });
          }
        }
      });
    }

    // Legacy <lorebook>
    const lorebookMatches = text.match(/<lorebook[\s\S]*?<\/lorebook>/gi);
    if (lorebookMatches) {
      lorebookMatches.forEach(lorebookBlock => {
        const promptIndices = [];
        let match;
        const pGlobalRegex = /<prompt>([\s\S]*?)<\/prompt>/gi;
        while ((match = pGlobalRegex.exec(lorebookBlock)) !== null) {
          promptIndices.push({
            prompt: match[1].trim(),
            startIndex: match.index,
            endIndex: pGlobalRegex.lastIndex
          });
        }

        let prevEnd = 0;
        promptIndices.forEach(pItem => {
          const headerSegment = lorebookBlock.substring(prevEnd, pItem.startIndex);
          prevEnd = pItem.endIndex;

          const depthMatch = headerSegment.match(/<depth_scan>(\d+)<\/depth_scan>/i);
          const depth_scan = depthMatch ? parseInt(depthMatch[1], 10) : 1;

          const insertMatch = headerSegment.match(/<insertion>(context|user_msg)<\/insertion>/i);
          const insertion = insertMatch ? insertMatch[1].toLowerCase() : 'context';

          const kwMatch = headerSegment.match(/<keywords>([\s\S]*?)<\/keywords>/i);
          const rawKw = kwMatch ? kwMatch[1].trim() : '';
          const keywords = rawKw.split(',').map(k => k.trim()).filter(Boolean);

          if (keywords.length > 0 && pItem.prompt) {
            triggerRules.push({
              depth_scan,
              insertion,
              keywords,
              prompt: pItem.prompt
            });
          }
        });
      });
    }
  });

  // Step 2: Clean ALL trigger and config tags from messages
  const cleanedMessages = messages.map(msg => {
    const newMsg = { ...msg };
    if (typeof newMsg.content === 'string') {
      newMsg.content = cleanTextFromTags(newMsg.content);
    } else if (Array.isArray(newMsg.content)) {
      newMsg.content = newMsg.content.map(part => {
        if (part && part.type === 'text' && typeof part.text === 'string') {
          return {
            ...part,
            text: cleanTextFromTags(part.text)
          };
        }
        return part;
      });
    }
    return newMsg;
  });

  // Step 3: Find the last assistant message
  let lastAssistantMsgText = '';
  for (let i = cleanedMessages.length - 1; i >= 0; i--) {
    if (cleanedMessages[i].role === 'assistant') {
      lastAssistantMsgText = getMsgText(cleanedMessages[i]);
      break;
    }
  }

  // Step 4: Evaluate trigger conditions
  const triggeredUserPrompts = [];
  const triggeredContextPrompts = [];

  // Evaluate shorter rules
  if (shorterRules.length > 0 && lastAssistantMsgText) {
    const charCount = lastAssistantMsgText.replace(/[\s\r\n]/g, '').length;
    shorterRules.forEach(rule => {
      if (charCount > rule.length) {
        triggeredUserPrompts.push(rule.prompt);
      }
    });
  }

  // Evaluate keyremind rules
  if (keyremindRules.length > 0 && lastAssistantMsgText) {
    keyremindRules.forEach(rule => {
      if (!lastAssistantMsgText.includes(rule.key)) {
        triggeredUserPrompts.push(rule.prompt);
      }
    });
  }

  // Evaluate trigger rules
  if (triggerRules.length > 0) {
    triggerRules.forEach(rule => {
      let userCount = 0;
      let assistantCount = 0;
      const scannedTexts = [];

      for (let i = cleanedMessages.length - 1; i >= 0; i--) {
        const msg = cleanedMessages[i];
        if (msg.role === 'user' && userCount < rule.depth_scan) {
          scannedTexts.push(getMsgText(msg));
          userCount++;
        } else if (msg.role === 'assistant' && assistantCount < rule.depth_scan) {
          scannedTexts.push(getMsgText(msg));
          assistantCount++;
        }
        if (userCount >= rule.depth_scan && assistantCount >= rule.depth_scan) {
          break;
        }
      }

      const fullScannedText = scannedTexts.join(' ').toLowerCase();

      // Check if ANY keyword matches
      const isTriggered = rule.keywords.some(kw => fullScannedText.includes(kw.toLowerCase()));
      if (isTriggered) {
        if (rule.insertion === 'user_msg') {
          triggeredUserPrompts.push(rule.prompt);
        } else {
          triggeredContextPrompts.push(rule.prompt);
        }
      }
    });
  }

  // Step 5: Insert triggered context prompts (after system prompt)
  if (triggeredContextPrompts.length > 0) {
    const contextPromptText = triggeredContextPrompts.join('\n\n');
    if (cleanedMessages.length > 0 && cleanedMessages[0].role === 'system') {
      const sysMsg = cleanedMessages[0];
      if (typeof sysMsg.content === 'string') {
        sysMsg.content += '\n\n' + contextPromptText;
      } else if (Array.isArray(sysMsg.content)) {
        const textPart = sysMsg.content.find(p => p.type === 'text');
        if (textPart) {
          textPart.text += '\n\n' + contextPromptText;
        } else {
          sysMsg.content.push({ type: 'text', text: '\n\n' + contextPromptText });
        }
      }
    } else {
      cleanedMessages.unshift({
        role: 'system',
        content: contextPromptText
      });
    }
  }

  // Step 6: Append triggered user_msg prompts (end of last user message)
  if (triggeredUserPrompts.length > 0) {
    let lastUserIdx = -1;
    for (let i = cleanedMessages.length - 1; i >= 0; i--) {
      if (cleanedMessages[i].role === 'user') {
        lastUserIdx = i;
        break;
      }
    }

    const combinedUserPrompt = '\n\n' + triggeredUserPrompts.join('\n\n');

    if (lastUserIdx !== -1) {
      const userMsg = cleanedMessages[lastUserIdx];
      if (typeof userMsg.content === 'string') {
        userMsg.content += combinedUserPrompt;
      } else if (Array.isArray(userMsg.content)) {
        const textPart = userMsg.content.find(p => p.type === 'text');
        if (textPart) {
          textPart.text += combinedUserPrompt;
        } else {
          userMsg.content.push({ type: 'text', text: combinedUserPrompt });
        }
      }
    } else {
      cleanedMessages.push({
        role: 'user',
        content: combinedUserPrompt.trim()
      });
    }
  }

  return {
    messages: cleanedMessages,
    fixFormat,
    autoLineBreak,
    triggeredPrompts: [...triggeredContextPrompts, ...triggeredUserPrompts]
  };
}

module.exports = {
  cleanTextFromTags,
  processEventTriggers
};
