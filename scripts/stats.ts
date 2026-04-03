import * as fs from 'fs'
import { runBattle } from '../packages/kernel/src/index.js'
import { SPECIES } from '../packages/kernel/src/species.js'
import type { BattleArtifact, KernelInputs, Side } from '../packages/kernel/src/types.js'

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
// CLI arg parsing
// ---------------------------------------------------------------------------

interface ParsedArgs {
  seeds: number
  mode: 'summary' | 'full'
  json: boolean
}

function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    seeds: 1000,
    mode: 'summary',
    json: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    const next = argv[i + 1]
    if (arg === '--seeds' && next !== undefined) {
      result.seeds = parseInt(next, 10)
      i++
    } else if (arg === '--mode' && next !== undefined) {
      if (next === 'full' || next === 'summary') {
        result.mode = next
      }
      i++
    } else if (arg === '--json') {
      result.json = true
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Per-battle stats
// ---------------------------------------------------------------------------

interface BattleStats {
  winner: Side | 'draw'
  total_turns: number
  damage_a: number
  damage_b: number
  burn_damage_a: number
  burn_damage_b: number
  winner_remaining_hp: number
  winner_max_hp: number
  winner_low_hp: boolean
  crit_kill: boolean
  burn_kill: boolean
  move_usage_a: Record<string, number>
  move_usage_b: Record<string, number>
  move_available_turns_a: Record<string, number>
  move_available_turns_b: Record<string, number>
  miss_count_a: number
  miss_count_b: number
  status_applied: Record<string, number>
  first_actor_won: boolean
}

function extractBattleStats(artifact: BattleArtifact): BattleStats {
  const events = artifact.events
  const winner = artifact.winner

  let damage_a = 0
  let damage_b = 0
  let burn_damage_a = 0
  let burn_damage_b = 0
  let miss_count_a = 0
  let miss_count_b = 0
  const move_usage_a: Record<string, number> = {}
  const move_usage_b: Record<string, number> = {}
  const status_applied: Record<string, number> = {}

  // Track HP readings for each side and kill event index
  let kill_event_index = -1
  let burn_kill = false

  // Track last known HP for each side at each event index
  const hp_readings_a: Array<{ index: number; hp: number }> = []
  const hp_readings_b: Array<{ index: number; hp: number }> = []

  // First actor detection
  let first_actor_side: Side | null = null

  // Crit tracking: track last crit event per side
  let last_crit_side: Side | null = null
  let last_crit_index = -1

  for (let i = 0; i < events.length; i++) {
    const event = events[i]!
    const p = event.payload
    const actorSide = event.actor_side

    switch (event.event_type) {
      case 'DAMAGE_DEALT': {
        const damage = p['damage'] as number
        const remaining = p['remaining_hp'] as number
        const targetSide = p['target_side'] as Side

        if (actorSide === 'a') damage_a += damage
        if (actorSide === 'b') damage_b += damage

        // Record HP reading for the target (the one receiving damage)
        if (targetSide === 'a') hp_readings_a.push({ index: i, hp: remaining })
        if (targetSide === 'b') hp_readings_b.push({ index: i, hp: remaining })

        if (remaining === 0) {
          kill_event_index = i
          burn_kill = false
        }

        // First actor detection
        if (first_actor_side === null) first_actor_side = actorSide ?? null

        break
      }

      case 'BURN_DAMAGE': {
        const damage = p['damage'] as number
        const remaining = p['remaining_hp'] as number

        // actor_side = the mon taking burn damage
        if (actorSide === 'a') {
          burn_damage_a += damage
          hp_readings_a.push({ index: i, hp: remaining })
        }
        if (actorSide === 'b') {
          burn_damage_b += damage
          hp_readings_b.push({ index: i, hp: remaining })
        }

        if (remaining === 0) {
          kill_event_index = i
          burn_kill = true
        }

        break
      }

      case 'MOVE_SELECTED': {
        const moveId = p['move_id'] as string
        if (actorSide === 'a') {
          move_usage_a[moveId] = (move_usage_a[moveId] ?? 0) + 1
        }
        if (actorSide === 'b') {
          move_usage_b[moveId] = (move_usage_b[moveId] ?? 0) + 1
        }
        break
      }

      case 'MOVE_MISSED': {
        if (actorSide === 'a') miss_count_a++
        if (actorSide === 'b') miss_count_b++
        if (first_actor_side === null) first_actor_side = actorSide ?? null
        break
      }

      case 'CRIT': {
        last_crit_side = actorSide ?? null
        last_crit_index = i
        break
      }

      case 'STATUS_APPLIED': {
        const targetSide = p['target_side'] as string
        const status = p['status'] as string
        const key = `${status}_on_${targetSide}`
        status_applied[key] = (status_applied[key] ?? 0) + 1
        break
      }

      case 'ACTION_FROZEN_FAILED':
      case 'ACTION_PARALYSIS_FAILED': {
        if (first_actor_side === null) first_actor_side = actorSide ?? null
        break
      }

      default:
        break
    }
  }

  // Determine winner's remaining HP
  let winner_remaining_hp = 0
  let winner_max_hp = 0
  let winner_low_hp = false
  let crit_kill = false

  if (winner !== 'draw' && kill_event_index >= 0) {
    // The loser is the opposite side
    const winnerSide = winner
    const winnerSpeciesId =
      winnerSide === 'a' ? artifact.side_a_species_id : artifact.side_b_species_id
    winner_max_hp = SPECIES[winnerSpeciesId]!.base_hp

    // Scan backwards for the winner's most recent HP reading before the kill event
    const winnerReadings = winnerSide === 'a' ? hp_readings_a : hp_readings_b
    for (let j = winnerReadings.length - 1; j >= 0; j--) {
      const reading = winnerReadings[j]!
      if (reading.index < kill_event_index) {
        winner_remaining_hp = reading.hp
        break
      }
    }

    // If no reading found before kill, winner was never damaged — full HP
    if (winner_remaining_hp === 0 && winnerReadings.length === 0) {
      winner_remaining_hp = winner_max_hp
    }
    // Edge: if all readings are at or after the kill event, winner is at max
    if (winner_remaining_hp === 0) {
      const anyBefore = winnerReadings.some((r) => r.index < kill_event_index)
      if (!anyBefore) {
        winner_remaining_hp = winner_max_hp
      }
    }

    // Low HP check: integer form
    winner_low_hp = winner_remaining_hp * 4 <= winner_max_hp

    // Crit kill: check if the kill event is a DAMAGE_DEALT and a CRIT event
    // for the same attacker appeared between the last MOVE_SELECTED and the kill
    if (!burn_kill && last_crit_side !== null && last_crit_index < kill_event_index) {
      // The kill was by the opposite side of the loser, i.e., the winner
      // Check if the crit was by the winner (who dealt the killing blow)
      const killerSide = winner
      if (last_crit_side === killerSide) {
        // Verify crit is in the same action sequence (after last MOVE_SELECTED for killer)
        let lastMoveSelectedIdx = -1
        for (let j = kill_event_index - 1; j >= 0; j--) {
          if (
            events[j]!.event_type === 'MOVE_SELECTED' &&
            events[j]!.actor_side === killerSide
          ) {
            lastMoveSelectedIdx = j
            break
          }
        }
        if (last_crit_index > lastMoveSelectedIdx) {
          crit_kill = true
        }
      }
    }
  }

  // First actor won
  const first_actor_won =
    winner !== 'draw' && first_actor_side !== null && first_actor_side === winner

  // Track move availability: each move in the final moveset was available every turn
  const move_available_turns_a: Record<string, number> = {}
  const move_available_turns_b: Record<string, number> = {}
  const turnsA = artifact.total_turns
  const turnsB = artifact.total_turns
  for (const move of artifact.side_a_final_moveset) {
    move_available_turns_a[move.move_id] = (move_available_turns_a[move.move_id] ?? 0) + turnsA
  }
  for (const move of artifact.side_b_final_moveset) {
    move_available_turns_b[move.move_id] = (move_available_turns_b[move.move_id] ?? 0) + turnsB
  }

  return {
    winner,
    total_turns: artifact.total_turns,
    damage_a,
    damage_b,
    burn_damage_a,
    burn_damage_b,
    winner_remaining_hp,
    winner_max_hp,
    winner_low_hp,
    crit_kill,
    burn_kill,
    move_usage_a,
    move_usage_b,
    move_available_turns_a,
    move_available_turns_b,
    miss_count_a,
    miss_count_b,
    status_applied,
    first_actor_won,
  }
}

// ---------------------------------------------------------------------------
// Matchup aggregation
// ---------------------------------------------------------------------------

interface MatchupStats {
  side_a: string
  side_b: string
  seeds_run: number
  a_win_rate: number
  b_win_rate: number
  draw_rate: number
  avg_turns: number
  min_turns: number
  max_turns: number
  avg_damage_per_turn_a: number
  avg_damage_per_turn_b: number
  avg_winner_hp_remaining_pct: number
  winner_low_hp_rate: number
  burn_ko_rate: number
  first_actor_win_rate: number
  unbalanced_flag: boolean
  move_usage_a: Record<string, number>
  move_usage_b: Record<string, number>
  status_rates: Record<string, number>
}

function aggregateMatchup(
  sideA: string,
  sideB: string,
  battles: BattleStats[]
): MatchupStats {
  const n = battles.length

  let a_wins = 0
  let b_wins = 0
  let draws = 0
  let total_turns = 0
  let min_turns = Infinity
  let max_turns = 0
  let total_damage_a = 0
  let total_damage_b = 0
  let total_winner_hp_pct = 0
  let winner_count = 0
  let winner_low_hp_count = 0
  let burn_ko_count = 0
  let first_actor_win_count = 0
  let non_draw_count = 0
  const move_totals_a: Record<string, number> = {}
  const move_totals_b: Record<string, number> = {}
  const move_available_totals_a: Record<string, number> = {}
  const move_available_totals_b: Record<string, number> = {}
  const status_counts: Record<string, number> = {}

  for (const b of battles) {
    if (b.winner === 'a') a_wins++
    else if (b.winner === 'b') b_wins++
    else draws++

    total_turns += b.total_turns
    if (b.total_turns < min_turns) min_turns = b.total_turns
    if (b.total_turns > max_turns) max_turns = b.total_turns

    total_damage_a += b.damage_a
    total_damage_b += b.damage_b

    if (b.winner !== 'draw') {
      non_draw_count++
      if (b.winner_max_hp > 0) {
        total_winner_hp_pct += (b.winner_remaining_hp / b.winner_max_hp) * 100
        winner_count++
      }
      if (b.winner_low_hp) winner_low_hp_count++
      if (b.burn_kill) burn_ko_count++
      if (b.first_actor_won) first_actor_win_count++
    }

    for (const [moveId, count] of Object.entries(b.move_usage_a)) {
      move_totals_a[moveId] = (move_totals_a[moveId] ?? 0) + count
    }
    for (const [moveId, count] of Object.entries(b.move_usage_b)) {
      move_totals_b[moveId] = (move_totals_b[moveId] ?? 0) + count
    }
    for (const [moveId, avail] of Object.entries(b.move_available_turns_a)) {
      move_available_totals_a[moveId] = (move_available_totals_a[moveId] ?? 0) + avail
    }
    for (const [moveId, avail] of Object.entries(b.move_available_turns_b)) {
      move_available_totals_b[moveId] = (move_available_totals_b[moveId] ?? 0) + avail
    }
    for (const [key, count] of Object.entries(b.status_applied)) {
      status_counts[key] = (status_counts[key] ?? 0) + count
    }
  }

  // Convert move counts to rates (% of turns where move was available)
  const move_usage_a: Record<string, number> = {}
  const move_usage_b: Record<string, number> = {}
  for (const [moveId, count] of Object.entries(move_totals_a)) {
    const avail = move_available_totals_a[moveId] ?? 0
    move_usage_a[moveId] = avail > 0 ? count / avail : 0
  }
  for (const [moveId, count] of Object.entries(move_totals_b)) {
    const avail = move_available_totals_b[moveId] ?? 0
    move_usage_b[moveId] = avail > 0 ? count / avail : 0
  }

  // Convert status counts to rates (% of battles)
  const status_rates: Record<string, number> = {}
  for (const [key, count] of Object.entries(status_counts)) {
    status_rates[key] = n > 0 ? count / n : 0
  }

  const a_win_rate = n > 0 ? (a_wins / n) * 100 : 0
  const b_win_rate = n > 0 ? (b_wins / n) * 100 : 0

  return {
    side_a: sideA,
    side_b: sideB,
    seeds_run: n,
    a_win_rate,
    b_win_rate,
    draw_rate: n > 0 ? (draws / n) * 100 : 0,
    avg_turns: n > 0 ? total_turns / n : 0,
    min_turns: min_turns === Infinity ? 0 : min_turns,
    max_turns,
    avg_damage_per_turn_a: total_turns > 0 ? total_damage_a / total_turns : 0,
    avg_damage_per_turn_b: total_turns > 0 ? total_damage_b / total_turns : 0,
    avg_winner_hp_remaining_pct: winner_count > 0 ? total_winner_hp_pct / winner_count : 0,
    winner_low_hp_rate: non_draw_count > 0 ? winner_low_hp_count / non_draw_count : 0,
    burn_ko_rate: non_draw_count > 0 ? burn_ko_count / non_draw_count : 0,
    first_actor_win_rate: non_draw_count > 0 ? first_actor_win_count / non_draw_count : 0,
    unbalanced_flag: a_win_rate < 35 || a_win_rate > 65 || b_win_rate < 35 || b_win_rate > 65,
    move_usage_a,
    move_usage_b,
    status_rates,
  }
}

// ---------------------------------------------------------------------------
// Species aggregation
// ---------------------------------------------------------------------------

interface SpeciesStats {
  species_id: string
  overall_win_rate: number
  avg_turns: number
  most_used_move: string
  least_used_move: string
  avg_damage_per_turn: number
  flag: string | null
}

function aggregateSpecies(
  speciesId: string,
  matchups: MatchupStats[]
): SpeciesStats {
  let total_battles = 0
  let total_wins = 0
  let total_turns = 0
  let total_damage = 0
  let total_turn_count = 0
  const move_usage: Record<string, number> = {}
  let move_usage_total_turns = 0

  for (const m of matchups) {
    if (m.side_a === speciesId) {
      total_battles += m.seeds_run
      total_wins += Math.round((m.a_win_rate / 100) * m.seeds_run)
      total_turns += m.avg_turns * m.seeds_run
      total_turn_count += m.avg_turns * m.seeds_run
      total_damage += m.avg_damage_per_turn_a * m.avg_turns * m.seeds_run
      for (const [moveId, rate] of Object.entries(m.move_usage_a)) {
        move_usage[moveId] = (move_usage[moveId] ?? 0) + rate * m.seeds_run
      }
      move_usage_total_turns += m.seeds_run
    }
    if (m.side_b === speciesId) {
      total_battles += m.seeds_run
      total_wins += Math.round((m.b_win_rate / 100) * m.seeds_run)
      total_turns += m.avg_turns * m.seeds_run
      total_turn_count += m.avg_turns * m.seeds_run
      total_damage += m.avg_damage_per_turn_b * m.avg_turns * m.seeds_run
      for (const [moveId, rate] of Object.entries(m.move_usage_b)) {
        move_usage[moveId] = (move_usage[moveId] ?? 0) + rate * m.seeds_run
      }
      move_usage_total_turns += m.seeds_run
    }
  }

  const overall_win_rate = total_battles > 0 ? (total_wins / total_battles) * 100 : 0
  const avg_turns = total_battles > 0 ? total_turns / total_battles : 0
  const avg_damage_per_turn =
    total_turn_count > 0 ? total_damage / total_turn_count : 0

  // Normalize move usage
  const move_rates: Record<string, number> = {}
  for (const [moveId, total] of Object.entries(move_usage)) {
    move_rates[moveId] = move_usage_total_turns > 0 ? total / move_usage_total_turns : 0
  }

  const moveEntries = Object.entries(move_rates)
  let most_used_move = ''
  let least_used_move = ''

  if (moveEntries.length > 0) {
    moveEntries.sort((a, b) => b[1] - a[1])
    most_used_move = moveEntries[0]![0]
    least_used_move = moveEntries[moveEntries.length - 1]![0]
  }

  let flag: string | null = null
  if (overall_win_rate >= 60) flag = 'HIGH'
  else if (overall_win_rate <= 40) flag = 'LOW'

  return {
    species_id: speciesId,
    overall_win_rate,
    avg_turns,
    most_used_move,
    least_used_move,
    avg_damage_per_turn,
    flag,
  }
}

// ---------------------------------------------------------------------------
// Output: summary table
// ---------------------------------------------------------------------------

function pad(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length)
}

