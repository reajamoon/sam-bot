# Security Best Practices

- Do not commit database files or secrets.
- Use environment variables for all sensitive configuration.
- Validate all user input and handle errors gracefully.
- Keep tokens, app IDs, and database URLs in `.env` and PM2 ecosystem configs.
- Limit bot permissions to only what is required.
