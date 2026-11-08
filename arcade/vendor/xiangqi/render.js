/*!
 * 中国象棋 · Canvas 渲染层
 * 静态棋盘（木纹 / 格线 / 楚河汉界）绘制一次后缓存，每帧只重绘棋子与高亮
 */
(function (global) {
  'use strict';

  var X = global.Xiangqi;

  var COLS = 9, ROWS = 10;
  var MARGIN_RATIO = 1.0;    // 边距 = cell * MARGIN_RATIO（留出纵线坐标的位置）
  var PIECE_RATIO = 0.44;    // 棋子半径 = cell * PIECE_RATIO

  function BoardRenderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cell = 60;
    this.ox = 0;
    this.oy = 0;
    this.dpr = global.devicePixelRatio || 1;

    this.board = Int8Array.from(X.START);
    this.selected = -1;
    this.targets = [];
    this.lastMove = null;   // {from, to}
    this.checkSq = -1;
    this.hover = -1;
    this.flipped = false;
    this.anim = null;
    this.pulse = 0;
    this._bg = null;

    var self = this;
    this._loop = function () {
      self.pulse += 0.05;
      self.draw();
      self._raf = global.requestAnimationFrame(self._loop);
    };
  }

  BoardRenderer.prototype.start = function () {
    if (!this._raf) this._raf = global.requestAnimationFrame(this._loop);
  };
  BoardRenderer.prototype.stop = function () {
    if (this._raf) { global.cancelAnimationFrame(this._raf); this._raf = null; }
  };

  /** 根据容器尺寸重算棋盘布局 */
  BoardRenderer.prototype.resize = function (cssW, cssH) {
    var m = MARGIN_RATIO;
    var cell = Math.min(cssW / (COLS - 1 + 2 * m), cssH / (ROWS - 1 + 2 * m));
    cell = Math.max(24, Math.floor(cell));
    this.cell = cell;

    var w = Math.round((COLS - 1 + 2 * m) * cell);
    var h = Math.round((ROWS - 1 + 2 * m) * cell);
    this.dpr = global.devicePixelRatio || 1;

    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.ox = Math.round(m * cell);
    this.oy = Math.round(m * cell);
    this.width = w;
    this.height = h;
    this._bg = null; // 尺寸变化后重建静态层
  };

  /** 棋盘坐标 -> 画布像素（考虑翻转） */
  BoardRenderer.prototype.pos = function (sq) {
    var r = X.row(sq), c = X.col(sq);
    if (this.flipped) { r = 9 - r; c = 8 - c; }
    return { x: this.ox + c * this.cell, y: this.oy + r * this.cell };
  };

  /** 画布像素 -> 棋盘格子，超出范围返回 -1 */
  BoardRenderer.prototype.hitTest = function (px, py) {
    var c = Math.round((px - this.ox) / this.cell);
    var r = Math.round((py - this.oy) / this.cell);
    if (r < 0 || r > 9 || c < 0 || c > 8) return -1;
    var p = this.pos(X.sq(this.flipped ? 9 - r : r, this.flipped ? 8 - c : c));
    if (Math.hypot(px - p.x, py - p.y) > this.cell * 0.62) return -1;
    return X.sq(this.flipped ? 9 - r : r, this.flipped ? 8 - c : c);
  };

  // ---------- 静态层 ----------
  BoardRenderer.prototype.buildBackground = function () {
    var cell = this.cell, ox = this.ox, oy = this.oy;
    var cv = document.createElement('canvas');
    cv.width = this.canvas.width;
    cv.height = this.canvas.height;
    var g = cv.getContext('2d');
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    var W = this.width, H = this.height;

    // 木纹底色
    var grad = g.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#f6e3bd');
    grad.addColorStop(0.45, '#efd6a6');
    grad.addColorStop(1, '#e3c188');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    // 木纹肌理
    g.save();
    g.globalAlpha = 0.05;
    g.strokeStyle = '#7a4a1c';
    for (var i = 0; i < 46; i++) {
      var y = (i / 46) * H + Math.sin(i * 1.7) * 3;
      g.lineWidth = 0.6 + (i % 4) * 0.35;
      g.beginPath();
      g.moveTo(0, y);
      for (var xx = 0; xx <= W; xx += 26) {
        g.lineTo(xx, y + Math.sin((xx * 0.012) + i * 0.9) * 2.4);
      }
      g.stroke();
    }
    g.restore();

    // 四角暗角
    var vig = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.78);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(92,52,12,0.28)');
    g.fillStyle = vig;
    g.fillRect(0, 0, W, H);

    var LINE = 'rgba(88,54,22,0.78)';
    g.strokeStyle = LINE;
    g.lineCap = 'round';

    // 横线
    g.lineWidth = 1.3;
    for (var r = 0; r < ROWS; r++) {
      g.beginPath();
      g.moveTo(ox, oy + r * cell);
      g.lineTo(ox + 8 * cell, oy + r * cell);
      g.stroke();
    }
    // 竖线（楚河汉界处断开，两侧边线贯通）
    for (var c = 0; c < COLS; c++) {
      g.beginPath();
      if (c === 0 || c === 8) {
        g.moveTo(ox + c * cell, oy);
        g.lineTo(ox + c * cell, oy + 9 * cell);
      } else {
        g.moveTo(ox + c * cell, oy);
        g.lineTo(ox + c * cell, oy + 4 * cell);
        g.moveTo(ox + c * cell, oy + 5 * cell);
        g.lineTo(ox + c * cell, oy + 9 * cell);
      }
      g.stroke();
    }

    // 九宫斜线
    g.lineWidth = 1.2;
    [[0, 2], [7, 9]].forEach(function (p) {
      g.beginPath();
      g.moveTo(ox + 3 * cell, oy + p[0] * cell);
      g.lineTo(ox + 5 * cell, oy + p[1] * cell);
      g.moveTo(ox + 5 * cell, oy + p[0] * cell);
      g.lineTo(ox + 3 * cell, oy + p[1] * cell);
      g.stroke();
    });

    // 外框：双线
    var pad = cell * 0.30;
    g.lineWidth = 2.6;
    g.strokeStyle = 'rgba(80,46,16,0.9)';
    g.strokeRect(ox - pad, oy - pad, 8 * cell + pad * 2, 9 * cell + pad * 2);
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(80,46,16,0.55)';
    g.strokeRect(ox - pad * 1.72, oy - pad * 1.72, 8 * cell + pad * 3.44, 9 * cell + pad * 3.44);

    // 炮位 / 兵位的准星
    var marks = [[2, 1], [2, 7], [7, 1], [7, 7],
                 [3, 0], [3, 2], [3, 4], [3, 6], [3, 8],
                 [6, 0], [6, 2], [6, 4], [6, 6], [6, 8]];
    g.strokeStyle = 'rgba(88,54,22,0.8)';
    g.lineWidth = 1.4;
    var d = cell * 0.09, len = cell * 0.16;
    marks.forEach(function (m) {
      var x = ox + m[1] * cell, y = oy + m[0] * cell;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) {
        if ((m[1] === 0 && s[0] < 0) || (m[1] === 8 && s[0] > 0)) return;
        g.beginPath();
        g.moveTo(x + s[0] * d, y + s[1] * (d + len));
        g.lineTo(x + s[0] * d, y + s[1] * d);
        g.lineTo(x + s[0] * (d + len), y + s[1] * d);
        g.stroke();
      });
    });

    // 楚河 · 汉界
    g.save();
    g.fillStyle = 'rgba(104,62,24,0.5)';
    g.font = '600 ' + Math.round(cell * 0.52) + 'px "STKaiti","KaiTi","Kaiti SC","Songti SC","SimSun",serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    var my = oy + 4.5 * cell;
    var left = ['楚', '河'], right = ['汉', '界'];
    left.forEach(function (ch, i) { g.fillText(ch, ox + (1.3 + i * 0.95) * cell, my); });
    right.forEach(function (ch, i) { g.fillText(ch, ox + (5.75 + i * 0.95) * cell, my); });
    g.restore();

    // 纵线坐标
    g.save();
    g.fillStyle = 'rgba(96,58,22,0.62)';
    g.font = '500 ' + Math.round(cell * 0.25) + 'px "PingFang SC","Microsoft YaHei",sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    var cn = ['九', '八', '七', '六', '五', '四', '三', '二', '一'];
    for (var k = 0; k < 9; k++) {
      var lbl = this.flipped ? String(9 - k) : cn[k];
      var top = this.flipped ? cn[8 - k] : String(k + 1);
      g.fillText(lbl, ox + k * cell, oy + 9 * cell + cell * 0.74);
      g.fillText(top, ox + k * cell, oy - cell * 0.74);
    }
    g.restore();

    this._bg = cv;
  };

  // ---------- 棋子 ----------
  BoardRenderer.prototype.drawPiece = function (g, x, y, piece, scale, alpha) {
    var R = this.cell * PIECE_RATIO * (scale || 1);
    var isRed = piece > 0;
    var t = X.typeOf(piece);
    var glyph = X.GLYPH[t][isRed ? 0 : 1];

    g.save();
    g.globalAlpha = alpha == null ? 1 : alpha;

    // 投影
    g.beginPath();
    g.ellipse(x + R * 0.09, y + R * 0.16, R * 0.98, R * 0.92, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(60,34,10,0.32)';
    g.filter = 'blur(3px)';
    g.fill();
    g.filter = 'none';

    // 棋子本体
    var gr = g.createRadialGradient(x - R * 0.36, y - R * 0.42, R * 0.12, x, y, R * 1.08);
    gr.addColorStop(0, '#fffaf0');
    gr.addColorStop(0.42, '#f7e7c6');
    gr.addColorStop(0.82, '#e9d0a3');
    gr.addColorStop(1, '#cfae7c');
    g.beginPath();
    g.arc(x, y, R, 0, Math.PI * 2);
    g.fillStyle = gr;
    g.fill();

    // 外圈立体边
    g.lineWidth = Math.max(1.2, R * 0.07);
    g.strokeStyle = 'rgba(122,80,34,0.75)';
    g.stroke();
    g.beginPath();
    g.arc(x, y, R * 0.93, Math.PI * 0.75, Math.PI * 1.75);
    g.lineWidth = Math.max(1, R * 0.05);
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.stroke();

    // 内圈
    var main = isRed ? '#b1252b' : '#26333f';
    g.beginPath();
    g.arc(x, y, R * 0.76, 0, Math.PI * 2);
    g.lineWidth = Math.max(1, R * 0.055);
    g.strokeStyle = main;
    g.globalAlpha = (alpha == null ? 1 : alpha) * 0.85;
    g.stroke();
    g.globalAlpha = alpha == null ? 1 : alpha;

    // 字
    g.fillStyle = main;
    g.font = '700 ' + Math.round(R * 1.06) + 'px "STKaiti","KaiTi","Kaiti SC","Songti SC","SimSun",serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(glyph, x, y + R * 0.04);
    g.restore();
  };

  // ---------- 每帧渲染 ----------
  BoardRenderer.prototype.draw = function () {
    var g = this.ctx, cell = this.cell;
    if (!this._bg) this.buildBackground();

    g.clearRect(0, 0, this.width, this.height);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this._bg, 0, 0);
    g.restore();

    var i, p;

    // 上一手标记
    if (this.lastMove) {
      [this.lastMove.from, this.lastMove.to].forEach(function (s) {
        var q = this.pos(s), d = cell * 0.40, len = cell * 0.14;
        g.save();
        g.strokeStyle = 'rgba(214,143,43,0.95)';
        g.lineWidth = 2.4;
        g.lineCap = 'round';
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s2) {
          g.beginPath();
          g.moveTo(q.x + s2[0] * d, q.y + s2[1] * (d - len));
          g.lineTo(q.x + s2[0] * d, q.y + s2[1] * d);
          g.lineTo(q.x + s2[0] * (d - len), q.y + s2[1] * d);
          g.stroke();
        });
        g.restore();
      }, this);
    }

    // 将军警示
    if (this.checkSq >= 0) {
      var kp = this.pos(this.checkSq);
      var w = 0.5 + 0.5 * Math.sin(this.pulse * 2.2);
      var rg = g.createRadialGradient(kp.x, kp.y, cell * 0.1, kp.x, kp.y, cell * 0.78);
      rg.addColorStop(0, 'rgba(224,49,49,' + (0.42 + 0.28 * w) + ')');
      rg.addColorStop(1, 'rgba(224,49,49,0)');
      g.fillStyle = rg;
      g.beginPath();
      g.arc(kp.x, kp.y, cell * 0.78, 0, Math.PI * 2);
      g.fill();
    }

    // 悬停
    if (this.hover >= 0 && this.hover !== this.selected && this.board[this.hover] !== 0) {
      var hp = this.pos(this.hover);
      g.beginPath();
      g.arc(hp.x, hp.y, cell * PIECE_RATIO * 1.08, 0, Math.PI * 2);
      g.strokeStyle = 'rgba(180,120,50,0.45)';
      g.lineWidth = 2;
      g.stroke();
    }

    // 棋子
    var animFrom = this.anim ? this.anim.from : -1;
    var animTo = this.anim ? this.anim.to : -1;
    for (i = 0; i < 90; i++) {
      p = this.board[i];
      if (p === 0 || i === animTo) continue;
      var pt = this.pos(i);
      var sel = (i === this.selected);
      this.drawPiece(g, pt.x, pt.y, p, sel ? 1.06 : 1);
    }

    // 选中光环
    if (this.selected >= 0 && this.board[this.selected] !== 0) {
      var sp = this.pos(this.selected);
      var a = 0.55 + 0.35 * Math.sin(this.pulse * 2.6);
      g.save();
      g.beginPath();
      g.arc(sp.x, sp.y, cell * PIECE_RATIO * 1.16, 0, Math.PI * 2);
      g.strokeStyle = 'rgba(230,168,58,' + a + ')';
      g.lineWidth = 3;
      g.shadowColor = 'rgba(230,168,58,0.9)';
      g.shadowBlur = 12;
      g.stroke();
      g.restore();
    }

    // 可走点
    for (i = 0; i < this.targets.length; i++) {
      var ts = this.targets[i], tp = this.pos(ts);
      g.save();
      if (this.board[ts] !== 0) {
        g.beginPath();
        g.arc(tp.x, tp.y, cell * PIECE_RATIO * 1.14, 0, Math.PI * 2);
        g.strokeStyle = 'rgba(202,74,52,0.85)';
        g.lineWidth = 3.2;
        g.setLineDash([cell * 0.16, cell * 0.12]);
        g.stroke();
      } else {
        g.beginPath();
        g.arc(tp.x, tp.y, cell * 0.13, 0, Math.PI * 2);
        g.fillStyle = 'rgba(94,62,26,0.42)';
        g.fill();
      }
      g.restore();
    }

    // 移动动画
    if (this.anim) {
      var an = this.anim;
      var k = Math.min(1, (Date.now() - an.t0) / an.dur);
      var e = 1 - Math.pow(1 - k, 3);
      var a1 = this.pos(an.from), a2 = this.pos(an.to);
      var x = a1.x + (a2.x - a1.x) * e;
      var y = a1.y + (a2.y - a1.y) * e;
      var lift = Math.sin(Math.PI * e) * cell * 0.10;
      this.drawPiece(g, x, y - lift, an.piece, 1 + Math.sin(Math.PI * e) * 0.07);
      if (k >= 1) this.anim = null;
    }
  };

  /** 播放一次移动动画（纯视觉，不承载对局逻辑） */
  BoardRenderer.prototype.animateMove = function (from, to, piece, dur) {
    this.anim = { from: from, to: to, piece: piece, t0: Date.now(), dur: dur || 220 };
  };

  BoardRenderer.prototype.setFlipped = function (f) {
    this.flipped = !!f;
    this._bg = null;
  };

  global.BoardRenderer = BoardRenderer;
})(window);
