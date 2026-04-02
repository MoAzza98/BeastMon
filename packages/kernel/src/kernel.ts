import { RNG } from './rng.js'
import { CONSTANTS } from './constants.js'
import type {
  KernelInputs,
  BattleArtifact,
  BattleEvent,
  BattleMon,
  Move,
  Side,
  Species,
} from './types.js'
import { getSpeciesById } from './species.js'
import { getMoveById } from './moves.js'
import { getTypeEffectiveness } from './typeChart.js'
import { computeEffectiveAtk, computeEffectiveDef, computeBurnDamage } from './damage.js'
import { computeMoveWeight, selectMove, computeEffectiveSpeed } from './weighting.js'
import { applyAbility } from './abilities.js'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function rollVariableMoves(rng: RNG, species: Species): [Move, Move] {
  const pool = [...species.variable_pool]

  const i1 = rng.drawVariableMove1()
  const moveId1 = pool[i1]! // safe: i1 is drawn from [0,5], pool has 6 elements
  pool.splice(i1, 1)

  const i2 = rng.drawVariableMove2()
  const moveId2 = pool[i2]! // safe: i2 is drawn from [0,4], pool has 5 elements after splice

  return [getMoveById(moveId1), getMoveById(moveId2)]
}

function buildBattleMon(species: Species, moveset: [Move, Move, Move, Move]): BattleMon {
  return {
    species_id: species.species_id,
    name: species.name,
    type: species.type,
    max_hp: species.base_hp,
    current_hp: species.base_hp,
    base_atk: species.base_atk,
    base_def: species.base_def,
    base_speed: species.base_speed,
    ability_id: species.ability_id,
    moveset,
    status: null,
    speed_boost_stacks: 0,
  }
}

interface ActionResult {
  battleOver: boolean
  winner?: Side | 'draw'
}

