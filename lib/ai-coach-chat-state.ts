import type { ChartRequest } from '@/components/ai-coach/center-panel'

export interface ChartRequestMessageLike {
  role: 'user' | 'assistant'
  chartRequest?: ChartRequest | null
}

export function getLatestAssistantChartRequest(messages: ChartRequestMessageLike[]): ChartRequest | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role !== 'assistant') continue
    if (message.chartRequest) return message.chartRequest
  }

  return null
}
