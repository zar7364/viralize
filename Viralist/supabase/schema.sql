-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PROFILES TABLE
-- Stores user information extending the built-in auth.users table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  avatar TEXT,
  subscription_tier TEXT DEFAULT 'free', -- 'free', 'pro', 'agency'
  subscription_status TEXT DEFAULT 'active', -- 'active', 'past_due', 'canceled'
  subscription_start TIMESTAMP WITH TIME ZONE,
  subscription_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Set up Row Level Security (RLS) for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Trigger to automatically create a profile for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'avatar', '')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- CREATOR PERSONALITY TABLE
CREATE TABLE public.creator_personality (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  niche TEXT DEFAULT '',
  style TEXT DEFAULT '',
  target_audience TEXT DEFAULT '',
  language TEXT DEFAULT 'Bahasa Indonesia',
  brand_keywords TEXT DEFAULT '',
  avoid_keywords TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.creator_personality ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own personality" 
  ON public.creator_personality FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own personality" 
  ON public.creator_personality FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own personality" 
  ON public.creator_personality FOR UPDATE 
  USING (auth.uid() = user_id);


-- BRIEFS TABLE
CREATE TABLE public.briefs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  topic TEXT NOT NULL,
  platform TEXT NOT NULL,
  tone TEXT NOT NULL,
  hook1 TEXT,
  hook2 TEXT,
  hook3 TEXT,
  outline TEXT,
  full_script TEXT,
  caption TEXT,
  visual_notes TEXT,
  duration TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own briefs" 
  ON public.briefs FOR ALL 
  USING (auth.uid() = user_id);


-- SCHEDULED POSTS TABLE
CREATE TABLE public.scheduled_posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  brief_id UUID REFERENCES public.briefs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  platform TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  caption TEXT,
  calendar_event_id TEXT,
  calendar_event_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own scheduled posts"
  ON public.scheduled_posts FOR ALL
  USING (auth.uid() = user_id);


-- GOOGLE CALENDAR CONNECTIONS TABLE
-- Refresh token per user untuk koneksi Google Calendar masing-masing.
-- Tidak ada RLS policy sama sekali untuk role anon/authenticated - tabel
-- ini cuma boleh diakses lewat service_role key di backend, karena
-- refresh_token setara password dan tidak boleh bisa dibaca dari browser.
CREATE TABLE public.google_calendar_connections (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  refresh_token TEXT NOT NULL,
  connected_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;


-- VOUCHER REDEMPTIONS TABLE
-- Catatan penukaran kode voucher promo, dipakai untuk membatasi jumlah
-- total penukaran per kode. Tidak ada RLS policy - cuma diakses lewat
-- service_role key di backend, sama seperti tabel Calendar di atas.
CREATE TABLE public.voucher_redemptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL,
  redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, code)
);

ALTER TABLE public.voucher_redemptions ENABLE ROW LEVEL SECURITY;
