'use client';
import { TMatch, TParticipant, Player } from '@/lib/types';

interface Props {
  matches: TMatch[];
  participants: TParticipant[];
  players: Player[];
  onMatchClick: (match: TMatch) => void;
}

function pLabel(pId: string, participants: TParticipant[], players: Player[]): string {
  if (!pId || pId === 'TBD') return 'TBD';
  const p = participants.find((x) => x.id === pId);
  if (!p) return '?';
  if (p.name) return p.name;
  return p.playerIds.map((id) => {
    const pl = players.find((x) => x.id === id);
    return pl ? (pl.name.split(' ').pop() || pl.name) : id;
  }).join('/');
}

function MatchBox({
  match, participants, players, onMatchClick, highlight
}: {
  match: TMatch | undefined;
  participants: TParticipant[];
  players: Player[];
  onMatchClick: (m: TMatch) => void;
  highlight?: boolean;
}) {
  if (!match) return <div className="w-44 h-16 rounded-xl bg-gray-50 border border-dashed border-gray-200" />;

  const isTBD = match.p1Id === 'TBD' || match.p2Id === 'TBD';
  const p1 = pLabel(match.p1Id, participants, players);
  const p2 = pLabel(match.p2Id, participants, players);
  const winner = match.played ? (match.score1! >= match.score2! ? match.p1Id : match.p2Id) : null;

  return (
    <button
      onClick={() => !isTBD && onMatchClick(match)}
      disabled={isTBD}
      className={`w-48 rounded-xl overflow-hidden border-2 transition-all text-left ${
        highlight ? 'border-yellow-400 shadow-yellow-100 shadow-lg' :
        match.played ? 'border-gray-200 hover:border-gray-300' :
        isTBD ? 'border-dashed border-gray-200 cursor-default' :
        'border-blue-200 hover:border-blue-400 hover:shadow-md cursor-pointer'
      }`}
    >
      {/* Player 1 row */}
      <div className={`px-3 py-2 flex items-center justify-between gap-2 ${
        match.played && winner === match.p1Id ? 'bg-green-50' : 'bg-white'
      }`}>
        <span className={`text-xs font-semibold truncate ${
          isTBD ? 'text-gray-300' :
          match.played && winner === match.p1Id ? 'text-green-700' : 'text-gray-700'
        }`}>{p1}</span>
        {match.played && (
          <span className={`text-sm font-bold flex-shrink-0 ${winner === match.p1Id ? 'text-green-600' : 'text-gray-400'}`}>
            {match.score1}
          </span>
        )}
        {!match.played && !isTBD && (
          <span className="text-blue-300 text-xs flex-shrink-0">✏️</span>
        )}
      </div>

      <div className="h-px bg-gray-100" />

      {/* Player 2 row */}
      <div className={`px-3 py-2 flex items-center justify-between gap-2 ${
        match.played && winner === match.p2Id ? 'bg-green-50' : 'bg-gray-50'
      }`}>
        <span className={`text-xs font-semibold truncate ${
          isTBD ? 'text-gray-300' :
          match.played && winner === match.p2Id ? 'text-green-700' : 'text-gray-500'
        }`}>{p2}</span>
        {match.played && (
          <span className={`text-sm font-bold flex-shrink-0 ${winner === match.p2Id ? 'text-green-600' : 'text-gray-400'}`}>
            {match.score2}
          </span>
        )}
      </div>

      {/* Set detail */}
      {match.played && match.sets && match.sets.length > 0 && (
        <div className="px-3 py-1 bg-gray-50 border-t border-gray-100 text-center text-gray-400" style={{ fontSize: 10 }}>
          {match.sets.map((s, i) => `${s.s1}-${s.s2}`).join('  ')}
        </div>
      )}
    </button>
  );
}

function Connector({ vertical = false }: { vertical?: boolean }) {
  return vertical
    ? <div className="w-px bg-gray-200 mx-auto" style={{ height: 28 }} />
    : <div className="h-px bg-gray-200 self-center" style={{ width: 20 }} />;
}

