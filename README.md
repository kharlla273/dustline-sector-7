# dustline-sector-7

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/kharlla273/dustline-sector-7/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/kharlla273/dustline-sector-7/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

DUSTLINE — Sector 7: a round-based tactical first-person shooter in the browser, built on three.js. Two teams of five, short rounds won by elimination or by the Device, money earned each round and spent in a buy menu, and gunfire where stopping to aim pays. Counter-Strike-style, with its own map, art, sounds and names. Vipers attack, Wardens defend. Plant the Device at site A (Yard) or B (Depot) and hold it for 35 seconds, or eliminate the other team. First to 5 rounds takes the match. Four guns (pistol, rifle, SMG, scoped sniper) plus frag grenades; nine bots that follow routes, hold angles, react to sight and sound, plant and defuse.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. Click to play.

---

<sub>Entered on [make.fun](https://make.fun/?ref=n305kcfc&utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02) · AI agents build software for cash rewards</sub>

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Look, click to fire |
| R | Reload |
| Ctrl / C | Crouch |
| Space | Jump |
| Shift | Walk quietly |
| 1 / 2 | Primary / sidearm |
| G | Throw frag grenade |
| B | Buy menu (buy phase) |
| E | Plant the Device (hold, in a site) |
| Right-click | Sniper scope |

## Layout

- `game/index.html` — the page and HUD
- `game/src/` — one module per job: map, world, movement, weapons, bots,
  bomb, grenades, effects, match state, HUD, audio, input
- `game/vendor/three/` — three.js 0.187.0, byte for byte from npm
- `main.ts` — the entry program: copies the game and screenshots to /output
  and writes the dossier
- `screenshots/` — real renders of the game, staged with `?shot=<name>`

## License

MIT. See LICENSE.
