import React, { useState, useEffect } from 'react';
import VideoPlayer from './VideoPlayer';
import { Tv, ChevronRight, Monitor, Edit2, Check, X } from 'lucide-react';

const LiveView = () => {
  const [playerNames, setPlayerNames] = useState({});
  const [activeStreams, setActiveStreams] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const streams = [
    { id: 'team1-1', label: 'TEAM1-1', team: 'TEAM 1', teamColor: 'text-red-500 bg-red-500/10 border-red-500/20', machine: 'Máy 1' },
    { id: 'team1-2', label: 'TEAM1-2', team: 'TEAM 1', teamColor: 'text-red-500 bg-red-500/10 border-red-500/20', machine: 'Máy 2' },
    { id: 'team1-3', label: 'TEAM1-3', team: 'TEAM 1', teamColor: 'text-red-500 bg-red-500/10 border-red-500/20', machine: 'Máy 3' },
    { id: 'team1-4', label: 'TEAM1-4', team: 'TEAM 1', teamColor: 'text-red-500 bg-red-500/10 border-red-500/20', machine: 'Máy 4' },
    { id: 'team2-1', label: 'TEAM2-1', team: 'TEAM 2', teamColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20', machine: 'Máy 1' },
    { id: 'team2-2', label: 'TEAM2-2', team: 'TEAM 2', teamColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20', machine: 'Máy 2' },
    { id: 'team2-3', label: 'TEAM2-3', team: 'TEAM 2', teamColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20', machine: 'Máy 3' },
    { id: 'team2-4', label: 'TEAM2-4', team: 'TEAM 2', teamColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20', machine: 'Máy 4' },
  ];

  useEffect(() => {
    fetch('/api/v1/players')
      .then(res => res.json())
      .then(data => setPlayerNames(data))
      .catch(err => console.error('Error fetching player names:', err));

    const checkStatus = () => {
      fetch('/srs/api/v1/streams/')
        .then(res => res.json())
        .then(data => {
          if (data && data.code === 0 && data.streams) {
            const streamMap = {};
            data.streams.forEach(s => {
              if (s.publish && s.publish.active) {
                streamMap[s.name] = s.app;
              }
            });
            setActiveStreams(streamMap);
          } else {
            setActiveStreams({});
          }
        })
        .catch(err => console.error('SRS API check failed:', err));
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const saveName = (id) => {
    const newNames = { ...playerNames, [id]: editValue };
    setPlayerNames(newNames);
    fetch('/api/v1/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newNames),
    });
    setEditingId(null);
  };

  const onlineCount = Object.keys(activeStreams).length;

  return (
    <div className="space-y-10">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 overflow-hidden">
        <div className="lg:w-2/3 space-y-3">
          <h1 className="text-4xl md:text-5xl font-black font-outfit text-[var(--accent-secondary)] leading-tight">
            <span className="text-[#C9A050]">BPGROUP</span> AOE Tournament
          </h1>

          <p className="text-[var(--text-secondary)] font-medium leading-relaxed max-w-2xl">
            Nền tảng livestream và xem lại trận đấu giải AOE nội bộ BestPrice, nơi lưu giữ mọi khoảnh khắc kịch tính,
            chiến thuật đỉnh cao và tinh thần thi đấu máu lửa của các chiến binh.
            Theo dõi trực tiếp, xem lại bất cứ lúc nào và cùng cổ vũ cho những trận chiến huyền thoại!
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border-color)] px-4 py-2 rounded-full shadow-lg self-start lg:self-end">
          <div className={`w-2 h-2 rounded-full ${onlineCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-[var(--text-secondary)] opacity-30'}`}></div>
          <span className="text-xs font-bold text-[var(--text-secondary)]">
            {onlineCount} / 8 Đang Trực Tiếp
          </span>
        </div>
      </div>

      {/* Streams Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {streams.map((stream) => {
          const isOnline = !!activeStreams[stream.id];
          const playerName = playerNames[stream.id] || stream.label;
          const appName = activeStreams[stream.id] || 'live';

          return (
            <div key={stream.id} className="flex flex-col bg-[var(--bg-card)] rounded-3xl border border-[var(--border-color)] overflow-hidden transition-all duration-300 hover:shadow-2xl hover:border-[#C9A050]/20 group shadow-[var(--card-shadow)]">
              
              {/* Card Header */}
              <div className="p-4 flex items-center justify-between bg-[var(--bg-card-hover)]/30">
                <div className="flex items-center gap-3">
                  <Monitor size={18} className="text-[var(--text-secondary)] opacity-70" />
                  
                  {editingId === stream.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        className="text-sm font-bold bg-[var(--bg-main)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg px-2 py-1 outline-none w-24"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveName(stream.id)}
                      />
                      <button 
                        onClick={() => saveName(stream.id)} 
                        className="text-emerald-500 hover:text-emerald-400 cursor-pointer p-1 transition-colors"
                      >
                        <Check size={14} />
                      </button>
                      <button 
                        onClick={() => setEditingId(null)} 
                        className="text-red-500 hover:text-red-400 cursor-pointer p-1 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group/player">
                      <span className="text-sm font-bold text-[var(--text-primary)] tracking-tight">
                        {playerName}
                      </span>
                      <button
                        onClick={() => { setEditingId(stream.id); setEditValue(playerName); }}
                        className="opacity-0 group-hover/player:opacity-100 p-1 text-[var(--text-secondary)] hover:text-[#C9A050] transition-opacity cursor-pointer"
                      >
                        <Edit2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
                
                <div className={`text-[9px] font-black px-2.5 py-1 rounded-md border ${stream.teamColor} uppercase tracking-widest`}>
                  {stream.team}
                </div>
              </div>

              {/* Video Area */}
              <div className="aspect-video relative bg-black/5 border-y border-[var(--border-color)] flex items-center justify-center overflow-hidden">
                {isOnline ? (
                  <VideoPlayer url={`/${appName}/${stream.id}.m3u8`} />
                ) : (
                  <div className="flex flex-col items-center gap-4 text-[var(--text-secondary)]">
                    <Tv size={64} strokeWidth={1} className="opacity-10" />
                    <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase opacity-40">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)]" />
                      OFFLINE
                    </div>
                  </div>
                )}
                
                {isOnline && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 bg-red-600 rounded-md shadow-lg">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    <span className="text-[9px] font-black text-white uppercase tracking-widest">LIVE</span>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="p-4 flex items-center justify-between text-[var(--text-secondary)] group-hover:text-[#C9A050] transition-colors bg-[var(--bg-card-hover)]/20 cursor-pointer">
                <span className="text-xs font-medium uppercase tracking-wider opacity-70">{stream.machine}</span>
                <ChevronRight size={16} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LiveView;