function fmtPct(val: number, decimals = 1): string {
  return val.toFixed(decimals) + '%'
}

function fmtNum(val: number, decimals = 1): string {
  return val.toFixed(decimals)
}

function printSummaryTable(matchups: MatchupStats[]): void {
  const header =
    `${BOLD}${pad('Matchup', 26)}| ${pad('Seeds', 6)}| ${pad('A Win%', 8)}| ${pad('B Win%', 8)}| ${pad('Avg Trn', 8)}| ${pad('Min', 4)}| ${pad('Max', 4)}| ${pad('Burn KO%', 9)}| Flag${RESET}`
  console.log('')
  console.log(header)
  console.log('-'.repeat(95))

  for (const m of matchups) {
    const matchupName = `${m.side_a} vs ${m.side_b}`
    const flag = m.unbalanced_flag
      ? `${YELLOW}${BOLD} ⚠ UNBALANCED${RESET}`
      : `${GREEN} ✓${RESET}`

    console.log(
      `${pad(matchupName, 26)}| ${pad(String(m.seeds_run), 6)}| ${pad(fmtPct(m.a_win_rate), 8)}| ${pad(fmtPct(m.b_win_rate), 8)}| ${pad(fmtNum(m.avg_turns), 8)}| ${pad(String(m.min_turns), 4)}| ${pad(String(m.max_turns), 4)}| ${pad(fmtPct(m.burn_ko_rate * 100), 9)}|${flag}`
    )
  }
}

