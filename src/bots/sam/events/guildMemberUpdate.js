// src/events/guildMemberUpdate.js
// Discord.js v14+ event handler for when a user's roles or info are updated
import { Events } from 'discord.js';
import { upsertUserPermissionLevel } from '../../../shared/utils/permissionLevel.js';

export default {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember) {
    // Only update if roles have changed
    const oldRoles = oldMember.roles.cache.map(r => r.id).sort().join(',');
    const newRoles = newMember.roles.cache.map(r => r.id).sort().join(',');
    if (oldRoles !== newRoles) {
      try {
        await upsertUserPermissionLevel(newMember);
      } catch (err) {
        console.error(`Failed to update user permission level for ${newMember.id}:`, err);
      }
    }
  },
};
