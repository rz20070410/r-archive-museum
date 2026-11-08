/* 游戏：合成大西瓜 —— 重力、碰撞与 11 级水果合成 */
(function () {
  'use strict';

  var FONT_UI = '"PingFang SC", "Microsoft YaHei", sans-serif';
  var FONT_NUM = '"Consolas", monospace';
  var FONT_EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

  var FRUIT = [
    { emoji: '🍒', name: '樱桃', r: 13, color: '#f43f5e' },
    { emoji: '🍓', name: '草莓', r: 18, color: '#fb7185' },
    { emoji: '🍇', name: '葡萄', r: 23, color: '#a855f7' },
    { emoji: '🍊', name: '橘子', r: 29, color: '#fb923c' },
    { emoji: '🍑', name: '桃子', r: 35, color: '#fda4af' },
    { emoji: '🍎', name: '苹果', r: 42, color: '#ef4444' },
    { emoji: '🍐', name: '梨', r: 50, color: '#a3e635' },
    { emoji: '🍋', name: '柠檬', r: 57, color: '#facc15' },
    { emoji: '🍍', name: '菠萝', r: 65, color: '#fbbf24' },
    { emoji: '🍈', name: '甜瓜', r: 72, color: '#22c55e' },
    { emoji: '🍉', name: '西瓜', r: 80, color: '#16a34a' }
  ];
  var MAX_LEVEL = FRUIT.length;
  // 合成出新等级时的基础分（按 1-based 等级下标）
  var LEVEL_SCORE = [0, 0, 10, 25, 45, 70, 100, 140, 190, 250, 320, 400];

  var GRAV = 1600;
  var STEP = 1 / 120;
  var MAX_SPEED = 1100;
  var MAX_PARTICLES = 240;

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
    id: 'suika',
    title: '合成大西瓜',
    subtitle: '合并水果，别让箱子溢出',
    description: '把水果一颗颗放进箱子，相同的两颗碰撞就会合成更大的水果。从樱桃一路合到西瓜，小心别让果堆越过警戒线。',
    icon: '🍉',
    accent: '#fb7185',
    accent2: '#22c55e',
    tags: ['休闲', '挑战'],
    difficulty: '简单',
    width: 600,
    height: 800,
    order: 25,
    tips: '落点越靠中间，水果越容易滚到一起合成；大水果尽量放两侧，给新的腾空间。',
    controls: [
      { keys: '← → / A D', action: '左右瞄准' },
      { keys: '鼠标 / 触摸', action: '移动瞄准线' },
      { keys: '空格 / 点击', action: '放下水果' }
    ],

    create: function (rt) {
      var colors = rt.colors;

      /* ---------- 布局 ---------- */
      var W = rt.width;
      var H = rt.height;
      var BIN_L = Math.round(W * 0.06);
      var BIN_R = W - BIN_L;
      var BIN_TOP = 150;
      var BIN_BOTTOM = H - 110;
      var DANGER_Y = BIN_TOP + 44;
      var HOLD_Y = 112;
      var HUD_H = 78;
      var DEX_Y = H - 100;

      /* ---------- 状态 ---------- */
      var ctx = null;
      var bgGrad = null;
      var binGrad = null;
      var glowGrad = null;
      var dangerGrad = null;

      var phase = 'play';
      var score = 0;
      var merges = 0;
      var maxLevel = 1;
      var combo = 0;
      var maxCombo = 0;
      var comboT = 0;
      var lastMergeT = -10;
      var timeAlive = 0;
      var overTimer = 0;
      var ended = false;
      var shake = 0;
      var flash = 0;
      var dropCd = 0;
      var dangerTimer = 0;
      var hudDirty = true;
      var statusText = '';
      var mouseActive = true;
      var lastPtrX = W / 2;
      var aimPulse = 0;

      var unlocked = [];
      var dexCount = 0;

      var held = { level: 1, x: W / 2, bob: 0 };
      var nextLevel = 1;
      var fruits = [];
      var particles = [];
      var popups = [];

      /* ---------- 存档：图鉴 ---------- */
      (function loadDex() {
        var saved = rt.storage.get('dex', null);
        var i;
        for (i = 0; i < MAX_LEVEL; i++) {
          unlocked.push(saved && saved[i] === true);
        }
        if (!unlocked[0]) unlocked[0] = true;
        dexCount = 0;
        for (i = 0; i < MAX_LEVEL; i++) if (unlocked[i]) dexCount += 1;
      })();

      function saveDex() {
        rt.storage.set('dex', unlocked);
      }

      /* ---------- 工具 ---------- */
      function setStatus(text) {
        if (text === statusText) return;
        statusText = text;
        rt.setStatus(text);
      }

      function addScore(n) {
        score += n;
        rt.setScore(score);
      }

      function updateHud() {
        var i;
        dexCount = 0;
        for (i = 0; i < MAX_LEVEL; i++) if (unlocked[i]) dexCount += 1;
        rt.setHud({
          图鉴: dexCount + '/' + MAX_LEVEL,
          合成: merges,
          最大: FRUIT[maxLevel - 1].emoji + FRUIT[maxLevel - 1].name
        });
      }

      function heldRadius() {
        return FRUIT[held.level - 1].r;
      }

      function clampHeldX() {
        var r = heldRadius();
        held.x = rt.clamp(held.x, BIN_L + r + 2, BIN_R - r - 2);
      }

      function randomDropLevel() {
        var roll = rt.rand(0, 1);
        if (roll < 0.3) return 1;
        if (roll < 0.57) return 2;
        if (roll < 0.77) return 3;
        if (roll < 0.92) return 4;
        return 5;
      }

      function addParticles(x, y, color, count, power) {
        var room = MAX_PARTICLES - particles.length;
        if (room <= 0) return;
        if (count > room) count = room;
        for (var i = 0; i < count; i++) {
          var a = rt.rand(0, Math.PI * 2);
          var sp = rt.rand(60, 260) * (power || 1);
          particles.push({
            x: x, y: y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp - 50,
            life: rt.rand(0.3, 0.75),
            max: 0.75,
            size: rt.rand(2, 4.6),
            color: color,
            grav: 520
          });
        }
      }

      function addPopup(x, y, text, color) {
        if (popups.length > 18) popups.shift();
        popups.push({
          x: x + rt.rand(-16, 16),
          y: y + rt.rand(-7, 7),
          vy: -52,
          text: text,
          color: color,
          life: 1.0,
          max: 1.0
        });
      }

      /* ---------- 放置水果 ---------- */
      function spawnFruit(level, x, y, vy) {
        fruits.push({
          x: x,
          y: y,
          vx: 0,
          vy: vy || 0,
          r: FRUIT[level - 1].r,
          level: level,
          age: 0,
          born: rt.time,
          dead: false
        });
      }

      function dropFruit() {
        if (phase !== 'play' || dropCd > 0) return;
        var lvl = held.level;
        var r = FRUIT[lvl - 1].r;
        spawnFruit(lvl, rt.clamp(held.x, BIN_L + r + 2, BIN_R - r - 2), HOLD_Y, 60);
        addParticles(held.x, HOLD_Y + r * 0.6, FRUIT[lvl - 1].color, 6, 0.6);
        held.level = nextLevel;
        clampHeldX();
        nextLevel = randomDropLevel();
        dropCd = 0.32;
        aimPulse = 1;
        rt.audio.play('blip', 0.45);
        hudDirty = true;
      }

      /* ---------- 合成 ---------- */
      function mergeFruits(a, b) {
        a.dead = true;
        b.dead = true;
        merges += 1;
        var mx = (a.x + b.x) * 0.5;
        var my = (a.y + b.y) * 0.5;
        var lvl = a.level;
        var info = FRUIT[lvl - 1];

        if (rt.time - lastMergeT < 0.85) combo += 1;
        else combo = 1;
        lastMergeT = rt.time;
        comboT = 1.4;
        if (combo > maxCombo) maxCombo = combo;
        var mult = 1 + Math.min(combo - 1, 8) * 0.2;

        if (lvl >= MAX_LEVEL) {
          // 两个西瓜相撞：原地炸开，超高奖励
          var bonus = Math.round(500 * mult);
          addScore(bonus);
          addParticles(mx, my, '#fbbf24', 46, 2.4);
          addParticles(mx, my, '#f43f5e', 26, 2);
          addParticles(mx, my, '#ffffff', 16, 2.2);
          addPopup(mx, my - 30, '双瓜爆炸 +' + bonus, colors.warn);
          shake = 22;
          flash = 0.55;
          rt.audio.play('explode', 0.9);
          rt.audio.play('win', 0.4);
          hudDirty = true;
          return;
        }

        var nl = lvl + 1;
        var nInfo = FRUIT[nl - 1];
        var gained = Math.round(LEVEL_SCORE[nl] * mult);
        addScore(gained);
        unlocked[nl - 1] = true;
        saveDex();
        if (nl > maxLevel) maxLevel = nl;

        spawnFruit(nl, mx, my, -Math.min(260, 120 + lvl * 12));

        addParticles(mx, my, nInfo.color, 10 + nl * 2, 1 + nl * 0.08);
        addParticles(mx, my, '#ffffff', 4, 0.9);
        addPopup(mx, my - nInfo.r - 4, '+' + gained, nInfo.color);
        if (combo >= 2) addPopup(mx, my - nInfo.r - 28, '连击 x' + combo, colors.accent);
        shake = Math.max(shake, nl >= 9 ? 9 : nl >= 6 ? 5 : 2.5);

        rt.audio.play(nl >= 9 ? 'power' : 'merge', nl >= 10 ? 0.85 : 0.6);
        if (nl === MAX_LEVEL) {
          flash = 0.3;
          rt.audio.play('win', 0.35);
        }
        hudDirty = true;
      }

      /* ---------- 物理 ---------- */
      function stepPhysics(h) {
        var i, j;
        for (i = 0; i < fruits.length; i++) {
          var f = fruits[i];
          if (f.dead) continue;
          f.age += h;
          f.vy += GRAV * h;
          f.x += f.vx * h;
          f.y += f.vy * h;
          f.vx *= 0.999;
          f.vy *= 0.999;
          if (f.vx > MAX_SPEED) f.vx = MAX_SPEED;
          else if (f.vx < -MAX_SPEED) f.vx = -MAX_SPEED;
          if (f.vy > MAX_SPEED) f.vy = MAX_SPEED;
        }

        // 箱壁
        for (i = 0; i < fruits.length; i++) {
          var w = fruits[i];
          if (w.dead) continue;
          if (w.x - w.r < BIN_L) {
            w.x = BIN_L + w.r;
            if (w.vx < 0) w.vx = -w.vx * 0.28;
            w.vy *= 0.985;
          } else if (w.x + w.r > BIN_R) {
            w.x = BIN_R - w.r;
            if (w.vx > 0) w.vx = -w.vx * 0.28;
            w.vy *= 0.985;
          }
          if (w.y + w.r > BIN_BOTTOM) {
            w.y = BIN_BOTTOM - w.r;
            if (w.vy > 0) w.vy = -w.vy * 0.18;
            if (Math.abs(w.vy) < 26) w.vy = 0;
            w.vx *= 0.9;
            if (w.y - w.r < BIN_TOP) w.y = BIN_TOP + w.r;
          }
        }

        // 圆-圆碰撞 + 同级合成
        for (var iter = 0; iter < 2; iter++) {
          for (i = 0; i < fruits.length; i++) {
            var a = fruits[i];
            if (a.dead) continue;
            for (j = i + 1; j < fruits.length; j++) {
              var b = fruits[j];
              if (b.dead) continue;
              var dx = b.x - a.x;
              var dy = b.y - a.y;
              var rr = a.r + b.r;
              var d2 = dx * dx + dy * dy;
              if (d2 >= rr * rr) continue;
              if (a.level === b.level) {
                mergeFruits(a, b);
                break;
              }
              var d = Math.sqrt(d2);
              if (d < 0.001) {
                dx = rt.rand(-1, 1);
                dy = -1;
                d = Math.sqrt(dx * dx + dy * dy) || 1;
              }
              var nx = dx / d;
              var ny = dy / d;
              var pen = rr - d;
              var ma = a.r * a.r;
              var mb = b.r * b.r;
              var invA = 1 / ma;
              var invB = 1 / mb;
              var invSum = invA + invB;

              var corr = pen * 0.6;
              a.x -= nx * corr * (invA / invSum);
              a.y -= ny * corr * (invA / invSum);
              b.x += nx * corr * (invB / invSum);
              b.y += ny * corr * (invB / invSum);

              var rvx = b.vx - a.vx;
              var rvy = b.vy - a.vy;
              var vn = rvx * nx + rvy * ny;
              if (vn < 0) {
                var jimp = -(1.08) * vn / invSum;
                a.vx -= jimp * nx * invA;
                a.vy -= jimp * ny * invA;
                b.vx += jimp * nx * invB;
                b.vy += jimp * ny * invB;
                // 切向摩擦，帮助堆叠稳定
                var tx = -ny;
                var ty = nx;
                var vt = rvx * tx + rvy * ty;
                var jt = -(vt / invSum) * 0.18;
                a.vx -= jt * tx * invA;
                a.vy -= jt * ty * invA;
                b.vx += jt * tx * invB;
                b.vy += jt * ty * invB;
              }
            }
          }
        }

        // 清理已合成
        for (i = fruits.length - 1; i >= 0; i--) {
          if (fruits[i].dead) fruits.splice(i, 1);
        }
      }

      /* ---------- 危险判定 ---------- */
      function updateDanger(dt) {
        var top = Infinity;
        for (var i = 0; i < fruits.length; i++) {
          var f = fruits[i];
          if (f.age < 1.1) continue;
          var t = f.y - f.r;
          if (t < top) top = t;
        }
        if (top < DANGER_Y) {
          dangerTimer += dt;
          if (dangerTimer >= 2) gameOver();
        } else {
          dangerTimer = Math.max(0, dangerTimer - dt * 2.4);
        }
      }

      function gameOver() {
        if (phase !== 'play') return;
        phase = 'over';
        overTimer = 0;
        shake = 16;
        flash = 0.6;
        rt.audio.play('explode', 0.85);
        addParticles(W / 2, BIN_TOP + 40, colors.danger, 26, 1.6);
        for (var i = 0; i < fruits.length; i++) {
          if (fruits[i].y - fruits[i].r < DANGER_Y + 30) {
            addParticles(fruits[i].x, fruits[i].y, FRUIT[fruits[i].level - 1].color, 4, 0.9);
          }
        }
        hudDirty = true;
      }

      /* ---------- 更新 ---------- */
      var accum = 0;

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
        if (shake > 0) shake = Math.max(0, shake - dt * 40);
        if (flash > 0) flash = Math.max(0, flash - dt * 2.2);
        if (dropCd > 0) dropCd = Math.max(0, dropCd - dt);
        if (comboT > 0) {
          comboT -= dt;
          if (comboT <= 0) combo = 0;
        }
        if (aimPulse > 0) aimPulse = Math.max(0, aimPulse - dt * 3);
      }

      function updateHeld(dt) {
        var move = 0;
        if (rt.keys.has('ArrowLeft') || rt.keys.has('KeyA')) move -= 1;
        if (rt.keys.has('ArrowRight') || rt.keys.has('KeyD')) move += 1;
        if (move !== 0) {
          mouseActive = false;
          held.x += move * 430 * dt;
        } else if (mouseActive) {
          held.x += (rt.pointer.x - held.x) * Math.min(1, dt * 20);
        }
        clampHeldX();
        held.bob += dt;
        if (rt.wasPressed('Space')) dropFruit();
      }

      function statusNow() {
        if (phase === 'over') return '箱子被水果堆满了…';
        if (dangerTimer > 0.15) return '危险！果堆越过警戒线';
        if (dropCd > 0) return '水果下落中…';
        return '← → / 鼠标瞄准 · 空格 / 点击落果';
      }

      return {
        update: function (dt) {
          timeAlive += dt;
          tickEffects(dt);
          if (hudDirty) {
            hudDirty = false;
            updateHud();
          }
          setStatus(statusNow());

          if (phase === 'over') {
            overTimer += dt;
            if (!ended && overTimer >= 1.15) {
              ended = true;
              var info = FRUIT[maxLevel - 1];
              rt.end({
                score: score,
                message: '最大的水果是 ' + info.emoji + ' ' + info.name + '，果堆漫过了警戒线',
                stats: [
                  { label: '最大水果', value: info.emoji + ' ' + info.name },
                  { label: '合成次数', value: merges },
                  { label: '最高连击', value: 'x' + Math.max(1, maxCombo) },
                  { label: '存活时间', value: timeAlive.toFixed(1) + 's' }
                ]
              });
            }
            return;
          }

          updateHeld(dt);

          accum += dt;
          var guard = 0;
          while (accum >= STEP && guard < 6) {
            stepPhysics(STEP);
            accum -= STEP;
            guard += 1;
          }
          if (guard >= 6) accum = 0;

          updateDanger(dt);
          if (phase !== 'play') return;
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
          drawBin(t);
          drawAimGuide(t);
          drawFruits(t);
          drawHeld(t);
          drawParticles();
          drawPopups();
          ctx.restore();

          drawHud(t);
          drawDex(t);
          drawNextPreview(t);
          drawOverlays(t);
        },

        onPointerMove: function (x) {
          if (Math.abs(x - lastPtrX) > 0.5) {
            mouseActive = true;
            lastPtrX = x;
          }
        },

        onPointerDown: function (x) {
          lastPtrX = x;
          mouseActive = true;
          if (phase === 'play') {
            held.x = rt.clamp(x, BIN_L + heldRadius() + 2, BIN_R - heldRadius() - 2);
            dropFruit();
          }
        },

        destroy: function () {
          fruits.length = 0;
          particles.length = 0;
          popups.length = 0;
        }
      };

      /* ================= 绘制 ================= */
      function ensureGradients() {
        if (bgGrad) return;
        bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, '#0b0a1c');
        bgGrad.addColorStop(0.5, '#120b20');
        bgGrad.addColorStop(1, '#0a1417');

        binGrad = ctx.createLinearGradient(0, BIN_TOP, 0, BIN_BOTTOM);
        binGrad.addColorStop(0, 'rgba(20,16,40,0.5)');
        binGrad.addColorStop(1, 'rgba(10,22,26,0.62)');

        glowGrad = ctx.createRadialGradient(W / 2, 200, 20, W / 2, 200, W * 0.75);
        glowGrad.addColorStop(0, 'rgba(251,113,133,0.16)');
        glowGrad.addColorStop(0.6, 'rgba(34,197,94,0.06)');
        glowGrad.addColorStop(1, 'rgba(34,197,94,0)');

        dangerGrad = ctx.createLinearGradient(0, 0, 0, H);
        dangerGrad.addColorStop(0, 'rgba(244,63,94,0)');
        dangerGrad.addColorStop(0.5, 'rgba(244,63,94,0.05)');
        dangerGrad.addColorStop(1, 'rgba(244,63,94,0.16)');
      }

      function drawBackground(t) {
        ctx.fillStyle = bgGrad;
        ctx.fillRect(-30, -30, W + 60, H + 60);
        ctx.fillStyle = glowGrad;
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = 'rgba(251,113,133,0.06)';
        for (var gy = 24; gy < H; gy += 36) {
          for (var gx = 24; gx < W; gx += 36) {
            ctx.fillRect(gx, gy, 1.6, 1.6);
          }
        }

        // 顶部装饰光带
        var scan = Math.sin(t * 0.7) * 40 + 60;
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = 'rgba(251,113,133,0.1)';
        ctx.fillRect(0, scan, W, 2);
        ctx.globalAlpha = 1;
      }

      function drawBin(t) {
        // 箱体
        ctx.fillStyle = binGrad;
        roundRect(ctx, BIN_L, BIN_TOP, BIN_R - BIN_L, BIN_BOTTOM - BIN_TOP, 18);
        ctx.fill();

        // 霓虹边框
        ctx.save();
        ctx.shadowColor = colors.accent;
        ctx.shadowBlur = 18;
        ctx.strokeStyle = 'rgba(251,113,133,0.55)';
        ctx.lineWidth = 2.4;
        roundRect(ctx, BIN_L, BIN_TOP, BIN_R - BIN_L, BIN_BOTTOM - BIN_TOP, 18);
        ctx.stroke();
        ctx.restore();

        // 内壁高光
        ctx.strokeStyle = 'rgba(34,197,94,0.18)';
        ctx.lineWidth = 1.2;
        roundRect(ctx, BIN_L + 6, BIN_TOP + 6, BIN_R - BIN_L - 12, BIN_BOTTOM - BIN_TOP - 12, 14);
        ctx.stroke();

        // 箱内水印 + 底部纹理
        ctx.globalAlpha = 0.055;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '210px ' + FONT_EMOJI;
        ctx.fillStyle = '#ffffff';
        ctx.fillText('🍉', W / 2, (BIN_TOP + BIN_BOTTOM) / 2 + 24);
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;

        // 箱底刻度
        ctx.strokeStyle = 'rgba(251,113,133,0.12)';
        ctx.lineWidth = 1;
        for (var x = BIN_L + 40; x < BIN_R - 20; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, BIN_BOTTOM - 14);
          ctx.lineTo(x, BIN_BOTTOM - 5);
          ctx.stroke();
        }

        // 警戒线
        var danger = dangerTimer / 2;
        var hot = danger > 0.02;
        ctx.save();
        ctx.setLineDash([10, 8]);
        ctx.lineDashOffset = -t * 24;
        ctx.strokeStyle = hot
          ? 'rgba(244,63,94,' + (0.55 + Math.sin(t * 12) * 0.3).toFixed(3) + ')'
          : 'rgba(148,163,184,0.25)';
        ctx.lineWidth = hot ? 2.2 : 1.4;
        ctx.beginPath();
        ctx.moveTo(BIN_L + 10, DANGER_Y);
        ctx.lineTo(BIN_R - 10, DANGER_Y);
        ctx.stroke();
        ctx.restore();

        ctx.textAlign = 'left';
        ctx.font = '700 11px ' + FONT_UI;
        ctx.fillStyle = hot ? colors.danger : 'rgba(148,163,184,0.55)';
        ctx.fillText('警戒线', BIN_L + 14, DANGER_Y - 8);

        if (hot) {
          // 超过 2 秒判负的进度条
          ctx.fillStyle = 'rgba(244,63,94,0.25)';
          roundRect(ctx, BIN_L + 10, DANGER_Y + 8, (BIN_R - BIN_L) - 20, 5, 3);
          ctx.fill();
          ctx.fillStyle = colors.danger;
          roundRect(ctx, BIN_L + 10, DANGER_Y + 8, Math.max(2, ((BIN_R - BIN_L) - 20) * Math.min(1, danger)), 5, 3);
          ctx.fill();
          ctx.textAlign = 'right';
          ctx.font = '900 13px ' + FONT_NUM;
          ctx.fillStyle = 'rgba(244,63,94,' + (0.65 + Math.sin(t * 10) * 0.35).toFixed(3) + ')';
          ctx.fillText('危险 ' + (2 - dangerTimer).toFixed(1) + 's', BIN_R - 16, DANGER_Y + 28);
        }
      }

      function drawAimGuide(t) {
        if (phase !== 'play') return;
        var x = held.x;
        ctx.save();
        ctx.setLineDash([4, 10]);
        ctx.lineDashOffset = -t * 40;
        ctx.strokeStyle = 'rgba(251,113,133,' + (0.2 + aimPulse * 0.3).toFixed(3) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, HOLD_Y + heldRadius() + 6);
        ctx.lineTo(x, BIN_BOTTOM - 10);
        ctx.stroke();
        ctx.restore();
      }

      function drawFruits(t) {
        for (var i = 0; i < fruits.length; i++) {
          var f = fruits[i];
          if (f.dead) continue;
          drawFruitBody(f, t, 1);
        }
      }

      function drawFruitBody(f, t, alpha) {
        var info = FRUIT[f.level - 1];
        var pop = 1;
        var age = t - f.born;
        if (age < 0.36) pop = 1 + 0.24 * Math.sin((age / 0.36) * Math.PI);

        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.scale(pop, pop);
        ctx.globalAlpha = alpha;

        ctx.globalAlpha = alpha * 0.16;
        ctx.fillStyle = info.color;
        ctx.beginPath();
        ctx.arc(0, 0, f.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha * 0.5;
        ctx.strokeStyle = info.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, f.r - 1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = alpha;

        if (f.level >= 8) {
          ctx.shadowColor = info.color;
          ctx.shadowBlur = f.level >= 10 ? 22 : 14;
        }
        ctx.font = Math.round(f.r * 2.2) + 'px ' + FONT_EMOJI;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(info.emoji, 0, 1);
        ctx.shadowBlur = 0;
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      function drawHeld(t) {
        var bob = Math.sin(t * 4) * 2;
        var f = {
          x: held.x,
          y: HOLD_Y + bob,
          r: heldRadius(),
          level: held.level,
          born: -10
        };
        drawFruitBody(f, t, dropCd > 0 ? 0.5 : 1);

        // 待机提示环
        if (phase === 'play') {
          ctx.strokeStyle = 'rgba(251,113,133,' + (0.18 + Math.sin(t * 5) * 0.1).toFixed(3) + ')';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(held.x, HOLD_Y + bob, heldRadius() + 7 + Math.sin(t * 5) * 1.5, 0, Math.PI * 2);
          ctx.stroke();
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
        ctx.font = '900 18px ' + FONT_NUM;
        for (var i = 0; i < popups.length; i++) {
          var pp = popups[i];
          ctx.globalAlpha = Math.max(0, Math.min(1, pp.life / pp.max));
          ctx.fillStyle = pp.color;
          ctx.fillText(pp.text, pp.x, pp.y);
        }
        ctx.globalAlpha = 1;
      }

      function drawHud(t) {
        // 分数
        ctx.textAlign = 'left';
        ctx.font = '700 10px ' + FONT_NUM;
        ctx.fillStyle = 'rgba(148,163,184,0.9)';
        ctx.fillText('SCORE', BIN_L, 24);
        ctx.font = '900 26px ' + FONT_NUM;
        ctx.fillStyle = colors.text;
        ctx.fillText(String(score), BIN_L, 52);

        ctx.font = '700 10px ' + FONT_NUM;
        ctx.fillStyle = 'rgba(148,163,184,0.7)';
        ctx.fillText('BEST ' + String(rt.best), BIN_L, 70);

        // 图鉴进度
        ctx.textAlign = 'center';
        ctx.font = '700 11px ' + FONT_UI;
        ctx.fillStyle = 'rgba(148,163,184,0.9)';
        ctx.fillText('图鉴', W / 2, 22);
        ctx.font = '900 14px ' + FONT_NUM;
        ctx.fillStyle = colors.accent;
        ctx.fillText(dexCount + ' / ' + MAX_LEVEL, W / 2, 42);

        if (combo >= 2 && comboT > 0) {
          ctx.font = '900 14px ' + FONT_NUM;
          ctx.fillStyle = 'rgba(251,191,36,' + Math.min(1, comboT).toFixed(3) + ')';
          ctx.fillText('COMBO x' + combo, W / 2, 62);
        }
        ctx.textAlign = 'left';
      }

      function drawNextPreview(t) {
        var bx = W - 96;
        var by = 8;
        var size = 62;

        ctx.textAlign = 'center';
        ctx.font = '700 10px ' + FONT_UI;
        ctx.fillStyle = 'rgba(148,163,184,0.9)';
        ctx.fillText('下一颗', bx + size / 2, by + 10);

        ctx.fillStyle = 'rgba(16,14,34,0.8)';
        roundRect(ctx, bx, by + 14, size, size, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(34,197,94,0.45)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        var info = FRUIT[nextLevel - 1];
        ctx.font = Math.round(34) + 'px ' + FONT_EMOJI;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(info.emoji, bx + size / 2, by + 14 + size / 2 + 1);
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
      }

      function drawDex(t) {
        ctx.textAlign = 'left';
        ctx.font = '700 10px ' + FONT_UI;
        ctx.fillStyle = 'rgba(148,163,184,0.75)';
        ctx.fillText('合成图鉴', BIN_L, DEX_Y - 4);

        var slotW = (BIN_R - BIN_L) / MAX_LEVEL;
        for (var i = 0; i < MAX_LEVEL; i++) {
          var cx = BIN_L + slotW * (i + 0.5);
          var cy = DEX_Y + 30;
          var on = unlocked[i];
          var info = FRUIT[i];

          ctx.globalAlpha = on ? 1 : 0.16;
          ctx.fillStyle = 'rgba(16,14,34,0.85)';
          ctx.beginPath();
          ctx.arc(cx, cy, 17, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = on ? info.color : 'rgba(148,163,184,0.6)';
          ctx.lineWidth = on ? 1.6 : 1;
          ctx.stroke();

          ctx.font = '18px ' + FONT_EMOJI;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(info.emoji, cx, cy + 1);
          ctx.textBaseline = 'alphabetic';
          ctx.globalAlpha = 1;
        }
        ctx.textAlign = 'left';
      }

      function drawOverlays(t) {
        if (dangerTimer > 0.15) {
          ctx.globalAlpha = 0.25 + Math.sin(t * 8) * 0.12;
          ctx.fillStyle = dangerGrad;
          ctx.fillRect(0, 0, W, H);
          ctx.globalAlpha = 1;
        }
        if (flash > 0) {
          ctx.fillStyle = 'rgba(251,113,133,' + Math.min(0.4, flash * 0.7).toFixed(3) + ')';
          ctx.fillRect(0, 0, W, H);
        }
        if (phase === 'over') {
          var k = Math.min(1, overTimer / 0.9);
          ctx.fillStyle = 'rgba(6,6,16,' + (0.3 + k * 0.4).toFixed(3) + ')';
          ctx.fillRect(0, 0, W, H);
          ctx.textAlign = 'center';
          ctx.font = '900 30px ' + FONT_UI;
          ctx.fillStyle = 'rgba(244,63,94,' + k.toFixed(3) + ')';
          ctx.fillText('箱子满了', W / 2, H / 2 - 20);
          ctx.font = '700 13px ' + FONT_NUM;
          ctx.fillStyle = 'rgba(232,236,255,' + (0.7 * k).toFixed(3) + ')';
          ctx.fillText('FINAL SCORE ' + score, W / 2, H / 2 + 16);
          ctx.textAlign = 'left';
        }
      }
    }
  });
})();
