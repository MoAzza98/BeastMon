import type { BeastMonType } from './types.js'
import { CONSTANTS } from './constants.js'

type TypeChartRow = Record<BeastMonType, number>
type TypeChart = Record<BeastMonType, TypeChartRow>

const TYPE_CHART: TypeChart = {
  fire: {
    fire:   CONSTANTS.TYPE_NEUTRAL,
    grass:  CONSTANTS.TYPE_SUPER_EFFECTIVE,
    water:  CONSTANTS.TYPE_RESISTED,
    ice:    CONSTANTS.TYPE_NEUTRAL,
    dragon: CONSTANTS.TYPE_RESISTED,
  },
  grass: {
    fire:   CONSTANTS.TYPE_RESISTED,
    grass:  CONSTANTS.TYPE_NEUTRAL,
    water:  CONSTANTS.TYPE_SUPER_EFFECTIVE,
    ice:    CONSTANTS.TYPE_NEUTRAL,
    dragon: CONSTANTS.TYPE_RESISTED,
  },
  water: {
    fire:   CONSTANTS.TYPE_SUPER_EFFECTIVE,
    grass:  CONSTANTS.TYPE_RESISTED,
    water:  CONSTANTS.TYPE_NEUTRAL,
    ice:    CONSTANTS.TYPE_NEUTRAL,
    dragon: CONSTANTS.TYPE_RESISTED,
  },
  ice: {
    fire:   CONSTANTS.TYPE_NEUTRAL,
    grass:  CONSTANTS.TYPE_NEUTRAL,
    water:  CONSTANTS.TYPE_NEUTRAL,
    ice:    CONSTANTS.TYPE_NEUTRAL,
    dragon: CONSTANTS.TYPE_SUPER_EFFECTIVE,
  },
  dragon: {
    fire:   CONSTANTS.TYPE_NEUTRAL,
    grass:  CONSTANTS.TYPE_NEUTRAL,
    water:  CONSTANTS.TYPE_NEUTRAL,
    ice:    CONSTANTS.TYPE_RESISTED,
    dragon: CONSTANTS.TYPE_SUPER_EFFECTIVE,
  },
} as const

export function getTypeEffectiveness(
  moveType: BeastMonType,
  defenderType: BeastMonType
): number {
  return TYPE_CHART[moveType][defenderType]
}
