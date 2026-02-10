'use client'

import { useMemo, useState } from 'react'
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react'
import * as Sentry from '@sentry/nextjs'
import { createAppError, createAppErrorFromResponse, notifyAppError } from '@/lib/error-handler'

const BROKERS = [
  'Interactive Brokers',
  'Schwab / TD Ameritrade',
  'Robinhood',
  'E*Trade',
  'Fidelity',
  'Webull',
]

interface ImportWizardProps {
  onImported?: () => void
}

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((header) => header.trim())
  return lines.slice(1).map((line) => {
    const values = line.split(',')
    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = (values[index] || '').trim()
    })
    return row
  })
}

export function ImportWizard({ onImported }: ImportWizardProps) {
  const [broker, setBroker] = useState(BROKERS[0])
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<Array<Record<string, string>>>([])
  const [uploading, setUploading] = useState(false)
  const [resultMessage, setResultMessage] = useState<string | null>(null)

  const previewRows = useMemo(() => rows.slice(0, 5), [rows])
  const columns = useMemo(() => {
    if (rows.length === 0) return []
    return Object.keys(rows[0]).slice(0, 6)
  }, [rows])

  const handleFileChange = async (file: File | null) => {
    if (!file) return
    setFileName(file.name)
    const text = await file.text()
    setRows(parseCsv(text))
    setResultMessage(null)
  }

  const runImport = async () => {
    if (rows.length === 0 || uploading) return
    setUploading(true)
    setResultMessage(null)
    try {
      const response = await fetch('/api/members/journal/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broker,
          fileName: fileName || 'import.csv',
          rows,
        }),
      })

      if (!response.ok) {
        throw await createAppErrorFromResponse(response)
      }

      const result = await response.json()
      const inserted = result?.data?.inserted ?? 0
      const duplicates = result?.data?.duplicates ?? 0
      const errors = result?.data?.errors ?? 0
      Sentry.addBreadcrumb({
        category: 'journal',
        message: 'Trades imported',
        level: 'info',
        data: {
          broker,
          fileName: fileName || 'import.csv',
          rows: rows.length,
          inserted,
          duplicates,
          errors,
        },
      })
      setResultMessage(`Import complete: ${inserted} inserted, ${duplicates} duplicates, ${errors} errors.`)
      if (onImported) onImported()
    } catch (error) {
      notifyAppError(createAppError(error))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="glass-card rounded-xl p-4 border border-white/[0.06] space-y-3">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-medium text-ivory">CSV Import Wizard</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr_auto] gap-2">
        <select
          value={broker}
          onChange={(event) => setBroker(event.target.value)}
          className="h-10 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-ivory focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
        >
          {BROKERS.map((brokerOption) => (
            <option key={brokerOption} value={brokerOption}>{brokerOption}</option>
          ))}
        </select>

        <label className="h-10 px-3 rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-muted-foreground flex items-center gap-2 cursor-pointer hover:bg-white/[0.05]">
          <Upload className="w-4 h-4" />
          <span className="truncate">{fileName || 'Upload CSV file'}</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] || null
              void handleFileChange(file)
            }}
          />
        </label>

        <button
          type="button"
          onClick={runImport}
          disabled={rows.length === 0 || uploading}
          className="h-10 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm flex items-center gap-1.5"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Import
        </button>
      </div>

      {previewRows.length > 0 && (
        <div className="rounded-lg border border-white/[0.06] overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-white/[0.04]">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="text-left px-2.5 py-2 text-muted-foreground font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t border-white/[0.04]">
                  {columns.map((column) => (
                    <td key={column} className="px-2.5 py-1.5 text-ivory/80 max-w-[140px] truncate">
                      {row[column] || '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resultMessage && (
        <p className="text-xs text-emerald-300">{resultMessage}</p>
      )}
    </div>
  )
}