export default function KnockoutBracket({ matches, participants, players, onMatchClick }: Props) {
  const byStage = (s: string) => matches.filter((m) => m.stage === s).sort((a, b) => a.order - b.order);

  const qfs = byStage('qf');
  const sfs = byStage('sf');
  const finals = byStage('final');
  const thirds = byStage('3rd');

  const hasQF = qfs.length > 0;
  const hasSF = sfs.length > 0;
  const hasFinal = finals.length > 0;

  if (!hasFinal) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
        Chưa có nhánh knockout
      </div>
    );
  }

  // ── 2 teams: just Final ──────────────────────────────────────────
  if (!hasQF && !hasSF) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="text-xs font-bold text-yellow-600 uppercase tracking-widest bg-yellow-50 border border-yellow-200 px-3 py-1 rounded-full">
          🏆 Chung kết
        </div>
        <MatchBox match={finals[0]} participants={participants} players={players} onMatchClick={onMatchClick} highlight />
      </div>
    );
  }

  // ── 4 teams: SF → Final ─────────────────────────────────────────
  if (!hasQF && hasSF) {
    return (
      <div className="overflow-x-auto pb-4">
        <div className="min-w-max flex items-center gap-4 px-8 py-8">
          {/* SF column */}
          <div className="flex flex-col gap-6">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-2">Bán kết</div>
            {sfs.map((m) => (
              <MatchBox key={m.id} match={m} participants={participants} players={players} onMatchClick={onMatchClick} />
            ))}
          </div>

          {/* Connectors → Final */}
          <div className="flex flex-col items-center" style={{ gap: 40 }}>
            <div className="h-px bg-gray-200 w-5 mt-8" />
            <div className="h-px bg-gray-200 w-5 mb-2" />
          </div>

          {/* Final */}
          <div className="flex flex-col items-center gap-2">
            <div className="text-xs font-bold text-yellow-600 uppercase tracking-widest bg-yellow-50 border border-yellow-200 px-3 py-1 rounded-full mb-2">
              🏆 Chung kết
            </div>
            <MatchBox match={finals[0]} participants={participants} players={players} onMatchClick={onMatchClick} highlight />
            {thirds.length > 0 && (
              <>
                <div className="text-xs font-medium text-gray-400 mt-4 mb-1">🥉 Hạng 3</div>
                <MatchBox match={thirds[0]} participants={participants} players={players} onMatchClick={onMatchClick} />
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── 8 teams: QF → SF → Final ────────────────────────────────────
  return (
    <div className="overflow-x-auto pb-4">
      <div className="min-w-max flex items-start gap-0 px-8 py-8">
        {/* QF column */}
        <div className="flex flex-col gap-4">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-2 h-6">Tứ kết</div>
          {qfs.map((m, i) => (
            <div key={m.id} className={i === 1 ? 'mb-4' : ''}>
              <MatchBox match={m} participants={participants} players={players} onMatchClick={onMatchClick} />
            </div>
          ))}
        </div>

        {/* QF→SF connectors */}
        <div className="flex flex-col pt-8 gap-0" style={{ width: 24 }}>
          {[0, 1].map((i) => (
            <div key={i} className="relative" style={{ height: 94 + (i === 0 ? 0 : 16) }}>
              <div className="absolute right-0 top-1/2 w-3 h-px bg-gray-200" />
              <div className="absolute right-3 top-0 bottom-0 w-px bg-gray-200" style={{ top: '25%', bottom: '25%' }} />
              <div className="absolute left-3 top-1/2 w-3 h-px bg-gray-200" />
            </div>
          ))}
        </div>

        {/* SF column */}
        <div className="flex flex-col gap-4 pt-8">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-2 -mt-8 h-6">Bán kết</div>
          {sfs.map((m) => (
            <div key={m.id} className="flex items-center" style={{ marginTop: 24, marginBottom: 24 }}>
              <MatchBox match={m} participants={participants} players={players} onMatchClick={onMatchClick} />
            </div>
          ))}
        </div>

        {/* SF→Final connectors */}
        <div className="flex flex-col items-center pt-8" style={{ width: 24, marginTop: 24 }}>
          <div className="h-px bg-gray-200 w-full mt-8" />
          <div className="h-24 w-px bg-gray-200" />
          <div className="h-px bg-gray-200 w-full mb-8" />
        </div>

        {/* Final column */}
        <div className="flex flex-col items-center gap-3 pt-8" style={{ marginTop: 60 }}>
          <div className="text-xs font-bold text-yellow-600 uppercase tracking-widest bg-yellow-50 border border-yellow-200 px-3 py-1 rounded-full">
            🏆 Chung kết
          </div>
          <MatchBox match={finals[0]} participants={participants} players={players} onMatchClick={onMatchClick} highlight />
          {thirds.length > 0 && (
            <>
              <div className="text-xs font-medium text-gray-400 mt-6 mb-1">🥉 Hạng 3</div>
              <MatchBox match={thirds[0]} participants={participants} players={players} onMatchClick={onMatchClick} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
