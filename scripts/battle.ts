import { runBattle } from '../packages/kernel/src/index.js'
import { getMoveById } from '../packages/kernel/src/moves.js'
import { SPECIES, getSpeciesById } from '../packages/kernel/src/species.js'
import type { BattleEvent, KernelInputs } from '../packages/kernel/src/types.js'

// ---------------------------------------------------------------------------
// ANSI colour codes
// ---------------------------------------------------------------------------

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const WHITE = '\x1b[37m'

// ---------------------------------------------------------------------------
// Sleep utility
// ---------------------------------------------------------------------------

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

// ---------------------------------------------------------------------------
// Cinematic display types and helpers
// ---------------------------------------------------------------------------

interface SideDisplay {
  name: string
  maxHp: number
  currentHp: number
  status: string | null
}

function renderHPBar(display: SideDisplay): string {
  const filled = Math.floor((display.currentHp / display.maxHp) * 20)
  const empty = 20 - filled

  // Integer cross-multiplication for colour thresholds — no division
  let colour: string
  if (display.currentHp * 4 > display.maxHp * 2) {
    colour = GREEN   // >50%
  } else if (display.currentHp * 4 > display.maxHp) {
    colour = YELLOW  // >25%, <=50%
  } else {
    colour = RED     // <=25%
  }

  const bar = `${colour}${'█'.repeat(filled)}${'░'.repeat(empty)}${RESET}`
  const hp = `${colour}${display.currentHp}/${display.maxHp}${RESET} HP`
  const nameCol = display.name.toUpperCase().padEnd(10)

  let statusBadge = ''
  if (display.status === 'burn') {
    statusBadge = ` ${RED}[BRN]${RESET}`
  } else if (display.status === 'paralysis') {
    statusBadge = ` ${YELLOW}[PAR]${RESET}`
  } else if (display.status === 'freeze') {
    statusBadge = ` ${CYAN}[FRZ]${RESET}`
  }

  return `  ${nameCol}${bar}  ${hp}${statusBadge}`
}

function printBothBars(sideA: SideDisplay, sideB: SideDisplay): void {
  console.log('')
  console.log(renderHPBar(sideA))
  console.log(renderHPBar(sideB))
  console.log('')
}

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

interface ParsedArgs {
  mode: string
  seed: number
  a: string
  b: string
  delay: number
}

function parseArgs(argv: string[]): ParsedArgs {
  const speciesIds = Object.keys(SPECIES)
  const defaults: ParsedArgs = {
    mode: 'run',
    seed: 1,
    a: speciesIds[0]!,  // safe: SPECIES always has at least 5 entries
    b: speciesIds[1]!,  // safe: SPECIES always has at least 5 entries
    delay: 800,
  }

  const args = argv.slice(0)

  // First positional arg is mode
  if (args.length > 0 && !args[0]!.startsWith('--')) {
    // safe: args.length > 0 guarantees shift() returns a string
    defaults.mode = args.shift()!
  }

  // Parse named flags and collect bare positional args
  const positionals: string[] = []
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!  // safe: i < args.length guarantees index is in bounds
    const next = args[i + 1]
    if (arg === '--seed' && next !== undefined) {
      defaults.seed = parseInt(next, 10)
      i++
    } else if (arg === '--a' && next !== undefined) {
      defaults.a = next
      i++
    } else if (arg === '--b' && next !== undefined) {
      defaults.b = next
      i++
    } else if (arg === '--delay' && next !== undefined) {
      defaults.delay = parseInt(next, 10)
      i++
    } else if (!arg.startsWith('--')) {
      positionals.push(arg)
    }
  }

  // Positional args after mode are treated as species A and B
  // so `battle:random -- embrak torrentis` works without --a/--b flags
  if (positionals.length >= 1) {
    defaults.a = positionals[0]!  // safe: length >= 1
  }
  if (positionals.length >= 2) {
    defaults.b = positionals[1]!  // safe: length >= 2
  }

  return defaults
}

