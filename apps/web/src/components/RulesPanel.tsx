import type { EndCondition, GameConfig } from '@polypoly/shared';
import { Toggle } from './Toggle.js';

interface RulesPanelProps {
  config: GameConfig;
  editable: boolean;
  onChange: (patch: Partial<GameConfig>) => void;
}

/** Grouped rather than one flat list: at sixteen switches a flat column gives
 *  no sense of which ones matter for a normal game and which change it into a
 *  different one. */
const GROUPS: { title: string; blurb: string; toggles: { key: keyof GameConfig; label: string; description: string }[] }[] = [
  {
    title: 'Core rules',
    blurb: 'The familiar board game. Most tables leave these on.',
    toggles: [
      {
        key: 'doubleRentOnFullSet',
        label: 'Double rent on a full set',
        description: 'Owning every property of one country doubles their rent until you build',
      },
      { key: 'auction', label: 'Auctions', description: 'Declining a purchase puts the tile up for bidding instead of leaving it' },
      { key: 'mortgage', label: 'Mortgages', description: 'Raise cash against a property; it earns nothing until you buy it back' },
      { key: 'evenBuild', label: 'Even building', description: 'Houses must go up and come down evenly across a set' },
    ],
  },
  {
    title: 'Scarcity',
    blurb: 'Make money and materials genuinely run out.',
    toggles: [
      {
        key: 'limitedHouseSupply',
        label: 'Limited house supply',
        description: 'The bank holds only 32 houses and 12 hotels — building can stall, and blocking a leader becomes a tactic',
      },
      { key: 'vacationCash', label: 'Vacation pot', description: 'Taxes and fees pile up on the Vacation tile for whoever lands on it' },
      { key: 'noRentInPrison', label: 'No rent from jail', description: 'A jailed player collects nothing on anything they own' },
      {
        key: 'oneTradeAtATime',
        label: 'One trade at a time',
        description: 'A player can only be in one pending trade, so trading cannot crowd out the game',
      },
    ],
  },
  {
    title: 'Extra modes',
    blurb: 'Each of these changes how the game plays. Off by default.',
    toggles: [
      {
        key: 'healthMode',
        label: 'Health',
        description: 'Tiles cost or restore health, 1-1 makes you ill and pays hospital owners, jail wears you down, and Go pays half while sick',
      },
      {
        key: 'squatCards',
        label: 'Squat cards',
        description: 'A card can grant one free stay on a matching opponent property — once per opponent',
      },
      {
        key: 'allianceMode',
        label: 'Alliances',
        description: 'A card pairs two players for three turns: rent between them is halved, and with health on they can pass health',
      },
      {
        key: 'rainyDay',
        label: 'Weather',
        description: 'Rent doubles for a turn or two early on; the Sunny tile cuts the rain short and halves rent instead',
      },
      {
        key: 'hostageMode',
        label: 'Hostages',
        description: 'From jail you can freeze one opponent property, earning its owner nothing until you are out',
      },
    ],
  },
];

export function RulesPanel({ config, editable, onChange }: RulesPanelProps) {
  const set = (patch: Partial<GameConfig>) => editable && onChange(patch);

  return (
    <div className="space-y-6">
      {GROUPS.map((group) => (
        <section key={group.title}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{group.title}</h3>
          <p className="mb-1 text-xs text-slate-500">{group.blurb}</p>
          <div className="divide-y divide-slate-800">
            {group.toggles.map((t) => (
              <Toggle
                key={t.key}
                label={t.label}
                description={t.description}
                checked={config[t.key] as boolean}
                disabled={!editable}
                onChange={(v) => set({ [t.key]: v } as Partial<GameConfig>)}
              />
            ))}
          </div>
        </section>
      ))}

      <section>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">Table</h3>
        <div className="space-y-3">
          <NumberField
            label="Maximum players"
            description="How many seats this game has"
            value={config.maxPlayers}
            min={2}
            max={8}
            editable={editable}
            onChange={(v) => set({ maxPlayers: v })}
          />
          <NumberField
            label="Starting cash"
            description="What everyone begins with"
            value={config.startingCash}
            min={500}
            max={5000}
            step={100}
            editable={editable}
            onChange={(v) => set({ startingCash: v })}
          />
          <EndConditionField config={config} editable={editable} onChange={onChange} />
        </div>
      </section>
    </div>
  );
}

function NumberField({
  label,
  description,
  value,
  min,
  max,
  step = 1,
  editable,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  editable: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 ${!editable ? 'opacity-70' : ''}`}>
      <div>
        <div className="font-medium text-slate-100">{label}</div>
        <div className="text-sm text-slate-400">{description}</div>
      </div>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={!editable}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-right text-slate-100 disabled:cursor-not-allowed"
      />
    </div>
  );
}

function EndConditionField({ config, editable, onChange }: RulesPanelProps) {
  const condition = config.endCondition;

  return (
    <div className={`space-y-2 ${!editable ? 'opacity-70' : ''}`}>
      <div>
        <div className="font-medium text-slate-100">End condition</div>
        <div className="text-sm text-slate-400">How the game decides a winner</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={condition.type}
          disabled={!editable}
          onChange={(e) => {
            const type = e.target.value as EndCondition['type'];
            const next: EndCondition =
              type === 'last-standing'
                ? { type }
                : type === 'round-limit'
                  ? { type, rounds: 20 }
                  : { type, minutes: 90 };
            onChange({ endCondition: next });
          }}
          className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-slate-100 disabled:cursor-not-allowed"
        >
          <option value="last-standing">Last player standing</option>
          <option value="round-limit">Round limit</option>
          <option value="time-limit">Time limit</option>
        </select>
        {condition.type === 'round-limit' && (
          <input
            type="number"
            value={condition.rounds}
            min={3}
            disabled={!editable}
            onChange={(e) => onChange({ endCondition: { type: 'round-limit', rounds: Number(e.target.value) } })}
            className="w-20 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-slate-100 disabled:cursor-not-allowed"
          />
        )}
        {condition.type === 'round-limit' && (
          <span className="text-sm text-slate-400">rounds — one round is everyone playing once — richest wins</span>
        )}
        {condition.type === 'time-limit' && (
          <input
            type="number"
            value={condition.minutes}
            min={10}
            disabled={!editable}
            onChange={(e) => onChange({ endCondition: { type: 'time-limit', minutes: Number(e.target.value) } })}
            className="w-20 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-slate-100 disabled:cursor-not-allowed"
          />
        )}
        {condition.type === 'time-limit' && <span className="text-sm text-slate-400">minutes, richest wins</span>}
      </div>
    </div>
  );
}
