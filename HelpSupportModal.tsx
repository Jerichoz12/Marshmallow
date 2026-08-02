import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, LifeBuoy, HelpCircle, ShieldCheck, ChevronDown, ChevronUp, Mail, ExternalLink, Share2 } from 'lucide-react';
import { playTouchSound } from '../utils/audioSound';

interface HelpSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpSupportModal: React.FC<HelpSupportModalProps> = ({ isOpen, onClose }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  if (!isOpen) return null;

  const EMAIL_ADDRESS = 'elo143456@gmail.com';
  const FACEBOOK_LINK = 'https://www.facebook.com/share/1D5KvmkJrK/';

  const faqs = [
    {
      q: 'How do I use my Code Number?',
      a: 'Your 6-digit Code Number is your unique login identifier on Marshmallow. It keeps your account secure and private.'
    },
    {
      q: 'Are my messages and photos secure?',
      a: 'Yes, all your chat history, photos, and account data are encrypted and safely stored in the cloud.'
    },
    {
      q: 'How do I change my Username or Profile Border?',
      a: 'Simply go to Account Settings to customize your username, avatar, or select a new animated border.'
    },
    {
      q: 'How do I add friends or search for users?',
      a: 'Use the "Search" tab or button to find other users by their username or name and send a friend request.'
    }
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                <LifeBuoy className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-100">Help & Support</h3>
                <p className="text-xs text-slate-400">Help and Information for Marshmallow</p>
              </div>
            </div>

            <button
              onClick={() => {
                playTouchSound();
                onClose();
              }}
              className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300 leading-relaxed">
            {/* Direct Official Contact Buttons */}
            <div className="space-y-3">
              <h4 className="font-bold text-slate-100 text-sm">
                <span>Contact Official Support</span>
              </h4>

              <div className="grid grid-cols-1 gap-3">
                {/* Facebook Direct Link */}
                <a
                  href={FACEBOOK_LINK}
                  onClick={playTouchSound}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-2xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/40 transition flex items-center justify-between group cursor-pointer shadow-md"
                >
                  <div className="overflow-hidden">
                    <p className="font-extrabold text-slate-100 text-xs">Official Facebook</p>
                    <p className="text-[11px] text-slate-400 truncate">Click to open Facebook profile</p>
                  </div>
                </a>
              </div>
            </div>

            {/* FAQ Accordion Section */}
            <div className="space-y-3">
              <h4 className="font-bold text-slate-100 text-sm">
                <span>Frequently Asked Questions (FAQ)</span>
              </h4>

              <div className="space-y-2">
                {faqs.map((faq, i) => (
                  <div
                    key={i}
                    className="border border-slate-800 rounded-2xl bg-slate-950/60 overflow-hidden transition"
                  >
                    <button
                      onClick={() => {
                        playTouchSound();
                        setOpenFaq(openFaq === i ? null : i);
                      }}
                      className="w-full p-3.5 text-left font-bold text-slate-200 text-xs flex items-center justify-between hover:bg-slate-800/40 transition cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      {openFaq === i ? (
                        <ChevronUp className="w-4 h-4 text-pink-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                    </button>
                    {openFaq === i && (
                      <div className="px-3.5 pb-3.5 pt-1 text-slate-400 text-xs border-t border-slate-800/50 leading-relaxed">
                        {faq.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Privacy & Security Note */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>Account Protection Guarantee</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Your chat history, photos, and personal data are securely stored and encrypted.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
