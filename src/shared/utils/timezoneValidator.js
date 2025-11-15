const countries = require('country-region-data');

/**
 * Map common regions/cities to their IANA timezone identifiers
 * This covers major cities and regions that users commonly reference
 */
const REGION_TIMEZONE_MAP = {
    // United States regions
    'new york': 'America/New_York',
    'ny': 'America/New_York',
    'nyc': 'America/New_York',
    'new york city': 'America/New_York',
    'manhattan': 'America/New_York',
    'brooklyn': 'America/New_York',
    'queens': 'America/New_York',
    'bronx': 'America/New_York',
    'eastern': 'America/New_York',
    'east coast': 'America/New_York',
    
    'california': 'America/Los_Angeles',
    'ca': 'America/Los_Angeles',
    'los angeles': 'America/Los_Angeles',
    'la': 'America/Los_Angeles',
    'san francisco': 'America/Los_Angeles',
    'sf': 'America/Los_Angeles',
    'san diego': 'America/Los_Angeles',
    'sacramento': 'America/Los_Angeles',
    'oakland': 'America/Los_Angeles',
    'san jose': 'America/Los_Angeles',
    'pacific': 'America/Los_Angeles',
    'west coast': 'America/Los_Angeles',
    
    'chicago': 'America/Chicago',
    'illinois': 'America/Chicago',
    'il': 'America/Chicago',
    'texas': 'America/Chicago',
    'tx': 'America/Chicago',
    'houston': 'America/Chicago',
    'dallas': 'America/Chicago',
    'austin': 'America/Chicago',
    'san antonio': 'America/Chicago',
    'central': 'America/Chicago',
    'midwest': 'America/Chicago',
    
    'denver': 'America/Denver',
    'colorado': 'America/Denver',
    'co': 'America/Denver',
    'utah': 'America/Denver',
    'arizona': 'America/Phoenix', // Arizona doesn't observe DST
    'az': 'America/Phoenix',
    'phoenix': 'America/Phoenix',
    'mountain': 'America/Denver',
    
    'florida': 'America/New_York',
    'fl': 'America/New_York',
    'miami': 'America/New_York',
    'orlando': 'America/New_York',
    'tampa': 'America/New_York',
    
    'washington': 'America/Los_Angeles',
    'wa': 'America/Los_Angeles',
    'seattle': 'America/Los_Angeles',
    'portland': 'America/Los_Angeles',
    'oregon': 'America/Los_Angeles',
    'or': 'America/Los_Angeles',
    
    // Canada
    'toronto': 'America/Toronto',
    'ontario': 'America/Toronto',
    'ottawa': 'America/Toronto',
    'montreal': 'America/Montreal',
    'quebec': 'America/Montreal',
    'vancouver': 'America/Vancouver',
    'british columbia': 'America/Vancouver',
    'bc': 'America/Vancouver',
    'calgary': 'America/Edmonton',
    'alberta': 'America/Edmonton',
    'winnipeg': 'America/Winnipeg',
    'manitoba': 'America/Winnipeg',
    
    // Europe
    'london': 'Europe/London',
    'uk': 'Europe/London',
    'united kingdom': 'Europe/London',
    'england': 'Europe/London',
    'britain': 'Europe/London',
    'scotland': 'Europe/London',
    'wales': 'Europe/London',
    
    'paris': 'Europe/Paris',
    'france': 'Europe/Paris',
    'berlin': 'Europe/Berlin',
    'germany': 'Europe/Berlin',
    'amsterdam': 'Europe/Amsterdam',
    'netherlands': 'Europe/Amsterdam',
    'rome': 'Europe/Rome',
    'italy': 'Europe/Rome',
    'madrid': 'Europe/Madrid',
    'spain': 'Europe/Madrid',
    
    'moscow': 'Europe/Moscow',
    'russia': 'Europe/Moscow',
    
    // Asia
    'tokyo': 'Asia/Tokyo',
    'japan': 'Asia/Tokyo',
    'beijing': 'Asia/Shanghai',
    'china': 'Asia/Shanghai',
    'shanghai': 'Asia/Shanghai',
    'hong kong': 'Asia/Hong_Kong',
    'singapore': 'Asia/Singapore',
    'seoul': 'Asia/Seoul',
    'south korea': 'Asia/Seoul',
    'korea': 'Asia/Seoul',
    'mumbai': 'Asia/Kolkata',
    'india': 'Asia/Kolkata',
    'delhi': 'Asia/Kolkata',
    'bangalore': 'Asia/Kolkata',
    
    // Australia
    'sydney': 'Australia/Sydney',
    'melbourne': 'Australia/Melbourne',
    'brisbane': 'Australia/Brisbane',
    'perth': 'Australia/Perth',
    'adelaide': 'Australia/Adelaide',
    'australia': 'Australia/Sydney', // Default to Sydney
    
    // Other
    'hawaii': 'Pacific/Honolulu',
    'hi': 'Pacific/Honolulu',
    'honolulu': 'Pacific/Honolulu',
    'alaska': 'America/Anchorage',
    'ak': 'America/Anchorage',
    'anchorage': 'America/Anchorage'
};

