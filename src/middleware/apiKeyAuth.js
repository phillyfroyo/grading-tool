/**
 * API key authentication middleware for the public /v1/* API.
 *
 * Reads `Authorization: Bearer <key>` from the request, hashes the presented
 * key with SHA-256, and compares against the hashed keys configured in the
 * `API_KEYS` env var.
 *
 * API_KEYS env var format (JSON):
 *   {"akdmic_dev": "<sha256_hex>", "cuentana_dev": "<sha256_hex>"}
 *
 * On success, attaches `req.apiClient = "<client_name>"` for downstream logging.
 */

import crypto from 'crypto';

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function loadApiKeys() {
  const raw = process.env.API_KEYS;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
    console.error('[apiKeyAuth] API_KEYS must be a JSON object of {clientName: sha256Hex}');
    return {};
  } catch (err) {
    console.error('[apiKeyAuth] Failed to parse API_KEYS env var:', err.message);
    return {};
  }
}

function timingSafeEqualHex(a, b) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

export function apiKeyAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({
      error: {
        code: 'unauthorized',
        message: 'Missing or malformed Authorization header. Expected: Authorization: Bearer <key>',
      },
    });
  }

  const presentedKey = match[1].trim();
  const presentedHash = sha256Hex(presentedKey);
  const keys = loadApiKeys();

  let matchedClient = null;
  for (const [clientName, storedHash] of Object.entries(keys)) {
    if (typeof storedHash !== 'string' || storedHash.length !== 64) continue;
    if (timingSafeEqualHex(presentedHash, storedHash.toLowerCase())) {
      matchedClient = clientName;
      break;
    }
  }

  if (!matchedClient) {
    return res.status(401).json({
      error: {
        code: 'unauthorized',
        message: 'Invalid API key',
      },
    });
  }

  req.apiClient = matchedClient;
  next();
}
