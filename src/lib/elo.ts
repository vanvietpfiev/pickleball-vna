const K_FACTOR = 32;

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function newRating(rating: number, expected: number, actual: number): number {
  return Math.round(rating + K_FACTOR * (actual - expected));
}

// For doubles: use average ELO of each team
export function calculateDoublesElo(
  team1Ratings: number[],
  team2Ratings: number[],
  team1Won: boolean
): { team1New: number[]; team2New: number[] } {
  const avg1 = team1Ratings.reduce((a, b) => a + b, 0) / team1Ratings.length;
  const avg2 = team2Ratings.reduce((a, b) => a + b, 0) / team2Ratings.length;

  const exp1 = expectedScore(avg1, avg2);
  const exp2 = expectedScore(avg2, avg1);

  const actual1 = team1Won ? 1 : 0;
  const actual2 = team1Won ? 0 : 1;

  return {
    team1New: team1Ratings.map((r) => newRating(r, exp1, actual1)),
    team2New: team2Ratings.map((r) => newRating(r, exp2, actual2)),
  };
}

export function calculateSinglesElo(
  rating1: number,
  rating2: number,
  player1Won: boolean
): { new1: number; new2: number } {
  const exp1 = expectedScore(rating1, rating2);
  const exp2 = expectedScore(rating2, rating1);

  return {
    new1: newRating(rating1, exp1, player1Won ? 1 : 0),
    new2: newRating(rating2, exp2, player1Won ? 0 : 1),
  };
}

// Balanced team pairing: sort by ELO, snake-draft
export function balancedPairs(
  playerIds: string[],
  elos: Record<string, number>
): { team1: string[]; team2: string[] }[] {
  const sorted = [...playerIds].sort((a, b) => elos[b] - elos[a]);
  const courts = Math.floor(sorted.length / 4);
  const result: { team1: string[]; team2: string[] }[] = [];

  for (let i = 0; i < courts; i++) {
    const group = sorted.slice(i * 4, i * 4 + 4);
    // Snake: [0,3] vs [1,2] balances total ELO
    result.push({ team1: [group[0], group[3]], team2: [group[1], group[2]] });
  }

  return result;
}

export function randomPairs(playerIds: string[]): { team1: string[]; team2: string[] }[] {
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
  const courts = Math.floor(shuffled.length / 4);
  const result: { team1: string[]; team2: string[] }[] = [];

  for (let i = 0; i < courts; i++) {
    const group = shuffled.slice(i * 4, i * 4 + 4);
    result.push({ team1: [group[0], group[1]], team2: [group[2], group[3]] });
  }

  return result;
}
