
const { EmbedBuilder } = require('discord.js');
const { createHelpWithBackButton } = require('./profileHelpButtons');
const fs = require('fs');
const path = require('path');
const helpTexts = JSON.parse(fs.readFileSync(path.join(__dirname, 'profileHelp', 'helpTexts.json'), 'utf8'));

/**
 * Create timezone/region help embed
 * @param {Object} interaction - Discord interaction
 * @returns {Object} Object with embed and component rows
 */

function createTimezoneRegionHelp(interaction) {
    const tzText = helpTexts.timezone_region;
    const embed = new EmbedBuilder()
        .setTitle(tzText.title)
        .setDescription(tzText.description)
        .addFields(...tzText.fields)
        .setColor(0x5865F2);
    return createHelpWithBackButton(embed, interaction);
}

module.exports = { createTimezoneRegionHelp };
