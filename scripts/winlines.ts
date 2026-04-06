/**
 * Win Line Analysis Script
 *
 * Scans seeds where a specific species wins a matchup, extracts per-battle
 * conditions, and aggregates them into a pattern report for balance analysis.
 *
 * Usage:
 *   tsx scripts/winlines.ts scan    --a <id> --b <id> --winner <id> [--count N] [--search-limit N]
 *   tsx scripts/winlines.ts analyze --a <id> --b <id> --winner <id> [--count N] [--search-limit N]
 */

import { runBattle } from '../packages/kernel/src/index.js'
import { SPECIES } from '../packages/kernel/src/species.js'
import type { BattleArtifact, BattleEvent, Side } from '../packages/kernel/src/types.js'
import type { StatusEffect } from '../packages/kernel/src/types.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedArgs {
  mode: 'scan' | 'analyze'
  sideA: string
  sideB: string
  winner: string
  count: number
  searchLimit: number
}

interface BattleRecord {
  seed: number
  total_turns: number
  kill_source: 'burn' | 'damage'
  winner_status_applied: StatusEffect | null
  winner_status_turn: number | null
  loser_status_applied: StatusEffect | null
  winner_crit_on_kill: boolean
  winner_se_on_kill: boolean
  winner_crit_turn_1: boolean
  winner_ended_low_hp: boolean
  winner_remaining_hp: number
  winner_ability_fired: boolean
  loser_ability_fired: boolean
  winner_max_speed_boost: number
  winner_action_failed: boolean
  loser_action_failed: boolean
  loser_status_failed: boolean
  winner_miss: boolean
}

interface WinlinePattern {
  seeds_found: number
  seeds_scanned: number
  win_rate_in_scan: number

  avg_turns: number
  min_turns: number
  max_turns: number

  burn_on_loser_rate: number
  burn_by_turn_2_rate: number
  para_on_loser_rate: number
  freeze_on_loser_rate: number
  any_status_on_loser_rate: number

  burn_on_winner_rate: number
  para_on_winner_rate: number
  any_status_on_winner_rate: number

  kill_by_burn_rate: number
  kill_by_damage_rate: number

  winner_crit_on_kill_rate: number
  winner_se_on_kill_rate: number
  winner_crit_turn_1_rate: number

  winner_ended_low_hp_rate: number
  winner_ability_fired_rate: number
  loser_ability_fired_rate: number
  winner_max_speed_boost_avg: number
  winner_action_failed_rate: number
  loser_action_failed_rate: number
  loser_status_failed_rate: number
  winner_miss_rate: number

  short_battle_rate: number
  long_battle_rate: number
}

// ---------------------------------------------------------------------------
// CLI Parsing
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(`Usage:
  tsx scripts/winlines.ts scan    --a <id> --b <id> --winner <id> [--count N] [--search-limit N]
  tsx scripts/winlines.ts analyze --a <id> --b <id> --winner <id> [--count N] [--search-limit N]

Species: ${Object.keys(SPECIES).join(', ')}`)
}

