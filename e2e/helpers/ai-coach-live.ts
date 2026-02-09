import { e2eBypassToken, e2eBypassUserId } from './member-auth'

export const e2eAICoachMode = process.env.E2E_AI_COACH_MODE || 'mock'
export const isAICoachLiveMode = e2eAICoachMode === 'live'

export const e2eBackendUrl = process.env.E2E_BACKEND_URL
  || process.env.NEXT_PUBLIC_AI_COACH_API_URL
  || 'http://localhost:3001'

export const aiCoachBypassUserId = process.env.E2E_BYPASS_USER_ID || e2eBypassUserId
export const aiCoachBypassToken = process.env.E2E_BYPASS_TOKEN || e2eBypassToken

export function getAICoachAuthHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${aiCoachBypassToken}`,
    'Content-Type': 'application/json',
  }
}