function resolveAction(
  actor: BattleMon,
  target: BattleMon,
  actorSide: Side,
  targetSide: Side,
  selectedMove: Move,
  rng: RNG,
  events: BattleEvent[]
): ActionResult {
  // Step 1 — Frozen check
  if (actor.status === 'freeze') {
    const thawDraw = rng.drawThaw()
    if (thawDraw === CONSTANTS.THAWS_ON) {
      actor.status = null
    } else {
      events.push({ event_type: 'ACTION_FROZEN_FAILED', actor_side: actorSide, payload: {} })
      return { battleOver: false }
    }
  }

  // Step 2 — Paralysis check
  if (actor.status === 'paralysis') {
    const paraDraw = rng.drawParalysisFail()
    if (paraDraw === CONSTANTS.PARA_FAILS_ON) {
      events.push({ event_type: 'ACTION_PARALYSIS_FAILED', actor_side: actorSide, payload: {} })
      return { battleOver: false }
    }
  }

  // Step 3 — Accuracy check
  const accuracyDraw = rng.drawAccuracy()
  const hit = accuracyDraw < selectedMove.accuracy
  if (!hit) {
    events.push({
      event_type: 'MOVE_MISSED',
      actor_side: actorSide,
      payload: { move_id: selectedMove.move_id },
    })
    return { battleOver: false }
  }

  // Step 4 — Damage path (damaging moves only)
  const isDamaging =
    selectedMove.category === 'damage' || selectedMove.category === 'damage_plus_status'

  if (isDamaging) {
    // 4a — Type effectiveness
    let typeMul = getTypeEffectiveness(selectedMove.type, target.type)

    // Check target ability for block_damage (fire_immunity)
    const targetAbilityResult = applyAbility(target.ability_id, 'ON_BEFORE_DAMAGE', {
      self: target,
      move: selectedMove,
    })
    if (targetAbilityResult.block_damage) {
      typeMul = 0
    }

    // 4b — Crit draw
    const critDraw = selectedMove.crit_enabled ? rng.drawCrit() : 1

    // 4c — Variance draw
    const varianceDraw = rng.drawVariance()

    // 4d — Compute damage (inline formula with x8 ability modifier)
    const A = computeEffectiveAtk(actor)
    const D = computeEffectiveDef(target)
    const x1 = Math.floor((2 * CONSTANTS.LEVEL) / 5) + 2
    const x2 = x1 * selectedMove.power
    const x3 = Math.floor((x2 * A) / D)
    const x4 = Math.floor(x3 / 50) + 2

    const critMul =
      critDraw === CONSTANTS.CRIT_ON ? CONSTANTS.CRIT_MUL : CONSTANTS.FIXED_POINT_DENOM
    const stabMul =
      selectedMove.type === actor.type ? CONSTANTS.STAB_ON : CONSTANTS.STAB_OFF

    const x5 = Math.floor((x4 * critMul) / CONSTANTS.FIXED_POINT_DENOM)
    const x6 = Math.floor((x5 * stabMul) / CONSTANTS.FIXED_POINT_DENOM)
    const x7 = Math.floor((x6 * typeMul) / CONSTANTS.FIXED_POINT_DENOM)

    // x8 — actor ability damage modifier (sniper, low_hp_boost)
    const actorAbilityResult = applyAbility(actor.ability_id, 'ON_BEFORE_DAMAGE', {
      self: actor,
      move: selectedMove,
      is_crit: critDraw === CONSTANTS.CRIT_ON,
    })
    const abilityMul = actorAbilityResult.damage_multiplier_fp ?? CONSTANTS.FIXED_POINT_DENOM
    const x8 = Math.floor((x7 * abilityMul) / CONSTANTS.FIXED_POINT_DENOM)

    // x9 — variance
    const x9 = Math.floor((x8 * varianceDraw) / CONSTANTS.FIXED_POINT_DENOM)

    const damage = typeMul === 0 ? 0 : Math.max(1, x9)
    const rawNewHp = target.current_hp - damage

    // Resolve ON_SURVIVE_LETHAL
    if (rawNewHp <= 0) {
      const surviveResult = applyAbility(target.ability_id, 'ON_SURVIVE_LETHAL', { self: target })
      if (surviveResult.survive_lethal) {
        target.current_hp = 1
      } else {
        target.current_hp = 0
      }
    } else {
      target.current_hp = rawNewHp
    }

    // 4e — Emit modifier events
    if (critDraw === CONSTANTS.CRIT_ON && selectedMove.crit_enabled) {
      events.push({ event_type: 'CRIT', actor_side: actorSide, payload: {} })
    }
    if (typeMul === CONSTANTS.TYPE_SUPER_EFFECTIVE) {
      events.push({ event_type: 'TYPE_SUPER_EFFECTIVE', actor_side: actorSide, payload: {} })
    } else if (typeMul === CONSTANTS.TYPE_RESISTED) {
      events.push({ event_type: 'TYPE_RESISTED', actor_side: actorSide, payload: {} })
    } else if (typeMul === CONSTANTS.TYPE_IMMUNE) {
      events.push({ event_type: 'TYPE_IMMUNE', actor_side: actorSide, payload: {} })
    }

    // 4f — Emit DAMAGE_DEALT
    events.push({
      event_type: 'DAMAGE_DEALT',
      actor_side: actorSide,
      payload: {
        target_side: targetSide,
        move_id: selectedMove.move_id,
        damage,
        remaining_hp: target.current_hp,
      },
    })

    // 4g — Check for faint
    if (target.current_hp === 0) {
      events.push({ event_type: 'MON_FAINTED', payload: { side: targetSide } })
      const winner: Side | 'draw' = actor.current_hp > 0 ? actorSide : 'draw'
      events.push({ event_type: 'BATTLE_END', payload: { winner } })
      return { battleOver: true, winner }
    }
  }

  // Step 5 — Status application path
  if (selectedMove.inflicted_status !== null && target.current_hp > 0) {
    // 5a — Status proc draw if rolled
    let procSucceeded = true
    if (selectedMove.status_application_mode === 'rolled') {
      // Non-null assertions safe: rolled mode guarantees these fields exist
      const draw = rng.drawStatusProc(selectedMove.status_proc_denominator!)
      procSucceeded = draw < selectedMove.status_proc_numerator!
    }

    if (procSucceeded) {
      // 5b — Check validity
      const alreadyStatused = target.status !== null
      let blockedByAbility = false
      if (!alreadyStatused) {
        const statusResult = applyAbility(target.ability_id, 'ON_STATUS_APPLY_ATTEMPT', {
          pending_status: selectedMove.inflicted_status,
        })
        blockedByAbility = statusResult.block_status === true
      }

      // 5c — Apply or fail
      if (!alreadyStatused && !blockedByAbility) {
        target.status = selectedMove.inflicted_status
        events.push({
          event_type: 'STATUS_APPLIED',
          actor_side: actorSide,
          payload: {
            target_side: targetSide,
            status: selectedMove.inflicted_status,
          },
        })
      } else {
        events.push({
          event_type: 'STATUS_FAILED',
          actor_side: actorSide,
          payload: {
            target_side: targetSide,
            reason: alreadyStatused ? 'already_statused' : 'blocked_by_ability',
          },
        })
      }
    }
    // If proc failed: no event emitted, per spec
  }

  return { battleOver: false }
}

// ---------------------------------------------------------------------------
// Select move for one side
// ---------------------------------------------------------------------------

