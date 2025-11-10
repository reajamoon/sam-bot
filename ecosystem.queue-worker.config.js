// PM2 ecosystem file for queueWorker.js
module.exports = {
  apps: [
    {
      name: 'fic-queue-worker',
      script: './queueWorker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
    }
}
  ],
};
