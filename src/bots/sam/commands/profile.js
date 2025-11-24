
import { SlashCommandBuilder, InteractionFlags } from 'discord.js';
import handleProfileHelp from './profile/helpHandler.js';
import handleProfileSettings from './profile/settingsHandler.js';
import handlePrivacySettings from './profile/privacyHandler.js';
import handleProfileView from './profile/viewHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View user profile information or get help')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to view profile for')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('quick')
                .setDescription('Quick access to help or other shortcuts')
                .setRequired(false)
                .addChoices(
                    { name: 'Help', value: 'help' },
                    { name: 'Profile Settings', value: 'profile-settings' },
                    { name: 'Privacy Settings', value: 'privacy-settings' }
                )
        ),
    async execute(interaction) {
        console.log('Profile command starting...');
        const quick = interaction.options.getString('quick');
        if (quick === 'help') {
            const ephemeralFlag = InteractionFlags?.Ephemeral ?? 64;
            await interaction.deferReply({ flags: ephemeralFlag });
            console.log('Profile help deferred as ephemeral');
            await handleProfileHelp(interaction);
            return;
        }
        await interaction.deferReply();
        console.log('Profile command deferred successfully');
        if (quick === 'profile-settings') {
            await handleProfileSettings(interaction);
            return;
        }
        if (quick === 'privacy-settings') {
            await handlePrivacySettings(interaction);
            return;
        }
        await handleProfileView(interaction);
    }
};
