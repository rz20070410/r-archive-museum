/* ==========================================================================
   R ARCHIVE · fx.js
   细节层：磁吸光标、银液拖尾、磁吸按钮、头部滚动状态。
   只在精细指针 + 非减少动态时启用；对性能与可达性友好。
   ========================================================================== */
(function () {
  'use strict';

  var Museum = window.Museum;
  if (!Museum) return;
  var U = Museum.util;

  var finePointer = window.matchMedia ? window.matchMedia('(pointer: fine)') : null;
  var reduced = Museum.env.reduced();
  var enabled = !!(finePointer && finePointer.matches) && !Museum.env.coarse() && !reduced;
  function bindMagnetic(scope) {
    if (!enabled) return;
    U.$$('[data-magnetic]', scope || document).forEach(function (node) {
      if (node.__magnetic) return;
      node.__magnetic = true;
      var raf = 0, tx = 0, ty = 0, cx = 0, cy = 0, targetX = 0, targetY = 0;
      function loop() {
        raf = 0;
        cx += (targetX - cx) * 0.18;
        cy += (targetY - cy) * 0.18;
        node.style.transform = 'translate3d(' + cx.toFixed(2) + 'px,' + cy.toFixed(2) + 'px,0)';
        if (Math.abs(targetX - cx) > 0.2 || Math.abs(targetY - cy) > 0.2) raf = requestAnimationFrame(loop);
      }
      node.addEventListener('pointermove', function (e) {
        var r = node.getBoundingClientRect();
        var relX = e.clientX - (r.left + r.width / 2);
        var relY = e.clientY - (r.top + r.height / 2);
        var dist = Math.hypot(relX, relY);
        var limit = Math.max(r.width, r.height) * 0.8;
        if (dist < limit) { targetX = relX * 0.16; targetY = relY * 0.2; }
        else { targetX = 0; targetY = 0; }
        if (!raf) raf = requestAnimationFrame(loop);
      });
      node.addEventListener('pointerleave', function () {
        targetX = 0; targetY = 0;
        if (!raf) raf = requestAnimationFrame(loop);
      });
    });
  }

  /* ---------- 头部滚动状态 ---------- */
  var headerEl = document.getElementById('site-header');
  var scrollTicking = false;
  function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(function () {
      scrollTicking = false;
      if (headerEl) headerEl.classList.toggle('is-solid', window.scrollY > 24);
    });
  }

  /* ---------- 初始化 ---------- */
  function init() {
    bindMagnetic(document);
  }

  /* 路由切换后重新绑定新出现的磁吸件与 hover 目标 */
  function refresh(scope) {
    bindMagnetic(scope || document);

  }

  Museum.fx = { refresh: refresh, enabled: enabled };
  Museum.events.on('route:mounted', function () { refresh(document); });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  U.on(window, 'scroll', onScroll, { passive: true });
  onScroll();
})();

