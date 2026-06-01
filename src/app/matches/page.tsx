'use client';
import { useEffect, useState } from 'react';
import { Player, Match } from '@/lib/types';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';

export default function MatchesPage() {
  const { isLoggedIn } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [type, setType] = useState<'singles' | 'doubles'>('doubles');
  const [team1, setTeam1] = useState<string[]>([]);
  const [team2, setTeam2] = useState<string[]>([]);
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [winningSide, setWinningSide] = useState<'1' | '2'>('1');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/players').then((r) => r.json()),
      fetch('/api/matches').then((r) => r.json()),
    ]).then(([p, m]) => {
      if (Array.isArray(p)) setPlayers(p);
      if (Array.isArray(m)) setMatches(m);
      setLoading(false);
    });
  }, []);

  const maxTeamSize = type === 'doubles' ? 2 : 1;

  const togglePlayer = (id: string, side: 1 | 2) => {
    const set = side === 1 ? team1 : team2;
    const other = side === 1 ? team2 : team1;
    const setter = side === 1 ? setTeam1 : setTeam2;

    if (set.includes(id)) {
      setter(set.filter((x) => x !== id));
    } else if (other.includes(id)) {
      return; // already on other team
    } else if (set.length < maxTeamSize) {
      setter([...set, id]);
    }
  };

  const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? id;

  const submit = async () => {
    if (team1.length !== maxTeamSize || team2.length !== maxTeamSize) {
      setError(`Mỗi đội cần ${maxTeamSize} người.`);
      return;
    }
    if (!score1 || !score2) {
      setError('Nhập tỷ số.');
      return;
    }
    setSubmitting(true);
    setError('');
    const res = await fetch('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, team1, team2, score1, score2, winningSide, notes }),
    });
    const data = await res.json();
    if (res.ok) {
      setMatches((prev) => [data, ...prev]);
      setTeam1([]);
      setTeam2([]);
      setScore1('');
      setScore2('');
      setNotes('');
      setSuccess('Đã lưu kết quả và cập nhật ELO!');
      setTimeout(() => setSuccess(''), 4000);
    } else {
      setError(data.error || 'Lỗi');
    }
    setSubmitting(false);
  };

  const playerColor = (id: string) => {
    if (team1.includes(id)) return 'bg-blue-100 border-blue-400 text-blue-800';
    if (team2.includes(id)) return 'bg-red-100 border-red-400 text-red-800';
    return 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100';
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-blue-900 mb-6">Kết quả trận đấu</h1>

      {!isLoggedIn && (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 px-5 py-3 mb-6 flex items-center gap-3 text-sm text-slate-500">
          <span>🔒</span>
          <span>Bạn đang xem ở chế độ khách. <Link href="/login" className="text-blue-600 font-semibold hover:underline">Đăng nhập</Link> để nhập kết quả.</span>
        </div>
      )}

      {isLoggedIn && <div className="bg-white rounded-xl shadow p-5 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">Nhập kết quả mới</h2>

        <div className="flex gap-3 mb-4">
          {(['doubles', 'singles'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setType(t); setTeam1([]); setTeam2([]); }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border ${
                type === t ? 'bg-blue-700 text-white border-blue-700' : 'border-gray-300 text-gray-600'
              }`}
            >
              {t === 'doubles' ? 'Đánh đôi' : 'Đánh đơn'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm font-medium text-blue-700 mb-2">
              Đội Xanh ({team1.length}/{maxTeamSize})
            </p>
            <div className="flex flex-wrap gap-2">
              {players.map((p) => (
                <button
                  key={p.id}
                  onClick={() => togglePlayer(p.id, 1)}
                  className={`px-3 py-1 rounded-full text-xs border font-medium transition-colors ${playerColor(p.id)}`}
                >
                  {p.name}
                  {team1.includes(p.id) && ' ✓'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-red-600 mb-2">
              Đội Đỏ ({team2.length}/{maxTeamSize})
            </p>
            <div className="flex flex-wrap gap-2">
              {players.map((p) => (
                <button
                  key={p.id}
                  onClick={() => togglePlayer(p.id, 2)}
                  className={`px-3 py-1 rounded-full text-xs border font-medium transition-colors ${playerColor(p.id)}`}
                >
                  {p.name}
                  {team2.includes(p.id) && ' ✓'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 items-end flex-wrap mb-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Điểm Đội Xanh</label>
            <input
              type="number" min="0"
              className="border rounded-lg px-3 py-2 w-20 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={score1} onChange={(e) => setScore1(e.target.value)}
            />
          </div>
          <span className="text-gray-400 font-bold pb-2">–</span>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Điểm Đội Đỏ</label>
            <input
              type="number" min="0"
              className="border rounded-lg px-3 py-2 w-20 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={score2} onChange={(e) => setScore2(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Đội thắng</label>
            <select
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={winningSide} onChange={(e) => setWinningSide(e.target.value as '1' | '2')}
            >
              <option value="1">Đội Xanh</option>
              <option value="2">Đội Đỏ</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-600 block mb-1">Ghi chú</label>
            <input
              className="border rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Tùy chọn..."
              value={notes} onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        {success && <p className="text-green-600 text-sm mb-3">{success}</p>}

        <button
          onClick={submit}
          disabled={submitting}
          className="bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50"
        >
          {submitting ? 'Đang lưu...' : 'Lưu kết quả'}
        </button>
      </div>}

      <h2 className="font-semibold text-gray-800 mb-3">Lịch sử trận đấu</h2>
      {loading ? (
        <p className="text-gray-400">Đang tải...</p>
      ) : matches.length === 0 ? (
        <p className="text-gray-500">Chưa có trận đấu nào.</p>
      ) : (
        <div className="space-y-2">
          {matches.map((m) => (
            <div key={m.id} className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    {m.type === 'doubles' ? 'Đôi' : 'Đơn'}
                  </span>
                  <span className="font-medium text-sm">
                    {m.team1.map(playerName).join(' & ')}
                    <span className={`mx-2 font-bold ${m.winningSide === '1' ? 'text-green-600' : 'text-red-500'}`}>
                      {m.score1}–{m.score2}
                    </span>
                    {m.team2.map(playerName).join(' & ')}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {m.date ? new Date(m.date).toLocaleDateString('vi-VN') : ''}
                </span>
              </div>
              {m.notes && <p className="text-xs text-gray-400 mt-1">{m.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
