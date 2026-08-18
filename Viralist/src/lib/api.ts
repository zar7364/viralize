import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

class ApiError extends Error {}

async function authedFetch<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new ApiError('Kamu belum login. Silakan login ulang.');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.detail || `Request gagal (${res.status})`);
  }
  return data as T;
}

export interface StreamEvent {
  type: 'tool_call_started' | 'tool_call_completed' | 'content_delta' | 'done' | 'error';
  text?: string;
  result?: unknown;
}

// SSE stream dari backend: progres asli agent (tool call, isi jawaban yang
// lagi diketik) - bukan simulasi. Backend cuma mengirim event 'done' kalau
// semua guardrail (content filter, dll) lolos, sama seperti endpoint biasa.
async function* streamSSE(path: string, body: unknown): AsyncGenerator<StreamEvent> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new ApiError('Kamu belum login. Silakan login ulang.');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.detail || `Request gagal (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data: ')) continue;
      try {
        yield JSON.parse(line.slice('data: '.length)) as StreamEvent;
      } catch {
        // abaikan chunk yang tidak lengkap/rusak
      }
    }
  }
}

export function streamTopics(niche: string): AsyncGenerator<StreamEvent> {
  return streamSSE('/api/topics/stream', { niche });
}

export function streamScript(
  topicIndex: number,
  context?: { platform?: string; tone?: string; duration?: string }
): AsyncGenerator<StreamEvent> {
  return streamSSE('/api/script/stream', { topic_index: topicIndex, ...context });
}

export interface TopicItem {
  number: number;
  title: string;
}

export interface TopicsResponse {
  niche: string;
  topics: TopicItem[];
}

export function apiTopics(niche: string): Promise<TopicsResponse> {
  return authedFetch('/api/topics', { method: 'POST', body: { niche } });
}

export interface ScriptResponse {
  topic_index: number;
  topic: string;
  script: string;
  hook: string;
}

export function apiScript(
  topicIndex: number,
  context?: { platform?: string; tone?: string; duration?: string }
): Promise<ScriptResponse> {
  return authedFetch('/api/script', {
    method: 'POST',
    body: { topic_index: topicIndex, ...context },
  });
}

export interface SchedulePreviewResponse {
  judul: string;
  topik: string;
  tanggal: string;
  jam: string;
  durasi: string;
  timezone: string;
  calendar: string;
}

export function apiSchedulePreview(
  judul: string,
  topik: string,
  tanggal: string,
  jam: string
): Promise<SchedulePreviewResponse> {
  return authedFetch('/api/schedule/preview', {
    method: 'POST',
    body: { judul, topik, tanggal, jam },
  });
}

export interface ScheduleConfirmResponse {
  success: boolean;
  message: string;
  event_link: string | null;
  event_id: string | null;
}

export function apiScheduleConfirm(): Promise<ScheduleConfirmResponse> {
  return authedFetch('/api/schedule/confirm', { method: 'POST' });
}

export function streamScheduleConfirm(): AsyncGenerator<StreamEvent> {
  return streamSSE('/api/schedule/confirm/stream', {});
}

export interface ScheduleDeleteResponse {
  success: boolean;
  message: string;
}

export function apiScheduleDelete(eventId: string, calendarId = 'primary'): Promise<ScheduleDeleteResponse> {
  return authedFetch('/api/schedule/delete', {
    method: 'POST',
    body: { event_id: eventId, calendar_id: calendarId },
  });
}

export function streamScheduleDelete(eventId: string, calendarId = 'primary'): AsyncGenerator<StreamEvent> {
  return streamSSE('/api/schedule/delete/stream', { event_id: eventId, calendar_id: calendarId });
}
