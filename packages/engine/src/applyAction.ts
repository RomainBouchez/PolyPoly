import { auctionEligiblePlayerIds, recordBid, recordPass, startAuction, type AuctionResult } from './auction.js';
import { boardSize, getOwnableTile, getTile, hospitalTiles, jailTileIndex } from './board.js';
import { bankrupt, chargePlayer, settleDebt } from './debt.js';
import { drawCard, findCardById } from './deck.js';
import { checkLastStanding, checkTurnLimit, checkTimeLimit } from './endCondition.js';
import { IllegalActionError } from './errors.js';
import { buildHouse, sellHouse } from './houses.js';
import { mortgageProperty, unmortgageProperty } from './mortgage.js';
import type { Rng } from './rng.js';
import {
  ALLIANCE_DURATION_TURNS,
  ALLIANCE_RENT_MULTIPLIER,
  EMERGENCY_FINE,
  EMERGENCY_HEALTH_THRESHOLD,
  GO_HEALTH_BONUS,
  GO_SALARY,
  HEALTH_MAX,
  HEALTH_SICK_THRESHOLD,
  HOSPITAL_PAYOUT,
  ILLNESS_PENALTY,
  ILLNESS_PENALTY_DOUBLE,
  JAIL_FINE,
  MAX_JAIL_TURNS,
  PHARMACY_RESET_HEALTH,
  SUNNY_DAY_DURATION_MIN,
  SUNNY_DAY_DURATION_MAX,
  computeRent,
  isAllied,
} from './rules.js';
import { executeTrade, findTrade, validateTrade } from './trade.js';
import type { GameAction, GameEvent, GameState, PlayerId, TradeOffer } from './types.js';

export function applyAction(
  state: GameState,
  action: GameAction,
  rng: Rng,
): { state: GameState; events: GameEvent[] } {
  if (state.phase.type === 'game-over') throw new IllegalActionError('The game has ended');

  const draft = structuredClone(state);
  const events: GameEvent[] = [];

  switch (action.type) {
    case 'roll':
      handleRoll(draft, action.playerId, rng, events);
      break;
    case 'buy':
      handleBuy(draft, action.playerId, events);
      break;
    case 'decline-purchase':
      handleDeclinePurchase(draft, action.playerId, events);
      break;
    case 'pay-jail-fine':
      handlePayJailFine(draft, action.playerId, events);
      break;
    case 'roll-for-jail':
      handleRollForJail(draft, action.playerId, rng, events);
      break;
    case 'use-jail-card':
      handleUseJailCard(draft, action.playerId, events);
      break;
    case 'build-house': {
      const houses = buildHouse(draft, action.playerId, action.tileIndex);
      events.push({ type: 'house-built', playerId: action.playerId, tileIndex: action.tileIndex, houses });
      break;
    }
    case 'sell-house': {
      const houses = sellHouse(draft, action.playerId, action.tileIndex);
      events.push({ type: 'house-sold', playerId: action.playerId, tileIndex: action.tileIndex, houses });
      break;
    }
    case 'mortgage': {
      const amount = mortgageProperty(draft, action.playerId, action.tileIndex);
      events.push({ type: 'mortgaged', playerId: action.playerId, tileIndex: action.tileIndex, amount });
      break;
    }
    case 'unmortgage': {
      const amount = unmortgageProperty(draft, action.playerId, action.tileIndex);
      events.push({ type: 'unmortgaged', playerId: action.playerId, tileIndex: action.tileIndex, amount });
      break;
    }
    case 'auction-bid': {
      const result = recordBid(draft, action.playerId, action.amount);
      events.push({ type: 'auction-bid', playerId: action.playerId, amount: action.amount });
      if (result) finalizeAuction(draft, result, events);
      break;
    }
    case 'auction-pass': {
      const result = recordPass(draft, action.playerId);
      events.push({ type: 'auction-passed', playerId: action.playerId });
      if (result) finalizeAuction(draft, result, events);
      break;
    }
    case 'propose-trade': {
      const trade: TradeOffer = {
        id: draft.nextTradeId++,
        fromId: action.playerId,
        toId: action.toId,
        fromCash: action.fromCash,
        toCash: action.toCash,
        fromProperties: action.fromProperties,
        toProperties: action.toProperties,
        fromJailCards: action.fromJailCards,
        toJailCards: action.toJailCards,
      };
      validateTrade(draft, trade);
      draft.pendingTrades.push(trade);
      events.push({ type: 'trade-proposed', tradeId: trade.id, fromId: trade.fromId, toId: trade.toId });
      break;
    }
    case 'respond-trade': {
      const trade = findTrade(draft, action.tradeId);
      if (trade.toId !== action.playerId) throw new IllegalActionError('Not your trade to respond to');
      draft.pendingTrades = draft.pendingTrades.filter((t) => t.id !== action.tradeId);
      if (action.accept) {
        validateTrade(draft, trade);
        executeTrade(draft, trade);
        events.push({ type: 'trade-accepted', tradeId: trade.id });
      } else {
        events.push({ type: 'trade-declined', tradeId: trade.id });
      }
      break;
    }
    case 'cancel-trade': {
      const trade = findTrade(draft, action.tradeId);
      if (trade.fromId !== action.playerId) throw new IllegalActionError('Not your trade to cancel');
      draft.pendingTrades = draft.pendingTrades.filter((t) => t.id !== action.tradeId);
      events.push({ type: 'trade-cancelled', tradeId: trade.id });
      break;
    }
    case 'pay-debt':
      settleDebt(draft, action.playerId, events);
      resolveEndOfMove(draft, action.playerId, events);
      break;
    case 'use-squat-on':
      handleUseSquatOn(draft, action.playerId, action.tileIndex, events);
      break;
    case 'skip-squat':
      handleSkipSquat(draft, action.playerId, events);
      break;
    case 'declare-bankruptcy':
      bankrupt(draft, action.playerId, events);
      finishTurn(draft, events);
      break;
    case 'check-time-limit':
      checkTimeLimit(draft, action.elapsedMinutes, events);
      break;
    case 'transfer-health':
      handleTransferHealth(draft, action.playerId, action.toId, action.amount, events);
      break;
    case 'take-hostage':
      handleTakeHostage(draft, action.playerId, action.tileIndex, events);
      break;
  }

  return { state: draft, events };
}

