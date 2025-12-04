import { REST, Routes } from 'discord.js';
import ping from './commands/ping.js';

export default async function registerCasCommands(client) {
  const guildId = process.env.CAS_GUILD_ID;
  const appId = process.env.CAS_APP_ID;
  const token = process.env.CAS_BOT_TOKEN;
  if (!guildId || !appId || !token) {
    console.warn('[cas] Missing env: CAS_GUILD_ID, CAS_APP_ID, or CAS_BOT_TOKEN');
  }

  client.commands.set(ping.data.name, ping);

  const commands = [ping.data.toJSON()];
  const rest = new REST({ version: '10' }).setToken(token);
  try {
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
      console.log('[cas] Registered guild commands');
    } else {
      await rest.put(Routes.applicationCommands(appId), { body: commands });
      console.log('[cas] Registered global commands');
    }
  } catch (err) {
    console.error('[cas] Failed to register commands:', err);
  }
}
