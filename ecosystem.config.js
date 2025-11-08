module.exports = {
    apps: [{
        name: 'sam-bot',
        script: 'src/index.js',
        exec_mode: 'fork',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        env: {
            NODE_ENV: 'development',
            DATABASE_URL: 'sqlite:./database/bot.sqlite'
        },
        env_production: {
            NODE_ENV: 'production',
            DATABASE_URL: ''
        },
        error_file: './logs/pm2-error.log',
        out_file: './logs/pm2-out.log',
        log_file: './logs/pm2-combined.log',
        time: true
    }]
};