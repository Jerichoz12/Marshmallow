import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, X, ShieldAlert, KeyRound, ArrowRight } from 'lucide-react';

interface AdminPasswordModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminPasswordModal: React.FC<AdminPasswordModalProps> = ({
  onClose,
  onSuccess
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'J3riChoS143!') {
      onSuccess();
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center shadow-lg shadow-purple-500/10">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-100">Admin Security Gate</h3>
          <p className="text-xs text-slate-400 mt-1">
            Enter the admin password to access the Supabase SQL Export tools.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              placeholder="Enter admin password..."
              className={`w-full bg-slate-950 border rounded-2xl py-3 pl-10 pr-4 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition ${
                error
                  ? 'border-rose-500 text-rose-300 focus:border-rose-500'
                  : 'border-slate-800 focus:border-purple-500'
              }`}
              autoFocus
            />
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2"
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Incorrect Password! Access Denied.</span>
            </motion.div>
          )}

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold text-xs shadow-lg shadow-pink-500/20 flex items-center justify-center space-x-2 transition active:scale-95"
          >
            <span>Unlock Database Export</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </motion.div>
    </div>
  );
};
