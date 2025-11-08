# PB Library Rec Search Feature – Planning Document

---
## Goals
- Search recommendations by title, author, tags, rating, summary, and more
- Paginated, styled embed results with navigation
- Fast, reliable, and extensible for future filters (warnings, date, etc.)
- Sambot in-character error handling and help text

## User Experience
- `/rec search [query] [filters]` as a slash command
- Options for title, author, tags, rating, etc.
- Results in paginated embeds (5 per page), with navigation buttons
- All member-facing text is Sammy style

## Technical Plan
### 1. Command & Handler
- Extend `/rec search` subcommand in `rec.js`
- Implement/extend `recHandlers/searchHandler.js` for main logic

### 2. Query Parsing
- Parse user input for search terms and filters
- Support partial/case-insensitive matches

### 3. Database Search
- Use Sequelize to filter recommendations by provided fields
- Support AND/OR logic for multiple filters

### 4. Pagination
- Paginate results (5 per page)
- Store current page and total results in interaction/session

### 5. Embed Generation
- Use `createRecommendationEmbed` for each result
- Add navigation buttons with standardized custom IDs

### 6. Error Handling & Help
- Sam message if no results
- Help button/command for search tips

### 7. Extensibility
- Modularize filter logic for easy addition of new fields
- Keep all member-facing text in Sam's voice

## File Structure
- `src/commands/rec.js` – Slash command routing
- `src/commands/rec/searchHandler.js` – Search logic and pagination
- `src/utils/recUtils/createRecommendationEmbed.js` – Embed builder
- `src/utils/recUtils/pagination.js` – Pagination helpers

## Next Steps
1. Audit or create `searchHandler.js` for modular search logic
2. Design slash command options for search
3. Implement query parsing and database filtering
4. Build paginated embed output and navigation
5. Test with various queries and edge cases

---

*Last updated: 2025-11-06*