// ---------------------------------------------------------------------------
// Output: full details
// ---------------------------------------------------------------------------

function printFullDetails(matchups: MatchupStats[]): void {
  for (const m of matchups) {
    console.log('')
    console.log(
      `${BOLD}${CYAN}${m.side_a} vs ${m.side_b} — Move Usage${RESET}`
    )

    console.log(`  ${m.side_a}:`)
    const sortedA = Object.entries(m.move_usage_a).sort((a, b) => b[1] - a[1])
    for (const [moveId, rate] of sortedA) {
      console.log(`    ${pad(moveId, 22)}: ${fmtPct(rate * 100)} of turns`)
    }

    console.log(`  ${m.side_b}:`)
    const sortedB = Object.entries(m.move_usage_b).sort((a, b) => b[1] - a[1])
    for (const [moveId, rate] of sortedB) {
      console.log(`    ${pad(moveId, 22)}: ${fmtPct(rate * 100)} of turns`)
    }

    console.log('')
    console.log(
      `${BOLD}${CYAN}${m.side_a} vs ${m.side_b} — Status${RESET}`
    )
    const statusEntries = Object.entries(m.status_rates)
    if (statusEntries.length === 0) {
      console.log('  (no status effects applied)')
    } else {
      for (const [key, rate] of statusEntries) {
        console.log(`  ${pad(key, 28)}: ${fmtPct(rate * 100)} of battles`)
      }
    }

    console.log('')
    console.log(
      `${DIM}  First-actor win rate: ${fmtPct(m.first_actor_win_rate * 100)} | Winner avg HP: ${fmtPct(m.avg_winner_hp_remaining_pct)} | Low HP wins: ${fmtPct(m.winner_low_hp_rate * 100)}${RESET}`
    )
  }
}

