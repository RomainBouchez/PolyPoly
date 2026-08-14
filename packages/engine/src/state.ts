import type { GameConfig } from '@polypoly/shared';
import { boardEurope } from './board.js';
import { createInitialDecks } from './deck.js';
import type { Rng } from './rng.js';
import { HEALTH_START } from './rules.js';
import type { GameState, Player, PlayerId } from './types.js';

export interface NewPlayerInfo {
  id: PlayerId;
  name: string;
  color: string;
}

export function createInitialState(config: GameConfig, playerInfos: NewPlayerInfo[], rng: Rng): GameState {
  if (playerInfos.length < 2) {
    throw new Error('Need at least 2 players to start a game');
  }

  const players: Record<PlayerId, Player> = {};
  for (const info of playerInfos) {
    players[info.id] = {
      id: info.id,
      name: info.name,
      color: info.color,
      cash: config.startingCash,
      position: 0,
      inJail: false,
      jailTurns: 0,
      getOutOfJailFreeCards: 0,
      status: 'active',
      health: HEALTH_START,
      pharmacyUsed: false,
    };
  }

  const turnOrder = playerInfos.map((info) => info.id);

  return {
    board: boardEurope,
    config,
    players,
    turnOrder,
    currentPlayerIndex: 0,
    ownership: {},
    phase: { type: 'awaiting-roll', playerId: turnOrder[0]! },
    doublesCount: 0,
    vacationPot: 0,
    turnNumber: 1,
    bank: { housesRemaining: 32, hotelsRemaining: 12 },
    decks: createInitialDecks(rng),
    heldJailCards: [],
    pendingTrades: [],
    nextTradeId: 1,
  };
}
