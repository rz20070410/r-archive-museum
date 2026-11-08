/* ==========================================================================
   PAGE ROUTER FX · top tabs + CSS 3D cube transition + page animations
   ========================================================================== */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const app = document.getElementById('app');
  const tabs = [...document.querySelectorAll('.site-tabs a')];
  if (!app) return;

  const ROUTES = { origin: '01 / 初心', games: '02 / 游戏', next: '03 / 未来' };
  const routeOf = (hash) => {
    if (hash.indexOf('#/origin') === 0) return 'origin';
    if (hash.indexOf('#/next') === 0) return 'next';
    return 'games';
  };

  /* ---------- 全屏液态玻璃流体转场 ---------- */
  const overlay = document.createElement('div');
  overlay.className = 'page-transition';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML =
    '<div class="lt-glass" aria-hidden="true"></div>' +
    '<canvas class="lt-canvas" aria-hidden="true"></canvas>' +
    '<div class="pt-label"><span id="transition-label">R`s GAME BOX</span><em id="transition-sub">CHANGING VIEW</em></div>';
  document.body.appendChild(overlay);

  const transitionLabel = overlay.querySelector('#transition-label');
  const transitionSub = overlay.querySelector('#transition-sub');
  const ltGlass = overlay.querySelector('.lt-glass');
  const ltCanvas = overlay.querySelector('.lt-canvas');
  const ltCtx = ltCanvas.getContext('2d');
  const ltMobile = matchMedia('(max-width: 820px)');
  let busy = false;
  let ltRaf = 0;
  let ltBlobs = [];

  const ltEaseOut = (t) => 1 - Math.pow(1 - t, 3);
  const ltEaseInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function ltSeed() {
    const n = ltMobile.matches ? 10 : 16;
    ltBlobs = [];
    for (let i = 0; i < n; i++) {
      ltBlobs.push({
        a: (i / n) * Math.PI * 2 + Math.random() * 0.7,
        d: 0.18 + Math.random() * 0.82,   /* 向外涌出的距离 */
        r: 0.16 + Math.random() * 0.26,   /* 大小 */
        s: 0.6 + Math.random() * 0.8,     /* 流动速度 */
        ph: Math.random() * Math.PI * 2,
        al: 0.55 + Math.random() * 0.45,
        w: 0.05 + Math.random() * 0.08    /* 呼吸幅度 */
      });
    }
  }

  function ltSize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    /* 超高清：最多 2 倍像素密度，同时限制总像素量避免大屏掉帧 */
    const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(4200000 / Math.max(1, w * h)));
    ltCanvas.width = Math.round(w * dpr);
    ltCanvas.height = Math.round(h * dpr);
    ltCanvas.style.width = w + 'px';
    ltCanvas.style.height = h + 'px';
    ltCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: w, h: h };
  }

  /* p: 0 = 收在中心，1 = 铺满全屏。canvas 只画清晰的高光与液滴，不做模糊 */
  function ltDraw(p, time, w, h) {
    const c = ltCtx;
    c.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const span = Math.max(w, h);
    const maxR = Math.hypot(w, h) * 0.52 * p;

    /* 液滴：小、边缘明确，像挂在玻璃上的水珠，不是散景 */
    for (let i = 0; i < ltBlobs.length; i++) {
      const b = ltBlobs[i];
      const ang = b.a + Math.sin(time * 0.0011 * b.s + b.ph) * 0.28;
      const rr = maxR * b.d;
      const x = cx + Math.cos(ang) * rr;
      const y = cy + Math.sin(ang * 1.07) * rr * 0.92;
      const pulse = 0.7 + 0.3 * Math.sin(time * 0.0024 * b.s + b.ph);
      const r = span * (0.006 + b.r * 0.032) * (0.5 + p * 1.1) * pulse;
      if (r <= 0.8) continue;
      const al = Math.min(0.5, 0.42 * b.al * Math.min(1, p * 1.8));
      const g = c.createRadialGradient(x - r * 0.18, y - r * 0.22, r * 0.08, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,' + al.toFixed(3) + ')');
      g.addColorStop(0.66, 'rgba(240,248,255,' + (al * 0.82).toFixed(3) + ')');
      g.addColorStop(0.92, 'rgba(190,220,255,' + (al * 0.3).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
      /* 水珠一圈清晰的边 */
      c.strokeStyle = 'rgba(255,255,255,' + (al * 0.45).toFixed(3) + ')';
      c.lineWidth = 1;
      c.beginPath();
      c.arc(x, y, r * 0.96, 0, Math.PI * 2);
      c.stroke();
    }

    /* 峰值：用一层清透的冷光（不是黑幕）盖住换页这一瞬，仍然是清晰的高光面 */
    const peak = Math.max(0, Math.min(1, (p - 0.7) / 0.3));
    const veil = 0.72 * peak * peak;
    if (veil > 0.002) {
      c.fillStyle = 'rgba(196, 216, 244,' + veil.toFixed(3) + ')';
      c.fillRect(0, 0, w, h);
    }

    /* 两道锐利的镜面反光，压暗之后仍然清晰可见 */
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) {
      const a = -0.62 + i * 0.5;
      const width = span * (0.05 + i * 0.028);
      const sweep = (Math.sin(time * 0.0013 + i * 2.1) * 0.5 + 0.5) * span - span * 0.5;
      c.save();
      c.translate(cx + sweep * Math.cos(a), cy + sweep * Math.sin(a));
      c.rotate(a);
      const g = c.createLinearGradient(0, -width, 0, width);
      const amt = (0.1 + p * 0.16).toFixed(3);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.46, 'rgba(200,228,255,' + amt + ')');
      g.addColorStop(0.5, 'rgba(255,255,255,' + (Number(amt) + 0.08).toFixed(3) + ')');
      g.addColorStop(0.54, 'rgba(200,228,255,' + amt + ')');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(-span, -width, span * 2, width * 2);
      c.restore();
    }
    c.globalCompositeOperation = 'source-over';
  }

  function ltRun(timing) {
    const size = ltSize();
    ltSeed();
    const start = performance.now();
    const grow = timing.grow;
    const hold = timing.hold;
    const shrink = timing.shrink;
    const total = grow + hold + shrink;
    let covered = false;
    let finished = false;

    /* 关键：切路由不依赖"刚好落在 hold 帧里"，低帧率时 hold 窗口可能被整帧跳过。
       在峰值之后 24ms 再切，保证压暗已经铺满，换页完全看不见。 */
    function fireCover() {
      if (covered) return;
      covered = true;
      ltDraw(1, performance.now(), size.w, size.h);
      if (timing.onCover) timing.onCover();
    }

    function finish() {
      if (finished) return;
      finished = true;
      clearTimeout(coverTimer);
      clearTimeout(endTimer);
      fireCover();
      if (ltRaf) { cancelAnimationFrame(ltRaf); ltRaf = 0; }
      ltCtx.clearRect(0, 0, size.w, size.h);
      ltGlass.style.opacity = '0';
      ltGlass.style.transform = 'scale(0.02) rotate(-14deg)';
      overlay.classList.remove('is-on', 'is-peak');
      document.body.classList.remove('is-transitioning', 'is-lt');
      if (timing.onDone) timing.onDone();
    }

    const coverTimer = setTimeout(fireCover, grow + 24);
    const endTimer = setTimeout(finish, total + 420);
    const coverAt = grow + 24;

    document.body.classList.add('is-transitioning', 'is-lt');
    ltGlass.style.opacity = '0';
    ltGlass.style.transform = 'scale(0.02) rotate(-14deg)';
    overlay.classList.add('is-on');
    overlay.classList.remove('is-peak');

    function frame(now) {
      const t = now - start;
      if (!covered && t >= coverAt) fireCover();
      if (t >= total) { finish(); return; }

      let p;
      let scale;
      let rot;
      let opacity;
      if (t < grow) {
        p = ltEaseOut(t / grow);
        scale = 0.02 + p;
        rot = -14 + p * 24;
        opacity = Math.min(1, p * 10);
      } else if (t < grow + hold) {
        p = 1;
        scale = 1.02 + Math.sin((t - grow) * 0.008) * 0.006;
        rot = 10 + Math.sin((t - grow) * 0.01) * 1.4;
        opacity = 1;
        overlay.classList.add('is-peak');
      } else {
        const k = (t - grow - hold) / shrink;
        p = 1 - ltEaseInOut(k);
        scale = 0.02 + p;
        rot = 10 + (1 - p) * 16;
        opacity = p > 0.06 ? 1 : p / 0.06;
        overlay.classList.remove('is-peak');
      }
      ltGlass.style.transform = 'scale(' + scale.toFixed(4) + ') rotate(' + rot.toFixed(2) + 'deg)';
      ltGlass.style.opacity = opacity.toFixed(3);
      ltDraw(p, now, size.w, size.h);
      ltRaf = requestAnimationFrame(frame);
    }
    ltRaf = requestAnimationFrame(frame);
  }

  function go(href, label, opts) {
    if (busy) return false;
    if (reduced.matches) {
      location.hash = href;
      return true;
    }
    busy = true;
    const fast = !!(opts && opts.fast);
    transitionLabel.textContent = label || 'R`s GAME BOX';
    transitionSub.textContent = fast ? 'OPENING' : 'CHANGING VIEW';
    ltRun({
      grow: fast ? 240 : 300,
      hold: fast ? 70 : 90,
      shrink: fast ? 220 : 280,
      onCover: function () { location.hash = href; },
      onDone: function () { busy = false; }
    });
    return true;
  }
  /* 让游戏卡片等非 <a> 入口也能走同一套帘幕转场 */
  window.RGBGo = go;

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || ['#/', '#/origin', '#/next'].indexOf(href) < 0) return;
    const target = routeOf(href);
    const current = routeOf(location.hash);
    if (target === current) {
      if (location.hash !== href) location.hash = href;
      return;
    }
    e.preventDefault();
    go(href, ROUTES[target]);
  });

  /* ---------- 顶部选项卡状态 ---------- */
  function syncTabs() {
    const current = routeOf(location.hash);
    tabs.forEach((a) => {
      const active = a.getAttribute('href') === '#/origin' ? current === 'origin'
        : a.getAttribute('href') === '#/next' ? current === 'next'
        : current === 'games';
      a.classList.toggle('is-active', active);
      if (active) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.body.dataset.page = current;
  }

  /* ---------- 页面滚动揭示 / 建议卡 ---------- */
  let revealObserver = null;
  function setupPage() {
    if (revealObserver) revealObserver.disconnect();
    revealObserver = null;
    const view = document.querySelector('#view-origin, #view-next');
    if (!view) return;
    const items = view.querySelectorAll('[data-reveal]');
    if (!items.length) return;
    if (reduced.matches || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-in'));
      return;
    }
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('is-in');
          revealObserver.unobserve(en.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
    items.forEach((el) => revealObserver.observe(el));
  }

  function setupIdeaForm() {
    const form = document.getElementById('idea-form');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const name = String(data.get('name') || '').trim() || '匿名玩家';
      const idea = String(data.get('idea') || '').trim();
      if (!idea) return;
      const result = document.getElementById('idea-result');
      if (!result) return;
      const text = '来自 ' + name + ' 的建议：\n' + idea;
      result.hidden = false;
      result.dataset.copy = text;
      result.innerHTML =
        '<div class="idea-result__head"><span>SUGGESTION CARD / 本地生成</span><span>READY</span></div>' +
        '<p>' + escapeHtml(idea) + '</p>' +
        '<button type="button" class="idea-copy" id="copy-idea">复制建议卡</button>';
      result.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'center' });
    });
    document.addEventListener('click', (e) => {
      const btn = e.target.closest && e.target.closest('#copy-idea');
      if (!btn) return;
      const result = document.getElementById('idea-result');
      const text = result && result.dataset.copy;
      if (!text) return;
      const done = () => { btn.textContent = '✓ 已复制'; };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => {});
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (err) {}
        ta.remove();
      }
    });
  }

  /* ---------- 页面卡片 / 视频 / 文字特效 ---------- */
  const ORIGIN_ART = [
    ['snake', '为爱发电'],
    ['xiangqi', '没有广告'],
    ['solitaire', '无账号也存档'],
    ['tower', '一直加新游戏']
  ];
  const NEXT_ART = ['tetris', 'space', 'snake', 'pool', 'suika', 'tower'];

  function enhanceCards(view) {
    const chapters = [...view.querySelectorAll('.origin-chapter')];
    chapters.forEach((card, i) => {
      const pair = ORIGIN_ART[i];
      if (!pair) return;
      card.classList.add('liquid-card', 'tilt-card');
      card.style.setProperty('--card-bg', "url('/assets/img/games/" + pair[0] + "-bg.webp')");
      card.style.setProperty('--card-icon', "url('/assets/img/games/" + pair[0] + "-icon.webp')");
      if (!card.querySelector('.card-mark')) {
        const mark = document.createElement('span');
        mark.className = 'card-mark';
        mark.setAttribute('aria-hidden', 'true');
        mark.innerHTML = '<img src="/assets/img/games/' + pair[0] + '-icon.webp" alt="">';
        card.appendChild(mark);
      }
    });
    const items = [...view.querySelectorAll('.next-item')];
    items.forEach((card, i) => {
      const id = NEXT_ART[i];
      card.classList.add('liquid-card', 'tilt-card');
      if (id) {
        card.style.setProperty('--card-icon', "url('/assets/img/games/" + id + "-icon.webp')");
        if (!card.querySelector('.card-mark')) {
          const mark = document.createElement('span');
          mark.className = 'card-mark';
          mark.setAttribute('aria-hidden', 'true');
          mark.innerHTML = '<img src="/assets/img/games/' + id + '-icon.webp" alt="">';
          card.appendChild(mark);
        }
      }
    });
  }

  let cardVideoObserver = null;
  function setupNextVideo(view) {
    const items = [...view.querySelectorAll('.next-item')];
    if (!items.length) return;
    const mobile = document.documentElement.classList.contains('is-mobile');
    const conn = navigator.connection || {};
    const saveData = !!conn.saveData || /(^|-)(2g)$/.test(conn.effectiveType || '');
    /* 开了省流量：保留封面图，不下载视频 */
    if (saveData) {
      items.forEach((card) => card.classList.add('has-static-video'));
      return;
    }
    if (cardVideoObserver) cardVideoObserver.disconnect();
    const videos = items.map((card) => {
      if (card.querySelector('.next-card-video')) return { card, video: card.querySelector('.next-card-video') };
      const video = document.createElement('video');
      video.className = 'next-card-video';
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.autoplay = false;
      video.preload = mobile ? 'none' : 'metadata';
      video.poster = 'assets/video/future-poster.jpg';
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.setAttribute('aria-hidden', 'true');
      const src = document.createElement('source');
      src.src = 'assets/video/future.mp4';
      src.type = 'video/mp4';
      video.appendChild(src);
      card.prepend(video);
      card.classList.add('has-video');
      return { card, video };
    });
    /* 减少动效：只显示封面帧，不自动播放 */
    if (reduced.matches) return;
    if (!('IntersectionObserver' in window)) {
      videos.forEach(({ video }) => video.play().catch(() => {}));
      return;
    }
    cardVideoObserver = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const item = videos.find((v) => v.card === en.target);
        if (!item) return;
        if (en.isIntersecting) {
          if (item.video.preload === 'none') item.video.preload = 'metadata';
          item.video.play().catch(() => {});
        } else {
          item.video.pause();
        }
      });
    }, { threshold: 0.2 });
    videos.forEach(({ card }) => cardVideoObserver.observe(card));
  }

  let textObserver = null;
  function splitWords(el) {
    if (el.dataset.wordsplit) return;
    el.dataset.wordsplit = '1';
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    let count = 0;
    nodes.forEach((node) => {
      if (!node.nodeValue || !node.nodeValue.trim()) return;
      const frag = document.createDocumentFragment();
      const emit = (text) => {
        const word = document.createElement('span');
        word.className = 'word';
        word.style.setProperty('--d', String(count++));
        const inner = document.createElement('span');
        inner.className = 'word-in';
        inner.textContent = text;
        word.appendChild(inner);
        frag.appendChild(word);
      };
      node.nodeValue.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (!part.trim()) { frag.appendChild(document.createTextNode(part)); return; }
        /* 中文逐字拆开，英文按词拆开，避免长中文不换行横向溢出 */
        part.match(/[^\u3400-\u9fff]+|[\u3400-\u9fff]/g).forEach((piece) => { if (piece) emit(piece); });
      });
      if (node.parentNode) node.parentNode.replaceChild(frag, node);
    });
    el.classList.add('text-split');
  }

  function setupText(view) {
    if (textObserver) textObserver.disconnect();
    textObserver = null;
    const mobile = document.documentElement.classList.contains('is-mobile');
    const targets = view.querySelectorAll(mobile
      ? '.origin-manifesto h2, .origin-quote blockquote, .next-title span, .next-roadmap h2, .next-wish h2, .origin-chapter h3, .next-item h3'
      : '.origin-manifesto h2, .origin-quote blockquote, .origin-lead, .origin-copy, .origin-chapter h3, .next-title span, .next-roadmap h2, .next-wish h2, .next-lead, .next-note, .next-item h3');
    if (!targets.length) return;
    targets.forEach(splitWords);
    if (reduced.matches || !('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('text-in'));
      return;
    }
    textObserver = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('text-in');
          textObserver.unobserve(en.target);
        }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
    targets.forEach((el) => textObserver.observe(el));
  }

  function enhancePage() {
    const view = document.querySelector('#view-origin, #view-next');
    if (!view) return;
    enhanceCards(view);
    setupNextVideo(view);
    setupText(view);
  }

  /* 卡片 3D 侧面悬浮 */
  if (matchMedia('(pointer: fine)').matches) {
    document.addEventListener('pointermove', (e) => {
      const card = e.target.closest && e.target.closest('.tilt-card');
      if (!card) return;
      const r = card.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--rx', (-ny * 7).toFixed(2) + 'deg');
      card.style.setProperty('--ry', (nx * 9).toFixed(2) + 'deg');
      card.style.setProperty('--mx', ((nx + 0.5) * 100).toFixed(1) + '%');
      card.style.setProperty('--my', ((ny + 0.5) * 100).toFixed(1) + '%');
    }, { passive: true });
    document.addEventListener('pointerout', (e) => {
      const card = e.target.closest && e.target.closest('.tilt-card');
      if (!card || (e.relatedTarget && card.contains(e.relatedTarget))) return;
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    }, { passive: true });
  }

  /* 背景漂浮文字 / 水墨层 */
  function setupAmbient() {
    if (document.querySelector('.bg-float')) return;
    const float = document.createElement('div');
    float.className = 'bg-float';
    float.setAttribute('aria-hidden', 'true');
    float.innerHTML =
      '<span class="bg-word bg-word--1">PLAY</span>' +
      '<span class="bg-word bg-word--2">R`S GAME BOX</span>' +
      '<span class="bg-word bg-word--3">17</span>' +
      '<span class="bg-word bg-word--4">∞</span>';
    const ink = document.createElement('div');
    ink.className = 'bg-ink';
    ink.setAttribute('aria-hidden', 'true');
    document.body.append(float, ink);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function onRoute() {
    syncTabs();
    const poll = document.querySelectorAll('#view-next .poll-option');
    poll.forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        poll.forEach((b) => b.classList.remove('is-voted'));
        btn.classList.add('is-voted');
        const chosen = btn.querySelector('span')?.textContent || '';
        const result = document.getElementById('poll-result');
        if (result) result.textContent = '已记录你的选择：' + chosen + ' · 本地保存';
        try { localStorage.setItem('rgb.poll', btn.getAttribute('data-poll')); } catch (e) {}
      });
    });
    setupAmbient();
    setupPage();
    enhancePage();
    setupIdeaForm();
    /* 非游戏页自动收起底部播放器，避免遮挡正文；音乐继续播放 */
    if (routeOf(location.hash) !== 'games') {
      const player = document.getElementById('music-player');
      const toggle = document.getElementById('music-toggle');
      if (player) player.classList.add('is-collapsed');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }
  }
  window.addEventListener('hashchange', onRoute);
  onRoute();
})();
