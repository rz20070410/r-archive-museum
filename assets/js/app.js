/* ==========================================================================
   R ARCHIVE · app.js
   应用外壳：hash 路由、页面挂载/卸载、站点头尾交互、移动端菜单、开场调度。
   视图契约：window.XxxView = { mount(rootEl, params), unmount() }
   ========================================================================== */
(function () {
  'use strict';

  var Museum = window.Museum;
  if (!Museum) {
    console.error('[silver-arcade] core/util.js 未加载');
    return;
  }
  var U = Museum.util;
  var app = document.getElementById('app');
  var header = document.getElementById('site-header');
  var footer = document.getElementById('site-footer');
  var mobileNav = document.getElementById('mobile-nav');
  var burger = document.getElementById('nav-burger');

  var currentView = null;
  var currentName = null;
  var currentParams = null;
  var booted = false;

  var ROUTES = ['home', 'hall', 'game', 'play', 'books', 'sculptures', 'history', 'licenses'];

  var TITLES = {
    home: 'R-数字藏馆 · R ARCHIVE — 黑银游戏艺术馆',
    hall: '游戏展映 · R ARCHIVE',
    game: '展品详情 · R ARCHIVE',
    play: '游戏舞台 · R ARCHIVE',
    books: '书籍 · R-数字藏馆', sculptures:'数字雕塑 · R-数字藏馆', history:'开发历史 · R-数字藏馆',
    licenses: '开源许可 · R ARCHIVE'
  };

  function parseHash() {
    var raw = String(location.hash || '').replace(/^#\/?/, '');
    var parts = raw.split('/').filter(Boolean);
    var name = parts[0] || 'home';
    if(name === 'novels') name = 'books';
    if (ROUTES.indexOf(name) < 0) name = 'notfound';
    var params = {};
    if (name === 'game' || name === 'play') {
      params.id = parts[1] ? decodeURIComponent(parts[1]) : '';
      if (!params.id) name = 'hall';
    }
    return { name: name, params: params };
  }

  function viewFor(name) {
    switch (name) {
      case 'home': return window.HomeView;
      case 'hall': return window.CinemaView;
      case 'game': return window.CinemaView;
      case 'books': return window.BooksView;
      case 'sculptures': return window.SculptureView;
      case 'history': return window.HistoryView;
      case 'licenses': return window.LicensesView;
      case 'play': return window.PlayStage;
      case 'notfound': return window.NotFoundView;
      default: return null;
    }
  }

  function setActiveNav(name) {
    var active = name === 'game' || name === 'play' ? 'hall' : name;
    U.$$('[data-nav]').forEach(function (link) {
      var target = link.getAttribute('data-nav');
      link.classList.toggle('is-active', target === active);
      if (link.closest('.site-nav') || link.closest('.mobile-nav')) {
        if (target === active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
    });
  }

  function closeMobileNav() {
    if (!mobileNav || mobileNav.hidden) return;
    mobileNav.classList.remove('is-open');
    mobileNav.hidden = true;
    if (burger) {
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', '打开菜单');
    }
    Museum.lockScroll(false);
  }

  function openMobileNav() {
    if (!mobileNav) return;
    mobileNav.hidden = false;
    requestAnimationFrame(function () { mobileNav.classList.add('is-open'); });
    if (burger) {
      burger.setAttribute('aria-expanded', 'true');
      burger.setAttribute('aria-label', '关闭菜单');
    }
    Museum.lockScroll(true);
  }

  function teardown() {
    if (currentView && typeof currentView.unmount === 'function') {
      try { currentView.unmount(); } catch (err) { console.error('[silver-arcade] 视图卸载失败:', currentName, err); }
    }
    currentView = null;
    document.body.classList.remove('is-stage', 'detail-open');
    var stageCanvas = document.querySelector('.webgl-stage');
    if (stageCanvas && stageCanvas.parentNode) stageCanvas.parentNode.removeChild(stageCanvas);
    if (app) app.innerHTML = '';
  }

  function renderError(node, error) {
    console.error('[silver-arcade] 路由渲染失败:', error);
    if (!node) return;
    node.innerHTML = '<section class="view page-error" data-view="error">' +
      '<p class="kicker">SYSTEM / 500</p>' +
      '<h1 class="error-title">展厅暂时失去信号</h1>' +
      '<p class="lede">本地渲染出现异常，请刷新页面重试。若反复出现，请查看浏览器控制台。</p>' +
      '<a class="btn btn-line" href="#/">返回首页</a></section>';
  }

  function mountRoute(parsed) {
    teardown();
    var view = viewFor(parsed.name);
    currentName = parsed.name;
    currentParams = parsed.params;
    Museum.route = { name: parsed.name === 'notfound' ? 'notfound' : parsed.name, params: parsed.params };
    document.body.setAttribute('data-view', parsed.name);
    document.body.classList.toggle('is-stage', parsed.name === 'play');
    document.title = TITLES[parsed.name] || TITLES.home;
    setActiveNav(parsed.name);
    closeMobileNav();

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    window.__MUSEUM_ROUTE__ = { view: parsed.name, params: parsed.params };

    if (!view || typeof view.mount !== 'function') {
      var fallback = window.NotFoundView;
      if (fallback && typeof fallback.mount === 'function') {
        currentView = fallback;
        fallback.mount(app, parsed.params);
      } else {
        renderError(app, new Error('视图未加载: ' + parsed.name));
        return;
      }
    } else {
      currentView = view;
      try {
        view.mount(app, parsed.params);
      } catch (err) {
        renderError(app, err);
        return;
      }
    }

    currentName = parsed.name;
    Museum.events.emit('route:change', { name: parsed.name, params: parsed.params });
    Museum.events.emit('route:mounted', { name: parsed.name, params: parsed.params, root: app });
    if (header) header.classList.toggle('is-solid', window.scrollY > 24);
    window.__MUSEUM_READY__ = true;
  }

  function route(force) {
    var parsed = parseHash();
    if (!booted) {
      booted = true;
      /* 开场先于首页挂载：首页组件能正确等待揭开 */
      if (parsed.name === 'home') {
        if (window.Museum && Museum.intro) Museum.intro.play(false);
      } else {
        document.body.classList.add('intro-done');
      }
      mountRoute(parsed);
      Museum.events.emit('boot:ready', { view: parsed.name, params: parsed.params });
      return;
    }
    window.cancelFilmCut();
    if (!force && Museum.route.name === parsed.name &&
        JSON.stringify(Museum.route.params) === JSON.stringify(parsed.params)) {
      Museum.events.emit('route:same', parsed);
      return;
    }
    const labels={home:['ARCHIVE','首页'],hall:['COLLECTION','游戏展映'],books:['LIBRARY','书籍'],history:['CHRONICLE','开发手记'],sculptures:['FORM','数字雕塑'],play:['PLAY','进入游戏'],licenses:['CREDITS','致谢']};
    const g=(window.MUSEUM_GAMES.games||[]).find(x=>x.id===parsed.params.id);
    const isDetail=parsed.name==='game' && g;
    const label=isDetail?[window.ArchiveFilmTitle(g),g.title]:(labels[parsed.name]||['ARCHIVE','藏馆']);
    const origin=isDetail?document.querySelector('.ghost-type')||document.activeElement||document.body:null;
    window.filmCut(label[0],label[1],()=>mountRoute(parsed),origin);
  }

  function bindShell() {
    U.on(window, 'hashchange', function () { route(); });

    if (burger) {
      burger.addEventListener('click', function () {
        if (mobileNav && !mobileNav.hidden) closeMobileNav(); else openMobileNav();
      });
    }
    if (mobileNav) {
      U.$$('a', mobileNav).forEach(function (link) {
        link.addEventListener('click', function () { closeMobileNav(); });
      });
    }

    var replay = document.getElementById('replay-intro');
    if (replay) {
      replay.addEventListener('click', function () {
        var begin = function () { if (Museum.intro) Museum.intro.play(true); };
        if (Museum.route.name !== 'home') {
          Museum.go('home');
          setTimeout(begin, 180);
        } else {
          begin();
        }
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (mobileNav && !mobileNav.hidden) { closeMobileNav(); return; }
      }
      if (e.defaultPrevented) return;
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === '/' && Museum.route.name === 'hall') {
        var search = document.getElementById('hall-search');
        if (search) { e.preventDefault(); search.focus(); search.select && search.select(); }
      }
    });

    U.on(window, 'resize', U.debounce(function () {
      if (window.innerWidth > 820) closeMobileNav();
    }, 120));

    U.on(document, 'visibilitychange', function () {
      Museum.events.emit('visibility:change', { hidden: document.hidden });
    });
  }

  /* ---------- 启动 ---------- */
  bindShell();
  route(true);

  /* 一些老页面/外部链接可能带 #games 等锚点，统一回首页 */
  if (!location.hash) {
    try { history.replaceState(null, '', location.pathname + location.search + '#/'); } catch (e) {}
  }
})();
