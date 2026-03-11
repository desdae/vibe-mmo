# ITEM EQUIPMENT SYSTEM

## item slots 
  -  head, chest, shoulders, rings, necklace, trinkets, bracers, gloves, pants, belt, boot, off hand, main hand
## base items for each type tables
  - id, name, level range, slot (probably can be LLM generated for like each 5 level ranges for each slot) 
## item affix table 
  - id, name, min item level can appear on, [modifier array] (most likely min-max rollable ranges should scale with item level) (also need a sane way to describe what spell tags, damage schools etc it modifies, maybe even restrict to item types so weapons, rings e.g. have offensive, while most armor have defensive modifiers)
## item rarity defs
  - normal - just base affix
  - magic - 1-2 extra affixes
  - rare - 3-4 extra affixes
  - epic - 5-6 extra affixes
  - legendary - 7-8 extra affixes
  - mythic - 9-10 extra affixes
  - divine - 11-12 extra affixes
  each rarity tier has like 10x lower chance to drop than previous

