import { REST, Routes } from 'discord.js';
import ping from './commands/ping.js';
import * as sprint from './commands/sprint.js';

export default async function registerDeanCommands(client) {
  const appId = (process.env.DEAN_CLIENT_ID || '').trim();
  const token = (process.env.DEAN_BOT_TOKEN || '').trim();
  if (!appId || !token) {
    console.warn('[dean] Missing env: DEAN_CLIENT_ID or DEAN_BOT_TOKEN');
  }

  client.commands.set(ping.data.name, ping);
  client.commands.set(sprint.data.name, sprint);

  const commands = [ping.data.toJSON(), sprint.data.toJSON()];
  const rest = new REST({ version: '10' }).setToken(token);
  try {
    const result = await rest.put(Routes.applicationCommands(appId), { body: commands });
    console.log(`[dean] Registered ${Array.isArray(result) ? result.length : commands.length} global command(s)`);
  } catch (err) {
    console.error('[dean] Failed to register commands:', err);
  }
}