function fail(msg: string): never {
  console.error(`Error: ${msg}`)
  process.exit(1)
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.length === 0) {
    printUsage()
    process.exit(1)
  }

  const mode = argv[0]
  if (mode !== 'scan' && mode !== 'analyze') {
    printUsage()
    fail(`Unknown mode "${mode}". Use "scan" or "analyze".`)
  }

  let sideA: string | undefined
  let sideB: string | undefined
  let winner: string | undefined
  let count = 200
  let searchLimit = 500000

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i]
    const next = argv[i + 1]
    switch (arg) {
      case '--a':
        sideA = next; i++; break
      case '--b':
        sideB = next; i++; break
      case '--winner':
        winner = next; i++; break
      case '--count':
        count = parseInt(next ?? '', 10); i++; break
      case '--search-limit':
        searchLimit = parseInt(next ?? '', 10); i++; break
      default:
        fail(`Unknown flag: ${arg}`)
    }
  }

  if (!sideA) fail('--a is required')
  if (!sideB) fail('--b is required')
  if (!winner) fail('--winner is required')

  if (!(sideA in SPECIES)) fail(`Unknown species for --a: "${sideA}"`)
  if (!(sideB in SPECIES)) fail(`Unknown species for --b: "${sideB}"`)
  if (sideA === sideB) fail('--a and --b must differ')
  if (winner !== sideA && winner !== sideB) fail('--winner must be one of --a or --b')

  if (!Number.isInteger(count) || count < 1) fail('--count must be a positive integer')
  if (count < 10) fail('--count minimum is 10')
  if (!Number.isInteger(searchLimit) || searchLimit < 1) fail('--search-limit must be a positive integer')
  if (searchLimit < count) fail('--search-limit must be >= --count')

  return { mode, sideA, sideB, winner, count, searchLimit }
}

// ---------------------------------------------------------------------------
// Turn Map
// ---------------------------------------------------------------------------

function buildTurnMap(events: BattleEvent[]): number[] {
  let turn = 0
  return events.map(e => {
    if (e.event_type === 'MOVE_SELECTED' && e.actor_side === 'a') turn++
    return turn
  })
}

// ---------------------------------------------------------------------------
// Per-Battle Extraction
// ---------------------------------------------------------------------------

