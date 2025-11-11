// ao3ShareModal.js
// Handler for AO3 share HTML modal submission
const { parseAo3ShareHtml } = require('../../utils/recUtils/ao3ShareParser');
const { MessageFlags } = require('discord.js');

async function handleAo3ShareModal(interaction) {
    const html = interaction.fields.getTextInputValue('ao3share_html');
    let ficData;
    try {
        ficData = parseAo3ShareHtml(html);
    } catch (err) {
        return await interaction.reply({
            content: 'Sorry, I could not parse the AO3 share HTML. Please check your input.',
            flags: MessageFlags.Ephemeral
        });
    }
    // Show confirmation modal with pre-filled fields
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const confirmModal = new ModalBuilder()
        .setCustomId('ao3share_confirm_modal')
        .setTitle('Confirm AO3 Fic Details');

    const urlInput = new TextInputBuilder()
        .setCustomId('url')
        .setLabel('Fic URL')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(ficData.url || '');
    const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Title')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(ficData.title || '');
    const authorInput = new TextInputBuilder()
        .setCustomId('author')
        .setLabel('Author')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(ficData.author || '');
    const tagsInput = new TextInputBuilder()
        .setCustomId('tags')
        .setLabel('Tags (comma-separated)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(ficData.additionalTags ? ficData.additionalTags.join(', ') : '');
    const ratingInput = new TextInputBuilder()
        .setCustomId('rating')
        .setLabel('Rating')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(ficData.rating || '');
    const wordcountInput = new TextInputBuilder()
        .setCustomId('wordcount')
        .setLabel('Word Count')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(ficData.wordCount ? String(ficData.wordCount) : '');
    const summaryInput = new TextInputBuilder()
        .setCustomId('summary')
        .setLabel('Summary')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setValue(ficData.summary || '');

    confirmModal.addComponents(
        new ActionRowBuilder().addComponents(urlInput),
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(authorInput),
        new ActionRowBuilder().addComponents(tagsInput),
        new ActionRowBuilder().addComponents(ratingInput),
        new ActionRowBuilder().addComponents(wordcountInput),
        new ActionRowBuilder().addComponents(summaryInput)
    );
    await interaction.showModal(confirmModal);
}

module.exports = { handleAo3ShareModal };