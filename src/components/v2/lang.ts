/** True when a string carries Devanagari, so it must be set in the
 *  Devanagari face with room for matras (even on an English page, for
 *  example a bhandara the organiser named only in Hindi). */
export const hasDevanagari = (s: unknown): boolean =>
  typeof s === "string" && /[ऀ-ॿ]/.test(s);
