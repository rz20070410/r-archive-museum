/* ==========================================================================
   R ARCHIVE · player.js
   黑银唱片播放器（window.VinylPlayer）
   --------------------------------------------------------------------------
   设计约束：
   - 常驻 #player-root（在 #app 之外），跨所有路由不重建；只复用页面里
     唯一的 <audio id="museum-audio">，永远不新建 audio 元素、不请求网络。
   - 曲库来自 window.MUSEUM_TRACKS（assets/js/data/tracks.js）。默认空曲库：
     全部传输控件 disabled，显示“曲库筹备中 / NO VINYL YET”，不自动播放、
     不自动选曲、没有上传入口。
   - 曲库被授权音频填充后：播放/暂停、上一首/下一首、拖动进度、音量、
     静音、列表/单曲循环、曲目列表（当前行高亮）、播完自动下一首、
     缺失/加载失败有内联提示与 toast。
   - Volume / muted / loop 写入 Museum.store；不记忆播放状态（无自动播放）。
   - 视觉：黑银拉丝金属面板、细银发丝线、同心纹黑胶、摆动唱臂、
     冰蓝微指示灯、玻璃模糊；桌面右下浮动、手机底部安全区上方 bottom sheet。
   - 经典脚本、ES2018 以内、'use strict'、无外部资源（内联 SVG/CSS）。

   公共 API（window.VinylPlayer）：
     mount(rootEl)   挂载（幂等；脚本加载时会自动挂载 #player-root）
     open()          展开面板
     close()         收起为紧凑播放器
     toggle()        展开/收起
     refresh()       重新读取 window.MUSEUM_TRACKS 并重绘
     getState()      返回当前状态快照（供自检/其他模块读取）
     _devSetTracks() 仅自动化测试：临时替换运行时曲库并 refresh

   存储键（Museum.store）：
     player.volume  0..1        player.muted  boolean
     player.loop    'list' | 'single'
   ========================================================================== */
