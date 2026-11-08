/* ==========================================================================
   R ARCHIVE · intro.js
   电影级启动序列：可跳过、每个会话只播一次、尊重减少动态。
   ========================================================================== */
(function () {
  'use strict';

  var Museum = window.Museum;
  if (!Museum) return;
  var U = Museum.util;
  var SEEN_KEY = 'intro.seen';

  var state = { active: false, node: null, timers: [] };

  function seen() {
    try { return window.sessionStorage.getItem('silver-arcade.' + SEEN_KEY) === '1'; }
    catch (e) { return false; }
  }
  function markSeen() {
    try { window.sessionStorage.setItem('silver-arcade.' + SEEN_KEY, '1'); } catch (e) {}
  }

  function canSkipAuto() {
    return Museum.env.reduced() || Museum.env.noIntro();
  }

  function clearTimers() {
    state.timers.forEach(function (t) { clearTimeout(t); });
    state.timers = [];
  }

  function build() {
    var node = document.createElement('div');
    node.className = 'intro';
    node.id = 'intro';
    node.setAttribute('role', 'dialog');
    node.setAttribute('aria-modal', 'true');
    node.setAttribute('aria-label', 'R-数字藏馆开场');
    node.innerHTML =
      '<div class="intro__scan" aria-hidden="true"></div>' +
      '<div class="intro__frame">' +
        '<div class="intro__top">' +
          '<span class="intro__brand">R ARCHIVE</span>' +
          '<span class="intro__code">BOOT&nbsp;SEQUENCE&nbsp;/&nbsp;001</span>' +
        '</div>' +
        '<div class="intro__center">' +
          '<p class="intro__kicker">数字世界启动</p>' +
          '<div class="intro__title" aria-hidden="true">' +
            '<span class="mask-line"><span>R —</span></span>' +
            '<span class="mask-line intro__serif"><span>数字藏馆</span></span>' +
          '</div>' +
          '<p class="intro__zh"><span>记忆</span><i></i><span>成形</span></p>' +
          '<div class="intro__progress" aria-hidden="true"><i></i></div>' +
        '</div>' +
        '<div class="intro__bottom">' +
          '<ul class="intro__log" aria-hidden="true">' +
            '<li>CRYSTAL CORE<span>折射晶体 · 就位</span></li>' +
            '<li>AURORA FIELD<span>极光冷雾 · 校准</span></li>' +
            '<li>23 EXHIBITS<span>可玩游戏藏品 · 封存</span></li>' +
          '</ul>' +
          '<button type="button" class="intro__skip" id="intro-skip">' +
            '<span>跳过开场</span><kbd>ESC</kbd>' +
          '</button>' +
        '</div>' +
        '<span class="intro__corner intro__corner--a" aria-hidden="true"></span>' +
        '<span class="intro__corner intro__corner--b" aria-hidden="true"></span>' +
      '</div>';
    const dust = document.createElement('div'); dust.className='boot-dust'; dust.setAttribute('aria-hidden','true');
    for(let i=0;i<88;i++){const mote=document.createElement('i');mote.style.cssText='--x:'+Math.cos(i*2.4)*Math.sqrt(i/88)*58+'vw;--y:'+Math.sin(i*2.4)*Math.sqrt(i/88)*65+'vh;--delay:'+(i%11)*34+'ms';dust.append(mote)} node.prepend(dust);
    document.body.appendChild(node);
    return node;
  }

  function finish(instant) {
    if (!state.active) return;
    state.active = false;
    clearTimers();
    var node = state.node;
    markSeen();
    Museum.lockScroll(false);
    document.body.classList.remove('intro-active');
    document.body.classList.add('intro-done');
    if (!node) {
      Museum.events.emit('intro:done');
      return;
    }
    node.classList.add('is-out');
    var wait = instant || Museum.env.reduced() ? 20 : 900;
    window.setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
      if (state.node === node) state.node = null;
      Museum.events.emit('intro:done');
    }, wait);
  }

  function startSteps() {
    var node = state.node;
    if (!node) return;
    node.classList.add('is-live');
    var steps = 2250;
    [420, 1080, 1720].forEach(function (delay, i) {
      state.timers.push(setTimeout(function () {
        if (!node) return;
        node.classList.add('is-step-' + (i + 1));
        var log = node.querySelectorAll('.intro__log li');
        if (log[i]) log[i].classList.add('is-on');
      }, delay));
    });
    state.timers.push(setTimeout(function () { finish(false); }, steps));
  }

  function play(force) {
    if (state.active) return true;
    if (!force && (seen() || canSkipAuto())) {
      document.body.classList.add('intro-done');
      markSeen();
      Museum.events.emit('intro:done');
      return false;
    }
    if (force) {
      try { window.sessionStorage.removeItem('silver-arcade.' + SEEN_KEY); } catch (e) {}
    }
    state.active = true;
    state.node = build();
    Museum.lockScroll(true);
    document.body.classList.add('intro-active');
    document.body.classList.remove('intro-done');
    Museum.events.emit('intro:start');
    var skip = document.getElementById('intro-skip');
    if (skip) {
      skip.addEventListener('click', function () { finish(true); });
      state.timers.push(setTimeout(function () { try { skip.focus({ preventScroll: true }); } catch (e) {} }, 50));
    }
    if (Museum.env.reduced()) {
      state.timers.push(setTimeout(function () { finish(true); }, 260));
    } else {
      requestAnimationFrame(function () {
        if (state.node) state.node.classList.add('is-live');
        startSteps();
      });
    }
    return true;
  }

  document.addEventListener('keydown', function (e) {
    if (!state.active) return;
    if (e.key === 'Escape' || e.code === 'Escape') {
      e.preventDefault();
      finish(true);
    }
  }, { capture: true });

  Museum.intro = {
    play: play,
    skip: function () { finish(true); },
    isActive: function () { return state.active; },
    isSeen: seen
  };

  /* 页面首次载入：首页才播放，深入路由直接看内容 */
  Museum.events.on('boot:ready', function (payload) {
    if (!payload || payload.view !== 'home') {
      document.body.classList.add('intro-done');
      return;
    }
    play(false);
  });
})();
