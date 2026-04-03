export type BeastMonType = 'fire' | 'grass' | 'water' | 'ice' | 'dragon'
export type MoveCategory = 'damage' | 'damage_plus_status' | 'pure_status'
export type StatusEffect = 'burn' | 'paralysis' | 'freeze'
export type StatusApplicationMode = 'guaranteed' | 'rolled'
export type DamageStat = 'atk' | 'speed'
export type Side = 'a' | 'b'

export type StatusFailedReason =
  | 'already_statused'
  | 'proc_failed'
  | 'immunity_ability'
  | 'type_immunity'

export interface Move {
  move_id: string
  name: string
  type: BeastMonType
  category: MoveCategory
  power: number
  accuracy: number
  priority: number
  crit_enabled: boolean
  damage_stat: DamageStat
  inflicted_status: StatusEffect | null
  status_application_mode: StatusApplicationMode | null
  status_proc_numerator: number | null
  status_proc_denominator: number | null
}

export interface Species {
  species_id: string
  name: string
  type: BeastMonType
  base_hp: number
  base_atk: number
  base_def: number
  base_speed: number
  ability_id: string
  signature_move_1: string
  signature_move_2: string
  variable_pool: [string, string, string, string, string, string]
}

export interface BattleMon {
  species_id: string
  name: string
  type: BeastMonType
  max_hp: number
  current_hp: number
  base_atk: number
  base_def: number
  base_speed: number
  ability_id: string
  moveset: [Move, Move, Move, Move]
  status: StatusEffect | null
  speed_boost_stacks: number
  sturdy_used: boolean
}

export type BattleEventType =
  | 'BATTLE_START'
  | 'MOVE_SELECTED'
  | 'ACTION_FROZEN_FAILED'
  | 'ACTION_PARALYSIS_FAILED'
  | 'MOVE_MISSED'
  | 'DAMAGE_DEALT'
  | 'CRIT'
  | 'TYPE_SUPER_EFFECTIVE'
  | 'TYPE_RESISTED'
  | 'TYPE_IMMUNE'
  | 'STATUS_APPLIED'
  | 'STATUS_FAILED'
  | 'BURN_DAMAGE'
  | 'MON_FAINTED'
  | 'BATTLE_END'
  | 'THAW_SUCCESS'
  | 'ABILITY_TRIGGERED'
  | 'STURDY_ACTIVATED'
  | 'SPEED_BOOST_STACKED'

export interface BattleEvent {
  event_type: BattleEventType
  actor_side?: Side
  payload: Record<string, unknown>
}

export interface BattleArtifact {
  engine_version: string
  content_version: string
  ruleset_version: string
  seed: number
  side_a_species_id: string
  side_b_species_id: string
  winner: Side | 'draw'
  total_turns: number
  events: BattleEvent[]
  side_a_final_moveset: [Move, Move, Move, Move]
  side_b_final_moveset: [Move, Move, Move, Move]
}

export interface KernelInputs {
  engine_version: string
  content_version: string
  ruleset_version: string
  seed: number
  side_a_species_id: string
  side_b_species_id: string
}

export interface BattleTimingMetadata {
  battle_id: string
  started_at_ms: number
  turn_duration_ms: number
  playback_start_ms: number
}

export interface StoredBattle {
  artifact: BattleArtifact
  timing: BattleTimingMetadata
}
