import Discord from 'discord.js';
const { REST, Routes } = Discord;
import dotenv from 'dotenv';
import { readdirSync } from 'fs';
import { join } from 'path';
dotenv.config();

const commands = [];

import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const commandsPath = join(__dirname, '../../src', 'bots', 'dean', 'commands');
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const commandModule = await import(join(commandsPath, file));
  const dataExport = commandModule.data || (commandModule.default && commandModule.default.data);
  if (!dataExport || typeof dataExport.toJSON !== 'function') {
    console.warn(`Skipping command file ${file}: no SlashCommandBuilder 'data' export found.`);
    continue;
  }
  commands.push(dataExport.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.DEAN_BOT_TOKEN);

(async () => {
  try {
    const guildId = process.env.DEAN_GUILD_ID;
    const appId = process.env.DEAN_APP_ID;
    console.log(`Started refreshing ${commands.length} application (/) commands for guild: ${guildId || 'GLOBAL'}`);

    if (guildId) {
      const data = await rest.put(
        Routes.applicationGuildCommands(appId, guildId),
        { body: commands },
      );
      console.log(`✅ Successfully deployed ${data.length} commands to guild ${guildId}`);
    } else {
      const data = await rest.put(
        Routes.applicationCommands(appId),
        { body: commands },
      );
      console.log(`✅ Successfully deployed ${data.length} commands globally`);
    }
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
})();
