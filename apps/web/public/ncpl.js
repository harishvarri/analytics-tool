/*!
 * ncpl.js — NCPL Analytics auto-capture script (v2)
 *
 * Zero-dependency, framework-agnostic. Add ONE tag to any web app and it
 * automatically captures page views, SPA route changes, sessions, clicks,
 * form submits, device/browser/OS, performance, JS errors — AND the signed-in
 * user (auto-detected from Supabase, Clerk, Firebase, Auth0, or a JWT), with
 * auto login/logout events. No developer code required.
 *
 *   <script defer src="https://<your-analytics-host>/ncpl.js"
 *           data-project="crm" data-key="ncpl_pk_xxxxx"></script>
 *
 * Optional manual events (the app MAY call these, but isn't required to):
 *   window.ncpl.track('payment.completed', { amount: 4200 });
 *   window.ncpl.identify('<uuid>');   // override auto-detection if you prefer
 *   window.ncpl.page();               // force a page view
 *
 * Attributes:
 *   data-project       (required)  project slug, e.g. "crm"
 *   data-key           (required)  public ingest key, e.g. "ncpl_pk_..."
 *   data-endpoint      (optional)  override ingest URL (defaults to script origin)
 *   data-debug         (optional)  log captured events to the console
 *   data-autoidentify  (optional)  set to "false" to disable auto user discovery
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
    var AUTO_IDENTIFY = (script.getAttribute('data-autoidentify') || '').toLowerCase() !== 'false';
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

    // Anonymous-by-default: every browser counts as a distinct visitor (a stable
    // UUID). ncpl.identify(...) attaches a real identity once a user signs in:
    //   identify('<central-user-uuid>')        → central SSO apps
    //   identify(null, { email, name })        → independent apps (linked by email)
    var userId = ANON_ID;
    try {
      var storedUid = window.sessionStorage.getItem('ncpl_uid');
      if (storedUid) userId = storedUid;
    } catch (e) {}

    var identifiedEmail = null;
    try {
      var storedEmail = window.sessionStorage.getItem('ncpl_uemail');
      if (storedEmail) identifiedEmail = storedEmail;
    } catch (e) {}

    var identifiedName = null;
    try {
      var storedName = window.sessionStorage.getItem('ncpl_uname');
      if (storedName) identifiedName = storedName;
    } catch (e) {}

    function isUuid(s) {
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
    }

    // Auto user-discovery state. manualSet = the app called identify() itself
    // (takes precedence — we stop auto-detecting). autoKey = the identity we
    // auto-detected, so we don't re-fire auth.login on every reload/poll.
    var manualSet = false;
    var autoIdentified = !!identifiedEmail;
    var autoKey = identifiedEmail || (isUuid(userId) ? userId : null);

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
        // When identified by email (no uuid), send userId:null + userEmail so the
        // platform resolves to the central directory user by email.
        userId: identifiedEmail ? null : userId,
        sessionId: SESSION_ID,
        url: location.href,
        referrer: document.referrer || null,
        metadata: merge({}, DEVICE, { anonId: ANON_ID }, metadata || {}),
        occurredAt: new Date().toISOString()
      };
      if (identifiedEmail) ev.userEmail = identifiedEmail;
      if (identifiedName) ev.userName = identifiedName;
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
    // Public identify() — flags a manual override so auto-discovery defers to it.
    window.ncpl.identify = function (id, traits) {
      manualSet = true;
      doIdentify(id, traits);
    };
    function doIdentify(id, traits) {
      traits = traits || {};
      if (id === null && !traits.email && !traits.name) {
        userId = ANON_ID;
        identifiedEmail = null;
        identifiedName = null;
        try {
          window.sessionStorage.removeItem('ncpl_uid');
          window.sessionStorage.removeItem('ncpl_uemail');
          window.sessionStorage.removeItem('ncpl_uname');
        } catch (e) {}
        return;
      }
      if (id === null) {
        userId = ANON_ID;
        try { window.sessionStorage.removeItem('ncpl_uid'); } catch (e) {}
      } else if (typeof id === 'string' && isUuid(id)) {
        userId = id;
        try { window.sessionStorage.setItem('ncpl_uid', id); } catch (e) {}
      } else if (typeof id === 'string' && id.indexOf('@') > -1) {
        identifiedEmail = id.toLowerCase();
        try { window.sessionStorage.setItem('ncpl_uemail', identifiedEmail); } catch (e) {}
      }
      if (traits.email) {
        identifiedEmail = String(traits.email).toLowerCase();
        try { window.sessionStorage.setItem('ncpl_uemail', identifiedEmail); } catch (e) {}
      }
      if (traits.name) {
        identifiedName = String(traits.name);
        try { window.sessionStorage.setItem('ncpl_uname', identifiedName); } catch (e) {}
      }
    };
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

    // ---- AUTO USER DISCOVERY (v2) ------------------------------------------
    // Detect the signed-in user from common auth providers and identify them
    // with no developer code. Only email/name/sub are read; the raw token is
    // never stored or transmitted. Every probe is wrapped so it can't throw.
    function b64urlDecode(s) {
      try {
        s = String(s).replace(/-/g, '+').replace(/_/g, '/');
        while (s.length % 4) s += '=';
        var raw = atob(s);
        try {
          return decodeURIComponent(raw.split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
        } catch (e) { return raw; }
      } catch (e) { return null; }
    }
    function jwtPayload(tok) {
      if (typeof tok !== 'string') return null;
      var parts = tok.split('.');
      if (parts.length !== 3) return null;
      var json = b64urlDecode(parts[1]);
      if (!json) return null;
      try { return JSON.parse(json); } catch (e) { return null; }
    }
    function looksJwt(s) {
      return typeof s === 'string' && s.length < 4096 &&
        /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(s);
    }
    function pickName(o) {
      if (!o) return null;
      if (o.full_name) return o.full_name;
      if (o.name) return o.name;
      if (o.fullName) return o.fullName;
      if (o.displayName) return o.displayName;
      var combo = ((o.given_name || '') + ' ' + (o.family_name || '')).trim();
      return combo || null;
    }
    function fromUser(u, provider) {
      if (!u || typeof u !== 'object') return null;
      var email = u.email ||
        (u.primaryEmailAddress && u.primaryEmailAddress.emailAddress) || null;
      var name = pickName(u) || (u.user_metadata ? pickName(u.user_metadata) : null);
      var id = u.id || u.uid || u.sub || null;
      if (!email && !id) return null;
      return { id: id, email: email ? String(email).toLowerCase() : null, name: name || null, provider: provider };
    }
    function fromClaims(c, provider) {
      if (!c || typeof c !== 'object') return null;
      var email = c.email || null;
      if (!email && !c.sub) return null;
      return { id: c.sub || null, email: email ? String(email).toLowerCase() : null, name: pickName(c), provider: provider };
    }
    function lsKeys() {
      var out = [];
      try { for (var i = 0; i < localStorage.length; i++) out.push(localStorage.key(i)); } catch (e) {}
      return out;
    }
    function discoverUser() {
      // 1. Supabase — session JSON under sb-<ref>-auth-token in localStorage.
      try {
        var keys = lsKeys();
        for (var i = 0; i < keys.length; i++) {
          if (!/^sb-.*-auth-token$/.test(keys[i])) continue;
          var parsed = JSON.parse(localStorage.getItem(keys[i]));
          if (Array.isArray(parsed)) parsed = parsed[0];
          var sUser = (parsed && (parsed.user || (parsed.currentSession && parsed.currentSession.user))) || null;
          var got = fromUser(sUser, 'supabase');
          if (got && (got.email || got.id)) return got;
          var at = parsed && (parsed.access_token || (parsed.currentSession && parsed.currentSession.access_token));
          if (at) { var c = fromClaims(jwtPayload(at), 'supabase'); if (c && c.email) return c; }
        }
      } catch (e) {}
      // 2. Clerk
      try { if (window.Clerk && window.Clerk.user) { var g = fromUser(window.Clerk.user, 'clerk'); if (g) return g; } } catch (e) {}
      // 3. Firebase
      try {
        var fb = window.firebase && window.firebase.auth && window.firebase.auth();
        if (fb && fb.currentUser) { var gf = fromUser(fb.currentUser, 'firebase'); if (gf) return gf; }
      } catch (e) {}
      // 4. Auth0 (SPA SDK stores id_token in an @@auth0spajs@@ cache entry)
      try {
        var ks = lsKeys();
        for (var j = 0; j < ks.length; j++) {
          if (ks[j].indexOf('@@auth0spajs@@') === -1) continue;
          var a = JSON.parse(localStorage.getItem(ks[j]));
          var body = a && (a.body || a);
          var idt = body && (body.id_token || (body.decodedToken && body.decodedToken.encoded && body.decodedToken.encoded.id_token));
          var u0 = body && body.decodedToken && body.decodedToken.user;
          if (u0) { var gu = fromUser(u0, 'auth0'); if (gu) return gu; }
          if (idt) { var ca = fromClaims(jwtPayload(idt), 'auth0'); if (ca && ca.email) return ca; }
        }
      } catch (e) {}
      // 5. Generic JWT — scan storage for an access/id token with an email claim.
      try {
        var stores = [window.localStorage, window.sessionStorage];
        for (var s = 0; s < stores.length; s++) {
          var st = stores[s]; if (!st) continue;
          for (var k = 0; k < st.length; k++) {
            var val = st.getItem(st.key(k));
            if (!looksJwt(val)) continue;
            var cg = fromClaims(jwtPayload(val), 'jwt');
            if (cg && cg.email) return cg;
          }
        }
      } catch (e) {}
      return null;
    }

    function applyDiscovery() {
      if (!AUTO_IDENTIFY || manualSet) return;
      var d = null;
      try { d = discoverUser(); } catch (e) { d = null; }
      if (d && (d.email || (d.id && isUuid(d.id)))) {
        var key = d.email || d.id;
        if (key !== autoKey) {
          if (d.id && isUuid(d.id)) doIdentify(d.id, d.name ? { name: d.name } : {});
          else doIdentify(null, d.name ? { email: d.email, name: d.name } : { email: d.email });
          autoKey = key;
          autoIdentified = true;
          enqueue('auth', 'auth.login', { method: 'auto', provider: d.provider });
          if (DEBUG) console.log('[ncpl] auto-identified via ' + d.provider, d.email || d.id);
        }
      } else if (autoIdentified) {
        // Identity was auto-detected and is now gone → treat as sign-out.
        enqueue('auth', 'auth.logout', { method: 'auto' });
        doIdentify(null);
        autoKey = null;
        autoIdentified = false;
        if (DEBUG) console.log('[ncpl] auto sign-out detected');
      }
    }

    if (AUTO_IDENTIFY) {
      applyDiscovery();
      // Providers may hydrate after load — re-check a few times, then on signals.
      [800, 2500, 6000, 15000].forEach(function (ms) { setTimeout(applyDiscovery, ms); });
      try {
        window.addEventListener('storage', applyDiscovery);
        window.addEventListener('focus', applyDiscovery);
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible') applyDiscovery();
        });
        window.addEventListener('popstate', applyDiscovery);
        window.addEventListener('hashchange', applyDiscovery);
      } catch (e) {}
    }

    if (DEBUG) console.log('[ncpl] initialised for project "' + PROJECT + '" → ' + ENDPOINT);
  } catch (fatal) {
    // Absolutely never throw into the host application.
    try { if (window.console) console.warn('[ncpl] init failed', fatal); } catch (e) {}
  }
})();
