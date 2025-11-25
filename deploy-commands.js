
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
const commandsPath = join(__dirname, 'src', 'bots', 'sam', 'commands');
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const commandModule = await import(join(commandsPath, file));
    const command = commandModule.default || commandModule;
    commands.push(command.data.toJSON());
}

// Construct and prepare an instance of the REST module
const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

// Deploy commands to GUILD_ID
(async () => {
    try {
        const guildId = process.env.GUILD_ID;
        console.log(`Started refreshing ${commands.length} application (/) commands for guild: ${guildId}`);

        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
            { body: commands },
        );

        console.log(`✅ Successfully deployed ${data.length} commands to guild ${guildId}`);
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
    }
})();
