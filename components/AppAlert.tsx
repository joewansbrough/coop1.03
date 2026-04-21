import React from 'react';

interface AppAlertProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose?: () => void;
}

const ALERT_STYLES = {
  success: {
    shell: 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-300',
    icon: 'fa-circle-check text-emerald-600 dark:text-emerald-400'
  },
  error: {
    shell: 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-900/20 dark:border-rose-800/50 dark:text-rose-300',
    icon: 'fa-circle-exclamation text-rose-600 dark:text-rose-400'
  },
  info: {
    shell: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-800/50 dark:text-blue-300',
    icon: 'fa-circle-info text-blue-600 dark:text-blue-400'
  }
};

const AppAlert: React.FC<AppAlertProps> = ({ message, type = 'info', onClose }) => {
  const styles = ALERT_STYLES[type];

  return (
    <div className={`rounded-2xl border px-4 py-3 flex items-start gap-3 shadow-sm animate-in slide-in-from-top-2 duration-200 ${styles.shell}`}>
      <i className={`fa-solid ${styles.icon} text-sm mt-0.5`}></i>
      <p className="flex-1 text-sm font-bold leading-relaxed">{message}</p>
      {onClose && (
        <button onClick={onClose} className="text-current/60 hover:text-current transition-colors">
          <i className="fa-solid fa-xmark"></i>
        </button>
      )}
    </div>
  );
};

export default AppAlert;
