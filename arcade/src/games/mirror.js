/* 游戏：镜像双生 —— 同时操控左右两个镜像体抵达出口 */
(function () {
  'use strict';
  var N = 11;

  Arcade.register({
    id: 'mirror',
    title: '镜像双生',
    subtitle: '一步同时走两个自己',
    description: '你操控左边的「实」与右边的「镜」，它们永远左右对称。两块身体共享方向键，任何一方撞墙都会同时停下。让两个自己分别抵达左下与右下的出口。',
    icon: '🪞',
    accent: '#e9d5ff',
    accent2: '#7e22ce',
    tags: ['益智', '挑战'],
    difficulty: '困难',
    width: 640,
    height: 640,
    order: 92,
    tips: '先让两个自己一起向下，再左右调整；任何一边被墙卡住，整步都会作废。',
    controls: [
      { keys: '方向键 / WASD', action: '同时移动两个镜像体' },
      { keys: 'R', action: '重新开始' }
    ],

    create: function (rt) {
      var W = rt.width, H = rt.height;
      var CELL = Math.floor(Math.min(W, H) * 0.76 / N);
      var BX = Math.round((W - CELL * N) / 2);
      var BY = Math.round((H - CELL * N) / 2 + 8);
      var walls = new Uint8Array(N * N);
      var ax = 1, ay = 1, bx = N - 2, by = 1;
      var exitA = { x: 1, y: N - 2 };
      var exitB = { x: N - 2, y: N - 2 };
      var moves = 0;
      var maxMoves = 34;
      var time = 0;
      var ended = false;
      var won = false;
      var flash = 0;
      var trail = [];
      var particles = [];

      function i(x, y) { return y * N + x; }
      function wall(x, y) {
        if (x < 0 || y < 0 || x >= N || y >= N) return true;
        return walls[i(x, y)] === 1;
      }
      function mirrorX(x) { return N - 1 - x; }

      function addWall(x, y) {
        walls[i(x, y)] = 1;
        walls[i(mirrorX(x), y)] = 1;
      }

      /* 外框 + 对称障碍 */
      for (var t = 0; t < N; t++) {
        walls[i(t, 0)] = 1; walls[i(t, N - 1)] = 1;
        walls[i(0, t)] = 1; walls[i(N - 1, t)] = 1;
      }
      [[2, 1], [3, 1], [4, 3], [4, 4], [5, 3], [6, 5], [7, 3], [7, 4], [8, 1], [3, 5], [6, 4], [2, 5]].forEach(function (p) { addWall(p[0], p[1]); });
      walls[i(5, 5)] = 0;
      walls[i(1, 1)] = 0; walls[i(N - 2, 1)] = 0;
      walls[i(exitA.x, exitA.y)] = 0; walls[i(exitB.x, exitB.y)] = 0;

      function step(dx, dy) {
        if (ended) return;
        var nx = ax + dx, ny = ay + dy;
        var mx = mirrorX(nx), my = ny;
        if (wall(nx, ny) || wall(mx, my)) {
          flash = 0.25;
          rt.audio.play('error', 0.18);
          return;
        }
        ax = nx; ay = ny; bx = mx; by = my;
        moves++;
        trail.push([ax, ay, bx, by]);
        if (trail.length > 20) trail.shift();
        rt.audio.play('step', 0.3);
        if (ax === exitA.x && ay === exitA.y && bx === exitB.x && by === exitB.y) finish(true);
        else if (moves >= maxMoves) finish(false);
      }

      function finish(win) {
        if (ended) return;
        ended = true; won = win;
        var score = win ? Math.max(120, 900 - moves * 12 - Math.round(time * 3)) : 0;
        rt.end({
          won: win,
          score: score,
          message: win ? '两个自己都到达了出口。' : '步数耗尽，镜像停在了原地。',
          stats: [
            { label: '步数', value: moves + ' / ' + maxMoves },
            { label: '用时', value: time.toFixed(1) + 's' }
          ]
        });
      }

      rt.setScore(0);
      rt.setHud({ '步数': '0 / ' + maxMoves, '用时': '0s' });
      rt.setStatus('方向键同时移动两个镜像体');

      return {
        update: function (dt) {
          if (ended) return;
          time += dt;
          if (rt.wasPressed('ArrowLeft') || rt.wasPressed('KeyA')) step(-1, 0);
          else if (rt.wasPressed('ArrowRight') || rt.wasPressed('KeyD')) step(1, 0);
          else if (rt.wasPressed('ArrowUp') || rt.wasPressed('KeyW')) step(0, -1);
          else if (rt.wasPressed('ArrowDown') || rt.wasPressed('KeyS')) step(0, 1);
          if (flash > 0) flash = Math.max(0, flash - dt);
          for (var p = particles.length - 1; p >= 0; p--) {
            particles[p].life -= dt;
            if (particles[p].life <= 0) particles.splice(p, 1);
          }
          rt.setScore(won ? 800 : moves * 10);
          rt.setHud({ '步数': moves + ' / ' + maxMoves, '用时': Math.round(time) + 's' });
          if (time > 90) finish(false);
        },

        render: function (c) {
          c.fillStyle = '#060409';
          c.fillRect(0, 0, W, H);
          var bg = c.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * 0.65);
          bg.addColorStop(0, 'rgba(126,34,206,0.15)');
          bg.addColorStop(1, 'rgba(6,4,9,0)');
          c.fillStyle = bg;
          c.fillRect(0, 0, W, H);

          c.strokeStyle = 'rgba(233,213,255,0.14)';
          c.setLineDash([3, 10]);
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(BX + CELL * N / 2, BY);
          c.lineTo(BX + CELL * N / 2, BY + CELL * N);
          c.stroke();
          c.setLineDash([]);

          for (var y = 0; y < N; y++) {
            for (var x = 0; x < N; x++) {
              var px = BX + x * CELL, py = BY + y * CELL;
              if (walls[i(x, y)]) {
                c.fillStyle = 'rgba(233,213,255,0.12)';
                c.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
                c.strokeStyle = 'rgba(233,213,255,0.34)';
                c.lineWidth = 1;
                c.strokeRect(px + 1.5, py + 1.5, CELL - 3, CELL - 3);
              } else {
                c.strokeStyle = 'rgba(255,255,255,0.035)';
                c.lineWidth = 1;
                c.strokeRect(px + 0.5, py + 0.5, CELL - 1, CELL - 1);
              }
            }
          }

          function drawExit(p, color) {
            var x = BX + p.x * CELL + CELL / 2, y = BY + p.y * CELL + CELL / 2;
            c.beginPath();
            c.arc(x, y, CELL * 0.30, 0, 6.2832);
            c.strokeStyle = color;
            c.lineWidth = 2;
            c.shadowColor = color;
            c.shadowBlur = 14;
            c.stroke();
            c.shadowBlur = 0;
          }
          drawExit(exitA, '#67e8f9');
          drawExit(exitB, '#f0abfc');

          for (var t = 0; t < trail.length; t++) {
            var q = trail[t];
            c.globalAlpha = (t / trail.length) * 0.14;
            c.fillStyle = '#e9d5ff';
            c.fillRect(BX + q[0] * CELL + CELL * 0.36, BY + q[1] * CELL + CELL * 0.36, CELL * 0.28, CELL * 0.28);
            c.fillRect(BX + q[2] * CELL + CELL * 0.36, BY + q[3] * CELL + CELL * 0.36, CELL * 0.28, CELL * 0.28);
          }
          c.globalAlpha = 1;

          function dot(x, y, color, glow) {
            var cx = BX + x * CELL + CELL / 2, cy = BY + y * CELL + CELL / 2;
            c.beginPath();
            c.arc(cx, cy, CELL * 0.27, 0, 6.2832);
            c.fillStyle = color;
            c.shadowColor = color;
            c.shadowBlur = glow ? 20 : 6;
            c.fill();
            c.shadowBlur = 0;
          }
          dot(ax, ay, '#e9d5ff', true);
          dot(bx, by, '#a78bfa', false);

          c.fillStyle = 'rgba(255,255,255,0.34)';
          c.font = '600 10px "Consolas", monospace';
          c.fillText('MIRROR TWIN / SHARED INPUT', BX, BY - 14);
          c.fillText('MOVES ' + moves + ' / ' + maxMoves, BX + CELL * N - 120, BY - 14);

          if (flash > 0) {
            c.fillStyle = 'rgba(255,80,120,' + flash * 0.2 + ')';
            c.fillRect(BX, BY, CELL * N, CELL * N);
          }
          if (time < 3.5) {
            c.fillStyle = 'rgba(233,213,255,' + (1 - time / 3.5) * 0.65 + ')';
            c.font = '600 13px "PingFang SC", "Microsoft YaHei", sans-serif';
            c.textAlign = 'center';
            c.fillText('两个自己同步移动，任何一边撞墙都会停下', W / 2, BY + CELL * N + 24);
          }
        }
      };
    }
  });
})();
