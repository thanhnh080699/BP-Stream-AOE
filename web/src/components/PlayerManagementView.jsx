import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, UserPlus, Loader2, AlertCircle, Search, Edit2, Check, X as CloseIcon } from 'lucide-react';
import PasswordModal from './PasswordModal';

const PlayerManagementView = () => {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  
  // Auth Modal State
  const [authModal, setAuthModal] = useState({
      isOpen: false,
      title: '',
      description: '',
      onConfirm: () => {}
  });

  const fetchPlayers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/players-db');
      if (!response.ok) throw new Error('Không thể tải danh sách người chơi');
      const data = await response.json();
      setPlayers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  const handleAddPlayer = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/v1/players-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Lỗi khi thêm người chơi');
      }
      
      setName('');
      fetchPlayers();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePlayer = async (id) => {
    setAuthModal({
      isOpen: true,
      title: 'Xóa thành viên thi đấu',
      description: 'Hành động này sẽ xóa người chơi khỏi cơ sở dữ liệu. Vui lòng nhập mật khẩu xác thực để thực hiện.',
      onConfirm: async (password) => {
        if (password !== '1234567890') {
          alert('Mật khẩu không đúng!');
          return;
        }

        try {
          const response = await fetch(`/api/v1/players-db/${id}`, {
            method: 'DELETE'
          });
          if (!response.ok) throw new Error('Lỗi khi xóa');
          setAuthModal(prev => ({ ...prev, isOpen: false }));
          fetchPlayers();
        } catch (err) {
          alert(err.message);
        }
      }
    });
  };

  const handleUpdatePlayer = async (id, newName) => {
    if (!newName.trim()) return;
    
    setAuthModal({
      isOpen: true,
      title: 'Cập nhật tên thành viên',
      description: `Bạn đang đổi tên thành viên thành "${newName}". Vui lòng nhập mật khẩu xác thực.`,
      onConfirm: async (password) => {
        if (password !== '1234567890') {
          alert('Mật khẩu không đúng!');
          return;
        }

        try {
          const response = await fetch(`/api/v1/players-db/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName.trim() })
          });
          
          if (!response.ok) throw new Error('Lỗi khi cập nhật');
          setEditingId(null);
          setAuthModal(prev => ({ ...prev, isOpen: false }));
          fetchPlayers();
        } catch (err) {
          alert(err.message);
        }
      }
    });
  };

  const filteredPlayers = players.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black font-outfit text-[var(--accent-secondary)] tracking-tight uppercase leading-none mb-3">
            Cài đặt người chơi
          </h2>
          <p className="text-[var(--text-secondary)] text-sm font-medium opacity-70">
            Quản lý danh sách thành viên thi đấu AOE
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Add Player Form */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 shadow-xl sticky top-8">
            <div className="flex items-center gap-3 text-[#f1812e] mb-6">
              <UserPlus size={20} />
              <h3 className="font-bold uppercase tracking-tight text-sm">Thêm thành viên</h3>
            </div>
            
            <form onSubmit={handleAddPlayer} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest ml-1">Tên người chơi</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Chim Sẻ Đi Nắng"
                  className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl py-3 px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#f1812e]/30 transition-all"
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-[#f1812e] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#d96d1c] transition-all disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                <span>THÊM MỚI</span>
              </button>
            </form>
          </div>
        </div>

        {/* Players List */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-main)]/30">
              <div className="flex items-center gap-3">
                <Users className="text-[#f1812e]" size={20} />
                <span className="font-bold text-sm uppercase tracking-tight">Danh sách ({players.length})</span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-40" size={14} />
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg py-1.5 pl-9 pr-4 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#f1812e]/50 w-40 md:w-60 transition-all"
                />
              </div>
            </div>

            <div className="max-h-[600px] overflow-y-auto">
              {loading && players.length === 0 ? (
                <div className="p-12 text-center opacity-40">
                  <Loader2 className="animate-spin mx-auto mb-4" size={24} />
                  <p className="text-xs font-bold uppercase tracking-widest">Đang tải...</p>
                </div>
              ) : filteredPlayers.length === 0 ? (
                <div className="p-12 text-center opacity-40">
                  <Users className="mx-auto mb-4" size={32} />
                  <p className="text-xs font-bold uppercase tracking-widest">Không tìm thấy ai</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-color)]">
                  {/* Desktop Table Header - only visible on md+ */}
                  <div className="hidden md:grid grid-cols-12 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border-color)] bg-[var(--bg-main)]/10">
                    <div className="col-span-6 px-6 py-4">Tên người chơi</div>
                    <div className="col-span-3 px-6 py-4">Ngày thêm</div>
                    <div className="col-span-3 px-6 py-4 text-right">Thao tác</div>
                  </div>

                  {filteredPlayers.map((player) => (
                    <div key={player.id} className="grid grid-cols-1 md:grid-cols-12 items-center hover:bg-[var(--bg-main)]/50 transition-colors group p-4 md:p-0">
                      {/* Name Section */}
                      <div className="col-span-full md:col-span-6 md:px-6 md:py-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#f1812e]/10 border border-[#f1812e]/20 flex items-center justify-center text-[#f1812e] text-xs font-black shrink-0">
                          {player.name.charAt(0).toUpperCase()}
                        </div>
                        {editingId === player.id ? (
                          <div className="flex items-center gap-2 flex-1 animate-in slide-in-from-left-1 duration-200">
                            <input
                              autoFocus
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="flex-1 bg-[var(--bg-main)] border border-[#f1812e]/50 rounded-lg py-1.5 px-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#f1812e]/30"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdatePlayer(player.id, editingName);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                            />
                            <button onClick={() => handleUpdatePlayer(player.id, editingName)} className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-md transition-colors">
                              <Check size={18} />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-md transition-colors">
                              <CloseIcon size={18} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[var(--text-primary)] font-bold text-base md:text-sm">{player.name}</span>
                        )}
                      </div>

                      {/* Date Section - hidden or moved on mobile */}
                      <div className="col-span-full md:col-span-3 md:px-6 md:py-4 text-[10px] md:text-xs opacity-50 mt-1 md:mt-0 pl-11 md:pl-6">
                        <span className="md:hidden">Thêm ngày: </span>
                        {new Date(player.created_at).toLocaleDateString('vi-VN')}
                      </div>

                      {/* Actions Section */}
                      <div className="col-span-full md:col-span-3 md:px-6 md:py-4 text-right mt-3 md:mt-0">
                        <div className="flex items-center justify-end gap-2">
                          {editingId !== player.id && (
                            <button
                              onClick={() => {
                                setEditingId(player.id);
                                setEditingName(player.name);
                              }}
                              className="p-2.5 md:p-2 rounded-xl border border-[var(--border-color)] md:border-transparent md:bg-transparent bg-[var(--bg-main)] text-[var(--text-secondary)] hover:bg-[#f1812e]/10 hover:text-[#f1812e] transition-all md:opacity-0 md:group-hover:opacity-100 flex items-center gap-2 text-xs font-bold"
                            >
                              <Edit2 size={16} />
                              <span className="md:hidden uppercase tracking-tight">Sửa</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleDeletePlayer(player.id)}
                            className="p-2.5 md:p-2 rounded-xl border border-[var(--border-color)] md:border-transparent md:bg-transparent bg-red-500/5 text-red-500 hover:bg-red-500 hover:text-white transition-all md:opacity-0 md:group-hover:opacity-100 flex items-center gap-2 text-xs font-bold"
                          >
                            <Trash2 size={16} />
                            <span className="md:hidden uppercase tracking-tight">Xóa</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
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

export default PlayerManagementView;
