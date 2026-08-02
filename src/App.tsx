import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Menu,
  MessageSquare,
  Users,
  Search,
  Home,
  Bell,
  User as UserIcon,
  ShieldCheck,
  Video,
  Database,
  Settings,
  Camera,
  Image as ImageIcon,
  Hash,
  LogOut,
  Smartphone,
  Film,
  Plus,
  Tv
} from 'lucide-react';
import {
  User,
  UserSettings,
  Chat,
  ActiveCallState,
  AppNotification
} from './types';
import {
  fetchCurrentUser,
  fetchChats,
  fetchNotifications,
  markNotificationsRead,
  clearAuthToken,
  wsManager
} from './services/api';

import { SplashScreen } from './components/SplashScreen';
import { AuthScreen } from './components/AuthScreen';
import { HamburgerMenu } from './components/HamburgerMenu';
import { VerifiedBadge, isDeveloperUser } from './components/VerifiedBadge';
import { ChatView } from './components/ChatView';
import { FriendsView } from './components/FriendsView';
import { FeedView } from './components/FeedView';
import { SearchView } from './components/SearchView';
import { ProfileView } from './components/ProfileView';
import { NotificationsView } from './components/NotificationsView';
import { VideoFeedView } from './components/VideoFeedView';
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal';
import { HelpSupportModal } from './components/HelpSupportModal';
import { NicknameModal } from './components/NicknameModal';
import { SettingsModal } from './components/SettingsModal';
import { SqlExporterModal } from './components/SqlExporterModal';
import { AdminPasswordModal } from './components/AdminPasswordModal';
import { VideoCallModal } from './components/VideoCallModal';
import { StalkConfirmationModal } from './components/StalkConfirmationModal';
import { ImageViewerModal } from './components/ImageViewerModal';
import { UserAvatar } from './components/UserAvatar';
import { MarshmallowLogo } from './components/MarshmallowLogo';
import { playTouchSound, toggleSoundEnabled, getSoundEnabled } from './utils/audioSound';
import { playMessageSound } from './utils/sound';
import { getPartnerChatDisplayName } from './utils/chatNicknames';

