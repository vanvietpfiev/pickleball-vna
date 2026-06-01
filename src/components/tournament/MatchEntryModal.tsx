'use client';
import { useState } from 'react';
import { TMatch, TParticipant, Player, TSet } from '@/lib/types';

interface Props {
  match: TMatch;
  participants: TParticipant[];
  players: Player[];
  onSave: (matchId: string, score1: number, score2: number, sets: TSet[]) => void;
  onClose: () => void;
}

function participantLabel(p: TParticipant | undefined, players: Player[]): string {
  if (!p) return 'TBD';
  if (p.name) return p.name;
  return p.playerIds.map((id) => {
    const pl = players.find((x) => x.id === id);
    return pl ? pl.name.split(' ').pop() : id;
  }).join(' / ');
}

const stageLabel: Record<string, string> = {
  group: 'Vòng bảng', qf: 'Tứ kết', sf: 'Bán kết', '3rd': 'Tranh hạng 3', final: 'Chung kết'
};

const MAX_SETS = 3;

export default function MatchEntryModal({ match, participants, players, onSave, onClose }: Props) {
  const p1 = participants.find((p) => p.id === match.p1Id);
  const p2 = participants.find((p) => p.id === match.p2Id);
  const label1 = participantLabel(p1, players);
  const label2 = participantLabel(p2, players);

  // Initialise from existing data if re-editing
  const initSets: { s1: string; s2: string }[] = match.sets
    ? match.sets.map((s) => ({ s1: String(s.s1), s2: String(s.s2) }))
    : [{ s1: '', s2: '' }, { s1: '', s2: '' }, { s1: '', s2: '' }];
  // Pad to MAX_SETS
  while (initSets.length < MAX_SETS) initSets.push({ s1: '', s2: '' });

  const [sets, setSets] = useState<{ s1: string; s2: string }[]>(initSets);

  const updateSet = (idx: number, side: 's1' | 's2', val: string) => {
    setSets((prev) => prev.map((s, i) => i === idx ? { ...s, [side]: val } : s));
  };

  // Compute played sets (both sides filled)
  const playedSets = sets.filter((s) => s.s1 !== '' && s.s2 !== '');
  const validSets = playedSets.filter((s) => {
    const n1 = parseInt(s.s1), n2 = parseInt(s.s2);
    return !isNaN(n1) && !isNaN(n2) && n1 !== n2;
  });

  const setsWon1 = validSets.filter((s) => parseInt(s.s1) > parseInt(s.s2)).length;
  const setsWon2 = validSets.filter((s) => parseInt(s.s2) > parseInt(s.s1)).length;
  const hasWinner = validSets.length > 0 && setsWon1 !== setsWon2;
  const winner = hasWinner ? (setsWon1 > setsWon2 ? label1 : label2) : null;

  const handleSave = () => {
    if (!hasWinner) return;
    const finalSets: TSet[] = validSets.map((s) => ({ s1: parseInt(s.s1), s2: parseInt(s.s2) }));
    onSave(match.id, setsWon1, setsWon2, finalSets);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white rounded-t-2xl px-6 py-4">
          <p className="text-blue-200 text-xs font-medium uppercase tracking-widest mb-1">
            {stageLabel[match.stage] || match.stage}
            {match.groupName ? ` · ${match.groupName}` : ''}
          </p>
          <div className="flex items-center justify-between">
            <p className="font-bold text-lg">Nhập kết quả</p>
            {match.played && <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Chỉnh sửa</span>}
          </div>
        </div>

        {/* Team names */}
        <div className="flex items-center px-6 pt-4 pb-2 gap-3">
          <p className="flex-1 text-sm font-bold text-blue-800 text-center leading-tight">{label1}</p>
          <p className="text-xs text-gray-400 flex-shrink-0">vs</p>
          <p className="flex-1 text-sm font-bold text-blue-800 text-center leading-tight">{label2}</p>
        </div>

        {/* Set scores */}
        <div className="px-6 py-2 space-y-2">
          {sets.map((s, i) => {
            const n1 = parseInt(s.s1), n2 = parseInt(s.s2);
            const filled = s.s1 !== '' && s.s2 !== '';
            const isValid = filled && !isNaN(n1) && !isNaN(n2) && n1 !== n2;
            const w1 = isValid && n1 > n2;
            const w2 = isValid && n2 > n1;

            return (
              <div key={i} className={`flex items-center gap-3 rounded-xl px-4 py-2.5 border-2 transition-colors ${
                isValid ? (w1 ? 'border-blue-200 bg-blue-50' : 'border-orange-200 bg-orange-50') :
                filled ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'
              }`}>
                <span className="text-xs font-semibold text-gray-400 w-12 flex-shrink-0">Sec {i + 1}</span>
                <input
                  type="number" min="0"
                  className={`w-16 text-center text-xl font-bold border-2 rounded-lg py-1 focus:outline-none transition-colors ${
                    w1 ? 'border-blue-400 text-blue-700 bg-white' : 'border-gray-200 text-gray-700 bg-white'
                  }`}
                  value={s.s1}
                  onChange={(e) => updateSet(i, 's1', e.target.value)}
                  placeholder="–"
                  autoFocus={i === 0}
                />
                <span className="text-gray-300 font-bold flex-shrink-0">:</span>
                <input
                  type="number" min="0"
                  className={`w-16 text-center text-xl font-bold border-2 rounded-lg py-1 focus:outline-none transition-colors ${
                    w2 ? 'border-orange-400 text-orange-700 bg-white' : 'border-gray-200 text-gray-700 bg-white'
                  }`}
                  value={s.s2}
                  onChange={(e) => updateSet(i, 's2', e.target.value)}
                  placeholder="–"
                />
                {isValid && (
                  <span className={`text-xs font-bold flex-shrink-0 ${w1 ? 'text-blue-600' : 'text-orange-600'}`}>
                    {w1 ? '✓' : '✓'}
                  </span>
                )}
                {filled && !isValid && (
                  <span className="text-xs text-red-400 flex-shrink-0">hòa?</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="px-6 py-3">
          {hasWinner ? (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black text-green-700">{setsWon1}</span>
                <span className="text-gray-400 font-bold">–</span>
                <span className="text-2xl font-black text-green-700">{setsWon2}</span>
                <span className="text-xs text-gray-500 ml-1">sec thắng</span>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Thắng trận</p>
                <p className="text-sm font-bold text-green-700">{winner}</p>
              </div>
            </div>
          ) : validSets.length > 0 ? (
            <p className="text-center text-xs text-orange-500">Kết quả đang hòa — thêm sec quyết định</p>
          ) : (
            <p className="text-center text-xs text-gray-400">Nhập điểm từng sec đấu (ít nhất 1 sec)</p>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50">
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={!hasWinner}
            className="flex-1 py-2.5 rounded-xl bg-blue-700 text-white font-semibold text-sm hover:bg-blue-800 disabled:opacity-40"
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}
