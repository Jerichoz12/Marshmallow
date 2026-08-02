import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShieldCheck, Lock, EyeOff, FileText, UserCheck } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-100">Privacy Policy</h3>
                <p className="text-xs text-slate-400">Marshmallow Social & Data Protection</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Policy Body */}
          <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300 leading-relaxed">
            <div className="p-4 rounded-2xl bg-pink-500/5 border border-pink-500/10 flex items-start space-x-3">
              <Lock className="w-5 h-5 text-pink-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-slate-100 text-xs mb-1">Your Data Ownership & Encryption</h4>
                <p className="text-slate-400">
                  Marshmallow Social values your privacy. All your passwords, messages, and posts are securely managed and persisted safely.
                </p>
              </div>
            </div>

            <section className="space-y-2">
              <h4 className="font-bold text-slate-200 text-sm flex items-center space-x-2">
                <EyeOff className="w-4 h-4 text-purple-400" />
                <span>Phone Number Privacy Controls ("Only Me")</span>
              </h4>
              <p className="text-slate-400">
                You have full control over who can view your contact information. You can set your phone number visibility to:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-400">
                <li><strong className="text-slate-200">Public:</strong> Visible to all users.</li>
                <li><strong className="text-slate-200">Friends:</strong> Visible only to confirmed friends.</li>
                <li><strong className="text-slate-200">Only Me:</strong> Completely hidden from all other users on the platform.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h4 className="font-bold text-slate-200 text-sm flex items-center space-x-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>Media Upload Guidelines & Limits</span>
              </h4>
              <p className="text-slate-400">
                To maintain high platform performance and safety, the following upload rules are enforced:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-400">
                <li><strong className="text-slate-200">Photo Posts:</strong> Maximum 3 photo uploads per user per day.</li>
                <li><strong className="text-slate-200">Video Posts:</strong> Maximum video duration is 1 minute (60 seconds).</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h4 className="font-bold text-slate-200 text-sm flex items-center space-x-2">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span>Community Standards</span>
              </h4>
              <p className="text-slate-400">
                Please treat all members with respect. Harassment, hateful speech, and inappropriate content are strictly prohibited.
              </p>
            </section>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-pink-500/20 transition active:scale-95"
            >
              I Understand
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
