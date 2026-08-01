# Thread Goals

A goal pins an objective to a thread and tracks what the agent spends pursuing it — tokens and
working time — with an optional token budget. Goals work identically on Claude and Codex threads:
both providers feed the same accounting pipeline, so status behaves the same no matter which
model is doing the work.

## Setting a goal

Type `/goal` followed by the objective in the composer of a running thread:

```
/goal Ship the login fix --budget 50k
```

The optional `--budget` flag accepts plain numbers (`50000`), thousands (`50k`), or millions
(`1.5m`). Setting a new goal while one is active supersedes the old one; the superseded goal is
kept in thread history.

Once set, a goal card docks above the composer showing the objective, status, tokens used
(against the budget when one is set), and working time. Counters update live while the agent
works: Codex streams token usage as the turn runs, Claude settles authoritative totals as each
turn completes, and elapsed time ticks in real time whenever a turn is charging the goal.

## Controlling a goal

- `/goal pause` — suspend tracking. Paused wall time and tokens are not charged to the goal.
- `/goal resume` — resume tracking.
- `/goal done` — mark the objective complete.
- `/goal clear` — remove the goal from the card (history is preserved).
- `/goal` — with no arguments, points you at the current goal.

The same actions are available from the `…` menu on the goal card.

## Statuses

**Active**: tracking, with a pulse while a turn is running. **Paused**: tracking suspended.
**Blocked**: waiting on something outside the agent. **Usage limited**: the provider hit a rate
or usage limit; tracking continues. **Budget hit**: tokens used reached the budget; tracking
continues so you can see the overrun, and raising the budget or resuming returns it to active.
**Complete**: the objective was marked done.

Budget transitions are automatic: an active goal flips to **Budget hit** the moment usage
reaches the budget, and provider rate limits flip it to **Usage limited**.

## Display styles

The goal card ships in nine display styles — from a one-line ledger strip to a console readout,
ring gauge, segment bar, and status trail. Pick one from the card's `…` menu under **Display
style**; the choice is per device and applies immediately.

## What counts as usage

Tokens count everything the provider processed for the thread's turns while the goal was
tracking: fresh input, cache reads and writes, and output. Time counts only wall time inside
provider turns — idle time between your messages is never charged.
