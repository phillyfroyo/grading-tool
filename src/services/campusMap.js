// src/services/campusMap.js
//
// Campus (North / South) and role (dev / akdmic) are NOT stored on the users
// table, so we classify each user by explicit email lookups the operator
// maintains here. Most users are on gmail, so domain inference doesn't work —
// this is a hand-curated map. Update it and redeploy as new users join.
//
// Also carries a small HIDE list for automated test accounts that were created
// by dev/verification runs (they have zero real activity and would pollute
// active-user and per-campus counts). Only accounts confirmed as test noise go
// here; ambiguous ones are left visible.
//
// All keys are lowercased emails.

// Automated test accounts to omit from the dashboard entirely (list + all
// counts). Confirmed test noise, not real users.
const HIDDEN_EMAILS = new Set([
  'sessiontest@example.com',   // session-persistence test run
  'comptest@example.com',      // component test run
  'uitest@example.com',        // hardcoded in .tmprun/pill-check.mjs (UI screenshot test)
  'flip.wp@gmail.com',         // early dev-alias account; hidden per operator (not deleted — keeps its class profile)
  // Assorted early test accounts, hidden per operator (soft-hide, not deleted).
  'testuser@example.com',
  'newtestuser@example.com',
  'testupdatedat@example.com',
  'testing1234@email.com',
  'test@example.com',
  'testingemail@gmail.com',
]);

// email → 'North' | 'South'
const EMAIL_TO_CAMPUS = {
  // South campus
  'antoine.stemarie@anahuac.mx': 'South',
  'schademannh@icloud.com': 'South',
  'elliehudspith@yahoo.co.uk': 'South',
  'schademannh@gmail.com': 'South',
  'chrisp893@gmail.com': 'South',
  'antoine_797@hotmail.com': 'South',
  'lorenacavuoti@gmail.com': 'South',
  'vivian.perez@anahuac.mx': 'South',
  'daniel.guerramejia18@gmail.com': 'South',
  'elena.hudspith@universidad.anahuac.mx': 'South',
  'angelica_rangel@anahuac.mx': 'South',

  // North campus
  'schaddemannh@gmail.com': 'North',
  'ines.cosme@anahuac.mx': 'North',
  'ira.franco@anahuac.mx': 'North',
  'alejandro_esquivel@anahuac.mx': 'North',
  'alejandra.arochaca@anahuac.mx': 'North',
  'cristina.martinez@universidad.anahuac.mx': 'North',
  'daniela_ichazo@anahuac.mx': 'North',
  'ernesto.acosta@anahuac.mx': 'North',
  'marina.lugo@anahuac.mx': 'North',
  'creditosmartel@gmail.com': 'North',
  'ira.franco@gmail.com': 'North',
  'catalina.gonzalez0119@gmail.com': 'North',
};

// email → role badge. 'dev' = operator's own account (costs called out
// separately); 'akdmic' = akdmic platform owner (potential acquirer).
const EMAIL_TO_ROLE = {
  'philipwooleryprice@gmail.com': 'dev',
  'javier@akdmic.com': 'akdmic',
};

/** Return 'North' | 'South' | null for an email. */
export function campusForEmail(email) {
  if (!email) return null;
  return EMAIL_TO_CAMPUS[email.toLowerCase()] || null;
}

/** Return 'dev' | 'akdmic' | null for an email. */
export function roleForEmail(email) {
  if (!email) return null;
  return EMAIL_TO_ROLE[email.toLowerCase()] || null;
}

/** True if this email should be hidden from the dashboard (test account). */
export function isHiddenEmail(email) {
  if (!email) return false;
  return HIDDEN_EMAILS.has(email.toLowerCase());
}

/** The dev account's email (for the separate Dev-costs card). */
export const DEV_EMAIL = 'philipwooleryprice@gmail.com';
