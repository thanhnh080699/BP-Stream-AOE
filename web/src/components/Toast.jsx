import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    setTimeout(() => {
      removeToast(id);
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 max-w-md w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

const ToastItem = ({ toast, onClose }) => {
  const { message, type } = toast;

  const styles = {
    success: {
      bg: 'bg-green-500/10 border-green-500/30 text-green-500',
      icon: <CheckCircle2 size={18} className="text-green-500 shrink-0" />,
    },
    error: {
      bg: 'bg-red-500/10 border-red-500/30 text-red-500',
      icon: <AlertCircle size={18} className="text-red-500 shrink-0" />,
    },
    warning: {
      bg: 'bg-orange-500/10 border-orange-500/30 text-orange-500',
      icon: <AlertCircle size={18} className="text-orange-500 shrink-0" />,
    },
    info: {
      bg: 'bg-blue-500/10 border-blue-500/30 text-blue-500',
      icon: <Info size={18} className="text-blue-500 shrink-0" />,
    },
  };

  const currentStyle = styles[type] || styles.info;

  return (
    <div className={`flex items-start justify-between gap-3 p-4 rounded-2xl border backdrop-blur-md shadow-2xl pointer-events-auto transition-all duration-300 animate-in slide-in-from-bottom-5 ${currentStyle.bg}`}>
      <div className="flex items-start gap-2.5">
        {currentStyle.icon}
        <span className="text-xs font-bold leading-relaxed">{message}</span>
      </div>
      <button 
        onClick={onClose} 
        className="text-current opacity-50 hover:opacity-100 transition-opacity p-0.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
};
