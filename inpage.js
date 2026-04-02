// === PREVENT DOUBLE INJECTION — 100% SAFE FOR MAIN WORLD ===
(() => {
  if (window.__PT_POSTER_INPAGE_LOADED__) {
    console.log('[PT POSTER] inpage.js already loaded — skipping');
    return;
  }
  window.__PT_POSTER_INPAGE_LOADED__ = true;

  // === YOUR ACTUAL INPAGE.JS CODE STARTS HERE ===
  const TARGET = 'https://relay.amazon.com/api/loadboard/search';

  const isTargetUrl = (raw) => {
    try {
      const u = new URL(raw, location.href);
      const base = u.origin + u.pathname;
      return base === TARGET;
    } catch (e) {
      return false;
    }
  };

  const safeParse = (val) => {
    try {
      if (val == null) return null;
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch { return val; }
      }
      if (val instanceof URLSearchParams) return Object.fromEntries(val.entries());
      if (val instanceof FormData) {
        const obj = {};
        for (const [k, v] of val.entries()) obj[k] = v;
        return obj;
      }
      if (val instanceof Blob) return '[blob]';
      if (val instanceof ArrayBuffer) return '[arraybuffer]';
      if (typeof val === 'object') return val;
      return String(val);
    } catch {
      return '[unserializable]';
    }
  };

  // Your fetch patch here...
  (function patchFetch() {
    const origFetch = window.fetch;
    if (!origFetch) return;

    window.__LAST_SUCCESSFUL_FETCH__ = null;

    window.fetch = async function (input, init) {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const method = (init && init.method) || (input && input.method) || 'GET';
      const normalizedMethod = (method || 'GET').toUpperCase();

      if (normalizedMethod !== 'POST') {
        return origFetch.apply(this, arguments);
      }

      if (!isTargetUrl(url)) {
        return origFetch.apply(this, arguments);
      }

      const body = init?.body ?? input?.body;
      if (!body) return origFetch.apply(this, arguments);

      const id = Math.random().toString(36).slice(2);
      const requestBody = safeParse(body);

      try {
        const response = await origFetch.apply(this, arguments);

        let text = '[unreadable]';
        try { text = await response.clone().text(); } catch (e) {}

        let parsed = text;
        try { parsed = JSON.parse(text); } catch (e) {}

        const endMsg = {
          __RELAY_MONITOR__: true,
          type: 'request-end',
          layer: 'fetch',
          id,
          url: new URL(url, location.href).href,
          method: normalizedMethod,
          status: response.status,
          responseBody: parsed
        };

        window.__LAST_SUCCESSFUL_FETCH__ = id;
        window.postMessage(endMsg, '*');

        return response;
      } catch (err) {
        if (err?.name === "AbortError") return;
        await new Promise(res => setTimeout(res, 300));
        if (window.__LAST_SUCCESSFUL_FETCH__ === id) return;

        const errMsg = {
          __RELAY_MONITOR__: true,
          type: 'request-error',
          layer: 'fetch',
          id,
          url: new URL(url, location.href).href,
          method: normalizedMethod,
          error: String(err)
        };
        window.postMessage(errMsg, '*');
        throw err;
      }
    };
  })();
})();