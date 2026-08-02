export const SUPABASE_SQL_SCHEMA = `-- ========================================================
-- MARSHMALLOW BY ECHOPH - COMPLETE SUPABASE DATABASE SCHEMA
-- Execute this SQL script in your Supabase SQL Editor.
-- ========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS & PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nickname TEXT NOT NULL,
    nickname_last_changed_at TIMESTAMPTZ,
    avatar_url TEXT DEFAULT '',
    status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline')),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for instant username searches
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- 2. FRIENDS & FRIEND REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.friend_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sender_id, receiver_id)
);

CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user1_id, user2_id)
);

-- 3. CHATS TABLE
CREATE TABLE IF NOT EXISTS public.chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
    participants UUID[] NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL DEFAULT '',
    media_type TEXT DEFAULT 'text' CHECK (media_type IN ('text', 'image', 'video', 'file', 'audio')),
    media_url TEXT DEFAULT '',
    media_name TEXT DEFAULT '',
    media_size BIGINT DEFAULT 0,
    audio_duration NUMERIC DEFAULT 0,
    reply_to_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    reactions JSONB DEFAULT '{}'::jsonb,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_edited BOOLEAN DEFAULT FALSE,
    is_unsent BOOLEAN DEFAULT FALSE,
    hidden_for TEXT DEFAULT '[]',
    seen_by UUID[] DEFAULT ARRAY[]::UUID[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_unsent BOOLEAN DEFAULT FALSE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS hidden_for TEXT DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

-- 5. CALL LOGS TABLE
CREATE TABLE IF NOT EXISTS public.calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('video', 'audio')),
    status TEXT NOT NULL CHECK (status IN ('completed', 'declined', 'missed')),
    duration_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. USER SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'dark',
    notifications_enabled BOOLEAN DEFAULT TRUE,
    read_receipts BOOLEAN DEFAULT TRUE,
    online_status_visible BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist before creating
DROP POLICY IF EXISTS "Public profiles are accessible" ON public.profiles;
DROP POLICY IF EXISTS "Public friend requests are accessible" ON public.friend_requests;
DROP POLICY IF EXISTS "Public friendships are accessible" ON public.friendships;
DROP POLICY IF EXISTS "Public chats are accessible" ON public.chats;
DROP POLICY IF EXISTS "Public messages are accessible" ON public.messages;
DROP POLICY IF EXISTS "Public calls are accessible" ON public.calls;
DROP POLICY IF EXISTS "Public notifications are accessible" ON public.notifications;
DROP POLICY IF EXISTS "Public user settings are accessible" ON public.user_settings;

-- Allow public read/write access
CREATE POLICY "Public profiles are accessible" ON public.profiles FOR ALL USING (true);
CREATE POLICY "Public friend requests are accessible" ON public.friend_requests FOR ALL USING (true);
CREATE POLICY "Public friendships are accessible" ON public.friendships FOR ALL USING (true);
CREATE POLICY "Public chats are accessible" ON public.chats FOR ALL USING (true);
CREATE POLICY "Public messages are accessible" ON public.messages FOR ALL USING (true);
CREATE POLICY "Public calls are accessible" ON public.calls FOR ALL USING (true);
CREATE POLICY "Public notifications are accessible" ON public.notifications FOR ALL USING (true);
CREATE POLICY "Public user settings are accessible" ON public.user_settings FOR ALL USING (true);

-- ENABLE SUPABASE REALTIME REPLICATION (Safely ignored if already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'friend_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
  END IF;
END $$;
`;
