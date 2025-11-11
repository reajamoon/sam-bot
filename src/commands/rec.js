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
                .setName('queue')
                .setDescription('View the current fic metadata parsing queue'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a new fanfiction recommendation')
                .addStringOption(option =>
                    option.setName('url')
                        .setDescription('URL of the fanfiction')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('Story title (required if auto-parsing fails)')
                        .setRequired(false))
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
                .setName('update')
                .setDescription('Update an existing recommendation with fresh metadata')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('ID of the recommendation to update')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('find_url')
                        .setDescription('URL of the recommendation to update')
                        .setRequired(false))
                .addIntegerOption(option =>
                    option.setName('find_ao3_id')
                        .setDescription('AO3 Work ID to find (just the number)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('new_url')
                        .setDescription('New URL (optional, will re-fetch metadata if URL changed)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('Update the story title')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('author')
                        .setDescription('Update the author name')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('summary')
                        .setDescription('Update the story summary')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('rating')
                        .setDescription('Update the story rating')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('status')
                        .setDescription('Update the story status')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Complete', value: 'Complete' },
                            { name: 'Work in Progress', value: 'Work in Progress' },
                            { name: 'Ongoing', value: 'Ongoing' },
                            { name: 'Hiatus', value: 'Hiatus' },
                            { name: 'Abandoned', value: 'Abandoned' },
                            { name: 'Unknown', value: 'Unknown' }
                        ))
                .addBooleanOption(option =>
                    option.setName('deleted')
                        .setDescription('Mark if the story has been deleted from the original site')
                        .setRequired(false))
                .addAttachmentOption(option =>
                    option.setName('attachment')
                        .setDescription('File attachment for deleted fics (ONLY with express author permission)')
                        .setRequired(false))
                .addIntegerOption(option =>
                    option.setName('wordcount')
                        .setDescription('Update the word count')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('tags')
                        .setDescription('Update additional tags (comma-separated)')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('append')
                        .setDescription('Append these tags to existing additional tags (instead of replacing)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('notes')
                        .setDescription('Update personal notes about this fic')
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
                .setDescription('Reset stuck fic metadata jobs (mods/admins only)')),

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
        try {
            switch (subcommand) {
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