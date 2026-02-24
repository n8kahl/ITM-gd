export interface FlowAnomalyFeatureVector {
  volumeOiZScore: number
  premiumMomentum: number
  spreadTighteningRatio: number
  sweepIntensity: number
  timeOfDayNormalizedVolume: number
}

export interface FlowAnomalyInference {
  anomalyScore: number
  averagePathLength: number
  threshold: number
  source: 'ml' | 'fallback'
}

export interface IsolationTreeLeaf {
  pathLength: number
}

export interface IsolationTreeSplit {
  feature: keyof FlowAnomalyFeatureVector
  threshold: number
  highBranch: 'left' | 'right'
  left: IsolationTreeNode
  right: IsolationTreeNode
}

export type IsolationTreeNode = IsolationTreeLeaf | IsolationTreeSplit

export interface FlowAnomalyIsolationModel {
  version: string
  sampleSize: number
  trees: IsolationTreeNode[]
}

export const FLOW_ANOMALY_DECISION_THRESHOLD = 0.62

const EULER_GAMMA = 0.5772156649

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

function isLeaf(node: IsolationTreeNode): node is IsolationTreeLeaf {
  return 'pathLength' in node
}

function safeNumber(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback
  return value
}

function normalizedFeatures(input: FlowAnomalyFeatureVector): FlowAnomalyFeatureVector {
  return {
    volumeOiZScore: clamp(safeNumber(input.volumeOiZScore), 0, 12),
    premiumMomentum: clamp(safeNumber(input.premiumMomentum), 0, 3),
    spreadTighteningRatio: clamp(safeNumber(input.spreadTighteningRatio), 0, 1),
    sweepIntensity: clamp(safeNumber(input.sweepIntensity), 0, 1.5),
    timeOfDayNormalizedVolume: clamp(safeNumber(input.timeOfDayNormalizedVolume), 0, 3),
  }
}

function traverseTree(node: IsolationTreeNode, features: FlowAnomalyFeatureVector): number {
  if (isLeaf(node)) return node.pathLength
  const value = safeNumber(features[node.feature], 0)
  const takeHighBranch = value > node.threshold
  const next = takeHighBranch
    ? (node.highBranch === 'left' ? node.left : node.right)
    : (node.highBranch === 'left' ? node.right : node.left)
  return traverseTree(next, features)
}

function averagePathLength(sampleSize: number): number {
  if (sampleSize <= 1) return 0
  if (sampleSize === 2) return 1
  return (2 * (Math.log(sampleSize - 1) + EULER_GAMMA)) - ((2 * (sampleSize - 1)) / sampleSize)
}

function fallbackAnomalyScore(features: FlowAnomalyFeatureVector): number {
  const raw = (
    clamp(features.volumeOiZScore / 4, 0, 1) * 0.35
    + clamp(features.premiumMomentum / 1.8, 0, 1) * 0.22
    + clamp(features.spreadTighteningRatio, 0, 1) * 0.14
    + clamp(features.sweepIntensity, 0, 1) * 0.17
    + clamp(features.timeOfDayNormalizedVolume / 1.7, 0, 1) * 0.12
  )
  return clamp(raw, 0, 1)
}

function modelUsable(model: FlowAnomalyIsolationModel): boolean {
  if (!Number.isFinite(model.sampleSize) || model.sampleSize < 8) return false
  return Array.isArray(model.trees) && model.trees.length >= 3
}

const DEFAULT_FLOW_ANOMALY_MODEL: FlowAnomalyIsolationModel = {
  version: 'flow-iforest-v1',
  sampleSize: 128,
  trees: [
    {
      feature: 'volumeOiZScore',
      threshold: 2.1,
      highBranch: 'left',
      left: { pathLength: 2 },
      right: {
        feature: 'premiumMomentum',
        threshold: 0.8,
        highBranch: 'left',
        left: { pathLength: 4 },
        right: { pathLength: 8 },
      },
    },
    {
      feature: 'sweepIntensity',
      threshold: 0.72,
      highBranch: 'left',
      left: { pathLength: 3 },
      right: {
        feature: 'timeOfDayNormalizedVolume',
        threshold: 1.15,
        highBranch: 'left',
        left: { pathLength: 5 },
        right: { pathLength: 8 },
      },
    },
    {
      feature: 'spreadTighteningRatio',
      threshold: 0.82,
      highBranch: 'left',
      left: {
        feature: 'volumeOiZScore',
        threshold: 1.3,
        highBranch: 'left',
        left: { pathLength: 4 },
        right: { pathLength: 7 },
      },
      right: { pathLength: 8 },
    },
    {
      feature: 'timeOfDayNormalizedVolume',
      threshold: 1.0,
      highBranch: 'left',
      left: {
        feature: 'premiumMomentum',
        threshold: 0.55,
        highBranch: 'left',
        left: { pathLength: 4 },
        right: { pathLength: 7 },
      },
      right: { pathLength: 8 },
    },
    {
      feature: 'premiumMomentum',
      threshold: 0.95,
      highBranch: 'left',
      left: { pathLength: 3 },
      right: {
        feature: 'volumeOiZScore',
        threshold: 1.6,
        highBranch: 'left',
        left: { pathLength: 5 },
        right: { pathLength: 8 },
      },
    },
    {
      feature: 'volumeOiZScore',
      threshold: 0.95,
      highBranch: 'left',
      left: {
        feature: 'sweepIntensity',
        threshold: 0.6,
        highBranch: 'left',
        left: { pathLength: 4 },
        right: { pathLength: 7 },
      },
      right: { pathLength: 8 },
    },
  ],
}

let activeFlowAnomalyModel: FlowAnomalyIsolationModel | null = null

function resolveModel(): FlowAnomalyIsolationModel {
  return activeFlowAnomalyModel ?? DEFAULT_FLOW_ANOMALY_MODEL
}

export function inferFlowAnomaly(
  input: FlowAnomalyFeatureVector,
  threshold: number = FLOW_ANOMALY_DECISION_THRESHOLD,
): FlowAnomalyInference {
  const features = normalizedFeatures(input)
  const model = resolveModel()

  if (!modelUsable(model)) {
    const anomalyScore = fallbackAnomalyScore(features)
    return {
      anomalyScore,
      averagePathLength: 0,
      threshold,
      source: 'fallback',
    }
  }

  const pathLengths = model.trees.map((tree) => traverseTree(tree, features))
  const meanPathLength = pathLengths.reduce((sum, value) => sum + value, 0) / pathLengths.length
  const expectedPathLength = Math.max(1e-9, averagePathLength(model.sampleSize))
  const anomalyScore = clamp(2 ** (-meanPathLength / expectedPathLength), 0, 1)

  return {
    anomalyScore,
    averagePathLength: meanPathLength,
    threshold,
    source: 'ml',
  }
}

export function isFlowAnomaly(
  input: FlowAnomalyFeatureVector,
  threshold: number = FLOW_ANOMALY_DECISION_THRESHOLD,
): boolean {
  return inferFlowAnomaly(input, threshold).anomalyScore >= threshold
}

export function __setFlowAnomalyModelForTest(model: FlowAnomalyIsolationModel | null): void {
  activeFlowAnomalyModel = model
}

export function __resetFlowAnomalyModelForTest(): void {
  activeFlowAnomalyModel = null
}
