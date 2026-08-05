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

// javascript: URLs in href/src/action
const JAVASCRIPT_URLS = /(href|src|action)\s*=\s*["']\s*javascript:/gi;

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

  // Step 4: Restore allowed tags, stripping dangerous attributes.
  result = result.replace(/__TAG_(\d+)__/g, (_m, idx) => {
    let tag = allowedTags[Number.parseInt(idx, 10)];

    // Strip event handlers.
    tag = tag.replace(EVENT_HANDLERS, "");

    // Strip javascript: URLs.
    tag = tag.replace(JAVASCRIPT_URLS, '$1=""');

    return tag;
  });

  // Step 5: Remove any remaining event handlers or javascript: URLs
  // that might have slipped through (defense in depth).
  result = result.replace(EVENT_HANDLERS, "");
  result = result.replace(JAVASCRIPT_URLS, '$1=""');

  return result;
}

const sanitizeHtml = {
  sanitize,
};

export default sanitizeHtml;