// ---------------------------------------------------------------------------
// Output: species overview
// ---------------------------------------------------------------------------

function printSpeciesOverview(species: SpeciesStats[]): void {
  console.log('')
  console.log(`${BOLD}${WHITE}Species Overall Win Rates${RESET}`)
  for (const s of species) {
    let flagStr = ''
    if (s.flag === 'HIGH') flagStr = `  ${YELLOW}${BOLD}⚠ HIGH${RESET}`
    else if (s.flag === 'LOW') flagStr = `  ${YELLOW}${BOLD}⚠ LOW${RESET}`
    else flagStr = `  ${GREEN}✓${RESET}`

    console.log(
      `${pad(s.species_id, 14)}: ${fmtPct(s.overall_win_rate)}${flagStr}`
    )
  }
}

// ---------------------------------------------------------------------------
// Output: move health
// ---------------------------------------------------------------------------

function printMoveHealth(matchups: MatchupStats[]): void {
  // Collect total usage across all matchups per move
  const moveGlobalUsage: Record<string, { total: number; appearances: number }> = {}

  for (const m of matchups) {
    for (const [moveId, rate] of Object.entries(m.move_usage_a)) {
      if (!moveGlobalUsage[moveId]) {
        moveGlobalUsage[moveId] = { total: 0, appearances: 0 }
      }
      moveGlobalUsage[moveId]!.total += rate
      moveGlobalUsage[moveId]!.appearances++
    }
    for (const [moveId, rate] of Object.entries(m.move_usage_b)) {
      if (!moveGlobalUsage[moveId]) {
        moveGlobalUsage[moveId] = { total: 0, appearances: 0 }
      }
      moveGlobalUsage[moveId]!.total += rate
      moveGlobalUsage[moveId]!.appearances++
    }
  }

  const deadWeight: Array<{ moveId: string; avgRate: number }> = []
  for (const [moveId, data] of Object.entries(moveGlobalUsage)) {
    const avgRate = data.appearances > 0 ? data.total / data.appearances : 0
    if (avgRate * 100 < 10) {
      deadWeight.push({ moveId, avgRate })
    }
  }

  console.log('')
  console.log(`${BOLD}${WHITE}Move Health${RESET}`)
  if (deadWeight.length === 0) {
    console.log(`${GREEN}  All moves above 10% usage threshold.${RESET}`)
  } else {
    deadWeight.sort((a, b) => a.avgRate - b.avgRate)
    for (const { moveId, avgRate } of deadWeight) {
      console.log(
        `  ${YELLOW}⚠ ${pad(moveId, 22)}: ${fmtPct(avgRate * 100)} avg usage — potential dead weight${RESET}`
      )
    }
  }
}

