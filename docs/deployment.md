# Deployment

This project uses PM2 to manage multiple bot processes (Sam, Dean, Cas, Jack).

## Quick Commands
- `npm run deploy:all`: start Sam, Dean, Cas, Jack via PM2
- `npm run deploy:all:save`: start all and persist the PM2 list (`pm2 save`)
- `npm run stop:all`: stop all four processes
- `npm run restart:all`: restart all four processes

## Persist Across Reboots
Run PM2 startup steps once to enable auto-resurrection:

```bash
pm2 startup
# Follow the printed instruction (uses sudo to configure system service)
pm2 save
```

## Individual Bots
Start bots individually if needed:

```bash
npm run deploy:sam
npm run deploy:dean
npm run deploy:cas
npm run deploy:jack
```

## Notes
- Environment variables are managed via `.env` and PM2 ecosystem configs (`ecosystem.*.config.cjs`).
- `start-bots.sh` can also start all bots using their ecosystem files.
