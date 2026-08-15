import type { EndCondition, GameConfig } from '@polypoly/shared';
import { Toggle } from './Toggle.js';

interface RulesPanelProps {
  config: GameConfig;
  editable: boolean;
  onChange: (patch: Partial<GameConfig>) => void;
}

export function RulesPanel({ config, editable, onChange }: RulesPanelProps) {
  const set = (patch: Partial<GameConfig>) => editable && onChange(patch);

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">Toggles</h3>
        <div className="divide-y divide-slate-800">
          <Toggle
            label="Private room"
            description="Private rooms can be accessed using the room URL only"
            checked={config.privateRoom}
            disabled={!editable}
            onChange={(v) => set({ privateRoom: v })}
          />
          <Toggle
            label="Allow bots to join"
            description="Not available yet — bots are coming in a future update"
            checked={false}
            disabled
            onChange={() => {}}
          />
          <Toggle
            label="x2 rent on full-set properties"
            description="If a player owns a full property set, the base rent payment will be doubled"
            checked={config.doubleRentOnFullSet}
            disabled={!editable}
            onChange={(v) => set({ doubleRentOnFullSet: v })}
          />
          <Toggle
            label="Vacation cash"
            description="Taxes and bank payments accumulate on Vacation; landing there collects the pot"
            checked={config.vacationCash}
            disabled={!editable}
            onChange={(v) => set({ vacationCash: v })}
          />
          <Toggle
            label="Auction"
            description="If someone skips buying a property, it goes to auction among the other players"
            checked={config.auction}
            disabled={!editable}
            onChange={(v) => set({ auction: v })}
          />
          <Toggle
            label="Don't collect rent while in prison"
            description="Rent isn't collected when landing on properties whose owners are in prison"
            checked={config.noRentInPrison}
            disabled={!editable}
            onChange={(v) => set({ noRentInPrison: v })}
          />
          <Toggle
            label="Mortgage"
            description="Mortgage properties to earn 50% of their cost, but they won't earn rent"
            checked={config.mortgage}
            disabled={!editable}
            onChange={(v) => set({ mortgage: v })}
          />
          <Toggle
            label="Even build"
            description="Houses and hotels must be built up and sold off evenly within a set"
            checked={config.evenBuild}
            disabled={!editable}
            onChange={(v) => set({ evenBuild: v })}
          />
          <Toggle
            label="Limited house supply"
            description="The bank only has 32 houses and 12 hotels — building can stall on scarcity"
            checked={config.limitedHouseSupply}
            disabled={!editable}
            onChange={(v) => set({ limitedHouseSupply: v })}
          />
          <Toggle
            label="Health mode"
            description="Some tiles cost or restore health, rolling 1-1 makes you sick and pays hospital owners, and Go withholds cash while you're sick"
            checked={config.healthMode}
            disabled={!editable}
            onChange={(v) => set({ healthMode: v })}
          />
          <Toggle
            label="Squat cards"
            description="Chance/Community cards can grant a free stay on a matching opponent property — once per opponent, blocked while sick"
            checked={config.squatCards}
            disabled={!editable}
            onChange={(v) => set({ squatCards: v })}
          />
        </div>
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">Settings</h3>
        <div className="space-y-4">
          <NumberField
            label="Maximum players"
            description="How many players can join the game"
            value={config.maxPlayers}
            min={2}
            max={8}
            editable={editable}
            onChange={(v) => set({ maxPlayers: v })}
          />
          <NumberField
            label="Starting cash"
            description="Adjust how much money players start the game with"
            value={config.startingCash}
            min={200}
            max={10000}
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
                : type === 'turn-limit'
                  ? { type, turns: 40 }
                  : { type, minutes: 90 };
            onChange({ endCondition: next });
          }}
          className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-slate-100 disabled:cursor-not-allowed"
        >
          <option value="last-standing">Last player standing</option>
          <option value="turn-limit">Turn limit</option>
          <option value="time-limit">Time limit</option>
        </select>
        {condition.type === 'turn-limit' && (
          <input
            type="number"
            value={condition.turns}
            min={5}
            disabled={!editable}
            onChange={(e) => onChange({ endCondition: { type: 'turn-limit', turns: Number(e.target.value) } })}
            className="w-20 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-slate-100 disabled:cursor-not-allowed"
          />
        )}
        {condition.type === 'turn-limit' && <span className="text-sm text-slate-400">turns, richest wins</span>}
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
