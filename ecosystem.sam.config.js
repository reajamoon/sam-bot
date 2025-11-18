// PM2 ecosystem file for Sam bot
module.exports = {
  apps: [
    {
      name: "sam-bot",
      script: "./src/bots/sam/sam.js",
      max_memory_restart: "800M",
      max_restarts: 5,
      restart_delay: 10000,
      instances: "1",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://crypto:bottom%21Derek87@206.189.180.215:5432/sam_bot_db"
      }
    }
  ]
};
