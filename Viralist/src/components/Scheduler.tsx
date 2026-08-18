import React, { useState } from 'react';
import { Calendar as CalendarIcon, Clock, Trash2, X, FileText, RefreshCw, ExternalLink } from 'lucide-react';
import {
  apiSchedulePreview,
  streamScheduleConfirm,
  streamScheduleDelete,
  type SchedulePreviewResponse,
  type ScheduleConfirmResponse,
} from '../lib/api';

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
  createdAt: string;
  status?: 'draft' | 'scheduled';
}

interface ScheduledPost {
  id: string;
  briefId: string;
  title: string;
  platform: 'tiktok' | 'reels' | 'shorts';
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  caption: string;
  calendarEventId?: string | null;
  calendarEventLink?: string | null;
}

// Pesan dari agent kadang mengandung markdown (**bold**, [label](url)) yang
// tidak di-render sebagai markdown di sini - dibersihkan jadi plain text.
function cleanAgentMessage(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1')
    .trim();
}

interface SchedulerProps {
  briefs: Brief[];
  scheduledPosts: ScheduledPost[];
  onSchedulePost: (post: Omit<ScheduledPost, 'id'>) => void;
  onUnschedulePost: (id: string) => void;
  onDeleteBrief: (id: string) => void;
  user: { name: string; email: string; avatar: string; subscription_tier?: string; subscription_status?: string } | null;
  briefToSchedule?: Brief | null;
  clearBriefToSchedule?: () => void;
}

