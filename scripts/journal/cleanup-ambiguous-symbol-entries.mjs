#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const AMBIGUOUS_SYMBOLS = [
  'MULTIPLE',
  'MULTI',
  'PORTFOLIO',
  'VARIOUS',
  'MIXED',
  'ACCOUNT',
  'POSITIONS',
  'POSITION',
  'HOLDINGS',
  'TOTAL',
]

function parseArgs(argv) {
  const args = {
    execute: false,
    userId: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--execute') {
      args.execute = true
      continue
    }
    if (token === '--user-id' && argv[index + 1]) {
      args.userId = argv[index + 1]
      index += 1
      continue
    }
  }

  return args
}

function chunk(items, size) {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function isConservativeDeleteCandidate(row) {
  return (
    row.entry_price == null
    && row.exit_price == null
    && row.position_size == null
    && row.pnl == null
    && row.pnl_percentage == null
    && row.setup_notes == null
    && row.execution_notes == null
    && row.lessons_learned == null
    && (!Array.isArray(row.tags) || row.tags.length === 0)
  )
}

async function main() {
  const { execute, userId } = parseArgs(process.argv.slice(2))

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  let query = supabase
    .from('journal_entries')
    .select([
      'id',
      'user_id',
      'symbol',
      'entry_price',
      'exit_price',
      'position_size',
      'pnl',
      'pnl_percentage',
      'setup_notes',
      'execution_notes',
      'lessons_learned',
      'tags',
      'screenshot_storage_path',
      'created_at',
    ].join(','))
    .in('symbol', AMBIGUOUS_SYMBOLS)

  if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data: rows, error: loadError } = await query

  if (loadError) {
    console.error('Failed to load ambiguous symbol entries:', loadError.message)
    process.exit(1)
  }

  const allRows = rows ?? []
  const safeRows = allRows.filter(isConservativeDeleteCandidate)
  const manualRows = allRows.filter((row) => !isConservativeDeleteCandidate(row))

  console.log(`Ambiguous entries found: ${allRows.length}`)
  console.log(`Safe delete candidates: ${safeRows.length}`)
  console.log(`Manual review required: ${manualRows.length}`)

  if (manualRows.length > 0) {
    console.log('\nManual review rows:')
    for (const row of manualRows) {
      console.log(`- ${row.id} user=${row.user_id} symbol=${row.symbol} created_at=${row.created_at}`)
    }
  }

  if (!execute) {
    console.log('\nDry run only. Re-run with --execute to apply cleanup.')
    return
  }

  if (safeRows.length === 0) {
    console.log('\nNo safe candidates to delete.')
    return
  }

  const idsToDelete = safeRows.map((row) => row.id)
  const pathsToRemove = safeRows
    .map((row) => row.screenshot_storage_path)
    .filter((path) => typeof path === 'string' && path.length > 0)

  const { error: deleteError, count } = await supabase
    .from('journal_entries')
    .delete({ count: 'exact' })
    .in('id', idsToDelete)

  if (deleteError) {
    console.error('Failed to delete journal entries:', deleteError.message)
    process.exit(1)
  }

  console.log(`\nDeleted journal rows: ${count ?? idsToDelete.length}`)

  if (pathsToRemove.length === 0) {
    console.log('No screenshot files to remove.')
    return
  }

  let removedFiles = 0
  let removeErrors = 0

  for (const pathBatch of chunk(pathsToRemove, 100)) {
    const { data, error } = await supabase.storage
      .from('journal-screenshots')
      .remove(pathBatch)

    if (error) {
      removeErrors += pathBatch.length
      console.error(`Failed to remove storage batch (${pathBatch.length}):`, error.message)
      continue
    }

    removedFiles += data?.length ?? 0
  }

  console.log(`Removed screenshot files: ${removedFiles}`)
  if (removeErrors > 0) {
    console.log(`Storage remove failures (count): ${removeErrors}`)
  }
}

main().catch((error) => {
  console.error('Cleanup failed:', error instanceof Error ? error.message : String(error))
  process.exit(1)
})
