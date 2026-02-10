'use client'

interface FullEntryValues {
  trade_date: string
  symbol: string
  direction: 'long' | 'short'
  contract_type: 'stock' | 'call' | 'put'
  entry_price: string
  exit_price: string
  position_size: string
  pnl: string
  pnl_percentage: string
  is_open: boolean
  stop_loss: string
  initial_target: string
  strategy: string
  strike_price: string
  expiration_date: string
  dte_at_entry: string
  iv_at_entry: string
  delta_at_entry: string
  theta_at_entry: string
  gamma_at_entry: string
  vega_at_entry: string
  underlying_at_entry: string
  underlying_at_exit: string
  mood_before: string
  mood_after: string
  discipline_score: string
  followed_plan: '' | 'yes' | 'no'
  deviation_notes: string
  setup_notes: string
  execution_notes: string
  lessons_learned: string
  tags: string
  rating: string
}

interface FullEntryFormProps {
  values: FullEntryValues
  symbolError: string | null
  disabled?: boolean
  onChange: (key: keyof FullEntryValues, value: string | boolean) => void
}

export function FullEntryForm({ values, symbolError, disabled = false, onChange }: FullEntryFormProps) {
  return (
    <div className="space-y-4">
      <details open className="rounded-lg border border-white/10 bg-white/5 p-3">
        <summary className="cursor-pointer text-sm font-medium text-ivory">Trade Details</summary>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Trade Date</label>
            <input
              type="date"
              value={values.trade_date}
              onChange={(event) => onChange('trade_date', event.target.value)}
              className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
              disabled={disabled}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Symbol</label>
            <input
              value={values.symbol}
              onChange={(event) => onChange('symbol', event.target.value.toUpperCase())}
              className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
              placeholder="AAPL"
              disabled={disabled}
            />
            {symbolError ? <p className="mt-1 text-xs text-red-400">{symbolError}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Direction</label>
            <select
              value={values.direction}
              onChange={(event) => onChange('direction', event.target.value as 'long' | 'short')}
              className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
              disabled={disabled}
            >
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Contract Type</label>
            <select
              value={values.contract_type}
              onChange={(event) => onChange('contract_type', event.target.value as 'stock' | 'call' | 'put')}
              className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
              disabled={disabled}
            >
              <option value="stock">Stock</option>
              <option value="call">Call</option>
              <option value="put">Put</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Entry Price</label>
            <input
              value={values.entry_price}
              onChange={(event) => onChange('entry_price', event.target.value)}
              type="number"
              step="0.01"
              className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
              disabled={disabled}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Exit Price</label>
            <input
              value={values.exit_price}
              onChange={(event) => onChange('exit_price', event.target.value)}
              type="number"
              step="0.01"
              className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
              disabled={disabled}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Position Size</label>
            <input
              value={values.position_size}
              onChange={(event) => onChange('position_size', event.target.value)}
              type="number"
              step="0.01"
              className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
              disabled={disabled}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">P&L</label>
            <input
              value={values.pnl}
              onChange={(event) => onChange('pnl', event.target.value)}
              type="number"
              step="0.01"
              className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
              disabled={disabled}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">P&L %</label>
            <input
              value={values.pnl_percentage}
              onChange={(event) => onChange('pnl_percentage', event.target.value)}
              type="number"
              step="0.0001"
              className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
              disabled={disabled}
            />
          </div>

          <div className="flex items-end gap-2">
            <input
              id="is-open"
              type="checkbox"
              checked={values.is_open}
              onChange={(event) => onChange('is_open', event.target.checked)}
              disabled={disabled}
            />
            <label htmlFor="is-open" className="text-xs text-muted-foreground">Open position</label>
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Stop Loss</label>
            <input
              value={values.stop_loss}
              onChange={(event) => onChange('stop_loss', event.target.value)}
              type="number"
              step="0.01"
              className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
              disabled={disabled}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Initial Target</label>
            <input
              value={values.initial_target}
              onChange={(event) => onChange('initial_target', event.target.value)}
              type="number"
              step="0.01"
              className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
              disabled={disabled}
            />
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-xs text-muted-foreground">Strategy</label>
            <input
              value={values.strategy}
              onChange={(event) => onChange('strategy', event.target.value)}
              className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
              disabled={disabled}
            />
          </div>
        </div>
      </details>

      <details className="rounded-lg border border-white/10 bg-white/5 p-3">
        <summary className="cursor-pointer text-sm font-medium text-ivory">Options</summary>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field value={values.strike_price} label="Strike Price" onChange={(v) => onChange('strike_price', v)} disabled={disabled} />
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Expiration</label>
            <input
              value={values.expiration_date}
              onChange={(event) => onChange('expiration_date', event.target.value)}
              type="date"
              className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
              disabled={disabled}
            />
          </div>
          <Field value={values.dte_at_entry} label="DTE at Entry" onChange={(v) => onChange('dte_at_entry', v)} disabled={disabled} />
          <Field value={values.iv_at_entry} label="IV at Entry" onChange={(v) => onChange('iv_at_entry', v)} disabled={disabled} />
          <Field value={values.delta_at_entry} label="Delta" onChange={(v) => onChange('delta_at_entry', v)} disabled={disabled} />
          <Field value={values.theta_at_entry} label="Theta" onChange={(v) => onChange('theta_at_entry', v)} disabled={disabled} />
          <Field value={values.gamma_at_entry} label="Gamma" onChange={(v) => onChange('gamma_at_entry', v)} disabled={disabled} />
          <Field value={values.vega_at_entry} label="Vega" onChange={(v) => onChange('vega_at_entry', v)} disabled={disabled} />
          <Field value={values.underlying_at_entry} label="Underlying at Entry" onChange={(v) => onChange('underlying_at_entry', v)} disabled={disabled} />
          <Field value={values.underlying_at_exit} label="Underlying at Exit" onChange={(v) => onChange('underlying_at_exit', v)} disabled={disabled} />
        </div>
      </details>

      <details className="rounded-lg border border-white/10 bg-white/5 p-3">
        <summary className="cursor-pointer text-sm font-medium text-ivory">Psychology</summary>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <MoodSelect value={values.mood_before} label="Mood Before" onChange={(v) => onChange('mood_before', v)} disabled={disabled} />
          <MoodSelect value={values.mood_after} label="Mood After" onChange={(v) => onChange('mood_after', v)} disabled={disabled} />
          <Field value={values.discipline_score} label="Discipline (1-5)" onChange={(v) => onChange('discipline_score', v)} disabled={disabled} />

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Followed Plan</label>
            <select
              value={values.followed_plan}
              onChange={(event) => onChange('followed_plan', event.target.value as '' | 'yes' | 'no')}
              className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
              disabled={disabled}
            >
              <option value="">Not set</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-muted-foreground">Deviation Notes</label>
            <textarea
              value={values.deviation_notes}
              onChange={(event) => onChange('deviation_notes', event.target.value)}
              className="min-h-[80px] w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-ivory"
              disabled={disabled}
            />
          </div>
        </div>
      </details>

      <details className="rounded-lg border border-white/10 bg-white/5 p-3">
        <summary className="cursor-pointer text-sm font-medium text-ivory">Notes</summary>

        <div className="mt-3 space-y-3">
          <TextArea value={values.setup_notes} label="Setup Notes" onChange={(v) => onChange('setup_notes', v)} disabled={disabled} />
          <TextArea value={values.execution_notes} label="Execution Notes" onChange={(v) => onChange('execution_notes', v)} disabled={disabled} />
          <TextArea value={values.lessons_learned} label="Lessons Learned" onChange={(v) => onChange('lessons_learned', v)} disabled={disabled} />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Tags (comma-separated)</label>
              <input
                value={values.tags}
                onChange={(event) => onChange('tags', event.target.value)}
                className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
                disabled={disabled}
              />
            </div>
            <Field value={values.rating} label="Rating (1-5)" onChange={(v) => onChange('rating', v)} disabled={disabled} />
          </div>
        </div>
      </details>
    </div>
  )
}

function Field({ value, label, onChange, disabled }: { value: string, label: string, onChange: (value: string) => void, disabled?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
        disabled={disabled}
      />
    </div>
  )
}

function TextArea({ value, label, onChange, disabled }: { value: string, label: string, onChange: (value: string) => void, disabled?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[90px] w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-ivory"
        disabled={disabled}
      />
    </div>
  )
}

function MoodSelect({ value, label, onChange, disabled }: { value: string, label: string, onChange: (value: string) => void, disabled?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
        disabled={disabled}
      >
        <option value="">Not set</option>
        <option value="confident">Confident</option>
        <option value="neutral">Neutral</option>
        <option value="anxious">Anxious</option>
        <option value="frustrated">Frustrated</option>
        <option value="excited">Excited</option>
        <option value="fearful">Fearful</option>
      </select>
    </div>
  )
}
