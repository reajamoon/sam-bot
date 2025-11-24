import { handleBirthdayModal } from './modals/birthdayModal.js';
import { handleBioModal } from './modals/bioModal.js';
import { handleTimezoneModal } from './modals/timezoneModal.js';
import { handlePronounsModal } from './modals/pronounsModal.js';
import { handleRegionModal } from './modals/regionModal.js';
import { handleAo3ShareModal } from './modals/ao3ShareModal.js';
import logger from '../../../shared/utils/logger.js';
import { InteractionFlags } from 'discord.js';
const EPHEMERAL_FLAG = typeof InteractionFlags !== 'undefined' && InteractionFlags.Ephemeral ? InteractionFlags.Ephemeral : 64;

/**
 * Handle modal submissions by delegating to appropriate handlers
 */
async function handleModal(interaction) {
    try {
        const customId = interaction.customId;
        
        if (customId === 'birthday_modal' || customId.startsWith('birthday_modal_')) {
            // Extract message ID if present for dual updates
            const originalMessageId = customId.startsWith('birthday_modal_') ? customId.split('birthday_modal_')[1] : null;
            return await handleBirthdayModal(interaction, originalMessageId);
        }
        else if (customId === 'bio_modal' || customId.startsWith('bio_modal_')) {
            // Extract message ID if present for dual updates
            const originalMessageId = customId.startsWith('bio_modal_') ? customId.split('bio_modal_')[1] : null;
            return await handleBioModal(interaction, originalMessageId);
        }
        else if (customId === 'timezone_modal' || customId.startsWith('timezone_modal_')) {
            // Extract message ID if present for dual updates
            const originalMessageId = customId.startsWith('timezone_modal_') ? customId.split('timezone_modal_')[1] : null;
            return await handleTimezoneModal(interaction, originalMessageId);
        }
        else if (customId === 'pronouns_modal' || customId.startsWith('pronouns_modal_')) {
            // Extract message ID if present for dual updates
            const originalMessageId = customId.startsWith('pronouns_modal_') ? customId.split('pronouns_modal_')[1] : null;
            return await handlePronounsModal(interaction, originalMessageId);
        }
        else if (customId === 'region_modal' || customId.startsWith('region_modal_')) {
            // Extract message ID if present for dual updates
            const originalMessageId = customId.startsWith('region_modal_') ? customId.split('region_modal_')[1] : null;
            return await handleRegionModal(interaction, originalMessageId);
        }
        else if (customId === 'ao3share_modal') {
            return await handleAo3ShareModal(interaction);
        } else if (customId === 'ao3share_confirm_modal') {
            const mod = await import('../../../handlers/modals/ao3ShareConfirmModal.js');
            return await mod.handleAo3ShareConfirmModal(interaction);
        } else {
            logger.warn(`Unhandled modal interaction: ${customId}`);
            await interaction.reply({
                content: 'This modal interaction is not currently supported.',
                flags: EPHEMERAL_FLAG
            });
        }
        
    } catch (error) {
        logger.error('Error in modal handler:', error);
        
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'Something went wrong processing that form. Please try again.',
                    flags: EPHEMERAL_FLAG
                });
            }
        } catch (responseError) {
            logger.error('Error responding to failed modal interaction:', responseError);
        }
    }
}

export { handleModal };