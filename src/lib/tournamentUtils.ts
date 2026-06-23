import { TMatch, TGroup, TParticipant, TournamentFormat, TMatchStage, TSeries } from './types';

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
// Cross-group circular seeding: group[i] #1 vs group[(i+1)%G] #2
// 2 groups × 2 → 4 teams: SF1: 1A-2B, SF2: 1B-2A → Final
// 4 groups × 2 → 8 teams: QF1: 1A-2B, QF2: 1B-2C, QF3: 1C-2D, QF4: 1D-2A → SF → Final

export function generateKnockoutMatches(
  groups: TGroup[],
  groupMatches: TMatch[],
  format: TournamentFormat
): TMatch[] {
  const n = format?.advancePerGroup ?? 2;
  const G = groups.length;

  const ranked: Record<string, Standing[]> = {};
  for (const g of groups) {
    const gm = groupMatches.filter((m) => m.groupName === g.name);
    ranked[g.name] = calcGroupStandings(g.participantIds, gm);
  }

  // advancers[rank][groupIndex] = participantId
  const advancers: string[][] = Array.from({ length: n }, (_, rank) =>
    groups.map((g) => ranked[g.name]?.[rank]?.participantId ?? 'TBD')
  );

  const totalTeams = G * n;
  const matches: TMatch[] = [];
  let order = 0;

  if (totalTeams === 2) {
    matches.push(makeKOMatch('final', advancers[0][0], advancers[0][1] ?? 'TBD', order++));
  } else if (totalTeams === 4) {
    if (n === 2) {
      // Circular: SF[i] = 1[i] vs 2[(i+1)%G]
      for (let i = 0; i < G; i++) {
        matches.push(makeKOMatch('sf', advancers[0][i], advancers[1][(i + 1) % G], order++));
      }
    } else {
      // 1 advance per group, 4 groups: 1A vs 1D, 1B vs 1C (cross-seeded)
      matches.push(makeKOMatch('sf', advancers[0][0], advancers[0][3] ?? 'TBD', order++));
      matches.push(makeKOMatch('sf', advancers[0][1], advancers[0][2] ?? 'TBD', order++));
    }
    if (format?.hasThirdPlace) matches.push(makeKOMatch('3rd', 'TBD', 'TBD', order++));
    matches.push(makeKOMatch('final', 'TBD', 'TBD', order++));
  } else if (totalTeams === 8) {
    // Circular QF: QF[i] = 1[i] vs 2[(i+1)%G] for i in 0..G-1
    for (let i = 0; i < G; i++) {
      matches.push(makeKOMatch('qf', advancers[0][i], advancers[1 % n][(i + 1) % G], order++));
    }
    // SF1: W(QF0) vs W(QF1), SF2: W(QF2) vs W(QF3)
    matches.push(makeKOMatch('sf', 'TBD', 'TBD', order++));
    matches.push(makeKOMatch('sf', 'TBD', 'TBD', order++));
    if (format?.hasThirdPlace) matches.push(makeKOMatch('3rd', 'TBD', 'TBD', order++));
    matches.push(makeKOMatch('final', 'TBD', 'TBD', order++));
  }

  return matches;
}

