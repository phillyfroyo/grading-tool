// src/services/campusMap.js
//
// Campus (North / South) is NOT stored on the users table. Until signup captures
// it, we classify each user by an explicit email→campus map the operator fills
// in. This is deliberately a hand-maintained lookup (most users are on gmail, so
// domain inference doesn't work). Unknown emails return null → shown as "—".
//
// To populate: the admin dashboard exposes the full email list; classify each
// and add entries here, then redeploy. Keys are lowercased emails.
const EMAIL_TO_CAMPUS = {
  // 'someone@gmail.com': 'North',
  // 'another@gmail.com': 'South',
};

/** Return 'North' | 'South' | null for an email. */
export function campusForEmail(email) {
  if (!email) return null;
  return EMAIL_TO_CAMPUS[email.toLowerCase()] || null;
}
