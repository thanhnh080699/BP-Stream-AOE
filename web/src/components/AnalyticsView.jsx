import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Calendar, 
  Search, 
  Filter, 
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
    const globalStats = {
      seriesTotal: 0,
      seriesCount: 0,
      dailyActivity: {},
      categories: {} 
    };

    flatScores.forEach(match => {
      const teamA = match.team_a_players.split(',').map(s => s.trim()).filter(s => s);
      const teamB = match.team_b_players.split(',').map(s => s.trim()).filter(s => s);
      const scoreA = parseInt(match.score_a);
      const scoreB = parseInt(match.score_b);
      
      const cat = teamA.length === teamB.length ? `${teamA.length}-${teamA.length}` : `${teamA.length}-${teamB.length}`;
      
      const gameTotal = scoreA + scoreB;
      globalStats.seriesTotal++;
      globalStats.seriesCount += gameTotal;
      if (!globalStats.categories[cat]) {
        globalStats.categories[cat] = { count: 0, wins: 0, losses: 0 };
      }
      globalStats.categories[cat].count += gameTotal;
      globalStats.categories[cat].wins += scoreA;
      globalStats.categories[cat].losses += scoreB;
      
      const dateStr = match.match_date;
      if (!globalStats.dailyActivity[dateStr]) {
        globalStats.dailyActivity[dateStr] = {};
      }
      globalStats.dailyActivity[dateStr][cat] = (globalStats.dailyActivity[dateStr][cat] || 0) + gameTotal;

      const processPlayer = (playerName, pWins, pLosses) => {
        if (!players[playerName]) {
          players[playerName] = {
            name: playerName,
            totalSeries: 0,
            wins: 0,
            losses: 0,
            categories: {}
          };
        }
        
        players[playerName].totalSeries++;
        players[playerName].wins += pWins;
        players[playerName].losses += pLosses;
        
        if (!players[playerName].categories[cat]) {
          players[playerName].categories[cat] = { wins: 0, losses: 0, total: 0 };
        }
        players[playerName].categories[cat].total += (pWins + pLosses);
        players[playerName].categories[cat].wins += pWins;
        players[playerName].categories[cat].losses += pLosses;
      };

      teamA.forEach(p => processPlayer(p, scoreA, scoreB));
      teamB.forEach(p => processPlayer(p, scoreB, scoreA));
    });

    const finalPlayers = Object.values(players)
      .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        const rateA = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
        const rateB = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
        return rateB - rateA;
      });

    return { players: finalPlayers, globalStats };
  }, [scores, timeFilter, searchQuery]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Loader2 className="animate-spin text-[#f1812e] mb-4" size={48} />
        <p className="font-black uppercase tracking-widest text-[#f1812e]">Đang phân tích dữ liệu...</p>
      </div>
    );
  }

  const { players, globalStats } = processedData;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Header sections */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
        <div>
          <h2 className="text-3xl font-black font-outfit text-[var(--accent-secondary)] tracking-tight uppercase leading-none mb-3">
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[32px] p-6 shadow-xl flex items-center gap-6 group hover:-translate-y-1 transition-all duration-300">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/20 flex items-center justify-center text-white shrink-0 transition-transform">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-[11px] font-black opacity-30 uppercase tracking-[0.2em] mb-1">Tổng số kèo</p>
            <p className="text-4xl font-black font-outfit">{globalStats.seriesTotal}</p>
          </div>
        </div>

        <div className="md:col-span-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[32px] p-6 shadow-xl relative overflow-hidden group">
          <div className="flex justify-between items-center mb-6 px-2">
            <div className="flex items-center gap-3">
              <BarChart3 size={18} className="text-[#f1812e]" />
              <span className="text-[10px] font-black opacity-40 uppercase tracking-widest">Tần suất trận đấu theo ngày</span>
            </div>
          </div>
          
          <div className="h-44 flex items-end justify-between gap-2 px-2 border-b border-[var(--border-color)] pb-2 overflow-x-auto overflow-y-hidden">
            {[...Array(15)].map((_, i) => {
              const date = new Date();
              date.setDate(date.getDate() - (14 - i));
              const dStr = date.toISOString().split('T')[0];
              const shortDate = dStr.split('-').slice(1).reverse().join('/');
              const activity = globalStats.dailyActivity[dStr] || {};
              const dayTotal = Object.values(activity).reduce((a, b) => a + b, 0);
              
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group/bar min-w-[30px]">
                  <div className="w-full relative flex flex-col-reverse items-center justify-start min-h-[4px]">
                    <div className="absolute -top-12 bg-[var(--bg-main)] border border-[var(--border-color)] px-2 py-1 rounded text-[8px] font-black whitespace-nowrap opacity-0 group-hover/bar:opacity-100 transition-opacity shadow-xl z-20 pointer-events-none text-center">
                      <p className="opacity-40 mb-0.5">{dStr}</p>
                      <p className="text-orange-500">{dayTotal} Trận</p>
                    </div>
                    
                    {Object.keys(activity).map((cat, idx) => {
                      const count = activity[cat];
                      const colors = ['bg-orange-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-slate-500'];
                      return (
                        <div 
                          key={cat} 
                          className={`w-full max-w-[20px] ${colors[idx % colors.length]} transition-all duration-700 hover:brightness-125`}
                          style={{ height: `${count * 15}px` }}
                        />
                      );
                    })}
                  </div>
                  <span className="text-[8px] font-black opacity-30 uppercase tracking-tighter whitespace-nowrap">{shortDate}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[40px] p-8 shadow-2xl relative overflow-hidden group">
          <h3 className="text-lg font-black uppercase tracking-widest mb-8 flex items-center gap-3">
            <Filter size={20} className="text-[#f1812e]" />
            Phân bổ thể thức
          </h3>
          <div className="flex flex-col items-center">
            <div className="relative w-48 h-48 mb-6">
              <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--border-color)" strokeWidth="12" className="opacity-10" />
                {Object.keys(globalStats.categories).sort().map((cat, idx, arr) => {
                  const data = globalStats.categories[cat];
                  const percent = globalStats.seriesCount > 0 ? (data.count / globalStats.seriesCount) : 0;
                  const offset = arr.slice(0, idx).reduce((acc, c) => acc + (globalStats.categories[c].count / globalStats.seriesCount), 0) * 251.2;
                  const colors = ['#f1812e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#64748b'];
                  
                  return (
                    <circle 
                      key={cat} cx="50" cy="50" r="40" fill="transparent" 
                      stroke={colors[idx % colors.length]} strokeWidth="12" 
                      strokeDasharray="251.2" 
                      strokeDashoffset={251.2 * (1 - percent) - offset} 
                      strokeLinecap={percent > 0.05 ? "round" : "butt"} 
                      className="transition-all duration-1000" 
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black font-outfit">{globalStats.seriesCount}</span>
                <span className="text-[8px] font-black opacity-40 uppercase tracking-tighter">TỔNG TRẬN</span>
              </div>
            </div>
            <div className="w-full space-y-2">
              {Object.keys(globalStats.categories).sort().map((cat, idx) => {
                const colors = ['bg-[#f1812e]', 'bg-blue-500', 'bg-green-500', 'bg-orange-500', 'bg-purple-500', 'bg-slate-500'];
                return (
                  <div key={cat} className="flex justify-between items-center bg-[var(--bg-main)]/50 p-2.5 rounded-xl border border-[var(--border-color)]">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${colors[idx % colors.length]}`} />
                      <span className="text-[10px] font-black opacity-60 uppercase">{cat}</span>
                    </div>
                    <span className="text-xs font-black">{globalStats.categories[cat].count} Trận</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[40px] p-8 shadow-2xl relative overflow-hidden">
          <h3 className="text-lg font-black uppercase tracking-widest mb-8 flex items-center gap-3">
            <TrendingUp size={20} className="text-green-500" />
            Tổng số trận theo thể thức
          </h3>
          <div className="h-64 flex items-end justify-between gap-4 px-4 border-b border-[var(--border-color)] mb-8">
            {Object.keys(globalStats.categories).sort().map((cat, i) => {
              const data = globalStats.categories[cat];
              const maxCount = Math.max(...Object.values(globalStats.categories).map(d => d.count), 1);
              const height = (data.count / maxCount) * 200;
              const colors = ['from-orange-500 to-orange-400', 'from-blue-500 to-blue-400', 'from-green-500 to-green-400', 'from-purple-500 to-purple-400', 'from-slate-500 to-slate-400'];
              return (
                <div key={cat} className="flex-1 flex flex-col items-center gap-4 group">
                  <div className="w-full relative flex flex-col items-center">
                    <div className="absolute -top-8 bg-[var(--bg-main)] border border-[var(--border-color)] px-2 py-1 rounded text-[10px] font-black opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {data.wins} THẮNG / {data.losses} THUA
                    </div>
                    <div 
                      className={`w-full max-w-[40px] bg-gradient-to-t ${colors[i % colors.length]} rounded-t-xl transition-all duration-1000 ease-out cursor-pointer hover:brightness-110 shadow-lg`}
                      style={{ height: `${height}px` }}
                    />
                  </div>
                  <span className="text-[10px] font-black opacity-30 uppercase tracking-widest">{cat}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="relative group">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-30 group-focus-within:text-[#f1812e] transition-colors" size={20} />
        <input
          type="text" placeholder="Tìm kiếm tài năng AOE..."
          value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[32px] py-6 pl-16 pr-6 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-[#f1812e]/10 transition-all shadow-2xl focus:border-[#f1812e]/50 placeholder:opacity-30"
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        {players.length === 0 ? (
          <div className="bg-[var(--bg-card)] rounded-[32px] border border-dashed border-[var(--border-color)] py-20 text-center opacity-30">
            <Trophy size={64} className="mx-auto mb-4" />
            <p className="font-black uppercase tracking-widest text-xs">Không tìm thấy dữ liệu phù hợp</p>
          </div>
        ) : (
          players.map((player, idx) => {
            const totalGames = player.wins + player.losses;
            const winRate = totalGames > 0 ? ((player.wins / totalGames) * 100).toFixed(1) : "0.0";
            return (
              <div key={player.name} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[40px] p-8 md:p-12 shadow-2xl hover:shadow-[#f1812e]/5 transition-all group overflow-hidden relative mb-4">
                <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-gradient-to-br from-orange-500/5 to-transparent rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000" />
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
                  <div className="lg:col-span-3 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-[#f1812e] to-[#ffaa45] flex items-center justify-center text-white shadow-2xl shadow-orange-500/30 transition-transform">
                        <span className="text-3xl font-black">{player.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="absolute -top-3 -left-3 w-10 h-10 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] flex items-center justify-center shadow-lg font-black italic text-[#f1812e] text-lg">#{idx + 1}</div>
                      {idx < 3 && <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-yellow-500 rounded-2xl border-4 border-[var(--bg-card)] flex items-center justify-center shadow-lg animate-bounce"><Medal size={18} className="text-white" /></div>}
                    </div>
                    <div>
                      <h3 className="text-4xl font-black tracking-tight mb-2">{player.name}</h3>
                      <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                        <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest bg-orange-500/10 px-3 py-1 rounded-full">Pro Player</span>
                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-full">{player.totalSeries} KÈO</span>
                      </div>
                    </div>
                  </div>

                  {/* Main Win/Loss Stats with Radial Chart */}
                  <div className="lg:col-span-4 flex items-center justify-between bg-[var(--bg-main)]/40 rounded-[32px] p-8 border border-[var(--border-color)]">
                    <div className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="w-1.5 h-10 bg-green-500 rounded-full" />
                        <div>
                          <p className="text-[10px] font-black opacity-30 uppercase tracking-widest">Thắng</p>
                          <p className="text-3xl font-black text-green-500 tabular-nums">{player.wins}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-1.5 h-10 bg-red-500 rounded-full" />
                        <div>
                          <p className="text-[10px] font-black opacity-30 uppercase tracking-widest">Thua</p>
                          <p className="text-3xl font-black text-red-500 tabular-nums">{player.losses}</p>
                        </div>
                      </div>
                    </div>

                    <div className="relative flex items-center justify-center scale-110">
                      <svg className="w-32 h-32 transform -rotate-90">
                        <circle cx="64" cy="64" r="54" fill="transparent" stroke="currentColor" strokeWidth="12" className="text-[var(--border-color)] opacity-20" />
                        <circle 
                          cx="64" cy="64" r="54" fill="transparent" stroke="url(#gradient-player-win)" strokeWidth="12" 
                          strokeDasharray={339.29} strokeDashoffset={339.29 * (1 - winRate / 100)} strokeLinecap="round" className="transition-all duration-1000 ease-out" 
                        />
                        <defs><linearGradient id="gradient-player-win" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f1812e" /><stop offset="100%" stopColor="#ffaa45" /></linearGradient></defs>
                      </svg>
                      <div className="absolute text-center">
                        <p className="text-2xl font-black font-outfit leading-none mb-1 tabular-nums">{winRate}%</p>
                        <p className="text-[8px] font-black opacity-40 uppercase tracking-tighter">WINRATE</p>
                      </div>
                    </div>
                  </div>

                  {/* Team Categories Breakdown - Professional Horizontal Bars */}
                  <div className="lg:col-span-5 grid grid-cols-1 gap-4">
                    {Object.keys(player.categories).sort().map(cat => {
                      const data = player.categories[cat];
                      const rate = data.total > 0 ? ((data.wins / data.total) * 100).toFixed(0) : 0;
                      return (
                        <div key={cat} className="group/item">
                          <div className="flex justify-between items-center mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="w-8 h-8 rounded-lg bg-[var(--bg-main)] flex items-center justify-center text-[10px] font-black border border-[var(--border-color)]">{cat}</span>
                              <span className="text-xs font-black text-[#f1812e] uppercase tracking-widest">{data.wins}W / {data.losses}L</span>
                            </div>
                            <span className="text-xs font-black opacity-30 uppercase">{data.total} KÈO</span>
                          </div>
                          <div className="h-2.5 w-full bg-[var(--bg-main)] rounded-full overflow-hidden flex p-0.5 border border-[var(--border-color)]">
                            <div 
                              className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all duration-1000" 
                              style={{ width: `${rate}%` }}
                            />
                            <div 
                              className="h-full opacity-20 bg-red-500 transition-all duration-1000 ml-0.5 rounded-full" 
                              style={{ width: `${data.total > 0 ? 100 - rate : 0}%` }}
                            />
                          </div>
                        </div>
                      );
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