// ---------------------------------------------------------------------------
// Random helpers
// ---------------------------------------------------------------------------

function randomSeed(): number {
  // Generate a random 32-bit unsigned integer seed from system entropy
  return Math.floor(Math.random() * 0xFFFFFFFF)
}

function randomSpecies(): string {
  const ids = Object.keys(SPECIES)
  const index = Math.floor(Math.random() * ids.length)
  return ids[index]!  // safe: ids.length >= 5, index is always in bounds
}

function randomSpeciesPair(): [string, string] {
  const ids = Object.keys(SPECIES)
  const indexA = Math.floor(Math.random() * ids.length)
  let indexB = Math.floor(Math.random() * (ids.length - 1))
  if (indexB >= indexA) indexB++  // ensure B != A
  return [ids[indexA]!, ids[indexB]!]  // safe: both indices are in bounds
}

// ---------------------------------------------------------------------------
// Build kernel inputs
// ---------------------------------------------------------------------------

function buildInputs(seed: number, a: string, b: string): KernelInputs {
  return {
    engine_version: '1.0.0',
    content_version: '1.0.0',
    ruleset_version: '1.0.0',
    seed,
    side_a_species_id: a,
    side_b_species_id: b,
  }
}

// ---------------------------------------------------------------------------
// Event printer
// ---------------------------------------------------------------------------