function selectMoveForSide(
  self: BattleMon,
  opponent: BattleMon,
  rng: RNG
): { move: Move; slot: number } {
  const weights: [number, number, number, number] = [
    computeMoveWeight(self, opponent, self.moveset[0], getTypeEffectiveness(self.moveset[0].type, opponent.type)),
    computeMoveWeight(self, opponent, self.moveset[1], getTypeEffectiveness(self.moveset[1].type, opponent.type)),
    computeMoveWeight(self, opponent, self.moveset[2], getTypeEffectiveness(self.moveset[2].type, opponent.type)),
    computeMoveWeight(self, opponent, self.moveset[3], getTypeEffectiveness(self.moveset[3].type, opponent.type)),
  ]

  const totalWeight = weights[0] + weights[1] + weights[2] + weights[3]

  let selectedSlot: number
  if (totalWeight > 0) {
    const draw = rng.drawWeightedSelection(totalWeight)
    selectedSlot = selectMove(weights, draw)
  } else {
    const draw = rng.drawAllZeroFallback()
    selectedSlot = selectMove([0, 0, 0, 0], draw)
  }

  // safe: selectedSlot is 0–3, moveset is a fixed 4-tuple
  return { move: self.moveset[selectedSlot]!, slot: selectedSlot }
}

// ---------------------------------------------------------------------------
// Determine action order for two sides
// ---------------------------------------------------------------------------

function determineActionOrder(
  moveA: Move,
  moveB: Move,
  monA: BattleMon,
  monB: BattleMon,
  rng: RNG
): [Side, Side] {
  if (moveA.priority !== moveB.priority) {
    return moveA.priority > moveB.priority ? ['a', 'b'] : ['b', 'a']
  }

  const speedA = computeEffectiveSpeed(monA)
  const speedB = computeEffectiveSpeed(monB)

  if (speedA !== speedB) {
    return speedA > speedB ? ['a', 'b'] : ['b', 'a']
  }

  // Both priority and speed are equal — consume speed tie draw
  const tieDraw = rng.drawSpeedTie()
  return tieDraw === 0 ? ['a', 'b'] : ['b', 'a']
}

// ---------------------------------------------------------------------------
// Determine end-of-turn order
// ---------------------------------------------------------------------------

