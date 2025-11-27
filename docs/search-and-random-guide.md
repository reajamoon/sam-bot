# How to Search & Browse the PB Library

*A user-friendly guide to finding your next favorite fic*

## Quick Start

- **Random fic:** `/rec random`
- **Search by title:** `/rec search title:coffee shop`
- **Search by author:** `/rec search author:mishacollins`
- **Search by tags:** `/rec search tags:angst AND hurt/comfort`

---

## `/rec search` - Find Specific Fics

Search the library using any combination of these fields:

### Basic Searches
- **Title:** `/rec search title:coffee shop` - finds fics with "coffee shop" in the title
- **Author:** `/rec search author:dean` - finds fics by authors with "dean" in their name
- **Summary:** `/rec search summary:apocalypse` - finds fics mentioning "apocalypse" in the summary
- **Rating:** `/rec search rating:explicit` - finds explicit fics

## Advanced Tag Filtering

Both commands support sophisticated tag filtering using AND/OR/NOT logic across **all tag types**:

**Tag Types Searched:**
- **Freeform tags** (relationships, tropes, themes)
- **Archive warnings** (Major Character Death, Graphic Violence, etc.)
- **Character tags** (Dean Winchester, Sam Winchester, etc.) 
- **Fandom tags** (Supernatural, SPN RPF, etc.)
- **Additional tags** (user-added custom tags)

### Modern Syntax
- **Single tags**: `hurt/comfort` (finds any fic with hurt/comfort)
- **AND logic**: `angst AND hurt/comfort` (finds fics that have both tags)
- **OR logic**: `fluff OR hurt/comfort` (finds fics that have either tag)
- **NOT logic**: `hurt/comfort NOT major character death` (finds hurt/comfort fics without major character death)
- **Combined**: `angst AND hurt/comfort NOT major character death OR domestic fluff` (finds fics with both angst+hurt/comfort but no MCD, OR domestic fluff)

### Legacy Syntax (still supported)
- **Single tags**: `hurt/comfort`
- **AND logic**: `angst+hurt/comfort` (using + symbol)
- **OR logic**: `fluff, hurt/comfort` (using comma)
- **NOT logic**: `hurt/comfort, -major character death` (using - symbol for exclusion)

### Examples
```
/rec search tags: angst AND hurt/comfort NOT major character death
/rec search tags: fluff OR humor NOT crack
/rec search tags: canon divergence AND bottom dean NOT top sam
/rec random tags: hurt/comfort NOT angst, domestic fluff
/rec search tags: dean winchester AND sam winchester NOT wincest
/rec search tags: major character death AND happy ending  // archive warning + tag
/rec search tags: castiel NOT graphic depictions of violence  // character + archive warning
```

### Combine Different Fields
You can search multiple fields at once:
- `/rec search title:coffee author:cas tags:fluff` - coffee shop fics by authors named "cas" tagged with fluff
- `/rec search author:dean rating:teen tags:high school AND first kiss` - teen-rated high school first kiss fics by "dean" authors

---

## `/rec random` - Discover New Fics

Get a surprise recommendation with optional filtering:

### Basic Random
- `/rec random` - completely random fic from the library

### Filter by Tags
Use the same powerful tag syntax as search:
**Tag filtering:**
- `/rec random tag:fluff` - random fluffy fic
- `/rec random tag:case fic AND hurt/comfort` - random case fic with hurt/comfort
- `/rec random tag:coffee shop OR bakery` - random AU in food service settings
- `/rec random tag:hurt/comfort NOT major character death` - random hurt/comfort without MCD

### Content Filters
Control what types of fics you get:
- `/rec random allowwip:true` - include works in progress
- `/rec random allowdeleted:true` - include fics that were deleted/removed
- `/rec random allowabandoned:true` - include abandoned/hiatus fics
- `/rec random risky:true` - include all fics, even incomplete recommendations

**Combining filters:**
- `/rec random tag:angst allowwip:true` - random angsty fic, including WIPs
- `/rec random tag:fluff AND coffee shop risky:true allowdeleted:true` - random coffee shop fluff, including risky or deleted fics
- `/rec random tag:hurt/comfort NOT angst rating:explicit` - random explicit hurt/comfort without angst

---

## Pro Tips

### Tag Searching
- **Be specific:** "bottom dean winchester" vs just "dean"
- **Use quotes:** Not needed! Just type the tags normally
- **Mix and match:** `hurt!dean AND protective!cas OR hurt!cas AND protective!dean`
- **Try variations:** "coffee shop" vs "coffeeshop" vs "coffee shop au"

### Finding What You Want
- **Start broad:** Try `/rec search tags:fluff` then narrow down
- **Use author names:** Many authors have distinctive writing styles
- **Browse by rating:** Filter by explicit, teen, mature, etc.
- **Try random with filters:** Great way to discover new favorites

### Legacy Syntax
Old-style searches still work if you prefer them:
- `angst+hurt/comfort, fluff` (same as `angst AND hurt/comfort OR fluff`)
- But the new AND/OR syntax is much clearer!

---

## Examples

**Finding comfort fics:**
- `/rec search tags:hurt/comfort AND happy ending`
- `/rec random tag:fluff AND domestic`

**Exploring AUs:**
- `/rec search tags:coffee shop OR bakery OR bookstore`
- `/rec random tag:high school AU OR college AU`

**Mood-based searching:**
- `/rec search tags:angst AND hurt/comfort rating:mature` - heavy emotional fics
- `/rec random tag:crack OR humor allowwip:true` - funny fics including WIPs

**Author exploration:**
- `/rec search author:mishacollins tags:fluff` - fluffy fics by mishacollins-type authors
- `/rec search author:dean title:coffee` - coffee-themed fics by dean-type authors

---

*Happy reading! If you find a fic you love, don't forget to leave kudos and comments for the author! ❤️*