function printEvent(event: BattleEvent, getName: (side: string) => string): void {
  const p = event.payload
  const side = event.actor_side !== undefined ? `[${event.actor_side}]` : ''

  switch (event.event_type) {
    case 'BATTLE_START':
      console.log(`${BOLD}${WHITE}${'='.repeat(60)}${RESET}`)
      console.log(
        `${BOLD}${WHITE}BATTLE START: ${p['side_a_species_id'] as string} vs ${p['side_b_species_id'] as string}${RESET}`
      )
      console.log(`${BOLD}${WHITE}${'='.repeat(60)}${RESET}`)
      break

    case 'BATTLE_END':
      console.log(`${BOLD}${WHITE}${'='.repeat(60)}${RESET}`)
      console.log(`${BOLD}${WHITE}BATTLE END — Winner: ${p['winner'] as string}${RESET}`)
      console.log(`${BOLD}${WHITE}${'='.repeat(60)}${RESET}`)
      break

    case 'MOVE_SELECTED':
      console.log(
        `${CYAN}${side} Selected move: ${p['move_id'] as string} (slot ${p['slot'] as number})${RESET}`
      )
      break

    case 'DAMAGE_DEALT':
      console.log(
        `${side} ${RED}Damage: ${p['damage'] as number}${RESET} to ${p['target_side'] as string} ${DIM}(${p['remaining_hp'] as number} HP remaining)${RESET}`
      )
      break

    case 'CRIT':
      console.log(`${YELLOW}${side} A critical hit!${RESET}`)
      break

    case 'TYPE_SUPER_EFFECTIVE':
      console.log(`${GREEN}${side} It's super effective!${RESET}`)
      break

    case 'TYPE_RESISTED':
      console.log(`${DIM}${side} It's not very effective...${RESET}`)
      break

    case 'TYPE_IMMUNE':
      console.log(`${DIM}${side} It had no effect!${RESET}`)
      break

    case 'MON_FAINTED': {
      const faintedSide = p['side'] as string
      console.log(`${BOLD}${getName(faintedSide)} fainted!${RESET}`)
      break
    }

    case 'MOVE_MISSED': {
      const actorSide = event.actor_side as string
      console.log(`${DIM}${side} ${getName(actorSide)}'s attack missed!${RESET}`)
      break
    }

    case 'STATUS_APPLIED': {
      const targetSide = p['target_side'] as string
      const status = p['status'] as string
      let statusMsg: string
      if (status === 'burn') {
        statusMsg = `${getName(targetSide)} was burned!`
      } else if (status === 'paralysis') {
        statusMsg = `${getName(targetSide)} was paralyzed! It may be unable to move!`
      } else if (status === 'freeze') {
        statusMsg = `${getName(targetSide)} was frozen solid!`
      } else {
        statusMsg = `${getName(targetSide)} was afflicted with ${status}!`
      }
      console.log(`${YELLOW}${side} ${statusMsg}${RESET}`)
      break
    }

    case 'STATUS_FAILED': {
      const reason = p['reason'] as string
      const failTargetSide = p['target_side'] as string
      let failMsg: string
      if (reason === 'already_statused') {
        failMsg = `But it already has a status condition — it failed!`
      } else if (reason === 'proc_failed') {
        failMsg = `The status effect didn't take hold.`
      } else if (reason === 'immunity_ability') {
        failMsg = `${getName(failTargetSide)}'s ability protected it from the status!`
      } else if (reason === 'type_immunity') {
        failMsg = `${getName(failTargetSide)} is immune to that status!`
      } else {
        failMsg = `Status failed: ${reason}`
      }
      console.log(`${DIM}${side} ${failMsg}${RESET}`)
      break
    }

    case 'ACTION_FROZEN_FAILED': {
      const frozenSide = event.actor_side as string
      console.log(`${YELLOW}${side} ${getName(frozenSide)} is frozen solid and can't move!${RESET}`)
      break
    }

    case 'ACTION_PARALYSIS_FAILED': {
      const paraSide = event.actor_side as string
      console.log(`${YELLOW}${side} ${getName(paraSide)} is paralyzed! It can't move!${RESET}`)
      break
    }

    case 'BURN_DAMAGE': {
      const burnSide = event.actor_side as string
      console.log(
        `${RED}${side} ${getName(burnSide)} is hurt by its burn! Damage: ${p['damage'] as number}${RESET} ${DIM}(${p['remaining_hp'] as number} HP remaining)${RESET}`
      )
      break
    }

    case 'THAW_SUCCESS': {
      const thawSide = p['actor_side'] as string
      console.log(`${YELLOW}${getName(thawSide)} thawed out!${RESET}`)
      break
    }

    case 'ABILITY_TRIGGERED': {
      const abilityId = p['ability_id'] as string
      const abilityActorSide = p['actor_side'] as string
      const affectedSide = p['affected_side'] as string
      const oldValue = p['old_value'] as number
      const newValue = p['new_value'] as number
      if (abilityId === 'huge_power') {
        console.log(
          `${YELLOW}${getName(abilityActorSide)}'s Huge Power activated! Its Attack surged! (${oldValue} → ${newValue})${RESET}`
        )
      } else if (abilityId === 'intimidate') {
        console.log(
          `${YELLOW}${getName(abilityActorSide)}'s Intimidate triggered! ${getName(affectedSide)}'s Attack fell! (${oldValue} → ${newValue})${RESET}`
        )
      } else {
        console.log(
          `${YELLOW}${getName(abilityActorSide)}'s ${abilityId} triggered! (${oldValue} → ${newValue})${RESET}`
        )
      }
      break
    }

    case 'STURDY_ACTIVATED': {
      const sturdySide = p['side'] as string
      console.log(`${YELLOW}${BOLD}${getName(sturdySide)} endured the hit with Sturdy! It hung on with 1 HP!${RESET}`)
      break
    }

    case 'SPEED_BOOST_STACKED': {
      const boostSide = p['side'] as string
      const newStacks = p['new_stacks'] as number
      console.log(
        `${YELLOW}${getName(boostSide)}'s Speed Boost activated! (${newStacks} stack${newStacks === 1 ? '' : 's'})${RESET}`
      )
      break
    }

    default:
      console.log(
        `${DIM}${side} ${event.event_type}: ${JSON.stringify(p)}${RESET}`
      )
      break
  }
}

