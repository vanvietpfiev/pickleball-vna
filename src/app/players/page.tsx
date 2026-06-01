'use client';
import { useEffect, useRef, useState } from 'react';
import { Player, PlayerLevel } from '@/lib/types';
import { compressImage } from '@/lib/imageUtils';
import Avatar from '@/components/Avatar';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';

const LEVELS: { value: PlayerLevel; label: string; color: string }[] = [
  { value: 'A', label: 'A', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'B', label: 'B', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'C', label: 'C', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: '',  label: '–', color: 'bg-gray-100 text-gray-400 border-gray-200' },
];

function LevelBadge({ level }: { level?: PlayerLevel }) {
  const l = LEVELS.find((x) => x.value === (level ?? '')) ?? LEVELS[3];
  if (!level) return null;
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black border ${l.color}`}>
      {l.label}
    </span>
  );
}

export default function PlayersPage() {
  const { isLoggedIn } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [initialElo, setInitialElo] = useState('1200');
  const [level, setLevel] = useState<PlayerLevel>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editingAvatar, setEditingAvatar] = useState<string | null>(null);
  const [editingLevel, setEditingLevel] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const editFileRef = useRef<HTMLInputElement>(null);

  const load = () =>
    fetch('/api/players').then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setPlayers(d.sort((a: Player, b: Player) => b.elo - a.elo));
      setLoading(false);
    });

  useEffect(() => { load(); }, []);

  const handleAvatarFile = async (file: File, onDone: (data: string) => void) => {
    const compressed = await compressImage(file);
    onDone(compressed);
  };

  const addPlayer = async () => {
    if (!name.trim()) return;
    setSubmitting(true); setError('');
    const res = await fetch('/api/players', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), avatar: avatarPreview, initialElo: Number(initialElo) || 1200, level }),
    });
    const data = await res.json();
    if (res.ok) {
      setName(''); setAvatarPreview(''); setInitialElo('1200'); setLevel('');
      setPlayers((prev) => [...prev, data].sort((a, b) => b.elo - a.elo));
    } else setError(data.error || 'Lỗi');
    setSubmitting(false);
  };

  const updateAvatar = async (playerId: string, avatar: string) => {
    const res = await fetch('/api/players', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: playerId, avatar }),
    });
    if (res.ok) setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, avatar } : p)));
    setEditingAvatar(null);
  };

  const updateLevel = async (playerId: string, newLevel: PlayerLevel) => {
    setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, level: newLevel } : p)));
    setEditingLevel(null);
    await fetch('/api/players', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: playerId, level: newLevel }),
    });
  };

  const maxElo = players.length ? players[0].elo : 1200;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="gradient-navy rounded-3xl px-6 pt-7 pb-8 mb-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="relative flex items-end justify-between">
          <div>
            <p className="text-blue-200 text-sm font-semibold uppercase tracking-widest mb-1">Đội Pickleball</p>
            <h1 className="text-3xl font-black">Thành viên</h1>
            <p className="text-blue-200 text-sm mt-1">{players.length} thành viên</p>
          </div>
          <div className="text-5xl opacity-20">👤</div>
        </div>
      </div>

      {/* Add form */}
      {!isLoggedIn && (
        <div className="card px-5 py-3 mb-8 flex items-center gap-3 text-sm text-slate-500 border-dashed">
          <span>🔒</span>
          <span>Bạn đang xem ở chế độ khách. <Link href="/login" className="text-blue-600 font-semibold hover:underline">Đăng nhập</Link> để thêm hoặc chỉnh sửa.</span>
        </div>
      )}
      {isLoggedIn && <div className="card p-5 mb-8">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Thêm thành viên mới</h2>
        <div className="flex gap-4 items-end flex-wrap">
          {/* Avatar */}
          <button type="button" onClick={() => fileRef.current?.click()} className="relative group flex-shrink-0">
            {avatarPreview
              ? <img src={avatarPreview} alt="preview" className="w-14 h-14 rounded-2xl object-cover border-2 border-blue-300" />
              : <div className="w-14 h-14 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-blue-400 hover:bg-blue-50 transition-all"><span className="text-xl">+</span></div>
            }
            <span className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center shadow-sm">📷</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarFile(f, setAvatarPreview); e.target.value = ''; }} />

          {/* Name */}
          <div className="flex-1 min-w-36">
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">Họ và tên *</label>
            <input className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="VD: Nguyễn Văn A"
              value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPlayer()} />
          </div>

          {/* Initial ELO */}
          <div className="w-28">
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">ELO ban đầu</label>
            <input type="number" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={initialElo} onChange={(e) => setInitialElo(e.target.value)} />
          </div>

          {/* Level */}
          <div className="w-28">
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">Trình độ</label>
            <select className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              value={level} onChange={(e) => setLevel(e.target.value as PlayerLevel)}>
              <option value="">Chưa xác định</option>
              <option value="A">A – Cao</option>
              <option value="B">B – Trung</option>
              <option value="C">C – Mới</option>
            </select>
          </div>

          <button onClick={addPlayer} disabled={submitting || !name.trim()}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-40 flex-shrink-0">
            {submitting ? '...' : '+ Thêm'}
          </button>
        </div>
        {error && <p className="text-red-500 text-sm mt-3">⚠️ {error}</p>}
      </div>}

      <input ref={editFileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f && editingAvatar) handleAvatarFile(f, (d) => updateAvatar(editingAvatar, d)); e.target.value = ''; }} />

      {/* Player grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="card p-4 flex flex-col items-center gap-3 animate-pulse">
              <div className="w-16 h-16 bg-slate-100 rounded-full" />
              <div className="h-3 w-20 bg-slate-100 rounded-full" />
              <div className="h-3 w-12 bg-slate-100 rounded-full" />
            </div>
          ))}
        </div>
      ) : players.length === 0 ? (
        <div className="card p-16 text-center text-slate-400">
          <p className="text-4xl mb-3">👤</p>
          <p className="font-medium">Chưa có thành viên nào</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {players.map((p, i) => {
            const winRate = p.matches > 0 ? Math.round((p.wins / p.matches) * 100) : null;
            const eloPct = Math.round((p.elo / Math.max(maxElo, 1)) * 100);
            const eloChange = p.initialElo ? p.elo - p.initialElo : 0;
            const rankColors = ['gradient-gold text-white', 'gradient-silver text-white', 'gradient-bronze text-white'];

            return (
              <div key={p.id} className="card card-hover p-4 flex flex-col items-center gap-3 animate-slide-up group relative"
                style={{ animationDelay: `${i * 40}ms` }}>
                {/* Rank */}
                <span className={`absolute top-3 left-3 w-5 h-5 rounded-full flex items-center justify-center text-xs font-black ${i < 3 ? rankColors[i] : 'bg-slate-100 text-slate-400'}`}>{i + 1}</span>

                {/* Level badge — click to change */}
                <div className="absolute top-3 right-3">
                  {isLoggedIn && editingLevel === p.id ? (
                    <div className="flex gap-1 bg-white shadow-lg rounded-xl p-1 border border-slate-100 z-10">
                      {LEVELS.map((lv) => (
                        <button key={lv.value} onClick={() => updateLevel(p.id, lv.value)}
                          className={`w-6 h-6 rounded-lg text-xs font-black border transition-all hover:scale-110 ${lv.color}`}>
                          {lv.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button onClick={() => isLoggedIn && setEditingLevel(p.id)} title={isLoggedIn ? 'Đổi trình độ' : undefined}
                      className="opacity-70 hover:opacity-100 transition-opacity">
                      {p.level
                        ? <LevelBadge level={p.level} />
                        : <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-300 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">+</span>
                      }
                    </button>
                  )}
                </div>

                {/* Avatar */}
                <div className="relative mt-2">
                  <button onClick={() => isLoggedIn && (setEditingAvatar(p.id), editFileRef.current?.click())} disabled={!isLoggedIn}>
                    <Avatar src={p.avatar} name={p.name} size={56} className="hover:opacity-80 transition-opacity" />
                    <span className="absolute inset-0 rounded-full bg-black/0 hover:bg-black/10 transition-colors flex items-end justify-center pb-0.5 opacity-0 group-hover:opacity-100">
                      <span className="text-white text-xs bg-black/40 rounded-full px-1">📷</span>
                    </span>
                  </button>
                  {i === 0 && <span className="absolute -top-1 -right-1 text-base">👑</span>}
                </div>

                {/* Name */}
                <p className="font-bold text-slate-800 text-sm leading-tight truncate w-full text-center">{p.name}</p>

                {/* ELO block */}
                <div className="w-full bg-slate-50 rounded-xl px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <p className="text-lg font-black text-blue-700">{p.elo}</p>
                    {eloChange !== 0 && (
                      <span className={`text-xs font-bold ${eloChange > 0 ? 'text-green-500' : 'text-red-400'}`}>
                        {eloChange > 0 ? `+${eloChange}` : eloChange}
                      </span>
                    )}
                  </div>
                  <div className="h-1 bg-slate-200 rounded-full mt-1 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-700" style={{ width: `${eloPct}%` }} />
                  </div>
                  {p.initialElo && p.initialElo !== 1200 && (
                    <p className="text-xs text-slate-400 mt-0.5">Ban đầu: {p.initialElo}</p>
                  )}
                </div>

                {/* Stats */}
                <div className="flex gap-3 w-full text-xs text-center">
                  <div className="flex-1"><p className="font-bold text-slate-700">{p.matches}</p><p className="text-slate-400">Trận</p></div>
                  <div className="flex-1"><p className="font-bold text-green-600">{p.wins}</p><p className="text-slate-400">Thắng</p></div>
                  <div className="flex-1">
                    <p className={`font-bold ${winRate !== null && winRate >= 60 ? 'text-green-600' : winRate !== null && winRate < 40 ? 'text-red-400' : 'text-slate-500'}`}>
                      {winRate !== null ? `${winRate}%` : '–'}
                    </p>
                    <p className="text-slate-400">Tỷ lệ</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
