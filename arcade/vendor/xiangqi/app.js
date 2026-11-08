/*!
 * 中国象棋 · 应用层
 * 负责对局流程、人机交互、走子动画调度、音效与界面更新
 */
(function (global) {
  'use strict';

  var X = global.Xiangqi;
  var AI = global.XiangqiAI;

  // ---------- 音效（WebAudio 合成，无需外部资源）----------
  var Sound = {
    enabled: true,
    ctx: null,
    init: function () {
      if (!this.ctx) {
        var AC = global.AudioContext || global.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    tone: function (freq, dur, type, gain, delay) {
      if (!this.enabled || !this.ctx) return;
      var c = this.ctx, t = c.currentTime + (delay || 0);
      var osc = c.createOscillator(), g = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain || 0.18, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g); g.connect(c.destination);
      osc.start(t); osc.stop(t + dur + 0.02);
    },
    noise: function (dur, gain, freq) {
      if (!this.enabled || !this.ctx) return;
      var c = this.ctx, n = Math.floor(c.sampleRate * dur);
      var buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.5);
      var src = c.createBufferSource(); src.buffer = buf;
      var flt = c.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = freq || 1600;
      var g = c.createGain(); g.gain.value = gain || 0.12;
      src.connect(flt); flt.connect(g); g.connect(c.destination);
      src.start();
    },
    move: function () { this.noise(0.06, 0.10, 2200); this.tone(320, 0.08, 'triangle', 0.10); },
    capture: function () { this.noise(0.13, 0.20, 900); this.tone(150, 0.18, 'square', 0.10); },
    check: function () { this.tone(880, 0.16, 'sine', 0.16); this.tone(1180, 0.22, 'sine', 0.14, 0.09); },
    win: function () { [523, 659, 784, 1047].forEach(function (f, i) { Sound.tone(f, 0.30, 'sine', 0.14, i * 0.10); }); },
    lose: function () { [523, 440, 349, 262].forEach(function (f, i) { Sound.tone(f, 0.34, 'sine', 0.13, i * 0.11); }); }
  };

  // ---------- 对局状态 ----------
  var G = {
    board: Int8Array.from(X.START),
    side: X.RED,
    mode: 'ai',          // 'ai' | 'pvp'
    humanSide: X.RED,
    level: 'normal',
    history: [],         // {from,to,captured,side,text}
    captured: { 1: [], '-1': [] },  // key 为被吃方
    positions: {},
    selected: -1,
    targets: [],
    busy: false,
    over: false,
    startedAt: 0,
    clock: { 1: 0, '-1': 0 },
    lastTick: 0
  };

  var $ = function (id) { return document.getElementById(id); };
  var renderer, boardWrap;

  // ---------- 工具 ----------
  function posKey() {
    var s = '';
    for (var i = 0; i < 90; i++) s += String.fromCharCode(G.board[i] + 8);
    return s + (G.side > 0 ? 'r' : 'b');
  }
  function sideName(s) { return s === X.RED ? '红方' : '黑方'; }

  function legalFrom(sq) {
    var all = X.legalMoves(G.board, G.side), res = [];
    for (var i = 0; i < all.length; i++) {
      if (X.moveFrom(all[i]) === sq) res.push(X.moveTo(all[i]));
    }
    return res;
  }

  // ---------- 界面刷新 ----------
  function updateStatus(text, kind) {
    var el = $('status');
    el.textContent = text;
    el.className = 'status' + (kind ? ' ' + kind : '');
  }

  function updateTurn() {
    var dot = $('turnDot'), t = $('turnText');
    dot.className = 'turn-dot ' + (G.side === X.RED ? 'red' : 'black');
    var who = sideName(G.side);
    if (G.mode === 'ai') who += G.side === G.humanSide ? '（你）' : '（电脑）';
    t.textContent = G.over ? '对局结束' : who + '走棋';
  }

  function fmtTime(ms) {
    var s = Math.floor(ms / 1000);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  function updateClock() {
    $('timeRed').textContent = fmtTime(G.clock[1]);
    $('timeBlack').textContent = fmtTime(G.clock['-1']);
  }

  function updateMoveList() {
    var list = $('moveList');
    list.innerHTML = '';
    for (var i = 0; i < G.history.length; i += 2) {
      var row = document.createElement('div');
      row.className = 'move-row';
      row.innerHTML = '<span class="mv-no">' + (i / 2 + 1) + '.</span>' +
        '<span class="mv red">' + (G.history[i] ? G.history[i].text : '') + '</span>' +
        '<span class="mv black">' + (G.history[i + 1] ? G.history[i + 1].text : '') + '</span>';
      list.appendChild(row);
    }
    list.scrollTop = list.scrollHeight;
    $('moveCount').textContent = G.history.length;
  }

  function updateCaptured() {
    [['capRed', -1], ['capBlack', 1]].forEach(function (pair) {
      var el = $(pair[0]), arr = G.captured[String(pair[1])];
      el.innerHTML = '';
      arr.forEach(function (p) {
        var s = document.createElement('span');
        s.className = 'cap-piece ' + (p > 0 ? 'r' : 'b');
        s.textContent = X.GLYPH[X.typeOf(p)][p > 0 ? 0 : 1];
        el.appendChild(s);
      });
      if (!arr.length) el.innerHTML = '<span class="cap-empty">—</span>';
    });
  }

  function updateEval() {
    var raw = AI.evaluate(G.board);
    var pct = Math.max(-1, Math.min(1, raw / 1600));
    $('evalFill').style.width = ((pct + 1) / 2 * 100) + '%';
    var txt = raw === 0 ? '均势' : (raw > 0 ? '红优 +' : '黑优 +') + Math.abs(Math.round(raw / 10)) / 10;
    if (Math.abs(raw) < 40) txt = '均势';
    $('evalText').textContent = txt;
  }

  function refresh() {
    renderer.board = G.board;
    renderer.selected = G.selected;
    renderer.targets = G.targets;
    var last = G.history[G.history.length - 1];
    renderer.lastMove = last ? { from: last.from, to: last.to } : null;
    renderer.checkSq = X.inCheck(G.board, G.side) ? X.findKing(G.board, G.side) : -1;
    updateTurn();
    updateMoveList();
    updateCaptured();
    updateEval();
    $('btnUndo').disabled = G.history.length === 0 || G.busy;
    $('btnHint').disabled = G.busy || G.over;
  }

  // ---------- 对局流程 ----------
  function newGame() {
    G.board = Int8Array.from(X.START);
    G.side = X.RED;
    G.history = [];
    G.captured = { 1: [], '-1': [] };
    G.positions = {};
    G.selected = -1;
    G.targets = [];
    G.busy = false;
    G.over = false;
    G.clock = { 1: 0, '-1': 0 };
    G.lastTick = Date.now();
    G.positions[posKey()] = 1;
    hideOverlay();
    updateClock();
    refresh();
    updateStatus('新局开始，红先。', '');
    if (G.mode === 'ai' && G.side !== G.humanSide) scheduleAI();
  }

  function endGame(title, text, humanWon) {
    G.over = true;
    G.busy = false;
    G.selected = -1;
    G.targets = [];
    refresh();
    updateStatus(title, 'over');
    showOverlay(title, text);
    if (G.mode === 'pvp' || humanWon == null) Sound.win();
    else humanWon ? Sound.win() : Sound.lose();
  }

  /** 执行一步棋（含动画），完成后进入下一手 */
  function doMove(from, to) {
    var text = X.moveToChinese(G.board, from, to);
    var piece = G.board[from];
    var cap = G.board[to];

    G.board[to] = piece;
    G.board[from] = 0;
    if (cap !== 0) G.captured[String(X.sideOf(cap))].push(cap);
    G.history.push({ from: from, to: to, captured: cap, side: G.side, text: text });
    G.selected = -1;
    G.targets = [];
    G.side = -G.side;
    G.busy = true;
    refresh();

    var DUR = 200;
    renderer.animateMove(from, to, piece, DUR);
    setTimeout(function () {
      if (cap !== 0) Sound.capture(); else Sound.move();
      afterMove(cap);
    }, DUR);
  }

  function afterMove(cap) {
    var key = posKey();
    G.positions[key] = (G.positions[key] || 0) + 1;

    var legal = X.legalMoves(G.board, G.side);
    var checked = X.inCheck(G.board, G.side);

    if (legal.length === 0) {
      var winner = -G.side;
      var reason = checked ? '绝杀' : '困毙（无子可动）';
      G.busy = false;
      endGame(sideName(winner) + '胜', reason + '，' + sideName(winner) + '获胜！',
        G.mode === 'ai' ? winner === G.humanSide : null);
      return;
    }

    if (G.positions[key] >= 3) {
      G.busy = false;
      endGame('和棋', '同一局面出现三次，判和。', null);
      return;
    }
    // 六十回合内无吃子判和
    var idle = 0;
    for (var i = G.history.length - 1; i >= 0 && G.history[i].captured === 0; i--) idle++;
    if (idle >= 120) {
      G.busy = false;
      endGame('和棋', '连续 60 回合无吃子，判和。', null);
      return;
    }

    G.busy = false;
    refresh();

    if (checked) {
      Sound.check();
      updateStatus(sideName(G.side) + '被将军！', 'check');
    } else {
      updateStatus(cap !== 0 ? '吃子！' : '', '');
    }

    if (G.mode === 'ai' && G.side !== G.humanSide) scheduleAI();
  }

  function scheduleAI() {
    G.busy = true;
    refresh();
    $('thinking').classList.add('on');
    updateStatus('电脑思考中…', 'thinking');
    setTimeout(function () {
      var lv = AI.LEVELS[G.level];
      var mv = AI.bookMove(G.board, G.side, G.history.length);
      var info = null;
      if (!mv) {
        info = AI.think(G.board, G.side, lv);
        mv = info.move;
      }
      $('thinking').classList.remove('on');
      if (!mv) { G.busy = false; return; }
      if (info) {
        $('aiInfo').textContent = '深度 ' + info.depth + ' · ' + (info.nodes / 1000).toFixed(0) + 'k 节点 · ' + info.ms + 'ms';
      } else {
        $('aiInfo').textContent = '开局库';
      }
      doMove(X.moveFrom(mv), X.moveTo(mv));
    }, 40);
  }

  function undo() {
    if (G.busy || !G.history.length) return;
    var steps = (G.mode === 'ai' && G.history.length >= 2) ? 2 : 1;
    // 若最后一手是人走的（AI 还没回应），只退一步
    if (G.mode === 'ai' && G.history[G.history.length - 1].side === G.humanSide) steps = 1;
    for (var s = 0; s < steps && G.history.length; s++) {
      var h = G.history.pop();
      var key = posKey();
      if (G.positions[key]) G.positions[key]--;
      G.board[h.from] = G.board[h.to];
      G.board[h.to] = h.captured;
      if (h.captured !== 0) {
        var arr = G.captured[String(X.sideOf(h.captured))];
        arr.pop();
      }
      G.side = h.side;
    }
    G.over = false;
    G.selected = -1;
    G.targets = [];
    hideOverlay();
    refresh();
    updateStatus('已悔棋。', '');
  }

  function hint() {
    if (G.busy || G.over) return;
    G.busy = true;
    updateStatus('正在为你分析…', 'thinking');
    $('thinking').classList.add('on');
    setTimeout(function () {
      var info = AI.think(G.board, G.side, AI.LEVELS.normal);
      $('thinking').classList.remove('on');
      G.busy = false;
      if (!info.move) { refresh(); return; }
      var f = X.moveFrom(info.move), t = X.moveTo(info.move);
      G.selected = f;
      G.targets = [t];
      refresh();
      updateStatus('建议：' + X.moveToChinese(G.board, f, t), 'hint');
    }, 40);
  }

  // ---------- 输入 ----------
  function onPick(sq) {
    if (G.over || G.busy) return;
    if (G.mode === 'ai' && G.side !== G.humanSide) return;

    var p = G.board[sq];
    if (G.selected >= 0 && G.targets.indexOf(sq) >= 0) {
      doMove(G.selected, sq);
      return;
    }
    if (p !== 0 && X.sideOf(p) === G.side) {
      G.selected = sq;
      G.targets = legalFrom(sq);
      Sound.init();
      Sound.tone(520, 0.05, 'sine', 0.07);
      refresh();
      if (!G.targets.length) updateStatus('该子无路可走。', '');
      return;
    }
    if (G.selected >= 0) {
      G.selected = -1;
      G.targets = [];
      refresh();
    }
  }

  function canvasPoint(e) {
    var rect = renderer.canvas.getBoundingClientRect();
    var t = e.touches && e.touches[0] ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }

  // ---------- 弹窗 ----------
  function showOverlay(title, text) {
    $('overlayTitle').textContent = title;
    $('overlayText').textContent = text;
    $('overlay').classList.add('on');
  }
  function hideOverlay() { $('overlay').classList.remove('on'); }

  // ---------- 设置控件 ----------
  function bindSeg(groupId, onChange) {
    var g = $(groupId);
    g.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.classList.contains('active')) return;
      g.querySelectorAll('button').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      onChange(b.dataset.value);
    });
  }

  function fitBoard() {
    var w = boardWrap.clientWidth;
    var h = boardWrap.clientHeight;
    renderer.resize(w, h);
  }

  // ---------- 启动 ----------
  function init() {
    boardWrap = $('boardWrap');
    renderer = new global.BoardRenderer($('board'));
    fitBoard();
    renderer.start();

    var cv = renderer.canvas;
    cv.addEventListener('mousedown', function (e) {
      Sound.init();
      var pt = canvasPoint(e);
      var sq = renderer.hitTest(pt.x, pt.y);
      if (sq >= 0) onPick(sq);
    });
    cv.addEventListener('mousemove', function (e) {
      var pt = canvasPoint(e);
      renderer.hover = renderer.hitTest(pt.x, pt.y);
      cv.style.cursor = renderer.hover >= 0 && G.board[renderer.hover] !== 0 ? 'pointer' : 'default';
    });
    cv.addEventListener('mouseleave', function () { renderer.hover = -1; });
    cv.addEventListener('touchstart', function (e) {
      Sound.init();
      var pt = canvasPoint(e);
      var sq = renderer.hitTest(pt.x, pt.y);
      if (sq >= 0) { e.preventDefault(); onPick(sq); }
    }, { passive: false });

    $('btnNew').addEventListener('click', newGame);
    $('btnUndo').addEventListener('click', undo);
    $('btnHint').addEventListener('click', hint);
    $('btnFlip').addEventListener('click', function () {
      renderer.setFlipped(!renderer.flipped);
      this.classList.toggle('active', renderer.flipped);
    });
    $('btnSound').addEventListener('click', function () {
      Sound.enabled = !Sound.enabled;
      this.classList.toggle('off', !Sound.enabled);
      this.querySelector('span').textContent = Sound.enabled ? '音效开' : '音效关';
      if (Sound.enabled) { Sound.init(); Sound.move(); }
    });
    $('btnAgain').addEventListener('click', newGame);
    $('overlayClose').addEventListener('click', hideOverlay);

    bindSeg('modeSel', function (v) {
      G.mode = v;
      $('sideRow').style.display = v === 'ai' ? '' : 'none';
      $('levelRow').style.display = v === 'ai' ? '' : 'none';
      newGame();
    });
    bindSeg('sideSel', function (v) {
      G.humanSide = v === 'red' ? X.RED : X.BLACK;
      renderer.setFlipped(G.humanSide === X.BLACK);
      $('btnFlip').classList.toggle('active', renderer.flipped);
      newGame();
    });
    bindSeg('levelSel', function (v) { G.level = v; });

    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'u' || (e.ctrlKey && e.key === 'z')) { e.preventDefault(); undo(); }
      if (e.key === 'n') newGame();
      if (e.key === 'h') hint();
      if (e.key === 'Escape') { G.selected = -1; G.targets = []; refresh(); }
    });

    global.addEventListener('resize', function () { fitBoard(); });

    // 计时器
    setInterval(function () {
      var now = Date.now();
      var dt = now - (G.lastTick || now);
      G.lastTick = now;
      if (!G.over && G.history.length + (G.busy ? 1 : 0) > 0) {
        G.clock[String(G.side)] += dt;
        updateClock();
      }
    }, 250);

    newGame();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  global.__xq = G;
})(window);
