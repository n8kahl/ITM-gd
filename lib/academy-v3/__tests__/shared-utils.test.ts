/**
 * Academy V3 Shared Utilities Tests
 *
 * Tests for the _shared.ts module including:
 * - academyV3ErrorResponse format
 * - logAcademyError structured output
 * - parseBodySafe size validation
 *
 * PASSING CRITERIA:
 * - Error responses always include error.code and error.message
 * - Body parsing rejects payloads over MAX_BODY_SIZE
 * - Structured logs include service, route, code, timestamp
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { academyV3ErrorResponse, logAcademyError, parseBodySafe, MAX_BODY_SIZE } from '@/app/api/academy-v3/_shared'

describe('academyV3ErrorResponse', () => {
  it('returns JSON response with correct status and error envelope', async () => {
    const response = academyV3ErrorResponse(404, 'NOT_FOUND', 'Resource not found')
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toEqual({
      code: 'NOT_FOUND',
      message: 'Resource not found',
      details: undefined,
    })
  })

  it('includes details when provided', async () => {
    const details = { field: 'email', issue: 'required' }
    const response = academyV3ErrorResponse(400, 'VALIDATION', 'Invalid', details)
    const body = await response.json()

    expect(body.error.details).toEqual(details)
  })

  it('returns 401 for unauthorized', async () => {
    const response = academyV3ErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized')
    expect(response.status).toBe(401)
  })

  it('returns 500 for internal errors', async () => {
    const response = academyV3ErrorResponse(500, 'INTERNAL_ERROR', 'Something broke')
    expect(response.status).toBe(500)
  })
})

describe('logAcademyError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('outputs structured JSON with required fields', () => {
    logAcademyError('test/route', 'TEST_ERROR', new Error('test message'))

    expect(console.error).toHaveBeenCalledTimes(1)
    const logOutput = JSON.parse((console.error as ReturnType<typeof vi.fn>).mock.calls[0][0])

    expect(logOutput.service).toBe('academy-v3')
    expect(logOutput.route).toBe('test/route')
    expect(logOutput.code).toBe('TEST_ERROR')
    expect(logOutput.message).toBe('test message')
    expect(logOutput.stack).toBeDefined()
    expect(logOutput.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('handles non-Error objects gracefully', () => {
    logAcademyError('test/route', 'STRING_ERROR', 'plain string error')

    const logOutput = JSON.parse((console.error as ReturnType<typeof vi.fn>).mock.calls[0][0])
    expect(logOutput.message).toBe('plain string error')
    expect(logOutput.stack).toBeUndefined()
  })

  it('includes metadata when provided', () => {
    logAcademyError('test/route', 'META_ERROR', new Error('err'), {
      assessmentId: 'abc-123',
      userId: 'user-456',
    })

    const logOutput = JSON.parse((console.error as ReturnType<typeof vi.fn>).mock.calls[0][0])
    expect(logOutput.assessmentId).toBe('abc-123')
    expect(logOutput.userId).toBe('user-456')
  })
})

describe('parseBodySafe', () => {
  it('exports MAX_BODY_SIZE as 100KB', () => {
    expect(MAX_BODY_SIZE).toBe(100 * 1024)
  })

  it('returns null for oversized payloads', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-length': String(MAX_BODY_SIZE + 1) },
      body: '{}',
    })

    const result = await parseBodySafe(request)
    expect(result).toBeNull()
  })

  it('parses valid JSON body', async () => {
    const payload = { answers: { q1: 'A' } }
    const request = new Request('http://localhost', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(JSON.stringify(payload).length),
      },
      body: JSON.stringify(payload),
    })

    const result = await parseBodySafe<typeof payload>(request)
    expect(result).toEqual(payload)
  })

  it('returns null for invalid JSON', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    })

    const result = await parseBodySafe(request)
    expect(result).toBeNull()
  })
})
