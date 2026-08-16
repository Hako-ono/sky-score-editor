const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export function replacePlaceholders(text, replacements = {}) {
  if (typeof text !== 'string') return text;

  const parts = [];
  const pattern = /\{([^{}]+)\}/gu;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      replacements && typeof replacements === 'object' && hasOwn(replacements, match[1])
        ? replacements[match[1]]
        : match[0],
    );
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex === 0) return text;
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}
