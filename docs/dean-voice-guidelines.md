# Dean Voice Guidelines

These guidelines keep Dean’s in-character voice consistent across commands, help texts, and member-facing messages.

## Core Traits
- **Dry humor:** Sarcastic, teasing, playful; avoids mean-spirited tone.
- **Protective:** Prioritizes member comfort and safety; practical and direct.
- **Casual register:** Contractions, colloquialisms; slang and pop culture references.
- **Action-first:** Short, decisive phrasing; prefers quick steps over exposition.
- **Warm under the snark:** Encouraging when members need help.

## Style Rules
- **Avoid customer service tone:** Keep it personal and fandom-native.
- **Compact lines:** One thought per sentence when possible.
- **Second person:** Speak to the member directly: “you”, “your”.
- **Prefer contractions:** Use “you’re”, “don’t”, “can’t”, “it’s” wherever natural.
- **Casual slang (light):** “ya”, “gonna”, “wanna” when it reads natural.
 - **Punchy verbs:** Favor short encouragements like “Lock in.”, “Keep pace.”, “You’re cooking.”
 - **Endearments (light):** Drop quick asides mid-sentence when it fits: “You’ve got this, sweetheart.” Keep brief and kind.

## Phrasing Patterns
- **Acknowledge + nudge:** “Got it. Try this next.”
- **Warn + alternative:** “That won’t fly. Here’s the fix.”
- **Praise lightly:** “Nice pull. Let’s wrap it up.”
- **Empathy without mush:** “Yeah, that’s annoying. We’ll figure it out.”

## Formatting Conventions
- **Bot-local strings:** Keep Dean text under `src/bots/dean/`.
- **Shared helpers only:** Reuse formatting utils; don’t share raw text across bots.
- **Ephemerals:** Use `InteractionFlags.Ephemeral` (or `64`) where appropriate.
 - **Centralize copy:** Build embeds via helpers (e.g., `src/bots/dean/text/sprintText.js`).

## Examples
- Success: “Done. Your settings are locked. Need anything else?”
- Warning: “Heads up: this will overwrite your old data.”
- Help: “Short version: pick a tag, hit confirm.”
- Error: “Nope. That link’s busted. Drop a valid one.”
- Sprint end: “Nice work. Share your wordcount when you’re ready.”
- Sprint leave: “Catch ya next round.”
 - Sprint start (solo): “Timer’s set for 25 minutes.”
 - Sprint start (team): “Timer’s set for 25 minutes. Join with code ABC123.”
 - Midpoint: “Halfway there. You got this!”
 - Status (solo): “About 10 minutes left. You’re cooking.”
 - Status (team): “About 10 minutes left. 3 sprinters in. Keep pace.”
 - Encouragement: “Halfway there. You got this, sweetheart.”

## Do/Don’t
- **Do:** Keep jokes light, keep steps clear, keep members safe.
- **Don’t:** Lecture, over-explain, or use corporate euphemisms.

## Voice Consistency Checklist
- Is it concise and conversational?
- Does it feel like Dean: protective, sardonic, practical?
- Are contractions used where natural?
- Is slang light and natural?
- Does it follow ephemeral usage rules?
- Are strings scoped to Dean code paths?
 - Are encouragements punchy and brief (e.g., “Keep it rolling.”)?
 - If an endearment is used, is it short, warm, and non-patronizing?

*For broader architecture and shared conventions, see `docs/sam-voice-guidelines.md` and `.github/copilot-instructions.md`.*