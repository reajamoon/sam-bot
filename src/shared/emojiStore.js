/**
 * Centralized custom emoji store for the single-guild workspace.
 *
 * Loads guild emojis once and provides stable lookups by canonical names.
 * Use this to replace default emojis in user-facing messages across bots.
 */
import { Collection } from 'discord.js';

const EMOJI_CACHE = {
  guildId: null,
  byId: new Map(),
  byName: new Map(),
  loadedAt: null
};

/**
 * Normalize emoji names for lookup consistency.
 * - Lowercase
 * - Strip common prefixes like `PB__`
 * - Replace spaces/underscores with single underscores
 */
function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/^pb__/, '')
    .replace(/\s+/g, '_')
    .replace(/__+/g, '_');
}

/**
 * Initialize emoji store by fetching emojis from the single configured guild.
 * Reads guild id from `CAS_GUILD_ID`, `SAM_GUILD_ID`, or `GUILD_ID`.
 */
export async function initEmojiStore(client, guildId) {
  const defaultGuildId = guildId || process.env.CAS_GUILD_ID || process.env.SAM_GUILD_ID || process.env.GUILD_ID;
  if (!defaultGuildId) return false;
  const guild = client.guilds.cache.get(defaultGuildId) || await client.guilds.fetch(defaultGuildId).catch(() => null);
  if (!guild) return false;
  // Populate cache
  try {
    await guild.emojis.fetch();
  } catch {}
  const coll = guild.emojis.cache instanceof Collection ? guild.emojis.cache : new Collection();
  EMOJI_CACHE.guildId = defaultGuildId;
  EMOJI_CACHE.byId.clear();
  EMOJI_CACHE.byName.clear();
  coll.forEach(e => {
    const info = {
      id: e.id,
      name: e.name,
      normalized: normalizeName(e.name),
      animated: !!e.animated,
      mention: e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`
    };
    EMOJI_CACHE.byId.set(e.id, info);
    EMOJI_CACHE.byName.set(info.normalized, info);
  });
  EMOJI_CACHE.loadedAt = Date.now();
  return true;
}

/**
 * Get an emoji by canonical (normalized) name.
 * Falls back to a provided default string if not found.
 * @param {string} name
 * @param {string} fallback Optional fallback, e.g., "🤗"
 */
export function emoji(name, fallback = '') {
  const key = normalizeName(name);
  const entry = EMOJI_CACHE.byName.get(key);
  return entry ? entry.mention : fallback;
}

/**
 * Utility to check if the store is initialized.
 */
export function emojiStoreReady() {
  return EMOJI_CACHE.byName.size > 0;
}

/**
 * Convenience: common emoji aliases used across bots.
 * Add or adjust these names to your hand-drawn set.
 */
export const EMOJIS = {
  // Animated hugstiel (Cas hug) example: PB__aHugstiel
  cas_hug: 'ahugstiel',
  // Common faces or reactions
  sam_ok: 'sam_ok',
  dean_wtf: 'dean_wtf',
  jack_smile: 'jack_smile',
  // Status
  check: 'check',
  lock: 'lock'
};
