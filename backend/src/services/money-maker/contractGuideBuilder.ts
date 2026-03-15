import {
  MoneyMakerContractCandidate,
  MoneyMakerExecutionPlan,
} from '../../lib/money-maker/types'
import { OptionContract, OptionsChainResponse } from '../options/types'

const CONTRACT_MULTIPLIER = 100

type CandidateLabel = MoneyMakerContractCandidate['label']

interface ContractGuideProfile {
  label: CandidateLabel
  minDelta: number
  maxDelta: number
  targetDelta: number
  preferredMinDte: number
  preferredMaxDte: number
}

interface FlattenedContract {
  contract: OptionContract
  dte: number
}

export interface MoneyMakerContractGuideResult {
  contracts: MoneyMakerContractCandidate[]
  degradedReason: string | null
}

const PROFILE_CONFIG: ContractGuideProfile[] = [
  {
    label: 'primary',
    minDelta: 0.35,
    maxDelta: 0.55,
    targetDelta: 0.45,
    preferredMinDte: 3,
    preferredMaxDte: 10,
  },
  {
    label: 'conservative',
    minDelta: 0.5,
    maxDelta: 0.65,
    targetDelta: 0.575,
    preferredMinDte: 7,
    preferredMaxDte: 14,
  },
  {
    label: 'lower_cost',
    minDelta: 0.25,
    maxDelta: 0.4,
    targetDelta: 0.325,
    preferredMinDte: 3,
    preferredMaxDte: 10,
  },
]

function round(value: number): number {
  return Number(value.toFixed(2))
}

function getDesiredType(executionPlan: MoneyMakerExecutionPlan): OptionContract['type'] {
  return executionPlan.target1 >= executionPlan.entry ? 'call' : 'put'
}

function getMid(contract: OptionContract): number {
  return (contract.bid + contract.ask) / 2
}

function getSpreadPct(contract: OptionContract): number {
  const mid = getMid(contract)
  if (!Number.isFinite(mid) || mid <= 0) {
    return Number.POSITIVE_INFINITY
  }
  return ((contract.ask - contract.bid) / mid) * 100
}

function formatOptionSymbol(contract: OptionContract): string {
  return `${contract.symbol} ${contract.expiry} ${contract.type === 'call' ? 'C' : 'P'} ${contract.strike}`
}

function scoreDeltaFit(absDelta: number, profile: ContractGuideProfile): number {
  const halfBand = Math.max((profile.maxDelta - profile.minDelta) / 2, 0.0001)
  const distanceFromTarget = Math.abs(absDelta - profile.targetDelta)
  const normalized = Math.max(0, 1 - (distanceFromTarget / halfBand))
  return normalized * 100
}

function scoreSpreadQuality(spreadPct: number): number {
  return Math.max(0, Math.min(100, ((18 - spreadPct) / 18) * 100))
}

function scoreOpenInterest(openInterest: number | null | undefined): number {
  const oi = Math.max(0, openInterest || 0)
  return Math.max(0, Math.min(100, (Math.log10(oi + 1) / Math.log10(5000)) * 100))
}

function scoreVolume(volume: number | null | undefined): number {
  const value = Math.max(0, volume || 0)
  return Math.max(0, Math.min(100, (Math.log10(value + 1) / Math.log10(2000)) * 100))
}

function scoreThetaEfficiency(theta: number | null | undefined): number {
  const absTheta = Math.abs(theta || 0)
  return Math.max(0, Math.min(100, 100 - (absTheta * 120)))
}

function scoreIvTiming(): number {
  return 50
}

function scoreContract(contract: OptionContract, profile: ContractGuideProfile): number {
  const absDelta = Math.abs(contract.delta || 0)
  const spreadPct = getSpreadPct(contract)

  return round(
    (scoreDeltaFit(absDelta, profile) * 0.35)
    + (scoreSpreadQuality(spreadPct) * 0.25)
    + (scoreOpenInterest(contract.openInterest) * 0.15)
    + (scoreVolume(contract.volume) * 0.10)
    + (scoreThetaEfficiency(contract.theta) * 0.10)
    + (scoreIvTiming() * 0.05),
  )
}

function passesBaseFilters(contract: FlattenedContract, desiredType: OptionContract['type']): boolean {
  const absDelta = Math.abs(contract.contract.delta || 0)
  const spreadPct = getSpreadPct(contract.contract)
  const premiumPerContract = contract.contract.ask * CONTRACT_MULTIPLIER

  if (contract.contract.type !== desiredType) return false
  if (contract.dte <= 0 || contract.dte > 21) return false
  if (!(contract.contract.bid > 0 && contract.contract.ask > contract.contract.bid)) return false
  if (!Number.isFinite(absDelta) || absDelta < 0.2 || absDelta > 0.7) return false
  if ((contract.contract.openInterest || 0) < 300 && (contract.contract.volume || 0) < 100) return false
  if (!Number.isFinite(spreadPct) || spreadPct > 18) return false
  if (!Number.isFinite(premiumPerContract) || premiumPerContract <= 0) return false
  return true
}

