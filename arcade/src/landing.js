/* ==========================================================================
   LANDING LAYER · video hero + kinetic scroll narrative
   ========================================================================== */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const app = document.getElementById('app');
  if (!app) return;

  const tickerItems = '<span>R&#96;s GAME BOX</span><i>✦</i><span>23 GAMES</span><i>✦</i><span>PLAY FOREVER</span><i>✦</i><span>NO INSTALL</span><i>✦</i><span>ONE BOX</span><i>✦</i>';
  const storyHtml = `
    <section class="landing-manifesto" data-landing>
      <div class="lm-sticky">
        <p class="lm-eyebrow">R&#96;s GAME BOX — VOL. 01 / 2026</p>
        <h2 class="lm-title"><span>PLAY</span><span>COMPETE</span><span>REPEAT</span></h2>
        <div class="lm-foot">
          <p>23 款小游戏，一个盒子。<br>没有安装，没有多余步骤。</p>
          <span>SCROLL TO EXPLORE ↓</span>
        </div>
      </div>
    </section>
    <div class="landing-ticker" aria-hidden="true"><div class="landing-ticker-track">${tickerItems}${tickerItems}</div></div>
    <section class="landing-statement" data-landing>
      <p class="ls-index">01 / THE BOX</p>
      <h2>SMALL GAMES.<br><em>BIG REPLAYS.</em></h2>
      <p class="ls-copy">从贪吃蛇、俄罗斯方块，到中国象棋、塔防与纸牌接龙。经典玩法被重新装进同一个盒子，随时打开，随时开一局。</p>
    </section>
    <section class="landing-select" data-landing>
      <p class="ls-index">02 / LIBRARY</p>
      <h2>SELECT<br><em>YOUR GAME</em></h2>
      <p class="ls-copy">向下滚动，下面是你的游戏卡选择界面。</p>
    </section>`;

  function ensureGrain() {
    if (document.querySelector('.landing-grain')) return;
    const g = document.createElement('div');
    g.className = 'landing-grain';
    g.setAttribute('aria-hidden', 'true');
    document.body.appendChild(g);
  }

  function mountHero(hero) {
    if (!hero || hero.classList.contains('landing-hero')) return;
    hero.classList.add('landing-hero');
    const mobile = document.documentElement.classList.contains('is-mobile');
    const conn = navigator.connection || {};
    /* 只在"明确省流量"或 2G 时退回封面帧；3G/4G/WiFi 都加载视频 */
    const thin = !!conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');

    const video = document.createElement('video');
    video.className = 'landing-video';
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.autoplay = false;
    video.preload = mobile ? 'none' : 'metadata';
    video.poster = 'assets/video/hero-poster.jpg';
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('aria-hidden', 'true');
    const src = document.createElement('source');
    src.src = 'assets/video/hero.mp4';
    src.type = 'video/mp4';
    video.appendChild(src);

    const shade = document.createElement('div');
    shade.className = 'landing-shade';
    shade.setAttribute('aria-hidden', 'true');
    /* 手机也挂载视频：省流量/弱网/减少动效时只留封面帧 */
    if (!thin) hero.prepend(video);
    hero.prepend(shade);

    const kicker = document.createElement('div');
    kicker.className = 'landing-kicker';
    kicker.innerHTML = '<span>R&#96;s GAME BOX</span><span>VOL. 01 / PLAY WITHOUT LIMITS</span>';
    hero.appendChild(kicker);

    const cue = document.createElement('a');
    cue.className = 'landing-cue';
    cue.href = '#games';
    cue.innerHTML = '<span>下滑查看更多</span><i aria-hidden="true"></i>';
    cue.addEventListener('click', (e) => {
      const target = document.getElementById('games');
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
    });
    hero.appendChild(cue);

    if (thin || reduced.matches) return;
    if (!('IntersectionObserver' in window)) {
      video.play().catch(() => {});
      return;
    }
    /* 只在这个 Hero 进入视口时播放，滚走就暂停；离开页面时自动停止 */
    const heroObserver = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.target.isConnected) { heroObserver.disconnect(); return; }
        if (en.isIntersecting) {
          if (video.preload === 'none') video.preload = 'metadata';
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.12 });
    heroObserver.observe(hero);
  }

  let revealObserver = null;
  function observeReveal() {
    if (!('IntersectionObserver' in window)) return;
    if (!revealObserver) {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('in');
            revealObserver.unobserve(en.target);
          }
        });
      }, { threshold: 0.18 });
    }
    document.querySelectorAll('.landing-statement, .landing-select').forEach((el) => {
      if (!el.classList.contains('in')) revealObserver.observe(el);
    });
  }

  function mount() {
    const hub = document.querySelector('#view-hub');
    if (!hub) {
      document.body.classList.remove('has-landing');
      return;
    }
    const hero = hub.querySelector('.hero');
    mountHero(hero);

    const head = hub.querySelector('.section-head');
    if (head && !hub.querySelector('.landing-inserted')) {
      const wrap = document.createElement('div');
      wrap.className = 'landing-inserted';
      wrap.innerHTML = storyHtml;
      head.before(wrap);
    }
    document.body.classList.add('has-landing');
    ensureGrain();
    observeReveal();
  }

  let scrollRaf = 0;
  function updateScroll() {
    scrollRaf = 0;
    const hero = document.querySelector('.landing-hero');
    if (hero) {
      const p = Math.min(1, Math.max(0, scrollY / Math.max(1, innerHeight)));
      hero.style.setProperty('--lp', p.toFixed(3));
      const video = hero.querySelector('.landing-video');
      if (video && !reduced.matches) {
        video.style.transform = 'translate3d(0,' + (p * 7).toFixed(2) + '%,0) scale(' + (1.04 + p * 0.06).toFixed(3) + ')';
      }
    }
    document.querySelectorAll('.landing-manifesto').forEach((sec) => {
      const r = sec.getBoundingClientRect();
      const total = Math.max(1, r.height - innerHeight);
      const p = Math.min(1, Math.max(0, -r.top / total));
      sec.style.setProperty('--p', p.toFixed(3));
    });
  }
  addEventListener('scroll', () => {
    if (!scrollRaf) scrollRaf = requestAnimationFrame(updateScroll);
  }, { passive: true });
  addEventListener('resize', updateScroll);
  updateScroll();

  new MutationObserver(mount).observe(app, { childList: true, subtree: true });
  mount();
})();
