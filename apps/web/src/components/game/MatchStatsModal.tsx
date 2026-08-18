import { useEffect, useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { X } from 'lucide-react';
import { computeMatchStats, type GameState, type LoggedEvent, type MatchStats, type PlayerId } from '@polypoly/engine';
import type { NetWorthSnapshot } from '@polypoly/shared';
import { PlayerName, TileLabel } from './GameLabels.js';
import { NetWorthChart, NetWorthChartSkeleton } from './NetWorthChart.js';

interface MatchStatsModalProps {
  state: GameState;
  myPlayerId: PlayerId;
  fetchMatchLog: () => Promise<{ log: LoggedEvent[]; logComplete: boolean; netWorthHistory: NetWorthSnapshot[] }>;
  onClose: () => void;
}

type Tab = 'global' | 'personal';

const DISMISS_OFFSET = 120;
const DISMISS_VELOCITY = 800;

function money(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`;
}

function SectionHeading({ icon, title }: { icon: string; title: string }) {
  return (
    <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
      <span className="text-sm leading-none">{icon}</span>
      {title}
    </h3>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl bg-white/5 p-2.5 ring-1 ring-inset ring-white/10">{children}</div>;
}

function Standings({ state, stats }: { state: GameState; stats: MatchStats }) {
  return (
    <section className="mb-4">
      <SectionHeading icon="🏆" title="Final standings" />
      <div className="space-y-1.5">
        {stats.standings.map((s, i) => (
          <Card key={s.playerId}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-4 shrink-0 text-center text-xs text-slate-500">{i + 1}</span>
                <PlayerName state={state} playerId={s.playerId} />
                {s.isWinner && <span className="shrink-0">🏆</span>}
                {s.status === 'bankrupt' && (
                  <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-400">
                    bankrupt
                  </span>
                )}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-100">{money(s.netWorth)}</span>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function MoneyFlow({ state, stats }: { state: GameState; stats: MatchStats }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const anyFlow = stats.moneyFlow.some((f) => f.rentPaid > 0 || f.rentReceived > 0 || f.taxPaid > 0 || f.wealthTaxPaid > 0);
  if (!anyFlow && !stats.biggestRent) return null;

  return (
    <section className="mb-4">
      <SectionHeading icon="💰" title="Money flow" />
      <div className="space-y-1.5">
        {stats.biggestRent && (
          <Card>
            <p className="text-sm text-slate-200">
              Biggest rent: <PlayerName state={state} playerId={stats.biggestRent.from} /> paid{' '}
              <span className="font-semibold text-slate-100">{money(stats.biggestRent.amount)}</span> to{' '}
              <PlayerName state={state} playerId={stats.biggestRent.to} /> on <TileLabel state={state} tileIndex={stats.biggestRent.tileIndex} />
            </p>
          </Card>
        )}
        {stats.moneyFlow
          .filter((f) => f.rentPaid > 0 || f.rentReceived > 0 || f.taxPaid > 0 || f.wealthTaxPaid > 0 || f.wealthTaxReceived > 0)
          .map((f) => {
            const isOpen = expanded === f.playerId;
            const opponents = Object.keys({ ...f.rentPaidTo, ...f.rentReceivedFrom });
            return (
              <Card key={f.playerId}>
                <button
                  className="flex w-full items-center justify-between gap-2 text-left"
                  onClick={() => setExpanded(isOpen ? null : f.playerId)}
                  disabled={opponents.length === 0}
                >
                  <PlayerName state={state} playerId={f.playerId} />
                  <span className="shrink-0 text-xs tabular-nums text-slate-400">
                    rent paid {money(f.rentPaid)} · received {money(f.rentReceived)}
                  </span>
                </button>
                {isOpen && opponents.length > 0 && (
                  <div className="mt-1.5 space-y-0.5 border-t border-white/10 pt-1.5 text-xs text-slate-400">
                    {opponents.map((opId) => (
                      <div key={opId} className="flex items-center justify-between">
                        <PlayerName state={state} playerId={opId} />
                        <span className="tabular-nums">
                          {f.rentPaidTo[opId] ? `paid ${money(f.rentPaidTo[opId]!)}` : ''}
                          {f.rentPaidTo[opId] && f.rentReceivedFrom[opId] ? ' · ' : ''}
                          {f.rentReceivedFrom[opId] ? `received ${money(f.rentReceivedFrom[opId]!)}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {(f.taxPaid > 0 || f.wealthTaxPaid > 0 || f.wealthTaxReceived > 0) && (
                  <p className="mt-1 text-xs text-slate-500">
                    {f.taxPaid > 0 && `tax ${money(f.taxPaid)}`}
                    {f.wealthTaxPaid > 0 && ` · departure tax paid ${money(f.wealthTaxPaid)}`}
                    {f.wealthTaxReceived > 0 && ` · departure tax received ${money(f.wealthTaxReceived)}`}
                  </p>
                )}
              </Card>
            );
          })}
      </div>
    </section>
  );
}

