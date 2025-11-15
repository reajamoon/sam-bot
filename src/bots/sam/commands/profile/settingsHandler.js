const { getOrCreateUser, generateProfileCard, createProfileButtons } = require('../../utils/profileCard');

module.exports = async function handleProfileSettings(interaction) {
    const targetUser = interaction.user;
    const user = await getOrCreateUser(targetUser);
    const { embed } = await generateProfileCard(targetUser, user, interaction.client, interaction);
    const buttonRows = createProfileButtons(interaction.user.id, targetUser.id);
    if (buttonRows[0] && buttonRows[0].components) {
        buttonRows[0].components = buttonRows[0].components.map(btn => {
            if (btn.customId && btn.customId.startsWith('return_profile')) {
                btn.customId = `return_profile_${targetUser.id}`;
            }
            return btn;
        });
    }
    const profileSettingsRow = buttonRows[0];
    const { InteractionFlags } = require('discord.js');
    await interaction.editReply({
        embeds: [embed],
        components: [profileSettingsRow],
        flags: InteractionFlags.Ephemeral
    });
};
