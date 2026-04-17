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
  Medal,
  X,
  History,
  ArrowRight
} from 'lucide-react';

const MatchHistoryModal = ({ isOpen, onClose, player, category, matches }) => {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-card)] border border-[var(--border-color)] w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col h-[80vh] animate-in zoom-in-95 duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-8 border-b border-[var(--border-color)] flex justify-between items-center bg-gradient-to-r from-orange-500/10 to-transparent">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <History size={20} className="text-[#f1812e]" />
              <h3 className="text-2xl font-black uppercase tracking-tight">Lịch sử {category}</h3>
            </div>
            <div className="text-[10px] font-black opacity-40 uppercase tracking-widest">Người chơi: <span className="text-[#f1812e]">{player}</span></div>
          </div>
          <button onClick={onClose} className="w-12 h-12 rounded-2xl bg-[var(--bg-main)] flex items-center justify-center hover:bg-red-500 hover:text-white transition-all group">
            <X size={24} className="group-hover:rotate-90 transition-transform" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-4">
          {matches.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-30 italic py-20">
              <History size={48} className="mb-4" />
              <div className="font-bold">Chưa có dữ liệu thi đấu cho kèo này</div>
            </div>
          ) : (
            matches.map((match, i) => {
              const date = new Date(match.date);
              const isTeamA = match.team_a_players.includes(player);
              const pScore = isTeamA ? match.score_a : match.score_b;
              const oScore = isTeamA ? match.score_b : match.score_a;
              const isWin = parseInt(pScore) > parseInt(oScore);

              const renderPlayers = (playersStr, currentPlayer) => {
                const parts = playersStr.split(',');
                return parts.map((p, idx) => {
                  const trimmed = p.trim();
                  const isCurrent = trimmed.toLowerCase() === currentPlayer.toLowerCase();
                  return (
                    <React.Fragment key={idx}>
                      <span className={isCurrent ? "text-[#f1812e] font-black" : ""}>
                        {trimmed}
                      </span>
                      {idx < parts.length - 1 ? ", " : ""}
                    </React.Fragment>
                  );
                });
              };

              return (
                <div key={i} className={`flex items-center justify-between p-6 rounded-3xl border transition-all ${isWin ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'} hover:scale-[1.02]`}>
                  <div className="flex items-center gap-6 flex-1 min-w-0">
                    <div className="text-center min-w-[60px]">
                      <div className="text-[10px] font-black opacity-30 uppercase">{date.toLocaleDateString('vi-VN', { month: 'numeric', day: 'numeric' })}</div>
                      <div className="text-sm font-black">{date.getFullYear()}</div>
                    </div>
                    <div className="w-px h-10 bg-[var(--border-color)] opacity-20" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${isWin ? 'bg-green-500 text-white shadow-sm' : 'bg-red-500 text-white shadow-sm'}`}>
                          {isWin ? 'Thắng' : 'Thua'}
                        </span>
                        {match.match_type && match.match_type !== "Kèo đấu" && (
                          <span className="text-sm font-black opacity-60 italic">{match.match_type}</span>
                        )}
                      </div>
                      <div className="text-sm font-medium text-[var(--text-secondary)] opacity-90 tracking-wide leading-relaxed break-words">
                        <span className={isTeamA ? "bg-green-500/10 px-1 rounded" : ""}>
                          {renderPlayers(match.team_a_players, player)}
                        </span>
                        <span className="mx-2 opacity-20 font-black">VS</span>
                        <span className={!isTeamA ? "bg-green-500/10 px-1 rounded" : ""}>
                          {renderPlayers(match.team_b_players, player)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-3xl font-black font-outfit tracking-tighter tabular-nums italic shrink-0 ml-4">
                    <span className={isWin ? 'text-green-500' : 'text-red-500'}>{pScore}</span>
                    <span className="opacity-20 mx-1">-</span>
                    <span className="opacity-40">{oScore}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-8 border-t border-[var(--border-color)] bg-[var(--bg-main)]/50 text-center">
          <div className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em] italic">Dữ liệu được cập nhật tự động theo thời gian thực</div>
        </div>
      </div>
    </div>
  );
};

const AnalyticsView = () => {
  const [scores, setScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('all'); // all, week, month, quarter, year, custom
  const [searchQuery, setSearchQuery] = useState('');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [selectedMatchHistory, setSelectedMatchHistory] = useState(null); // { player, category, matches }
  const [hoveredCategory, setHoveredCategory] = useState(null);

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
      } else if (timeFilter === 'custom') {
        if (customRange.start) {
          include = include && matchDate >= new Date(customRange.start);
        }
        if (customRange.end) {
          const endDate = new Date(customRange.end);
          endDate.setHours(23, 59, 59, 999);
          include = include && matchDate <= endDate;
        }
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
      totalPlayers: 0,
      earliestDate: null,
      dailyActivity: {},
      categories: {},
      rawMatches: [] // Store for history popups
    };

    flatScores.forEach(match => {
      globalStats.rawMatches.push(match);
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

      const matchDateObj = new Date(dateStr);
      if (!globalStats.earliestDate || matchDateObj < globalStats.earliestDate) {
        globalStats.earliestDate = matchDateObj;
      }
    });

    globalStats.totalPlayers = Object.keys(players).length;

    const finalPlayers = Object.values(players)
      .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        const rateA = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
        const rateB = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
        return rateB - rateA;
      });

    return { players: finalPlayers, globalStats };
  }, [scores, timeFilter, searchQuery, customRange]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Loader2 className="animate-spin text-[#f1812e] mb-4" size={48} />
        <div className="font-black uppercase tracking-widest text-[#f1812e] text-sm">Đang phân tích dữ liệu...</div>
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
          <div className="text-[var(--text-secondary)] text-sm font-medium opacity-70">
            Dữ liệu hiệu suất thi đấu của các chiến binh
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-3">
          {['all', 'week', 'month', 'quarter', 'year', 'custom'].map(f => (
            <button
              key={f}
              onClick={() => setTimeFilter(f)}
              className={`px-3 sm:px-4 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all flex-1 sm:flex-initial text-center ${timeFilter === f
                  ? 'bg-[#f1812e] text-white shadow-lg shadow-orange-500/20'
                  : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:border-[#f1812e]/50 text-opacity-50'
                }`}
            >
              {f === 'all' ? 'Tất cả' : (f === 'week' ? 'Tuần' : (f === 'month' ? 'Tháng' : (f === 'quarter' ? 'Quý' : (f === 'year' ? 'Năm' : 'Lọc'))))}
            </button>
          ))}
        </div>
      </div>

      {timeFilter === 'custom' && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 shadow-xl animate-in slide-in-from-top-4 duration-300">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1 w-full space-y-2">
              <label className="text-[10px] font-black opacity-40 uppercase tracking-widest ml-2">Từ ngày</label>
              <input
                type="date"
                value={customRange.start}
                onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl p-3 text-sm font-bold focus:outline-none focus:border-[#f1812e] transition-colors"
              />
            </div>
            <ArrowRight size={20} className="text-[#f1812e] opacity-30 hidden md:block" />
            <div className="flex-1 w-full space-y-2">
              <label className="text-[10px] font-black opacity-40 uppercase tracking-widest ml-2">Đến ngày</label>
              <input
                type="date"
                value={customRange.end}
                onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl p-3 text-sm font-bold focus:outline-none focus:border-[#f1812e] transition-colors"
              />
            </div>
            <button
              onClick={() => { setCustomRange({ start: '', end: '' }); setTimeFilter('all'); }}
              className="px-6 py-3 rounded-xl bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all self-end"
            >
              Xóa lọc
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[32px] p-6 shadow-xl flex flex-col justify-center gap-4 group hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors" />

          <div className="flex items-center gap-4 border-b border-[var(--border-color)] pb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f1812e] to-orange-500 shadow-orange-500/20 flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform">
              <Activity size={18} />
            </div>
            <div>
              <div className="text-[9px] font-black opacity-40 uppercase tracking-[0.2em] mb-0.5">Tổng số trận</div>
              <div className="text-2xl font-black font-outfit leading-none">{globalStats.seriesCount}</div>
            </div>
          </div>

          <div className="flex items-center gap-4 border-b border-[var(--border-color)] pb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/20 flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform">
              <Users size={18} />
            </div>
            <div>
              <div className="text-[9px] font-black opacity-40 uppercase tracking-[0.2em] mb-0.5">Thành viên</div>
              <div className="text-2xl font-black font-outfit leading-none">{globalStats.totalPlayers}</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 shadow-green-500/20 flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform">
              <Calendar size={18} />
            </div>
            <div>
              <div className="text-[9px] font-black opacity-40 uppercase tracking-[0.2em] mb-0.5">Bắt đầu từ</div>
              <div className="text-sm font-black font-outfit leading-none mt-1">
                {globalStats.earliestDate ? globalStats.earliestDate.toLocaleDateString('vi-VN') : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[32px] p-6 shadow-xl relative overflow-hidden group">
          <div className="flex justify-between items-center mb-6 px-2">
            <div className="flex items-center gap-3">
              <BarChart3 size={18} className="text-[#f1812e]" />
              <span className="text-[10px] font-black opacity-40 uppercase tracking-widest">Tần suất trận đấu theo ngày</span>
            </div>
          </div>
          <div className="relative h-[400px] px-2 mt-4 overflow-x-auto scrollbar-hide group/chart">
            {/* Y Axis Grid & Labels */}
            <div className="absolute inset-x-2 top-16 bottom-10 flex flex-col justify-between pointer-events-none z-0">
              {[...Array(5)].map((_, i) => {
                const maxVal = Math.max(...Object.values(globalStats.dailyActivity).map(a => Object.values(a).reduce((sum, v) => sum + v, 0)), 1);
                const val = Math.round((maxVal / 4) * (4 - i));
                return (
                  <div key={i} className="flex items-center gap-3 w-full">
                    <span className="text-[9px] font-black opacity-40 w-4 text-right tabular-nums">{val}</span>
                    <div className="flex-1 h-px bg-[var(--border-color)] opacity-20" />
                  </div>
                );
              })}
            </div>

            <div className="absolute inset-x-10 top-16 bottom-10 flex items-end justify-between gap-px pb-2 z-10">
              {[...Array(15)].map((_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - (14 - i));
                const dStr = date.toISOString().split('T')[0];
                const shortDate = dStr.split('-').slice(1).reverse().join('/');
                const activity = globalStats.dailyActivity[dStr] || {};
                const dayTotal = Object.values(activity).reduce((a, b) => a + b, 0);

                const maxPossibleDayTotal = Math.max(...Object.values(globalStats.dailyActivity).map(a => Object.values(a).reduce((sum, v) => sum + v, 0)), 1);
                const pxPerMatch = Math.min(200 / maxPossibleDayTotal, 50);

                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-3 group/bar min-w-[32px] h-full justify-end">
                    <div
                      className="w-full relative flex flex-col-reverse items-stretch justify-start min-h-[4px]"
                    >
                      {/* Tooltip moved inside the relative bar container */}
                      <div className="absolute left-1/2 -translate-x-1/2 bg-[var(--bg-card)] border border-[var(--border-color)] px-3 py-2 rounded-xl text-[10px] font-black whitespace-nowrap opacity-0 group-hover/bar:opacity-100 transition-all shadow-2xl z-50 pointer-events-none text-center transform -translate-y-2 group-hover/bar:translate-y-0"
                        style={{ bottom: `calc(${dayTotal * pxPerMatch}px + 10px)` }}>
                        <div className="text-[9px] opacity-40 mb-0.5 font-bold uppercase tracking-widest">{dStr}</div>
                        <div className="text-[#f1812e] text-xs mb-1">{dayTotal} Trận</div>
                        <div className="space-y-0.5">
                          {Object.entries(activity).map(([cat, count]) => {
                            const colorTexts = { '1-1': 'text-[#f1812e]', '2-2': 'text-blue-500', '3-3': 'text-green-500', '4-4': 'text-purple-500', '3-4': 'text-pink-500' };
                            return <div key={cat} className={`${colorTexts[cat] || 'text-slate-500'} text-[8px] uppercase tracking-tighter`}>{cat}: {count}</div>
                          })}
                        </div>
                      </div>

                      {Object.keys(activity).map((cat) => {
                        const count = activity[cat];
                        const colorBgs = { '1-1': 'bg-[#f1812e]', '2-2': 'bg-blue-500', '3-3': 'bg-green-500', '4-4': 'bg-purple-500', '3-4': 'bg-pink-500' };
                        return (
                          <div
                            key={cat}
                            className={`w-full ${colorBgs[cat] || 'bg-slate-500'} transition-all duration-700 hover:brightness-125 first:rounded-b-md last:rounded-t-md`}
                            style={{ height: `${count * pxPerMatch}px` }}
                          />
                        );
                      })}
                    </div>
                    <div className="h-px w-full bg-[var(--border-color)] opacity-50" />
                    <span className="text-[9px] font-black opacity-60 uppercase tracking-tighter whitespace-nowrap">{dayTotal > 0 ? shortDate : '-'}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-center flex-wrap items-center gap-4 pt-4 border-t border-[var(--border-color)]/50">
            {['1-1', '2-2', '3-3', '4-4', '3-4'].map(cat => {
              const bg = { '1-1': 'bg-[#f1812e]', '2-2': 'bg-blue-500', '3-3': 'bg-green-500', '4-4': 'bg-purple-500', '3-4': 'bg-pink-500' }[cat] || 'bg-slate-500';
              return <div key={cat} className="flex items-center gap-1.5"><div className={`w-2 h-2 rounded-full ${bg}`} /><span className="text-[10px] font-black opacity-60 uppercase">{cat}</span></div>
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
                {Object.keys(globalStats.categories).sort().reduce((acc, cat) => {
                  const data = globalStats.categories[cat];
                  const percent = globalStats.seriesCount > 0 ? (data.count / globalStats.seriesCount) : 0;
                  const colors = { '1-1': '#f1812e', '2-2': '#3b82f6', '3-3': '#10b981', '4-4': '#a855f7', '3-4': '#ec4899' };
                  const color = colors[cat] || '#64748b';
                  const dasharray = `${percent * 251.2} 251.2`;
                  const dashoffset = -acc.offset;

                  acc.elements.push(
                    <circle
                      key={cat} cx="50" cy="50" r="40" fill="transparent"
                      stroke={color} strokeWidth={hoveredCategory === cat ? "15" : "12"}
                      strokeDasharray={dasharray}
                      strokeDashoffset={dashoffset}
                      strokeLinecap="butt"
                      className="transition-all duration-300 cursor-pointer"
                      onMouseEnter={() => setHoveredCategory(cat)}
                      onMouseLeave={() => setHoveredCategory(null)}
                    />
                  );
                  acc.offset += percent * 251.2;
                  return acc;
                }, { elements: [], offset: 0 }).elements}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center transition-all duration-300">
                <span className={`font-black font-outfit leading-none ${hoveredCategory ? 'text-4xl text-[#f1812e]' : 'text-3xl opacity-100'}`}>
                  {hoveredCategory ? globalStats.categories[hoveredCategory].count : globalStats.seriesCount}
                </span>
                <span className="text-[8px] font-black opacity-40 uppercase tracking-tighter mt-1">
                  {hoveredCategory ? `${hoveredCategory}` : 'TỔNG TRẬN'}
                </span>
              </div>
            </div>
            <div className="w-full space-y-2">
              {Object.keys(globalStats.categories).sort().map((cat) => {
                const bgColors = { '1-1': 'bg-[#f1812e]', '2-2': 'bg-blue-500', '3-3': 'bg-green-500', '4-4': 'bg-purple-500', '3-4': 'bg-pink-500' };
                const bg = bgColors[cat] || 'bg-slate-500';
                return (
                  <div key={cat} className="flex justify-between items-center bg-[var(--bg-main)]/50 p-2.5 rounded-xl border border-[var(--border-color)]">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${bg}`} />
                      <span className="text-[10px] font-black opacity-60 uppercase">{cat}</span>
                    </div>
                    <span className="text-xs font-black">{globalStats.categories[cat].count} Trận</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[40px] p-6 shadow-2xl relative overflow-hidden flex flex-col">
          <h3 className="text-lg font-black uppercase tracking-widest mb-8 flex items-center gap-3">
            <TrendingUp size={20} className="text-green-500" />
            Tổng số trận theo thể thức
          </h3>
          <div className="flex-1 relative mt-4 min-h-[260px]">
            {/* Y Axis Grid */}
            <div className="absolute inset-x-0 top-0 bottom-8 flex flex-col justify-between pointer-events-none">
              {[...Array(5)].map((_, i) => {
                const maxVal = Math.max(...Object.values(globalStats.categories).map(d => d.count), 1);
                const val = Math.round((maxVal / 4) * (4 - i));
                return (
                  <div key={i} className="flex items-center gap-3 w-full">
                    <span className="text-[9px] font-black opacity-30 w-4 text-right">{val}</span>
                    <div className="flex-1 h-px bg-[var(--border-color)] opacity-10" />
                  </div>
                );
              })}
            </div>

            <div className="absolute inset-x-8 top-0 bottom-0 flex items-end justify-between gap-4 px-4 z-10">
              {Object.keys(globalStats.categories).sort().map((cat, i) => {
                const data = globalStats.categories[cat];
                const maxCount = Math.max(...Object.values(globalStats.categories).map(d => d.count), 1);
                const height = (data.count / maxCount) * 200;
                const colors = {
                  '1-1': 'from-[#f1812e] to-orange-400',
                  '2-2': 'from-blue-500 to-blue-400',
                  '3-3': 'from-green-500 to-green-400',
                  '4-4': 'from-purple-500 to-purple-400',
                  '3-4': 'from-pink-500 to-pink-400'
                };
                const gradient = colors[cat] || 'from-slate-500 to-slate-400';
                return (
                  <div key={cat} className="flex-1 flex flex-col items-center gap-3 group h-full justify-end">
                    <div className="w-full relative flex flex-col items-center h-full justify-end">
                      {/* Tooltip moved inside the relative bar container */}
                      <div className="absolute left-1/2 -translate-x-1/2 bg-[var(--bg-main)] border border-[var(--border-color)] px-2 py-1 rounded text-[10px] font-black opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none"
                        style={{ bottom: `calc(${height}px + 10px)` }}>
                        {data.wins} THẮNG / {data.losses} THUA
                      </div>
                      <div
                        className={`w-full max-w-[48px] bg-gradient-to-t ${gradient} rounded-t-xl transition-all duration-1000 ease-out cursor-pointer hover:brightness-110 shadow-lg relative group flex flex-col justify-end pb-2`}
                        style={{ height: `${height}px`, minHeight: '28px' }}
                      >
                        <span className="text-[12px] font-black text-white/90 drop-shadow-md text-center leading-none">{data.count}</span>
                      </div>
                    </div>
                    <div className="h-px w-full bg-[var(--border-color)] opacity-20" />
                    <span className="text-[10px] font-black opacity-60 uppercase tracking-widest">{cat}</span>
                  </div>
                );
              })}
            </div>
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
            const attendance = globalStats.seriesCount > 0 ? ((totalGames / globalStats.seriesCount) * 100).toFixed(1) : "0.0";

            const playerMatches = globalStats.rawMatches.filter(m =>
              m.team_a_players.includes(player.name) || m.team_b_players.includes(player.name)
            ).sort((a, b) => new Date(b.match_date) - new Date(a.match_date));

            const calculateRecentWR = (matches, limit) => {
              let gamesCount = 0;
              let winsCount = 0;
              for (const m of matches) {
                if (gamesCount >= limit) break;
                const isTeamA = m.team_a_players.includes(player.name);
                const pWin = isTeamA ? parseInt(m.score_a) : parseInt(m.score_b);
                const pLoss = isTeamA ? parseInt(m.score_b) : parseInt(m.score_a);

                const remaining = limit - gamesCount;
                const totalHere = pWin + pLoss;

                if (totalHere <= remaining) {
                  winsCount += pWin;
                  gamesCount += totalHere;
                } else {
                  const winRatio = totalHere > 0 ? (pWin / totalHere) : 0;
                  winsCount += winRatio * remaining;
                  gamesCount += remaining;
                }
              }
              return gamesCount > 0 ? ((winsCount / gamesCount) * 100).toFixed(1) : "-";
            };

            const wr20 = calculateRecentWR(playerMatches, 20);
            const wr50 = calculateRecentWR(playerMatches, 50);
            const wr100 = calculateRecentWR(playerMatches, 100);

            return (
              <div key={player.name} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[24px] p-4 md:p-5 shadow-xl hover:shadow-[#f1812e]/5 transition-all group overflow-hidden relative mb-3">
                <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-gradient-to-br from-orange-500/5 to-transparent rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000" />
                <div className="relative z-10">
                  {/* Single Row: Avatar | Info+Phong độ | W/L + Winrate | Category Bars */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5 items-center">

                    {/* COL 1: Avatar + Name (2 cols) */}
                    <div className="md:col-span-2 flex items-center gap-3">
                      <div className="relative shrink-0">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#f1812e] to-[#ffaa45] flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                          <span className="text-xl font-black">{player.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="absolute -top-1.5 -left-1.5 w-7 h-7 bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)] flex items-center justify-center shadow font-black italic text-[#f1812e] text-xs">#{idx + 1}</div>
                        {idx < 3 && <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-yellow-500 rounded-md border-2 border-[var(--bg-card)] flex items-center justify-center shadow animate-bounce"><Medal size={12} className="text-white" /></div>}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-black tracking-tight leading-tight truncate">{player.name}</h3>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="text-[9px] font-black text-blue-500 uppercase tracking-wider bg-blue-500/10 px-2 py-0.5 rounded-full">{totalGames} Trận</span>
                        </div>
                      </div>
                    </div>

                    {/* COL 2: Tổng quát (3 cols) - Bold Titles, Larger W/L */}
                    <div className="md:col-span-3 h-full border-x border-[var(--border-color)]/20 flex flex-col justify-center">
                      <p className="text-[10px] font-black opacity-60 text-[var(--f1812ea)] uppercase tracking-[0.15em] mb-2 text-center">Tổng quát</p>
                      <div className="space-y-2.5">
                        {/* Hàng 1: Highlighted boxes */}
                        <div className="flex gap-2 px-1">
                          <div className="flex-1 text-center py-2.5 bg-orange-500/10 rounded-xl border border-orange-500/20 shadow-sm shadow-orange-500/5">
                            <p className="text-[8px] font-black text-[#f1812e] opacity-80 uppercase mb-1">Tỷ lệ thắng</p>
                            <div className="text-base font-black text-[#f1812e] tracking-tight">{winRate}%</div>
                          </div>
                          <div className="flex-1 text-center py-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 shadow-sm shadow-blue-500/5">
                            <p className="text-[8px] font-black text-blue-500 opacity-80 uppercase mb-1">Chuyên cần</p>
                            <div className="text-base font-black text-blue-500 tracking-tight">{attendance}%</div>
                          </div>
                        </div>
                        {/* Hàng 2: Combined Wins/Losses (Bigger) */}
                        <div className="text-center px-1">
                           <div className="inline-flex items-center gap-2 bg-[var(--bg-main)]/60 px-4 py-1.5 rounded-xl border border-[var(--border-color)] shadow-sm">
                             <span className="text-[15px] font-black text-green-500 tabular-nums">{player.wins} Thắng</span>
                             <span className="text-[15px] font-medium opacity-20">/</span>
                             <span className="text-[15px] font-black text-red-500 tabular-nums">{player.losses} Thua</span>
                           </div>
                        </div>
                      </div>
                    </div>

                    {/* COL 3: Phong độ (2 cols) - Bold Titles */}
                    <div className="md:col-span-2 border-r border-[var(--border-color)]/20 flex flex-col justify-center">
                      <p className="text-[10px] font-black opacity-60 uppercase tracking-[0.15em] mb-2 text-center">Phong độ gần nhất</p>
                      <div className="space-y-1.5 px-1">
                        <div className="flex items-center justify-between bg-orange-500/5 px-3 py-2 rounded-lg border border-orange-500/10">
                           <span className="text-[9px] font-black opacity-40 uppercase">20 Trận</span>
                           <span className="text-xs font-black text-orange-500">{wr20}%</span>
                        </div>
                        <div className="flex items-center justify-between bg-blue-500/5 px-3 py-2 rounded-lg border border-blue-500/10">
                           <span className="text-[9px] font-black opacity-40 uppercase">50 Trận</span>
                           <span className="text-xs font-black text-blue-500">{wr50}%</span>
                        </div>
                        <div className="flex items-center justify-between bg-green-500/5 px-3 py-2 rounded-lg border border-green-500/10">
                           <span className="text-[9px] font-black opacity-40 uppercase">100 Trận</span>
                           <span className="text-xs font-black text-green-500">{wr100}%</span>
                        </div>
                      </div>
                    </div>

                    {/* COL 4: Category Bars (5 cols) */}
                    <div className="md:col-span-5 pl-4">
                      <div className="space-y-2">
                        {['1-1', '2-2', '3-3', '4-4', '3-4'].map(cat => {
                          const data = player.categories[cat] || { wins: 0, losses: 0, total: 0 };
                          const rate = data.total > 0 ? (data.wins / data.total) * 100 : 0;
                          const colorMap = {
                            '1-1': { bg: 'bg-[#f1812e]', text: 'text-[#f1812e]' },
                            '2-2': { bg: 'bg-blue-500', text: 'text-blue-500' },
                            '3-3': { bg: 'bg-green-500', text: 'text-green-500' },
                            '4-4': { bg: 'bg-purple-500', text: 'text-purple-500' },
                            '3-4': { bg: 'bg-pink-500', text: 'text-pink-500' },
                          };
                          const cm = colorMap[cat] || { bg: 'bg-slate-500', text: 'text-slate-500' };

                          return (
                            <div
                              key={cat}
                              onClick={() => {
                                const filtered = globalStats.rawMatches.filter(m => {
                                  const inMatch = m.team_a_players.includes(player.name) || m.team_b_players.includes(player.name);
                                  const currentCat = m.team_a_players.split(',').length === m.team_b_players.split(',').length
                                    ? `${m.team_a_players.split(',').length}-${m.team_a_players.split(',').length}`
                                    : `${m.team_a_players.split(',').length}-${m.team_b_players.split(',').length}`;
                                  return inMatch && currentCat === cat;
                                }).sort((a, b) => new Date(b.date) - new Date(a.date));
                                setSelectedMatchHistory({ player: player.name, category: cat, matches: filtered });
                              }}
                              className="flex items-center gap-3 cursor-pointer group/bar hover:bg-[var(--bg-main)]/40 rounded-xl px-2 py-1 transition-all"
                            >
                              <span className={`text-[11px] font-black ${cm.text} w-8 shrink-0 text-right tabular-nums`}>{cat}</span>
                              <div className="flex-1 h-3 bg-[var(--border-color)]/20 rounded-full overflow-hidden shadow-inner">
                                <div
                                  className={`h-full ${cm.bg} rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.1)]`}
                                  style={{ width: `${Math.max(rate, 2)}%` }}
                                />
                              </div>
                              <span className={`text-[11px] font-black ${cm.text} w-10 shrink-0 tabular-nums`}>{rate.toFixed(0)}%</span>
                              <span className="text-[9px] font-black opacity-30 w-14 shrink-0 tabular-nums text-right font-outfit">{data.wins}W {data.losses}L</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <MatchHistoryModal
        isOpen={!!selectedMatchHistory}
        onClose={() => setSelectedMatchHistory(null)}
        player={selectedMatchHistory?.player}
        category={selectedMatchHistory?.category}
        matches={selectedMatchHistory?.matches || []}
      />
    </div>
  );
};

export default AnalyticsView;