function handleRoll(draft: GameState, playerId: PlayerId, rng: Rng, events: GameEvent[]): void {
  requirePhase(draft, 'awaiting-roll', playerId);
  const player = requirePlayer(draft, playerId);
  if (player.inJail) throw new IllegalActionError('You are in jail — pay the fine or try to roll doubles');

  const d1 = rng.nextInt(6);
  const d2 = rng.nextInt(6);
  const isDouble = d1 === d2;
  events.push({ type: 'rolled', playerId, dice: [d1, d2] });

  if (draft.config.healthMode && d1 === 1 && d2 === 1) {
    triggerIllness(draft, playerId, events);
  }

  draft.doublesCount = isDouble ? draft.doublesCount + 1 : 0;

  if (draft.doublesCount === 3) {
    draft.doublesCount = 0;
    sendToJail(draft, playerId, 'three-doubles', events);
    finishTurn(draft, events);
    return;
  }

  movePlayer(draft, playerId, d1 + d2, events);
  resolveTile(draft, playerId, player.position, d1 + d2, rng, events);
}

function handleBuy(draft: GameState, playerId: PlayerId, events: GameEvent[]): void {
  const phase = requirePhase(draft, 'awaiting-purchase', playerId);
  const tileIndex = phase.tileIndex;
  const tile = getOwnableTile(draft.board, tileIndex);
  const player = requirePlayer(draft, playerId);
  if (player.cash < tile.price) throw new IllegalActionError('Not enough cash to buy this property');

  player.cash -= tile.price;
  draft.ownership[tileIndex] = { ownerId: playerId, houses: 0, mortgaged: false };
  events.push({ type: 'purchased', playerId, tileIndex, price: tile.price });
  resolveEndOfMove(draft, playerId, events);
}

