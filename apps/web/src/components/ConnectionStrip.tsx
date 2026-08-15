import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

const RECOVERED_MS = 2200;

/**
 * Connection status, shown only when there is something to say: red while the
 * socket is down, then green just long enough to confirm it came back. A
 * permanent bar would cost a strip of screen on a phone to tell you what is
 * true almost all the time — but a silent recovery leaves you unsure whether
 * it is safe to act again, which is why the green half exists at all.
 */
export function ConnectionStrip({ connected }: { connected: boolean }) {
  const [showRecovered, setShowRecovered] = useState(false);
  const wasDown = useRef(!connected);

  useEffect(() => {
    if (!connected) {
      wasDown.current = true;
      setShowRecovered(false);
      return;
    }
    if (!wasDown.current) return;
    wasDown.current = false;
    setShowRecovered(true);
    const timer = setTimeout(() => setShowRecovered(false), RECOVERED_MS);
    return () => clearTimeout(timer);
  }, [connected]);

  const visible = !connected || showRecovered;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={connected ? 'connected' : 'disconnected'}
          initial={{ y: '-100%' }}
          animate={{ y: 0 }}
          exit={{ y: '-100%' }}
          transition={{ type: 'spring', bounce: 0, visualDuration: 0.3 }}
          className={`fixed inset-x-0 top-0 z-40 px-3 py-1 text-center text-[11px] font-semibold ${
            connected ? 'bg-emerald-500 text-slate-950' : 'bg-red-500 text-white'
          }`}
        >
          {connected ? 'Connected' : 'Disconnected — reconnecting…'}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
