/** Stable FNV-1a 32-bit hash for user text. No locale or wall-clock inputs. */
export function textToSeed(text) {
  const input = String(text);
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
