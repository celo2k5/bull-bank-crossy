# $FROGGER Play 2 Earn

$FROGGER is a front-end play-to-earn arcade game. Players enter a Solana wallet, cross two roads, ride logs through two rivers, and compete for a creator reward pool.

## Gameplay

The board is a four-zone crossing course:

1. **Road I** - dodge moving traffic to reach the first grass checkpoint.
2. **River I** - hop only onto logs. Landing in open water ends the run.
3. **Road II** - cross a faster second traffic section.
4. **River II** - ride the last log section to reach the finish.

Logs carry the frog in the direction of the current, so the player must adjust position while riding. Reach the FROGGER FINISH zone to bank a point and restart at the bottom. Every two points increase the rush level, making traffic and river currents faster, shortening logs, and adding more traffic.

Controls:

- **WASD** or arrow keys on desktop
- Swipe on mobile

## Audio

The game includes synthesized hop, finish, and game-over sounds using the browser Web Audio API. Use the **SOUND ON / SOUND OFF** control above the board to toggle audio.

## Reward rules

At the end of a 45-second round, players with positive scores are ranked. Fixed rewards are calculated as:

| Place | Share |
| --- | ---: |
| First | 50% |
| Second | 30% |
| Third | 20% |

Missing placements stay unclaimed; they are not silently redistributed.

## Backend settlement handoff

The front end emits a `bullbank:round-complete` browser event at the end of each round. Its detail contains the round ID, winner wallets, exact payout amounts, and unclaimed amount. A trusted backend must independently validate gameplay and wallet eligibility, then sign any real Solana transfers.

## Local development

```bash
python -m http.server 8000
```

Open `http://localhost:8000`.
