import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';
import registerCasCommands from './registerCommands.js';
import onMessageCreate from './events/messageCreate.js';
import { initEmojiStore } from '../../shared/emojiStore.js';

const token = process.env.CAS_BOT_TOKEN;
if (!token) {
  console.error('CAS_BOT_TOKEN is not set.');
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
  console.log(`[cas] Logged in as ${client.user.tag}`);
  // Initialize shared emoji store for user-facing messages
  const ok = await initEmojiStore(client).catch(() => false);
  if (!ok) {
    console.warn('[cas] Emoji store did not initialize. Check guild ID env.');
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (err) {
    console.error('[cas] Command error:', err);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: 'There was an error executing that command.' });
    } else {
      await interaction.reply({ content: 'There was an error executing that command.', ephemeral: true });
    }
  }
});

client.on('messageCreate', async (message) => {
  await onMessageCreate(message);
});

await registerCasCommands(client);
await client.login(token);
