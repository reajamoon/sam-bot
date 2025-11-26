// src/events/guildMemberRemove.js
// Discord.js v14+ event handler for when a user leaves the server
import { Events } from 'discord.js';
import { User } from '../../../models/index.js';

export default {
  name: Events.GuildMemberRemove,
  async execute(member) {
    try {
      await User.update(
        { permissionLevel: 'non_member' },
        { where: { discordId: member.id } }
      );
    } catch (err) {
      console.error(`Failed to set non_member permission for ${member.id}:`, err);
    }
  },
};