function PropertyActivity({ state, stats }: { state: GameState; stats: MatchStats }) {
  const active = stats.property.filter(
    (p) => p.propertiesBought > 0 || p.housesBuilt > 0 || p.hotelsBuilt > 0 || p.mortgagesTaken > 0,
  );
  if (active.length === 0) return null;
  return (
    <section className="mb-4">
      <SectionHeading icon="🏠" title="Property" />
      <div className="space-y-1.5">
        {active.map((p) => (
          <Card key={p.playerId}>
            <div className="flex items-center justify-between gap-2">
              <PlayerName state={state} playerId={p.playerId} />
              <span className="text-xs tabular-nums text-slate-400">
                {p.propertiesBought} bought
                {p.housesBuilt > 0 && ` · ${p.housesBuilt}🏠 built`}
                {p.hotelsBuilt > 0 && ` · ${p.hotelsBuilt}🏨 built`}
                {p.mortgagesTaken > 0 && ` · ${p.mortgagesTaken} mortgaged`}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function BoardActivity({ state, stats }: { state: GameState; stats: MatchStats }) {
  if (stats.tileVisits.length === 0) return null;
  const top = stats.tileVisits.slice(0, 5);
  return (
    <section className="mb-4">
      <SectionHeading icon="🗺️" title="Board" />
      <Card>
        <p className="mb-1.5 text-xs uppercase tracking-wide text-slate-500">Most-visited tiles</p>
        <div className="space-y-1">
          {top.map((v) => (
            <div key={v.tileIndex} className="flex items-center justify-between text-sm">
              <TileLabel state={state} tileIndex={v.tileIndex} />
              <span className="tabular-nums text-slate-400">{v.count}×</span>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

function JailActivity({ state, stats }: { state: GameState; stats: MatchStats }) {
  const active = stats.jail.filter((j) => Object.values(j.timesSent).some((n) => n > 0));
  if (active.length === 0) return null;
  return (
    <section className="mb-4">
      <SectionHeading icon="🚔" title="Jail" />
      <div className="space-y-1.5">
        {active.map((j) => {
          const timesSent = Object.values(j.timesSent).reduce((a, b) => a + b, 0);
          return (
            <Card key={j.playerId}>
              <div className="flex items-center justify-between gap-2">
                <PlayerName state={state} playerId={j.playerId} />
                <span className="flex items-center gap-1 text-xs tabular-nums text-slate-400">
                  sent {timesSent}× · served {j.turnsServed} turn{j.turnsServed === 1 ? '' : 's'}
                  {!stats.logComplete && (
                    <span title="Recorded from a partial log — may undercount." className="text-amber-400">
                      *
                    </span>
                  )}
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function TradeActivity({ state, stats }: { state: GameState; stats: MatchStats }) {
  const active = stats.trades.filter((t) => t.asInitiator.proposed > 0 || t.asRecipient.proposed > 0);
  if (active.length === 0) return null;
  return (
    <section className="mb-4">
      <SectionHeading icon="🤝" title="Trades" />
      <div className="space-y-1.5">
        {active.map((t) => (
          <Card key={t.playerId}>
            <div className="flex items-center justify-between gap-2">
              <PlayerName state={state} playerId={t.playerId} />
              <span className="text-xs tabular-nums text-slate-400">
                proposed {t.asInitiator.proposed} · accepted {t.asInitiator.accepted + t.asRecipient.accepted}
              </span>
            </div>
            {(t.cashSent > 0 || t.cashReceived > 0 || t.propertiesSent > 0 || t.propertiesReceived > 0) && (
              <p className="mt-1 text-xs text-slate-500">
                sent {money(t.cashSent)}
                {t.propertiesSent > 0 && ` + ${t.propertiesSent} propert${t.propertiesSent === 1 ? 'y' : 'ies'}`} · received{' '}
                {money(t.cashReceived)}
                {t.propertiesReceived > 0 && ` + ${t.propertiesReceived} propert${t.propertiesReceived === 1 ? 'y' : 'ies'}`}
              </p>
            )}
          </Card>
        ))}
      </div>
    </section>
  );
}

function Bankruptcies({ state, stats }: { state: GameState; stats: MatchStats }) {
  if (stats.bankruptcies.length === 0) return null;
  return (
    <section className="mb-4">
      <SectionHeading icon="💀" title="Bankruptcies" />
      <div className="space-y-1.5">
        {stats.bankruptcies.map((b) => (
          <Card key={b.order}>
            <p className="text-sm text-slate-200">
              <span className="text-slate-500">#{b.order}</span> <PlayerName state={state} playerId={b.playerId} /> went bankrupt to{' '}
              {b.creditorId === 'bank' ? <span className="font-semibold">the bank</span> : <PlayerName state={state} playerId={b.creditorId} />}
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}

function OptionalExtras({ state, stats }: { state: GameState; stats: MatchStats }) {
  const rows: { icon: string; text: React.ReactNode }[] = [];
  if (state.config.allianceMode && stats.alliances.length > 0) {
    rows.push({
      icon: '🤝',
      text: (
        <>
          {stats.alliances.length} alliance{stats.alliances.length === 1 ? '' : 's'} formed
        </>
      ),
    });
  }
  if (state.config.rainyDay && stats.rainyDayOccurrences > 0) {
    rows.push({ icon: '🌧️', text: <>Rain fell {stats.rainyDayOccurrences}×</> });
  }
  if (state.config.squatCards && stats.squatsUsed.length > 0) {
    rows.push({
      icon: '🏚️',
      text: (
        <>
          {stats.squatsUsed.length} squat{stats.squatsUsed.length === 1 ? '' : 's'} pulled off
        </>
      ),
    });
  }
  if (stats.emergencyFines.length > 0) {
    rows.push({
      icon: '🚑',
      text: (
        <>
          {stats.emergencyFines.length} emergency fine{stats.emergencyFines.length === 1 ? '' : 's'} paid
        </>
      ),
    });
  }
  if (rows.length === 0) return null;
  return (
    <section className="mb-4">
      <SectionHeading icon="✨" title="Also happened" />
      <Card>
        <div className="space-y-1 text-sm text-slate-300">
          {rows.map((r, i) => (
            <p key={i} className="flex items-center gap-1.5">
              <span>{r.icon}</span>
              {r.text}
            </p>
          ))}
        </div>
      </Card>
    </section>
  );
}

/** Every per-player array in MatchStats holds one entry for every player,
 *  zeroed out rather than omitted — so pulling "mine" out is a find, never a
 *  missing-data case. What each section checks is whether that entry has any
 *  non-zero activity, same gating the Global tab's per-section filters use,
 *  just narrowed to one player instead of "does anyone have this". */
function PersonalTab({ state, stats, myPlayerId }: { state: GameState; stats: MatchStats; myPlayerId: PlayerId }) {
  const rank = stats.standings.findIndex((s) => s.playerId === myPlayerId) + 1;
  const standing = stats.standings.find((s) => s.playerId === myPlayerId);
  const flow = stats.moneyFlow.find((f) => f.playerId === myPlayerId);
  const prop = stats.property.find((p) => p.playerId === myPlayerId);
  const board = stats.board.find((b) => b.playerId === myPlayerId);
  const jail = stats.jail.find((j) => j.playerId === myPlayerId);
  const trade = stats.trades.find((t) => t.playerId === myPlayerId);
  const wentBankrupt = stats.bankruptcies.find((b) => b.playerId === myPlayerId);
  const bankruptedByMe = stats.bankruptcies.filter((b) => b.creditorId === myPlayerId);
  const myAlliances = stats.alliances.filter((a) => a.players.includes(myPlayerId));
  const mySquats = stats.squatsUsed.filter((s) => s.playerId === myPlayerId);
  const myFines = stats.emergencyFines.filter((f) => f.playerId === myPlayerId);
  const opponents = flow ? Object.keys({ ...flow.rentPaidTo, ...flow.rentReceivedFrom }) : [];

  return (
    <div>
      <section className="mb-4">
        <SectionHeading icon="🎯" title="Your result" />
        <Card>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              {rank > 0 && <span className="text-xs text-slate-500">#{rank}</span>}
              {standing?.isWinner && <span>🏆</span>}
              {standing?.status === 'bankrupt' && (
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-400">
                  bankrupt
                </span>
              )}
            </span>
            <span className="text-sm font-semibold tabular-nums text-slate-100">{standing ? money(standing.netWorth) : '—'}</span>
          </div>
          {standing && <p className="mt-1 text-xs text-slate-500">cash on hand: {money(standing.cash)}</p>}
        </Card>
      </section>

      {flow &&
        (flow.rentPaid > 0 || flow.rentReceived > 0 || flow.taxPaid > 0 || flow.wealthTaxPaid > 0 || flow.wealthTaxReceived > 0 || flow.cardCashDelta !== 0) && (
          <section className="mb-4">
            <SectionHeading icon="💰" title="Your money" />
            <Card>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">rent paid</span>
                <span className="tabular-nums text-slate-100">{money(flow.rentPaid)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">rent received</span>
                <span className="tabular-nums text-slate-100">{money(flow.rentReceived)}</span>
              </div>
              {opponents.length > 0 && (
                <div className="mt-1.5 space-y-0.5 border-t border-white/10 pt-1.5 text-xs text-slate-400">
                  {opponents.map((opId) => (
                    <div key={opId} className="flex items-center justify-between">
                      <PlayerName state={state} playerId={opId} />
                      <span className="tabular-nums">
                        {flow.rentPaidTo[opId] ? `paid ${money(flow.rentPaidTo[opId]!)}` : ''}
                        {flow.rentPaidTo[opId] && flow.rentReceivedFrom[opId] ? ' · ' : ''}
                        {flow.rentReceivedFrom[opId] ? `received ${money(flow.rentReceivedFrom[opId]!)}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {(flow.taxPaid > 0 || flow.wealthTaxPaid > 0 || flow.wealthTaxReceived > 0 || flow.cardCashDelta !== 0) && (
                <p className="mt-1.5 border-t border-white/10 pt-1.5 text-xs text-slate-500">
                  {flow.taxPaid > 0 && `tax ${money(flow.taxPaid)}`}
                  {flow.wealthTaxPaid > 0 && ` · departure tax paid ${money(flow.wealthTaxPaid)}`}
                  {flow.wealthTaxReceived > 0 && ` · departure tax received ${money(flow.wealthTaxReceived)}`}
                  {flow.cardCashDelta !== 0 && ` · cards ${flow.cardCashDelta > 0 ? '+' : ''}${money(flow.cardCashDelta)}`}
                </p>
              )}
            </Card>
          </section>
        )}

      {prop && (prop.propertiesBought > 0 || prop.housesBuilt > 0 || prop.hotelsBuilt > 0 || prop.mortgagesTaken > 0) && (
        <section className="mb-4">
          <SectionHeading icon="🏠" title="Your property" />
          <Card>
            <p className="text-sm text-slate-300">
              {prop.propertiesBought} bought ({money(prop.totalSpentBuying)})
              {prop.auctionsWon > 0 && ` · ${prop.auctionsWon} auctions won`}
              {prop.housesBuilt > 0 && ` · ${prop.housesBuilt}🏠 built`}
              {prop.hotelsBuilt > 0 && ` · ${prop.hotelsBuilt}🏨 built`}
              {prop.mortgagesTaken > 0 && ` · ${prop.mortgagesTaken} mortgaged`}
            </p>
          </Card>
        </section>
      )}

      {board && board.tileVisits.length > 0 && (
        <section className="mb-4">
          <SectionHeading icon="🗺️" title="Your most-visited tiles" />
          <Card>
            <div className="space-y-1">
              {board.tileVisits.slice(0, 5).map((v) => (
                <div key={v.tileIndex} className="flex items-center justify-between text-sm">
                  <TileLabel state={state} tileIndex={v.tileIndex} />
                  <span className="tabular-nums text-slate-400">{v.count}×</span>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      {jail && Object.values(jail.timesSent).some((n) => n > 0) && (
        <section className="mb-4">
          <SectionHeading icon="🚔" title="Your time in jail" />
          <Card>
            <p className="flex items-center gap-1 text-sm text-slate-300">
              sent {Object.values(jail.timesSent).reduce((a, b) => a + b, 0)}× · served {jail.turnsServed} turn
              {jail.turnsServed === 1 ? '' : 's'}
              {!stats.logComplete && (
                <span title="Recorded from a partial log — may undercount." className="text-amber-400">
                  *
                </span>
              )}
            </p>
          </Card>
        </section>
      )}

      {trade && (trade.asInitiator.proposed > 0 || trade.asRecipient.proposed > 0) && (
        <section className="mb-4">
          <SectionHeading icon="🤝" title="Your trades" />
          <Card>
            <p className="text-sm text-slate-300">
              proposed {trade.asInitiator.proposed} · received {trade.asRecipient.proposed} · accepted{' '}
              {trade.asInitiator.accepted + trade.asRecipient.accepted}
            </p>
            {(trade.cashSent > 0 || trade.cashReceived > 0 || trade.propertiesSent > 0 || trade.propertiesReceived > 0) && (
              <p className="mt-1 text-xs text-slate-500">
                sent {money(trade.cashSent)}
                {trade.propertiesSent > 0 && ` + ${trade.propertiesSent} propert${trade.propertiesSent === 1 ? 'y' : 'ies'}`} · received{' '}
                {money(trade.cashReceived)}
                {trade.propertiesReceived > 0 && ` + ${trade.propertiesReceived} propert${trade.propertiesReceived === 1 ? 'y' : 'ies'}`}
              </p>
            )}
          </Card>
        </section>
      )}

      {(wentBankrupt || bankruptedByMe.length > 0) && (
        <section className="mb-4">
          <SectionHeading icon="💀" title="Bankruptcy" />
          <div className="space-y-1.5">
            {wentBankrupt && (
              <Card>
                <p className="text-sm text-slate-200">
                  You went bankrupt to{' '}
                  {wentBankrupt.creditorId === 'bank' ? (
                    <span className="font-semibold">the bank</span>
                  ) : (
                    <PlayerName state={state} playerId={wentBankrupt.creditorId} />
                  )}
                </p>
              </Card>
            )}
            {bankruptedByMe.map((b) => (
              <Card key={b.order}>
                <p className="text-sm text-slate-200">
                  You bankrupted <PlayerName state={state} playerId={b.playerId} />
                </p>
              </Card>
            ))}
          </div>
        </section>
      )}

      {(myAlliances.length > 0 || mySquats.length > 0 || myFines.length > 0) && (
        <section className="mb-4">
          <SectionHeading icon="✨" title="Also happened to you" />
          <Card>
            <div className="space-y-1 text-sm text-slate-300">
              {myAlliances.length > 0 && (
                <p>
                  🤝 {myAlliances.length} alliance{myAlliances.length === 1 ? '' : 's'} formed
                </p>
              )}
              {mySquats.length > 0 && (
                <p>
                  🏚️ {mySquats.length} squat{mySquats.length === 1 ? '' : 's'} pulled off
                </p>
              )}
              {myFines.length > 0 && (
                <p>
                  🚑 {myFines.length} emergency fine{myFines.length === 1 ? '' : 's'} paid
                </p>
              )}
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}

export function MatchStatsModal({ state, myPlayerId, fetchMatchLog, onClose }: MatchStatsModalProps) {
  const [stats, setStats] = useState<MatchStats | null>(null);
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('global');

  useEffect(() => {
    let cancelled = false;
    fetchMatchLog()
      .then(({ log, logComplete, netWorthHistory }) => {
        if (cancelled) return;
        setStats(computeMatchStats(log, state, logComplete));
        setNetWorthHistory(netWorthHistory);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
    // Deliberately once per mount — the match is over, state is frozen, and
    // fetchMatchLog is a stable callback identity from useRoom/useSpectator.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const winner = stats?.winnerId ? state.players[stats.winnerId] : undefined;

  function handleDragEnd(_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) onClose();
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 0.55 }}
        onDragEnd={handleDragEnd}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', bounce: 0.15, visualDuration: 0.4 }}
        className="flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-slate-900 text-slate-100 shadow-2xl sm:max-h-[85dvh] sm:rounded-3xl"
      >
        <div className="flex cursor-grab justify-center pt-2 active:cursor-grabbing sm:hidden">
          <span className="h-1.5 w-10 rounded-full bg-white/15" />
        </div>

        <div className="relative shrink-0 bg-slate-800/60 px-4 py-3 text-center">
          <h2 className="text-lg font-bold tracking-tight">
            {winner ? <>🏆 {winner.name} wins!</> : '📊 Match summary'}
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {stats ? `${stats.roundsPlayed} round${stats.roundsPlayed === 1 ? '' : 's'} played` : 'Loading…'}
            {stats && !stats.logComplete && ' · some stats may be incomplete'}
          </p>
          <button
            onClick={onClose}
            className="absolute right-2.5 top-2 rounded-full p-1.5 text-slate-400 transition-colors active:bg-white/10 active:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        {stats && (
          <div className="flex shrink-0 gap-1 border-b border-white/10 bg-slate-900 p-2">
            {(['global', 'personal'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                  tab === t ? 'bg-white/10 text-slate-100' : 'text-slate-500 active:bg-white/5'
                }`}
              >
                {t === 'global' ? '🌍 Whole game' : '🎯 You'}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          <AnimatePresence mode="wait">
            {error ? (
              <motion.p key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8 text-center text-sm text-red-300">
                Couldn't load the match summary — {error}
              </motion.p>
            ) : !stats ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <section className="mb-4 animate-pulse space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-10 rounded-lg bg-white/5 ring-1 ring-inset ring-white/10" />
                  ))}
                </section>
                <section className="mb-4">
                  <Card>
                    <NetWorthChartSkeleton />
                  </Card>
                </section>
              </motion.div>
            ) : tab === 'global' ? (
              <motion.div key="global" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
                <Standings state={state} stats={stats} />
                {netWorthHistory.length > 1 && (
                  <section className="mb-4">
                    <SectionHeading icon="📈" title="Wealth over time" />
                    <Card>
                      <NetWorthChart state={state} history={netWorthHistory} />
                    </Card>
                  </section>
                )}
                <MoneyFlow state={state} stats={stats} />
                <PropertyActivity state={state} stats={stats} />
                <BoardActivity state={state} stats={stats} />
                <JailActivity state={state} stats={stats} />
                <TradeActivity state={state} stats={stats} />
                <Bankruptcies state={state} stats={stats} />
                <OptionalExtras state={state} stats={stats} />
              </motion.div>
            ) : (
              <motion.div key="personal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
                <PersonalTab state={state} stats={stats} myPlayerId={myPlayerId} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
