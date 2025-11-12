# Sam Bot: Long-Term To-Do List

---

## Core Features
- [ ] Fic club features
- [x] Add regular backup/export for recommendations
- [x] Implement data migration scripts for schema changes
- [ ] Optimize database queries for large library
- [ ] Preempt case where library grows outsized
- [ ] Color rec embed by rating/warnings
    - Update the recommendation embed logic to set the embed color based on fic rating (e.g., Teen, Mature, Explicit) and/or content warnings. This should be handled in src/utils/recUtils/createRecommendationEmbed.js and coordinated with rating/warning parsing from fic metadata.

## User Experience
 - [ ] Unify `/rec update <id>` to use a single identifier field (ID, URL, AO3 ID, etc.) with internal logic to detect and handle all types.
- [ ] Enhance help and onboarding (interactive guides)
- [ ] Add user profile pages (show contributions, stats)
- [ ] Allow users to favorite fics
- [ ] Add notification system for fic updates based on completion status or chapter count
- [ ] Birthday wishes with timezone fallback
    - Add logic to send birthday wishes to users based on their set timezone, with a fallback to the server time if user timezone is not set. Integrate with birthday notification and profile logic.

## Attachments & Permissions
- [ ] Enforce stricter author permission checks for uploads
- [ ] Add mod review queue for new attachments
- [ ] Add audit log for edits/removals
- [ ] Implement recommendation flag/report system
- [ ] Add support for author requests (removal, corrections)

## Logging & Monitoring
- [ ] Integrate advanced logging (Winston)
- [ ] Add health checks and uptime monitoring
- [ ] Suppress or resolve PM2 AXM errors

## Community & Moderation
- [ ] Add `/modmail` improvements (auto-categorize, mod notes) [this to-do should be moved to Cas bot]

## DevOps
- [ ] Add test coverage for all modules

## Privacy Modularization Implementation Details
- [ ] If privacy button bugs persist, plan to rebuild privacy buttons from scratch

---

*Last updated: 2025-11-05*
