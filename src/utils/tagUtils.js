/**
 * Tag utility functions for processing and matching tags
 */
import { sequelize } from '../models/index.js';
import { Op } from 'sequelize';

/**
 * Expands tag synonyms, particularly for AU (Alternate Universe) variations
 * @param {string} tag - The original tag to expand
 * @returns {string[]} - Array of tag variations including the original
 */
export function expandTagSynonyms(tag) {
    const variations = new Set([tag]);
    const lowerTag = tag.toLowerCase();
    
    // Handle AU/Alternate Universe synonyms
    if (lowerTag === 'au' || lowerTag === 'alternate universe') {
        variations.add('AU');
        variations.add('Alternate Universe');
    }
    
    // Handle "Alternate Universe: X" <-> "AU: X" <-> "X" patterns
    const auColonMatch = lowerTag.match(/^alternate universe:\s*(.+)$/i);
    if (auColonMatch) {
        const suffix = auColonMatch[1].trim();
        variations.add(`AU: ${suffix}`);
        variations.add(suffix);
        variations.add(`Alternate Universe: ${suffix}`);
    }
    
    const auColonShortMatch = lowerTag.match(/^au:\s*(.+)$/i);
    if (auColonShortMatch) {
        const suffix = auColonShortMatch[1].trim();
        variations.add(`Alternate Universe: ${suffix}`);
        variations.add(suffix);
        variations.add(`AU: ${suffix}`);
    }
    
    // For standalone terms, check if they could be AU suffixes
    // Only do this for reasonable length terms to avoid false matches
    if (lowerTag.length >= 3 && lowerTag.length <= 50 && 
        !lowerTag.includes(':') && 
        !lowerTag.match(/^(au|alternate universe)$/i)) {
        variations.add(`AU: ${tag}`);
        variations.add(`Alternate Universe: ${tag}`);
    }
    
    return Array.from(variations);
}

/**
 * Enhanced JSONB search conditions with AU synonym expansion
 * Compatible with existing getTagSearchConditions signature
 * @param {string} tag - The tag to search for
 * @param {Object} operation - Sequelize operation (Op.iLike, Op.notILike)
 * @param {string[]} tagFields - Array of JSONB field names to search in
 * @returns {Array} - Array of sequelize.where conditions with all variations across all fields
 */
export function createTagSearchConditions(tag, operation, tagFields = ['tags', 'additionalTags']) {
    const variations = expandTagSynonyms(tag);
    const conditions = [];
    
    for (const field of tagFields) {
        for (const variation of variations) {
            // Use proper JSONB array search with null checks and type validation
            if (operation === Op.iLike) {
                conditions.push(
                    sequelize.literal(`(
                        "Recommendation"."${field}" IS NOT NULL 
                        AND jsonb_typeof("Recommendation"."${field}") = 'array'
                        AND EXISTS (
                            SELECT 1 FROM jsonb_array_elements_text("Recommendation"."${field}") AS element 
                            WHERE LOWER(element) LIKE LOWER('%${variation.replace(/'/g, "''")}%')
                        )
                    )`)
                );
            } else if (operation === Op.notILike) {
                conditions.push(
                    sequelize.literal(`(
                        "Recommendation"."${field}" IS NULL 
                        OR jsonb_typeof("Recommendation"."${field}") != 'array'
                        OR NOT EXISTS (
                            SELECT 1 FROM jsonb_array_elements_text("Recommendation"."${field}") AS element 
                            WHERE LOWER(element) LIKE LOWER('%${variation.replace(/'/g, "''")}%')
                        )
                    )`)
                );
            }
        }
    }
    
    return conditions;
}

/**
 * Normalizes and deduplicates an array of tags
 * @param {string[]} tags - Array of tags to normalize
 * @returns {string[]} - Normalized and deduplicated array
 */
export function normalizeTags(tags) {
    if (!Array.isArray(tags)) return [];
    
    const normalized = new Set();
    
    for (const tag of tags) {
        if (typeof tag === 'string' && tag.trim()) {
            normalized.add(tag.trim());
        }
    }
    
    return Array.from(normalized).sort();
}

/**
 * Enhanced tag matching for client-side filtering with AU synonyms
 * @param {string[]} recTags - Array of tags from a recommendation
 * @param {string} searchTag - Tag to search for (will be expanded with synonyms)
 * @returns {boolean} - True if any variation matches
 */
export function matchesTagWithSynonyms(recTags, searchTag) {
    const variations = expandTagSynonyms(searchTag);
    const lowerRecTags = recTags.map(tag => tag.toLowerCase());
    
    return variations.some(variation => 
        lowerRecTags.some(recTag => recTag.includes(variation.toLowerCase()))
    );
}