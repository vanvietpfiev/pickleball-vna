'use client';
import { useEffect, useState } from 'react';
import { Player, PlayerLevel } from '@/lib/types';

const levelColor: Record<string, string> = {
  A: 'bg-red-100 text-red-700',
  B: 'bg-orange-100 text-orange-700',
  C: 'bg-green-100 text-green-700',
};
import Avatar from '@/components/Avatar';

function EloBar({ elo, max }: { elo: number; max: number }) {
  const pct = Math.round((elo / Math.max(max, 1)) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-700"
          style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-bold text-blue-700 w-12 text-right">{elo}</span>
    </div>
  );
}

function PodiumCard({ player, rank, index }: { player: Player; rank: 1 | 2 | 3; index: number }) {
  const configs = {
    1: { grad: 'from-yellow-400 via-amber-400 to-orange-400', label: '🥇 Quán quân', size: 56, smSize: 72, textColor: 'text-yellow-700', bgLight: 'bg-yellow-50', border: 'border-yellow-200', order: 'order-2', mt: '' },
    2: { grad: 'from-slate-400 via-slate-300 to-slate-400', label: '🥈 Á quân', size: 44, smSize: 60, textColor: 'text-slate-600', bgLight: 'bg-slate-50', border: 'border-slate-200', order: 'order-1', mt: 'mt-4 sm:mt-6' },
    3: { grad: 'from-amber-700 via-amber-600 to-yellow-700', label: '🥉 Hạng ba', size: 44, smSize: 60, textColor: 'text-amber-800', bgLight: 'bg-amber-50', border: 'border-amber-200', order: 'order-3', mt: 'mt-4 sm:mt-6' },
  };
  const c = configs[rank];
  const winRate = player.matches > 0 ? Math.round((player.wins / player.matches) * 100) : 0;

  return (
    <div className={`flex flex-col items-center ${c.order} animate-slide-up flex-1 min-w-0`} style={{ animationDelay: `${index * 80}ms` }}>
      <div className={`${c.mt} card border ${c.border} p-2 sm:p-5 flex flex-col items-center gap-2 sm:gap-3 w-full text-center`}>
        <div className={`p-1 rounded-full bg-gradient-to-br ${c.grad}`}>
          <Avatar src={player.avatar} name={player.name} size={c.size} className="ring-2 ring-white" />
        </div>
        <div className="w-full">
          <p className={`text-[10px] sm:text-xs font-bold ${c.textColor} mb-0.5`}>{c.label}</p>
          <div className="flex items-center justify-center gap-1 flex-wrap">
            <p className="font-black text-slate-800 text-xs sm:text-sm leading-tight truncate">{player.name}</p>
            {player.level && (
              <span className={`text-[10px] font-black px-1 py-0.5 rounded-full flex-shrink-0 ${levelColor[player.level] ?? ''}`}>{player.level}</span>
            )}
          </div>
        </div>
        <div className={`w-full ${c.bgLight} rounded-xl px-2 py-1.5`}>
          <p className="text-xl sm:text-2xl font-black text-slate-800">{player.elo}</p>
          <p className="text-[10px] text-slate-500 font-medium">ELO</p>
        </div>
        <div className="flex gap-2 text-xs w-full justify-center">
          <div className="text-center">
            <p className="font-bold text-green-600">{player.wins}</p>
            <p className="text-slate-400 text-[10px]">Thắng</p>
          </div>
          <div className="w-px bg-slate-100" />
          <div className="text-center">
            <p className="font-bold text-slate-700">{winRate}%</p>
            <p className="text-slate-400 text-[10px]">Tỷ lệ</p>
          </div>
          <div className="w-px bg-slate-100" />
          <div className="text-center">
            <p className="font-bold text-red-400">{player.losses}</p>
            <p className="text-slate-400 text-[10px]">Thua</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/players')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPlayers(data.sort((a: Player, b: Player) => b.elo - a.elo));
        else if (data.error) setError(data.error);
        setLoading(false);
      })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, []);

  const maxElo = players.length ? players[0].elo : 1200;
  const top3 = players.slice(0, 3);
  const rest = players.slice(3);

  return (
    <div className="animate-fade-in">
      {/* Hero header */}
      <div className="gradient-navy rounded-3xl px-6 pt-8 pb-10 mb-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="relative">
          <p className="text-blue-200 text-sm font-semibold uppercase tracking-widest mb-1">Ban Kỹ Thuật · Vietnam Airlines</p>
          <h1 className="text-3xl font-black mb-1">Bảng xếp hạng ELO</h1>
          <p className="text-blue-200 text-sm">{players.length} thành viên đang thi đấu</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 mb-6 text-sm flex items-center gap-2">
          <span>⚠️</span> Lỗi kết nối: {error}
        </div>
      )}

      {/* Top 3 podium */}
      {loading ? (
        <div className="flex justify-center gap-2 sm:gap-4 mb-8">
          {[1, 0, 2].map((i) => (
            <div key={i} className={`flex-1 max-w-36 h-56 card animate-pulse ${i === 0 ? '' : 'mt-4 sm:mt-6'}`} />
          ))}
        </div>
      ) : top3.length >= 2 && (
        <div className="flex justify-center gap-2 sm:gap-4 mb-8 max-w-sm sm:max-w-none mx-auto">
          {top3.length >= 2 && <PodiumCard player={top3[1]} rank={2} index={1} />}
          {top3.length >= 1 && <PodiumCard player={top3[0]} rank={1} index={0} />}
          {top3.length >= 3 && <PodiumCard player={top3[2]} rank={3} index={2} />}
        </div>
      )}

      {/* Rank 4+ table */}
      {(loading || rest.length > 0) && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-600 uppercase tracking-wider">Bảng xếp hạng đầy đủ</p>
            <p className="text-xs text-slate-400">{players.length} thành viên</p>
          </div>
          <div className="divide-y divide-slate-50">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3 animate-pulse">
                    <div className="w-6 h-6 bg-slate-100 rounded-full" />
                    <div className="w-9 h-9 bg-slate-100 rounded-full" />
                    <div className="flex-1 h-4 bg-slate-100 rounded-full" />
                    <div className="w-24 h-4 bg-slate-100 rounded-full" />
                  </div>
                ))
              : players.map((p, i) => {
                  const winRate = p.matches > 0 ? Math.round((p.wins / p.matches) * 100) : null;
                  const rankColors = ['bg-yellow-400', 'bg-slate-300', 'bg-amber-600'];
                  return (
                    <div key={p.id}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-blue-50/50 transition-colors group animate-slide-up"
                      style={{ animationDelay: `${i * 30}ms` }}
                    >
                      {/* Rank */}
                      <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                        i < 3 ? `${rankColors[i]} text-white` : 'text-slate-400 font-bold'
                      }`}>{i + 1}</span>

                      {/* Avatar */}
                      <Avatar src={p.avatar} name={p.name} size={36} className="flex-shrink-0" />

                      {/* Name + ELO bar */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="font-semibold text-slate-800 text-sm truncate group-hover:text-blue-700 transition-colors">{p.name}</p>
                          {p.level && (
                            <span className={`flex-shrink-0 text-xs font-black px-1.5 py-0.5 rounded-full ${levelColor[p.level] ?? 'bg-gray-100 text-gray-400'}`}>
                              {p.level}
                            </span>
                          )}
                        </div>
                        <EloBar elo={p.elo} max={maxElo} />
                      </div>

                      {/* Stats */}
                      <div className="hidden sm:flex items-center gap-4 text-xs flex-shrink-0">
                        <div className="text-center w-10">
                          <p className="font-bold text-slate-700">{p.matches}</p>
                          <p className="text-slate-400">Trận</p>
                        </div>
                        <div className="text-center w-10">
                          <p className="font-bold text-green-600">{p.wins}</p>
                          <p className="text-slate-400">Thắng</p>
                        </div>
                        <div className="text-center w-10">
                          <p className="font-bold text-red-400">{p.losses}</p>
                          <p className="text-slate-400">Thua</p>
                        </div>
                        <div className="text-center w-10">
                          <p className={`font-bold ${winRate !== null && winRate >= 60 ? 'text-green-600' : winRate !== null && winRate < 40 ? 'text-red-400' : 'text-slate-600'}`}>
                            {winRate !== null ? `${winRate}%` : '–'}
                          </p>
                          <p className="text-slate-400">Tỷ lệ</p>
                        </div>
                      </div>
                    </div>
                  );
                })
            }
          </div>
        </div>
      )}
    </div>
  );
}
