/**
 * Centralized Discord Button Custom ID Utility
 * Format: [action]_[context]_[primaryId]_[secondaryId]
 * - action: required (e.g., set_bio, toggle_privacy_mode_full, rec_next_page)
 * - context: required (e.g., profile_settings, privacy_settings, rec_navigation)
 * - primaryId: required (userId, recId, page number, etc)
 * - secondaryId: optional (messageId, extra context)
 *
 * Example: toggle_privacy_mode_full_privacy_settings_123456789012345678_ABCDEFG
 */

async function buildButtonId({ action, context, primaryId, secondaryId }) {
    if (!action || !context || !primaryId) {
        throw new Error('Missing required fields for button ID');
    }
    let safePrimaryId = String(primaryId);
    let safeSecondaryId = secondaryId ? String(secondaryId) : '';

    // If primaryId or secondaryId are too long, hash them
    async function shortHash(str) {
        const crypto = await import('crypto');
        return crypto.createHash('sha256').update(str).digest('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
    }
    if (safePrimaryId.length > 32) safePrimaryId = await shortHash(safePrimaryId);
    if (safeSecondaryId.length > 32) safeSecondaryId = await shortHash(safeSecondaryId);

    let id = `${action}_${context}_${safePrimaryId}`;
    if (safeSecondaryId) id += `_${safeSecondaryId}`;
    if (id.length > 100) {
        id = await shortHash(id);
        if (process && process.env && process.env.NODE_ENV !== 'production') {
            console.warn('CustomId exceeded 100 chars, hashed:', id);
        }
    }
    return id;
}

function parseButtonId(customId) {
    // Split by underscore
    const parts = customId.split('_');
    if (parts.length < 3) return null;
    // Find context block (e.g., profile_settings, privacy_settings, rec_navigation, profile_help_menu, etc)
    let contextIdx = -1;
    for (let i = 1; i < parts.length; i++) {
        // Look for context blocks ending with _settings, _navigation, _menu, or _help_menu
        const contextBlock = parts.slice(i - 1, i + 2).join('_');
        if (contextBlock.endsWith('_settings') || contextBlock.endsWith('_navigation') || contextBlock.endsWith('_menu') || contextBlock.endsWith('_help_menu')) {
            contextIdx = i - 1;
            break;
        }
    }
    if (contextIdx === -1) return null;
    // Determine context length (2 or 3 parts)
    let contextLength = 2;
    if (parts[contextIdx + 2] && (parts[contextIdx] + '_' + parts[contextIdx + 1] + '_' + parts[contextIdx + 2]).endsWith('_help_menu')) {
        contextLength = 3;
    }
    const action = parts.slice(0, contextIdx).join('_');
    const context = parts.slice(contextIdx, contextIdx + contextLength).join('_');
    const primaryId = parts[contextIdx + contextLength];
    if (!primaryId) return null;
    const secondaryId = parts.length > contextIdx + contextLength + 1 ? parts.slice(contextIdx + contextLength + 1).join('_') : undefined;
    return { action, context, primaryId, secondaryId };
}


export { buildButtonId, parseButtonId };
