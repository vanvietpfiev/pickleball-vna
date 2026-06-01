'use client';
import { useEffect, useState } from 'react';
import { Player } from '@/lib/types';

interface TeamPair {
  team1: string[];
  team2: string[];
}

export default function SessionPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<'balanced' | 'random'>('balanced');
  const [teams, setTeams] = useState<TeamPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch('/api/players')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setPlayers(d.sort((a: Player, b: Player) => b.elo - a.elo));
        setLoading(false);
      });
  }, []);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const generate = async () => {
    if (selected.length < 4) return;
    setGenerating(true);
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerIds: selected, mode }),
    });
    const data = await res.json();
    if (res.ok) setTeams(data.teams);
    setGenerating(false);
  };

  const playerName = (id: string) => {
    const p = players.find((x) => x.id === id);
    return p ? `${p.name} (${p.elo})` : id;
  };

  const selectAll = () => setSelected(players.map((p) => p.id));
  const clearAll = () => setSelected([]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-blue-900 mb-6">Chia đội buổi chơi</h1>

      <div className="bg-white rounded-xl shadow p-5 mb-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-semibold text-gray-800">Chọn người tham gia ({selected.length})</h2>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">Chọn tất cả</button>
            <span className="text-gray-300">|</span>
            <button onClick={clearAll} className="text-xs text-gray-500 hover:underline">Bỏ chọn</button>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm">Đang tải...</p>
        ) : (
          <div className="flex flex-wrap gap-2 mb-4">
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className={`px-3 py-1.5 rounded-full text-sm border font-medium transition-colors ${
                  selected.includes(p.id)
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {p.name} <span className="text-xs opacity-70">({p.elo})</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex gap-2">
            {(['balanced', 'random'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-full text-sm border font-medium ${
                  mode === m ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 text-gray-600'
                }`}
              >
                {m === 'balanced' ? '⚖️ Cân bằng ELO' : '🎲 Ngẫu nhiên'}
              </button>
            ))}
          </div>

          <button
            onClick={generate}
            disabled={selected.length < 4 || generating}
            className="bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50"
          >
            {generating ? 'Đang chia...' : 'Chia đội'}
          </button>
          {selected.length > 0 && selected.length < 4 && (
            <span className="text-xs text-orange-500">Cần ít nhất 4 người</span>
          )}
        </div>

        {selected.length % 4 !== 0 && selected.length >= 4 && (
          <p className="text-xs text-gray-400 mt-2">
            * {selected.length % 4} người sẽ không được xếp sân (cần bội số của 4)
          </p>
        )}
      </div>

      {teams.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-800 mb-3">
            Kết quả chia đội – {mode === 'balanced' ? 'Cân bằng ELO' : 'Ngẫu nhiên'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {teams.map((t, i) => (
              <div key={i} className="bg-white rounded-xl shadow p-4 border-t-4 border-blue-500">
                <p className="font-semibold text-gray-700 mb-3">Sân {i + 1}</p>
                <div className="flex justify-between gap-4">
                  <div className="flex-1 bg-blue-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-blue-600 mb-2">Đội Xanh</p>
                    {t.team1.map((id) => (
                      <p key={id} className="text-sm font-medium text-gray-800">{playerName(id)}</p>
                    ))}
                  </div>
                  <div className="flex items-center font-bold text-gray-400">vs</div>
                  <div className="flex-1 bg-red-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-red-500 mb-2">Đội Đỏ</p>
                    {t.team2.map((id) => (
                      <p key={id} className="text-sm font-medium text-gray-800">{playerName(id)}</p>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
