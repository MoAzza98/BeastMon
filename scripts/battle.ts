import { runBattle } from '../packages/kernel/src/index.js'
import { SPECIES } from '../packages/kernel/src/species.js'
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
// Arg parsing
// ---------------------------------------------------------------------------

interface ParsedArgs {
  mode: string
  seed: number
  a: string
  b: string
}

function parseArgs(argv: string[]): ParsedArgs {
  const speciesIds = Object.keys(SPECIES)
  const defaults: ParsedArgs = {
    mode: 'run',
    seed: 1,
    a: speciesIds[0]!,  // safe: SPECIES always has at least 5 entries
    b: speciesIds[1]!,  // safe: SPECIES always has at least 5 entries
  }

  const args = argv.slice(0)

  // First positional arg is mode
  if (args.length > 0 && !args[0]!.startsWith('--')) {
    defaults.mode = args.shift()!
  }

  // Parse named flags
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
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
    }
  }

  return defaults
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

function printEvent(event: BattleEvent): void {
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
      console.log(`${YELLOW}${side} Critical hit!${RESET}`)
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

    case 'MON_FAINTED':
      console.log(`${BOLD}${p['side'] as string} fainted!${RESET}`)
      break

    case 'MOVE_MISSED':
      console.log(`${DIM}${side} ${p['move_id'] as string} missed!${RESET}`)
      break

    case 'STATUS_APPLIED':
      console.log(
        `${YELLOW}${side} Applied ${p['status'] as string} to ${p['target_side'] as string}${RESET}`
      )
      break

    case 'STATUS_FAILED':
      console.log(
        `${DIM}${side} Status failed on ${p['target_side'] as string}: ${p['reason'] as string}${RESET}`
      )
      break

    case 'ACTION_FROZEN_FAILED':
      console.log(`${YELLOW}${side} is frozen solid!${RESET}`)
      break

    case 'ACTION_PARALYSIS_FAILED':
      console.log(`${YELLOW}${side} is paralysed and can't move!${RESET}`)
      break

    case 'BURN_DAMAGE':
      console.log(
        `${RED}${side} Burn damage: ${p['damage'] as number}${RESET} ${DIM}(${p['remaining_hp'] as number} HP remaining)${RESET}`
      )
      break

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

  for (const event of artifact.events) {
    printEvent(event)
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
// Main
// ---------------------------------------------------------------------------

const parsed = parseArgs(process.argv.slice(2))

if (parsed.mode === 'verify') {
  verifyMode(parsed.seed, parsed.a, parsed.b)
} else {
  runMode(parsed.seed, parsed.a, parsed.b)
}
