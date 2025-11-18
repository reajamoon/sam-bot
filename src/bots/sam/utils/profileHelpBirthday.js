
const { EmbedBuilder } = require('discord.js');
const { createHelpWithBackButton } = require('./profileHelpButtons');
const fs = require('fs');
const path = require('path');
const helpTexts = JSON.parse(fs.readFileSync(path.join(__dirname, 'profileHelp', 'helpTexts.json'), 'utf8'));

/**
 * Create birthday help embed
 * @param {Object} interaction - Discord interaction
 * @returns {Object} Object with embed and component rows
 */

function createBirthdayHelp(interaction) {
    const birthdayText = helpTexts.birthday;
    const embed = new EmbedBuilder()
        .setTitle(birthdayText.title)
        .setDescription(birthdayText.description)
        .addFields(...birthdayText.fields)
        .setColor(0x5865F2);
    return createHelpWithBackButton(embed, interaction);
}

module.exports = { createBirthdayHelp };
