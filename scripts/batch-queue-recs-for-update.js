// scripts/batch-queue-recs-for-update.js
// Adds all recommendations to the parsing queue for batch metadata update
// Run this script to backfill archive_warnings

const path = require('path');
// Load environment variables from .env if present
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Sequelize } = require('sequelize');
const dbConfig = require('../config/config.json');
const env = process.env.NODE_ENV || 'development';
const config = dbConfig[env];
if (!config) {
  console.error(`No database config found for environment '${env}'. Please set NODE_ENV to match a section in config.json (e.g., 'production').`);
  process.exit(1);
}
let sequelize;
if (config.use_env_variable) {
  const dbUrl = process.env[config.use_env_variable];
  if (!dbUrl) {
    console.error(`Environment variable '${config.use_env_variable}' is not set. Please set it to your database connection string.`);
    process.exit(1);
  }
  sequelize = new Sequelize(dbUrl, {
    dialect: config.dialect,
    logging: config.logging,
    pool: config.pool
  });
} else {
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    {
      host: config.host,
      dialect: config.dialect,
      logging: config.logging,
      pool: config.pool
    }
  );
}
const Recommendation = require('../src/models/Recommendation')(sequelize);

// Import ParseQueue model (was QueueEntry)
const ParseQueue = require('../src/models/ParseQueue')(sequelize);

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    // 1. Clear all 'done' ParseQueue entries
    // const deleted = await ParseQueue.destroy({ where: { status: 'done' } });
    // console.log(`Cleared ${deleted} 'done' entries from ParseQueue.`);

    // 2. Fetch all recs
    const recs = await Recommendation.findAll();
    let added = 0;
    let processed = 0;
    const BATCH_SIZE = 10;
    for (const rec of recs) {
  // Debug: log rec.id and rec.recommendedBy to diagnose 'Unknown User' issue
  console.log(`Rec ID ${rec.id} recommendedBy:`, rec.recommendedBy);
      if (added >= BATCH_SIZE) break;
      // 3. Normalize fic_url: remove /chapters/12345 if present
      let ficUrl = rec.url.replace(/\/chapters\/\d+$/, '');
      let alreadyQueued = false;
      try {
        if (ParseQueue) {
          alreadyQueued = await ParseQueue.findOne({ where: { fic_url: ficUrl } });
        }
        if (!alreadyQueued) {
          await ParseQueue.create({ fic_url: ficUrl, status: 'pending', requested_by: rec.recommendedBy });
          added++;
          console.log(`Queued rec ID ${rec.id} (${ficUrl}) for update.`);
        }
      } catch (err) {
        console.error(`Error queueing rec ID ${rec.id} (${ficUrl}):`, err.message);
      }
      processed++;
      if (processed % 10 === 0) {
        console.log(`Processed ${processed} recs so far, ${added} added to queue.`);
      }
    }
    console.log(`Batch queue complete. Added ${added} recommendations to the parsing queue (processed ${processed} total).`);
    await sequelize.close();
  } catch (err) {
    console.error('Error during batch queue:', err);
    process.exit(1);
  }
})();
