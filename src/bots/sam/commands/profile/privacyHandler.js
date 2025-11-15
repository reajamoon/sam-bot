const { getOrCreateUser } = require('../../utils/profileCard');

module.exports = async function handlePrivacySettings(interaction) {
    const targetUser = interaction.user;
    const user = await getOrCreateUser(targetUser);
    const { content, embeds, components } = require('../../handlers/buttons/privacyButtons').buildPrivacySettingsMenu(user, targetUser.id);
    if (components && components[0] && components[0].components) {
        components[0].components = components[0].components.map(btn => {
            if (btn.customId && btn.customId.startsWith('return_profile')) {
                btn.customId = `return_profile_${targetUser.id}`;
            }
            return btn;
        });
    }
    const { InteractionFlags } = require('discord.js');
    await interaction.editReply({
        content,
        embeds,
        components,
        flags: InteractionFlags.Ephemeral
    });
};
