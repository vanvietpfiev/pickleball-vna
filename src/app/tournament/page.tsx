'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Tournament, TParticipant, TGroup, TournamentFormat, Player } from '@/lib/types';
import { optimalPairing } from '@/lib/tournamentUtils';
import Avatar from '@/components/Avatar';
import { useAuth } from '@/components/AuthProvider';

const STATUS_CONFIG = {
  setup:       { label: 'Chuẩn bị',   color: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400' },
  group_stage: { label: 'Vòng bảng',  color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
  knockout:    { label: 'Knockout',    color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  finished:    { label: 'Kết thúc',   color: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
} as const;

export default function TournamentListPage() {
  const { isLoggedIn } = useAuth();
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'ongoing' | 'finished'>('all');

  // ── Wizard state ─────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [tName, setTName] = useState('');
  const [tType, setTType] = useState<'singles' | 'doubles'>('doubles');
  const [groupCount, setGroupCount] = useState(2);
  const [advancePerGroup, setAdvancePerGroup] = useState(2);
  const [hasThirdPlace, setHasThirdPlace] = useState(true);
  const [creating, setCreating] = useState(false);

  // Step 2: smart pairing
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [fixedPairs, setFixedPairs] = useState<{ a: string; b: string }[]>([]);
  const [lockMode, setLockMode] = useState(false);       // "fixing a pair" mode
  const [lockFirst, setLockFirst] = useState<string | null>(null);
  const [autoPairs, setAutoPairs] = useState<{ a: string; b: string }[] | null>(null);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});

  // Step 3: group assign
  const [participants, setParticipants] = useState<TParticipant[]>([]);
  const [groupAssign, setGroupAssign] = useState<Record<string, number>>({});

  useEffect(() => {
    Promise.all([
      fetch('/api/tournament').then((r) => r.json()),
      fetch('/api/players').then((r) => r.json()),
    ]).then(([t, p]) => {
      if (Array.isArray(t)) setTournaments(t);
      if (Array.isArray(p)) setPlayers(p.sort((a: Player, b: Player) => b.elo - a.elo));
      setLoading(false);
    });
  }, []);

  const resetCreate = () => {
    setStep(1); setTName(''); setTType('doubles');
    setGroupCount(2); setAdvancePerGroup(2); setHasThirdPlace(true);
    setSelectedIds([]); setFixedPairs([]); setLockMode(false); setLockFirst(null);
    setAutoPairs(null); setTeamNames({});
    setParticipants([]); setGroupAssign({});
  };

  // ── Step 2 helpers ───────────────────────────────────────────────
  const fixedIds = useMemo(() => new Set(fixedPairs.flatMap((p) => [p.a, p.b])), [fixedPairs]);
  const lockedInSelection = useMemo(() => selectedIds.filter((id) => fixedIds.has(id)), [selectedIds, fixedIds]);

  const toggleSelect = (id: string) => {
    if (fixedIds.has(id)) return; // can't deselect if in a fixed pair
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setAutoPairs(null);
  };

  const handleLockClick = (id: string) => {
    if (!selectedIds.includes(id)) return;
    if (!lockMode) return;
    if (fixedIds.has(id)) {
      // Remove this person's fixed pair
      setFixedPairs((prev) => prev.filter((p) => p.a !== id && p.b !== id));
      setAutoPairs(null);
      return;
    }
    if (!lockFirst) {
      setLockFirst(id);
    } else if (lockFirst === id) {
      setLockFirst(null);
    } else {
      setFixedPairs((prev) => [...prev, { a: lockFirst, b: id }]);
      setLockFirst(null);
      setAutoPairs(null);
    }
  };

  const runAutoPair = () => {
    const freePlayers = players
      .filter((p) => selectedIds.includes(p.id) && !fixedIds.has(p.id))
      .map((p) => ({ id: p.id, elo: p.elo }));
    const result = optimalPairing(freePlayers, fixedPairs);
    setAutoPairs(result.pairs.filter((p) => !fixedPairs.some((f) => f.a === p.a && f.b === p.b)));
  };

  const removeFixedPair = (idx: number) => {
    setFixedPairs((prev) => prev.filter((_, i) => i !== idx));
    setAutoPairs(null);
  };

  const removeAutoPair = (idx: number) => {
    setAutoPairs((prev) => (prev ? prev.filter((_, i) => i !== idx) : null));
  };

  const allPairs = useMemo(
    () => [...fixedPairs, ...(autoPairs ?? [])],
    [fixedPairs, autoPairs]
  );

  const pairingStats = useMemo(() => {
    if (!allPairs.length) return null;
    const eloMap: Record<string, number> = {};
    players.forEach((p) => (eloMap[p.id] = p.elo));
    const totals = allPairs.map((p) => (eloMap[p.a] ?? 0) + (eloMap[p.b] ?? 0));
    const avg = totals.reduce((s, t) => s + t, 0) / totals.length;
    const spread = Math.max(...totals) - Math.min(...totals);
    return { totals, avg, spread };
  }, [allPairs, players]);

  const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? id;
  const playerElo = (id: string) => players.find((p) => p.id === id)?.elo ?? 0;
  const playerAvatar = (id: string) => { const p = players.find((x) => x.id === id); return p ? { src: p.avatar, name: p.name } : null; };

  // Free players not yet in any pair
  const unpairedFreeIds = selectedIds.filter((id) => !fixedIds.has(id) && !(autoPairs ?? []).some((p) => p.a === id || p.b === id));

  // ── Step 2 → 3: build participants from pairs ────────────────────
  const goToStep3 = () => {
    if (tType === 'singles') {
      const parts: TParticipant[] = selectedIds.map((id) => ({
        id: `tp_${Date.now()}_${id}`,
        playerIds: [id],
      }));
      setParticipants(parts);
    } else {
      const parts: TParticipant[] = allPairs.map((pair, i) => ({
        id: `tp_${Date.now()}_${i}`,
        playerIds: [pair.a, pair.b],
        name: teamNames[`${pair.a}_${pair.b}`] || teamNames[`${pair.b}_${pair.a}`] || undefined,
      }));
      setParticipants(parts);
    }
    setGroupAssign({});
    setStep(3);
  };

  const autoAssign = () => {
    const newAssign: Record<string, number> = {};
    participants.forEach((p, i) => { newAssign[p.id] = i % groupCount; });
    setGroupAssign(newAssign);
  };

  const participantLabel = (p: TParticipant) => {
    if (p.name) return p.name;
    return p.playerIds.map((id) => players.find((x) => x.id === id)?.name ?? id).join(' & ');
  };

  // ── Create tournament ────────────────────────────────────────────
  const createTournament = async () => {
    if (!tName.trim() || participants.length < 2) return;
    setCreating(true);

    const groups: TGroup[] = Array.from({ length: groupCount }, (_, i) => ({
      name: `Bảng ${String.fromCharCode(65 + i)}`,
      participantIds: participants.filter((p) => groupAssign[p.id] === i).map((p) => p.id),
    })).filter((g) => g.participantIds.length > 0);

    const format: TournamentFormat = { advancePerGroup, hasThirdPlace };

    const res = await fetch('/api/tournament', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: tName, type: tType,
        participants, groups, format,
        matches: [], status: 'setup',
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setTournaments((prev) => [data, ...prev]);
      setShowCreate(false);
      resetCreate();
      router.push(`/tournament/${data.id}`);
    }
    setCreating(false);
  };

  const filteredTournaments = tournaments.filter((t) => {
    if (filter === 'upcoming') return t.status === 'setup';
    if (filter === 'ongoing') return t.status === 'group_stage' || t.status === 'knockout';
    if (filter === 'finished') return t.status === 'finished';
    return true;
  });

  const totalAdvancing = groupCount * advancePerGroup;
  const canAutoPair = unpairedFreeIds.length >= 2 && unpairedFreeIds.length % 2 === 0;
  const step2Ready = tType === 'singles'
    ? selectedIds.length >= 2
    : allPairs.length >= 2 && unpairedFreeIds.length === 0;

  // ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">Giải đấu</h1>
          <p className="text-gray-500 text-sm mt-0.5">Quản lý các giải đấu pickleball</p>
        </div>
        {isLoggedIn ? (
          <button
            onClick={() => { setShowCreate(!showCreate); if (showCreate) resetCreate(); }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              showCreate ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-blue-700 text-white hover:bg-blue-800 shadow-sm'
            }`}
          >
            {showCreate ? 'Hủy' : '+ Tạo giải mới'}
          </button>
        ) : (
          <Link href="/login" className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 text-slate-500 border border-dashed border-slate-300">
            🔒 Đăng nhập để tạo giải
          </Link>
        )}
      </div>

      {/* ── Creation wizard ──────────────────────────────────────── */}
      {showCreate && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8 overflow-hidden">
          {/* Progress bar */}
          <div className="bg-gradient-to-r from-blue-900 to-blue-700 px-6 py-4">
            <div className="flex items-center gap-3">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    step === s ? 'bg-white text-blue-800 border-white' :
                    step > s ? 'bg-blue-500 text-white border-blue-500' : 'border-blue-400 text-blue-300'
                  }`}>{step > s ? '✓' : s}</div>
                  <span className={`text-xs font-medium hidden sm:block ${step >= s ? 'text-white' : 'text-blue-400'}`}>
                    {s === 1 ? 'Thông tin' : s === 2 ? 'Người chơi & Cặp đôi' : 'Phân bảng'}
                  </span>
                  {s < 3 && <div className={`w-8 h-px ${step > s ? 'bg-blue-400' : 'bg-blue-700'}`} />}
                </div>
              ))}
            </div>
          </div>

          <div className="p-6">

            {/* ── STEP 1 ─────────────────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5">Tên giải đấu *</label>
                  <input
                    className="border rounded-xl px-4 py-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="VD: Giải Pickleball Ban KT tháng 6/2025"
                    value={tName} onChange={(e) => setTName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && tName.trim() && setStep(2)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-1.5">Hình thức</label>
                    <div className="flex gap-2">
                      {(['doubles', 'singles'] as const).map((t) => (
                        <button key={t} onClick={() => { setTType(t); setSelectedIds([]); setFixedPairs([]); setAutoPairs(null); }}
                          className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                            tType === t ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}>
                          {t === 'doubles' ? '👥 Đánh đôi' : '👤 Đánh đơn'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-1.5">Số bảng</label>
                    <select className="border rounded-xl px-3 py-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      value={groupCount} onChange={(e) => setGroupCount(Number(e.target.value))}>
                      {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} bảng</option>)}
                    </select>
                  </div>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <p className="text-sm font-semibold text-blue-800 mb-3">Quy tắc knockout</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-blue-700 block mb-1">Vượt qua vòng bảng</label>
                      <select className="border border-blue-200 rounded-lg px-3 py-2 w-full text-sm bg-white focus:outline-none"
                        value={advancePerGroup} onChange={(e) => setAdvancePerGroup(Number(e.target.value))}>
                        <option value={1}>Top 1 mỗi bảng</option>
                        <option value={2}>Top 2 mỗi bảng</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={hasThirdPlace} onChange={(e) => setHasThirdPlace(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                        <span className="text-sm text-blue-700 font-medium">Tranh hạng 3</span>
                      </label>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-blue-600 bg-white rounded-lg px-3 py-2 border border-blue-100">
                    → {groupCount} bảng × top {advancePerGroup} = <strong>{totalAdvancing} đội</strong> vào knockout
                    {totalAdvancing === 2 && ' → Thẳng chung kết'}
                    {totalAdvancing === 4 && ' → Bán kết + Chung kết'}
                    {totalAdvancing === 8 && ' → Tứ kết + Bán kết + Chung kết'}
                  </div>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => setStep(2)} disabled={!tName.trim()}
                    className="bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-800 disabled:opacity-40">
                    Tiếp theo →
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 2: Smart pairing ─────────────────────────── */}
            {step === 2 && (
              <div className="space-y-5">

                {/* Player selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-700">
                      Chọn người tham gia
                      <span className="ml-2 text-blue-600 font-bold">{selectedIds.length}</span>
                      <span className="text-gray-400 font-normal"> / {players.length}</span>
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => { setSelectedIds(players.map((p) => p.id)); setAutoPairs(null); }}
                        className="text-xs text-blue-600 border border-blue-200 px-2.5 py-1 rounded-full hover:bg-blue-50">Chọn tất cả</button>
                      <button onClick={() => { setSelectedIds([]); setFixedPairs([]); setAutoPairs(null); }}
                        className="text-xs text-gray-500 border border-gray-200 px-2.5 py-1 rounded-full hover:bg-gray-50">Bỏ chọn</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {players.map((pl) => {
                      const sel = selectedIds.includes(pl.id);
                      const inFixed = fixedIds.has(pl.id);
                      const isPending = lockFirst === pl.id;
                      return (
                        <button key={pl.id}
                          onClick={() => lockMode ? handleLockClick(pl.id) : toggleSelect(pl.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                            inFixed ? 'bg-amber-50 border-amber-300 text-amber-800' :
                            isPending ? 'bg-blue-600 border-blue-600 text-white ring-2 ring-blue-300' :
                            sel ? 'bg-blue-50 border-blue-400 text-blue-800' :
                            'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          <Avatar src={pl.avatar} name={pl.name} size={24} />
                          <span>{pl.name}</span>
                          <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                            sel ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
                          }`}>{pl.elo}</span>
                          {inFixed && <span className="text-amber-500 text-xs">🔒</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Doubles-only: pairing controls */}
                {tType === 'doubles' && selectedIds.length >= 2 && (
                  <div className="border border-gray-100 rounded-2xl overflow-hidden">
                    {/* Controls bar */}
                    <div className="bg-gray-50 px-4 py-3 flex items-center gap-3 flex-wrap border-b border-gray-100">
                      <button
                        onClick={() => { setLockMode(!lockMode); setLockFirst(null); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          lockMode ? 'bg-amber-500 text-white border-amber-500' : 'bg-white border-gray-200 text-gray-600 hover:border-amber-400 hover:text-amber-600'
                        }`}
                      >
                        🔒 {lockMode ? (lockFirst ? 'Chọn người thứ 2…' : 'Đang khoá — click người') : 'Khoá cặp cố định'}
                      </button>

                      <button
                        onClick={runAutoPair}
                        disabled={unpairedFreeIds.length < 2}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          canAutoPair
                            ? 'bg-blue-700 text-white border-blue-700 hover:bg-blue-800'
                            : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        }`}
                      >
                        ⚡ Tự động ghép cặp tối ưu ELO
                        {unpairedFreeIds.length >= 2 && ` (${unpairedFreeIds.length} người)`}
                      </button>

                      {unpairedFreeIds.length > 0 && unpairedFreeIds.length % 2 !== 0 && (
                        <span className="text-xs text-orange-500">⚠ {unpairedFreeIds.length} người chưa ghép — cần số chẵn</span>
                      )}
                    </div>

                    {/* Fixed pairs */}
                    {fixedPairs.length > 0 && (
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">🔒 Cặp khoá cố định</p>
                        <div className="space-y-2">
                          {fixedPairs.map((pair, i) => {
                            const total = playerElo(pair.a) + playerElo(pair.b);
                            return (
                              <div key={i} className="flex items-center gap-3 bg-amber-50 rounded-xl px-3 py-2.5 border border-amber-100">
                                <div className="flex -space-x-1">
                                  {[pair.a, pair.b].map((id) => { const av = playerAvatar(id); return av ? <Avatar key={id} src={av.src} name={av.name} size={28} className="ring-2 ring-white" /> : null; })}
                                </div>
                                <span className="flex-1 text-sm font-semibold text-amber-900">
                                  {playerName(pair.a)} & {playerName(pair.b)}
                                </span>
                                <span className="text-xs font-mono bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Σ {total}</span>
                                <input placeholder="Tên đội" className="text-xs border border-amber-200 rounded-lg px-2 py-1 w-28 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                                  value={teamNames[`${pair.a}_${pair.b}`] || ''}
                                  onChange={(e) => setTeamNames((p) => ({ ...p, [`${pair.a}_${pair.b}`]: e.target.value }))} />
                                <button onClick={() => removeFixedPair(i)} className="text-amber-400 hover:text-red-500 text-lg leading-none">×</button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Auto pairs */}
                    {autoPairs && autoPairs.length > 0 && (
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">⚡ Cặp tự động (tối ưu ELO)</p>
                        <div className="space-y-2">
                          {autoPairs.map((pair, i) => {
                            const total = playerElo(pair.a) + playerElo(pair.b);
                            const avg = pairingStats?.avg ?? total;
                            const diff = Math.abs(total - avg);
                            const balanced = diff <= 30;
                            return (
                              <div key={i} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-gray-100 hover:border-blue-200 transition-colors">
                                <div className="flex -space-x-1">
                                  {[pair.a, pair.b].map((id) => { const av = playerAvatar(id); return av ? <Avatar key={id} src={av.src} name={av.name} size={28} className="ring-2 ring-white" /> : null; })}
                                </div>
                                <span className="flex-1 text-sm font-semibold text-gray-800">
                                  {playerName(pair.a)} & {playerName(pair.b)}
                                </span>
                                <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${balanced ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                  Σ {total}
                                </span>
                                <input placeholder="Tên đội" className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-28 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                  value={teamNames[`${pair.a}_${pair.b}`] || ''}
                                  onChange={(e) => setTeamNames((p) => ({ ...p, [`${pair.a}_${pair.b}`]: e.target.value }))} />
                                <button onClick={() => removeAutoPair(i)} className="text-gray-300 hover:text-red-500 text-lg leading-none">×</button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ELO balance indicator */}
                    {pairingStats && allPairs.length >= 2 && (
                      <div className="px-4 py-3 bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-gray-500">Độ cân bằng ELO các đội</p>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            pairingStats.spread <= 30 ? 'bg-green-100 text-green-700' :
                            pairingStats.spread <= 80 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {pairingStats.spread <= 30 ? '✅ Rất cân bằng' : pairingStats.spread <= 80 ? '⚠️ Tương đối' : '❌ Chênh lệch'}
                            {' · '}spread {pairingStats.spread}
                          </span>
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          {pairingStats.totals.map((total, i) => {
                            const diff = total - pairingStats.avg;
                            const pct = Math.min(100, Math.round((total / (pairingStats.avg * 1.2)) * 100));
                            return (
                              <div key={i} className="flex-1 min-w-16">
                                <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                                  <span>Đội {i + 1}</span>
                                  <span className={diff > 0 ? 'text-blue-500' : diff < 0 ? 'text-red-400' : 'text-green-500'}>
                                    {diff > 0 ? `+${diff}` : diff}
                                  </span>
                                </div>
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                                <p className="text-xs font-bold text-center mt-0.5 text-gray-700">{total}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Unpaired free players */}
                    {unpairedFreeIds.length > 0 && (
                      <div className="px-4 py-3 border-t border-gray-100">
                        <p className="text-xs text-orange-500 font-medium mb-2">Chưa được ghép cặp:</p>
                        <div className="flex flex-wrap gap-2">
                          {unpairedFreeIds.map((id) => (
                            <span key={id} className="flex items-center gap-1 bg-orange-50 border border-orange-200 text-orange-700 text-xs px-2 py-1 rounded-lg font-medium">
                              {playerName(id)} ({playerElo(id)})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Singles: simple count */}
                {tType === 'singles' && (
                  <p className="text-sm text-gray-500">
                    {selectedIds.length} người đã chọn tham gia đánh đơn.
                  </p>
                )}

                <div className="flex justify-between">
                  <button onClick={() => setStep(1)} className="text-gray-500 px-4 py-2 rounded-xl text-sm hover:bg-gray-100">← Quay lại</button>
                  <button onClick={goToStep3} disabled={!step2Ready}
                    className="bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-800 disabled:opacity-40">
                    Tiếp theo →
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3: Assign groups ─────────────────────────── */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">
                    Phân bảng
                    <span className="ml-2 text-gray-400 font-normal">
                      ({participants.filter((p) => groupAssign[p.id] != null).length}/{participants.length} đã phân)
                    </span>
                  </p>
                  <button onClick={autoAssign} className="text-xs text-blue-600 border border-blue-200 px-3 py-1 rounded-full hover:bg-blue-50">
                    ⚡ Tự động
                  </button>
                </div>

                <div className="space-y-2">
                  {participants.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5">
                      <div className="flex -space-x-1 flex-shrink-0">
                        {p.playerIds.map((pid) => {
                          const av = playerAvatar(pid);
                          return av ? <Avatar key={pid} src={av.src} name={av.name} size={28} className="ring-2 ring-white" /> : null;
                        })}
                      </div>
                      <span className="flex-1 text-sm font-medium text-gray-700 truncate">{participantLabel(p)}</span>
                      <div className="flex gap-1 flex-shrink-0">
                        {Array.from({ length: groupCount }, (_, i) => (
                          <button key={i}
                            onClick={() => setGroupAssign((prev) => ({ ...prev, [p.id]: i }))}
                            className={`w-8 h-8 rounded-lg text-sm font-bold border-2 transition-all ${
                              groupAssign[p.id] === i
                                ? 'bg-blue-700 text-white border-blue-700'
                                : 'border-gray-200 text-gray-500 hover:border-blue-400 hover:text-blue-600'
                            }`}
                          >
                            {String.fromCharCode(65 + i)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${groupCount}, 1fr)` }}>
                  {Array.from({ length: groupCount }, (_, i) => {
                    const inGroup = participants.filter((p) => groupAssign[p.id] === i);
                    return (
                      <div key={i} className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                        <p className="text-xs font-bold text-blue-700 mb-2">Bảng {String.fromCharCode(65 + i)} ({inGroup.length})</p>
                        {inGroup.map((p) => <p key={p.id} className="text-xs text-blue-600 truncate">{participantLabel(p)}</p>)}
                        {inGroup.length === 0 && <p className="text-xs text-gray-300">Chưa có</p>}
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between">
                  <button onClick={() => setStep(2)} className="text-gray-500 px-4 py-2 rounded-xl text-sm hover:bg-gray-100">← Quay lại</button>
                  <button
                    onClick={createTournament}
                    disabled={creating || participants.some((p) => groupAssign[p.id] == null)}
                    className="bg-green-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-40"
                  >
                    {creating ? 'Đang tạo...' : '🏆 Tạo giải đấu'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Filter tabs ─────────────────────────────────────────── */}
      {!showCreate && (
        <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
          {([
            { key: 'all',      label: 'Tất cả',         count: tournaments.length },
            { key: 'upcoming', label: 'Sắp diễn ra',    count: tournaments.filter(t => t.status === 'setup').length },
            { key: 'ongoing',  label: 'Đang diễn ra',   count: tournaments.filter(t => t.status === 'group_stage' || t.status === 'knockout').length },
            { key: 'finished', label: 'Đã kết thúc',    count: tournaments.filter(t => t.status === 'finished').length },
          ] as const).map(({ key, label, count }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
                filter === key ? 'bg-white text-blue-800 shadow' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {label}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  filter === key ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'
                }`}>{count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Tournament list ──────────────────────────────────────── */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-40 animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : filteredTournaments.length === 0 && !showCreate ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🏆</p>
          <p className="font-medium">{filter === 'all' ? 'Chưa có giải đấu nào' : 'Không có giải đấu nào trong mục này'}</p>
          {filter === 'all' && <p className="text-sm mt-1">Nhấn "Tạo giải mới" để bắt đầu</p>}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTournaments.map((t) => {
            const sc = STATUS_CONFIG[t.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.setup;
            const parts = t.config?.participants ?? [];
            const groups = t.config?.groups ?? [];
            const matchesPlayed = t.matches?.filter((m) => m.played).length ?? 0;
            const matchesTotal = t.matches?.length ?? 0;

            return (
              <button key={t.id} onClick={() => router.push(`/tournament/${t.id}`)}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all text-left overflow-hidden group">
                <div className="bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-4 group-hover:from-blue-800">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-white text-base leading-tight">{t.name}</h3>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${sc.color}`}>{sc.label}</span>
                  </div>
                  <p className="text-blue-300 text-xs mt-1">
                    {t.type === 'singles' ? 'Đánh đơn' : 'Đánh đôi'} · {new Date(t.date).toLocaleDateString('vi-VN')}
                  </p>
                </div>
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span>{parts.length} {t.type === 'doubles' ? 'cặp' : 'người'} · {groups.length} bảng</span>
                    {matchesTotal > 0 && <span>{matchesPlayed}/{matchesTotal} trận</span>}
                  </div>
                  {matchesTotal > 0 && (
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(matchesPlayed / matchesTotal) * 100}%` }} />
                    </div>
                  )}
                  {parts.length > 0 && (
                    <div className="flex items-center -space-x-1">
                      {parts.slice(0, 6).map((p) => {
                        const pl = players.find((x) => x.id === p.playerIds[0]);
                        return pl ? <Avatar key={p.id} src={pl.avatar} name={pl.name} size={24} className="ring-2 ring-white" /> : null;
                      })}
                      {parts.length > 6 && (
                        <div className="w-6 h-6 rounded-full bg-gray-200 ring-2 ring-white flex items-center justify-center text-xs text-gray-500 font-bold">
                          +{parts.length - 6}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