export const Scheduler: React.FC<SchedulerProps> = ({
  briefs,
  scheduledPosts,
  onSchedulePost,
  onUnschedulePost,
  onDeleteBrief,
  user,
  briefToSchedule,
  clearBriefToSchedule,
}) => {
  // "Schedule + Google Calendar" (event asli di Calendar) cuma buat akun
  // Agency. Akun lain tetap bisa pakai "Schedule" biasa (lokal saja).
  const isAgency = user?.subscription_tier === 'agency';
  const [showAgencyUpgradeModal, setShowAgencyUpgradeModal] = useState(false);

  // States for scheduling modal
  const [selectedBrief, setSelectedBrief] = useState<Brief | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('18:00');
  // true = "Schedule + Google Calendar" (buat event asli), false = "Schedule"
  // saja (cuma tersimpan di aplikasi, tidak menyentuh Google Calendar).
  const [createCalendarEvent, setCreateCalendarEvent] = useState(isAgency);

  // Detail brief dari Backlog: lihat isi lengkap + pilihan Schedule / Delete.
  const [briefDetail, setBriefDetail] = useState<Brief | null>(null);

  // Scheduling flow: form (pick date/time) -> preview (backend summary) ->
  // processing (Scheduling Agent live log, sama kayak di cmd) -> result
  const [scheduleStage, setScheduleStage] = useState<'form' | 'preview' | 'processing' | 'result'>('form');
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<SchedulePreviewResponse | null>(null);
  const [confirmResult, setConfirmResult] = useState<ScheduleConfirmResponse | null>(null);
  const [scheduleLogs, setScheduleLogs] = useState<{ id: string; text: string }[]>([]);

  // State for preview modal
  const [previewPost, setPreviewPost] = useState<ScheduledPost | null>(null);

  // Delete flow di dalam preview modal: idle -> processing (cmd popup live,
  // sama seperti create) -> error (kalau gagal, post TIDAK dihapus dari app)
  const [deleteStage, setDeleteStage] = useState<'idle' | 'processing' | 'error'>('idle');
  const [deleteLogs, setDeleteLogs] = useState<{ id: string; text: string }[]>([]);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState<string | null>(null);

  const openPreviewPost = (post: ScheduledPost) => {
    setDeleteStage('idle');
    setDeleteLogs([]);
    setDeleteErrorMsg(null);
    setPreviewPost(post);
  };

  const closePreviewPost = () => {
    setPreviewPost(null);
    setDeleteStage('idle');
    setDeleteLogs([]);
    setDeleteErrorMsg(null);
  };

  // Hapus post: kalau ada calendarEventId, event asli di Google Calendar
  // BENAR-BENAR dihapus dulu (live log, sama pola dengan create-event) -
  // hanya dihapus dari daftar aplikasi kalau itu sukses. Post lama yang
  // dibuat sebelum fitur ini ada (tidak punya calendarEventId) langsung
  // dihapus lokal saja, karena tidak ada id event untuk dihapus di Calendar.
  const handleDeletePost = async (post: ScheduledPost) => {
    if (!post.calendarEventId) {
      onUnschedulePost(post.id);
      closePreviewPost();
      return;
    }

    setDeleteStage('processing');
    setDeleteLogs([]);
    setDeleteErrorMsg(null);

    try {
      let success = false;
      let message = '';

      for await (const event of streamScheduleDelete(post.calendarEventId)) {
        if (event.type === 'tool_call_started') {
          setDeleteLogs((prev) => [...prev, { id: Math.random().toString(), text: `> ${event.text}` }]);
        } else if (event.type === 'tool_call_completed') {
          setDeleteLogs((prev) => [...prev, { id: Math.random().toString(), text: event.text || 'Tool selesai.' }]);
        } else if (event.type === 'error') {
          throw new Error(event.text || 'Gagal menghapus event di Google Calendar.');
        } else if (event.type === 'done') {
          const result = event.result as { success: boolean; message: string };
          success = result.success;
          message = result.message;
        }
      }

      if (!success) {
        throw new Error(cleanAgentMessage(message) || 'Event gagal dihapus dari Google Calendar.');
      }

      onUnschedulePost(post.id);
      closePreviewPost();
    } catch (err: any) {
      setDeleteErrorMsg(err?.message || 'Gagal menghapus event di Google Calendar.');
      setDeleteStage('error');
    }
  };

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const resetScheduleFlow = () => {
    setScheduleStage('form');
    setPreviewData(null);
    setConfirmResult(null);
    setScheduleError(null);
    setIsScheduling(false);
    setScheduleLogs([]);
    setCreateCalendarEvent(isAgency);
  };

  // Effect to auto-open schedule modal if briefToSchedule is passed
  React.useEffect(() => {
    if (briefToSchedule) {
      setSelectedBrief(briefToSchedule);
      setScheduleDate(todayStr);
      resetScheduleFlow();
      if (clearBriefToSchedule) clearBriefToSchedule();
    }
  }, [briefToSchedule, clearBriefToSchedule, todayStr]);

  // Filter out briefs that are already scheduled
  const unscheduledBriefs = briefs.filter(
    (b) => !scheduledPosts.some((p) => p.briefId === b.id)
  );

  // Generate Calendar Days (Current Month: August 2026)
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-indexed

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // First day of current month
  const firstDayOfMonth = new Date(year, month, 1);
  // Day of week for first day (0 = Sunday, 1 = Monday, etc.)
  const startDayOfWeek = firstDayOfMonth.getDay();
  // Total days in current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Create calendar cells array
  const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean; isToday: boolean }[] = [];

  // Fill in blanks for previous month
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const prevMonthDate = new Date(year, month - 1, d);
    const dateStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: false,
      isToday: false,
    });
  }

  // Fill in current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    cells.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: true,
      isToday,
    });
  }

  // Fill in next month blanks to complete grid (multiples of 7, let's aim for 35 or 42 cells)
  const totalCellsNeeded = cells.length > 35 ? 42 : 35;
  const nextMonthFill = totalCellsNeeded - cells.length;
  for (let d = 1; d <= nextMonthFill; d++) {
    const nextMonthDate = new Date(year, month + 1, d);
    const dateStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: false,
      isToday: false,
    });
  }

  const handleOpenScheduleModal = (brief: Brief) => {
    setBriefDetail(null);
    setSelectedBrief(brief);
    setScheduleDate(todayStr);
    resetScheduleFlow();
  };

  const closeScheduleModal = () => {
    setSelectedBrief(null);
    resetScheduleFlow();
  };

  const closeBriefDetail = () => setBriefDetail(null);

  const handleDeleteBriefClick = (brief: Brief) => {
    if (window.confirm(`Hapus brief "${brief.topic}" dari backlog? Tindakan ini tidak bisa dibatalkan.`)) {
      onDeleteBrief(brief.id);
      closeBriefDetail();
    }
  };

  // Step 3: kalau "Schedule" saja (tanpa Calendar), langsung simpan lokal -
  // tidak ada event Google Calendar yang dibuat sama sekali. Kalau "Schedule
  // + Google Calendar", minta ringkasan jadwal dari backend dulu (belum
  // create event apapun) sebelum user konfirmasi di step berikutnya.
  const handlePreviewSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBrief || !scheduleDate || !scheduleTime) return;

    // Jaga-jaga (defense in depth) - seharusnya sudah dicegat saat pilih
    // radio-nya, tapi tetap dicek lagi di sini sebelum benar-benar jalan.
    if (createCalendarEvent && !isAgency) {
      setCreateCalendarEvent(false);
      setShowAgencyUpgradeModal(true);
      return;
    }

    if (!createCalendarEvent) {
      onSchedulePost({
        briefId: selectedBrief.id,
        title: selectedBrief.topic,
        platform: selectedBrief.platform,
        date: scheduleDate,
        time: scheduleTime,
        caption: selectedBrief.caption,
        calendarEventId: null,
        calendarEventLink: null,
      });
      setConfirmResult({
        success: true,
        message: 'Jadwal tersimpan di aplikasi. Tidak ada event yang dibuat di Google Calendar (sesuai pilihan "Schedule" saja).',
        event_link: null,
        event_id: null,
      });
      setScheduleStage('result');
      return;
    }

    setIsScheduling(true);
    setScheduleError(null);
    try {
      const data = await apiSchedulePreview(
        `Publikasi Konten: ${selectedBrief.topic}`,
        selectedBrief.topic,
        scheduleDate,
        scheduleTime
      );
      setPreviewData(data);
      setScheduleStage('preview');
    } catch (err: any) {
      setScheduleError(err?.message || 'Gagal menyiapkan preview jadwal.');
    } finally {
      setIsScheduling(false);
    }
  };

  // Step 4: user konfirmasi -> baru benar-benar create event di Google Calendar.
  // Hasil (sukses/gagal) dilaporkan apa adanya dari backend, dan hanya
  // dicatat ke Supabase (onSchedulePost) kalau backend memang sukses.
  const handleCreateEvent = async () => {
    setIsScheduling(true);
    setScheduleError(null);
    setScheduleLogs([]);
    setScheduleStage('processing');

    const contentLineId = `confirm-content-${Date.now()}`;

    try {
      let result: ScheduleConfirmResponse | null = null;

      for await (const event of streamScheduleConfirm()) {
        if (event.type === 'tool_call_started') {
          setScheduleLogs((prev) => [...prev, { id: Math.random().toString(), text: `> ${event.text}` }]);
        } else if (event.type === 'tool_call_completed') {
          setScheduleLogs((prev) => [...prev, { id: Math.random().toString(), text: event.text || 'Tool selesai.' }]);
        } else if (event.type === 'content_delta') {
          setScheduleLogs((prev) => {
            const idx = prev.findIndex((l) => l.id === contentLineId);
            if (idx === -1) return [...prev, { id: contentLineId, text: event.text || '' }];
            const next = [...prev];
            next[idx] = { ...next[idx], text: next[idx].text + (event.text || '') };
            return next;
          });
        } else if (event.type === 'error') {
          throw new Error(event.text || 'Gagal membuat event di Google Calendar.');
        } else if (event.type === 'done') {
          result = event.result as ScheduleConfirmResponse;
        }
      }

      if (!result) throw new Error('Agent tidak mengembalikan hasil.');

      setConfirmResult(result);
      setScheduleStage('result');
      if (result.success && selectedBrief && previewData) {
        onSchedulePost({
          briefId: selectedBrief.id,
          title: selectedBrief.topic,
          platform: selectedBrief.platform,
          date: previewData.tanggal,
          time: previewData.jam,
          caption: selectedBrief.caption,
          calendarEventId: result.event_id,
          calendarEventLink: result.event_link,
        });
      }
    } catch (err: any) {
      // Laporkan apa adanya sebagai hasil gagal, bukan hardcode sukses.
      setConfirmResult({ success: false, message: err?.message || 'Gagal membuat event di Google Calendar.', event_link: null, event_id: null });
      setScheduleStage('result');
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '0.25rem' }}>Content Scheduler</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Review your content brief backlog, assign dates, and preview how posts look on mobile formats.
        </p>
      </div>

      <div className="scheduler-layout">
        {/* Backlog Column */}
        <div className="backlog-panel glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
          {/* Our Schedule Section */}
          <div>
            <h3 className="backlog-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CalendarIcon size={18} style={{ color: 'var(--color-primary)' }} /> Our Schedule ({scheduledPosts.length})
            </h3>
            
            <div className="backlog-list">
              {scheduledPosts.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>
                  No posts scheduled yet.
                </p>
              ) : (
                scheduledPosts.map((post) => (
                  <div
                    key={post.id}
                    className="backlog-card"
                    onClick={() => openPreviewPost(post)}
                  >
                    <div className="backlog-card-title">{post.title}</div>
                    <div className="backlog-card-meta">
                      <span style={{ color: post.platform === 'tiktok' ? 'var(--color-accent)' : post.platform === 'reels' ? 'var(--color-primary)' : 'var(--color-secondary)' }}>
                        {post.platform.toUpperCase()}
                      </span>
                      <span>{post.date}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-glass)' }} />

          {/* Brief Backlog Section */}
          <div>
            <h3 className="backlog-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} style={{ color: 'var(--color-primary)' }} /> Brief Backlog ({unscheduledBriefs.length})
            </h3>
            
            <div className="backlog-list">
              {unscheduledBriefs.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>
                  No unscheduled briefs. Create one in the Brief Creator!
                </p>
              ) : (
                unscheduledBriefs.map((brief) => (
                  <div
                    key={brief.id}
                    className="backlog-card"
                    onClick={() => setBriefDetail(brief)}
                  >
                    <div className="backlog-card-title">{brief.topic}</div>
                    <div className="backlog-card-meta">
                      <span style={{ color: brief.platform === 'tiktok' ? 'var(--color-accent)' : brief.platform === 'reels' ? 'var(--color-primary)' : 'var(--color-secondary)' }}>
                        {brief.platform.toUpperCase()}
                      </span>
                      <span>{brief.tone}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Calendar Panel */}
        <div className="calendar-panel glass-panel">
          <div className="calendar-header">
            <h2 style={{ fontSize: '1.4rem' }}>
              {monthNames[month]} {year}
            </h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Click backlog items to schedule
            </div>
          </div>

          <div className="calendar-grid">
            {/* Weekday headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="calendar-day-header">
                {day}
              </div>
            ))}

            {/* Day cells */}
            {cells.map((cell, idx) => {
              // Find posts scheduled for this specific date
              const postsForDay = scheduledPosts.filter((p) => p.date === cell.dateStr);

              return (
                <div
                  key={idx}
                  className={`calendar-cell ${cell.isCurrentMonth ? 'current-month' : ''} ${cell.isToday ? 'today' : ''}`}
                >
                  <span className="calendar-cell-num">{cell.dayNum}</span>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', width: '100%', minWidth: 0 }}>
                    {postsForDay.map((post) => (
                      <div
                        key={post.id}
                        className={`scheduled-item ${post.platform}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openPreviewPost(post);
                        }}
                        title={`${post.time} - ${post.title}`}
                      >
                        <span style={{ fontWeight: 'bold', marginRight: '4px' }}>{post.time}</span>
                        {post.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Form Scheduling Modal */}
      {selectedBrief && (
        <div className="modal-overlay" onClick={closeScheduleModal}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeScheduleModal}>
              <X size={18} />
            </button>
            <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CalendarIcon size={18} style={{ color: 'var(--color-primary)' }} /> Schedule Publication
            </h3>

            {scheduleStage === 'form' && (
              <form onSubmit={handlePreviewSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
                <div className="form-group">
                  <label>Content Title</label>
                  <input
                    type="text"
                    className="form-input"
                    value={selectedBrief.topic}
                    readOnly
                    style={{ background: 'rgba(255,255,255,0.01)', borderStyle: 'dashed' }}
                  />
                </div>

                <div className="form-group">
                  <label>Target Platform</label>
                  <input
                    type="text"
                    className="form-input"
                    value={selectedBrief.platform.toUpperCase()}
                    readOnly
                    style={{ background: 'rgba(255,255,255,0.01)', borderStyle: 'dashed' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label htmlFor="pub-date">Publish Date</label>
                    <input
                      id="pub-date"
                      type="date"
                      className="form-input"
                      value={scheduleDate}
                      min={todayStr}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="pub-time">Publish Time</label>
                    <input
                      id="pub-time"
                      type="time"
                      className="form-input"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '0.9rem 1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', margin: 0 }}>
                    <input
                      type="radio"
                      name="schedule-mode"
                      checked={!createCalendarEvent}
                      onChange={() => setCreateCalendarEvent(false)}
                    />
                    <span>
                      <strong>Schedule</strong>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Simpan jadwal di aplikasi saja, tanpa Google Calendar.</span>
                    </span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', margin: 0 }}>
                    <input
                      type="radio"
                      name="schedule-mode"
                      checked={createCalendarEvent}
                      onChange={() => {
                        if (!isAgency) {
                          setShowAgencyUpgradeModal(true);
                          return;
                        }
                        setCreateCalendarEvent(true);
                      }}
                    />
                    <span>
                      <strong>Schedule + Google Calendar</strong>
                      {isAgency ? (
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Buat juga event asli di Google Calendar.</span>
                      ) : (
                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#b45309' }}>Khusus akun Agency.</span>
                      )}
                    </span>
                  </label>
                </div>

                {scheduleError && <p style={{ color: '#dc2626', fontSize: '0.85rem', margin: 0 }}>{scheduleError}</p>}

                <button
                  type="submit"
                  disabled={isScheduling}
                  style={{
                    width: '100%',
                    marginTop: '1rem',
                    padding: '0.85rem 1.5rem',
                    border: 'none',
                    borderRadius: '9999px',
                    background: 'linear-gradient(135deg, #00cbd5 0%, #0891b2 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    cursor: isScheduling ? 'not-allowed' : 'pointer',
                    opacity: isScheduling ? 0.7 : 1,
                    boxShadow: '0 4px 20px rgba(0, 203, 213, 0.35)',
                    transition: 'all 0.2s'
                  }}
                >
                  {isScheduling
                    ? 'Menyiapkan preview...'
                    : createCalendarEvent
                      ? 'Lihat Preview'
                      : 'Simpan Jadwal'}
                </button>
              </form>
            )}

            {scheduleStage === 'preview' && previewData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                <div style={{ background: 'rgba(0,203,213,0.05)', border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
                  <div><strong>Judul:</strong> {previewData.judul}</div>
                  <div><strong>Tanggal:</strong> {previewData.tanggal}</div>
                  <div><strong>Jam:</strong> {previewData.jam}</div>
                  <div><strong>Durasi:</strong> {previewData.durasi}</div>
                  <div><strong>Timezone:</strong> {previewData.timezone}</div>
                  <div><strong>Kalender:</strong> {previewData.calendar}</div>
                </div>

                {scheduleError && <p style={{ color: '#dc2626', fontSize: '0.85rem', margin: 0 }}>{scheduleError}</p>}

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setScheduleStage('form')}
                    disabled={isScheduling}
                  >
                    Kembali
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateEvent}
                    disabled={isScheduling}
                    style={{
                      flex: 1,
                      padding: '0.7rem 1.25rem',
                      border: 'none',
                      borderRadius: '9999px',
                      background: 'linear-gradient(135deg, #00cbd5 0%, #0891b2 100%)',
                      color: '#ffffff',
                      fontWeight: 700,
                      cursor: isScheduling ? 'not-allowed' : 'pointer',
                      opacity: isScheduling ? 0.7 : 1,
                    }}
                  >
                    {isScheduling ? 'Membuat event...' : 'Konfirmasi & Buat Event'}
                  </button>
                </div>
              </div>
            )}

            {scheduleStage === 'processing' && (
              <div style={{ marginTop: '1rem', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
                <div className="workspace-header" style={{ background: 'rgba(0,203,213,0.05)' }}>
                  <div className="workspace-title">
                    <RefreshCw size={16} style={{ animation: 'spin 1.5s linear infinite' }} />
                    <span>Scheduling Agent Processing...</span>
                  </div>
                </div>
                <div className="shell-container" style={{ maxHeight: '280px', borderRadius: 0 }}>
                  {scheduleLogs.map((log) => (
                    <div key={log.id} className="shell-line">
                      <span className="shell-text">{log.text}</span>
                    </div>
                  ))}
                  <div className="shell-line">
                    <span style={{ color: 'var(--text-muted)' }}>
                      Menghubungi Google Calendar
                      <span className="typing-dot"></span>
                      <span className="typing-dot" style={{ animationDelay: '0.2s' }}></span>
                      <span className="typing-dot" style={{ animationDelay: '0.4s' }}></span>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {scheduleStage === 'result' && confirmResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                <div
                  style={{
                    background: confirmResult.success ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)',
                    border: `1px solid ${confirmResult.success ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'}`,
                    borderRadius: '10px',
                    padding: '1rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere',
                    overflow: 'hidden',
                    maxHeight: '320px',
                    overflowY: 'auto',
                    fontSize: '0.85rem',
                  }}
                >
                  <strong style={{ color: confirmResult.success ? '#16a34a' : '#dc2626' }}>
                    {confirmResult.success
                      ? (confirmResult.event_id ? 'Event berhasil dibuat' : 'Jadwal tersimpan')
                      : 'Event gagal dibuat'}
                  </strong>
                  <p style={{ marginTop: '0.5rem' }}>{cleanAgentMessage(confirmResult.message)}</p>
                  {confirmResult.event_link && (
                    <a href={confirmResult.event_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', wordBreak: 'break-all' }}>
                      Buka di Google Calendar &rarr;
                    </a>
                  )}
                </div>
                {!confirmResult.success && (
                  <button type="button" className="btn btn-secondary" onClick={() => setScheduleStage('preview')}>
                    <RefreshCw size={14} />
                    <span>Coba Lagi</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeScheduleModal}
                  style={{
                    padding: '0.7rem 1.25rem',
                    border: 'none',
                    borderRadius: '9999px',
                    background: 'linear-gradient(135deg, #00cbd5 0%, #0891b2 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Tutup
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Popup: Schedule + Google Calendar khusus akun Agency */}
      {showAgencyUpgradeModal && (
        <div className="modal-overlay" onClick={() => setShowAgencyUpgradeModal(false)}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()} style={{ background: '#ffffff', color: '#0f172a', maxWidth: '400px', width: '90%', textAlign: 'center' }}>
            <button className="modal-close" onClick={() => setShowAgencyUpgradeModal(false)}>
              <X size={18} />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(217,119,6,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CalendarIcon size={22} style={{ color: '#b45309' }} />
              </div>
              <h3 style={{ fontSize: '1.15rem', margin: 0 }}>Fitur Khusus Agency</h3>
              <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>
                Integrasi Google Calendar (buat event asli otomatis) cuma tersedia untuk paket <strong>Agency</strong>.
                Akun Anda saat ini bisa tetap pakai <strong>Schedule</strong> biasa (tersimpan di aplikasi, tanpa Google Calendar).
              </p>
              <button
                onClick={() => setShowAgencyUpgradeModal(false)}
                style={{
                  marginTop: '0.5rem',
                  width: '100%',
                  padding: '0.7rem 1.25rem',
                  border: 'none',
                  borderRadius: '9999px',
                  background: 'linear-gradient(135deg, #00cbd5 0%, #0891b2 100%)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Brief Backlog Detail Modal: lihat isi lengkap + pilihan Schedule / Delete */}
      {briefDetail && (
        <div className="modal-overlay" onClick={closeBriefDetail}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()} style={{ background: '#ffffff', color: '#0f172a', maxWidth: '640px', width: '90%' }}>
            <button className="modal-close" onClick={closeBriefDetail}>
              <X size={18} />
            </button>
            <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} style={{ color: 'var(--color-primary)' }} /> Brief Detail
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem', maxHeight: '55vh', overflowY: 'auto', paddingRight: '0.25rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#0f172a', background: 'rgba(0,203,213,0.1)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>{briefDetail.platform.toUpperCase()}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', background: '#f1f5f9', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>{briefDetail.tone}</span>
              </div>

              <div>
                <h5 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', marginBottom: '0.4rem', fontWeight: 600 }}>Video Topic / Concept</h5>
                <div style={{ background: '#f1f5f9', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', fontWeight: 500 }}>
                  {briefDetail.topic}
                </div>
              </div>

              {[briefDetail.hook1, briefDetail.hook2, briefDetail.hook3].filter(Boolean).length > 0 && (
                <div>
                  <h5 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', marginBottom: '0.4rem', fontWeight: 600 }}>Hook</h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {[briefDetail.hook1, briefDetail.hook2, briefDetail.hook3].filter(Boolean).map((hook, idx) => (
                      <div key={idx} style={{ background: 'rgba(0, 203, 213, 0.06)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(0, 203, 213, 0.2)', fontSize: '0.85rem' }}>
                        "{hook}"
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {briefDetail.outline && (
                <div>
                  <h5 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', marginBottom: '0.4rem', fontWeight: 600 }}>Visual Script Outline</h5>
                  <pre style={{ background: '#f1f5f9', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', fontFamily: 'var(--font-body)', whiteSpace: 'pre-wrap', lineHeight: '1.5', margin: 0 }}>
                    {briefDetail.outline}
                  </pre>
                </div>
              )}

              {briefDetail.fullScript && (
                <div>
                  <h5 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-primary)', marginBottom: '0.4rem', fontWeight: 700 }}>Full Video Script</h5>
                  <pre style={{ background: 'rgba(0,203,213,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(0,203,213,0.25)', fontSize: '0.85rem', fontFamily: 'var(--font-body)', whiteSpace: 'pre-wrap', lineHeight: '1.7', margin: 0 }}>
                    {briefDetail.fullScript}
                  </pre>
                </div>
              )}

              {briefDetail.visualNotes && (
                <div>
                  <h5 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', marginBottom: '0.4rem', fontWeight: 600 }}>Directing Cues & Visual Notes</h5>
                  <pre style={{ background: '#f1f5f9', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', fontFamily: 'var(--font-body)', whiteSpace: 'pre-wrap', lineHeight: '1.5', margin: 0 }}>
                    {briefDetail.visualNotes}
                  </pre>
                </div>
              )}

              {briefDetail.caption && (
                <div>
                  <h5 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', marginBottom: '0.4rem', fontWeight: 600 }}>Video Caption</h5>
                  <div style={{ background: '#f1f5f9', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#334155' }}>
                    {briefDetail.caption}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1.5rem', marginTop: '1.25rem' }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, color: 'var(--color-accent)' }}
                onClick={() => handleDeleteBriefClick(briefDetail)}
              >
                <Trash2 size={16} />
                <span>Delete Brief</span>
              </button>
              <button
                onClick={() => handleOpenScheduleModal(briefDetail)}
                style={{
                  flex: 1,
                  padding: '0.7rem 1.25rem',
                  border: 'none',
                  borderRadius: '9999px',
                  background: 'linear-gradient(135deg, #00cbd5 0%, #0891b2 100%)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 16px rgba(0,203,213,0.3)',
                }}
              >
                <CalendarIcon size={16} />
                <span>Schedule</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simulated Phone Post Preview Modal */}
      {previewPost && (() => {
        const matchingBrief = briefs.find((b) => b.id === previewPost.briefId);
        return (
          <div className="modal-overlay" onClick={closePreviewPost}>
            <div className="modal-content preview-modal-content glass-panel" onClick={(e) => e.stopPropagation()} style={{ background: '#ffffff', color: '#0f172a', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', maxWidth: '850px', width: '90%' }}>
              <button className="modal-close" onClick={closePreviewPost}>
                <X size={18} />
              </button>

              {deleteStage !== 'idle' && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {deleteStage === 'processing' && (
                    <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                      <div className="workspace-header" style={{ background: 'rgba(0,203,213,0.05)' }}>
                        <div className="workspace-title" style={{ color: '#0f172a' }}>
                          <RefreshCw size={16} style={{ animation: 'spin 1.5s linear infinite' }} />
                          <span>Scheduling Agent Processing...</span>
                        </div>
                      </div>
                      <div className="shell-container" style={{ maxHeight: '280px', borderRadius: 0 }}>
                        {deleteLogs.map((log) => (
                          <div key={log.id} className="shell-line">
                            <span className="shell-text">{log.text}</span>
                          </div>
                        ))}
                        <div className="shell-line">
                          <span style={{ color: 'var(--text-muted)' }}>
                            Menghapus event dari Google Calendar
                            <span className="typing-dot"></span>
                            <span className="typing-dot" style={{ animationDelay: '0.2s' }}></span>
                            <span className="typing-dot" style={{ animationDelay: '0.4s' }}></span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {deleteStage === 'error' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '10px', padding: '1rem', fontSize: '0.85rem' }}>
                        <strong style={{ color: '#dc2626' }}>Event gagal dihapus</strong>
                        <p style={{ marginTop: '0.5rem', color: '#0f172a' }}>{deleteErrorMsg}</p>
                        <p style={{ marginTop: '0.5rem', color: '#64748b', fontSize: '0.8rem' }}>Post ini belum dihapus dari daftar karena event di Google Calendar belum berhasil dihapus.</p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setDeleteStage('idle')}>
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePost(previewPost)}
                          style={{ flex: 1, padding: '0.7rem 1.25rem', border: 'none', borderRadius: '9999px', background: 'linear-gradient(135deg, #00cbd5 0%, #0891b2 100%)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Coba Lagi
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {deleteStage === 'idle' && (
                <>

              {/* Left Column: Script / Naskah Detail View */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', maxHeight: '480px', background: '#f8fafc', padding: '1.25rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
                  <FileText size={20} style={{ color: 'var(--color-primary)' }} />
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>AI Script & Directing Brief</h4>
                </div>

                {matchingBrief ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
                    <div>
                      <h5 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', marginBottom: '0.4rem', fontWeight: 600 }}>Video Topic / Concept</h5>
                      <div style={{ background: '#f1f5f9', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', fontWeight: 500, color: '#0f172a' }}>
                        {matchingBrief.topic}
                      </div>
                    </div>

                    {[matchingBrief.hook1, matchingBrief.hook2, matchingBrief.hook3].filter(Boolean).length > 0 && (
                      <div>
                        <h5 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', marginBottom: '0.4rem', fontWeight: 600 }}>Hook</h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {[matchingBrief.hook1, matchingBrief.hook2, matchingBrief.hook3].filter(Boolean).map((hook, idx) => (
                            <div key={idx} style={{ background: 'rgba(0, 203, 213, 0.06)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(0, 203, 213, 0.2)', fontSize: '0.85rem', position: 'relative', color: '#0f172a' }}>
                              <span style={{ position: 'absolute', left: '-6px', top: '50%', transform: 'translateY(-50%)', background: 'var(--color-primary)', color: '#000', fontSize: '0.65rem', fontWeight: 700, width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {idx + 1}
                              </span>
                              <span style={{ paddingLeft: '0.5rem' }}>"{hook}"</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {matchingBrief.outline && (
                      <div>
                        <h5 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', marginBottom: '0.4rem', fontWeight: 600 }}>Visual Script Outline</h5>
                        <pre style={{ background: '#f1f5f9', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', fontFamily: 'var(--font-body)', whiteSpace: 'pre-wrap', lineHeight: '1.5', margin: 0, color: '#0f172a' }}>
                          {matchingBrief.outline}
                        </pre>
                      </div>
                    )}

                    {matchingBrief.fullScript && (
                      <div>
                        <h5 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-primary)', marginBottom: '0.4rem', fontWeight: 700 }}>Full Video Script (Word-by-Word)</h5>
                        <pre style={{ background: 'rgba(0,203,213,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(0,203,213,0.25)', fontSize: '0.85rem', fontFamily: 'var(--font-body)', whiteSpace: 'pre-wrap', lineHeight: '1.7', margin: 0, color: '#0f172a' }}>
                          {matchingBrief.fullScript}
                        </pre>
                      </div>
                    )}

                    {matchingBrief.visualNotes && (
                      <div>
                        <h5 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', marginBottom: '0.4rem', fontWeight: 600 }}>Directing Cues & Visual Notes</h5>
                        <pre style={{ background: '#f1f5f9', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', fontFamily: 'var(--font-body)', whiteSpace: 'pre-wrap', lineHeight: '1.5', margin: 0, color: '#0f172a' }}>
                          {matchingBrief.visualNotes}
                        </pre>
                      </div>
                    )}

                    {previewPost.caption && (
                      <div>
                        <h5 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', marginBottom: '0.4rem', fontWeight: 600 }}>Video Caption</h5>
                        <div style={{ background: '#f1f5f9', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#334155' }}>
                          {previewPost.caption}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', padding: '2rem 0', fontSize: '0.9rem' }}>
                    Original brief script not found.
                  </div>
                )}
              </div>

              {/* Right Column: Actions & Meta Info */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={20} style={{ color: 'var(--color-secondary)' }} /> Post Details
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                    Review your script draft details and metadata for this scheduled {previewPost.platform.toUpperCase()} post.
                  </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#64748b', marginBottom: '0.25rem' }}>Title</h4>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>{previewPost.title}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#64748b', marginBottom: '0.25rem' }}>Publish Date</h4>
                        <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>{previewPost.date}</span>
                      </div>
                      <div>
                        <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#64748b', marginBottom: '0.25rem' }}>Publish Time</h4>
                        <span style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#0f172a' }}>
                        <Clock size={14} style={{ color: 'var(--color-primary)' }} /> {previewPost.time}
                      </span>
                    </div>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#64748b', marginBottom: '0.25rem' }}>Platform</h4>
                    <span style={{ fontSize: '0.9rem', color: '#0f172a', background: 'rgba(0,203,213,0.08)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                      {previewPost.platform.toUpperCase()}
                    </span>
                  </div>
                  {previewPost.calendarEventLink && (
                    <div>
                      <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#64748b', marginBottom: '0.25rem' }}>Google Calendar</h4>
                      <a
                        href={previewPost.calendarEventLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '0.9rem', color: 'var(--color-primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        Buka event <ExternalLink size={13} />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1.5rem' }}>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, color: 'var(--color-accent)' }}
                  onClick={() => handleDeletePost(previewPost)}
                >
                  <Trash2 size={16} />
                  <span>Unschedule Post</span>
                </button>
                <button
                  onClick={closePreviewPost}
                  style={{
                    flex: 1,
                    padding: '0.7rem 1.25rem',
                    border: 'none',
                    borderRadius: '9999px',
                    background: 'linear-gradient(135deg, #00cbd5 0%, #0891b2 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 16px rgba(0,203,213,0.3)',
                  }}
                >
                  <span>Close Preview</span>
                </button>
              </div>
              </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

    </div>
  );
};