function extractRecord(
  artifact: BattleArtifact,
  seed: number,
  winnerSide: Side,
  loserSide: Side,
  winnerSpeciesId: string
): BattleRecord {
  const events = artifact.events
  const turnMap = buildTurnMap(events)

  // --- kill_source ---
  const faintedIdx = events.findIndex(
    e => e.event_type === 'MON_FAINTED' && e.payload['side'] === loserSide
  )
  let kill_source: 'burn' | 'damage' = 'damage'
  if (faintedIdx > 0) {
    const prev = events[faintedIdx - 1]
    if (prev && prev.event_type === 'BURN_DAMAGE') {
      kill_source = 'burn'
    }
  }

  // --- winner_status_applied (status winner inflicted on loser) ---
  let winner_status_applied: StatusEffect | null = null
  let winner_status_turn: number | null = null
  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    if (
      e && e.event_type === 'STATUS_APPLIED' &&
      e.payload['target_side'] === loserSide
    ) {
      winner_status_applied = e.payload['status'] as StatusEffect
      winner_status_turn = turnMap[i] ?? 0
      break
    }
  }

  // --- loser_status_applied (status loser inflicted on winner) ---
  let loser_status_applied: StatusEffect | null = null
  for (const e of events) {
    if (
      e.event_type === 'STATUS_APPLIED' &&
      e.payload['target_side'] === winnerSide
    ) {
      loser_status_applied = e.payload['status'] as StatusEffect
      break
    }
  }

  // --- winner_crit_on_kill and winner_se_on_kill ---
  let winner_crit_on_kill = false
  let winner_se_on_kill = false

  // Find the DAMAGE_DEALT event that killed the loser (remaining_hp === 0, actor_side === winnerSide)
  let killDmgIdx = -1
  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    if (
      e && e.event_type === 'DAMAGE_DEALT' &&
      e.actor_side === winnerSide &&
      e.payload['remaining_hp'] === 0
    ) {
      killDmgIdx = i
    }
  }

  if (killDmgIdx >= 0) {
    const killTurn = turnMap[killDmgIdx] ?? 0
    // Scan backwards from killDmgIdx within the same turn for CRIT / TYPE_SUPER_EFFECTIVE
    for (let j = killDmgIdx - 1; j >= 0; j--) {
      const ej = events[j]
      if (!ej) break
      const jTurn = turnMap[j] ?? 0
      if (jTurn < killTurn) break
      // Stop if we hit a MOVE_SELECTED for the winner (start of their action this turn)
      if (ej.event_type === 'MOVE_SELECTED' && ej.actor_side === winnerSide) break
      if (ej.event_type === 'CRIT' && ej.actor_side === winnerSide) {
        winner_crit_on_kill = true
      }
      if (ej.event_type === 'TYPE_SUPER_EFFECTIVE' && ej.actor_side === winnerSide) {
        winner_se_on_kill = true
      }
    }
  }

  // --- winner_crit_turn_1 ---
  let winner_crit_turn_1 = false
  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    if (
      e && e.event_type === 'CRIT' &&
      e.actor_side === winnerSide &&
      (turnMap[i] ?? 0) === 1
    ) {
      winner_crit_turn_1 = true
      break
    }
  }

  // --- winner_ended_low_hp and winner_remaining_hp ---
  const baseHp = SPECIES[winnerSpeciesId as keyof typeof SPECIES].base_hp
  let winnerLastHp = baseHp // default: full HP if no damage event
  for (let i = 0; i < faintedIdx && i < events.length; i++) {
    const e = events[i]
    if (!e) continue
    if (
      e.event_type === 'DAMAGE_DEALT' &&
      e.payload['target_side'] === winnerSide
    ) {
      winnerLastHp = e.payload['remaining_hp'] as number
    } else if (
      e.event_type === 'BURN_DAMAGE' &&
      e.actor_side === winnerSide
    ) {
      winnerLastHp = e.payload['remaining_hp'] as number
    }
  }
  const winner_ended_low_hp = winnerLastHp * 4 <= baseHp

  // --- ability fields ---
  let winner_ability_fired = false
  let loser_ability_fired = false
  let winner_max_speed_boost = 0

  for (const e of events) {
    // Winner ability
    if (
      (e.event_type === 'ABILITY_TRIGGERED' && e.payload['actor_side'] === winnerSide) ||
      (e.event_type === 'STURDY_ACTIVATED' && e.payload['side'] === winnerSide) ||
      (e.event_type === 'SPEED_BOOST_STACKED' && e.payload['side'] === winnerSide)
    ) {
      winner_ability_fired = true
    }
    // Loser ability
    if (
      (e.event_type === 'ABILITY_TRIGGERED' && e.payload['actor_side'] === loserSide) ||
      (e.event_type === 'STURDY_ACTIVATED' && e.payload['side'] === loserSide) ||
      (e.event_type === 'SPEED_BOOST_STACKED' && e.payload['side'] === loserSide)
    ) {
      loser_ability_fired = true
    }
    // Winner max speed boost
    if (e.event_type === 'SPEED_BOOST_STACKED' && e.payload['side'] === winnerSide) {
      const stacks = e.payload['new_stacks'] as number
      if (stacks > winner_max_speed_boost) winner_max_speed_boost = stacks
    }
  }

  // --- action failed ---
  let winner_action_failed = false
  let loser_action_failed = false
  for (const e of events) {
    if (
      (e.event_type === 'ACTION_PARALYSIS_FAILED' || e.event_type === 'ACTION_FROZEN_FAILED') &&
      e.actor_side === winnerSide
    ) {
      winner_action_failed = true
    }
    if (
      (e.event_type === 'ACTION_PARALYSIS_FAILED' || e.event_type === 'ACTION_FROZEN_FAILED') &&
      e.actor_side === loserSide
    ) {
      loser_action_failed = true
    }
  }

  // --- loser_status_failed ---
  let loser_status_failed = false
  for (const e of events) {
    if (e.event_type === 'STATUS_FAILED' && e.actor_side === loserSide) {
      loser_status_failed = true
      break
    }
  }

  // --- winner_miss ---
  let winner_miss = false
  for (const e of events) {
    if (e.event_type === 'MOVE_MISSED' && e.actor_side === winnerSide) {
      winner_miss = true
      break
    }
  }

  return {
    seed,
    total_turns: artifact.total_turns,
    kill_source,
    winner_status_applied,
    winner_status_turn,
    loser_status_applied,
    winner_crit_on_kill,
    winner_se_on_kill,
    winner_crit_turn_1,
    winner_ended_low_hp,
    winner_remaining_hp: winnerLastHp,
    winner_ability_fired,
    loser_ability_fired,
    winner_max_speed_boost,
    winner_action_failed,
    loser_action_failed,
    loser_status_failed,
    winner_miss,
  }
}

