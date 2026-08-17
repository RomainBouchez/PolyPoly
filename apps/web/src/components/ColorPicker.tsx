import { motion } from 'motion/react';
import { COLOR_PALETTE } from '@polypoly/shared';

interface ColorPickerProps {
  /** Colours already claimed by other seats — shown but not selectable.
   *  The caller's own current colour should not be included here, so they
   *  can still see it highlighted rather than greyed out. */
  takenColors: ReadonlySet<string>;
  selected?: string | null;
  onSelect: (color: string) => void;
}

/** A row of colour swatches, shared by the join screen and the lobby so the
 *  two pickers can never drift apart. Taken colours are shown dimmed rather
 *  than hidden, so a player sees at a glance what is still free instead of
 *  picking blind and getting bounced by the server. */
export function ColorPicker({ takenColors, selected, onSelect }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {COLOR_PALETTE.map((color) => {
        const taken = takenColors.has(color) && color !== selected;
        return (
          <motion.button
            key={color}
            type="button"
            disabled={taken}
            onClick={() => onSelect(color)}
            whileTap={taken ? undefined : { scale: 0.88 }}
            transition={{ type: 'spring', bounce: 0, visualDuration: 0.2 }}
            aria-label={taken ? 'Colour already taken' : 'Choose colour'}
            aria-pressed={color === selected}
            className={`h-9 w-9 shrink-0 rounded-full border-2 ${
              color === selected ? 'border-white' : 'border-transparent'
            } ${taken ? 'cursor-not-allowed opacity-20' : 'cursor-pointer'}`}
            style={{ backgroundColor: color }}
          />
        );
      })}
    </div>
  );
}
