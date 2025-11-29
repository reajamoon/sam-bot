// processUserMetadata.js
// Utility for handling user-specific metadata (notes, manual fields)
// Used by command handlers to save user data immediately before queue processing

import { UserFicMetadata } from '../../models/index.js';

/**
 * Saves user-specific metadata immediately using work ID extracted from URL.
 * This is called by command handlers BEFORE queue processing.
 * @param {Object} options
 * @param {string} options.url - Fanfiction URL to extract ID from
 * @param {Object} options.user - User object with id
 * @param {string} [options.notes] - User notes
 * @param {string[]} [options.additionalTags] - Additional tags
 * @param {Object} [options.manualFields] - Manual field overrides
 * @returns {Promise<{ao3ID?: number, seriesId?: number, site: string}>} - Returns extracted IDs and site
 */
async function saveUserMetadata(options) {
  const { url, user, notes = '', additionalTags = [], manualFields = {} } = options;

  // Detect site and extract relevant IDs
  const siteInfo = detectSiteAndExtractIDs(url);

  if (!siteInfo.isSupported) {
    throw new Error('Unsupported fanfiction site');
  }

  // Always save user metadata record to establish user<->fic relationship
  // Even if no custom fields provided, we need the base record for future updates
  try {
    const metadataRecord = {
      userID: user.id,
      rec_note: (notes && notes.trim()) || null,
      additional_tags: Array.isArray(additionalTags) ? additionalTags : [],
      manual_fields: Object.keys(manualFields).length > 0 ? manualFields : null
    };

    // Set ID fields based on URL type
    if (siteInfo.site === 'ao3') {
      if (siteInfo.isSeriesUrl) {
        // Series URL: store seriesId only, ao3ID=null
        metadataRecord.seriesId = siteInfo.seriesId;
        metadataRecord.ao3ID = null;
      } else {
        // Work URL: store ao3ID, seriesId=null
        metadataRecord.ao3ID = siteInfo.ao3ID;
        metadataRecord.seriesId = null;
      }
    } else {
      // For non-AO3 sites, use URL as identifier
      metadataRecord.url = url;
    }

    await UserFicMetadata.upsert(metadataRecord);
  } catch (err) {
    console.error('[saveUserMetadata] Error saving user metadata:', err);
    throw err;
  }

  return siteInfo;
}

/**
 * Retrieves user metadata for building embeds that include user-specific data.
 * @param {string} identifier - Work ID (ao3ID) or URL for non-AO3 sites
 * @param {string} userID - User ID
 * @param {string} [type='ao3ID'] - Type of identifier: 'ao3ID' or 'url'
 * @returns {Promise<Object|null>} - User metadata or null
 */
async function getUserMetadata(identifier, userID, type = 'ao3ID') {
  try {
    const whereClause = { userID };

    if (type === 'ao3ID') {
      whereClause.ao3ID = identifier;
    } else if (type === 'seriesId') {
      whereClause.seriesId = identifier;
    } else {
      whereClause.url = identifier;
    }

    const userMeta = await UserFicMetadata.findOne({ where: whereClause });
    return userMeta ? {
      notes: userMeta.rec_note,
      additionalTags: userMeta.additional_tags || [],
      manualFields: userMeta.manual_fields || {}
    } : null;
  } catch (err) {
    console.error('[getUserMetadata] Error retrieving user metadata:', err);
    return null;
  }
}

/**
 * Updates existing user metadata (for update commands)
 * @param {Object} options
 * @param {string} options.identifier - Work ID (ao3ID) or URL for non-AO3 sites
 * @param {string} options.userID - User ID
 * @param {string} [options.type='ao3ID'] - Type of identifier: 'ao3ID' or 'url'
 * @param {string} [options.notes] - New notes (undefined = don't change)
 * @param {string[]} [options.additionalTags] - New additional tags (undefined = don't change)
 * @param {Object} [options.manualFields] - New manual fields (undefined = don't change)
 */
async function updateUserMetadata(options) {
  const { identifier, userID, type = 'ao3ID', notes, additionalTags, manualFields } = options;

  try {
    const whereClause = { userID };

    if (type === 'ao3ID') {
      whereClause.ao3ID = identifier;
    } else if (type === 'seriesId') {
      whereClause.seriesId = identifier;
    } else {
      whereClause.url = identifier;
    }

    const existing = await UserFicMetadata.findOne({ where: whereClause });

    if (!existing) {
      // Create new if doesn't exist
      const createData = {
        userID,
        rec_note: notes || null,
        additional_tags: additionalTags || [],
        manual_fields: manualFields || null
      };

      if (type === 'ao3ID') {
        createData.ao3ID = identifier;
      } else if (type === 'seriesId') {
        createData.seriesId = identifier;
      } else {
        createData.url = identifier;
      }

      await UserFicMetadata.create(createData);
      return;
    }

    // Update only provided fields
    const updateFields = {};
    if (notes !== undefined) {
      updateFields.rec_note = notes.trim() || null;
    }
    if (additionalTags !== undefined) {
      updateFields.additional_tags = Array.isArray(additionalTags) ? additionalTags : [];
    }
    if (manualFields !== undefined) {
      updateFields.manual_fields = Object.keys(manualFields).length > 0 ? manualFields : null;
    }

    if (Object.keys(updateFields).length > 0) {
      await existing.update(updateFields);
    }
  } catch (err) {
    console.error('[updateUserMetadata] Error updating user metadata:', err);
    throw err;
  }
}

/**
 * Detect site type and extract relevant IDs from URL
 * @param {string} url - Fanfiction URL
 * @returns {Object} Site info with extracted IDs
 */
function detectSiteAndExtractIDs(url) {
  if (url.includes('archiveofourown.org')) {
    const isSeriesUrl = url.includes('/series/');
    const isWorkUrl = url.includes('/works/');
    
    return {
      site: 'ao3',
      isSeriesUrl,
      isWorkUrl,
      ao3ID: isWorkUrl ? extractAO3WorkId(url) : null,
      seriesId: isSeriesUrl ? extractAO3SeriesId(url) : null,
      isSupported: true
    };
  } else if (url.includes('fanfiction.net')) {
    return {
      site: 'ffnet',
      ficID: extractFFNetStoryId(url),
      isSupported: true
    };
  } else if (url.includes('wattpad.com')) {
    return {
      site: 'wattpad',
      isSupported: true
    };
  } else if (url.includes('livejournal.com') || url.includes('.livejournal.com')) {
    return {
      site: 'livejournal',
      isSupported: true
    };
  } else if (url.includes('dreamwidth.org') || url.includes('.dreamwidth.org')) {
    return {
      site: 'dreamwidth',
      isSupported: true
    };
  } else if (url.includes('tumblr.com') || url.includes('.tumblr.com')) {
    return {
      site: 'tumblr',
      isSupported: true
    };
  }
  
  return {
    site: 'unknown',
    isSupported: false
  };
}/**
 * Extract FFNet story ID from URL
 */
function extractFFNetStoryId(url) {
  const match = url && url.match(/\/s\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extract AO3 work ID from URL
 */
function extractAO3WorkId(url) {
  const match = url && url.match(/\/works\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extract AO3 series ID from URL (if it's a series URL)
 */
function extractAO3SeriesId(url) {
  const match = url && url.match(/\/series\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export {
  saveUserMetadata,
  getUserMetadata,
  updateUserMetadata,
  detectSiteAndExtractIDs,
  extractAO3WorkId,
  extractAO3SeriesId,
  extractFFNetStoryId
};