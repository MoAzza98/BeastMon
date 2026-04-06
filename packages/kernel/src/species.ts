import type { Species } from './types.js'

export const SPECIES = {
  embrak: {
    species_id: 'embrak',
    name: 'Embrak',
    type: 'fire',
    base_hp: 240,
    base_atk: 100,
    base_def: 70,
    base_speed: 105,
    ability_id: 'speed_boost',
    signature_move_1: 'inferno_rush',
    signature_move_2: 'searing_fang',
    variable_pool: ['fire_blast', 'flamethrower', 'ember', 'will_o_wisp', 'dragon_pulse', 'frost_breath'],
  },
  thornvine: {
    species_id: 'thornvine',
    name: 'Thornvine',
    type: 'grass',
    base_hp: 285,
    base_atk: 85,
    base_def: 100,
    base_speed: 70,
    ability_id: 'sturdy',
    signature_move_1: 'thorn_lash',
    signature_move_2: 'spore_cloud',
    variable_pool: ['solar_strike', 'razor_leaf', 'vine_whip', 'dragon_pulse', 'hydro_pump', 'ice_beam'],
  },
  torrentis: {
    species_id: 'torrentis',
    name: 'Torrentis',
    type: 'water',
    base_hp: 260,
    base_atk: 85,
    base_def: 90,
    base_speed: 70,
    ability_id: 'intimidate',
    signature_move_1: 'hydro_slam',
    signature_move_2: 'riptide',
    variable_pool: ['hydro_pump', 'water_pulse', 'icy_wind', 'ice_beam', 'dragon_pulse', 'stun_spore'],
  },
  glacior: {
    species_id: 'glacior',
    name: 'Glacior',
    type: 'ice',
    base_hp: 250,
    base_atk: 95,
    base_def: 85,
    base_speed: 80,
    ability_id: 'sniper',
    signature_move_1: 'glacial_spike',
    signature_move_2: 'blizzard_rush',
    variable_pool: ['ice_beam', 'frost_breath', 'icy_wind', 'dragon_pulse', 'water_pulse', 'draco_freeze'],
  },
  drakonyx: {
    species_id: 'drakonyx',
    name: 'Drakonyx',
    type: 'dragon',
    base_hp: 100,
    base_atk: 100,
    base_def: 90,
    base_speed: 85,
    ability_id: 'huge_power',
    signature_move_1: 'dragon_rage',
    signature_move_2: 'scale_storm',
    variable_pool: ['dragon_pulse', 'outrage', 'draco_freeze', 'fire_blast', 'ice_beam', 'will_o_wisp'],
  },
} satisfies Record<string, Species>

export function getSpeciesById(id: string): Species {
  const species = (SPECIES as Record<string, Species | undefined>)[id]
  if (species === undefined) throw new Error(`Unknown species_id: "${id}"`)
  return species
}
