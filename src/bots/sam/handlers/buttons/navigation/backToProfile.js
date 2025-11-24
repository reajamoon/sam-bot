import { getOrCreateUser, generateProfileCard, createProfileButtons, canViewProfile } from '../../../utils/profileCard.js';

async function handleBackToProfile(interaction) {
    const targetUser = interaction.user;
    const user = await getOrCreateUser(targetUser);
    if (!canViewProfile(user, interaction.user.id, targetUser.id)) {
        await interaction.update({
            content: `${targetUser.username} has chosen to keep their profile private.`,
            embeds: [],
            components: []
        });
        return;
    }
    const { embed } = await generateProfileCard(targetUser, user, interaction.client, interaction);
    const buttonRows = createProfileButtons(interaction.user.id, targetUser.id);
    await interaction.update({
        embeds: [embed],
        components: buttonRows
    });
}

export { handleBackToProfile };
