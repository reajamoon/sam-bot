// ao3ShareModal.js
// Handler for AO3 share HTML modal submission
const { parseAo3ShareHtml } = require('../../../../shared/recUtils/ao3ShareParser');
const { MessageFlags } = require('discord.js');

async function handleAo3ShareModal(interaction) {
    const logger = require('../../../../shared/utils/logger');
    logger.info('AO3 share modal submitted');
    const html = interaction.fields.getTextInputValue('ao3share_html');
    let ficData;
    try {
        logger.info('Parsing AO3 share HTML...');
        ficData = parseAo3ShareHtml(html);
        logger.info('AO3 share HTML parsed successfully:', ficData);
    } catch (err) {
        logger.error('Error parsing AO3 share HTML:', err);
        let msg = 'Sorry, I could not parse the AO3 share HTML.';
        if (err.parseErrors && err.parseErrors.length > 0) {
            msg += '\n' + err.parseErrors.map(e => `• ${e}`).join('\n');
        } else if (err.message) {
            msg += `\n${err.message}`;
        }
        await interaction.reply({
            content: msg + '\n\nMake sure you pasted the full AO3 share HTML export, starting with the work link.',
            flags: MessageFlags.Ephemeral
        });
        logger.info('AO3 share modal error reply sent');
        return;
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
    logger.info('Showing AO3 share confirmation modal...');
    await interaction.showModal(confirmModal);
    logger.info('AO3 share confirmation modal shown');
}

module.exports = { handleAo3ShareModal };