function handleDeclinePurchase(draft: GameState, playerId: PlayerId, events: GameEvent[]): void {
  const phase = requirePhase(draft, 'awaiting-purchase', playerId);
  events.push({ type: 'declined-purchase', playerId, tileIndex: phase.tileIndex });

  if (draft.config.auction && auctionEligiblePlayerIds(draft).some((id) => id !== playerId)) {
    draft.phase = startAuction(draft, phase.tileIndex, playerId);
    events.push({ type: 'auction-started', tileIndex: phase.tileIndex });
    return;
  }
  if (draft.config.auction) events.push({ type: 'auction-no-sale', tileIndex: phase.tileIndex });
  resolveEndOfMove(draft, playerId, events);
}

function finalizeAuction(draft: GameState, result: AuctionResult, events: GameEvent[]): void {
  if (result.winnerId) {
    draft.players[result.winnerId]!.cash -= result.amount;
    draft.ownership[result.tileIndex] = { ownerId: result.winnerId, houses: 0, mortgaged: false };
    events.push({ type: 'auction-won', playerId: result.winnerId, tileIndex: result.tileIndex, amount: result.amount });
  } else {
    events.push({ type: 'auction-no-sale', tileIndex: result.tileIndex });
  }
  resolveEndOfMove(draft, result.resumePlayerId, events);
}

/** Picks the target property for one of `playerId`'s still-undecided Squat
 *  passes — the free stay applies automatically whenever they later land on
 *  that exact tile (see the rent-charging branch in resolveTile). */
function handleUseSquatOn(draft: GameState, playerId: PlayerId, tileIndex: number, events: GameEvent[]): void {
  const player = requirePlayer(draft, playerId);
  if (!draft.config.squatCards) throw new IllegalActionError('Squat cards are disabled');
  if (draft.config.healthMode && player.health <= HEALTH_SICK_THRESHOLD) {
    throw new IllegalActionError('Too sick to squat right now');
  }

  const ownership = draft.ownership[tileIndex];
  if (!ownership) throw new IllegalActionError('That tile is not owned');
  if (ownership.ownerId === playerId) throw new IllegalActionError('You already own that property');
  if (ownership.mortgaged) throw new IllegalActionError('That property is mortgaged');
  if (player.squattedPlayerIds.includes(ownership.ownerId)) throw new IllegalActionError('You already squatted this player');

  const held = draft.heldSquatCards.find(
    (h) => h.playerId === playerId && h.targetTileIndex === undefined && h.buildingLevel === ownership.houses,
  );
  if (!held) throw new IllegalActionError('No matching Squat pass for that property');

  held.targetTileIndex = tileIndex;
  player.squattedPlayerIds.push(ownership.ownerId);
  events.push({ type: 'squat-target-chosen', playerId, targetId: ownership.ownerId, tileIndex });
}

function handleSkipSquat(draft: GameState, playerId: PlayerId, events: GameEvent[]): void {
  const heldIdx = draft.heldSquatCards.findIndex((h) => h.playerId === playerId && h.targetTileIndex === undefined);
  if (heldIdx === -1) throw new IllegalActionError('No Squat pass to skip');

  const [held] = draft.heldSquatCards.splice(heldIdx, 1);
  draft.decks[held!.deck].discardPile.push(findCardById(held!.cardId));
  events.push({ type: 'squat-skipped', playerId });
}

function handlePayJailFine(draft: GameState, playerId: PlayerId, events: GameEvent[]): void {
  requirePhase(draft, 'awaiting-jail-decision', playerId);
  const player = requirePlayer(draft, playerId);
  if (player.cash < JAIL_FINE) throw new IllegalActionError('Not enough cash to pay the jail fine');

  player.cash -= JAIL_FINE;
  player.inJail = false;
  player.jailTurns = 0;
  events.push({ type: 'released-from-jail', playerId, method: 'paid-fine' });
  releaseHostageIfHeldBy(draft, playerId, events);
  draft.phase = { type: 'awaiting-roll', playerId };
}

function handleUseJailCard(draft: GameState, playerId: PlayerId, events: GameEvent[]): void {
  requirePhase(draft, 'awaiting-jail-decision', playerId);
  const player = requirePlayer(draft, playerId);
  const heldIdx = draft.heldJailCards.findIndex((h) => h.playerId === playerId);
  if (player.getOutOfJailFreeCards <= 0 || heldIdx === -1) {
    throw new IllegalActionError('No Get Out of Jail Free card to use');
  }

  const [held] = draft.heldJailCards.splice(heldIdx, 1);
  player.getOutOfJailFreeCards -= 1;
  draft.decks[held!.deck].discardPile.push(findCardById(held!.cardId));
  player.inJail = false;
  player.jailTurns = 0;
  events.push({ type: 'released-from-jail', playerId, method: 'jail-card' });
  releaseHostageIfHeldBy(draft, playerId, events);
  draft.phase = { type: 'awaiting-roll', playerId };
}

