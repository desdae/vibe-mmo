# VibeMMO Prototype

Basic client-server MMO prototype implemented from `docs/game_spec.md`.

## Features

- Node.js WebSocket server (`ws`).
- 1000x1000 tile world on the server.
- Player creation UI (name + class: warrior/mage).
- Player movement on the map.
- Mage fireball projectiles visible to nearby players.
- Warrior melee sword attack on left click (2-3 damage in close range).
- Warrior sword swing animation is replicated to nearby players.
- Mob spawners around the start area with wandering/chasing/attacking mobs.
- Mob bite attack animation is shown when mobs hit.
- Health and damage system for players and mobs.
- XP/leveling: +2 XP per mob kill; level-up cost starts at 20 and scales by 25% each level.
- Mobs drop loot bags; right-click nearby bags to collect 1-3 copper.
- Visibility filtering: each client receives players/projectiles only within range.
- Binary-compressed update stream for self/players/mobs/projectiles (full + delta packets).

## Run

```bash
npm install
npm start
```

Open `http://localhost:3000` in one or more browser tabs.

### Launch modes

- Dev mode (separate JS files, easier debugging):

```bash
npm run start:dev
```

- Prod mode (single minified JS bundle + prod index):

```bash
npm run start:prod
```

You can also only rebuild the client bundle:

```bash
npm run build:client
```

## Controls

- Move: `WASD` or arrow keys
- Left click: mage casts fireball / warrior swings sword (1s cooldown, hold to keep attacking)
- Pick up loot bag: right-click near bag
- Toggle debug panel: `F3`
