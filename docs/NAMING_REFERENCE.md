# Discord Bot Naming Reference

This document serves as the single source of truth for all variable names, field names, and naming conventions used throughout the Discord bot codebase. Refer to this file to maintain consistency and avoid naming errors.

## Server Demographics & Technical Context

### Target Deployment Environment
- **Development**: Windows Linux Subsystem (WSL)
- **Production**: Remote Ubuntu server
- **Process Management**: PM2 for production deployment
- **Database**: SQLite for development, PostgreSQL for production

### Server Statistics (Profound Bond Community)
- **Total Members**: 3,700-4,000 members
- **Active Members**: ~400 concurrent active users
- **Bot Usage Patterns**: 
  - Peak concurrent privacy settings users: 2-3 (rare occurrence)
  - Typical privacy session: 1-3 button clicks per user
  - Profile views: Low to moderate frequency
- **Rate Limiting Considerations**: Negligible risk due to moderate usage patterns
- **Performance Requirements**: Standard Discord bot response times adequate

### Community Context
- **Primary Community**: Profound Bond (Supernatural fandom)
- **Bot Personality**: Sam Winchester's voice - direct, casual, helpful
- **Key Features**: Profile system, recommendation library, birthday notifications
- **Content Focus**: Fanfiction recommendations, member profiles, community interaction

## Database Models

### User Model (`src/models/User.js`)