/**
 * Common timezone abbreviations mapping to IANA identifiers
 */
const TIMEZONE_ABBREVIATIONS = {
    'EST': 'America/New_York',
    'CST': 'America/Chicago', 
    'MST': 'America/Denver',
    'PST': 'America/Los_Angeles',
    'EDT': 'America/New_York',
    'CDT': 'America/Chicago',
    'MDT': 'America/Denver', 
    'PDT': 'America/Los_Angeles',
    'UTC': 'UTC',
    'GMT': 'UTC',
    'BST': 'Europe/London',
    'CET': 'Europe/Paris',
    'JST': 'Asia/Tokyo',
    'IST': 'Asia/Kolkata',
    'AEST': 'Australia/Sydney',
    'HST': 'Pacific/Honolulu',
    'AKST': 'America/Anchorage'
};

/**
 * Validate and normalize timezone input using region library and flexible parsing
 * @param {string} input - User input for timezone
 * @returns {Object} - { isValid: boolean, normalizedTimezone: string|null, suggestions: string[] }
 */
function validateTimezone(input) {
    if (!input || typeof input !== 'string') {
        return { isValid: false, normalizedTimezone: null, suggestions: [] };
    }

    const cleanInput = input.trim();
    
    if (cleanInput.length === 0) {
        return { isValid: false, normalizedTimezone: null, suggestions: [] };
    }

    const inputLower = cleanInput.toLowerCase();
    
    // 1. Check timezone abbreviations first
    const upperInput = cleanInput.toUpperCase();
    if (TIMEZONE_ABBREVIATIONS[upperInput]) {
        return {
            isValid: true,
            normalizedTimezone: TIMEZONE_ABBREVIATIONS[upperInput],
            suggestions: []
        };
    }
    
    // 2. Handle UTC offset formats like +5, -8, UTC+2, UTC-5, UTC 0, UTC +0, UTC -0, UTC+00:00, UTC 00:00
    const offsetMatch = cleanInput.match(/^(UTC)?\s*([+-]?\d{1,2})(:?\d{2})?$/i);
    if (offsetMatch) {
        const [, utcPrefix, offsetHours, offsetMinutes] = offsetMatch;
        // Accept 'UTC 0', 'UTC+0', 'UTC -0', 'UTC0', '+0', '-0', '0'
        let hours = parseInt(offsetHours);
        if (isNaN(hours)) hours = 0;
        const mins = offsetMinutes ? parseInt(offsetMinutes.replace(':', '')) : 0;
        if (hours >= -12 && hours <= 14 && mins >= 0 && mins < 60) {
            // Normalize to UTC+X or UTC-X
            let sign = hours < 0 ? '-' : '+';
            if (hours === 0 && offsetHours.startsWith('-')) sign = '-';
            if (hours === 0 && offsetHours.startsWith('+')) sign = '+';
            const absHours = Math.abs(hours).toString().padStart(2, '0');
            const absMins = mins ? `:${mins.toString().padStart(2, '0')}` : '';
            const utcOffset = `UTC${sign}${absHours}${absMins}`;
            return {
                isValid: true,
                normalizedTimezone: utcOffset,
                suggestions: []
            };
        }
    }
    
    // 3. Check direct region/city mappings
    if (REGION_TIMEZONE_MAP[inputLower]) {
        return {
            isValid: true,
            normalizedTimezone: REGION_TIMEZONE_MAP[inputLower],
            suggestions: []
        };
    }
    
    // 4. Try IANA timezone validation (in case user entered exact IANA format)
    try {
        const testDate = new Date();
        testDate.toLocaleString('en-US', { 
            timeZone: cleanInput,
            hour: '2-digit',
            minute: '2-digit'
        });
        return {
            isValid: true,
            normalizedTimezone: cleanInput,
            suggestions: []
        };
    } catch (error) {
        // Not a valid IANA timezone, continue with region library
    }
    
    // 5. Use region library to find potential matches
    const suggestions = [];
    let bestMatch = null;
    
    // Search through countries and regions for matches
    for (const country of countries) {
        const countryLower = country.countryName.toLowerCase();
        
        // Check if input matches country name
        if (countryLower === inputLower || country.countryShortCode.toLowerCase() === inputLower) {
            // Found country match, try to map to a timezone
            const countryTimezone = getCountryDefaultTimezone(country.countryName);
            if (countryTimezone) {
                bestMatch = countryTimezone;
                break;
            }
        }
        
        // Check regions within countries
        if (country.regions) {
            for (const region of country.regions) {
                const regionLower = region.name.toLowerCase();
                
                if (regionLower === inputLower || region.shortCode?.toLowerCase() === inputLower) {
                    // Found region match, try to map to timezone
                    const regionTimezone = getRegionTimezone(country.countryName, region.name);
                    if (regionTimezone) {
                        bestMatch = regionTimezone;
                        break;
                    }
                }
                
                // Partial matches for suggestions
                if (regionLower.includes(inputLower) || inputLower.includes(regionLower)) {
                    const timezone = getRegionTimezone(country.countryName, region.name);
                    if (timezone && suggestions.length < 5) {
                        suggestions.push(`${region.name}, ${country.countryName}`);
                    }
                }
            }
            
            if (bestMatch) break;
        }
        
        // Add country suggestions for partial matches
        if (countryLower.includes(inputLower) || inputLower.includes(countryLower)) {
            const timezone = getCountryDefaultTimezone(country.countryName);
            if (timezone && suggestions.length < 5) {
                suggestions.push(country.countryName);
            }
        }
    }
    
    // 6. Fuzzy search in our region/timezone map for suggestions
    for (const [region, timezone] of Object.entries(REGION_TIMEZONE_MAP)) {
        if (region.includes(inputLower) || inputLower.includes(region)) {
            if (suggestions.length < 5 && !suggestions.some(s => s.toLowerCase().includes(region))) {
                suggestions.push(region.charAt(0).toUpperCase() + region.slice(1));
            }
        }
    }
    
    if (bestMatch) {
        return {
            isValid: true,
            normalizedTimezone: bestMatch,
            suggestions: []
        };
    }
    
    return {
        isValid: false,
        normalizedTimezone: null,
        suggestions: suggestions.slice(0, 5) // Limit to 5 suggestions
    };
}

