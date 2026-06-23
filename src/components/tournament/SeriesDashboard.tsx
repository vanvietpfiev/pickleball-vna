'use client';
import { useState } from 'react';
import { Tournament, TParticipant, TMatch, TSeries } from '@/lib/types';
import { calcGroupStandings, generateSeriesKnockout, propagateSeriesKO } from '@/lib/tournamentUtils';
import Avatar from '@/components/Avatar';
import { Player } from '@/lib/types';

interface Props {
  tournament: Tournament;
  players: Player[];
  isLoggedIn: boolean;
  onSave: (patch: Partial<{ matches: TMatch[]; status: string }>) => Promise<void>;
}

function pName(p: TParticipant | undefined, players: Player[]) {
  if (!p) return 'TBD';
  if (p.name) return p.name;
  return p.playerIds.map((id) => players.find((x) => x.id === id)?.name?.split(' ').pop() ?? '?').join(' / ');
}

function pAvatars(p: TParticipant | undefined, players: Player[]) {
  if (!p) return null;
  return (
    <div className="flex -space-x-1">
      {p.playerIds.slice(0, 2).map((id) => {
        const pl = players.find((x) => x.id === id);
        return pl ? <Avatar key={id} src={pl.avatar} name={pl.name} size={20} className="ring-1 ring-white" /> : null;
      })}
    </div>
  );
}

interface ScoreInput { score1: string; score2: string }

function MatchBox({
  match, participants, players, isLoggedIn, onEdit, label, compact,
}: {
  match: TMatch | undefined;
  participants: TParticipant[];
  players: Player[];
  isLoggedIn: boolean;
  onEdit?: (m: TMatch) => void;
  label?: string;
  compact?: boolean;
}) {
  if (!match) return <div className="h-16 rounded-xl bg-gray-50 border border-dashed border-gray-200" />;
  const p1 = participants.find((p) => p.id === match.p1Id);
  const p2 = participants.find((p) => p.id === match.p2Id);
  const isTBD = match.p1Id === 'TBD' || match.p2Id === 'TBD';
  const winner = match.played ? (match.score1! >= match.score2! ? 'p1' : 'p2') : null;

  return (
    <div
      onClick={() => !isTBD && isLoggedIn && onEdit?.(match)}
      className={`rounded-xl border transition-all text-xs ${
        isTBD ? 'bg-gray-50 border-dashed border-gray-200 cursor-default' :
        isLoggedIn ? 'bg-white border-gray-200 cursor-pointer hover:border-blue-300 hover:shadow-sm' :
        'bg-white border-gray-200'
      }`}
    >
      {label && (
        <div className="px-2 pt-1.5 pb-0 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</div>
      )}
      <div className="px-2 py-1.5 space-y-1">
        {[{ p: p1, id: match.p1Id, score: match.score1, isWinner: winner === 'p1' },
          { p: p2, id: match.p2Id, score: match.score2, isWinner: winner === 'p2' }].map(({ p, id, score, isWinner }, i) => (
          <div key={i} className={`flex items-center gap-1.5 ${isWinner ? 'font-semibold' : ''}`}>
            {p ? pAvatars(p, players) : <div className="w-5 h-5 rounded-full bg-gray-100" />}
            <span className={`flex-1 truncate ${id === 'TBD' ? 'text-gray-300 italic' : isWinner ? 'text-blue-800' : 'text-gray-600'}`}>
              {id === 'TBD' ? 'TBD' : pName(p, players)}
            </span>
            {match.played && (
              <span className={`w-5 text-center font-bold ${isWinner ? 'text-blue-700' : 'text-gray-400'}`}>{score ?? 0}</span>
            )}
          </div>
        ))}
      </div>
      {isLoggedIn && !isTBD && !match.played && (
        <div className="px-2 pb-1.5 pt-0">
          <span className="text-[10px] text-blue-500 font-medium">Nhập kết quả →</span>
        </div>
      )}
    </div>
  );
}

