export interface StreamRecoveryResult {
  content: string
  error: string
}

const PARTIAL_RESPONSE_NOTICE = '_Partial response recovered after the live stream was interrupted. Ask me to continue if you want the rest._'

export function recoverInterruptedStreamContent(streamContent: string): StreamRecoveryResult | null {
  const trimmedContent = streamContent.trim()
  if (!trimmedContent) return null

  return {
    content: `${trimmedContent}\n\n${PARTIAL_RESPONSE_NOTICE}`,
    error: 'Response interrupted after partial output. The partial answer was preserved.',
  }
}
