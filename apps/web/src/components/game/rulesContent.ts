import {
  AIRPORT_RENT_BY_COUNT,
  ALLIANCE_DURATION_ROUNDS,
  BID_INCREMENT,
  EMERGENCY_FINE,
  FULL_SET_VALUE_MULTIPLIER,
  EMERGENCY_HEALTH_THRESHOLD,
  GO_HEALTH_BONUS,
  GO_SALARY,
  GO_SALARY_SICK,
  HEALTH_MAX,
  HEALTH_SICK_THRESHOLD,
  HEALTH_START,
  HOSPITAL_PAYOUT,
  HOUSES_PER_HOTEL,
  ILLNESS_PENALTY,
  ILLNESS_PENALTY_DOUBLE,
  JAIL_FINE,
  JAIL_HEALTH_DRAIN,
  MAX_JAIL_TURNS,
  PHARMACY_RESET_HEALTH,
  RAINY_DAY_TRIGGER_MAX,
  RAINY_DAY_TRIGGER_MIN,
  SUNNY_DAY_DURATION_MAX,
  SUNNY_DAY_DURATION_MIN,
  UNMORTGAGE_INTEREST,
  UTILITY_RENT_MULTIPLIER_BOTH,
  UTILITY_RENT_MULTIPLIER_ONE,
  WEALTH_TAX_RATE,
  type GameState,
} from '@polypoly/engine';
import type { GameConfig } from '@polypoly/shared';

export interface RuleEntry {
  title: string;
  body: string;
  /** Present when the rule is optional; used to mark it off in this game. */
  flag?: keyof GameConfig;
}

export interface RuleSection {
  id: string;
  title: string;
  icon: string;
  entries: RuleEntry[];
}

/**
 * Every number here is read from the engine's own constants rather than typed
 * out, because prose drifts: the rules panel spent a while telling players Go
 * paid nothing while sick, months after it started paying half. If a value
 * changes in `rules.ts`, this text follows on the next build.
 *
 * Ordered from what a first-time player needs to what only matters once an
 * optional mode is switched on.
 */
