import React from 'react';
import { Sparkles, Calendar, FileText, CheckCircle2, Clock, Archive } from 'lucide-react';

interface Brief {
  id: string;
  topic: string;
  platform: 'tiktok' | 'reels' | 'shorts';
  tone: string;
  hook1: string;
  hook2: string;
  hook3: string;
  outline: string;
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
}

interface DashboardProps {
  briefs: Brief[];
  scheduledPosts: ScheduledPost[];
  setActiveTab: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ briefs, scheduledPosts, setActiveTab }) => {
  const totalBriefs = briefs.length;
  const totalScheduled = scheduledPosts.length;

  const backlogCount = briefs.filter(b => !scheduledPosts.some(p => p.briefId === b.id)).length;
  // Sort posts by date to show next up
  const upcomingPosts = [...scheduledPosts].sort((a, b) => {
    return new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime();
  }).slice(0, 3); // show top 3

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="dashboard-header">
        <div className="dashboard-title">
          <h1>Let's Viralize Your Content with AI</h1>
          <p>Welcome back! Let's see how your AI content pipeline is performing today.</p>
        </div>
      </div>

      <div className="stats-grid-row">
        {/* Card 1: Briefs Created */}
        <div className="stat-card glass-panel" style={{ 
          background: 'linear-gradient(135deg, rgba(0, 203, 213, 0.03) 0%, rgba(8, 145, 178, 0.06) 100%)', 
          border: '1px solid rgba(0, 203, 213, 0.2)', 
          borderRadius: '16px', 
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          textAlign: 'left'
        }}>
          <div className="stat-column-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Briefs Created</h4>
            <div className="stat-icon-wrapper" style={{ color: '#00cbd5', background: 'rgba(0, 203, 213, 0.1)', padding: '6px', borderRadius: '8px', display: 'flex' }}>
              <FileText size={18} />
            </div>
          </div>
          <div className="stat-number" style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>{totalBriefs}</div>
          <div className={`stat-change ${totalBriefs > 0 ? 'positive' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', color: totalBriefs > 0 ? 'var(--color-success)' : 'var(--text-muted)', fontWeight: 500, minHeight: '1.2rem' }}>
            {totalBriefs > 0 ? (
              <>
                <FileText size={14} />
                <span>Total generated</span>
              </>
            ) : (
              <span>No activity yet</span>
            )}
          </div>
        </div>

        {/* Card 2: Scheduled Posts */}
        <div className="stat-card glass-panel" style={{ 
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.03) 0%, rgba(217, 70, 239, 0.05) 100%)', 
          border: '1px solid rgba(139, 92, 246, 0.2)', 
          borderRadius: '16px', 
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          textAlign: 'left'
        }}>
          <div className="stat-column-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scheduled Posts</h4>
            <div className="stat-icon-wrapper" style={{ color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.1)', padding: '6px', borderRadius: '8px', display: 'flex' }}>
              <Calendar size={18} />
            </div>
          </div>
          <div className="stat-number" style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>{totalScheduled}</div>
          <div className="stat-change positive" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', color: totalScheduled > 0 ? 'var(--color-success)' : 'var(--text-muted)', fontWeight: 500 }}>
            <CheckCircle2 size={14} style={{ color: totalScheduled > 0 ? 'var(--color-success)' : 'var(--text-muted)' }} />
            <span>{totalScheduled > 0 ? 'Queue is active' : 'Queue is empty'}</span>
          </div>
        </div>

        {/* Card 3: Brief Backlog */}
        <div className="stat-card glass-panel" style={{ 
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.03) 0%, rgba(5, 150, 105, 0.05) 100%)', 
          border: '1px solid rgba(16, 185, 129, 0.2)', 
          borderRadius: '16px', 
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          textAlign: 'left'
        }}>
          <div className="stat-column-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Brief Backlog</h4>
            <div className="stat-icon-wrapper" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '6px', borderRadius: '8px', display: 'flex' }}>
              <Archive size={18} />
            </div>
          </div>
          <div className="stat-number" style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            {backlogCount}
          </div>
          <div className={`stat-change ${backlogCount > 0 ? 'positive' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', color: backlogCount > 0 ? '#10b981' : 'var(--text-muted)', fontWeight: 500, minHeight: '1.2rem' }}>
            {backlogCount > 0 ? (
              <>
                <FileText size={14} />
                <span>Ready to schedule</span>
              </>
            ) : (
              <span>Queue is empty</span>
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-sections">
        <section className="timeline-section glass-panel">
          <h3 className="section-title">
            <Clock size={18} style={{ color: 'var(--color-primary)' }} /> Upcoming Publications
          </h3>
          {upcomingPosts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1.5rem', color: 'var(--text-secondary)' }}>
              <Calendar size={48} style={{ opacity: 0.2, marginBottom: '0.5rem' }} />
              <p>No content scheduled yet.</p>
              <button 
                className="btn btn-secondary" 
                style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}
                onClick={() => setActiveTab('scheduler')}
              >
                Go to Scheduler
              </button>
            </div>
          ) : (
            <div className="timeline-list-container">
              <div className="timeline-list">
                {upcomingPosts.map((post) => (
                  <div key={post.id} className="timeline-item">
                    <div className="timeline-time">
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {post.date.split('-').slice(1).join('/')}
                      </div>
                      <div style={{ fontSize: '0.75rem' }}>{post.time}</div>
                    </div>
                    <div className={`timeline-dot ${post.platform === 'tiktok' ? 'accent' : post.platform === 'reels' ? 'purple' : 'cyan'}`}></div>
                    <div className="timeline-details">
                      <div className="timeline-post-title">{post.title}</div>
                      <div className="timeline-platform">{post.platform.toUpperCase()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </section>

        <section className="quick-actions-section glass-panel">
          <h3 className="section-title">
            <Sparkles size={18} style={{ color: 'var(--color-primary)' }} /> Quick Actions
          </h3>
          <div className="quick-action-btns">
            <button className="action-btn" onClick={() => setActiveTab('creator')}>
              <span className="action-btn-title">
                <Sparkles size={16} style={{ color: 'var(--color-primary)' }} /> Generate AI Brief
              </span>
              <span className="action-btn-desc">Create a hook list & outline script for a platform.</span>
            </button>

            <button className="action-btn" onClick={() => setActiveTab('scheduler')}>
              <span className="action-btn-title">
                <Calendar size={16} style={{ color: 'var(--color-secondary)' }} /> Calendar Scheduler
              </span>
              <span className="action-btn-desc">Plan and preview scheduled short-form videos.</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