function makeKOMatch(stage: TMatchStage, p1Id: string, p2Id: string, order: number): TMatch {
  return { id: `ko_${Date.now()}_${order}`, stage, p1Id, p2Id, played: false, order };
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

// ── Series format utilities ───────────────────────────────────────

export function generateSeriesGroupMatches(seriesId: string, groups: TGroup[]): TMatch[] {
  const seriesGroups = groups.filter((g) => g.seriesId === seriesId);
  const matches: TMatch[] = [];
  let order = 0;
  const base = Date.now();
  for (const group of seriesGroups) {
    const ids = group.participantIds;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        matches.push({
          id: `sgm_${base}_${seriesId}_${order}`,
          stage: 'group',
          groupName: group.name,
          seriesId,
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

// Cross-bracket knockout: 1A-2B, 1B-2C, 1C-2D, 1D-2A (for 4 groups)
export function generateSeriesKnockout(
  seriesId: string,
  groups: TGroup[],
  groupMatches: TMatch[]
): TMatch[] {
  const seriesGroups = groups.filter((g) => g.seriesId === seriesId);
  const n = seriesGroups.length;
  if (n < 2) return [];

  const base = Date.now();
  let order = 0;

  // Compute standings per group
  const ranked: Record<string, Standing[]> = {};
  for (const g of seriesGroups) {
    const gm = groupMatches.filter((m) => m.seriesId === seriesId && m.groupName === g.name);
    ranked[g.name] = calcGroupStandings(g.participantIds, gm);
  }

  const first = (groupName: string) => ranked[groupName]?.[0]?.participantId ?? 'TBD';
  const second = (groupName: string) => ranked[groupName]?.[1]?.participantId ?? 'TBD';

  const matches: TMatch[] = [];

  if (n === 2) {
    // SF → Final
    const A = seriesGroups[0].name, B = seriesGroups[1].name;
    matches.push({ id: `s_sf_${seriesId}_1_${base}`, stage: 'sf', seriesId, p1Id: first(A), p2Id: second(B), played: false, order: order++ });
    matches.push({ id: `s_sf_${seriesId}_2_${base}`, stage: 'sf', seriesId, p1Id: first(B), p2Id: second(A), played: false, order: order++ });
    matches.push({ id: `s_final_${seriesId}_${base}`, stage: 'final', seriesId, p1Id: 'TBD', p2Id: 'TBD', played: false, order: order++ });
  } else if (n >= 4) {
    // QF: 1A-2B, 1B-2C, 1C-2D, 1D-2A
    const [gA, gB, gC, gD] = seriesGroups.map((g) => g.name);
    matches.push({ id: `s_qf_${seriesId}_1_${base}`, stage: 'qf', seriesId, p1Id: first(gA), p2Id: second(gB), played: false, order: order++ });
    matches.push({ id: `s_qf_${seriesId}_2_${base}`, stage: 'qf', seriesId, p1Id: first(gB), p2Id: second(gC), played: false, order: order++ });
    matches.push({ id: `s_qf_${seriesId}_3_${base}`, stage: 'qf', seriesId, p1Id: first(gC), p2Id: second(gD), played: false, order: order++ });
    matches.push({ id: `s_qf_${seriesId}_4_${base}`, stage: 'qf', seriesId, p1Id: first(gD), p2Id: second(gA), played: false, order: order++ });
    matches.push({ id: `s_sf_${seriesId}_1_${base}`, stage: 'sf', seriesId, p1Id: 'TBD', p2Id: 'TBD', played: false, order: order++ });
    matches.push({ id: `s_sf_${seriesId}_2_${base}`, stage: 'sf', seriesId, p1Id: 'TBD', p2Id: 'TBD', played: false, order: order++ });
    matches.push({ id: `s_final_${seriesId}_${base}`, stage: 'final', seriesId, p1Id: 'TBD', p2Id: 'TBD', played: false, order: order++ });
  } else {
    // 3 groups: QF with one bye, then SF, Final
    const [gA, gB, gC] = seriesGroups.map((g) => g.name);
    matches.push({ id: `s_qf_${seriesId}_1_${base}`, stage: 'qf', seriesId, p1Id: first(gB), p2Id: second(gC), played: false, order: order++ });
    matches.push({ id: `s_sf_${seriesId}_1_${base}`, stage: 'sf', seriesId, p1Id: first(gA), p2Id: 'TBD', played: false, order: order++ });
    matches.push({ id: `s_sf_${seriesId}_2_${base}`, stage: 'sf', seriesId, p1Id: first(gC), p2Id: second(gA), played: false, order: order++ });
    matches.push({ id: `s_final_${seriesId}_${base}`, stage: 'final', seriesId, p1Id: 'TBD', p2Id: 'TBD', played: false, order: order++ });
  }

  return matches;
}

export function propagateSeriesKO(seriesId: string, allMatches: TMatch[]): TMatch[] {
  const updated = allMatches.map((m) => ({ ...m }));
  const sm = (stage: TMatchStage) =>
    updated.filter((m) => m.seriesId === seriesId && m.stage === stage).sort((a, b) => a.order - b.order);

  const qfs = sm('qf'), sfs = sm('sf'), finals = sm('final');

  if (qfs.length === 4 && sfs.length >= 2) {
    fillSlot(sfs[0], 'p1Id', getWinner(qfs[0]));
    fillSlot(sfs[0], 'p2Id', getWinner(qfs[1]));
    fillSlot(sfs[1], 'p1Id', getWinner(qfs[2]));
    fillSlot(sfs[1], 'p2Id', getWinner(qfs[3]));
  }
  if (qfs.length === 1 && sfs.length >= 1) {
    fillSlot(sfs[0], 'p2Id', getWinner(qfs[0]));
  }
  if (sfs.length >= 2 && finals.length > 0) {
    fillSlot(finals[0], 'p1Id', getWinner(sfs[0]));
    fillSlot(finals[0], 'p2Id', getWinner(sfs[1]));
  }

  return updated;
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
