/* Rz神次元游戏箱 · 核心引擎：游戏注册、主循环、输入、HUD、暂停与结算 */
(function () {
  'use strict';

  var Arcade = window.Arcade = window.Arcade || {};
  var games = [];
  Arcade.games = games;

  Arcade.register = function (def) {
    if (!def || typeof def.id !== 'string' || !def.id) {
      throw new Error('Arcade.register: 缺少游戏 id');
    }
    if (typeof def.create !== 'function' && !def.url) {
      throw new Error('Arcade.register: ' + def.id + ' 缺少 create()');
    }
    if (games.some(function (g) { return g.id === def.id; })) {
      console.warn('[arcade] 重复注册的游戏 id:', def.id);
      return;
    }
    games.push(def);
  };

  Arcade.getGame = function (id) {
    for (var i = 0; i < games.length; i++) {
      if (games[i].id === id) return games[i];
    }
    return null;
  };

  Arcade.best = function (id) {
    return Number(Arcade.store.get('best.' + id, 0)) || 0;
  };

  Arcade.recordBest = function (id, score) {
    var prev = Arcade.best(id);
    var value = Number(score) || 0;
    if (value > prev) {
      Arcade.store.set('best.' + id, value);
      return { best: value, isNew: true };
    }
    return { best: prev, isNew: false };
  };

  Arcade.plays = function (id) {
    return Number(Arcade.store.get('plays.' + id, 0)) || 0;
  };

  Arcade.addPlay = function (id) {
    var next = Arcade.plays(id) + 1;
    Arcade.store.set('plays.' + id, next);
    Arcade.store.set('lastPlayed.' + id, Date.now());
    return next;
  };

  Arcade.totals = function () {
    var plays = 0;
    var bestSum = 0;
    games.forEach(function (g) {
      plays += Arcade.plays(g.id);
      bestSum += Arcade.best(g.id);
    });
    return { games: games.length, plays: plays, bestSum: bestSum };
  };

  var DEFAULT_COLORS = {
    bg: '#0b0e1a',
    panel: '#141a2e',
    line: '#2a3450',
    text: '#e8ecff',
    muted: '#8b95b5',
    accent: '#22d3ee',
    accent2: '#6366f1',
    danger: '#f43f5e',
    success: '#34d399',
    warn: '#fbbf24'
  };

  var BLOCK_DEFAULT = {
    ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Space: 1,
    KeyW: 0, KeyA: 0, KeyS: 0, KeyD: 0
  };

  function esc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function GameHost(opts) {
    this.canvas = opts.canvas;
    this.ctx = this.canvas.getContext('2d');
    this.game = opts.game;
    this.hudEl = opts.hud;
    this.statusEl = opts.status;
    this.overlayEl = opts.overlay;
    this.onExit = opts.onExit || function () {};
    this.onMuteChange = opts.onMuteChange || function () {};
    this.onScore = opts.onScore || function () {};

    var g = this.game;
    this.width = g.width || 720;
    this.height = g.height || 540;
    this.pointer = { x: this.width / 2, y: this.height / 2, down: false, clicked: false };
    this.keys = new Set();
    this.justPressed = new Set();
    this.pendingEnd = null;
    this.instance = null;
    this.raf = null;
    this.lastTs = 0;
    this.state = 'idle';
    this.overlayMode = null;
    this.score = 0;
    this.best = Arcade.best(g.id);
    this.hudCache = {};
    this.extraKey = '';
    this.dpr = 0;
    this._loop = this._frame.bind(this);
    this._paused = false;

    this._boundKeyDown = this._onKeyDown.bind(this);
    this._boundKeyUp = this._onKeyUp.bind(this);
    this._boundDown = this._onPointerDown.bind(this);
    this._boundMove = this._onPointerMove.bind(this);
    this._boundUp = this._onPointerUp.bind(this);
    this._boundVisibility = this._onVisibility.bind(this);
    this._boundBlur = this._onBlur.bind(this);
    this._boundResize = this._syncCanvas.bind(this);
    this._boundOverlayClick = this._onOverlayClick.bind(this);
  }

  GameHost.prototype.mount = function () {
    var self = this;
    this._buildHud();
    this._syncCanvas();
    this._makeRuntime();

    window.addEventListener('keydown', this._boundKeyDown);
    window.addEventListener('keyup', this._boundKeyUp);
    this.canvas.addEventListener('pointerdown', this._boundDown);
    this.canvas.addEventListener('pointermove', this._boundMove);
    this.canvas.addEventListener('pointerup', this._boundUp);
    this.canvas.addEventListener('pointercancel', this._boundUp);
    this.canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    this.overlayEl.addEventListener('click', this._boundOverlayClick);
    document.addEventListener('visibilitychange', this._boundVisibility);
    window.addEventListener('blur', this._boundBlur);
    window.addEventListener('resize', this._boundResize);

    this._startInstance();
    this.state = 'running';
    this.lastTs = 0;
    this._schedule();
    this._paintHud();
    self.canvas.focus && self.canvas.focus();
    return this;
  };

  GameHost.prototype._makeRuntime = function () {
    var self = this;
    var g = this.game;
    var storage = Arcade.store.scoped(g.id);
    var colors = Object.assign({}, DEFAULT_COLORS, {
      accent: g.accent || DEFAULT_COLORS.accent,
      accent2: g.accent2 || DEFAULT_COLORS.accent2
    });

    this.rt = {
      width: this.width,
      height: this.height,
      canvas: this.canvas,
      hudElement: this.hudEl,
      colors: colors,
      keys: this.keys,
      pointer: this.pointer,
      audio: Arcade.audio,
      storage: storage,
      time: 0,
      frame: 0,
      score: 0,
      best: this.best,
      get muted() { return Arcade.audio.isMuted(); },
      wasPressed: function (code) { return self.justPressed.has(code); },
      setScore: function (value) {
        var v = Math.max(0, Math.round(Number(value) || 0));
        if (v === self.score) return;
        self.score = v;
        self.rt.score = v;
        if (v > self.best) {
          self.best = v;
          self.rt.best = v;
        }
        self._paintHud(true);
        self.onScore(v);
      },
      setHud: function (obj) {
        var data = obj || {};
        var key = JSON.stringify(data);
        if (key === self.extraKey) return;
        self.extraKey = key;
        self._paintExtra(data);
      },
      setStatus: function (text) {
        var value = text ? String(text) : '';
        if (self.hudCache.status === value) return;
        self.hudCache.status = value;
        self.statusEl.textContent = value;
        self.statusEl.classList.toggle('is-empty', !value);
      },
      rand: function (min, max) { return min + Math.random() * (max - min); },
      randInt: function (min, max) { return Math.floor(min + Math.random() * (max - min + 1)); },
      pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
      clamp: function (v, min, max) { return v < min ? min : v > max ? max : v; },
      /* 允许游戏额外注册清理逻辑（等价于返回 destroy） */
      onCleanup: function (fn) { self._cleanups.push(fn); },
      end: function (result) { self._end(result || {}); }
    };
    this._cleanups = [];
  };

  GameHost.prototype._startInstance = function () {
    var self = this;
    this._destroyInstance();
    this.pendingEnd = null;
    this.overlayMode = null;
    this.overlayEl.innerHTML = '';
    this.overlayEl.hidden = true;
    this.score = 0;
    this.rt.time = 0;
    this.rt.frame = 0;
    this.rt.score = 0;
    this.hudCache = { score: 0, best: this.best, status: '' };
    this.extraKey = '';
    this.keys.clear();
    this.justPressed.clear();
    this.pointer.down = false;
    this.pointer.clicked = false;
    this.pointer.x = this.width / 2;
    this.pointer.y = this.height / 2;
    /* 先清空 HUD，再交给 create()：create 里面 setHud / setStatus 的内容必须保留 */
    this._paintExtra({});
    this.rt.setStatus('');
    this.rt.best = this.best;
    try {
      this.instance = this.game.create(this.rt) || {};
    } catch (err) {
      this._fail(err, '创建游戏');
      return;
    }
    this._paintHud(true);
    this._clearCanvas();
    this._renderOnce();
  };

  GameHost.prototype._destroyInstance = function () {
    if (this._cleanups && this._cleanups.length) {
      this._cleanups.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
    }
    this._cleanups = [];
    if (this.instance && typeof this.instance.destroy === 'function') {
      try { this.instance.destroy(); } catch (e) { /* ignore */ }
    }
    this.instance = null;
  };

  GameHost.prototype._clearCanvas = function () {
    var ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  };

  GameHost.prototype._renderOnce = function () {
    if (!this.instance) return;
    var ctx = this.ctx;
    ctx.save();
    try {
      ctx.fillStyle = this.rt.colors.bg;
      ctx.fillRect(0, 0, this.width, this.height);
      if (typeof this.instance.render === 'function') this.instance.render(ctx);
    } catch (err) {
      this._fail(err, '渲染');
    }
    ctx.restore();
  };

  GameHost.prototype._syncCanvas = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(this.width * dpr);
    var h = Math.round(this.height * dpr);
    if (this.dpr === dpr && this.canvas.width === w && this.canvas.height === h) return;
    this.dpr = dpr;
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.aspectRatio = this.width + ' / ' + this.height;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._renderOnce();
  };

  GameHost.prototype._schedule = function () {
    if (this.raf) return;
    this.raf = window.requestAnimationFrame(this._loop);
  };

  GameHost.prototype._frame = function (ts) {
    this.raf = null;
    if (this.state !== 'running') return;
    if (!this.lastTs) this.lastTs = ts;
    var dt = (ts - this.lastTs) / 1000;
    this.lastTs = ts;
    if (!isFinite(dt) || dt <= 0) dt = 1 / 60;
    if (dt > 0.05) dt = 0.05;

    var rt = this.rt;
    rt.time += dt;
    rt.frame++;

    try {
      if (this.instance && typeof this.instance.update === 'function') {
        this.instance.update(dt);
      }
    } catch (err) {
      this._fail(err, '更新');
      return;
    }

    this._renderOnce();

    if (this.pendingEnd) {
      this._finishEnd();
      return;
    }

    this.justPressed.clear();
    this.pointer.clicked = false;
    this._schedule();
  };

  GameHost.prototype._end = function (result) {
    if (this.pendingEnd || this.state === 'over') return;
    var score = Number(result.score);
    if (!isFinite(score)) score = this.score;
    score = Math.max(0, Math.round(score));
    this.pendingEnd = {
      score: score,
      message: result.message || '',
      won: !!result.won,
      stats: Array.isArray(result.stats) ? result.stats.slice(0, 6) : []
    };
    this.score = score;
    this.rt.score = score;
    if (score > this.best) {
      this.best = score;
      this.rt.best = score;
    }
    this._paintHud(true);
    if (typeof this.onScore === 'function') this.onScore(score);
  };

  GameHost.prototype._finishEnd = function () {
    var result = this.pendingEnd;
    this.pendingEnd = null;
    this.state = 'over';
    this._stopLoop();
    var record = Arcade.recordBest(this.game.id, result.score);
    this.best = record.best;
    this.rt.best = record.best;
    this._paintHud(true);
    if (result.won) Arcade.audio.play('win');
    else Arcade.audio.play('lose');
    this._showOverOverlay(result, record.isNew);
  };

  GameHost.prototype.restart = function () {
    if (this.overlayMode === 'error') {
      window.location.reload();
      return;
    }
    this._stopLoop();
    this._renderOnce();
    this._destroyInstance();
    this.state = 'running';
    this.overlayMode = null;
    this.overlayEl.hidden = true;
    this.overlayEl.innerHTML = '';
    this._startInstance();
    this.lastTs = 0;
    this._schedule();
    Arcade.audio.play('click');
  };

  GameHost.prototype._stopLoop = function () {
    if (this.raf) {
      window.cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  };

  GameHost.prototype.pause = function () {
    if (this.state !== 'running') return;
    this._stopLoop();
    this.state = 'paused';
    this.keys.clear();
    this.justPressed.clear();
    this.pointer.down = false;
    this._showPauseOverlay();
  };

  GameHost.prototype.resume = function () {
    if (this.state !== 'paused') return;
    this.overlayEl.hidden = true;
    this.overlayEl.innerHTML = '';
    this.overlayMode = null;
    this.state = 'running';
    this.lastTs = 0;
    this._schedule();
  };

  GameHost.prototype.togglePause = function () {
    if (this.state === 'running') this.pause();
    else if (this.state === 'paused') this.resume();
  };

  GameHost.prototype.exit = function () {
    this.destroy();
    this.onExit();
  };

  GameHost.prototype.destroy = function () {
    this._stopLoop();
    Arcade.recordBest(this.game.id, this.score);
    this._destroyInstance();
    this.state = 'idle';
    window.removeEventListener('keydown', this._boundKeyDown);
    window.removeEventListener('keyup', this._boundKeyUp);
    this.canvas.removeEventListener('pointerdown', this._boundDown);
    this.canvas.removeEventListener('pointermove', this._boundMove);
    this.canvas.removeEventListener('pointerup', this._boundUp);
    this.canvas.removeEventListener('pointercancel', this._boundUp);
    this.overlayEl.removeEventListener('click', this._boundOverlayClick);
    document.removeEventListener('visibilitychange', this._boundVisibility);
    window.removeEventListener('blur', this._boundBlur);
    window.removeEventListener('resize', this._boundResize);
    this.overlayEl.hidden = true;
    this.overlayEl.innerHTML = '';
  };

  /* ---------- HUD ---------- */
  GameHost.prototype._buildHud = function () {
    this.hudEl.innerHTML =
      '<div class="hud-stat hud-stat--main">' +
        '<span class="hud-label">分数</span>' +
        '<strong class="hud-value" data-hud="score">0</strong>' +
      '</div>' +
      '<div class="hud-stat">' +
        '<span class="hud-label">最高</span>' +
        '<strong class="hud-value hud-value--best" data-hud="best">0</strong>' +
      '</div>' +
      '<div class="hud-extra" data-hud="extra"></div>' +
      '<div class="hud-actions">' +
        '<button type="button" class="icon-btn" data-hud="mute" title="静音 (M)" aria-label="静音">🔊</button>' +
        '<button type="button" class="icon-btn" data-hud="pause" title="暂停 (Esc)" aria-label="暂停">⏸</button>' +
        '<button type="button" class="icon-btn" data-hud="restart" title="重新开始 (R)" aria-label="重新开始">↻</button>' +
      '</div>';
    this.scoreEl = this.hudEl.querySelector('[data-hud="score"]');
    this.bestEl = this.hudEl.querySelector('[data-hud="best"]');
    this.extraEl = this.hudEl.querySelector('[data-hud="extra"]');
    this.muteEl = this.hudEl.querySelector('[data-hud="mute"]');
    this.pauseEl = this.hudEl.querySelector('[data-hud="pause"]');

    var self = this;
    this.hudEl.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-hud]');
      if (!btn) return;
      var act = btn.getAttribute('data-hud');
      if (act === 'mute') {
        var muted = Arcade.audio.toggleMuted();
        self._paintMute(muted);
        self.onMuteChange(muted);
      } else if (act === 'pause') {
        self.togglePause();
      } else if (act === 'restart') {
        self.restart();
      }
    });
    this._paintMute(Arcade.audio.isMuted());
  };

  GameHost.prototype._paintMute = function (muted) {
    if (!this.muteEl) return;
    this.muteEl.textContent = muted ? '🔇' : '🔊';
    this.muteEl.setAttribute('aria-label', muted ? '取消静音' : '静音');
    this.muteEl.classList.toggle('is-off', muted);
  };

  GameHost.prototype._paintHud = function (bumpScore) {
    if (this.scoreEl) {
      var text = String(this.score);
      if (this.scoreEl.textContent !== text) {
        this.scoreEl.textContent = text;
        if (bumpScore) {
          this.scoreEl.classList.remove('is-bump');
          void this.scoreEl.offsetWidth;
          this.scoreEl.classList.add('is-bump');
        }
      }
    }
    if (this.bestEl) this.bestEl.textContent = String(this.best);
    var paused = this.state === 'paused';
    if (this.pauseEl) this.pauseEl.textContent = paused ? '▶' : '⏸';
    if (this.pauseEl) this.pauseEl.setAttribute('aria-label', paused ? '继续' : '暂停');
  };

  GameHost.prototype._paintExtra = function (data) {
    if (!this.extraEl) return;
    var keys = Object.keys(data || {});
    if (!keys.length) {
      this.extraEl.innerHTML = '';
      return;
    }
    this.extraEl.innerHTML = keys.map(function (k) {
      return '<div class="hud-chip"><span class="hud-chip__label">' + esc(k) +
        '</span><span class="hud-chip__value">' + esc(data[k]) + '</span></div>';
    }).join('');
  };

  /* ---------- 覆盖层 ---------- */
  GameHost.prototype._showOverlay = function (mode, html) {
    this.overlayMode = mode;
    this.overlayEl.innerHTML = html;
    this.overlayEl.hidden = false;
    this.overlayEl.setAttribute('data-mode', mode);
  };

  GameHost.prototype._showPauseOverlay = function () {
    this._paintHud();
    this._showOverlay('paused',
      '<div class="overlay-card overlay-card--pause">' +
        '<div class="overlay-eyebrow">PAUSED</div>' +
        '<h2 class="overlay-title">暂停中</h2>' +
        '<p class="overlay-message">休息一下，回来继续。</p>' +
        '<div class="overlay-actions">' +
          '<button type="button" class="btn btn-primary" data-act="resume">继续游戏</button>' +
          '<button type="button" class="btn btn-ghost" data-act="restart">重新开始</button>' +
          '<button type="button" class="btn btn-ghost" data-act="exit">返回大厅</button>' +
        '</div>' +
        '<p class="overlay-hint">Esc / P 继续 · R 重开</p>' +
      '</div>');
  };

  GameHost.prototype._showOverOverlay = function (result, isNewRecord) {
    var stats = result.stats || [];
    var statsHtml = stats.length
      ? '<dl class="overlay-stats">' + stats.map(function (s) {
          return '<div><dt>' + esc(s.label) + '</dt><dd>' + esc(s.value) + '</dd></div>';
        }).join('') + '</dl>'
      : '';
    this._showOverlay('over',
      '<div class="overlay-card">' +
        '<div class="overlay-eyebrow">' + (result.won ? 'YOU WIN' : 'GAME OVER') + '</div>' +
        '<h2 class="overlay-title">' + (result.won ? '通关！' : '游戏结束') + '</h2>' +
        (!result.won ? '<div class="taunt-card" aria-hidden="true"><span>菜</span></div>' : '') +
        (result.message ? '<p class="overlay-message">' + esc(result.message) + '</p>' : '') +
        '<div class="overlay-score">' +
          (isNewRecord ? '<span class="overlay-record">🏆 新纪录</span>' : '<span class="overlay-score__label">本局得分</span>') +
          '<strong>' + String(result.score) + '</strong>' +
          (isNewRecord ? '<span class="overlay-score__label">历史最高</span>' : '') +
        '</div>' +
        statsHtml +
        '<div class="overlay-actions">' +
          '<button type="button" class="btn btn-primary" data-act="restart">再来一局</button>' +
          '<button type="button" class="btn btn-ghost" data-act="exit">返回大厅</button>' +
        '</div>' +
        '<p class="overlay-hint">Enter 再来一局 · Esc 返回大厅</p>' +
      '</div>');
  };

  GameHost.prototype._fail = function (err, phase) {
    console.error('[arcade] ' + this.game.id + ' ' + phase + '出错：', err);
    this._stopLoop();
    this.state = 'error';
    this._showOverlay('error',
      '<div class="overlay-card">' +
        '<div class="overlay-eyebrow">ERROR</div>' +
        '<h2 class="overlay-title">游戏出错了</h2>' +
        '<p class="overlay-message">' + esc(phase) + '时发生异常：' + esc(err && err.message ? err.message : String(err)) + '</p>' +
        '<div class="overlay-actions">' +
          '<button type="button" class="btn btn-primary" data-act="restart">重新开始</button>' +
          '<button type="button" class="btn btn-ghost" data-act="exit">返回大厅</button>' +
        '</div>' +
      '</div>');
  };

  GameHost.prototype._onOverlayClick = function (e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    if (act === 'resume') this.resume();
    else if (act === 'restart') this.restart();
    else if (act === 'exit') this.exit();
  };

  /* ---------- 输入 ---------- */
  GameHost.prototype._onKeyDown = function (e) {
    var code = e.code;
    var target = e.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

    if (this.state === 'over' || this.state === 'error') {
      if (code === 'Enter' || code === 'NumpadEnter') { e.preventDefault(); this.restart(); return; }
      if (code === 'Escape') { e.preventDefault(); this.exit(); return; }
      return;
    }
    if (code === 'Escape' || code === 'KeyP') {
      e.preventDefault();
      this.togglePause();
      return;
    }
    if (code === 'KeyR') {
      e.preventDefault();
      this.restart();
      return;
    }
    if (code === 'KeyM') {
      var muted = Arcade.audio.toggleMuted();
      this._paintMute(muted);
      this.onMuteChange(muted);
      return;
    }
    if (this.state !== 'running') return;
    if (BLOCK_DEFAULT[code] === 1) e.preventDefault();
    if (!e.repeat) this.justPressed.add(code);
    this.keys.add(code);
    if (this.instance && typeof this.instance.onKeyDown === 'function') {
      try { this.instance.onKeyDown(code, e); } catch (err) { this._fail(err, '按键处理'); }
    }
  };

  GameHost.prototype._onKeyUp = function (e) {
    this.keys.delete(e.code);
  };

  GameHost.prototype._toLogical = function (e) {
    var rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: this.pointer.x, y: this.pointer.y };
    var x = (e.clientX - rect.left) / rect.width * this.width;
    var y = (e.clientY - rect.top) / rect.height * this.height;
    return {
      x: Math.max(0, Math.min(this.width, x)),
      y: Math.max(0, Math.min(this.height, y))
    };
  };

  GameHost.prototype._callPointer = function (name, x, y, event) {
    if (!this.instance || typeof this.instance[name] !== 'function') return;
    try { this.instance[name](x, y, event); } catch (err) { this._fail(err, '指针处理'); }
  };

  GameHost.prototype._onPointerDown = function (e) {
    if (this.state !== 'running') return;
    e.preventDefault();
    if (this.canvas.setPointerCapture) {
      try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
    var p = this._toLogical(e);
    this.pointer.x = p.x;
    this.pointer.y = p.y;
    this.pointer.down = true;
    this.pointer.clicked = true;
    this._callPointer('onPointerDown', p.x, p.y, e);
  };

  GameHost.prototype._onPointerMove = function (e) {
    var p = this._toLogical(e);
    this.pointer.x = p.x;
    this.pointer.y = p.y;
    if (this.state === 'running') this._callPointer('onPointerMove', p.x, p.y, e);
  };

  GameHost.prototype._onPointerUp = function (e) {
    this.pointer.down = false;
    if (this.state === 'running') {
      var p = this._toLogical(e);
      this._callPointer('onPointerUp', p.x, p.y, e);
    }
  };

  GameHost.prototype._onVisibility = function () {
    if (document.hidden) {
      if (this.state === 'running') this.pause();
    } else {
      this.lastTs = 0;
    }
  };

  GameHost.prototype._onBlur = function () {
    if (this.state === 'running') this.pause();
  };

  Arcade.GameHost = GameHost;
  Arcade.createHost = function (opts) { return new GameHost(opts); };
})();
