# $FROGGER Play 2 Earn

$FROGGER is a front-end play-to-earn arcade game. Players enter a Solana wallet, survive a dense road section, ride logs across the river, and compete for a creator reward pool.

## Gameplay

The board is a compact fixed crossing course:

1. **Road** - cross three increasingly fast traffic lanes.
2. **River** - hop only onto short moving logs. Landing in open water ends the run.
3. **Finish** - reach the final grass zone to bank a point.

Logs carry the frog in the direction of the current, so the player must adjust position while riding. Reach the FROGGER FINISH zone to bank a point and restart at the bottom. Every point increases the rush level, making traffic and river currents faster, shortening logs, and adding more traffic.

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