export function buildRuleSections(state: GameState): RuleSection[] {
  const cfg = state.config;
  const startingCash = cfg.startingCash;

  return [
    {
      id: 'basics',
      title: 'The basics',
      icon: '🎲',
      entries: [
        {
          title: 'Goal',
          body:
            cfg.endCondition.type === 'last-standing'
              ? 'Be the last player who has not gone bankrupt. Everyone else is knocked out along the way.'
              : cfg.endCondition.type === 'round-limit'
                ? `The game ends after ${cfg.endCondition.rounds} rounds — a round is everyone playing once. Whoever is worth the most then wins.`
                : `The game ends after ${cfg.endCondition.minutes} minutes. Whoever is worth the most then wins.`,
        },
        {
          title: 'Your turn',
          body: `Roll two dice and move that many tiles clockwise. Whatever you land on resolves immediately — buy it, pay rent, draw a card. Roll a double and you go again; three doubles in a row sends you to jail instead of moving.`,
        },
        {
          title: 'Starting out',
          body: `Everyone begins on Go with $${startingCash}.`,
        },
        {
          title: 'Passing Go',
          body: `Collect $${GO_SALARY} every time you pass or land on Go. Being sent to jail does not count as passing it.`,
        },
        {
          title: 'Net worth',
          body: `Your worth is your cash plus what your holdings would fetch: a property inside a country you own outright counts ${FULL_SET_VALUE_MULTIPLIER}× its price, a lone one counts its price, a mortgaged one its mortgage value, and houses count what they cost to build. Money you currently owe is subtracted. It is the figure under your cash, and the one that decides a game won on points.`,
        },
      ],
    },

    {
      id: 'property',
      title: 'Buying and rent',
      icon: '🏠',
      entries: [
        {
          title: 'Buying',
          body: 'Land on an unowned property and you may buy it at the printed price. Every tile you own charges rent to anyone who lands on it.',
        },
        {
          title: 'Auctions',
          body: `Decline a purchase and the tile goes to auction among the other players, bidding in $${BID_INCREMENT} steps. The last player who has not passed wins it at their bid. If nobody bids, it stays unowned.`,
          flag: 'auction',
        },
        {
          title: 'Colour sets',
          body: 'Owning every property of one country doubles the rent on all of them — until you start building, after which the house rate applies instead.',
          flag: 'doubleRentOnFullSet',
        },
        {
          title: 'Airports',
          body: `Rent depends on how many airports the owner holds: $${AIRPORT_RENT_BY_COUNT.join(', $')} for one, two, three and four.`,
        },
        {
          title: 'Utilities',
          body: `Rent is your dice roll times ${UTILITY_RENT_MULTIPLIER_ONE}, or times ${UTILITY_RENT_MULTIPLIER_BOTH} if the owner holds both.`,
        },
        {
          title: 'No rent from jail',
          body: 'A player sitting in jail collects no rent on anything they own.',
          flag: 'noRentInPrison',
        },
      ],
    },

    {
      id: 'building',
      title: 'Building',
      icon: '🏗️',
      entries: [
        {
          title: 'Houses',
          body: `You can build once you own every property of a country and none of them is mortgaged. Each house multiplies the rent sharply; a ${HOUSES_PER_HOTEL + 1}th purchase turns ${HOUSES_PER_HOTEL} houses into a hotel.`,
        },
        {
          title: 'Even building',
          body: 'Houses must go up evenly across the set — you cannot put a second house anywhere until every property in the set has one. Selling works the same way in reverse.',
          flag: 'evenBuild',
        },
        {
          title: 'Limited supply',
          body: 'The bank holds only 32 houses and 12 hotels. When they run out, building stalls until someone sells — which is a real tactic against a leader.',
          flag: 'limitedHouseSupply',
        },
        {
          title: 'Why can I not build?',
          body: 'The property card tells you: a missing set member, a mortgage anywhere in the set, even-build pointing at another property, not enough cash, or an empty bank.',
        },
      ],
    },

    {
      id: 'money',
      title: 'Money trouble',
      icon: '💸',
      entries: [
        {
          title: 'Departure tax',
          body: `Land on Departure Tax and you pay ${Math.round(WEALTH_TAX_RATE * 100)}% of your net worth straight to whoever currently has the least — not the bank. Already the poorest yourself? Nothing happens.`,
        },
        {
          title: 'Mortgaging',
          body: `Mortgage a property for half its price to raise cash. It earns no rent while mortgaged, and lifting it costs the mortgage value plus ${Math.round((UNMORTGAGE_INTEREST - 1) * 100)}% interest. Sell any houses first.`,
          flag: 'mortgage',
        },
        {
          title: 'Debt',
          body: 'Owe more than you hold and play pauses on you: sell houses and mortgage property until you can pay. Everyone waits, so it is shown to the whole table.',
        },
        {
          title: 'Bankruptcy',
          body: 'If you cannot raise enough, you are out. Everything you own passes to whoever you owed — mortgages included, which is why an inherited set often cannot be built on straight away.',
        },
        {
          title: 'Vacation pot',
          body: 'Taxes and bank payments pile up on the Vacation tile instead of vanishing. Land on it and you take the lot.',
          flag: 'vacationCash',
        },
      ],
    },

    {
      id: 'jail',
      title: 'Jail',
      icon: '🚔',
      entries: [
        {
          title: 'Getting in',
          body: 'The Go To Jail tile, a card that says so, or rolling three doubles in one turn. You move straight there without passing Go.',
        },
        {
          title: 'Getting out',
          body: `Pay $${JAIL_FINE}, use a Get Out of Jail Free card, or roll a double. After ${MAX_JAIL_TURNS} failed turns you pay the fine and leave anyway. Escaping on a double does not earn you another roll.`,
        },
        {
          title: 'Health cost',
          body: `Each turn served costs ${JAIL_HEALTH_DRAIN} health — up to ${JAIL_HEALTH_DRAIN * MAX_JAIL_TURNS} over a full stay, which is a real reason to pay the fine early.`,
          flag: 'healthMode',
        },
        {
          title: 'Hostage',
          body: 'While jailed you may take one opponent property hostage. It earns its owner nothing until you get out.',
          flag: 'hostageMode',
        },
      ],
    },

    {
      id: 'trading',
      title: 'Trading',
      icon: '🤝',
      entries: [
        {
          title: 'Offers',
          body: 'Offer any mix of cash and property for any mix of theirs. Properties with houses cannot be traded — sell the houses first.',
        },
        {
          title: 'Negotiating',
          body: 'An offer can be accepted, declined, or answered with changes. A counter replaces the original rather than sitting beside it, so there is only ever one live version between you.',
        },
        {
          title: 'One at a time',
          body: 'You can only be in one trade at once, whether you proposed it or received it. Settle it before starting another — and nobody can bury you under simultaneous offers.',
          flag: 'oneTradeAtATime',
        },
      ],
    },

    {
      id: 'cards',
      title: 'Cards',
      icon: '🧳',
      entries: [
        {
          title: 'Travel and Customs',
          body: 'Landing on a card tile draws the top card and resolves it at once: collect, pay, move, or go to jail. Get Out of Jail Free cards are kept until used.',
        },
        {
          title: 'Squat pass',
          body: 'A card can grant a free stay. You pick a target property matching the building level rolled with it, and the next time you land there you pay nothing. You can never squat the same opponent twice.',
          flag: 'squatCards',
        },
        {
          title: 'Alliance',
          body: `A card can pair you with another player for ${ALLIANCE_DURATION_ROUNDS} rounds — a round is everyone playing once, not ${ALLIANCE_DURATION_ROUNDS} single turns. Rent between you is halved, and in health mode you can pass health to each other.`,
          flag: 'allianceMode',
        },
      ],
    },

    {
      id: 'health',
      title: 'Health mode',
      icon: '❤️',
      entries: [
        {
          title: 'Health',
          body: `Everyone starts at ${HEALTH_START} out of ${HEALTH_MAX}. At ${HEALTH_SICK_THRESHOLD} or below you are sick, which has consequences of its own.`,
          flag: 'healthMode',
        },
        {
          title: 'Falling ill',
          body: `Roll 1-1 and you lose ${ILLNESS_PENALTY} health and pay every hospital owner — $${HOSPITAL_PAYOUT.join(', $')} depending on how many they hold. Fall ill while already sick and it costs ${ILLNESS_PENALTY_DOUBLE} health instead, though the money is unchanged.`,
          flag: 'healthMode',
        },
        {
          title: 'Being sick',
          body: `Passing Go pays $${GO_SALARY_SICK} instead of $${GO_SALARY}, and you cannot claim a Squat pass. Passing Go still restores ${GO_HEALTH_BONUS} health either way, so it is a way out rather than a trap.`,
          flag: 'healthMode',
        },
        {
          title: 'Health tiles',
          body: `Some properties trade cash against health — fast food pays you but costs health, a gym costs cash and restores it. The pharmacy resets you to ${PHARMACY_RESET_HEALTH}, once per game.`,
          flag: 'healthMode',
        },
        {
          title: 'Emergency',
          body: `Land on Emergency below ${EMERGENCY_HEALTH_THRESHOLD} health and you are fined $${EMERGENCY_FINE}. Above it, nothing happens.`,
          flag: 'healthMode',
        },
      ],
    },

    {
      id: 'weather',
      title: 'Weather',
      icon: '🌧️',
      entries: [
        {
          title: 'Rainy day',
          body: `Somewhere between round ${RAINY_DAY_TRIGGER_MIN} and ${RAINY_DAY_TRIGGER_MAX}, rent everywhere doubles for a round or two. It is scheduled when the game starts, so it lands the same way on a replay.`,
          flag: 'rainyDay',
        },
        {
          title: 'Sunny day',
          body: `Landing on the Sunny tile while it rains stops the rain and halves rent instead, for ${SUNNY_DAY_DURATION_MIN}-${SUNNY_DAY_DURATION_MAX} rounds.`,
          flag: 'rainyDay',
        },
      ],
    },
  ];
}

/** Case-insensitive match over a rule's title and body. */
export function matchesQuery(entry: RuleEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${entry.title} ${entry.body}`.toLowerCase().includes(q);
}
