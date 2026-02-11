'use client'

import { ScreenshotUploadZone } from '@/components/journal/screenshot-upload-zone'

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
  screenshot_url: string
  screenshot_storage_path: string
}

interface FullEntryFormProps {
  values: FullEntryValues
  symbolError: string | null
  disabled?: boolean
  onChange: (key: keyof FullEntryValues, value: string | boolean) => void
}

export function FullEntryForm({ values, symbolError, disabled = false, onChange }: FullEntryFormProps) {
  const isOptions = values.contract_type === 'call' || values.contract_type === 'put'

  return (
    <div className="space-y-4">
      {/* 1. Core Trade Details - Open by default */}
      <details open className="rounded-lg border border-white/10 bg-white/5">
        <summary className="cursor-pointer p-3 text-sm font-medium text-ivory">Core Trade Details</summary>
        <div className="space-y-3 p-3 pt-0">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Trade Date</label>
              <input
                type="date"
                value={values.trade_date}
                onChange={(e) => onChange('trade_date', e.target.value)}
                className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
                disabled={disabled}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Symbol</label>
              <input
                value={values.symbol}
                onChange={(e) => onChange('symbol', e.target.value.toUpperCase())}
                className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
                placeholder="AAPL"
                disabled={disabled}
              />
              {symbolError && <p className="mt-1 text-xs text-red-400">{symbolError}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Direction</label>
              <select
                value={values.direction}
                onChange={(e) => onChange('direction', e.target.value as 'long' | 'short')}
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
                onChange={(e) => onChange('contract_type', e.target.value as 'stock' | 'call' | 'put')}
                className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
                disabled={disabled}
              >
                <option value="stock">Stock</option>
                <option value="call">Call</option>
                <option value="put">Put</option>
              </select>
            </div>
            <Field value={values.entry_price} label="Entry Price" onChange={(v) => onChange('entry_price', v)} type="number" disabled={disabled} />
            <Field value={values.exit_price} label="Exit Price" onChange={(v) => onChange('exit_price', v)} type="number" disabled={disabled} />
            <Field value={values.position_size} label="Position Size" onChange={(v) => onChange('position_size', v)} type="number" disabled={disabled} />
            <Field value={values.pnl} label="P&L" onChange={(v) => onChange('pnl', v)} type="number" disabled={disabled} />
            <Field value={values.pnl_percentage} label="P&L %" onChange={(v) => onChange('pnl_percentage', v)} type="number" step="0.0001" disabled={disabled} />
          </div>
        </div>
      </details>

      {/* 2. Risk Management */}
      <details className="rounded-lg border border-white/10 bg-white/5">
        <summary className="cursor-pointer p-3 text-sm font-medium text-ivory">Risk Management</summary>
        <div className="space-y-3 p-3 pt-0">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field value={values.stop_loss} label="Stop Loss" onChange={(v) => onChange('stop_loss', v)} type="number" disabled={disabled} />
            <Field value={values.initial_target} label="Initial Target" onChange={(v) => onChange('initial_target', v)} type="number" disabled={disabled} />
            <div className="flex items-end gap-2">
              <input
                id="is-open"
                type="checkbox"
                checked={values.is_open}
                onChange={(e) => onChange('is_open', e.target.checked)}
                disabled={disabled}
                className="h-4 w-4"
              />
              <label htmlFor="is-open" className="text-xs text-muted-foreground">Open position</label>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Strategy</label>
            <input
              value={values.strategy}
              onChange={(e) => onChange('strategy', e.target.value)}
              className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
              placeholder="e.g., Bull flag breakout, VWAP bounce"
              disabled={disabled}
            />
          </div>
        </div>
      </details>

      {/* 3. Options Details - Only show for call/put */}
      {isOptions && (
        <details className="rounded-lg border border-white/10 bg-white/5">
          <summary className="cursor-pointer p-3 text-sm font-medium text-ivory">Options Details</summary>
          <div className="space-y-3 p-3 pt-0">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field value={values.strike_price} label="Strike Price" onChange={(v) => onChange('strike_price', v)} type="number" disabled={disabled} />
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Expiration Date</label>
                <input
                  type="date"
                  value={values.expiration_date}
                  onChange={(e) => onChange('expiration_date', e.target.value)}
                  className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
                  disabled={disabled}
                />
              </div>
              <Field value={values.dte_at_entry} label="DTE at Entry" onChange={(v) => onChange('dte_at_entry', v)} type="number" disabled={disabled} />
              <Field value={values.iv_at_entry} label="IV at Entry (%)" onChange={(v) => onChange('iv_at_entry', v)} type="number" disabled={disabled} />
              <Field value={values.delta_at_entry} label="Delta" onChange={(v) => onChange('delta_at_entry', v)} type="number" step="0.01" disabled={disabled} />
              <Field value={values.theta_at_entry} label="Theta" onChange={(v) => onChange('theta_at_entry', v)} type="number" step="0.01" disabled={disabled} />
              <Field value={values.gamma_at_entry} label="Gamma" onChange={(v) => onChange('gamma_at_entry', v)} type="number" step="0.01" disabled={disabled} />
              <Field value={values.vega_at_entry} label="Vega" onChange={(v) => onChange('vega_at_entry', v)} type="number" step="0.01" disabled={disabled} />
              <Field value={values.underlying_at_entry} label="Underlying at Entry" onChange={(v) => onChange('underlying_at_entry', v)} type="number" disabled={disabled} />
              <Field value={values.underlying_at_exit} label="Underlying at Exit" onChange={(v) => onChange('underlying_at_exit', v)} type="number" disabled={disabled} />
            </div>
          </div>
        </details>
      )}

      {/* 4. Psychology & Discipline */}
      <details className="rounded-lg border border-white/10 bg-white/5">
        <summary className="cursor-pointer p-3 text-sm font-medium text-ivory">Psychology & Discipline</summary>
        <div className="space-y-3 p-3 pt-0">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <MoodSelect value={values.mood_before} label="Mood Before Trade" onChange={(v) => onChange('mood_before', v)} disabled={disabled} />
            <MoodSelect value={values.mood_after} label="Mood After Trade" onChange={(v) => onChange('mood_after', v)} disabled={disabled} />
            <Field value={values.discipline_score} label="Discipline Score (1-5)" onChange={(v) => onChange('discipline_score', v)} type="number" disabled={disabled} />
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Followed Plan?</label>
              <select
                value={values.followed_plan}
                onChange={(e) => onChange('followed_plan', e.target.value as '' | 'yes' | 'no')}
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
                onChange={(e) => onChange('deviation_notes', e.target.value)}
                className="min-h-[80px] w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-ivory"
                placeholder="How did you deviate from your plan?"
                disabled={disabled}
              />
            </div>
          </div>
        </div>
      </details>

      {/* 5. Notes & Lessons */}
      <details className="rounded-lg border border-white/10 bg-white/5">
        <summary className="cursor-pointer p-3 text-sm font-medium text-ivory">Notes & Lessons</summary>
        <div className="space-y-3 p-3 pt-0">
          <TextArea value={values.setup_notes} label="Setup Notes" onChange={(v) => onChange('setup_notes', v)} placeholder="What was your trade setup?" disabled={disabled} />
          <TextArea value={values.execution_notes} label="Execution Notes" onChange={(v) => onChange('execution_notes', v)} placeholder="How did you execute?" disabled={disabled} />
          <TextArea value={values.lessons_learned} label="Lessons Learned" onChange={(v) => onChange('lessons_learned', v)} placeholder="What did you learn?" disabled={disabled} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Tags (comma-separated)</label>
              <input
                value={values.tags}
                onChange={(e) => onChange('tags', e.target.value)}
                className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
                placeholder="breakout, FOMO, revenge-trade"
                disabled={disabled}
              />
            </div>
            <Field value={values.rating} label="Trade Rating (1-5)" onChange={(v) => onChange('rating', v)} type="number" disabled={disabled} />
          </div>
        </div>
      </details>

      {/* 6. Screenshot */}
      <details className="rounded-lg border border-white/10 bg-white/5">
        <summary className="cursor-pointer p-3 text-sm font-medium text-ivory">Screenshot</summary>
        <div className="space-y-3 p-3 pt-0">
          <ScreenshotUploadZone
            currentScreenshotUrl={values.screenshot_url || null}
            onUploadComplete={(url, path) => {
              onChange('screenshot_url', url)
              onChange('screenshot_storage_path', path)
            }}
            onRemove={() => {
              onChange('screenshot_url', '')
              onChange('screenshot_storage_path', '')
            }}
            disabled={disabled}
          />
        </div>
      </details>
    </div>
  )
}

function Field({
  value,
  label,
  onChange,
  type = 'text',
  step,
  disabled,
}: {
  value: string
  label: string
  onChange: (value: string) => void
  type?: string
  step?: string
  disabled?: boolean
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        step={step || (type === 'number' ? '0.01' : undefined)}
        className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
        disabled={disabled}
      />
    </div>
  )
}

function TextArea({
  value,
  label,
  onChange,
  placeholder,
  disabled,
}: {
  value: string
  label: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[90px] w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-ivory placeholder:text-muted-foreground"
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
