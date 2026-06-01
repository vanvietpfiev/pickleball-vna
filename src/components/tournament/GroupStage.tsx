'use client';
import { TMatch, TGroup, TParticipant, Player } from '@/lib/types';
import { calcGroupStandings } from '@/lib/tournamentUtils';
import Avatar from '@/components/Avatar';

interface Props {
  groups: TGroup[];
  participants: TParticipant[];
  players: Player[];
  matches: TMatch[];
  onMatchClick: (match: TMatch) => void;
}

function pLabel(pId: string, participants: TParticipant[], players: Player[], short = false): string {
  if (pId === 'TBD') return 'TBD';
  const p = participants.find((x) => x.id === pId);
  if (!p) return pId;
  if (p.name) return short ? p.name.split(' ').pop() || p.name : p.name;
  return p.playerIds.map((id) => {
    const pl = players.find((x) => x.id === id);
    if (!pl) return id;
    return short ? pl.name.split(' ').pop() || pl.name : pl.name;
  }).join(' / ');
}

function pAvatar(pId: string, participants: TParticipant[], players: Player[]) {
  const p = participants.find((x) => x.id === pId);
  if (!p) return null;
  const pl = players.find((x) => x.id === p.playerIds[0]);
  return pl ? { src: pl.avatar, name: pl.name } : null;
}

export default function GroupStage({ groups, participants, players, matches, onMatchClick }: Props) {
  const groupMatches = matches.filter((m) => m.stage === 'group');

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const gMatches = groupMatches.filter((m) => m.groupName === group.name);
        const standings = calcGroupStandings(group.participantIds, gMatches);
        const totalMatches = (group.participantIds.length * (group.participantIds.length - 1)) / 2;
        const playedMatches = gMatches.filter((m) => m.played).length;

        return (
          <div key={group.name} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Group header */}
            <div className="bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 flex items-center justify-between">
              <h3 className="font-bold text-white text-lg">{group.name}</h3>
              <span className="text-blue-200 text-xs font-medium">
                {playedMatches}/{totalMatches} trận
              </span>
            </div>

            <div className="grid md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-gray-100">
              {/* Standings */}
              <div className="p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Bảng xếp hạng</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400">
                      <th className="text-left pb-2 font-medium">#</th>
                      <th className="text-left pb-2 font-medium">Tên</th>
                      <th className="text-center pb-2 font-medium">Đ</th>
                      <th className="text-center pb-2 font-medium">T</th>
                      <th className="text-center pb-2 font-medium">H</th>
                      <th className="text-center pb-2 font-medium">B</th>
                      <th className="text-center pb-2 font-medium">HS</th>
                      <th className="text-center pb-2 font-bold text-blue-700">PTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s, i) => {
                      const av = pAvatar(s.participantId, participants, players);
                      const isTop = i < 2;
                      return (
                        <tr key={s.participantId} className={`border-t ${i === 0 ? 'bg-yellow-50' : i === 1 ? 'bg-gray-50' : ''}`}>
                          <td className="py-2 pr-2">
                            <span className={`text-xs font-black w-5 h-5 rounded-full flex items-center justify-center ${
                              i === 0 ? 'bg-yellow-400 text-white' :
                              i === 1 ? 'bg-gray-300 text-white' :
                              i === 2 ? 'bg-amber-600 text-white' :
                              'text-gray-400'
                            }`}>{i + 1}</span>
                          </td>
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-1.5">
                              {av && <Avatar src={av.src} name={av.name} size={20} />}
                              <span className={`font-medium ${isTop ? 'text-gray-800' : 'text-gray-600'} leading-tight`}>
                                {pLabel(s.participantId, participants, players, true)}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 text-center text-gray-500">{s.played}</td>
                          <td className="py-2 text-center text-green-600 font-medium">{s.wins}</td>
                          <td className="py-2 text-center text-gray-400">{s.draws}</td>
                          <td className="py-2 text-center text-red-500 font-medium">{s.losses}</td>
                          <td className="py-2 text-center text-gray-500">
                            {s.goalsFor - s.goalsAgainst > 0 ? '+' : ''}{s.goalsFor - s.goalsAgainst}
                          </td>
                          <td className="py-2 text-center font-bold text-blue-700 text-sm">{s.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Match schedule */}
              <div className="p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Lịch thi đấu</p>
                <div className="space-y-2">
                  {gMatches.sort((a, b) => a.order - b.order).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => onMatchClick(m)}
                      className={`w-full px-3 py-2 rounded-xl text-xs transition-all border ${
                        m.played
                          ? 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100'
                          : 'bg-blue-50 border-blue-100 text-blue-800 hover:bg-blue-100 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex-1 text-left truncate">
                          {pLabel(m.p1Id, participants, players, true)}
                        </span>
                        {m.played ? (
                          <span className="font-bold text-gray-700 bg-white rounded-md px-2 py-0.5 border text-sm flex-shrink-0">
                            {m.score1} – {m.score2}
                          </span>
                        ) : (
                          <span className="text-blue-400 flex-shrink-0">vs</span>
                        )}
                        <span className="flex-1 text-right truncate">
                          {pLabel(m.p2Id, participants, players, true)}
                        </span>
                        {!m.played && (
                          <span className="text-blue-400 ml-1 flex-shrink-0">✏️</span>
                        )}
                      </div>
                      {m.played && m.sets && m.sets.length > 0 && (
                        <div className="text-center text-gray-400 mt-0.5" style={{ fontSize: 10 }}>
                          {m.sets.map((s, i) => `${s.s1}-${s.s2}`).join('  ')}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
