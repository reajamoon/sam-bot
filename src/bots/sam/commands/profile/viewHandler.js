const { getOrCreateUser, generateProfileCard, createProfileButtons, canViewProfile } = require('../../../../utils/profileCard');

module.exports = async function handleProfileView(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const user = await getOrCreateUser(targetUser);
    if (!canViewProfile(user, interaction.user.id, targetUser.id)) {
        await interaction.editReply({ content: `${targetUser.username} has chosen to keep their profile private.` });
        return;
    }
    const { embed } = await generateProfileCard(targetUser, user, interaction.client, interaction);
    const buttonRows = createProfileButtons(interaction.user.id, targetUser.id);
    const profileMessage = await interaction.editReply({ embeds: [embed], components: buttonRows });
    if (interaction.user.id === targetUser.id) {
        const updatedButtonRows = createProfileButtons(interaction.user.id, targetUser.id, profileMessage.id);
        await profileMessage.edit({ embeds: [embed], components: updatedButtonRows });
    }
};
