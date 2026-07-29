// formatFixer.js — Auto Line Break & Smart Format Fixer for NIM Proxy

/**
 * Applies smart line breaks between adjacent roleplay/story format elements if missing.
 */
function applyAutoLineBreak(text) {
  if (typeof text !== 'string' || !text) return text;

  // 1. Same-line adjacent RP elements (separated by horizontal spaces)
  // e.g. *Action.* "Dialogue." -> *Action.*\n\n"Dialogue."
  text = text.replace(/(\*[^\*\n]+\*)[ \t]+(?="|`|['‘]|\[(?=[^\]]*\]))/g, '$1\n\n');
  text = text.replace(/("[^"\n]+"[^\n]*?)[ \t]+(?=\*|`|['‘]|\[(?=[^\]]*\]))/g, '$1\n\n');
  text = text.replace(/(`[^`\n]+`)[ \t]+(?=\*|"|['‘]|\[(?=[^\]]*\]))/g, '$1\n\n');

  // 2. Ensure Scene Dividers (---, ***, ___) have double newlines before AND after
  text = text.replace(/([^\n])[ \t\r]*([-*_]{3,})/g, '$1\n\n$2');
  text = text.replace(/([-*_]{3,})[ \t\r]*([^\n])/g, '$1\n\n$2');

  // 3. Ensure Status Box [...] has double newlines before
  text = text.replace(/([^\n])[ \t\r]*(\[\s*(?:🕒|🍂|📜|📍|Day|Time|Season|Year|Location|Status|HP|MP|Level|Rank)[^\]]*\])/gi, '$1\n\n$2');

  // 4. Upgrade single newlines between separate non-empty lines (paragraphs/dialogues/actions) to double newlines
  const lines = text.split('\n');
  const resultLines = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const curr = lines[i];
    const trimmed = curr.trim();

    if (/^`{3,}/.test(trimmed)) {
      inCodeBlock = !inCodeBlock;
      resultLines.push(curr);
      continue;
    }

    if (inCodeBlock) {
      resultLines.push(curr);
      continue;
    }

    if (!trimmed) {
      if (resultLines.length > 0 && resultLines[resultLines.length - 1] !== '') {
        resultLines.push('');
      }
      continue;
    }

    // If previous line was non-empty, insert blank line
    if (resultLines.length > 0 && resultLines[resultLines.length - 1] !== '') {
      resultLines.push('');
    }

    resultLines.push(curr);
  }

  return resultLines.join('\n').replace(/\n{3,}/g, '\n\n');
}

// ========================================================================
// Internal Helpers
// ========================================================================

/**
 * Count occurrences of a single character in a string.
 */
function countChar(str, ch) {
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === ch) n++;
  }
  return n;
}

/**
 * Count single asterisks, EXCLUDING those that form ** bold pairs.
 * e.g. "**text*" → strips "**" first → counts remaining "*" → 1
 */
function countSingleAsterisks(str) {
  return (str.replace(/\*\*/g, '').match(/\*/g) || []).length;
}

/**
 * Count all quote-like characters (" \u201C \u201D) as a single group.
 * LLMs may output curly/smart quotes; treating them uniformly prevents
 * false negatives when the opening is curly but closing is straight (or vice versa).
 */
function countAllQuotes(str) {
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '"' || c === '\u201C' || c === '\u201D') n++;
  }
  return n;
}

// ========================================================================
// Nested *"..."* Pattern Fixer (RP-specific)
// ========================================================================

/**
 * Handles the most common nested roleplay format: *"dialogue/action"*
 * Ensures the quote (") closes BEFORE the italic (*), respecting correct
 * Markdown nesting order.
 *
 * @param {string} content - Trimmed line content (starts with *")
 * @returns {string|null} Fixed content, or null if no fix was needed/applicable
 */
function fixNestedItalicQuote(content) {
  const quoteCount = countAllQuotes(content);
  const astCount = countSingleAsterisks(content);
  const quoteOdd = quoteCount % 2 !== 0;
  const astOdd = astCount % 2 !== 0;

  // Already balanced — nothing to do
  if (!quoteOdd && !astOdd) return null;

  // Case A: *"text...* → *"text..."*
  // Quote is unbalanced, italic is balanced, line ends with *
  // Insert closing " before the trailing * to maintain correct nesting
  if (quoteOdd && !astOdd && /\*\s*$/.test(content)) {
    return content.replace(/(\*)\s*$/, '"$1');
  }

  // Case B: *"text... → *"text..."*
  // Both quote and italic are unbalanced — close in reverse nesting order: " then *
  if (quoteOdd && astOdd) {
    return content + '"*';
  }

  // Case C: *"text..." → *"text..."*
  // Only italic is unbalanced
  if (!quoteOdd && astOdd) {
    return content + '*';
  }

  // Case D: *"text"*..."extra quote → only quote unbalanced, line doesn't end with *
  // Close the stray quote
  if (quoteOdd && !astOdd) {
    return content + '"';
  }

  return null;
}