// ---------------------------------------------------------------------------
// JSON output
// ---------------------------------------------------------------------------

function writeJson(
  matchups: MatchupStats[],
  species: SpeciesStats[],
  seedCount: number
): void {
  const output = {
    generated_at: new Date().toISOString(),
    seeds_per_matchup: seedCount,
    matchups: matchups.map((m) => ({
      side_a: m.side_a,
      side_b: m.side_b,
      seeds_run: m.seeds_run,
      a_win_rate: parseFloat(m.a_win_rate.toFixed(1)),
      b_win_rate: parseFloat(m.b_win_rate.toFixed(1)),
      draw_rate: parseFloat(m.draw_rate.toFixed(1)),
      avg_turns: parseFloat(m.avg_turns.toFixed(1)),
      min_turns: m.min_turns,
      max_turns: m.max_turns,
      avg_damage_per_turn_a: parseFloat(m.avg_damage_per_turn_a.toFixed(1)),
      avg_damage_per_turn_b: parseFloat(m.avg_damage_per_turn_b.toFixed(1)),
      avg_winner_hp_remaining_pct: parseFloat(
        m.avg_winner_hp_remaining_pct.toFixed(1)
      ),
      winner_low_hp_rate: parseFloat(m.winner_low_hp_rate.toFixed(3)),
      burn_ko_rate: parseFloat(m.burn_ko_rate.toFixed(3)),
      first_actor_win_rate: parseFloat(m.first_actor_win_rate.toFixed(3)),
      unbalanced_flag: m.unbalanced_flag,
      move_usage_a: roundRecord(m.move_usage_a, 3),
      move_usage_b: roundRecord(m.move_usage_b, 3),
      status_rates: roundRecord(m.status_rates, 3),
    })),
    species: species.map((s) => ({
      species_id: s.species_id,
      overall_win_rate: parseFloat(s.overall_win_rate.toFixed(1)),
      avg_turns: parseFloat(s.avg_turns.toFixed(1)),
      most_used_move: s.most_used_move,
      least_used_move: s.least_used_move,
      avg_damage_per_turn: parseFloat(s.avg_damage_per_turn.toFixed(1)),
      flag: s.flag,
    })),
  }

  const path = 'scripts/stats-output.json'
  fs.writeFileSync(path, JSON.stringify(output, null, 2) + '\n')
  console.log(`\n${GREEN}JSON written to ${path}${RESET}`)
}