function handleRollForJail(draft: GameState, playerId: PlayerId, rng: Rng, events: GameEvent[]): void {
  requirePhase(draft, 'awaiting-jail-decision', playerId);
  const player = requirePlayer(draft, playerId);

  const d1 = rng.nextInt(6);
  const d2 = rng.nextInt(6);
  const isDouble = d1 === d2;
  events.push({ type: 'rolled', playerId, dice: [d1, d2] });

  if (!isDouble) {
    player.jailTurns += 1;
    if (player.jailTurns >= MAX_JAIL_TURNS) {
      if (player.cash >= JAIL_FINE) player.cash -= JAIL_FINE;
      player.inJail = false;
      player.jailTurns = 0;
      events.push({ type: 'released-from-jail', playerId, method: 'max-turns' });
      releaseHostageIfHeldBy(draft, playerId, events);
    } else {
      events.push({ type: 'stayed-in-jail', playerId });
    }
    finishTurn(draft, events);
    return;
  }

  player.inJail = false;
  player.jailTurns = 0;
  draft.doublesCount = 0; // escaping jail on a double does not earn a bonus roll
  events.push({ type: 'released-from-jail', playerId, method: 'rolled-doubles' });
  releaseHostageIfHeldBy(draft, playerId, events);
  movePlayer(draft, playerId, d1 + d2, events);
  resolveTile(draft, playerId, player.position, d1 + d2, rng, events);
}

function movePlayer(draft: GameState, playerId: PlayerId, steps: number, events: GameEvent[]): void {
  const player = requirePlayer(draft, playerId);
  const from = player.position;
  const to = (from + steps) % boardSize(draft.board);
  const passedGo = to < from;
  player.position = to;
  events.push({ type: 'moved', playerId, from, to, passedGo });
  if (passedGo) {
    const isSick = draft.config.healthMode && player.health <= HEALTH_SICK_THRESHOLD;
    if (!isSick) {
      player.cash += GO_SALARY;
      events.push({ type: 'collected-go', playerId, amount: GO_SALARY });
    }
    if (draft.config.healthMode) {
      player.health = Math.min(HEALTH_MAX, player.health + GO_HEALTH_BONUS);
    }
  }
}

