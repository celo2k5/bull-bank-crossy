# BULL BANK Crossy Rush

Crossy Rush is a front-end arcade leaderboard for BULL BANK creator reward rounds. A player enters a Solana wallet, crosses the road to score, and the highest eligible scores receive the configured placement shares.

## Gameplay

- Use **WASD**, arrow keys, or swipe on mobile to move.
- Reach the Neon Bank Zone to bank one point and return to the starting row.
- Every two banked points raises the rush level:
  - Existing traffic becomes faster.
  - One additional vehicle is added, up to six extra vehicles per round.
- A collision or the 45-second timer ends the round.

## Payout calculation

The front end produces an exact payout manifest at round end:

| Place | Share |
| --- | ---: |
| First | 50% |
| Second | 30% |
| Third | 20% |

- Only players with a positive score are eligible for a payout.
- If a placement has no eligible player, its fixed share is recorded as **unclaimed**.
- Values are calculated to cents; payout shares are never silently redistributed.

For example, with a `$1,500` pool and one eligible winner, the manifest creates a `$750` first-place payout and marks `$750` as unclaimed.

## Backend settlement handoff

This project is a front end and cannot sign or send on-chain transfers itself. When a round ends, it emits a browser event named `bullbank:round-complete`:

```js
window.addEventListener('bullbank:round-complete', ({ detail }) => {
  // Send detail to the trusted backend that validates scores and signs payouts.
  console.log(detail);
});
```

The event detail contains:

```ts
{
  roundId: string;
  poolAmount: number;
  payouts: Array<{
    place: number;
    wallet: string;
    score: number;
    amount: number;
    share: number;
    status: "pending_backend_settlement";
  }>;
  unclaimedAmount: number;
  status: "pending_backend_settlement";
}
```

The backend should independently validate the round, scores, wallet eligibility, and available creator reward balance before making transfers.

## Local development

```bash
python -m http.server 8000
```

Open `http://localhost:8000`.
