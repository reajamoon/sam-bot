import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';
import registerDeanCommands from './registerCommands.js';
import { startSprintWatchdog } from './sprintScheduler.js';
import { initEmojiStore } from '../../shared/emojiStore.js';

const token = process.env.DEAN_BOT_TOKEN;
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

client.once('ready', async () => {
  console.log(`[dean] Logged in as ${client.user.tag}`);
  const ok = await initEmojiStore(client).catch(() => false);
  if (!ok) {
    console.warn('[dean] Emoji store did not initialize. Check guild ID env (DEAN_GUILD_ID or GUILD_ID).');
  }
  // Start sprint watchdog after ready
  startSprintWatchdog(client);
});

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

await registerDeanCommands(client);
await client.login(token);
