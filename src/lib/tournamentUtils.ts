import { TMatch, TGroup, TParticipant, TournamentFormat, TMatchStage } from './types';

// ── Optimal doubles pairing (minimise ELO variance across teams) ──
// Uses backtracking brute-force (fast up to ~12 players, then greedy fallback)

export interface PairingResult {
  pairs: { a: string; b: string }[];
  teamTotals: number[];
  variance: number;          // lower = more balanced
  spread: number;            // max - min team total
}

export function optimalPairing(
  players: { id: string; elo: number }[],
  fixedPairs: { a: string; b: string }[] = []
): PairingResult {
  // Remove fixed-pair players from the free pool
  const fixedIds = new Set(fixedPairs.flatMap((p) => [p.a, p.b]));
  const free = players.filter((p) => !fixedIds.has(p.id));

  let autoPairs: { a: string; b: string }[];

  if (free.length < 2) {
    autoPairs = [];
  } else if (free.length <= 10) {
    autoPairs = backtrackPair(free);
  } else {
    // Greedy snake for large N
    const sorted = [...free].sort((a, b) => b.elo - a.elo);
    autoPairs = [];
    while (sorted.length >= 2) {
      autoPairs.push({ a: sorted[0].id, b: sorted[sorted.length - 1].id });
      sorted.splice(sorted.length - 1, 1);
      sorted.splice(0, 1);
    }
  }

  const allPairs = [...fixedPairs, ...autoPairs];
  const eloMap: Record<string, number> = {};
  players.forEach((p) => (eloMap[p.id] = p.elo));

  const teamTotals = allPairs.map((p) => (eloMap[p.a] ?? 0) + (eloMap[p.b] ?? 0));
  const avg = teamTotals.length ? teamTotals.reduce((s, t) => s + t, 0) / teamTotals.length : 0;
  const variance = teamTotals.reduce((s, t) => s + Math.pow(t - avg, 2), 0) / (teamTotals.length || 1);
  const spread = teamTotals.length ? Math.max(...teamTotals) - Math.min(...teamTotals) : 0;

  return { pairs: allPairs, teamTotals, variance, spread };
}

function backtrackPair(players: { id: string; elo: number }[]): { a: string; b: string }[] {
  let bestPairs: { a: string; b: string }[] = [];
  let bestVariance = Infinity;

  function recurse(remaining: { id: string; elo: number }[], current: { a: string; b: string }[]) {
    if (remaining.length === 0) {
      const totals = current.map((p) => {
        const ae = players.find((x) => x.id === p.a)?.elo ?? 0;
        const be = players.find((x) => x.id === p.b)?.elo ?? 0;
        return ae + be;
      });
      const avg = totals.reduce((s, t) => s + t, 0) / totals.length;
      const v = totals.reduce((s, t) => s + Math.pow(t - avg, 2), 0);
      if (v < bestVariance) { bestVariance = v; bestPairs = [...current]; }
      return;
    }
    const first = remaining[0];
    for (let i = 1; i < remaining.length; i++) {
      recurse(
        remaining.filter((_, idx) => idx !== 0 && idx !== i),
        [...current, { a: first.id, b: remaining[i].id }]
      );
    }
  }

  recurse(players, []);
  return bestPairs;
}

// ── Group stage schedule (round-robin) ────────────────────────────

export function generateGroupMatches(groups: TGroup[]): TMatch[] {
  const matches: TMatch[] = [];
  let order = 0;
  for (const group of groups) {
    const ids = group.participantIds;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        matches.push({
          id: `gm_${Date.now()}_${order}`,
          stage: 'group',
          groupName: group.name,
          p1Id: ids[i],
          p2Id: ids[j],
          played: false,
          order: order++,
        });
      }
    }
  }
  return matches;
}

// ── Group standings ───────────────────────────────────────────────

