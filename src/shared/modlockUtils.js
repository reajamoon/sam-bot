// Utility for global modlock field checks using Config table
import { Config, User } from '../models/index.js';
let globalModlockedFieldsCache = null;

/**
 * Loads and caches the global modlocked fields from the Config table.
 * Expects Config row with key 'global_modlocked_fields' and value as comma-separated field names.
 * @returns {Promise<Set<string>>}
 */
export async function getGlobalModlockedFields() {
  if (globalModlockedFieldsCache) return globalModlockedFieldsCache;
  const configEntry = await Config.findOne({ where: { key: 'global_modlocked_fields' } });
  if (!configEntry) {
    globalModlockedFieldsCache = new Set();
    return globalModlockedFieldsCache;
  }
  globalModlockedFieldsCache = new Set(
    configEntry.value.split(',').map(f => f.trim()).filter(Boolean)
  );
  return globalModlockedFieldsCache;
}

/**
 * Checks if a field is globally modlocked.
 * @param {string} fieldName
 * @returns {Promise<boolean>}
 */
export async function isFieldGloballyModlocked(fieldName) {
  const fields = await getGlobalModlockedFields();
  return fields.has(fieldName);
}

/**
 * Permission-aware global modlock check: locks apply only to members.
 * Staff (mod/admin/superadmin) bypass global locks.
 * @param {{ id: string }} requestingUser
 * @param {string} fieldName
 * @returns {Promise<boolean>}
 */
export async function isFieldGloballyModlockedFor(requestingUser, fieldName) {
  try {
    if (requestingUser && requestingUser.id) {
      const userRecord = await User.findOne({ where: { discordId: requestingUser.id } });
      const level = (userRecord?.permissionLevel || 'member').toLowerCase();
      if (level !== 'member') {
        return false;
      }
    }
  } catch (e) {
    // On lookup failure, fall through to member behavior
  }
  return isFieldGloballyModlocked(fieldName);
}

/**
 * (Optional) Call this to clear the cache if config changes at runtime.
 */
export function clearGlobalModlockedFieldsCache() {
  globalModlockedFieldsCache = null;
}