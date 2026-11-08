/* ==========================================================================
   R ARCHIVE · novels.js — 书籍阅览室（#/novels）
   --------------------------------------------------------------------------
   window.NovelsView = { mount(rootEl, params), unmount() }

   · 数据：window.MUSEUM_BOOKS（assets/js/data/novels.js），每次 mount 重新读取。
   · 空库（items: []）→ 只展示「筹备中 / IN PREPARATION」空架展陈，不发假书。
   · items 有真实书目 → 渲染书卡网格 + 阅读详情抽屉（封面/简介/章节数）。
   · 只读 DOM + 内联 SVG；无网络请求；经典脚本，无 ES module。
   ========================================================================== */
(function () {
  'use strict';

  var Museum = window.Museum;
  if (!Museum) {
    console.error('[silver-arcade] novels.js 需要先加载 core/util.js');
    return;
  }
  var U = Museum.util;

  var DEFAULT_NOTE = '书架正在装帧，第一本书确定后才会出现在这里。';
  var TONES = { silver: true, ink: true, ice: true };
  var COVER_BASE = 'book-cover';

  var CLOSE_SVG = '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true" focusable="false">' +
    '<path d="M3.2 3.2l9.6 9.6M12.8 3.2L3.2 12.8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';

  var SEAL_SVG = '<svg viewBox="0 0 120 120" fill="none" aria-hidden="true" focusable="false">' +
    '<circle cx="60" cy="60" r="55" stroke="currentColor" stroke-width="0.8" opacity="0.6"/>' +
    '<circle cx="60" cy="60" r="46" stroke="currentColor" stroke-width="0.8" opacity="0.75" stroke-dasharray="1 5"/>' +
    '<path d="M36 77C36 53 49 39 73 39" stroke="currentColor" stroke-width="1.6"/>' +
    '<path d="M44 82C44 62 55 50 75 50" stroke="currentColor" stroke-width="1.2" opacity="0.75"/>' +
    '<path d="M52 87C52 72 61 62 77 62" stroke="currentColor" stroke-width="1.2" opacity="0.5"/>' +
    '<circle cx="73" cy="39" r="2.6" fill="currentColor"/>' +
    '</svg>';

  var state = {
    mounted: false,
    root: null,
    section: null,
    data: null,
    items: [],
    revealOff: null,
    listeners: [],
    keyOff: null,
    routeSameOff: null,
    drawerEl: null,
    drawerPanel: null,
    closeTimer: 0,
    raf: 0,
    locked: false,
    lastFocus: null,
    openedIndex: -1
  };

  /* ======================================================================
     数据归一化：任何字段缺失/类型错误都降级，绝不凭空造书
     ====================================================================== */
  function text(value) {
    if (value == null) return '';
    return String(value).replace(/\s+/g, ' ').trim();
  }

  function safeNum(value) {
    var n = parseInt(value, 10);
    return isFinite(n) && n > 0 ? n : 0;
  }

  function padCount(n) {
    n = Math.max(0, Math.round(Number(n) || 0));
    return n < 10 ? '0' + n : U.formatNumber(n);
  }

  function fmtDate(value) {
    var raw = text(value);
    var m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(raw);
    if (!m) return raw || '—';
    return m[1] + '.' + U.pad2(Number(m[2])) + '.' + U.pad2(Number(m[3]));
  }

  function glyphOf(cover, title) {
    var glyph = text(cover && cover.glyph);
    if (!glyph) glyph = text(title);
    return glyph ? glyph.slice(0, 2) : '';
  }

  function normalizeData() {
    var raw = window.MUSEUM_BOOKS;
    if (!raw || typeof raw !== 'object') raw = {};
    var rawItems = Array.isArray(raw.items) ? raw.items : [];
    var items = [];
    var authors = {};

    rawItems.forEach(function (entry, index) {
      if (!entry || typeof entry !== 'object') return;
      var title = text(entry.title);
      if (!title) return; /* 没有真实书名就不算一本书，直接丢弃 */
      var cover = entry.cover && typeof entry.cover === 'object' ? entry.cover : {};
      var item = {
        id: text(entry.id) || ('novel-' + (index + 1)),
        title: title,
        subtitle: text(entry.subtitle),
        author: text(entry.author),
        category: text(entry.category),
        status: text(entry.status),
        summary: text(entry.summary),
        chapters: safeNum(entry.chapters),
        words: safeNum(entry.words),
        tone: TONES[text(cover.tone)] ? text(cover.tone) : 'silver',
        glyph: glyphOf(cover, title)
      };
      if (item.author) authors[item.author] = true;
      items.push(item);
    });

    var chapters = items.reduce(function (sum, item) { return sum + item.chapters; }, 0);
    var words = items.reduce(function (sum, item) { return sum + item.words; }, 0);

    return {
      status: text(raw.status) === 'ready' ? 'ready' : 'preparing',
      updatedAt: text(raw.updatedAt),
      note: text(raw.note),
      items: items,
      chapters: chapters,
      words: words,
      authorCount: Object.keys(authors).length
    };
  }

  function indexOfId(id) {
    var wanted = text(id);
    if (!wanted) return -1;
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].id === wanted) return i;
    }
    return -1;
  }

  /* ======================================================================
     封面 / 书卡 / 阅读抽屉
     ====================================================================== */
  function statusClass(status) {
    var s = text(status);
    if (/连载|连載|ongoing|serial/i.test(s)) return ' is-ongoing';
    if (/完|完结|done|complete|finished/i.test(s)) return ' is-done';
    return ' is-neutral';
  }

  function coverHtml(item, index, large) {
    var tone = TONES[item.tone] ? item.tone : 'silver';
    var cls = COVER_BASE + ' book-cover--tone-' + tone + (large ? ' book-cover--drawer' : '');
    return '<span class="' + cls + '">' +
        '<span class="book-cover__spine" aria-hidden="true"></span>' +
        '<span class="book-cover__texture" aria-hidden="true"></span>' +
        (item.glyph ? '<span class="book-cover__glyph" aria-hidden="true">' + U.esc(item.glyph) + '</span>' : '') +
        '<span class="book-cover__top">' +
          (item.category
            ? '<span class="book-cover__cat">' + U.esc(item.category) + '</span>'
            : '<span class="book-cover__cat book-cover__cat--empty" aria-hidden="true"></span>') +
          (item.status
            ? '<span class="book-cover__status' + statusClass(item.status) + '"><i aria-hidden="true"></i>' + U.esc(item.status) + '</span>'
            : '') +
        '</span>' +
        '<span class="book-cover__center">' +
          '<span class="book-cover__title">' + U.esc(item.title) + '</span>' +
          '<span class="book-cover__rule" aria-hidden="true"></span>' +
          (item.author ? '<span class="book-cover__author">' + U.esc(item.author) + '</span>' : '') +
        '</span>' +
        '<span class="book-cover__foot">' +
          '<span class="book-cover__no">N°' + U.pad2(index + 1) + '</span>' +
          '<span class="book-cover__imprint">R ARCHIVE</span>' +
        '</span>' +
        '<span class="book-cover__glint" aria-hidden="true"></span>' +
      '</span>';
  }

  function cardHtml(item, index) {
    var chapters = item.chapters > 0 ? U.formatNumber(item.chapters) + ' 章' : '章节未定';
    return '<button type="button" class="book-card" data-book-index="' + index + '"' +
        ' data-reveal style="--d:' + (index % 6) + '"' +
        ' aria-label="打开《' + U.esc(item.title) + '》的阅读详情">' +
        '<span class="book-card__frame">' +
          coverHtml(item, index, false) +
          '<span class="book-card__meta">' +
            '<span class="book-card__chapters">' + U.esc(chapters) + '</span>' +
            '<span class="book-card__open">阅读详情 <i aria-hidden="true">↗</i></span>' +
          '</span>' +
        '</span>' +
      '</button>';
  }

  function drawerHtml(item, index) {
    var chips = '';
    if (item.category) chips += '<span class="novel-chip">' + U.esc(item.category) + '</span>';
    if (item.status) chips += '<span class="novel-chip novel-chip--status' + statusClass(item.status) + '"><i aria-hidden="true"></i>' + U.esc(item.status) + '</span>';

    var summary = item.summary || '这本书的简介尚未公开。';

    return '<div class="novel-drawer__bar">' +
        '<span class="novel-drawer__index">EX LIBRIS · N°' + U.pad2(index + 1) + '</span>' +
        '<button type="button" class="icon-btn novel-drawer__close" data-drawer-close aria-label="关闭阅读详情">' + CLOSE_SVG + '</button>' +
      '</div>' +
      '<div class="novel-drawer__scroll">' +
        '<div class="novel-drawer__top">' +
          '<div class="novel-drawer__cover">' + coverHtml(item, index, true) + '</div>' +
          '<div class="novel-drawer__ident">' +
            '<p class="novel-drawer__kicker">R ARCHIVE · 书目</p>' +
            '<h2 class="novel-drawer__title" id="novel-drawer-title">' + U.esc(item.title) + '</h2>' +
            (item.subtitle ? '<p class="novel-drawer__subtitle">' + U.esc(item.subtitle) + '</p>' : '') +
            (item.author ? '<p class="novel-drawer__author">' + U.esc(item.author) + '</p>' : '') +
            (chips ? '<div class="novel-drawer__chips">' + chips + '</div>' : '') +
          '</div>' +
        '</div>' +
        '<hr class="hairline">' +
        '<p class="novel-drawer__summary" id="novel-drawer-summary">' + U.esc(summary) + '</p>' +
        '<dl class="novel-drawer__facts">' +
          '<div class="novel-fact"><dt>章节 <em>CHAPTERS</em></dt><dd>' +
            (item.chapters > 0 ? U.formatNumber(item.chapters) + ' 章' : '未定') + '</dd></div>' +
          '<div class="novel-fact"><dt>字数 <em>WORDS</em></dt><dd>' +
            (item.words > 0 ? U.formatNumber(item.words) + ' 字' : '未定') + '</dd></div>' +
        '</dl>' +
        '<p class="novel-drawer__note">阅读器将在书籍正式上架后开放 · 当前仅展示书目信息</p>' +
      '</div>';
  }

  /* ======================================================================
     页面骨架：阅览室 hero + 筹备中空架展陈 / 书目网格 + 守则 + 收尾
     ====================================================================== */
  function slotHtml(no, tier, col) {
    var first = tier === 1 && col === 1;
    return '<span class="novels-shelf__slot' + (first ? ' novels-shelf__slot--first' : '') + '">' +
        '<span class="novels-shelf__engrave">' +
          (first ? '<i>第 一 本 书</i><em>FIRST BOOK</em>' : '<span>筹备中</span>') +
        '</span>' +
        '<span class="novels-shelf__no" aria-hidden="true">' + U.pad2(no) + '</span>' +
        (first ? '<span class="novels-shelf__bookmark" aria-hidden="true"><i>R ARCHIVE</i></span>' : '') +
      '</span>';
  }

  function shelfHtml() {
    var tiers = '';
    var no = 0;
    for (var tier = 0; tier < 2; tier++) {
      var slots = '';
      for (var col = 0; col < 3; col++) slots += slotHtml(++no, tier, col);
      tiers += '<div class="novels-shelf__tier">' +
          '<div class="novels-shelf__niche">' + slots + '</div>' +
          '<div class="novels-shelf__board" aria-hidden="true"></div>' +
        '</div>';
    }
    return '<figure class="novels-shelf" data-reveal>' +
        '<div class="novels-shelf__frame" aria-hidden="true">' +
          '<div class="novels-shelf__scene">' +
            '<div class="novels-shelf__body">' +
              '<div class="novels-shelf__top">' +
                '<span class="novels-shelf__plate">R ARCHIVE · READING ROOM</span>' +
                '<span class="novels-shelf__plateno">N°01</span>' +
              '</div>' +
              tiers +
              '<div class="novels-shelf__base" aria-hidden="true"></div>' +
              '<div class="novels-shelf__foot">' +
                '<span>SHELF · 00</span>' +
                '<span class="novels-shelf__foot-mark" aria-hidden="true">◠</span>' +
                '<span>EMPTY / 空架</span>' +
              '</div>' +
              '<span class="novels-shelf__light" aria-hidden="true"></span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<figcaption class="novels-shelf__caption">' +
          '<span>空架 · EMPTY SHELF N°01</span>' +
          '<span>六格空位，等待第一本书</span>' +
        '</figcaption>' +
      '</figure>';
  }

  function sealedCardHtml() {
    return '<div class="sealed-card" data-reveal style="--d:1">' +
        '<div class="sealed-card__inner">' +
          '<div class="sealed-card__head"><span>EX LIBRIS</span><span>SEAL · 001</span></div>' +
          '<div class="sealed-card__seal" aria-hidden="true">' + SEAL_SVG + '</div>' +
          '<p class="sealed-card__title">尚未启封</p>' +
          '<p class="sealed-card__en">SEALED UNTIL THE FIRST BOOK</p>' +
          '<div class="sealed-card__foot"><span>藏书票 · 保留</span><span>NO. 0001</span></div>' +
        '</div>' +
      '</div>';
  }

  function ledgerStepHtml(no, name, en) {
    return '<li class="ledger__step">' +
        '<span class="ledger__no">' + no + '</span>' +
        '<span class="ledger__name">' + name + '</span>' +
        '<span class="ledger__en">' + en + '</span>' +
        '<span class="ledger__dots" aria-hidden="true"></span>' +
        '<span class="ledger__state">待定</span>' +
      '</li>';
  }

  function ledgerHtml() {
    return '<div class="ledger" data-reveal style="--d:2">' +
        '<div class="ledger__head">' +
          '<span class="ledger__title">装帧流程</span>' +
          '<span class="ledger__en-head">BINDING PROCESS</span>' +
        '</div>' +
        '<ol class="ledger__steps">' +
          ledgerStepHtml('01', '封面', 'COVER') +
          ledgerStepHtml('02', '章节', 'CHAPTERS') +
          ledgerStepHtml('03', '校对', 'PROOF') +
        '</ol>' +
        '<p class="ledger__note">流程尚未开始 · 不预设书名、作者与日期</p>' +
      '</div>';
  }

  function oathHtml() {
    return '<blockquote class="novels-oath" data-reveal style="--d:3">' +
        '<span class="novels-oath__mark" aria-hidden="true">“</span>' +
        '<p class="novels-oath__quote">' +
          '<span>第一本书确定之后，</span>' +
          '<span>才会出现在这个架子上。</span>' +
        '</p>' +
        '<p class="novels-oath__note">NO SAMPLE BOOKS · NO PLACEHOLDERS</p>' +
      '</blockquote>';
  }

  function emptySectionHtml(data) {
    return '<div class="novels-empty" data-novels-empty>' +
        '<section class="novels-prep shell" aria-labelledby="novels-prep-title">' +
          '<header class="novels-prep__head">' +
            '<div class="novels-prep__headline">' +
              '<p class="kicker kicker--ice">EMPTY LIBRARY · 空架</p>' +
              '<h2 class="novels-prep__title" id="novels-prep-title">' +
                '<span class="novels-prep__cn"><span class="mask-line"><span>筹备中</span></span></span>' +
                '<span class="novels-prep__en display"><em>IN PREPARATION</em></span>' +
              '</h2>' +
            '</div>' +
            '<p class="novels-prep__copy">' + U.esc(data.note || DEFAULT_NOTE) + '</p>' +
          '</header>' +
          '<div class="novels-prep__grid">' +
            shelfHtml() +
            '<div class="novels-prep__side">' + sealedCardHtml() + ledgerHtml() + '</div>' +
          '</div>' +
          oathHtml() +
        '</section>' +
      '</div>';
  }

  function collectionSectionHtml(data, hasBooks) {
    var cards = hasBooks ? data.items.map(cardHtml).join('') : '';
    var notice = (hasBooks && data.status !== 'ready')
      ? '<p class="novels-collection__notice">新书仍在装帧中 · 已上架书目以真实完成为准</p>'
      : '';
    return '<section class="novels-collection shell" data-novels-collection aria-labelledby="novels-collection-title"' +
        (hasBooks ? '' : ' hidden') + '>' +
        '<header class="novels-sec-head">' +
          '<div class="novels-sec-head__main">' +
            '<p class="kicker">COLLECTION · 书目</p>' +
            '<h2 class="novels-sec-title" id="novels-collection-title">书架</h2>' +
          '</div>' +
          '<p class="novels-collection__meta"><span data-collection-count>' + padCount(data.items.length) + '</span> 本 · 真实书目</p>' +
        '</header>' +
        notice +
        '<div class="novels-grid" data-novels-grid>' + cards + '</div>' +
      '</section>';
  }

  function ruleHtml(no, name, en, body) {
    return '<li class="novels-rule" data-reveal>' +
        '<span class="novels-rule__no">' + no + '</span>' +
        '<h3 class="novels-rule__title">' + name + '</h3>' +
        '<p class="novels-rule__en">' + en + '</p>' +
        '<p class="novels-rule__body">' + body + '</p>' +
      '</li>';
  }

  function rulesSectionHtml() {
    return '<section class="novels-rules shell" aria-labelledby="novels-rules-title">' +
        '<header class="novels-sec-head">' +
          '<div class="novels-sec-head__main">' +
            '<p class="kicker">HOUSE RULES · 阅览室守则</p>' +
            '<h2 class="novels-sec-title" id="novels-rules-title">一间诚实的阅览室</h2>' +
          '</div>' +
          '<p class="novels-rules__intro">书架只放真正写完的书。在它到达之前，这里只展示真实。</p>' +
        '</header>' +
        '<ol class="novels-rules__list">' +
          ruleHtml('01', '不虚构书目', 'NO PLACEHOLDERS',
            '空架就是空架。书架只陈列已经确定装帧完成的书，不用样板书占位。') +
          ruleHtml('02', '不做订阅', 'NO SIGNUPS',
            '没有表单、没有邮件、没有通知。书到了，自然会出现在书架上。') +
          ruleHtml('03', '只做阅读', 'READING ONLY',
            '无广告、无追踪、无账号。所有页面在本地运行，不发出任何请求。') +
        '</ol>' +
      '</section>';
  }

  function endSectionHtml(hallLabel, hasBooks, bookCount) {
    return '<section class="novels-end shell">' +
        '<div class="novels-end__rule" aria-hidden="true"></div>' +
        '<div class="novels-end__row">' +
          '<span>' + (hasBooks ? 'OPEN STACKS · 已开架' : 'CLOSED STACKS · 待开架') + '</span>' +
          '<span>' + (hasBooks ? padCount(bookCount) + ' BOOKS / 书目已入库' : 'NO. 00 / 等待第一本书') + '</span>' +
        '</div>' +
        '<div class="novels-end__actions">' +
          '<a class="btn btn-line" href="#/hall" data-magnetic><span>' + U.esc(hallLabel) + '</span><i aria-hidden="true">↗</i></a>' +
          '<a class="btn btn-ghost" href="#/">返回首页</a>' +
        '</div>' +
      '</section>';
  }

  function buildPage(data) {
    var hasBooks = data.items.length > 0;
    var statusLabel = hasBooks ? '已开架' : (data.status === 'ready' ? '待入库' : '筹备中');
    var gameCount = window.MUSEUM_GAMES ? Number(window.MUSEUM_GAMES.count) : 0;
    var hallLabel = gameCount > 0 ? '先去展厅看 ' + gameCount + ' 件藏品' : '先去游戏展厅';

    return '' +
      '<div class="novels-atmosphere" aria-hidden="true">' +
        '<span class="novels-atmosphere__glow"></span>' +
        '<span class="novels-atmosphere__rail">THE READING ROOM · 阅览室 · VOL. 01</span>' +
      '</div>' +

      '<header class="novels-hero shell">' +
        '<div class="novels-hero__meta">' +
          '<p class="kicker">R ARCHIVE · READING ROOM · 03</p>' +
          '<p class="novels-hero__sign">ARCHIVE N°03 / 藏书室</p>' +
        '</div>' +
        '<div class="novels-hero__grid">' +
          '<div class="novels-hero__lead">' +
            '<h1 class="novels-title" id="novels-title">' +
              '<span class="novels-title__cn"><span class="mask-line" style="--d:0"><span>书籍</span></span></span>' +
              '<span class="novels-title__en display"><span class="mask-line" style="--d:1"><span><em>BOOKS</em></span></span></span>' +
            '</h1>' +
            '<p class="novels-hero__sub">THE READING ROOM</p>' +
          '</div>' +
          '<div class="novels-hero__aside">' +
            '<p class="lede">书籍将从这里开始连载。首部作品正在筹备。</p>' +
            '<dl class="novels-meta">' +
              '<div class="novels-meta__row">' +
                '<dt>馆藏 <em>COLLECTION</em></dt>' +
                '<dd><span class="novels-meta__num" data-count="books">' + padCount(data.items.length) + '</span><i>本</i></dd>' +
              '</div>' +
              '<div class="novels-meta__row">' +
                '<dt>状态 <em>STATUS</em></dt>' +
                '<dd class="novels-meta__status"><span class="novels-dot" aria-hidden="true"></span>' + statusLabel + '</dd>' +
              '</div>' +
              '<div class="novels-meta__row">' +
                '<dt>更新 <em>UPDATED</em></dt>' +
                '<dd class="novels-meta__date">' + U.esc(fmtDate(data.updatedAt)) + '</dd>' +
              '</div>' +
            '</dl>' +
          '</div>' +
        '</div>' +
        '<div class="novels-hero__rule" aria-hidden="true"></div>' +
        '<div class="novels-hero__foot">' +
          '<span class="novels-hero__scroll">SCROLL · ' + (hasBooks ? '向下看书目' : '向下看空架') + '</span>' +
          '<span class="novels-hero__vol">THE READING ROOM / VOL. 01</span>' +
        '</div>' +
      '</header>' +

      emptySectionHtml(data) +
      collectionSectionHtml(data, hasBooks) +

      endSectionHtml(hallLabel, hasBooks, data.items.length);
  }

  /* ======================================================================
     阅读抽屉
     ====================================================================== */
  function safeFocus(node) {
    if (!node || typeof node.focus !== 'function') return;
    try { node.focus({ preventScroll: true }); } catch (err) { try { node.focus(); } catch (e) {} }
  }

  function buildDrawer() {
    var el = document.createElement('div');
    el.className = 'novel-drawer';
    el.hidden = true;
    el.innerHTML = '<div class="novel-drawer__scrim" data-drawer-close aria-hidden="true"></div>' +
      '<aside class="novel-drawer__panel" role="dialog" aria-modal="true" tabindex="-1"' +
      ' aria-labelledby="novel-drawer-title" aria-describedby="novel-drawer-summary"></aside>';
    document.body.appendChild(el);
    state.drawerEl = el;
    state.drawerPanel = U.$('.novel-drawer__panel', el);
    state.listeners.push(U.on(el, 'click', function (e) {
      var target = e.target;
      if (target && target.closest && target.closest('[data-drawer-close]')) closeDrawer();
    }));
  }

  function openDrawer(index) {
    var item = state.items[index];
    if (!item || !state.drawerEl || !state.drawerPanel) return;
    if (state.raf) { cancelAnimationFrame(state.raf); state.raf = 0; }
    if (state.closeTimer) { clearTimeout(state.closeTimer); state.closeTimer = 0; }

    var active = document.activeElement;
    state.lastFocus = (active && active !== document.body && active !== document.documentElement) ? active : null;
    state.openedIndex = index;

    state.drawerPanel.innerHTML = drawerHtml(item, index);
    var el = state.drawerEl;
    el.hidden = false;
    if (!Museum.env.reduced()) void el.offsetWidth; /* 先落一帧，滑入过渡才会发生 */
    el.classList.add('is-open');

    if (!state.locked) { Museum.lockScroll(true); state.locked = true; }

    var closeBtn = U.$('[data-drawer-close]', state.drawerPanel);
    safeFocus(closeBtn || state.drawerPanel);

    if (Museum.fx && typeof Museum.fx.refresh === 'function') {
      try { Museum.fx.refresh(el); } catch (err) { /* 细节层可选，不影响抽屉 */ }
    }
  }

  function closeDrawer(instant) {
    var el = state.drawerEl;
    if (!el || el.hidden) return;

    el.classList.remove('is-open');
    if (state.locked) { Museum.lockScroll(false); state.locked = false; }

    var focusTarget = state.lastFocus;
    state.lastFocus = null;
    state.openedIndex = -1;

    if (focusTarget && document.contains(focusTarget)) {
      safeFocus(focusTarget);
    } else if (state.section) {
      safeFocus(U.$('.book-card', state.section));
    }

    if (instant || Museum.env.reduced()) {
      el.hidden = true;
      return;
    }
    state.closeTimer = window.setTimeout(function () {
      state.closeTimer = 0;
      if (state.openedIndex === -1) el.hidden = true;
    }, 560);
  }

  function trapTab(e) {
    var panel = state.drawerPanel;
    if (!panel) return;
    var nodes = U.$$('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])', panel)
      .filter(function (node) { return node.offsetParent !== null || node === document.activeElement; });
    if (!nodes.length) { e.preventDefault(); safeFocus(panel); return; }
    var first = nodes[0];
    var last = nodes[nodes.length - 1];
    var active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !panel.contains(active)) { e.preventDefault(); safeFocus(last); }
    } else if (active === last || !panel.contains(active)) {
      e.preventDefault(); safeFocus(first);
    }
  }

  function onDocumentKeydown(e) {
    var el = state.drawerEl;
    if (!el || el.hidden) return;
    var key = e.key || '';
    if (key === 'Escape' || key === 'Esc' || e.keyCode === 27) {
      e.preventDefault();
      closeDrawer();
      return;
    }
    if (key === 'Tab' || e.keyCode === 9) trapTab(e);
  }

  /* ======================================================================
     事件绑定：空架视差 / 书卡倾斜与光泽 / 卡片打开抽屉
     ====================================================================== */
  function bindShelfTilt(section) {
    var shelf = U.$('.novels-shelf', section);
    if (!shelf || Museum.env.reduced() || Museum.env.coarse()) return;
    state.listeners.push(U.on(shelf, 'pointermove', function (e) {
      if (!state.section) return;
      var r = shelf.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var px = U.clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      var py = U.clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
      state.section.style.setProperty('--tilt-x', px.toFixed(3));
      state.section.style.setProperty('--tilt-y', py.toFixed(3));
    }, { passive: true }));
    state.listeners.push(U.on(shelf, 'pointerleave', function () {
      if (!state.section) return;
      state.section.style.setProperty('--tilt-x', '0');
      state.section.style.setProperty('--tilt-y', '0');
    }));
  }

  function bindCards(section) {
    var grid = U.$('[data-novels-grid]', section);
    if (!grid) return;

    state.listeners.push(U.on(grid, 'click', function (e) {
      var target = e.target;
      var card = target && target.closest ? target.closest('.book-card') : null;
      if (!card || !grid.contains(card)) return;
      var index = parseInt(card.getAttribute('data-book-index'), 10);
      if (!isNaN(index)) openDrawer(index);
    }));

    if (Museum.env.reduced() || Museum.env.coarse()) return;

    state.listeners.push(U.on(grid, 'pointermove', function (e) {
      var target = e.target;
      var card = target && target.closest ? target.closest('.book-card') : null;
      if (!card || !grid.contains(card)) return;
      var r = card.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var px = U.clamp((e.clientX - r.left) / r.width, 0, 1);
      var py = U.clamp((e.clientY - r.top) / r.height, 0, 1);
      card.style.setProperty('--ry', ((px - 0.5) * 11).toFixed(2) + 'deg');
      card.style.setProperty('--rx', ((py - 0.5) * -9).toFixed(2) + 'deg');
      card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
      card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
    }, { passive: true }));

    state.listeners.push(U.on(grid, 'pointerout', function (e) {
      var target = e.target;
      var card = target && target.closest ? target.closest('.book-card') : null;
      if (!card) return;
      if (e.relatedTarget && card.contains(e.relatedTarget)) return;
      card.style.removeProperty('--ry');
      card.style.removeProperty('--rx');
      card.style.removeProperty('--mx');
      card.style.removeProperty('--my');
    }));
  }

  /* ======================================================================
     mount / unmount
     ====================================================================== */
  function mount(rootEl, params) {
    var root = rootEl || document.getElementById('app');
    if (!root) {
      console.warn('[silver-arcade] novels: 找不到 #app');
      return;
    }
    if (state.mounted) unmount();

    var data = normalizeData();
    state.data = data;
    state.items = data.items;
    state.root = root;

    var section = document.createElement('section');
    section.className = 'view view--novels route-enter';
    section.setAttribute('data-view', 'novels');
    section.setAttribute('aria-labelledby', 'novels-title');
    section.innerHTML = buildPage(data);
    root.appendChild(section);
    state.section = section;
    state.mounted = true;

    state.revealOff = Museum.observeReveal(section);
    bindShelfTilt(section);
    bindCards(section);

    buildDrawer();
    state.keyOff = U.on(document, 'keydown', onDocumentKeydown);
    state.routeSameOff = Museum.events.on('route:same', function () { closeDrawer(true); });

    var wanted = params && params.id ? indexOfId(params.id) : -1;
    if (wanted > -1) {
      state.raf = requestAnimationFrame(function () {
        state.raf = 0;
        openDrawer(wanted);
      });
    }
  }

  function unmount() {
    state.mounted = false;

    if (state.raf) { cancelAnimationFrame(state.raf); state.raf = 0; }
    if (state.closeTimer) { clearTimeout(state.closeTimer); state.closeTimer = 0; }

    if (state.revealOff) { state.revealOff(); state.revealOff = null; }
    while (state.listeners.length) {
      var off = state.listeners.pop();
      try { off(); } catch (err) { /* 已移除的节点 */ }
    }
    if (state.keyOff) { state.keyOff(); state.keyOff = null; }
    if (state.routeSameOff) { state.routeSameOff(); state.routeSameOff = null; }

    if (state.locked) { Museum.lockScroll(false); state.locked = false; }
    if (state.drawerEl) {
      state.drawerEl.classList.remove('is-open');
      if (state.drawerEl.parentNode) state.drawerEl.parentNode.removeChild(state.drawerEl);
    }
    state.drawerEl = null;
    state.drawerPanel = null;
    state.lastFocus = null;
    state.openedIndex = -1;

    if (state.section && state.section.parentNode) {
      state.section.parentNode.removeChild(state.section);
    }
    state.section = null;
    state.root = null;
    state.data = null;
    state.items = [];
  }

  window.NovelsView = {
    mount: mount,
    unmount: unmount
  };
})();
