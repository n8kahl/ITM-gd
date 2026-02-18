'use client'

import { useMemo, useState } from 'react'
import Papa from 'papaparse'
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { importTradeRowSchema } from '@/lib/validation/journal-entry'

const BROKERS = [
  { label: 'Generic CSV (Other Broker)', value: 'generic' },
  { label: 'Interactive Brokers', value: 'interactive_brokers' },
  { label: 'Schwab', value: 'schwab' },
  { label: 'Robinhood', value: 'robinhood' },
  { label: 'E*Trade', value: 'etrade' },
  { label: 'Fidelity', value: 'fidelity' },
  { label: 'Webull', value: 'webull' },
] as const
const IMPORT_CHUNK_SIZE = 500
const CLIENT_VALIDATION_SAMPLE_LIMIT = 2_000

interface ImportWizardProps {
  onImported?: () => void
}

interface ParsedRow {
  index: number
  row: Record<string, string>
  valid: boolean
  issues: string[]
}

export function ImportWizard({ onImported }: ImportWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [broker, setBroker] = useState<(typeof BROKERS)[number]['value']>('interactive_brokers')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ inserted: number, duplicates: number, errors: number } | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  const validationPreview = useMemo<ParsedRow[]>(() => {
    return rows.slice(0, 20).map((row, index) => {
      const parsed = importTradeRowSchema.safeParse(row)
      return {
        index,
        row,
        valid: parsed.success,
        issues: parsed.success
          ? []
          : parsed.error.issues.map((issue) => issue.message),
      }
    })
  }, [rows])

  const errorCount = useMemo(() => {
    return rows.slice(0, CLIENT_VALIDATION_SAMPLE_LIMIT).reduce((count, row) => {
      const parsed = importTradeRowSchema.safeParse(row)
      return count + (parsed.success ? 0 : 1)
    }, 0)
  }, [rows])

  const headerColumns = useMemo(() => {
    if (rows.length === 0) return []
    return Object.keys(rows[0]).slice(0, 6)
  }, [rows])

  const parseFile = (file: File) => {
    setParsing(true)
    setParseError(null)
    setResult(null)

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.replace(/^\uFEFF/, '').trim(),
      complete: (results: Papa.ParseResult<Record<string, string>>) => {
        setParsing(false)
        const parsedRows = (results.data ?? []).filter(
          (row: Record<string, string>) => (
            Object.keys(row).length > 0
            && Object.values(row).some((value) => (
              typeof value === 'string'
                ? value.trim().length > 0
                : value != null
            ))
          ),
        )

        if (parsedRows.length === 0) {
          setParseError('No CSV rows found in the selected file.')
          setRows([])
          return
        }

        setRows(parsedRows)
        setStep(3)
      },
      error: (error) => {
        setParsing(false)
        setParseError(error instanceof Error ? error.message : 'Failed to parse CSV file.')
        setRows([])
      },
    })
  }

  const runImport = async () => {
    if (rows.length === 0 || importing) return

    setImporting(true)
    setParseError(null)

    try {
      let inserted = 0
      let duplicates = 0
      let errors = 0

      const totalChunks = Math.ceil(rows.length / IMPORT_CHUNK_SIZE)

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
        const chunkStart = chunkIndex * IMPORT_CHUNK_SIZE
        const chunkRows = rows.slice(chunkStart, chunkStart + IMPORT_CHUNK_SIZE)

        const response = await fetch('/api/members/journal/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            broker,
            fileName: fileName || 'journal-import.csv',
            rows: chunkRows,
          }),
        })

        const payload = await response.json()
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || `Import failed on chunk ${chunkIndex + 1}/${totalChunks}`)
        }

        inserted += payload.data?.inserted ?? 0
        duplicates += payload.data?.duplicates ?? 0
        errors += payload.data?.errors ?? 0
      }

      setResult({
        inserted,
        duplicates,
        errors,
      })
      setStep(4)
      onImported?.()
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
        <h3 className="text-sm font-medium text-ivory">Import Wizard</h3>
      </div>

      <div className="text-xs text-muted-foreground">
        Step {step} of 4
      </div>

      {step === 1 ? (
        <div className="space-y-3">
          <label className="block text-xs text-muted-foreground">Broker</label>
          <select
            value={broker}
            onChange={(event) => setBroker(event.target.value as (typeof BROKERS)[number]['value'])}
            className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
          >
            {BROKERS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="h-10 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Continue
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3">
          <label className="flex h-12 cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory">
            <Upload className="h-4 w-4" />
            <span className="truncate">{fileName || 'Select CSV file'}</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                setFileName(file.name)
                parseFile(file)
              }}
            />
          </label>

          {parsing ? (
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Parsing CSV...
            </div>
          ) : null}

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="h-10 rounded-md border border-white/10 px-4 text-sm text-ivory hover:bg-white/5"
            >
              Back
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            {rows.length} rows parsed. {errorCount} rows currently invalid
            {rows.length > CLIENT_VALIDATION_SAMPLE_LIMIT ? ` (sampled from first ${CLIENT_VALIDATION_SAMPLE_LIMIT.toLocaleString()} rows).` : '.'}
            {rows.length > IMPORT_CHUNK_SIZE ? ` Import will run in ${Math.ceil(rows.length / IMPORT_CHUNK_SIZE)} batches.` : ''}
          </div>

          <div className="max-h-64 overflow-auto rounded-md border border-white/10">
            <table className="w-full text-xs">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-2 py-2 text-left text-muted-foreground">#</th>
                  {headerColumns.map((column) => (
                    <th key={column} className="px-2 py-2 text-left text-muted-foreground">{column}</th>
                  ))}
                  <th className="px-2 py-2 text-left text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {validationPreview.map((item) => (
                  <tr key={item.index} className="border-t border-white/10">
                    <td className="px-2 py-1 text-muted-foreground">{item.index + 1}</td>
                    {headerColumns.map((column) => (
                      <td key={`${item.index}-${column}`} className="px-2 py-1 text-ivory/80">
                        {item.row[column] || '—'}
                      </td>
                    ))}
                    <td className="px-2 py-1">
                      {item.valid ? (
                        <span className="text-emerald-400">Valid</span>
                      ) : (
                        <span className="text-red-400">Invalid</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-md border border-white/10 bg-black/20 p-3 text-xs text-muted-foreground">
            {errorCount > 0
              ? `${errorCount} rows failed validation and will be counted as errors during import.`
              : 'All previewed rows look valid.'}
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="h-10 rounded-md border border-white/10 px-4 text-sm text-ivory hover:bg-white/5"
            >
              Back
            </button>

            <button
              type="button"
              onClick={runImport}
              disabled={importing}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirm Import
            </button>
          </div>
        </div>
      ) : null}

      {step === 4 && result ? (
        <div className="space-y-3">
          <div className="rounded-md border border-white/10 bg-black/20 p-3 text-sm text-ivory">
            Import complete.
          </div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>Inserted: {result.inserted}</li>
            <li>Duplicates: {result.duplicates}</li>
            <li>Errors: {result.errors}</li>
          </ul>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setStep(1)
                setRows([])
                setResult(null)
                setFileName('')
                setParseError(null)
              }}
              className="h-10 rounded-md border border-white/10 px-4 text-sm text-ivory hover:bg-white/5"
            >
              Import Another File
            </button>
          </div>
        </div>
      ) : null}

      {parseError ? (
        <p className="text-xs text-red-400">{parseError}</p>
      ) : null}
    </section>
  )
}
