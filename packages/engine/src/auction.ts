import { IllegalActionError } from './errors.js';
import { activePlayerIds } from './endCondition.js';
import type { GameState, PlayerId } from './types.js';

export interface AuctionPhaseData {
  type: 'auction';
  tileIndex: number;
  order: PlayerId[];
  passed: PlayerId[];
  highBid: number;
  highBidderId: PlayerId | null;
  turnPlayerId: PlayerId;
  resumePlayerId: PlayerId;
}

export interface AuctionResult {
  tileIndex: number;
  winnerId: PlayerId | null;
  amount: number;
  resumePlayerId: PlayerId;
}

export function startAuction(state: GameState, tileIndex: number, resumePlayerId: PlayerId): AuctionPhaseData {
  const active = activePlayerIds(state);
  const startIdx = active.indexOf(resumePlayerId);
  const order = [...active.slice(startIdx + 1), ...active.slice(0, startIdx + 1)];
  return {
    type: 'auction',
    tileIndex,
    order,
    passed: [],
    highBid: 0,
    highBidderId: null,
    turnPlayerId: order[0]!,
    resumePlayerId,
  };
}

function remaining(phase: AuctionPhaseData): PlayerId[] {
  return phase.order.filter((id) => !phase.passed.includes(id));
}

function nextAfter(phase: AuctionPhaseData, playerId: PlayerId): PlayerId | null {
  const still = remaining(phase);
  const idx = phase.order.indexOf(playerId);
  for (let i = 1; i <= phase.order.length; i++) {
    const candidate = phase.order[(idx + i) % phase.order.length]!;
    if (still.includes(candidate)) return candidate;
  }
  return null;
}

function closeResult(phase: AuctionPhaseData): AuctionResult {
  return {
    tileIndex: phase.tileIndex,
    winnerId: phase.highBidderId,
    amount: phase.highBid,
    resumePlayerId: phase.resumePlayerId,
  };
}

export function recordBid(draft: GameState, playerId: PlayerId, amount: number): AuctionResult | null {
  const phase = draft.phase;
  if (phase.type !== 'auction') throw new IllegalActionError('No auction in progress');
  if (phase.turnPlayerId !== playerId) throw new IllegalActionError('Not your turn to bid');
  if (amount <= phase.highBid) throw new IllegalActionError('Bid must be higher than the current bid');
  const player = draft.players[playerId]!;
  if (player.cash < amount) throw new IllegalActionError('Not enough cash for that bid');

  phase.highBid = amount;
  phase.highBidderId = playerId;

  if (remaining(phase).length <= 1) return closeResult(phase);
  const next = nextAfter(phase, playerId);
  if (!next) return closeResult(phase);
  phase.turnPlayerId = next;
  return null;
}

export function recordPass(draft: GameState, playerId: PlayerId): AuctionResult | null {
  const phase = draft.phase;
  if (phase.type !== 'auction') throw new IllegalActionError('No auction in progress');
  if (phase.turnPlayerId !== playerId) throw new IllegalActionError('Not your turn to act in the auction');

  phase.passed.push(playerId);
  if (remaining(phase).length <= 1) return closeResult(phase);
  const next = nextAfter(phase, playerId);
  if (!next) return closeResult(phase);
  phase.turnPlayerId = next;
  return null;
}
