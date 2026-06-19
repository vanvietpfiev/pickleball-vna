'use client';
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Tournament, TMatch, Player, TSet } from '@/lib/types';
import GroupStage from '@/components/tournament/GroupStage';
import KnockoutBracket from '@/components/tournament/KnockoutBracket';
import MatchEntryModal from '@/components/tournament/MatchEntryModal';
import RoundRobinView from '@/components/tournament/RoundRobinView';
import { generateGroupMatches, generateKnockoutMatches, propagateKOResult, isGroupStageComplete } from '@/lib/tournamentUtils';
import { useAuth } from '@/components/AuthProvider';

export default function TournamentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'group' | 'knockout'>('group');
  const [editingMatch, setEditingMatch] = useState<TMatch | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/tournament/${id}`).then((r) => r.json()),
      fetch('/api/players').then((r) => r.json()),
    ]).then(([t, p]) => {
      if (t && !t.error) setTournament(t);
      if (Array.isArray(p)) setPlayers(p);
      setLoading(false);
    });
  }, [id]);

  const save = async (updates: Partial<Tournament>) => {
    if (!tournament) return;
    setSaving(true);
    const merged = { ...tournament, ...updates };
    await fetch(`/api/tournament/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: merged.config,
        matches: merged.matches,
        status: merged.status,
      }),
    });
    setTournament(merged);
    setSaving(false);
  };

  const handleMatchResult = async (matchId: string, score1: number, score2: number, sets: TSet[]) => {
    if (!tournament) return;
    setEditingMatch(null);

    const matchBefore = tournament.matches.find((m) => m.id === matchId);

    let updated = tournament.matches.map((m) =>
      m.id === matchId ? { ...m, score1, score2, sets, played: true } : m
    );

    const hasKO = updated.some((m) => m.stage !== 'group');
    if (hasKO) updated = propagateKOResult(updated);

    await save({ matches: updated });

    // Push ELO update to Google Sheets (fire-and-forget)
    if (matchBefore && matchBefore.p1Id !== 'TBD' && matchBefore.p2Id !== 'TBD') {
      const tParticipants = tournament.config?.participants ?? [];
      const p1 = tParticipants.find((p) => p.id === matchBefore.p1Id);
      const p2 = tParticipants.find((p) => p.id === matchBefore.p2Id);
      if (p1 && p2 && p1.playerIds.length > 0 && p2.playerIds.length > 0) {
        fetch('/api/matches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: tournament.type,
            team1: p1.playerIds,
            team2: p2.playerIds,
            score1,
            score2,
            winningSide: score1 > score2 ? '1' : '2',
            notes: `[${tournament.name}]`,
          }),
        });
      }
    }
  };

  const startGroupStage = async () => {
    if (!tournament) return;
    const groupMatches = generateGroupMatches(tournament.config.groups);
    await save({ matches: groupMatches, status: 'group_stage' });
    setActiveTab('group');
  };

  const generateKnockout = async () => {
    if (!tournament) return;
    const groupMatches = tournament.matches.filter((m) => m.stage === 'group');
    const koMatches = generateKnockoutMatches(
      tournament.config.groups,
      groupMatches,
      tournament.config.format
    );
    await save({ matches: [...groupMatches, ...koMatches], status: 'knockout' });
    setActiveTab('knockout');
  };

  const finishTournament = async () => {
    if (!tournament) return;
    await save({ status: 'finished' });
  };

  const deleteTournament = async () => {
    await fetch(`/api/tournament/${id}`, { method: 'DELETE' });
    router.push('/tournament');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Đang tải giải đấu...</p>
        </div>
      </div>
    );
  }

  if (!tournament) return <p className="text-gray-500">Không tìm thấy giải đấu.</p>;

  const { config: rawConfig, status, matches } = tournament;
  // Detect round-robin: check config.mode first, fallback to match ID pattern
  const isRoundRobin =
    rawConfig?.mode === 'round_robin' ||
    (matches.length > 0 && (rawConfig?.groups ?? []).length === 0 && matches[0]?.id?.startsWith('rr_'));
  const participants = rawConfig?.participants ?? [];
  const groups = rawConfig?.groups ?? [];
  const format = rawConfig?.format ?? { advancePerGroup: 2, hasThirdPlace: false };

  const groupComplete = isGroupStageComplete(groups, matches);
  const hasKnockout = matches.some((m) => m.stage !== 'group');
  const koMatches = matches.filter((m) => m.stage !== 'group');
  const finalMatch = koMatches.find((m) => m.stage === 'final');
  const champion = finalMatch?.played
    ? participants.find((p) => p.id === (finalMatch.score1! > finalMatch.score2! ? finalMatch.p1Id : finalMatch.p2Id))
    : null;

  const statusConfig = {
    setup:       { label: 'Chuẩn bị',     color: 'bg-gray-100 text-gray-600' },
    group_stage: { label: 'Vòng bảng',     color: 'bg-blue-100 text-blue-700' },
    knockout:    { label: 'Knockout',       color: 'bg-orange-100 text-orange-700' },
    finished:    { label: '✅ Kết thúc',   color: 'bg-green-100 text-green-700' },
  };
  const sc = statusConfig[status] ?? statusConfig.setup;

  function participantName(pId: string) {
    const p = participants.find((x) => x.id === pId);
    if (!p) return pId;
    if (p.name) return p.name;
    return p.playerIds.map((id) => players.find((x) => x.id === id)?.name ?? id).join(' & ');
  }

  return (
    <div>
      {/* ── Header card ─────────────────────────────────────── */}
      <div className="gradient-navy rounded-2xl px-4 pt-4 pb-4 mb-4 text-white relative overflow-hidden">
        {/* Dot pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative">
          {/* Back + saving indicator */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => router.push('/tournament')} className="flex items-center gap-1 text-blue-200 text-sm hover:text-white transition-colors active:opacity-70">
              ← Danh sách
            </button>
            {saving && <span className="text-xs text-blue-300 animate-pulse">Đang lưu...</span>}
          </div>

          {/* Title row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold leading-tight mb-2">{tournament.name}</h1>
              {/* Badges */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sc.color}`}>{sc.label}</span>
                {isRoundRobin && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">⚽ Vòng tròn</span>
                )}
              </div>
              {/* Meta */}
              <div className="text-blue-200 text-xs flex flex-wrap gap-x-2 gap-y-0.5">
                <span>{tournament.type === 'singles' ? '👤 Đơn' : '👥 Đôi'}</span>
                <span>·</span>
                <span>
                  {new Date(tournament.date).toLocaleDateString('vi-VN', { dateStyle: 'short' })}{' '}
                  {new Date(tournament.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span>· {participants.length} {isRoundRobin ? 'đội' : 'người'}{!isRoundRobin && ` · ${groups.length} bảng`}</span>
                {tournament.venue && <span>· 📍 {tournament.venue}</span>}
              </div>
            </div>

            {/* Admin quick actions */}
            {isLoggedIn && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {status !== 'setup' && status !== 'finished' && (
                  confirmFinish ? (
                    <div className="flex items-center gap-1.5 bg-green-900/60 rounded-xl px-2.5 py-1.5">
                      <span className="text-xs text-green-200">Kết thúc?</span>
                      <button onClick={() => { finishTournament(); setConfirmFinish(false); }}
                        className="bg-green-400 text-green-900 px-2 py-0.5 rounded-lg text-xs font-black">✓</button>
                      <button onClick={() => setConfirmFinish(false)} className="text-blue-300 text-sm leading-none">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmFinish(true)}
                      className="bg-green-500/80 hover:bg-green-400 active:bg-green-600 text-white px-3 py-1.5 rounded-xl text-xs font-semibold transition-all">
                      🏁 Kết thúc
                    </button>
                  )
                )}
                {confirmDelete ? (
                  <div className="flex items-center gap-1.5 bg-red-900/60 rounded-xl px-2.5 py-1.5">
                    <span className="text-xs text-red-200">Xóa?</span>
                    <button onClick={deleteTournament}
                      className="bg-red-400 text-red-900 px-2 py-0.5 rounded-lg text-xs font-black">✓</button>
                    <button onClick={() => setConfirmDelete(false)} className="text-blue-300 text-sm leading-none">✕</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(true)}
                    className="bg-white/10 hover:bg-red-500/40 active:bg-red-600/60 text-white/60 hover:text-white px-2.5 py-1.5 rounded-xl text-sm transition-all">
                    🗑
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Start/Generate buttons (non-round-robin only) */}
          {!isRoundRobin && isLoggedIn && (status === 'setup' || (status === 'group_stage' && groupComplete && !hasKnockout)) && (
            <div className="mt-3 pt-3 border-t border-white/10 flex gap-2">
              {status === 'setup' && (
                <button onClick={startGroupStage}
                  className="bg-white/20 hover:bg-white/30 active:bg-white/10 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
                  🚀 Bắt đầu vòng bảng
                </button>
              )}
              {status === 'group_stage' && groupComplete && !hasKnockout && (
                <button onClick={generateKnockout}
                  className="bg-orange-400/80 hover:bg-orange-400 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
                  ⚡ Tạo nhánh Knockout
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Champion banner (group-knockout only) */}
      {champion && (
        <div className="bg-gradient-to-r from-yellow-400 to-amber-500 rounded-2xl p-4 mb-4 text-white shadow-lg">
          <p className="text-yellow-900 text-xs font-bold uppercase tracking-widest mb-1">🏆 Vô địch</p>
          <p className="text-xl sm:text-2xl font-bold">{participantName(champion.id)}</p>
        </div>
      )}

      {/* ── Round-robin view ── */}
      {isRoundRobin && (
        <RoundRobinView
          tournament={tournament}
          players={players}
          saving={saving}
          isLoggedIn={isLoggedIn}
          onMatchResult={handleMatchResult}
        />
      )}

      {/* ── Group-knockout view ── */}

      {/* Tab bar (group + knockout) */}
      {!isRoundRobin && status !== 'setup' && (
        <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('group')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'group' ? 'bg-white text-blue-800 shadow' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Vòng bảng
          </button>
          {hasKnockout && (
            <button
              onClick={() => setActiveTab('knockout')}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'knockout' ? 'bg-white text-blue-800 shadow' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Knockout
              {status === 'knockout' && <span className="ml-1.5 inline-block w-2 h-2 bg-orange-500 rounded-full" />}
            </button>
          )}
        </div>
      )}

      {/* Setup info */}
      {!isRoundRobin && status === 'setup' && (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-gray-800 mb-3">{g.name}</h3>
              <div className="space-y-2">
                {g.participantIds.map((pid) => {
                  const p = participants.find((x) => x.id === pid);
                  const pl = p && players.find((x) => x.id === p.playerIds[0]);
                  return (
                    <div key={pid} className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                      {participantName(pid)}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="bg-blue-50 rounded-2xl border border-blue-100 p-5">
            <h3 className="font-bold text-blue-800 mb-3">Cấu hình giải</h3>
            <div className="space-y-1 text-sm text-blue-700">
              <p>Hình thức: <strong>{tournament.type === 'singles' ? 'Đánh đơn' : 'Đánh đôi'}</strong></p>
              <p>Vượt qua vòng bảng: <strong>Top {format.advancePerGroup}</strong> mỗi bảng</p>
              <p>Trận tranh hạng 3: <strong>{format.hasThirdPlace ? 'Có' : 'Không'}</strong></p>
              <p>Tổng đội vào knockout: <strong>{groups.length * format.advancePerGroup}</strong></p>
            </div>
          </div>
        </div>
      )}

      {/* Group stage */}
      {!isRoundRobin && status !== 'setup' && activeTab === 'group' && (
        <GroupStage
          groups={groups}
          participants={participants}
          players={players}
          matches={matches.filter((m) => m.stage === 'group')}
          onMatchClick={setEditingMatch}
        />
      )}

      {/* Progress bar for group stage */}
      {!isRoundRobin && status === 'group_stage' && activeTab === 'group' && (
        <div className="mt-4 bg-white rounded-xl border border-gray-100 p-4">
          {groupComplete ? (
            <div className="flex items-center justify-between">
              <p className="text-green-600 font-semibold text-sm">✅ Vòng bảng hoàn tất!</p>
              {!hasKnockout && (
                <button onClick={generateKnockout} className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-700">
                  ⚡ Tạo nhánh Knockout
                </button>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-gray-500 text-xs">Tiến độ vòng bảng</p>
                <p className="text-gray-500 text-xs">
                  {matches.filter((m) => m.stage === 'group' && m.played).length}/
                  {matches.filter((m) => m.stage === 'group').length} trận
                </p>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{
                    width: `${matches.filter((m) => m.stage === 'group').length
                      ? (matches.filter((m) => m.stage === 'group' && m.played).length /
                         matches.filter((m) => m.stage === 'group').length) * 100
                      : 0}%`
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Knockout bracket */}
      {!isRoundRobin && activeTab === 'knockout' && hasKnockout && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-amber-500 px-5 py-3">
            <h3 className="font-bold text-white">Nhánh Knockout</h3>
          </div>
          <KnockoutBracket
            matches={koMatches}
            participants={participants}
            players={players}
            onMatchClick={setEditingMatch}
          />
        </div>
      )}

      {/* Match entry modal (group-knockout only) */}
      {!isRoundRobin && editingMatch && (
        <MatchEntryModal
          match={editingMatch}
          participants={participants}
          players={players}
          onSave={handleMatchResult}
          onClose={() => setEditingMatch(null)}
        />
      )}
    </div>
  );
}
