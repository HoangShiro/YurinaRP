// formatFixer.js — Auto Line Break & Smart Format Fixer for NIM Proxy

/**
 * Applies smart line breaks between adjacent roleplay/story format elements if missing.
 */
function applyAutoLineBreak(text) {
  if (typeof text !== 'string' || !text) return text;

  // 1. Action block (*...*) followed by Dialogue ("..."), Thought (`...`), Divider (---), or Status ([...])
  text = text.replace(/(\*[^\*\n]+\*)[ \t]*(?="|`|---|\[(?=[^\]]*\]))/g, '$1\n\n');

  // 2. Dialogue ("...") followed by Action (*...*), Thought (`...`), Divider (---), or Status ([...])
  text = text.replace(/("[^"\n]+")[ \t]*(?=\*|`|---|\[(?=[^\]]*\]))/g, '$1\n\n');

  // 3. Thought (`...`) followed by Action (*...*), Dialogue ("..."), Divider (---), or Status ([...])
  text = text.replace(/(`[^`\n]+`)[ \t]*(?=\*|"|---|\[(?=[^\]]*\]))/g, '$1\n\n');

  // 4. Scene Divider (---) formatting
  // Ensure double newlines before and after ---
  text = text.replace(/([^\n])[ \t]*---/g, '$1\n\n---');
  text = text.replace(/---[ \t]*([^\n])/g, '---\n\n$1');

  // 5. Status Box [...] formatting
  // If status box is attached directly to text without a double newline
  text = text.replace(/([^\n])[ \t]*(\[\s*(?:🕒|🍂|📜|📍|Day|Time|Season|Year|Location|Status)[^\]]*\])/g, '$1\n\n$2');

  // Clean up excess newlines (more than 2 consecutive newlines)
  text = text.replace(/\n{3,}/g, '\n\n');

  return text;
}

/**
 * Fixes missing pairs of quotes, asterisks, backticks, and brackets.
 */
function fixTextFormatting(text, isFinal = false) {
  if (typeof text !== 'string' || !text) return text;

  const lines = text.split('\n');
  const processedLines = lines.map((line) => {
    let l = line;
    const trimmed = l.trim();
    if (!trimmed) return l;

    // --- Fix Missing Opening Delimiters on standalone lines ---
    if (/^[^\*]+\*$/.test(trimmed)) {
      l = '*' + l;
    }
    if (/^[^"]+"$/.test(trimmed)) {
      l = '"' + l;
    }
    if (/^[^`]+`$/.test(trimmed)) {
      l = '`' + l;
    }
    if (l.includes(']') && !l.includes('[')) {
      l = '[' + l;
    }
    if (l.includes(')') && !l.includes('(')) {
      l = '(' + l;
    }

    // --- Fix Missing Closing Delimiters on individual lines ---
    // If line starts with * and has odd number of *
    const asteriskMatches = (l.replace(/\*\*/g, '').match(/\*/g) || []).length;
    if (asteriskMatches % 2 !== 0) {
      l = l + '*';
    }

    // If line starts with " and has odd number of "
    const quoteMatches = (l.match(/"/g) || []).length;
    if (quoteMatches % 2 !== 0) {
      l = l + '"';
    }

    // If line starts with ` and has odd number of `
    const backtickMatches = (l.match(/`/g) || []).length;
    if (backtickMatches % 2 !== 0) {
      l = l + '`';
    }

    // If line starts with [ and has no closing ]
    if (l.includes('[') && !l.includes(']')) {
      l = l + ']';
    }

    // If line starts with ( and has no closing )
    if (l.includes('(') && !l.includes(')')) {
      l = l + ')';
    }

    return l;
  });

  let result = processedLines.join('\n');

  // --- Document-wide Final Pass at stream/document end ---
  if (isFinal) {
    const openBrackets = (result.match(/\[/g) || []).length;
    const closeBrackets = (result.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) {
      result += ']'.repeat(openBrackets - closeBrackets);
    }

    const openParens = (result.match(/\(/g) || []).length;
    const closeParens = (result.match(/\)/g) || []).length;
    if (openParens > closeParens) {
      result += ')'.repeat(openParens - closeParens);
    }
  }

  return result;
}

/**
 * Stateful Stream Processor for SSE streaming outputs
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
