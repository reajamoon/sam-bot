// PM2 ecosystem file for Jack (queue worker)
module.exports = {
  apps: [
    {
      name: 'jack',
  script: './src/bots/jack/queueWorker.js',
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
