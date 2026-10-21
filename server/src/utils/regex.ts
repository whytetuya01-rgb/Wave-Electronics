// Escapes user-supplied text for use inside a RegExp so searches match it
// literally. Without this, a search term containing regex syntax - a part
// code like "LM317(T)", or a stray "[" or "*" - made MongoDB reject the
// pattern and every list endpoint returned a 500, and crafted patterns were a
// ReDoS vector.
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
