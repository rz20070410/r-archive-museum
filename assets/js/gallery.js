/* ==========================================================================
   R ARCHIVE · gallery.js
   360° 游戏展厅：CSS 3D 圆柱、拖动/滚轮/键盘/触控旋转、搜索与收藏、
   圆环/网格双视图、展品详情展开、旧存档成绩复用。
   ========================================================================== */
(function () {
  'use strict';

  var Museum = window.Museum;
  if (!Museum) return;
  var U = Museum.util;
  var DATA = window.MUSEUM_GAMES || { games: [], tags: [] };
  var ALL = (DATA.games || []).slice();
  var ALL_TAGS = DATA.tags || [];
  var FAV_KEY = 'favorites';

  var state = {
    active: false,
    root: null,
    query: '',
    tag: '全部',
    favOnly: false,
    mode: 'ring',
    filtered: [],
    index: 0,
    rot: 0,
    targetRot: 0,
    dragging: false,
    dragX: 0,
    dragMoved: 0,
    velocity: 0,
    lastX: 0,
    lastT: 0,
    raf: 0,
    lastPaintRot: 999,
    paintedIndex: -1,
    cards: [],
    step: 15.652,
    radius: 900,
    cardW: 220,
    detailId: null,
    detailEl: null,
    detailKeyHandler: null,
    lastFocus: null,
    controller: null,
    wheelLock: 0,
    needsPaint: true
  };

  /* ------------------------------------------------------------------ */
  /* 收藏与旧存档                                                       */
  /* ------------------------------------------------------------------ */
  function readLegacy(key) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw == null ? null : JSON.parse(raw);
    } catch (e) { return null; }
  }

  function favorites() {
    var list = Museum.store.get(FAV_KEY, null);
    if (!Array.isArray(list)) {
      var legacy = readLegacy('neon-arcade.favorites');
      list = Array.isArray(legacy) ? legacy.filter(function (id) {
        return ALL.some(function (g) { return g.id === id; });
      }) : [];
      Museum.store.set(FAV_KEY, list);
    }
    return list.slice();
  }
  function isFav(id) { return favorites().indexOf(id) >= 0; }
  function toggleFav(id) {
    var list = favorites();
    var i = list.indexOf(id);
    var added = i < 0;
    if (added) list.push(id); else list.splice(i, 1);
    Museum.store.set(FAV_KEY, list);
    Museum.events.emit('favorites:change', { id: id, added: added });
    return added;
  }
  function bestScore(id) {
    var raw = readLegacy('neon-arcade.best.' + id);
    var n = typeof raw === 'number' ? raw : Number(raw);
    return isFinite(n) && n > 0 ? n : 0;
  }
  function getGame(id) {
    return ALL.filter(function (g) { return g.id === id; })[0] || null;
  }

  /* ------------------------------------------------------------------ */
  /* 模板                                                               */
  /* ------------------------------------------------------------------ */
  function chipsHtml() {
    var html = '<button type="button" class="hall-chip' + (state.tag === '全部' && !state.favOnly ? ' is-active' : '') +
      '" data-tag="全部" aria-pressed="' + (state.tag === '全部' && !state.favOnly) + '">全部' +
      '<span>' + ALL.length + '</span></button>';
    ALL_TAGS.forEach(function (tag) {
      var n = ALL.filter(function (g) { return (g.tags || []).indexOf(tag) >= 0; }).length;
      var active = state.tag === tag && !state.favOnly;
      html += '<button type="button" class="hall-chip' + (active ? ' is-active' : '') +
        '" data-tag="' + U.esc(tag) + '" aria-pressed="' + active + '">' + U.esc(tag) +
        '<span>' + n + '</span></button>';
    });
    html += '<button type="button" class="hall-chip hall-chip--fav' + (state.favOnly ? ' is-active' : '') +
      '" data-fav-filter="1" aria-pressed="' + state.favOnly + '">★ 收藏<span>' + favorites().length + '</span></button>';
    return html;
  }

  function template() {
    return '' +
      '<section class="view view--hall" data-view="hall">' +
        '<header class="hall-head">' +
          '<p class="kicker kicker--ice">02 / THE 360° HALL</p>' +
          '<div class="hall-head__row">' +
            '<h1 class="hall-head__title display">' +
              '<span class="mask-line"><span>展厅</span></span>' +
              '<em class="hall-head__en">THE ROTATING HALL</em>' +
            '</h1>' +
            '<p class="hall-head__count mono"><b id="hall-visible">' + ALL.length + '</b>&nbsp;/&nbsp;' + ALL.length + ' EXHIBITS</p>' +
          '</div>' +
          '<p class="hall-head__lede lede">拖动、滚轮或方向键转动圆环；点击正前方的展品，打开它的金属与玻璃空间。' +
            '所有游戏都完整保留在本馆的旧档案里，随时可以进入。</p>' +
        '</header>' +

        '<div class="hall-toolbar">' +
          '<div class="hall-search" id="hall-search-wrap">' +
            '<svg class="hall-search__icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">' +
              '<circle cx="8.6" cy="8.6" r="5.6" stroke="currentColor" stroke-width="1.1"/>' +
              '<path d="M13 13l4 4" stroke="currentColor" stroke-width="1.1"/></svg>' +
            '<input id="hall-search" type="search" placeholder="搜索展品、类型…（按 / 聚焦）" autocomplete="off" spellcheck="false" aria-label="搜索游戏展品">' +
            '<button type="button" class="hall-search__clear" id="hall-search-clear" aria-label="清空搜索">✕</button>' +
          '</div>' +
          '<div class="hall-chips" id="hall-chips" role="group" aria-label="按类型筛选">' + chipsHtml() + '</div>' +
          '<div class="hall-modes" role="group" aria-label="视图切换">' +
            '<button type="button" class="hall-mode is-active" data-mode="ring" aria-pressed="true">圆环</button>' +
            '<button type="button" class="hall-mode" data-mode="grid" aria-pressed="false">网格</button>' +
          '</div>' +
        '</div>' +

        '<div class="hall-stage" id="hall-stage" tabindex="0" role="region" aria-roledescription="3D 圆柱展厅" aria-label="360 度游戏展厅：拖动、滚轮或左右方向键旋转，回车查看当前展品">' +
          '<div class="hall-stage__topline mono" aria-hidden="true">' +
            '<span>ROTATING COLLECTION</span><span>DEG 360 / LIVE</span>' +
          '</div>' +
          '<div class="hall-fog hall-fog--left" aria-hidden="true"></div>' +
          '<div class="hall-fog hall-fog--right" aria-hidden="true"></div>' +
          '<div class="hall-ring" id="hall-ring">' +
            '<div class="hall-track" id="hall-track"></div>' +
          '</div>' +
          '<div class="hall-floor" aria-hidden="true"></div>' +
          '<button type="button" class="hall-arrow hall-arrow--prev" id="hall-prev" aria-label="上一个展品">←</button>' +
          '<button type="button" class="hall-arrow hall-arrow--next" id="hall-next" aria-label="下一个展品">→</button>' +
          '<div class="hall-counter mono" aria-hidden="true"><span id="hall-position">01</span> / <b id="hall-total">' + ALL.length + '</b></div>' +
          '<p class="hall-hint mono" aria-hidden="true">DRAG&nbsp;·&nbsp;←&nbsp;→&nbsp;·&nbsp;WHEEL&nbsp;·&nbsp;ENTER</p>' +
          '<div class="hall-empty" id="hall-empty" hidden>' +
            '<span class="hall-empty__icon" aria-hidden="true">◇</span>' +
            '<h3>没有符合条件的展品</h3>' +
            '<p>换一个关键词，或清空筛选条件再看看。</p>' +
            '<button type="button" class="btn btn-line btn-sm" id="hall-reset">清空筛选</button>' +
          '</div>' +
        '</div>' +

        '<div class="hall-grid" id="hall-grid" hidden></div>' +

        '<div class="hall-panel" id="hall-panel"></div>' +
      '</section>';
  }

  /* ------------------------------------------------------------------ */
  /* 数据筛选                                                           */
  /* ------------------------------------------------------------------ */
  function applyFilters() {
    var q = state.query.toLowerCase().trim();
    state.filtered = ALL.filter(function (g) {
      if (state.favOnly && !isFav(g.id)) return false;
      if (state.tag !== '全部' && (g.tags || []).indexOf(state.tag) < 0) return false;
      if (q) {
        var hay = [g.title, g.subtitle, g.description, g.difficulty, (g.tags || []).join(' ')]
          .join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    var visibleEl = document.getElementById('hall-visible');
    if (visibleEl) visibleEl.textContent = String(state.filtered.length);
    var totalEl = document.getElementById('hall-total');
    if (totalEl) totalEl.textContent = String(state.filtered.length);
    var empty = document.getElementById('hall-empty');
    var stage = document.getElementById('hall-stage');
    var gridEl = document.getElementById('hall-grid');
    var noResults = state.filtered.length === 0;
    if (empty) empty.hidden = !noResults;
    var ring = document.getElementById('hall-ring');
    if (ring) ring.style.visibility = noResults ? 'hidden' : '';
    if (gridEl) gridEl.hidden = state.mode !== 'grid' || noResults;
    if (stage) stage.hidden = state.mode === 'grid' || noResults;
    if (noResults) {
      var panel = document.getElementById('hall-panel');
      if (panel) panel.innerHTML = '';
      return;
    }
    var keepId = state.filtered[state.index] ? state.filtered[state.index].id : null;
    buildRing(keepId);
    if (state.mode === 'grid') buildGrid();
    else buildGrid();
    updatePanel();
  }

  /* ------------------------------------------------------------------ */
  /* 圆环                                                               */
  /* ------------------------------------------------------------------ */
  function buildRing(keepId) {
    var track = document.getElementById('hall-track');
    if (!track) return;
    var list = state.filtered;
    if (keepId) {
      var found = -1;
      list.forEach(function (g, i) { if (g.id === keepId) found = i; });
      state.index = found >= 0 ? found : 0;
    } else {
      state.index = 0;
    }
    track.innerHTML = list.map(function (g, i) {
      var fav = isFav(g.id);
      return '<button type="button" class="hall-card' + (fav ? ' is-fav' : '') + '" data-id="' + U.esc(g.id) +
        '" data-index="' + i + '" style="--i:' + i + '" tabindex="-1" ' +
        'aria-label="第 ' + (i + 1) + ' 件展品：' + U.esc(g.title) + '，' + U.esc((g.tags || []).join('、')) + '。按回车查看详情">' +
        '<span class="hall-card__glow" aria-hidden="true"></span>' +
        '<span class="hall-card__frame">' +
          '<span class="hall-card__cover">' + Museum.coverHtml(g) + '</span>' +
          '<span class="hall-card__plate">' +
            '<span class="hall-card__num mono">' + U.pad2(i + 1) + '</span>' +
            '<span class="hall-card__title">' + U.esc(g.title) + '</span>' +
            '<span class="hall-card__meta mono">' + U.esc((g.tags || [])[0] || 'COLLECTION') + '</span>' +
          '</span>' +
          '<span class="hall-card__edge" aria-hidden="true"></span>' +
        '</span>' +
        '<span class="hall-card__fav" aria-hidden="true">★</span>' +
      '</button>';
    }).join('');
    state.cards = U.$$('.hall-card', track);
    state.index = U.clamp(state.index, 0, Math.max(0, list.length - 1));
    geometry();
    state.rot = -state.index * state.step;
    state.targetRot = state.rot;
    paintRing(true);
    updateTabindex();
    updatePanel();
    state.needsPaint = true;
  }

  function geometry() {
    var ring = document.getElementById('hall-ring');
    var stage = document.getElementById('hall-stage');
    if (!ring || !stage) return;
    var n = Math.max(1, state.filtered.length);
    var vw = window.innerWidth;
    var mobile = vw <= 820;
    var stageW = stage.clientWidth || vw;
    var cardW = mobile
      ? U.clamp(vw * 0.5, 168, 216)
      : U.clamp(stageW * 0.155, 178, 252);
    var step = 360 / n;
    var radius = (cardW * 1.08) / (2 * Math.tan(Math.PI / n));
    radius = Math.max(radius, mobile ? 420 : 660);
    state.step = step;
    state.cardW = cardW;
    state.radius = radius;
    const transforms = getCarouselCellTransforms(state.cards.length,radius);
    state.cards.forEach((card,i)=>card.style.transform=transforms[i]);
    ring.style.setProperty('--card-w', cardW.toFixed(1) + 'px');
    ring.style.setProperty('--step', step.toFixed(4) + 'deg');
    ring.style.setProperty('--radius', radius.toFixed(1) + 'px');
    ring.style.setProperty('--count', String(n));
    state.lastPaintRot = 999;
    state.paintedIndex = -1;
  }

  function normalizeDeg(d) {
    return ((d % 360) + 540) % 360 - 180;
  }

  function selectedIndex() {
    var n = state.filtered.length;
    if (!n) return 0;
    return ((Math.round(-state.rot / state.step) % n) + n) % n;
  }

  function paintRing(force) {
    var track = document.getElementById('hall-track');
    if (!track) return;
    if (!force && Math.abs(state.rot - state.lastPaintRot) < 0.008 && state.paintedIndex === state.index) return;
    state.lastPaintRot = state.rot;
    state.paintedIndex = state.index;
    track.style.setProperty('--rot', state.rot.toFixed(3) + 'deg');
    var visible = state.cards;
    for (var i = 0; i < visible.length; i++) {
      var card = visible[i];
      var delta = Math.abs(normalizeDeg(i * state.step + state.rot));
      var o = U.clamp(1 - delta / (state.step * 7.4), 0.1, 1);
      card.style.opacity = o.toFixed(3);
      card.style.zIndex = String(1000 - Math.round(delta));
      card.classList.toggle('is-current', i === state.index);
      card.tabIndex = i === state.index ? 0 : -1;
    }
  }

  function updateTabindex() {
    state.cards.forEach(function (c, i) { c.tabIndex = i === state.index ? 0 : -1; });
  }

  function goToIndex(target, silent) {
    var n = state.filtered.length;
    if (!n) return;
    var idx = ((target % n) + n) % n;
    state.index = idx;
    var base = -idx * state.step;
    var current = state.rot;
    while (base - current > 180) base -= 360;
    while (base - current < -180) base += 360;
    state.targetRot = base;
    if (Museum.env.reduced()) {
      state.rot = state.targetRot;
      paintRing(true);
    }
    if (!silent) updatePanel();
    updateTabindex();
    state.needsPaint = true;
  }

  function nearestSnap() {
    var n = state.filtered.length;
    if (!n) return;
    var idx = ((Math.round(-state.rot / state.step) % n) + n) % n;
    state.index = idx;
    var base = -idx * state.step;
    while (base - state.rot > 180) base -= 360;
    while (base - state.rot < -180) base += 360;
    state.targetRot = base;
    updatePanel();
    updateTabindex();
  }

  function loop() {
    if (!state.active) return;
    state.raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    var prev = state.rot;
    if (!state.dragging) {
      state.rot = U.damp(state.rot, state.targetRot, Museum.env.reduced() ? 100 : 7.5, 1 / 60);
      if (Math.abs(state.targetRot - state.rot) < 0.01) state.rot = state.targetRot;
    }
    if (Math.abs(state.rot - prev) > 0.0005) {
      paintRing(false);
      var idx = selectedIndex();
      if (idx !== state.index) { state.index = idx; updateTabindex(); updatePanel(); }
    }
  }

  /* ------------------------------------------------------------------ */
  /* 网格视图                                                           */
  /* ------------------------------------------------------------------ */
  function buildGrid() {
    var grid = document.getElementById('hall-grid');
    if (!grid) return;
    grid.hidden = state.mode !== 'grid';
    if (state.mode !== 'grid') return;
    grid.innerHTML = state.filtered.map(function (g, i) {
      var fav = isFav(g.id);
      return '<button type="button" class="hall-grid__card' + (fav ? ' is-fav' : '') + '" data-id="' + U.esc(g.id) + '" ' +
        'style="--i:' + (i % 12) + '">' +
        '<span class="hall-grid__cover">' + Museum.coverHtml(g) + '</span>' +
        '<span class="hall-grid__plate">' +
          '<span class="hall-grid__num mono">' + U.pad2(i + 1) + '</span>' +
          '<span class="hall-grid__title">' + U.esc(g.title) + '</span>' +
          '<span class="hall-grid__meta mono">' + U.esc((g.tags || []).join(' · ')) + '</span>' +
        '</span>' +
        '<span class="hall-grid__fav" aria-hidden="true">★</span>' +
      '</button>';
    }).join('');
  }

  function setMode(mode) {
    state.mode = mode;
    Museum.store.set('hall.view', mode);
    var stage = document.getElementById('hall-stage');
    var grid = document.getElementById('hall-grid');
    var panel = document.getElementById('hall-panel');
    U.$$('.hall-mode').forEach(function (b) {
      var active = b.getAttribute('data-mode') === mode;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    if (mode === 'grid') {
      if (stage) stage.hidden = true;
      buildGrid();
      if (panel) panel.classList.add('is-panel--grid');
    } else {
      if (grid) grid.hidden = true;
      if (stage) stage.hidden = state.filtered.length === 0;
      if (panel) panel.classList.remove('is-panel--grid');
      paintRing(true);
    }
    updatePanel();
    Museum.toast(mode === 'grid' ? '网格视图 · 点击展品查看详情' : '360° 圆环视图 · 拖动旋转');
  }

  /* ------------------------------------------------------------------ */
  /* 选中信息面板                                                       */
  /* ------------------------------------------------------------------ */
  function updatePanel() {
    var panel = document.getElementById('hall-panel');
    if (!panel) return;
    var g = state.filtered[state.index];
    var pos = document.getElementById('hall-position');
    if (pos) pos.textContent = g ? U.pad2(state.index + 1) : '00';
    if (!g) { panel.innerHTML = ''; return; }
    var fav = isFav(g.id);
    var best = bestScore(g.id);
    var controls = (g.controls || []).map(function (c) {
      return '<span class="hall-panel__key"><b>' + U.esc(c.keys) + '</b>' + U.esc(c.action) + '</span>';
    }).join('');
    panel.innerHTML =
      '<div class="hall-panel__cover">' + Museum.coverHtml(g) + '</div>' +
      '<div class="hall-panel__body">' +
        '<p class="hall-panel__index mono">EXHIBIT&nbsp;' + U.pad2(state.index + 1) + '&nbsp;/&nbsp;' + U.pad2(state.filtered.length) +
          '&nbsp;&nbsp;·&nbsp;&nbsp;' + U.esc(g.difficulty || '中等') + '</p>' +
        '<h2 class="hall-panel__title cn-title">' + U.esc(g.title) + '</h2>' +
        '<p class="hall-panel__sub">' + U.esc(g.subtitle || '') + '</p>' +
        '<div class="hall-panel__tags">' +
          (g.tags || []).map(function (t) { return '<span>' + U.esc(t) + '</span>'; }).join('') +
          (best ? '<span class="hall-panel__best mono">最佳 ' + U.formatNumber(best) + '</span>' : '') +
        '</div>' +
        (controls ? '<div class="hall-panel__keys">' + controls + '</div>' : '') +
      '</div>' +
      '<div class="hall-panel__actions">' +
        '<button type="button" class="btn btn-line btn-sm" data-detail="' + U.esc(g.id) + '">查看展品 <i aria-hidden="true">↗</i></button>' +
        '<a class="btn btn-solid btn-sm" href="#/play/' + encodeURIComponent(g.id) + '">进入游戏 <i aria-hidden="true">▶</i></a>' +
        '<button type="button" class="hall-panel__fav' + (fav ? ' is-fav' : '') + '" data-panel-fav="' + U.esc(g.id) + '" ' +
          'aria-pressed="' + fav + '" aria-label="' + (fav ? '取消收藏' : '收藏') + ' ' + U.esc(g.title) + '">' + (fav ? '★' : '☆') + '</button>' +
      '</div>';
  }

  /* ------------------------------------------------------------------ */
  /* 展品详情                                                           */
  /* ------------------------------------------------------------------ */
  function detailHtml(g, cardRect) {
    var idx = state.filtered.indexOf(g);
    var best = bestScore(g.id);
    var fav = isFav(g.id);
    var controls = (g.controls || []).filter(function (c) { return c && c.keys; });
    return '<div class="hall-detail__backdrop" data-detail-close="1"></div>' +
      '<div class="hall-detail__panel" role="document">' +
        '<button type="button" class="hall-detail__close" data-detail-close="1" aria-label="关闭展品详情">' +
          '<span aria-hidden="true">✕</span>' +
        '</button>' +
        '<div class="hall-detail__art" id="detail-art">' +
          '<div class="hall-detail__ambient" aria-hidden="true" ' +
            (g.bgArt ? 'style="background-image:url(\'' + U.esc(g.bgArt) + '\')"' : '') + '></div>' +
          '<span class="hall-detail__seal mono">EXHIBIT&nbsp;/&nbsp;' + U.pad2(idx + 1) + '&nbsp;OF&nbsp;' + U.pad2(state.filtered.length) + '</span>' +
          '<div class="hall-detail__cover">' + Museum.coverHtml(g) + '</div>' +
          '<span class="hall-detail__artcaption mono">' + U.esc(g.subtitle || '') + '</span>' +
        '</div>' +
        '<div class="hall-detail__info">' +
          '<p class="kicker">' + U.esc((g.tags || []).join(' / ')) + '&nbsp;&nbsp;·&nbsp;&nbsp;' + U.esc(g.difficulty || '中等') + '</p>' +
          '<h2 class="hall-detail__title display" id="detail-title">' +
            '<span class="mask-line"><span>' + U.esc(g.title) + '</span></span>' +
          '</h2>' +
          '<p class="hall-detail__sub">' + U.esc(g.subtitle || '') + '</p>' +
          '<p class="hall-detail__desc">' + U.esc(g.description || '') + '</p>' +
          (g.tips ? '<p class="hall-detail__tip"><span class="mono">TIP</span>' + U.esc(g.tips) + '</p>' : '') +
          '<dl class="hall-detail__facts">' +
            '<div><dt class="mono">CONTROLS</dt><dd>' +
              (controls.length ? controls.map(function (c) { return '<span><b>' + U.esc(c.keys) + '</b>' + U.esc(c.action) + '</span>'; }).join('') : '<span>鼠标 / 触控</span>') +
            '</dd></div>' +
            '<div><dt class="mono">BEST SCORE</dt><dd>' + (best ? U.formatNumber(best) : '暂无记录') + '</dd></div>' +
            '<div><dt class="mono">SOURCE</dt><dd>' + (g.external ? '独立开源游戏 · 独立舞台运行' : '本站原生游戏 · 独立舞台运行') + '</dd></div>' +
          '</dl>' +
          '<div class="hall-detail__actions">' +
            '<a class="btn btn-solid" href="#/play/' + encodeURIComponent(g.id) + '" data-detail-play>' +
              '<span>进入游戏舞台</span><i aria-hidden="true">↗</i></a>' +
            '<button type="button" class="btn btn-line" data-detail-fav="' + U.esc(g.id) + '" aria-pressed="' + fav + '">' +
              (fav ? '★ 已收藏' : '☆ 收藏展品') + '</button>' +
            (g.source ? '<a class="hall-detail__source mono" href="' + U.esc(g.source) + '" target="_blank" rel="noopener">SOURCE / ' + U.esc(g.license || '') + '</a>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
  }

  // The new collection is already mounted behind the letter-shaped apertures.
  function revealCategory(tag) {
    if (Museum.env.reduced()) return;
    const words = {'全部':'ARCADE','街机':'ARCADE','经典':'CLASSIC','益智':'PUZZLE','休闲':'PLAY','挑战':'TRIAL','策略':'TACTIC','卡牌':'CARDS','对战':'VERSUS','收藏':'SAVED'};
    const word = words[tag] || 'ARCADE';
    document.querySelector('.category-aperture')?.remove();
    const sheet = document.createElement('div');
    sheet.className = 'category-aperture';
    sheet.setAttribute('aria-hidden','true');
    const gap = Math.min(150, 840 / word.length);
    const letters = Array.from(word,(ch,i)=>'<text x="'+(500+(i-(word.length-1)/2)*gap)+'" y="325" text-anchor="middle" fill="black">'+ch+'</text>').join('');
    sheet.innerHTML = '<svg viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet"><defs><mask id="category-cut"><rect width="100%" height="100%" fill="white"/>'+letters+'</mask></defs><rect width="100%" height="100%" fill="#bec8d3" mask="url(#category-cut)"/></svg>';
    document.body.appendChild(sheet);
    sheet.querySelectorAll('text').forEach((letter,i)=>letter.animate([{transform:'translateY(90px)'},{transform:'translateY(0)'}],{duration:220,delay:i*15,fill:'both'}));
    const motion=sheet.animate([{opacity:0,transform:'scale(1)'},{opacity:1,transform:'scale(1)',offset:.2},{opacity:1,transform:'scale(1.06)',offset:.49},{opacity:0,transform:'scale(6)'}],{duration:820,easing:'ease-in-out'});
    motion.onfinish=()=>sheet.remove();
  }
  function openDetail(id, opts) {
    var g = getGame(id);
    if (!g) { Museum.toast('没有找到这件展品'); return; }
    opts = opts || {};
    closeDetail(true);
    state.detailId = id;
    state.lastFocus = document.activeElement;
    var root = state.root;
    var card = null;
    state.cards.forEach(function (c) { if (c.getAttribute('data-id') === id) card = c; });
    if (state.mode === 'grid') card = Array.from(root.querySelectorAll('.hall-grid__card')).find(node => node.dataset.id === id);
    state.returnCard = card;
    var cardRect = card ? card.getBoundingClientRect() : null;

    var wrap = document.createElement('div');
    wrap.className = 'hall-detail';
    wrap.id = 'hall-detail';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-labelledby', 'detail-title');
    wrap.innerHTML = detailHtml(g, cardRect);
    root.appendChild(wrap);
    state.detailEl = wrap;
    document.body.classList.add('detail-open');
    Museum.lockScroll(true);
    document.title = g.title + ' · R ARCHIVE';

    if (!Museum.env.reduced()) {
      const title=wrap.querySelector('#detail-title .mask-line > span');
      title.setAttribute('aria-label',g.title);title.textContent='';
      Array.from(g.title).forEach((letter,i)=>{
        const ch=document.createElement('span');ch.textContent=letter;ch.setAttribute('aria-hidden','true');ch.style.display='inline-block';title.append(ch);
        ch.animate([{transform:'translateY(70%) rotateX(-55deg)',opacity:0},{transform:'none',opacity:1}],{duration:440,delay:i*33,fill:'both'});
      });
    }
    var closeBtn = wrap.querySelector('.hall-detail__close');
    var art = wrap.querySelector('.hall-detail__art');
    var panel = wrap.querySelector('.hall-detail__panel');

    if (!Museum.env.reduced()) {
      if (cardRect && art) {
        var ar = art.getBoundingClientRect();
        var sx = cardRect.width / Math.max(1, ar.width);
        var sy = cardRect.height / Math.max(1, ar.height);
        var tx = cardRect.left + cardRect.width / 2 - (ar.left + ar.width / 2);
        var ty = cardRect.top + cardRect.height / 2 - (ar.top + ar.height / 2);
        art.animate([
          { transform: 'translate(' + tx + 'px,' + ty + 'px) scale(' + sx + ',' + sy + ')', opacity: 0.5 },
          { transform: 'none', opacity: 1 }
        ], { duration: 760, easing: 'cubic-bezier(.16,1,.3,1)' });
      }
      if (panel) {
        panel.animate([
          { opacity: 0, transform: 'translateY(30px)' },
          { opacity: 1, transform: 'none' }
        ], { duration: 620, delay: 80, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' });
      }
      var lines = wrap.querySelectorAll('.mask-line');
      lines.forEach(function (l) { l.classList.add('is-in'); });
    } else {
      var linesR = wrap.querySelectorAll('.mask-line');
      linesR.forEach(function (l) { l.classList.add('is-in'); });
    }

    wrap.addEventListener('click', function (e) {
      var closeTarget = e.target.closest('[data-detail-close]');
      if (closeTarget) { e.preventDefault(); closeDetail(); return; }
      var favBtn = e.target.closest('[data-detail-fav]');
      if (favBtn) {
        var fid = favBtn.getAttribute('data-detail-fav');
        var added = toggleFav(fid);
        favBtn.setAttribute('aria-pressed', String(added));
        favBtn.textContent = added ? '★ 已收藏' : '☆ 收藏展品';
        syncFavViews();
        Museum.toast(added ? '★ 已加入收藏' : '已取消收藏');
      }
    });

    state.detailKeyHandler = function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closeDetail(); }
      else if (e.key === 'Tab') {
        var focusables = wrap.querySelectorAll('a[href], button:not([disabled])');
        if (!focusables.length) return;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', state.detailKeyHandler);

    if (!opts.fromRoute) {
      try { history.replaceState(null, '', '#/game/' + encodeURIComponent(id)); } catch (e) { location.hash = '#/game/' + encodeURIComponent(id); }
    }
    setTimeout(function () { if (closeBtn) closeBtn.focus({ preventScroll: true }); }, 30);
  }

  function closeDetail(instant) {
    if (!state.detailEl) {
      if (location.hash.indexOf('#/game/') === 0) {
        try { history.replaceState(null, '', '#/hall'); } catch (e) { location.hash = '#/hall'; }
      }
      return;
    }
    var wrap = state.detailEl;
    state.detailEl = null;
    state.detailId = null;
    document.removeEventListener('keydown', state.detailKeyHandler);
    state.detailKeyHandler = null;
    document.body.classList.remove('detail-open');
    Museum.lockScroll(false);
    if (location.hash.indexOf('#/game/') === 0) {
      try { history.replaceState(null, '', '#/hall'); } catch (e) { location.hash = '#/hall'; }
    }
    document.title = '360° 展厅 · R ARCHIVE';
    var done = function () {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      if (state.lastFocus && state.lastFocus.isConnected && typeof state.lastFocus.focus === 'function') {
        state.lastFocus.focus({ preventScroll: true });
      }
    };
    if (instant || Museum.env.reduced()) { done(); return; }
    const cover = wrap.querySelector('.hall-detail__cover');
    const target = state.returnCard;
    if (cover && target && target.isConnected) {
      const from = cover.getBoundingClientRect(), to = target.getBoundingClientRect();
      if (from.width && to.width) {
        const flight = cover.cloneNode(true);
        flight.setAttribute('aria-hidden','true');
        Object.assign(flight.style,{position:'fixed',pointerEvents:'none',zIndex:3000,left:from.left+'px',top:from.top+'px',width:from.width+'px',height:from.height+'px',margin:0,transformOrigin:'top left'});
        document.body.appendChild(flight);
        cover.style.visibility='hidden';
        flight.animate([{transform:'none'},{transform:'translate('+(to.left-from.left)+'px,'+(to.top-from.top)+'px) scale('+to.width/from.width+','+to.height/from.height+')'}],{duration:430,easing:'cubic-bezier(.4,0,.18,1)',fill:'both'}).onfinish=()=>flight.remove();
      }
    }
    wrap.classList.add('is-closing');
    setTimeout(done, 260);
  }

  function syncFavViews() {
    state.cards.forEach(function (card) {
      var id = card.getAttribute('data-id');
      card.classList.toggle('is-fav', isFav(id));
    });
    U.$$('.hall-grid__card').forEach(function (card) {
      card.classList.toggle('is-fav', isFav(card.getAttribute('data-id')));
    });
    var g = state.filtered[state.index];
    if (g) {
      var btn = document.querySelector('[data-panel-fav]');
      if (btn) {
        var fav = isFav(g.id);
        btn.classList.toggle('is-fav', fav);
        btn.textContent = fav ? '★' : '☆';
        btn.setAttribute('aria-pressed', String(fav));
      }
    }
    var chips = document.getElementById('hall-chips');
    if (chips) chips.innerHTML = chipsHtml();
  }

  /* ------------------------------------------------------------------ */
  /* 交互                                                               */
  /* ------------------------------------------------------------------ */
  function bind(controller) {
    var signal = { signal: controller.signal };
    var ring = document.getElementById('hall-ring');
    var stage = document.getElementById('hall-stage');
    var chips = document.getElementById('hall-chips');
    var search = document.getElementById('hall-search');
    var searchWrap = document.getElementById('hall-search-wrap');
    var searchClear = document.getElementById('hall-search-clear');

    U.$$('a, button', state.root).forEach(function (node) {
      if (!node.hasAttribute('data-magnetic')) node.setAttribute('data-magnetic', '');
    });

    chips.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      if (btn.hasAttribute('data-fav-filter')) {
        state.favOnly = !state.favOnly;
      } else {
        state.tag = btn.getAttribute('data-tag');
        state.favOnly = false;
      }
      revealCategory(state.favOnly ? '收藏' : state.tag);
      Museum.store.set('hall.filter', { tag: state.tag, favOnly: state.favOnly });
      chips.innerHTML = chipsHtml();
      applyFilters();
    }, signal);

    if (search) {
      var runSearch = U.debounce(function () {
        applyFilters();
      }, 90);
      search.addEventListener('input', function () {
        state.query = search.value;
        searchWrap.classList.toggle('has-value', !!search.value);
        runSearch();
      }, signal);
      search.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          search.value = '';
          state.query = '';
          searchWrap.classList.remove('has-value');
          applyFilters();
          search.blur();
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          if (state.filtered[state.index]) openDetail(state.filtered[state.index].id);
        }
      }, signal);
    }
    if (searchClear) {
      searchClear.addEventListener('click', function () {
        search.value = '';
        state.query = '';
        searchWrap.classList.remove('has-value');
        applyFilters();
        search.focus();
      }, signal);
    }

    U.$$('.hall-mode').forEach(function (btn) {
      btn.addEventListener('click', function () { setMode(btn.getAttribute('data-mode')); }, signal);
    });

    var reset = document.getElementById('hall-reset');
    if (reset) {
      reset.addEventListener('click', function () {
        state.query = '';
        state.tag = '全部';
        state.favOnly = false;
        if (search) search.value = '';
        if (searchWrap) searchWrap.classList.remove('has-value');
        var chipsEl = document.getElementById('hall-chips');
        if (chipsEl) chipsEl.innerHTML = chipsHtml();
        applyFilters();
      }, signal);
    }

    var clickCard = function (card) {
      var id = card.getAttribute('data-id');
      var idx = Number(card.getAttribute('data-index'));
      if (state.detailEl) return;
      if (idx !== state.index) { goToIndex(idx); return; }
      openDetail(id);
    };

    if (ring) {
      ring.addEventListener('click', function (e) {
        var card = e.target.closest('.hall-card');
        if (!card || state.dragMoved > 8) return;
        clickCard(card);
      }, signal);
    }

    var gridEl = document.getElementById('hall-grid');
    if (gridEl) {
      gridEl.addEventListener('click', function (e) {
        var card = e.target.closest('.hall-grid__card');
        if (card) openDetail(card.getAttribute('data-id'));
      }, signal);
    }

    var panel = document.getElementById('hall-panel');
    if (panel) {
      panel.addEventListener('click', function (e) {
        var detailBtn = e.target.closest('[data-detail]');
        if (detailBtn) { openDetail(detailBtn.getAttribute('data-detail')); return; }
        var favBtn = e.target.closest('[data-panel-fav]');
        if (favBtn) {
          var id = favBtn.getAttribute('data-panel-fav');
          var added = toggleFav(id);
          Museum.toast(added ? '★ 已加入收藏' : '已取消收藏');
          syncFavViews();
          updatePanel();
        }
      }, signal);
    }

    var prev = document.getElementById('hall-prev');
    var next = document.getElementById('hall-next');
    if (prev) prev.addEventListener('click', function () { goToIndex(state.index - 1); }, signal);
    if (next) next.addEventListener('click', function () { goToIndex(state.index + 1); }, signal);

    /* 指针拖动 */
    var dragStartIndex = 0;
    function pointerDown(e) {
      if (state.mode !== 'ring' || state.detailEl) return;
      if (e.target.closest('.hall-arrow, .hall-empty')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      state.dragging = true;
      state.dragX = e.clientX;
      state.lastX = e.clientX;
      state.lastT = performance.now();
      state.velocity = 0;
      state.dragMoved = 0;
      dragStartIndex = state.index;
      stage.classList.add('is-dragging');
      // Capture after movement so a tap reaches its original cover.
      e.preventDefault();
    }
    function pointerMove(e) {
      if (!state.dragging) return;
      var dx = e.clientX - state.lastX;
      var now = performance.now();
      var dt = Math.max(1, now - state.lastT);
      state.lastX = e.clientX;
      state.lastT = now;
      state.dragMoved += Math.abs(e.clientX - state.dragX);
      state.dragX = e.clientX;
      if (state.dragMoved>8 && !stage.hasPointerCapture(e.pointerId)) stage.setPointerCapture(e.pointerId);
      state.rot += dx * (e.pointerType === 'touch' ? 0.38 : 0.26);
      state.velocity = (dx / dt) * 16;
      paintRing(true);
      var idx = selectedIndex();
      if (idx !== state.index) { state.index = idx; updateTabindex(); updatePanel(); }
    }
    function pointerUp(e) {
      if (!state.dragging) return;
      state.dragging = false;
      if (stage) stage.classList.remove('is-dragging');
      var inertia = U.clamp(state.velocity * 2.6, -state.step * 2.2, state.step * 2.2);
      if (Math.abs(inertia) > 4 && !Museum.env.reduced()) state.rot += inertia;
      if (Museum.env.reduced()) state.rot = Math.round(state.rot / state.step) * state.step;
      nearestSnap();
      state.dragMoved = state.dragMoved;
      setTimeout(function () { state.dragMoved = 0; }, 60);
    }

    if (stage) {
      stage.addEventListener('pointerdown', pointerDown, signal);
      stage.addEventListener('pointermove', pointerMove, signal);
      stage.addEventListener('pointerup', pointerUp, signal);
      stage.addEventListener('pointercancel', pointerUp, signal);
      stage.addEventListener('lostpointercapture', pointerUp, signal);
      stage.addEventListener('wheel', function (e) {
        if (state.mode !== 'ring' || state.detailEl) return;
        /* 纵向滚轮用于旋转圆环，避免与页面滚动冲突 */
        e.preventDefault();
        var now = performance.now();
        if (now - state.wheelLock < 120) return;
        state.wheelLock = now;
        var dir = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) > 0 ? 1 : -1;
        goToIndex(state.index + dir);
      }, { passive: false, signal: controller.signal });
      stage.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); goToIndex(state.index - 1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); goToIndex(state.index + 1); }
        else if (e.key === 'Home') { e.preventDefault(); goToIndex(0); }
        else if (e.key === 'End') { e.preventDefault(); goToIndex(state.filtered.length - 1); }
        else if (e.key === 'Enter') {
          e.preventDefault();
          if (state.filtered[state.index]) openDetail(state.filtered[state.index].id);
        }
      }, signal);
    }

    /* 全局键盘：灯箱关闭以外的方向键/回车支持 */
    document.addEventListener('keydown', function (e) {
      if (e.defaultPrevented || Museum.route.name !== 'hall' || state.detailEl) return;
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); goToIndex(state.index - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goToIndex(state.index + 1); }
      else if (e.key === 'Enter' && !e.target.closest('a,button')) {
        e.preventDefault();
        if (state.filtered[state.index]) openDetail(state.filtered[state.index].id);
      }
    }, signal);

    window.addEventListener('resize', U.debounce(function () {
      if (!state.active) return;
      var keep = state.filtered[state.index] ? state.filtered[state.index].id : null;
      geometry();
      if (keep) {
        var idx = -1;
        state.filtered.forEach(function (g, i) { if (g.id === keep) idx = i; });
        if (idx >= 0) goToIndex(idx, true);
      }
      paintRing(true);
      if (state.mode === 'grid') buildGrid();
    }, 160), signal);

    document.addEventListener('visibilitychange', function () {
      if (!state.active) return;
      state.needsPaint = true;
    }, signal);
  }

  /* ------------------------------------------------------------------ */
  /* 生命周期                                                           */
  /* ------------------------------------------------------------------ */
  function mount(rootEl, params) {
    state.active = true;
    state.root = rootEl;
    state.controller = new AbortController();
    state.query = '';
    state.detailEl = null;
    state.detailId = null;
    state.index = 0;
    state.rot = 0;
    state.targetRot = 0;
    state.mode = Museum.store.get('hall.view', 'ring') === 'grid' ? 'grid' : 'ring';
    var savedFilter = Museum.store.get('hall.filter', null);
    state.tag = savedFilter && savedFilter.tag && (savedFilter.tag === '全部' || ALL_TAGS.indexOf(savedFilter.tag) >= 0)
      ? savedFilter.tag : '全部';
    state.favOnly = !!(savedFilter && savedFilter.favOnly);

    rootEl.innerHTML = template();
    bind(state.controller);
    U.$$('.hall-mode').forEach(function (b) {
      var active = b.getAttribute('data-mode') === state.mode;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    applyFilters();
    U.$$('a, button', rootEl).forEach(function (node) {
      if (!node.hasAttribute('data-magnetic')) node.setAttribute('data-magnetic', '');
    });
    Museum.fx && Museum.fx.refresh(rootEl);
    Museum.observeReveal(rootEl);
    if (Museum.env.reduced()) {
      state.rot = 0; state.targetRot = 0;
    }
    state.raf = requestAnimationFrame(loop);

    if (params && params.id) {
      var g = getGame(params.id);
      if (g) {
        setTimeout(function () { if (state.active) openDetail(params.id, { fromRoute: true }); }, 40);
      } else {
        Museum.toast('没有找到这件展品，已返回展厅');
      }
    }
    window.__HALL_INDEX__ = function () { return state.index; };
    window.__HALL_ROT__ = function () { return state.rot; };
  }

  function unmount() {
    state.active = false;
    cancelAnimationFrame(state.raf);
    state.raf = 0;
    if (state.controller) state.controller.abort();
    if (state.detailEl) {
      document.removeEventListener('keydown', state.detailKeyHandler);
      Museum.lockScroll(false);
      if (state.detailEl.parentNode) state.detailEl.parentNode.removeChild(state.detailEl);
      state.detailEl = null;
    }
    document.body.classList.remove('detail-open');
    document.title = '360° 展厅 · R ARCHIVE';
    state.root = null;
    state.cards = [];
    window.__HALL_INDEX__ = null;
    window.__HALL_ROT__ = null;
  }

  window.GalleryView = {
    mount: mount,
    unmount: unmount,
    openDetail: function (id) { if (state.active) openDetail(id); },
    closeDetail: function () { closeDetail(); }
  };
})();