function resolveTile(
  draft: GameState,
  playerId: PlayerId,
  tileIndex: number,
  diceSum: number,
  rng: Rng,
  events: GameEvent[],
): void {
  const tile = getTile(draft.board, tileIndex);
  const player = requirePlayer(draft, playerId);

  // Health effects fire on landing regardless of ownership/purchase outcome —
  // "achetable normalement" is a separate concern from the health effect.
  if (draft.config.healthMode && tile.kind === 'property' && tile.healthEffect) {
    const paid = applyHealthEffect(draft, playerId, tileIndex, tile.healthEffect, events);
    if (!paid) return;
  }

  switch (tile.kind) {
    case 'go':
    case 'jail':
      break;

    case 'vacation':
      if (draft.config.vacationCash && draft.vacationPot > 0) {
        const amount = draft.vacationPot;
        player.cash += amount;
        draft.vacationPot = 0;
        events.push({ type: 'landed-on-vacation', playerId, amount });
      }
      break;

    case 'go-to-jail':
      draft.doublesCount = 0;
      sendToJail(draft, playerId, 'tile', events);
      finishTurn(draft, events);
      return;

    case 'tax': {
      const amount = tile.amount;
      const paid = chargePlayer(draft, playerId, amount, 'bank', events);
      if (!paid) return;
      if (draft.config.vacationCash) draft.vacationPot += amount;
      events.push({ type: 'tax-paid', playerId, amount, toVacationPot: draft.config.vacationCash });
      break;
    }

    case 'card':
      applyCardDraw(draft, playerId, tile.deck, rng, events);
      return;

    case 'emergency': {
      if (draft.config.healthMode && player.health < EMERGENCY_HEALTH_THRESHOLD) {
        const paid = chargePlayer(draft, playerId, EMERGENCY_FINE, 'bank', events);
        if (!paid) return;
        events.push({ type: 'emergency-fine', playerId, amount: EMERGENCY_FINE });
      }
      break;
    }

    case 'sunny': {
      if (draft.config.rainyDay && draft.rainyDay.turnsRemaining > 0) {
        draft.rainyDay.turnsRemaining = 0;
        events.push({ type: 'rainy-day-ended' });
        const turns = SUNNY_DAY_DURATION_MIN + rng.nextInt(SUNNY_DAY_DURATION_MAX - SUNNY_DAY_DURATION_MIN + 1);
        draft.sunnyDay.turnsRemaining = turns;
        events.push({ type: 'sunny-day-started', turns });
      }
      break;
    }

    case 'property':
    case 'airport':
    case 'utility':
    case 'hospital': {
      const ownership = draft.ownership[tileIndex];
      if (!ownership) {
        draft.phase = { type: 'awaiting-purchase', playerId, tileIndex };
        return;
      }
      if (ownership.ownerId !== playerId) {
        let rent = computeRent(draft, tileIndex, diceSum);
        if (draft.config.allianceMode && isAllied(draft, playerId, ownership.ownerId)) {
          rent = Math.round(rent * ALLIANCE_RENT_MULTIPLIER);
        }
        if (rent > 0) {
          const squatIdx = draft.heldSquatCards.findIndex((h) => h.playerId === playerId && h.targetTileIndex === tileIndex);
          if (squatIdx !== -1) {
            const [held] = draft.heldSquatCards.splice(squatIdx, 1);
            draft.decks[held!.deck].discardPile.push(findCardById(held!.cardId));
            events.push({ type: 'squatted', playerId, targetId: ownership.ownerId, tileIndex });
          } else {
            const paid = chargePlayer(draft, playerId, rent, ownership.ownerId, events);
            if (!paid) return;
            events.push({ type: 'rent-paid', from: playerId, to: ownership.ownerId, amount: rent, tileIndex });
          }
        }
      }
      break;
    }
  }

  resolveEndOfMove(draft, playerId, events);
}

/** Returns false if a cash charge parked the game in debt-settlement — the
 *  caller must stop resolving the rest of the move in that case. */
function applyHealthEffect(
  draft: GameState,
  playerId: PlayerId,
  tileIndex: number,
  effect: { cashDelta: number; healthDelta: number; pharmacy?: boolean },
  events: GameEvent[],
): boolean {
  const player = requirePlayer(draft, playerId);

  if (effect.pharmacy) {
    if (player.pharmacyUsed) return true;
    const healthDelta = PHARMACY_RESET_HEALTH - player.health;
    player.pharmacyUsed = true;
    player.health = PHARMACY_RESET_HEALTH;
    events.push({ type: 'health-effect', playerId, tileIndex, cashDelta: 0, healthDelta });
    return true;
  }

  if (effect.cashDelta < 0) {
    const paid = chargePlayer(draft, playerId, -effect.cashDelta, 'bank', events);
    if (!paid) return false;
  } else if (effect.cashDelta > 0) {
    player.cash += effect.cashDelta;
  }

  player.health = Math.max(0, Math.min(HEALTH_MAX, player.health + effect.healthDelta));
  events.push({ type: 'health-effect', playerId, tileIndex, cashDelta: effect.cashDelta, healthDelta: effect.healthDelta });
  return true;
}

