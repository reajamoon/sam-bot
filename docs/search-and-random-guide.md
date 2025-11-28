# PB Library Search Guide
## Quick Start
- **Random fic:** `/rec random`
- **Search title:** `/rec search title:coffee shop`
- **Search author:** `/rec search author:mishacollins`
- **Search tags:** `/rec search tags:angst AND hurt/comfort`
## Search Commands
### `/rec search` - Find Specific Fics
- **Title:** `/rec search title:coffee shop`
- **Author:** `/rec search author:dean`
- **Summary:** `/rec search summary:apocalypse`
- **Rating:** `/rec search rating:explicit`
- **Tags:** See tag filtering below
### `/rec random` - Random Recommendations
- `/rec random` - completely random fic
- `/rec random tag:fluff` - random fluffy fic
- `/rec random allowwip:true` - include WIPs
- `/rec random risky:true` - include incomplete recs
## Tag Filtering
Works with all tag types: freeform, archive warnings, characters, fandoms, additional tags.
### Syntax
- **Single:** `hurt/comfort`
- **AND:** `angst AND hurt/comfort` (both required)
- **OR:** `fluff OR hurt/comfort` (either)
- **NOT:** `hurt/comfort NOT major character death` (exclude)
- **Combined:** `angst AND fluff NOT crack OR domestic`
### Smart Matching
- **AU Support:** `AU`, `Alternate Universe`, `Coffee Shop` all match `AU: Coffee Shop`
- **Bang Tags:** `hurt!dean` matches `hurt/comfort` tags
- **Variations:** System finds related tag variants automatically
### Examples
```
/rec search tags:hurt!dean AND protective!castiel NOT established relationship
/rec search tags:coffee shop OR bakery
/rec random tag:angst AND hurt/comfort NOT major character death
/rec search tags:castiel NOT graphic depictions of violence
```
## Advanced Features
### Multi-Field Search
```
/rec search title:coffee author:cas tags:fluff
/rec search author:dean rating:teen tags:high school AND first kiss
```
### Content Filters (random only)
- `allowwip:true` - include works in progress
- `allowdeleted:true` - include deleted fics
- `allowabandoned:true` - include abandoned fics
- `risky:true` - include *everything*
### Combined Examples
```
/rec random tag:fluff AND coffee shop risky:true allowdeleted:true
/rec random tag:hurt/comfort NOT angst rating:explicit allowwip:true
```
## Legacy Syntax (still works)
- **AND:** `angst+hurt/comfort` (use + symbol)
- **OR:** `fluff, hurt/comfort` (use comma)
- **NOT:** `hurt/comfort, -major character death` (use - symbol)
## Pro Tips
- **Be specific:** "bottom dean winchester" vs just "dean"
- **Try variations:** "coffee shop" vs "coffeeshop" vs "coffee shop au"
- **Start broad:** `/rec search tags:fluff` then narrow down
- **Use author search:** Many have distinctive styles
- **Random discovery:** `/rec random tag:your-mood` for surprises
## Common Searches
**Comfort fics:** `/rec search tags:hurt/comfort AND happy ending`
**AUs:** `/rec search tags:coffee shop OR high school OR modern`
**Angsty:** `/rec search tags:angst AND hurt/comfort rating:mature`
**Funny:** `/rec random tag:crack OR humor allowwip:true`
**By author:** `/rec search author:misha tags:fluff`
*Happy reading! ❤️*