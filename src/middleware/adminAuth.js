// src/middleware/adminAuth.js
//
// Gates the admin dashboard. Access is controlled by a single shared secret in
// the ADMIN_SECRET env var (set locally in .env and in Vercel) — deliberately
// independent of normal user login, so only the operator can reach /admin.
//
// Flow:
//   1. Operator visits /admin → served a small password form (see admin.html).
//   2. Form POSTs the secret to /admin/login → if it matches ADMIN_SECRET we set
//      an httpOnly signed cookie so the secret never rides in the URL.
//   3. Subsequent /admin* requests are authorized by that cookie.
//
// If ADMIN_SECRET is unset, the whole admin surface returns 404 (invisible),
// so a misconfigured deploy can't expose an unguarded dashboard.

const ADMIN_COOKIE = 'adminAuth';

/** Constant-time-ish string compare to avoid trivial timing leaks. */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

/** True when ADMIN_SECRET is configured. When false, admin surface is hidden. */
export function adminConfigured() {
  return !!process.env.ADMIN_SECRET;
}

/**
 * Require a valid admin session (signed cookie holding the secret).
 * - 404 if ADMIN_SECRET isn't configured (hide the feature entirely).
 * - 401 JSON for API paths, redirect to /admin for page paths, when unauthed.
 */
export function requireAdmin(req, res, next) {
  if (!adminConfigured()) {
    return res.status(404).send('Not found');
  }
  const cookieVal = req.signedCookies?.[ADMIN_COOKIE];
  if (safeEqual(cookieVal, process.env.ADMIN_SECRET)) {
    return next();
  }
  // Not authorized.
  if (req.path.startsWith('/admin/api/')) {
    return res.status(401).json({ success: false, error: 'Admin authentication required' });
  }
  return res.redirect('/admin');
}

/**
 * Handle the admin login POST. Verifies the submitted secret and, on success,
 * sets the signed httpOnly cookie.
 */
export function handleAdminLogin(req, res) {
  if (!adminConfigured()) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  const submitted = req.body?.secret;
  if (!safeEqual(submitted, process.env.ADMIN_SECRET)) {
    return res.status(401).json({ success: false, error: 'Invalid secret' });
  }
  res.cookie(ADMIN_COOKIE, process.env.ADMIN_SECRET, {
    signed: true,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000, // 12 hours
  });
  return res.json({ success: true });
}

/** Clear the admin cookie. Attributes must match those used when setting it
 * (path/httpOnly/secure/sameSite) or some browsers won't clear it. */
export function handleAdminLogout(req, res) {
  res.clearCookie(ADMIN_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  return res.json({ success: true });
}

/**
 * Report whether the current request is an authenticated admin. Used by the
 * page route to decide whether to show the dashboard or the login form.
 */
export function isAdminAuthed(req) {
  if (!adminConfigured()) return false;
  return safeEqual(req.signedCookies?.[ADMIN_COOKIE], process.env.ADMIN_SECRET);
}