function ScoreModal({
  match, participants, players, onClose, onSave,
}: {
  match: TMatch;
  participants: TParticipant[];
  players: Player[];
  onClose: () => void;
  onSave: (s1: number, s2: number) => void;
}) {
  const [s, setS] = useState<ScoreInput>({
    score1: match.score1?.toString() ?? '',
    score2: match.score2?.toString() ?? '',
  });
  const p1 = participants.find((p) => p.id === match.p1Id);
  const p2 = participants.find((p) => p.id === match.p2Id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-gray-800 mb-4 text-center">Nhập kết quả</h3>
        <div className="space-y-3">
          {[{ p: p1, key: 'score1' as const, label: pName(p1, players) },
            { p: p2, key: 'score2' as const, label: pName(p2, players) }].map(({ p, key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <div className="flex-1 text-sm font-medium text-gray-700 truncate">{label}</div>
              <input
                type="number" min="0"
                className="w-16 border-2 border-gray-200 rounded-xl px-2 py-2 text-center text-lg font-bold focus:outline-none focus:border-blue-500"
                value={s[key]} onChange={(e) => setS((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Huỷ</button>
          <button
            onClick={() => {
              const s1 = parseInt(s.score1) || 0;
              const s2 = parseInt(s.score2) || 0;
              onSave(s1, s2);
            }}
            disabled={s.score1 === '' || s.score2 === ''}
            className="flex-1 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-semibold disabled:opacity-40 hover:bg-blue-800"
          >
            Lưu kết quả
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SeriesDashboard({ tournament, players, isLoggedIn, onSave }: Props) {
  const [activeSeries, setActiveSeries] = useState<string>('A');
  const [activeView, setActiveView] = useState<'groups' | 'bracket'>('groups');
  const [editingMatch, setEditingMatch] = useState<TMatch | null>(null);

  const config = tournament.config;
  const seriesList: TSeries[] = config.series ?? [
    { id: 'A', name: 'Series A – Đôi Nam-Nam', type: 'male_male' },
    { id: 'B', name: 'Series B – Đôi Nam-Nữ', type: 'male_female' },
  ];
  const participants = config.participants ?? [];
  const allGroups = config.groups ?? [];

  const getSeriesGroups = (sId: string) => allGroups.filter((g) => g.seriesId === sId);
  const getSeriesMatches = (sId: string) => tournament.matches.filter((m) => m.seriesId === sId);

  const isSetup = tournament.status === 'setup';
  const isGroupStage = tournament.status === 'group_stage';
  const isKnockout = tournament.status === 'knockout' || tournament.status === 'finished';

  const handleStartGroups = async () => {
    const allGroupMatches = seriesList.flatMap((s) =>
      getSeriesGroups(s.id).flatMap((g) => {
        const ids = g.participantIds;
        const matches = [];
        let order = 0;
        for (let i = 0; i < ids.length; i++)
          for (let j = i + 1; j < ids.length; j++)
            matches.push({
              id: `sgm_${Date.now()}_${s.id}_${g.name}_${order}`,
              stage: 'group' as const, groupName: g.name, seriesId: s.id,
              p1Id: ids[i], p2Id: ids[j], played: false, order: order++,
            });
        return matches;
      })
    );
    await onSave({ matches: allGroupMatches, status: 'group_stage' });
  };

  const handleGenerateKnockout = async () => {
    const groupMatches = tournament.matches.filter((m) => m.stage === 'group');
    const koMatches = seriesList.flatMap((s) =>
      generateSeriesKnockout(s.id, allGroups, groupMatches)
    );
    await onSave({ matches: [...groupMatches, ...koMatches], status: 'knockout' });
    setActiveView('bracket');
  };

  const handleMatchResult = async (matchId: string, score1: number, score2: number) => {
    setEditingMatch(null);
    let updated = tournament.matches.map((m) =>
      m.id === matchId ? { ...m, score1, score2, played: true } : m
    );
    // Propagate per series
    for (const s of seriesList) {
      updated = propagateSeriesKO(s.id, updated);
    }
    await onSave({ matches: updated });
  };

  const currentSeries = seriesList.find((s) => s.id === activeSeries);
  const seriesGroups = getSeriesGroups(activeSeries);
  const seriesMatches = getSeriesMatches(activeSeries);
  const groupMatches = seriesMatches.filter((m) => m.stage === 'group');
  const qfMatches = seriesMatches.filter((m) => m.stage === 'qf').sort((a, b) => a.order - b.order);
  const sfMatches = seriesMatches.filter((m) => m.stage === 'sf').sort((a, b) => a.order - b.order);
  const finalMatch = seriesMatches.find((m) => m.stage === 'final');

  return (
    <div className="space-y-4">
      {/* Series tabs */}
      <div className="flex gap-2">
        {seriesList.map((s) => (
          <button key={s.id} onClick={() => setActiveSeries(s.id)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeSeries === s.id
                ? 'bg-blue-700 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
            }`}>
            {s.name}
          </button>
        ))}
      </div>

      {/* Action buttons */}
      {isLoggedIn && (
        <div className="flex gap-2 flex-wrap">
          {isSetup && (
            <button onClick={handleStartGroups}
              className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700">
              ▶ Bắt đầu vòng bảng
            </button>
          )}
          {isGroupStage && (
            <button onClick={handleGenerateKnockout}
              className="px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700">
              ⚡ Tạo vòng loại trực tiếp
            </button>
          )}
          {isKnockout && (
            <button onClick={() => onSave({ status: 'finished' })}
              className="px-4 py-2 rounded-xl bg-gray-700 text-white text-sm font-semibold hover:bg-gray-800">
              🏁 Kết thúc giải
            </button>
          )}
        </div>
      )}

      {/* View toggle */}
      {isKnockout && (
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {(['groups', 'bracket'] as const).map((v) => (
            <button key={v} onClick={() => setActiveView(v)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                activeView === v ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'
              }`}>
              {v === 'groups' ? '📊 Bảng đấu' : '🏆 Nhánh đấu'}
            </button>
          ))}
        </div>
      )}

      {/* Groups view */}
      {(activeView === 'groups' || !isKnockout) && (
        <div className="space-y-4">
          {seriesGroups.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              Chưa có nhóm nào trong {currentSeries?.name}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {seriesGroups.map((group) => {
                const gm = groupMatches.filter((m) => m.groupName === group.name);
                const standings = calcGroupStandings(group.participantIds, gm);
                const totalGames = (group.participantIds.length * (group.participantIds.length - 1)) / 2;
                const played = gm.filter((m) => m.played).length;

                return (
                  <div key={group.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Group header */}
                    <div className="bg-gradient-to-r from-blue-900 to-blue-700 px-4 py-3 flex items-center justify-between">
                      <span className="font-bold text-white text-sm">{group.name}</span>
                      <span className="text-blue-300 text-xs">{played}/{totalGames} trận</span>
                    </div>

                    {/* Standings */}
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-400 uppercase tracking-wide">
                          <th className="text-left px-3 py-1.5 font-semibold">Đội</th>
                          <th className="px-2 py-1.5 font-semibold">Đ</th>
                          <th className="px-2 py-1.5 font-semibold">T</th>
                          <th className="px-2 py-1.5 font-semibold">B</th>
                          <th className="px-2 py-1.5 font-semibold">HS</th>
                          <th className="px-2 py-1.5 font-semibold text-blue-700">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.map((s, idx) => {
                          const p = participants.find((x) => x.id === s.participantId);
                          const advances = idx < 2;
                          const gd = s.goalsFor - s.goalsAgainst;
                          return (
                            <tr key={s.participantId}
                              className={`border-t border-gray-50 ${advances ? 'bg-blue-50/50' : ''}`}>
                              <td className="px-3 py-2 flex items-center gap-1.5">
                                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                                  idx === 0 ? 'bg-yellow-400 text-yellow-900' :
                                  idx === 1 ? 'bg-slate-300 text-slate-700' :
                                  'bg-gray-100 text-gray-400'
                                }`}>{idx + 1}</span>
                                {p ? pAvatars(p, players) : null}
                                <span className={`truncate font-medium ${advances ? 'text-blue-800' : 'text-gray-700'}`}>
                                  {pName(p, players)}
                                </span>
                                {advances && <span className="text-[10px] text-blue-500 font-bold ml-auto flex-shrink-0">→ TK</span>}
                              </td>
                              <td className="px-2 py-2 text-center text-gray-500">{s.played}</td>
                              <td className="px-2 py-2 text-center text-green-600 font-medium">{s.wins}</td>
                              <td className="px-2 py-2 text-center text-red-400">{s.losses}</td>
                              <td className="px-2 py-2 text-center text-gray-500">{gd > 0 ? '+' : ''}{gd}</td>
                              <td className="px-2 py-2 text-center font-bold text-blue-700">{s.points}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Group matches */}
                    {gm.length > 0 && (
                      <div className="border-t border-gray-50 px-3 py-2 space-y-1">
                        {gm.map((m) => {
                          const p1 = participants.find((p) => p.id === m.p1Id);
                          const p2 = participants.find((p) => p.id === m.p2Id);
                          const winner = m.played ? (m.score1! >= m.score2! ? 'p1' : 'p2') : null;
                          return (
                            <div key={m.id}
                              onClick={() => isLoggedIn && setEditingMatch(m)}
                              className={`flex items-center gap-2 text-xs py-1 px-2 rounded-lg transition-all ${
                                isLoggedIn ? 'cursor-pointer hover:bg-blue-50' : ''
                              } ${m.played ? 'bg-gray-50/50' : ''}`}>
                              <span className={`flex-1 truncate text-right ${winner === 'p1' ? 'font-bold text-blue-800' : 'text-gray-600'}`}>
                                {pName(p1, players)}
                              </span>
                              <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${
                                m.played ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-400'
                              }`}>
                                {m.played ? `${m.score1}-${m.score2}` : 'vs'}
                              </span>
                              <span className={`flex-1 truncate ${winner === 'p2' ? 'font-bold text-blue-800' : 'text-gray-600'}`}>
                                {pName(p2, players)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Bracket view */}
      {activeView === 'bracket' && isKnockout && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 overflow-x-auto">
          <div className="min-w-[600px]">
            {qfMatches.length > 0 ? (
              /* QF → SF → Final layout */
              <div className="flex gap-4 items-center">
                {/* QF column */}
                <div className="flex-1 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center mb-3">Tứ kết</p>
                  {qfMatches.map((m, i) => (
                    <MatchBox key={m.id} match={m} participants={participants} players={players}
                      isLoggedIn={isLoggedIn} onEdit={setEditingMatch}
                      label={`TK${i + 1}`} />
                  ))}
                </div>

                {/* Arrow */}
                <div className="text-gray-300 text-xl flex-shrink-0">→</div>

                {/* SF column */}
                <div className="flex-1 space-y-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center mb-3">Bán kết</p>
                  {sfMatches.map((m, i) => (
                    <MatchBox key={m.id} match={m} participants={participants} players={players}
                      isLoggedIn={isLoggedIn} onEdit={setEditingMatch}
                      label={`BK${i + 1}`} />
                  ))}
                </div>

                {/* Arrow */}
                <div className="text-gray-300 text-xl flex-shrink-0">→</div>

                {/* Final column */}
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 text-center mb-3">🏆 Chung kết</p>
                  <div className="ring-2 ring-amber-400 rounded-xl">
                    <MatchBox match={finalMatch} participants={participants} players={players}
                      isLoggedIn={isLoggedIn} onEdit={setEditingMatch}
                      label="Chung kết" />
                  </div>
                  {finalMatch?.played && (
                    <div className="mt-3 text-center">
                      {(() => {
                        const winner = participants.find((p) =>
                          p.id === (finalMatch.score1! >= finalMatch.score2! ? finalMatch.p1Id : finalMatch.p2Id)
                        );
                        return (
                          <div className="bg-amber-50 rounded-xl py-3 px-2 border border-amber-200">
                            <p className="text-xs text-amber-600 font-semibold">🥇 Vô địch {currentSeries?.name}</p>
                            <p className="font-bold text-amber-800 text-sm mt-1">{pName(winner, players)}</p>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            ) : sfMatches.length > 0 ? (
              /* SF → Final layout (2 groups) */
              <div className="flex gap-4 items-center">
                <div className="flex-1 space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center mb-3">Bán kết</p>
                  {sfMatches.map((m, i) => (
                    <MatchBox key={m.id} match={m} participants={participants} players={players}
                      isLoggedIn={isLoggedIn} onEdit={setEditingMatch} label={`BK${i + 1}`} />
                  ))}
                </div>
                <div className="text-gray-300 text-xl flex-shrink-0">→</div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 text-center mb-3">🏆 Chung kết</p>
                  <div className="ring-2 ring-amber-400 rounded-xl">
                    <MatchBox match={finalMatch} participants={participants} players={players}
                      isLoggedIn={isLoggedIn} onEdit={setEditingMatch} label="Chung kết" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                Vòng loại trực tiếp chưa được tạo
              </div>
            )}
          </div>
        </div>
      )}

      {/* Score modal */}
      {editingMatch && (
        <ScoreModal
          match={editingMatch}
          participants={participants}
          players={players}
          onClose={() => setEditingMatch(null)}
          onSave={(s1, s2) => handleMatchResult(editingMatch.id, s1, s2)}
        />
      )}
    </div>
  );
}
