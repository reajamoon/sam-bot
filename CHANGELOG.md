# PB Community Changelog

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
