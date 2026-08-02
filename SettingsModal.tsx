import React from 'react';
import { motion } from 'motion/react';
import { X, Moon, Sun, Bell, Shield, Info, Heart } from 'lucide-react';
import { UserSettings } from '../types';
import { updateUserSettings } from '../services/api';

interface SettingsModalProps {
  settings: UserSettings;
  onClose: () => void;
  onUpdateSettings: (newSettings: UserSettings) => void;
  onOpenSqlExporter: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onClose,
  onUpdateSettings,
  onOpenSqlExporter
}) => {
  const toggleTheme = async () => {
    const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
    const updated = { ...settings, theme: newTheme as 'dark' | 'light' };
    onUpdateSettings(updated);
    await updateUserSettings(updated);
  };

  const toggleNotifications = async () => {
    const updated = { ...settings, notificationsEnabled: !settings.notificationsEnabled };
    onUpdateSettings(updated);
    await updateUserSettings(updated);
  };

  const toggleOnlineVisibility = async () => {
    const updated = { ...settings, onlineStatusVisible: !settings.onlineStatusVisible };
    onUpdateSettings(updated);
    await updateUserSettings(updated);
  };

  const toggleReadReceipts = async () => {
    const updated = { ...settings, readReceipts: !settings.readReceipts };
    onUpdateSettings(updated);
    await updateUserSettings(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-slate-100 mb-6">Settings</h2>

        <div className="space-y-6">
          {/* Appearance Section */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              <span>Appearance</span>
            </h3>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">Theme Mode</p>
                <p className="text-xs text-slate-400">
                  Currently using <span className="capitalize text-white font-bold">{settings.theme}</span> mode
                </p>
              </div>
              <button
                onClick={toggleTheme}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 font-bold text-xs transition cursor-pointer"
              >
                <span>{settings.theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}</span>
              </button>
            </div>
          </div>

          {/* Notifications Section */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              <span>Notifications</span>
            </h3>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">Push & Chime Alerts</p>
                <p className="text-xs text-slate-400">Play sounds for new incoming messages</p>
              </div>
              <button
                onClick={toggleNotifications}
                className={`w-12 h-6 rounded-full transition-colors relative p-1 cursor-pointer ${
                  settings.notificationsEnabled ? 'bg-white' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full transition-transform ${
                    settings.notificationsEnabled ? 'translate-x-6 bg-slate-950' : 'translate-x-0 bg-slate-400'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Privacy Section */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              <span>Privacy</span>
            </h3>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium text-slate-200">Show Active Status</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${settings.onlineStatusVisible ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                      {settings.onlineStatusVisible ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Kapag OFF, hindi makikita ng ibang users kung online o active ang account.</p>
                </div>
                <button
                  onClick={toggleOnlineVisibility}
                  className={`w-12 h-6 rounded-full transition-colors relative p-1 cursor-pointer ${
                    settings.onlineStatusVisible ? 'bg-white' : 'bg-slate-800'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full transition-transform ${
                      settings.onlineStatusVisible ? 'translate-x-6 bg-slate-950' : 'translate-x-0 bg-slate-400'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between border-t border-slate-800/60 pt-3">
                <div>
                  <p className="text-sm font-medium text-slate-200">Read Receipts</p>
                  <p className="text-xs text-slate-400">Allow others to see when you've read messages</p>
                </div>
                <button
                  onClick={toggleReadReceipts}
                  className={`w-12 h-6 rounded-full transition-colors relative p-1 cursor-pointer ${
                    settings.readReceipts ? 'bg-white' : 'bg-slate-800'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full transition-transform ${
                      settings.readReceipts ? 'translate-x-6 bg-slate-950' : 'translate-x-0 bg-slate-400'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Database Export */}
          <div>
            <button
              onClick={() => {
                onClose();
                onOpenSqlExporter();
              }}
              className="w-full py-3 px-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 text-sm font-medium flex items-center justify-between transition group cursor-pointer"
            >
              <div className="text-left">
                <p className="text-sm font-medium">Supabase SQL Database Export</p>
                <p className="text-xs text-slate-400">View generated schema & migration commands</p>
              </div>
              <span className="text-xs text-white font-semibold">
                View
              </span>
            </button>
          </div>

          {/* About Section */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 text-center">
            <h4 className="text-sm font-bold text-slate-100">Marshmallow by EchoPH</h4>
            <p className="text-xs text-slate-400 mt-1">Version 1.0.0 (Production Build)</p>
            <p className="text-xs text-slate-500 mt-2">
              <span>Crafted by EchoPH</span>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
