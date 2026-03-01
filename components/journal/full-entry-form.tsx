'use client'

import { ScreenshotUploadZone } from '@/components/journal/screenshot-upload-zone'
import { DatePickerField } from '@/components/journal/date-picker-field'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

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

const fieldInputClassName = 'h-10 border-white/10 bg-black/20 text-sm text-ivory placeholder:text-muted-foreground focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50'
const fieldSelectClassName = 'h-10 border-white/10 bg-black/20 text-sm text-ivory focus:ring-2 focus:ring-emerald-500/50'
const textAreaClassName = 'min-h-[90px] border-white/10 bg-black/20 text-sm text-ivory placeholder:text-muted-foreground transition-colors duration-300 hover:border-white/20 focus-visible:ring-2 focus-visible:ring-emerald-500/50'

export function FullEntryForm({ values, symbolError, disabled = false, onChange }: FullEntryFormProps) {
  const isOptions = values.contract_type === 'call' || values.contract_type === 'put'

  return (
    <div className="space-y-4">
      <details open className="rounded-lg border border-white/10 bg-white/5">
        <summary className="cursor-pointer p-3 text-sm font-medium text-ivory">Core Trade Details</summary>
        <div className="space-y-3 p-3 pt-0">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Trade Date</label>
              <DatePickerField
                value={values.trade_date || null}
                placeholder="Select trade date"
                ariaLabel="Trade date"
                onChange={(date) => onChange('trade_date', date ?? '')}
                disabled={disabled}
                className="w-full"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Symbol</label>
              <Input
                value={values.symbol}
                onChange={(event) => onChange('symbol', event.target.value.toUpperCase())}
                className={fieldInputClassName}
                placeholder="AAPL"
                disabled={disabled}
              />
              {symbolError && <p className="mt-1 text-xs text-red-400">{symbolError}</p>}
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Direction</label>
              <Select
                value={values.direction}
                onValueChange={(value) => onChange('direction', value as 'long' | 'short')}
                disabled={disabled}
              >
                <SelectTrigger className={fieldSelectClassName} aria-label="Direction">
                  <SelectValue placeholder="Direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">Long</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Contract Type</label>
              <Select
                value={values.contract_type}
                onValueChange={(value) => onChange('contract_type', value as 'stock' | 'call' | 'put')}
                disabled={disabled}
              >
                <SelectTrigger className={fieldSelectClassName} aria-label="Contract Type">
                  <SelectValue placeholder="Contract type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="put">Put</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Field value={values.entry_price} label="Entry Price" onChange={(value) => onChange('entry_price', value)} type="number" disabled={disabled} />
            <Field value={values.exit_price} label="Exit Price" onChange={(value) => onChange('exit_price', value)} type="number" disabled={disabled} />
            <Field value={values.position_size} label="Position Size" onChange={(value) => onChange('position_size', value)} type="number" disabled={disabled} />
            <Field value={values.pnl} label="P&L" onChange={(value) => onChange('pnl', value)} type="number" disabled={disabled} />
            <Field value={values.pnl_percentage} label="P&L %" onChange={(value) => onChange('pnl_percentage', value)} type="number" step="0.0001" disabled={disabled} />
          </div>
        </div>
      </details>

      <details className="rounded-lg border border-white/10 bg-white/5">
        <summary className="cursor-pointer p-3 text-sm font-medium text-ivory">Risk Management</summary>
        <div className="space-y-3 p-3 pt-0">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field value={values.stop_loss} label="Stop Loss" onChange={(value) => onChange('stop_loss', value)} type="number" disabled={disabled} />
            <Field value={values.initial_target} label="Initial Target" onChange={(value) => onChange('initial_target', value)} type="number" disabled={disabled} />

            <div className="flex items-end gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2">
              <Checkbox
                id="is-open"
                checked={values.is_open}
                onCheckedChange={(checked) => onChange('is_open', checked === true)}
                disabled={disabled}
              />
              <label htmlFor="is-open" className="text-xs text-muted-foreground">Open position</label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Strategy</label>
            <Input
              value={values.strategy}
              onChange={(event) => onChange('strategy', event.target.value)}
              className={fieldInputClassName}
              placeholder="e.g., Bull flag breakout, VWAP bounce"
              disabled={disabled}
            />
          </div>
        </div>
      </details>

      {isOptions && (
        <details className="rounded-lg border border-white/10 bg-white/5">
          <summary className="cursor-pointer p-3 text-sm font-medium text-ivory">Options Details</summary>
          <div className="space-y-3 p-3 pt-0">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field value={values.strike_price} label="Strike Price" onChange={(value) => onChange('strike_price', value)} type="number" disabled={disabled} />

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Expiration Date</label>
                <DatePickerField
                  value={values.expiration_date || null}
                  placeholder="Select expiration"
                  ariaLabel="Expiration date"
                  onChange={(date) => onChange('expiration_date', date ?? '')}
                  disabled={disabled}
                />
              </div>

              <Field value={values.dte_at_entry} label="DTE at Entry" onChange={(value) => onChange('dte_at_entry', value)} type="number" disabled={disabled} />
              <Field value={values.iv_at_entry} label="IV at Entry (%)" onChange={(value) => onChange('iv_at_entry', value)} type="number" disabled={disabled} />
              <Field value={values.delta_at_entry} label="Delta" onChange={(value) => onChange('delta_at_entry', value)} type="number" step="0.01" disabled={disabled} />
              <Field value={values.theta_at_entry} label="Theta" onChange={(value) => onChange('theta_at_entry', value)} type="number" step="0.01" disabled={disabled} />
              <Field value={values.gamma_at_entry} label="Gamma" onChange={(value) => onChange('gamma_at_entry', value)} type="number" step="0.01" disabled={disabled} />
              <Field value={values.vega_at_entry} label="Vega" onChange={(value) => onChange('vega_at_entry', value)} type="number" step="0.01" disabled={disabled} />
              <Field value={values.underlying_at_entry} label="Underlying at Entry" onChange={(value) => onChange('underlying_at_entry', value)} type="number" disabled={disabled} />
              <Field value={values.underlying_at_exit} label="Underlying at Exit" onChange={(value) => onChange('underlying_at_exit', value)} type="number" disabled={disabled} />
            </div>
          </div>
        </details>
      )}

      <details className="rounded-lg border border-white/10 bg-white/5">
        <summary className="cursor-pointer p-3 text-sm font-medium text-ivory">Psychology & Discipline</summary>
        <div className="space-y-3 p-3 pt-0">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <MoodSelect value={values.mood_before} label="Mood Before Trade" onChange={(value) => onChange('mood_before', value)} disabled={disabled} />
            <MoodSelect value={values.mood_after} label="Mood After Trade" onChange={(value) => onChange('mood_after', value)} disabled={disabled} />
            <Field value={values.discipline_score} label="Discipline Score (1-5)" onChange={(value) => onChange('discipline_score', value)} type="number" disabled={disabled} />

            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Followed Plan?</label>
              <Select
                value={values.followed_plan || 'unset'}
                onValueChange={(value) => onChange('followed_plan', value === 'unset' ? '' : value as '' | 'yes' | 'no')}
                disabled={disabled}
              >
                <SelectTrigger className={fieldSelectClassName} aria-label="Followed Plan">
                  <SelectValue placeholder="Followed plan?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">Not set</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-muted-foreground">Deviation Notes</label>
              <Textarea
                value={values.deviation_notes}
                onChange={(event) => onChange('deviation_notes', event.target.value)}
                className={textAreaClassName}
                placeholder="How did you deviate from your plan?"
                disabled={disabled}
              />
            </div>
          </div>
        </div>
      </details>

      <details className="rounded-lg border border-white/10 bg-white/5">
        <summary className="cursor-pointer p-3 text-sm font-medium text-ivory">Notes & Lessons</summary>
        <div className="space-y-3 p-3 pt-0">
          <TextArea value={values.setup_notes} label="Setup Notes" onChange={(value) => onChange('setup_notes', value)} placeholder="What was your trade setup?" disabled={disabled} />
          <TextArea value={values.execution_notes} label="Execution Notes" onChange={(value) => onChange('execution_notes', value)} placeholder="How did you execute?" disabled={disabled} />
          <TextArea value={values.lessons_learned} label="Lessons Learned" onChange={(value) => onChange('lessons_learned', value)} placeholder="What did you learn?" disabled={disabled} />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Tags (comma-separated)</label>
              <Input
                value={values.tags}
                onChange={(event) => onChange('tags', event.target.value)}
                className={fieldInputClassName}
                placeholder="breakout, FOMO, revenge-trade"
                disabled={disabled}
              />
            </div>
            <Field value={values.rating} label="Trade Rating (1-5)" onChange={(value) => onChange('rating', value)} type="number" disabled={disabled} />
          </div>
        </div>
      </details>

      <details className="rounded-lg border border-white/10 bg-white/5">
        <summary className="cursor-pointer p-3 text-sm font-medium text-ivory">Screenshot</summary>
        <div className="space-y-3 p-3 pt-0">
          <ScreenshotUploadZone
            currentScreenshotUrl={values.screenshot_url || null}
            onUploadComplete={(url, path) => {
              onChange('screenshot_url', url)
              onChange('screenshot_storage_path', path)
            }}
            onApplyExtractedPosition={(position) => {
              onChange('symbol', position.symbol)
              onChange('contract_type', position.type === 'stock' ? 'stock' : position.type)
              onChange('position_size', String(Math.abs(position.quantity || 1)))
              if (position.quantity < 0) {
                onChange('direction', 'short')
              }
              if (position.entryPrice > 0) {
                onChange('entry_price', String(position.entryPrice))
              }
              if (typeof position.strike === 'number') {
                onChange('strike_price', String(position.strike))
              }
              if (typeof position.expiry === 'string' && position.expiry.length >= 10) {
                onChange('expiration_date', position.expiry.slice(0, 10))
              }
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
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        inputMode={type === 'number' ? 'decimal' : undefined}
        step={step || (type === 'number' ? '0.01' : undefined)}
        className={fieldInputClassName}
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
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={textAreaClassName}
        disabled={disabled}
      />
    </div>
  )
}

function MoodSelect({
  value,
  label,
  onChange,
  disabled,
}: {
  value: string
  label: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <Select
        value={value || 'unset'}
        onValueChange={(nextValue) => onChange(nextValue === 'unset' ? '' : nextValue)}
        disabled={disabled}
      >
        <SelectTrigger className={fieldSelectClassName} aria-label={label}>
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unset">Not set</SelectItem>
          <SelectItem value="confident">Confident</SelectItem>
          <SelectItem value="neutral">Neutral</SelectItem>
          <SelectItem value="anxious">Anxious</SelectItem>
          <SelectItem value="frustrated">Frustrated</SelectItem>
          <SelectItem value="excited">Excited</SelectItem>
          <SelectItem value="fearful">Fearful</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
