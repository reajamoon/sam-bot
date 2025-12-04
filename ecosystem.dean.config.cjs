module.exports = {
  apps: [
    {
      name: 'dean-bot',
      script: 'node',
      args: './src/bots/dean/dean.js',
      watch: false,
      instances: 1,
      autorestart: true,
      exec_mode: "cluster",
      max_memory_restart: '700M',
      max_restarts: 5,
      restart_delay: 10000,
      env: {
        NODE_ENV: 'production',
        DEAN_BOT_TOKEN: process.env.DEAN_BOT_TOKEN,
        DEAN_APP_ID: process.env.DEAN_APP_ID,
        DATABASE_URL: process.env.DATABASE_URL
      }
    }
  ]
};
