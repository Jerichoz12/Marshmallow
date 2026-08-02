import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  Lock,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
  CheckCircle2,
  FileText,
  X,
  UserCheck,
  Shield,
  KeyRound,
  Terminal,
  ExternalLink,
  Code2
} from 'lucide-react';
import { MarshmallowLogo } from './MarshmallowLogo';
import { LoginBackgroundVideo } from './LoginBackgroundVideo';
import {
  loginWithCodeNumber,
  loginWithGoogle,
  loginWithPassword,
  registerCodeUser
} from '../services/api';
import { User as UserType, UserSettings } from '../types';
import { playTouchSound, playSuccessSound, playErrorSound } from '../utils/audioSound';

interface AuthScreenProps {
  onSuccess: (user: UserType, settings: UserSettings) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const [authView, setAuthView] = useState<'login' | 'register' | 'developer' | 'google_prompt'>('login');
  
  // Login / Registration Form Fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [gender, setGender] = useState<'male' | 'female' | ''>('male');
  const [birthday, setBirthday] = useState<string>('');

  // Developer Login State
  const [devCodeNumber, setDevCodeNumber] = useState('');
  const [showQuestion, setShowQuestion] = useState(false);
  const [secretAnswer, setSecretAnswer] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  // Google OAuth Client Config
  const GOOGLE_CLIENT_ID = '555949619793-a311t6bc2kjjr6vq2po4snvb8jl2islt.apps.googleusercontent.com';
  const [googleEmail, setGoogleEmail] = useState('user@gmail.com');
  const [googleName, setGoogleName] = useState('Google User');
  const [googleCodeNumber, setGoogleCodeNumber] = useState('');
  const [googleCredential, setGoogleCredential] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && !document.getElementById('google-gsi-script')) {
      const script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        try {
          if ((window as any).google?.accounts?.id) {
            (window as any).google.accounts.id.initialize({
              client_id: GOOGLE_CLIENT_ID,
              callback: handleGoogleCredentialResponse,
              auto_select: false,
              use_fedcm_for_prompt: false,
            });

            const parent = document.getElementById('google-btn-container');
            if (parent) {
              (window as any).google.accounts.id.renderButton(parent, {
                theme: 'filled_black',
                size: 'large',
                width: 320,
                text: 'continue_with',
                shape: 'pill'
              });
            }
          }
        } catch (e) {
          console.warn('Google Identity initialization error:', e);
        }
      };
      document.head.appendChild(script);
    } else if (typeof window !== 'undefined' && (window as any).google?.accounts?.id) {
      try {
        const parent = document.getElementById('google-btn-container');
        if (parent) {
          (window as any).google.accounts.id.renderButton(parent, {
            theme: 'filled_black',
            size: 'large',
            width: 320,
            text: 'continue_with',
            shape: 'pill'
          });
        }
      } catch (e) {}
    }
  }, [authView]);

  const handleGoogleCredentialResponse = async (response: any) => {
    if (response?.credential) {
      try {
        setLoading(true);
        setError(null);
        let email = 'Google User';
        let name = 'Google User';
        try {
          const parts = response.credential.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            if (payload.email) {
              email = payload.email;
              setGoogleEmail(payload.email);
            }
            if (payload.name) {
              name = payload.name;
              setGoogleName(payload.name);
            }
          }
        } catch (e) {}

        setGoogleCredential(response.credential);
        setGoogleCodeNumber(name.toLowerCase().replace(/[^a-z0-9_]/g, ''));
        
        // Try direct backend authentication with verified Google credential token
        const res = await loginWithGoogle(
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          response.credential
        );
        playSuccessSound();
        setSuccessMsg(`Signed in as ${res.user.nickname || res.user.username}!`);
        setTimeout(() => {
          onSuccess(res.user, res.settings);
        }, 500);
      } catch (err: any) {
        console.warn('Google credential response error:', err);
        setAuthView('google_prompt');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleTriggerGoogleAuth = () => {
    playTouchSound();
    setError(null);
    setSuccessMsg(null);
    setAuthView('google_prompt');
  };

  // Open Privacy Policy in new tab and show modal
  const handleOpenPrivacyPolicy = () => {
    playTouchSound();
    try {
      window.open('/privacy-policy', '_blank');
    } catch (e) {
      console.log('Opened in popup fallback modal', e);
    }
    setShowPrivacyPolicy(true);
  };

  // HANDLE LOG IN SUBMIT (Username + Password REQUIRED)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      playErrorSound();
      setError('Username is required.');
      return;
    }

    if (!password.trim()) {
      playErrorSound();
      setError('Password is required to log in.');
      return;
    }

    try {
      setLoading(true);
      const res = await loginWithPassword(cleanUsername, password.trim());
      playSuccessSound();
      onSuccess(res.user, res.settings);
    } catch (err: any) {
      playErrorSound();
      setError(err.message || 'Incorrect Username or Password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // HANDLE CREATE ACCOUNT (Username + Password)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      playErrorSound();
      setError('Username is required.');
      return;
    }

    if (!password.trim()) {
      playErrorSound();
      setError('Password is required. You can use any words or numbers.');
      return;
    }

    if (password.trim().length < 4) {
      playErrorSound();
      setError('Password must be at least 4 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      playErrorSound();
      setError('Password and Confirm Password do not match.');
      return;
    }

    if (!gender) {
      playErrorSound();
      setError('Please select your Gender (Male or Female).');
      return;
    }

    if (!birthday) {
      playErrorSound();
      setError('Please select your Birth Date.');
      return;
    }

    try {
      setLoading(true);
      const res = await registerCodeUser(cleanUsername, password.trim(), gender, birthday);
      playSuccessSound();
      onSuccess(res.user, res.settings);
    } catch (err: any) {
      playErrorSound();
      setError(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  // HANDLE DEVELOPER LOG IN (Code Number 143456 / 547257 / 537212 - NO PASSWORD)
  const handleDeveloperLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanDevCode = devCodeNumber.trim().replace(/\s+/g, '');
    if (!cleanDevCode) {
      playErrorSound();
      setError('Please enter the Developer Code Number.');
      return;
    }

    const ALLOWED_DEV_CODES = ['143456', '547257', '537212'];
    if (!ALLOWED_DEV_CODES.includes(cleanDevCode)) {
      playErrorSound();
      setError('Incorrect Developer Code Number. Please try again.');
      return;
    }

    try {
      setLoading(true);
      const res = await loginWithCodeNumber(cleanDevCode);
      playSuccessSound();
      onSuccess(res.user, res.settings);
    } catch (err: any) {
      playErrorSound();
      setError(err.message || 'Developer Log In failed.');
    } finally {
      setLoading(false);
    }
  };

  // HANDLE GOOGLE LOG IN
  const handleCompleteGoogleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanUsername = googleCodeNumber.trim().replace(/\s+/g, '');
    if (!cleanUsername) {
      playErrorSound();
      setError('Username is required after signing in with Google.');
      return;
    }

    if (!gender) {
      playErrorSound();
      setError('Please select your Gender (Male or Female).');
      return;
    }

    if (!birthday) {
      playErrorSound();
      setError('Please select your Birth Date.');
      return;
    }

    try {
      setLoading(true);
      const res = await loginWithGoogle(
        googleEmail,
        googleName,
        'goog_' + Date.now(),
        cleanUsername,
        cleanUsername,
        googleCredential || undefined,
        gender,
        birthday
      );
      playSuccessSound();
      onSuccess(res.user, res.settings);
    } catch (err: any) {
      playErrorSound();
      setError(err.message || 'Failed to log in with Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-100 p-4 relative overflow-hidden select-none">
      {/* Background Video */}
      <LoginBackgroundVideo />

      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Auth Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md bg-[#242526] border border-[#3A3B3C] rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 will-change-transform transform-gpu"
      >
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="mb-2 flex items-center justify-center">
            <MarshmallowLogo size={68} animated />
          </div>

          <h1 className="text-2xl font-black tracking-tight text-white">
            {authView === 'login' && 'Log In to Marshmallow'}
            {authView === 'register' && 'Create a New Account'}
            {authView === 'developer' && 'Developer Portal Log In'}
            {authView === 'google_prompt' && 'Google Sign-In'}
          </h1>
          <p className="text-xs text-[#B0B3B8] font-medium mt-1">
            {authView === 'login' && 'Enter your Username and Password to log in.'}
            {authView === 'register' && 'Set up your own Username and Password to get started.'}
            {authView === 'developer' && 'Enter the confidential Developer Access Code Number.'}
            {authView === 'google_prompt' && 'Signed in with Google. Specify your Username to complete setup.'}
          </p>
        </div>

        {/* Mode Selector Tabs (Log In / Create Account / Developer) */}
        {(authView === 'login' || authView === 'register' || authView === 'developer') && (
          <div className="grid grid-cols-3 gap-1 p-1 bg-[#18191a] rounded-2xl border border-[#3A3B3C] mb-5 text-center">
            <button
              type="button"
              onClick={() => {
                playTouchSound();
                setError(null);
                setSuccessMsg(null);
                setAuthView('login');
              }}
              className={`py-2 px-2 rounded-xl font-bold text-[11px] flex items-center justify-center space-x-1 transition cursor-pointer ${
                authView === 'login'
                  ? 'bg-[#3A3B3C] text-white shadow-md'
                  : 'text-[#B0B3B8] hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5 shrink-0" />
              <span>Log In</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playTouchSound();
                setError(null);
                setSuccessMsg(null);
                setAuthView('register');
              }}
              className={`py-2 px-2 rounded-xl font-bold text-[11px] flex items-center justify-center space-x-1 transition cursor-pointer ${
                authView === 'register'
                  ? 'bg-[#3A3B3C] text-white shadow-md'
                  : 'text-[#B0B3B8] hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <span>Register</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playTouchSound();
                setError(null);
                setSuccessMsg(null);
                setAuthView('developer');
              }}
              className={`py-2 px-2 rounded-xl font-bold text-[11px] flex items-center justify-center space-x-1 transition cursor-pointer ${
                authView === 'developer'
                  ? 'bg-[#3A3B3C] text-white shadow-md'
                  : 'text-[#B0B3B8] hover:text-white'
              }`}
            >
              <Code2 className="w-3.5 h-3.5 shrink-0 text-white" />
              <span>Developer</span>
            </button>
          </div>
        )}

        {/* Global Notifications Banners */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center space-x-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center space-x-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </motion.div>
        )}

        {/* VIEW 1: REGULAR USER LOG IN FORM (USERNAME + PASSWORD REQUIRED) */}
        {authView === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#B0B3B8] mb-1.5 ml-1 flex items-center justify-between">
                <span>Username</span>
                <span className="text-[10px] text-[#E4E6EB] font-bold">Required</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#B0B3B8]">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError(null);
                  }}
                  placeholder="Enter your Username..."
                  className="w-full bg-[#18191a] border border-[#3A3B3C] rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-[#8A8D91] focus:outline-none focus:border-[#4E4F50] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#B0B3B8] mb-1.5 ml-1 flex items-center justify-between">
                <span>Password</span>
                <span className="text-[10px] text-[#E4E6EB] font-bold">Required</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#B0B3B8]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="Enter your Password..."
                  className="w-full bg-[#18191a] border border-[#3A3B3C] rounded-xl py-3 pl-11 pr-11 text-sm text-white placeholder-[#8A8D91] focus:outline-none focus:border-[#4E4F50] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#B0B3B8] hover:text-white transition cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-4 rounded-xl bg-[#3A3B3C] hover:bg-[#4E4F50] text-white font-bold text-sm flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Log In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* GOOGLE SIGN IN CONTAINER */}
            <div className="pt-2">
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-[#3A3B3C]"></div>
                <span className="flex-shrink mx-3 text-[11px] text-[#B0B3B8] font-semibold uppercase">Or continue with</span>
                <div className="flex-grow border-t border-[#3A3B3C]"></div>
              </div>

              {/* Official Google GSI Rendered Button Container */}
              <div id="google-btn-container" className="w-full flex justify-center my-1.5 min-h-[44px]"></div>
            </div>
          </form>
        )}

        {/* VIEW 2: CREATE ACCOUNT FORM (USERNAME + PASSWORD) */}
        {authView === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#B0B3B8] mb-1.5 ml-1 flex items-center justify-between">
                <span>Username</span>
                <span className="text-[10px] text-[#E4E6EB] font-bold">Name / Words</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#B0B3B8]">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError(null);
                  }}
                  placeholder="Example: JohnDoe"
                  className="w-full bg-[#18191a] border border-[#3A3B3C] rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-[#8A8D91] focus:outline-none focus:border-[#4E4F50] transition-all"
                />
              </div>
              <p className="text-[11px] text-[#B0B3B8] mt-1.5">
                You may use any word or name as your Username in the app.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#B0B3B8] mb-1.5 ml-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#B0B3B8]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="Create a password (words, numbers, etc)..."
                  className="w-full bg-[#18191a] border border-[#3A3B3C] rounded-xl py-3 pl-11 pr-11 text-sm text-white placeholder-[#8A8D91] focus:outline-none focus:border-[#4E4F50] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#B0B3B8] hover:text-white transition cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#B0B3B8] mb-1.5 ml-1">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#B0B3B8]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="Repeat password..."
                  className="w-full bg-[#18191a] border border-[#3A3B3C] rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-[#8A8D91] focus:outline-none focus:border-[#4E4F50] transition-all"
                />
              </div>
            </div>

            {/* Gender Selection */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#B0B3B8] mb-1.5 ml-1 flex items-center justify-between">
                <span>Gender</span>
                <span className="text-[10px] text-[#E4E6EB] font-bold">Required</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setGender('male'); setError(null); }}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                    gender === 'male'
                      ? 'bg-[#3A3B3C] border-[#4E4F50] text-white shadow-md'
                      : 'bg-[#18191a] border-[#3A3B3C] text-[#B0B3B8] hover:border-[#4E4F50]'
                  }`}
                >
                  <span>Male</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setGender('female'); setError(null); }}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                    gender === 'female'
                      ? 'bg-[#3A3B3C] border-[#4E4F50] text-white shadow-md'
                      : 'bg-[#18191a] border-[#3A3B3C] text-[#B0B3B8] hover:border-[#4E4F50]'
                  }`}
                >
                  <span>Female</span>
                </button>
              </div>
            </div>

            {/* Birth Date Selection */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#B0B3B8] mb-1.5 ml-1 flex items-center justify-between">
                <span>Birth Date</span>
                <span className="text-[10px] text-[#E4E6EB] font-bold">Required</span>
              </label>
              <input
                type="date"
                required
                value={birthday}
                onChange={(e) => {
                  setBirthday(e.target.value);
                  setError(null);
                }}
                className="w-full bg-[#18191a] border border-[#3A3B3C] rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#4E4F50] transition-all cursor-pointer"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-4 rounded-xl bg-[#3A3B3C] hover:bg-[#4E4F50] text-white font-bold text-sm flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Create Account & Log In</span>
                  <UserPlus className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* VIEW 3: DEVELOPER LOG IN FORM */}
        {authView === 'developer' && (
          <form onSubmit={handleDeveloperLoginSubmit} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-[#18191a] border border-[#3A3B3C] text-xs text-white flex items-center space-x-3">
              <div className="p-2 bg-[#3A3B3C] rounded-xl text-white shrink-0">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-white">Developer Access Portal</p>
                <p className="text-[11px] text-[#B0B3B8]">
                  Enter the confidential Developer Code Number to enter the portal.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#B0B3B8] mb-1.5 ml-1">
                Developer Code Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#B0B3B8] font-mono font-bold">
                  #
                </div>
                <input
                  type="text"
                  required
                  value={devCodeNumber}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setDevCodeNumber(val);
                    setError(null);
                  }}
                  placeholder="Enter Developer Code Number..."
                  className="w-full bg-[#18191a] border border-[#3A3B3C] rounded-xl py-3 pl-11 pr-4 text-base font-mono tracking-widest text-white placeholder-[#8A8D91] focus:outline-none focus:border-[#4E4F50] transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-4 rounded-xl bg-[#3A3B3C] hover:bg-[#4E4F50] text-white font-bold text-sm flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Developer Log In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* VIEW 4: GOOGLE LOGIN PROMPT */}
        {authView === 'google_prompt' && (
          <form onSubmit={handleCompleteGoogleLogin} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-[#18191a] border border-[#3A3B3C] text-xs text-white flex items-center space-x-3">
              <div className="p-2 bg-[#3A3B3C] rounded-xl text-white shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-white">Signed in as {googleName}</p>
                <p className="text-[11px] text-[#B0B3B8] font-mono">{googleEmail}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#B0B3B8] mb-1.5 ml-1">
                Required Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#B0B3B8]">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={googleCodeNumber}
                  onChange={(e) => {
                    setGoogleCodeNumber(e.target.value);
                    setError(null);
                  }}
                  placeholder="Enter your Username..."
                  className="w-full bg-[#18191a] border border-[#3A3B3C] rounded-xl py-3.5 pl-11 pr-4 text-sm text-white placeholder-[#8A8D91] focus:outline-none focus:border-[#4E4F50] transition-all"
                />
              </div>
            </div>

            {/* Gender Selection */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#B0B3B8] mb-1.5 ml-1 flex items-center justify-between">
                <span>Gender</span>
                <span className="text-[10px] text-[#E4E6EB] font-bold">Required</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setGender('male'); setError(null); }}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                    gender === 'male'
                      ? 'bg-[#3A3B3C] border-[#4E4F50] text-white shadow-md'
                      : 'bg-[#18191a] border-[#3A3B3C] text-[#B0B3B8] hover:border-[#4E4F50]'
                  }`}
                >
                  <span>Male</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setGender('female'); setError(null); }}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                    gender === 'female'
                      ? 'bg-[#3A3B3C] border-[#4E4F50] text-white shadow-md'
                      : 'bg-[#18191a] border-[#3A3B3C] text-[#B0B3B8] hover:border-[#4E4F50]'
                  }`}
                >
                  <span>Female</span>
                </button>
              </div>
            </div>

            {/* Birth Date Selection */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#B0B3B8] mb-1.5 ml-1 flex items-center justify-between">
                <span>Birth Date</span>
                <span className="text-[10px] text-[#E4E6EB] font-bold">Required</span>
              </label>
              <input
                type="date"
                required
                value={birthday}
                onChange={(e) => {
                  setBirthday(e.target.value);
                  setError(null);
                }}
                className="w-full bg-[#18191a] border border-[#3A3B3C] rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#4E4F50] transition-all cursor-pointer"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-4 rounded-xl bg-[#3A3B3C] hover:bg-[#4E4F50] text-white font-bold text-sm flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Complete Google Sign-In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  playTouchSound();
                  setError(null);
                  setAuthView('login');
                }}
                className="text-xs text-[#B0B3B8] hover:text-white transition font-medium cursor-pointer"
              >
                &larr; Cancel and go back
              </button>
            </div>
          </form>
        )}

        {/* Footer with Security & Privacy & Policy Link */}
        <div className="mt-6 pt-4 border-t border-[#3A3B3C] flex flex-col items-center justify-center space-y-2 text-xs text-[#B0B3B8]">
          <div className="flex items-center space-x-1.5 text-[#B0B3B8]">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Marshmallow End-to-End Encrypted Data</span>
          </div>

          <button
            type="button"
            onClick={handleOpenPrivacyPolicy}
            className="text-[11px] text-white hover:underline underline-offset-2 font-bold transition cursor-pointer flex items-center space-x-1"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Read Privacy Policy & Terms</span>
            <ExternalLink className="w-3 h-3 ml-0.5" />
          </button>
        </div>
      </motion.div>

      {/* PRIVACY POLICY & TERMS MODAL */}
      <AnimatePresence>
        {showPrivacyPolicy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-lg"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="w-full max-w-3xl max-h-[90vh] bg-[#242526] border border-[#3A3B3C] rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col relative overflow-hidden text-white"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#3A3B3C] shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-[#3A3B3C] border border-[#4E4F50] rounded-2xl text-white">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white flex items-center space-x-2">
                      <span>Marshmallow Privacy & Terms of Policy</span>
                      <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono rounded-md">Official Legal Doc</span>
                    </h2>
                    <p className="text-xs text-[#B0B3B8]">Comprehensive Data Protection and Security Guidelines</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      try { window.open('/privacy-policy', '_blank'); } catch(e){}
                    }}
                    title="Open in New Tab"
                    className="p-2 rounded-xl text-white hover:bg-[#3A3B3C] transition cursor-pointer flex items-center space-x-1 text-xs font-semibold"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span className="hidden sm:inline">New Tab</span>
                  </button>
                  <button
                    onClick={() => setShowPrivacyPolicy(false)}
                    className="p-2 rounded-xl text-[#B0B3B8] hover:text-white hover:bg-[#3A3B3C] transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto py-5 pr-3 space-y-6 text-xs text-[#E4E6EB] leading-relaxed custom-scrollbar">
                
                {/* SECTION 1 */}
                <section className="space-y-2.5 bg-[#18191a] p-4 rounded-2xl border border-[#3A3B3C]">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-white" />
                    <span>I. Introduction and Platform Terms</span>
                  </h3>
                  <p>
                    This document contains the official, legal, and technical policy regarding privacy, security, and data governance for all users of Marshmallow Network. By creating an account or accessing any feature of the application, you agree to all terms and provisions stated herein.
                  </p>
                  <p>
                    Marshmallow promotes an open, safe, and high-quality communication experience. Our infrastructure is built to ensure your identity and private messages remain fully protected against any unauthorized access.
                  </p>
                </section>

                {/* SECTION 2 */}
                <section className="space-y-2.5 bg-[#18191a] p-4 rounded-2xl border border-[#3A3B3C]">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center space-x-2">
                    <UserCheck className="w-4 h-4 text-white" />
                    <span>II. Authenticity, Username Management, and Developer Privileges</span>
                  </h3>
                  <p>
                    <strong>1. Regular Accounts:</strong> Regular users register with their chosen Username (words, names, or handle) and personal Password.
                  </p>
                  <p>
                    <strong>2. One-Time Username Change Policy:</strong> Users are allowed to change their username <u>once (1 time) only</u> inside Profile Settings. This prevents impersonation and maintains community integrity.
                  </p>
                  <p>
                    <strong>3. Developer Accounts:</strong> Official Developer Accounts have confidential Developer Access Codes. Developer accounts possess system management access without requiring standard login credentials.
                  </p>
                </section>

                {/* SECTION 3 */}
                <section className="space-y-2.5 bg-[#18191a] p-4 rounded-2xl border border-[#3A3B3C]">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center space-x-2">
                    <Lock className="w-4 h-4 text-white" />
                    <span>III. Encryption and Message Security (End-to-End Encryption)</span>
                  </h3>
                  <p>
                    All private message exchanges between users (Direct Messages), Group Chats, Audio Calls, and Video Calls are protected by advanced encryption standards (AES-256 + TLS Transport Security).
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5 text-[#B0B3B8]">
                    <li>No third-party ad networks or unauthorized entities can intercept or read your private chats.</li>
                    <li>Voice and Video calls use secure WebSocket signaling channels to keep your connection and IP address private.</li>
                    <li>Deleted messages or media are permanently removed from active sync feeds.</li>
                  </ul>
                </section>

                {/* SECTION 4 */}
                <section className="space-y-2.5 bg-[#18191a] p-4 rounded-2xl border border-[#3A3B3C]">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-white" />
                    <span>IV. Protection for Uploaded Media, Photos, and Voice Clips</span>
                  </h3>
                  <p>
                    Any photos, Stories, video clips, voice notes, or attachments uploaded to Marshmallow feeds and chats are securely stored in our cloud media servers.
                  </p>
                  <p>
                    Users maintain full control to delete or edit their shared media and posts at any time.
                  </p>
                </section>

                {/* SECTION 5 */}
                <section className="space-y-2.5 bg-[#18191a] p-4 rounded-2xl border border-[#3A3B3C]">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>V. Zero Third-Party Data Selling Guarantee</span>
                  </h3>
                  <p>
                    Marshmallow is committed to preserving user trust. We never sell, trade, or rent your personal information, contact details, or chat logs to advertising brokers or marketers.
                  </p>
                </section>

                {/* SECTION 6 */}
                <section className="space-y-2.5 bg-[#18191a] p-4 rounded-2xl border border-[#3A3B3C]">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-white" />
                    <span>VI. Community Standards, Anti-Bullying, and Account Suspension</span>
                  </h3>
                  <p>
                    To keep the platform safe and enjoyable, the following behaviors are strictly prohibited:
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5 text-[#B0B3B8]">
                    <li>Cyberbullying, harassment, threats, or extortion of other members.</li>
                    <li>Distributing malicious content, false news, or hate speech.</li>
                    <li>Creating automated bot accounts for spamming public stories or chats.</li>
                  </ul>
                  <p>
                    Violations may result in immediate blocking or account suspension under our security systems and administration team.
                  </p>
                </section>

                {/* SECTION 7 */}
                <section className="space-y-2.5 bg-[#18191a] p-4 rounded-2xl border border-[#3A3B3C]">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center space-x-2">
                    <KeyRound className="w-4 h-4 text-white" />
                    <span>VII. Password Security Responsibility</span>
                  </h3>
                  <p>
                    Users are responsible for maintaining the confidentiality of their passwords. Official Marshmallow team members will never ask for your password via direct message or email.
                  </p>
                </section>

                {/* SECTION 8 */}
                <section className="space-y-2.5 bg-[#18191a] p-4 rounded-2xl border border-[#3A3B3C]">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-white" />
                    <span>VIII. Contacting Developer Support</span>
                  </h3>
                  <p>
                    If you have questions regarding this policy or wish to report technical issues or harassment, visit the <strong>Help & Support</strong> section in the app to contact our team.
                  </p>
                </section>

              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-[#3A3B3C] flex items-center justify-between shrink-0">
                <span className="text-[11px] text-[#B0B3B8]">Marshmallow Legal Governance &copy; 2026</span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      try { window.open('/privacy-policy', '_blank'); } catch(e){}
                    }}
                    className="py-2.5 px-4 rounded-xl bg-[#3A3B3C] hover:bg-[#4E4F50] text-white font-bold text-xs transition cursor-pointer flex items-center space-x-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in New Tab</span>
                  </button>
                  <button
                    onClick={() => setShowPrivacyPolicy(false)}
                    className="py-2.5 px-6 rounded-xl bg-[#3A3B3C] hover:bg-[#4E4F50] text-white font-bold text-xs transition cursor-pointer"
                  >
                    I Understand
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
