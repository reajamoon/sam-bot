# PB Community Changelog

---

## 2025-11-11

### Features & Improvements
- All fic metadata fetches (AO3 and others) now use a deduplicated queue system to prevent memory leaks and lag.
- Queue jobs are always used for metadata fetches, never direct parsing, ensuring reliability and no overlap.
- All interested users are notified when a job completes, with instant jobs suppressing redundant notifications for a smooth smooooth experience.
- Queue worker, subscriber, and job processor logic reviewed and hardened for reliability.
- Notification suppression for instant jobs is configurable and robust to edge cases.
- Documentation updated to reflect queue architecture and notification changes.
- Made some little fixes and tweaks to how /rec update ID lookup works, hopefully handles better than before.

---

## 2025-11-08

### Features & Improvements
- AO3 parser, login/session, and fetch utilities fully scrutinized for stupid weird little loopies and blackholes of logic.
- AO3 login/session logic now uses cookie persistence and always navigates to the fic URL after login instead of just staring blankly at the login confirmation screen.
- All AO3 fetch and parser modules are modular, silent, and return clear error objects for user feedback. bless.
- Resolved a loop where Sam would look for a typo'd tablename in the database, get sad it wasn't there, look again, repeat, many times a second until crashing taking Dean and Cas down with him until they were all stuck in a horrifying restart-crash death spiral.
- Code and comments reviewed for clarity and maintainability :)

---

## 2025-11-05

### Features & Improvements
- Privacy and profile button handlers are now unified and much easier to maintain.
- All embeds (profile, help, birthday, privacy) are now guaranteed to have proper titles and descriptions—no more empty messages!
- Input modals (bio, pronouns, region, timezone) now check for reasonable length and log any validation errors, making it easier to spot issues.
- Birthday notifications are only sent when there are birthdays to celebrate—no more empty or unnecessary messages.
- Error handling and logging have been improved everywhere, so problems are easier to track down and fix.
- Documentation and error action plan have been updated to match the new code structure.
- Code cleanup and error fixes in message tracking and profile modules.

### Bug Fixes
- Fixed the annoying "countries is not iterable" error in regionValidator.js.
- Fixed missing EmbedBuilder imports and made sure all embeds have required fields.
- Patched double replies, expired tokens, and failed updates in all interaction handlers.
- Fixed Discord errors: "Invalid Form Body" (50035), "Cannot send an empty message" (50006), "Unknown interaction" (10062), and "Interaction has already been acknowledged" (40060).
- Privacy button reliability and embed validation bugs are now resolved.
- Bio and other input fields now have proper length validation.
- 'Messages Sent' field now properly hides the 'since' date if set by a mod, and shows it only for auto-tracked counts.

---

## 2025-11-04

### Features & Improvements
- Removed the old pronouns help module and button from the help system, pronouns are now part of the bio section.
- Help menu navigation is cleaner and easier to use.
- Documentation and migration checklist updated to reflect these changes.

### Bug Fixes
- No remaining references to the old pronouns help module/button.

---

## 2025-11-03

### Features & Improvements
- Unified message tracking: all profile, privacy, modal, and select menu handlers now use a single utility for message IDs.
