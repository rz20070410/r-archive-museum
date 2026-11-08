/* ==========================================================================
   SILVER ARCADE · core/util.js
   全局命名空间、安全存储、事件、DOM 与动画小工具、公共 Reveal 观察器。
   约定：所有模块都挂在 window.Museum 上；经典 <script>，无模块、无网络。
   ========================================================================== */
(function () {
  'use strict';

  var Museum = window.Museum = window.Museum || {};
  var hasDOM = typeof document !== 'undefined';

  /* ---------- 环境 ---------- */
  var reduceQuery = hasDOM && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var coarseQuery = hasDOM && window.matchMedia ? window.matchMedia('(pointer: coarse)') : null;

  Museum.env = {
    reduced: function () { return !!(reduceQuery && reduceQuery.matches) || document.documentElement.classList.contains('is-reduced'); },
    coarse: function () { return !!(coarseQuery && coarseQuery.matches) || document.documentElement.classList.contains('is-mobile'); },
    mobile: function () { return window.innerWidth <= 820; },
    noIntro: function () { return document.documentElement.classList.contains('no-intro'); },
    dpr: function () { return Math.min(window.devicePixelRatio || 1, 2); }
  };

  /* ---------- 安全存储（file:// 下 localStorage 可能不可用，降级内存） ---------- */
  var PREFIX = 'silver-arcade.museum.';
  var memory = Object.create(null);
  var storageOK = false;
  try {
    var probe = PREFIX + '__probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    storageOK = true;
  } catch (e) { storageOK = false; }

  var store = Museum.store = {
    available: storageOK,
    get: function (key, fallback) {
      var raw;
      try { raw = storageOK ? window.localStorage.getItem(PREFIX + key) : (key in memory ? memory[key] : null); }
      catch (e) { raw = key in memory ? memory[key] : null; }
      if (raw == null) return fallback;
      try { return JSON.parse(raw); } catch (e) { return fallback; }
    },
    set: function (key, value) {
      var raw;
      try { raw = JSON.stringify(value); } catch (e) { return false; }
      memory[key] = raw;
      if (storageOK) {
        try { window.localStorage.setItem(PREFIX + key, raw); } catch (e) { /* memory already set */ }
      }
      return true;
    },
    del: function (key) {
      delete memory[key];
      if (storageOK) { try { window.localStorage.removeItem(PREFIX + key); } catch (e) {} }
    }
  };

  /* ---------- 事件总线 ---------- */
  var handlers = Object.create(null);
  Museum.events = {
    on: function (name, fn) {
      (handlers[name] || (handlers[name] = [])).push(fn);
      return function () { Museum.events.off(name, fn); };
    },
    off: function (name, fn) {
      var list = handlers[name];
      if (!list) return;
      var i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    },
    emit: function (name, payload) {
      var list = handlers[name];
      if (!list) return;
      list.slice().forEach(function (fn) {
        try { fn(payload); } catch (err) { console.error('[museum] event handler failed:', name, err); }
      });
    }
  };

  /* ---------- DOM ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function el(tag, className, html) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
  }
  function on(node, type, handler, options) {
    if (!node) return function () {};
    node.addEventListener(type, handler, options);
    return function () { node.removeEventListener(type, handler, options); };
  }

  /* ---------- 数学与格式化 ---------- */
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function damp(current, target, lambda, dt) { return lerp(current, target, 1 - Math.exp(-lambda * dt)); }
  function formatNumber(n) {
    return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    return Math.floor(sec / 60) + ':' + pad2(sec % 60);
  }

  Museum.util = {
    $: $, $$: $$, esc: esc, el: el, on: on,
    clamp: clamp, lerp: lerp, damp: damp,
    formatNumber: formatNumber, pad2: pad2, fmtTime: fmtTime,
    nextFrame: function (fn) { return window.requestAnimationFrame(fn); },
    debounce: function (fn, wait) {
      var t;
      return function () {
        var args = arguments, self = this;
        clearTimeout(t);
        t = setTimeout(function () { fn.apply(self, args); }, wait);
      };
    },
    /** 数字补间（尊重减少动态） */
    countUp: function (node, target, opts) {
      if (!node) return;
      opts = opts || {};
      var reduced = Museum.env.reduced();
      var from = opts.from != null ? opts.from : 0;
      var dur = opts.duration || 900;
      var decimals = opts.decimals || 0;
      var suffix = opts.suffix || '';
      var start = performance.now();
      if (reduced || Number(target) === 0) {
        node.textContent = (decimals ? Number(target).toFixed(decimals) : formatNumber(target)) + suffix;
        return;
      }
      function tick(now) {
        var p = clamp((now - start) / dur, 0, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        var v = from + (target - from) * eased;
        node.textContent = (decimals ? v.toFixed(decimals) : formatNumber(v)) + suffix;
        if (p < 1) requestAnimationFrame(tick);
        else node.textContent = (decimals ? Number(target).toFixed(decimals) : formatNumber(target)) + suffix;
      }
      requestAnimationFrame(tick);
    }
  };

  /* ---------- 卡片藏品封面（复用旧站 card-art.js 的单色 SVG 版画） ---------- */
  Museum.coverHtml = function(game) {
    return '<img class="ai-cover" src="assets/art/'+encodeURIComponent(game.id)+'.webp" alt="'+esc(game.title)+' 游戏封面" loading="lazy" decoding="async">';
  };

  /* ---------- Reveal 观察器（所有视图共用） ---------- */
  var revealObserver = null;
  function ensureRevealObserver() {
    if (revealObserver || !('IntersectionObserver' in window)) return;
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  }
  Museum.observeReveal = function (root) {
    var nodes = $$('[data-reveal], .mask-line', root || document);
    if (Museum.env.reduced() || !('IntersectionObserver' in window)) {
      nodes.forEach(function (n) { n.classList.add('is-in'); });
      return function () {};
    }
    ensureRevealObserver();
    nodes.forEach(function (n) {
      if (!n.classList.contains('is-in')) revealObserver.observe(n);
    });
    return function () {
      if (!revealObserver) return;
      nodes.forEach(function (n) { revealObserver.unobserve(n); });
    };
  };

  /* ---------- 轻提示 ---------- */
  var toastTimer = null;
  Museum.toast = function (message, ms) {
    var node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.classList.remove('is-show'); }, ms || 2000);
  };

  /* ---------- 路由便捷 ---------- */
  Museum.route = { name: 'home', params: {} };
  Museum.hrefFor = function (name, params) {
    params = params || {};
    if (name === 'home') return '#/';
    if (name === 'game') return '#/game/' + encodeURIComponent(params.id || '');
    if (name === 'play') return '#/play/' + encodeURIComponent(params.id || '');
    return '#/' + name + (params.id ? '/' + encodeURIComponent(params.id) : '');
  };
  Museum.go = function (nameOrHash) {
    var hash = nameOrHash.charAt(0) === '#' ? nameOrHash : Museum.hrefFor(nameOrHash);
    if (location.hash === hash) {
      Museum.events.emit('route:same', hash);
      return;
    }
    location.hash = hash;
  };

  /* ---------- 通用：锁定滚动 ---------- */
  var lockCount = 0;
  Museum.lockScroll = function (on) {
    lockCount = Math.max(0, lockCount + (on ? 1 : -1));
    document.body.classList.toggle('is-locked', lockCount > 0);
  };
})();
