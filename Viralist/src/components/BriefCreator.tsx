import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Terminal, Edit3, Calendar, RefreshCw, Send, Bot, PenTool, User } from 'lucide-react';
import { streamTopics, streamScript, type TopicItem, type TopicsResponse, type ScriptResponse } from '../lib/api';

interface Brief {
  id: string;
  topic: string;
  platform: 'tiktok' | 'reels' | 'shorts';
  tone: string;
  hook1: string;
  hook2: string;
  hook3: string;
  outline: string;
  fullScript: string;
  caption: string;
  visualNotes: string;
  duration: string;
  createdAt: string;
}

interface BriefCreatorProps {
  onSaveBrief: (brief: Brief) => void;
  onScheduleRequest?: (brief: Brief) => void;
  setActiveTab: (tab: string) => void;
  onUnsavedBriefChange?: (brief: Brief | null) => void;
  personality?: {
    niche: string;
    style: string;
    targetAudience: string;
    language: string;
    brandKeywords: string;
    avoidKeywords: string;
  };
  updatePersonality?: (p: any) => void;
}

interface LogLine {
  id: string;
  agent: 'system' | 'agent-1' | 'agent-2';
  text: string;
}

export const BriefCreator: React.FC<BriefCreatorProps> = ({ onSaveBrief, onScheduleRequest, setActiveTab, personality, updatePersonality, onUnsavedBriefChange }) => {
  // Inputs
  const [topic, setTopic] = useState('');
  const [platform, setPlatform] = useState<'tiktok' | 'reels' | 'shorts'>('tiktok');
  const [tone, setTone] = useState('Energetic');
  const [duration, setDuration] = useState('15-30s');

  const [isEditingPersonality, setIsEditingPersonality] = useState(false);
  const [localPersonality, setLocalPersonality] = useState(personality || {
    niche: '',
    style: '',
    targetAudience: '',
    language: 'Bahasa Indonesia',
    brandKeywords: '',
    avoidKeywords: ''
  });

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0); // 0: idle, 1: running agents, 2: complete
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [activeAgent, setActiveAgent] = useState<'none' | 'agent-1' | 'agent-2'>('none');
  const [topicsList, setTopicsList] = useState<TopicItem[]>([]);
  const [awaitingTopicPick, setAwaitingTopicPick] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    if (personality) {
      setLocalPersonality(personality);
    }
  }, [personality]);

  // Output state
  const [resultBrief, setResultBrief] = useState<Brief | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const shellEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of terminal logs
  useEffect(() => {
    if (shellEndRef.current) {
      shellEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const addLog = (agent: 'system' | 'agent-1' | 'agent-2', text: string) => {
    setLogs((prev) => [...prev, { id: Math.random().toString(), agent, text }]);
  };

  // Nambahin isi jawaban yang lagi "diketik" agent (streaming token demi
  // token dari model) ke satu baris log yang sama, biar keliatan kayak di
  // terminal beneran, bukan nge-push baris baru tiap token.
  const appendStreamContent = (id: string, agent: 'agent-1' | 'agent-2', delta: string) => {
    setLogs((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      if (idx === -1) return [...prev, { id, agent, text: delta }];
      const next = [...prev];
      next[idx] = { ...next[idx], text: next[idx].text + delta };
      return next;
    });
  };

  // Step 1: Agent Hook (Trend Agent) - cari 10 topik trending untuk niche yang diketik user.
  // Log di bawah mengikuti event asli dari agent (tool call, isi jawaban
  // yang lagi diketik), sama seperti yang muncul kalau agent dijalankan
  // langsung di terminal - bukan simulasi teks tetap.
  const runGeneration = async () => {
    if (!topic.trim()) return;

    setIsGenerating(true);
    setGenStep(1);
    setResultBrief(null);
    setIsEditing(false);
    setLogs([]);
    setTopicsList([]);
    setAwaitingTopicPick(false);
    setGenError(null);
    setActiveAgent('agent-1');

    addLog('system', `Agent Hook (Trend Agent) run started - niche: "${topic}"`);
    const contentLineId = `topics-content-${Date.now()}`;

    try {
      for await (const event of streamTopics(topic)) {
        if (event.type === 'tool_call_started') {
          addLog('agent-1', `> ${event.text}`);
        } else if (event.type === 'tool_call_completed') {
          addLog('agent-1', event.text || 'Tool selesai.');
        } else if (event.type === 'content_delta') {
          appendStreamContent(contentLineId, 'agent-1', event.text || '');
        } else if (event.type === 'error') {
          throw new Error(event.text || 'Terjadi error saat menjalankan agent.');
        } else if (event.type === 'done') {
          const result = event.result as TopicsResponse;
          addLog('agent-1', `Ditemukan ${result.topics.length} topik trending. Pilih salah satu di bawah untuk lanjut ke Director Agent.`);
          setTopicsList(result.topics);
          setAwaitingTopicPick(true);
        }
      }
      setIsGenerating(false);
    } catch (err: any) {
      const message = err?.message || 'Gagal mengambil topik trending.';
      addLog('system', `Error: ${message}`);
      setGenError(message);
      setIsGenerating(false);
      setGenStep(2);
    }
  };

  // Step 2: Director Agent - generate full script untuk topik yang dipilih.
  const pickTopic = async (topicNumber: number, topicTitle: string) => {
    setAwaitingTopicPick(false);
    setIsGenerating(true);
    setActiveAgent('agent-2');

    addLog('system', `Director Agent run started - topik #${topicNumber}: "${topicTitle}"`);
    const contentLineId = `script-content-${Date.now()}`;

    try {
      for await (const event of streamScript(topicNumber, { platform, tone, duration })) {
        if (event.type === 'tool_call_started') {
          addLog('agent-2', `> ${event.text}`);
        } else if (event.type === 'tool_call_completed') {
          addLog('agent-2', event.text || 'Tool selesai.');
        } else if (event.type === 'content_delta') {
          appendStreamContent(contentLineId, 'agent-2', event.text || '');
        } else if (event.type === 'error') {
          throw new Error(event.text || 'Terjadi error saat menjalankan agent.');
        } else if (event.type === 'done') {
          const result = event.result as ScriptResponse;
          setActiveAgent('none');
          addLog('system', 'Generation process complete. Syncing brief records...');

          const generatedBrief: Brief = {
            id: crypto.randomUUID(),
            topic: result.topic,
            platform,
            tone,
            hook1: result.hook,
            hook2: '',
            hook3: '',
            outline: '',
            fullScript: result.script,
            caption: '',
            visualNotes: '',
            duration,
            createdAt: new Date().toISOString(),
          };

          setResultBrief(generatedBrief);
          if (onUnsavedBriefChange) onUnsavedBriefChange(generatedBrief);
        }
      }
    } catch (err: any) {
      const message = err?.message || 'Gagal generate script.';
      addLog('system', `Error: ${message}`);
      setGenError(message);
    } finally {
      setIsGenerating(false);
      setGenStep(2);
    }
  };

  const handleSaveAndGo = () => {
    if (resultBrief) {
      if (onScheduleRequest) {
        onScheduleRequest(resultBrief);
      } else {
        onSaveBrief(resultBrief);
        setActiveTab('scheduler');
      }
      if (onUnsavedBriefChange) onUnsavedBriefChange(null);
    }
  };

  const handleFieldChange = (field: keyof Brief, value: string) => {
    if (resultBrief) {
      const updatedBrief = {
        ...resultBrief,
        [field]: value
      };
      setResultBrief(updatedBrief);
      if (onUnsavedBriefChange) onUnsavedBriefChange(updatedBrief);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '0.25rem' }}>AI Brief Creator</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Collaborate with specialized AI agents to optimize your video hooks and compose scripts.
        </p>
      </div>

      <div className="brief-creator-layout">
        {/* Input Form Panel */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 className="section-title">
            <Sparkles size={18} style={{ color: 'var(--color-primary)' }} /> Settings & Inputs
          </h3>

          {/* Personality badge */}
          {personality && (personality.niche || personality.style || personality.targetAudience) ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', background: 'rgba(0,203,213,0.07)', border: '1px solid rgba(0,203,213,0.2)', borderRadius: '10px', padding: '0.6rem 0.9rem', marginBottom: '1rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={13} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--color-primary)' }}>Creator Personality Active</strong>
                  {personality.niche && ` · ${personality.niche}`}
                  {personality.targetAudience && ` · ${personality.targetAudience}`}
                  {personality.language && ` · ${personality.language}`}
                </span>
              </div>
              <button 
                onClick={() => setIsEditingPersonality(true)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--color-primary)',
                  color: 'var(--color-primary)',
                  borderRadius: '6px',
                  padding: '0.3rem 0.8rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Edit
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: '10px', padding: '0.6rem 0.9rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#b45309' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={13} style={{ flexShrink: 0 }} />
                <span>No personality profile set. Personalize your briefs by setting it up.</span>
              </div>
              <button 
                onClick={() => setActiveTab('settings')}
                style={{
                  background: 'transparent',
                  border: '1px solid #b45309',
                  color: '#b45309',
                  borderRadius: '6px',
                  padding: '0.3rem 0.8rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Go to Settings
              </button>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="topic-input">Content Niche</label>
            <input
              id="topic-input"
              type="text"
              className="form-input"
              placeholder="e.g. produktivitas untuk mahasiswa, resep sarapan sehat"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={isGenerating}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="platform-select">Platform</label>
              <select
                id="platform-select"
                className="form-select"
                value={platform}
                onChange={(e) => setPlatform(e.target.value as any)}
                disabled={isGenerating}
              >
                <option value="tiktok">TikTok Video</option>
                <option value="reels">Instagram Reels</option>
                <option value="shorts">YouTube Shorts</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="tone-select">Video Tone</label>
              <select
                id="tone-select"
                className="form-select"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                disabled={isGenerating}
              >
                <option value="Energetic">Energetic / Hyped</option>
                <option value="Educational">Educational / Calm</option>
                <option value="Humorous">Humorous / Witty</option>
                <option value="Professional">Professional / Corporate</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="duration-select">Duration</label>
              <select
                id="duration-select"
                className="form-select"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                disabled={isGenerating}
              >
                <option value="15-30s">15-30 Seconds</option>
                <option value="30-60s">30-60 Seconds</option>
                <option value="1-3m">1-3 Minutes</option>
                <option value="3m+">3+ Minutes</option>
              </select>
            </div>
          </div>

          <button
            onClick={runGeneration}
            disabled={isGenerating || !topic.trim()}
            style={{
              width: '100%',
              marginTop: '1.5rem',
              padding: '0.85rem 1.5rem',
              border: 'none',
              borderRadius: '9999px',
              background: isGenerating || !topic.trim()
                ? 'rgba(0,203,213,0.3)'
                : 'linear-gradient(135deg, #00cbd5 0%, #0891b2 100%)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: isGenerating || !topic.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: isGenerating || !topic.trim() ? 'none' : '0 4px 20px rgba(0, 203, 213, 0.35)',
              transition: 'all 0.2s',
            }}
          >
            {isGenerating ? (
              <>
                <RefreshCw style={{ animation: 'spin 1.5s linear infinite' }} size={16} />
                <span>Agents Orchestrating...</span>
              </>
            ) : (
              <>
                <Send size={16} />
                <span>Generate Video Brief</span>
              </>
            )}
          </button>
        </div>

        {/* AI Agents Collaboration Terminal & Brief Editor */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {genStep === 1 || (genStep === 2 && !resultBrief && !genError) ? (
            <div className="agent-workspace">
              <div className="workspace-header">
                <div className="workspace-title">
                  <Terminal size={18} />
                  <span>Agent Logs Workspace</span>
                </div>
                <div className="agent-status-badges">
                  <span className={`agent-badge agent-1 ${activeAgent === 'agent-1' ? 'active' : ''}`}>
                    <Bot size={12} style={{ marginRight: '0.2rem' }} /> Agent Hook (Trend Agent) {activeAgent === 'agent-1' && '●'}
                  </span>
                  <span className={`agent-badge agent-2 ${activeAgent === 'agent-2' ? 'active' : ''}`}>
                    <PenTool size={12} style={{ marginRight: '0.2rem' }} /> Director Agent {activeAgent === 'agent-2' && '●'}
                  </span>
                </div>
              </div>

              <div className="shell-container">
                {logs.map((log) => (
                  <div key={log.id} className="shell-line">
                    <div>
                      {log.agent === 'system' && <span className="shell-prefix">[SYSTEM]</span>}
                      {log.agent === 'agent-1' && <span className="shell-agent-name agent-1">Agent Hook (Trend Agent)</span>}
                      {log.agent === 'agent-2' && <span className="shell-agent-name agent-2">Director Agent</span>}
                      <span className={log.agent === 'system' ? 'shell-system' : 'shell-text'}>{log.text}</span>
                    </div>
                  </div>
                ))}
                {isGenerating && (
                  <div className="shell-line">
                    <span style={{ color: 'var(--text-muted)' }}>
                      Agents executing tasks
                      <span className="typing-dot"></span>
                      <span className="typing-dot" style={{ animationDelay: '0.2s' }}></span>
                      <span className="typing-dot" style={{ animationDelay: '0.4s' }}></span>
                    </span>
                  </div>
                )}
                <div ref={shellEndRef} />
              </div>

              {awaitingTopicPick && topicsList.length > 0 && (
                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '260px', overflowY: 'auto' }}>
                  {topicsList.map((t) => (
                    <button
                      key={t.number}
                      onClick={() => pickTopic(t.number, t.title)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        textAlign: 'left',
                        padding: '0.65rem 0.9rem',
                        borderRadius: '10px',
                        border: '1px solid var(--border-glass)',
                        background: 'rgba(0,203,213,0.04)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{t.number}.</span>
                      <span>{t.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : genStep === 2 && !resultBrief && genError ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px', color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>
              <h4 style={{ color: '#dc2626', marginBottom: '0.5rem' }}>Generation Failed</h4>
              <p style={{ maxWidth: '360px', fontSize: '0.85rem', marginBottom: '1.5rem' }}>{genError}</p>
              <button className="btn btn-secondary" onClick={() => setGenStep(0)}>
                <RefreshCw size={14} />
                <span>Try Again</span>
              </button>
            </div>
          ) : genStep === 2 && resultBrief ? (
            <div className="brief-preview-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="section-title" style={{ marginBottom: 0 }}>
                  <Edit3 size={18} style={{ color: 'var(--color-primary)' }} /> Prepared Content Brief
                </h3>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? 'View Preview' : 'Edit Brief'}
                </button>
              </div>

              <div className="brief-meta">
                <span className="meta-badge">{resultBrief.platform.toUpperCase()}</span>
                <span className="meta-badge">{resultBrief.tone} Tone</span>
                <span className="meta-badge">Created Just Now</span>
              </div>

              {isEditing ? (
                // Editable form
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div className="form-group">
                    <label>Hook</label>
                    <input
                      type="text"
                      className="form-input"
                      value={resultBrief.hook1}
                      onChange={(e) => handleFieldChange('hook1', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Visual & Directing Notes</label>
                    <textarea
                      rows={3}
                      className="form-textarea"
                      value={resultBrief.visualNotes}
                      onChange={(e) => handleFieldChange('visualNotes', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Script Structure Outline</label>
                    <textarea
                      rows={6}
                      className="form-textarea"
                      value={resultBrief.outline}
                      onChange={(e) => handleFieldChange('outline', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Social Caption & Tags</label>
                    <textarea
                      rows={4}
                      className="form-textarea"
                      value={resultBrief.caption}
                      onChange={(e) => handleFieldChange('caption', e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                // Static preview layout
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '450px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  {resultBrief.hook1 && (
                    <div className="brief-section">
                      <h4>Hook</h4>
                      <ul className="hook-list">
                        <li className="hook-item">
                          <span className="hook-number">1</span>
                          <span>{resultBrief.hook1}</span>
                        </li>
                      </ul>
                    </div>
                  )}

                  {resultBrief.visualNotes && (
                    <div className="brief-section">
                      <h4>Visual Directing Guidelines</h4>
                      <div className="brief-body" style={{ fontStyle: 'italic', borderColor: 'var(--color-secondary)' }}>
                        {resultBrief.visualNotes}
                      </div>
                    </div>
                  )}

                  {resultBrief.outline && (
                    <div className="brief-section">
                      <h4>Video Script Outline</h4>
                      <pre className="brief-body">{resultBrief.outline}</pre>
                    </div>
                  )}

                  {resultBrief.fullScript && (
                    <div className="brief-section">
                      <h4 style={{ color: 'var(--color-primary)' }}>Full Video Script (Word-by-Word)</h4>
                      <pre className="brief-body" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7', fontSize: '0.85rem', borderColor: 'rgba(0,203,213,0.25)', background: 'rgba(0,203,213,0.03)' }}>{resultBrief.fullScript}</pre>
                    </div>
                  )}

                  {resultBrief.caption && (
                    <div className="brief-section">
                      <h4>Platform Caption</h4>
                      <pre className="brief-body" style={{ fontFamily: 'var(--font-body)' }}>{resultBrief.caption}</pre>
                    </div>
                  )}
                </div>
              )}

              <div className="brief-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => setGenStep(0)}
                  disabled={isGenerating}
                >
                  <RefreshCw size={14} />
                  <span>Start Over</span>
                </button>
                <button className="btn btn-cyan" onClick={handleSaveAndGo}>
                  <Calendar size={14} />
                  <span>Schedule Brief</span>
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px', color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>
              <Sparkles size={48} style={{ opacity: 0.15, marginBottom: '1.5rem', animation: 'pulse 2s infinite' }} />
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Agents Awaiting Topic Input</h4>
              <p style={{ maxWidth: '320px', fontSize: '0.85rem' }}>
                Fill in the topics form on the left, click generate, and see the AI agent orchestration log live.
              </p>
            </div>
          )}
        </div>
      </div>

      {isEditingPersonality && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(3px)'
        }}>
          <div style={{ backgroundColor: '#ffffff', color: '#1e293b', width: '90%', maxWidth: '450px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a', fontWeight: 700 }}>
              <User size={20} style={{ color: 'var(--color-primary)' }} /> Edit Creator Personality
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Content Niche</label>
                  <input
                    type="text"
                    value={localPersonality.niche}
                    onChange={e => setLocalPersonality({...localPersonality, niche: e.target.value})}
                    style={{ marginTop: '0.4rem', width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#0f172a', fontSize: '0.85rem' }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Language</label>
                  <select
                    value={localPersonality.language}
                    onChange={e => setLocalPersonality({...localPersonality, language: e.target.value})}
                    style={{ marginTop: '0.4rem', width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#0f172a', fontSize: '0.85rem' }}
                  >
                    <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                    <option value="English">English</option>
                    <option value="Bahasa Indonesia & English (Mix)">Indonesia + English (Mix)</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Creator Style & Personality</label>
                <textarea
                  rows={2}
                  value={localPersonality.style}
                  onChange={e => setLocalPersonality({...localPersonality, style: e.target.value})}
                  style={{ marginTop: '0.4rem', width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#0f172a', fontSize: '0.85rem', resize: 'vertical' }}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Target Audience</label>
                <input
                  type="text"
                  value={localPersonality.targetAudience}
                  onChange={e => setLocalPersonality({...localPersonality, targetAudience: e.target.value})}
                  style={{ marginTop: '0.4rem', width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#0f172a', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Brand Keywords</label>
                  <input
                    type="text"
                    value={localPersonality.brandKeywords}
                    onChange={e => setLocalPersonality({...localPersonality, brandKeywords: e.target.value})}
                    style={{ marginTop: '0.4rem', width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#0f172a', fontSize: '0.85rem' }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#e11d48', textTransform: 'uppercase' }}>Avoid Keywords</label>
                  <input
                    type="text"
                    value={localPersonality.avoidKeywords}
                    onChange={e => setLocalPersonality({...localPersonality, avoidKeywords: e.target.value})}
                    style={{ marginTop: '0.4rem', width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(225,29,72,0.3)', backgroundColor: '#fff1f2', color: '#9f1239', fontSize: '0.85rem' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => {
                  setLocalPersonality(personality || {
                    niche: '', style: '', targetAudience: '', language: 'Bahasa Indonesia', brandKeywords: '', avoidKeywords: ''
                  });
                  setIsEditingPersonality(false);
                }}
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (updatePersonality) updatePersonality(localPersonality);
                  setIsEditingPersonality(false);
                }}
                style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#ffffff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0, 203, 213, 0.3)' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
