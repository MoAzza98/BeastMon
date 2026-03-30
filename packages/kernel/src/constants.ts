export const CONSTANTS = {
  // Fixed-point arithmetic
  FIXED_POINT_DENOM: 1000,

  // Battle level (fixed at 50 for all battles)
  LEVEL: 50,

  // Type effectiveness multipliers (fixed-point)
  TYPE_IMMUNE:          0,
  TYPE_RESISTED:        500,
  TYPE_NEUTRAL:         1000,
  TYPE_SUPER_EFFECTIVE: 2000,

  // STAB
  STAB_ON:  1500,
  STAB_OFF: 1000,

  // Burn
  BURN_ATK_MUL:        500,
  BURN_RESIDUAL_DENOM: 8,
  BURN_RESIDUAL_MIN:   1,

  // Paralysis
  PARA_SPEED_MUL:     500,
  PARA_FAIL_DRAW_MAX: 3,
  PARA_FAILS_ON:      0,

  // Freeze
  THAW_DRAW_MAX: 3,
  THAWS_ON:      0,

  // Crit
  CRIT_DRAW_MAX: 15,
  CRIT_ON:       0,
  CRIT_MUL:      1500,

  // Variance
  VARIANCE_MIN: 850,
  VARIANCE_MAX: 1000,

  // Move weighting — base weights
  WEIGHT_DAMAGE_BASE:              100,
  WEIGHT_DAMAGE_PLUS_STATUS_BASE:  110,
  WEIGHT_PURE_STATUS_BASE:         40,

  // Move weighting — conditional adjustments
  WEIGHT_ADJ_SUPER_EFFECTIVE:      35,
  WEIGHT_ADJ_RESISTED:            -25,
  WEIGHT_ADJ_ROUGH_KO:             60,
  WEIGHT_ADJ_SLOWER_PARA_STATUS:   25,
  WEIGHT_ADJ_SLOWER_PRIO_DAMAGE:   20,
  WEIGHT_ADJ_STATUS_SELF_BEHIND:   20,
  WEIGHT_ADJ_STATUS_SELF_LOW_HP:   20,
  WEIGHT_ADJ_PARA_VS_FASTER:       25,
  WEIGHT_ADJ_BURN_VS_NOT_LOW:      15,
  WEIGHT_ADJ_FREEZE_WHILE_BEHIND:  15,
  WEIGHT_ADJ_DPS_VALID_STATUS:     10,
  WEIGHT_ADJ_DPS_SELF_BEHIND:      10,

  // Speed Boost ability
  SPEED_BOOST_PER_STACK: 100,
  SPEED_BOOST_BASE:      1000,
  SPEED_BOOST_CAP:       1500,

  // Server timing
  TURN_DURATION_MS:   2500,
  PLAYBACK_BUFFER_MS: 3000,
} as const
