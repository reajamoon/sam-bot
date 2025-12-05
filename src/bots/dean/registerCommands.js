import { REST, Routes } from 'discord.js';
import ping from './commands/ping.js';
import * as sprint from './commands/sprint.js';

export default async function registerDeanCommands(client) {
  const guildId = process.env.DEAN_GUILD_ID;
  const appId = process.env.DEAN_APP_ID;
  const token = process.env.DEAN_BOT_TOKEN;
  if (!guildId || !appId || !token) {
    console.warn('[dean] Missing env: DEAN_GUILD_ID, DEAN_APP_ID, or DEAN_BOT_TOKEN');
  }

  client.commands.set(ping.data.name, ping);
  client.commands.set(sprint.data.name, sprint);

  const commands = [ping.data.toJSON(), sprint.data.toJSON()];
  const rest = new REST({ version: '10' }).setToken(token);
  try {
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
      console.log('[dean] Registered guild commands');
    } else {
      await rest.put(Routes.applicationCommands(appId), { body: commands });
      console.log('[dean] Registered global commands');
    }
  } catch (err) {
    console.error('[dean] Failed to register commands:', err);
  }
}
