import { REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';

export default async function registerSamCommands(client) {
  const guildId = process.env.GUILD_ID;
  const appId = process.env.CLIENT_ID;
  const token = process.env.BOT_TOKEN;
  if (!appId || !token) {
    console.warn('[sam] Missing env: CLIENT_ID or BOT_TOKEN');
  }

  // Load all command modules under Sam's commands folder
  const commandsDir = path.join(path.dirname(new URL(import.meta.url).pathname), 'commands');
  const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));
  const commands = [];
  for (const file of files) {
    const mod = await import(path.join(commandsDir, file));
    const cmd = mod.default || mod;
    if (!cmd?.data?.toJSON) continue;
    client.commands?.set?.(cmd.data.name, cmd);
    commands.push(cmd.data.toJSON());
  }

  const rest = new REST({ version: '10' }).setToken(token);
  try {
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
      console.log('[sam] Registered guild commands');
    } else {
      await rest.put(Routes.applicationCommands(appId), { body: commands });
      console.log('[sam] Registered global commands');
    }
  } catch (err) {
    console.error('[sam] Failed to register commands:', err);
  }
}