(function () {
  'use strict';

  var Museum = window.Museum;
  if (!Museum || !Museum.util) return;

  var U = Museum.util;

  /* ---------- 常量 ---------- */
  var DEFAULT_VOLUME = 0.72;
  var STORE_VOLUME = 'player.volume';
  var STORE_MUTED = 'player.muted';
  var STORE_LOOP = 'player.loop';
  var LOOP_LIST = 'list';
  var LOOP_SINGLE = 'single';
  var PLAYER_ID = 'vinyl-player';
  var PANEL_ID = 'vp-panel';

  /* ---------- 内联图标（无外部资源） ---------- */
  var ICON = {
    play: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5.1 2.7 13 8l-7.9 5.3z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="4.5" y="3" width="2.3" height="10" rx=".4" fill="currentColor"/><rect x="9.2" y="3" width="2.3" height="10" rx=".4" fill="currentColor"/></svg>',
    prev: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4.4 3v10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M12.6 3.6v8.8L5.9 8z" fill="currentColor"/></svg>',
    next: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M11.6 3v10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M3.4 3.6v8.8L10.1 8z" fill="currentColor"/></svg>',
    loop: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.1 7.1A5 5 0 0 1 12.8 4.4M12.9 8.9A5 5 0 0 1 3.2 11.6" stroke="currentColor" stroke-width="1.15" fill="none" stroke-linecap="round"/><path d="M11.3 2.3l1.9 1.9-1.9 1.9M4.7 13.7l-1.9-1.9 1.9-1.9" stroke="currentColor" stroke-width="1.15" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    vol: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 6.2h2.2L8.4 3.6v8.8L5.2 9.8H3z" fill="currentColor"/><path d="M10.2 5.6a3.4 3.4 0 0 1 0 4.8M12 3.9a5.6 5.6 0 0 1 0 8.2" stroke="currentColor" stroke-width="1.1" fill="none" stroke-linecap="round"/></svg>',
    mute: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 6.2h2.2L8.4 3.6v8.8L5.2 9.8H3z" fill="currentColor"/><path d="M10.4 6.2l3.2 3.6M13.6 6.2l-3.2 3.6" stroke="currentColor" stroke-width="1.1" fill="none" stroke-linecap="round"/></svg>',
    caret: '<svg viewBox="0 0 10 6" aria-hidden="true" focusable="false"><path d="M1 5l4-4 4 4" stroke="currentColor" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    tonearm: '<svg class="vp-tonearm" viewBox="0 0 52 52" aria-hidden="true" focusable="false">' +
      '<circle cx="43.5" cy="8.5" r="3.1" fill="#0a0d11" stroke="currentColor" stroke-width="0.8"/>' +
      '<circle cx="43.5" cy="8.5" r="1" fill="currentColor"/>' +
      '<path d="M43.5 8.5 27 27.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
      '<rect x="21.5" y="24" width="9" height="4" rx="1" fill="currentColor" transform="rotate(135 26 26)"/>' +
      '</svg>'
  };

  /* ---------- 模板 ---------- */
  var TEMPLATE = [
    '<section class="vinyl-player" id="' + PLAYER_ID + '" data-vp-root data-empty="true" data-open="false"',
    '         role="region" aria-label="黑银唱片播放器">',
    '  <div class="vp-card">',
    '    <span class="vp-grip" aria-hidden="true"></span>',
    '    <div class="vp-serial" aria-hidden="true">',
    '      <span class="vp-serial__mark">R · VINYL</span>',
    '      <span class="vp-serial__status"><i class="vp-led"></i><b data-vp-status>NO VINYL</b></span>',
    '    </div>',
    '    <div class="vp-top">',
    '      <button type="button" class="vp-open" data-vp-open aria-expanded="false"',
    '              aria-controls="' + PANEL_ID + '" aria-label="展开黑银唱片面板">',
    '        <span class="vp-deck" aria-hidden="true">',
    '          <span class="vp-disc"><span class="vp-disc__label"><i class="vp-disc__hole"></i></span></span>',
    '          ' + ICON.tonearm,
    '        </span>',
    '        <span class="vp-meta">',
    '          <span class="vp-title" data-vp-title>曲库筹备中</span>',
    '          <span class="vp-sub" data-vp-sub>NO VINYL YET</span>',
    '        </span>',
    '        <span class="vp-caret" aria-hidden="true">' + ICON.caret + '</span>',
    '      </button>',
    '      <button type="button" class="vp-play" data-vp-play disabled aria-disabled="true" aria-label="播放">',
    '        <span class="vp-ico vp-ico--play" aria-hidden="true">' + ICON.play + '</span>',
    '        <span class="vp-ico vp-ico--pause" aria-hidden="true">' + ICON.pause + '</span>',
    '      </button>',
    '    </div>',
    '    <div class="vp-panel-wrap" id="' + PANEL_ID + '" data-vp-panelwrap inert aria-hidden="true">',
    '      <div class="vp-panel">',
    '        <div class="vp-panel-inner">',
    '          <p class="vp-error" data-vp-error role="status" aria-live="polite" hidden></p>',
    '          <div class="vp-progress">',
    '            <div class="vp-line">',
    '              <span class="vp-micro">进度 · PROGRESS</span>',
    '              <span class="vp-time"><span data-vp-time>0:00</span><i aria-hidden="true">/</i><span data-vp-duration>0:00</span></span>',
    '            </div>',
    '            <input type="range" class="vp-range" data-vp-seek min="0" max="1" step="1" value="0"',
    '                   aria-label="播放进度" disabled aria-disabled="true">',
    '          </div>',
    '          <div class="vp-transport">',
    '            <button type="button" class="vp-btn" data-vp-prev disabled aria-disabled="true" aria-label="上一首">' + ICON.prev + '</button>',
    '            <button type="button" class="vp-btn" data-vp-next disabled aria-disabled="true" aria-label="下一首">' + ICON.next + '</button>',
    '            <button type="button" class="vp-loop" data-vp-loop disabled aria-disabled="true" aria-pressed="false"',
    '                    aria-label="循环模式：列表循环">',
    '              <span class="vp-loop__ico" aria-hidden="true">' + ICON.loop + '</span>',
    '              <span class="vp-loop__txt" data-vp-loop-label>LIST LOOP</span>',
    '            </button>',
    '            <button type="button" class="vp-btn vp-mute" data-vp-mute disabled aria-disabled="true"',
    '                    aria-pressed="false" aria-label="静音">',
    '              <span class="vp-ico vp-ico--vol" aria-hidden="true">' + ICON.vol + '</span>',
    '              <span class="vp-ico vp-ico--mute" aria-hidden="true">' + ICON.mute + '</span>',
    '            </button>',
    '          </div>',
    '          <div class="vp-tracks">',
    '            <div class="vp-line">',
    '              <span class="vp-micro">曲目 · TRACKS</span>',
    '              <span class="vp-count" data-vp-count>00</span>',
    '            </div>',
    '            <ul class="vp-list" data-vp-list aria-label="曲目列表"></ul>',
    '            <div class="vp-empty" data-vp-empty>',
    '              <span class="vp-empty__disc" aria-hidden="true"></span>',
    '              <strong>曲库筹备中</strong>',
    '              <em>NO VINYL YET</em>',
    '              <p>等待授权的黑银唱片入藏。播放器已就绪，不会自动播放。</p>',
    '            </div>',
    '          </div>',
    '          <div class="vp-volume">',
    '            <div class="vp-line">',
    '              <span class="vp-micro">音量 · VOLUME</span>',
    '              <span class="vp-count" data-vp-vol-label>72</span>',
    '            </div>',
    '            <input type="range" class="vp-range vp-range--vol" data-vp-volume min="0" max="100" step="1"',
    '                   value="72" aria-label="音量" disabled aria-disabled="true">',
    '          </div>',
    '          <div class="vp-foot" aria-hidden="true">',
    '            <span class="vp-micro">R ARCHIVE · 黑银唱片</span>',
    '            <span class="vp-micro">LOCAL / NO STREAM</span>',
    '          </div>',
    '        </div>',
    '      </div>',
    '    </div>',
    '  </div>',
    '</section>'
  ].join('\n');

  /* ---------- 运行时状态 ---------- */
  var audio = null;
  var playerEl = null;
  var refs = null;
  var mounted = false;
  var isOpen = false;
  var lastTrigger = null;
  var watchingStage = false;

  var tracks = [];
  var index = -1;

  var prefs = {
    volume: DEFAULT_VOLUME,
    muted: false,
    loop: LOOP_LIST
  };

  var state = {
    playing: false,
    metadataReady: false,
    userSeeking: false,
    error: ''
  };

  /* ---------- 小工具 ---------- */
  function text(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function setRangeFill(input, ratio) {
    if (!input) return;
    var pct = Math.max(0, Math.min(1, isFinite(ratio) ? ratio : 0)) * 100;
    input.style.setProperty('--fill', pct.toFixed(2) + '%');
  }

  function setAriaDisabled(node, disabled) {
    if (!node) return;
    node.disabled = !!disabled;
    if (disabled) node.setAttribute('aria-disabled', 'true');
    else node.removeAttribute('aria-disabled');
  }

  function toast(message, ms) {
    if (Museum.toast) Museum.toast(message, ms || 2600);
  }

  function isRemoteSrc(src) {
    return /^(?:https?:)?\/\//i.test(src) || /^javascript:/i.test(src);
  }

  function currentTrack() {
    return index >= 0 && index < tracks.length ? tracks[index] : null;
  }

  /* ---------- 曲库归一化 ---------- */
  function normalizeTracks(raw) {
    var list = [];
    if (raw && !Array.isArray(raw) && Array.isArray(raw.items)) raw = raw.items;
    if (!Array.isArray(raw)) return list;
    for (var i = 0; i < raw.length; i++) {
      var item = raw[i];
      if (!item || typeof item !== 'object') continue;
      var src = text(item.src);
      if (!src) continue;
      list.push({
        title: text(item.title) || '未命名曲目',
        artist: text(item.artist),
        album: text(item.album),
        src: src,
        duration: Math.max(0, Number(item.duration) || 0),
        license: text(item.license)
      });
    }
    return list;
  }

  /* ---------- 偏好读写（Museum.store，file:// 下自动降级内存） ---------- */
  function readPrefs() {
    var storedVolume = Number(Museum.store.get(STORE_VOLUME, DEFAULT_VOLUME));
    prefs.volume = isFinite(storedVolume) ? U.clamp(storedVolume, 0, 1) : DEFAULT_VOLUME;
    prefs.muted = Museum.store.get(STORE_MUTED, false) === true;
    prefs.loop = Museum.store.get(STORE_LOOP, LOOP_LIST) === LOOP_SINGLE ? LOOP_SINGLE : LOOP_LIST;
  }

  function applyAudioPrefs() {
    if (!audio) return;
    audio.volume = prefs.volume;
    audio.muted = prefs.muted;
  }

  function persistVolume() {
    Museum.store.set(STORE_VOLUME, prefs.volume);
  }

  function persistMuted() {
    Museum.store.set(STORE_MUTED, prefs.muted);
  }

  function persistLoop() {
    Museum.store.set(STORE_LOOP, prefs.loop);
  }

  /* ---------- 展开 / 收起 ---------- */
  function syncTriggers() {
    var triggers = U.$$('[data-player-toggle], #footer-player');
    triggers.forEach(function (trigger) {
      trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (!trigger.hasAttribute('aria-controls')) trigger.setAttribute('aria-controls', PLAYER_ID);
      trigger.classList.toggle('is-playing', !!state.playing);
    });
    var header = document.getElementById('player-toggle');
    if (header) header.classList.toggle('is-playing', !!state.playing);
  }

  function setOpen(nextOpen) {
    if (!mounted) return;
    isOpen = !!nextOpen;
    playerEl.classList.toggle('is-open', isOpen);
    playerEl.setAttribute('data-open', isOpen ? 'true' : 'false');
    refs.openBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    refs.openBtn.setAttribute('aria-label', (isOpen ? '收起黑银唱片面板' : '展开黑银唱片面板') +
      (currentTrack() ? '，当前曲目 ' + currentTrack().title : ''));
    if (isOpen) {
      refs.panelWrap.removeAttribute('inert');
      refs.panelWrap.setAttribute('aria-hidden', 'false');
    } else {
      if (refs.panelWrap.contains(document.activeElement)) {
        var target = lastTrigger && document.contains(lastTrigger) ? lastTrigger : refs.openBtn;
        try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
      }
      refs.panelWrap.setAttribute('inert', '');
      refs.panelWrap.setAttribute('aria-hidden', 'true');
    }
    syncTriggers();
  }

  function open() { setOpen(true); }
  function close() { setOpen(false); }
  function toggle() { setOpen(!isOpen); }

  /* ---------- 曲目选择与播放 ---------- */
  function clearError() {
    state.error = '';
    if (!refs) return;
    playerEl.classList.remove('has-error');
    refs.error.hidden = true;
    refs.error.textContent = '';
  }

  function setError(message) {
    state.error = message;
    state.playing = false;
    if (!refs) return;
    playerEl.classList.remove('is-playing');
    playerEl.classList.add('has-error');
    refs.error.textContent = message;
    refs.error.hidden = false;
    updatePlayUI();
    syncTriggers();
    renderList();
    toast(message, 3200);
  }

  function resetSelection() {
    index = -1;
    state.metadataReady = false;
    state.userSeeking = false;
    state.duration = 0;
    if (audio) {
      try { audio.pause(); } catch (e) {}
      try { audio.removeAttribute('src'); } catch (e) {}
      try { audio.load(); } catch (e) {}
    }
    state.playing = false;
    clearError();
  }

  function loadTrack(nextIndex) {
    var track = tracks[nextIndex];
    if (!track) return false;
    index = nextIndex;
    state.metadataReady = false;
    state.duration = track.duration || 0;
    clearError();
    if (!audio) return false;
    if (isRemoteSrc(track.src)) {
      setError('外部音频已禁用 · LOCAL AUDIO ONLY');
      return false;
    }
    try {
      audio.src = track.src;
      audio.load();
    } catch (e) {
      setError('音频无法加载 · UNAVAILABLE');
      return false;
    }
    return true;
  }

  function selectTrack(nextIndex, shouldPlay) {
    if (nextIndex < 0 || nextIndex >= tracks.length) return;
    if (index === nextIndex) {
      if (shouldPlay) play();
      return;
    }
    var ok = loadTrack(nextIndex);
    if (refs) {
      renderMeta();
      renderList();
      renderTime();
      updateControls();
    }
    if (shouldPlay && ok) play();
    else if (shouldPlay && !ok) {
      /* 外部/损坏音频：保留选中态并给出错误 */
      renderTime();
    }
  }

  function play() {
    if (!tracks.length || !audio) return;
    if (index < 0) {
      selectTrack(0, true);
      return;
    }
    if (state.error && audio.error) {
      /* 重试一次：重新加载当前源 */
      try { audio.load(); } catch (e) {}
    }
    if (audio.ended) {
      try { audio.currentTime = 0; } catch (e) {}
    }
    var promise;
    try {
      promise = audio.play();
    } catch (err) {
      setError('无法播放 · PLAYBACK BLOCKED');
      return;
    }
    state.playing = true;
    updatePlayUI();
    syncTriggers();
    if (promise && typeof promise.catch === 'function') {
      promise.catch(function (err) {
        if (err && (err.name === 'AbortError' || err.name === 'NotSupportedError')) return;
        if (err && err.name === 'NotAllowedError') {
          setError('浏览器要求手动交互后才能播放 · TAP TO PLAY');
        } else {
          setError('无法播放 · PLAYBACK BLOCKED');
        }
      });
    }
  }

  function pause() {
    if (!audio) return;
    try { audio.pause(); } catch (e) {}
    state.playing = false;
    updatePlayUI();
    syncTriggers();
  }

  function togglePlay() {
    if (!tracks.length) return;
    if (state.playing && audio && !audio.paused) pause();
    else play();
  }

  function stepNext() {
    if (!tracks.length) return;
    if (index < 0) { selectTrack(0, true); return; }
    var nextIndex = (index + 1) % tracks.length;
    selectTrack(nextIndex, true);
  }

  function stepPrev() {
    if (!tracks.length) return;
    if (index < 0) { selectTrack(0, true); return; }
    if (audio && audio.currentTime > 3) {
      try { audio.currentTime = 0; } catch (e) {}
      updateTime();
      return;
    }
    var prevIndex = (index - 1 + tracks.length) % tracks.length;
    selectTrack(prevIndex, true);
  }

  function onEnded() {
    if (!tracks.length || !audio) return;
    if (prefs.loop === LOOP_SINGLE || tracks.length === 1) {
      try { audio.currentTime = 0; } catch (e) {}
      play();
      return;
    }
    selectTrack((index + 1) % tracks.length, true);
  }

  /* ---------- 时间 / 进度 ---------- */
  function effectiveDuration() {
    if (state.metadataReady && audio && isFinite(audio.duration) && audio.duration > 0) {
      return audio.duration;
    }
    var track = currentTrack();
    return track && track.duration > 0 ? track.duration : 0;
  }

  function renderTime() {
    if (!refs) return;
    var duration = effectiveDuration();
    var time = 0;
    if (audio && !state.userSeeking) time = audio.currentTime || 0;
    if (state.userSeeking) time = Number(refs.seek.value) || 0;
    if (time > duration && duration > 0) time = duration;
    refs.time.textContent = U.fmtTime(time);
    refs.duration.textContent = U.fmtTime(duration);
    refs.seek.max = String(Math.max(1, Math.floor(duration) || 1));
    if (!state.userSeeking) {
      var seekValue = Math.min(Number(refs.seek.max), Math.floor(time));
      refs.seek.value = String(seekValue);
      setRangeFill(refs.seek, duration > 0 ? time / duration : 0);
    }
    refs.seek.setAttribute('aria-valuetext', U.fmtTime(time) + ' / ' + U.fmtTime(duration));
  }

  function updateTime() {
    if (!refs || state.userSeeking) return;
    renderTime();
    var track = currentTrack();
    if (track) {
      /* 进度回调期间保持无障碍时间语义 */
      refs.seek.setAttribute('aria-valuetext', U.fmtTime(audio ? audio.currentTime : 0) + ' / ' + U.fmtTime(effectiveDuration()));
    }
  }

  /* ---------- 文案 / 控件同步 ---------- */
  function renderMeta() {
    var track = currentTrack();
    if (track) {
      refs.title.textContent = track.title;
      var sub = [track.artist, track.album].filter(Boolean).join(' · ');
      refs.sub.textContent = sub || 'R ARCHIVE · VOL. 01';
    } else if (tracks.length) {
      refs.title.textContent = '黑银唱片';
      refs.sub.textContent = U.pad2(tracks.length) + ' TRACKS · 选择一首';
    } else {
      refs.title.textContent = '曲库筹备中';
      refs.sub.textContent = 'NO VINYL YET';
    }
    refs.openBtn.setAttribute('aria-label',
      (isOpen ? '收起黑银唱片面板' : '展开黑银唱片面板') + (track ? '，当前曲目 ' + track.title : ''));
  }

  function updateControls() {
    var has = tracks.length > 0;
    setAriaDisabled(refs.playBtn, !has);
    setAriaDisabled(refs.prev, !has);
    setAriaDisabled(refs.next, !has);
    setAriaDisabled(refs.loop, !has);
    setAriaDisabled(refs.mute, !has);
    setAriaDisabled(refs.volume, !has);
    setAriaDisabled(refs.seek, !has);
    refs.list.setAttribute('aria-disabled', has ? 'false' : 'true');
    refs.count.textContent = has ? U.pad2(tracks.length) : '00';
    playerEl.setAttribute('data-empty', has ? 'false' : 'true');
  }

  function updatePlayUI() {
    if (!refs) return;
    var playing = !!state.playing;
    playerEl.classList.toggle('is-playing', playing);
    refs.playBtn.setAttribute('aria-label', playing ? '暂停' : '播放');
    refs.playBtn.setAttribute('title', playing ? '暂停 PAUSE' : '播放 PLAY');
    var status;
    if (!tracks.length) status = 'NO VINYL';
    else if (state.error) status = 'UNAVAILABLE';
    else if (playing) status = 'PLAYING';
    else if (currentTrack()) status = 'PAUSED';
    else status = 'STANDBY';
    refs.status.textContent = status;
    var activeRow = refs.list.querySelector('.vp-row.is-active');
    if (activeRow) activeRow.classList.toggle('is-live', playing);
  }

  function updateLoopUI() {
    if (!refs) return;
    var single = prefs.loop === LOOP_SINGLE;
    refs.loop.setAttribute('aria-pressed', single ? 'true' : 'false');
    refs.loop.setAttribute('aria-label', '循环模式：' + (single ? '单曲循环' : '列表循环'));
    refs.loop.classList.toggle('is-on', single);
    refs.loopLabel.textContent = single ? 'ONE LOOP' : 'LIST LOOP';
  }

  function updateMuteUI() {
    if (!refs) return;
    playerEl.classList.toggle('is-muted', prefs.muted);
    refs.mute.setAttribute('aria-pressed', prefs.muted ? 'true' : 'false');
    refs.mute.setAttribute('aria-label', prefs.muted ? '取消静音' : '静音');
    refs.mute.setAttribute('title', prefs.muted ? '取消静音 UNMUTE' : '静音 MUTE');
    refs.mute.classList.toggle('is-on', prefs.muted);
  }

  function updateVolumeUI() {
    if (!refs) return;
    var value = Math.round(prefs.volume * 100);
    refs.volume.value = String(value);
    refs.volLabel.textContent = String(value);
    setRangeFill(refs.volume, prefs.volume);
  }

  function renderList() {
    if (!refs) return;
    if (!tracks.length) {
      refs.list.innerHTML = '';
      return;
    }
    var html = '';
    for (var i = 0; i < tracks.length; i++) {
      var track = tracks[i];
      var active = i === index;
      var duration = track.duration > 0 ? U.fmtTime(track.duration) : '--:--';
      var meta = [track.artist, track.album].filter(Boolean).join(' · ');
      html += '<li class="vp-list__item">' +
        '<button type="button" class="vp-row' + (active ? ' is-active' : '') +
        (active && state.playing ? ' is-live' : '') + '"' +
        ' data-vp-track="' + i + '"' +
        (active ? ' aria-current="true"' : '') +
        ' aria-label="播放 ' + U.esc(track.title) + (track.artist ? ' · ' + U.esc(track.artist) : '') + '">' +
        '<span class="vp-row__idx" aria-hidden="true">' + U.pad2(i + 1) + '</span>' +
        '<span class="vp-row__main">' +
        '<span class="vp-row__title">' + U.esc(track.title) + '</span>' +
        (meta ? '<span class="vp-row__meta">' + U.esc(meta) + '</span>' : '') +
        '</span>' +
        '<span class="vp-row__time" aria-hidden="true">' + duration + '</span>' +
        '</button>' +
        '</li>';
    }
    refs.list.innerHTML = html;
  }

  function render() {
    if (!mounted || !refs) return;
    updateControls();
    renderMeta();
    renderList();
    renderTime();
    updatePlayUI();
    updateLoopUI();
    updateMuteUI();
    updateVolumeUI();
    syncTriggers();
  }

  /* ---------- 数据刷新 ---------- */
  function refresh() {
    var previousSrc = currentTrack() ? currentTrack().src : '';
    tracks = normalizeTracks(window.MUSEUM_TRACKS);
    var foundIndex = -1;
    if (previousSrc) {
      for (var i = 0; i < tracks.length; i++) {
        if (tracks[i].src === previousSrc) { foundIndex = i; break; }
      }
    }
    index = foundIndex;
    if (index < 0 && previousSrc) resetSelection();
    if (index < 0) {
      state.playing = false;
      state.metadataReady = false;
      state.duration = 0;
      clearError();
    }
    if (!mounted) return;
    render();
  }

  /* ---------- 音频事件 ---------- */
  function bindAudio() {
    if (!audio) return;
    U.on(audio, 'loadedmetadata', function () {
      if (index < 0) return;
      if (isFinite(audio.duration) && audio.duration > 0) state.metadataReady = true;
      renderTime();
    });
    U.on(audio, 'durationchange', function () {
      if (index < 0) return;
      if (isFinite(audio.duration) && audio.duration > 0) state.metadataReady = true;
      renderTime();
    });
    U.on(audio, 'timeupdate', updateTime);
    U.on(audio, 'play', function () {
      state.playing = true;
      clearError();
      updatePlayUI();
      syncTriggers();
    });
    U.on(audio, 'playing', function () {
      state.playing = true;
      updatePlayUI();
      syncTriggers();
    });
    U.on(audio, 'pause', function () {
      state.playing = false;
      updatePlayUI();
      syncTriggers();
    });
    U.on(audio, 'ended', onEnded);
    U.on(audio, 'error', function () {
      if (index < 0) return;
      var code = audio.error ? audio.error.code : 0;
      var message = code === 4 ? '音频文件缺失或格式不支持 · UNAVAILABLE' : '音频加载失败 · UNAVAILABLE';
      setError(message);
    });
    U.on(audio, 'loadstart', function () {
      if (index >= 0) clearError();
    });
    U.on(audio, 'volumechange', function () {
      /* 只同步外部（如系统）对音量的改动，不覆盖用户偏好 */
      if (!refs) return;
      if (!prefs.muted && audio.muted) {
        prefs.muted = true;
        persistMuted();
        updateMuteUI();
      }
    });
  }

  /* ---------- UI 事件 ---------- */
  function onSeekInput() {
    if (!refs || !tracks.length) return;
    state.userSeeking = true;
    var duration = effectiveDuration();
    var time = Number(refs.seek.value) || 0;
    refs.time.textContent = U.fmtTime(time);
    refs.duration.textContent = U.fmtTime(duration);
    refs.seek.setAttribute('aria-valuetext', U.fmtTime(time) + ' / ' + U.fmtTime(duration));
    setRangeFill(refs.seek, duration > 0 ? time / duration : 0);
  }

  function onSeekChange() {
    if (!refs || !tracks.length) return;
    state.userSeeking = false;
    var time = Number(refs.seek.value) || 0;
    if (audio && isFinite(time)) {
      try { audio.currentTime = time; } catch (e) {}
    }
    renderTime();
  }

  function onVolumeInput() {
    if (!refs) return;
    var value = U.clamp(Number(refs.volume.value) / 100, 0, 1);
    prefs.volume = value;
    if (prefs.muted && value > 0) {
      prefs.muted = false;
      persistMuted();
    }
    if (audio) audio.volume = value;
    persistVolume();
    updateVolumeUI();
    updateMuteUI();
  }

  function bindUi() {
    U.on(refs.openBtn, 'click', function () {
      lastTrigger = refs.openBtn;
      toggle();
    });
    U.on(refs.playBtn, 'click', togglePlay);
    U.on(refs.prev, 'click', stepPrev);
    U.on(refs.next, 'click', stepNext);
    U.on(refs.loop, 'click', function () {
      prefs.loop = prefs.loop === LOOP_SINGLE ? LOOP_LIST : LOOP_SINGLE;
      persistLoop();
      updateLoopUI();
      toast(prefs.loop === LOOP_SINGLE ? '单曲循环 · ONE LOOP' : '列表循环 · LIST LOOP', 1600);
    });
    U.on(refs.mute, 'click', function () {
      prefs.muted = !prefs.muted;
      if (audio) audio.muted = prefs.muted;
      persistMuted();
      updateMuteUI();
      toast(prefs.muted ? '已静音 · MUTED' : '取消静音 · UNMUTED', 1400);
    });
    U.on(refs.seek, 'pointerdown', function () { state.userSeeking = true; });
    U.on(refs.seek, 'input', onSeekInput);
    U.on(refs.seek, 'change', onSeekChange);
    U.on(refs.volume, 'input', onVolumeInput);
    U.on(refs.volume, 'change', onVolumeInput);
    U.on(refs.list, 'click', function (event) {
      var target = event.target;
      var row = target && target.closest ? target.closest('[data-vp-track]') : null;
      if (!row) return;
      var trackIndex = Number(row.getAttribute('data-vp-track'));
      if (!isFinite(trackIndex)) return;
      selectTrack(trackIndex, true);
    });
    U.on(refs.list, 'keydown', function (event) {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      var rows = U.$$('.vp-row', refs.list);
      if (!rows.length) return;
      var active = document.activeElement;
      var activeIndex = rows.indexOf(active);
      var nextIndex = event.key === 'ArrowDown' ? activeIndex + 1 : activeIndex - 1;
      nextIndex = U.clamp(nextIndex, 0, rows.length - 1);
      if (nextIndex !== activeIndex) {
        event.preventDefault();
        rows[nextIndex].focus();
      }
    });
  }

  /* ---------- 外部触发器（头部唱片按钮 / 页脚黑银唱片） ---------- */
  function bindTriggers() {
    U.on(document, 'click', function (event) {
      var target = event.target;
      var trigger = target && target.closest
        ? target.closest('[data-player-toggle], #footer-player')
        : null;
      if (!trigger) return;
      event.preventDefault();
      event.stopPropagation();
      lastTrigger = trigger;
      toggle();
    }, true);
  }

  function bindEscape() {
    U.on(document, 'keydown', function (event) {
      if (event.key !== 'Escape' && event.key !== 'Esc') return;
      if (isOpen) close();
    });
  }

  /* ---------- 游戏舞台：缩成小圆钮并收起面板 ---------- */
  function watchStage() {
    if (watchingStage || !('MutationObserver' in window) || !document.body) return;
    watchingStage = true;
    var observer = new MutationObserver(function () {
      if (document.body.classList.contains('is-stage') && isOpen) close();
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  /* ---------- 挂载 ---------- */
  function cacheRefs() {
    function q(selector) { return playerEl.querySelector(selector); }
    refs = {
      card: q('.vp-card'),
      openBtn: q('[data-vp-open]'),
      playBtn: q('[data-vp-play]'),
      title: q('[data-vp-title]'),
      sub: q('[data-vp-sub]'),
      status: q('[data-vp-status]'),
      panelWrap: q('[data-vp-panelwrap]'),
      time: q('[data-vp-time]'),
      duration: q('[data-vp-duration]'),
      seek: q('[data-vp-seek]'),
      prev: q('[data-vp-prev]'),
      next: q('[data-vp-next]'),
      loop: q('[data-vp-loop]'),
      loopLabel: q('[data-vp-loop-label]'),
      mute: q('[data-vp-mute]'),
      volume: q('[data-vp-volume]'),
      volLabel: q('[data-vp-vol-label]'),
      list: q('[data-vp-list]'),
      empty: q('[data-vp-empty]'),
      error: q('[data-vp-error]'),
      count: q('[data-vp-count]')
    };
  }

  function mount(rootEl) {
    if (mounted) return api;
    var host = rootEl;
    if (typeof host === 'string') host = document.querySelector(host);
    if (!host) host = document.getElementById('player-root');
    if (!host) {
      console.warn('[vinyl] #player-root 不存在，播放器未挂载。');
      return api;
    }
    audio = audio || document.getElementById('museum-audio');
    if (!audio) console.warn('[vinyl] #museum-audio 不存在，播放器只显示空库状态。');

    host.innerHTML = TEMPLATE;
    playerEl = host.querySelector('#' + PLAYER_ID);
    if (!playerEl) return api;

    cacheRefs();
    bindAudio();
    bindUi();
    bindTriggers();
    bindEscape();
    watchStage();

    mounted = true;
    readPrefs();
    applyAudioPrefs();
    refresh();
    syncTriggers();
    return api;
  }

  /* ---------- 状态快照 ---------- */
  function getState() {
    var track = currentTrack();
    var duration = effectiveDuration();
    var time = audio ? (audio.currentTime || 0) : 0;
    return {
      mounted: mounted,
      open: isOpen,
      empty: tracks.length === 0,
      count: tracks.length,
      index: index,
      current: track ? {
        title: track.title,
        artist: track.artist,
        album: track.album,
        src: track.src,
        duration: track.duration,
        license: track.license
      } : null,
      playing: !!state.playing,
      paused: !state.playing,
      hasAudio: !!audio,
      audioPaused: audio ? audio.paused : true,
      audioSrc: audio ? (audio.getAttribute('src') || '') : '',
      time: time,
      duration: duration,
      volume: prefs.volume,
      muted: prefs.muted,
      loop: prefs.loop,
      error: state.error || null
    };
  }

  /* ---------- 公共 API ---------- */
  var api = {
    mount: mount,
    open: open,
    close: close,
    toggle: toggle,
    refresh: refresh,
    getState: getState,
    /**
     * 仅自动化测试使用：临时替换运行时曲库（不改 tracks.js），随后 refresh。
     * 例：VinylPlayer._devSetTracks([{ title:'Test', artist:'Test',
     *       src:'data:audio/wav;base64,...' }])
     */
    _devSetTracks: function (list) {
      window.MUSEUM_TRACKS = Array.isArray(list) ? list : [];
      refresh();
    }
  };

  window.VinylPlayer = api;

  /* ---------- 自动挂载（index.html 的 #player-root 在脚本之前） ---------- */
  function boot() {
    mount(document.getElementById('player-root'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
