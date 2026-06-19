'use client';
import { useState, useMemo } from 'react';
import { Tournament, TMatch, Player, TSet } from '@/lib/types';
import { calcGroupStandings } from '@/lib/tournamentUtils';
import Avatar from '@/components/Avatar';

interface Props {
  tournament: Tournament;
  players: Player[];
  saving: boolean;
  isLoggedIn: boolean;
  onMatchResult: (matchId: string, score1: number, score2: number, sets: TSet[]) => void;
}

const RANK_COLORS = [
  'bg-yellow-400 text-white',
  'bg-slate-300 text-slate-700',
  'bg-amber-600 text-white',
];
const RANK_ICONS = ['🥇', '🥈', '🥉'];

export default function RoundRobinView({ tournament, players, saving, isLoggedIn, onMatchResult }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [s1, setS1] = useState('');
  const [s2, setS2] = useState('');

  const participants = tournament.config?.participants ?? [];
  const matches = tournament.matches ?? [];

  // ── helpers ────────────────────────────────────────────────────────

  function pName(pId: string) {
    const p = participants.find((x) => x.id === pId);
    if (!p) return pId;
    if (p.name) return p.name;
    return p.playerIds.map((id) => players.find((x) => x.id === id)?.name ?? id).join(' & ');
  }

  function pPlayers(pId: string): Player[] {
    const p = participants.find((x) => x.id === pId);
    if (!p) return [];
    return p.playerIds.map((id) => players.find((x) => x.id === id)).filter(Boolean) as Player[];
  }

  // ── computed data ───────────────────────────────────────────────────

  const rounds = useMemo(() => {
    const map: Record<string, TMatch[]> = {};
    for (const m of matches) {
      const key = m.groupName || 'Vòng 1';
      if (!map[key]) map[key] = [];
      map[key].push(m);
    }
    return Object.entries(map).sort((a, b) => {
      const na = parseInt(a[0].replace(/\D/g, '') || '0');
      const nb = parseInt(b[0].replace(/\D/g, '') || '0');
      return na - nb;
    });
  }, [matches]);

  const standings = useMemo(
    () => calcGroupStandings(participants.map((p) => p.id), matches),
    [participants, matches]
  );

  const playedCount = matches.filter((m) => m.played).length;
  const totalCount = matches.length;
  const pct = totalCount ? Math.round((playedCount / totalCount) * 100) : 0;
  const isFinished = tournament.status === 'finished';

  // ── result entry ────────────────────────────────────────────────────

  const startEdit = (m: TMatch) => {
    setEditingId(m.id);
    setS1(m.score1 != null ? String(m.score1) : '');
    setS2(m.score2 != null ? String(m.score2) : '');
  };

  const saveResult = (matchId: string) => {
    const score1 = parseInt(s1) || 0;
    const score2 = parseInt(s2) || 0;
    onMatchResult(matchId, score1, score2, []);
    setEditingId(null);
    setS1(''); setS2('');
  };

  // ── render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Progress strip */}
      <div className="card px-4 py-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-slate-700">Tiến độ</p>
            {saving && <span className="text-xs text-blue-500 animate-pulse">Đang lưu...</span>}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span><span className="font-bold text-blue-700">{playedCount}</span>/{totalCount} trận</span>
            {pct === 100 && <span className="text-green-600 font-bold">✅ Xong!</span>}
          </div>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-blue-500 to-blue-400"
            style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-slate-400">{totalCount - playedCount} trận còn lại</span>
          <span className={`text-[10px] font-bold ${pct === 100 ? 'text-green-600' : 'text-slate-400'}`}>{pct}%</span>
        </div>
      </div>

      {/* Champion banner (when finished) */}
      {isFinished && standings.length > 0 && (
        <div className="gradient-gold rounded-2xl px-6 py-5 text-white shadow-lg text-center animate-slide-up">
          <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">🏆 Vô địch</p>
          <p className="text-3xl font-black">{pName(standings[0].participantId)}</p>
          <p className="text-sm opacity-80 mt-1">
            {standings[0].wins} thắng · {standings[0].points} điểm ·
            {(standings[0].goalsFor - standings[0].goalsAgainst) >= 0 ? ' +' : ' '}{standings[0].goalsFor - standings[0].goalsAgainst} hiệu số
          </p>
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6 items-start">

        {/* ── Standings (2 cols) ─────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Top 3 podium */}
          {standings.length >= 2 && (
            <div className="grid grid-cols-3 gap-2 items-end">
              {[
                { s: standings[1], rank: 1 },
                { s: standings[0], rank: 0 },
                { s: standings.length >= 3 ? standings[2] : null, rank: 2 },
              ].map(({ s, rank }) => {
                if (!s) return <div key={rank} />;
                const pls = pPlayers(s.participantId);
                const diff = s.goalsFor - s.goalsAgainst;
                return (
                  <div key={s.participantId}>
                    <div className={`card p-2 text-center ${rank === 0 ? 'ring-2 ring-yellow-300 shadow-lg' : ''}`}>
                      <div className="text-base mb-1">{RANK_ICONS[rank]}</div>
                      {pls.length > 0 && (
                        <div className="flex justify-center mb-1">
                          <div className="flex -space-x-2">
                            {pls.map((pl) => (
                              <Avatar key={pl.id} src={pl.avatar} name={pl.name} size={rank === 0 ? 28 : 22}
                                className="ring-1 ring-white" />
                            ))}
                          </div>
                        </div>
                      )}
                      <p className="text-[10px] font-bold text-slate-700 leading-tight mb-1 overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{pName(s.participantId)}</p>
                      <div className={`rounded-lg px-1 py-1 ${rank === 0 ? 'bg-yellow-50' : rank === 1 ? 'bg-slate-50' : 'bg-amber-50'}`}>
                        <p className={`text-sm font-black ${rank === 0 ? 'text-yellow-700' : rank === 1 ? 'text-slate-600' : 'text-amber-800'}`}>{s.points}</p>
                        <p className="text-[9px] text-slate-400">điểm</p>
                      </div>
                      <p className={`text-[10px] mt-1 font-bold ${diff >= 0 ? 'text-blue-500' : 'text-red-400'}`}>
                        {diff >= 0 ? `+${diff}` : diff}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full standings table */}
          <div className="card overflow-hidden">
            <div className="gradient-navy px-4 py-3 flex items-center justify-between">
              <p className="text-sm font-bold text-white">Bảng xếp hạng</p>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${isFinished ? 'bg-slate-300' : 'bg-green-400 animate-pulse'}`} />
                <span className="text-xs text-blue-200">{isFinished ? 'Kết thúc' : 'Live'}</span>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-2 py-2 text-xs font-bold text-slate-400 w-8">#</th>
                  <th className="text-left px-2 py-2 text-xs font-bold text-slate-400">Đội</th>
                  <th className="hidden sm:table-cell text-center px-1.5 py-2 text-xs font-bold text-slate-400 w-7">P</th>
                  <th className="text-center px-1.5 py-2 text-xs font-bold text-green-500 w-7">W</th>
                  <th className="text-center px-1.5 py-2 text-xs font-bold text-red-400 w-7">L</th>
                  <th className="text-center px-2 py-2 text-xs font-bold text-blue-600 w-10">Pts</th>
                  <th className="text-center px-1.5 py-2 text-xs font-bold text-slate-400 w-10">±</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {standings.map((s, i) => {
                  const diff = s.goalsFor - s.goalsAgainst;
                  const isTop3 = i < 3;
                  const pls = pPlayers(s.participantId);
                  return (
                    <tr key={s.participantId}
                      className={`transition-colors ${i % 2 === 1 ? 'bg-slate-50/40' : ''} hover:bg-blue-50/40`}>
                      <td className="px-2 py-2">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${isTop3 ? RANK_COLORS[i] : 'bg-slate-100 text-slate-500'}`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-2 py-2 max-w-0">
                        <div className="flex items-center gap-1.5">
                          {pls.length > 0 && (
                            <div className="flex -space-x-1.5 flex-shrink-0">
                              {pls.map((pl) => (
                                <Avatar key={pl.id} src={pl.avatar} name={pl.name} size={20} className="ring-1 ring-white" />
                              ))}
                            </div>
                          )}
                          <span className={`font-semibold text-xs leading-tight truncate ${i === 0 ? 'text-blue-700' : 'text-slate-700'}`}>
                            {pName(s.participantId)}
                          </span>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell text-center px-1.5 py-2 text-xs text-slate-400">{s.played}</td>
                      <td className="text-center px-1.5 py-2 text-xs font-bold text-green-600">{s.wins}</td>
                      <td className="text-center px-1.5 py-2 text-xs text-red-400">{s.losses}</td>
                      <td className="text-center px-2 py-2">
                        <span className={`text-sm font-black ${i === 0 ? 'text-blue-700' : 'text-slate-700'}`}>{s.points}</span>
                      </td>
                      <td className="text-center px-1.5 py-2 text-xs font-bold">
                        <span className={diff > 0 ? 'text-green-500' : diff < 0 ? 'text-red-400' : 'text-slate-300'}>
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
              <span>W: Thắng = 3 điểm</span>
              <span>L: Thua = 0 điểm</span>
              <span>±: Hiệu số điểm</span>
            </div>
          </div>
        </div>

        {/* ── Match schedule (3 cols) ────────────────────────────── */}
        <div className="lg:col-span-3">
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-600 uppercase tracking-wider">Lịch thi đấu</p>
              <span className="text-xs text-slate-400">{rounds.length} vòng · {totalCount} trận</span>
            </div>

            <div className="divide-y divide-slate-50">
              {rounds.map(([roundName, roundMatches]) => {
                const roundPlayed = roundMatches.filter((m) => m.played).length;
                const roundDone = roundPlayed === roundMatches.length;
                return (
                  <div key={roundName}>
                    {/* Round header */}
                    <div className="px-5 py-2 bg-slate-50/80 flex items-center gap-3 sticky top-0 z-10 border-b border-slate-100">
                      <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{roundName}</span>
                      <div className="flex-1 h-px bg-slate-200" />
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        roundDone ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {roundPlayed}/{roundMatches.length} {roundDone ? '✓' : ''}
                      </span>
                    </div>

                    {/* Matches */}
                    {roundMatches.sort((a, b) => a.order - b.order).map((m) => (
                      <div key={m.id}
                        className={`px-3 sm:px-5 py-3 transition-colors ${editingId === m.id ? 'bg-blue-50' : 'hover:bg-slate-50/60'}`}>
                        {editingId === m.id ? (
                          /* ── Inline edit form ── */
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-blue-600 font-semibold">
                              <span>✏️</span>
                              <span>Nhập kết quả: {pName(m.p1Id)} vs {pName(m.p2Id)}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                <span className="text-sm font-semibold text-blue-700 truncate">{pName(m.p1Id)}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <input type="number" min="0"
                                  className="w-16 border-2 border-blue-400 rounded-xl px-2 py-2 text-base text-center font-black focus:outline-none focus:ring-2 focus:ring-blue-400"
                                  value={s1} onChange={(e) => setS1(e.target.value)} autoFocus />
                                <span className="text-slate-400 font-bold text-lg">–</span>
                                <input type="number" min="0"
                                  className="w-16 border-2 border-blue-400 rounded-xl px-2 py-2 text-base text-center font-black focus:outline-none focus:ring-2 focus:ring-blue-400"
                                  value={s2} onChange={(e) => setS2(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && saveResult(m.id)} />
                              </div>
                              <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                                <span className="text-sm font-semibold text-blue-700 truncate text-right">{pName(m.p2Id)}</span>
                              </div>
                            </div>
                            {s1 !== '' && s2 !== '' && s1 !== s2 && (
                              <p className="text-xs text-slate-500">
                                → <span className="font-bold text-green-600">{parseInt(s1) > parseInt(s2) ? pName(m.p1Id) : pName(m.p2Id)}</span> thắng +3 điểm
                              </p>
                            )}
                            <div className="flex gap-2 pt-1">
                              <button onClick={() => saveResult(m.id)} disabled={s1 === '' || s2 === ''}
                                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-40">
                                Lưu kết quả
                              </button>
                              <button onClick={() => { setEditingId(null); setS1(''); setS2(''); }}
                                className="text-slate-400 px-3 py-2 rounded-xl text-sm hover:bg-slate-100 transition-all">
                                Hủy
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* ── Display row ── */
                          <div className="flex items-center gap-3">
                            {/* Team 1 */}
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              {pPlayers(m.p1Id).length > 0 && (
                                <div className="flex -space-x-1.5 flex-shrink-0">
                                  {pPlayers(m.p1Id).map((pl) => (
                                    <Avatar key={pl.id} src={pl.avatar} name={pl.name} size={24} className="ring-1 ring-white" />
                                  ))}
                                </div>
                              )}
                              <span className={`text-sm font-semibold truncate ${
                                m.played && m.score1! > m.score2! ? 'text-blue-700' : 'text-slate-700'
                              }`}>
                                {pName(m.p1Id)}
                              </span>
                              {m.played && m.score1! > m.score2! && (
                                <span className="text-xs text-yellow-500 flex-shrink-0">👑</span>
                              )}
                            </div>

                            {/* Score */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {m.played ? (
                                <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl px-3 py-1">
                                  <span className={`text-base font-black min-w-5 text-center ${m.score1! > m.score2! ? 'text-blue-700' : 'text-slate-400'}`}>
                                    {m.score1}
                                  </span>
                                  <span className="text-slate-300 text-xs font-bold">–</span>
                                  <span className={`text-base font-black min-w-5 text-center ${m.score2! > m.score1! ? 'text-blue-700' : 'text-slate-400'}`}>
                                    {m.score2}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-300 text-sm font-bold px-3">vs</span>
                              )}

                              {isLoggedIn && !isFinished && (
                                <button onClick={() => startEdit(m)}
                                  className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-all flex-shrink-0 ${
                                    m.played
                                      ? 'text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200'
                                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                                  }`}>
                                  {m.played ? 'Sửa' : 'Nhập'}
                                </button>
                              )}

                              {m.played && (
                                <span className="text-green-400 text-xs flex-shrink-0">✓</span>
                              )}
                            </div>

                            {/* Team 2 */}
                            <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                              {m.played && m.score2! > m.score1! && (
                                <span className="text-xs text-yellow-500 flex-shrink-0">👑</span>
                              )}
                              <span className={`text-sm font-semibold truncate text-right ${
                                m.played && m.score2! > m.score1! ? 'text-blue-700' : 'text-slate-700'
                              }`}>
                                {pName(m.p2Id)}
                              </span>
                              {pPlayers(m.p2Id).length > 0 && (
                                <div className="flex -space-x-1.5 flex-shrink-0">
                                  {pPlayers(m.p2Id).map((pl) => (
                                    <Avatar key={pl.id} src={pl.avatar} name={pl.name} size={24} className="ring-1 ring-white" />
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
