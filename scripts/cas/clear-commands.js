import Discord from 'discord.js';
const { REST, Routes } = Discord;
import dotenv from 'dotenv';
dotenv.config();

const token = process.env.CAS_BOT_TOKEN;
const appId = process.env.CAS_APP_ID;
const guildId = process.env.CAS_GUILD_ID;

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
