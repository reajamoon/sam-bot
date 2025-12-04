// PM2 ecosystem file for Sam bot
module.exports = {
  apps: [
    {
      name: "sam",
      script: 'node',
      args: "./src/bots/sam/sam.js",
      instances: 1,
      autorestart: true,
      watch: false,
      exec_mode: "cluster",
      max_memory_restart: '700M',
      max_restarts: 5,
      restart_delay: 10000,
      interpreter: 'node',
      env: {
        NODE_ENV: "production",
        DATABASE_URL: process.env.DATABASE_URL
      }
    }
  ]
};