export default function App() {
  const [splashCompleted, setSplashCompleted] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<UserSettings>({
    theme: 'dark',
    notificationsEnabled: true,
    readReceipts: true,
    onlineStatusVisible: true
  });
  const [authChecking, setAuthChecking] = useState(true);
  const [soundOn, setSoundOn] = useState(getSoundEnabled());

  // App Navigation & Modals (Home, Friend, Video, Chat, Search, Notification, Profile)
  const [mainView, setMainView] = useState<'home' | 'friends' | 'videos' | 'chats' | 'search' | 'notification' | 'profile'>('home');
  const [videoInitialTab, setVideoInitialTab] = useState<'all' | 'saved'>('all');
  const [viewedUserId, setViewedUserId] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatSearch, setChatSearch] = useState('');

  // Notifications State
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [hasUnreadNotifs, setHasUnreadNotifs] = useState<boolean>(false);

  // Stalking Confirmation Modal state
  const [stalkModalOpen, setStalkModalOpen] = useState(false);
  const [stalkTargetUserId, setStalkTargetUserId] = useState<string | null>(null);
  const [stalkTargetUserObj, setStalkTargetUserObj] = useState<Partial<User> | null>(null);

  const handleOpenUserProfile = (targetUserId: string, userObj?: Partial<User>) => {
    if (targetUserId === currentUser?.id) {
      setViewedUserId(null);
      setMainView('profile');
      return;
    }
    setStalkTargetUserId(targetUserId);
    setStalkTargetUserObj(userObj || null);
    setStalkModalOpen(true);
  };

  const handleConfirmStalk = (targetUserId: string) => {
    setViewedUserId(targetUserId);
    setMainView('profile');
  };

  const [hamburgerOpen, setHamburgerOpen] = useState(false);
  const [helpSupportOpen, setHelpSupportOpen] = useState(false);
  const [nicknameModalOpen, setNicknameModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [privacyPolicyOpen, setPrivacyPolicyOpen] = useState(false);
  const [adminPasswordModalOpen, setAdminPasswordModalOpen] = useState(false);
  const [sqlExporterOpen, setSqlExporterOpen] = useState(false);
  const [selectedLightboxImage, setSelectedLightboxImage] = useState<string | null>(null);

  // PWA Installation State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isPwaInstalled, setIsPwaInstalled] = useState<boolean>(false);
  const [chatNicknameVersion, setChatNicknameVersion] = useState<number>(0);

  useEffect(() => {
    const handleNicknameChange = () => {
      setChatNicknameVersion(v => v + 1);
    };
    const handleProfileUpdate = (e: any) => {
      if (currentUser && e.detail?.nickname !== undefined) {
        setCurrentUser(prev => prev ? { ...prev, nickname: e.detail.nickname } : prev);
      }
    };
    window.addEventListener('chat_nickname_changed', handleNicknameChange);
    window.addEventListener('user_profile_updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('chat_nickname_changed', handleNicknameChange);
      window.removeEventListener('user_profile_updated', handleProfileUpdate);
    };
  }, [currentUser]);

  useEffect(() => {
    // Check if running in standalone PWA mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;

    if (isStandalone) {
      setIsPwaInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsPwaInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallPwa = async () => {
    playTouchSound();
    if (!deferredPrompt) {
      alert(
        'To install Marshmallow on Android or mobile browser:\n\n1. Tap your browser menu (⋮)\n2. Select "Add to Home screen" or "Install app".'
      );
      return;
    }

    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult?.outcome === 'accepted') {
      setIsPwaInstalled(true);
    }
    setDeferredPrompt(null);
  };

  // Push Notification State & Permission Handler
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  const handleRequestNotifPermission = async () => {
    playTouchSound();
    if (!('Notification' in window)) {
      alert('Push notifications are not supported on this browser or device.');
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm === 'granted') {
        playMessageSound();
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification('Marshmallow Chat Notifications Active! 🔔', {
            body: 'You will now receive real-time push alerts for new messages.',
            icon: 'https://i.imgur.com/wuZA94T.png',
            badge: 'https://i.imgur.com/wuZA94T.png'
          });
        }
      } else if (perm === 'denied') {
        alert('Notification permission was blocked. Please enable notifications in your browser settings.');
      }
    } catch (e) {
      console.error('Failed to request notification permission:', e);
    }
  };

  // Service Worker Message Listener (Handles notification tap navigation)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleSwMessage = (event: MessageEvent) => {
        if (event.data?.type === 'NAVIGATE_CHAT' && event.data.chatId) {
          setMainView('chats');
          setActiveChatId(event.data.chatId);
        }
      };
      navigator.serviceWorker.addEventListener('message', handleSwMessage);

      // Deep-link check for ?chatId=
      const params = new URLSearchParams(window.location.search);
      const urlChatId = params.get('chatId');
      if (urlChatId) {
        setMainView('chats');
        setActiveChatId(urlChatId);
      }

      return () => {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      };
    }
  }, []);

  // Collapsible Header state for scrolling
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  useEffect(() => {
    setIsHeaderCollapsed(false);
  }, [mainView]);

  const handleScroll = (scrollTop: number) => {
    if (scrollTop > 25) {
      setIsHeaderCollapsed(true);
    } else if (scrollTop <= 10) {
      setIsHeaderCollapsed(false);
    }
  };

  // Active Call State
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);

  // Restore user session on mount (keeps user logged in on refresh or re-open)
  useEffect(() => {
    async function checkExistingAuth() {
      try {
        const result = await fetchCurrentUser();
        if (result && result.user) {
          setCurrentUser(result.user);
          if (result.settings) setSettings(result.settings);
        }
      } catch (err) {
        console.error('Failed to restore user session:', err);
      } finally {
        setAuthChecking(false);
      }
    }
    checkExistingAuth();
  }, []);

  // Load Chats list
  const loadChatsList = async () => {
    if (!currentUser) return;
    try {
      const list = await fetchChats();
      setChats(list);
      if (list.length > 0 && !activeChatId && window.innerWidth >= 768) {
        setActiveChatId(list[0].id);
      }
    } catch (e) {
      console.error('Failed to fetch chats list', e);
    }
  };

  // Load Notifications list
  const loadNotificationsList = async () => {
    if (!currentUser) return;
    try {
      const list = await fetchNotifications();
      setNotifications(list);
      setHasUnreadNotifs(list.some((n: any) => !n.isRead));
    } catch (e) {
      console.error('Failed to fetch notifications list', e);
    }
  };

  const hasUnreadFriendNotifs = notifications.some(
    (n) => !n.isRead && (n.type === 'friend_request' || n.type === 'friend_accept')
  );

  const handleMarkAllNotificationsRead = async () => {
    try {
      await markNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setHasUnreadNotifs(false);
    } catch (e) {
      console.error('Failed to mark all notifications read', e);
    }
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    // Optimistically mark as read
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));

    if (notif.type === 'friend_request' || notif.type === 'friend_accept') {
      setMainView('friends');
    } else if (notif.type === 'post_like' || notif.type === 'post_comment' || notif.type === 'post_share') {
      setMainView('home');
    } else if (notif.senderUserId) {
      handleOpenUserProfile(notif.senderUserId);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadChatsList();
      loadNotificationsList();
    }
  }, [currentUser]);

  // Global WebSocket Event Listeners (Incoming Calls, Chat List Updates, Push Notifications, Social Notifications)
  useEffect(() => {
    if (!currentUser) return;

    // Handle Incoming Call Offer
    const unbindCallOffer = wsManager.on('call_offer', (payload) => {
      setActiveCall({
        callId: payload.callId || 'call_' + Date.now(),
        peerId: payload.callerId,
        peerUsername: payload.callerUsername,
        peerNickname: payload.callerNickname,
        peerAvatarUrl: payload.callerAvatarUrl,
        peerBorderId: payload.callerBorderId,
        type: payload.type || 'video',
        isCaller: false,
        status: 'ringing'
      });
    });

    const unbindCallDecline = wsManager.on('call_decline', () => {
      setActiveCall(null);
    });

    const unbindCallEnd = wsManager.on('call_end', () => {
      setActiveCall(null);
    });

    const unbindNotifNew = wsManager.on('notification_new', (payload: any) => {
      if (payload) {
        playMessageSound();
        setNotifications(prev => [payload, ...prev]);
        setHasUnreadNotifs(true);
      }
    });

    const unbindMsgNew = wsManager.on('message_new', (payload: any) => {
      loadChatsList();

      if (payload && currentUser && payload.senderId !== currentUser.id) {
        playMessageSound();

        // Push / System Notification if permitted
        if ('Notification' in window && Notification.permission === 'granted') {
          const senderName = payload.senderNickname || 'Marshmallow User';
          const previewText = payload.mediaType === 'image'
            ? '📷 Sent a photo'
            : payload.mediaType === 'video'
            ? '🎥 Sent a video'
            : payload.mediaType === 'audio'
            ? '🎵 Sent a voice message'
            : payload.content || 'Sent a new message';

          const title = `${senderName} • Marshmallow`;
          const options = {
            body: previewText,
            icon: payload.senderAvatarUrl || 'https://i.imgur.com/wuZA94T.png',
            badge: 'https://i.imgur.com/wuZA94T.png',
            tag: `chat_${payload.chatId}`,
            renotify: true,
            data: { chatId: payload.chatId }
          };

          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then((reg) => {
              reg.showNotification(title, options);
            }).catch(() => {
              try { new Notification(title, options); } catch (e) {}
            });
          } else {
            try { new Notification(title, options); } catch (e) {}
          }
        }
      }
    });

    const unbindReactionNotice = wsManager.on('message_reaction_notice', (payload: any) => {
      loadChatsList();
      if (payload && currentUser) {
        playMessageSound();
      }
    });

    const unbindMsgUpdate = wsManager.on('message_update', () => {
      loadChatsList();
    });

    const unbindStatsUpdate = wsManager.on('profile_stats_update', (payload: any) => {
      if (payload && currentUser && payload.userId === currentUser.id) {
        setCurrentUser(prev => prev ? {
          ...prev,
          followersCount: payload.followersCount,
          followingCount: payload.followingCount
        } : prev);
      }
    });

    return () => {
      unbindCallOffer();
      unbindCallDecline();
      unbindCallEnd();
      unbindNotifNew();
      unbindMsgNew();
      unbindReactionNotice();
      unbindMsgUpdate();
      unbindStatsUpdate();
    };
  }, [currentUser]);

  const handleStartCallWithUser = (friend: User) => {
    if (!currentUser) return;
    setActiveCall({
      callId: 'call_' + Date.now(),
      peerId: friend.id,
      peerUsername: friend.username,
      peerNickname: friend.nickname,
      peerAvatarUrl: friend.avatarUrl,
      peerBorderId: friend.borderId,
      type: 'video',
      isCaller: true,
      status: 'connected'
    });
  };

  const handleAcceptIncomingCall = () => {
    if (activeCall) {
      setActiveCall({
        ...activeCall,
        status: 'connected'
      });
    }
  };

  const handleEndCall = () => {
    if (activeCall) {
      wsManager.send('call_end', { targetUserId: activeCall.peerId });
      setActiveCall(null);
    }
  };

  const handleLogout = () => {
    clearAuthToken();
    wsManager.disconnect();
    setCurrentUser(null);
    setActiveChatId(null);
    setMainView('chats');
  };

  const activeChat = chats.find(c => c.id === activeChatId);

  const filteredChats = chats.filter(c => {
    if (!chatSearch.trim()) return true;
    const partner = c.participantUsers?.find(u => u.id !== currentUser?.id);
    const nickname = (partner?.nickname || '').toLowerCase();
    const username = (partner?.username || '').toLowerCase();
    const query = chatSearch.toLowerCase();
    return nickname.includes(query) || username.includes(query);
  });

  const totalUnreadCount = chats.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  return (
    <div className={`h-[100dvh] w-full flex flex-col font-sans transition-colors duration-300 overflow-hidden select-none ${
      settings.theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-[#18191a] text-[#E4E6EB]'
    }`}>
      {/* 1. CINEMATIC SPLASH SCREEN & 2. AUTH SCREEN */}
      <AnimatePresence mode="wait">
        {!splashCompleted ? (
          <SplashScreen key="splash" onComplete={() => setSplashCompleted(true)} />
        ) : !authChecking && !currentUser ? (
          <motion.div
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="w-full h-full"
          >
            <AuthScreen
              onSuccess={(user, userSettings) => {
                setCurrentUser(user);
                setSettings(userSettings);
                wsManager.connect(user.id);
                loadChatsList();
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* 3. MAIN MESSENGER & SOCIAL INTERFACE */}
      {splashCompleted && currentUser && (
        <div className="flex-1 flex flex-col h-[100dvh] max-h-[100dvh] w-full max-w-full overflow-hidden overflow-x-hidden touch-pan-y min-h-0 bg-[#18191a]">
          {/* Top Navigation Header (Clean Facebook Dark Theme Style) */}
          {mainView !== 'videos' && (
            <header className="sticky top-0 z-30 bg-[#242526] border-b border-[#3A3B3C] flex flex-col shrink-0 select-none pt-[env(safe-area-inset-top,0px)] transition-all">
              <AnimatePresence initial={false}>
                {!isHeaderCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden px-3 sm:px-4 py-2 flex items-center justify-between"
                  >
                    {/* Left: Hamburger Menu + Clean Text Title */}
                    <div className="flex items-center space-x-3 shrink-0">
                      <button
                        onClick={() => {
                          playTouchSound();
                          setHamburgerOpen(true);
                        }}
                        className="p-1.5 rounded-full hover:bg-[#3A3B3C] text-white transition cursor-pointer"
                        title="Open Menu"
                        aria-label="Open side menu"
                      >
                        <Menu className="w-6 h-6 text-white shrink-0" />
                      </button>

                      <div
                        onClick={() => {
                          playTouchSound();
                          setMainView('home');
                        }}
                        className="flex items-center cursor-pointer shrink-0"
                      >
                        <h1 className="font-extrabold text-2xl tracking-tight text-white font-sans">
                          Marshmallow
                        </h1>
                      </div>
                    </div>

                    {/* Right Facebook Header Icon: Messenger (💬) */}
                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => {
                          playTouchSound();
                          setMainView('chats');
                        }}
                        className="w-9 h-9 rounded-full bg-[#3A3B3C] hover:bg-[#4E4F50] text-white flex items-center justify-center transition cursor-pointer relative"
                        title="Messages"
                      >
                        <MessageSquare className="w-5 h-5 text-white" />
                        {totalUnreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 bg-red-600 text-white font-bold text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center border-2 border-[#242526]">
                            {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                          </span>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </header>
          )}

          {/* Main Body Stage */}
          <div className="flex-1 flex overflow-hidden pb-16 sm:pb-20">
            <div className={`flex-1 overflow-y-auto ${mainView === 'home' ? '' : 'hidden'}`} onScroll={(e) => handleScroll(e.currentTarget.scrollTop)}>
              <FeedView
                currentUser={currentUser}
                onOpenUserProfile={handleOpenUserProfile}
                onImageClick={(url) => setSelectedLightboxImage(url)}
              />
            </div>

            <div className={`flex-1 overflow-y-auto ${mainView === 'friends' ? '' : 'hidden'}`} onScroll={(e) => handleScroll(e.currentTarget.scrollTop)}>
              <FriendsView
                currentUser={currentUser}
                onOpenChat={async (chatId) => {
                  setMainView('chats');
                  setActiveChatId(chatId);
                  await loadChatsList();
                }}
                onStartCall={handleStartCallWithUser}
                onOpenUserProfile={handleOpenUserProfile}
                onOpenSearchCode={() => setMainView('search')}
              />
            </div>

            <div className={`flex-1 overflow-y-auto ${mainView === 'videos' ? '' : 'hidden'}`} onScroll={(e) => handleScroll(e.currentTarget.scrollTop)}>
              <VideoFeedView
                currentUser={currentUser}
                initialTab={videoInitialTab}
                isActive={mainView === 'videos'}
                onOpenUserProfile={handleOpenUserProfile}
                onOpenLightbox={(url) => setSelectedLightboxImage(url)}
              />
            </div>

            <div className={`flex-1 overflow-y-auto ${mainView === 'search' ? '' : 'hidden'}`} onScroll={(e) => handleScroll(e.currentTarget.scrollTop)}>
              <SearchView
                currentUser={currentUser}
                onOpenChat={async (chatId) => {
                  setMainView('chats');
                  setActiveChatId(chatId);
                  await loadChatsList();
                }}
                onOpenUserProfile={handleOpenUserProfile}
              />
            </div>

            <div className={`flex-1 overflow-y-auto ${mainView === 'notification' ? '' : 'hidden'}`} onScroll={(e) => handleScroll(e.currentTarget.scrollTop)}>
              <NotificationsView
                notifications={notifications}
                currentUser={currentUser}
                onMarkAllRead={handleMarkAllNotificationsRead}
                onOpenUserProfile={handleOpenUserProfile}
                onNotificationClick={handleNotificationClick}
              />
            </div>

            <div className={`flex-1 overflow-y-auto ${mainView === 'profile' ? '' : 'hidden'}`} onScroll={(e) => handleScroll(e.currentTarget.scrollTop)}>
              <ProfileView
                currentUser={currentUser}
                onProfileUpdated={(updated) => setCurrentUser(updated)}
                viewedUserId={viewedUserId}
                onBackToSelf={() => setViewedUserId(null)}
                onOpenChat={async (chatId) => {
                  setMainView('chats');
                  setActiveChatId(chatId);
                  await loadChatsList();
                }}
                onStartCall={handleStartCallWithUser}
                onOpenUserProfile={handleOpenUserProfile}
                onImageClick={(url) => setSelectedLightboxImage(url)}
                onOpenSettings={() => setSettingsModalOpen(true)}
                onOpenPrivacy={() => setPrivacyPolicyOpen(true)}
                onLogout={handleLogout}
              />
            </div>

            <div className={`flex-1 flex overflow-hidden ${mainView === 'chats' ? '' : 'hidden'}`}>
                {/* Left Sidebar Conversation List */}
                <div
                  className={`w-full md:w-80 lg:w-96 bg-slate-900/60 border-r border-slate-800/80 flex flex-col shrink-0 ${
                    activeChatId ? 'hidden md:flex' : 'flex'
                  }`}
                >
                  {/* Push Notification Permission Banner */}
                  {notifPermission === 'default' && (
                    <div className="p-2.5 bg-slate-800 border-b border-slate-700 flex items-center justify-between gap-2 shrink-0">
                      <div className="flex items-center space-x-2 text-[11px] font-bold text-slate-200">
                        <Bell className="w-3.5 h-3.5 shrink-0 text-white animate-bounce" />
                        <span className="line-clamp-1">Enable real-time chat alerts</span>
                      </div>
                      <button
                        onClick={handleRequestNotifPermission}
                        className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-950 rounded-lg text-[10px] font-extrabold shadow-md shrink-0 transition cursor-pointer"
                      >
                        Enable
                      </button>
                    </div>
                  )}

                  {/* Search Chats Input */}
                  <div className="p-3 border-b border-slate-800/80">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={chatSearch}
                        onChange={(e) => setChatSearch(e.target.value)}
                        placeholder="Search conversations..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-600"
                      />
                    </div>
                  </div>

                  {/* Conversation List */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {filteredChats.length === 0 ? (
                      <div className="text-center py-12 p-4 text-slate-500 text-xs">
                        No conversations found. Add friends to start private messaging!
                      </div>
                    ) : (
                      filteredChats.map((chat) => {
                        const partner = chat.participantUsers?.find(u => u.id !== currentUser.id);
                        const partnerDisplayName = getPartnerChatDisplayName(partner, currentUser.id);
                        const isSelected = chat.id === activeChatId;

                        return (
                          <button
                            key={chat.id}
                            onClick={() => setActiveChatId(chat.id)}
                            className={`w-full p-3 rounded-2xl flex items-center space-x-3 transition text-left ${
                              isSelected
                                ? 'bg-slate-800 border border-slate-700'
                                : 'hover:bg-slate-800/60'
                            }`}
                          >
                            <div className="relative shrink-0">
                              <UserAvatar
                                userId={partner?.id}
                                borderId={partner?.borderId}
                                src={partner?.avatarUrl}
                                username={partner?.username}
                                nickname={partnerDisplayName}
                                size="lg"
                                showStatus
                                status={partner?.status || 'offline'}
                              />
                            </div>

                            <div className="flex-1 overflow-hidden">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="font-bold text-xs text-slate-100 truncate flex items-center">
                                  <span className="truncate">{partnerDisplayName}</span>
                                  {partner && isDeveloperUser(partner) && (
                                    <VerifiedBadge className="w-3.5 h-3.5 ml-1 shrink-0" />
                                  )}
                                </h4>
                                {chat.lastMessage && (
                                  <span className="text-[10px] text-slate-500 shrink-0">
                                    {new Date(chat.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-between">
                                <p className={`text-xs truncate ${chat.unreadCount && chat.unreadCount > 0 ? 'text-white font-bold' : 'text-slate-400'}`}>
                                  {(() => {
                                    if (!chat.lastMessage) return 'Start chatting...';
                                    const rxKeys = Object.keys(chat.lastMessage.reactions || {});
                                    if (rxKeys.length > 0 && chat.unreadCount && chat.unreadCount > 0) {
                                      const topEmoji = rxKeys[rxKeys.length - 1];
                                      return `${topEmoji} Reacted to message`;
                                    }
                                    return chat.lastMessage.content || (chat.lastMessage.mediaType ? `Attachment (${chat.lastMessage.mediaType})` : 'Sent a message');
                                  })()}
                                </p>
                                {chat.unreadCount && chat.unreadCount > 0 ? (
                                  <span className="bg-white text-slate-950 font-black text-[10px] min-w-[18px] h-[18px] px-1.5 rounded-full flex items-center justify-center ml-2 shrink-0 shadow border border-slate-300">
                                    {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right Active Chat Panel */}
                <div
                  className={`flex-1 flex flex-col h-full overflow-hidden bg-slate-950 ${
                    !activeChatId ? 'hidden md:flex' : 'flex'
                  }`}
                >
                  {activeChat ? (
                    <ChatView
                      activeChat={activeChat}
                      currentUser={currentUser}
                      onBackMobile={() => setActiveChatId(null)}
                      onStartCall={handleStartCallWithUser}
                      onOpenUserProfile={handleOpenUserProfile}
                      onImageClick={(url) => setSelectedLightboxImage(url)}
                      onMessagesSeen={loadChatsList}
                    />
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
                      <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 p-4 mb-4 text-white flex items-center justify-center">
                        <MessageSquare className="w-full h-full" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-200">Marshmallow Private Chat</h3>
                      <p className="text-xs text-slate-400 mt-2 max-w-sm">
                        Select an active conversation or add friends to start end-to-end private messaging and WebRTC video calling.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

          {/* Fixed Responsive Bottom Navigation Bar (FB Style Dark Bar, Icon Only, White Selection) */}
          <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#242526] border-t border-[#3E4042] shadow-2xl py-1 px-2 select-none">
            <div className="grid grid-cols-7 w-full max-w-2xl mx-auto gap-1 items-center justify-between">
              {/* 1. HOME TAB */}
              <button
                onClick={() => {
                  playTouchSound();
                  setMainView('home');
                }}
                className={`flex items-center justify-center py-2.5 rounded-lg transition cursor-pointer min-w-0 w-full relative ${
                  mainView === 'home'
                    ? 'text-white border-b-2 border-white'
                    : 'text-[#B0B3B8] hover:text-white hover:bg-[#3A3B3C]/50'
                }`}
                title="Home"
                aria-label="Home"
              >
                <Home className="w-6 h-6 shrink-0" />
              </button>

              {/* 2. FRIEND TAB */}
              <button
                onClick={() => {
                  playTouchSound();
                  setMainView('friends');
                }}
                className={`flex items-center justify-center py-2.5 rounded-lg transition cursor-pointer min-w-0 w-full relative ${
                  mainView === 'friends'
                    ? 'text-white border-b-2 border-white'
                    : 'text-[#B0B3B8] hover:text-white hover:bg-[#3A3B3C]/50'
                }`}
                title="Friends"
                aria-label="Friends"
              >
                <div className="relative shrink-0">
                  <Users className="w-6 h-6" />
                  {hasUnreadFriendNotifs && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-[#242526]" />
                  )}
                </div>
              </button>

              {/* 3. VIDEO TAB */}
              <button
                onClick={() => {
                  playTouchSound();
                  setMainView('videos');
                }}
                className={`flex items-center justify-center py-2.5 rounded-lg transition cursor-pointer min-w-0 w-full relative ${
                  mainView === 'videos'
                    ? 'text-white border-b-2 border-white'
                    : 'text-[#B0B3B8] hover:text-white hover:bg-[#3A3B3C]/50'
                }`}
                title="Video"
                aria-label="Video"
              >
                <Film className="w-6 h-6 shrink-0" />
              </button>

              {/* 4. CHAT TAB */}
              <button
                onClick={() => {
                  playTouchSound();
                  setMainView('chats');
                }}
                className={`flex items-center justify-center py-2.5 rounded-lg transition cursor-pointer min-w-0 w-full relative ${
                  mainView === 'chats'
                    ? 'text-white border-b-2 border-white'
                    : 'text-[#B0B3B8] hover:text-white hover:bg-[#3A3B3C]/50'
                }`}
                title="Chats"
                aria-label="Chats"
              >
                <div className="relative shrink-0">
                  <MessageSquare className="w-6 h-6" />
                  {totalUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 bg-rose-500 text-white font-bold text-[9px] min-w-[14px] h-[14px] px-0.5 rounded-full flex items-center justify-center border-2 border-[#242526]">
                      {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                    </span>
                  )}
                </div>
              </button>

              {/* 5. SEARCH TAB */}
              <button
                onClick={() => {
                  playTouchSound();
                  setMainView('search');
                }}
                className={`flex items-center justify-center py-2.5 rounded-lg transition cursor-pointer min-w-0 w-full relative ${
                  mainView === 'search'
                    ? 'text-white border-b-2 border-white'
                    : 'text-[#B0B3B8] hover:text-white hover:bg-[#3A3B3C]/50'
                }`}
                title="Search"
                aria-label="Search"
              >
                <Search className="w-6 h-6 shrink-0" />
              </button>

              {/* 6. NOTIFICATION TAB */}
              <button
                onClick={() => {
                  playTouchSound();
                  setMainView('notification');
                  handleMarkAllNotificationsRead();
                }}
                className={`flex items-center justify-center py-2.5 rounded-lg transition cursor-pointer min-w-0 w-full relative ${
                  mainView === 'notification'
                    ? 'text-white border-b-2 border-white'
                    : 'text-[#B0B3B8] hover:text-white hover:bg-[#3A3B3C]/50'
                }`}
                title="Notifications"
                aria-label="Notifications"
              >
                <div className="relative shrink-0">
                  <Bell className="w-6 h-6" />
                  {hasUnreadNotifs && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-[#242526]" />
                  )}
                </div>
              </button>

              {/* 7. PROFILE TAB */}
              <button
                onClick={() => {
                  playTouchSound();
                  setViewedUserId(null);
                  setMainView('profile');
                }}
                className={`flex items-center justify-center py-2.5 rounded-lg transition cursor-pointer min-w-0 w-full relative ${
                  mainView === 'profile' && !viewedUserId
                    ? 'text-white border-b-2 border-white'
                    : 'text-[#B0B3B8] hover:text-white hover:bg-[#3A3B3C]/50'
                }`}
                title="Profile"
                aria-label="Profile"
              >
                <UserAvatar
                  userId={currentUser.id}
                  borderId={currentUser.borderId}
                  src={currentUser.avatarUrl}
                  username={currentUser.username}
                  nickname={currentUser.nickname}
                  size={24}
                />
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* HAMBURGER DRAWER MENU */}
      {currentUser && (
        <HamburgerMenu
          isOpen={hamburgerOpen}
          onClose={() => setHamburgerOpen(false)}
          currentUser={currentUser}
          settings={settings}
          onOpenSettingsModal={() => setSettingsModalOpen(true)}
          onOpenHelpSupport={() => setHelpSupportOpen(true)}
          onOpenSavedVideos={() => {
            setVideoInitialTab('saved');
            setMainView('videos');
            setHamburgerOpen(false);
          }}
          onLogout={() => {
            clearAuthToken();
            setCurrentUser(null);
            setHamburgerOpen(false);
          }}
        />
      )}

      {/* HELP & SUPPORT MODAL */}
      {helpSupportOpen && (
        <HelpSupportModal
          isOpen={helpSupportOpen}
          onClose={() => setHelpSupportOpen(false)}
        />
      )}

      {/* PRIVACY POLICY MODAL */}
      {privacyPolicyOpen && (
        <PrivacyPolicyModal
          isOpen={privacyPolicyOpen}
          onClose={() => setPrivacyPolicyOpen(false)}
        />
      )}

      {/* NICKNAME MODAL (7-DAY RESTRICTION ENFORCED) */}
      {currentUser && nicknameModalOpen && (
        <NicknameModal
          user={currentUser}
          onClose={() => setNicknameModalOpen(false)}
          onUpdated={(updated) => setCurrentUser(updated)}
        />
      )}

      {/* SETTINGS MODAL */}
      {settingsModalOpen && (
        <SettingsModal
          settings={settings}
          onClose={() => setSettingsModalOpen(false)}
          onUpdateSettings={(newSettings) => setSettings(newSettings)}
          onOpenSqlExporter={() => setAdminPasswordModalOpen(true)}
        />
      )}

      {/* ADMIN PASSWORD MODAL FOR SQL EXPORTER */}
      {adminPasswordModalOpen && (
        <AdminPasswordModal
          onClose={() => setAdminPasswordModalOpen(false)}
          onSuccess={() => {
            setAdminPasswordModalOpen(false);
            setSqlExporterOpen(true);
          }}
        />
      )}

      {/* SUPABASE SQL EXPORTER MODAL */}
      {sqlExporterOpen && (
        <SqlExporterModal onClose={() => setSqlExporterOpen(false)} />
      )}

      {/* WebRTC 1-ON-1 VIDEO CALL MODAL */}
      {currentUser && activeCall && (
        <VideoCallModal
          callState={activeCall}
          currentUser={currentUser}
          onEndCall={handleEndCall}
          onAcceptCall={handleAcceptIncomingCall}
        />
      )}

      {/* STALK CONFIRMATION MODAL */}
      {stalkModalOpen && stalkTargetUserId && (
        <StalkConfirmationModal
          isOpen={stalkModalOpen}
          targetUserId={stalkTargetUserId}
          initialUserObj={stalkTargetUserObj || undefined}
          onClose={() => {
            setStalkModalOpen(false);
            setStalkTargetUserId(null);
            setStalkTargetUserObj(null);
          }}
          onConfirmStalk={(userId) => {
            setStalkModalOpen(false);
            setStalkTargetUserId(null);
            setStalkTargetUserObj(null);
            handleConfirmStalk(userId);
          }}
        />
      )}
      {/* FULL-SCREEN IMAGE VIEWER LIGHTBOX */}
      {selectedLightboxImage && (
        <ImageViewerModal
          imageUrl={selectedLightboxImage}
          onClose={() => setSelectedLightboxImage(null)}
        />
      )}
    </div>
  );
}
