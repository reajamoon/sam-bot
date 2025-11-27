// AO3 fic tag validation for Castiel/Dean Winchester rec library
// Returns { valid: boolean, reason: string|null }

const CANONICAL_SHIP = 'Castiel/Dean Winchester';
const CANONICAL_FANDOM = 'Supernatural (TV 2005)';

/**
 * Checks if a fic meets the fandom/ship requirements for this library.
 * @param {string[]} fandomTags - Array of fandom tags
 * @param {string[]} relationshipTags - Array of relationship tags
 * @returns {{ valid: boolean, reason: string|null }}
 */
export function validateDeanCasRec(fandomTags, relationshipTags) {
  // 1. Must have Supernatural (TV 2005) fandom
  if (!fandomTags.some(f => f.trim().toLowerCase() === CANONICAL_FANDOM.toLowerCase())) {
    return { valid: false, reason: 'Missing Supernatural (TV 2005) fandom tag.' };
  }

  // 2. If no relationship tags, treat as gen (allowed)
  if (!relationshipTags || relationshipTags.length === 0) {
    return { valid: true, reason: null };
  }

  // 3. Allow if canonical ship is present (allow for double slashes, whitespace, etc)
  const canonRegex = /^Castiel\s*\/\/?\s*Dean Winchester$/i;
  if (relationshipTags.some(tag => canonRegex.test(tag.trim()))) {
    return { valid: true, reason: null };
  }

  // 4. Exclude if any tag is a Castiel/X or Dean Winchester/X ship (not canon, not gen), unless 'past' or 'minor' in tag
  for (const tag of relationshipTags) {
    const t = tag.trim();
    if (t.includes('&')) continue; // friendship, allowed
    if (/past|minor/i.test(t)) continue; // allow if marked as past/minor
    // Exclude if Castiel or Dean Winchester paired with anyone but each other
    // Allow only if tag is exactly canon ship (already checked above)
    // Exclude if tag contains both but also others (e.g. Castiel/Dean Winchester/Other)
    const parts = t.split('/').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (parts.includes('castiel') && parts.includes('dean winchester')) {
      if (parts.length > 2) {
        return { valid: false, reason: `Detected Multishipping: ${tag}` };
      }
      // else would have matched canonRegex above
    } else if (parts.includes('castiel') || parts.includes('dean winchester')) {
      return { valid: false, reason: `Detected Multishipping: ${tag}` };
    }
  }

  // 5. If only gen or canon ship, allow
  return { valid: true, reason: null };
}
