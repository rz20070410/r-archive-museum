/* ==========================================================================
   OFFLINE / PWA UI
   ========================================================================== */
(() => {
  'use strict';
  if (!('serviceWorker' in navigator)) return;

  let ready = false;
  let sw = null;
  let mediaDone = 0;
  let mediaTotal = 0;

  function build() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'footer-offline';
    btn.id = 'offline-btn';
    btn.textContent = '离线游玩';
    const footer = document.querySelector('.site-footer');
    if (footer) footer.appendChild(btn);

    const modal = document.createElement('div');
    modal.className = 'offline-modal';
    modal.id = 'offline-modal';
    modal.hidden = true;
    modal.innerHTML =
      '<div class="offline-card">' +
        '<button type="button" class="offline-close" id="offline-close" aria-label="关闭">×</button>' +
        '<p class="offline-kicker">PWA / OFFLINE</p>' +
        '<h2>把盒子<br>装进手机。</h2>' +
        '<ol class="offline-steps">' +
          '<li><b>iPhone 用 Safari 打开本站</b><br>点底部「分享」→「添加到主屏幕」。</li>' +
          '<li><b>第一次联网打开</b><br>点下方按钮，等待游戏、音乐和视频全部缓存完成。</li>' +
          '<li><b>断网后从主屏幕打开</b><br>23 款游戏、26 首歌和背景视频都可离线使用。</li>' +
        '</ol>' +
        '<div class="offline-actions">' +
          '<button type="button" class="btn btn-primary" id="offline-cache-media">缓存全部游戏 + 音乐 / 视频</button>' +
          '<span class="offline-hint" id="offline-hint">游戏 + 26 首歌 + 视频，约 45MB</span>' +
        '</div>' +
        '<div class="offline-progress"><i id="offline-bar"></i></div>' +
        '<p class="offline-note">离线缓存受 iOS 存储策略影响；添加到主屏幕后更稳定。清除 Safari 数据会移除缓存。</p>' +
      '</div>';
    document.body.appendChild(modal);

    const close = () => { modal.hidden = true; };
    btn.addEventListener('click', () => {
      modal.hidden = false;
      if (ready && sw) sw.postMessage({ type: 'PING' });
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.closest('#offline-close')) close();
    });
    document.getElementById('offline-cache-media').addEventListener('click', async () => {
      const mediaBtn = document.getElementById('offline-cache-media');
      const hint = document.getElementById('offline-hint');
      mediaBtn.disabled = true;
      hint.textContent = '正在准备离线模块…';
      try {
        await navigator.serviceWorker.ready;
        let worker = navigator.serviceWorker.controller;
        if (!worker) {
          await new Promise((resolve) => {
            const done = () => resolve();
            navigator.serviceWorker.addEventListener('controllerchange', done, { once: true });
            setTimeout(done, 3000);
          });
          worker = navigator.serviceWorker.controller;
        }
        if (!worker) {
          const reg = await navigator.serviceWorker.getRegistration();
          worker = reg && reg.active;
        }
        if (!worker) {
          hint.textContent = '离线模块还没就绪，请刷新页面后再试。';
          mediaBtn.disabled = false;
          return;
        }
        sw = worker;
        mediaDone = 0; mediaTotal = 0;
        hint.textContent = '正在缓存，请保持页面打开…';
        worker.postMessage({ type: 'CACHE_ALL' });
      } catch (err) {
        hint.textContent = '离线模块初始化失败，请刷新重试。';
        mediaBtn.disabled = false;
      }
    });
  }

  function bindMessages() {
    navigator.serviceWorker.addEventListener('message', (e) => {
      const d = e.data || {};
      if (d.type === 'CACHE_PROGRESS') {
        mediaDone = d.done; mediaTotal = d.total;
        const pct = mediaTotal ? Math.round((mediaDone / mediaTotal) * 100) : 0;
        const bar = document.getElementById('offline-bar');
        if (bar) bar.style.width = pct + '%';
        const hint = document.getElementById('offline-hint');
        if (hint) hint.textContent = '正在缓存 ' + mediaDone + ' / ' + mediaTotal + '（' + pct + '%）';
      } else if (d.type === 'CACHE_DONE') {
        const hint = document.getElementById('offline-hint');
        const mediaBtn = document.getElementById('offline-cache-media');
        if (hint) hint.textContent = '全部内容已缓存，可以断网打开。';
        if (mediaBtn) mediaBtn.disabled = false;
      } else if (d.type === 'CACHE_ERROR') {
        const hint = document.getElementById('offline-hint');
        if (hint) hint.textContent = '有文件缓存失败，请联网后重试。';
      }
    });
  }

  async function register() {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      sw = reg.active || navigator.serviceWorker.controller;
      ready = true;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        sw = navigator.serviceWorker.controller;
      });
    } catch (err) {
      const hint = document.getElementById('offline-hint');
      if (hint) hint.textContent = '当前浏览器不支持离线缓存。';
    }
  }

  function init() {
    build();
    bindMessages();
    register();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
