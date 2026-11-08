/* 游戏：贪吃蛇 —— 参考实现（其他游戏请遵循同样的结构与风格） */
(function () {
  'use strict';

  var COLS = 24;
  var ROWS = 18;
  var CELL = 26;
  var OX = (720 - COLS * CELL) / 2;
  var OY = (540 - ROWS * CELL) / 2;

  Arcade.register({
    id: 'snake',
    title: '贪吃蛇',
    subtitle: '吃得越多，越长越危险',
    description: '经典街机玩法，方向键控制小蛇吃豆长大。别撞墙、别咬到自己，金色豆子能一口气加 50 分。',
    icon: '🐍',
    accent: '#34d399',
    accent2: '#0ea5e9',
    tags: ['街机', '经典'],
    difficulty: '简单',
    width: 720,
    height: 540,
    order: 10,
    tips: '转弯前先想好下一步，贴边蛇行最安全。金色豆子会消失，看到就冲！',
    controls: [
      { keys: '↑ ↓ ← → / WASD', action: '控制方向' },
      { keys: 'P / Esc', action: '暂停' },
      { keys: 'R', action: '重新开始' }
    ],

    create: function (rt) {
      var ctx;
      var colors = rt.colors;
      var snake = [];
      var dir = { x: 1, y: 0 };
      var queue = [];
      var food = null;
      var stepTimer = 0;
      var interval = 0.16;
      var score = 0;
      var eaten = 0;
      var level = 1;
      var alive = true;
      var ended = false;
      var deathTimer = 0;
      var shake = 0;
      var flash = 0;
      var particles = [];
      var popups = [];
      var goldenClock = 0;
      var foodBirth = 0;
      var timeAlive = 0;
      var started = false;

      function cellAt(cx, cy) {
        return { x: OX + cx * CELL, y: OY + cy * CELL };
      }

      function freeCell() {
        var occupied = {};
        for (var i = 0; i < snake.length; i++) occupied[snake[i].x + ',' + snake[i].y] = true;
        if (food) occupied[food.x + ',' + food.y] = true;
        var tries = 0;
        while (tries++ < 500) {
          var cx = rt.randInt(0, COLS - 1);
          var cy = rt.randInt(0, ROWS - 1);
          if (!occupied[cx + ',' + cy]) return { x: cx, y: cy };
        }
        for (var y = 0; y < ROWS; y++) {
          for (var x = 0; x < COLS; x++) {
            if (!occupied[x + ',' + y]) return { x: x, y: y };
          }
        }
        return { x: 0, y: 0 };
      }

      function spawnFood(golden) {
        var c = freeCell();
        food = {
          x: c.x,
          y: c.y,
          golden: !!golden,
          life: golden ? 9 : Infinity,
          born: rt.time
        };
        foodBirth = rt.time;
      }

      function reset() {
        snake = [
          { x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }, { x: 5, y: 9 }
        ];
        dir = { x: 1, y: 0 };
        queue = [];
        stepTimer = 0;
        interval = 0.16;
        score = 0;
        eaten = 0;
        level = 1;
        alive = true;
        ended = false;
        deathTimer = 0;
        shake = 0;
        flash = 0;
        particles = [];
        popups = [];
        timeAlive = 0;
        started = false;
        spawnFood(false);
        rt.setScore(0);
        rt.setHud({ 长度: snake.length, 等级: 1 });
        rt.setStatus('方向键 / WASD 转向');
      }

      function addParticles(px, py, color, count, power) {
        for (var i = 0; i < count; i++) {
          var a = rt.rand(0, Math.PI * 2);
          var sp = rt.rand(40, 160) * (power || 1);
          particles.push({
            x: px, y: py,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            life: rt.rand(0.35, 0.8),
            max: 0.8,
            r: rt.rand(2, 5),
            color: color
          });
        }
        if (particles.length > 260) particles.splice(0, particles.length - 260);
      }

      function addPopup(px, py, text, color) {
        popups.push({ x: px, y: py, text: text, color: color, life: 0.9, max: 0.9 });
      }

      function die() {
        if (!alive) return;
        alive = false;
        deathTimer = 0;
        shake = 12;
        flash = 0.5;
        Arcade.audio.play('explode');
        var head = snake[0] || { x: 0, y: 0 };
        var pos = cellAt(head.x, head.y);
        addParticles(pos.x + CELL / 2, pos.y + CELL / 2, colors.danger, 40, 2);
        rt.setStatus('');
      }

      function step() {
        if (queue.length) {
          var next = queue.shift();
          if (next.x !== -dir.x || next.y !== -dir.y) dir = next;
        }
        var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
          die();
          return;
        }
        for (var i = 0; i < snake.length - 1; i++) {
          if (snake[i].x === head.x && snake[i].y === head.y) {
            die();
            return;
          }
        }
        snake.unshift(head);
        var ate = food && head.x === food.x && head.y === food.y;
        if (ate) {
          var gained = food.golden ? 50 : 10;
          score += gained;
          eaten++;
          rt.setScore(score);
          Arcade.audio.play(food.golden ? 'power' : 'eat');
          var pos = cellAt(food.x, food.y);
          addParticles(pos.x + CELL / 2, pos.y + CELL / 2, food.golden ? colors.warn : colors.accent, food.golden ? 26 : 16, food.golden ? 1.6 : 1);
          addPopup(pos.x + CELL / 2, pos.y, '+' + gained, food.golden ? colors.warn : colors.accent);
          shake = food.golden ? 6 : 2;
          if (food.golden) {
            // 金色豆子额外长 2 节
            var tail = snake[snake.length - 1];
            snake.push({ x: tail.x, y: tail.y });
            snake.push({ x: tail.x, y: tail.y });
          }
          var newLevel = Math.floor(eaten / 5) + 1;
          if (newLevel !== level) {
            level = newLevel;
            interval = Math.max(0.062, 0.16 - (level - 1) * 0.011);
            rt.setHud({ 长度: snake.length, 等级: level });
            rt.setStatus('等级 ' + level + ' · 速度提升！');
            Arcade.audio.play('level');
            addPopup(360, 240, 'LEVEL ' + level, colors.accent2);
          }
          spawnFood(false);
          if (eaten % 4 === 0 && !food.golden) {
            // 让金色豆子稍后出现
            goldenClock = rt.rand(1.6, 3.2);
          }
        } else {
          snake.pop();
        }
        rt.setHud({ 长度: snake.length, 等级: level });
      }

      rt.onCleanup(function () { /* 无外部监听需要清理 */ });

      reset();

      return {
        update: function (dt) {
          timeAlive += dt;
          if (shake > 0) shake = Math.max(0, shake - dt * 40);
          if (flash > 0) flash = Math.max(0, flash - dt * 1.6);

          for (var i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.life -= dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.94;
            p.vy *= 0.94;
            p.vy += 120 * dt;
            if (p.life <= 0) particles.splice(i, 1);
          }
          for (var j = popups.length - 1; j >= 0; j--) {
            var t = popups[j];
            t.life -= dt;
            t.y -= 34 * dt;
            if (t.life <= 0) popups.splice(j, 1);
          }

          if (!alive) {
            deathTimer += dt;
            if (deathTimer > 0.62 && !ended) {
              ended = true;
              rt.end({
                score: score,
                message: '撞上了！小蛇长度 ' + snake.length + ' 节',
                stats: [
                  { label: '吃到豆子', value: eaten },
                  { label: '最终长度', value: snake.length },
                  { label: '到达等级', value: level },
                  { label: '存活时间', value: timeAlive.toFixed(1) + 's' }
                ]
              });
            }
            return;
          }

          // 金色豆子计时
          if (!food) { spawnFood(false); return; }
          if (food.golden) {
            food.life -= dt;
            if (food.life <= 0) {
              var pos = cellAt(food.x, food.y);
              addParticles(pos.x + CELL / 2, pos.y + CELL / 2, colors.warn, 8, 0.6);
              spawnFood(false);
              rt.setStatus('金色豆子溜走了…');
            }
          } else if (goldenClock > 0) {
            goldenClock -= dt;
            if (goldenClock <= 0) {
              spawnFood(true);
              rt.setStatus('金色豆子出现！');
              Arcade.audio.play('power', 0.45);
            }
          }

          stepTimer += dt;
          var guard = 0;
          while (stepTimer >= interval && alive && guard++ < 4) {
            stepTimer -= interval;
            step();
          }
        },

        render: function (c) {
          ctx = c;
          var t = rt.time;
          var sx = shake > 0 ? rt.rand(-shake, shake) : 0;
          var sy = shake > 0 ? rt.rand(-shake, shake) : 0;

          ctx.save();
          ctx.translate(sx, sy);

          // 背景
          var bg = ctx.createLinearGradient(0, 0, 720, 540);
          bg.addColorStop(0, '#0a1020');
          bg.addColorStop(0.55, '#0b1524');
          bg.addColorStop(1, '#091a1a');
          ctx.fillStyle = bg;
          ctx.fillRect(-20, -20, 780, 600);

          // 网格点
          ctx.fillStyle = 'rgba(120, 200, 190, 0.10)';
          for (var gx = 0; gx <= COLS; gx++) {
            for (var gy = 0; gy <= ROWS; gy++) {
              ctx.beginPath();
              ctx.arc(OX + gx * CELL, OY + gy * CELL, 1.4, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // 场地边框
          ctx.save();
          ctx.shadowColor = colors.accent;
          ctx.shadowBlur = 18;
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.55)';
          ctx.lineWidth = 2;
          roundRect(ctx, OX - 8, OY - 8, COLS * CELL + 16, ROWS * CELL + 16, 14);
          ctx.stroke();
          ctx.restore();

          ctx.fillStyle = 'rgba(6, 18, 22, 0.55)';
          roundRect(ctx, OX - 4, OY - 4, COLS * CELL + 8, ROWS * CELL + 8, 12);
          ctx.fill();

          // 食物
          if (food) {
            var fp = cellAt(food.x, food.y);
            var pulse = 1 + Math.sin(t * 6) * 0.08;
            var fx = fp.x + CELL / 2;
            var fy = fp.y + CELL / 2;
            var radius = CELL * 0.31 * pulse;
            ctx.save();
            ctx.shadowColor = food.golden ? colors.warn : colors.danger;
            ctx.shadowBlur = food.golden ? 26 : 16;
            ctx.beginPath();
            ctx.arc(fx, fy, radius, 0, Math.PI * 2);
            var fgrad = ctx.createRadialGradient(fx - radius * 0.3, fy - radius * 0.35, 1, fx, fy, radius);
            if (food.golden) {
              fgrad.addColorStop(0, '#fff7cc');
              fgrad.addColorStop(0.5, '#fbbf24');
              fgrad.addColorStop(1, '#d97706');
            } else {
              fgrad.addColorStop(0, '#ffd1dc');
              fgrad.addColorStop(0.45, '#fb7185');
              fgrad.addColorStop(1, '#be123c');
            }
            ctx.fillStyle = fgrad;
            ctx.fill();
            ctx.restore();
            // 小叶子
            ctx.fillStyle = food.golden ? '#fde68a' : '#4ade80';
            ctx.beginPath();
            ctx.ellipse(fx + 2, fy - radius - 1, 4, 2.2, -0.5, 0, Math.PI * 2);
            ctx.fill();
          }

          // 蛇身
          for (var s = snake.length - 1; s >= 0; s--) {
            var seg = snake[s];
            var sp = cellAt(seg.x, seg.y);
            var ratio = s / Math.max(1, snake.length - 1);
            var size = CELL - 4 - ratio * 3;
            var pad = (CELL - size) / 2;
            var x = sp.x + pad;
            var y = sp.y + pad;
            ctx.beginPath();
            var grad = ctx.createLinearGradient(x, y, x + size, y + size);
            grad.addColorStop(0, s === 0 ? '#a7f3d0' : '#34d399');
            grad.addColorStop(1, s === 0 ? '#34d399' : '#059669');
            ctx.fillStyle = grad;
            if (s === 0) {
              ctx.shadowColor = colors.accent;
              ctx.shadowBlur = 22;
            } else {
              ctx.shadowBlur = 0;
            }
            roundRect(ctx, x, y, size, size, size * 0.3);
            ctx.fill();
            ctx.shadowBlur = 0;
            // 鳞片高光
            if (s % 2 === 0) {
              ctx.fillStyle = 'rgba(255,255,255,0.16)';
              roundRect(ctx, x + size * 0.22, y + size * 0.2, size * 0.3, size * 0.2, 3);
              ctx.fill();
            }
            // 眼睛
            if (s === 0) {
              var ex = sp.x + CELL / 2;
              var ey = sp.y + CELL / 2;
              var ox = dir.x * 6;
              var oy = dir.y * 6;
              var px = Math.abs(dir.y) * 5;
              var py = Math.abs(dir.x) * 5;
              ctx.fillStyle = '#042f1f';
              ctx.beginPath();
              ctx.arc(ex + ox - px, ey + oy - py, 2.6, 0, Math.PI * 2);
              ctx.arc(ex + ox + px, ey + oy + py, 2.6, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#ecfdf5';
              ctx.beginPath();
              ctx.arc(ex + ox - px - 0.8, ey + oy - py - 0.8, 1, 0, Math.PI * 2);
              ctx.arc(ex + ox + px - 0.8, ey + oy + py - 0.8, 1, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // 粒子
          for (var k = 0; k < particles.length; k++) {
            var pt = particles[k];
            ctx.globalAlpha = Math.max(0, pt.life / pt.max);
            ctx.fillStyle = pt.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;

          // 飘字
          ctx.textAlign = 'center';
          ctx.font = '900 20px "Consolas", monospace';
          for (var m = 0; m < popups.length; m++) {
            var pp = popups[m];
            ctx.globalAlpha = Math.max(0, pp.life / pp.max);
            ctx.fillStyle = pp.color;
            ctx.fillText(pp.text, pp.x, pp.y);
          }
          ctx.globalAlpha = 1;

          // 死亡闪光
          if (flash > 0) {
            ctx.fillStyle = 'rgba(244, 63, 94, ' + (flash * 0.45).toFixed(3) + ')';
            ctx.fillRect(-20, -20, 780, 600);
          }

          // 顶部装饰文字
          ctx.textAlign = 'left';
          ctx.font = '700 12px "Consolas", monospace';
          ctx.fillStyle = 'rgba(148, 233, 210, 0.6)';
          ctx.fillText('NEON SNAKE / ' + COLS + '×' + ROWS, OX - 2, OY - 22);
          ctx.textAlign = 'right';
          ctx.fillText('SPEED ' + (1 / interval).toFixed(1) + '/s', OX + COLS * CELL + 2, OY - 22);
          ctx.restore();
        },

        onKeyDown: function (code) {
          if (!alive) return;
          var map = {
            ArrowUp: { x: 0, y: -1 }, KeyW: { x: 0, y: -1 },
            ArrowDown: { x: 0, y: 1 }, KeyS: { x: 0, y: 1 },
            ArrowLeft: { x: -1, y: 0 }, KeyA: { x: -1, y: 0 },
            ArrowRight: { x: 1, y: 0 }, KeyD: { x: 1, y: 0 }
          };
          var d = map[code];
          if (!d) return;
          var last = queue.length ? queue[queue.length - 1] : dir;
          if (d.x === -last.x && d.y === -last.y) return;
          if (d.x === last.x && d.y === last.y) return;
          if (queue.length < 3) {
            queue.push(d);
            started = true;
            Arcade.audio.play('step', 0.5);
          }
        }
      };
    }
  });

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
})();
