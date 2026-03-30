import type { Species } from './types.js'

export const SPECIES = {
  embrak: {
    species_id: 'embrak',
    name: 'Embrak',
    type: 'fire',
    base_hp: 90,
    base_atk: 100,
    base_def: 70,
    base_speed: 105,
    ability_id: 'speed_boost',
    signature_move_1: 'inferno_rush',
    signature_move_2: 'searing_fang',
    variable_pool: ['fire_blast', 'flamethrower', 'ember', 'will_o_wisp', 'aqua_jet', 'frost_breath'] as const,
  },
  thornvine: {
    species_id: 'thornvine',
    name: 'Thornvine',
    type: 'grass',
    base_hp: 95,
    base_atk: 85,
    base_def: 100,
    base_speed: 70,
    ability_id: 'sturdy',
    signature_move_1: 'thorn_lash',
    signature_move_2: 'spore_cloud',
    variable_pool: ['solar_strike', 'razor_leaf', 'vine_whip', 'stun_spore', 'hydro_pump', 'ice_beam'] as const,
  },
  torrentis: {
    species_id: 'torrentis',
    name: 'Torrentis',
    type: 'water',
    base_hp: 90,
    base_atk: 115,
    base_def: 80,
    base_speed: 80,
    ability_id: 'intimidate',
    signature_move_1: 'hydro_slam',
    signature_move_2: 'riptide',
    variable_pool: ['hydro_pump', 'water_pulse', 'aqua_jet', 'ice_beam', 'frost_breath', 'stun_spore'] as const,
  },
  glacior: {
    species_id: 'glacior',
    name: 'Glacior',
    type: 'ice',
    base_hp: 80,
    base_atk: 95,
    base_def: 85,
    base_speed: 90,
    ability_id: 'sniper',
    signature_move_1: 'glacial_spike',
    signature_move_2: 'blizzard_rush',
    variable_pool: ['ice_beam', 'frost_breath', 'icy_wind', 'dragon_pulse', 'water_pulse', 'will_o_wisp'] as const,
  },
  drakonyx: {
    species_id: 'drakonyx',
    name: 'Drakonyx',
    type: 'dragon',
    base_hp: 100,
    base_atk: 120,
    base_def: 90,
    base_speed: 85,
    ability_id: 'huge_power',
    signature_move_1: 'dragon_rage',
    signature_move_2: 'scale_storm',
    variable_pool: ['dragon_pulse', 'outrage', 'draco_freeze', 'fire_blast', 'ice_beam', 'stun_spore'] as const,
  },
} satisfies Record<string, Species>

export function getSpeciesById(id: string): Species {
  const species = (SPECIES as Record<string, Species | undefined>)[id]
  if (species === undefined) throw new Error(`Unknown species_id: "${id}"`)
  return species
}
