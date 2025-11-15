let countries = require('country-region-data');
if (!Array.isArray(countries)) {
    // Sometimes country-region-data is weird. If this blows up, check the import. (Yep, it's happened.)
    countries = countries.default || [];
}

/**
 * Valid cities that should be kept as-is (with proper capitalization)
 * These are just places users might want to keep. If someone puts in 'NYC' instead of 'New York', let 'em. We're not the geography police.
 */
const VALID_CITIES = [
    // US Major Cities
    'New York', 'NYC', 'New York City', 'Manhattan', 'Brooklyn', 'Queens', 'Bronx',
    'Los Angeles', 'LA', 'San Francisco', 'SF', 'San Diego', 'Sacramento', 'Oakland', 'San Jose', 'Fresno',
    'Chicago', 'Houston', 'Dallas', 'Austin', 'San Antonio', 'Fort Worth',
    'Phoenix', 'Philadelphia', 'Denver', 'Seattle', 'Miami', 'Orlando', 'Tampa',
    'Atlanta', 'Boston', 'Detroit', 'Las Vegas', 'Portland', 'Nashville', 'Memphis',
    'Baltimore', 'Milwaukee', 'Minneapolis', 'Kansas City', 'St Louis', 'Cleveland',
    'Columbus', 'Cincinnati', 'Pittsburgh', 'Virginia Beach', 'Norfolk', 'Richmond',
    
    // Canadian Cities
    'Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Edmonton', 'Ottawa', 'Winnipeg', 'Halifax',
    
    // UK Cities
    'London', 'Manchester', 'Birmingham', 'Liverpool', 'Bristol', 'Leeds', 'Sheffield',
    'Edinburgh', 'Glasgow', 'Cardiff', 'Belfast',
    
    // European Cities
    'Paris', 'Berlin', 'Munich', 'Hamburg', 'Cologne', 'Frankfurt',
    'Rome', 'Milan', 'Naples', 'Madrid', 'Barcelona', 'Valencia',
    'Amsterdam', 'Rotterdam', 'Brussels', 'Vienna', 'Zurich', 'Geneva',
    'Stockholm', 'Oslo', 'Copenhagen', 'Helsinki', 'Dublin', 'Lisbon',
    'Warsaw', 'Prague', 'Budapest', 'Athens',
    
    // Asian Cities
    'Tokyo', 'Osaka', 'Kyoto', 'Yokohama', 'Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen',
    'Hong Kong', 'Singapore', 'Seoul', 'Busan', 'Mumbai', 'Delhi', 'Bangalore',
    'Chennai', 'Kolkata', 'Hyderabad', 'Bangkok', 'Manila', 'Jakarta', 'Kuala Lumpur',
    
    // Australian Cities
    'Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Canberra',
    
    // Other Major Cities
    'Mexico City', 'Rio de Janeiro', 'Sao Paulo', 'Buenos Aires', 'Cairo', 'Cape Town',
    'Johannesburg', 'Moscow', 'St Petersburg', 'Istanbul', 'Dubai', 'Tel Aviv', 'Jerusalem'
];

/**
 * Map lowercase city names to their proper capitalization
 * Because people type like gremlins. This helps.
 */
const CITY_CAPITALIZATION_MAP = VALID_CITIES.reduce((map, city) => {
    map[city.toLowerCase()] = city;
    return map;
}, {});

/**
 * Broader geographical regions that should be kept as-is
 * If someone wants to be "from Europe" and not get specific, let 'em. No need to get picky.
 */
const VALID_BROADER_REGIONS = [
    // US Regional Terms
    'west coast',
    'east coast', 
    'east coast usa',
    'west coast usa',
    'pacific coast',
    'atlantic coast',
    'northeast',
    'northeast usa',
    'northeast us',
    'northwest',
    'northwest usa',
    'pacific northwest',
    'pnw',
    'southwest',
    'southwest usa',
    'southeast',
    'southeast usa',
    'south',
    'southern usa',
    'deep south',
    'midwest',
    'midwestern usa',
    'great lakes',
    'new england',
    'mid atlantic',
    'sun belt',
    'rust belt',
    'bible belt',
    
    // International Regional Terms
    'western europe',
    'eastern europe',
    'central europe',
    'northern europe',
    'southern europe',
    'scandinavia',
    'nordic countries',
    'balkans',
    'british isles',
    'benelux',
    'iberian peninsula',
    'mediterranean',
    
    'east asia',
    'southeast asia',
    'south asia',
    'middle east',
    'far east',
    
    'north america',
    'south america',
    'central america',
    'latin america',
    
    'oceania',
    'down under'
];

