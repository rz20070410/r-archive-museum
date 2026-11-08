/* 游戏：桌球（8 球）—— 霓虹球房 · 拖拽蓄力 · 走位清台 */
(function () {
  'use strict';

  var BALL_R = 10.5;
  var POCKET_R = 21;
  var MOUTH = 16;            /* 袋口在库边上的开口半宽 */
  var STEP = 1 / 240;        /* 物理固定步长 */
  var MAX_SPEED = 1180;
  var FRICTION = 0.78;       /* 指数摩擦系数（每秒） */
  var CUSHION_E = 0.82;
  var BALL_E = 0.96;
  var STOP_SPEED = 7;
  var MAX_PULL = 190;        /* 满力需要的拉杆距离 */

  var BALL_COLOR = {
    1: '#facc15', 2: '#3b82f6', 3: '#ef4444', 4: '#a855f7', 5: '#fb923c',
    6: '#22c55e', 7: '#b91c1c', 8: '#111827',
    9: '#facc15', 10: '#3b82f6', 11: '#ef4444', 12: '#a855f7',
    13: '#fb923c', 14: '#22c55e', 15: '#b91c1c'
  };

  /* 经典三角摆球：1 号顶点、8 号中央、底角一花一实 */
  var RACK = [
    [1],
    [11, 2],
    [3, 8, 12],
    [13, 4, 14, 5],
    [6, 15, 7, 9, 10]
  ];

  function roundRect(c, x, y, w, h, r) {
    var radius = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + radius, y);
    c.lineTo(x + w - radius, y);
    c.quadraticCurveTo(x + w, y, x + w, y + radius);
    c.lineTo(x + w, y + h - radius);
    c.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    c.lineTo(x + radius, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - radius);
    c.lineTo(x, y + radius);
    c.quadraticCurveTo(x, y, x + radius, y);
    c.closePath();
  }

  Arcade.register({
    id: 'pool',
    title: '桌球',
    subtitle: '瞄准、走位、一杆清台',
    description: '单人 8 球挑战：拖拽蓄力、走位清台。白球落袋罚杆，8 号球必须最后打进，连击越多分数越高。',
    icon: '🎱',
    accent: '#34d399',
    accent2: '#0ea5e9',
    tags: ['休闲', '挑战'],
    difficulty: '中等',
    width: 800,
    height: 540,
    order: 55,
    tips: '先清彩球再收 8 号；白球贴库时轻推更稳，连击比蛮力更值钱。',
    controls: [
      { keys: '鼠标 / 触摸拖拽', action: '瞄准蓄力，松手击球' },
      { keys: '← →', action: '微调角度' },
      { keys: '↑ ↓ / 空格', action: '调整力度 / 蓄力' },
      { keys: 'Enter', action: '以当前力度击球' }
    ],

    create: function (rt) {
      var W = rt.width;
      var H = rt.height;

      /* ---------- 台面布局（全部基于 rt.width / rt.height） ---------- */
      var RAIL = Math.round(W * 0.045);                 /* 36 */
      var LF = Math.round(W * 0.0875);                  /* 70 */
      var SURF_W = W - LF * 2;                          /* 660 */
      var SURF_H = Math.round(SURF_W / 2);              /* 330 */
      var TOP = Math.round((H - (SURF_H + RAIL * 2)) / 2) + RAIL;
      var BF = TOP + SURF_H;
      var RF = LF + SURF_W;
      var midX = (LF + RF) / 2;
      var midY = (TOP + BF) / 2;
      var CAB_X = LF - RAIL;
      var CAB_Y = TOP - RAIL;
      var CAB_W = SURF_W + RAIL * 2;
      var CAB_H = SURF_H + RAIL * 2;

      var cueHome = { x: LF + SURF_W * 0.25, y: midY };
      var rackX = LF + SURF_W * 0.705;
      var rackY = midY;
      var rackStep = BALL_R * 2 + 0.7;
      var rackDX = rackStep * 0.866;

      var pockets = [
        { x: LF, y: TOP, corner: true },
        { x: RF, y: TOP, corner: true },
        { x: LF, y: BF, corner: true },
        { x: RF, y: BF, corner: true },
        { x: midX, y: TOP, corner: false },
        { x: midX, y: BF, corner: false }
      ];

      /* ---------- 状态（全部在 create 闭包内） ---------- */
      var balls = [];
      var phase = 'aim';            /* aim | shoot | over */
      var aimAngle = 0;
      var power = 0;
      var strokes = 0;
      var pottedCount = 0;
      var combo = 0;
      var maxCombo = 0;
      var totalPoints = 0;
      var comboBonus = 0;
      var elapsed = 0;

      var shotPots = [];
      var cuePotted = false;

      var dragging = false;
      var dragMoved = false;
      var dragStartX = 0;
      var dragStartY = 0;
      var spaceWasDown = false;

      var physAcc = 0;
      var shake = 0;
      var flash = 0;
      var particles = [];
      var popups = [];

      var overTimer = 0;
      var overResult = null;
      var ended = false;
      var won = false;

      var lastLiveScore = -1;
      var railSfx = 0;
      var ballSfx = 0;
      var potFlash = 0;

      /* ---------- 工具 ---------- */
      function pointsFor(n) {
        if (n === 8) return 300;
        return n <= 7 ? 100 : 150;
      }

      function remainingBalls() {
        var count = 0;
        for (var i = 1; i < balls.length; i++) {
          if (balls[i].live) count++;
        }
        return count;
      }

      function formatTime(t) {
        var m = Math.floor(t / 60);
        var s = Math.floor(t % 60);
        return m + "'" + (s < 10 ? '0' : '') + s;
      }

      function syncHud() {
        rt.setHud({ 剩余: remainingBalls(), 杆数: strokes, 连击: combo });
      }

      function computeScore(winFlag) {
        var s = totalPoints + comboBonus + (winFlag ? 800 : 0) - strokes * 12 - Math.floor(elapsed) * 2;
        return Math.max(0, Math.round(s));
      }

      function updateLiveScore() {
        var s = Math.max(0, Math.round(totalPoints + comboBonus - strokes * 12 - Math.floor(elapsed) * 2));
        if (s !== lastLiveScore) {
          lastLiveScore = s;
          rt.setScore(s);
        }
      }

      function addPopup(x, y, text, color, size) {
        if (popups.length >= 10) popups.shift();
        popups.push({ x: x, y: y, text: text, color: color, size: size || 15, life: 0.95, max: 0.95 });
      }

      function burst(x, y, color, count, speed) {
        for (var i = 0; i < count; i++) {
          var a = rt.rand(0, Math.PI * 2);
          var sp = rt.rand(speed * 0.3, speed);
          particles.push({
            x: x, y: y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            life: rt.rand(0.3, 0.8),
            max: 0.8,
            r: rt.rand(1.4, 3.4),
            color: color
          });
        }
        if (particles.length > 260) particles.splice(0, particles.length - 260);
      }

      function addConfetti() {
        for (var i = 0; i < 60; i++) {
          particles.push({
            x: midX + rt.rand(-240, 240),
            y: midY + rt.rand(-120, 120),
            vx: rt.rand(-120, 120),
            vy: rt.rand(-180, -40),
            life: rt.rand(0.5, 1.2),
            max: 1.2,
            r: rt.rand(1.6, 4),
            color: i % 3 === 0 ? '#facc15' : (i % 3 === 1 ? '#34d399' : '#38bdf8')
          });
        }
        if (particles.length > 260) particles.splice(0, particles.length - 260);
      }

      function updateParticles(dt) {
        for (var i = particles.length - 1; i >= 0; i--) {
          var p = particles[i];
          p.life -= dt;
          if (p.life <= 0) { particles.splice(i, 1); continue; }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 0.965;
          p.vy *= 0.965;
        }
      }

      function updatePopups(dt) {
        for (var i = popups.length - 1; i >= 0; i--) {
          var q = popups[i];
          q.life -= dt;
          q.y -= 26 * dt;
          if (q.life <= 0) popups.splice(i, 1);
        }
      }

      function updatePotAnims(dt) {
        for (var i = 0; i < balls.length; i++) {
          var b = balls[i];
          if (!b.live && b.potT >= 0 && b.potT < 0.5) b.potT += dt;
        }
      }

      /* ---------- 球桌 ---------- */
      function resetBalls() {
        balls = [];
        balls.push({
          n: 0, x: cueHome.x, y: cueHome.y, vx: 0, vy: 0,
          live: true, potT: -1, potX: 0, potY: 0, color: '#f8fafc', striped: false
        });
        for (var r = 0; r < RACK.length; r++) {
          var row = RACK[r];
          for (var j = 0; j < row.length; j++) {
            var n = row[j];
            balls.push({
              n: n,
              x: rackX + r * rackDX,
              y: rackY + (j - r / 2) * rackStep,
              vx: 0, vy: 0,
              live: true, potT: -1, potX: 0, potY: 0,
              color: BALL_COLOR[n],
              striped: n > 8
            });
          }
        }
      }

      function isSpotFree(x, y) {
        if (x < LF + BALL_R + 2 || x > RF - BALL_R - 2) return false;
        if (y < TOP + BALL_R + 2 || y > BF - BALL_R - 2) return false;
        for (var i = 0; i < pockets.length; i++) {
          var p = pockets[i];
          var pdx = x - p.x;
          var pdy = y - p.y;
          if (pdx * pdx + pdy * pdy < (POCKET_R + BALL_R) * (POCKET_R + BALL_R)) return false;
        }
        for (var j = 1; j < balls.length; j++) {
          var b = balls[j];
          if (!b.live) continue;
          var dx = b.x - x;
          var dy = b.y - y;
          var min = BALL_R * 2 + 2;
          if (dx * dx + dy * dy < min * min) return false;
        }
        return true;
      }

      function resetCueBall() {
        var cue = balls[0];
        cue.live = true;
        cue.potT = -1;
        cue.vx = 0;
        cue.vy = 0;
        if (isSpotFree(cueHome.x, cueHome.y)) {
          cue.x = cueHome.x;
          cue.y = cueHome.y;
          return;
        }
        var step = BALL_R * 2 + 8;
        for (var ring = 1; ring <= 14; ring++) {
          for (var k = 0; k < 16; k++) {
            var ang = (k / 16) * Math.PI * 2;
            var x = cueHome.x + Math.cos(ang) * step * ring;
            var y = cueHome.y + Math.sin(ang) * step * ring;
            if (isSpotFree(x, y)) {
              cue.x = x;
              cue.y = y;
              return;
            }
          }
        }
        cue.x = cueHome.x;
        cue.y = cueHome.y;
      }

      function pocketAt(x, y) {
        for (var i = 0; i < pockets.length; i++) {
          var p = pockets[i];
          var dx = x - p.x;
          var dy = y - p.y;
          var rr = p.corner ? POCKET_R + 2.5 : POCKET_R + 0.5;
          if (dx * dx + dy * dy < rr * rr) return p;
        }
        return null;
      }

      function inMouthX(x) {
        return Math.abs(x - LF) < MOUTH || Math.abs(x - RF) < MOUTH || Math.abs(x - midX) < MOUTH;
      }

      function inMouthY(y) {
        return Math.abs(y - TOP) < MOUTH || Math.abs(y - BF) < MOUTH;
      }

      function potBall(b, p) {
        b.live = false;
        b.vx = 0;
        b.vy = 0;
        b.potT = 0;
        b.potX = p.x;
        b.potY = p.y;
        if (b.n === 0) {
          cuePotted = true;
        } else {
          shotPots.push(b);
        }
        var col = b.n === 0 ? '#f8fafc' : b.color;
        burst(p.x, p.y, col, b.n === 0 ? 18 : 14, 190);
        burst(p.x, p.y, b.n === 0 ? rt.colors.danger : '#a7f3d0', 8, 120);
        if (b.n === 0) {
          addPopup(p.x, p.y - 16, '白球落袋', rt.colors.danger, 14);
          rt.audio.play('error', 0.75);
          shake = Math.max(shake, 10);
          flash = Math.max(flash, 0.4);
        } else if (b.n === 8) {
          addPopup(p.x, p.y - 16, '8 号球', rt.colors.warn, 18);
          rt.audio.play('power', 0.7);
          shake = Math.max(shake, 6);
        } else {
          addPopup(p.x, p.y - 16, '+' + pointsFor(b.n), rt.colors.warn, 15);
          rt.audio.play('eat', 0.55);
          shake = Math.max(shake, 3);
          potFlash = Math.max(potFlash, 0.35);
        }
        syncHud();
      }

      /* ---------- 物理 ---------- */
      function physicsStep(dt) {
        var i, b;
        for (i = 0; i < balls.length; i++) {
          b = balls[i];
          if (!b.live) continue;

          b.x += b.vx * dt;
          b.y += b.vy * dt;

          var decay = Math.exp(-FRICTION * dt);
          b.vx *= decay;
          b.vy *= decay;
          if (b.vx * b.vx + b.vy * b.vy < STOP_SPEED * STOP_SPEED) {
            b.vx = 0;
            b.vy = 0;
          }

          var pk = pocketAt(b.x, b.y);
          if (pk) { potBall(b, pk); continue; }

          /* 库边反弹（袋口留口） */
          var hit = 0;
          var sp;
          if (b.x - BALL_R < LF && !inMouthY(b.y)) {
            sp = Math.abs(b.vx);
            b.x = LF + BALL_R;
            b.vx = sp * CUSHION_E;
            b.vy *= 0.985;
            hit = sp;
          } else if (b.x + BALL_R > RF && !inMouthY(b.y)) {
            sp = Math.abs(b.vx);
            b.x = RF - BALL_R;
            b.vx = -sp * CUSHION_E;
            b.vy *= 0.985;
            hit = sp;
          }
          if (b.y - BALL_R < TOP && !inMouthX(b.x)) {
            sp = Math.abs(b.vy);
            b.y = TOP + BALL_R;
            b.vy = sp * CUSHION_E;
            b.vx *= 0.985;
            hit = Math.max(hit, sp);
          } else if (b.y + BALL_R > BF && !inMouthX(b.x)) {
            sp = Math.abs(b.vy);
            b.y = BF - BALL_R;
            b.vy = -sp * CUSHION_E;
            b.vx *= 0.985;
            hit = Math.max(hit, sp);
          }
          if (hit > 90) {
            if (railSfx <= 0) {
              rt.audio.play('step', 0.35);
              railSfx = 0.07;
            }
            burst(b.x, b.y, 'rgba(52, 211, 153, 0.55)', 2, 90);
          }

          /* 兜底：万一从袋口缝隙溜出桌面，直接算落袋 */
          if (b.x < LF - 12 || b.x > RF + 12 || b.y < TOP - 12 || b.y > BF + 12) {
            var near = pockets[0];
            var best = Infinity;
            for (var q = 0; q < pockets.length; q++) {
              var ddx = b.x - pockets[q].x;
              var ddy = b.y - pockets[q].y;
              var dd = ddx * ddx + ddy * ddy;
              if (dd < best) { best = dd; near = pockets[q]; }
            }
            potBall(b, near);
          }
        }

        /* 球球碰撞 */
        var n = balls.length;
        for (i = 0; i < n; i++) {
          var a = balls[i];
          if (!a.live) continue;
          for (var j = i + 1; j < n; j++) {
            b = balls[j];
            if (!b.live) continue;
            var dx = b.x - a.x;
            var dy = b.y - a.y;
            var minD = BALL_R * 2;
            var d2 = dx * dx + dy * dy;
            if (d2 >= minD * minD) continue;
            var d = Math.sqrt(d2);
            if (d < 0.0001) {
              dx = 0.01;
              dy = 0;
              d = 0.01;
            }
            var nx = dx / d;
            var ny = dy / d;
            var overlap = minD - d;
            a.x -= nx * overlap * 0.5;
            a.y -= ny * overlap * 0.5;
            b.x += nx * overlap * 0.5;
            b.y += ny * overlap * 0.5;

            var rvx = b.vx - a.vx;
            var rvy = b.vy - a.vy;
            var vn = rvx * nx + rvy * ny;
            if (vn > 0) continue;
            var imp = -(1 + BALL_E) * vn * 0.5;
            a.vx -= imp * nx;
            a.vy -= imp * ny;
            b.vx += imp * nx;
            b.vy += imp * ny;

            var rel = Math.abs(vn);
            if (rel > 45) {
              if (ballSfx <= 0) {
                rt.audio.play('blip', 0.28);
                ballSfx = 0.05;
              }
              if (rel > 170) burst(a.x + nx * BALL_R, a.y + ny * BALL_R, '#e2e8f0', 3, 110);
            }
          }
        }
      }

      function allStopped() {
        for (var i = 0; i < balls.length; i++) {
          var b = balls[i];
          if (b.live && (b.vx * b.vx + b.vy * b.vy) > 9) return false;
        }
        return true;
      }

      /* ---------- 击球 / 回合 ---------- */
      function shoot(pwr) {
        if (phase !== 'aim') return;
        var cue = balls[0];
        if (!cue || !cue.live) return;
        if (pwr <= 0.04) return;

        strokes++;
        phase = 'shoot';
        physAcc = 0;
        shotPots = [];
        cuePotted = false;
        power = 0;
        dragging = false;
        dragMoved = false;
        cue.vx = Math.cos(aimAngle) * MAX_SPEED * pwr;
        cue.vy = Math.sin(aimAngle) * MAX_SPEED * pwr;
        shake = Math.max(shake, 1.5 + pwr * 5);
        rt.audio.play('shoot', 0.55);
        burst(cue.x - Math.cos(aimAngle) * BALL_R * 1.2, cue.y - Math.sin(aimAngle) * BALL_R * 1.2,
          '#a7f3d0', 8, 120);
        syncHud();
        rt.setStatus('球在滚动…');
      }

      function finish(winFlag, msg) {
        won = winFlag;
        phase = 'over';
        overTimer = 0;
        var finalScore = computeScore(winFlag);
        rt.setScore(finalScore);
        overResult = {
          score: finalScore,
          won: winFlag,
          message: msg,
          stats: [
            { label: '杆数', value: strokes },
            { label: '用时', value: formatTime(elapsed) },
            { label: '进球数', value: pottedCount },
            { label: '最高连击', value: maxCombo }
          ]
        };
        if (winFlag) {
          rt.audio.play('power', 0.85);
          shake = 12;
          flash = 0.5;
          addConfetti();
        } else {
          rt.audio.play('explode', 0.75);
          shake = 14;
          flash = 0.6;
          burst(midX, midY, '#f43f5e', 40, 260);
        }
        rt.setStatus('');
      }

      function settleShot() {
        var pots = shotPots.length;
        if (pots > 0) {
          combo++;
          if (combo > maxCombo) maxCombo = combo;
          for (var i = 0; i < shotPots.length; i++) {
            totalPoints += pointsFor(shotPots[i].n);
            pottedCount++;
          }
          if (combo > 1) {
            comboBonus += 50 * (combo - 1);
            addPopup(midX, TOP + 54, '连击 ×' + combo + '  +' + (50 * (combo - 1)), rt.colors.warn, 18);
          }
          rt.audio.play('pop', 0.5);
          shake = Math.max(shake, 2 + combo);
        } else {
          combo = 0;
        }

        var foul = false;
        if (cuePotted) {
          foul = true;
          strokes += 2;
          resetCueBall();
          shake = Math.max(shake, 9);
          flash = Math.max(flash, 0.4);
          rt.audio.play('error', 0.7);
          addPopup(midX, TOP + 76, '白球落袋 · 罚 2 杆', rt.colors.danger, 16);
        }

        var eightPotted = false;
        for (var k = 0; k < shotPots.length; k++) {
          if (shotPots[k].n === 8) eightPotted = true;
        }
        var others = 0;
        for (var m = 1; m < balls.length; m++) {
          if (balls[m].n !== 8 && balls[m].live) others++;
        }

        shotPots = [];
        cuePotted = false;
        syncHud();
        updateLiveScore();

        if (eightPotted) {
          if (others > 0) {
            finish(false, '8 号球提前落袋，本局判负');
          } else {
            finish(true, '清台成功！8 号球最后落袋');
          }
          return;
        }

        phase = 'aim';
        power = 0;
        physAcc = 0;
        var left = remainingBalls();
        if (left === 1) {
          rt.setStatus('最后目标：8 号球 · 稳稳推进');
        } else if (foul) {
          rt.setStatus('犯规罚 2 杆 · 剩余 ' + left + ' 球');
        } else {
          rt.setStatus('剩余 ' + left + ' 球 · 拖拽蓄力，松手击球');
        }
      }

      /* ---------- 瞄准输入 ---------- */
      function updateDrag(x, y) {
        var cue = balls[0];
        if (!cue || !cue.live) return;
        var dx = cue.x - x;
        var dy = cue.y - y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d > 12) aimAngle = Math.atan2(dy, dx);
        var adx = Math.cos(aimAngle);
        var ady = Math.sin(aimAngle);
        var pull = (dragStartX - x) * adx + (dragStartY - y) * ady;
        power = rt.clamp(pull / MAX_PULL, 0, 1);
        if (Math.abs(x - dragStartX) + Math.abs(y - dragStartY) > 8) dragMoved = true;
      }

      function handleAim(dt) {
        var keys = rt.keys;
        if (!dragging) {
          var angleRate = 1.15;
          if (keys.has('ArrowLeft') || keys.has('KeyA')) aimAngle -= angleRate * dt;
          if (keys.has('ArrowRight') || keys.has('KeyD')) aimAngle += angleRate * dt;
          if (keys.has('ArrowUp') || keys.has('KeyW')) power = rt.clamp(power + 0.85 * dt, 0, 1);
          if (keys.has('ArrowDown') || keys.has('KeyS')) power = rt.clamp(power - 0.85 * dt, 0, 1);

          var spaceDown = keys.has('Space');
          if (spaceDown) {
            if (!spaceWasDown) rt.audio.play('blip', 0.2);
            power = rt.clamp(power + 1.05 * dt, 0, 1);
          } else if (spaceWasDown) {
            if (power > 0.05) {
              shoot(power);
            } else {
              power = 0;
            }
          }
          spaceWasDown = spaceDown;

          if (rt.wasPressed('Enter') || rt.wasPressed('NumpadEnter')) {
            if (power > 0.05) shoot(power);
            else rt.audio.play('error', 0.25);
          }
        } else {
          spaceWasDown = keys.has('Space');
        }
      }

      /* ---------- 落点预测 ---------- */
      function predict(angle) {
        var cue = balls[0];
        var dx = Math.cos(angle);
        var dy = Math.sin(angle);
        var sx = cue.x;
        var sy = cue.y;

        var tX = Infinity;
        var tY = Infinity;
        if (dx > 0.00001) tX = (RF - BALL_R - sx) / dx;
        else if (dx < -0.00001) tX = (LF + BALL_R - sx) / dx;
        if (dy > 0.00001) tY = (BF - BALL_R - sy) / dy;
        else if (dy < -0.00001) tY = (TOP + BALL_R - sy) / dy;
        var tWall = Math.min(tX, tY);
        if (tWall < 0) tWall = 0;

        var bestT = Infinity;
        var hitBall = null;
        var rr = BALL_R * 2;
        for (var i = 1; i < balls.length; i++) {
          var b = balls[i];
          if (!b.live) continue;
          var ox = b.x - sx;
          var oy = b.y - sy;
          var proj = ox * dx + oy * dy;
          if (proj <= 0) continue;
          var perp2 = ox * ox + oy * oy - proj * proj;
          if (perp2 >= rr * rr) continue;
          var t = proj - Math.sqrt(rr * rr - perp2);
          if (t < 0) t = 0;
          if (t < bestT) {
            bestT = t;
            hitBall = b;
          }
        }

        var tPocket = Infinity;
        var hitPocket = null;
        for (var p = 0; p < pockets.length; p++) {
          var pk = pockets[p];
          var px = pk.x - sx;
          var py = pk.y - sy;
          var pr = POCKET_R * 0.8;
          var pp = px * dx + py * dy;
          if (pp <= 0) continue;
          var perp2p = px * px + py * py - pp * pp;
          if (perp2p >= pr * pr) continue;
          var tp = pp - Math.sqrt(pr * pr - perp2p);
          if (tp < 0) tp = 0;
          if (tp < tPocket) {
            tPocket = tp;
            hitPocket = pk;
          }
        }

        if (hitBall && bestT <= tPocket && bestT <= tWall) {
          var cx = sx + dx * bestT;
          var cy = sy + dy * bestT;
          var nx = (hitBall.x - cx) / rr;
          var ny = (hitBall.y - cy) / rr;
          return { type: 'ball', x: cx, y: cy, ball: hitBall, nx: nx, ny: ny, t: bestT, dx: dx, dy: dy };
        }
        if (hitPocket && tPocket <= tWall) {
          return { type: 'pocket', x: hitPocket.x, y: hitPocket.y, pocket: hitPocket, t: tPocket, dx: dx, dy: dy };
        }
        return { type: 'wall', x: sx + dx * tWall, y: sy + dy * tWall, t: tWall, dx: dx, dy: dy };
      }

      /* ================= 渲染 ================= */
      function drawBackground(c) {
        var bg = c.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#04090c');
        bg.addColorStop(0.5, '#07130f');
        bg.addColorStop(1, '#03070a');
        c.fillStyle = bg;
        c.fillRect(0, 0, W, H);

        var gl = c.createRadialGradient(midX, midY, 40, midX, midY, 460);
        gl.addColorStop(0, 'rgba(52, 211, 153, 0.10)');
        gl.addColorStop(0.6, 'rgba(14, 165, 233, 0.04)');
        gl.addColorStop(1, 'rgba(0, 0, 0, 0)');
        c.fillStyle = gl;
        c.fillRect(0, 0, W, H);

        c.strokeStyle = 'rgba(52, 211, 153, 0.035)';
        c.lineWidth = 1;
        c.beginPath();
        for (var x = 0; x <= W; x += 40) {
          c.moveTo(x + 0.5, 0);
          c.lineTo(x + 0.5, H);
        }
        for (var y = 0; y <= H; y += 40) {
          c.moveTo(0, y + 0.5);
          c.lineTo(W, y + 0.5);
        }
        c.stroke();
      }

      function diamond(c, x, y) {
        c.beginPath();
        c.moveTo(x, y - 3.6);
        c.lineTo(x + 3.6, y);
        c.lineTo(x, y + 3.6);
        c.lineTo(x - 3.6, y);
        c.closePath();
        c.fill();
      }

      function drawTable(c) {
        /* 外框 */
        var wood = c.createLinearGradient(0, CAB_Y, 0, CAB_Y + CAB_H);
        wood.addColorStop(0, '#172a23');
        wood.addColorStop(0.45, '#0b1a15');
        wood.addColorStop(1, '#060f0c');
        c.fillStyle = wood;
        roundRect(c, CAB_X, CAB_Y, CAB_W, CAB_H, 22);
        c.fill();

        c.save();
        c.shadowColor = '#34d399';
        c.shadowBlur = 22;
        c.strokeStyle = 'rgba(52, 211, 153, 0.34)';
        c.lineWidth = 2;
        roundRect(c, CAB_X, CAB_Y, CAB_W, CAB_H, 22);
        c.stroke();
        c.restore();

        /* 内层高光 */
        c.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        c.lineWidth = 1;
        roundRect(c, CAB_X + 5, CAB_Y + 5, CAB_W - 10, CAB_H - 10, 18);
        c.stroke();

        /* 库边 */
        var cush = c.createLinearGradient(0, TOP - 14, 0, BF + 14);
        cush.addColorStop(0, '#13402f');
        cush.addColorStop(0.5, '#0b2a20');
        cush.addColorStop(1, '#123a2c');
        c.fillStyle = cush;
        roundRect(c, LF - 14, TOP - 14, SURF_W + 28, SURF_H + 28, 12);
        c.fill();
        c.strokeStyle = 'rgba(52, 211, 153, 0.22)';
        c.lineWidth = 1.5;
        c.stroke();

        /* 台呢 */
        var felt = c.createRadialGradient(midX, midY, 40, midX, midY, 420);
        felt.addColorStop(0, '#11553d');
        felt.addColorStop(0.55, '#0b3a2a');
        felt.addColorStop(1, '#06231a');
        c.fillStyle = felt;
        c.fillRect(LF, TOP, SURF_W, SURF_H);

        c.strokeStyle = 'rgba(255, 255, 255, 0.028)';
        c.lineWidth = 1;
        c.beginPath();
        for (var x = LF + 18; x < RF; x += 24) {
          c.moveTo(x + 0.5, TOP);
          c.lineTo(x + 0.5, BF);
        }
        c.stroke();

        /* 中央暗纹 logo */
        c.save();
        c.globalAlpha = 0.055;
        c.fillStyle = '#d1fae5';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = '900 44px "Consolas", monospace';
        c.fillText('NEONPOOL', midX, midY + 2);
        c.restore();

        /* 袋口 */
        for (var i = 0; i < pockets.length; i++) {
          var p = pockets[i];
          var pg = c.createRadialGradient(p.x, p.y, 2, p.x, p.y, POCKET_R);
          pg.addColorStop(0, '#000000');
          pg.addColorStop(0.62, '#020a08');
          pg.addColorStop(1, '#0a231b');
          c.fillStyle = pg;
          c.beginPath();
          c.arc(p.x, p.y, POCKET_R, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = 'rgba(52, 211, 153, 0.30)';
          c.lineWidth = 1.5;
          c.beginPath();
          c.arc(p.x, p.y, POCKET_R - 0.8, 0, Math.PI * 2);
          c.stroke();
          c.strokeStyle = 'rgba(255, 255, 255, 0.10)';
          c.lineWidth = 1;
          c.beginPath();
          c.arc(p.x, p.y, POCKET_R - 3.5, 0, Math.PI * 2);
          c.stroke();
        }

        /* 库钉 */
        c.fillStyle = 'rgba(52, 211, 153, 0.42)';
        for (var d = 1; d <= 7; d++) {
          if (d === 4) continue;
          var dx = LF + (SURF_W / 8) * d;
          diamond(c, dx, TOP - 20);
          diamond(c, dx, BF + 20);
        }
        for (var e = 1; e <= 3; e++) {
          var dy = TOP + (SURF_H / 4) * e;
          diamond(c, LF - 20, dy);
          diamond(c, RF + 20, dy);
        }

        /* 台边霓虹细线 */
        c.save();
        c.shadowColor = '#34d399';
        c.shadowBlur = 10;
        c.strokeStyle = 'rgba(52, 211, 153, 0.28)';
        c.lineWidth = 1;
        c.strokeRect(LF + 0.5, TOP + 0.5, SURF_W - 1, SURF_H - 1);
        c.restore();
      }

      function drawBall(c, x, y, radius, alpha, b) {
        var r = radius;
        var col = b.n === 0 ? '#f8fafc' : b.color;

        c.save();
        c.globalAlpha = alpha;

        /* 投影 */
        c.fillStyle = 'rgba(0, 0, 0, 0.32)';
        c.beginPath();
        c.ellipse(x + 2.4, y + 3.2, r * 0.96, r * 0.88, 0, 0, Math.PI * 2);
        c.fill();

        /* 球体底色 */
        if (b.striped) {
          c.fillStyle = '#f4f7fb';
          c.beginPath();
          c.arc(x, y, r, 0, Math.PI * 2);
          c.fill();
          c.save();
          c.beginPath();
          c.arc(x, y, r, 0, Math.PI * 2);
          c.clip();
          c.fillStyle = col;
          c.fillRect(x - r, y - r * 0.52, r * 2, r * 1.04);
          c.restore();
        } else {
          c.fillStyle = col;
          c.beginPath();
          c.arc(x, y, r, 0, Math.PI * 2);
          c.fill();
        }

        /* 体积渐变 */
        var g = c.createRadialGradient(x - r * 0.36, y - r * 0.4, r * 0.08, x, y, r * 1.06);
        g.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
        g.addColorStop(0.4, 'rgba(255, 255, 255, 0.02)');
        g.addColorStop(0.8, 'rgba(0, 0, 0, 0.18)');
        g.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();

        /* 高光 */
        c.fillStyle = 'rgba(255, 255, 255, 0.75)';
        c.beginPath();
        c.ellipse(x - r * 0.33, y - r * 0.42, r * 0.24, r * 0.15, -0.6, 0, Math.PI * 2);
        c.fill();

        /* 号码 */
        if (b.n > 0) {
          c.fillStyle = '#f8fafc';
          c.beginPath();
          c.arc(x, y, r * 0.5, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = '#0f172a';
          c.font = '700 ' + Math.round(r * 0.72) + 'px "Consolas", monospace';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(String(b.n), x, y + 0.5);
        }

        c.restore();
      }

      function drawBalls(c) {
        var i;
        for (i = 0; i < balls.length; i++) {
          var b = balls[i];
          if (b.live) {
            drawBall(c, b.x, b.y, BALL_R, 1, b);
          } else if (b.potT >= 0 && b.potT < 0.5) {
            var k = Math.min(1, b.potT / 0.4);
            drawBall(c, b.potX, b.potY, BALL_R * (1 - k * 0.85), 1 - k * 0.9, b);
          }
        }

        /* 白球瞄准环 */
        var cue = balls[0];
        if (cue && cue.live && phase === 'aim') {
          var pulse = 0.35 + 0.22 * Math.sin(rt.time * 5);
          c.strokeStyle = 'rgba(52, 211, 153, ' + pulse.toFixed(3) + ')';
          c.lineWidth = 2;
          c.beginPath();
          c.arc(cue.x, cue.y, BALL_R + 5, 0, Math.PI * 2);
          c.stroke();
        }

        /* 只剩 8 号时给一个脉冲环 */
        if (remainingBalls() === 1) {
          for (var j = 1; j < balls.length; j++) {
            if (balls[j].live && balls[j].n === 8) {
              var pl = 0.4 + 0.3 * Math.sin(rt.time * 4);
              c.strokeStyle = 'rgba(251, 191, 36, ' + pl.toFixed(3) + ')';
              c.lineWidth = 2;
              c.beginPath();
              c.arc(balls[j].x, balls[j].y, BALL_R + 7, 0, Math.PI * 2);
              c.stroke();
            }
          }
        }
      }

      function drawArrow(c, x1, y1, x2, y2, color, width) {
        c.strokeStyle = color;
        c.lineWidth = width;
        c.beginPath();
        c.moveTo(x1, y1);
        c.lineTo(x2, y2);
        c.stroke();
        var ang = Math.atan2(y2 - y1, x2 - x1);
        var size = 6;
        c.fillStyle = color;
        c.beginPath();
        c.moveTo(x2, y2);
        c.lineTo(x2 - Math.cos(ang - 0.42) * size, y2 - Math.sin(ang - 0.42) * size);
        c.lineTo(x2 - Math.cos(ang + 0.42) * size, y2 - Math.sin(ang + 0.42) * size);
        c.closePath();
        c.fill();
      }

      function drawAim(c) {
        var cue = balls[0];
        if (!cue || !cue.live) return;

        var dx = Math.cos(aimAngle);
        var dy = Math.sin(aimAngle);
        var pred = predict(aimAngle);
        var pulse = 0.55 + 0.25 * Math.sin(rt.time * 5);

        /* 瞄准虚线 */
        c.save();
        c.setLineDash([8, 8]);
        c.lineDashOffset = -rt.time * 28;
        c.strokeStyle = pred.type === 'pocket'
          ? 'rgba(251, 191, 36, 0.9)'
          : 'rgba(52, 211, 153, ' + pulse.toFixed(2) + ')';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(cue.x + dx * (BALL_R + 2), cue.y + dy * (BALL_R + 2));
        c.lineTo(pred.x, pred.y);
        c.stroke();
        c.setLineDash([]);
        c.restore();

        if (pred.type === 'ball') {
          /* 幽灵白球 */
          c.save();
          c.setLineDash([4, 4]);
          c.strokeStyle = 'rgba(226, 232, 240, 0.55)';
          c.lineWidth = 1.5;
          c.beginPath();
          c.arc(pred.x, pred.y, BALL_R, 0, Math.PI * 2);
          c.stroke();
          c.restore();
          /* 目标球去向 */
          var tx = pred.ball.x;
          var ty = pred.ball.y;
          drawArrow(c, tx + pred.nx * BALL_R, ty + pred.ny * BALL_R,
            tx + pred.nx * (BALL_R + 46), ty + pred.ny * (BALL_R + 46),
            'rgba(251, 191, 36, 0.8)', 2);
          /* 白球分离方向 */
          var tanx = -pred.ny;
          var tany = pred.nx;
          if (tanx * dx + tany * dy < 0) { tanx = -tanx; tany = -tany; }
          c.save();
          c.setLineDash([5, 5]);
          c.strokeStyle = 'rgba(148, 163, 184, 0.6)';
          c.lineWidth = 1.5;
          c.beginPath();
          c.moveTo(pred.x + tanx * BALL_R, pred.y + tany * BALL_R);
          c.lineTo(pred.x + tanx * (BALL_R + 40), pred.y + tany * (BALL_R + 40));
          c.stroke();
          c.restore();
        } else if (pred.type === 'pocket') {
          c.save();
          c.strokeStyle = 'rgba(251, 191, 36, ' + (0.5 + 0.3 * Math.sin(rt.time * 6)).toFixed(3) + ')';
          c.lineWidth = 2;
          c.beginPath();
          c.arc(pred.pocket.x, pred.pocket.y, POCKET_R + 4, 0, Math.PI * 2);
          c.stroke();
          c.restore();
        } else {
          /* 库边反射 */
          var rdx = dx;
          var rdy = dy;
          if (Math.abs(pred.y - (TOP + BALL_R)) < 2 || Math.abs(pred.y - (BF - BALL_R)) < 2) rdy = -rdy;
          else rdx = -rdx;
          c.save();
          c.setLineDash([5, 5]);
          c.strokeStyle = 'rgba(148, 163, 184, 0.55)';
          c.lineWidth = 1.5;
          c.beginPath();
          c.moveTo(pred.x, pred.y);
          c.lineTo(pred.x + rdx * 44, pred.y + rdy * 44);
          c.stroke();
          c.restore();
        }

        /* 球杆 */
        var pull = 24 + power * 46;
        var tipX = cue.x - dx * pull;
        var tipY = cue.y - dy * pull;
        var buttX = cue.x - dx * (pull + 150);
        var buttY = cue.y - dy * (pull + 150);
        c.save();
        c.lineCap = 'round';
        c.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        c.lineWidth = 8;
        c.beginPath();
        c.moveTo(tipX + 2, tipY + 3);
        c.lineTo(buttX + 2, buttY + 3);
        c.stroke();
        var stick = c.createLinearGradient(tipX, tipY, buttX, buttY);
        stick.addColorStop(0, '#f5e7c1');
        stick.addColorStop(0.18, '#d9b27a');
        stick.addColorStop(0.7, '#8a5a33');
        stick.addColorStop(1, '#4a2e1a');
        c.strokeStyle = stick;
        c.lineWidth = 6;
        c.beginPath();
        c.moveTo(tipX, tipY);
        c.lineTo(buttX, buttY);
        c.stroke();
        c.fillStyle = '#22d3ee';
        c.beginPath();
        c.arc(tipX, tipY, 2.6, 0, Math.PI * 2);
        c.fill();
        c.restore();

        /* 拉杆方向提示 */
        if (dragging && rt.pointer.down) {
          c.save();
          c.setLineDash([4, 6]);
          c.strokeStyle = 'rgba(148, 163, 184, 0.35)';
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(rt.pointer.x, rt.pointer.y);
          c.lineTo(cue.x, cue.y);
          c.stroke();
          c.restore();
        }
      }

      function drawParticles(c) {
        for (var i = 0; i < particles.length; i++) {
          var p = particles[i];
          c.globalAlpha = Math.max(0, p.life / p.max);
          c.fillStyle = p.color;
          c.beginPath();
          c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          c.fill();
        }
        c.globalAlpha = 1;
      }

      function drawPopups(c) {
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        for (var i = 0; i < popups.length; i++) {
          var q = popups[i];
          c.globalAlpha = Math.max(0, q.life / q.max);
          c.font = '900 ' + q.size + 'px "Consolas", "PingFang SC", monospace';
          c.fillStyle = q.color;
          c.fillText(q.text, q.x, q.y);
        }
        c.globalAlpha = 1;
      }

      function drawHud(c) {
        /* 顶部标题 */
        c.textAlign = 'left';
        c.textBaseline = 'alphabetic';
        c.font = '900 20px "Consolas", monospace';
        c.fillStyle = '#34d399';
        c.shadowColor = '#34d399';
        c.shadowBlur = 14;
        c.fillText('8-BALL', 36, 38);
        c.shadowBlur = 0;
        c.font = '600 10px "PingFang SC", "Microsoft YaHei", sans-serif';
        c.fillStyle = 'rgba(139, 149, 181, 0.9)';
        c.fillText('桌球 · 霓虹球房', 37, 54);

        /* 右侧数据 */
        var stats = [
          { label: '剩余', value: remainingBalls(), color: '#34d399', x: W - 36 },
          { label: '杆数', value: strokes, color: '#e8ecff', x: W - 132 },
          { label: '连击', value: combo, color: '#facc15', x: W - 228 }
        ];
        for (var i = 0; i < stats.length; i++) {
          var s = stats[i];
          c.textAlign = 'right';
          c.font = '600 9px "PingFang SC", "Microsoft YaHei", sans-serif';
          c.fillStyle = 'rgba(139, 149, 181, 0.75)';
          c.fillText(s.label, s.x, 26);
          c.font = '900 18px "Consolas", monospace';
          c.fillStyle = s.color;
          c.fillText(String(s.value), s.x, 48);
        }

        /* 只剩 8 号球时中央提示 */
        if (phase === 'aim' && remainingBalls() === 1) {
          var a = 0.55 + 0.35 * Math.sin(rt.time * 4);
          c.textAlign = 'center';
          c.font = '700 13px "PingFang SC", "Microsoft YaHei", sans-serif';
          c.fillStyle = 'rgba(251, 191, 36, ' + a.toFixed(3) + ')';
          c.fillText('最后目标 · 8 号球', W / 2, 48);
        }
      }

      function drawBottomBar(c) {
        var bx = CAB_X;
        var by = CAB_Y + CAB_H + 10;
        var bw = CAB_W;
        var bh = 46;

        c.fillStyle = 'rgba(9, 18, 15, 0.86)';
        roundRect(c, bx, by, bw, bh, 12);
        c.fill();
        c.strokeStyle = 'rgba(52, 211, 153, 0.18)';
        c.lineWidth = 1;
        c.stroke();

        /* 力度条 */
        var labelX = bx + 18;
        c.textAlign = 'left';
        c.textBaseline = 'middle';
        c.font = '700 10px "Consolas", monospace';
        c.fillStyle = 'rgba(139, 149, 181, 0.85)';
        c.fillText('POWER', labelX, by + bh / 2);

        var barX = bx + 72;
        var barY = by + 15;
        var barW = 258;
        var barH = 16;
        c.fillStyle = 'rgba(255, 255, 255, 0.08)';
        roundRect(c, barX, barY, barW, barH, 8);
        c.fill();

        if (power > 0.005) {
          var grad = c.createLinearGradient(barX, 0, barX + barW, 0);
          grad.addColorStop(0, '#34d399');
          grad.addColorStop(0.55, '#facc15');
          grad.addColorStop(1, '#f43f5e');
          c.save();
          roundRect(c, barX, barY, Math.max(6, barW * power), barH, 8);
          c.clip();
          c.fillStyle = grad;
          c.fillRect(barX, barY, barW, barH);
          c.restore();
          c.fillStyle = 'rgba(255, 255, 255, 0.18)';
          c.fillRect(barX + 3, barY + 3, Math.max(0, barW * power - 6), 3);
        }

        c.strokeStyle = 'rgba(255, 255, 255, 0.10)';
        c.lineWidth = 1;
        for (var i = 1; i < 10; i++) {
          var tx = barX + (barW / 10) * i;
          c.beginPath();
          c.moveTo(tx, barY + 2);
          c.lineTo(tx, barY + barH - 2);
          c.stroke();
        }

        c.textAlign = 'left';
        c.font = '700 12px "Consolas", monospace';
        c.fillStyle = power > 0.8 ? '#f43f5e' : (power > 0.45 ? '#facc15' : '#34d399');
        c.fillText(Math.round(power * 100) + '%', barX + barW + 12, by + bh / 2);

        /* 操作提示 */
        c.textAlign = 'right';
        c.font = '600 10px "PingFang SC", "Microsoft YaHei", sans-serif';
        c.fillStyle = 'rgba(139, 149, 181, 0.8)';
        c.fillText('按住拖拽蓄力 · 松手击球', bx + bw - 18, by + 17);
        c.fillStyle = 'rgba(139, 149, 181, 0.5)';
        c.fillText('← → 角度   ↑ ↓ / 空格 力度   Enter 击球', bx + bw - 18, by + 33);

        /* 连击提示 */
        if (combo > 1) {
          c.textAlign = 'center';
          c.font = '900 14px "Consolas", monospace';
          c.fillStyle = '#facc15';
          c.fillText('COMBO ×' + combo, midX, by + 15);
        }

        c.textBaseline = 'alphabetic';
      }

      function drawOver(c) {
        var k = Math.min(1, overTimer / 0.5);
        c.fillStyle = 'rgba(3, 8, 6, ' + (0.45 * k).toFixed(3) + ')';
        c.fillRect(0, 0, W, H);

        c.save();
        c.translate(midX, midY);
        var sc = 1 + (1 - k) * 0.35;
        c.scale(sc, sc);
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = '900 42px "Consolas", monospace';
        c.fillStyle = won ? '#34d399' : '#f43f5e';
        c.shadowColor = won ? '#34d399' : '#f43f5e';
        c.shadowBlur = 28;
        c.fillText(won ? 'CLEAR!' : 'GAME OVER', 0, -8);
        c.shadowBlur = 0;
        c.font = '600 14px "PingFang SC", "Microsoft YaHei", sans-serif';
        c.fillStyle = 'rgba(232, 236, 255, 0.9)';
        c.fillText(won ? '一杆清台 · 8 号球最后落袋' : '8 号球提前落袋', 0, 28);
        c.restore();
        c.textBaseline = 'alphabetic';
      }

      /* ---------- 初始化 ---------- */
      function reset() {
        resetBalls();
        phase = 'aim';
        aimAngle = 0;
        power = 0;
        strokes = 0;
        pottedCount = 0;
        combo = 0;
        maxCombo = 0;
        totalPoints = 0;
        comboBonus = 0;
        elapsed = 0;
        shotPots = [];
        cuePotted = false;
        dragging = false;
        dragMoved = false;
        spaceWasDown = false;
        physAcc = 0;
        shake = 0;
        flash = 0;
        particles = [];
        popups = [];
        overTimer = 0;
        overResult = null;
        ended = false;
        won = false;
        lastLiveScore = -1;
        railSfx = 0;
        ballSfx = 0;
        potFlash = 0;
        rt.setScore(0);
        syncHud();
        rt.setStatus('按住拖拽蓄力，松手击球 · 键盘 ← → 调角度');
      }

      reset();

      return {
        update: function (dt) {
          /* 引擎在 create 之后会清空一次 status / HUD 徽章，这里补上首帧提示与数据 */
          if (rt.frame <= 1 && phase === 'aim') {
            rt.setStatus('按住拖拽蓄力，松手击球 · 键盘 ← → 调角度');
            rt.setHud({});
            syncHud();
          }
          if (phase !== 'over') elapsed += dt;
          if (shake > 0) shake = Math.max(0, shake - dt * 42);
          if (flash > 0) flash = Math.max(0, flash - dt * 1.8);
          if (potFlash > 0) potFlash = Math.max(0, potFlash - dt * 2.4);
          if (railSfx > 0) railSfx -= dt;
          if (ballSfx > 0) ballSfx -= dt;

          updateParticles(dt);
          updatePopups(dt);
          updatePotAnims(dt);

          if (phase === 'aim') {
            handleAim(dt);
            if (dragging && !rt.pointer.down) {
              dragging = false;
              power = 0;
            }
          } else if (phase === 'shoot') {
            physAcc += dt;
            var steps = 0;
            while (physAcc >= STEP && steps < 14) {
              physicsStep(STEP);
              physAcc -= STEP;
              steps++;
            }
            if (steps >= 14) physAcc = 0;
            if (allStopped()) settleShot();
          } else if (phase === 'over') {
            overTimer += dt;
            if (overTimer > 0.85 && !ended) {
              ended = true;
              rt.end(overResult);
            }
          }

          if (phase !== 'over') updateLiveScore();
        },

        render: function (c) {
          var sx = shake > 0 ? rt.rand(-shake, shake) : 0;
          var sy = shake > 0 ? rt.rand(-shake, shake) : 0;

          c.save();
          c.translate(sx, sy);

          drawBackground(c);
          drawTable(c);
          drawBalls(c);
          if (phase === 'aim') drawAim(c);
          drawParticles(c);
          drawPopups(c);

          c.restore();

          drawHud(c);
          drawBottomBar(c);

          if (flash > 0) {
            c.fillStyle = 'rgba(52, 211, 153, ' + (flash * 0.22).toFixed(3) + ')';
            c.fillRect(0, 0, W, H);
          }
          if (potFlash > 0) {
            c.fillStyle = 'rgba(251, 191, 36, ' + (potFlash * 0.10).toFixed(3) + ')';
            c.fillRect(0, 0, W, H);
          }
          if (phase === 'over') drawOver(c);

          /* 暗角 */
          var vg = c.createRadialGradient(midX, midY, H * 0.36, midX, midY, H * 0.92);
          vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
          vg.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
          c.fillStyle = vg;
          c.fillRect(0, 0, W, H);
        },

        onPointerDown: function (x, y) {
          if (phase !== 'aim') return;
          if (!balls[0].live) return;
          dragging = true;
          dragMoved = false;
          dragStartX = x;
          dragStartY = y;
          updateDrag(x, y);
          power = 0;
        },

        onPointerMove: function (x, y) {
          if (!dragging || phase !== 'aim') return;
          updateDrag(x, y);
        },

        onPointerUp: function (x, y) {
          if (!dragging) return;
          dragging = false;
          updateDrag(x, y);
          if (dragMoved && power > 0.05) {
            shoot(power);
          } else {
            power = 0;
            rt.audio.play('blip', 0.15);
          }
        }
      };
    }
  });
})();
