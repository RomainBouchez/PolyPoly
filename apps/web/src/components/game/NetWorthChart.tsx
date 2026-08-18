import { useRef, useState } from 'react';
import type { GameState } from '@polypoly/engine';
import type { NetWorthSnapshot } from '@polypoly/shared';

const WIDTH = 340;
const HEIGHT = 190;
const PAD = { top: 10, right: 10, bottom: 20, left: 44 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;
/** Above this many rounds, per-point circles turn a multi-line chart into a
 *  field of dots — the line and the crosshair carry the shape instead. */
const MAX_MARKED_ROUNDS = 20;

function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

/** Same box as the real chart (shares WIDTH/HEIGHT/PAD so nothing jumps when
 *  the data arrives and this is swapped out), with a couple of placeholder
 *  lines standing in for "some player's wealth line" rather than a bare
 *  spinner — the shape reads as "chart loading", not just "loading". */
export function NetWorthChartSkeleton() {
  return (
    <div className="animate-pulse">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={PAD.top + f * PLOT_H}
            y2={PAD.top + f * PLOT_H}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        ))}
        {[0, 0.5, 1].map((f) => (
          <rect key={f} x={6} y={PAD.top + f * PLOT_H - 4} width={28} height={7} rx={3.5} fill="rgba(255,255,255,0.08)" />
        ))}
        <path
          d={`M${PAD.left},${PAD.top + PLOT_H * 0.62} L${PAD.left + PLOT_W * 0.3},${PAD.top + PLOT_H * 0.32} L${PAD.left + PLOT_W * 0.6},${PAD.top + PLOT_H * 0.5} L${WIDTH - PAD.right},${PAD.top + PLOT_H * 0.18}`}
          fill="none"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`M${PAD.left},${PAD.top + PLOT_H * 0.28} L${PAD.left + PLOT_W * 0.35},${PAD.top + PLOT_H * 0.58} L${PAD.left + PLOT_W * 0.7},${PAD.top + PLOT_H * 0.42} L${WIDTH - PAD.right},${PAD.top + PLOT_H * 0.68}`}
          fill="none"
          stroke="rgba(255,255,255,0.09)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="mt-2 flex justify-center gap-2">
        {[16, 20, 14].map((w, i) => (
          <span key={i} className="h-2.5 rounded-full bg-white/10" style={{ width: `${w * 4}px` }} />
        ))}
      </div>
    </div>
  );
}

/**
 * Net worth by round, one line per player, in their own token colour — the
 * same identity used for the pawn on the board, the trade chips, everywhere
 * else a player is named. A generated categorical palette would fight that
 * instead of reinforcing it.
 *
 * Net worth isn't carried by any single event (it's cash plus property plus
 * houses, all moving independently), so this can't be derived from the match
 * log after the fact the way the rest of the stats screen is — the history
 * comes from the server snapshotting it once per completed round as the game
 * is actually played (see Room.netWorthHistory).
 */
