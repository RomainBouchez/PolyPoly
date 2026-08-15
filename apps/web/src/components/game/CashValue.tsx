import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

interface CashValueProps {
  cash: number;
  /** Base text color (hex/rgb) to ease back to once the flash settles —
   *  matches whatever Tailwind color class the caller would otherwise use. */
  baseColor: string;
  className?: string;
}

const GAIN_COLOR = '#4ade80';
const LOSS_COLOR = '#f87171';
const FLASH_MS = 900;

/**
 * A cash figure that tints green on a gain / red on a loss and eases back,
 * with a small "+$200" / "-$50" badge that rises and fades alongside it.
 * Driven purely by watching `cash` change — works uniformly for every
 * cash-moving event (rent, tax, purchases, card effects, ...) without
 * needing to know *why* it changed.
 */
export function CashValue({ cash, baseColor, className }: CashValueProps) {
  const reduceMotion = useReducedMotion();
  const prevCash = useRef(cash);
  const idRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flash, setFlash] = useState<{ id: number; delta: number; tint: string } | null>(null);

  useEffect(() => {
    const delta = cash - prevCash.current;
    prevCash.current = cash;
    if (delta === 0) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    idRef.current += 1;
    const id = idRef.current;
    setFlash({ id, delta, tint: delta > 0 ? GAIN_COLOR : LOSS_COLOR });
    timeoutRef.current = setTimeout(() => {
      setFlash((f) => (f?.id === id ? null : f));
    }, FLASH_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cash]);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return (
    <span className="relative inline-flex">
      <motion.span
        className={className}
        animate={{ color: flash ? [flash.tint, flash.tint, baseColor] : baseColor }}
        transition={{ duration: FLASH_MS / 1000, times: [0, 0.18, 1], ease: 'easeOut' }}
      >
        ${cash}
      </motion.span>
      <AnimatePresence>
        {flash && (
          <motion.span
            key={flash.id}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: -16 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.2 : 0.8, ease: 'easeOut' }}
            className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap text-xs font-bold"
            style={{ color: flash.tint }}
          >
            {flash.delta > 0 ? `+$${flash.delta}` : `-$${Math.abs(flash.delta)}`}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