// ---------------------------------------------------------------------------
// Seed Scanning
// ---------------------------------------------------------------------------

function scanSeeds(args: ParsedArgs): { records: BattleRecord[]; scanned: number } {
  const winnerSide: Side = args.winner === args.sideA ? 'a' : 'b'
  const loserSide: Side = winnerSide === 'a' ? 'b' : 'a'
  const winnerName = SPECIES[args.winner as keyof typeof SPECIES].name
  const loserName = SPECIES[(winnerSide === 'a' ? args.sideB : args.sideA) as keyof typeof SPECIES].name

  const records: BattleRecord[] = []
  let found = 0
  let scanned = 0

  for (let seed = 1; seed <= args.searchLimit && found < args.count; seed++) {
    scanned++
    const artifact = runBattle({
      engine_version: '1.0.0',
      content_version: '1.0.0',
      ruleset_version: '1.0.0',
      seed,
      side_a_species_id: args.sideA,
      side_b_species_id: args.sideB,
    })

    if (artifact.winner === 'draw') continue
    if (artifact.winner !== winnerSide) continue

    records.push(extractRecord(artifact, seed, winnerSide, loserSide, args.winner))
    found++

    if (seed % 500 === 0 || found % 10 === 0) {
      process.stdout.write(
        `\r  Scanning seeds for ${winnerName} victories vs ${loserName}... [${found} / ${args.count} found | ${scanned.toLocaleString()} scanned]`
      )
    }
  }

  // Clear progress line
  process.stdout.write('\r' + ' '.repeat(100) + '\r')

  if (found === 0) {
    fail(`No winning seeds found after scanning ${scanned.toLocaleString()} seeds.`)
  }

  if (found < args.count) {
    console.log(
      `Warning: Only found ${found} winning seeds after scanning all ${scanned.toLocaleString()} seeds (requested ${args.count}).`
    )
  }

  return { records, scanned }
}

// ---------------------------------------------------------------------------
// Pattern Aggregation
// ---------------------------------------------------------------------------

function aggregatePatterns(records: BattleRecord[], seedsScanned: number): WinlinePattern {
  const n = records.length

  const sum = (fn: (r: BattleRecord) => boolean): number =>
    records.reduce((acc, r) => acc + (fn(r) ? 1 : 0), 0)

  const rate = (fn: (r: BattleRecord) => boolean): number => sum(fn) / n

  const turnSum = records.reduce((acc, r) => acc + r.total_turns, 0)
  const turns = records.map(r => r.total_turns)
  const speedBoostSum = records.reduce((acc, r) => acc + r.winner_max_speed_boost, 0)

  return {
    seeds_found: n,
    seeds_scanned: seedsScanned,
    win_rate_in_scan: n / seedsScanned,

    avg_turns: turnSum / n,
    min_turns: Math.min(...turns),
    max_turns: Math.max(...turns),

    burn_on_loser_rate: rate(r => r.winner_status_applied === 'burn'),
    burn_by_turn_2_rate: rate(r => r.winner_status_applied === 'burn' && r.winner_status_turn !== null && r.winner_status_turn <= 2),
    para_on_loser_rate: rate(r => r.winner_status_applied === 'paralysis'),
    freeze_on_loser_rate: rate(r => r.winner_status_applied === 'freeze'),
    any_status_on_loser_rate: rate(r => r.winner_status_applied !== null),

    burn_on_winner_rate: rate(r => r.loser_status_applied === 'burn'),
    para_on_winner_rate: rate(r => r.loser_status_applied === 'paralysis'),
    any_status_on_winner_rate: rate(r => r.loser_status_applied !== null),

    kill_by_burn_rate: rate(r => r.kill_source === 'burn'),
    kill_by_damage_rate: rate(r => r.kill_source === 'damage'),

    winner_crit_on_kill_rate: rate(r => r.winner_crit_on_kill),
    winner_se_on_kill_rate: rate(r => r.winner_se_on_kill),
    winner_crit_turn_1_rate: rate(r => r.winner_crit_turn_1),

    winner_ended_low_hp_rate: rate(r => r.winner_ended_low_hp),
    winner_ability_fired_rate: rate(r => r.winner_ability_fired),
    loser_ability_fired_rate: rate(r => r.loser_ability_fired),
    winner_max_speed_boost_avg: speedBoostSum / n,
    winner_action_failed_rate: rate(r => r.winner_action_failed),
    loser_action_failed_rate: rate(r => r.loser_action_failed),
    loser_status_failed_rate: rate(r => r.loser_status_failed),
    winner_miss_rate: rate(r => r.winner_miss),

    short_battle_rate: rate(r => r.total_turns <= 4),
    long_battle_rate: rate(r => r.total_turns >= 10),
  }
}

