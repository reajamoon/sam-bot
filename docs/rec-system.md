# PB Recommendation System – Documentation

## The PB Library (In-World Context)
So get this! Around here, we call the recommendation system "the Library" (sometimes "our library" or "the stacks" if you’re feeling bookish). It’s not just a bunch of fanfic recs; it’s the living archive of the PB community, where hunters swap stories, dig up old favorites, and keep the lore alive. Every time you add a rec, search the stacks, or check out stats, you’re helping build something bigger than just a list. You’re keeping the community inspired and connected.

Whenever you see rec features, help menus, or stats, I’m the one walking you through it. I keep things practical, direct, and clear, like I’m showing a friend how to find the good stuff. All member-facing text uses my voice (Sam Winchester), so you’ll get dry wit, a little sarcasm, and zero nonsense. If you’re ever lost, just ask for help and I'll come running.

The PB Library is modular, reliable, and always speaks in my voice. All documentation and features use "The PB Library" to keep things immersive and consistent with our server lore.
For help text style, see `docs/sam-voice-guidelines.md`.

## Overview
The Rec System lets PB members share, search, and discover fanfiction recommendations. It’s modular, reliable, and always speaks in Sam Winchester’s voice.

## Features
- Add new recommendations with metadata
- Search and filter by tags, author, title, rating, and more
- Get random recs and library stats
- Remove or update recs (with permission checks)
- Multi-page help system and navigation


## Architecture
- All fic metadata fetches (AO3 and others) are handled through a robust, deduplicated queue system. This ensures no overlap, prevents memory leaks, and keeps the bot responsive even under heavy load.
- Modular command and handler structure (`rec.js` routes to handlers)
- Utility modules for embed creation, validation, pagination, statistics, and config
- All buttons and navigation use standardized custom IDs
- Sam Winchester voice integration for all member-facing text

## Commands
- `/rec add` – Add a new recommendation
- `/rec search` – Search the library
- `/rec random` – Get a random rec
- `/rec stats` – View library statistics
- `/rec remove` – Remove a rec
- `/rec update` – Update rec metadata
- `/rec help` – Get help and tips

## File Structure
- `src/commands/rec.js` – Main command router
- `src/commands/rec/` – Handler modules (add, search, random, stats, remove, update, help)
- `src/utils/rec/` – Utility modules (embedBuilder, validator, pagination, statistics, config)

## Best Practices
- Use utility modules for all embed, validation, and pagination logic
- Keep Sam’s voice consistent in all member-facing text
- Modularize new features for maintainability
- Validate all input and provide clear, friendly error messages

## Extending the System
- Add new subcommands by creating handler modules
- Update utility modules for new metadata or filtering
- Use standardized custom ID format for all new buttons and navigation

## Queue & Notification System

- All fic metadata fetches are queued, deduplicated, and processed in order. No direct parsing is allowed outside the queue.
- Subscribers (users who requested or are interested in a job) are tracked and notified when the job completes.
- If a job is processed instantly (queue was empty and job completes within a few seconds), redundant notifications are suppressed.
- The queue worker, subscriber, and job processor logic are hip to edge cases and restarts.

## Migration Status

The rec system is fully modularized and uses a queue for all metadata fetches. Handler modules and utility files are split out, and the main command file just routes logic. Most migration steps are complete, but some advanced features (analytics, user preference tracking) are still planned for the future. If you see any TODOs in utility files, those are just reminders to finish moving some code out of the main command file.

## Benefits

- **Maintainability:** Each feature in its own module
- **Extensibility:** Easy to add new subcommands
- **Testability:** Individual components can be unit tested
- **Readability:** Clear separation of concerns
- **Consistency:** Unified error handling and styling
- **Performance:** Reduced memory footprint per operation

---
For help text style, see `docs/sam-voice-guidelines.md`. For technical details, see the handler and utility modules in `src/commands/rec/` and `src/utils/rec/`.
