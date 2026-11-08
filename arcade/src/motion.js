/* ==========================================================================
   MOTION LAYER · 运动编排层
   在不改变原有视觉语言的前提下，只给已有元素加"运动"：
     1) 顶部胶囊滑动（复用原来的白胶囊，不用新元素外观）
     2) 滚动惯性（整格卡片随滚速微倾，停下自动回正）
     3) 真实音频律动（音乐播放时用 AnalyserNode 驱动原来的 EQ 条）
     4) 游戏页入场编排（逐块浮现，替代整页硬切）
     5) 卡片按压交接（点开游戏前的一次短促下压）
   规则：只用 transform / opacity；全部参数共用 2 条曲线、3 个时长。
   ========================================================================== */
(function () {
  'use strict';

  var EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
  var reduced = matchMedia('(prefers-reduced-motion: reduce)');
  var app = document.getElementById('app');
  if (!app) return;

  /* ---------------------------------------------------------------- 1. 胶囊 */
  var nav = document.querySelector('.site-tabs');
  var pill = null;

  function ensurePill() {
    if (!nav) return null;
    if (!pill || !pill.isConnected) {
      pill = document.createElement('span');
      pill.className = 'tab-pill';
      pill.setAttribute('aria-hidden', 'true');
      nav.appendChild(pill);
      nav.classList.add('has-pill');
    }
    return pill;
  }

  function placePill(animate) {
    if (!nav) return;
    var active = nav.querySelector('a.is-active');
    var el = ensurePill();
    if (!active || !el) return;
    if (!animate) el.classList.add('no-anim');
    el.style.width = active.offsetWidth + 'px';
    el.style.height = active.offsetHeight + 'px';
    el.style.transform = 'translate3d(' + active.offsetLeft + 'px,' + active.offsetTop + 'px,0)';
    el.classList.add('is-on');
    if (!animate) {
      el.getBoundingClientRect(); /* 先落到目标，再恢复过渡 */
      requestAnimationFrame(function () { el.classList.remove('no-anim'); });
    }
  }

  /* cube.js 的 syncTabs 先于本文件注册 hashchange，因此这里读到的是新状态 */
  function movePill() {
    if (reduced.matches) {
      placePill(false);
      return;
    }
    placePill(true);
  }

  placePill(false);
  addEventListener('hashchange', function () { requestAnimationFrame(movePill); });
  addEventListener('resize', function () { placePill(false); }, { passive: true });
  if (nav) nav.addEventListener('scroll', function () { placePill(false); }, { passive: true });

  /* ------------------------------------------------------- 2. 滚动惯性 */
  var vel = 0;
  var lastY = window.scrollY || 0;
  var scrollTick = 0;
  var settleTick = 0;

  function paintVel() {
    document.documentElement.style.setProperty('--mt-vel', vel.toFixed(4));
  }

  function settle() {
    settleTick = 0;
    vel += (0 - vel) * 0.12;
    if (Math.abs(vel) < 0.002) vel = 0;
    paintVel();
    if (vel !== 0) settleTick = requestAnimationFrame(settle);
  }

  function onScroll() {
    if (scrollTick) return;
    scrollTick = requestAnimationFrame(function () {
      scrollTick = 0;
      var y = window.scrollY || document.documentElement.scrollTop || 0;
      var dy = y - lastY;
      lastY = y;
      var target = Math.max(-1, Math.min(1, dy / 55));
      vel += (target - vel) * 0.45;
      paintVel();
      if (!settleTick) settleTick = requestAnimationFrame(settle);
    });
  }

  if (!reduced.matches) {
    addEventListener('scroll', onScroll, { passive: true });
  }

  /* --------------------------------------------------- 3. 真实音频律动 */
  var eqMounted = false;

  function audioEq() {
    if (eqMounted) return;
    var audio = document.getElementById('site-bgm');
    var eq = document.querySelector('.mp-eq');
    if (!audio || !eq || reduced.matches) return;
    var bars = Array.prototype.slice.call(eq.querySelectorAll('span'));
    if (!bars.length) return;
    eqMounted = true;

    var ctx = null;
    var analyser = null;
    var data = null;
    var frame = 0;
    var routed = false;
    var routing = false;

    /* 只有 AudioContext 确认 running 之后才接管播放管道；
       否则一旦接管，声音会走一个挂起的上下文，音乐会变成静音。 */
    function attach() {
      if (!ctx || ctx.state !== 'running') { routing = false; return; }
      try {
        var src = ctx.createMediaElementSource(audio);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.78;
        src.connect(analyser);
        analyser.connect(ctx.destination);
        data = new Uint8Array(analyser.frequencyBinCount);
        routed = true;
        routing = false;
        eq.classList.add('is-live');
        if (!frame) frame = requestAnimationFrame(tick);
      } catch (err) {
        /* 接管失败就退回原来的 CSS 律动，音乐本身不受影响 */
        routing = false;
        routed = false;
        eq.classList.remove('is-live');
      }
    }

    function route() {
      if (routed) {
        if (!frame) frame = requestAnimationFrame(tick);
        return;
      }
      if (routing) return;
      routing = true;
      try {
        var Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) { routing = false; return; }
        if (!ctx) ctx = new Ctor();
        if (ctx.state === 'running') attach();
        else ctx.resume().then(attach, function () { routing = false; });
      } catch (err) {
        routing = false;
      }
    }

    function tick() {
      frame = 0;
      if (!analyser || audio.paused) return;
      analyser.getByteFrequencyData(data);
      var n = bars.length;
      var top = Math.min(data.length - 1, 26);
      for (var i = 0; i < n; i++) {
        var idx = 1 + Math.round(Math.pow(i / (n - 1), 1.4) * top);
        var v = (data[Math.min(top, idx)] || 0) / 255;
        bars[i].style.transform = 'scaleY(' + (0.14 + v * 0.86).toFixed(3) + ')';
      }
      frame = requestAnimationFrame(tick);
    }

    audio.addEventListener('play', route);
    audio.addEventListener('playing', route);
    if (!audio.paused) route();
    audio.addEventListener('pause', function () {
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      eq.classList.remove('is-live');
      bars.forEach(function (b) { b.style.transform = ''; });
    });
  }

  /* ------------------------------------------------- 4. 游戏页入场编排 */
  var seenView = null;
  var choreoQueued = 0;

  function choreograph() {
    choreoQueued = 0;
    var view = app.querySelector('.view');
    if (!view || view === seenView) return;
    seenView = view;
    if (reduced.matches) return;
    if (!view.classList.contains('view--play')) return; /* 大厅卡片自带 card-in 错峰 */

    var targets = [];
    var bar = view.querySelector('.play-bar');
    if (bar) targets.push([bar, 0]);
    Array.prototype.slice.call(view.querySelectorAll('.stage-col > *')).forEach(function (el, i) {
      targets.push([el, 90 + i * 55]);
    });
    Array.prototype.slice.call(view.querySelectorAll('.side > *')).forEach(function (el, i) {
      targets.push([el, 120 + i * 55]);
    });

    targets.forEach(function (item) {
      var el = item[0];
      if (!el || el.hidden) return;
      try {
        el.animate(
          [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
          { duration: 440, delay: item[1], easing: EASE, fill: 'backwards' }
        );
      } catch (err) { /* 老浏览器直接显示 */ }
    });
  }

  function queueChoreo() {
    if (choreoQueued) return;
    choreoQueued = requestAnimationFrame(function () {
      choreoQueued = requestAnimationFrame(choreograph);
    });
  }

  new MutationObserver(function () { queueChoreo(); }).observe(app, { childList: true });
  queueChoreo();

  /* --------------------------------------------- 5. 卡片按压交接 */
  app.addEventListener('pointerdown', function (e) {
    if (reduced.matches) return;
    var card = e.target.closest && e.target.closest('.game-card');
    if (!card) return;
    try {
      card.animate(
        [{ translate: '0 0' }, { translate: '0 -5px' }],
        { duration: 140, easing: 'ease-out', fill: 'forwards' }
      ).finished.then(function () {
        card.animate(
          [{ translate: '0 -5px' }, { translate: '0 0' }],
          { duration: 380, easing: EASE, fill: 'forwards' }
        );
      }).catch(function () {});
    } catch (err) { /* translate 属性不支持时忽略 */ }
  }, { passive: true });

  /* ------------------------------------------------- 6. 磁吸按钮 */
  var fine = matchMedia('(pointer: fine)');
  var magnets = [];
  var magTick = 0;
  var ptrX = 0;
  var ptrY = 0;
  var ptrAlive = false;
  var RADIUS = 70;
  var PULL = 5;

  function collectMagnets() {
    magnets = Array.prototype.slice.call(document.querySelectorAll('.btn-primary, #header-random'));
  }

  function magLoop() {
    magTick = 0;
    var active = false;
    magnets.forEach(function (el) {
      if (!el.isConnected) return;
      var cur = el.__mag || (el.__mag = { x: 0, y: 0 });
      var r = el.getBoundingClientRect();
      /* 用"未位移"的基准矩形算距离，避免按钮追光标造成的抖动 */
      var cx = r.left - cur.x + r.width / 2;
      var cy = r.top - cur.y + r.height / 2;
      var dx = ptrX - cx;
      var dy = ptrY - cy;
      var dist = Math.hypot(dx, dy) - Math.max(r.width, r.height) / 2;
      var tx = 0;
      var ty = 0;
      if (ptrAlive && dist < RADIUS) {
        var f = 1 - Math.max(0, dist) / RADIUS;
        f = f * f * PULL;
        var len = Math.hypot(dx, dy) || 1;
        tx = (dx / len) * f;
        ty = (dy / len) * f;
      }
      cur.x += (tx - cur.x) * 0.18;
      cur.y += (ty - cur.y) * 0.18;
      if (tx === 0 && Math.abs(cur.x) < 0.05 && Math.abs(cur.y) < 0.05) {
        cur.x = 0;
        cur.y = 0;
        if (el.style.translate) el.style.translate = '';
        return;
      }
      el.style.translate = cur.x.toFixed(2) + 'px ' + cur.y.toFixed(2) + 'px';
      active = true;
    });
    if (active) magTick = requestAnimationFrame(magLoop);
  }

  if (fine.matches && !reduced.matches) {
    addEventListener('pointermove', function (e) {
      ptrX = e.clientX;
      ptrY = e.clientY;
      ptrAlive = true;
      if (!magTick) magTick = requestAnimationFrame(magLoop);
    }, { passive: true });
    addEventListener('pointerdown', function () { ptrAlive = false; if (!magTick) magTick = requestAnimationFrame(magLoop); }, { passive: true });
    document.addEventListener('pointerleave', function () { ptrAlive = false; if (!magTick) magTick = requestAnimationFrame(magLoop); }, { passive: true });
    collectMagnets();
    new MutationObserver(collectMagnets).observe(app, { childList: true, subtree: true });
  }

  /* ------------------------------------------------------- 启动 */
  audioEq();
  if (!eqMounted) setTimeout(audioEq, 1400); /* fx.js 稍晚挂出 EQ 条时补一次 */
})();
