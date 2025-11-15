# SamBot (PB’s Fic Librarian, Tor Valen Stan, Probably Possessed)

Heya! If you’re reading this, you probably already know the deal. Destiel, Supernatural, and Profound Bond server chaos. SamBot’s been our fic librarian since 2017. If he starts acting weird just blame the leviathans.

## What Sam Actually Does

- **Fic recs:** `/rec` is your ticket to the library. Add fics, update them, pull random recs, search and browse fics.
- **Profile stuff:** Birthday, pronouns, timezone, region, bio—set it up, hide it, show it off, whatever.
- **Birthday hype:** He’ll ping you on your birthday (unless you’re hiding from the calendar).
- **Help menus:** Lost? Type `/profile help` or `/rec help` and Sam will walk you through. He’s kind of a know-it-all.
- **Privacy controls:** You can control what shows on your profile, disable others using the command to pull your profile, or delete your profile entirely. Sam is pretty good with secrets.
- **Live updates:** Change something? It updates instantly. If it doesn't for some reason (server issues or whatever) just pull a new profile with `/profile` and it'll show the changes.

## Project Overview

- **Modular Architecture:** All features are split into dedicated command, handler, event, model, and utility modules. See `docs/bot-architecture-overview.md` for details.
- **Sam Winchester’s Voice:** All member-facing text uses Sam’s voice—dry wit, practical, and a little snarky. See `docs/sam-voice-guidelines.md`. These guidelines exist for my own reference but also to kind of explain my Sam headcanons and characterizations I use for Sambot.
- **Database:** Uses SQLite for development and PostgreSQL for production. Database files are ignored via `.gitignore` for security.
- **Process Management:** Uses PM2 for deployment. Never use `npm start` or `npm run dev`—those are disabled. Dude, trust me.

## Documentation

- [Profile System](docs/profile-system.md)
- [Rec System](docs/rec-system.md)
- [Bot Architecture Overview](docs/bot-architecture-overview.md)
- [Sam’s Voice Guidelines](docs/sam-voice-guidelines.md)
- [Message Tracking Utility](docs/message-tracking-utility.md)
- [Naming Reference](docs/NAMING_REFERENCE.md)
- [Changelog](CHANGELOG.md)

## Project Status & Issues

This is a single developer project. The source is public for transparency, feature tracking, and documentation. If you’re a member and want to see how things work, poke around! If you want to base your own project on it, go wild! I’m not currently accepting outside contributions. If you really think we'd work well together hit me up on discord and let's talk. You can submit issues or feature requests if you spot a bug or have an idea.

## Extending the Bot

- Adds new commands by creating handler modules in `src/commands/`.
- Adds new profile fields or rec features by updating models and utility logic.
- Uses standardized custom ID formats for all buttons and navigation.
- Reference the docs for architecture, naming, and best practices.

## Security Best Practices

- Never commits database files or secrets.
- Uses environment variables for all sensitive config.
- Always validates user input and handles errors gracefully.

## In-Jokes & Personality

SamBot is basically Sam Winchester trapped in Discord. He’s snarky, helpful, and a  giant nerd. If he recs the same super angsty omegaverse fic for the hundredth time, just let him cook.

## Already Here?

`/rec` for fics, `/profile` for profile stuff, ping a mod if you need backup. Sam’s always lurking.

## Not Here Yet?

Join us, give the dev a cookie: [discord.gg/profoundbond](https://discord.gg/profoundbond)
