/* Rz神次元游戏箱 · 应用外壳：路由、大厅、游戏页、收藏与本地战绩 */
(function () {
  'use strict';

  var Arcade = window.Arcade;
  var app = document.getElementById('app');
  var toastEl = document.getElementById('toast');
  var soundBtn = document.getElementById('sound-toggle');
  var randomBtn = document.getElementById('header-random');

  var games = (Arcade.games || []).slice().sort(function (a, b) {
    var oa = typeof a.order === 'number' ? a.order : 100;
    var ob = typeof b.order === 'number' ? b.order : 100;
    if (oa !== ob) return oa - ob;
    return String(a.title).localeCompare(String(b.title), 'zh-CN');
  });

  var PREFERRED_TAGS = ['街机', '益智', '休闲', '经典', '挑战', '对战', '策略', '卡牌'];
  /* 本次新增的游戏卡片上显示 NEW 徽章 */
  var NEW_IDS = ['suika', 'sheep', 'pool', 'tower', 'solitaire', 'xiangqi', 'survivor', 'hextris'];
  /* 每款游戏的壁纸素材：图标 + 详情页背景（低分辨率素材不设置背景，回退纯黑） */
  var GAME_ART = {
    snake: { icon: 'assets/img/games/snake-icon.webp', bg: '/assets/img/games/snake-bg.webp' },
    breakout: { icon: 'assets/img/games/breakout-icon.webp', bg: '/assets/img/games/breakout-bg.webp' },
    tetris: { icon: 'assets/img/games/tetris-icon.webp', bg: '/assets/img/games/tetris-bg.webp' },
    g2048: { icon: 'assets/img/games/g2048-icon.webp', bg: '/assets/img/games/g2048-bg.webp' },
    minesweeper: { icon: 'assets/img/games/minesweeper-icon.webp', bg: '/assets/img/games/minesweeper-bg.webp' },
    space: { icon: 'assets/img/games/space-icon.webp', bg: '/assets/img/games/space-bg.webp' },
    flappy: { icon: 'assets/img/games/flappy-icon.webp' },
    memory: { icon: 'assets/img/games/memory-icon.webp' },
    gomoku: { icon: 'assets/img/games/gomoku-icon.webp', bg: '/assets/img/games/gomoku-bg.webp' },
    xiangqi: { icon: 'assets/img/games/xiangqi-icon.webp', bg: '/assets/img/games/xiangqi-bg.webp' },
    'minesweeper-master': { icon: 'assets/img/games/minesweeper-icon.webp', bg: '/assets/img/games/minesweeper-bg.webp' },
    'xiangqi-master': { icon: 'assets/img/games/xiangqi-icon.webp', bg: '/assets/img/games/xiangqi-bg.webp' },
    'gomoku-master': { icon: 'assets/img/games/gomoku-icon.webp', bg: '/assets/img/games/gomoku-bg.webp' },
    sonar: { icon: 'assets/img/games/tower-icon.webp', bg: '/assets/img/games/tower-bg.webp' },
    syncrings: { icon: 'assets/img/games/hextris-icon.webp', bg: '/assets/img/games/hextris-bg.webp' },
    mirror: { icon: 'assets/img/games/gomoku-icon.webp', bg: '/assets/img/games/gomoku-bg.webp' },
    suika: { icon: 'assets/img/games/suika-icon.webp', bg: '/assets/img/games/suika-bg.webp' },
    sheep: { icon: 'assets/img/games/sheep-icon.webp' },
    pool: { icon: 'assets/img/games/pool-icon.webp', bg: '/assets/img/games/pool-bg.webp' },
    tower: { icon: 'assets/img/games/tower-icon.webp', bg: '/assets/img/games/tower-bg.webp' },
    solitaire: { icon: 'assets/img/games/solitaire-icon.webp', bg: '/assets/img/games/solitaire-bg.webp' },
    survivor: { icon: 'assets/img/games/survivor-icon.webp', bg: '/assets/img/games/survivor-bg.webp' },
    hextris: { icon: 'assets/img/games/hextris-icon.webp', bg: '/assets/img/games/hextris-bg.webp' }
  };
  var HERO_BG = '/assets/img/games/hero.webp';
  var tags = [];
  PREFERRED_TAGS.forEach(function (t) {
    if (games.some(function (g) { return (g.tags || []).indexOf(t) >= 0; })) tags.push(t);
  });
  games.forEach(function (g) {
    (g.tags || []).forEach(function (t) { if (tags.indexOf(t) < 0) tags.push(t); });
  });

  var state = { query: '', tag: '全部', favOnly: false };
  var host = null;
  var toastTimer = null;
  var currentGame = null;

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function formatNumber(n) {
    return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function favorites() {
    var list = Arcade.store.get('favorites', []);
    return Array.isArray(list) ? list.slice() : [];
  }

  function isFav(id) { return favorites().indexOf(id) >= 0; }

  function toggleFav(id) {
    var list = favorites();
    var i = list.indexOf(id);
    var added = i < 0;
    if (added) list.push(id); else list.splice(i, 1);
    Arcade.store.set('favorites', list);
    return added;
  }

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-show'); }, 1800);
  }

  function countUp(el, target) {
    if (!el) return;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || target <= 0) { el.textContent = formatNumber(target); return; }
    var start = performance.now();
    var dur = 800;
    function tick(now) {
      var p = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = formatNumber(target * eased);
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = formatNumber(target);
    }
    requestAnimationFrame(tick);
  }

  function syncSound() {
    var muted = Arcade.audio.isMuted();
    soundBtn.textContent = muted ? '🔇' : '🔊';
    soundBtn.classList.toggle('is-off', muted);
    soundBtn.title = muted ? '取消静音 (M)' : '静音 (M)';
    soundBtn.setAttribute('aria-label', muted ? '取消静音' : '静音');
  }

  function diffClass(d) {
    if (d === '简单') return 'tag tag--difficulty tag--easy';
    if (d === '困难') return 'tag tag--difficulty tag--hard';
    return 'tag tag--difficulty tag--medium';
  }

  function randomGame() {
    if (!games.length) return;
    var pool = games.filter(function (g) { return !currentGame || g.id !== currentGame.id; });
    var pick = pool[Math.floor(Math.random() * pool.length)] || games[0];
    openGame(pick.id);
  }

  /* ---------- 大厅 ---------- */
  function artOf(id) {
    return GAME_ART[id] || {};
  }

  function artIconHtml(id, fallback, lazy) {
    var art = artOf(id);
    if (art.icon) {
      return '<img src="' + art.icon + '" alt="" ' + (lazy ? 'loading="lazy" ' : '') + 'decoding="async">';
    }
    return esc(fallback || '🎮');
  }

  function heroDeckHtml() {
    return games.slice(0, 9).map(function (g, i) {
      return '<div class="deck-tile" style="--accent:' + esc(g.accent || '#22d3ee') +
        ';--d:' + (i * 0.35).toFixed(2) + 's" title="' + esc(g.title) + '">' +
        '<span class="deck-tile__icon" aria-hidden="true">' + artIconHtml(g.id, g.icon, true) + '</span>' +
        '<span class="deck-tile__name">' + esc(g.title) + '</span>' +
      '</div>';
    }).join('');
  }

  function cardHtml(g, i) {
    var best = Arcade.best(g.id);
    var fav = isFav(g.id);
    var art = artOf(g.id);
    var tagHtml = (g.tags || []).slice(0, 2).map(function (t) {
      return '<span class="tag">' + esc(t) + '</span>';
    }).join('');
    return '<article class="game-card" data-id="' + esc(g.id) + '" tabindex="0" role="button" ' +
      'aria-label="开始游戏 ' + esc(g.title) + '" style="--accent:' + esc(g.accent || '#22d3ee') +
      ';--accent2:' + esc(g.accent2 || '#6366f1') + ';--i:' + i + '">' +
      (window.CardArt ? CardArt.render(g.id) : '') +
      '<div class="card-top">' +
        '<div class="card-icon' + (art.icon ? ' has-art' : '') + '" aria-hidden="true">' +
          artIconHtml(g.id, g.icon, i > 7) +
        '</div>' +
        '<button type="button" class="fav-btn' + (fav ? ' is-fav' : '') + '" data-fav="' + esc(g.id) + '" ' +
          'aria-label="' + (fav ? '取消收藏' : '收藏') + '" title="' + (fav ? '取消收藏' : '收藏') + '">' +
          (fav ? '★' : '☆') +
        '</button>' +
      '</div>' +
      '<div class="card-title-row">' +
        '<h3 class="card-title">' + esc(g.title) + '</h3>' +
        (NEW_IDS.indexOf(g.id) >= 0 ? '<span class="card-badge card-badge--new">NEW</span>' : '') +
        '<span class="' + diffClass(g.difficulty) + '">' + esc(g.difficulty || '中等') + '</span>' +
      '</div>' +
      '<div class="card-meta">' + tagHtml +
        (best > 0 ? '<span class="card-best">最佳 <b>' + formatNumber(best) + '</b></span>' : '') +
      '</div>' +
    '</article>';
  }

  function renderHub() {
    currentGame = null;
    window.__host = null;
    document.title = 'R`s GAME BOX';
    if (host) { host.destroy(); host = null; }
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    }

    var totals = Arcade.totals();
    var favCount = favorites().length;
    var cards = games.map(cardHtml).join('');

    app.innerHTML =
      '<section class="view view--hub" id="view-hub">' +
        '<div class="hero" style="--hero-bg:url(' + HERO_BG + ')">' +
          '<div class="hero-copy">' +
            '<h1 class="hero-title">R`s <span class="grad">GAME BOX</span></h1>' +
            '<div class="hero-stats">' +
              '<div class="stat"><span class="stat-value" data-stat="games">' + games.length + '</span>' +
                '<span class="stat-label">款即玩游戏</span></div>' +
              '<div class="stat"><span class="stat-value" data-stat="plays">0</span>' +
                '<span class="stat-label">累计开局</span></div>' +
              '<div class="stat"><span class="stat-value" data-stat="favs">0</span>' +
                '<span class="stat-label">我的收藏</span></div>' +
            '</div>' +
          '</div>' +
          '<div class="hero-deck" aria-hidden="true">' +
            '<span class="deck-glow"></span>' +
            '<div class="deck-grid">' + heroDeckHtml() + '</div>' +
          '</div>' +
        '</div>' +

        '<div class="section-head" id="games">' +
          '<h2 class="section-title">全部游戏 <small>ALL GAMES</small></h2>' +
          '<p class="section-sub" id="section-sub">共 ' + games.length + ' 款 · 点击卡片即可开玩</p>' +
        '</div>' +

        '<div class="toolbar" role="search">' +
          '<div class="search" id="search-wrap">' +
            '<span class="search__icon" aria-hidden="true">🔍</span>' +
            '<input id="game-search" type="search" placeholder="搜索游戏、标签…（按 / 聚焦）" autocomplete="off" spellcheck="false" aria-label="搜索游戏">' +
            '<button type="button" class="search__clear" id="search-clear" aria-label="清空搜索">✕</button>' +
          '</div>' +
          '<div class="chips" id="chips" role="group" aria-label="按分类筛选">' +
            chipsHtml() +
          '</div>' +
          '<span class="result-count" id="result-count">显示 <b>' + games.length + '</b> / ' + games.length + ' 款</span>' +
        '</div>' +

        '<div class="grid" id="game-grid">' + cards + '</div>' +

        '<div class="empty-state" id="empty-state" hidden>' +
          '<span class="empty-state__icon" aria-hidden="true">🕹️</span>' +
          '<h3>没有找到匹配的游戏</h3>' +
          '<p>换个关键词，或者清空筛选条件再看看。</p>' +
          '<button type="button" class="btn btn-ghost btn-sm" id="reset-filters">清空筛选</button>' +
        '</div>' +
      '</section>';

    bindHub();
    applyFilters();
    countUp(document.querySelector('[data-stat="plays"]'), totals.plays);
    countUp(document.querySelector('[data-stat="favs"]'), favCount);
    syncSound();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function chipsHtml() {
    var html = '<button type="button" class="chip' + (state.tag === '全部' && !state.favOnly ? ' is-active' : '') +
      '" data-tag="全部">全部 <span class="chip__count">' + games.length + '</span></button>';
    tags.forEach(function (t) {
      var n = games.filter(function (g) { return (g.tags || []).indexOf(t) >= 0; }).length;
      html += '<button type="button" class="chip' + (state.tag === t && !state.favOnly ? ' is-active' : '') +
        '" data-tag="' + esc(t) + '">' + esc(t) + ' <span class="chip__count">' + n + '</span></button>';
    });
    html += '<button type="button" class="chip' + (state.favOnly ? ' is-active' : '') +
      '" data-fav-filter="1">★ 收藏</button>';
    return html;
  }

  function bindHub() {
    var search = document.getElementById('game-search');
    var searchWrap = document.getElementById('search-wrap');
    var clearBtn = document.getElementById('search-clear');
    var chips = document.getElementById('chips');
    var grid = document.getElementById('game-grid');
    var empty = document.getElementById('empty-state');

    search.value = state.query;
    searchWrap.classList.toggle('has-value', !!state.query);

    search.addEventListener('input', function () {
      state.query = search.value.trim();
      searchWrap.classList.toggle('has-value', !!search.value);
      applyFilters();
    });
    search.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        search.value = '';
        state.query = '';
        searchWrap.classList.remove('has-value');
        applyFilters();
        search.blur();
      }
    });
    clearBtn.addEventListener('click', function () {
      search.value = '';
      state.query = '';
      searchWrap.classList.remove('has-value');
      applyFilters();
      search.focus();
    });

    chips.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      Arcade.audio.play('click');
      if (btn.hasAttribute('data-fav-filter')) {
        state.favOnly = !state.favOnly;
      } else {
        state.tag = btn.getAttribute('data-tag');
        state.favOnly = false;
      }
      chips.innerHTML = chipsHtml();
      applyFilters();
    });

    grid.addEventListener('click', function (e) {
      var favBtn = e.target.closest('[data-fav]');
      if (favBtn) {
        e.stopPropagation();
        var id = favBtn.getAttribute('data-fav');
        var added = toggleFav(id);
        favBtn.classList.toggle('is-fav', added);
        favBtn.textContent = added ? '★' : '☆';
        favBtn.setAttribute('aria-label', added ? '取消收藏' : '收藏');
        favBtn.title = added ? '取消收藏' : '收藏';
        Arcade.audio.play('toggle');
        toast(added ? '⭐ 已加入收藏' : '已取消收藏');
        if (state.favOnly) applyFilters();
        return;
      }
      var card = e.target.closest('.game-card');
      if (card) openGame(card.getAttribute('data-id'));
    });

    grid.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var card = e.target.closest('.game-card');
      if (!card || e.target !== card) return;
      e.preventDefault();
      openGame(card.getAttribute('data-id'));
    });

    grid.addEventListener('mousemove', function (e) {
      var card = e.target.closest('.game-card');
      if (!card) return;
      var rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', (((e.clientX - rect.left) / rect.width) * 100).toFixed(1) + '%');
      card.style.setProperty('--my', (((e.clientY - rect.top) / rect.height) * 100).toFixed(1) + '%');
    });

    empty.querySelector('#reset-filters').addEventListener('click', function () {
      state = { query: '', tag: '全部', favOnly: false };
      search.value = '';
      searchWrap.classList.remove('has-value');
      document.getElementById('chips').innerHTML = chipsHtml();
      applyFilters();
    });

  }

  function applyFilters() {
    if (!document.getElementById('game-grid')) return;
    var q = state.query.toLowerCase();
    var visible = 0;
    var cards = document.querySelectorAll('#game-grid .game-card');
    cards.forEach(function (card) {
      var g = Arcade.getGame(card.getAttribute('data-id'));
      if (!g) { card.classList.add('is-hidden'); return; }
      var haystack = [g.title, g.subtitle, g.description, g.difficulty, (g.tags || []).join(' ')].join(' ').toLowerCase();
      var ok = true;
      if (q && haystack.indexOf(q) < 0) ok = false;
      if (ok && state.tag !== '全部' && (g.tags || []).indexOf(state.tag) < 0) ok = false;
      if (ok && state.favOnly && !isFav(g.id)) ok = false;
      card.classList.toggle('is-hidden', !ok);
      if (ok) visible++;
    });
    var countEl = document.getElementById('result-count');
    if (countEl) {
      countEl.innerHTML = '显示 <b>' + visible + '</b> / ' + games.length + ' 款';
    }
    var empty = document.getElementById('empty-state');
    if (empty) empty.hidden = visible > 0;
    var sub = document.getElementById('section-sub');
    if (sub) {
      sub.textContent = state.query || state.tag !== '全部' || state.favOnly
        ? '筛选出 ' + visible + ' 款游戏'
        : '共 ' + games.length + ' 款 · 点击卡片即可开玩';
    }
  }

  /* ---------- 游戏页 ---------- */
  function openGame(id) {
    if (!id || !Arcade.getGame(id)) { toast('没找到这款游戏'); return; }
    Arcade.audio.play('click');
    if (currentGame && currentGame.id === id) return;
    var game = Arcade.getGame(id);
    var href = '#/play/' + encodeURIComponent(id);
    var label = game && game.title ? 'PLAY / ' + game.title : 'PLAY';
    if (!window.RGBGo || !window.RGBGo(href, label, { fast: true })) location.hash = href;
  }

  function renderExternal(game) {
    window.__host = null;
    Arcade.addPlay(game.id);
    var art = artOf(game.id);
    var tags = (game.tags || []).map(function (t) {
      return '<span class="tag">' + esc(t) + '</span>';
    }).join('');
    app.innerHTML =
      '<section class="view view--play external-page" style="--accent:' + esc(game.accent || '#22d3ee') +
        ';--accent2:' + esc(game.accent2 || '#6366f1') +
        (art.bg ? ';--game-bg:url(' + art.bg + ')' : '') + '">' +
        '<div class="play-bar">' +
          '<a class="back-btn" href="#/">← 返回大厅</a>' +
          '<div class="play-title">' +
            '<span class="play-icon' + (art.icon ? ' has-art' : '') + '" aria-hidden="true">' +
              artIconHtml(game.id, game.icon, false) + '</span>' +
            '<div><h1>' + esc(game.title) + '</h1><p>' + esc(game.subtitle || '') + '</p></div>' +
          '</div>' +
          '<div class="play-actions">' +
            '<button type="button" class="btn btn-ghost btn-sm" id="external-fav">' +
              (isFav(game.id) ? '★ 已收藏' : '☆ 收藏') +
            '</button>' +
            '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="' + esc(game.source) + '">' +
              '源码 · ' + esc(game.license) +
            '</a>' +
            '<button type="button" class="icon-btn" id="external-full" title="全屏" aria-label="全屏">⛶</button>' +
          '</div>' +
        '</div>' +
        '<div class="external-layout">' +
          '<div class="external-feature">' +
            '<iframe id="external-frame" title="' + esc(game.title) + '" src="' + esc(game.url) + '" ' +
              'allow="fullscreen; autoplay; gamepad" allowfullscreen></iframe>' +
          '</div>' +
          '<aside class="side">' +
            '<section class="panel">' +
              '<h2>玩法说明</h2>' +
              '<p>' + esc(game.help || '') + '</p>' +
              '<div class="difficulty-line">' + tags + '</div>' +
            '</section>' +
            '<section class="panel">' +
              '<h2>关于这款游戏</h2>' +
              '<p>' + esc(game.description || '') + '</p>' +
              '<p style="margin-top:10px;color:#5f6b8d;font-size:11.5px">' +
                '开源游戏，运行在独立页面中；分数与设置保存在游戏内。返回大厅会自动关闭。' +
              '</p>' +
            '</section>' +
          '</aside>' +
        '</div>' +
      '</section>';

    document.getElementById('external-fav').onclick = function () {
      var added = toggleFav(game.id);
      this.textContent = added ? '★ 已收藏' : '☆ 收藏';
      Arcade.audio.play('toggle');
      toast(added ? '⭐ 已加入收藏' : '已取消收藏');
    };
    document.getElementById('external-full').onclick = function () {
      var frame = document.getElementById('external-frame');
      if (frame.requestFullscreen) frame.requestFullscreen().catch(function () { toast('此浏览器不支持内嵌全屏'); });
      else toast('此浏览器不支持内嵌全屏，可横屏游玩');
    };
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function renderPlay(game) {
    currentGame = game;
    document.title = game.title + ' · R`s GAME BOX';
    if (host) { host.destroy(); host = null; }

    if (game.url) { renderExternal(game); return; }
    var best = Arcade.best(game.id);
    var plays = Arcade.plays(game.id);
    var controls = (game.controls || []).map(function (c) {
      return '<li class="control-row"><span class="keys">' + esc(c.keys) + '</span>' +
        '<span class="action">' + esc(c.action) + '</span></li>';
    }).join('');
    var tagHtml = (game.tags || []).map(function (t) {
      return '<span class="tag">' + esc(t) + '</span>';
    }).join('');

    var art = artOf(game.id);
    app.innerHTML =
      '<section class="view view--play" style="--accent:' + esc(game.accent || '#22d3ee') +
        ';--accent2:' + esc(game.accent2 || '#6366f1') +
        ';--ar:' + ((game.width || 4) / (game.height || 3)).toFixed(4) +
        (art.bg ? ';--game-bg:url(' + art.bg + ')' : '') + '">' +
        '<div class="play-bar">' +
          '<a class="back-btn" href="#/" id="back-link">← 返回大厅</a>' +
          '<div class="play-title">' +
            '<span class="play-icon' + (art.icon ? ' has-art' : '') + '" aria-hidden="true">' +
              artIconHtml(game.id, game.icon, false) + '</span>' +
            '<div><h1>' + esc(game.title) + '</h1><p>' + esc(game.subtitle || '') + '</p></div>' +
          '</div>' +
          '<div class="play-actions">' +
            '<span class="best-chip" id="best-chip">🏆 最佳 <b>' + formatNumber(best) + '</b></span>' +
            '<button type="button" class="icon-btn" id="fs-btn" title="全屏 (F)" aria-label="全屏">⛶</button>' +
          '</div>' +
        '</div>' +

        '<div class="play-layout">' +
          '<div class="stage-col">' +
            '<div class="hud" id="hud"></div>' +
            '<div class="stage" id="stage">' +
              '<canvas id="game-canvas" tabindex="0" aria-label="' + esc(game.title) + '游戏画面"></canvas>' +
              '<div class="overlay" id="overlay" hidden></div>' +
            '</div>' +
            '<div class="status-bar is-empty" id="status"></div>' +
            '<p class="stage-hint"><kbd>Esc</kbd> 暂停 <kbd>R</kbd> 重开 <kbd>M</kbd> 静音 <kbd>⛶</kbd> 全屏</p>' +
            '<div class="touch-dock" id="touch-dock" aria-label="触屏操作">' +
              '<div class="touch-dpad">' +
                '<button type="button" class="touch-key touch-key--up" data-key="ArrowUp" aria-label="上">▲</button>' +
                '<button type="button" class="touch-key touch-key--left" data-key="ArrowLeft" aria-label="左">◀</button>' +
                '<button type="button" class="touch-key touch-key--down" data-key="ArrowDown" aria-label="下">▼</button>' +
                '<button type="button" class="touch-key touch-key--right" data-key="ArrowRight" aria-label="右">▶</button>' +
              '</div>' +
              '<div class="touch-actions">' +
                '<button type="button" class="touch-key touch-key--action" data-key="Space" aria-label="主操作">A<small>主操作</small></button>' +
                '<button type="button" class="touch-key touch-key--action" data-key="KeyZ" aria-label="辅助操作">B<small>辅助</small></button>' +
                '<button type="button" class="touch-key touch-key--action" data-key="KeyX KeyC" aria-label="特殊操作">C<small>特殊</small></button>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<aside class="side">' +
            '<section class="panel">' +
              '<h2>操作方式</h2>' +
              '<ul class="controls">' + controls + '</ul>' +
            '</section>' +
            '<section class="panel">' +
              '<h2>玩法提示</h2>' +
              '<p>' + esc(game.tips || game.description || '') + '</p>' +
              '<div class="difficulty-line">' + tagHtml +
                '<span class="' + diffClass(game.difficulty) + '">' + esc(game.difficulty || '中等') + '</span>' +
              '</div>' +
            '</section>' +
            '<section class="panel">' +
              '<h2>战绩</h2>' +
              '<div class="panel-stats">' +
                '<div class="panel-stat"><strong id="stat-best">' + formatNumber(best) + '</strong><span>历史最佳</span></div>' +
                '<div class="panel-stat"><strong id="stat-plays">' + formatNumber(plays + 1) + '</strong><span>开局次数</span></div>' +
              '</div>' +
              '<p style="margin-top:10px;font-size:11.5px;color:#5f6b8d">成绩自动保存在本机浏览器中。</p>' +
            '</section>' +
            '<button type="button" class="btn btn-primary side-restart" id="side-restart">↻ 重新开始</button>' +
          '</aside>' +
        '</div>' +
      '</section>';

    var canvas = document.getElementById('game-canvas');
    var hud = document.getElementById('hud');
    var status = document.getElementById('status');
    var overlay = document.getElementById('overlay');
    var stage = document.getElementById('stage');
    stage.style.setProperty('--ar', String((game.width || 4) / (game.height || 3)));

    Arcade.addPlay(game.id);
    document.getElementById('stat-plays').textContent = formatNumber(Arcade.plays(game.id));

    var playingScore = 0;
    host = Arcade.createHost({
      canvas: canvas,
      hud: hud,
      status: status,
      overlay: overlay,
      game: game,
      onExit: function () {
        host = null;
        window.__host = null;
        currentGame = null;
        if (location.hash === '#/' || location.hash === '') {
          renderHub();
        } else {
          location.hash = '#/';
        }
      },
      onMuteChange: syncSound,
      onScore: function (score) {
        var statBest = document.getElementById('stat-best');
        var bestChip = document.getElementById('best-chip');
        if (statBest) {
          var shown = Number(statBest.textContent.replace(/,/g, '')) || 0;
          if (score > shown) {
            statBest.textContent = formatNumber(score);
            if (bestChip) bestChip.innerHTML = '🏆 最佳 <b>' + formatNumber(score) + '</b>';
          }
        }
        playingScore = score;
      }
    });
    host.mount();
    window.__host = host;

    document.getElementById('side-restart').addEventListener('click', function () {
      host && host.restart();
    });

    bindTouchDock();

    var fsBtn = document.getElementById('fs-btn');
    fsBtn.addEventListener('click', toggleFullscreen);
    syncFs();

    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function bindTouchDock() {
    var dock = document.getElementById('touch-dock');
    if (!dock) return;
    var buttons = dock.querySelectorAll('[data-key]');
    Array.prototype.forEach.call(buttons, function (btn) {
      var codes = btn.getAttribute('data-key').split(' ');
      function fire(type) {
        codes.forEach(function (code) {
          window.dispatchEvent(new KeyboardEvent(type, {
            code: code,
            key: code === 'Space' ? ' ' : code,
            bubbles: true,
            cancelable: true
          }));
        });
      }
      function down(e) {
        e.preventDefault();
        btn.classList.add('is-active');
        if (btn.setPointerCapture && e.pointerId !== undefined) {
          try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        }
        fire('keydown');
        Arcade.audio.unlock();
      }
      function up() {
        btn.classList.remove('is-active');
        fire('keyup');
      }
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
    });
  }

  function toggleFullscreen() {
    var stage = document.getElementById('stage');
    if (!stage) return;
    if (document.fullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen().catch(function () {});
    } else if (stage.requestFullscreen) {
      stage.requestFullscreen().catch(function () { toast('当前浏览器不支持全屏'); });
    } else {
      toast('当前浏览器不支持全屏');
    }
  }

  function syncFs() {
    var btn = document.getElementById('fs-btn');
    if (!btn) return;
    var isFs = !!document.fullscreenElement;
    btn.textContent = isFs ? '⤡' : '⛶';
    btn.title = isFs ? '退出全屏 (F)' : '全屏 (F)';
  }

  /* ---------- 路由 ---------- */
  function renderOrigin() {
    currentGame = null;
    window.__host = null;
    if (host) { host.destroy(); host = null; }
    document.title = '初心 · R`s GAME BOX';
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
    var chapters = [
      ['01', '为爱发电', '一个人、一台电脑、一堆想玩的类型。没有 KPI，也没有广告位，只把喜欢的玩法做出来。'],
      ['02', '没有广告', '不弹窗、不插屏、不诱导下载。打开就是游戏，关掉就是结束。'],
      ['03', '无账号也存档', '最高分、收藏和音乐状态都只留在你自己的浏览器里，不上传、不追踪。'],
      ['04', '一直加新游戏', '从贪吃蛇到中国象棋，从开源项目到原创玩法，盒子会继续长大。']
    ];
    var chaptersHtml = chapters.map(function (c, i) {
      return '<article class="origin-chapter" data-reveal style="--i:' + i + '">' +
        '<span class="origin-chapter__num">' + c[0] + '</span>' +
        '<h3>' + c[1] + '</h3>' +
        '<p>' + c[2] + '</p>' +
      '</article>';
    }).join('');
    app.innerHTML =
      '<section class="view view--origin" id="view-origin">' +
        '<div class="origin-hero" style="--origin-bg:url(\'/assets/img/games/hero.webp\')">' +
          '<div class="origin-hero__glow" aria-hidden="true"></div>' +
          '<p class="origin-kicker">01 / ORIGIN — R`s GAME BOX</p>' +
          '<h1 class="origin-title"><span>FOR THE</span><span><em>LOVE</em> OF</span><span>PLAY.</span></h1>' +
          '<p class="origin-lead">一个没有广告、没有内购、没有追踪的小游戏盒子。<br>做它，只是因为玩游戏的快乐本身。</p>' +
          '<div class="origin-hero__foot">' +
            '<a class="origin-cta" href="#/">进入游戏盒 <span aria-hidden="true">→</span></a>' +
            '<span class="origin-scroll">SCROLL TO READ ↓</span>' +
          '</div>' +
        '</div>' +
        '<div class="origin-marquee" aria-hidden="true"><div class="origin-marquee__track"><span>NO ADS · NO PAYWALL · NO TRACKING · JUST PLAY · </span><span>NO ADS · NO PAYWALL · NO TRACKING · JUST PLAY · </span></div></div>' +
        '<section class="origin-manifesto" data-reveal>' +
          '<p class="origin-index">01.1 / WHY THIS BOX</p>' +
          '<h2>NO ADS.<br>NO PAYWALL.<br><em>JUST PLAY.</em></h2>' +
          '<p class="origin-copy">很多小游戏网站，打开先看广告，点错就下载 App，玩到一半弹出充值。这个盒子想证明另一条路是可行的：纯前端、免费、无广告、没有后端，也能装下 23 款完整的小游戏。</p>' +
          '<div class="origin-stats">' +
            '<div><strong>23</strong><span>款游戏</span></div>' +
            '<div><strong>0</strong><span>条广告</span></div>' +
            '<div><strong>∞</strong><span>次重玩</span></div>' +
          '</div>' +
        '</section>' +
        '<section class="origin-chapters">' + chaptersHtml + '</section>' +
        '<section class="origin-quote" data-reveal>' +
          '<p class="origin-index">01.2 / A NOTE FROM THE MAKER</p>' +
          '<blockquote>“如果游戏是快乐的，<br>那它不该被广告打断。”</blockquote>' +
          '<p>—— Rz，R`s GAME BOX 作者</p>' +
        '</section>' +
        '<section class="origin-log" data-reveal>' +
          '<p class="origin-index">01.3 / BUILD LOG</p>' +
          '<div class="origin-log__grid">' +
            '<div><span>2026.10</span><strong>17</strong><p>第一版上线：纯前端小游戏合集，无广告、无后端。</p></div>' +
            '<div><span>2026.11</span><strong>23</strong><p>加入圆环、液态玻璃、抽卡、音乐播放器和三款大师 AI。</p></div>' +
            '<div><span>NEXT</span><strong>∞</strong><p>继续加游戏，也继续把选择权留给玩家。</p></div>' +
          '</div>' +
        '</section>' +
        '<a class="origin-next" href="#/next" data-cube="next">NEXT / 未来计划 <span aria-hidden="true">→</span></a>' +
      '</section>';
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function renderNext() {
    currentGame = null;
    window.__host = null;
    if (host) { host.destroy(); host = null; }
    document.title = '未来 · R`s GAME BOX';
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
    var ideas = [
      ['01', '更多开源游戏', '从 GitHub 挑选更多 MIT / GPL 好项目，本地化后装进盒子。'],
      ['02', '成就与排行', '本地成就系统，以及可选的轻量在线排行。'],
      ['03', '手机离线 PWA', '缓存全部小游戏，添加到主屏幕，断网也能玩。'],
      ['04', '双人对战', '同屏双人、手柄支持，以及更多本地多人玩法。'],
      ['05', '自定义主题', '液态玻璃、像素、极简、复古街机，自己选。'],
      ['06', '社区共创', '你提想法，作者来做；也欢迎直接提交 PR。']
    ];
    var ideasHtml = ideas.map(function (x, i) {
      return '<article class="next-item" data-reveal style="--i:' + i + '">' +
        '<span class="next-item__num">' + x[0] + '</span>' +
        '<h3>' + x[1] + '</h3>' +
        '<p>' + x[2] + '</p>' +
        '<span class="next-item__state">PLANNED</span>' +
      '</article>';
    }).join('');
    app.innerHTML =
      '<section class="view view--next" id="view-next">' +
        '<div class="next-hero">' +
          '<p class="next-kicker">03 / NEXT — ROADMAP</p>' +
          '<h1 class="next-title"><span>WHAT`S</span><span><em>NEXT?</em></span></h1>' +
          '<p class="next-lead">盒子还在长大。这里是没有做完的清单，<br>也是你可以参与的部分。</p>' +
          '<span class="origin-scroll">SCROLL TO EXPLORE ↓</span>' +
        '</div>' +
        '<div class="origin-marquee next-marquee" aria-hidden="true"><div class="origin-marquee__track"><span>BUILD IN PUBLIC · PLAY FOREVER · YOUR IDEA NEXT · </span><span>BUILD IN PUBLIC · PLAY FOREVER · YOUR IDEA NEXT · </span></div></div>' +
        '<section class="next-roadmap" data-reveal>' +
          '<p class="origin-index">03.1 / THE ROADMAP</p>' +
          '<h2>THE BOX<br><em>KEEPS GROWING.</em></h2>' +
          '<div class="next-grid">' + ideasHtml + '</div>' +
        '</section>' +
        '<section class="next-poll" data-reveal>' +
          '<p class="origin-index">03.1 / VOTE</p>' +
          '<h2 class="next-poll__title">下一款，<br><em>你说了算。</em></h2>' +
          '<p class="next-note">本地投票 · 不会上传任何数据，只用来记录你的偏好。</p>' +
          '<div class="poll-options">' +
            '<button type="button" class="poll-option" data-poll="games"><span>更多新游戏</span><b>42%</b></button>' +
            '<button type="button" class="poll-option" data-poll="online"><span>联机对战</span><b>31%</b></button>' +
            '<button type="button" class="poll-option" data-poll="offline"><span>手机离线 PWA</span><b>27%</b></button>' +
          '</div>' +
          '<p class="poll-result" id="poll-result">选一个你最想要的方向。</p>' +
        '</section>' +
        '<section class="next-wish" data-reveal>' +
          '<p class="origin-index">03.2 / YOUR TURN</p>' +
          '<h2>你的建议，<br><em>会变成下一款游戏。</em></h2>' +
          '<p class="next-note">这里没有后端，也不会偷偷上传。写下想法，生成一张建议卡，复制后发给作者。</p>' +
          '<form class="idea-form" id="idea-form">' +
            '<label class="idea-field"><span>怎么称呼你</span><input name="name" maxlength="24" placeholder="匿名玩家" autocomplete="off"></label>' +
            '<label class="idea-field"><span>想玩什么 / 想改什么</span><textarea name="idea" rows="4" maxlength="500" placeholder="例如：希望加入双人坦克大战，或者一个能联机的五子棋…" required></textarea></label>' +
            '<button class="btn btn-primary idea-submit" type="submit">生成建议卡 <span aria-hidden="true">→</span></button>' +
          '</form>' +
          '<div class="idea-result" id="idea-result" hidden></div>' +
        '</section>' +
        '<a class="origin-next" href="#/" data-cube="games">BACK TO THE BOX <span aria-hidden="true">→</span></a>' +
      '</section>';
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function route() {
    var raw = location.hash.replace(/^#\/?/, '');
    var parts = raw.split('/');
    if (parts[0] === 'origin') { renderOrigin(); return; }
    if (parts[0] === 'next') { renderNext(); return; }
    if (parts[0] === 'play' && parts[1]) {
      var game = Arcade.getGame(decodeURIComponent(parts[1]));
      if (game) {
        renderPlay(game);
        return;
      }
    }
    renderHub();
  }

  /* ---------- 全局 ---------- */
  function setupMusicPlayer() {
    /* 新版展厅以 iframe 嵌入 #/play 时不启动旧站播放器/旧开场外壳 */
    if (document.documentElement.classList.contains('is-embed')) return;
    var tracks = window.ARCADE_TRACKS || [];
    var audio = document.getElementById('site-bgm');
    var panel = document.getElementById('music-player');
    var listEl = document.getElementById('mp-list');
    var titleEl = document.getElementById('mp-title');
    var artistEl = document.getElementById('mp-artist');
    var playBtn = document.getElementById('mp-play');
    var muteBtn = document.getElementById('mp-mute');
    var loopBtn = document.getElementById('mp-loop');
    var seek = document.getElementById('mp-seek');
    var curEl = document.getElementById('mp-current');
    var durEl = document.getElementById('mp-duration');
    var headerBtn = document.getElementById('music-toggle');
    var closeBtn = document.getElementById('mp-close');
    if (!tracks.length || !audio || !panel) return;

    /* 每次进入站点随机选一首 */
    var idx = Math.floor(Math.random() * tracks.length);
    var on = Arcade.store.get('music.on', true) !== false;
    var muted = Arcade.store.get('music.muted', false) === true;
    var loopMode = Arcade.store.get('music.loop', 'list') === 'one' ? 'one' : 'list';
    var pending = false;
    var dragging = false;
    audio.volume = 0.32;
    audio.muted = muted;
    audio.loop = false;

    function fmt(sec) {
      sec = Math.max(0, Math.floor(Number(sec) || 0));
      return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2);
    }
    function track() { return tracks[idx]; }

    /* 播放器拖动（桌面端；手机端关闭，避免与滚动冲突） */
    var canDragPlayer = !document.documentElement.classList.contains('is-mobile');
    var dragState = null;
    function clampPos(x, y) {
      var r = panel.getBoundingClientRect();
      var maxX = Math.max(0, innerWidth - r.width - 8);
      var maxY = Math.max(0, innerHeight - r.height - 8);
      return { x: Math.min(Math.max(8, x), maxX), y: Math.min(Math.max(8, y), maxY) };
    }
    function setPlayerPos(x, y) {
      var p = clampPos(x, y);
      panel.classList.add('is-moved');
      panel.style.left = p.x + 'px';
      panel.style.top = p.y + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      Arcade.store.set('music.pos', p);
    }
    var savedPos = canDragPlayer ? Arcade.store.get('music.pos', null) : null;
    if (savedPos && typeof savedPos.x === 'number' && typeof savedPos.y === 'number') {
      setTimeout(function () { setPlayerPos(savedPos.x, savedPos.y); }, 0);
    }
    if (!canDragPlayer) {
      panel.classList.remove('is-moved', 'is-dragging');
      panel.style.removeProperty('left'); panel.style.removeProperty('top');
    }
    if (canDragPlayer) panel.querySelector('.mp-main').addEventListener('pointerdown', function (e) {
      if (e.target.closest('button,input,a')) return;
      var r = panel.getBoundingClientRect();
      dragState = { dx: e.clientX - r.left, dy: e.clientY - r.top, id: e.pointerId };
      panel.classList.add('is-dragging');
      panel.setPointerCapture && panel.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    document.addEventListener('pointermove', function (e) {
      if (!dragState || e.pointerId !== dragState.id) return;
      setPlayerPos(e.clientX - dragState.dx, e.clientY - dragState.dy);
    });
    document.addEventListener('pointerup', function (e) {
      if (!dragState || e.pointerId !== dragState.id) return;
      dragState = null;
      panel.classList.remove('is-dragging');
    });
    addEventListener('resize', function () {
      if (panel.classList.contains('is-moved')) {
        var r = panel.getBoundingClientRect();
        setPlayerPos(r.left, r.top);
      }
    });

    function renderList() {
      listEl.innerHTML = tracks.map(function (t, i) {
        return '<button type="button" class="mp-track' + (i === idx ? ' is-active' : '') + '" data-track="' + i + '">' +
          '<span class="mp-track-title">' + esc(t.title) + '</span>' +
          '<span class="mp-track-artist">' + esc(t.artist) + '</span>' +
          '<span class="mp-track-dur">' + fmt(t.duration) + '</span>' +
        '</button>';
      }).join('');
    }

    function paint() {
      var playing = !audio.paused && !audio.ended;
      titleEl.textContent = track().title;
      artistEl.textContent = track().artist;
      playBtn.textContent = playing ? '⏸' : '▶';
      playBtn.setAttribute('aria-label', playing ? '暂停' : '播放');
      muteBtn.textContent = muted ? '🔇' : '🔊';
      if (loopBtn) {
        loopBtn.textContent = loopMode === 'one' ? '🔂' : '🔁';
        loopBtn.title = loopMode === 'one' ? '单曲循环' : '列表循环';
        loopBtn.setAttribute('aria-label', loopBtn.title);
      }
      headerBtn.classList.toggle('is-on', playing);
      headerBtn.classList.toggle('is-off', !on);
      panel.classList.toggle('is-playing', playing);
      Array.prototype.forEach.call(listEl.children, function (b, i) {
        b.classList.toggle('is-active', i === idx);
      });
    }

    function play() {
      on = true;
      Arcade.store.set('music.on', true);
      Arcade.audio.unlock();
      var p = audio.play();
      if (p && p.catch) p.catch(function () { pending = true; paint(); });
      paint();
    }

    function pause() {
      on = false;
      Arcade.store.set('music.on', false);
      audio.pause();
      paint();
    }

    function load(i, shouldPlay) {
      idx = ((i % tracks.length) + tracks.length) % tracks.length;
      Arcade.store.set('music.track', idx);
      audio.src = track().src;
      audio.load();
      curEl.textContent = '0:00';
      durEl.textContent = fmt(track().duration);
      seek.value = 0;
      renderList();
      paint();
      if (shouldPlay) play();
    }

    playBtn.addEventListener('click', function () {
      if (audio.paused) play(); else pause();
    });
    document.getElementById('mp-prev').addEventListener('click', function () { load(idx - 1, true); });
    document.getElementById('mp-next').addEventListener('click', function () { load(idx + 1, true); });
    if (loopBtn) loopBtn.addEventListener('click', function () {
      loopMode = loopMode === 'one' ? 'list' : 'one';
      Arcade.store.set('music.loop', loopMode);
      paint();
    });
    document.getElementById('mp-mute').addEventListener('click', function () {
      muted = !muted;
      audio.muted = muted;
      Arcade.store.set('music.muted', muted);
      paint();
    });
    document.getElementById('mp-list-btn').addEventListener('click', function () {
      listEl.hidden = !listEl.hidden;
    });
    listEl.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.mp-track') : null;
      if (!btn) return;
      load(Number(btn.getAttribute('data-track')) || 0, true);
    });
    closeBtn.addEventListener('click', function () {
      panel.classList.add('is-collapsed');
      headerBtn.setAttribute('aria-expanded', 'false');
    });
    headerBtn.addEventListener('click', function () {
      panel.classList.toggle('is-collapsed');
      headerBtn.setAttribute('aria-expanded', panel.classList.contains('is-collapsed') ? 'false' : 'true');
    });

    seek.addEventListener('pointerdown', function () { dragging = true; });
    document.addEventListener('pointerup', function () { dragging = false; });
    seek.addEventListener('input', function () {
      var d = audio.duration;
      if (!isFinite(d) || d <= 0) d = track().duration;
      var t = (Number(seek.value) / 1000) * d;
      if (isFinite(t)) {
        audio.currentTime = Math.min(t, d);
        curEl.textContent = fmt(t);
      }
    });
    audio.addEventListener('timeupdate', function () {
      var d = audio.duration;
      if (!isFinite(d) || d <= 0) d = track().duration;
      if (d > 0 && !dragging) {
        seek.value = Math.round((audio.currentTime / d) * 1000);
        curEl.textContent = fmt(audio.currentTime);
      }
    });
    audio.addEventListener('loadedmetadata', function () {
      if (isFinite(audio.duration) && audio.duration > 0) durEl.textContent = fmt(audio.duration);
    });
    audio.addEventListener('ended', function () {
      if (loopMode === 'one') { audio.currentTime = 0; play(); }
      else load(idx + 1, true);
    });
    audio.addEventListener('play', paint);
    audio.addEventListener('pause', paint);

    /* 默认开启：浏览器拦截自动播放时，等访问者第一次点击页面再启动 */
    document.addEventListener('pointerdown', function () {
      if (on && audio.paused && pending) {
        pending = false;
        var p = audio.play();
        if (p && p.catch) p.catch(function () {});
        paint();
      }
    });

    renderList();
    load(idx, on);
  }

  function bindGlobal() {
    syncSound();
    setupMusicPlayer();
    soundBtn.addEventListener('click', function () {
      Arcade.audio.unlock();
      var muted = Arcade.audio.toggleMuted();
      syncSound();
      if (!muted) Arcade.audio.play('toggle');
      toast(muted ? '已静音' : '音效已开启');
    });
    randomBtn.addEventListener('click', randomGame);

    document.addEventListener('pointerdown', function once() {
      Arcade.audio.unlock();
      document.removeEventListener('pointerdown', once);
    });

    window.addEventListener('keydown', function (e) {
      if (e.code === 'Slash' && !currentGame) {
        var target = e.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        var input = document.getElementById('game-search');
        if (input) { e.preventDefault(); input.focus(); }
      }
      if (e.code === 'KeyF' && currentGame) {
        var target2 = e.target;
        if (target2 && (target2.tagName === 'INPUT' || target2.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        toggleFullscreen();
      }
    });

    document.addEventListener('fullscreenchange', syncFs);
    window.addEventListener('hashchange', route);

    if (!games.length) {
      app.innerHTML = '<div class="empty-state" style="margin-top:80px"><span class="empty-state__icon">🕹️</span>' +
        '<h3>游戏加载失败</h3><p>请确认 src/games/ 下的游戏脚本已正确加载。</p></div>';
      return;
    }
    route();
  }

  bindGlobal();
})();
