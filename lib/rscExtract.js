// Next.js streams server-component data as escaped JSON strings inside
// `self.__next_f.push([id, "..."])` calls embedded in <script> tags.
// These helpers pull the real fixture objects back out of that soup.

function readStringLiteral(text, startQuoteIndex) {
  let i = startQuoteIndex + 1;
  let raw = '';
  while (i < text.length) {
    const c = text[i];
    if (c === '\\') {
      raw += c + text[i + 1];
      i += 2;
      continue;
    }
    if (c === '"') {
      return { raw, end: i + 1 };
    }
    raw += c;
    i += 1;
  }
  throw new Error('Unterminated string literal');
}

// Concatenates the decoded string payloads of every self.__next_f.push([...]) call.
function decodeNextFPayloads(html) {
  const marker = 'self.__next_f.push([';
  let out = '';
  let searchFrom = 0;
  while (true) {
    const start = html.indexOf(marker, searchFrom);
    if (start === -1) break;
    const quoteStart = html.indexOf('"', start + marker.length);
    if (quoteStart === -1) break;
    const { raw, end } = readStringLiteral(html, quoteStart);
    try {
      out += JSON.parse('"' + raw + '"');
    } catch {
      // skip malformed chunk
    }
    searchFrom = end;
  }
  return out;
}

// Finds every balanced {...} object in `text` that, once parsed, contains `requiredKey`.
function extractJsonObjects(text, requiredKey) {
  const results = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;
    const end = findMatchingBrace(text, i);
    if (end === -1) continue;
    const candidate = text.slice(i, end + 1);
    if (!candidate.includes(`"${requiredKey}"`)) continue;
    try {
      const obj = JSON.parse(candidate);
      if (Object.prototype.hasOwnProperty.call(obj, requiredKey)) {
        results.push(obj);
      }
    } catch {
      // not actually valid JSON at this position, ignore
    }
  }
  return results;
}

function findMatchingBrace(text, openIndex) {
  let depth = 0;
  let inString = false;
  for (let i = openIndex; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') { i++; continue; }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function extractFixtureObjects(html, requiredKey) {
  const decoded = decodeNextFPayloads(html);
  return extractJsonObjects(decoded, requiredKey);
}

module.exports = { extractFixtureObjects };