export function NetWorthChart({ state, history }: { state: GameState; history: NetWorthSnapshot[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  if (history.length < 2) {
    return <p className="py-6 text-center text-sm text-slate-500">Not enough rounds played yet to chart.</p>;
  }

  const players = state.turnOrder.map((id) => state.players[id]!).filter(Boolean);
  const rounds = history.map((h) => h.roundNumber);
  const minRound = rounds[0]!;
  const maxRound = rounds[rounds.length - 1]!;
  const allValues = history.flatMap((h) => Object.values(h.values));
  const minValue = Math.min(0, ...allValues);
  const maxValue = Math.max(...allValues, 1);

  const scaleX = (round: number) => PAD.left + ((round - minRound) / (maxRound - minRound || 1)) * PLOT_W;
  const scaleY = (value: number) => PAD.top + PLOT_H - ((value - minValue) / (maxValue - minValue || 1)) * PLOT_H;

  const lines = players.map((player) => ({
    player,
    points: history.map((h) => ({ x: scaleX(h.roundNumber), y: scaleY(h.values[player.id] ?? 0) })),
  }));

  // A handful of evenly-spaced round labels regardless of how many rounds
  // were played — one per point would overlap on a long game.
  // Picked by INDEX into the actual rounds played, not by rounding an evenly
  // spaced value — the latter can land on a round nobody snapshotted (there's
  // a gap between rounds 4 and 6 but no round 5) and space unevenly once the
  // count doesn't divide cleanly. A short game shows every round; a long one
  // caps at 6 so labels don't collide.
  const tickCount = Math.min(rounds.length <= 8 ? rounds.length : 6, rounds.length);
  const xTicks = [
    ...new Set(
      Array.from({ length: tickCount }, (_, i) => Math.round((i * (rounds.length - 1)) / Math.max(1, tickCount - 1))),
    ),
  ].map((idx) => rounds[idx]!);
  const yTicks = [minValue, (minValue + maxValue) / 2, maxValue];

  function pointerToIndex(clientX: number): number {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const svgX = ((clientX - rect.left) / rect.width) * WIDTH;
    let closest = 0;
    let closestDist = Infinity;
    history.forEach((h, i) => {
      const dist = Math.abs(scaleX(h.roundNumber) - svgX);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });
    return closest;
  }

  const hovered = hoverIndex !== null ? history[hoverIndex] : null;
  const hoveredRanking = hovered
    ? [...players].sort((a, b) => (hovered.values[b.id] ?? 0) - (hovered.values[a.id] ?? 0))
    : [];
  const tooltipLeftPercent = hovered ? Math.min(85, Math.max(15, (scaleX(hovered.roundNumber) / WIDTH) * 100)) : 50;

  return (
    <div>
      <div ref={wrapperRef} className="relative touch-none select-none">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          onPointerDown={(e) => setHoverIndex(pointerToIndex(e.clientX))}
          onPointerMove={(e) => {
            if (e.buttons === 0 && e.pointerType === 'mouse') setHoverIndex(pointerToIndex(e.clientX));
            else if (e.pressure > 0 || e.pointerType !== 'mouse') setHoverIndex(pointerToIndex(e.clientX));
          }}
          onPointerLeave={() => setHoverIndex(null)}
        >
          {/* Recessive gridlines — the data reads from the lines, not the frame. */}
          {yTicks.map((v) => (
            <line
              key={v}
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={scaleY(v)}
              y2={scaleY(v)}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
          ))}
          {yTicks.map((v) => (
            <text key={v} x={PAD.left - 6} y={scaleY(v)} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="#64748b">
              {money(v)}
            </text>
          ))}
          {xTicks.map((r) => (
            <text key={r} x={scaleX(r)} y={HEIGHT - 4} textAnchor="middle" fontSize={9} fill="#64748b">
              {r}
            </text>
          ))}

          {hovered && (
            <line
              x1={scaleX(hovered.roundNumber)}
              x2={scaleX(hovered.roundNumber)}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
              stroke="rgba(255,255,255,0.25)"
              strokeWidth={1}
            />
          )}

          {lines.map(({ player, points }) => (
            <g key={player.id}>
              <path
                d={points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={player.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={hoverIndex === null || player.status === 'active' ? 1 : 0.5}
              />
              {rounds.length <= MAX_MARKED_ROUNDS &&
                points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={player.color} />)}
              {hovered && (
                <circle
                  cx={scaleX(hovered.roundNumber)}
                  cy={scaleY(hovered.values[player.id] ?? 0)}
                  r={4}
                  fill={player.color}
                  stroke="#0f172a"
                  strokeWidth={1.5}
                />
              )}
            </g>
          ))}
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute top-1 w-36 -translate-x-1/2 rounded-lg bg-slate-950/95 p-2 text-[11px] shadow-lg ring-1 ring-inset ring-white/10"
            style={{ left: `${tooltipLeftPercent}%` }}
          >
            <p className="mb-1 font-semibold text-slate-300">Round {hovered.roundNumber}</p>
            <div className="space-y-0.5">
              {hoveredRanking.map((player) => (
                <div key={player.id} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: player.color }} />
                    <span className="truncate text-slate-300">{player.name}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-100">{money(hovered.values[player.id] ?? 0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Legend — always present past a single series, per the dot+name
          convention PlayersPanel already uses. */}
      <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
        {players.map((player) => (
          <span key={player.id} className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: player.color }} />
            {player.name}
          </span>
        ))}
      </div>
    </div>
  );
}
