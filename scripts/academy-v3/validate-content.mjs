#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const PLACEHOLDER_PATTERNS = [/\blorem\b/i, /\btodo\b/i, /insert content/i, /placeholder/i]
const REQUIRED_BLOCKS = [
  'hook',
  'concept_explanation',
  'worked_example',
  'guided_practice',
  'independent_practice',
  'reflection',
]

function collectJsonFiles(dir) {
  const entries = readdirSync(dir)
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      files.push(...collectJsonFiles(fullPath))
      continue
    }

    if (entry.endsWith('.json')) {
      files.push(fullPath)
    }
  }

  return files
}

function validateLesson(lesson, context) {
  const errors = []

  if (!lesson.slug || typeof lesson.slug !== 'string') {
    errors.push(`${context}: missing lesson.slug`)
  }

  if (!lesson.learningObjective || typeof lesson.learningObjective !== 'string') {
    errors.push(`${context}: missing learningObjective`)
  }

  if (!Array.isArray(lesson.competenciesTargeted) || lesson.competenciesTargeted.length === 0) {
    errors.push(`${context}: missing competenciesTargeted`) 
  }

  if (!Array.isArray(lesson.blocks) || lesson.blocks.length === 0) {
    errors.push(`${context}: missing lesson blocks`)
    return errors
  }

  const blockTypes = lesson.blocks
    .map((block) => (typeof block?.blockType === 'string' ? block.blockType : null))
    .filter((value) => typeof value === 'string')

  for (const requiredType of REQUIRED_BLOCKS) {
    if (!blockTypes.includes(requiredType)) {
      errors.push(`${context}: missing required block type ${requiredType}`)
    }
  }

  if (!blockTypes.includes('guided_practice') && !blockTypes.includes('independent_practice')) {
    errors.push(`${context}: missing formative practice block`)
  }

  const textToScan = [
    lesson.title,
    lesson.learningObjective,
    ...lesson.blocks.map((block) => block.title || ''),
  ]
    .filter((value) => typeof value === 'string')
    .join(' ')

  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(textToScan)) {
      errors.push(`${context}: contains placeholder text matching ${pattern}`)
    }
  }

  return errors
}

function validateBlueprintFile(filePath) {
  const content = readFileSync(filePath, 'utf8')
  const data = JSON.parse(content)
  const errors = []

  if (!data.program || typeof data.program !== 'object') {
    errors.push(`${filePath}: missing program object`)
  }

  if (!Array.isArray(data.tracks) || data.tracks.length === 0) {
    errors.push(`${filePath}: missing tracks`)
    return errors
  }

  data.tracks.forEach((track, trackIndex) => {
    if (!Array.isArray(track.modules) || track.modules.length === 0) {
      errors.push(`${filePath}: track[${trackIndex}] missing modules`)
      return
    }

    track.modules.forEach((moduleRecord, moduleIndex) => {
      const moduleContext = `${filePath}: track[${trackIndex}] module[${moduleIndex}]`

      if (!Array.isArray(moduleRecord.lessons) || moduleRecord.lessons.length === 0) {
        errors.push(`${moduleContext}: missing lessons`)
        return
      }

      moduleRecord.lessons.forEach((lesson, lessonIndex) => {
        const lessonContext = `${moduleContext} lesson[${lessonIndex}]`
        errors.push(...validateLesson(lesson, lessonContext))
      })
    })
  })

  return errors
}

function main() {
  const root = process.cwd()
  const targetDir = process.argv[2]
    ? path.resolve(root, process.argv[2])
    : path.resolve(root, 'docs/specs/academy-content')

  const files = collectJsonFiles(targetDir)
  if (files.length === 0) {
    console.error(`No JSON content files found in ${targetDir}`)
    process.exit(1)
  }

  const allErrors = []
  for (const file of files) {
    allErrors.push(...validateBlueprintFile(file))
  }

  if (allErrors.length > 0) {
    console.error('Academy content validation failed:')
    for (const error of allErrors) {
      console.error(`- ${error}`)
    }
    process.exit(1)
  }

  console.log(`Academy content validation passed for ${files.length} file(s).`)
}

main()
