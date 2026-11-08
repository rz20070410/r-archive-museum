/* ==========================================================================
   FX LAYER · vanilla JS port of React Bits-inspired effects
   Dust / LightRays mount / Cursor glow / Card glare / ClickSpark / Progress
   ========================================================================== */
(() => {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(pointer: fine)');
  const small = matchMedia('(max-width: 700px)');
  const app = document.getElementById('app');
  if (!app) return;

  /* ---------- Hero: light rays + orb ---------- */
  function mountHeroFX() {
    const hero = document.querySelector('.hero');
    if (!hero || hero.querySelector('.fx-rays')) return;
    const orb = document.createElement('div');
    orb.className = 'fx-orb';
    orb.setAttribute('aria-hidden', 'true');
    const rays = document.createElement('div');
    rays.className = 'fx-rays';
    rays.setAttribute('aria-hidden', 'true');
    hero.prepend(rays, orb);
  }
  mountHeroFX();
  new MutationObserver(mountHeroFX).observe(app, { childList: true, subtree: true });

  /* ---------- Scroll progress ---------- */
  const bar = document.createElement('div');
  bar.id = 'fx-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  function drawProgress() {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0) + ')';
  }
  addEventListener('scroll', drawProgress, { passive: true });
  addEventListener('resize', drawProgress);
  drawProgress();

  /* ---------- Pointer: card glare + cursor glow + hero parallax ---------- */
  if (!reduced.matches) {
    let pending = null, raf = 0;
    document.addEventListener('pointermove', (e) => {
      const target = e.target.closest && e.target.closest('.game-card, .music-player');
      if (!target) return;
      pending = { target, x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        if (!pending) return;
        const r = pending.target.getBoundingClientRect();
        pending.target.style.setProperty('--mx', (((pending.x - r.left) / r.width) * 100).toFixed(2) + '%');
        pending.target.style.setProperty('--my', (((pending.y - r.top) / r.height) * 100).toFixed(2) + '%');
      });
    }, { passive: true });

    const cursor = document.createElement('div');
    cursor.id = 'fx-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cursor);
    let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy, shown = false;
    addEventListener('pointermove', (e) => {
      tx = e.clientX; ty = e.clientY;
      if (!shown) { shown = true; cursor.classList.add('is-on'); }
    }, { passive: true });
    (function cursorLoop() {
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;
      cursor.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
      requestAnimationFrame(cursorLoop);
    })();

    addEventListener('pointermove', (e) => {
      const hero = document.querySelector('.hero');
      if (!hero) return;
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--hpx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      hero.style.setProperty('--hpy', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    }, { passive: true });
  }

  /* ---------- Ambient dust ---------- */
  const dust = document.createElement('canvas');
  dust.id = 'fx-dust';
  dust.setAttribute('aria-hidden', 'true');
  document.body.appendChild(dust);
  const dctx = dust.getContext('2d');
  let dw = 0, dh = 0, ddpr = 1, parts = [], px = innerWidth / 2, py = innerHeight / 2;

  function sizeDust() {
    ddpr = Math.min(devicePixelRatio || 1, 2);
    dw = innerWidth; dh = innerHeight;
    dust.width = Math.round(dw * ddpr);
    dust.height = Math.round(dh * ddpr);
    dctx.setTransform(ddpr, 0, 0, ddpr, 0, 0);
    const n = 60;
    parts = Array.from({ length: n }, () => ({
      x: Math.random() * dw,
      y: Math.random() * dh,
      r: 0.4 + Math.random() * 1.5,
      vx: (Math.random() - 0.5) * 0.12,
      vy: -0.05 - Math.random() * 0.18,
      a: 0.08 + Math.random() * 0.35
    }));
  }

  function drawDust() {
    dctx.clearRect(0, 0, dw, dh);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy;
      if (p.y < -10) { p.y = dh + 10; p.x = Math.random() * dw; }
      if (p.x < -10) p.x = dw + 10;
      if (p.x > dw + 10) p.x = -10;
      const dx = p.x - px, dy = p.y - py, d2 = dx * dx + dy * dy;
      if (d2 < 20000 && d2 > 0) {
        const f = (1 - d2 / 20000) * 0.18, d = Math.sqrt(d2);
        p.x += (dx / d) * f; p.y += (dy / d) * f;
      }
      dctx.beginPath();
      dctx.fillStyle = 'rgba(255,255,255,' + p.a + ')';
      dctx.arc(p.x, p.y, p.r, 0, 6.2832);
      dctx.fill();
    }
    requestAnimationFrame(drawDust);
  }

  if (!reduced.matches && !document.documentElement.classList.contains('is-mobile')) {
    sizeDust();
    addEventListener('resize', sizeDust);
    addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; }, { passive: true });
    drawDust();
  } else {
    dust.style.display = 'none';
  }

  /* ---------- Click sparks ---------- */
  const spark = document.createElement('canvas');
  spark.id = 'fx-spark';
  spark.setAttribute('aria-hidden', 'true');
  document.body.appendChild(spark);
  const sctx = spark.getContext('2d');
  let sw = 0, sh = 0, sdpr = 1, sparks = [], running = false;

  function sizeSpark() {
    sdpr = Math.min(devicePixelRatio || 1, 2);
    sw = innerWidth; sh = innerHeight;
    spark.width = Math.round(sw * sdpr);
    spark.height = Math.round(sh * sdpr);
    sctx.setTransform(sdpr, 0, 0, sdpr, 0, 0);
  }

  function runSparks() {
    if (!running) return;
    sctx.clearRect(0, 0, sw, sh);
    sctx.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= 0.016;
      if (p.life <= 0) { sparks.splice(i, 1); continue; }
      sctx.strokeStyle = 'rgba(255,255,255,' + (p.life * p.a) + ')';
      sctx.lineWidth = p.w;
      sctx.beginPath();
      sctx.moveTo(p.x, p.y);
      sctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
      sctx.stroke();
    }
    sctx.globalCompositeOperation = 'source-over';
    if (sparks.length) requestAnimationFrame(runSparks);
    else { running = false; sctx.clearRect(0, 0, sw, sh); }
  }

  function burst(x, y) {
    if (reduced.matches) return;
    if (!sw) sizeSpark();
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 4.5;
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 0.45 + Math.random() * 0.5, a: 0.55 + Math.random() * 0.45, w: 0.6 + Math.random() * 1.4 });
    }
    if (sparks.length > 180) sparks = sparks.slice(-180);
    if (!running) { running = true; requestAnimationFrame(runSparks); }
  }

  let trailAt=0;
  document.addEventListener('pointermove',e=>{
    if(false){trailAt=performance.now();burst(e.clientX,e.clientY);}
  },{passive:true});
  setInterval(()=>{
    if(true)return;
    const title=document.querySelector('.hero-title');if(!title)return;
    const r=title.getBoundingClientRect();
    if(r.bottom>0 && r.top<innerHeight)burst(r.left+Math.random()*r.width,r.top+r.height*.65);
  },1600);
  sizeSpark();
  addEventListener('resize', sizeSpark);
  /* 点击火花特效已移除（参考站要求） */
})();


