/* ==========================================================================
   R ARCHIVE · pages.js
   静态页面：开源许可 / 404 展厅之外
   ========================================================================== */
(function () {
  'use strict';

  var Museum = window.Museum;
  if (!Museum) return;
  var U = Museum.util;
  var DATA = window.MUSEUM_LICENSES || { groups: [], notes: [], intro: '' };

  function itemHtml(item, i) {
    var links = [];
    if (item.local) links.push('<a class="lic-local mono" href="' + U.esc(item.local) + '">本地许可全文 ↗</a>');
    if (item.source) links.push('<a class="lic-source mono" href="' + U.esc(item.source) + '" target="_blank" rel="noopener">SOURCE ↗</a>');
    return '<li class="lic-item" data-reveal style="--d:' + (i % 6) + '">' +
      '<div class="lic-item__head">' +
        '<h3 class="lic-item__name">' + U.esc(item.name) + '</h3>' +
        '<span class="lic-item__badge mono">' + U.esc(item.license || '') + '</span>' +
      '</div>' +
      (item.version ? '<p class="lic-item__version mono">' + U.esc(item.version) + '</p>' : '') +
      (item.copyright ? '<p class="lic-item__copy mono">' + U.esc(item.copyright) + '</p>' : '') +
      (item.note ? '<p class="lic-item__note">' + U.esc(item.note) + '</p>' : '') +
      (links.length ? '<div class="lic-item__links">' + links.join('') + '</div>' : '') +
    '</li>';
  }

  function mount(root, params) {
    var groups = DATA.groups || [];
    var body = groups.map(function (group) {
      return '<section class="lic-group" aria-labelledby="lic-' + U.esc(group.en.replace(/[^a-z]/gi, '')) + '">' +
        '<div class="lic-group__head" data-reveal>' +
          '<h2 class="lic-group__title" id="lic-' + U.esc(group.en.replace(/[^a-z]/gi, '')) + '">' + U.esc(group.title) + '</h2>' +
          '<span class="lic-group__en mono">' + U.esc(group.en) + '</span>' +
        '</div>' +
        '<ul class="lic-list">' + (group.items || []).map(itemHtml).join('') + '</ul>' +
      '</section>';
    }).join('');

    root.innerHTML =
      '<section class="view view--licenses" data-view="licenses">' +
        '<header class="lic-hero">' +
          '<p class="kicker kicker--ice">04 / LICENSES & CREDITS</p>' +
          '<h1 class="lic-hero__title display" aria-label="开源许可与致谢">' +
            '<span class="mask-line"><span>OPEN</span></span>' +
            '<span class="mask-line"><span><em>LICENSES</em></span></span>' +
          '</h1>' +
          '<div class="lic-hero__meta">' +
            '<p class="lic-hero__intro lede">' + U.esc(DATA.intro || '') + '</p>' +
            '<p class="lic-hero__updated mono">UPDATED&nbsp;/&nbsp;' + U.esc(DATA.updatedAt || '') + '</p>' +
          '</div>' +
        '</header>' +
        '<div class="lic-body">' + body +
          '<section class="lic-notes" aria-labelledby="lic-notes-title">' +
            '<h2 class="lic-group__title" id="lic-notes-title">保留与说明</h2>' +
            '<ul class="lic-notes__list">' +
              (DATA.notes || []).map(function (n) { return '<li>' + U.esc(n) + '</li>'; }).join('') +
            '</ul>' +
          '</section>' +
        '</div>' +
        '<div class="lic-foot">' +
          '<a class="btn btn-line" href="#/" data-magnetic><span>返回首页</span><i aria-hidden="true">←</i></a>' +
          '<a class="btn btn-ghost" href="#/hall">进入 360° 展厅 <span aria-hidden="true">→</span></a>' +
        '</div>' +
      '</section>';

    Museum.observeReveal(root);
    Museum.fx && Museum.fx.refresh(root);
    U.$$('[data-magnetic]', root).forEach(function (n) { /* fx 已统一处理 */ });
  }

  function unmount() {}

  window.LicensesView = { mount: mount, unmount: unmount };

  /* ---------- 404：展厅之外 ---------- */
  function notFoundMount(root) {
    root.innerHTML =
      '<section class="view view--notfound" data-view="notfound">' +
        '<div class="notfound__inner">' +
          '<p class="kicker kicker--ice">EXHIBIT / 404</p>' +
          '<h1 class="notfound__title display">' +
            '<span class="mask-line"><span>不在馆内</span></span>' +
          '</h1>' +
          '<p class="notfound__copy">你走进了一间尚未开放的展厅。转过身，光在另一边。</p>' +
          '<div class="notfound__actions">' +
            '<a class="btn btn-solid" href="#/" data-magnetic><span>回到首页</span><i aria-hidden="true">↗</i></a>' +
            '<a class="btn btn-line" href="#/hall" data-magnetic><span>进入展厅</span><i aria-hidden="true">⟳</i></a>' +
          '</div>' +
          '<p class="notfound__fine mono">R ARCHIVE · LOCAL ARCHIVE · NO TRACKING</p>' +
        '</div>' +
      '</section>';
    Museum.observeReveal(root);
    Museum.fx && Museum.fx.refresh(root);
  }
  window.NotFoundView = { mount: notFoundMount, unmount: unmount };
})();