#### Core Identity Fields
- `discordId` (STRING, PRIMARY KEY) - Discord user ID
- `username` (STRING) - Discord username
- `discriminator` (STRING) - Discord discriminator (#1234)
- `avatar` (STRING) - Discord avatar hash
- `isBot` (BOOLEAN) - Whether user is a bot

#### Activity Tracking
- `joinedAt` (DATE) - When user first joined any tracked server
- `lastSeen` (DATE) - Last activity timestamp
- `messageCount` (INTEGER) - Total message count
- `experience` (INTEGER) - XP points
- `level` (INTEGER) - Current level

#### Profile Information
- `birthday` (DATEONLY) - User's birthday (MM/DD or MM/DD/YYYY)
- `timezone` (STRING) - User's timezone
- `pronouns` (STRING) - User's preferred pronouns
- `bio` (TEXT) - User's profile bio

#### Profile Display Settings
- `timezoneDisplay` (STRING) - How timezone appears on profile
  - Values: `'iana'`, `'offset'`, `'short'`, `'combined'`, `'hidden'`
  - Default: `'iana'`

#### Birthday Privacy Settings
- `birthdayMentions` (BOOLEAN) - Allow birthday mentions (default: true)
- `birthdayAnnouncements` (BOOLEAN) - Show in daily birthday list (default: true)
- `birthdayAgePrivacy` (BOOLEAN) - **Privacy Mode (Full)** - Hide ALL birthday info (default: false)
- `birthdayAgeOnly` (BOOLEAN) - **Privacy Mode (Age Hidden)** - Hide only age, show birthday/zodiac (default: false)
- `birthdayYearHidden` (BOOLEAN) - Whether birth year was provided (auto-set, indicates Privacy Mode Strict)
- `birthdayHidden` (BOOLEAN) - Profile birthday visibility toggle (default: false)

#### Profile Blocking
- `profileBlocked` (BOOLEAN) - Block profile viewing entirely (default: false)

#### Admin Message Count Tracking
- `messageCountSetBy` (STRING) - Discord ID of admin who set message count
- `messageCountSetAt` (DATE) - When admin set the count
- `messageCountStartDate` (DATE) - When message counting began for user
- `messagesSinceAdminSet` (INTEGER) - Messages sent since admin intervention

### Guild Model (`src/models/Guild.js`)

#### Core Guild Info
- `guildId` (STRING, PRIMARY KEY) - Discord guild ID
- `name` (STRING) - Guild name
- `ownerId` (STRING) - Guild owner Discord ID
- `memberCount` (INTEGER) - Current member count
- `icon` (STRING) - Guild icon hash

#### Bot Configuration
- `prefix` (STRING) - Command prefix (default: from env)
- `isActive` (BOOLEAN) - Whether bot is active in guild

#### Channel Settings
- `welcomeChannelId` (STRING) - Welcome message channel
- `modLogChannelId` (STRING) - Moderation log channel
- `birthdayChannelId` (STRING) - Birthday announcements channel

#### Role Settings
- `autoRole` (STRING) - Auto-assign role ID
- `birthdayWishesRoleId` (STRING) - Birthday mentions role

#### Messages & Time
- `welcomeMessage` (TEXT) - Custom welcome message
- `birthdayAnnouncementTime` (STRING) - Daily birthday time (HH:MM format, default: '09:00')

### Recommendation Model (`src/models/Recommendation.js`)

#### Core Fic Data
- `id` (INTEGER, AUTO_INCREMENT, PRIMARY KEY)
- `url` (TEXT, UNIQUE) - Fic URL
- `title` (TEXT) - Fic title
- `author` (STRING) - Author name
- `summary` (TEXT) - Fic summary/description

#### Fic Metadata
- `tags` (TEXT) - JSON array of site tags
- `additionalTags` (TEXT) - JSON array of user-added tags
- `rating` (STRING) - Content rating
- `wordCount` (INTEGER) - Word count
- `chapters` (STRING) - Chapter info (e.g., "5/?" or "12/12")
- `status` (STRING) - Completion status
- `language` (STRING) - Fic language (default: 'English')
- `category` (STRING) - Fic category

#### Dates & Stats
- `publishedDate` (DATEONLY) - When fic was published
- `updatedDate` (DATEONLY) - Last update date
- `kudos` (INTEGER) - AO3 kudos count
- `hits` (INTEGER) - AO3 hits count
- `bookmarks` (INTEGER) - AO3 bookmarks count
- `comments` (INTEGER) - AO3 comments count

#### Recommendation Tracking
- `recommendedBy` (STRING) - Discord ID of recommender
- `recommendedByUsername` (STRING) - Username of recommender
- `guildId` (STRING) - Guild where recommended
- `notes` (TEXT) - Additional notes about recommendation
- `deleted` (BOOLEAN) - Soft delete flag (default: false)
- `attachmentUrl` (STRING) - Attachment URL if any

## Button/Interaction Custom IDs

### Profile System Buttons

#### Main Profile Actions
- `profile_settings_${userId}` - Open profile settings menu
- `privacy_settings_${userId}` - Open privacy settings menu
- `profile_help` - Show profile help

#### Profile Settings Menu
- `set_birthday_${userId}` - Set birthday modal
- `set_bio_${userId}` - Set bio modal
- `set_timezone_${userId}` - Set timezone modal
- `set_pronouns_${userId}` - Set pronouns modal
- `timezone_display_${userId}` - Timezone display preferences
- `profile_settings_done` - Close profile settings

#### Privacy Settings
- `toggle_birthday_mentions` - Toggle birthday mentions
- `toggle_birthday_lists` - Toggle daily birthday list
- `toggle_privacy_mode_full` - Toggle Privacy Mode (Full) - hides ALL birthday info
- `toggle_privacy_mode_age_hidden` - Toggle Privacy Mode (Age Hidden) - hides only age
- `toggle_birthday_hidden` - Toggle profile birthday visibility
- `privacy_settings_done_${userId}` - Close privacy settings

#### Profile Help Navigation
- `profile_help_main` - Main help menu
- `profile_help_birthday` - Birthday help section
- `profile_help_bio` - Bio help section
- `profile_help_timezone` - Timezone help section
- `profile_help_pronouns` - Pronouns help section
- `profile_help_privacy` - Privacy help section
- `profile_help_tips` - Tips & tricks section
- `back_to_profile` - Return to profile view

### Modal Custom IDs
- `birthday_modal` - Birthday input modal
- `bio_modal` - Bio input modal
- `timezone_modal` - Timezone input modal
- `pronouns_modal` - Pronouns input modal

### Select Menu Custom IDs
- `timezone_display_select` - Timezone display preference dropdown

### Rec System Buttons (Planned)

#### Navigation
- `${baseId}_prev_${currentPage}` - Previous page
- `${baseId}_current_${currentPage}` - Current page indicator
- `${baseId}_next_${currentPage}` - Next page

#### Actions
- `rec_random_another` - Get another random recommendation
- `rec_similar_${recId}` - Find similar recommendations
- `rec_quick_update_${recId}` - Quick update recommendation

#### Filtering
- `search_filter_site` - Filter by site
- `search_filter_rating` - Filter by rating
- `search_filter_tag` - Filter by tag
- `search_clear_filters` - Clear all filters

## Privacy Mode System

### Privacy Mode Types
1. **Privacy Mode (Full)** - `birthdayAgePrivacy: true`
   - Hides: Age, birthday, Western zodiac, Chinese zodiac, ALL birthday info
   - Field: `birthdayAgePrivacy`

2. **Privacy Mode (Age Hidden)** - `birthdayAgeOnly: true`
   - Hides: Only the age field
   - Shows: Birthday, Western zodiac, Chinese zodiac
   - Field: `birthdayAgeOnly`

3. **Privacy Mode (Strict)** - `birthdayYearHidden: true`
   - Auto-enabled when birthday set without birth year
   - Locks Privacy Mode (Full) to ON
   - Locks Privacy Mode (Age Hidden) to ON
   - Field: `birthdayYearHidden`

### Privacy States Logic
- If `birthdayYearHidden === true`: User is in Privacy Mode (Strict)
  - `birthdayAgePrivacy` is locked to true
  - `birthdayAgeOnly` is locked to true
  - Cannot be changed unless birth year is provided
- If birth year provided: All privacy modes become toggleable

## Command Structure

### Slash Commands
- `/profile` - Main profile command
  - `view` subcommand - View user profile (default)
  - `help` subcommand - Show profile help
- `/rec` - Recommendation system command
- `/ping` - Bot status check
- `/test` - Development testing
- `/birthday-config` - Birthday system configuration
- `/birthday-notifications` - Birthday notification management
- `/admin-message-count` - Admin message count tools

## File Structure Reference

### Core Files
- `src/index.js` - Main bot entry point
- `src/events/` - Event handlers
  - `interactionCreate.js` - Main interaction dispatcher (57 lines)
  - `messageCreate.js` - Message handling
  - `ready.js` - Bot ready event
  - `guildCreate.js` - New guild handling

### Handlers (Modular Architecture)
- `src/handlers/`
  - `commandHandler.js` - Slash command processing
  - `buttonHandler.js` - Button interaction routing
  - `modalHandler.js` - Modal form processing
  - `selectMenuHandler.js` - Select menu handling
  - `buttons/` - Feature-specific button handlers
    - `profileButtons.js` - Profile system buttons
    - `navigationButtons.js` - Navigation buttons
    - `privacyButtons.js` - Privacy setting buttons
  - `modals/` - Modal processors
    - `birthdayModal.js` - Birthday form processing
    - `bioModal.js` - Bio form processing

### Utilities
- `src/utils/`
  - `profileCard.js` - Profile generation and display
  - `profileHelp.js` - Profile help system
  - `birthdayFormatter.js` - Birthday parsing and formatting
  - `birthdayNotifications.js` - Birthday notification system
  - `zodiacCalculator.js` - Zodiac sign calculations
  - `logger.js` - Logging utility
  - `rec/` - Recommendation system utilities
    - `config.js` - Rec system configuration
    - `validator.js` - URL and data validation
    - `embedBuilder.js` - Embed creation
    - `statistics.js` - Statistics generation
    - `pagination.js` - Pagination controls

### Backup & Safety
- `backup/events/interactionCreate_original.js` - Original 1,484-line file (preserved)

## Timezone Display Options

### `timezoneDisplay` Values
- `'iana'` - Full Name (e.g., America/New_York)
- `'offset'` - UTC Offset (e.g., UTC-5)
- `'short'` - Short Code (e.g., EST, PST)
- `'combined'` - Combined (e.g., (UTC-08:00) Pacific Time)
- `'hidden'` - Hidden (timezone won't show on profile)

## Environment Variables
- `BOT_TOKEN` - Discord bot token
- `COMMAND_PREFIX` - Default command prefix (default: '!')
- Database connection variables (SQLite for dev, PostgreSQL for prod)

## Common Patterns

### User ID Extraction from CustomId
```javascript
const targetUserId = interaction.customId.includes('_') ? 
    interaction.customId.split('_')[2] : interaction.user.id;
```

### Security Check for Profile Editing
```javascript
if (targetUserId !== interaction.user.id) {
    await interaction.reply({
        content: `**You can't edit someone else's profile!**\n\nTo edit your own profile, use:\n\`/profile\` - View and edit your profile\n\`/profile help\` - Learn about profile features`,
        ephemeral: true
    });
    return;
}
```

### Privacy Mode Checking
```javascript
const isPrivacyModeStrict = user.birthdayYearHidden === true;
const isPrivacyModeFull = user.birthdayAgePrivacy === true;
const isPrivacyModeAgeHidden = user.birthdayAgeOnly === true;
```
---

# AO3 Field Naming Reference

This section documents the normalization rules and mapping for AO3 metadata field labels as used in the parser.

## Field Normalization Rules
- All field labels are converted to lowercase.
- Leading and trailing whitespace is trimmed.
- Spaces and certain punctuation (colons, parentheses) are replaced with underscores.
- Multiple underscores are collapsed to a single underscore.
- Trailing and leading underscores are removed.

**Example:**
- `Archive Warnings` → `archive_warnings`
- `Relationship Tags` → `relationship_tags`
- `Characters` → `characters`
- `Category` → `category`
- `Fandom` → `fandom`
- `Additional Tags` → `additional_tags`
- `Published` → `published`
- `Word Count` → `word_count`

## Pluralization Handling
- The parser uses DOM traversal to match both singular and plural forms of AO3 field labels (e.g., `Relationship Tag` and `Relationship Tags`).
- Both forms are normalized to the same key (e.g., `relationship_tags`).

## Mapping Table (Common AO3 Fields)
| AO3 Field Label         | Normalized Key         |
|------------------------|-----------------------|
| Archive Warnings       | archive_warnings      |
| Category               | category              |
| Categories             | category              |
| Fandom                 | fandom                |
| Fandoms                | fandom                |
| Relationship           | relationship_tags     |
| Relationships          | relationship_tags     |
| Character              | character_tags        |
| Characters             | character_tags        |
| Additional Tags        | freeform_tags         |
| Language               | language              |
| Collections            | collections           |
| Published              | published             |
| Updated                | updated               |
| Completed              | completed             |
| Words                  | words                 |
| Word Count             | word_count            |
| Chapters               | chapters              |
| Comments               | comments              |
| Kudos                  | kudos                 |
| Bookmarks              | bookmarks             |
| Hits                   | hits                  |

---

_Last updated: 2025-11-12_