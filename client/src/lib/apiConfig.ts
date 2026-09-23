/**
 * Dynamic API and WebSocket endpoint resolver for local development and cloud hosting.
 */

export const getApiUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname || 'localhost';
    const isHttps = window.location.protocol === 'https:';
    if (window.location.port === '3000' || host === 'localhost') {
      return `http://${host}:8000`;
    }
    return `${isHttps ? 'https:' : 'http:'}//${window.location.host}`;
  }
  return 'http://localhost:8000';
};

export const getWsUrl = (sessionId: string = 'default'): string => {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    const base = process.env.NEXT_PUBLIC_WS_URL.replace(/\/$/, '');
    return `${base}/${sessionId}`;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname || 'localhost';
    const isHttps = window.location.protocol === 'https:';
    const proto = isHttps ? 'wss:' : 'ws:';
    if (window.location.port === '3000' || host === 'localhost') {
      return `${proto}//${host}:8000/ws/live/${sessionId}`;
    }
    return `${proto}//${window.location.host}/ws/live/${sessionId}`;
  }
  return `ws://localhost:8000/ws/live/${sessionId}`;
};