function roundRecord(
  rec: Record<string, number>,
  decimals: number
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const [key, val] of Object.entries(rec)) {
    result[key] = parseFloat(val.toFixed(decimals))
  }
  return result
}

// ---------------------------------------------------------------------------
// Progress indicator
// ---------------------------------------------------------------------------

function printProgress(
  matchupIdx: number,
  totalMatchups: number,
  sideA: string,
  sideB: string,
  seedIdx: number,
  totalSeeds: number
): void {
  const barWidth = 20
  const filled = Math.round((seedIdx / totalSeeds) * barWidth)
  const empty = barWidth - filled
  const bar = '='.repeat(filled) + (filled < barWidth ? '>' : '') + ' '.repeat(Math.max(0, empty - 1))
  process.stdout.write(
    `\rRunning matchup ${matchupIdx + 1}/${totalMatchups}: ${sideA} vs ${sideB} [${bar}] ${seedIdx}/${totalSeeds}`
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  const speciesIds = Object.keys(SPECIES)

  // Build ordered pairs (A !== B)
  const matchupPairs: Array<[string, string]> = []
  for (const a of speciesIds) {
    for (const b of speciesIds) {
      if (a !== b) matchupPairs.push([a, b])
    }
  }

  console.log(
    `${BOLD}${WHITE}BeastMon Stats Runner${RESET}`
  )
  console.log(
    `${DIM}Species: ${speciesIds.length} | Matchups: ${matchupPairs.length} | Seeds per matchup: ${args.seeds} | Total battles: ${matchupPairs.length * args.seeds}${RESET}`
  )

  const allMatchups: MatchupStats[] = []

  for (let mi = 0; mi < matchupPairs.length; mi++) {
    const [sideA, sideB] = matchupPairs[mi]!
    const battles: BattleStats[] = []

    for (let seed = 1; seed <= args.seeds; seed++) {
      if (seed % 50 === 0 || seed === 1 || seed === args.seeds) {
        printProgress(mi, matchupPairs.length, sideA, sideB, seed, args.seeds)
      }

      const inputs: KernelInputs = {
        engine_version: '1.0.0',
        content_version: '1.0.0',
        ruleset_version: '1.0.0',
        seed,
        side_a_species_id: sideA,
        side_b_species_id: sideB,
      }

      const artifact = runBattle(inputs)
      battles.push(extractBattleStats(artifact))
    }

    allMatchups.push(aggregateMatchup(sideA, sideB, battles))
  }

  // Clear progress line
  process.stdout.write('\r' + ' '.repeat(80) + '\r')
  console.log(`${GREEN}${BOLD}All ${matchupPairs.length * args.seeds} battles complete.${RESET}`)

  const allSpecies = speciesIds.map((id) => aggregateSpecies(id, allMatchups))

  // Summary table first
  printSummaryTable(allMatchups)

  // Species overview and move health
  printSpeciesOverview(allSpecies)
  printMoveHealth(allMatchups)

  // Full mode details last
  if (args.mode === 'full') {
    printFullDetails(allMatchups)
  }

  // JSON output
  if (args.json) {
    writeJson(allMatchups, allSpecies, args.seeds)
  }

  console.log('')
}

main()
