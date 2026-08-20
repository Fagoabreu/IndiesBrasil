// Server-side HTML sanitizer — prevents stored XSS in user-generated content.
// Strips dangerous tags/attributes while keeping formatting (b, i, p, br, etc.).
// No dependencies — uses regex-based whitelist approach.

// Tags and their content that are completely removed.
const REMOVE_TAGS = [
  /<script[\s\S]*?<\/script>/gi,
  /<style[\s\S]*?<\/style>/gi,
  /<iframe[\s\S]*?<\/iframe>/gi,
  /<object[\s\S]*?<\/object>/gi,
  /<embed[\s\S]*?>/gi,
  /<noscript[\s\S]*?<\/noscript>/gi,
];

// Allowed formatting/structural tags (tag name only — attributes stripped below).
const ALLOWED_TAGS_PATTERN =
  /<\/?(b|i|em|strong|u|s|del|sub|sup|mark|small|code|kbd|samp|var|abbr|cite|q|blockquote|pre|br\s*\/?>|hr\s*\/?>|p|div|span|h[1-6]|ul|ol|li|dl|dt|dd|table|thead|tfoot|tbody|tr|td|th|caption|colgroup|col|figure|figcaption|a|img|video|audio|source|wbr)(\s[^>]*)?>/gi;

// Event handlers (onclick, onerror, etc.)
const EVENT_HANDLERS = /\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;

// Named HTML entities relevant to attribute/URL obfuscation. Numeric entities
// (&#58;, &#x3a;, …) are handled separately in decodeEntitiesOnce.
const NAMED_ENTITIES = {
  amp: "&",
  colon: ":",
  tab: "\t",
  newline: "\n",
  sol: "/",
  equals: "=",
  quest: "?",
  num: "#",
  semi: ";",
  comma: ",",
  period: ".",
  lpar: "(",
  rpar: ")",
  lsqb: "[",
  rsqb: "]",
  lcub: "{",
  rcub: "}",
};

// Attributes whose value is a URL and must be checked for dangerous schemes.
const URL_ATTRIBUTES = /\b(href|src|action|formaction|xlink:href)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi;

/** Decodes one layer of HTML entities. Quotes and angle brackets stay encoded
 *  so an attacker can't break out of an attribute value or a tag. */
function decodeEntitiesOnce(str) {
  return str.replace(/&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]+);/gi, (entity) => {
    const body = entity.slice(1, -1).toLowerCase();
    let char = null;

    if (body[0] === "#") {
      const code = body[1] === "x" ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
      if (!Number.isNaN(code) && code >= 0 && code <= 0x10ffff) {
        char = String.fromCodePoint(code);
      }
    } else {
      char = NAMED_ENTITIES[body] ?? null;
    }

    if (char === null) return entity;
    // Never decode characters that could break out of an attribute value.
    if (char === '"' || char === "'" || char === "<" || char === ">") return entity;
    return char;
  });
}

/** Decodes HTML entities until stable, collapsing nested encodings
 *  (e.g. `&#x26;#x61;` → `&#x61;` → `a`) used to hide dangerous schemes. */
function decodeEntitiesIterative(str) {
  let result = str;
  for (let i = 0; i < 8; i++) {
    const next = decodeEntitiesOnce(result);
    if (next === result) break;
    result = next;
  }
  return result;
}

/** Neutralizes dangerous URL schemes (`javascript:`, `vbscript:`, and `data:`
 *  on navigation attributes) in a tag, after entity decoding. */
function sanitizeUrlAttributes(tag) {
  return tag.replace(URL_ATTRIBUTES, (match, attr, _quoted, doubleQuoted, singleQuoted, unquoted) => {
    let rawValue = unquoted;
    if (doubleQuoted !== undefined) {
      rawValue = doubleQuoted;
    } else if (singleQuoted !== undefined) {
      rawValue = singleQuoted;
    }
    const decoded = decodeEntitiesIterative(rawValue);
    // WHATWG URL parsing strips ASCII tab/newline before evaluating the scheme.
    const normalized = decoded.replace(/[\t\n\r\f]/g, "").trim();
    const lower = normalized.toLowerCase();
    const isNavigation = attr === "href" || attr === "action" || attr === "formaction";
    const isDangerous = lower.startsWith("javascript:") || lower.startsWith("vbscript:") || (isNavigation && lower.startsWith("data:"));

    if (!isDangerous) return match;
    return `${attr}=""`;
  });
}

/** Sanitizes a single allowed tag: decodes entities, strips event handlers
 *  and neutralizes dangerous URL attributes. */
function sanitizeTag(tag) {
  let safe = decodeEntitiesIterative(tag);
  safe = safe.replace(EVENT_HANDLERS, "");
  safe = sanitizeUrlAttributes(safe);
  return safe;
}

/**
 * Sanitizes an HTML string by:
 * 1. Removing script/style/iframe/object/embed tags entirely
 * 2. Keeping only allowed formatting tags
 * 3. Stripping all event handlers (onclick, onerror, etc.)
 * 4. Removing javascript: URLs from href/src attributes
 * 5. Stripping any remaining tags
 *
 * @param {string} html — the raw HTML to sanitize.
 * @returns {string} sanitized HTML safe for dangerouslySetInnerHTML.
 */
function sanitize(html) {
  if (!html || typeof html !== "string") {
    return "";
  }

  let result = html;

  // Step 1: Remove dangerous tags and their content.
  for (const pattern of REMOVE_TAGS) {
    result = result.replace(pattern, "");
  }

  // Step 2: Remove all tags, then re-insert allowed ones.
  // Store allowed tags before stripping everything.
  const allowedTags = [];
  result = result.replace(ALLOWED_TAGS_PATTERN, (match) => {
    allowedTags.push(match);
    return `__TAG_${allowedTags.length - 1}__`;
  });

  // Step 3: Strip any remaining tags (anything that looks like a tag).
  result = result.replace(/<\/?[^>]+>/g, "");

  // Step 4: Restore allowed tags, fully sanitized (entity-decoded, with
  // event handlers and dangerous URL schemes removed).
  result = result.replace(/__TAG_(\d+)__/g, (_m, idx) => {
    const tag = allowedTags[Number.parseInt(idx, 10)];
    return sanitizeTag(tag);
  });

  // Step 5: Defense in depth — re-scan the whole document for any event
  // handlers or dangerous URL attributes that slipped through.
  result = result.replace(EVENT_HANDLERS, "");
  result = sanitizeUrlAttributes(result);

  return result;
}

const sanitizeHtml = {
  sanitize,
};

export default sanitizeHtml;