function filterProfileContracts(
  contracts: FlattenedContract[],
  profile: ContractGuideProfile,
  desiredType: OptionContract['type'],
  usedSymbols: Set<string>,
  useFallbackWindow: boolean,
): FlattenedContract[] {
  const minDte = useFallbackWindow ? 2 : profile.preferredMinDte
  const maxDte = useFallbackWindow ? 14 : profile.preferredMaxDte

  return contracts.filter((contract) => {
    const optionSymbol = formatOptionSymbol(contract.contract)
    const absDelta = Math.abs(contract.contract.delta || 0)

    if (usedSymbols.has(optionSymbol)) return false
    if (!passesBaseFilters(contract, desiredType)) return false
    if (contract.dte < minDte || contract.dte > maxDte) return false
    if (absDelta < profile.minDelta || absDelta > profile.maxDelta) return false
    return true
  })
}

function buildExplanation(
  label: CandidateLabel,
  contract: OptionContract,
  usedFallbackWindow: boolean,
): string {
  const spreadPct = round(getSpreadPct(contract))
  const absDelta = round(Math.abs(contract.delta || 0))
  const base = label === 'primary'
    ? 'best balance of delta fit and spread quality'
    : label === 'conservative'
      ? 'higher delta follow-through candidate with cleaner staying power'
      : 'cheaper premium with lighter delta and acceptable liquidity'

  const fallbackNote = usedFallbackWindow
    ? '; fallback expiry window used because the preferred DTE band was empty'
    : ''

  return `${base}; delta ${absDelta}, spread ${spreadPct}%${fallbackNote}`
}

function toContractCandidate(
  label: CandidateLabel,
  contract: OptionContract,
  dte: number,
  usedFallbackWindow: boolean,
): MoneyMakerContractCandidate {
  const spreadPct = round(getSpreadPct(contract))
  const mid = round(getMid(contract))

  return {
    label,
    optionSymbol: formatOptionSymbol(contract),
    expiry: contract.expiry,
    strike: contract.strike,
    type: contract.type,
    bid: round(contract.bid),
    ask: round(contract.ask),
    mid,
    spreadPct,
    delta: contract.delta ?? null,
    theta: contract.theta ?? null,
    impliedVolatility: contract.impliedVolatility ?? null,
    openInterest: contract.openInterest ?? null,
    volume: contract.volume ?? null,
    premiumPerContract: round(contract.ask * CONTRACT_MULTIPLIER),
    dte,
    quality: spreadPct <= 12 ? 'green' : 'amber',
    explanation: buildExplanation(label, contract, usedFallbackWindow),
  }
}

export function buildContractGuide(params: {
  executionPlan: MoneyMakerExecutionPlan | null
  chains: OptionsChainResponse[]
}): MoneyMakerContractGuideResult {
  const { executionPlan, chains } = params

  if (!executionPlan) {
    return {
      contracts: [],
      degradedReason: 'No underlying execution plan is available for contract guidance.',
    }
  }

  const desiredType = getDesiredType(executionPlan)
  const flattenedContracts = chains.flatMap((chain) => {
    const contracts = desiredType === 'call' ? chain.options.calls : chain.options.puts
    return contracts.map((contract) => ({
      contract,
      dte: chain.daysToExpiry,
    }))
  })

  const usedSymbols = new Set<string>()
  const candidates: MoneyMakerContractCandidate[] = []
  const degradationNotes = new Set<string>()

  for (const profile of PROFILE_CONFIG) {
    let eligible = filterProfileContracts(flattenedContracts, profile, desiredType, usedSymbols, false)
    let usedFallbackWindow = false

    if (eligible.length === 0) {
      eligible = filterProfileContracts(flattenedContracts, profile, desiredType, usedSymbols, true)
      usedFallbackWindow = eligible.length > 0
      if (usedFallbackWindow) {
        degradationNotes.add(`Fallback expiry window used for ${profile.label.replace('_', ' ')} contract selection.`)
      }
    }

    if (eligible.length === 0) {
      continue
    }

    const topChoice = [...eligible]
      .sort((left, right) => {
        const leftScore = scoreContract(left.contract, profile)
        const rightScore = scoreContract(right.contract, profile)

        if (rightScore !== leftScore) {
          return rightScore - leftScore
        }

        return (right.contract.volume || 0) - (left.contract.volume || 0)
      })[0]

    const optionSymbol = formatOptionSymbol(topChoice.contract)
    usedSymbols.add(optionSymbol)
    candidates.push(
      toContractCandidate(profile.label, topChoice.contract, topChoice.dte, usedFallbackWindow),
    )
  }

  if (executionPlan.timeWarning !== 'normal') {
    degradationNotes.add('Late-session caution: contract guidance is informational only and should not be treated as a primary new-entry CTA.')
  }

  return {
    contracts: candidates,
    degradedReason: candidates.length > 0
      ? Array.from(degradationNotes).join(' ') || null
      : `No valid ${desiredType} contracts survived Money Maker liquidity and delta filters.`,
  }
}
