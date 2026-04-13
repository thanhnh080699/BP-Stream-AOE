import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Users, X, Calendar, Trophy, Save, Loader2, LayoutTemplate, Edit3, Check } from 'lucide-react';
import PasswordModal from './PasswordModal';

const ScoreboardView = () => {
  const [scores, setScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [playersList, setPlayersList] = useState([]);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingDateGroup, setEditingDateGroup] = useState(null); // { old_date, new_date }
  
  // Auth Modal State
  const [authModal, setAuthModal] = useState({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });
  
  // Form state
  const [formData, setFormData] = useState({
    match_date: new Date().toISOString().split('T')[0],
    match_type: 'Kèo đấu',
    team_a_players: '',
    team_b_players: '',
    score_a: 0,
    score_b: 0
  });

  const fetchScores = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/scores');
      if (!response.ok) throw new Error('Không thể tải dữ liệu tỷ số');
      const data = await response.json();
      setScores(data || {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayers = async () => {
    try {
      const response = await fetch('/api/v1/players-db');
      if (!response.ok) throw new Error('Không thể tải danh sách thành viên');
      const data = await response.json();
      setPlayersList(data || []);
    } catch (err) {
      console.error('Lỗi tải players:', err);
    }
  };

  useEffect(() => {
    fetchScores();
    fetchPlayers();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const togglePlayer = (teamKey, playerName) => {
    const currentMembers = formData[teamKey] ? formData[teamKey].split(',').map(s => s.trim()).filter(s => s) : [];
    let newMembers;
    
    if (currentMembers.includes(playerName)) {
      newMembers = currentMembers.filter(m => m !== playerName);
    } else {
      newMembers = [...currentMembers, playerName];
    }
    
    setFormData(prev => ({ ...prev, [teamKey]: newMembers.join(', ') }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.team_a_players || !formData.team_b_players) return;
    
    try {
      const isEditing = editingId !== null;
      const url = isEditing ? `/api/v1/scores/${editingId}` : '/api/v1/scores';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) throw new Error('Lỗi khi lưu tỷ số');
      
      setIsAdding(false);
      setEditingId(null);
      setFormData({
        match_date: new Date().toISOString().split('T')[0],
        match_type: 'Kèo đấu',
        team_a_players: '',
        team_b_players: '',
        score_a: 0,
        score_b: 0
      });
      fetchScores();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleBulkDateUpdate = async () => {
    if (!editingDateGroup || !editingDateGroup.new_date) return;
    
    try {
      const response = await fetch('/api/v1/scores/bulk-update-date', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_date: editingDateGroup.old_date,
          new_date: editingDateGroup.new_date
        })
      });
      
      if (!response.ok) throw new Error('Lỗi khi cập nhật ngày');
      
      setEditingDateGroup(null);
      fetchScores();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEdit = (match) => {
    setFormData({
      match_date: match.match_date,
      match_type: match.match_type,
      team_a_players: match.team_a_players,
      team_b_players: match.team_b_players,
      score_a: match.score_a,
      score_b: match.score_b
    });
    setEditingId(match.id);
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa kết quả trận đấu này?')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/scores/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Lỗi khi xóa');
      fetchScores();
    } catch (err) {
      alert(err.message);
    }
  };

  const getSelected = (teamKey) => formData[teamKey] ? formData[teamKey].split(',').map(s => s.trim()).filter(s => s) : [];

  const PlayerPicker = ({ teamKey, colorClass }) => {
    const otherTeamKey = teamKey === 'team_a_players' ? 'team_b_players' : 'team_a_players';
    const otherTeamSelected = getSelected(otherTeamKey);

    return (
      <div className="space-y-4">
        <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest block mb-1 opacity-60">
          Chọn thành viên thi đấu
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1 scrollbar-hide">
          {playersList.length === 0 ? (
            <p className="col-span-full text-[10px] italic opacity-40 py-2">Chưa có người chơi nào trong DB</p>
          ) : (
            playersList
              .filter(p => !otherTeamSelected.includes(p.name))
              .map(player => {
                const name = player.name;
                const isSelected = getSelected(teamKey).includes(name);
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => togglePlayer(teamKey, name)}
                    className={`text-[10px] font-bold px-2 py-2 rounded-lg border transition-all truncate text-left flex items-center gap-1.5 ${
                      isSelected 
                        ? `${colorClass} border-transparent shadow-sm scale-95` 
                        : 'bg-[var(--bg-main)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[#f1812e]/50'
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-gray-400 opacity-30'}`} />
                    {name}
                  </button>
                );
              })
          )}
        </div>
        <div className="mt-2 p-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] min-h-[3rem] flex flex-wrap gap-2">
          {getSelected(teamKey).length === 0 ? (
            <span className="text-[10px] italic text-[var(--text-secondary)] opacity-40">Chưa chọn ai</span>
          ) : (
            getSelected(teamKey).map((m, i) => (
              <span key={i} className={`text-[10px] font-black px-2 py-1 rounded-md flex items-center gap-1 ${colorClass}`}>
                {m}
                <X size={10} className="cursor-pointer" onClick={() => togglePlayer(teamKey, m)} />
              </span>
            ))
          )}
        </div>
      </div>
    );
  };

  if (loading && Object.keys(scores).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[var(--text-secondary)] opacity-60">
        <Loader2 className="animate-spin mb-4" size={32} />
        <p className="font-bold uppercase tracking-widest text-xs">Đang tải bảng tỷ số...</p>
      </div>
    );
  }

  const canSave = formData.team_a_players && formData.team_b_players;

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black font-outfit text-[var(--accent-secondary)] tracking-tight uppercase leading-none mb-3">
            Bảng tỷ số
          </h2>
          <div className="text-[var(--text-secondary)] text-sm font-medium opacity-70">
            Thống kê kết quả thi đấu AOE nội bộ
          </div>
        </div>
        
        <button
          onClick={() => {
            if (isAdding) {
              setIsAdding(false);
              return;
            }
            setAuthModal({
              isOpen: true,
              title: 'Thêm kết quả thi đấu',
              description: 'Để đảm bảo dữ liệu giải đấu được chính xác và công bằng, vui lòng nhập mật khẩu quản trị để mở form nhập kết quả.',
              onConfirm: (password) => {
                if (password === '1234567890') {
                  setAuthModal(prev => ({ ...prev, isOpen: false }));
                  setIsAdding(true);
                } else {
                  alert('Mật khẩu không đúng!');
                }
              }
            });
          }}
          className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl hover:scale-105 active:scale-95 ${
            isAdding ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-color)]' : 'bg-[#f1812e] text-white'
          }`}
        >
          {isAdding ? <X size={20} /> : <Plus size={20} />}
          <span>{isAdding ? (editingId ? 'Hủy sửa' : 'Đóng') : 'Thêm / Sửa kết quả'}</span>
        </button>
      </div>

      {isAdding && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[32px] p-8 md:p-12 shadow-2xl animate-in zoom-in-95 duration-300">
          <form onSubmit={handleSubmit} className="space-y-10 text-center">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest block mb-2 opacity-60">Ngày thi đấu</label>
                <div className="relative">
                  <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 text-[#f1812e]" size={20} />
                  <input
                    type="date"
                    name="match_date"
                    value={formData.match_date}
                    onChange={handleInputChange}
                    className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-2xl py-4 pl-14 pr-6 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#f1812e]/30 transition-all"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
              {/* Team A */}
              <div className="bg-[var(--bg-main)]/50 p-6 rounded-2xl border border-[var(--border-color)] space-y-6">
                <div className="flex items-center gap-3 text-orange-500">
                  <Users size={20} />
                </div>
                <PlayerPicker teamKey="team_a_players" colorClass="bg-orange-500 text-white" />
                <div className="pt-4 border-t border-[var(--border-color)]">
                  <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest block mb-2 opacity-60">Tỷ số</label>
                  <input
                    type="number"
                    name="score_a"
                    value={formData.score_a}
                    onChange={handleInputChange}
                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl py-4 text-2xl font-black text-center focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  />
                </div>
              </div>

              {/* Team B */}
              <div className="bg-[var(--bg-main)]/50 p-6 rounded-2xl border border-[var(--border-color)] space-y-6">
                <div className="flex items-center gap-3 text-blue-500">
                  <Users size={20} />
                </div>
                <PlayerPicker teamKey="team_b_players" colorClass="bg-blue-500 text-white" />
                <div className="pt-4 border-t border-[var(--border-color)]">
                  <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest block mb-2 opacity-60">Tỷ số</label>
                  <input
                    type="number"
                    name="score_b"
                    value={formData.score_b}
                    onChange={handleInputChange}
                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl py-4 text-3xl font-black text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={!canSave}
              className={`inline-flex items-center gap-3 px-12 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl ${
                canSave 
                ? 'bg-[#f1812e] text-white hover:bg-[#d96d1c] hover:scale-105 active:scale-95 shadow-orange-900/20' 
                : 'bg-gray-500/20 text-gray-500 cursor-not-allowed opacity-50 grayscale'
              }`}
            >
              <Save size={18} />
              {editingId ? 'CẬP NHẬT KẾT QUẢ' : 'LƯU KẾT QUẢ THI ĐẤU'}
            </button>
          </form>
        </div>
      )}

      {/* Results List */}
      <div className="grid grid-cols-1 gap-10">
        {Object.keys(scores).length === 0 ? (
          <div className="py-20 text-center opacity-30 bg-[var(--bg-card)] rounded-[32px] border border-dashed border-[var(--border-color)]">
            <Trophy size={64} className="mx-auto mb-6 opacity-10" />
            <div className="font-black uppercase tracking-[0.3em] text-sm">Chưa có dữ liệu thống kê</div>
          </div>
        ) : (
          Object.keys(scores).sort((a, b) => new Date(b) - new Date(a)).map(date => (
            <div key={date} className="flex flex-col bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[32px] overflow-hidden shadow-xl hover:shadow-2xl transition-all h-fit animate-in fade-in slide-in-from-bottom-2">
              <div className="p-6 bg-[var(--bg-main)]/50 border-b border-[var(--border-color)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="p-2 bg-[#f1812e]/10 rounded-lg cursor-pointer hover:bg-[#f1812e]/20 transition-colors"
                    onClick={() => setEditingDateGroup({ old_date: date, new_date: date })}
                    title="Đổi ngày cho tất cả các trận này"
                  >
                    <Calendar className="text-[#f1812e]" size={16} />
                  </div>
                  {editingDateGroup?.old_date === date ? (
                    <div className="flex items-center gap-2 animate-in slide-in-from-left-2">
                      <input 
                        type="date" 
                        className="bg-[var(--bg-card)] border border-[#f1812e]/50 rounded-lg px-2 py-1 text-xs font-black focus:outline-none focus:ring-2 focus:ring-[#f1812e]/30"
                        value={editingDateGroup.new_date}
                        onChange={(e) => setEditingDateGroup(prev => ({ ...prev, new_date: e.target.value }))}
                        autoFocus
                      />
                      <button onClick={handleBulkDateUpdate} className="p-1 text-green-500 hover:bg-green-500/10 rounded-md transition-all">
                        <Check size={18} />
                      </button>
                      <button onClick={() => setEditingDateGroup(null)} className="p-1 text-red-500 hover:bg-red-500/10 rounded-md transition-all">
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <span className="font-black text-sm uppercase tracking-tight">
                      {new Date(date).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="px-2.5 py-1 bg-[#f1812e]/10 rounded-full text-[#f1812e] text-[9px] font-black uppercase tracking-tighter">
                    {scores[date].length} Kèo đấu
                  </div>
                </div>
              </div>
              
              <div className="p-6 space-y-6 max-h-[600px] overflow-y-auto scrollbar-thin">
                {[...scores[date]].sort((a, b) => b.id - a.id).map((match, idx) => (
                  <div key={match.id} className="relative bg-[var(--bg-main)]/40 rounded-[24px] p-4 md:p-5 border border-[var(--border-color)]/30 group hover:border-[#f1812e]/40 transition-all flex items-center min-h-[100px]">
                    <div className="w-full flex items-center justify-between gap-6 md:gap-16">
                      {/* Team A Players */}
                      <div className="flex-1 text-right">
                        <div className="flex flex-nowrap justify-end gap-1.5 mb-3 overflow-x-hidden">
                          {match.team_a_players.split(',').map((p, i) => (
                            <span key={i} className="px-2.5 py-1 bg-orange-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-orange-500/10 whitespace-nowrap">{p.trim()}</span>
                          ))}
                        </div>
                        {/* TEAM A labels removed */}
                      </div>

                      {/* Score Badge */}
                      <div className="flex flex-col items-center justify-center min-w-[100px] bg-[var(--bg-card)] rounded-[20px] py-3 px-3 border border-[var(--border-color)] shadow-xl relative z-10">
                        <div className="text-2xl font-black font-outfit tracking-tighter flex items-center gap-3">
                          <span className={match.score_a > match.score_b ? 'text-orange-500' : 'text-[var(--text-primary)] opacity-40'}>{match.score_a}</span>
                          <span className="opacity-10">:</span>
                          <span className={match.score_b > match.score_a ? 'text-blue-500' : 'text-[var(--text-primary)] opacity-40'}>{match.score_b}</span>
                        </div>
                      </div>

                      {/* Team B Players */}
                      <div className="flex-1 text-left">
                        <div className="flex flex-nowrap justify-start gap-1.5 mb-3 overflow-x-hidden">
                          {match.team_b_players.split(',').map((p, i) => (
                            <span key={i} className="px-2.5 py-1 bg-blue-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-500/10 whitespace-nowrap">{p.trim()}</span>
                          ))}
                        </div>
                        {/* TEAM B labels removed */}
                      </div>
                    </div>
                    
                    <div className="absolute -top-2 -right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => handleEdit(match)}
                        className="p-2 bg-blue-500 text-white rounded-xl shadow-xl hover:scale-110 active:scale-90"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(match.id)}
                        className="p-2 bg-red-500 text-white rounded-xl shadow-xl hover:scale-110 active:scale-90"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Stats Summary Footer */}
      {Object.keys(scores).length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-20 md:left-auto md:right-10 md:translate-x-0">
          <div className="bg-[var(--bg-sidebar)] border border-[var(--border-color)] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-8 animate-in slide-in-from-right-4">
            <div className="flex items-center gap-3">
              <Trophy className="text-yellow-500" size={20} />
              <div>
                <div className="text-[10px] font-black opacity-40 uppercase tracking-widest leading-none mb-1">Tổng số trận</div>
                <div className="text-sm font-black font-outfit leading-none">
                  {Object.values(scores).flat().length}
                </div>
              </div>
            </div>
            <div className="w-px h-8 bg-[var(--border-color)] opacity-50" />
            <div className="flex items-center gap-3 text-[#f1812e]">
              <Users size={20} />
              <div>
                <div className="text-[10px] font-black opacity-40 uppercase tracking-widest leading-none mb-1">Cập nhật lúc</div>
                <div className="text-sm font-black font-outfit leading-none">
                  {new Date().toLocaleTimeString('vi-VN')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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

export default ScoreboardView;
