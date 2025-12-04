import Discord from 'discord.js';
const { REST, Routes } = Discord;
import dotenv from 'dotenv';
dotenv.config();

const token = process.env.DEAN_BOT_TOKEN;
const appId = process.env.DEAN_APP_ID;
const guildId = process.env.DEAN_GUILD_ID;

const rest = new REST({ version: '10' }).setToken(token);

async function clearCommands() {
  try {
    await rest.put(Routes.applicationCommands(appId), { body: [] });
    console.log('Cleared all global commands for Dean.');
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: [] });
      console.log(`✅ Cleared all guild commands for Dean in guild ${guildId}.`);
    }
  } catch (error) {
    console.error('Error clearing commands:', error);
  }
}

clearCommands();
