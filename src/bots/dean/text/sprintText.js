// Dean voice: upbeat, direct, no em-dashes.
export const colors = {
  info: 0x3B82F6,
  success: 0x10B981,
  warn: 0xF59E0B,
};

// Randomized encouragement lines for status/midpoint/end
const soloBoosters = [
  "Keep it rolling.",
  "Carry on, wayward writer.",
  "Turn it up, keep typing!",
  "Stay on it, sweetheart. You got this.",
  "You're cooking! Keep going.",
  "Lock in.",
  "Hey, eyes on the page."
];

const teamBoosters = [
  "Crew's moving, don't fall behind.",
  "Keep pace.",
  "Run with the pack.",
  "Let's push.",
  "Bring the heat.",
  "I’ll be back... with edits."
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Southern-style endearments; light, friendly, non-patronizing
const endearments = [
  'killer',
  'sweetheart',
  'sunshine',
  'cowboy',
];

function maybeEndearment() {
  // ~25% chance to append an endearment
  if (Math.random() < 0.5) {
    return ` ${pick(endearments)}`;
  }
  return '';
}

export function startSoloEmbed(minutes, label, visibility) {
  return {
    title: 'Sprint started',
    description: `Timer's set for ${minutes} minute${minutes === 1 ? '' : 's'}.${label ? `\nLabel: ${label}` : ''}`,
    color: colors.info,
    footer: { text: visibility === 'public' ? "Public by default, use 'ephemeral' to reply privately" : 'Private sprint' },
  };
}

export function hostTeamEmbed(minutes, label, groupId) {
  return {
    title: 'Team sprint started',
    description: `Timer's set for ${minutes} minute${minutes === 1 ? '' : 's'}. ${hostTeamCodeLine(groupId)}${label ? `\nLabel: ${label}` : ''}`,
    color: colors.info,
    footer: { text: "Public by default, use 'ephemeral' to reply privately" },
  };
}

export function joinTeamEmbed() {
  return {
    title: 'Joined team sprint',
    description: "You're in. Keep pace with the crew.",
    color: colors.success,
  };
}

export function endSoloEmbed() {
  return {
    title: 'Sprint ended',
    description: "Nice work. Drop your wordcount when you're ready.",
    color: colors.success,
  };
}

export function endTeamEmbed() {
  return {
    title: 'Team sprint ended',
    description: "Good run. Post your numbers when you're ready.",
    color: colors.success,
  };
}

export function statusSoloEmbed(remainingMin, label) {
  return {
    title: 'Sprint status',
    description: `About ${remainingMin} minute${remainingMin === 1 ? '' : 's'} left. ${pick(soloBoosters)}${maybeEndearment()}${label ? `\nLabel: ${label}` : ''}`,
    color: colors.info,
  };
}

export function statusTeamEmbed(remainingMin, count, label) {
  return {
    title: 'Team sprint status',
    description: `About ${remainingMin} minute${remainingMin === 1 ? '' : 's'} left. ${count} sprinter${count === 1 ? '' : 's'} in. ${pick(teamBoosters)}${maybeEndearment()}${label ? `\nLabel: ${label}` : ''}`,
    color: colors.info,
  };
}

export function leaveTeamEmbed() {
  return {
    title: 'Left team sprint',
    description: "Catch ya next round.",
    color: colors.warn,
  };
}

export function listEmbeds(lines) {
  return {
    title: 'Active sprints',
    description: lines.length ? lines.map(l => `• ${l}`).join('\n') : 'No active sprints in this channel.',
    color: colors.info,
  };
}

export function hostTeamCodeLine(groupId) {
  return `Join with code ${groupId}.`;
}

export function formatListLine(kind, remainingMin, userId, label) {
  const lbl = label ? ` • ${label}` : '';
  return `${kind} (${remainingMin}m left) • <@${userId}>${lbl}`;
}

export function midpointEmbed() {
  return {
    title: 'Midpoint',
    description: `Halfway there. You got this${maybeEndearment()}!`,
    color: colors.info,
  };
}

export function completeEmbed() {
  return {
    title: 'Sprint complete',
    description: "Nice work. Drop your wordcount when you're ready.",
    color: colors.success,
  };
}

export function summaryEmbed(channelMention, label, isTeam) {
  const who = isTeam ? 'Team sprint' : 'Sprint';
  const lbl = label ? ` (${label})` : '';
  return {
    title: 'Sprint summary',
    description: `${who} complete${lbl} in ${channelMention}.`,
    color: colors.info,
  };
}
