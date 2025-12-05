import Discord from 'discord.js';
const { REST, Routes } = Discord;
import dotenv from 'dotenv';
dotenv.config();

const rawToken = process.env.CAS_BOT_TOKEN || '';
const rawAppId = process.env.CAS_CLIENT_ID || '';
const rawGuildId = process.env.CAS_GUILD_ID || '';

const token = rawToken.trim();
const appId = rawAppId.trim();
const guildId = rawGuildId.trim();

if (!token || !appId) {
  console.error('[cas:clear] Missing env: CAS_CLIENT_ID or CAS_BOT_TOKEN');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

async function clearCommands() {
  try {
    await rest.put(Routes.applicationCommands(appId), { body: [] });
    console.log('Cleared all global commands for Cas.');
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: [] });
      console.log(`✅ Cleared all guild commands for Cas in guild ${guildId}.`);
    }
  } catch (error) {
    console.error('Error clearing commands:', error);
  }
}

clearCommands();