// ---------------------------------------------------------------------------
// run mode
// ---------------------------------------------------------------------------

function runMode(seed: number, a: string, b: string): void {
  const inputs = buildInputs(seed, a, b)
  const artifact = runBattle(inputs)

  const getName = (side: string): string =>
    side === 'a'
      ? getSpeciesById(artifact.side_a_species_id).name
      : getSpeciesById(artifact.side_b_species_id).name

  for (const event of artifact.events) {
    printEvent(event, getName)
  }

  console.log('')
  console.log(`Total turns: ${artifact.total_turns}`)
  console.log(
    `Side A moveset: ${artifact.side_a_final_moveset.map((m) => m.move_id).join(', ')}`
  )
  console.log(
    `Side B moveset: ${artifact.side_b_final_moveset.map((m) => m.move_id).join(', ')}`
  )
}

// ---------------------------------------------------------------------------
// verify mode
// ---------------------------------------------------------------------------

function verifyMode(seed: number, a: string, b: string): void {
  const inputs = buildInputs(seed, a, b)
  const artifact1 = runBattle(inputs)
  const artifact2 = runBattle(inputs)

  const json1 = JSON.stringify(artifact1)
  const json2 = JSON.stringify(artifact2)

  if (json1 === json2) {
    console.log(
      `${GREEN}${BOLD}DETERMINISM VERIFIED${RESET}`
    )
    console.log(
      `${GREEN}Events: ${artifact1.events.length} | Winner: ${artifact1.winner} | Turns: ${artifact1.total_turns}${RESET}`
    )
  } else {
    console.log(`${RED}${BOLD}DETERMINISM FAILURE${RESET}`)

    // Find first divergent event
    const maxLen = Math.max(artifact1.events.length, artifact2.events.length)
    for (let i = 0; i < maxLen; i++) {
      const e1 = JSON.stringify(artifact1.events[i])
      const e2 = JSON.stringify(artifact2.events[i])
      if (e1 !== e2) {
        console.log(`${RED}First divergence at event index ${i}:${RESET}`)
        console.log(`  Run 1: ${e1}`)
        console.log(`  Run 2: ${e2}`)
        break
      }
    }

    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// random mode — random seed, user-specified (or default) species
// ---------------------------------------------------------------------------

function randomMode(a: string, b: string): void {
  const seed = randomSeed()
  console.log(`${DIM}Seed: ${seed}${RESET}`)
  console.log('')
  runMode(seed, a, b)
}

// ---------------------------------------------------------------------------
// chaos mode — random seed AND random species
// ---------------------------------------------------------------------------

function chaosMode(): void {
  const seed = randomSeed()
  const [a, b] = randomSpeciesPair()
  console.log(`${DIM}Seed: ${seed} | ${getSpeciesById(a).name} vs ${getSpeciesById(b).name}${RESET}`)
  console.log('')
  runMode(seed, a, b)
}

// ---------------------------------------------------------------------------
// cinematic mode
// ---------------------------------------------------------------------------

async function cinematicMode(seed: number, a: string, b: string, delay: number): Promise<void> {
  const inputs = buildInputs(seed, a, b)
  const artifact = runBattle(inputs)

  const getName = (side: string): string =>
    side === 'a'
      ? getSpeciesById(artifact.side_a_species_id).name
      : getSpeciesById(artifact.side_b_species_id).name

  let sideA: SideDisplay | null = null
  let sideB: SideDisplay | null = null
  let turnCount = 0
  let pendingMoveA: string | null = null

  for (const event of artifact.events) {
    // payload is typed as Record<string, unknown>
    const p = event.payload

    switch (event.event_type) {
      case 'BATTLE_START': {
        const speciesA = getSpeciesById(p['side_a_species_id'] as string)
        const speciesB = getSpeciesById(p['side_b_species_id'] as string)

        sideA = {
          name: speciesA.name,
          maxHp: speciesA.base_hp,
          currentHp: speciesA.base_hp,
          status: null,
        }
        sideB = {
          name: speciesB.name,
          maxHp: speciesB.base_hp,
          currentHp: speciesB.base_hp,
          status: null,
        }

        // Header box — 48 inner characters
        const title = `⚔  ${speciesA.name.toUpperCase()}  vs  ${speciesB.name.toUpperCase()}  ⚔`
        const padded = title.padStart(Math.floor((48 + title.length) / 2)).padEnd(48)
        console.log(`${BOLD}`)
        console.log(`╔${'═'.repeat(48)}╗`)
        console.log(`║${padded}║`)
        console.log(`╚${'═'.repeat(48)}╝`)
        console.log(`${RESET}`)

        printBothBars(sideA, sideB)
        await sleep(delay)
        break
      }

      case 'MOVE_SELECTED': {
        const actorSide = event.actor_side as string
        const moveName = getMoveById(p['move_id'] as string).name // payload is typed as Record<string, unknown>

        if (actorSide === 'a') {
          turnCount++
          console.log(`${DIM}${'━'.repeat(20)}  Turn ${turnCount}  ${'━'.repeat(20)}${RESET}`)
          pendingMoveA = moveName
        } else {
          // Side B selection — print both moves
          console.log(`  ${CYAN}${getName('a').toUpperCase()}${RESET}  →  ${pendingMoveA}`)
          console.log(`  ${CYAN}${getName('b').toUpperCase()}${RESET}  →  ${moveName}`)
          pendingMoveA = null
          await sleep(Math.floor(delay / 2))
        }
        break
      }

      case 'CRIT':
        console.log(`  ${YELLOW}✦ Critical hit!${RESET}`)
        break

      case 'TYPE_SUPER_EFFECTIVE':
        console.log(`  ${GREEN}⚡ Super effective!${RESET}`)
        break

      case 'TYPE_RESISTED':
        console.log(`  ${DIM}Not very effective...${RESET}`)
        break

      case 'TYPE_IMMUNE':
        console.log(`  ${DIM}It had no effect.${RESET}`)
        break

      case 'DAMAGE_DEALT': {
        const actorSide = event.actor_side as string
        const targetSide = p['target_side'] as string // payload is typed as Record<string, unknown>
        const damage = p['damage'] as number // payload is typed as Record<string, unknown>
        const remainingHp = p['remaining_hp'] as number // payload is typed as Record<string, unknown>
        const moveName = getMoveById(p['move_id'] as string).name // payload is typed as Record<string, unknown>

        console.log(`  ${getName(actorSide).toUpperCase()} uses ${moveName}!`)
        console.log(`  ${RED}${getName(targetSide).toUpperCase()} takes ${damage} damage!${RESET}`)

        // Update target HP
        const target = targetSide === 'a' ? sideA! : sideB! // safe: BATTLE_START always precedes DAMAGE_DEALT
        target.currentHp = remainingHp

        printBothBars(sideA!, sideB!)
        await sleep(delay)
        break
      }

      case 'BURN_DAMAGE': {
        const burnSide = event.actor_side as string
        const damage = p['damage'] as number // payload is typed as Record<string, unknown>
        const remainingHp = p['remaining_hp'] as number // payload is typed as Record<string, unknown>

        console.log(`  ${RED}🔥 ${getName(burnSide).toUpperCase()} is hurt by its burn!${RESET}`)
        console.log(`  ${RED}${getName(burnSide).toUpperCase()} takes ${damage} damage!${RESET}`)

        // Update burning mon HP
        const burnMon = burnSide === 'a' ? sideA! : sideB! // safe: BATTLE_START always precedes BURN_DAMAGE
        burnMon.currentHp = remainingHp

        printBothBars(sideA!, sideB!)
        await sleep(delay)
        break
      }

      case 'STATUS_APPLIED': {
        const targetSide = p['target_side'] as string // payload is typed as Record<string, unknown>
        const status = p['status'] as string // payload is typed as Record<string, unknown>

        // Update status on target
        const target = targetSide === 'a' ? sideA! : sideB! // safe: BATTLE_START always precedes STATUS_APPLIED
        target.status = status

        let label: string
        if (status === 'burn') {
          label = '🔥 burned'
        } else if (status === 'paralysis') {
          label = '⚡ paralyzed'
        } else if (status === 'freeze') {
          label = '❄  frozen'
        } else {
          label = `afflicted with ${status}`
        }
        console.log(`  ${YELLOW}${getName(targetSide).toUpperCase()} was ${label}!${RESET}`)
        break
      }

      case 'STATUS_FAILED':
        console.log(`  ${DIM}Status had no effect.${RESET}`)
        break

      case 'ACTION_FROZEN_FAILED': {
        const frozenSide = event.actor_side as string
        console.log(`  ${CYAN}${getName(frozenSide).toUpperCase()} is frozen solid and can't move!${RESET}`)
        await sleep(delay)
        break
      }

      case 'ACTION_PARALYSIS_FAILED': {
        const paraSide = event.actor_side as string
        console.log(`  ${YELLOW}${getName(paraSide).toUpperCase()} is paralyzed! It can't move!${RESET}`)
        await sleep(delay)
        break
      }

      case 'MOVE_MISSED': {
        const missActorSide = event.actor_side as string
        const moveName = getMoveById(p['move_id'] as string).name // payload is typed as Record<string, unknown>
        console.log(`  ${DIM}${getName(missActorSide).toUpperCase()}'s ${moveName} missed!${RESET}`)
        await sleep(delay)
        break
      }

      case 'MON_FAINTED': {
        const faintedSide = p['side'] as string // payload is typed as Record<string, unknown>
        console.log(`  ${BOLD}${getName(faintedSide).toUpperCase()} fainted!${RESET}`)
        await sleep(delay)
        break
      }

      case 'BATTLE_END': {
        const winner = p['winner'] as string // payload is typed as Record<string, unknown>

        if (winner === 'draw') {
          console.log(`${BOLD}`)
          console.log(`  It's a draw!`)
          console.log(`${RESET}`)
        } else {
          const winnerName = getName(winner).toUpperCase()
          const title = `🏆  ${winnerName}  wins!`
          const padded = title.padStart(Math.floor((48 + title.length) / 2)).padEnd(48)
          console.log(`${BOLD}`)
          console.log(`╔${'═'.repeat(48)}╗`)
          console.log(`║${padded}║`)
          console.log(`╚${'═'.repeat(48)}╝`)
          console.log(`${RESET}`)
        }

        console.log(`  Turns: ${artifact.total_turns}`)
        console.log(`  Seed:  ${seed}`)
        break
      }

      default:
        // Graceful handling for events not specified in cinematic spec
        // (THAW_SUCCESS, ABILITY_TRIGGERED, STURDY_ACTIVATED, SPEED_BOOST_STACKED)
        if (event.actor_side !== undefined) {
          console.log(`  ${DIM}${getName(event.actor_side)}: ${event.event_type}${RESET}`)
        } else {
          console.log(`  ${DIM}${event.event_type}${RESET}`)
        }
        break
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const parsed = parseArgs(process.argv.slice(2))

if (parsed.mode === 'verify') {
  verifyMode(parsed.seed, parsed.a, parsed.b)
} else if (parsed.mode === 'random') {
  randomMode(parsed.a, parsed.b)
} else if (parsed.mode === 'chaos') {
  chaosMode()
} else if (parsed.mode === 'cinematic') {
  void cinematicMode(parsed.seed, parsed.a, parsed.b, parsed.delay)
} else {
  runMode(parsed.seed, parsed.a, parsed.b)
}
