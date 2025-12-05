import Discord from 'discord.js';
const { REST, Routes } = Discord;
import dotenv from 'dotenv';
dotenv.config();

const rawToken = process.env.BOT_TOKEN || '';
const rawClientId = process.env.CLIENT_ID || '';
const rawGuildId = process.env.GUILD_ID || '';

const token = rawToken.trim();
const clientId = rawClientId.trim();
const guildId = rawGuildId.trim();

if (!token || !clientId) {
  console.error('[sam:clear] Missing env: CLIENT_ID or BOT_TOKEN');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

async function clearCommands() {
  try {
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    console.log('Cleared all global commands.');
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
      console.log(`✅ Cleared all guild commands for guild ${guildId}.`);
    }
  } catch (error) {
    console.error('Error clearing commands:', error);
  }
}

clearCommands();
