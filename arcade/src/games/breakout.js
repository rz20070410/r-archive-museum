/* 游戏：打砖块 —— 霓虹砖墙，反弹到底 */
(function () {
  'use strict';

  var FONT_UI = '"PingFang SC", "Microsoft YaHei", sans-serif';
  var FONT_NUM = '"Consolas", monospace';

  var ROW_COLORS = ['#fb7185', '#f472b6', '#c084fc', '#818cf8', '#22d3ee', '#34d399'];

  var POWER = {
    multi: { char: '多', color: '#22d3ee', name: '多球' },
    wide: { char: '宽', color: '#f472b6', name: '加长挡板' },
    slow: { char: '慢', color: '#818cf8', name: '减速' },
    life: { char: '心', color: '#f43f5e', name: '加命' }
  };

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
    id: 'breakout',
    title: '打砖块',
    subtitle: '反弹、拆墙、别掉球',
    description: '拖动挡板接住小球，把整面霓虹砖墙拆干净。连击能翻倍加分，关卡越高球速越快，接住道具还能多球、加长、减速、加命。',
    icon: '🧱',
    accent: '#f472b6',
    accent2: '#a855f7',
    tags: ['街机', '经典'],
    difficulty: '中等',
    width: 720,
    height: 540,
    order: 20,
    tips: '用挡板边缘击球能打出更大角度；连击越高，单块砖越值钱。',
    controls: [
      { keys: '← → / A D', action: '移动挡板' },
      { keys: '鼠标 / 触摸', action: '拖动挡板' },
      { keys: '空格 / 点击', action: '发球' }
    ],

    create: function (rt) {
      var colors = rt.colors;

      /* ---------- 布局（全部由 rt.width / rt.height 推导） ---------- */
      var W = rt.width;
      var H = rt.height;
      var PF_L = Math.round(W * 0.036);
      var PF_R = W - PF_L;
      var PF_T = 58;
      var PADDLE_Y = H - 46;
      var PADDLE_H = 13;
      var PADDLE_W = Math.round(W * 0.15);
      var PADDLE_WIDE = Math.round(W * 0.233);
      var BALL_R = 7;

      var BRICK_COLS = 11;
      var BRICK_GAP = 5;
      var BRICK_H = 22;
      var BRICK_TOP = 88;
      var ROW_GAP = 6;
      var BRICK_X0 = PF_L + 10;
      var BRICK_X1 = PF_R - 10;
      var BRICK_W = (BRICK_X1 - BRICK_X0 - BRICK_GAP * (BRICK_COLS - 1)) / BRICK_COLS;

      var MAX_PARTICLES = 280;
      var MAX_BALLS = 6;
      var MAX_LIVES = 5;

      /* ---------- 状态（全部在闭包内，重开局自然重置） ---------- */
      var ctx = null;
      var bgGrad = null;
      var glowGrad = null;
      var dangerGrad = null;
      var bottomGrad = null;

      var phase = 'serve';
      var score = 0;
      var lives = 3;
      var level = 1;
      var combo = 0;
      var maxCombo = 0;
      var bricksBroken = 0;
      var bricksLeft = 0;
      var baseSpeed = 326;
      var slowT = 0;
      var wideT = 0;
      var timeAlive = 0;
      var overTimer = 0;
      var deadTimer = 0;
      var clearTimer = 0;
      var ended = false;
      var shake = 0;
      var flash = 0;
      var hudDirty = true;
      var statusText = '';
      var flashText = '';
      var flashTextT = 0;
      var mouseActive = true;
      var lastPtrX = W / 2;

      var banner = null;

      var paddle = { x: W / 2, w: PADDLE_W, targetW: PADDLE_W, vx: 0, glow: 0 };
      var balls = [];
      var bricks = [];
      var powerups = [];
      var particles = [];
      var popups = [];

      /* ---------- 小工具 ---------- */
      function currentSpeed() {
        return baseSpeed * (slowT > 0 ? 0.7 : 1);
      }

      function addScore(n) {
        score += n;
        rt.setScore(score);
      }

      function setStatus(text) {
        if (text === statusText) return;
        statusText = text;
        rt.setStatus(text);
      }

      function updateHud() {
        var hearts = '';
        var i;
        for (i = 0; i < lives; i++) hearts += '♥';
        if (!hearts) hearts = '—';
        rt.setHud({
          关卡: level,
          生命: hearts,
          连击: combo > 1 ? 'x' + combo : '—'
        });
      }

      function addParticles(x, y, color, count, power) {
        var room = MAX_PARTICLES - particles.length;
        if (room <= 0) return;
        if (count > room) count = room;
        for (var i = 0; i < count; i++) {
          var a = rt.rand(0, Math.PI * 2);
          var sp = rt.rand(50, 210) * (power || 1);
          particles.push({
            x: x, y: y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp - 34,
            life: rt.rand(0.28, 0.68),
            max: 0.68,
            size: rt.rand(2, 4.4),
            color: color,
            grav: 330
          });
        }
      }

      function addPopup(x, y, text, color) {
        if (popups.length > 22) popups.shift();
        popups.push({
          x: x, y: y, vy: -48,
          text: text, color: color,
          life: 0.85, max: 0.85
        });
      }

      /* ---------- 关卡 / 球 ---------- */
      function buildLevel() {
        bricks.length = 0;
        var rows = Math.max(4, Math.min(6, 3 + level));
        var hp2Chance = Math.min(0.9, 0.1 + level * 0.14);
        for (var r = 0; r < rows; r++) {
          for (var c = 0; c < BRICK_COLS; c++) {
            var hp = 1;
            if (r === 0 && level >= 2) hp = 2;
            else if (rt.rand(0, 1) < hp2Chance) hp = 2;
            bricks.push({
              x: BRICK_X0 + c * (BRICK_W + BRICK_GAP),
              y: BRICK_TOP + r * (BRICK_H + ROW_GAP),
              w: BRICK_W,
              h: BRICK_H,
              hp: hp,
              maxHp: hp,
              color: ROW_COLORS[r % ROW_COLORS.length],
              row: r,
              alive: true,
              flash: 0
            });
          }
        }
        bricksLeft = bricks.length;
      }

      function resetBall(stuck) {
        balls.length = 0;
        balls.push({
          x: paddle.x,
          y: PADDLE_Y - BALL_R - 1,
          vx: 0, vy: 0,
          r: BALL_R,
          dead: false,
          stuck: !!stuck
        });
      }

      function syncServe() {
        for (var i = 0; i < balls.length; i++) {
          if (balls[i].stuck) {
            balls[i].x = paddle.x;
            balls[i].y = PADDLE_Y - BALL_R - 1;
            balls[i].vx = 0;
            balls[i].vy = 0;
          }
        }
      }

      function launch() {
        if (phase !== 'serve' || !balls.length) return;
        var b = balls[0];
        var ang = rt.rand(-0.42, 0.42);
        var sp = currentSpeed();
        b.vx = Math.sin(ang) * sp;
        b.vy = -Math.cos(ang) * sp;
        b.stuck = false;
        phase = 'play';
        rt.audio.play('blip', 0.55);
        addParticles(b.x, b.y, colors.accent, 10, 0.8);
        shake = Math.max(shake, 2);
      }

      /* ---------- 特效 ---------- */
      function tickEffects(dt) {
        var i;
        for (i = particles.length - 1; i >= 0; i--) {
          var p = particles[i];
          p.life -= dt;
          if (p.life <= 0) { particles.splice(i, 1); continue; }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += p.grav * dt;
          p.vx *= 0.985;
          p.vy *= 0.985;
        }
        for (i = popups.length - 1; i >= 0; i--) {
          var pp = popups[i];
          pp.life -= dt;
          pp.y += pp.vy * dt;
          if (pp.life <= 0) popups.splice(i, 1);
        }
        for (i = 0; i < bricks.length; i++) {
          if (bricks[i].flash > 0) bricks[i].flash = Math.max(0, bricks[i].flash - dt * 4);
        }
        if (banner) {
          banner.life -= dt;
          if (banner.life <= 0) banner = null;
        }
        if (flashTextT > 0) {
          flashTextT -= dt;
          if (flashTextT <= 0) flashText = '';
        }
        if (shake > 0) shake = Math.max(0, shake - dt * 42);
        if (flash > 0) flash = Math.max(0, flash - dt * 2.2);
        if (slowT > 0) slowT = Math.max(0, slowT - dt);
        if (wideT > 0) {
          wideT = Math.max(0, wideT - dt);
          if (wideT === 0) paddle.targetW = PADDLE_W;
        }
        if (paddle.glow > 0) paddle.glow = Math.max(0, paddle.glow - dt * 5);
      }

      /* ---------- 挡板 ---------- */
      function updatePaddle(dt) {
        var move = 0;
        if (rt.keys.has('ArrowLeft') || rt.keys.has('KeyA')) move -= 1;
        if (rt.keys.has('ArrowRight') || rt.keys.has('KeyD')) move += 1;
        var oldX = paddle.x;
        if (move !== 0) {
          mouseActive = false;
          paddle.x += move * 640 * dt;
        } else if (mouseActive) {
          paddle.x += (rt.pointer.x - paddle.x) * Math.min(1, dt * 18);
        }
        // 挡板宽度缓动
        paddle.w += (paddle.targetW - paddle.w) * Math.min(1, dt * 10);
        var half = paddle.w / 2;
        if (paddle.x < PF_L + half) paddle.x = PF_L + half;
        if (paddle.x > PF_R - half) paddle.x = PF_R - half;
        paddle.vx = (paddle.x - oldX) / Math.max(dt, 0.0001);
      }

      /* ---------- 道具 ---------- */
      function maybeDrop(br) {
        if (powerups.length >= 3) return;
        if (rt.rand(0, 1) > 0.2) return;
        var roll = rt.rand(0, 1);
        var type;
        if (roll < 0.34) type = 'multi';
        else if (roll < 0.62) type = 'wide';
        else if (roll < 0.86) type = 'slow';
        else type = 'life';
        powerups.push({
          x: br.x + br.w * 0.5,
          y: br.y + br.h * 0.5,
          vy: 108,
          type: type,
          phase: rt.rand(0, Math.PI * 2)
        });
      }

      function catchPowerup(p) {
        var info = POWER[p.type];
        rt.audio.play('power', 0.7);
        addParticles(p.x, p.y, info.color, 14, 1.2);
        shake = Math.max(shake, 2.6);
        flashText = info.name + '！';
        flashTextT = 1.5;
        if (p.type === 'multi') {
          var snapshot = balls.slice(0);
          var added = 0;
          for (var i = 0; i < snapshot.length && added < 2 && balls.length < MAX_BALLS; i++) {
            var src = snapshot[i];
            var ang = Math.atan2(src.vy, src.vx);
            for (var d = -1; d <= 1 && added < 2 && balls.length < MAX_BALLS; d += 2) {
              var a2 = ang + d * 0.42;
              var sp = currentSpeed();
              balls.push({
                x: src.x, y: src.y,
                vx: Math.cos(a2) * sp,
                vy: Math.sin(a2) * sp,
                r: BALL_R,
                dead: false,
                stuck: false
              });
              added += 1;
            }
          }
          if (added === 0) addScore(40);
        } else if (p.type === 'wide') {
          wideT = 12;
          paddle.targetW = PADDLE_WIDE;
        } else if (p.type === 'slow') {
          slowT = 9;
        } else if (p.type === 'life') {
          if (lives < MAX_LIVES) lives += 1;
          else addScore(60);
          updateHud();
        }
        addPopup(paddle.x, PADDLE_Y - 24, info.name, info.color);
      }

      function updatePowerups(dt) {
        for (var i = powerups.length - 1; i >= 0; i--) {
          var p = powerups[i];
          p.y += p.vy * dt;
          if (p.y > H + 26) { powerups.splice(i, 1); continue; }
          var px0 = paddle.x - paddle.w / 2;
          if (p.y + 13 >= PADDLE_Y && p.y - 13 <= PADDLE_Y + PADDLE_H &&
              p.x >= px0 - 12 && p.x <= px0 + paddle.w + 12) {
            catchPowerup(p);
            powerups.splice(i, 1);
          }
        }
      }

      /* ---------- 碰撞 ---------- */
      // 保证球既有足够的纵向分量（防水平死循环），也有横向分量（防竖直打洞卡死）
      function fixBallAngle(b) {
        var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        if (sp < 0.001) return;
        var nx = b.vx / sp;
        var ny = b.vy / sp;
        if (nx === 0) nx = rt.rand(0, 1) < 0.5 ? -0.001 : 0.001;
        if (ny === 0) ny = rt.rand(0, 1) < 0.5 ? -0.001 : 0.001;
        var ax = Math.abs(nx);
        var ay = Math.abs(ny);
        var sx = nx < 0 ? -1 : 1;
        var sy = ny < 0 ? -1 : 1;
        if (ay < 0.3) {
          ay = 0.3;
          ax = Math.sqrt(1 - ay * ay);
        } else if (ax < 0.17) {
          ax = 0.17;
          ay = Math.sqrt(1 - ax * ax);
        }
        b.vx = sx * ax * sp;
        b.vy = sy * ay * sp;
      }

      function bouncePaddle(b) {
        var half = paddle.w / 2;
        var rel = rt.clamp((b.x - paddle.x) / half, -1, 1);
        // 正中心接球时给一点随机偏移，避免球永远垂直往返“打洞”
        if (Math.abs(rel) < 0.1) {
          rel = (rt.rand(0, 1) < 0.5 ? -1 : 1) * rt.rand(0.12, 0.26);
        }
        var maxAng = Math.PI / 3;
        var ang = rel * maxAng + rt.clamp(paddle.vx * 0.00018, -0.16, 0.16);
        ang = rt.clamp(ang, -maxAng, maxAng);
        var sp = currentSpeed();
        b.vx = Math.sin(ang) * sp;
        b.vy = -Math.abs(Math.cos(ang)) * sp;
        b.y = PADDLE_Y - b.r - 0.5;
        paddle.glow = 1;
        combo = 0;
        updateHud();
        rt.audio.play('blip', 0.4);
        addParticles(b.x, PADDLE_Y, colors.accent, 6, 0.55);
        shake = Math.max(shake, 1.8);
      }

      function collideBrick(b) {
        for (var i = 0; i < bricks.length; i++) {
          var br = bricks[i];
          if (!br.alive) continue;
          var cx = br.x + br.w * 0.5;
          var cy = br.y + br.h * 0.5;
          var ox = br.w * 0.5 + b.r - Math.abs(b.x - cx);
          if (ox <= 0) continue;
          var oy = br.h * 0.5 + b.r - Math.abs(b.y - cy);
          if (oy <= 0) continue;
          if (ox < oy) {
            b.vx = -b.vx;
            b.x += (b.x < cx ? -ox : ox);
          } else {
            b.vy = -b.vy;
            b.y += (b.y < cy ? -oy : oy);
          }
          hitBrick(br);
          return true;
        }
        return false;
      }

      function stepBall(b, dt) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        if (b.x - b.r < PF_L) {
          b.x = PF_L + b.r;
          b.vx = Math.abs(b.vx);
          addParticles(b.x, b.y, colors.accent2, 2, 0.5);
        } else if (b.x + b.r > PF_R) {
          b.x = PF_R - b.r;
          b.vx = -Math.abs(b.vx);
          addParticles(b.x, b.y, colors.accent2, 2, 0.5);
        }
        if (b.y - b.r < PF_T) {
          b.y = PF_T + b.r;
          b.vy = Math.abs(b.vy);
          addParticles(b.x, b.y, colors.accent2, 2, 0.5);
        } else if (b.y - b.r > H + 12) {
          b.dead = true;
          return;
        }

        var px0 = paddle.x - paddle.w / 2;
        if (b.vy > 0 && b.y + b.r >= PADDLE_Y && b.y - b.r <= PADDLE_Y + PADDLE_H &&
            b.x + b.r >= px0 && b.x - b.r <= px0 + paddle.w) {
          bouncePaddle(b);
          fixBallAngle(b);
          return;
        }

        if (collideBrick(b)) fixBallAngle(b);
      }

      function updateBalls(dt) {
        var sp = currentSpeed();
        for (var i = balls.length - 1; i >= 0; i--) {
          var b = balls[i];
          if (b.dead || b.stuck) continue;
          var m = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          if (m < 0.001) {
            b.vx = 0;
            b.vy = -sp;
            m = sp;
          }
          if (Math.abs(m - sp) > 0.6) {
            var k = sp / m;
            b.vx *= k;
            b.vy *= k;
          }
          var steps = Math.max(1, Math.ceil((sp * dt) / 5));
          var sdt = dt / steps;
          for (var s = 0; s < steps; s++) {
            if (b.dead) break;
            stepBall(b, sdt);
          }
        }
        for (var j = balls.length - 1; j >= 0; j--) {
          if (balls[j].dead) balls.splice(j, 1);
        }
        if (balls.length === 0 && phase === 'play') loseLife();
      }

      /* ---------- 计分 / 关卡流程 ---------- */
      function hitBrick(br) {
        br.hp -= 1;
        br.flash = 1;
        combo += 1;
        if (combo > maxCombo) maxCombo = combo;
        var cx = br.x + br.w * 0.5;
        var cy = br.y + br.h * 0.5;
        var gained;
        if (br.hp <= 0) {
          br.alive = false;
          bricksLeft -= 1;
          bricksBroken += 1;
          gained = 10 + Math.min(combo, 12) * 2 + level * 2;
          addParticles(cx, cy, br.color, 16, 1.15);
          rt.audio.play('pop', 0.55);
          shake = Math.max(shake, 3.4);
          maybeDrop(br);
        } else {
          gained = 5;
          addParticles(cx, cy, br.color, 5, 0.75);
          rt.audio.play('hit', 0.4);
          shake = Math.max(shake, 1.8);
        }
        addScore(gained);
        addPopup(cx, cy - 4, '+' + gained, br.color);
        if (combo >= 4) addPopup(cx, cy - 26, '连击 x' + combo, colors.accent);
        updateHud();
        if (bricksLeft <= 0) levelClear();
      }

      function levelClear() {
        if (phase !== 'play') return;
        phase = 'clear';
        clearTimer = 0;
        combo = 0;
        var bonus = 90 * level + lives * 45;
        addScore(bonus);
        banner = {
          title: '关卡 ' + level + ' 清空',
          sub: '通关奖励 +' + bonus,
          life: 1.35,
          max: 1.35
        };
        rt.audio.play('level', 0.8);
        shake = 8;
        for (var i = 0; i < 3; i++) {
          addParticles(
            rt.rand(PF_L + 60, PF_R - 60),
            rt.rand(BRICK_TOP + 40, 330),
            rt.pick(ROW_COLORS), 15, 1.5
          );
        }
        updateHud();
        setStatus('关卡 ' + level + ' 完成！');
      }

      function nextLevel() {
        level += 1;
        baseSpeed = Math.min(660, 326 * Math.pow(1.075, level - 1));
        slowT = 0;
        wideT = 0;
        paddle.targetW = PADDLE_W;
        powerups.length = 0;
        buildLevel();
        resetBall(true);
        phase = 'serve';
        clearTimer = 0;
        banner = null;
        rt.audio.play('blip', 0.5);
        updateHud();
        setStatus('按空格 / 点击发球');
      }

      function loseLife() {
        if (phase !== 'play') return;
        lives -= 1;
        combo = 0;
        slowT = 0;
        wideT = 0;
        paddle.targetW = PADDLE_W;
        updateHud();
        shake = 15;
        flash = 0.55;
        addParticles(paddle.x, H - 16, colors.danger, 20, 1.5);
        rt.audio.play('explode', 0.6);
        if (lives <= 0) {
          lives = 0;
          phase = 'over';
          overTimer = 0;
          updateHud();
          setStatus('生命耗尽…');
        } else {
          phase = 'dying';
          deadTimer = 0;
          setStatus('掉球了，再来一次');
        }
      }

      /* ---------- 初始化 ---------- */
      buildLevel();
      resetBall(true);
      phase = 'serve';
      hudDirty = true;

      return {
        update: function (dt) {
          timeAlive += dt;
          tickEffects(dt);
          if (hudDirty) {
            hudDirty = false;
            updateHud();
          }

          if (phase === 'over') {
            overTimer += dt;
            if (!ended && overTimer >= 1.05) {
              ended = true;
              rt.end({
                score: score,
                message: '第 ' + level + ' 关失守，砖块拆掉 ' + bricksBroken + ' 块',
                stats: [
                  { label: '到达关卡', value: level },
                  { label: '击碎砖块', value: bricksBroken },
                  { label: '最高连击', value: 'x' + maxCombo },
                  { label: '存活时间', value: timeAlive.toFixed(1) + 's' }
                ]
              });
            }
            return;
          }

          updatePaddle(dt);

          if (phase === 'dying') {
            deadTimer += dt;
            setStatus('');
            if (deadTimer >= 0.7) {
              resetBall(true);
              phase = 'serve';
              deadTimer = 0;
              setStatus('按空格 / 点击发球');
            }
            return;
          }

          if (phase === 'clear') {
            clearTimer += dt;
            if (clearTimer >= 1.25) nextLevel();
            return;
          }

          updatePowerups(dt);

          if (phase === 'serve') {
            syncServe();
            setStatus(flashTextT > 0 ? flashText : '按空格 / 点击发球');
            if (rt.wasPressed('Space')) launch();
            return;
          }

          // phase === 'play'
          if (flashTextT > 0) setStatus(flashText);
          else if (combo >= 3) setStatus('连击 x' + combo);
          else setStatus('');
          updateBalls(dt);
          if (bricksLeft <= 0 && phase === 'play') levelClear();
        },

        render: function (c) {
          ctx = c;
          ensureGradients();
          var t = rt.time;

          var sx = shake > 1 ? rt.rand(-shake, shake) : 0;
          var sy = shake > 1 ? rt.rand(-shake, shake) : 0;
          ctx.save();
          ctx.translate(sx, sy);
          drawBackground(t);
          drawFieldFrame(t);
          drawBricks();
          drawPowerups(t);
          drawPaddle(t);
          drawBalls();
          drawParticles();
          drawPopups();
          drawBanner();
          drawServeHint(t);
          ctx.restore();

          drawInfo(t);
          drawOverlays(t);
        },

        onPointerMove: function (x) {
          if (Math.abs(x - lastPtrX) > 0.6) {
            mouseActive = true;
            lastPtrX = x;
          }
        },

        onPointerDown: function (x) {
          lastPtrX = x;
          mouseActive = true;
          if (phase === 'serve') launch();
        },

        destroy: function () {
          // 无外部监听 / 计时器需要清理；闭包内的状态随实例一起丢弃
          balls.length = 0;
          particles.length = 0;
          popups.length = 0;
          powerups.length = 0;
        }
      };

      /* ================= 绘制 ================= */

      function ensureGradients() {
        if (bgGrad) return;
        bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, '#0a0a1e');
        bgGrad.addColorStop(0.5, '#0a1224');
        bgGrad.addColorStop(1, '#150a24');

        glowGrad = ctx.createRadialGradient(W * 0.5, 46, 8, W * 0.5, 46, 430);
        glowGrad.addColorStop(0, 'rgba(244,114,182,0.55)');
        glowGrad.addColorStop(0.45, 'rgba(168,85,247,0.16)');
        glowGrad.addColorStop(1, 'rgba(168,85,247,0)');

        dangerGrad = ctx.createRadialGradient(W * 0.5, H * 0.62, 140, W * 0.5, H * 0.62, 430);
        dangerGrad.addColorStop(0, 'rgba(244,63,94,0)');
        dangerGrad.addColorStop(1, 'rgba(244,63,94,0.6)');

        bottomGrad = ctx.createLinearGradient(0, H - 64, 0, H);
        bottomGrad.addColorStop(0, 'rgba(244,63,94,0)');
        bottomGrad.addColorStop(1, 'rgba(244,63,94,0.22)');
      }

      function drawBackground(t) {
        ctx.fillStyle = bgGrad;
        ctx.fillRect(-30, -30, W + 60, H + 60);

        ctx.globalAlpha = 0.55 + Math.sin(t * 0.9) * 0.12;
        ctx.fillStyle = glowGrad;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;

        ctx.fillStyle = 'rgba(129,140,248,0.10)';
        for (var gx = PF_L + 18; gx < PF_R; gx += 34) {
          for (var gy = PF_T + 18; gy < H; gy += 34) {
            ctx.fillRect(gx, gy, 1.8, 1.8);
          }
        }

        // 顶部扫光线
        var scan = (t * 90) % (H + 120) - 60;
        var sg = ctx.createLinearGradient(0, scan, 0, scan + 90);
        sg.addColorStop(0, 'rgba(244,114,182,0)');
        sg.addColorStop(0.5, 'rgba(244,114,182,0.05)');
        sg.addColorStop(1, 'rgba(244,114,182,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(PF_L, scan, PF_R - PF_L, 90);
      }

      function drawFieldFrame(t) {
        ctx.save();
        ctx.shadowColor = colors.accent;
        ctx.shadowBlur = 18;
        ctx.strokeStyle = 'rgba(244,114,182,0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(PF_L, H + 14);
        ctx.lineTo(PF_L, PF_T + 14);
        ctx.quadraticCurveTo(PF_L, PF_T, PF_L + 14, PF_T);
        ctx.lineTo(PF_R - 14, PF_T);
        ctx.quadraticCurveTo(PF_R, PF_T, PF_R, PF_T + 14);
        ctx.lineTo(PF_R, H + 14);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = bottomGrad;
        ctx.fillRect(PF_L, H - 64, PF_R - PF_L, 64);

        ctx.save();
        ctx.setLineDash([8, 12]);
        ctx.lineDashOffset = -t * 26;
        ctx.strokeStyle = 'rgba(244,63,94,0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(PF_L + 4, H - 15);
        ctx.lineTo(PF_R - 4, H - 15);
        ctx.stroke();
        ctx.restore();
      }

      function drawBricks() {
        for (var i = 0; i < bricks.length; i++) {
          var br = bricks[i];
          if (!br.alive) continue;
          var x = br.x;
          var y = br.y;
          var w = br.w;
          var h = br.h;
          roundRect(ctx, x, y, w, h, 4);
          ctx.fillStyle = br.color;
          ctx.fill();

          if (br.hp > 1) {
            // 双血砖：暗色装甲 + 霓虹描边 + 角部刻线
            ctx.fillStyle = 'rgba(8,10,28,0.42)';
            ctx.fill();
            roundRect(ctx, x + 2.4, y + 2.4, w - 4.8, h - 4.8, 3);
            ctx.strokeStyle = br.color;
            ctx.lineWidth = 1.8;
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.fillRect(x + 6, y + 5, 4, 1.6);
            ctx.fillRect(x + w - 10, y + h - 6.6, 4, 1.6);
            ctx.fillRect(x + 6, y + h - 6.6, 4, 1.6);
            ctx.fillRect(x + w - 10, y + 5, 4, 1.6);
          } else {
            ctx.fillStyle = 'rgba(255,255,255,0.24)';
            ctx.fillRect(x + 4, y + 3, w - 8, 2);
            ctx.fillStyle = 'rgba(0,0,0,0.24)';
            ctx.fillRect(x + 4, y + h - 5, w - 8, 2);
          }

          if (br.flash > 0) {
            ctx.globalAlpha = Math.min(1, br.flash);
            roundRect(ctx, x, y, w, h, 4);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      }

      function drawPowerups(t) {
        for (var i = 0; i < powerups.length; i++) {
          var p = powerups[i];
          var info = POWER[p.type];
          var bob = Math.sin(t * 5 + p.phase) * 2;
          var cx = p.x;
          var cy = p.y + bob;
          ctx.save();
          ctx.shadowColor = info.color;
          ctx.shadowBlur = 12;
          roundRect(ctx, cx - 13, cy - 13, 26, 26, 8);
          ctx.fillStyle = 'rgba(10,12,26,0.92)';
          ctx.fill();
          ctx.strokeStyle = info.color;
          ctx.lineWidth = 1.6;
          ctx.stroke();
          ctx.restore();

          ctx.globalAlpha = 0.35 + Math.sin(t * 6 + p.phase) * 0.2;
          roundRect(ctx, cx - 16, cy - 16, 32, 32, 10);
          ctx.strokeStyle = info.color;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.globalAlpha = 1;

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = '700 15px ' + FONT_UI;
          ctx.fillStyle = info.color;
          ctx.fillText(info.char, cx, cy + 1);
          ctx.textBaseline = 'alphabetic';
        }
      }

      function drawPaddle(t) {
        var px0 = paddle.x - paddle.w / 2;
        var py = PADDLE_Y;
        var h = PADDLE_H;

        var g = ctx.createLinearGradient(px0, py, px0 + paddle.w, py + h);
        g.addColorStop(0, '#f472b6');
        g.addColorStop(0.5, '#fbcfe8');
        g.addColorStop(1, '#a855f7');

        ctx.save();
        ctx.shadowColor = colors.accent;
        ctx.shadowBlur = 14 + paddle.glow * 20;
        roundRect(ctx, px0, py, paddle.w, h, h / 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        roundRect(ctx, px0 + 6, py + 2.5, paddle.w - 12, 2, 1);
        ctx.fill();

        ctx.fillStyle = 'rgba(12,10,30,0.5)';
        ctx.fillRect(paddle.x - 1, py + 3, 2, h - 6);

        // 加长状态外圈
        if (wideT > 0) {
          ctx.globalAlpha = 0.3 + Math.sin(t * 8) * 0.15;
          roundRect(ctx, px0 - 3, py - 3, paddle.w + 6, h + 6, (h + 6) / 2);
          ctx.strokeStyle = colors.accent;
          ctx.lineWidth = 1.4;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      function drawBalls() {
        for (var i = 0; i < balls.length; i++) {
          var b = balls[i];
          var m = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          var ux = m > 0.001 ? b.vx / m : 0;
          var uy = m > 0.001 ? b.vy / m : 0;
          if (!b.stuck && m > 0.001) {
            for (var k = 4; k >= 1; k--) {
              ctx.globalAlpha = 0.11 * (5 - k);
              ctx.fillStyle = colors.accent;
              ctx.beginPath();
              ctx.arc(b.x - ux * k * 7, b.y - uy * k * 7, b.r * (1 - k * 0.13), 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.globalAlpha = 1;
          }
          ctx.save();
          if (i === 0) {
            ctx.shadowColor = colors.accent;
            ctx.shadowBlur = 16;
          }
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fillStyle = '#fdf2f8';
          ctx.fill();
          ctx.restore();

          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r * 0.52, 0, Math.PI * 2);
          ctx.fillStyle = '#f472b6';
          ctx.fill();

          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.beginPath();
          ctx.arc(b.x - 2, b.y - 2.5, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      function drawParticles() {
        for (var i = 0; i < particles.length; i++) {
          var p = particles[i];
          var a = p.life / p.max;
          if (a <= 0) continue;
          ctx.globalAlpha = Math.min(1, a);
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
        }
        ctx.globalAlpha = 1;
      }

      function drawPopups() {
        ctx.textAlign = 'center';
        ctx.font = '900 17px ' + FONT_NUM;
        for (var i = 0; i < popups.length; i++) {
          var pp = popups[i];
          ctx.globalAlpha = Math.max(0, Math.min(1, pp.life / pp.max));
          ctx.fillStyle = pp.color;
          ctx.fillText(pp.text, pp.x, pp.y);
        }
        ctx.globalAlpha = 1;
      }

      function drawBanner() {
        if (!banner) return;
        var age = banner.max - banner.life;
        var pop = Math.min(1, age / 0.18);
        var alpha = Math.min(1, banner.life / 0.28);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(W / 2, 238);
        ctx.scale(0.9 + pop * 0.1, 0.9 + pop * 0.1);
        ctx.fillStyle = 'rgba(10,10,26,0.82)';
        roundRect(ctx, -180, -54, 360, 108, 18);
        ctx.fill();
        ctx.strokeStyle = 'rgba(244,114,182,0.7)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.font = '900 26px ' + FONT_UI;
        ctx.fillStyle = colors.text;
        ctx.fillText(banner.title, 0, 2);
        ctx.font = '700 15px ' + FONT_NUM;
        ctx.fillStyle = colors.accent;
        ctx.fillText(banner.sub, 0, 32);
        ctx.restore();
      }

      function drawServeHint(t) {
        if (phase !== 'serve') return;
        var a = 0.55 + 0.35 * Math.sin(t * 4);
        var x = rt.clamp(paddle.x, PF_L + 90, PF_R - 90);
        ctx.textAlign = 'center';
        ctx.font = '700 15px ' + FONT_UI;
        ctx.fillStyle = 'rgba(253,242,248,' + a.toFixed(3) + ')';
        ctx.fillText('按空格发球', x, PADDLE_Y - 36);
        ctx.font = '700 11px ' + FONT_NUM;
        ctx.fillStyle = 'rgba(244,114,182,' + (a * 0.8).toFixed(3) + ')';
        ctx.fillText('SPACE / TAP', x, PADDLE_Y - 20);
      }

      function drawInfo(t) {
        ctx.textAlign = 'left';
        ctx.font = '700 11px ' + FONT_NUM;
        ctx.fillStyle = 'rgba(139,149,181,0.85)';
        ctx.fillText('LIVES', PF_L + 2, 20);

        ctx.font = '700 17px ' + FONT_UI;
        var hx = PF_L + 2;
        for (var i = 0; i < MAX_LIVES; i++) {
          if (i < lives) {
            var pulse = lives === 1 ? 0.55 + 0.45 * Math.sin(t * 8) : 1;
            ctx.globalAlpha = pulse;
            ctx.fillStyle = lives === 1 ? colors.danger : colors.accent;
            ctx.fillText('♥', hx, 42);
          } else {
            ctx.globalAlpha = 0.14;
            ctx.fillStyle = colors.muted;
            ctx.fillText('♥', hx, 42);
          }
          hx += 17;
        }
        ctx.globalAlpha = 1;

        ctx.textAlign = 'center';
        ctx.font = '700 11px ' + FONT_NUM;
        ctx.fillStyle = 'rgba(139,149,181,0.85)';
        ctx.fillText('LEVEL', W / 2, 20);
        ctx.font = '900 20px ' + FONT_NUM;
        ctx.fillStyle = colors.accent2;
        ctx.fillText(('0' + level).slice(-2), W / 2, 44);

        ctx.textAlign = 'right';
        ctx.font = '700 11px ' + FONT_NUM;
        ctx.fillStyle = 'rgba(139,149,181,0.85)';
        ctx.fillText('BEST', PF_R - 2, 20);
        ctx.font = '900 15px ' + FONT_NUM;
        ctx.fillStyle = 'rgba(232,236,255,0.9)';
        ctx.fillText(String(rt.best), PF_R - 2, 37);

        if (combo > 1) {
          ctx.font = '900 13px ' + FONT_NUM;
          ctx.fillStyle = colors.accent;
          ctx.fillText('COMBO x' + combo, PF_R - 2, 53);
        }
        ctx.textAlign = 'left';
      }

      function drawOverlays(t) {
        if (lives === 1 && phase !== 'over') {
          ctx.globalAlpha = 0.34 + Math.sin(t * 6) * 0.18;
          ctx.fillStyle = dangerGrad;
          ctx.fillRect(0, 0, W, H);
          ctx.globalAlpha = 1;
        }
        if (flash > 0) {
          ctx.fillStyle = 'rgba(244,63,94,' + Math.min(0.5, flash * 0.6).toFixed(3) + ')';
          ctx.fillRect(0, 0, W, H);
        }
        if (phase === 'over') {
          var k = Math.min(1, overTimer / 0.9);
          ctx.fillStyle = 'rgba(6,6,16,' + (0.25 + k * 0.4).toFixed(3) + ')';
          ctx.fillRect(0, 0, W, H);
          ctx.textAlign = 'center';
          ctx.font = '900 34px ' + FONT_UI;
          ctx.fillStyle = 'rgba(244,63,94,' + k.toFixed(3) + ')';
          ctx.fillText('生命耗尽', W / 2, 244);
          ctx.font = '700 13px ' + FONT_NUM;
          ctx.fillStyle = 'rgba(232,236,255,' + (0.65 * k).toFixed(3) + ')';
          ctx.fillText('FINAL SCORE ' + score, W / 2, 278);
          ctx.textAlign = 'left';
        }
      }
    }
  });
})();
