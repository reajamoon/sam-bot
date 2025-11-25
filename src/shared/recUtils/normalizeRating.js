// Normalize rating values to AO3 standard
export default function normalizeRating(rating) {
  if (!rating || !rating.trim()) return 'not rated';
  const r = rating.trim().toLowerCase();
  if (r === 'explicit' || r.startsWith('explicit')) return 'explicit';
  if (r === 'mature') return 'mature';
  if (r === 'general audiences') return 'general audiences';
  if (r === 'not rated') return 'not rated';
  if (r === 't' || r === 'teen and up audiences') return 'teen and up audiences';
  return 'not rated';
}