/**
 * Handles the REVERSE nested roleplay format: "*dialogue/action*"
 * (quote wrapping italic, opposite of *"..."* above).
 * Ensures the italic (*) closes BEFORE the quote ("), respecting nesting.
 *
 * @param {string} content - Trimmed line content (starts with "*)
 * @returns {string|null} Fixed content, or null if no fix was needed/applicable
 */
function fixNestedQuoteItalic(content) {
  const quoteCount = countAllQuotes(content);
  const astCount = countSingleAsterisks(content);
  const quoteOdd = quoteCount % 2 !== 0;
  const astOdd = astCount % 2 !== 0;

  // Already balanced — nothing to do
  if (!quoteOdd && !astOdd) return null;

  // Case A: "*text..." → insert * before trailing " → "*text...*"
  // Italic is unbalanced, quote is balanced, line ends with "
  if (astOdd && !quoteOdd && /["\u201D]\s*$/.test(content)) {
    return content.replace(/(["\u201D])(\s*)$/, '*$1$2');
  }

  // Case B: "*text... → both need closing → add *" at end
  if (astOdd && quoteOdd) {
    return content + '*"';
  }

  // Case C: "*text*... → only quote needs closing
  if (!astOdd && quoteOdd) {
    return content + '"';
  }

  // Case D: italic unbalanced, quote balanced, doesn't end with "
  if (astOdd && !quoteOdd) {
    return content + '*';
  }

  return null;
}

// ========================================================================
// ========================================================================

/**
 * When multiple inline delimiter types are unbalanced on the same line,
 * determine which type "owns" the line based on its opening character.
 * The dominant type gets fixed; non-dominant stray characters are left
 * enclosed within the dominant format (harmless).
 *
 * Priority order: ` > " > * (backtick is the most distinctive/unambiguous)
 *
 * @param {string} content - Line content
 * @param {string[]} types - Array of unbalanced delimiter chars ('*', '"', '`')
 * @returns {string|null} The dominant delimiter character, or null
 */
function detectDominant(content, types) {
  // Opening character is the strongest signal
  for (const t of ['`', '"', '*']) {
    if (content.startsWith(t) && types.includes(t)) return t;
  }
  // Fallback: closing character
  for (const t of ['`', '"', '*']) {
    if (content.endsWith(t) && types.includes(t)) return t;
  }
  return types[0] || null;
}

/**
 * Add a missing delimiter to content. Decides whether to add as opener
 * (prepend) or closer (append) based on which end already has the delimiter.
 *
 * @param {string} content - Line content
 * @param {string} delim - The delimiter string ('*', '**', '"', '`')
 * @returns {string} Content with delimiter added
 */
function addDelimiter(content, delim) {
  const starts = content.startsWith(delim);
  const ends = content.endsWith(delim);

  if (starts && !ends) {
    return content + delim;    // Has opener → add closer at end
  } else if (!starts && ends) {
    return delim + content;    // Has closer → add opener at start
  }
  return content + delim;      // Default: add closer at end
}

// ========================================================================
// Bracket & Parenthesis Fixer
// ========================================================================

/**
 * Fix unbalanced bracket [] and parenthesis () pairs on a single line.
 * Counts actual occurrences of each symbol and adds the minimum number
 * of missing openers/closers to balance them.
 */
function fixBracketPairs(content) {
  // Square brackets
  const openB = (content.match(/\[/g) || []).length;
  const closeB = (content.match(/\]/g) || []).length;
  if (openB > closeB) {
    content += ' ]'.repeat(openB - closeB);
  } else if (closeB > openB) {
    content = '[ '.repeat(closeB - openB) + content;
  }

  // Parentheses
  const openP = (content.match(/\(/g) || []).length;
  const closeP = (content.match(/\)/g) || []).length;
  if (openP > closeP) {
    content += ')'.repeat(openP - closeP);
  } else if (closeP > openP) {
    content = '('.repeat(closeP - openP) + content;
  }

  return content;
}

// ========================================================================
// Inline Delimiter Fixer (*, **, ", `)
// ========================================================================

/**
 * Fix inline delimiter imbalances with cross-type conflict awareness.
 *
 * Key design decisions:
 * 1. Bold ** and Italic * share the * character. When both are "odd",
 *    a single * fixes both (because * + existing * = ** completing the bold pair).
 * 2. When multiple inline types (*, ", `) are simultaneously unbalanced,
 *    only the DOMINANT type (determined by opening character) is fixed.
 *    Non-dominant stray characters are left enclosed within the dominant
 *    format, where they render as harmless literal characters.
 * 3. Bold ** is handled independently since it doesn't semantically
 *    conflict with single-char delimiters (it's a 2-char sequence).
 */
function fixInlineDelimiters(content, skipAsterisks = false) {
  const boldPairs = skipAsterisks ? 0 : (content.match(/\*\*/g) || []).length;
  const singleAst = skipAsterisks ? 0 : countSingleAsterisks(content);
  const quotes = countAllQuotes(content);
  const backticks = countChar(content, '`');

  const boldOdd = boldPairs % 2 !== 0;
  const astOdd = singleAst % 2 !== 0;
  const quoteOdd = quotes % 2 !== 0;
  const btOdd = backticks % 2 !== 0;

  // --- Step 1: Handle Bold/Italic interaction ---
  // Bold ** and Italic * share the asterisk character.
  // When both bold pairs and single asterisks are "odd count",
  // adding one * simultaneously completes a ** pair AND closes the stray *.
  let astHandled = false;
  if (boldOdd && astOdd) {
    content = addDelimiter(content, '*');
    astHandled = true; // Both bold and italic are now fixed
  } else if (boldOdd) {
    content = addDelimiter(content, '**');
    // astOdd is false, so italic doesn't need fixing
  }

  // --- Step 2: Collect remaining unbalanced types ---
  const remaining = [];
  if (astOdd && !astHandled) remaining.push('*');
  if (quoteOdd) remaining.push('"');
  if (btOdd) remaining.push('`');

  if (remaining.length === 0) {
    return content;
  }

  if (remaining.length === 1) {
    // Single unbalanced type — no cross-type conflict, fix directly
    return addDelimiter(content, remaining[0]);
  }

  // --- Step 3: Cross-type conflict — multiple types unbalanced ---
  // When the trailing character is a DIFFERENT delimiter type than the
  // dominant opener, it's almost certainly a typo (e.g., `Text* where
  // the * should have been `). Replace the trailing char with the
  // dominant's closer for a cleaner fix.
  const dominant = detectDominant(content, remaining);
  if (dominant) {
    const lastChar = content[content.length - 1];
    if (lastChar !== dominant && remaining.includes(lastChar)) {
      // Trailing char is a stray delimiter — replace with dominant closer
      content = content.slice(0, -1) + dominant;
    } else {
      // No trailing stray — add dominant closer normally
      content = addDelimiter(content, dominant);
    }
  }

  return content;
}

// ========================================================================
// Main Per-Line Fixer
// ========================================================================

/**
 * Process a single line to fix formatting delimiters.
 * This is the core function that orchestrates all fix phases.
 */
function fixLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return line;

  // Skip special lines that should never be modified
  if (/^[-*_]{3,}\s*$/.test(trimmed)) return line;  // Dividers: ---, ***, ___
  if (/^`{3,}/.test(trimmed)) return line;           // Code fences: ```

  const indent = line.match(/^(\s*)/)[1];
  let content = trimmed;

  // ================================================================
  // Phase 1: Fix Bullet-List False Positive
  // ================================================================
  // In Markdown, "* " (asterisk + space) at line start creates a bullet list.
  // If the line ALSO ends with "*", it was almost certainly meant to be
  // italic (*...*), not a bullet item.
  // Example: "* Lillith sat...*" → "*Lillith sat...*"
  let isBulletPoint = false;
  if (/^\*\s+/.test(content) && /[^*\s]\*\s*$/.test(content)) {
    // Ends with * → false positive bullet, fix to italic
    content = content.replace(/^\*\s+/, '*');
  } else if (/^\*\s+/.test(content)) {
    // Starts with "* " but does NOT end with * → legitimate bullet point.
    // The single * is a bullet marker, not a broken italic delimiter.
    // Skip all inline asterisk fixing for this line.
    isBulletPoint = true;
  }

  // ================================================================
  // Phase 2a: Handle Nested *"..."* Roleplay Pattern
  // ================================================================
  // The *"dialogue/action"* pattern is the most common nested format
  // in RP text. Special handling ensures " closes before * (correct
  // Markdown nesting order) and avoids misplaced closers.
  if (/^\*["\u201C]/.test(content) && !content.startsWith('**')) {
    const fixed = fixNestedItalicQuote(content);
    if (fixed !== null) {
      // Nested fix handled inline delimiters; still need bracket fix
      return indent + fixBracketPairs(fixed);
    }
  }

  // ================================================================
  // Phase 2b: Handle Reverse Nested "*...*" Roleplay Pattern
  // ================================================================
  // The "*action/dialogue*" pattern (quote wrapping italic).
  // Ensures * closes before " (correct nesting order).
  if (/^["\u201C]\*/.test(content) && !content.startsWith('"**')) {
    const fixed = fixNestedQuoteItalic(content);
    if (fixed !== null) {
      return indent + fixBracketPairs(fixed);
    }
  }

  // ================================================================
  // Phase 3: Fix Inline Delimiters with Cross-Type Awareness
  // ================================================================
  content = fixInlineDelimiters(content, isBulletPoint);

  // ================================================================
  // Phase 4: Fix Brackets and Parentheses
  // ================================================================
  content = fixBracketPairs(content);

  return indent + content;
}

// ========================================================================
// Main Entry Point
// ========================================================================

/**
 * Fixes missing/mismatched formatting delimiters in roleplay text.
 *
 * Handles: * (italic), ** (bold), " (dialogue), ` (thought), [] (brackets), () (parens)
 *
 * Key improvements over naive approach:
 * - Bullet-list false positive detection: "* text*" → "*text*"
 * - Cross-type conflict resolution: opening delimiter type wins, stray chars left harmless
 * - Nested *"..."* RP pattern: ensures " closes before * (correct nesting)
 * - Bold/Italic interaction: ** and * share characters, handled atomically
 * - Proper indent preservation: fixes applied to content, indent re-prepended
 * - Code fences and dividers skipped to avoid false fixes
 *
 * @param {string} text - Input text (one or more lines)
 * @param {boolean} isFinal - If true, also runs document-wide bracket balancing
 * @returns {string} Text with formatting fixes applied
 */
function fixTextFormatting(text, isFinal = false) {
  if (typeof text !== 'string' || !text) return text;

  const lines = text.split('\n');
  const processedLines = lines.map(line => fixLine(line));
  let result = processedLines.join('\n');

  // Document-wide final pass: balance any remaining bracket/paren imbalance
  // This catches cases where brackets span multiple lines (e.g. status boxes
  // split across streaming chunks).
  if (isFinal) {
    const openBrackets = (result.match(/\[/g) || []).length;
    const closeBrackets = (result.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) {
      result += ' ]'.repeat(openBrackets - closeBrackets);
    }

    const openParens = (result.match(/\(/g) || []).length;
    const closeParens = (result.match(/\)/g) || []).length;
    if (openParens > closeParens) {
      result += ')'.repeat(openParens - closeParens);
    }
  }

  return result;
}

// ========================================================================
// Stateful Stream Processor for SSE streaming outputs
// ========================================================================

/**
 * Buffers streaming text chunks and applies formatting fixes to complete
 * lines. Holds back the trailing incomplete line until more data arrives
 * or flush() is called at stream end.
 */
class StreamTextProcessor {
  constructor(options = {}) {
    this.fixFormat = !!options.fixFormat;
    this.autoLineBreak = !!options.autoLineBreak;
    this.buffer = '';
  }

  processChunk(chunk) {
    if (!chunk) return '';
    this.buffer += chunk;

    // Process completed lines/paragraphs in buffer, holding back trailing incomplete line
    const lastNewlineIdx = this.buffer.lastIndexOf('\n');
    if (lastNewlineIdx === -1) {
      return '';
    }

    const completePart = this.buffer.slice(0, lastNewlineIdx + 1);
    this.buffer = this.buffer.slice(lastNewlineIdx + 1);

    let processed = completePart;
    if (this.autoLineBreak) {
      processed = applyAutoLineBreak(processed);
    }
    if (this.fixFormat) {
      processed = fixTextFormatting(processed, false);
    }

    return processed;
  }

  flush() {
    let remaining = this.buffer;
    this.buffer = '';

    if (!remaining) return '';

    if (this.autoLineBreak) {
      remaining = applyAutoLineBreak(remaining);
    }
    if (this.fixFormat) {
      remaining = fixTextFormatting(remaining, true);
    }

    return remaining;
  }
}

module.exports = {
  applyAutoLineBreak,
  fixTextFormatting,
  StreamTextProcessor
};