function determineEndOfTurnOrder(
  monA: BattleMon,
  monB: BattleMon,
  rng: RNG
): [Side, Side] {
  const speedA = computeEffectiveSpeed(monA)
  const speedB = computeEffectiveSpeed(monB)

  if (speedA !== speedB) {
    return speedA > speedB ? ['a', 'b'] : ['b', 'a']
  }

  const tieDraw = rng.drawSpeedTie()
  return tieDraw === 0 ? ['a', 'b'] : ['b', 'a']
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function runBattle(inputs: KernelInputs): BattleArtifact {
  // 1. Validate inputs and look up species
  const speciesA = getSpeciesById(inputs.side_a_species_id)
  const speciesB = getSpeciesById(inputs.side_b_species_id)

  // 2. Instantiate RNG
  const rng = new RNG(inputs.seed)

  // 3. Roll variable moves — 4 draws in exact order
  const [varA1, varA2] = rollVariableMoves(rng, speciesA)
  const [varB1, varB2] = rollVariableMoves(rng, speciesB)

  // 4. Construct BattleMon objects
  const movesetA: [Move, Move, Move, Move] = [
    getMoveById(speciesA.signature_move_1),
    getMoveById(speciesA.signature_move_2),
    varA1,
    varA2,
  ]
  const movesetB: [Move, Move, Move, Move] = [
    getMoveById(speciesB.signature_move_1),
    getMoveById(speciesB.signature_move_2),
    varB1,
    varB2,
  ]

  const monA = buildBattleMon(speciesA, movesetA)
  const monB = buildBattleMon(speciesB, movesetB)

  // 5. Apply ON_BATTLE_START abilities — side A then side B
  const startResultA = applyAbility(monA.ability_id, 'ON_BATTLE_START', {
    self: monA,
    opponent: monB,
  })
  if (startResultA.modified_atk !== undefined) {
    if (monA.ability_id === 'huge_power') {
      monA.base_atk = startResultA.modified_atk
    } else if (monA.ability_id === 'intimidate') {
      monB.base_atk = startResultA.modified_atk
    }
  }

  const startResultB = applyAbility(monB.ability_id, 'ON_BATTLE_START', {
    self: monB,
    opponent: monA,
  })
  if (startResultB.modified_atk !== undefined) {
    if (monB.ability_id === 'huge_power') {
      monB.base_atk = startResultB.modified_atk
    } else if (monB.ability_id === 'intimidate') {
      monA.base_atk = startResultB.modified_atk
    }
  }

  // 6. Emit BATTLE_START
  const events: BattleEvent[] = []
  events.push({
    event_type: 'BATTLE_START',
    payload: {
      side_a_species_id: inputs.side_a_species_id,
      side_b_species_id: inputs.side_b_species_id,
      side_a_moveset: monA.moveset,
      side_b_moveset: monB.moveset,
    },
  })

  // 7. Turn loop
  let turn = 0
  let winner: Side | 'draw' | undefined

  while (monA.current_hp > 0 && monB.current_hp > 0) {
    turn++

    // Phase A — Move selection
    const selA = selectMoveForSide(monA, monB, rng)
    events.push({
      event_type: 'MOVE_SELECTED',
      actor_side: 'a',
      payload: { move_id: selA.move.move_id, slot: selA.slot },
    })

    const selB = selectMoveForSide(monB, monA, rng)
    events.push({
      event_type: 'MOVE_SELECTED',
      actor_side: 'b',
      payload: { move_id: selB.move.move_id, slot: selB.slot },
    })

    // Phase B — Action ordering
    const [firstSide, secondSide] = determineActionOrder(
      selA.move,
      selB.move,
      monA,
      monB,
      rng
    )

    const firstActor = firstSide === 'a' ? monA : monB
    const firstTarget = firstSide === 'a' ? monB : monA
    const firstMove = firstSide === 'a' ? selA.move : selB.move
    const firstTargetSide: Side = firstSide === 'a' ? 'b' : 'a'

    // Phase C — First actor action resolution
    const firstResult = resolveAction(
      firstActor,
      firstTarget,
      firstSide,
      firstTargetSide,
      firstMove,
      rng,
      events
    )

    // Phase D — Terminal check
    if (firstResult.battleOver) {
      winner = firstResult.winner
      break
    }

    // Phase E — Second actor action resolution
    const secondActor = secondSide === 'a' ? monA : monB
    const secondTarget = secondSide === 'a' ? monB : monA
    const secondMove = secondSide === 'a' ? selA.move : selB.move
    const secondTargetSide: Side = secondSide === 'a' ? 'b' : 'a'

    const secondResult = resolveAction(
      secondActor,
      secondTarget,
      secondSide,
      secondTargetSide,
      secondMove,
      rng,
      events
    )

    // Phase F — Terminal check
    if (secondResult.battleOver) {
      winner = secondResult.winner
      break
    }

    // End-of-turn sequence
    const [eotFirst, eotSecond] = determineEndOfTurnOrder(monA, monB, rng)
    const eotOrder: Array<{ mon: BattleMon; side: Side }> = [
      { mon: eotFirst === 'a' ? monA : monB, side: eotFirst },
      { mon: eotSecond === 'a' ? monA : monB, side: eotSecond },
    ]

    let battleEnded = false
    for (const entry of eotOrder) {
      // a. Burn damage
      if (entry.mon.status === 'burn') {
        const burnDmg = computeBurnDamage(entry.mon)
        entry.mon.current_hp = Math.max(0, entry.mon.current_hp - burnDmg)

        events.push({
          event_type: 'BURN_DAMAGE',
          actor_side: entry.side,
          payload: {
            damage: burnDmg,
            remaining_hp: entry.mon.current_hp,
          },
        })

        if (entry.mon.current_hp === 0) {
          events.push({ event_type: 'MON_FAINTED', payload: { side: entry.side } })
          const survivingSide: Side = entry.side === 'a' ? 'b' : 'a'
          const survivingMon = entry.side === 'a' ? monB : monA
          winner = survivingMon.current_hp > 0 ? survivingSide : 'draw'
          events.push({ event_type: 'BATTLE_END', payload: { winner } })
          battleEnded = true
          break
        }
      }

      // b. ON_TURN_END ability (only if mon alive)
      if (entry.mon.current_hp > 0) {
        const turnEndResult = applyAbility(entry.mon.ability_id, 'ON_TURN_END', {
          self: entry.mon,
        })
        if (turnEndResult.new_speed_boost_stacks !== undefined) {
          entry.mon.speed_boost_stacks = turnEndResult.new_speed_boost_stacks
        }
      }
    }

    if (battleEnded) break
  }

  // 8. Return BattleArtifact
  return {
    engine_version: inputs.engine_version,
    content_version: inputs.content_version,
    ruleset_version: inputs.ruleset_version,
    seed: inputs.seed,
    side_a_species_id: inputs.side_a_species_id,
    side_b_species_id: inputs.side_b_species_id,
    // winner is always assigned before the loop exits — every break path sets it
    // via resolveAction or end-of-turn burn termination
    winner: winner!,
    total_turns: turn,
    events,
    side_a_final_moveset: monA.moveset,
    side_b_final_moveset: monB.moveset,
  }
}