export interface Standing {
  participantId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export function calcGroupStandings(
  participantIds: string[],
  groupMatches: TMatch[]
): Standing[] {
  const map: Record<string, Standing> = {};
  for (const id of participantIds) {
    map[id] = { participantId: id, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
  }

  for (const m of groupMatches) {
    if (!m.played || m.score1 == null || m.score2 == null) continue;
    const a = map[m.p1Id];
    const b = map[m.p2Id];
    if (!a || !b) continue;
    a.played++; b.played++;
    a.goalsFor += m.score1; a.goalsAgainst += m.score2;
    b.goalsFor += m.score2; b.goalsAgainst += m.score1;
    if (m.score1 > m.score2) {
      a.wins++; a.points += 3; b.losses++;
    } else if (m.score1 < m.score2) {
      b.wins++; b.points += 3; a.losses++;
    } else {
      a.draws++; a.points++; b.draws++; b.points++;
    }
  }

  return Object.values(map).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });
}

// ── Generate knockout bracket from group results ──────────────────
// Seeding: A1 vs B2, B1 vs A2 (crossover to avoid same-group early rematch)

export function generateKnockoutMatches(
  groups: TGroup[],
  groupMatches: TMatch[],
  format: TournamentFormat
): TMatch[] {
  const n = format.advancePerGroup;
  // Collect ranked participants per group
  const ranked: Record<string, Standing[]> = {};
  for (const g of groups) {
    const gMatches = groupMatches.filter((m) => m.groupName === g.name);
    ranked[g.name] = calcGroupStandings(g.participantIds, gMatches);
  }

  // Build advancing list: [rank][groupIndex]
  const advancers: string[][] = [];
  for (let rank = 0; rank < n; rank++) {
    advancers[rank] = groups.map((g) => ranked[g.name]?.[rank]?.participantId ?? 'TBD');
  }

  // Total advancing teams
  const totalTeams = groups.length * n;
  const matches: TMatch[] = [];
  let order = 0;

  if (totalTeams === 2) {
    // Straight to final
    matches.push(makeKOMatch('final', advancers[0][0], advancers[0][1] ?? advancers[1]?.[0] ?? 'TBD', order++));
  } else if (totalTeams === 4) {
    // 2 SFs → Final (+ optional 3rd place)
    // SF1: A1 vs B2 (or A1 vs A2 if 1 group)
    const sf1p1 = advancers[0][0] ?? 'TBD';
    const sf1p2 = groups.length >= 2 ? (advancers[1][1] ?? advancers[1][0] ?? 'TBD') : (advancers[1]?.[0] ?? 'TBD');
    const sf2p1 = groups.length >= 2 ? (advancers[0][1] ?? advancers[0][0] ?? 'TBD') : (advancers[1]?.[1] ?? 'TBD');
    const sf2p2 = advancers[1]?.[0] ?? advancers[0][1] ?? 'TBD';

    matches.push(makeKOMatch('sf', sf1p1, sf1p2, order++));
    matches.push(makeKOMatch('sf', sf2p1, sf2p2, order++));
    if (format.hasThirdPlace) {
      matches.push(makeKOMatch('3rd', 'TBD', 'TBD', order++));
    }
    matches.push(makeKOMatch('final', 'TBD', 'TBD', order++));
  } else if (totalTeams === 8) {
    // QF → SF → Final
    // Seeding: A1 B2 C1 D2 | B1 A2 D1 C2
    const seeds = buildSeeds8(groups, advancers);
    for (let i = 0; i < 4; i++) {
      matches.push(makeKOMatch('qf', seeds[i * 2] ?? 'TBD', seeds[i * 2 + 1] ?? 'TBD', order++));
    }
    matches.push(makeKOMatch('sf', 'TBD', 'TBD', order++));
    matches.push(makeKOMatch('sf', 'TBD', 'TBD', order++));
    if (format.hasThirdPlace) {
      matches.push(makeKOMatch('3rd', 'TBD', 'TBD', order++));
    }
    matches.push(makeKOMatch('final', 'TBD', 'TBD', order++));
  }

  return matches;
}

function makeKOMatch(stage: TMatchStage, p1Id: string, p2Id: string, order: number): TMatch {
  return { id: `ko_${Date.now()}_${order}`, stage, p1Id, p2Id, played: false, order };
}