function triggerIllness(draft: GameState, playerId: PlayerId, events: GameEvent[]): void {
  const player = requirePlayer(draft, playerId);
  const isDoublePeine = player.health <= HEALTH_SICK_THRESHOLD;
  const healthLoss = isDoublePeine ? ILLNESS_PENALTY_DOUBLE : ILLNESS_PENALTY;
  const multiplier = isDoublePeine ? 2 : 1;

  // Group hospitals by owner — payout scales with each owner's own hospital
  // count, same shape as airport rent. An unowned hospital's nominal share
  // (the 1-hospital rate) goes to the vacation pot instead of vanishing.
  const ownerCounts = new Map<PlayerId, number>();
  let potContribution = 0;
  for (const hospital of hospitalTiles(draft.board)) {
    const ownership = draft.ownership[hospital.index];
    if (!ownership) {
      potContribution += HOSPITAL_PAYOUT[0]! * multiplier;
    } else {
      ownerCounts.set(ownership.ownerId, (ownerCounts.get(ownership.ownerId) ?? 0) + 1);
    }
  }

  for (const [ownerId, count] of ownerCounts) {
    const amount = (HOSPITAL_PAYOUT[Math.min(count, 3) - 1] ?? 0) * multiplier;
    const sickPlayer = requirePlayer(draft, playerId);
    const paidAmount = Math.min(amount, sickPlayer.cash);
    if (paidAmount > 0) {
      sickPlayer.cash -= paidAmount;
      draft.players[ownerId]!.cash += paidAmount;
    }
    if (paidAmount < amount) potContribution += amount - paidAmount;
  }

  draft.vacationPot += potContribution;
  player.health = Math.max(0, player.health - healthLoss);
  events.push({ type: 'illness', playerId, healthLoss, doublePeine: isDoublePeine });
}

function applyCardDraw(draft: GameState, playerId: PlayerId, deckName: 'travel' | 'customs', rng: Rng, events: GameEvent[]): void {
  const card = drawCard(draft.decks[deckName], rng);
  events.push({ type: 'card-drawn', playerId, deck: deckName, cardId: card.id, text: card.text });
  const effect = card.effect;
  const player = requirePlayer(draft, playerId);

  if (effect.type !== 'get-out-of-jail-free' && effect.type !== 'grant-squat') {
    draft.decks[deckName].discardPile.push(card);
  }

  switch (effect.type) {
    case 'collect':
      player.cash += effect.amount;
      events.push({ type: 'card-effect', playerId, description: card.text, cashDelta: effect.amount });
      resolveEndOfMove(draft, playerId, events);
      return;

    case 'pay': {
      const paid = chargePlayer(draft, playerId, effect.amount, 'bank', events);
      if (!paid) return;
      events.push({ type: 'card-effect', playerId, description: card.text, cashDelta: -effect.amount });
      resolveEndOfMove(draft, playerId, events);
      return;
    }

    case 'get-out-of-jail-free':
      player.getOutOfJailFreeCards += 1;
      draft.heldJailCards.push({ cardId: card.id, deck: deckName, playerId });
      resolveEndOfMove(draft, playerId, events);
      return;

    case 'go-to-jail':
      draft.doublesCount = 0;
      sendToJail(draft, playerId, 'card', events);
      finishTurn(draft, events);
      return;

    case 'move-to': {
      const from = player.position;
      const to = effect.tileIndex;
      const passedGo = to < from;
      player.position = to;
      events.push({ type: 'moved', playerId, from, to, passedGo });
      if (passedGo) {
        player.cash += GO_SALARY;
        events.push({ type: 'collected-go', playerId, amount: GO_SALARY });
      }
      resolveTile(draft, playerId, to, 0, rng, events);
      return;
    }

    case 'move-relative': {
      const from = player.position;
      let to = (from + effect.steps) % boardSize(draft.board);
      if (to < 0) to += boardSize(draft.board);
      const passedGo = effect.steps > 0 && to < from;
      player.position = to;
      events.push({ type: 'moved', playerId, from, to, passedGo });
      if (passedGo) {
        player.cash += GO_SALARY;
        events.push({ type: 'collected-go', playerId, amount: GO_SALARY });
      }
      resolveTile(draft, playerId, to, 0, rng, events);
      return;
    }

    case 'pay-each-player': {
      let totalPaid = 0;
      for (const otherId of draft.turnOrder) {
        if (otherId === playerId) continue;
        const other = draft.players[otherId]!;
        if (other.status !== 'active') continue;
        const amount = Math.min(effect.amount, player.cash);
        player.cash -= amount;
        other.cash += amount;
        totalPaid += amount;
      }
      events.push({ type: 'card-effect', playerId, description: card.text, cashDelta: -totalPaid });
      resolveEndOfMove(draft, playerId, events);
      return;
    }

    case 'collect-from-each-player': {
      let totalCollected = 0;
      for (const otherId of draft.turnOrder) {
        if (otherId === playerId) continue;
        const other = draft.players[otherId]!;
        if (other.status !== 'active') continue;
        const amount = Math.min(effect.amount, other.cash);
        other.cash -= amount;
        player.cash += amount;
        totalCollected += amount;
      }
      events.push({ type: 'card-effect', playerId, description: card.text, cashDelta: totalCollected });
      resolveEndOfMove(draft, playerId, events);
      return;
    }

    case 'form-alliance': {
      // Partner picked at random among other active players not already in
      // an alliance — each player may only be in one alliance at a time, to
      // keep rent-sharing/health-transfer targeting unambiguous. Fizzles
      // (no-op) if the drawer is already allied or no one is eligible.
      const alreadyAllied = (id: PlayerId) => draft.alliances.some((a) => a.players.includes(id));
      const eligible = alreadyAllied(playerId)
        ? []
        : draft.turnOrder.filter((id) => id !== playerId && draft.players[id]?.status === 'active' && !alreadyAllied(id));
      if (eligible.length === 0) {
        events.push({ type: 'card-effect', playerId, description: card.text, cashDelta: 0 });
        resolveEndOfMove(draft, playerId, events);
        return;
      }
      const partnerId = eligible[rng.nextInt(eligible.length) - 1]!;
      draft.alliances.push({ players: [playerId, partnerId], turnsRemaining: ALLIANCE_DURATION_TURNS });
      events.push({ type: 'alliance-formed', players: [playerId, partnerId] });
      resolveEndOfMove(draft, playerId, events);
      return;
    }

    case 'grant-squat': {
      const levels = [1, 2, 3, 5];
      const buildingLevel = levels[rng.nextInt(levels.length) - 1]!;
      draft.heldSquatCards.push({ cardId: card.id, deck: deckName, playerId, buildingLevel });
      events.push({ type: 'squat-granted', playerId, buildingLevel });
      resolveEndOfMove(draft, playerId, events);
      return;
    }
  }
}

