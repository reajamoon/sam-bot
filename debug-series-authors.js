import { fetchSeriesWithUserMetadata } from './src/models/fetchSeriesWithUserMetadata.js';

// Test series ID - use the one you're seeing issues with
const seriesId = process.argv[2] || 1;

console.log(`Debugging series author for series ID: ${seriesId}`);

const series = await fetchSeriesWithUserMetadata(seriesId);
if (!series) {
    console.log('Series not found');
    process.exit(1);
}

console.log('\n=== Series Data ===');
console.log('Series authors:', series.authors);
console.log('Series author (singular):', series.author);

console.log('\n=== Works in Series ===');
if (series.works && series.works.length > 0) {
    series.works.forEach((work, index) => {
        console.log(`\nWork ${index + 1}:`);
        console.log('  Title:', work.title);
        console.log('  Authors:', work.authors);
        console.log('  Author (singular):', work.author);
        console.log('  notPrimaryWork:', work.notPrimaryWork);
        console.log('  Published:', work.publishedDate);
        console.log('  Created:', work.createdAt);
    });
    
    console.log('\n=== Primary Work Detection ===');
    const primaryWork = series.works.find(work => !work.notPrimaryWork);
    console.log('Primary work found:', !!primaryWork);
    if (primaryWork) {
        console.log('Primary work title:', primaryWork.title);
        console.log('Primary work authors:', primaryWork.authors);
        console.log('Primary work author:', primaryWork.author);
    }
    
    // Also check oldest work
    const sortedWorks = series.works.sort((a, b) => {
        if (a.publishedDate && b.publishedDate) {
            return new Date(a.publishedDate) - new Date(b.publishedDate);
        }
        if (a.createdAt && b.createdAt) {
            return new Date(a.createdAt) - new Date(b.createdAt);
        }
        return 0;
    });
    
    console.log('\n=== Oldest Work (fallback) ===');
    if (sortedWorks.length > 0) {
        const oldestWork = sortedWorks[0];
        console.log('Oldest work title:', oldestWork.title);
        console.log('Oldest work authors:', oldestWork.authors);
        console.log('Oldest work author:', oldestWork.author);
    }
}

process.exit(0);