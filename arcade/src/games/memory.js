/* 游戏：记忆翻牌 —— 记住位置，连击配对吧 */
(function () {
  'use strict';

  var COLS = 4;
  var ROWS = 5;
  var PAIRS = 10;
  var GAP = 12;
  var CARD_W = 112;
  var CARD_H = 92;
  var BOARD_W = COLS * CARD_W + (COLS - 1) * GAP; /* 484 */
  var BOARD_H = ROWS * CARD_H + (ROWS - 1) * GAP; /* 508 */
  var BX = (640 - BOARD_W) / 2; /* 78 */
  var BY = 114;

  var FLIP_DUR = 0.2;
  var POP_DUR = 0.25;
  var COMBO_WINDOW = 6;
  var MAX_PARTICLES = 260;

  var EMOJIS = ['🍒', '💎', '⚡', '🌙', '🔥', '🎵', '👾', '🚀', '🍀', '🎲'];

  var PAIR_COLORS = [
    '#f472b6', '#fb923c', '#fbbf24', '#a3e635', '#34d399',
    '#22d3ee', '#60a5fa', '#a78bfa', '#e879f9', '#f87171'
  ];

  function cardX(col) {
    return BX + col * (CARD_W + GAP);
  }

  function cardY(row) {
    return BY + row * (CARD_H + GAP);
  }

  function roundRect(ctx, x, y, w, h, r) {
    var radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function fmtClock(sec) {
    var total = Math.max(0, Math.floor(sec));
    var m = Math.floor(total / 60);
    var s = total % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  Arcade.register({
    id: 'memory',
    title: '记忆翻牌',
    subtitle: '记住位置，连击配对吧',
    description: '20 张霓虹卡牌藏着 10 对图案。翻开两张相同的牌即可配对，连续配对触发连击倍率，越多越爽。',
    icon: '🃏',
    accent: '#c084fc',
    accent2: '#6366f1',
    tags: ['益智', '休闲'],
    difficulty: '简单',
    width: 640,
    height: 640,
    order: 60,
    tips: '先翻一遍记住位置，再按连击节奏成对翻开；翻错会清空连击，稳一点更划算。',
    controls: [
      { keys: '鼠标点击', action: '翻开卡牌' },
      { keys: '触摸点击', action: '翻开卡牌' }
    ],

    create: function (rt) {
      var ctx = null;

      var cards;
      var pending;
      var locked;
      var judgeT;
      var waitT;

      var steps;
      var score;
      var combo;
      var maxCombo;
      var comboT;
      var matchedCount;
      var elapsed;
      var lastHudSec;

      var over;
      var overT;
      var endCalled;

      var particles;
      var rings;
      var popups;
      var ambient;
      var shake;
      var hoverIndex;

      var hudDirty;
      var statusDirty;

      var bgGrad;
      var glowA;
      var glowB;

      /* ---------- 牌堆 ---------- */

      function flipCard(card, to) {
        card.flipFrom = card.flip;
        card.flipTo = to;
        card.flipT = 0;
        card.flipDur = 0.16 + Math.abs(to - card.flip) * 0.06;
        card.flipping = true;
      }

      function setup() {
        cards = [];
        var deck = [];
        var p;
        for (p = 0; p < PAIRS; p++) {
          deck.push(p);
          deck.push(p);
        }
        for (var i = deck.length - 1; i > 0; i--) {
          var j = rt.randInt(0, i);
          var tmp = deck[i];
          deck[i] = deck[j];
          deck[j] = tmp;
        }
        for (var k = 0; k < deck.length; k++) {
          var pair = deck[k];
          var row = Math.floor(k / COLS);
          var col = k % COLS;
          cards.push({
            pair: pair,
            emoji: EMOJIS[pair],
            color: PAIR_COLORS[pair],
            row: row,
            col: col,
            x: cardX(col),
            y: cardY(row),
            flip: 0,
            flipFrom: 0,
            flipTo: 0,
            flipT: 1,
            flipDur: FLIP_DUR,
            flipping: false,
            state: 'back',
            matched: false,
            pop: 0,
            glow: 0
          });
        }
      }

      function cardIndexAt(x, y) {
        for (var i = 0; i < cards.length; i++) {
          var c = cards[i];
          if (x >= c.x && x <= c.x + CARD_W && y >= c.y && y <= c.y + CARD_H) return i;
        }
        return -1;
      }

      /* ---------- 特效 ---------- */

      function addBurst(px, py, color, count, power) {
        for (var i = 0; i < count; i++) {
          var a = rt.rand(0, Math.PI * 2);
          var sp = rt.rand(50, 190) * (power || 1);
          particles.push({
            x: px,
            y: py,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            life: rt.rand(0.3, 0.75),
            max: 0.75,
            r: rt.rand(1.6, 3.8),
            color: color
          });
        }
        if (particles.length > MAX_PARTICLES) {
          particles.splice(0, particles.length - MAX_PARTICLES);
        }
      }

      function addRing(px, py, color) {
        rings.push({ x: px, y: py, r: 8, life: 0.55, max: 0.55, color: color });
        if (rings.length > 24) rings.splice(0, rings.length - 24);
      }

      function addPopup(px, py, text, color) {
        popups.push({
          x: px,
          y: py,
          text: text,
          color: color,
          life: 1,
          max: 1
        });
      }

      /* ---------- 配对判定 ---------- */

      function judgeCards() {
        if (pending.length < 2) {
          pending = [];
          locked = false;
          return;
        }
        var a = pending[0];
        var b = pending[1];

        if (a.pair === b.pair) {
          a.state = 'matched';
          b.state = 'matched';
          a.matched = true;
          b.matched = true;
          a.pop = POP_DUR;
          b.pop = POP_DUR;
          a.glow = 0.7;
          b.glow = 0.7;
          matchedCount++;

          var mult = 1 + combo * 0.5;
          var gained = Math.round(100 * mult);
          score += gained;
          combo++;
          if (combo > maxCombo) maxCombo = combo;
          comboT = COMBO_WINDOW;
          rt.setScore(score);

          var ax = a.x + CARD_W / 2;
          var ay = a.y + CARD_H / 2;
          var bx = b.x + CARD_W / 2;
          var by = b.y + CARD_H / 2;
          addBurst(ax, ay, a.color, 12);
          addBurst(bx, by, b.color, 12);
          addRing(ax, ay, a.color);
          addRing(bx, by, b.color);
          addPopup((ax + bx) / 2, (ay + by) / 2 - 14, '+' + gained, '#fde68a');
          if (combo > 1) {
            addPopup((ax + bx) / 2, (ay + by) / 2 + 20, '连击 ×' + combo, '#fbbf24');
          }

          rt.audio.play('pop', 0.75);
          if (combo >= 3) rt.audio.play('power', 0.3);

          pending = [];
          locked = false;
          hudDirty = true;

          if (matchedCount >= PAIRS) {
            over = true;
            overT = 0;
            rt.audio.play('level', 0.85);
            rt.setStatus('');
          }
        } else {
          waitT = 0.7;
          combo = 0;
          comboT = 0;
          shake = 4;
          rt.audio.play('error', 0.45);
          hudDirty = true;
        }
      }

      function hidePending() {
        for (var i = 0; i < pending.length; i++) {
          var c = pending[i];
          if (!c.matched) {
            c.state = 'back';
            flipCard(c, 0);
          }
        }
        pending = [];
        locked = false;
      }

      /* ---------- HUD / 结算 ---------- */

      function updateHud() {
        rt.setHud({
          '步数': steps,
          '用时': fmtClock(elapsed),
          '连击': combo > 0 ? '×' + combo : '—'
        });
      }

      function finishGame() {
        rt.end({
          score: score,
          won: true,
          message: '全部配对完成，记忆力满分！',
          stats: [
            { label: '用时', value: elapsed.toFixed(1) + 's' },
            { label: '步数', value: steps },
            { label: '最高连击', value: maxCombo },
            { label: '平均每步', value: (elapsed / Math.max(1, steps)).toFixed(1) + 's' }
          ]
        });
      }

      function reset() {
        setup();
        pending = [];
        locked = false;
        judgeT = 0;
        waitT = 0;

        steps = 0;
        score = 0;
        combo = 0;
        maxCombo = 0;
        comboT = 0;
        matchedCount = 0;
        elapsed = 0;
        lastHudSec = -1;

        over = false;
        overT = 0;
        endCalled = false;

        particles = [];
        rings = [];
        popups = [];
        ambient = [];
        shake = 0;
        hoverIndex = -1;

        hudDirty = true;
        statusDirty = true;

        for (var i = 0; i < 16; i++) {
          ambient.push({
            x: rt.rand(0, 640),
            y: rt.rand(0, 640),
            r: rt.rand(0.8, 1.8),
            sp: rt.rand(7, 22),
            a: rt.rand(0.08, 0.2),
            ph: rt.rand(0, Math.PI * 2)
          });
        }

        rt.setScore(0);
      }

      /* ---------- 绘制 ---------- */

      function drawBackground(t) {
        if (!bgGrad) {
          bgGrad = ctx.createLinearGradient(0, 0, 640, 640);
          bgGrad.addColorStop(0, '#0a0a1a');
          bgGrad.addColorStop(0.5, '#121027');
          bgGrad.addColorStop(1, '#1a0f2b');
          glowA = ctx.createRadialGradient(120, 70, 20, 120, 70, 330);
          glowA.addColorStop(0, 'rgba(192, 132, 252, 0.16)');
          glowA.addColorStop(1, 'rgba(192, 132, 252, 0)');
          glowB = ctx.createRadialGradient(560, 600, 20, 560, 600, 350);
          glowB.addColorStop(0, 'rgba(99, 102, 241, 0.16)');
          glowB.addColorStop(1, 'rgba(99, 102, 241, 0)');
        }
        ctx.fillStyle = bgGrad;
        ctx.fillRect(-20, -20, 680, 680);
        ctx.fillStyle = glowA;
        ctx.fillRect(-20, -20, 680, 680);
        ctx.fillStyle = glowB;
        ctx.fillRect(-20, -20, 680, 680);

        ctx.strokeStyle = 'rgba(120, 130, 220, 0.045)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var gx = 0; gx <= 640; gx += 40) {
          ctx.moveTo(gx + 0.5, -20);
          ctx.lineTo(gx + 0.5, 660);
        }
        for (var gy = 0; gy <= 640; gy += 40) {
          ctx.moveTo(-20, gy + 0.5);
          ctx.lineTo(660, gy + 0.5);
        }
        ctx.stroke();

        ctx.fillStyle = '#c4b5fd';
        for (var i = 0; i < ambient.length; i++) {
          var d = ambient[i];
          ctx.globalAlpha = d.a * (0.6 + 0.4 * Math.sin(t * 1.4 + d.ph));
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      function drawChip(x, y, w, h, label, value) {
        ctx.fillStyle = 'rgba(20, 20, 44, 0.88)';
        roundRect(ctx, x, y, w, h, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.22)';
        ctx.lineWidth = 1;
        roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 12);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(165, 170, 210, 0.85)';
        ctx.font = '700 10px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText(label, x + w / 2, y + 15);
        ctx.fillStyle = '#e9d5ff';
        ctx.font = '900 17px "Consolas", monospace';
        ctx.fillText(String(value), x + w / 2, y + 35);
      }

      function drawHeader(t) {
        ctx.save();
        ctx.shadowColor = 'rgba(192, 132, 252, 0.8)';
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#e9d5ff';
        ctx.font = '900 28px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('记忆翻牌', BX, 50);
        ctx.restore();

        ctx.fillStyle = 'rgba(192, 132, 252, 0.6)';
        ctx.font = '700 11px "Consolas", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('NEON MEMORY · 10 PAIRS', BX, 70);

        var cw = 88;
        var gap = 8;
        var y = 16;
        var h = 52;
        var x = 562 - (cw * 3 + gap * 2);
        drawChip(x, y, cw, h, '配对', matchedCount + ' / ' + PAIRS);
        drawChip(x + cw + gap, y, cw, h, '最高连击', maxCombo > 0 ? '×' + maxCombo : '—');
        drawChip(x + cw * 2 + gap * 2, y, cw, h, '连击窗口', combo > 0 ? Math.ceil(comboT) + 's' : '—');

        if (combo > 0 && comboT > 0) {
          var bw = cw * 3 + gap * 2;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          roundRect(ctx, x, 76, bw, 5, 2.5);
          ctx.fill();
          ctx.fillStyle = 'rgba(251, 191, 36, 0.85)';
          roundRect(ctx, x, 76, bw * (comboT / COMBO_WINDOW), 5, 2.5);
          ctx.fill();
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.font = '600 11px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillStyle = 'rgba(165, 175, 210, 0.6)';
        ctx.fillText('点击牌面翻开 · 连续配对触发连击倍率', 320, 100);
      }

      function drawBoardPanel() {
        ctx.save();
        ctx.shadowColor = 'rgba(192, 132, 252, 0.25)';
        ctx.shadowBlur = 24;
        ctx.fillStyle = 'rgba(15, 17, 34, 0.72)';
        roundRect(ctx, BX - 10, BY - 10, BOARD_W + 20, BOARD_H + 20, 20);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = 'rgba(192, 132, 252, 0.16)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, BX - 9.25, BY - 9.25, BOARD_W + 18.5, BOARD_H + 18.5, 19);
        ctx.stroke();
      }

      function drawCard(card, t, index) {
        var isFront = card.flip >= 0.5;
        var scaleX = Math.abs(Math.cos(Math.PI * card.flip));
        if (scaleX < 0.06) return;
        var lift = Math.sin(Math.PI * card.flip) * 6;
        if (index === hoverIndex) lift += 3;

        var w = CARD_W;
        var h = CARD_H;
        var cx = card.x + w / 2;
        var cy = card.y + h / 2;

        ctx.save();
        ctx.translate(cx, cy - lift);
        ctx.scale(scaleX, 1);

        /* 卡片投影 */
        ctx.shadowColor = 'rgba(2, 4, 12, 0.55)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = isFront ? '#1b2138' : (index === hoverIndex ? '#2b3463' : '#232a4d');
        roundRect(ctx, -w / 2, -h / 2, w, h, 12);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        if (!isFront) {
          /* 背面 */
          ctx.strokeStyle = index === hoverIndex ? 'rgba(192, 132, 252, 0.9)' : 'rgba(192, 132, 252, 0.5)';
          ctx.lineWidth = 1.6;
          roundRect(ctx, -w / 2 + 1.2, -h / 2 + 1.2, w - 2.4, h - 2.4, 11);
          ctx.stroke();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
          roundRect(ctx, -w / 2 + 6, -h / 2 + 6, w - 12, h * 0.3, 8);
          ctx.fill();

          ctx.strokeStyle = 'rgba(167, 139, 250, 0.35)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(0, -15);
          ctx.lineTo(15, 0);
          ctx.lineTo(0, 15);
          ctx.lineTo(-15, 0);
          ctx.closePath();
          ctx.stroke();

          ctx.fillStyle = 'rgba(167, 139, 250, 0.55)';
          ctx.beginPath();
          ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = 'rgba(192, 132, 252, 0.28)';
          for (var di = 0; di < 4; di++) {
            var dx = (di % 2 === 0 ? -1 : 1) * (w / 2 - 13);
            var dy = (di < 2 ? -1 : 1) * (h / 2 - 13);
            ctx.beginPath();
            ctx.arc(dx, dy, 1.7, 0, Math.PI * 2);
            ctx.fill();
          }

          /* 扫光：全牌同步，形成整块光带 */
          var sh = (t * 0.5) % 1;
          ctx.globalAlpha = 0.07;
          ctx.fillStyle = '#e9d5ff';
          roundRect(ctx, -w / 2 + 10 + sh * (w - 34), -h / 2 + 8, 10, h - 16, 5);
          ctx.fill();
          ctx.globalAlpha = 1;
        } else {
          /* 正面 */
          var isMatched = card.state === 'matched';
          ctx.globalAlpha = 0.12;
          ctx.fillStyle = card.color;
          roundRect(ctx, -w / 2, -h / 2, w, h, 12);
          ctx.fill();
          ctx.globalAlpha = 1;

          ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
          roundRect(ctx, -w / 2 + 6, -h / 2 + 6, w - 12, h * 0.3, 8);
          ctx.fill();

          ctx.save();
          ctx.strokeStyle = card.color;
          ctx.lineWidth = 2;
          ctx.globalAlpha = isMatched ? 1 : 0.55;
          if (isMatched) {
            ctx.shadowColor = card.color;
            ctx.shadowBlur = 16 + Math.sin(t * 4 + index) * 6;
          }
          roundRect(ctx, -w / 2 + 1.2, -h / 2 + 1.2, w - 2.4, h - 2.4, 11);
          ctx.stroke();
          ctx.restore();

          var scalePop = 1;
          if (card.pop > 0) {
            var q = 1 - card.pop / POP_DUR;
            scalePop = 1 + Math.sin(Math.PI * q) * 0.14;
          }
          if (scalePop !== 1) ctx.scale(scalePop, scalePop);

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = '42px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
          ctx.fillStyle = '#f8fafc';
          ctx.fillText(card.emoji, 0, 3);
        }
        ctx.restore();
      }

      function drawParticles() {
        for (var i = 0; i < rings.length; i++) {
          var r = rings[i];
          ctx.globalAlpha = Math.max(0, r.life / r.max) * 0.7;
          ctx.strokeStyle = r.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        for (var j = 0; j < particles.length; j++) {
          var p = particles[j];
          ctx.globalAlpha = Math.max(0, p.life / p.max) * 0.9;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      function drawPopups() {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '900 18px "Consolas", monospace';
        for (var i = 0; i < popups.length; i++) {
          var p = popups[i];
          ctx.globalAlpha = Math.min(1, p.life / p.max) * Math.min(1, (p.max - p.life) * 8 + 0.2);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text, p.x, p.y);
        }
        ctx.globalAlpha = 1;
      }

      function drawCelebration() {
        if (!over) return;
        var a = Math.min(1, overT * 2.2);
        ctx.save();
        ctx.globalAlpha = a * 0.78;
        ctx.fillStyle = 'rgba(8, 10, 24, 1)';
        ctx.fillRect(0, 0, 640, 640);
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = a;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(192, 132, 252, 0.9)';
        ctx.shadowBlur = 26;
        ctx.fillStyle = '#e9d5ff';
        ctx.font = '900 34px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText('全部配对成功！', 320, 300);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(210, 220, 250, 0.82)';
        ctx.font = '600 15px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText(
          '用时 ' + elapsed.toFixed(1) + 's · 步数 ' + steps + ' · 最高连击 ' + maxCombo,
          320,
          344
        );
        ctx.restore();
      }

      reset();

      return {
        update: function (dt) {
          elapsed += dt;
          if (Math.floor(elapsed) !== lastHudSec) {
            lastHudSec = Math.floor(elapsed);
            hudDirty = true;
          }
          if (hudDirty) {
            updateHud();
            hudDirty = false;
          }
          if (statusDirty) {
            rt.setStatus('记住位置，找出全部 10 对图案');
            statusDirty = false;
          }

          if (shake > 0) shake = Math.max(0, shake - dt * 30);

          var i;
          for (i = 0; i < cards.length; i++) {
            var card = cards[i];
            if (card.flipping) {
              card.flipT += dt / card.flipDur;
              if (card.flipT >= 1) {
                card.flipT = 1;
                card.flip = card.flipTo;
                card.flipping = false;
              } else {
                card.flip = card.flipFrom +
                  (card.flipTo - card.flipFrom) * easeInOutQuad(card.flipT);
              }
            }
            if (card.pop > 0) card.pop = Math.max(0, card.pop - dt);
            if (card.glow > 0) card.glow = Math.max(0, card.glow - dt);
          }

          if (comboT > 0) {
            comboT -= dt;
            if (comboT <= 0) {
              comboT = 0;
              if (combo > 0) {
                combo = 0;
                hudDirty = true;
              }
            }
          }

          if (judgeT > 0) {
            judgeT -= dt;
            if (judgeT <= 0) {
              judgeT = 0;
              judgeCards();
            }
          }
          if (waitT > 0) {
            waitT -= dt;
            if (waitT <= 0) {
              waitT = 0;
              hidePending();
            }
          }

          for (i = rings.length - 1; i >= 0; i--) {
            var rg = rings[i];
            rg.life -= dt;
            rg.r += 230 * dt;
            if (rg.life <= 0) rings.splice(i, 1);
          }
          for (i = particles.length - 1; i >= 0; i--) {
            var pt = particles[i];
            pt.life -= dt;
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            pt.vx *= 0.93;
            pt.vy *= 0.93;
            pt.vy += 90 * dt;
            if (pt.life <= 0) particles.splice(i, 1);
          }
          for (i = popups.length - 1; i >= 0; i--) {
            var pp = popups[i];
            pp.life -= dt;
            pp.y -= 42 * dt;
            if (pp.life <= 0) popups.splice(i, 1);
          }
          for (i = 0; i < ambient.length; i++) {
            var d = ambient[i];
            d.y -= d.sp * dt;
            d.x += Math.sin(rt.time * 0.6 + d.ph) * 6 * dt;
            if (d.y < -6) {
              d.y = 646;
              d.x = rt.rand(0, 640);
            }
          }

          hoverIndex = -1;
          if (!over && !endCalled && !locked) {
            var hi = cardIndexAt(rt.pointer.x, rt.pointer.y);
            if (hi >= 0) {
              var hc = cards[hi];
              if (!hc.matched && !hc.flipping && hc.state === 'back') hoverIndex = hi;
            }
          }

          if (over) {
            overT += dt;
            if (!endCalled && overT >= 1.1) {
              endCalled = true;
              finishGame();
            }
          }
        },

        render: function (c) {
          ctx = c;
          var t = rt.time;
          var sx = shake > 0 ? rt.rand(-shake, shake) : 0;
          var sy = shake > 0 ? rt.rand(-shake, shake) : 0;
          ctx.save();
          ctx.translate(sx, sy);
          drawBackground(t);
          drawHeader(t);
          drawBoardPanel();
          for (var i = 0; i < cards.length; i++) {
            drawCard(cards[i], t, i);
          }
          drawParticles();
          drawPopups();
          drawCelebration();
          ctx.restore();
        },

        onPointerDown: function (x, y) {
          if (over || endCalled) return;
          if (locked || pending.length >= 2) return;
          var idx = cardIndexAt(x, y);
          if (idx < 0) return;
          var card = cards[idx];
          if (card.matched || card.flipping || card.state !== 'back') return;

          card.state = 'up';
          flipCard(card, 1);
          pending.push(card);
          rt.audio.play('flip', 0.6);

          if (pending.length === 2) {
            steps++;
            locked = true;
            judgeT = 0.22;
            hudDirty = true;
          }
        }
      };
    }
  });
})();
