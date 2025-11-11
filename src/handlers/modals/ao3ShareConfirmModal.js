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

    // Create a fake options object for addHandler
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