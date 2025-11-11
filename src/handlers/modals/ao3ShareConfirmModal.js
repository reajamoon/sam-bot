// ao3ShareConfirmModal.js
// Handler for AO3 share confirmation modal submission
const handleAddRecommendation = require('../../commands/recHandlers/addHandler');
const { MessageFlags } = require('discord.js');

async function handleAo3ShareConfirmModal(interaction) {
    // Get all fields from the confirmation modal
    const url = interaction.fields.getTextInputValue('url');
    const title = interaction.fields.getTextInputValue('title');
    const author = interaction.fields.getTextInputValue('author');
    const tags = interaction.fields.getTextInputValue('tags');
    const rating = interaction.fields.getTextInputValue('rating');
    const wordcount = interaction.fields.getTextInputValue('wordcount');
    const summary = interaction.fields.getTextInputValue('summary');

    // Duplicate check: Recommendation and ParseQueue
    const { Recommendation, ParseQueue, ParseQueueSubscriber } = require('../../models');
    const existingRec = await Recommendation.findOne({ where: { url } });
    if (existingRec) {
        const addedDate = existingRec.createdAt ? `<t:${Math.floor(new Date(existingRec.createdAt).getTime()/1000)}:F>` : '';
        return await interaction.reply({
            content: `*${existingRec.title}* was already added to the library by **${existingRec.recommendedByUsername}**${addedDate ? `, on ${addedDate}` : ''}! Great minds think alike though.`,
            flags: MessageFlags.Ephemeral
        });
    }
    let queueEntry = await ParseQueue.findOne({ where: { fic_url: url } });
    if (queueEntry) {
        if (queueEntry.status === 'pending' || queueEntry.status === 'processing') {
            const existingSub = await ParseQueueSubscriber.findOne({ where: { queue_id: queueEntry.id, user_id: interaction.user.id } });
            if (!existingSub) {
                await ParseQueueSubscriber.create({ queue_id: queueEntry.id, user_id: interaction.user.id });
            }
            return await interaction.reply({
                content: 'That fic is already being processed! You’ll get a notification when it’s ready.',
                flags: MessageFlags.Ephemeral
            });
        } else if (queueEntry.status === 'done' && queueEntry.result) {
            // Return cached result (simulate embed)
            const processRecommendationJob = require('../../utils/recUtils/processRecommendationJob');
            await processRecommendationJob({
                url,
                user: { id: interaction.user.id, username: interaction.user.username },
                manualFields: {},
                additionalTags: tags ? tags.split(',').map(t => t.trim()) : [],
                notes: null,
                notify: async (embed) => {
                    await interaction.reply({
                        content: null,
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral
                    });
                }
            });
            return;
        } else if (queueEntry.status === 'error') {
            return await interaction.reply({
                content: `There was an error parsing this fic previously: ${queueEntry.error_message || 'Unknown error.'} You can try again later.`,
                flags: MessageFlags.Ephemeral
            });
        }
    }
    // If not duplicate, proceed to addHandler
    const fakeOptions = {
        getString: (name) => {
            switch (name) {
                case 'url': return url;
                case 'title': return title;
                case 'author': return author;
                case 'summary': return summary;
                case 'rating': return rating;
                case 'tags': return tags;
                case 'notes': return null;
                default: return null;
            }
        },
        getInteger: (name) => {
            if (name === 'wordcount') return wordcount ? parseInt(wordcount, 10) : null;
            return null;
        }
    };
    // Proxy interaction to override options, keep user and reply methods
    const fakeInteraction = Object.create(interaction);
    fakeInteraction.options = fakeOptions;
    fakeInteraction.deferReply = async () => { if (!fakeInteraction.deferred) { fakeInteraction.deferred = true; } };
    fakeInteraction.editReply = async (data) => {
        if (!fakeInteraction._replied) {
            fakeInteraction._replied = true;
            return await interaction.reply(data);
        } else {
            return await interaction.editReply(data);
        }
    };
    fakeInteraction.user = interaction.user;
    await handleAddRecommendation(fakeInteraction);
}

module.exports = { handleAo3ShareConfirmModal };