import React, { useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type = 'success', duration = 3000, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const typeStyles = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800',
      icon: CheckCircle2,
      iconColor: 'text-green-600'
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: AlertCircle,
      iconColor: 'text-red-600'
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: Info,
      iconColor: 'text-blue-600'
    }
  };

  const styles = typeStyles[type];
  const Icon = styles.icon;

  return (
    <div 
      className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${styles.bg} ${styles.border} ${styles.text} min-w-[300px] max-w-[500px] transform transition-all duration-300 ease-in-out animate-in fade-in slide-in-from-top-2`}
      style={{
        animation: 'slideIn 0.3s ease-out'
      }}
    >
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
      <Icon className={`w-5 h-5 ${styles.iconColor} flex-shrink-0`} />
      <p className="flex-1 font-semibold text-sm">{message}</p>
      <button
        onClick={onClose}
        className={`flex-shrink-0 ${styles.text} hover:opacity-70 transition-opacity`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default Toast;

