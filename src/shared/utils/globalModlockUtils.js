// Utility for global modlock field checks using Config table
// Global policy helpers live here to avoid confusion with per-record setters.
import { Config, User } from '../../models/index.js';
let globalModlockedFieldsCache = null;
let botsRespectGlobalModlocksCache = null;

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

export async function shouldBotsRespectGlobalModlocks() {
  if (botsRespectGlobalModlocksCache !== null) return botsRespectGlobalModlocksCache;
  try {
    const cfg = await Config.findOne({ where: { key: 'bots_respect_global_modlocks' } });
    const val = (cfg?.value || 'true').toString().trim().toLowerCase();
    botsRespectGlobalModlocksCache = (val === 'true');
  } catch (e) {
    console.error('[globalModlockUtils] Failed to read bots_respect_global_modlocks, defaulting to true:', e);
    botsRespectGlobalModlocksCache = true;
  }
  return botsRespectGlobalModlocksCache;
}

export async function isFieldGloballyModlocked(fieldName) {
  const fields = await getGlobalModlockedFields();
  return fields.has(fieldName);
}

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

export function clearGlobalModlockedFieldsCache() {
  globalModlockedFieldsCache = null;
  botsRespectGlobalModlocksCache = null;
}
