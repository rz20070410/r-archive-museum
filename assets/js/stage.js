/* ==========================================================================
   R ARCHIVE · stage.js
   游戏舞台：iframe 承载旧版真实 #/play 游戏（embed 模式，关闭旧开场/播放器），
   可关闭、可重载、可全屏；桌面保留展签侧栏，手机全宽。
   ========================================================================== */
(function () {
  'use strict';

  var Museum = window.Museum;
  if (!Museum) return;
  var U = Museum.util;
  var ALL = ((window.MUSEUM_GAMES || {}).games || []);

  var state = {
    active: false,
    root: null,
    game: null,
    iframe: null,
    loadTimer: 0,
    slowTimer: 0,
    controller: null,
    onKey: null
  };

  function getGame(id) {
    return ALL.filter(function (g) { return g.id === id; })[0] || null;
  }

  function template(game) {
    var tags = (game.tags || []).map(function (t) { return U.esc(t); }).join(' / ');
    var controls = (game.controls || []).map(function (c) {
      return '<li><b>' + U.esc(c.keys) + '</b><span>' + U.esc(c.action) + '</span></li>';
    }).join('');
    var bg = game.bgArt ? 'style="--stage-bg:url(\'' + U.esc(new URL('assets/art/'+game.id+'.webp',document.baseURI).href) + '\')"' : '';
    return '' +
      '<section class="view view--stage" data-view="play" ' + bg + '>' +
        '<header class="stage-topbar">' +
          '<a class="stage-back" href="#/hall" id="stage-back"><i aria-hidden="true">←</i><span>返回展厅</span></a>' +
          '<div class="stage-title">' +
            '<p class="stage-title__kicker mono">NOW PLAYING&nbsp;/&nbsp;' + U.esc(game.id.toUpperCase()) + '&nbsp;/&nbsp;' + U.esc(tags) + '</p>' +
            '<h1 class="stage-title__name">' + U.esc(game.title) + '</h1>' +
          '</div>' +
          '<div class="stage-actions">' +
            '<span class="stage-badge mono">' + U.esc(game.difficulty || '中等') + '</span>' +
            '<button type="button" class="stage-btn" id="stage-reload" title="重新载入舞台" aria-label="重新载入舞台">↻</button>' +
            '<button type="button" class="stage-btn" id="stage-full" title="全屏" aria-label="全屏">⛶</button>' +
            '<button type="button" class="stage-close" id="stage-close" aria-label="关闭舞台，返回展厅">' +
              '<span>关闭舞台</span><i aria-hidden="true">✕</i>' +
            '</button>' +
          '</div>' +
        '</header>' +
        '<div class="stage-body">' +
          '<aside class="stage-rail" aria-label="展签与操作说明">' +
            '<p class="kicker">EXHIBIT&nbsp;LABEL</p>' +
            '<h2 class="stage-rail__sub">' + U.esc(game.subtitle || '') + '</h2>' +
            '<p class="stage-rail__desc">' + U.esc(game.description || '') + '</p>' +
            '<div class="stage-rail__block">' +
              '<p class="stage-rail__label mono">CONTROLS</p>' +
              '<ul class="stage-controls">' + (controls || '<li><b>鼠标 / 触控</b><span>直接操作</span></li>') + '</ul>' +
            '</div>' +
            (game.tips ? '<p class="stage-rail__tip">' + U.esc(game.tips) + '</p>' : '') +
            '<div class="stage-rail__meta">' +
              '<span class="mono">SAVE</span><p>成绩保存在本机浏览器 · 与旧档案互通</p>' +
            '</div>' +
            (game.source ? '<a class="stage-rail__source mono" href="' + U.esc(game.source) + '" target="_blank" rel="noopener">SOURCE / ' + U.esc(game.license || '') + '</a>' : '') +
            '<p class="stage-rail__fine mono">舞台内已关闭旧版开场与旧播放器；游戏本体完整复用，无重写。</p>' +
          '</aside>' +
          '<div class="stage-frame" id="stage-frame">' +
            '<div class="stage-loading" id="stage-loading" aria-live="polite">' +
              '<span class="mono">LOADING&nbsp;EXHIBIT&nbsp;/&nbsp;' + U.esc(game.id.toUpperCase()) + '</span>' +
              '<i aria-hidden="true"></i>' +
            '</div>' +
            '<iframe id="stage-iframe" class="stage-iframe" title="' + U.esc(game.title) + '游戏舞台" ' +
              'src="' + U.esc(game.playUrl) + '" ' +
              'allow="fullscreen; autoplay; gamepad; accelerometer; gyroscope; xr-spatial-tracking" ' +
              'allowfullscreen loading="eager"></iframe>' +
            '<div class="stage-note" id="stage-note" hidden>' +
              '<p>舞台载入时间较长。若一直空白，可能是浏览器阻止了本地 iframe。</p>' +
              '<button type="button" class="btn btn-line btn-sm" id="stage-retry">重新载入</button>' +
            '</div>' +
            '<div class="stage-hint" id="stage-hint">' +
              '<span>点击画面开始操作</span><span class="mono">ESC 关闭舞台</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>';
  }

  function setLoaded(ok) {
    var loading = document.getElementById('stage-loading');
    var frame = document.getElementById('stage-frame');
    var note = document.getElementById('stage-note');
    if (frame) frame.classList.add('is-loaded');
    if (loading) loading.classList.add('is-done');
    if (note) note.hidden = ok !== false;
  }

  function revealFrame() {
    var loading = document.getElementById('stage-loading');
    var frame = document.getElementById('stage-frame');
    if (frame) frame.classList.add('is-loaded');
    if (loading) loading.classList.add('is-done');
  }

  function reload() {
    var iframe = document.getElementById('stage-iframe');
    var loading = document.getElementById('stage-loading');
    var note = document.getElementById('stage-note');
    var frame = document.getElementById('stage-frame');
    if (!iframe) return;
    if (loading) { loading.classList.remove('is-done'); loading.hidden = false; }
    if (frame) frame.classList.remove('is-loaded');
    if (note) note.hidden = true;
    clearTimeout(state.loadTimer);
    clearTimeout(state.slowTimer);
    state.loadTimer = setTimeout(revealFrame, 1500);
    state.slowTimer = setTimeout(function () {
      if (!state.active) return;
      var f = document.getElementById('stage-frame');
      if (f && !f.classList.contains('is-loaded')) {
        var n = document.getElementById('stage-note');
        if (n) n.hidden = false;
      }
    }, 9000);
    try { iframe.src = iframe.src; } catch (e) {}
    if (state.iframe) state.iframe.onload = onFrameLoad;
  }

  function onFrameLoad() {
    clearTimeout(state.slowTimer);
    clearTimeout(state.loadTimer);
    var note = document.getElementById('stage-note');
    if (note) note.hidden = true;
    setTimeout(revealFrame, 220);
  }

  function toggleFullscreen() {
    var frame = document.getElementById('stage-frame');
    if (!frame) return;
    if (document.fullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen().catch(function () {});
    } else if (frame.requestFullscreen) {
      frame.requestFullscreen().catch(function () { Museum.toast('当前浏览器不支持全屏'); });
    } else {
      Museum.toast('当前浏览器不支持全屏');
    }
  }

  function syncFullscreen() {
    var btn = document.getElementById('stage-full');
    if (!btn) return;
    var on = !!document.fullscreenElement;
    btn.textContent = on ? '⤡' : '⛶';
    btn.title = on ? '退出全屏' : '全屏';
    btn.setAttribute('aria-label', btn.title);
  }

  function close() {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    }
    Museum.go('hall');
  }

  function mount(rootEl, params) {
    state.active = true;
    state.root = rootEl;
    state.controller = new AbortController();
    var signal = { signal: state.controller.signal };
    var game = getGame(params && params.id);
    if (!game) {
      rootEl.innerHTML = '<section class="view view--stage" data-view="play"><div class="stage-missing">' +
        '<p class="kicker">EXHIBIT / 404</p><h1>这件展品不在馆内</h1>' +
        '<a class="btn btn-line" href="#/hall">返回 360° 展厅</a></div></section>';
      return;
    }
    state.game = game;
    rootEl.innerHTML = template(game);
    state.iframe = document.getElementById('stage-iframe');

    if (state.iframe) {
      state.iframe.addEventListener('load', onFrameLoad);
      state.iframe.addEventListener('error', function () { setLoaded(false); });
    }
    state.loadTimer = setTimeout(revealFrame, 1800);
    state.slowTimer = setTimeout(function () {
      var frame = document.getElementById('stage-frame');
      if (frame && !frame.classList.contains('is-loaded')) {
        var note = document.getElementById('stage-note');
        if (note) note.hidden = false;
      }
    }, 9000);

    var back = document.getElementById('stage-back');
    var closeBtn = document.getElementById('stage-close');
    var reloadBtn = document.getElementById('stage-reload');
    var fullBtn = document.getElementById('stage-full');
    var retry = document.getElementById('stage-retry');
    var frame = document.getElementById('stage-frame');
    var hint = document.getElementById('stage-hint');

    [back, closeBtn].forEach(function (node) {
      if (!node) return;
      node.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        close();
      }, signal);
    });
    if (reloadBtn) reloadBtn.addEventListener('click', reload, signal);
    if (fullBtn) fullBtn.addEventListener('click', toggleFullscreen, signal);
    if (retry) retry.addEventListener('click', reload, signal);
    if (frame && hint) {
      frame.addEventListener('pointerdown', function () {
        hint.classList.add('is-hidden');
      }, signal);
      state.hintTimer = setTimeout(function () {
        if (hint) hint.classList.add('is-hidden');
      }, 6200);
    }

    state.onKey = function (e) {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', state.onKey);
    document.addEventListener('fullscreenchange', syncFullscreen);
    syncFullscreen();
  }

  function unmount() {
    state.active = false;
    clearTimeout(state.loadTimer);
    clearTimeout(state.slowTimer);
    clearTimeout(state.hintTimer);
    if (state.controller) state.controller.abort();
    if (state.iframe) {
      try { state.iframe.src = 'about:blank'; } catch (e) {}
      state.iframe = null;
    }
    if (state.onKey) document.removeEventListener('keydown', state.onKey);
    state.onKey = null;
    document.removeEventListener('fullscreenchange', syncFullscreen);
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
    state.root = null;
    state.game = null;
  }

  window.PlayStage = { mount: mount, unmount: unmount };
})();
