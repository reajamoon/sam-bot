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
  if (Math.random() < 0.25) {
    return ` ${pick(endearments)}`;
  }
  return '';
}

export function startSoloEmbed(minutes, label, visibility) {
  return {
    title: 'Sprint started',
    description: `Timer's set for ${minutes} minute${minutes === 1 ? '' : 's'}.${label ? `\nLabel: ${label}` : ''}`,
    color: colors.info,
  };
}

export function hostTeamEmbed(minutes, label, groupId) {
  return {
    title: 'Team sprint started',
    description: `Timer's set for ${minutes} minute${minutes === 1 ? '' : 's'}. ${hostTeamCodeLine(groupId)}${label ? `\nLabel: ${label}` : ''}`,
    color: colors.info,
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

// Plain-text responses in Dean's voice
export function notEnabledInChannelText(sprintChannelMention = '') {
  const tail = sprintChannelMention ? ` Head over to ${sprintChannelMention} if you wanna do that.` : '';
  return `Hey buddy, you can't sprint here.${tail}`;
}
export function noActiveTeamText() {
  return "There ain't anybody sprinting in here. You can start one with /sprint host. I can call up my buddies if you need more bodies.";
}
export function alreadyActiveSprintText() {
  return 'You already have a sprint going, dude. Need to ditch it? Use /sprint end. Or just keep going.';
}
export function noActiveSprintText() {
  return "Nobody's sprinting right now. Wanna kick one off with /sprint start?";
}
export function notInTeamSprintText() {
  return "You're not in a team sprint. Wanna join one? Ask the host for the code and use /sprint join.";
}
export function hostsUseEndText() {
  return 'If you started it, use /sprint end.';
}
export function selectAChannelText() {
  return 'Pick a channel to use.';
}
export function onlyStaffSetChannelText() {
  return "Only mods can set the sprint channel. If you need a hand, call up a mod.";
}
export function sprintChannelSetText(channelId, allowThreads) {
  return `Sprint channel set to <#${channelId}>. Threads are ${allowThreads ? 'allowed' : 'not allowed'}.`;
}