/* ===== 第二批交互：滚动、涟漪、倾斜、播放器律动、防复制 ===== */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(pointer: fine)');
  const app = document.getElementById('app');
  if (!app) return;

  /* Hero 附加装饰：跑马灯 + 流星 */
  function mountHeroExtras() {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    if (!hero.querySelector('.fx-marquee')) {
      const m = document.createElement('div');
      m.className = 'fx-marquee';
      m.setAttribute('aria-hidden', 'true');
      m.innerHTML = '<span>R`s GAME BOX · 17 GAMES · PLAY · WIN · R`s GAME BOX · 17 GAMES · PLAY · WIN · </span>';
      hero.appendChild(m);
    }
    if (!hero.querySelector('.fx-meteor')) {
      for (let i = 0; i < 2; i++) {
        const s = document.createElement('i');
        s.className = 'fx-meteor';
        s.setAttribute('aria-hidden', 'true');
        s.style.setProperty('--mx', (12 + i * 46) + '%');
        s.style.setProperty('--md', (i * 4.5 + 1.5) + 's');
        hero.appendChild(s);
      }
    }
  }

  /* 滚动：进度视差 + 揭示 */
  function applyScroll() {
    const hero = document.querySelector('.hero');
    if (hero) hero.style.setProperty('--sy', Math.min(scrollY, 900).toFixed(0));
  }
  let scrollRaf = 0;
  addEventListener('scroll', () => {
    if (!scrollRaf) scrollRaf = requestAnimationFrame(() => { scrollRaf = 0; applyScroll(); });
  }, { passive: true });
  applyScroll();

  const revealObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) { en.target.classList.add('fx-in'); revealObserver.unobserve(en.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
    : null;

  function mountReveals() {
    if (reduced.matches || !revealObserver) return;
    const targets = document.querySelectorAll('.section-head, .toolbar');
    targets.forEach((el, i) => {
      if (el.classList.contains('fx-reveal')) return;
      el.classList.add('fx-reveal');
      el.setAttribute('data-fx-delay', String(i % 3));
      revealObserver.observe(el);
    });
  }

  function mountExtras() { mountHeroExtras(); mountReveals(); }
  mountExtras();
  new MutationObserver(mountExtras).observe(app, { childList: true, subtree: true });

  /* 播放器律动条 */
  function mountEQ() {
    const main = document.querySelector('.mp-main');
    if (!main || document.querySelector('.mp-eq')) return;
    const eq = document.createElement('div');
    eq.className = 'mp-eq';
    eq.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 14; i++) eq.appendChild(document.createElement('span'));
    main.after(eq);
  }
  mountEQ();
  new MutationObserver(mountEQ).observe(document.body, { childList: true, subtree: true });

  /* 点击涟漪 */
  document.addEventListener('pointerdown', (e) => {
    if (reduced.matches) return;
    const el = e.target.closest && e.target.closest('.game-card, .btn, .icon-btn, .back-btn, .mp-btn, .chip, .fav-btn, .rgb-controls button');
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dot = document.createElement('span');
    dot.className = 'fx-ripple';
    dot.style.left = (e.clientX - r.left) + 'px';
    dot.style.top = (e.clientY - r.top) + 'px';
    el.appendChild(dot);
    setTimeout(() => dot.remove(), 760);
  }, { passive: true });

  /* 禁止复制 / 右键 / 图片拖拽；输入框不受影响 */
  const allow = (t) => t && t.closest && t.closest('input,textarea,[contenteditable="true"]');
  ['copy', 'cut', 'contextmenu', 'dragstart'].forEach((type) => {
    document.addEventListener(type, (e) => {
      if (allow(e.target)) return;
      e.preventDefault();
    });
  });
})();
