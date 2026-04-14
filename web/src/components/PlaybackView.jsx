import React, { useState, useEffect } from 'react';
import VideoPlayer from './VideoPlayer';
import { Calendar, Play, Clock, Monitor, Archive, Filter, ChevronRight, HardDrive, AlertCircle, Trash2, Edit2, Check, X, Trophy } from 'lucide-react';
import PasswordModal from './PasswordModal';
import PlaybackCalendar from './PlaybackCalendar';

const PlaybackView = () => {
    const [replays, setReplays] = useState({});
    const [playerNames, setPlayerNames] = useState({});
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedStream, setSelectedStream] = useState(null);
    const [allPlayers, setAllPlayers] = useState([]);
    const [scores, setScores] = useState({});
    const [editingStreamId, setEditingStreamId] = useState(null);
    const [tempPlayerName, setTempPlayerName] = useState('');
    
    // Auth Modal State
    const [authModal, setAuthModal] = useState({
        isOpen: false,
        title: '',
        description: '',
        onConfirm: () => {}
    });

    const fetchMetadata = () => {
        fetch('/api/v1/metadata')
            .then(res => res.json())
            .then(data => {
                setReplays(data);
                // Only auto-select date/stream on first load
                if (!selectedDate) {
                    const dates = Object.keys(data).sort((a, b) => b.localeCompare(a));
                    if (dates.length > 0) {
                        setSelectedDate(dates[0]);
                        const streams = data[dates[0]].streams || {};
                        const streamIds = Object.keys(streams);
                        if (streamIds.length > 0) setSelectedStream(streamIds[0]);
                    }
                } else if (!data[selectedDate]) {
                    // Current selected date was deleted
                    const dates = Object.keys(data).sort((a, b) => b.localeCompare(a));
                    if (dates.length > 0) {
                        setSelectedDate(dates[0]);
                        const streams = data[dates[0]].streams || {};
                        const streamIds = Object.keys(streams);
                        if (streamIds.length > 0) setSelectedStream(streamIds[0]);
                    } else {
                        setSelectedDate(null);
                        setSelectedStream(null);
                    }
                } else if (selectedStream && (!data[selectedDate].streams || !data[selectedDate].streams[selectedStream])) {
                    // Selected stream was deleted
                    const streams = data[selectedDate].streams || {};
                    const streamIds = Object.keys(streams);
                    if (streamIds.length > 0) setSelectedStream(streamIds[0]);
                    else setSelectedStream(null);
                }
            })
            .catch(err => console.error("Error fetching replays:", err));
    };

    const handleDelete = (date, streamId = null) => {
        const type = streamId ? `máy ${playerNames[streamId] || streamId}` : `toàn bộ dữ liệu ngày ${date}`;
        
        setAuthModal({
            isOpen: true,
            title: 'Xác nhận xóa dữ liệu',
            description: `Bạn đang yêu cầu xóa ${type}. Hành động này không thể hoàn tác. Vui lòng nhập mật khẩu để xác thực quyền quản trị.`,
            onConfirm: (password) => {
                fetch('/api/v1/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password, date, stream: streamId })
                })
                    .then(async res => {
                        const data = await res.json();
                        if (res.ok) {
                            alert('Xoá thành công!');
                            setAuthModal(prev => ({ ...prev, isOpen: false }));
                            fetchMetadata();
                        } else {
                            alert(`Lỗi: ${data.error || 'Không thể xoá'}`);
                        }
                    })
                    .catch(err => {
                        console.error('Delete error:', err);
                        alert('Lỗi kết nối server');
                    });
            }
        });
    };

    useEffect(() => {
        fetchMetadata();

        fetch('/api/v1/players')
            .then(res => res.json())
            .then(data => setPlayerNames(data))
            .catch(err => console.error('Error fetching player names:', err));

        fetch('/api/v1/players-db')
            .then(res => res.json())
            .then(data => setAllPlayers(data))
            .catch(err => console.error('Error fetching all players:', err));

        fetch('/api/v1/scores')
            .then(res => res.json())
            .then(data => setScores(data || {}))
            .catch(err => console.error('Error fetching scores:', err));
    }, []);

    // Memoized current player stats
    const playerStats = React.useMemo(() => {
        if (!selectedStream) return null;
        const playerName = replays[selectedDate]?.streams?.[selectedStream]?.display_name || playerNames[selectedStream] || selectedStream;
        
        let wins = 0;
        let losses = 0;
        let total = 0;
        let gamesWon = 0;
        let gamesLost = 0;

        Object.values(scores).forEach(dayMatches => {
            dayMatches.forEach(match => {
                const teamA = match.team_a_players.split(',').map(s => s.trim().toLowerCase());
                const teamB = match.team_b_players.split(',').map(s => s.trim().toLowerCase());
                const lowerName = playerName.toLowerCase();
                const scoreA = parseInt(match.score_a) || 0;
                const scoreB = parseInt(match.score_b) || 0;

                if (teamA.includes(lowerName)) {
                    total++;
                    gamesWon += scoreA;
                    gamesLost += scoreB;
                    if (scoreA > scoreB) wins++;
                    else if (scoreA < scoreB) losses++;
                } else if (teamB.includes(lowerName)) {
                    total++;
                    gamesWon += scoreB;
                    gamesLost += scoreA;
                    if (scoreB > scoreA) wins++;
                    else if (scoreB < scoreA) losses++;
                }
            });
        });

        const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";
        return { wins, losses, total, winRate, name: playerName, gamesWon, gamesLost };
    }, [selectedStream, selectedDate, replays, playerNames, scores]);

    const currentPlayerInfo = React.useMemo(() => {
        if (!playerStats) return null;
        return allPlayers.find(p => p.name.toLowerCase() === playerStats.name.toLowerCase());
    }, [allPlayers, playerStats]);

    const handleSavePlayerName = (date, streamId, newName) => {
        if (!newName || !date) return;

        fetch('/api/v1/metadata/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, stream_id: streamId, new_name: newName })
        })
        .then(res => {
            if (res.ok) {
                setEditingStreamId(null);
                fetchMetadata(); // Refresh to get updated display_name
            } else {
                alert('Lỗi khi lưu tên người chơi');
            }
        })
        .catch(err => console.error('Error saving player name:', err));
    };

    // New: Polling effect for processing status
    useEffect(() => {
        const hasProcessing = Object.values(replays).some(m => m.status === 'processing');
        let interval;
        if (hasProcessing) {
            interval = setInterval(fetchMetadata, 3000); // Poll every 3s
        }
        return () => clearInterval(interval);
    }, [replays]);


    const handleDateChange = (date) => {
        setSelectedDate(date);
        const streams = replays[date].streams || {};
        const streamIds = Object.keys(streams);
        if (streamIds.length > 0) {
            setSelectedStream(streamIds[0]);
        } else {
            setSelectedStream(null);
        }
    };

    const currentVideo = (selectedDate && selectedStream && replays[selectedDate]?.streams?.[selectedStream])
        ? replays[selectedDate].streams[selectedStream]
        : null;

    return (
        <div className="max-w-[1600px] mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 overflow-hidden">
                <div className="space-y-2">
                    <h2 className="text-3xl font-black font-outfit text-[var(--accent-secondary)]">
                        <span className="text-[#f1812e]">Lưu trữ</span> Trận đấu
                    </h2>
                    <p className="text-[var(--text-secondary)] font-medium">Xem lại lịch sử thi đấu của các đội</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                {/* 1. Video Player Container (Order 1) */}
                <div className="xl:col-span-8 order-1 space-y-6">
                    <div className="relative aspect-video rounded-3xl overflow-hidden bg-black border border-[var(--border-color)] shadow-2xl">
                        {currentVideo ? (
                            <VideoPlayer
                                url={currentVideo.hls ? `/replays/${currentVideo.hls}` : `/replays/${currentVideo.file}`}
                                isPlayback={true}
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-6 text-[var(--text-secondary)] bg-[var(--bg-card)]">
                                <div className="p-8 rounded-full border border-[var(--border-color)] bg-[var(--bg-card-hover)]/40">
                                    <Monitor size={64} strokeWidth={1} className="opacity-20" />
                                </div>
                                <div className="text-center">
                                    <p className="text-xs font-bold uppercase tracking-[0.3em] opacity-40">Đang đợi lựa chọn</p>
                                    <p className="text-[10px] font-medium mt-2">Chọn ngày và máy để bắt đầu phát lại</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Sidebar Container (Calendar + Machines + Actions) (Order 2 on Mobile, Right side on Desktop) */}
                {/* We use xl:row-span-2 to let it take the full height on the right while Metadata stacks on the left */}
                <div className="xl:col-span-4 xl:row-span-2 order-2 space-y-8">
                    {/* Bảng lịch */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <h2 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2 text-[var(--text-secondary)]">
                                <Archive size={16} className="text-[#f1812e]/50" /> BẢN GHI LƯU TRỮ
                            </h2>
                            <span className="text-[10px] font-bold text-[var(--text-secondary)]">{Object.keys(replays).length} NGÀY</span>
                        </div>
                        <PlaybackCalendar 
                            replays={replays}
                            selectedDate={selectedDate}
                            onSelectDate={handleDateChange}
                        />
                    </div>

                    {/* Các máy thi đấu */}
                    {selectedDate && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-6 duration-500">
                            <div className="flex items-center justify-between px-1">
                                <h2 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2 text-[var(--text-secondary)]">
                                    <Filter size={16} className="text-[#f1812e]/50" /> CÁC MÁY THI ĐẤU
                                </h2>
                                <span className="text-[10px] font-bold text-[var(--text-secondary)]">{Object.keys(replays[selectedDate].streams || {}).length} MÁY</span>
                            </div>
                            <div className="grid grid-cols-1 gap-2.5 max-h-[45vh] overflow-y-auto pr-2 scrollbar-thin">
                                {Object.entries(replays[selectedDate].streams || {}).map(([s_id, meta]) => (
                                    <div
                                        key={s_id}
                                        onClick={() => setSelectedStream(s_id)}
                                        className={`group relative flex flex-col p-4 rounded-2xl transition-all duration-300 border cursor-pointer ${selectedStream === s_id
                                            ? 'bg-[#f1812e] text-[#fff] border-transparent shadow-2xl'
                                            : 'bg-[var(--bg-card)] border-[var(--border-color)] hover:border-[#f1812e]/30 text-[var(--text-secondary)]'
                                            }`}
                                    >
                                        <div className="flex justify-between items-center w-full mb-2">
                                            {editingStreamId === s_id ? (
                                                <div className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
                                                    <select
                                                        value={tempPlayerName}
                                                        onChange={(e) => setTempPlayerName(e.target.value)}
                                                        className="flex-1 bg-[var(--bg-main)] border border-[#fff]/20 rounded-lg py-1 px-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none"
                                                        autoFocus
                                                    >
                                                        <option value="">Chọn người chơi...</option>
                                                        {allPlayers.map(p => (
                                                            <option key={p.id} value={p.name}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleSavePlayerName(selectedDate, s_id, tempPlayerName);
                                                        }}
                                                        className="p-1 hover:bg-white/10 rounded"
                                                    >
                                                        <Check size={14} className="text-emerald-400" />
                                                    </button>
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingStreamId(null);
                                                        }}
                                                        className="p-1 hover:bg-white/10 rounded"
                                                    >
                                                        <X size={14} className="text-red-400" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-black font-outfit uppercase tracking-tight text-sm ${selectedStream === s_id ? 'text-[#fff]' : 'text-[var(--text-primary)]'}`}>
                                                            {meta.display_name || playerNames[s_id] || s_id}
                                                        </span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingStreamId(s_id);
                                                                setTempPlayerName(meta.display_name || playerNames[s_id] || '');
                                                            }}
                                                            className={`p-1 rounded opacity-30 hover:opacity-100 transition-opacity ${selectedStream === s_id ? 'hover:bg-black/20' : 'hover:bg-white/10'}`}
                                                        >
                                                            <Edit2 size={12} />
                                                        </button>
                                                    </div>
                                                    <span className={`text-[9px] font-black font-mono uppercase tracking-tighter ${selectedStream === s_id ? 'text-[#fff]/40' : 'text-[var(--text-secondary)] opacity-50'}`}>{s_id}</span>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2.5">
                                            <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest ${selectedStream === s_id ? 'text-[#fff]/70' : 'text-[var(--text-secondary)] opacity-70'}`}>
                                                <Clock size={12} className={selectedStream === s_id ? 'text-[#fff]/70' : 'text-[#f1812e]/60'} />
                                                {meta.duration_minutes} PHÚT
                                            </div>
                                            <div className={`w-1 h-1 rounded-full ${selectedStream === s_id ? 'bg-[#fff]/20' : 'bg-[var(--border-color)]'}`} />
                                            <span className={`text-[10px] font-bold uppercase tracking-widest ${selectedStream === s_id ? 'text-[#fff]/70' : 'text-[var(--text-secondary)] opacity-40'}`}>Đã lưu</span>
                                        </div>
                                        {selectedStream === s_id && (
                                            <>
                                                <div className="absolute right-4 bottom-4 p-1 bg-[#0B0E14] rounded-full text-[#fff] shadow-lg">
                                                    <Play size={10} fill="currentColor" />
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(selectedDate, s_id);
                                                    }}
                                                    className="absolute right-12 bottom-4 p-1 bg-[#fff] hover:bg-red-500 rounded-full text-red-500 hover:text-white transition-all shadow-lg border border-red-500/30"
                                                    title="Xoá máy này"
                                                >
                                                    <Trash2 size={10} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Quản lý dữ liệu (Action Card) */}
                    {selectedDate && replays[selectedDate] && (
                        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] p-5 shadow-sm animate-in fade-in slide-in-from-right-2 duration-300">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-[11px] sm:text-xs font-black text-[var(--accent-secondary)] truncate">Quản lý dữ liệu ngày {selectedDate}</h3>
                                {replays[selectedDate].status === 'processing' && (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-yellow-500/20 text-yellow-500 rounded-md border border-yellow-500/20">
                                        <span className="text-[8px] font-black uppercase tracking-tighter">Đang xử lý</span>
                                        <div className="w-1 h-1 bg-yellow-500 rounded-full animate-pulse" />
                                    </div>
                                )}
                            </div>

                            {replays[selectedDate].status === 'processing' && (
                                <div className="mb-5 space-y-2">
                                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-tighter text-[#f1812e]">
                                        <span>{replays[selectedDate].progress_text || 'Đang xử lý...'}</span>
                                        <span>{replays[selectedDate].progress_percent || 0}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-[var(--bg-main)] rounded-full overflow-hidden border border-[var(--border-color)]">
                                        <div
                                            className="h-full bg-[#f1812e] transition-all duration-500 shadow-[0_0_10px_rgba(201,160,80,0.5)]"
                                            style={{ width: `${replays[selectedDate].progress_percent || 0}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                {replays[selectedDate].status !== 'completed' && (
                                    <button
                                        onClick={() => {
                                            setAuthModal({
                                                isOpen: true,
                                                title: 'Tổng hợp dữ liệu video',
                                                description: 'Để tránh spam nhiều lần và tối ưu tài nguyên máy chủ, vui lòng nhập mật khẩu để bắt đầu quá trình tổng hợp file MP4/HLS.',
                                                onConfirm: (password) => {
                                                    if (password !== '1234567890') {
                                                        alert('Mật khẩu không đúng!');
                                                        return;
                                                    }
                                                    fetch(`/api/v1/merge/${selectedDate}`, { method: 'POST' });
                                                    alert('Đã bắt đầu quá trình tổng hợp video (HLS & MP4)...');
                                                    setReplays(prev => ({
                                                        ...prev,
                                                        [selectedDate]: { ...prev[selectedDate], status: 'processing', progress_percent: 5, progress_text: 'Đang bắt đầu...' }
                                                    }));
                                                    setAuthModal(prev => ({ ...prev, isOpen: false }));
                                                }
                                            });
                                        }}
                                        disabled={replays[selectedDate].status === 'processing'}
                                        className={`w-full py-3 text-[10px] font-black rounded-xl border transition-all uppercase tracking-widest flex items-center justify-center gap-2 group/btn cursor-pointer ${replays[selectedDate].status === 'processing'
                                            ? 'bg-[#f1812e] text-[#fff] border-[#f1812e] cursor-not-allowed'
                                            : 'bg-[#f1812e] text-[#fff] border-[#f1812e]'
                                            }`}
                                    >
                                        <HardDrive size={14} className={`${replays[selectedDate].status === 'processing' ? 'animate-spin' : 'group-hover/btn:scale-110 transition-transform'}`} />
                                        {replays[selectedDate].status === 'processing' ? 'Đang Xử Lý...' : 'Tổng Hợp File'}
                                    </button>
                                )}

                                <button
                                    onClick={() => handleDelete(selectedDate)}
                                    className="w-full py-3 text-[10px] font-bold rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-500/70 hover:text-red-500 transition-all uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <Trash2 size={14} />
                                    Xoá Ngày Này
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. Player Information (Metadata Card) (Order 3 on Mobile, Below video on Desktop) */}
                <div className="xl:col-span-8 order-3 space-y-6">
                    {currentVideo && (
                        <div className="bg-[var(--bg-card)] rounded-[40px] border border-[var(--border-color)] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
                            {/* Header / Banner area */}
                            <div className="h-24 bg-gradient-to-r from-orange-500/10 via-[#f1812e]/5 to-transparent border-b border-[var(--border-color)] relative overflow-hidden hidden md:block">
                                <div className="absolute inset-0 flex items-center px-10">
                                    <h2 className="text-xl font-black uppercase tracking-widest text-[var(--accent-secondary)]">
                                        Thông tin người chơi: <span className="text-[#f1812e]">{playerStats?.name}</span>
                                    </h2>
                                </div>
                                <div className="absolute top-0 right-0 w-64 h-64 bg-[#f1812e]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                            </div>

                            <div className="p-8 md:p-10">
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                                    {/* Column 1: Match Info */}
                                    <div className="lg:col-span-4 space-y-6">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 rounded-2xl bg-[#f1812e]/10 flex items-center justify-center text-[#f1812e]">
                                                <Archive size={20} />
                                            </div>
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Thông tin bản ghi</h4>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center gap-4 group">
                                                <div className="w-8 h-8 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-secondary)] group-hover:text-[#f1812e] transition-colors">
                                                    <Calendar size={14} />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black opacity-30 uppercase tracking-tighter">Ngày thi đấu</p>
                                                    <p className="text-xs font-bold text-[var(--accent-secondary)]">{selectedDate}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 group">
                                                <div className="w-8 h-8 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-secondary)] group-hover:text-[#f1812e] transition-colors">
                                                    <Clock size={14} />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black opacity-30 uppercase tracking-tighter">Thời lượng</p>
                                                    <p className="text-xs font-bold text-[var(--accent-secondary)]">{currentVideo.duration_minutes} PHÚT</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 group">
                                                <div className="w-8 h-8 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-secondary)] group-hover:text-[#f1812e] transition-colors">
                                                    <HardDrive size={14} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[9px] font-black opacity-30 uppercase tracking-tighter">Nguồn dữ liệu</p>
                                                    <p className="text-xs font-bold text-[var(--accent-secondary)] truncate opacity-70" title={currentVideo.hls || currentVideo.file}>{currentVideo.hls || currentVideo.file}</p>
                                                </div>
                                            </div>

                                            <div className="pt-2">
                                                <span className="px-3 py-1 bg-green-500/10 text-green-500 border border-green-500/20 rounded-full text-[9px] font-black uppercase tracking-widest">
                                                    Dữ liệu đã sẵn sàng
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Column 2: Player Info */}
                                    <div className="lg:col-span-4 space-y-6">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                                                <Monitor size={20} />
                                            </div>
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Tên người chơi</h4>
                                        </div>

                                        <div className="flex flex-col items-center md:items-start gap-4">
                                            <div className="relative group/avatar">
                                                <div className="w-20 h-20 rounded-[30px] bg-gradient-to-br from-[#f1812e] to-[#ff8c37] flex items-center justify-center text-white text-3xl font-black shadow-2xl shadow-orange-500/20 group-hover:scale-105 transition-transform duration-500">
                                                    {playerStats?.name.charAt(0).toUpperCase()}
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black font-outfit text-[var(--accent-secondary)]">{playerStats?.name}</h3>
                                                {currentPlayerInfo && (
                                                    <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-40 mt-2 uppercase">
                                                        Tham gia từ: {new Date(currentPlayerInfo.created_at).toLocaleDateString('vi-VN')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Column 3: Stats */}
                                    <div className="lg:col-span-4 space-y-6">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                                <Trophy size={20} />
                                            </div>
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Thành tích tổng quát</h4>
                                        </div>

                                        <div className="bg-[var(--bg-main)]/50 border border-[var(--border-color)] rounded-3xl p-6 relative overflow-hidden group">
                                            <div className="space-y-6 relative z-10">
                                                {/* Match Stats */}
                                                <div>
                                                    <p className="text-[10px] font-black opacity-30 uppercase tracking-widest mb-3">Thống kê kèo đấu (Series)</p>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="text-center p-3 rounded-2xl bg-green-500/5 border border-green-500/10">
                                                            <p className="text-[9px] font-black text-green-500 uppercase tracking-tighter mb-1">Thắng Kèo</p>
                                                            <p className="text-2xl font-black font-outfit tabular-nums text-green-500">{playerStats?.wins}</p>
                                                        </div>
                                                        <div className="text-center p-3 rounded-2xl bg-red-500/5 border border-red-500/10">
                                                            <p className="text-[9px] font-black text-red-500 uppercase tracking-tighter mb-1">Thua Kèo</p>
                                                            <p className="text-2xl font-black font-outfit tabular-nums text-red-500">{playerStats?.losses}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Game/Map Stats */}
                                                <div>
                                                    <p className="text-[10px] font-black opacity-30 uppercase tracking-widest mb-3">Thống kê số trận)</p>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)]">
                                                            <span className="text-[9px] font-black opacity-40 uppercase">Thắng</span>
                                                            <span className="text-lg font-black font-outfit text-green-500">{playerStats?.gamesWon}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)]">
                                                            <span className="text-[9px] font-black opacity-40 uppercase">Thua</span>
                                                            <span className="text-lg font-black font-outfit text-red-500">{playerStats?.gamesLost}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-end px-1">
                                                        <span className="text-[10px] font-black opacity-40 uppercase tracking-widest">Hiệu suất thắng kèo</span>
                                                        <span className="text-lg font-black font-outfit text-[#f1812e]">{playerStats?.winRate}%</span>
                                                    </div>
                                                    <div className="h-2 w-full bg-[var(--bg-main)] rounded-full overflow-hidden border border-[var(--border-color)]">
                                                        <div 
                                                            className="h-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(241,129,46,0.5)]"
                                                            style={{ width: `${playerStats?.winRate}%` }}
                                                        />
                                                    </div>
                                                    <p className="text-[9px] font-bold text-center opacity-30 uppercase tracking-tighter">
                                                        Dựa trên {playerStats?.total} kèo đấu toàn thời gian
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Auth Modal */}
            <PasswordModal 
                isOpen={authModal.isOpen}
                title={authModal.title}
                description={authModal.description}
                onClose={() => setAuthModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={authModal.onConfirm}
            />
        </div>
    );
};

export default PlaybackView;
