import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, UserPlus, Loader2, AlertCircle, Search } from 'lucide-react';

const PlayerManagementView = () => {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (!window.confirm('Bạn có chắc chắn muốn xóa người chơi này?')) return;
    
    try {
      const response = await fetch(`/api/v1/players-db/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Lỗi khi xóa');
      fetchPlayers();
    } catch (err) {
      alert(err.message);
    }
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
                <table className="w-full text-left">
                  <thead className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                    <tr>
                      <th className="px-6 py-4">Tên người chơi</th>
                      <th className="px-6 py-4">Ngày thêm</th>
                      <th className="px-6 py-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-bold divide-y divide-[var(--border-color)]">
                    {filteredPlayers.map((player) => (
                      <tr key={player.id} className="hover:bg-[var(--bg-main)]/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#f1812e]/10 border border-[#f1812e]/20 flex items-center justify-center text-[#f1812e] text-xs font-black">
                              {player.name.charAt(0).toUpperCase()}
                            </div>
                            {player.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs opacity-50">
                          {new Date(player.created_at).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDeletePlayer(player.id)}
                            className="p-2 rounded-lg text-red-500 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerManagementView;