function handleTransferHealth(draft: GameState, playerId: PlayerId, toId: PlayerId, amount: number, events: GameEvent[]): void {
  if (!draft.config.healthMode || !draft.config.allianceMode) {
    throw new IllegalActionError('Health transfers are disabled in this game');
  }
  if (amount <= 0) throw new IllegalActionError('Transfer amount must be positive');
  if (!isAllied(draft, playerId, toId)) throw new IllegalActionError('You are not allied with that player');

  const from = requirePlayer(draft, playerId);
  const to = requirePlayer(draft, toId);
  if (from.health - amount < 0) throw new IllegalActionError('Not enough health to transfer');
  if (to.health + amount > HEALTH_MAX) throw new IllegalActionError('That would exceed the health cap');

  from.health -= amount;
  to.health += amount;
  events.push({ type: 'health-transferred', fromId: playerId, toId, amount });
}

function handleTakeHostage(draft: GameState, playerId: PlayerId, tileIndex: number, events: GameEvent[]): void {
  requirePhase(draft, 'awaiting-jail-decision', playerId);
  if (!draft.config.hostageMode) throw new IllegalActionError('Hostage-taking is disabled in this game');
  if (draft.hostage) throw new IllegalActionError('A hostage is already held');

  const ownership = draft.ownership[tileIndex];
  if (!ownership) throw new IllegalActionError('This tile is not owned');
  if (ownership.ownerId === playerId) throw new IllegalActionError('You cannot take your own property hostage');
  if (ownership.mortgaged) throw new IllegalActionError('This property is already mortgaged');
  const owner = draft.players[ownership.ownerId];
  if (!owner || owner.status !== 'active') throw new IllegalActionError('Invalid hostage target');

  draft.hostage = { tileIndex, kidnapperId: playerId, ownerId: ownership.ownerId };
  events.push({ type: 'hostage-taken', playerId, tileIndex, ownerId: ownership.ownerId });
}

function releaseHostageIfHeldBy(draft: GameState, playerId: PlayerId, events: GameEvent[]): void {
  if (draft.hostage?.kidnapperId === playerId) {
    events.push({ type: 'hostage-released', playerId, tileIndex: draft.hostage.tileIndex });
    draft.hostage = null;
  }
}

