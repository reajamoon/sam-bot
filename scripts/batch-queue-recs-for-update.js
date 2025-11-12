// scripts/batch-queue-recs-for-update.js
// Adds all recommendations to the parsing queue for batch metadata update
// Run this script to backfill archive_warnings

const path = require('path');
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

// Import your queue model or utility
const QueueEntry = require('../src/models/QueueEntry') ? require('../src/models/QueueEntry')(sequelize) : null;

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');
    const recs = await Recommendation.findAll();
    let added = 0;
    let processed = 0;
    const BATCH_SIZE = 50;
    for (const rec of recs) {
      if (added >= BATCH_SIZE) break;
      let alreadyQueued = false;
      try {
        if (QueueEntry) {
          alreadyQueued = await QueueEntry.findOne({ where: { url: rec.url } });
        }
        if (!alreadyQueued) {
          // Use model method for insert
          await QueueEntry.create({ url: rec.url, status: 'pending' });
          added++;
          console.log(`Queued rec ID ${rec.id} (${rec.url}) for update.`);
        }
      } catch (err) {
        console.error(`Error queueing rec ID ${rec.id} (${rec.url}):`, err.message);
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