/**
 * Country/region aliases that should be normalized to proper names
 * These are alternate terms that should map to official country names. Just making life easier.
 */
const COUNTRY_ALIASES = {
    'usa': 'United States',
    'us': 'United States',
    'america': 'United States',
    'uk': 'United Kingdom',
    'britain': 'United Kingdom',
    'great britain': 'United Kingdom',
    'europe': 'Europe', // Keep as general term
    'asia': 'Asia',     // Keep as general term
    'africa': 'Africa'  // Keep as general term
};

/**
 * Validate and normalize region input
 * Handles country names, codes, regions, cities, and broad regions. Tries to be smart.
 * @param {string} input - User input for region
 * @returns {Object} - { isValid: boolean, normalizedRegion: string|null, suggestions: string[] }
 */
function validateRegion(input) {
    if (!input || typeof input !== 'string') {
        return { isValid: false, normalizedRegion: null, suggestions: [] };
    }

    const cleanInput = input.trim();
    
    // Length validation (2-50 characters). Don't let people go wild.
    if (cleanInput.length < 2 || cleanInput.length > 50) {
        return { isValid: false, normalizedRegion: null, suggestions: [] };
    }

    // Basic character validation (letters, spaces, hyphens, apostrophes, parentheses). No emojis, sorry.
    const validRegionRegex = /^[a-zA-Z\s\-'().,]+$/;
    if (!validRegionRegex.test(cleanInput)) {
        return { isValid: false, normalizedRegion: null, suggestions: [] };
    }

    const inputLower = cleanInput.toLowerCase();
    let exactMatch = null;
    const suggestions = [];

    // 1. Check if it's a valid city (preserve with proper capitalization)
    if (CITY_CAPITALIZATION_MAP[inputLower]) {
        return {
            isValid: true,
            normalizedRegion: CITY_CAPITALIZATION_MAP[inputLower],
            suggestions: []
        };
    }

    // 2. Check if it's a valid broader geographical region (keep as-is)
    if (VALID_BROADER_REGIONS.includes(inputLower)) {
    // Capitalize the first letter of each word for consistency (looks nicer)
        const normalized = cleanInput.toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        
        return {
            isValid: true,
            normalizedRegion: normalized,
            suggestions: []
        };
    }

    // 3. Check country aliases (make it easy for users)
    if (COUNTRY_ALIASES[inputLower]) {
        return {
            isValid: true,
            normalizedRegion: COUNTRY_ALIASES[inputLower],
            suggestions: []
        };
    }

    // 4. Handle comma-separated format like "WA, USA" or "California, US" (classic)
    if (cleanInput.includes(',')) {
        const parts = cleanInput.split(',').map(part => part.trim());
        if (parts.length === 2) {
            const [regionPart, countryPart] = parts;
            const regionLower = regionPart.toLowerCase();
            const countryLower = countryPart.toLowerCase();
            
            // Find the country first - try exact matches first, then partial matches (cover all bases)
            let targetCountry = null;
            
            // First try exact country name matches
            for (const country of countries) {
                if (country.countryName.toLowerCase() === countryLower || 
                    country.countryShortCode.toLowerCase() === countryLower) {
                    targetCountry = country;
                    break;
                }
            }
            
            // If no exact match, try partial matches but only if unambiguous (don't guess too much)
            if (!targetCountry) {
                // Enhanced matching for common country references (US/UK shortcuts)
                const partialMatches = countries.filter(country => {
                    const countryName = country.countryName.toLowerCase();
                    const countryCode = country.countryShortCode.toLowerCase();
                    
                    // Direct matches
                    if (countryName.includes(countryLower) || countryCode.includes(countryLower)) {
                        return true;
                    }
                    
                    // Special regex patterns for common country references
                    // Match "USA", "US" but exclude "USM" (US Minor Outlying Islands)
                    if (/^us[^m]?$/i.test(countryLower) && countryName === 'united states') {
                        return true;
                    }
                    // Match "UK" variations
                    if (/^uk$/i.test(countryLower) && countryName === 'united kingdom') {
                        return true;
                    }
                    
                    return false;
                });
                
                if (partialMatches.length === 1) {
                    targetCountry = partialMatches[0];
                } else if (partialMatches.length > 1) {
                    // Multiple country matches - suggest them (don't want to pick wrong)
                    return {
                        isValid: false,
                        normalizedRegion: null,
                        suggestions: partialMatches.map(c => `Try "${regionPart}, ${c.countryName}" or "${regionPart}, ${c.countryShortCode}"`).slice(0, 3)
                    };
                }
            }
            
            if (targetCountry && targetCountry.regions) {
                // Look for the region within this country (states, provinces, etc.)
                for (const region of targetCountry.regions) {
                    if (region.name.toLowerCase() === regionLower || 
                        (region.shortCode && region.shortCode.toLowerCase() === regionLower)) {
                        return { 
                            isValid: true, 
                            normalizedRegion: `${region.name}, ${targetCountry.countryName}`, 
                            suggestions: [] 
                        };
                    }
                }
                
                // If region not found but country is valid, suggest regions (helpful)
                const regionSuggestions = targetCountry.regions
                    .filter(region => 
                        region.name.toLowerCase().includes(regionLower) ||
                        (region.shortCode && region.shortCode.toLowerCase().includes(regionLower))
                    )
                    .map(region => `${region.name}, ${targetCountry.countryName}`)
                    .slice(0, 3);
                
                if (regionSuggestions.length > 0) {
                    return { 
                        isValid: false, 
                        normalizedRegion: null, 
                        suggestions: regionSuggestions
                    };
                }
            }
        }
    }

    // Check for exact country name matches (easy win)
    for (const country of countries) {
        if (country.countryName.toLowerCase() === inputLower) {
            return { isValid: true, normalizedRegion: country.countryName, suggestions: [] };
        }
        
    // Check country code matches (shortcut)
        if (country.countryShortCode.toLowerCase() === inputLower) {
            return { isValid: true, normalizedRegion: country.countryName, suggestions: [] };
        }
    }

    // Check for region/state matches within countries (dig deeper)
    const regionMatches = [];
    for (const country of countries) {
        if (country.regions) {
            for (const region of country.regions) {
                if (region.name.toLowerCase() === inputLower || 
                    (region.shortCode && region.shortCode.toLowerCase() === inputLower)) {
                    regionMatches.push({
                        region: region.name,
                        country: country.countryName,
                        normalized: `${region.name}, ${country.countryName}`
                    });
                }
            }
        }
    }

    // If we found exactly one region match, use it (no ambiguity)
    if (regionMatches.length === 1) {
        return { 
            isValid: true, 
            normalizedRegion: regionMatches[0].normalized, 
            suggestions: [] 
        };
    }
    
    // If we found multiple region matches, it's ambiguous - show suggestions (let user pick)
    if (regionMatches.length > 1) {
        return { 
            isValid: false, 
            normalizedRegion: null, 
            suggestions: regionMatches.map(match => match.normalized).slice(0, 5)
        };
    }

    // Check for partial matches for suggestions (try to help)
    
    // Add suggestions from city names (maybe they meant one of these)
    for (const city of VALID_CITIES) {
        const cityLower = city.toLowerCase();
        if (cityLower.includes(inputLower) || inputLower.includes(cityLower)) {
            if (suggestions.length < 5) {
                suggestions.push(city);
            }
        }
    }
    
    // Add suggestions from broader region terms (maybe they meant one of these)
    for (const broadRegion of VALID_BROADER_REGIONS) {
        if (broadRegion.includes(inputLower) || inputLower.includes(broadRegion)) {
            if (suggestions.length < 5) {
                const formatted = broadRegion
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
                suggestions.push(formatted);
            }
        }
    }
    
    // Add suggestions from country aliases (common shortcuts)
    for (const [alias, country] of Object.entries(COUNTRY_ALIASES)) {
        if (alias.includes(inputLower) || inputLower.includes(alias)) {
            if (suggestions.length < 5) {
                suggestions.push(alias.toUpperCase());
            }
        }
    }
    
    // Check countries and regions for partial matches (cover all bases)
    for (const country of countries) {
        if (country.countryName.toLowerCase().includes(inputLower)) {
            if (suggestions.length < 5) {
                suggestions.push(country.countryName);
            }
        }
        
    // Check regions for partial matches (states, provinces, etc.)
        if (country.regions) {
            for (const region of country.regions) {
                if (region.name.toLowerCase().includes(inputLower)) {
                    if (suggestions.length < 5) {
                        suggestions.push(`${region.name}, ${country.countryName}`);
                    }
                }
            }
        }
    }

    // Common timezone region mappings (for timezone nerds)
    const timezoneRegions = {
        'pacific': 'Pacific Time Zone',
        'mountain': 'Mountain Time Zone', 
        'central': 'Central Time Zone',
        'eastern': 'Eastern Time Zone',
        'atlantic': 'Atlantic Time Zone',
        'alaska': 'Alaska Time Zone',
        'hawaii': 'Hawaii-Aleutian Time Zone',
        'europe': 'Europe',
        'asia': 'Asia',
        'africa': 'Africa',
        'oceania': 'Oceania',
        'antarctica': 'Antarctica'
    };

    if (timezoneRegions[inputLower]) {
        return { isValid: true, normalizedRegion: timezoneRegions[inputLower], suggestions: [] };
    }

    // Fallback: Accept smaller towns/cities with proper capitalization
    // If input looks like a reasonable place name, accept it with proper formatting (don't be too strict)
    if (isReasonablePlaceName(cleanInput)) {
        const normalized = properCapitalization(cleanInput);
        return {
            isValid: true,
            normalizedRegion: normalized,
            suggestions: []
        };
    }

    // If we have suggestions, it's a partial match (let user decide)
    if (suggestions.length > 0) {
        return { 
            isValid: false, 
            normalizedRegion: null, 
            suggestions: suggestions.slice(0, 5) // Limit to 5 suggestions
        };
    }

    return { isValid: false, normalizedRegion: null, suggestions: [] };
}

/**
 * Check if input looks like a reasonable place name. Not rocket science.
 * @param {string} input - The input to validate
 * @returns {boolean} - Whether it seems like a valid place name
 */
function isReasonablePlaceName(input) {
    const trimmed = input.trim();
    
    // Length check (2-30 characters for smaller places). Don't let people go wild.
    if (trimmed.length < 2 || trimmed.length > 30) {
        return false;
    }
    
    // Must contain at least one letter. No numbers-only nonsense.
    if (!/[a-zA-Z]/.test(trimmed)) {
        return false;
    }
    
    // Check for reasonable place name patterns. Allow letters, spaces, hyphens, apostrophes, and periods.
    const placeNameRegex = /^[a-zA-Z][a-zA-Z\s\-'\.]*[a-zA-Z]$|^[a-zA-Z]$/;
    if (!placeNameRegex.test(trimmed)) {
        return false;
    }
    
    // Reject if it's mostly numbers or symbols. Not a password field.
    const letterCount = (trimmed.match(/[a-zA-Z]/g) || []).length;
    if (letterCount < trimmed.length * 0.6) {
        return false;
    }
    
    // Reject obvious non-place inputs. No 'asdf' allowed.
    const invalidTerms = ['test', 'asdf', 'qwerty', 'admin', 'none', 'null', 'undefined'];
    if (invalidTerms.includes(trimmed.toLowerCase())) {
        return false;
    }
    
    return true;
}

/**
 * Apply proper capitalization to place names. Makes things look nice.
 * @param {string} input - The input to capitalize
 * @returns {string} - Properly capitalized place name
 */
function properCapitalization(input) {
    return input.trim()
        .toLowerCase()
        .split(/(\s+|\-|')/)
        .map(part => {
            // Skip spaces, hyphens, and apostrophes (leave as-is)
            if (/^[\s\-']+$/.test(part)) {
                return part;
            }
            
            // Handle common place name patterns (like 'de', 'la', etc.)
            if (part.length === 0) return part;
            
            // Special cases for place names (articles, prepositions)
            const lowerPart = part.toLowerCase();
            if (['de', 'la', 'le', 'du', 'von', 'van', 'del', 'da', 'di', 'san', 'santa'].includes(lowerPart)) {
                return lowerPart; // Keep articles and prepositions lowercase unless at start
            }
            
            // Standard capitalization (the usual)
            return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        })
        .join('')
    // Fix capitalization after certain punctuation
    .replace(/^(.)/, match => match.toUpperCase()) // Always capitalize first letter
    .replace(/(\s+)(.)/, (match, space, letter) => space + letter.toUpperCase()); // Capitalize after spaces
}

/**
 * Get all available countries for reference.
 * @returns {Array} - Array of country objects
 */
function getAllCountries() {
    return countries.map(country => ({
        name: country.countryName,
        code: country.countryShortCode,
        hasRegions: !!(country.regions && country.regions.length > 0)
    }));
}

/**
 * Get regions for a specific country.
 * @param {string} countryName - Name of the country
 * @returns {Array} - Array of regions for the country
 */
function getRegionsForCountry(countryName) {
    const country = countries.find(c => 
        c.countryName.toLowerCase() === countryName.toLowerCase()
    );
    
    if (!country || !country.regions) {
        return [];
    }
    
    return country.regions.map(region => ({
        name: region.name,
        code: region.shortCode
    }));
}

module.exports = {
    validateRegion,
    getAllCountries,
    getRegionsForCountry,
    VALID_CITIES,
    CITY_CAPITALIZATION_MAP,
    VALID_BROADER_REGIONS,
    COUNTRY_ALIASES
};