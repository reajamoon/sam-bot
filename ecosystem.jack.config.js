// PM2 ecosystem file for Jack (queue worker)
module.exports = {
  apps: [
    {
      name: 'jack',
      script: './src/bots/jack/jack.js',
      instances: 1,
      autorestart: true,
      watch: false,
      exec_mode: "fork",
      max_memory_restart: '700M',
      max_restarts: 5,
      restart_delay: 10000,
      env: {
        NODE_ENV: 'production',
      }
    }
  ],
};