function buildSeeds8(groups: TGroup[], advancers: string[][]): string[] {
  // Standard cross-seeding for 4 groups × 2
  if (groups.length >= 4) {
    return [
      advancers[0][0], advancers[1][1] ?? 'TBD',
      advancers[2][0], advancers[3][1] ?? 'TBD',
      advancers[1][0], advancers[0][1] ?? 'TBD',
      advancers[3][0], advancers[2][1] ?? 'TBD',
    ];
  }
  // Fallback: just flatten
  return advancers.flat();
}

// After a KO match is played, propagate winner to next round TBD slot
export function propagateKOResult(matches: TMatch[]): TMatch[] {
  const updated = matches.map((m) => ({ ...m }));

  const byStage = (s: TMatchStage) => updated.filter((m) => m.stage === s).sort((a, b) => a.order - b.order);
  const qfs = byStage('qf');
  const sfs = byStage('sf');
  const finals = byStage('final');
  const thirds = byStage('3rd');

  // QF → SF
  if (qfs.length === 4 && sfs.length >= 2) {
    fillSlot(sfs[0], 'p1Id', getWinner(qfs[0]));
    fillSlot(sfs[0], 'p2Id', getWinner(qfs[1]));
    fillSlot(sfs[1], 'p1Id', getWinner(qfs[2]));
    fillSlot(sfs[1], 'p2Id', getWinner(qfs[3]));
  }

  // SF → Final & 3rd
  if (sfs.length >= 2) {
    if (finals.length > 0) {
      fillSlot(finals[0], 'p1Id', getWinner(sfs[0]));
      fillSlot(finals[0], 'p2Id', getWinner(sfs[1]));
    }
    if (thirds.length > 0) {
      fillSlot(thirds[0], 'p1Id', getLoser(sfs[0]));
      fillSlot(thirds[0], 'p2Id', getLoser(sfs[1]));
    }
  }

  // 2-team final (no SF/QF)
  // Already set at generation time

  return updated;
}

function getWinner(m: TMatch | undefined): string {
  if (!m || !m.played || m.score1 == null || m.score2 == null) return 'TBD';
  return m.score1 >= m.score2 ? m.p1Id : m.p2Id;
}

function getLoser(m: TMatch | undefined): string {
  if (!m || !m.played || m.score1 == null || m.score2 == null) return 'TBD';
  return m.score1 < m.score2 ? m.p1Id : m.p2Id;
}

function fillSlot(match: TMatch, slot: 'p1Id' | 'p2Id', value: string) {
  if (value !== 'TBD') match[slot] = value;
}

// ── Round-robin full schedule (circle method) ─────────────────────
// Generates N*(N-1)/2 matches grouped into N-1 rounds,
// each team plays exactly once per round.

export function generateRoundRobinSchedule(participantIds: string[]): TMatch[] {
  const matches: TMatch[] = [];
  const n = participantIds.length;
  if (n < 2) return matches;

  // Add a phantom "bye" slot for odd N so circle method works cleanly
  const ids = [...participantIds];
  if (n % 2 !== 0) ids.push('__bye__');
  const N = ids.length;
  const rounds = N - 1;
  const rotating = ids.slice(1);
  const base = Date.now();

  for (let round = 0; round < rounds; round++) {
    const current = [ids[0], ...rotating];
    for (let i = 0; i < N / 2; i++) {
      const p1 = current[i];
      const p2 = current[N - 1 - i];
      if (p1 !== '__bye__' && p2 !== '__bye__') {
        matches.push({
          id: `rr_${base}_r${round}_${i}`,
          stage: 'group',
          groupName: `Vòng ${round + 1}`,
          p1Id: p1,
          p2Id: p2,
          played: false,
          order: round * 100 + i,
        });
      }
    }
    // Rotate: move last element of rotating to front
    rotating.unshift(rotating.pop()!);
  }

  return matches;
}

export function isGroupStageComplete(groups: TGroup[], matches: TMatch[]): boolean {
  const groupMatches = matches.filter((m) => m.stage === 'group');
  let expected = 0;
  for (const g of groups) {
    const n = g.participantIds.length;
    expected += (n * (n - 1)) / 2;
  }
  return groupMatches.filter((m) => m.played).length >= expected;
}
