// The match: the one place the game's state lives. Phases run buy (15 s, the
// buy menu is open) -> live (100 s) -> end (4 s, the banner) -> the next
// round, first to 5 rounds takes the match. Money follows the Counter-Strike
// shape: $300 a kill, $3250 for a round win, $1900 for a loss plus $500 per
// consecutive loss, capped at $3400. The kill feed and the round log live here
// too, so the HUD only reads.
export const BUY_SECONDS = 15;
export const ROUND_SECONDS = 100;
export const END_SECONDS = 4;
export const ROUNDS_TO_WIN = 5;
export const START_MONEY = 800;
export const KILL_REWARD = 300;
export const WIN_REWARD = 3250;
export const LOSS_REWARD = 1900;
export const LOSS_BONUS_STEP = 500;
export const LOSS_BONUS_MAX = 3400;

export function createMatch() {
  const state = {
    phase: 'buy', // buy | live | end | matchEnd
    phaseTime: BUY_SECONDS,
    round: 1,
    score: { attackers: 0, defenders: 0 },
    losses: { attackers: 0, defenders: 0 },
    roundWinner: null,
    roundReason: '',
    matchWinner: null,
    killFeed: [], // {killer, victim, headshot, time, killerTeam}
    log: [],
  };

  function aliveCount(fighters, team) {
    let count = 0;
    for (const fighter of fighters) {
      if (fighter.team === team && fighter.alive) count += 1;
    }
    return count;
  }

  return {
    state,
    startRound() {
      state.phase = 'buy';
      state.phaseTime = BUY_SECONDS;
      state.roundWinner = null;
      state.roundReason = '';
    },
    startLive() {
      state.phase = 'live';
      state.phaseTime = ROUND_SECONDS;
    },
    addKill(killer, victim, headshot, now) {
      state.killFeed.unshift({
        killer: killer.name,
        victim: victim.name,
        headshot,
        killerTeam: killer.team,
        time: now,
      });
      if (state.killFeed.length > 5) state.killFeed.pop();
      killer.kills += 1;
      killer.money += KILL_REWARD;
      victim.deaths += 1;
    },
    endRound(winner, reason, fighters) {
      state.phase = 'end';
      state.phaseTime = END_SECONDS;
      state.roundWinner = winner;
      state.roundReason = reason;
      state.score[winner] += 1;
      const loser = winner === 'attackers' ? 'defenders' : 'attackers';
      state.losses[loser] += 1;
      state.losses[winner] = 0;
      const lossPay = Math.min(LOSS_BONUS_MAX, LOSS_REWARD + LOSS_BONUS_STEP * (state.losses[loser] - 1));
      for (const fighter of fighters) {
        fighter.money += fighter.team === winner ? WIN_REWARD : lossPay;
      }
      state.log.push(`Round ${state.round}: ${winner} win — ${reason}`);
      if (state.score[winner] >= ROUNDS_TO_WIN) {
        state.matchWinner = winner;
      }
    },
    nextRound() {
      state.round += 1;
      this.startRound();
    },
    finishMatch() {
      state.phase = 'matchEnd';
      state.phaseTime = 0;
    },
    // Check the round's end conditions during live play. Returns the winner
    // and reason when the round is over, else null.
    checkEnd(fighters, bombMode) {
      if (state.phase !== 'live') return null;
      const attackersAlive = aliveCount(fighters, 'attackers');
      const defendersAlive = aliveCount(fighters, 'defenders');
      if (bombMode === 'detonated') return { winner: 'attackers', reason: 'Device detonated' };
      if (bombMode === 'defused') return { winner: 'defenders', reason: 'Device defused' };
      if (defendersAlive === 0) return { winner: 'attackers', reason: 'Wardens eliminated' };
      if (attackersAlive === 0 && bombMode !== 'planted') {
        return { winner: 'defenders', reason: 'Vipers eliminated' };
      }
      if (attackersAlive === 0 && bombMode === 'planted') return null; // defenders must still defuse
      if (state.phaseTime <= 0) return { winner: 'defenders', reason: 'Time expired' };
      return null;
    },
  };
}
