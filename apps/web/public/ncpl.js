/*!
 * ncpl.js — NCPL Analytics auto-capture script (v1)
 *
 * Zero-dependency, framework-agnostic. Add ONE tag to any web app and it
 * automatically captures page views, SPA route changes, sessions, clicks,
 * form submits, device/browser/OS, performance, and JS errors — no developer
 * code required.
 *
 *   <script defer src="https://<your-analytics-host>/ncpl.js"
 *           data-project="crm" data-key="ncpl_pk_xxxxx"></script>
 *
 * Optional manual events (the app MAY call these, but isn't required to):
 *   window.ncpl.track('payment.completed', { amount: 4200 });
 *   window.ncpl.identify('<uuid>');   // a real user UUID, if you have one
 *   window.ncpl.page();               // force a page view
 *
 * Attributes:
 *   data-project   (required)  project slug, e.g. "crm"
 *   data-key       (required)  public ingest key, e.g. "ncpl_pk_..."
 *   data-endpoint  (optional)  override ingest URL (defaults to this script's origin)
 *   data-debug     (optional)  log captured events to the console
 */
(function () {
  'use strict';

  try {
    // ---- locate this script tag + read config -----------------------------
    var script = document.currentScript;
    if (!script) {
      var all = document.querySelectorAll('script[data-project][data-key]');
      script = all[all.length - 1];
    }
    if (!script) return;

    var PROJECT = script.getAttribute('data-project');
    var KEY = script.getAttribute('data-key');
    var DEBUG = script.hasAttribute('data-debug');
    if (!PROJECT || !KEY) {
      if (DEBUG) console.warn('[ncpl] missing data-project or data-key — not tracking');
      return;
    }

    // Derive the ingest endpoint from this script's own origin unless overridden.
    var endpointAttr = script.getAttribute('data-endpoint');
    var origin = '';
    try { origin = new URL(script.src).origin; } catch (e) { origin = location.origin; }
    var ENDPOINT = endpointAttr || origin + '/api/v1/events';

    // ---- tiny helpers ------------------------------------------------------
    function uuid() {
      if (window.crypto && crypto.randomUUID) {
        try { return crypto.randomUUID(); } catch (e) { /* fallthrough */ }
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0;
        var v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }

    function persistentId(kind, key) {
      try {
        var s = kind === 'local' ? window.localStorage : window.sessionStorage;
        var v = s.getItem(key);
        if (!v) { v = uuid(); s.setItem(key, v); }
        return v;
      } catch (e) { return uuid(); }
    }

    function merge(target) {
      for (var i = 1; i < arguments.length; i++) {
        var src = arguments[i];
        if (!src) continue;
        for (var k in src) {
          if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k];
        }
      }
      return target;
    }

    var SESSION_ID = persistentId('session', 'ncpl_sid'); // resets per tab session
    var ANON_ID = persistentId('local', 'ncpl_aid');      // stable per browser

    // ---- device / environment context -------------------------------------
    function deviceContext() {
      try {
        var ua = navigator.userAgent;
        var w = (window.screen && screen.width) || 0;
        var h = (window.screen && screen.height) || 0;

        var browser = 'other';
        if (/Edg\//.test(ua)) browser = 'edge';
        else if (/OPR\/|Opera/.test(ua)) browser = 'opera';
        else if (/Chrome\//.test(ua)) browser = 'chrome';
        else if (/Firefox\//.test(ua)) browser = 'firefox';
        else if (/Safari\//.test(ua)) browser = 'safari';

        var os = 'other';
        if (/Windows/.test(ua)) os = 'windows';
        else if (/Mac OS X/.test(ua)) os = 'macos';
        else if (/Android/.test(ua)) os = 'android';
        else if (/Linux/.test(ua)) os = 'linux';
        else if (/iPhone|iPad/.test(ua)) os = 'ios';

        var deviceType = w > 0 && w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
        var tz = null;
        try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}

        return {
          browser: browser,
          os: os,
          deviceType: deviceType,
          screenResolution: w + 'x' + h,
          language: navigator.language,
          timezone: tz
        };
      } catch (e) { return {}; }
    }
    var DEVICE = deviceContext();

    var userId = null; // becomes a UUID only if the app calls ncpl.identify()

    // ---- event queue (batch + retry-safe unload flush) ---------------------
    var queue = [];
    var FLUSH_MS = 4000;
    var MAX_BATCH = 20;
    var timer = null;

    function schedule() {
      if (timer) return;
      timer = setTimeout(function () { flush(false); }, FLUSH_MS);
    }

    function flush(viaKeepalive) {
      if (timer) { clearTimeout(timer); timer = null; }
      if (!queue.length) return;
      var batch = queue.splice(0, queue.length);
      try {
        fetch(ENDPOINT, {
          method: 'POST',
          keepalive: viaKeepalive !== false,
          headers: { 'content-type': 'application/json', 'x-ncpl-api-key': KEY },
          body: JSON.stringify({ events: batch })
        })['catch'](function () { /* never break the host app */ });
      } catch (e) { /* swallow */ }
    }

    function enqueue(category, name, metadata) {
      var ev = {
        portalId: PROJECT,
        category: category,
        name: name,
        source: 'web',
        userId: userId,
        sessionId: SESSION_ID,
        url: location.href,
        referrer: document.referrer || null,
        metadata: merge({}, DEVICE, { anonId: ANON_ID }, metadata || {}),
        occurredAt: new Date().toISOString()
      };
      queue.push(ev);
      if (DEBUG) console.log('[ncpl]', name, ev);
      if (queue.length >= MAX_BATCH) flush(false);
      else schedule();
    }

    // ---- public API --------------------------------------------------------
    window.ncpl = window.ncpl || {};
    window.ncpl.track = function (name, metadata) {
      if (typeof name === 'string' && name) enqueue('custom', name, metadata);
    };
    window.ncpl.identify = function (id) { userId = id || null; };
    window.ncpl.page = function () { trackPage(); };

    // ---- page views + SPA route changes ------------------------------------
    var lastPath = null;
    var enteredAt = Date.now();

    function currentPath() { return location.pathname + location.search; }

    function trackPage() {
      enqueue('navigation', 'navigation.page_view', { path: currentPath(), title: document.title });
    }

    function flushEngagement() {
      var ms = Date.now() - enteredAt;
      enteredAt = Date.now();
      if (ms >= 1000) {
        enqueue('custom', 'performance.engagement', {
          route: lastPath || currentPath(),
          engagedMs: ms,
          engagedSec: Math.round(ms / 1000)
        });
      }
    }

    function onRouteChange() {
      var p = currentPath();
      if (p === lastPath) return;
      flushEngagement();
      enqueue('navigation', 'navigation.route_change', { from: lastPath, to: p });
      lastPath = p;
      enteredAt = Date.now();
      trackPage();
    }

    lastPath = currentPath();
    trackPage();

    try {
      var _push = history.pushState;
      var _replace = history.replaceState;
      history.pushState = function () { var r = _push.apply(this, arguments); onRouteChange(); return r; };
      history.replaceState = function () { var r = _replace.apply(this, arguments); onRouteChange(); return r; };
      window.addEventListener('popstate', onRouteChange);
      window.addEventListener('hashchange', onRouteChange);
    } catch (e) { /* history not patchable */ }

    // ---- click capture (delegated, interactive elements only) --------------
    function clickMeta(el) {
      var text = (el.innerText || el.textContent || '').trim().slice(0, 80);
      return {
        tag: (el.tagName || '').toLowerCase(),
        id: el.id || null,
        text: text,
        href: (el.getAttribute && el.getAttribute('href')) || null
      };
    }

    document.addEventListener('click', function (e) {
      try {
        var el = e.target;
        while (el && el !== document) {
          var explicit = el.getAttribute && el.getAttribute('data-ncpl-event');
          if (explicit) { enqueue('interaction', explicit, clickMeta(el)); return; }
          var tag = (el.tagName || '').toLowerCase();
          var role = el.getAttribute && el.getAttribute('role');
          if (tag === 'a' || tag === 'button' || role === 'button') {
            enqueue('interaction', 'interaction.click', clickMeta(el));
            return;
          }
          el = el.parentNode;
        }
      } catch (err) { /* swallow */ }
    }, true);

    // ---- form submit capture ----------------------------------------------
    document.addEventListener('submit', function (e) {
      try {
        var f = e.target;
        enqueue('interaction', 'interaction.form_submit', {
          id: f.id || null,
          name: (f.getAttribute && f.getAttribute('name')) || null,
          action: (f.getAttribute && f.getAttribute('action')) || null
        });
      } catch (err) { /* swallow */ }
    }, true);

    // ---- error capture -----------------------------------------------------
    window.addEventListener('error', function (e) {
      enqueue('error', 'error.captured', {
        message: String((e && e.message) || 'error').slice(0, 300),
        file: (e && e.filename) || null,
        line: (e && e.lineno) || null,
        type: 'window.error'
      });
    });
    window.addEventListener('unhandledrejection', function (e) {
      var reason = e && e.reason;
      var msg = reason && reason.message ? reason.message : String(reason);
      enqueue('error', 'error.captured', { message: String(msg).slice(0, 300), type: 'unhandledrejection' });
    });

    // ---- performance (Navigation Timing) -----------------------------------
    function capturePerf() {
      try {
        var entries = performance.getEntriesByType('navigation');
        var nav = entries && entries[0];
        if (!nav || nav.loadEventEnd <= 0) return;
        enqueue('custom', 'performance.page_load', {
          route: currentPath(),
          ttfbMs: Math.round(nav.responseStart),
          domInteractiveMs: Math.round(nav.domInteractive),
          domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
          loadMs: Math.round(nav.loadEventEnd),
          transferKb: nav.transferSize ? Math.round(nav.transferSize / 1024) : null
        });
      } catch (e) { /* swallow */ }
    }
    if (document.readyState === 'complete') setTimeout(capturePerf, 0);
    else window.addEventListener('load', function () { setTimeout(capturePerf, 0); });

    // ---- flush on hide / unload --------------------------------------------
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') { flushEngagement(); flush(true); }
    });
    window.addEventListener('pagehide', function () { flushEngagement(); flush(true); });

    if (DEBUG) console.log('[ncpl] initialised for project "' + PROJECT + '" → ' + ENDPOINT);
  } catch (fatal) {
    // Absolutely never throw into the host application.
    try { if (window.console) console.warn('[ncpl] init failed', fatal); } catch (e) {}
  }
})();
