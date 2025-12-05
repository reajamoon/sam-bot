import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';
import registerDeanCommands from './registerCommands.js';
import onReady from './events/ready.js';
import { initEmojiStore } from '../../shared/emojiStore.js';
import { fileURLToPath, pathToFileURL } from 'url';
import { join, dirname } from 'path';

const token = (process.env.DEAN_BOT_TOKEN || '').trim();
if (!token) {
  console.error('DEAN_BOT_TOKEN is not set.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.Message]
});

client.commands = new Collection();

// Startup diagnostics to confirm runtime and module resolution
try {
  console.log('[dean] Node', process.version, 'platform', process.platform);
  const here = fileURLToPath(import.meta.url);
  const dir = dirname(here);
  const schedPath = join(dir, 'sprintScheduler.js');
  console.log('[dean] scheduler path', schedPath, 'url', pathToFileURL(schedPath).href);
} catch (e) {
  console.log('[dean] startup diagnostics failed:', e && e.message ? e.message : e);
}

// Delegate ready handling to modular event file
onReady(client);

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (err) {
    console.error('[dean] Command error:', err);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: 'There was an error executing that command.' });
    } else {
      const { MessageFlags } = await import('discord.js');
      await interaction.reply({ content: 'There was an error executing that command.', flags: MessageFlags.Ephemeral });
    }
  }
});

process.on('uncaughtException', (err) => {
  console.error('[dean] uncaughtException:', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[dean] unhandledRejection:', reason && reason.stack ? reason.stack : reason);
});

const REGISTER_ON_BOOT = String(process.env.DEAN_REGISTER_ON_BOOT || 'false').toLowerCase() === 'true';
await client.login(token);
if (REGISTER_ON_BOOT) {
  await registerDeanCommands(client);
} else {
  console.log('[dean] Skipping command registration on boot (DEAN_REGISTER_ON_BOOT=false).');
}
