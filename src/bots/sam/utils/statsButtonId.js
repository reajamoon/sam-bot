// Utility for building and parsing stats button customIds

const STATS_BUTTON_PREFIX = 'stats_charts';

export function buildStatsButtonId(context = '') {
    return context ? `${STATS_BUTTON_PREFIX}:${context}` : STATS_BUTTON_PREFIX;
}

export function parseStatsButtonId(customId) {
    if (!customId.startsWith(STATS_BUTTON_PREFIX)) return null;
    const parts = customId.split(':');
    return { context: parts[1] || '' };
}
