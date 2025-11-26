// src/events/guildMemberAdd.js
// Discord.js v14+ event handler for when a user joins the server
import { Events } from 'discord.js';
import { upsertUserPermissionLevel } from '../../../shared/utils/permissionLevel.js';

export default {
  name: Events.GuildMemberAdd,
  async execute(member) {
    try {
      await upsertUserPermissionLevel(member);
    } catch (err) {
      console.error(`Failed to upsert user permission level for ${member.id}:`, err);
    }
  },
};
