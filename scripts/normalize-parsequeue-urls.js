// Script to normalize fic_url in ParseQueue by removing /chapters/12345 segment
require('dotenv').config();
const { Sequelize } = require('sequelize');
const { sequelize, ParseQueue } = require('../src/models');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Find all ParseQueue entries with fic_url containing /chapters/12345
    const entries = await ParseQueue.findAll({
      where: {
        fic_url: { [Sequelize.Op.like]: '%/chapters/%' }
      }
    });

    let updated = 0;
    for (const entry of entries) {
      const originalUrl = entry.fic_url;
      const normalizedUrl = originalUrl.replace(/\/chapters\/\d+$/, '');
      if (normalizedUrl !== originalUrl) {
        // Check for duplicate
        const duplicate = await ParseQueue.findOne({ where: { fic_url: normalizedUrl } });
        if (!duplicate) {
          entry.fic_url = normalizedUrl;
          await entry.save();
          updated++;
          console.log(`Updated fic_url for queue ID ${entry.id}: ${originalUrl} -> ${normalizedUrl}`);
        } else {
          // If duplicate exists, delete this entry
          await entry.destroy();
          console.log(`Deleted duplicate queue entry ID ${entry.id} with fic_url ${originalUrl}`);
        }
      }
    }
    console.log(`Normalization complete. ${updated} entries updated.`);
    await sequelize.close();
  } catch (err) {
    console.error('Error during fic_url normalization:', err);
    process.exit(1);
  }
})();
