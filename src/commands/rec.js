/**
 * @file rec.js
 * Main command router for the /rec slash command. Handles routing to subcommand handlers for fanfiction recommendations.
 * @module commands/rec
 */
const { SlashCommandBuilder, EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Recommendation } = require('../models');
const handleAddRecommendation = require('./recHandlers/addHandler');
const handleRemoveRecommendation = require('./recHandlers/removeHandler');
const handleRandomRecommendation = require('./recHandlers/randomHandler');
const handleStats = require('./recHandlers/statsHandler');
const { fetchFicMetadata } = require('../utils/recUtils/ficParser');
const findRecommendationByIdOrUrl = require('../utils/recUtils/findRecommendationByIdOrUrl');
const createRecommendationEmbed = require('../utils/recUtils/createRecommendationEmbed');
const handleUpdateRecommendation = require('./recHandlers/updateHandler');
const handleSearchRecommendations = require('./recHandlers/searchHandler');
const { handleHelp, handleHelpNavigation } = require('./recHandlers/helpHandler');
const quickLinkCheck = require('../utils/recUtils/quickLinkCheck');

/**
 * Main /rec command export object.
 * @type {{
 *   data: SlashCommandBuilder,
 *   execute: function(Discord.Interaction): Promise<void>,
 *   handleHelpNavigation: function(Discord.Interaction): Promise<void>
 * }}
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName('rec')
        .setDescription('Manage fanfiction recommendations')
        .addSubcommand(subcommand =>
            subcommand
                .setName('notifytag')
                .setDescription('Control whether you are tagged in fic queue notifications')
                .addStringOption(option =>
                    option.setName('mode')
                        .setDescription('on = tag me, off = do not tag me')
                        .setRequired(true)
                        .addChoices(
                            { name: 'on', value: 'on' },
                            { name: 'off', value: 'off' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a new fanfiction recommendation to the library')
                .addStringOption(option =>
                    option.setName('url')
                        .setDescription('Fanfiction URL (AO3, FFNet, Wattpad, etc.)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('Title (optional, for manual entry)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('author')
                        .setDescription('Author (optional, for manual entry)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('summary')
                        .setDescription('Summary (optional, for manual entry)')
                        .setRequired(false))
                .addIntegerOption(option =>
                    option.setName('wordcount')
                        .setDescription('Word count (optional, for manual entry)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('rating')
                        .setDescription('Rating (optional, for manual entry)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('tags')
                        .setDescription('Additional tags (comma-separated, optional)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('notes')
                        .setDescription('Personal notes (optional)')
                        .setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('queue')
                .setDescription('View the current fic metadata parsing queue'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('update')
                .setDescription('Update an existing recommendation with fresh metadata')
                .addStringOption(option =>
                    option.setName('identifier')
                        .setDescription('Fic ID, AO3 WorkId, or URL')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('author')
                        .setDescription('Author name (required if auto-parsing fails)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('tags')
                        .setDescription('Additional tags (comma-separated)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('summary')
                        .setDescription('Story summary (required if auto-parsing fails)')
                        .setRequired(false))
                .addIntegerOption(option =>
                    option.setName('wordcount')
                        .setDescription('Word count (required if auto-parsing fails)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('rating')
                        .setDescription('Story rating (e.g., Teen And Up Audiences, Explicit)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('notes')
                        .setDescription('Personal notes about this fic')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('status')
                        .setDescription('Manually set fic status (MODS ONLY)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('random')
                .setDescription('Get a random fanfiction recommendation')
                .addStringOption(option =>
                    option.setName('tag')
                        .setDescription('Filter by tag')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a fanfiction recommendation')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('ID of the recommendation to remove')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('url')
                        .setDescription('URL of the recommendation to remove')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('help')
                .setDescription('Show detailed help for the recommendation system'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Show library and contributor statistics'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('search')
                .setDescription('Search for recommendations by title, author, or tags'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add_ao3share')
                .setDescription('Add a new fanfiction recommendation by pasting AO3 share HTML'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('resetqueue')
                .setDescription('Reset stuck fic metadata jobs (mods/admins only)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('clearqueue')
                .setDescription('Remove all queue jobs for a fic URL (mods/admins only)')
                .addStringOption(option =>
                    option.setName('url')
                        .setDescription('Fic URL to clear from the queue')
                        .setRequired(true))),

    /**
     * Main entry for all /rec subcommands. Routes to the appropriate handler.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction - Discord interaction object
     * @returns {Promise<void>}
     */
    async execute(interaction) {
        if (!interaction.inGuild()) {
            return await interaction.reply({
                content: 'Hey, the recommendation system is specifically set up for Profound Bond. You\'ll need to use this command in the server where I can properly catalog everything.',
                flags: MessageFlags.Ephemeral
            });
        }

        const subcommand = interaction.options.getSubcommand();

        const handleQueue = require('./recHandlers/queueHandler');
        const handleResetQueue = require('./recHandlers/resetQueueHandler');
        const handleRecNotifyTag = require('./recHandlers/recNotifyTag');
        try {
            switch (subcommand) {
                case 'notifytag':
                    await handleRecNotifyTag(interaction);
                    break;
                case 'add':
                    await handleAddRecommendation(interaction);
                    break;
                case 'random':
                    await handleRandomRecommendation(interaction);
                    break;
                case 'search':
                    await handleSearchRecommendations(interaction);
                    break;
                case 'stats':
                    await handleStats(interaction);
                    break;
                case 'remove':
                    await handleRemoveRecommendation(interaction);
                    break;
                case 'update':
                    await handleUpdateRecommendation(interaction);
                    break;
                case 'queue':
                    await handleQueue(interaction);
                    break;
                    case 'resetqueue':
                        await handleResetQueue(interaction);
                        break;
                case 'clearqueue': {
                    const handleClearQueue = require('./recHandlers/clearQueueHandler');
                    await handleClearQueue(interaction);
                    break;
                }
                case 'add_ao3share': {
                    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
                    const modal = new ModalBuilder()
                        .setCustomId('ao3share_modal')
                        .setTitle('Paste AO3 Share HTML');
                    const htmlInput = new TextInputBuilder()
                        .setCustomId('ao3share_html')
                        .setLabel('Paste the AO3 share HTML here')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true);
                    modal.addComponents(new ActionRowBuilder().addComponents(htmlInput));
                    await interaction.showModal(modal);
                    break;
                }
                case 'help':
                    await handleHelp(interaction);
                    break;
                default:
                    await interaction.reply({
                        content: 'Something went wrong with that command. Try again?',
                        flags: MessageFlags.Ephemeral
                    });
            }
        } catch (error) {
            console.error('Error in rec command:', error);
            throw error;
        }
    },

    /**
     * Handles navigation for the rec help menu buttons.
     * @param {import('discord.js').ButtonInteraction} interaction - Discord button interaction object
     * @returns {Promise<void>}
     */
    async handleHelpNavigation(interaction) {
        await handleHelpNavigation(interaction);
    },
};