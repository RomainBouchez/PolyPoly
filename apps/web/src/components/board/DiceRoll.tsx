import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { GameEvent } from '@polypoly/engine';

interface DiceRollProps {
  events: GameEvent[];
}

const TUMBLE_MS = 550;
const TUMBLE_TICK_MS = 90;

/** Tumbles to a random face every tick while "rolling", then locks to the
 *  real result from the authoritative `rolled` event — the displayed value
 *  is never anything but that event's dice once the animation settles. */
export function DiceRoll({ events }: DiceRollProps) {
  const reduceMotion = useReducedMotion();
  const lastCount = useRef(events.length);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dice, setDice] = useState<[number, number] | null>(null);
  const [display, setDisplay] = useState<[number, number]>([1, 1]);
  const [rolling, setRolling] = useState(false);
  const [rollId, setRollId] = useState(0);

  useEffect(() => {
    if (events.length <= lastCount.current) {
      lastCount.current = events.length;
      return;
    }
    const newEvents = events.slice(lastCount.current);
    lastCount.current = events.length;

    const rolled = [...newEvents].reverse().find((e): e is Extract<GameEvent, { type: 'rolled' }> => e.type === 'rolled');
    if (!rolled) return;

    // A fresh roll interrupts any tumble still in flight — clear its timers
    // so they can't fire late and clobber the new result.
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setRollId((id) => id + 1);

    if (reduceMotion) {
      setDice(rolled.dice);
      setDisplay(rolled.dice);
      setRolling(false);
      return;
    }

    setRolling(true);
    intervalRef.current = setInterval(() => {
      setDisplay([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]);
    }, TUMBLE_TICK_MS);
    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setDisplay(rolled.dice);
      setDice(rolled.dice);
      setRolling(false);
    }, TUMBLE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  if (dice === null && !rolling) return null;

  return (
    <div className="flex shrink-0 items-center gap-[clamp(6px,1.4cqmin,12px)]" aria-hidden="true">
      <Die value={display[0]} rolling={rolling} rollId={rollId} reduceMotion={!!reduceMotion} />
      <Die value={display[1]} rolling={rolling} rollId={rollId} reduceMotion={!!reduceMotion} />
    </div>
  );
}

const PIP_POSITIONS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [25, 25],
    [75, 75],
  ],
  3: [
    [25, 25],
    [50, 50],
    [75, 75],
  ],
  4: [
    [25, 25],
    [75, 25],
    [25, 75],
    [75, 75],
  ],
  5: [
    [25, 25],
    [75, 25],
    [50, 50],
    [25, 75],
    [75, 75],
  ],
  6: [
    [25, 25],
    [75, 25],
    [25, 50],
    [75, 50],
    [25, 75],
    [75, 75],
  ],
};

function Die({ value, rolling, rollId, reduceMotion }: { value: number; rolling: boolean; rollId: number; reduceMotion: boolean }) {
  const pips = PIP_POSITIONS[value] ?? PIP_POSITIONS[1]!;

  return (
    <motion.div
      key={reduceMotion ? `die-${rollId}` : 'die'}
      className="relative aspect-square w-[clamp(24px,6.5cqmin,40px)] shrink-0 rounded-[18%] border border-white/15 bg-slate-100 shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
      initial={reduceMotion ? { opacity: 0.3 } : { rotate: 0, scale: 1 }}
      animate={
        reduceMotion
          ? { opacity: 1 }
          : rolling
            ? { rotate: [0, -16, 12, -8, 4, 0], scale: [1, 1.08, 0.94, 1.05, 0.98, 1] }
            : { rotate: 0, scale: 1 }
      }
      transition={
        reduceMotion
          ? { duration: 0.25, ease: 'easeOut' }
          : rolling
            ? { duration: TUMBLE_MS / 1000, ease: 'easeInOut', times: [0, 0.2, 0.45, 0.65, 0.85, 1] }
            : { type: 'spring', bounce: 0.15, visualDuration: 0.3 }
      }
    >
      {pips.map(([x, y], i) => (
        <span
          key={i}
          className="absolute block h-[16%] w-[16%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900"
          style={{ left: `${x}%`, top: `${y}%` }}
        />
      ))}
    </motion.div>
  );
}
