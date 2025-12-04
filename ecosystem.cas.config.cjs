module.exports = {
  apps: [
    {
      name: 'cas',
      script: 'node',
      args: './src/bots/cas/cas.js',
      watch: false,
      instances: 1,
      autorestart: true,
      exec_mode: "cluster",
      max_memory_restart: '700M',
      max_restarts: 5,
      restart_delay: 10000,
      env: {
        NODE_ENV: 'production',
        CAS_BOT_TOKEN: process.env.CAS_BOT_TOKEN,
        CAS_APP_ID: process.env.CAS_APP_ID,
        DATABASE_URL: process.env.DATABASE_URL
      }
    }
  ]
};
