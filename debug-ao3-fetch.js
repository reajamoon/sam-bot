// debug-ao3-fetch.js
// Usage: node debug-ao3-fetch.js <workUrl>
// Example: node debug-ao3-fetch.js https://archiveofourown.org/works/26869954


require('dotenv').config();
const { debugLoginAndFetchWork } = require('./src/shared/recUtils/ao3/ao3Utils');

const workUrl = process.argv[2];
if (!workUrl) {
  console.error('Usage: node debug-ao3-fetch.js <workUrl>');
  process.exit(1);
}

debugLoginAndFetchWork(workUrl)
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error during AO3 debug fetch:', err);
    process.exit(1);
  });
