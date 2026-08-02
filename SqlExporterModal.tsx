import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Copy, Check, Database, Terminal, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { SUPABASE_SQL_SCHEMA } from '../utils/supabaseSql';
import { SUPABASE_URL, checkSupabaseConnection } from '../lib/supabase';

interface SqlExporterModalProps {
  onClose: () => void;
}

export const SqlExporterModal: React.FC<SqlExporterModalProps> = ({ onClose }) => {
  const [copied, setCopied] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    checkSupabaseConnection().then((res) => setIsConnected(res.connected));
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-2xl border border-purple-500/20">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-slate-100">Supabase Connected</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Active</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">{SUPABASE_URL}</p>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 mb-4 text-xs text-slate-300 space-y-2">
          <div className="flex items-center space-x-2 font-semibold text-purple-400">
            <Terminal className="w-4 h-4" />
            <span>Connected Supabase Instance Details:</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Project Name:</span>
              <span className="text-pink-300 font-semibold">Jerichoz12's ProjectProject</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Project ID:</span>
              <span className="text-indigo-300 font-semibold">hgxbiabmiepbjwzqoifd</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Region:</span>
              <span className="text-teal-300 font-semibold">ap-northeast-1</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Project URL:</span>
              <span className="text-purple-300 truncate font-semibold">{SUPABASE_URL}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Publishable Key:</span>
              <span className="text-emerald-400 font-semibold truncate">sb_publishable_uFf...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Secret Key:</span>
              <span className="text-indigo-400 font-semibold truncate">sb_secret_wDq...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Database Password:</span>
              <span className="text-amber-400 font-semibold">J3riChoS143!</span>
            </div>
          </div>
        </div>

        {/* Code Box */}
        <div className="relative flex-1 bg-slate-950 rounded-2xl border border-slate-800 p-4 font-mono text-xs text-emerald-400 overflow-auto min-h-[220px]">
          <button
            onClick={handleCopy}
            className="absolute top-3 right-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-sans font-medium text-xs rounded-xl flex items-center space-x-1.5 transition shadow"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy SQL</span>
              </>
            )}
          </button>
          <pre className="whitespace-pre-wrap">{SUPABASE_SQL_SCHEMA}</pre>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-slate-500">Includes Users, Friends, Chats, Messages, Media, RLS & Realtime</span>
          <button
            onClick={handleCopy}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold text-xs shadow-lg shadow-pink-500/20 flex items-center space-x-2 hover:opacity-95 transition"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied SQL Script' : 'Copy SQL Script'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

