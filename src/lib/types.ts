export type PlayerLevel = 'A' | 'B' | 'C' | '';

export interface Player {
  id: string;
  name: string;
  elo: number;
  matches: number;
  wins: number;
  losses: number;
  createdAt: string;
  avatar?: string;
  initialElo?: number;
  level?: PlayerLevel;
  unit?: string;
}

export interface Match {
  id: string;
  date: string;
  type: 'singles' | 'doubles';
  team1: string[];
  team2: string[];
  score1: number;
  score2: number;
  winningSide: '1' | '2';
  notes?: string;
}

export interface Session {
  id: string;
  date: string;
  playerIds: string[];
  teams: { team1: string[]; team2: string[] }[];
  mode: 'balanced' | 'random';
}

// ── Tournament ────────────────────────────────────────────────────

/** A participant is 1 player (singles) or 2 players (doubles) */
export interface TParticipant {
  id: string;          // e.g. "tp_001"
  playerIds: string[];
  name?: string;       // custom team name for doubles
}

export interface TGroup {
  name: string;        // "Bảng A", "Bảng B" …
  participantIds: string[];
}

export type TMatchStage = 'group' | 'qf' | 'sf' | '3rd' | 'final';

export interface TSet {
  s1: number;
  s2: number;
}

export interface TMatch {
  id: string;
  stage: TMatchStage;
  groupName?: string;  // only for group stage
  p1Id: string;        // participant ID or 'TBD'
  p2Id: string;
  score1?: number;     // sets won by p1
  score2?: number;     // sets won by p2
  sets?: TSet[];       // per-set point scores
  played: boolean;
  order: number;       // sort order within stage
  globalMatchId?: string; // ID in global Matches sheet (set after first result save)
}

export interface TournamentFormat {
  advancePerGroup: number;   // 1 or 2
  hasThirdPlace: boolean;
}

export interface TournamentConfig {
  participants: TParticipant[];
  groups: TGroup[];
  format: TournamentFormat;
  mode?: 'group_knockout' | 'round_robin';
}

export type TournamentStatus = 'setup' | 'group_stage' | 'knockout' | 'finished';

export interface Tournament {
  id: string;
  name: string;
  date: string;
  venue?: string;
  type: 'singles' | 'doubles';
  config: TournamentConfig;
  matches: TMatch[];
  status: TournamentStatus;
}

export interface EloChange {
  playerId: string;
  before: number;
  after: number;
  change: number;
}
