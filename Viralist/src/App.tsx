import { useState, useEffect, useRef, type FormEvent } from 'react';
import { User, Sparkles, Check } from 'lucide-react';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { BriefCreator } from './components/BriefCreator';
import { Scheduler } from './components/Scheduler';

interface Brief {
  id: string;
  topic: string;
  platform: 'tiktok' | 'reels' | 'shorts';
  tone: string;
  hook1: string;
  hook2: string;
  hook3: string;
  outline: string;
  fullScript?: string;
  caption: string;
  visualNotes?: string;
  duration?: string;
  createdAt: string;
  status?: 'draft' | 'scheduled';
}

interface ScheduledPost {
  id: string;
  briefId: string;
  title: string;
  platform: 'tiktok' | 'reels' | 'shorts';
  date: string;
  time: string;
  caption: string;
  calendarEventId?: string | null;
  calendarEventLink?: string | null;
}

export interface CreatorPersonality {
  niche: string;
  style: string;
  targetAudience: string;
  language: string;
  brandKeywords: string;
  avoidKeywords: string;
}

import { supabase } from './lib/supabase';
import { apiVoucherRedeem } from './lib/api';

export default function App() {
  const [user, setUser] = useState<{ id: string; name: string; email: string; avatar: string; subscription_tier: string; subscription_status: string; subscription_start?: string; subscription_end?: string } | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchProfile(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchProfile(session.user);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (authUser: any) => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('payment') === 'success') {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1);

        await supabase.from('profiles').update({
          subscription_tier: 'pro',
          subscription_start: startDate.toISOString(),
          subscription_end: endDate.toISOString()
        }).eq('id', authUser.id);
        
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();
      
      if (error) {
        // Profil mungkin belum terbuat oleh trigger, tunggu sebentar dan coba lagi (hanya untuk new user)
        if (error.code === 'PGRST116') {
          console.warn('Profile not found, might be still creating...');
          setTimeout(() => fetchProfile(authUser), 1500);
          return;
        }
        throw error;
      }
      
      setUser({
        id: authUser.id,
        name: data?.name || authUser.email,
        email: authUser.email,
        avatar: data?.avatar || authUser.user_metadata?.avatar_url || '',
        subscription_tier: data?.subscription_tier || 'free',
        subscription_status: data?.subscription_status || 'active',
        subscription_start: data?.subscription_start,
        subscription_end: data?.subscription_end
      });

      // Fetch persistent data
      fetchUserBriefs(authUser.id);
      fetchUserScheduledPosts(authUser.id);

      if (activeTab === 'login') {
         setActiveTab('dashboard'); // hanya ganti tab jika sebelumnya tidak login (misal dari halaman awal)
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const fetchUserBriefs = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('briefs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (data) {
        setBriefs(data.map(item => ({
          id: item.id,
          topic: item.topic,
          platform: item.platform,
          tone: item.tone,
          hook1: item.hook1,
          hook2: item.hook2,
          hook3: item.hook3,
          outline: item.outline,
          fullScript: item.full_script,
          caption: item.caption,
          visualNotes: item.visual_notes,
          duration: item.duration,
          status: item.status,
          createdAt: item.created_at,
        })));
      }
    } catch (err) {
      console.error('Error fetching briefs:', err);
    }
  };

  const fetchUserScheduledPosts = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('scheduled_posts')
        .select('*')
        .eq('user_id', userId)
        .order('scheduled_date', { ascending: true });
      
      if (error) throw error;
      
      if (data) {
        setScheduledPosts(data.map(item => ({
          id: item.id,
          briefId: item.brief_id,
          title: item.title,
          platform: item.platform,
          date: item.scheduled_date,
          time: item.scheduled_time,
          caption: item.caption,
          calendarEventId: item.calendar_event_id ?? null,
          calendarEventLink: item.calendar_event_link ?? null,
        })));
      }
    } catch (err) {
      console.error('Error fetching scheduled posts:', err);
    }
  };

  const [personality, setPersonality] = useState<CreatorPersonality>({
    niche: '', style: '', targetAudience: '', language: 'Bahasa Indonesia', brandKeywords: '', avoidKeywords: ''
  });
  const [personalitySaved, setPersonalitySaved] = useState(false);

  const handlePersonalityChange = (field: keyof CreatorPersonality, value: string) => {
    setPersonality(prev => ({ ...prev, [field]: value }));
    setPersonalitySaved(false);
  };

  const savePersonality = () => {
    // Nantinya ini akan di-save ke Supabase (tabel creator_personality)
    setPersonalitySaved(true);
    setTimeout(() => setPersonalitySaved(false), 2500);
  };

  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [briefToSchedule, setBriefToSchedule] = useState<Brief | null>(null);

  const [unsavedBrief, setUnsavedBrief] = useState<Brief | null>(null);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  
  const notifiedPosts = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Request notification permission
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }

    const interval = setInterval(() => {
      const now = new Date();
      scheduledPosts.forEach(post => {
        if (notifiedPosts.current.has(post.id)) return;

        const postTime = new Date(`${post.date}T${post.time}`);
        const diffMs = postTime.getTime() - now.getTime();
        const diffMins = diffMs / 60000;

        // Trigger notification if scheduled within 10 minutes (and we are within 10 to 11 mins range to prevent spam, or simply 0 to 10 mins)
        if (diffMins > 0 && diffMins <= 10) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Content Reminder', {
              body: `Your post "${post.title}" is scheduled to go live in ${Math.ceil(diffMins)} minutes!`,
              icon: '/favicon.ico' // fallback icon
            });
          }
          notifiedPosts.current.add(post.id);
        }
      });
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [scheduledPosts]);

  const handleTabNavigation = (tab: string) => {
    if (activeTab === 'creator' && unsavedBrief) {
      setPendingTab(tab);
    } else {
      setActiveTab(tab);
    }
  };

  const MAYAR_API_TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyNTI0N2I3ZS05YjlkLTQ5NTMtOWRlNy0wMDdhMGQ1MDVjZTEiLCJhY2NvdW50SWQiOiI5MmEzOTNjNi1hOGFhLTQ2MGItOTQ2Yy0yOTJlOTJmYTNhZmIiLCJjcmVhdGVkQXQiOiIxNzg2NDIzNzE2NTY3Iiwicm9sZSI6ImRldmVsb3BlciIsInNjb3BlIjp7InJlYWQiOnRydWUsIndyaXRlIjp0cnVlfSwic3ViIjoibmV6YXJhYmRpbGFocHJha2FzYUBnbWFpbC5jb20iLCJuYW1lIjoiTmV6YXQgQWJkaWxhaCBQcmFrYXNhIiwibGluayI6ImFuYWx5dHJpY3MiLCJpc1NlbGZEb21haW4iOmZhbHNlLCJpYXQiOjE3ODY0MjM3MTZ9.VPoifkVyDKVDOE5hWdYwcgc-6yc3RDSi5I_bXnU9Tx9AMEFyBNdX95McznMjacKES0WAPrmvtBfTG8ituoN1TfcF2_vM1nA_YU0sGP3-OFP21xrxRDhvM9hKsys0Kxr3X8gMFcTM-tQunlNJNRaHzvW8HoNkB5zm2MSOrMd33UG9Who9pq-CZYbDrgSUCia9sSvGHjmMJcIGZkC_-DvdNBwxQRutagdD7buLG6KzOCqQD0ot2H9IlaVb1VD18upEry29qSjFPsDofpAnCBjc73pgCT6Feg517zbkXAtVmEvqV07TNsK31buRQBl8LItNYNjR_kdhrcAMqGag0bMqwQ';
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const handleUpgradeClick = async () => {
    if (!user) return;
    setIsProcessingPayment(true);
    try {
      const res = await fetch('https://api.mayar.id/hl/v1/payment/create', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + MAYAR_API_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: user.name,
          email: user.email,
          mobile: '08123456789', // Placeholder
          amount: 10000, // TODO: harga sementara buat testing, kembalikan ke harga normal nanti
          redirectUrl: window.location.origin + '?payment=success',
          description: 'Viralize Creator Pro (1 Month)',
          paymentMethods: ['qris']
        })
      });
      const data = await res.json();
      if (data && data.data && data.data.link) {
        window.location.href = data.data.link;
      } else {
        alert('Failed to generate payment link. Please try again.');
        setIsProcessingPayment(false);
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to payment gateway.');
      setIsProcessingPayment(false);
    }
  };

  const [voucherCode, setVoucherCode] = useState('');
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState<string | null>(null);

  const handleRedeemVoucher = async (e: FormEvent) => {
    e.preventDefault();
    if (!voucherCode.trim()) return;
    setVoucherLoading(true);
    setVoucherError(null);
    try {
      const result = await apiVoucherRedeem(voucherCode.trim());
      setUser((prev) => prev ? {
        ...prev,
        subscription_tier: result.subscription_tier,
        subscription_status: 'active',
        subscription_end: result.subscription_end,
      } : prev);
      setVoucherCode('');
    } catch (err: any) {
      setVoucherError(err?.message || 'Gagal menukar voucher. Coba lagi.');
    } finally {
      setVoucherLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error during sign out:', error);
    } finally {
      setUser(null);
    }
  };

  const handleSaveBrief = async (newBrief: Brief) => {
    setBriefs((prev) => [newBrief, ...prev]);
    
    if (user) {
      try {
        const { error } = await supabase.from('briefs').insert({
          id: newBrief.id,
          user_id: user.id,
          topic: newBrief.topic,
          platform: newBrief.platform,
          tone: newBrief.tone,
          hook1: newBrief.hook1,
          hook2: newBrief.hook2,
          hook3: newBrief.hook3,
          outline: newBrief.outline,
          full_script: newBrief.fullScript,
          caption: newBrief.caption,
          visual_notes: newBrief.visualNotes,
          duration: newBrief.duration,
          status: newBrief.status || 'draft'
        });
        if (error) throw error;
      } catch (err) {
        console.error('Error saving brief to database:', err);
      }
    }
  };

  const handleScheduleRequest = async (newBrief: Brief) => {
    setBriefs((prev) => [newBrief, ...prev]);
    setBriefToSchedule(newBrief);
    setActiveTab('scheduler');

    if (user) {
      try {
        const { error } = await supabase.from('briefs').insert({
          id: newBrief.id,
          user_id: user.id,
          topic: newBrief.topic,
          platform: newBrief.platform,
          tone: newBrief.tone,
          hook1: newBrief.hook1,
          hook2: newBrief.hook2,
          hook3: newBrief.hook3,
          outline: newBrief.outline,
          full_script: newBrief.fullScript,
          caption: newBrief.caption,
          visual_notes: newBrief.visualNotes,
          duration: newBrief.duration,
          status: newBrief.status || 'draft'
        });
        if (error) throw error;
      } catch (err) {
        console.error('Error saving brief before scheduling:', err);
      }
    }
  };

  const handleSchedulePost = async (postDetails: Omit<ScheduledPost, 'id'>) => {
    const newId = crypto.randomUUID();
    const newScheduled: ScheduledPost = {
      ...postDetails,
      id: newId,
    };
    setScheduledPosts((prev) => [...prev, newScheduled]);

    setBriefs((prev) =>
      prev.map((b) => (b.id === postDetails.briefId ? { ...b, status: 'scheduled' } : b))
    );

    if (user) {
      const basePayload = {
        id: newId,
        user_id: user.id,
        brief_id: postDetails.briefId,
        title: postDetails.title,
        platform: postDetails.platform,
        scheduled_date: postDetails.date,
        scheduled_time: postDetails.time,
        caption: postDetails.caption,
      };

      try {
        let { error } = await supabase.from('scheduled_posts').insert({
          ...basePayload,
          calendar_event_id: postDetails.calendarEventId ?? null,
          calendar_event_link: postDetails.calendarEventLink ?? null,
        });

        // Kolom calendar_event_id/calendar_event_link belum ada di database
        // (migrasi belum jalan - lihat catatan project). PostgREST balas
        // 'PGRST204' (kolom tidak ada di schema cache) untuk INSERT dengan
        // key JSON yang tidak dikenal - beda dari '42703' yang muncul kalau
        // kolom itu direferensikan langsung di query SELECT.
        if (error && ((error as any).code === 'PGRST204' || (error as any).code === '42703')) {
          console.warn('Kolom calendar_event_id/calendar_event_link belum ada di database - menyimpan tanpa itu.');
          ({ error } = await supabase.from('scheduled_posts').insert(basePayload));
        }

        if (error) throw error;

        await supabase.from('briefs').update({ status: 'scheduled' }).eq('id', postDetails.briefId);
      } catch (err) {
        console.error('Error scheduling post:', err);
        // Rollback optimistic update - kalau tidak, jadwal ini kelihatan
        // sukses sekarang tapi "balik ke backlog" membingungkan setelah
        // reload karena sebenarnya tidak pernah tersimpan di database.
        setScheduledPosts((prev) => prev.filter((p) => p.id !== newId));
        setBriefs((prev) =>
          prev.map((b) => (b.id === postDetails.briefId ? { ...b, status: 'draft' } : b))
        );
        alert(
          'Event Google Calendar sudah dibuat, tapi jadwal ini GAGAL disimpan di database aplikasi. ' +
          'Coba lagi. (Detail error ada di console browser.)'
        );
      }
    }
  };

  const handleUnschedulePost = async (id: string) => {
    const postToUnschedule = scheduledPosts.find((p) => p.id === id);
    setScheduledPosts((prev) => prev.filter((p) => p.id !== id));
    
    if (postToUnschedule) {
      setBriefs((prev) =>
        prev.map((b) => (b.id === postToUnschedule.briefId ? { ...b, status: 'draft' } : b))
      );
      
      if (user) {
        try {
          await supabase.from('scheduled_posts').delete().eq('id', id);
          await supabase.from('briefs').update({ status: 'draft' }).eq('id', postToUnschedule.briefId);
        } catch (err) {
          console.error('Error unscheduling post:', err);
        }
      }
    }
  };

  // Hapus brief dari backlog (belum pernah dijadwalkan, jadi tidak ada event
  // Google Calendar yang perlu dihapus - cuma hapus catatan briefnya saja).
  const handleDeleteBrief = async (id: string) => {
    setBriefs((prev) => prev.filter((b) => b.id !== id));

    if (user) {
      try {
        const { error } = await supabase.from('briefs').delete().eq('id', id);
        if (error) throw error;
      } catch (err) {
        console.error('Error deleting brief:', err);
        alert('Gagal menghapus brief dari database. Coba lagi.');
        fetchUserBriefs(user.id);
      }
    }
  };

  if (!user) {
    return <Login />;
  }

  const isExpired = user.subscription_tier === 'pro' && user.subscription_end && new Date(user.subscription_end) < new Date();
  const showPaywall = user.subscription_tier === 'free' || isExpired;

  return (
    <div className="app-container">
      <Header user={user} onLogout={handleLogout} />

      <main className={`main-content ${activeTab === 'dashboard' ? 'main-content-dashboard-override' : ''}`}>
        {showPaywall ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '100%', padding: '2rem' }}>
            <h2 style={{ marginBottom: '0.5rem', color: '#111827', fontSize: '2rem', fontWeight: 800 }}>Pilih Paket Berlangganan</h2>
            <p style={{ marginBottom: '2.5rem', color: '#4b5563', textAlign: 'center' }}>Akun Anda saat ini berada di tier Free. Silakan upgrade untuk membuka semua fitur.</p>

            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: '1200px' }}>
              {/* Free Plan */}
              <div className="pricing-card glass-panel" style={{ maxWidth: '350px', width: '100%', display: 'flex', flexDirection: 'column', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(255, 255, 255, 0.03)' }}>
                <div className="pricing-header">
                  <h3>Free Plan</h3>
                  <p>Fitur dasar untuk pembuatan konten</p>
                  <div className="pricing-price" style={{ fontSize: '1.9rem', color: '#111827', fontWeight: 700 }}>
                    Rp 0<span style={{ fontSize: '0.85rem', fontWeight: 400 }}>/selamanya</span>
                  </div>
                </div>
                <ul className="pricing-features" style={{ listStyle: 'none', padding: 0, margin: '1.5rem 0', flexGrow: 1 }}>
                  <li style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', color: '#4b5563', alignItems: 'center' }}>
                    <Check size={16} /> <span>5 AI Briefs per bulan</span>
                  </li>
                  <li style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', color: '#4b5563', alignItems: 'center' }}>
                    <Check size={16} /> <span>Akses workspace Dual AI Agent</span>
                  </li>
                  <li style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', color: '#4b5563', alignItems: 'center' }}>
                    <Check size={16} /> <span>Kalender editorial bulanan</span>
                  </li>
                </ul>
                <button 
                  className="btn btn-secondary" 
                  style={{ width: '100%', marginTop: 'auto', padding: '0.85rem', borderRadius: '8px', cursor: 'not-allowed', opacity: 0.6, fontWeight: 600, border: '1px solid #d1d5db', backgroundColor: '#f3f4f6', color: '#9ca3af' }} 
                  disabled
                >
                  Belum Tersedia
                </button>
              </div>

              {/* Pro Plan */}
              <div className="pricing-card glass-panel popular" style={{ maxWidth: '350px', width: '100%', display: 'flex', flexDirection: 'column', padding: '2rem', borderRadius: '16px', border: '2px solid #00cbd5', background: 'rgba(0, 203, 213, 0.05)', boxShadow: '0 8px 32px rgba(0, 203, 213, 0.1)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '-12px', right: '20px', background: 'linear-gradient(135deg, #00cbd5 0%, #0891b2 100%)', color: '#fff', fontSize: '0.75rem', fontWeight: 700, padding: '4px 12px', borderRadius: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Popular</div>
                <div className="pricing-header">
                  <h3>Creator Pro</h3>
                  <p>Buka semua fitur untuk mempercepat pertumbuhan konten Anda</p>
                  <div className="pricing-price" style={{ fontSize: '1.9rem', color: '#111827', fontWeight: 700 }}>
                    Rp 10.000<span style={{ fontSize: '0.85rem', fontWeight: 400 }}>/bulan</span>
                  </div>
                </div>
                <ul className="pricing-features" style={{ listStyle: 'none', padding: 0, margin: '1.5rem 0', flexGrow: 1 }}>
                  <li style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', color: '#111827', alignItems: 'center' }}>
                    <Sparkles size={16} style={{ color: '#00cbd5' }} /> <span>AI Briefs Tanpa Batas</span>
                  </li>
                  <li style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', color: '#111827', alignItems: 'center' }}>
                    <Sparkles size={16} style={{ color: '#00cbd5' }} /> <span>Jadwalkan ke Kalender</span>
                  </li>
                  <li style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', color: '#111827', alignItems: 'center' }}>
                    <Sparkles size={16} style={{ color: '#00cbd5' }} /> <span>Prioritas Kecepatan AI</span>
                  </li>
                </ul>
                <button 
                  className="btn" 
                  style={{ width: '100%', marginTop: 'auto', padding: '0.85rem', background: 'linear-gradient(135deg, #00cbd5 0%, #0891b2 100%)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,203,213,0.3)' }} 
                  onClick={handleUpgradeClick}
                  disabled={isProcessingPayment}
                >
                  {isProcessingPayment ? 'Processing...' : 'Upgrade to Pro'}
                </button>
              </div>

              {/* Agency Plan */}
              <div className="pricing-card glass-panel" style={{ maxWidth: '350px', width: '100%', display: 'flex', flexDirection: 'column', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(255, 255, 255, 0.03)' }}>
                <div className="pricing-header">
                  <h3>Agency Plan</h3>
                  <p>Untuk agensi profesional dan tim skala besar</p>
                  <div className="pricing-price" style={{ fontSize: '1.9rem', color: '#111827', fontWeight: 700 }}>
                    Rp 1.500.000<span style={{ fontSize: '0.85rem', fontWeight: 400 }}>/bulan</span>
                  </div>
                </div>
                <ul className="pricing-features" style={{ listStyle: 'none', padding: 0, margin: '1.5rem 0', flexGrow: 1 }}>
                  <li style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', color: '#4b5563', alignItems: 'center' }}>
                    <Check size={16} /> <span>Semua fitur Creator Pro</span>
                  </li>
                  <li style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', color: '#4b5563', alignItems: 'center' }}>
                    <Check size={16} /> <span>Hingga 5 Akun TikTok Scraper</span>
                  </li>
                  <li style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', color: '#4b5563', alignItems: 'center' }}>
                    <Check size={16} /> <span>Dukungan Account Manager Khusus</span>
                  </li>
                </ul>
                <button 
                  className="btn btn-secondary" 
                  style={{ width: '100%', marginTop: 'auto', padding: '0.85rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, border: '1px solid #d1d5db', backgroundColor: '#fff', color: '#374151' }}
                  onClick={() => window.open('https://wa.me/+6285719496865', '_blank')}
                >
                  Contact Sales
                </button>
              </div>
            </div>

            <div style={{ width: '100%', maxWidth: '600px', marginTop: '2rem', background: 'rgba(0,203,213,0.08)', border: '1px solid rgba(0,203,213,0.3)', borderRadius: '14px', padding: '1.25rem 1.5rem', textAlign: 'center' }}>
              <p style={{ margin: 0, marginBottom: '0.75rem', color: '#0f172a', fontSize: '0.9rem' }}>
                Punya kode voucher? Masukkan kode <strong>GOMKA</strong> untuk dapat paket Agency gratis selama 1 bulan (terbatas untuk 10 pengguna pertama).
              </p>
              <form onSubmit={handleRedeemVoucher} style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value)}
                  placeholder="Masukkan kode voucher"
                  disabled={voucherLoading}
                  style={{ padding: '0.6rem 1rem', borderRadius: '9999px', border: '1px solid var(--border-glass)', fontSize: '0.9rem', minWidth: '220px' }}
                />
                <button
                  type="submit"
                  disabled={voucherLoading || !voucherCode.trim()}
                  style={{
                    padding: '0.6rem 1.5rem',
                    borderRadius: '9999px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #00cbd5 0%, #0891b2 100%)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: voucherLoading ? 'not-allowed' : 'pointer',
                    opacity: voucherLoading ? 0.7 : 1,
                  }}
                >
                  {voucherLoading ? 'Memproses...' : 'Gunakan Voucher'}
                </button>
              </form>
              {voucherError && <p style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '0.75rem', marginBottom: 0 }}>{voucherError}</p>}
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard 
                briefs={briefs} 
                scheduledPosts={scheduledPosts} 
                setActiveTab={setActiveTab} 
              />
            )}

            {activeTab === 'creator' && (
              <BriefCreator 
                onSaveBrief={handleSaveBrief} 
                onScheduleRequest={handleScheduleRequest}
                setActiveTab={setActiveTab}
                personality={personality}
                onUnsavedBriefChange={setUnsavedBrief}
              />
            )}

            {activeTab === 'scheduler' && (
              <Scheduler 
                briefs={briefs} 
                scheduledPosts={scheduledPosts} 
                onSchedulePost={handleSchedulePost}
                onUnschedulePost={handleUnschedulePost}
                onDeleteBrief={handleDeleteBrief}
                user={user}
                briefToSchedule={briefToSchedule}
                clearBriefToSchedule={() => setBriefToSchedule(null)}
              />
            )}

            {activeTab === 'settings' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
            {/* Column 1: Identity */}
            <div className="glass-panel" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)' }}>
                <User size={22} /> Account & Personality
              </h2>
              <div style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '0.5rem', color: 'var(--color-primary)' }}>Account & Identity</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Signed in via Google as <strong>{user.name}</strong> ({user.email})
                </p>
                <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                  <h5 style={{ margin: 0, marginBottom: '0.5rem', color: 'var(--color-accent)' }}>Subscription Status</h5>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>Plan: <strong style={{ textTransform: 'uppercase' }}>{user.subscription_tier}</strong></p>
                  {user.subscription_tier === 'pro' && (
                    <>
                      <p style={{ margin: 0, fontSize: '0.85rem', marginTop: '0.2rem' }}>
                        Active From: {user.subscription_start ? new Date(user.subscription_start).toLocaleDateString() : '-'}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.85rem', marginTop: '0.2rem' }}>
                        Valid Until: {user.subscription_end ? new Date(user.subscription_end).toLocaleDateString() : '-'}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* ─── Creator Personality Section ─── */}
              <div style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                  <User size={16} style={{ color: 'var(--color-primary)' }} />
                  <h4 style={{ margin: 0, color: 'var(--color-primary)' }}>Creator Personality Profile</h4>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                  Tell the AI who you are: your niche, style, and audience. This is injected into every brief prompt so generated content always fits your unique creator voice.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Content Niche</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Tech, Finance, Lifestyle, Fitness"
                        value={personality.niche}
                        onChange={e => handlePersonalityChange('niche', e.target.value)}
                        style={{ marginTop: '0.4rem', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Content Language</label>
                      <select
                        className="form-select"
                        value={personality.language}
                        onChange={e => handlePersonalityChange('language', e.target.value)}
                        style={{ marginTop: '0.4rem', fontSize: '0.85rem' }}
                      >
                        <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                        <option value="English">English</option>
                        <option value="Bahasa Indonesia & English (Mix)">Indonesia + English (Mix)</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Creator Style & Personality</label>
                    <textarea
                      className="form-textarea"
                      rows={3}
                      placeholder="Describe your on-camera style, tone, and personality. e.g. 'Energetic, fast-paced, use Gen-Z slang, always end with a challenge'"
                      value={personality.style}
                      onChange={e => handlePersonalityChange('style', e.target.value)}
                      style={{ marginTop: '0.4rem', fontSize: '0.85rem', resize: 'vertical' }}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Target Audience</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Mahasiswa 18-24 tahun, startup founders, ibu rumah tangga"
                      value={personality.targetAudience}
                      onChange={e => handlePersonalityChange('targetAudience', e.target.value)}
                      style={{ marginTop: '0.4rem', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Brand Keywords</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. viral, produktif, mindset"
                        value={personality.brandKeywords}
                        onChange={e => handlePersonalityChange('brandKeywords', e.target.value)}
                        style={{ marginTop: '0.4rem', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Avoid Keywords</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. hustle, toxic, FOMO"
                        value={personality.avoidKeywords}
                        onChange={e => handlePersonalityChange('avoidKeywords', e.target.value)}
                        style={{ marginTop: '0.4rem', fontSize: '0.85rem', borderColor: 'rgba(225,29,72,0.3)' }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={savePersonality}
                    style={{
                      alignSelf: 'flex-start',
                      padding: '0.65rem 1.5rem',
                      border: 'none',
                      borderRadius: '9999px',
                      background: personalitySaved
                        ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                        : 'linear-gradient(135deg, #00cbd5 0%, #0891b2 100%)',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: personalitySaved
                        ? '0 4px 16px rgba(5,150,105,0.3)'
                        : '0 4px 16px rgba(0,203,213,0.3)',
                      transition: 'all 0.3s',
                    }}
                  >
                    <Sparkles size={15} />
                    {personalitySaved ? 'Personality Saved!' : 'Save Personality Profile'}
                  </button>
                </div>
              </div>
              </div>
              
              {/* Column 2: AI Agent */}
              <div className="glass-panel" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)' }}>
                  <Sparkles size={22} /> AI Agent
                </h2>
              <div style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '0.5rem' }}>AI Agent Settings</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Choose default models for the Hook Analyst and Creative Director agents.
                </p>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <select className="form-select" defaultValue="gemini-flash" style={{ maxWidth: '300px' }}>
                    <option value="gemini-flash">Gemini 3.5 Flash (Default)</option>
                    <option value="gemini-pro">Gemini 3.5 Pro</option>
                  </select>
                </div>
            </div>
          </div>
        </div>
        )}
          </>
        )}
      </main>

      {pendingTab && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '1rem', color: '#0f172a' }}>Unsaved Brief!</h3>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              You have a generated brief that hasn't been saved. What would you like to do before leaving this page?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button 
                onClick={() => {
                  if (unsavedBrief) handleScheduleRequest(unsavedBrief);
                  setUnsavedBrief(null);
                  setPendingTab(null);
                }}
                style={{ padding: '0.85rem', background: 'linear-gradient(135deg, #00cbd5 0%, #0891b2 100%)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,203,213,0.3)' }}
              >
                Save & Schedule
              </button>
              <button 
                onClick={() => {
                  if (unsavedBrief) handleSaveBrief(unsavedBrief);
                  setUnsavedBrief(null);
                  setActiveTab(pendingTab);
                  setPendingTab(null);
                }}
                style={{ padding: '0.85rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Save to Backlog
              </button>
              <button 
                onClick={() => {
                  setUnsavedBrief(null);
                  setActiveTab(pendingTab);
                  setPendingTab(null);
                }}
                style={{ padding: '0.85rem', background: 'rgba(225,29,72,0.1)', color: '#e11d48', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Discard & Leave
              </button>
              <button 
                onClick={() => setPendingTab(null)}
                style={{ padding: '0.85rem', background: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <Navigation activeTab={activeTab} setActiveTab={handleTabNavigation} />
    </div>
  );
}
