'use client';
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Tournament, TMatch, Player, TSet } from '@/lib/types';
import GroupStage from '@/components/tournament/GroupStage';
import KnockoutBracket from '@/components/tournament/KnockoutBracket';
import MatchEntryModal from '@/components/tournament/MatchEntryModal';
import { generateGroupMatches, generateKnockoutMatches, propagateKOResult, isGroupStageComplete } from '@/lib/tournamentUtils';

export default function TournamentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
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
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => router.push('/tournament')} className="text-blue-600 text-sm hover:underline mb-3 flex items-center gap-1">
          ← Danh sách giải đấu
        </button>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">{tournament.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${sc.color}`}>{sc.label}</span>
              <span className="text-xs text-gray-400">
                {tournament.type === 'singles' ? 'Đánh đơn' : 'Đánh đôi'} ·{' '}
                {new Date(tournament.date).toLocaleDateString('vi-VN')} ·{' '}
                {participants.length} người · {groups.length} bảng
              </span>
            </div>
          </div>

          {saving && <span className="text-xs text-blue-500 animate-pulse">Đang lưu...</span>}

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            {status === 'setup' && (
              <button onClick={startGroupStage} className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-800">
                🚀 Bắt đầu vòng bảng
              </button>
            )}
            {status === 'group_stage' && groupComplete && !hasKnockout && (
              <button onClick={generateKnockout} className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-700">
                ⚡ Tạo nhánh Knockout
              </button>
            )}
            {/* Manual finish — available anytime after setup */}
            {status !== 'setup' && status !== 'finished' && (
              confirmFinish ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-300 rounded-lg px-3 py-1.5">
                  <span className="text-xs text-green-700 font-medium">Kết thúc giải?</span>
                  <button onClick={() => { finishTournament(); setConfirmFinish(false); }} className="bg-green-600 text-white px-2.5 py-1 rounded text-xs font-bold hover:bg-green-700">Xác nhận</button>
                  <button onClick={() => setConfirmFinish(false)} className="text-gray-500 text-xs hover:text-gray-700 px-1">Hủy</button>
                </div>
              ) : (
                <button onClick={() => setConfirmFinish(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700">
                  🏁 Kết thúc giải
                </button>
              )
            )}
            {/* Delete */}
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} className="border border-red-200 text-red-400 px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-50">
                🗑
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-red-50 border border-red-300 rounded-lg px-3 py-1.5">
                <span className="text-xs text-red-600 font-medium">Xóa giải?</span>
                <button onClick={deleteTournament} className="bg-red-600 text-white px-2.5 py-1 rounded text-xs font-bold hover:bg-red-700">Xóa</button>
                <button onClick={() => setConfirmDelete(false)} className="text-gray-500 text-xs hover:text-gray-700 px-1">Hủy</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Champion banner */}
      {champion && (
        <div className="bg-gradient-to-r from-yellow-400 to-amber-500 rounded-2xl p-5 mb-6 text-white shadow-lg">
          <p className="text-yellow-900 text-xs font-bold uppercase tracking-widest mb-1">🏆 Vô địch</p>
          <p className="text-2xl font-bold">{participantName(champion.id)}</p>
        </div>
      )}

      {/* Tab bar (group + knockout) */}
      {status !== 'setup' && (
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
      {status === 'setup' && (
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
      {status !== 'setup' && activeTab === 'group' && (
        <GroupStage
          groups={groups}
          participants={participants}
          players={players}
          matches={matches.filter((m) => m.stage === 'group')}
          onMatchClick={setEditingMatch}
        />
      )}

      {/* Progress bar for group stage */}
      {status === 'group_stage' && activeTab === 'group' && (
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
      {activeTab === 'knockout' && hasKnockout && (
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

      {/* Match entry modal */}
      {editingMatch && (
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
