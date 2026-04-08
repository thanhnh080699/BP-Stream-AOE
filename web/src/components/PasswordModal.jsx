import React, { useState } from 'react';
import { Lock, ShieldAlert, X } from 'lucide-react';

const PasswordModal = ({ isOpen, onClose, onConfirm, title, description }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!password) {
      setError('Vui lòng nhập mật khẩu');
      return;
    }
    onConfirm(password);
    setPassword('');
    setError('');
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative p-8 md:p-10">
          <button 
            onClick={handleClose}
            className="absolute top-6 right-6 p-2 text-[var(--text-secondary)] hover:text-[#f1812e] transition-colors rounded-xl bg-[var(--bg-main)]/50 border border-[var(--border-color)]"
          >
            <X size={18} />
          </button>

          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-[#f1812e]/10 rounded-2xl flex items-center justify-center text-[#f1812e] mb-6 shadow-inner">
              <Lock size={32} />
            </div>

            <h3 className="text-2xl font-black font-outfit text-[var(--accent-secondary)] uppercase tracking-tight mb-2">
              {title || 'Xác thực bảo mật'}
            </h3>
            
            <p className="text-sm font-medium text-[var(--text-secondary)] opacity-80 mb-8 leading-relaxed">
              {description}
            </p>

            <form onSubmit={handleSubmit} className="w-full space-y-6">
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] ml-1 opacity-60">
                  Mật khẩu truy cập
                </label>
                <div className="relative">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]/40" size={18} />
                  <input
                    autoFocus
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    placeholder="••••••••"
                    className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-2xl py-4 pl-14 pr-6 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#f1812e]/30 transition-all placeholder:text-[var(--text-secondary)]/20"
                  />
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-red-500 text-[10px] font-bold uppercase tracking-wider mt-2 ml-1">
                    <ShieldAlert size={12} />
                    {error}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-[var(--bg-main)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-card-hover)] transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-[#f1812e] text-white shadow-lg shadow-orange-900/20 hover:bg-[#d96d1c] hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Xác nhận
                </button>
              </div>
            </form>
          </div>
        </div>
        
        <div className="bg-[var(--bg-main)]/50 px-8 py-4 border-t border-[var(--border-color)] text-center">
            <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-40">
                Hệ thống bảo mật bởi IT Team BestPrice
            </p>
        </div>
      </div>
    </div>
  );
};

export default PasswordModal;