function resolveEndOfMove(draft: GameState, playerId: PlayerId, events: GameEvent[]): void {
  if (draft.doublesCount > 0) {
    draft.phase = { type: 'awaiting-roll', playerId };
  } else {
    finishTurn(draft, events);
  }
}

function sendToJail(draft: GameState, playerId: PlayerId, reason: 'tile' | 'three-doubles' | 'card', events: GameEvent[]): void {
  const player = requirePlayer(draft, playerId);
  player.position = jailTileIndex(draft.board);
  player.inJail = true;
  player.jailTurns = 0;
  events.push({ type: 'sent-to-jail', playerId, reason });
}

function finishTurn(draft: GameState, events: GameEvent[]): void {
  if (draft.phase.type === 'game-over') return;
  draft.doublesCount = 0;
  const currentPlayerId = draft.turnOrder[draft.currentPlayerIndex]!;
  const nextId = advanceToNextActivePlayer(draft);
  events.push({ type: 'turn-ended', playerId: currentPlayerId, nextPlayerId: nextId });
  tickTurnEffects(draft, events);
  if (checkLastStanding(draft, events)) return;
  if (checkTurnLimit(draft, events)) return;
  startTurnPhase(draft, nextId);
}

/** Advances per-turn-boundary effects (alliance duration, rainy day
 *  scheduling/duration) — called once per finished turn, i.e. per player's
 *  turn, not per full round. */
function tickTurnEffects(draft: GameState, events: GameEvent[]): void {
  if (draft.config.rainyDay) {
    checkRainyDay(draft, events);
    checkSunnyDay(draft, events);
  }

  if (draft.config.allianceMode && draft.alliances.length > 0) {
    draft.alliances = draft.alliances.filter((alliance) => {
      alliance.turnsRemaining -= 1;
      if (alliance.turnsRemaining <= 0) {
        events.push({ type: 'alliance-ended', players: alliance.players });
        return false;
      }
      return true;
    });
  }
}

function checkRainyDay(draft: GameState, events: GameEvent[]): void {
  const rd = draft.rainyDay;
  if (!rd.triggered && rd.triggerTurn !== null && draft.turnNumber >= rd.triggerTurn) {
    rd.triggered = true;
    rd.turnsRemaining = rd.durationTurns;
    events.push({ type: 'rainy-day-started', turns: rd.durationTurns });
  } else if (rd.turnsRemaining > 0) {
    rd.turnsRemaining -= 1;
    if (rd.turnsRemaining === 0) events.push({ type: 'rainy-day-ended' });
  }
}

function checkSunnyDay(draft: GameState, events: GameEvent[]): void {
  const sd = draft.sunnyDay;
  if (sd.turnsRemaining > 0) {
    sd.turnsRemaining -= 1;
    if (sd.turnsRemaining === 0) events.push({ type: 'sunny-day-ended' });
  }
}

function advanceToNextActivePlayer(draft: GameState): PlayerId {
  const total = draft.turnOrder.length;
  let idx = draft.currentPlayerIndex;
  for (let i = 0; i < total; i++) {
    idx = (idx + 1) % total;
    const candidate = draft.turnOrder[idx]!;
    if (draft.players[candidate]?.status === 'active') break;
  }
  draft.currentPlayerIndex = idx;
  draft.turnNumber += 1;
  return draft.turnOrder[idx]!;
}

function startTurnPhase(draft: GameState, playerId: PlayerId): void {
  const player = requirePlayer(draft, playerId);
  draft.phase = player.inJail
    ? { type: 'awaiting-jail-decision', playerId }
    : { type: 'awaiting-roll', playerId };
}

function requirePlayer(draft: GameState, playerId: PlayerId) {
  const player = draft.players[playerId];
  if (!player) throw new IllegalActionError(`Unknown player ${playerId}`);
  return player;
}

function requirePhase<T extends GameState['phase']['type']>(
  draft: GameState,
  type: T,
  playerId: PlayerId,
): Extract<GameState['phase'], { type: T }> {
  const phase = draft.phase;
  if (phase.type !== type || (phase as { playerId?: PlayerId }).playerId !== playerId) {
    throw new IllegalActionError(`Illegal action: expected phase "${type}" for ${playerId}, got "${phase.type}"`);
  }
  return phase as Extract<GameState['phase'], { type: T }>;
}