// ---------------------------------------------------------------------------
// Output: scan mode
// ---------------------------------------------------------------------------

function printScanTable(records: BattleRecord[], scanned: number, args: ParsedArgs): void {
  const winnerName = SPECIES[args.winner as keyof typeof SPECIES].name
  const loserKey = args.winner === args.sideA ? args.sideB : args.sideA
  const loserName = SPECIES[loserKey as keyof typeof SPECIES].name
  const baseHp = SPECIES[args.winner as keyof typeof SPECIES].base_hp

  console.log(
    `${winnerName} beats ${loserName} \u2014 ${records.length} winning seeds found (scanned ${scanned.toLocaleString()})\n`
  )

  const header = ' Seed    | Turns | Kill   | Winner Status | Loser Status | Crit Kill | SE Kill | Win HP%  | Notes'
  const divider = '---------|-------|--------|---------------|--------------|-----------|---------|----------|--------'
  console.log(header)
  console.log(divider)

  const displayCount = Math.min(records.length, 50)
  for (let i = 0; i < displayCount; i++) {
    const r = records[i]
    if (!r) continue

    const seedStr = String(r.seed).padStart(7)
    const turnsStr = String(r.total_turns).padStart(5)
    const killStr = r.kill_source.padEnd(6)

    let winStatusStr = '-'
    if (r.winner_status_applied) {
      winStatusStr = `${r.winner_status_applied} T${r.winner_status_turn}`
    }
    winStatusStr = winStatusStr.padEnd(13)

    let loseStatusStr = '-'
    if (r.loser_status_applied) {
      loseStatusStr = r.loser_status_applied
    }
    loseStatusStr = loseStatusStr.padEnd(12)

    let critKillStr = r.winner_crit_on_kill ? 'yes' : 'no'
    if (r.winner_crit_on_kill && r.winner_crit_turn_1) critKillStr = 'yes (T1)'
    critKillStr = critKillStr.padEnd(9)

    const seKillStr = (r.winner_se_on_kill ? 'yes' : 'no').padEnd(7)

    const hpPct = Math.floor((r.winner_remaining_hp * 100) / baseHp)
    const hpStr = `${hpPct}%`.padStart(8)

    // Notes
    const notes: string[] = []
    if (r.winner_crit_on_kill && r.total_turns <= 4) notes.push('CRIT BURST')
    if (r.winner_ended_low_hp) notes.push('LOW HP WIN')
    if (r.winner_action_failed) notes.push('SURVIVED LOCK')
    if (r.loser_status_applied === 'burn') notes.push('SURVIVED BURN')
    if (r.loser_ability_fired) notes.push('OPP ABILITY FIRED')

    console.log(
      `${seedStr} | ${turnsStr} | ${killStr} | ${winStatusStr} | ${loseStatusStr} | ${critKillStr} | ${seKillStr} | ${hpStr} | ${notes.join(', ')}`
    )
  }

  if (records.length > 50) {
    console.log(`\n(showing first 50 of ${records.length})`)
  }
}

