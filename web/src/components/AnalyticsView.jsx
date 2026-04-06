import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Calendar, 
  Search, 
  Filter, 
  ArrowUpRight, 
  ArrowDownRight,
  Loader2,
  Trophy,
  Activity,
  User,
  Medal
} from 'lucide-react';

const AnalyticsView = () => {
  const [scores, setScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('all'); // all, week, month, quarter, year
  const [searchQuery, setSearchQuery] = useState('');

  const fetchScores = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/scores');
      if (!response.ok) throw new Error('Không thể tải dữ liệu tỷ số');
      const data = await response.json();
      setScores(data || {});
    } catch (err) {
      console.error('Lỗi tải scores:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScores();
  }, []);

  // Flatten and filter scores
  const processedData = useMemo(() => {
    const flatScores = [];
    const now = new Date();
    
    Object.keys(scores).forEach(date => {
      const matchDate = new Date(date);
      let include = true;
      
      if (timeFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        include = matchDate >= weekAgo;
      } else if (timeFilter === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(now.getMonth() - 1);
        include = matchDate >= monthAgo;
      } else if (timeFilter === 'quarter') {
        const quarterAgo = new Date();
        quarterAgo.setMonth(now.getMonth() - 3);
        include = matchDate >= quarterAgo;
      } else if (timeFilter === 'year') {
        const yearAgo = new Date();
        yearAgo.setFullYear(now.getFullYear() - 1);
        include = matchDate >= yearAgo;
      }
      
      if (include) {
        scores[date].forEach(match => {
          flatScores.push({ ...match, date });
        });
      }
    });

    const players = {};

    flatScores.forEach(match => {
      const teamA = match.team_a_players.split(',').map(s => s.trim()).filter(s => s);
      const teamB = match.team_b_players.split(',').map(s => s.trim()).filter(s => s);
      const scoreA = parseInt(match.score_a);
      const scoreB = parseInt(match.score_b);
      const teamSize = teamA.length; // Assume balanced teams for category

      const processPlayer = (playerName, won, isTeamA) => {
        if (!players[playerName]) {
          players[playerName] = {
            name: playerName,
            totalMatches: 0,
            wins: 0,
            losses: 0,
            categories: {
              '1-1': { wins: 0, losses: 0, total: 0 },
              '2-2': { wins: 0, losses: 0, total: 0 },
              '3-3': { wins: 0, losses: 0, total: 0 },
              '4-4': { wins: 0, losses: 0, total: 0 },
              'other': { wins: 0, losses: 0, total: 0 }
            }
          };
        }
        
        players[playerName].totalMatches++;
        if (won) players[playerName].wins++;
        else players[playerName].losses++;
        
        const cat = teamSize === 1 ? '1-1' : (teamSize === 2 ? '2-2' : (teamSize === 3 ? '3-3' : (teamSize === 4 ? '4-4' : 'other')));
        players[playerName].categories[cat].total++;
        if (won) players[playerName].categories[cat].wins++;
        else players[playerName].categories[cat].losses++;
      };

      teamA.forEach(p => processPlayer(p, scoreA > scoreB, true));
      teamB.forEach(p => processPlayer(p, scoreB > scoreA, false));
    });

    return Object.values(players)
      .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => (b.wins / b.totalMatches) - (a.wins / a.totalMatches));
  }, [scores, timeFilter, searchQuery]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Loader2 className="animate-spin text-[#f1812e] mb-4" size={48} />
        <p className="font-black uppercase tracking-widest text-[#f1812e]">Đang phân tích dữ liệu...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
        <div>
          <h2 className="text-5xl font-black font-outfit text-[var(--accent-secondary)] tracking-tight uppercase leading-none mb-3">
            Phân tích thống kê
          </h2>
          <p className="text-[var(--text-secondary)] text-sm font-medium opacity-70">
            Dữ liệu hiệu suất thi đấu của các chiến binh
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {['all', 'week', 'month', 'quarter', 'year'].map(f => (
            <button
              key={f}
              onClick={() => setTimeFilter(f)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                timeFilter === f 
                ? 'bg-[#f1812e] text-white shadow-lg shadow-orange-500/20' 
                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:border-[#f1812e]/50 text-opacity-50'
              }`}
            >
              {f === 'all' ? 'Tất cả' : (f === 'week' ? 'Tuần' : (f === 'month' ? 'Tháng' : (f === 'quarter' ? 'Quý' : 'Năm')))}
            </button>
          ))}
        </div>
      </div>

      {/* Global Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Tổng số trận', value: Object.values(scores).flat().length, icon: Activity, color: 'text-blue-500' },
          { label: 'Tỉ lệ team 1-1', value: '45%', icon: User, color: 'text-orange-500' },
          { label: 'Tỉ lệ team 2-2+', value: '55%', icon: Users, color: 'text-green-500' },
          { label: 'Cập nhật cuối', value: 'Hôm nay', icon: Calendar, color: 'text-purple-500' },
        ].map((stat, i) => (
          <div key={i} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 shadow-xl flex items-center gap-4">
            <div className={`p-4 rounded-2xl bg-${stat.color.split('-')[1]}-500/10 ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em]">{stat.label}</p>
              <p className="text-2xl font-black font-outfit">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div className="relative">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-30" size={20} />
        <input
          type="text"
          placeholder="Tìm kiếm tên người chơi..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl py-5 pl-16 pr-6 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#f1812e]/30 transition-all shadow-lg"
        />
      </div>

      {/* Players Leaderboard / Stats */}
      <div className="grid grid-cols-1 gap-6">
        {processedData.length === 0 ? (
          <div className="bg-[var(--bg-card)] rounded-[32px] border border-dashed border-[var(--border-color)] py-20 text-center opacity-30">
            <Trophy size={64} className="mx-auto mb-4" />
            <p className="font-black uppercase tracking-widest text-xs">Không tìm thấy dữ liệu phù hợp</p>
          </div>
        ) : (
          processedData.map((player, idx) => {
            const winRate = ((player.wins / player.totalMatches) * 100).toFixed(1);
            return (
              <div key={player.name} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[32px] p-6 md:p-10 shadow-xl hover:shadow-2xl transition-all group overflow-hidden relative">
                {/* Ranking Badge */}
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-all">
                  <span className="text-8xl font-black italic">#{idx + 1}</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
                  {/* Player Hero Section */}
                  <div className="lg:col-span-3 flex items-center gap-6">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-[24px] bg-gradient-to-br from-[#f1812e] to-[#ffaa45] flex items-center justify-center text-white shadow-xl shadow-orange-500/20">
                        <span className="text-3xl font-black">{player.name.charAt(0).toUpperCase()}</span>
                      </div>
                      {idx < 3 && (
                        <div className="absolute -top-3 -right-3 w-10 h-10 bg-yellow-500 rounded-full border-4 border-[var(--bg-card)] flex items-center justify-center shadow-lg">
                          <Medal size={16} className="text-white" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-2xl font-black tracking-tight">{player.name}</h3>
                      <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest bg-orange-500/10 px-2 py-0.5 rounded inline-block mt-1">CHIẾN BINH</p>
                    </div>
                  </div>

                  {/* Main Win/Loss Stats */}
                  <div className="lg:col-span-3 flex justify-between items-center bg-[var(--bg-main)]/50 rounded-2xl p-6 border border-[var(--border-color)]">
                    <div className="text-center">
                      <p className="text-[9px] font-black opacity-30 uppercase tracking-widest mb-1">Thắng</p>
                      <p className="text-2xl font-black text-green-500">{player.wins}</p>
                    </div>
                    <div className="h-10 w-px bg-[var(--border-color)]" />
                    <div className="text-center">
                      <p className="text-[9px] font-black opacity-30 uppercase tracking-widest mb-1">Thua</p>
                      <p className="text-2xl font-black text-red-500">{player.losses}</p>
                    </div>
                    <div className="h-10 w-px bg-[var(--border-color)]" />
                    <div className="text-center">
                      <p className="text-[9px] font-black opacity-30 uppercase tracking-widest mb-1">Winrate</p>
                      <p className="text-2xl font-black text-[#f1812e]">{winRate}%</p>
                    </div>
                  </div>

                  {/* Team Categories Breakdown - Custom Visual Bar Chart */}
                  <div className="lg:col-span-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {['1-1', '2-2', '3-3', '4-4'].map(cat => {
                      const data = player.categories[cat];
                      const rate = data.total > 0 ? ((data.wins / data.total) * 100).toFixed(0) : 0;
                      return (
                        <div key={cat} className="space-y-2">
                          <div className="flex justify-between items-end">
                            <span className="text-[10px] font-black opacity-50 uppercase tracking-tight">{cat}</span>
                            <span className="text-xs font-black">{rate}%</span>
                          </div>
                          <div className="h-2 w-full bg-[var(--bg-main)] rounded-full overflow-hidden flex gap-0.5">
                            <div 
                              className="h-full bg-orange-500 transition-all duration-1000" 
                              style={{ width: `${rate}%` }}
                            />
                            <div 
                              className="h-full bg-red-500 transition-all duration-1000" 
                              style={{ width: `${data.total > 0 ? 100 - rate : 0}%` }}
                            />
                          </div>
                          <p className="text-[8px] font-black opacity-30 uppercase text-center">{data.total} TRẬN</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AnalyticsView;
