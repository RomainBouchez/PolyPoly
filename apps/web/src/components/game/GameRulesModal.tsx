import { useMemo, useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { Search, X } from 'lucide-react';
import type { GameState } from '@polypoly/engine';
import { buildRuleSections, matchesQuery } from './rulesContent.js';

const DISMISS_OFFSET = 120;
const DISMISS_VELOCITY = 800;

/** Highlights the matched run so a hit is findable inside a long paragraph. */
function Highlighted({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const at = text.toLowerCase().indexOf(q.toLowerCase());
  if (at === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-[3px] bg-amber-400/30 text-amber-100">{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}

export function GameRulesModal({ state, onClose }: { state: GameState; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const sections = useMemo(() => buildRuleSections(state), [state]);

  // Optional rules that are off still appear, marked — a player asking "how do
  // auctions work" deserves to be told this game has them switched off rather
  // than to find nothing and assume the rules are incomplete.
  const filtered = useMemo(
    () =>
      sections
        .map((section) => ({ ...section, entries: section.entries.filter((e) => matchesQuery(e, query)) }))
        .filter((section) => section.entries.length > 0),
    [sections, query],
  );

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
          <h2 className="text-lg font-bold tracking-tight">📖 Game rules</h2>
          <p className="mt-0.5 text-xs text-slate-400">Everything as it is set up for this game</p>
          <button
            onClick={onClose}
            className="absolute right-2.5 top-2 rounded-full p-1.5 text-slate-400 transition-colors active:bg-white/10 active:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        <div className="shrink-0 border-b border-white/10 px-4 py-2.5">
          <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-inset ring-white/10 focus-within:ring-violet-500/50">
            <Search size={15} className="shrink-0 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the rules…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-600"
            />
            {query && (
              <button onClick={() => setQuery('')} className="shrink-0 rounded-full p-0.5 text-slate-500 active:text-slate-300">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          <AnimatePresence mode="popLayout">
            {filtered.length === 0 ? (
              <motion.p
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-8 text-center text-sm text-slate-500"
              >
                Nothing matches “{query}”.
              </motion.p>
            ) : (
              filtered.map((section) => (
                <motion.section
                  key={section.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="mb-4 last:mb-0"
                >
                  <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <span className="text-sm leading-none">{section.icon}</span>
                    {section.title}
                  </h3>
                  <div className="space-y-1.5">
                    {section.entries.map((entry) => {
                      const off = entry.flag ? !state.config[entry.flag] : false;
                      return (
                        <div
                          key={entry.title}
                          className={`rounded-xl bg-white/5 p-2.5 ring-1 ring-inset ring-white/10 ${off ? 'opacity-45' : ''}`}
                        >
                          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
                            {/* Wrapped: Highlighted returns three fragments, and
                                as bare children of a flex row each becomes its
                                own item, so the gap would open up inside the
                                word around the match. */}
                            <span>
                              <Highlighted text={entry.title} query={query} />
                            </span>
                            {off && (
                              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-400">
                                off
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 text-[13px] leading-snug text-slate-300">
                            <Highlighted text={entry.body} query={query} />
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </motion.section>
              ))
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
