// PM2 ecosystem file for queueWorker.js
module.exports = {
  apps: [
    {
      name: 'jack',
      script: './queueWorker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      exec_mode: "fork",
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
    }
}
  ],
};
