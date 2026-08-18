import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles, ArrowRight, ShieldCheck, Calendar, Smartphone, RefreshCw,
  Check, HelpCircle, ChevronDown, TrendingUp, Activity,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { AnimatedWorkflow } from './AnimatedWorkflow';
import { AIFlowCanvas } from './AIFlowCanvas';
import { supabase } from '../lib/supabase';

export const Login: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const lang = 'en';

  const t = {
    en: {
      navFeatures: 'Features',
      navWorkflow: 'Workflow',
      navPricing: 'Pricing',
      navFaq: 'FAQ',
      signIn: 'Sign In',
      connecting: 'Connecting...',
      newBadge: 'Make your content stand out with AI',
      heroTitlePre: 'Create scripts, schedule posts & monitor metrics with a data-driven strategy, ',
      heroTitleHighlight: 'as lightning-fast AI',
      heroSubtitle: 'Supercharge your TikTok, Reels, and Shorts presence. Let specialized AI agents generate outline visual drafts, monitor platform analytics, and auto-optimize your data-driven content strategy.',
      getStarted: 'Get Started with Google',
      explore: 'Explore Features',
      supported: 'Viralize your content in',
      pricingTitle: 'Simple, Transparent Pricing',
      pricingSubtitle: 'Choose the plan that fits your growth. Start creating high-converting short-form scripts today.',
      faqTitle: 'Frequently Asked Questions',
      faqSubtitle: 'Everything you need to know about our multi-agent platform and scraping workflow.',
      step1Title: 'STEP 1',
      step1Desc: 'Link your TikTok account to automatically scrape and sync relevant analytics metrics to your workspace.',
      step2Title: 'STEP 2',
      step2Desc: 'Collaborate with Hook Analyst and Creative Director agents to draft outline visual short-form scripts.',
      step3Title: 'STEP 3',
      step3Desc: 'Queue final drafts straight to your content scheduler calendar and track reach growth dynamically.',
      workflowBadge: 'AI Architecture',
      workflowTitle: 'Collaborative Multi-Agent Flow',
      workflowSubtitle: 'Two specialized LLM-powered agents work together in a live workshop to output perfect hooks and directing cues.',
      agent1Title: 'Hook & Trend Analyst',
      agent1Desc: 'Scours current platform search volumes, analyzes trending formats, recommends high-retention hook text variations, and generates viral hashtags.',
      agent2Title: 'Creative Script Director',
      agent2Desc: 'Pulls hooks data, structures the video script (intro, problem, tips, CTA), writes visual direction cues, and drafts a compelling video caption.',
      featuresBadge: 'Features',
      featuresTitle: 'Designed for Short-Form Creators',
      featuresSubtitle: 'Viralize skips unnecessary bloat to help you focus entirely on your content generation pipeline.',
      feat1Title: 'Dual AI Agent Workshop',
      feat1Desc: 'Watch agents converse and compile briefs. View terminal outputs live and edit briefs to match your brand style.',
      feat2Title: 'Monthly Editorial Calendar',
      feat2Desc: 'Drag briefs directly from the backlog and schedule publication times. Clear, visual weekly-monthly overview grids.',
      feat3Title: 'Mobile Phone Feed Preview',
      feat3Desc: 'Click calendar schedules to test exactly how captions, usernames, hashtags, and buttons fit inside a virtual phone simulator shell.',
      feat4Title: 'AI Content Strategy',
      feat4Desc: 'Extract high-performance content pillars. Analyze past views and metrics to auto-strategize hooks, script angles, and video length.',
      feat5Title: 'Performance Monitoring',
      feat5Desc: 'Monitor key metrics like follower growth curves, views, likes, and engagement directly in the workspace sync pipeline.',
      feat6Title: 'TikTok Profile Auto-Sync',
      feat6Desc: 'Link your social accounts to scrape real-time views and follower statistics, instantly syncing pipeline intelligence.',
      footerDesc: 'First collaborative AI agents platform for short-form video hooks research, outline director scripts, and auto-scheduling.',
      rights: 'Hak Cipta Dilindungi.',
      planStarter: 'Starter',
      planStarterDesc: 'Ideal for new creators getting started with AI scheduling.',
      planFree: 'Start for Free',
      planPro: 'Creator Pro',
      planProDesc: 'For active creators who publish content daily.',
      planUpgrade: 'Upgrade to Pro',
      planAgency: 'Agency',
      planAgencyDesc: 'For marketing agencies and content teams.',
      planSales: 'Contact Sales',
    },
    id: {
      navFeatures: 'Fitur',
      navWorkflow: 'Alur Kerja',
      navPricing: 'Harga',
      navFaq: 'FAQ',
      signIn: 'Masuk',
      connecting: 'Menghubungkan...',
      newBadge: 'Buat konten Anda menonjol dengan AI',
      heroTitlePre: 'Buat naskah, jadwalkan postingan & pantau metrik dengan strategi berbasis data, ',
      heroTitleHighlight: 'layaknya AI kilat',
      heroSubtitle: 'Maksimalkan kehadiran TikTok, Reels, dan Shorts Anda. Biarkan agen AI khusus menyusun draf naskah visual, memantau analitik platform, dan mengoptimalkan strategi konten berbasis data.',
      getStarted: 'Mulai dengan Google',
      explore: 'Jelajahi Fitur',
      supported: 'Viralkan kontenmu di',
      pricingTitle: 'Harga Sederhana & Transparan',
      pricingSubtitle: 'Pilih paket yang sesuai dengan pertumbuhan Anda. Mulai buat naskah berkinerja tinggi hari ini.',
      faqTitle: 'Pertanyaan yang Sering Diajukan',
      faqSubtitle: 'Semua yang perlu Anda ketahui tentang platform multi-agen dan alur scraping kami.',
      step1Title: 'LANGKAH 1',
      step1Desc: 'Hubungkan akun TikTok Anda untuk secara otomatis mengambil dan menyinkronkan data analitik ke ruang kerja Anda.',
      step2Title: 'LANGKAH 2',
      step2Desc: 'Berkolaborasi dengan agen Hook Analyst dan Creative Director untuk menyusun draf outline naskah visual.',
      step3Title: 'LANGKAH 3',
      step3Desc: 'Masukkan draf akhir langsung ke kalender penjadwalan konten Anda dan pantau pertumbuhan jangkauan secara dinamis.',
      workflowBadge: 'Arsitektur AI',
      workflowTitle: 'Alur Kerja Kolaboratif Multi-Agen',
      workflowSubtitle: 'Dua agen khusus bertenaga LLM bekerja sama di ruang kerja langsung untuk menghasilkan hook dan petunjuk arah visual terbaik.',
      agent1Title: 'Analis Hook & Tren',
      agent1Desc: 'Memindai volume pencarian platform, menganalisis format tren saat ini, merekomendasikan variasi teks hook berkinerja tinggi, dan menghasilkan tagar viral.',
      agent2Title: 'Direktur Naskah Kreatif',
      agent2Desc: 'Mengambil data hook, menyusun naskah video (intro, masalah, solusi, CTA), menulis isyarat petunjuk visual, dan merancang caption menarik.',
      featuresBadge: 'Fitur',
      featuresTitle: 'Didesain untuk Kreator Konten Pendek',
      featuresSubtitle: 'Viralize menghilangkan kerumitan tidak perlu agar Anda dapat fokus sepenuhnya pada jalur pembuatan konten Anda.',
      feat1Title: 'Ruang Kerja Dual AI Agent',
      feat1Desc: 'Lihat percakapan agen dan kompilasi brief secara langsung. Pantau output terminal live dan edit naskah agar sesuai gaya brand Anda.',
      feat2Title: 'Kalender Editorial Bulanan',
      feat2Desc: 'Tarik naskah langsung dari backlog dan jadwalkan waktu publikasi. Kalender visual mingguan-bulanan yang sangat jelas.',
      feat3Title: 'Pratinjau Feed Handphone',
      feat3Desc: 'Klik jadwal kalender untuk menguji bagaimana caption, hashtag, dan tombol pas di dalam cangkang simulator handphone virtual.',
      feat4Title: 'Strategi Konten AI',
      feat4Desc: 'Ekstrak pilar konten berkinerja tinggi. Analisis metrik tayangan masa lalu untuk menyusun strategi hook, sudut pandang naskah, dan durasi video.',
      feat5Title: 'Pemantauan Kinerja',
      feat5Desc: 'Pantau metrik penting seperti kurva pertumbuhan pengikut, tayangan, suka, dan interaksi langsung di dalam pipeline integrasi.',
      feat6Title: 'Sinkronisasi Profil TikTok',
      feat6Desc: 'Hubungkan akun sosial Anda untuk mengambil tayangan waktu nyata dan statistik pengikut secara otomatis.',
      footerDesc: 'Platform kolaborasi AI agents pertama untuk riset hook video pendek, caption generator, dan penjadwalan konten otomatis.',
      rights: 'Hak Cipta Dilindungi.',
      planStarter: 'Starter',
      planStarterDesc: 'Sangat cocok untuk kreator baru yang ingin memulai penjadwalan konten dengan AI.',
      planFree: 'Mulai Gratis',
      planPro: 'Creator Pro',
      planProDesc: 'Untuk kreator aktif yang mempublikasikan konten setiap hari.',
      planUpgrade: 'Upgrade ke Pro',
      planAgency: 'Agency',
      planAgencyDesc: 'Untuk agensi pemasaran dan tim konten kreatif.',
      planSales: 'Hubungi Sales',
    }
  }[lang];

  const faqs = {
    en: [
      {
        q: "How does the Dual AI Agents collaboration work?",
        a: "Viralize operates two autonomous agents. The first agent (Hook Analyst) researches keyword trends and generates 3 high-performing hook variations. The analysis is automatically sent to the second agent (Creative Director), which structures the video script outlines and drafts captions."
      },
      {
        q: "How does the TikTok Scraper feature work?",
        a: "Simply enter your TikTok username in the Settings panel. Our AI gathers publicly available analytics such as follower count, total likes, and recent video metadata, instantly syncing this intelligence to your main dashboard."
      },
      {
        q: "Can I cancel my subscription at any time?",
        a: "Yes, you can upgrade, downgrade, or cancel your subscription plan at any time directly through the billing settings dashboard with no cancellation fees."
      },
      {
        q: "Does Viralize support Reels and Shorts?",
        a: "Yes, you can automatically draft, schedule, and queue short-form content for TikTok, Instagram Reels, and YouTube Shorts through a single, unified editorial calendar."
      },
      {
        q: "Is the account scraper secure to use?",
        a: "Completely secure. Our system only collects publicly available creator profile metadata (such as view counts, likes, and follower numbers) without ever asking for your account passwords."
      },
      {
        q: "How does the AI help in formulating a content strategy?",
        a: "The AI monitors your past video performance, maps out optimal posting hours with peak engagement, and recommends new content pillars tailored specifically to your audience niche."
      }
    ],
    id: [
      {
        q: "Bagaimana cara kerja kolaborasi Dual AI Agents?",
        a: "Viralize mengoperasikan dua agen mandiri. Agen pertama (Hook Analyst) meneliti tren kata kunci dan membuat 3 alternatif hook berkinerja tinggi. Hasil analisis tersebut secara otomatis dikirim ke Agen kedua (Creative Director) yang bertugas menyusun outline script video secara berurutan dan menyusun caption."
      },
      {
        q: "Bagaimana fitur Scraper TikTok bekerja?",
        a: "Cukup masukkan username TikTok Anda di menu Settings. AI kami akan mengumpulkan data analitik publik seperti jumlah pengikut, total likes, dan metadata video terbaru Anda. Data ini disinkronisasikan ke dalam dashboard utama Anda secara real-time."
      },
      {
        q: "Apakah saya bisa membatalkan langganan kapan saja?",
        a: "Ya, Anda dapat menaikkan, menurunkan, atau membatalkan langganan Anda kapan saja melalui dashboard pengaturan billing tanpa biaya penalti."
      },
      {
        q: "Apakah Viralize mendukung Reels dan Shorts?",
        a: "Ya, Anda dapat mempublikasikan dan menjadwalkan konten secara otomatis untuk TikTok, Instagram Reels, dan YouTube Shorts langsung melalui satu kalender editorial terpusat."
      },
      {
        q: "Apakah data scraper aman digunakan?",
        a: "Sangat aman. Sistem kami hanya mengumpulkan metadata publik yang tersedia di profil kreator Anda (seperti jumlah views, likes, dan followers) tanpa meminta kata sandi akun Anda."
      },
      {
        q: "Bagaimana AI membantu menyusun strategi?",
        a: "AI memantau performa postingan Anda sebelumnya, memetakan jam-jam posting dengan engagement tinggi, dan merumuskan content pillars baru yang disesuaikan dengan niche Anda."
      }
    ]
  }[lang];

  const carouselRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (carouselRef.current) {
      const card = carouselRef.current.querySelector('.feature-item-card');
      if (card) {
        carouselRef.current.scrollBy({ left: -(card.clientWidth + 24), behavior: 'smooth' });
      } else {
        carouselRef.current.scrollBy({ left: -320, behavior: 'smooth' });
      }
    }
  };

  const scrollRight = () => {
    if (carouselRef.current) {
      const card = carouselRef.current.querySelector('.feature-item-card');
      if (card) {
        carouselRef.current.scrollBy({ left: card.clientWidth + 24, behavior: 'smooth' });
      } else {
        carouselRef.current.scrollBy({ left: 320, behavior: 'smooth' });
      }
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (carouselRef.current) {
        const track = carouselRef.current;
        const card = track.querySelector('.feature-item-card');
        if (card) {
          const cardWidth = card.clientWidth + 24; // Card width + gap
          const maxScrollLeft = track.scrollWidth - track.clientWidth;
          
          if (track.scrollLeft >= maxScrollLeft - 10) {
            track.scrollTo({ left: 0, behavior: 'smooth' });
          } else {
            track.scrollBy({ left: cardWidth, behavior: 'smooth' });
          }
        }
      }
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      alert(err.message || 'Failed to connect to Google');
      setIsLoading(false);
    }
  };

  return (
    <div className="landing-container" style={{ position: 'relative', overflow: 'hidden', backgroundColor: '#ffffff' }}>

      {/* Ambient background animation grid and blobs */}
      <div className="hero-ambient-bg">
        <div className="hero-grid-pattern"></div>
        <div className="hero-glow-blob-1"></div>
        <div className="hero-glow-blob-2"></div>
      </div>

      {/* Floating Capsule Navbar */}
      <nav className="landing-navbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="logo-container" style={{ display: 'flex', alignItems: 'center', margin: 0, gap: '0.6rem', alignSelf: 'center' }}>
          <img src="/logo.png" alt="Viralize" width={28} style={{ height: 'auto', display: 'block' }} />
          <span className="logo-text" style={{ fontSize: '1.05rem', fontWeight: 700, lineHeight: 1 }}>Viralize</span>
        </div>

        {/* Center Navigation Links */}
        <div className="landing-nav-links" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <a href="#features" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = '#00cbd5'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>{t.navFeatures}</a>
          <a href="#workflow" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = '#00cbd5'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>{t.navWorkflow}</a>
          <a href="#pricing" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = '#00cbd5'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>{t.navPricing}</a>
          <a href="#faq" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = '#00cbd5'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>{t.navFaq}</a>
        </div>

        <button 
          className="btn btn-secondary" 
          onClick={handleGoogleLogin} 
          disabled={isLoading}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.45rem 1.25rem', fontSize: '0.8rem', borderRadius: '9999px', margin: 0, height: '32px' }}
        >
          {isLoading ? t.connecting : t.signIn}
        </button>
      </nav>

      {/* Clean Centered Hero Section */}
      <header className="clean-hero">
        <div className="new-feature-badge">
          <span className="badge-pill">New</span> {t.newBadge}
        </div>
        
        <h1>
          {t.heroTitlePre}<span className="hero-highlight-pill">{t.heroTitleHighlight}</span>
        </h1>
        
        <p>
          {t.heroSubtitle}
        </p>

        <div className="hero-cta-buttons">
          <button 
            className="btn btn-primary" 
            onClick={handleGoogleLogin} 
            disabled={isLoading}
            style={{ border: 'none', padding: '0.8rem 1.75rem', fontSize: '0.95rem', fontWeight: 600, borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {isLoading ? (
              <>
                <RefreshCw className="typing-dot" style={{ animation: 'spin 1.5s linear infinite' }} size={16} />
                <span>{t.connecting}</span>
              </>
            ) : (
              <>
                <span>{t.getStarted}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
          
          <a 
            href="#features"
            className="btn btn-outline"
            style={{ padding: '0.8rem 1.75rem', fontSize: '0.95rem', fontWeight: 600, borderRadius: '9999px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
          >
            {t.explore}
          </a>
        </div>
      </header>

      {/* Three Step Feature Cards Grid */}
      <div className="workflow-steps-grid">
        {/* Step 1 Card */}
        <div className="step-card">
          <div className="step-card-visual">
            <div className="mock-input-box">
              <span className="mock-at">@</span>
              <span className="mock-input-text">creator_profile</span>
              <span className="mock-check"><Check size={12} /></span>
            </div>
          </div>
          <div className="step-card-body">
            <div className="step-num">{t.step1Title}</div>
            <p>{t.step1Desc}</p>
          </div>
        </div>

        {/* Step 2 Card */}
        <div className="step-card">
          <div className="step-card-visual">
            <div className="mock-agents-chat">
              <div className="mock-bubble left">
                <strong>Hook Agent:</strong> "Use a pattern-interrupt hook!"
              </div>
              <div className="mock-bubble right">
                <strong>Director:</strong> "Added visual zoom cuts & guidelines."
              </div>
            </div>
          </div>
          <div className="step-card-body">
            <div className="step-num">{t.step2Title}</div>
            <p>{t.step2Desc}</p>
          </div>
        </div>

        {/* Step 3 Card */}
        <div className="step-card">
          <div className="step-card-visual">
            <div className="mock-chart-container">
              <div className="mock-bar" style={{ height: '30%' }}></div>
              <div className="mock-bar" style={{ height: '50%' }}></div>
              <div className="mock-bar active" style={{ height: '80%' }}></div>
              <div className="mock-bar" style={{ height: '65%' }}></div>
              <div className="mock-bar active" style={{ height: '95%' }}></div>
            </div>
          </div>
          <div className="step-card-body">
            <div className="step-num">{t.step3Title}</div>
            <p>{t.step3Desc}</p>
          </div>
        </div>
      </div>

      {/* Hero Testimonial & Social Proof Logos */}
      <div className="hero-testimonial">
        <img 
          src="/tiktok-logo.png" 
          className="testimonial-avatar" 
          alt="TikTok for Business" 
          style={{ width: '40px', height: '40px', borderRadius: '0', border: 'none', objectFit: 'contain', boxShadow: 'none' }}
        />
        <p className="testimonial-quote">
          "Don't make ads. Make TikToks."
        </p>
        <span className="testimonial-author">- TikTok for Business</span>
      </div>

      <div className="logos-strip" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', padding: '1.5rem 2.5rem 3.5rem', borderBottom: '1px solid var(--border-glass)' }}>
        <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>
          {t.supported}
        </span>
        <div style={{ display: 'flex', gap: '3.5rem', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          {/* TikTok Logo */}
          <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', opacity: 0.8, transition: 'opacity 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}>
            <img src="/tiktok-logo.png" alt="TikTok" style={{ height: '24px', objectFit: 'contain' }} />
          </a>

          {/* Instagram Logo */}
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', opacity: 0.8, transition: 'opacity 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}>
            <img src="/instagram-logo.png" alt="Instagram" style={{ height: '36px', objectFit: 'contain' }} />
          </a>

          {/* YouTube Logo */}
          <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', opacity: 0.8, transition: 'opacity 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}>
            <img src="/youtube-logo.png" alt="YouTube" style={{ height: '22px', objectFit: 'contain' }} />
          </a>
        </div>
      </div>

      {/* Dual Agent Workflow Section */}
      <section id="workflow" className="landing-section" style={{ borderTop: '1px solid var(--border-glass)' }}>
        <div className="section-header">
          <div className="landing-badge" style={{ alignSelf: 'center' }}>{t.workflowBadge}</div>
          <h2>{t.workflowTitle}</h2>
          <p>{t.workflowSubtitle}</p>
        </div>

        <AnimatedWorkflow />
        <div style={{ height: '3rem' }}></div>
        <AIFlowCanvas />
      </section>

      {/* Features Grid Section */}
      <section id="features" className="landing-section" style={{ borderTop: '1px solid var(--border-glass)', background: 'var(--bg-secondary)' }}>
        <div className="section-header">
          <div className="landing-badge" style={{ alignSelf: 'center' }}>{t.featuresBadge}</div>
          <h2>{t.featuresTitle}</h2>
          <p>{t.featuresSubtitle}</p>
        </div>

        <div className="features-carousel-container">
          <button className="carousel-btn prev" onClick={scrollLeft} aria-label="Previous slide">
            <ChevronLeft size={20} />
          </button>

          <div className="features-carousel-track" ref={carouselRef}>
            <div className="feature-item-card glass-panel">
              <div className="feature-item-icon">
                <Sparkles size={22} />
              </div>
              <h3 className="feature-item-title">{t.feat1Title}</h3>
              <p className="feature-item-desc">
                {t.feat1Desc}
              </p>
            </div>

            <div className="feature-item-card glass-panel">
              <div className="feature-item-icon">
                <Calendar size={22} />
              </div>
              <h3 className="feature-item-title">{t.feat2Title}</h3>
              <p className="feature-item-desc">
                {t.feat2Desc}
              </p>
            </div>

            <div className="feature-item-card glass-panel">
              <div className="feature-item-icon">
                <Smartphone size={22} />
              </div>
              <h3 className="feature-item-title">{t.feat3Title}</h3>
              <p className="feature-item-desc">
                {t.feat3Desc}
              </p>
            </div>

            {/* Card 4: AI Strategy Optimizer */}
            <div className="feature-item-card glass-panel">
              <div className="feature-item-icon" style={{ color: 'var(--color-primary)' }}>
                <TrendingUp size={22} />
              </div>
              <h3 className="feature-item-title">{t.feat4Title}</h3>
              <p className="feature-item-desc">
                {t.feat4Desc}
              </p>
            </div>

            {/* Card 5: Real-time Performance Monitoring */}
            <div className="feature-item-card glass-panel">
              <div className="feature-item-icon" style={{ color: 'var(--color-secondary)' }}>
                <Activity size={22} />
              </div>
              <h3 className="feature-item-title">{t.feat5Title}</h3>
              <p className="feature-item-desc">
                {t.feat5Desc}
              </p>
            </div>

            {/* Card 6: Dynamic Scraper Integration */}
            <div className="feature-item-card glass-panel">
              <div className="feature-item-icon" style={{ color: 'var(--color-primary)' }}>
                <RefreshCw size={22} />
              </div>
              <h3 className="feature-item-title">{t.feat6Title}</h3>
              <p className="feature-item-desc">
                {t.feat6Desc}
              </p>
            </div>
          </div>

          <button className="carousel-btn next" onClick={scrollRight} aria-label="Next slide">
            <ChevronRight size={20} />
          </button>
        </div>
      </section>

      {/* Pricing Packages Section */}
      <section id="pricing" className="landing-section" style={{ borderTop: '1px solid var(--border-glass)' }}>
        <div className="section-header">
          <div className="landing-badge" style={{ alignSelf: 'center' }}>Plans & Pricing</div>
          <h2>{t.pricingTitle}</h2>
          <p>{t.pricingSubtitle}</p>
        </div>

        <div className="pricing-grid">
          {/* Starter Plan */}
          <div className="pricing-card glass-panel">
            <div className="pricing-header">
              <h3>{t.planStarter}</h3>
              <p>{t.planStarterDesc}</p>
              <div className="pricing-price" style={{ fontSize: '1.9rem' }}>
                Rp 0<span style={{ fontSize: '0.85rem' }}>/bulan</span>
              </div>
            </div>
            <ul className="pricing-features">
              <li>
                <Check size={16} />
                <span>5 AI briefs per month</span>
              </li>
              <li>
                <Check size={16} />
                <span>Dual AI Agent workspace access</span>
              </li>
              <li>
                <Check size={16} />
                <span>Monthly editorial calendar</span>
              </li>
              <li>
                <Check size={16} />
                <span>Mobile feed layout previewer</span>
              </li>
            </ul>
            <button className="btn btn-secondary" style={{ width: '100%', marginTop: '1rem' }} onClick={handleGoogleLogin}>
              {t.planFree}
            </button>
          </div>

          {/* Pro Plan */}
          <div className="pricing-card glass-panel popular">
            <div className="pricing-header">
              <h3>{t.planPro}</h3>
              <p>{t.planProDesc}</p>
              <div className="pricing-price" style={{ fontSize: '1.9rem' }}>
                Rp 10.000<span style={{ fontSize: '0.85rem' }}>/bulan</span>
              </div>
            </div>
            <ul className="pricing-features">
              <li>
                <Check size={16} />
                <span>Unlimited AI briefs</span>
              </li>
              <li>
                <Check size={16} />
                <span>Custom agent prompt templates</span>
              </li>
              <li>
                <Check size={16} />
                <span>Link 1 TikTok Scraper account</span>
              </li>
              <li>
                <Check size={16} />
                <span>Scraped video historical analytics</span>
              </li>
              <li>
                <Check size={16} />
                <span>Priority generation speed</span>
              </li>
            </ul>
            <button className="btn" style={{ padding: '0.85rem', background: 'linear-gradient(135deg, #00cbd5 0%, #0891b2 100%)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,203,213,0.3)', width: '100%', marginTop: '1rem' }} onClick={handleGoogleLogin}>
              {t.planUpgrade}
            </button>
          </div>

          {/* Agency Plan */}
          <div className="pricing-card glass-panel">
            <div className="pricing-header">
              <h3>{t.planAgency}</h3>
              <p>{t.planAgencyDesc}</p>
              <div className="pricing-price" style={{ fontSize: '1.9rem' }}>
                Rp 1.500.000<span style={{ fontSize: '0.85rem' }}>/bulan</span>
              </div>
            </div>
            <ul className="pricing-features">
              <li>
                <Check size={16} />
                <span>Everything in Pro</span>
              </li>
              <li>
                <Check size={16} />
                <span>Link up to 5 TikTok scrapers</span>
              </li>
              <li>
                <Check size={16} />
                <span>Team collaboration workspace</span>
              </li>
              <li>
                <Check size={16} />
                <span>API integration access</span>
              </li>
              <li>
                <Check size={16} />
                <span>Dedicated account support</span>
              </li>
            </ul>
            <button className="btn btn-secondary" style={{ width: '100%', marginTop: '1rem' }} onClick={handleGoogleLogin}>
              {t.planSales}
            </button>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="landing-section" style={{ borderTop: '1px solid var(--border-glass)', background: 'var(--bg-secondary)' }}>
        <div className="section-header">
          <div className="landing-badge" style={{ alignSelf: 'center' }}>FAQ</div>
          <h2>{t.faqTitle}</h2>
          <p>{t.faqSubtitle}</p>
        </div>

        <div className="faq-list" style={{ maxWidth: '810px', margin: '3rem auto 0', width: '90%' }}>
          {faqs.map((faq, idx) => (
            <div key={idx} className="faq-item glass-panel">
              <div className="faq-question" onClick={() => toggleFaq(idx)}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <HelpCircle size={18} style={{ color: 'var(--color-primary)' }} />
                  <span>{faq.q}</span>
                </span>
                <ChevronDown size={16} className={`faq-chevron ${activeFaq === idx ? 'open' : ''}`} />
              </div>
              <div className={`faq-answer-wrapper ${activeFaq === idx ? 'open' : ''}`}>
                <p className="faq-answer">
                  {faq.a}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Extended Footer Section */}
      <footer style={{ borderTop: '1px solid var(--border-glass)', background: 'var(--bg-primary)', width: '100%' }}>
        <div className="landing-footer-grid">
          <div className="footer-col">
            <div className="logo-container" style={{ margin: 0, gap: '0.6rem', marginBottom: '0.5rem' }}>
              <img src="/logo.png" alt="Viralize" width={30} style={{ height: 'auto', display: 'block' }} />
              <span className="logo-text" style={{ fontSize: '1.25rem', fontWeight: 800 }}>Viralize</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', maxWidth: '260px' }}>
              {t.footerDesc}
            </p>
          </div>

          <div className="footer-col">
            <h5>Product</h5>
            <ul className="footer-links">
              <li><a href="#" onClick={(e) => e.preventDefault()}>AI Workspace</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>Smart Calendar</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>TikTok Scraper</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>Pricing Plans</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h5>Company</h5>
            <ul className="footer-links">
              <li><a href="#" onClick={(e) => e.preventDefault()}>About Us</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>Blog Articles</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>Career Path</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>Media Kit</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h5>Legal</h5>
            <ul className="footer-links">
              <li><a href="#" onClick={(e) => e.preventDefault()}>Privacy Policy</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>Terms of Service</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>Security Systems</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>GDPR Compliance</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            © {new Date().getFullYear()} Viralize. {t.rights}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            <ShieldCheck size={16} style={{ color: 'var(--color-primary)' }} />
            <span>Google OAuth Secure Authentication Enabled</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