// ---------------------------------------------------------------------------
// Output: analyze mode
// ---------------------------------------------------------------------------

// ANSI codes
const BOLD_YELLOW = '\x1b[1;33m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

function colorRate(rate: number, formatted: string): string {
  if (rate >= 0.80) return `${BOLD_YELLOW}${formatted}${RESET}`
  if (rate >= 0.40) return formatted
  return `${DIM}${formatted}${RESET}`
}

function fmtPct(rate: number): string {
  return (rate * 100).toFixed(1) + '%'
}

function printRateLine(label: string, rate: number, suffix?: string): void {
  const pct = fmtPct(rate).padStart(6)
  const colored = colorRate(rate, pct)
  const extra = suffix ? `  ${suffix}` : ''
  console.log(`${label.padEnd(36)}: ${colored}${extra}`)
}

function printAnalyzeReport(pattern: WinlinePattern, args: ParsedArgs): void {
  const winnerName = SPECIES[args.winner as keyof typeof SPECIES].name
  const loserKey = args.winner === args.sideA ? args.sideB : args.sideA
  const loserName = SPECIES[loserKey as keyof typeof SPECIES].name

  const winPct = fmtPct(pattern.win_rate_in_scan)

  console.log()
  console.log('\u2550'.repeat(56))
  console.log(`  WIN LINE ANALYSIS: ${winnerName} beats ${loserName}`)
  console.log(`  ${pattern.seeds_found} winning seeds | ${pattern.seeds_scanned.toLocaleString()} scanned | Win rate in scan: ${winPct}`)
  console.log('\u2550'.repeat(56))

  // Key Conditions
  console.log()
  console.log("KEY CONDITIONS (winner's win)")
  console.log('\u2500'.repeat(29))

  const dominant = pattern.any_status_on_loser_rate >= 0.80 ? ' \u2190 DOMINANT' : ''
  printRateLine('Any status on loser', pattern.any_status_on_loser_rate, dominant.trim() || undefined)
  printRateLine('  Burn on loser', pattern.burn_on_loser_rate)
  printRateLine('    \u2514\u2500 Burn by turn 2', pattern.burn_by_turn_2_rate)
  printRateLine('  Paralysis on loser', pattern.para_on_loser_rate)
  printRateLine('  Freeze on loser', pattern.freeze_on_loser_rate)
  printRateLine('Kill source: burn residual', pattern.kill_by_burn_rate)
  printRateLine('Kill source: direct damage', pattern.kill_by_damage_rate)
  printRateLine('Winner crit on kill', pattern.winner_crit_on_kill_rate)
  printRateLine('  \u2514\u2500 Crit on turn 1', pattern.winner_crit_turn_1_rate)
  printRateLine('Winner SE on kill', pattern.winner_se_on_kill_rate)
  printRateLine('Winner ended low HP (<25%)', pattern.winner_ended_low_hp_rate)

  // Opponent Conditions
  console.log()
  console.log('OPPONENT CONDITIONS (what winner survived)')
  console.log('\u2500'.repeat(43))

  printRateLine('Any status on winner', pattern.any_status_on_winner_rate)
  printRateLine('  Burn on winner', pattern.burn_on_winner_rate)
  printRateLine('  Paralysis on winner', pattern.para_on_winner_rate)
  printRateLine('Loser action failed (para/frz)', pattern.loser_action_failed_rate)
  printRateLine('Loser status move blocked', pattern.loser_status_failed_rate)
  printRateLine('Opponent ability fired', pattern.loser_ability_fired_rate)

  // Winner Ability Activity
  console.log()
  console.log('WINNER ABILITY ACTIVITY')
  console.log('\u2500'.repeat(23))

  printRateLine('Winner ability fired', pattern.winner_ability_fired_rate)
  const boostAvg = pattern.winner_max_speed_boost_avg.toFixed(1)
  console.log(`${'Winner avg speed boost stacks'.padEnd(36)}: ${boostAvg.padStart(6)}`)
  printRateLine('Winner action failed (survived)', pattern.winner_action_failed_rate)
  printRateLine('Winner any move missed', pattern.winner_miss_rate)

  // Battle Length
  console.log()
  console.log('BATTLE LENGTH')
  console.log('\u2500'.repeat(13))

  const avgStr = pattern.avg_turns.toFixed(1)
  console.log(`${'Avg turns'.padEnd(36)}: ${avgStr.padStart(6)}`)
  console.log(`${'Min / Max'.padEnd(36)}: ${String(pattern.min_turns).padStart(3)} / ${pattern.max_turns}`)
  printRateLine('Short battles (\u2264 4 turns)', pattern.short_battle_rate)
  printRateLine('Long battles (\u2265 10 turns)', pattern.long_battle_rate)

  // Victory Line Assessment
  console.log()
  console.log('VICTORY LINE ASSESSMENT')
  console.log('\u2500'.repeat(24))

  const candidates: Array<{ name: string; rate: number }> = [
    { name: 'Burn on loser', rate: pattern.burn_on_loser_rate },
    { name: 'Paralysis on loser', rate: pattern.para_on_loser_rate },
    { name: 'Freeze on loser', rate: pattern.freeze_on_loser_rate },
    { name: 'Kill by burn', rate: pattern.kill_by_burn_rate },
    { name: 'Crit on kill', rate: pattern.winner_crit_on_kill_rate },
    { name: 'SE on kill', rate: pattern.winner_se_on_kill_rate },
    { name: 'Winner ability fired', rate: pattern.winner_ability_fired_rate },
  ]

  const sorted = [...candidates].sort((a, b) => b.rate - a.rate)
  const primary = sorted.filter(c => c.rate >= 0.80)
  const secondary = sorted.filter(c => c.rate >= 0.20 && c.rate < 0.80)
  const marginal = sorted.filter(c => c.rate > 0 && c.rate < 0.20)

  if (primary.length > 0) {
    console.log(`  PRIMARY   (\u226580%)  : ${primary.map(c => `${c.name} (${fmtPct(c.rate)})`).join(', ')}`)
  }
  if (secondary.length > 0) {
    console.log(`  SECONDARY (20-79%): ${secondary.map(c => `${c.name} (${fmtPct(c.rate)})`).join(', ')}`)
  }
  if (marginal.length > 0) {
    console.log(`  MARGINAL  (<20%)  : ${marginal.map(c => `${c.name} (${fmtPct(c.rate)})`).join(', ')}`)
  }

  console.log()

  const highest = sorted[0]
  if (highest && highest.rate >= 0.80) {
    console.log(
      `  \u26a0 SINGLE DOMINANT LINE: ${fmtPct(highest.rate)} of wins share ${highest.name.toLowerCase()} as the core condition.`
    )
    console.log('    Consider whether a second independent line is viable.')
  } else {
    const multipleSignificant = candidates.filter(c => c.rate >= 0.40)
    if (multipleSignificant.length >= 2) {
      console.log('  \u2713 MULTIPLE LINES DETECTED')
    } else {
      console.log('  \u26a0 NO DOMINANT LINE \u2014 wins may be variance-driven')
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = parseArgs(process.argv.slice(2))
const { records, scanned } = scanSeeds(args)

if (args.mode === 'scan') {
  printScanTable(records, scanned, args)
} else {
  const pattern = aggregatePatterns(records, scanned)
  printAnalyzeReport(pattern, args)
}
