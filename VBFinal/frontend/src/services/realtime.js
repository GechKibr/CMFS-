const resolveWebSocketBase = () => {
  const configured = import.meta.env.VITE_WEBSOCKET_URL?.trim() || import.meta.env.VITE_WS_URL?.trim();
  if (configured) {
    let normalized = configured.replace(/\/+$/, '');
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && normalized.startsWith('ws://')) {
      normalized = normalized.replace(/^ws:\/\//, 'wss://');
    }
    return normalized;
  }

  const apiUrl = import.meta.env.VITE_API_URL?.trim();
  if (apiUrl) {
    try {
      const parsed = new URL(apiUrl, typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:8000');
      parsed.pathname = '';
      parsed.search = '';
      parsed.hash = '';
      parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
      return parsed.toString().replace(/\/+$/, '');
    } catch {
      // Fall through to the remaining local defaults.
    }
  }

  if (import.meta.env.DEV) {
    return 'ws://127.0.0.1:8000';
  }

  if (typeof window === 'undefined') {
    return 'ws://127.0.0.1:8000';
  }

  return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
};

export const buildRealtimeUrl = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = resolveWebSocketBase();
  const url = new URL(normalizedPath, `${base}/`);
  const token = localStorage.getItem('token');
  if (token) {
    url.searchParams.set('token', token);
  }
  return url.toString();
};

export const openRealtimeSocket = (path, handlers = {}) => {
  if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
    return null;
  }

  const token = localStorage.getItem('token');
  if (!token) {
    return null;
  }

  // Ping the server HTTP(s) origin before opening a raw WebSocket to avoid
  // browser-level "WebSocket is closed before the connection is established"
  // errors when the backend is unreachable. If the ping fails, call onError
  // and return null so callers fall back to polling.
  const base = resolveWebSocketBase();
  let origin;
  try {
    const parsed = new URL(base);
    parsed.protocol = parsed.protocol === 'wss:' ? 'https:' : parsed.protocol === 'ws:' ? 'http:' : parsed.protocol;
    parsed.pathname = '/';
    origin = parsed.toString().replace(/\/+$/, '');
  } catch {
    origin = null;
  }

  const pingServer = async (timeout = 1500) => {
    if (!origin) return false;
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      const resp = await fetch(origin, { method: 'HEAD', signal: controller.signal, cache: 'no-store' });
      clearTimeout(id);
      return resp.ok || resp.type === 'opaque' || resp.status === 0;
    } catch {
      return false;
    }
  };

  const openSocket = () => {
    try {
      const socket = new WebSocket(buildRealtimeUrl(path));

      if (handlers.onOpen) {
        socket.addEventListener('open', handlers.onOpen);
      }
      if (handlers.onMessage) {
        socket.addEventListener('message', handlers.onMessage);
      }
      if (handlers.onClose) {
        socket.addEventListener('close', handlers.onClose);
      }
      if (handlers.onError) {
        socket.addEventListener('error', handlers.onError);
      }

      return socket;
    } catch (err) {
      if (handlers.onError) {
        try { handlers.onError(err); } catch { }
      }
      return null;
    }
  };

  // Try a quick ping; if it fails, skip opening the WebSocket to avoid noisy
  // browser errors. Callers already implement polling fallback.
  try {
    // fire-and-forget ping but await result so we avoid creating the socket when
    // backend is unreachable.
    return (async () => {
      const ok = await pingServer(1200);
      if (!ok) {
        if (handlers.onError) {
          try { handlers.onError(new Error('Realtime server unreachable')); } catch { }
        }
        return null;
      }
      return openSocket();
    })();
  } catch (err) {
    if (handlers.onError) {
      try { handlers.onError(err); } catch { }
    }
    return null;
  }
};
