/**
 * Resume Marketing Portal — vanilla JS analytics integration.
 *
 * For a legacy portal where bundling the SDK isn't practical. Pull the SDK
 * UMD build (or self-host /dist/index.global.js) via <script> and call
 * window.NCPL.boot(...) once.
 *
 * In this example we use the JSON over fetch directly — same wire format
 * the real SDK emits. Drop in via:
 *
 *   <script src="/analytics.js" defer></script>
 */
(function () {
  const ENDPOINT = (window.NCPL_CONFIG && window.NCPL_CONFIG.endpoint) || '/api/v1/events';
  const PORTAL_ID = 'resume-marketing';
  const SESSION_KEY = 'ncpl_session_id';
  const USER_KEY = 'ncpl_user_id';

  // ---- session ----
  function sessionId() {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        (crypto.randomUUID && crypto.randomUUID()) ||
        Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  // ---- queue ----
  const queue = [];
  let timer = null;

  function flush() {
    if (queue.length === 0) return;
    const batch = queue.splice(0, 25);
    const body = JSON.stringify({ events: batch });
    if (document.visibilityState === 'hidden' && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
      return;
    }
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      // best-effort; re-queue at head for the next tick
      queue.unshift(...batch);
    });
  }

  function schedule() {
    if (timer) return;
    timer = setInterval(flush, 4000);
  }

  function enqueue(event) {
    queue.push({
      portalId: PORTAL_ID,
      occurredAt: new Date().toISOString(),
      sessionId: sessionId(),
      userId: localStorage.getItem(USER_KEY),
      url: location.href,
      referrer: document.referrer || null,
      source: 'web',
      ...event,
    });
    if (queue.length >= 25) flush();
  }

  // ---- public API ----
  window.NCPL = {
    identify(userId) {
      if (userId) localStorage.setItem(USER_KEY, userId);
      else localStorage.removeItem(USER_KEY);
    },
    track(category, name, metadata) {
      enqueue({ category: category || 'custom', name, metadata: metadata || {} });
    },
    pageView() {
      enqueue({ category: 'navigation', name: 'navigation.page_view' });
    },
    boot() {
      schedule();
      window.NCPL.pageView();
      window.addEventListener('pagehide', flush);
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush();
      });
    },
  };

  window.NCPL.boot();
})();
