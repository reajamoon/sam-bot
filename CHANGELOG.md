# PB Community Changelog


## 2025-11-12

### AO3 Parser & Metadata Handling & Database Query Optimizations & some other stuff maybe?
- AO3 parser now uses cheerio and zod to simplify scraping, good lord.
- All tag fields are decoded for HTML entities and special characters bye amp&.
- QueueWorker (jack) can now take a short nap if he gets tired, also batches queries :O
- fixed /chapters/12345 allowing dupes and deleted some folks' precious early recs I'm so sorry I should have given precedence to who added first not who added without /chapters/numbers but I'm stupid and forgot
- Sam now keeps a bag of cookie crunch cereal for Jack on hand (aka I fixed AO3 cookies not persisting)
- Also fixed Sam trying to open extra tabs forever instead of closing them. Mood, but also don't do that.
- Added dynamic checking of server load here and AO3 server response to back off on queue calls and increase from the standard variance (apx. 20s) if the servers seem busy to give AO3 a helping hand and also save our own server (the increased timeout depends on how hammered the servers seem but it can be anywhere from a 30s cooldown to a 3m cooldown so don't panic if your fic isn't popping immediately)
- Also on this note: fics that have gotten a successful new rec or update cannot be refetched for fresh data from AO3's servers for 3hours now! After that time they will drop out of the queue (where they sit in done state for that time preventing new update fetches) and can be updated again, if say, you added a chapter and a bunch of tags! You can still bypass the fetch and update manually while on cooldown.
- Errored fics (did not fetch for some reason) will give a message and drop out of the queue, not triggering a cooldown.
- Pending/Processing fics that are stuck in the queue will automatically drop out after 15 minutes, or can be manually kicked in the ass by a mod to rerun as a batch with /rec resetqueue or kicked out of the queue one by one with /rec clearqueue <url>
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