/**
 * Get default timezone for a country
 * @param {string} countryName - Country name
 * @returns {string|null} - IANA timezone identifier
 */
function getCountryDefaultTimezone(countryName) {
    const countryTimezones = {
        'United States': 'America/New_York', // Default to Eastern
        'Canada': 'America/Toronto',
        'United Kingdom': 'Europe/London',
        'France': 'Europe/Paris',
        'Germany': 'Europe/Berlin',
        'Italy': 'Europe/Rome',
        'Spain': 'Europe/Madrid',
        'Netherlands': 'Europe/Amsterdam',
        'Japan': 'Asia/Tokyo',
        'China': 'Asia/Shanghai',
        'India': 'Asia/Kolkata',
        'Australia': 'Australia/Sydney',
        'Russia': 'Europe/Moscow',
        'Brazil': 'America/Sao_Paulo',
        'Mexico': 'America/Mexico_City',
        'South Korea': 'Asia/Seoul',
        'Singapore': 'Asia/Singapore'
    };
    
    return countryTimezones[countryName] || null;
}

/**
 * Get timezone for a specific region within a country
 * @param {string} countryName - Country name
 * @param {string} regionName - Region/state name
 * @returns {string|null} - IANA timezone identifier
 */
function getRegionTimezone(countryName, regionName) {
    const regionLower = regionName.toLowerCase();
    
    // US state/region timezone mappings
    if (countryName === 'United States') {
        const usTimezones = {
            'california': 'America/Los_Angeles',
            'oregon': 'America/Los_Angeles',
            'washington': 'America/Los_Angeles',
            'nevada': 'America/Los_Angeles',
            'idaho': 'America/Boise',
            'utah': 'America/Denver',
            'colorado': 'America/Denver',
            'arizona': 'America/Phoenix',
            'new mexico': 'America/Denver',
            'montana': 'America/Denver',
            'wyoming': 'America/Denver',
            'north dakota': 'America/Chicago',
            'south dakota': 'America/Chicago',
            'nebraska': 'America/Chicago',
            'kansas': 'America/Chicago',
            'oklahoma': 'America/Chicago',
            'texas': 'America/Chicago',
            'minnesota': 'America/Chicago',
            'iowa': 'America/Chicago',
            'missouri': 'America/Chicago',
            'arkansas': 'America/Chicago',
            'louisiana': 'America/Chicago',
            'wisconsin': 'America/Chicago',
            'illinois': 'America/Chicago',
            'michigan': 'America/Detroit',
            'indiana': 'America/Indiana/Indianapolis',
            'ohio': 'America/New_York',
            'kentucky': 'America/New_York',
            'tennessee': 'America/New_York',
            'alabama': 'America/Chicago',
            'mississippi': 'America/Chicago',
            'georgia': 'America/New_York',
            'florida': 'America/New_York',
            'south carolina': 'America/New_York',
            'north carolina': 'America/New_York',
            'virginia': 'America/New_York',
            'west virginia': 'America/New_York',
            'maryland': 'America/New_York',
            'delaware': 'America/New_York',
            'pennsylvania': 'America/New_York',
            'new jersey': 'America/New_York',
            'new york': 'America/New_York',
            'connecticut': 'America/New_York',
            'rhode island': 'America/New_York',
            'massachusetts': 'America/New_York',
            'vermont': 'America/New_York',
            'new hampshire': 'America/New_York',
            'maine': 'America/New_York',
            'alaska': 'America/Anchorage',
            'hawaii': 'Pacific/Honolulu'
        };
        
        return usTimezones[regionLower] || 'America/New_York'; // Default to Eastern
    }
    
    // Canadian province timezone mappings
    if (countryName === 'Canada') {
        const canadaTimezones = {
            'british columbia': 'America/Vancouver',
            'alberta': 'America/Edmonton',
            'saskatchewan': 'America/Regina',
            'manitoba': 'America/Winnipeg',
            'ontario': 'America/Toronto',
            'quebec': 'America/Montreal',
            'new brunswick': 'America/Moncton',
            'nova scotia': 'America/Halifax',
            'prince edward island': 'America/Halifax',
            'newfoundland and labrador': 'America/St_Johns',
            'yukon': 'America/Whitehorse',
            'northwest territories': 'America/Yellowknife',
            'nunavut': 'America/Iqaluit'
        };
        
        return canadaTimezones[regionLower] || 'America/Toronto'; // Default to Eastern
    }
    
    // For other countries, return country default
    return getCountryDefaultTimezone(countryName);
}

module.exports = {
    validateTimezone,
    REGION_TIMEZONE_MAP,
    TIMEZONE_ABBREVIATIONS
};