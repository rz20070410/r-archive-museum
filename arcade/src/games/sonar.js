/* 游戏：声呐迷宫 —— 隐藏迷宫，靠声呐脉冲探路 */
(function () {
  'use strict';
  var N = 13;

  function rrect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  Arcade.register({
    id: 'sonar',
    title: '声呐迷宫',
    subtitle: '看不见墙，只听见回声',
    description: '迷宫完全隐藏在黑暗里。每走一步都可能是墙，只能靠声呐脉冲短暂照亮周围。找到右下角出口，用最少的脉冲逃出去。',
    icon: '📡',
    accent: '#67e8f9',
    accent2: '#0e7490',
    tags: ['益智', '挑战'],
    difficulty: '困难',
    width: 640,
    height: 640,
    order: 90,
    tips: '声呐会同时照亮周围八格以外的墙，先原地脉冲一次再决定第一步。',
    controls: [
      { keys: '方向键 / WASD', action: '移动' },
      { keys: '空格 / 点击', action: '发出声呐' },
      { keys: 'R', action: '重新生成迷宫' }
    ],

    create: function (rt) {
      var W = rt.width, H = rt.height;
      var PAD = Math.round(Math.min(W, H) * 0.07);
      var CELL = Math.floor((Math.min(W, H) - PAD * 2) / N);
      var BX = Math.round((W - CELL * N) / 2);
      var BY = Math.round((H - CELL * N) / 2 + 6);
      var map = new Uint8Array(N * N);
      var reveal = new Float32Array(N * N);
      var px = 1, py = 1;
      var exitX = N - 2, exitY = N - 2;
      var pulses = 3;
      var used = 0;
      var cooldown = 0;
      var wave = 0;
      var time = 0;
      var won = false;
      var ended = false;
      var started = false;
      var trail = [];
      var flash = 0;
      var lastMove = 0;

      function idx(x, y) { return y * N + x; }

      function generate() {
        map.fill(1);
        var stack = [[1, 1]];
        map[idx(1, 1)] = 0;
        var dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]];
        while (stack.length) {
          var cur = stack[stack.length - 1];
          var choices = [];
          for (var d = 0; d < 4; d++) {
            var nx = cur[0] + dirs[d][0], ny = cur[1] + dirs[d][1];
            if (nx > 0 && ny > 0 && nx < N - 1 && ny < N - 1 && map[idx(nx, ny)] === 1) {
              choices.push([nx, ny, cur[0] + dirs[d][0] / 2, cur[1] + dirs[d][1] / 2]);
            }
          }
          if (!choices.length) { stack.pop(); continue; }
          var c = choices[(Math.random() * choices.length) | 0];
          map[idx(c[2], c[3])] = 0;
          map[idx(c[0], c[1])] = 0;
          stack.push([c[0], c[1]]);
        }
        map[idx(exitX, exitY)] = 0;
      }

      function pulse() {
        if (pulses <= 0 || cooldown > 0) {
          rt.audio.play('error', 0.25);
          return;
        }
        pulses--; used++; cooldown = 3.2; wave = 1;
        flash = 0.5;
        var r = 5;
        for (var y = py - r; y <= py + r; y++) {
          for (var x = px - r; x <= px + r; x++) {
            if (x < 0 || y < 0 || x >= N || y >= N) continue;
            var dist = Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));
            if (dist <= r) reveal[idx(x, y)] = Math.max(reveal[idx(x, y)], 2.6 - dist * 0.2);
          }
        }
        rt.audio.play('power', 0.5);
      }

      function move(dx, dy) {
        if (ended) return;
        var nx = px + dx, ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) return;
        if (map[idx(nx, ny)] === 1) {
          rt.audio.play('error', 0.18);
          flash = 0.18;
          return;
        }
        px = nx; py = ny;
        lastMove = 0.12;
        trail.push([nx, ny]);
        if (trail.length > 26) trail.shift();
        rt.audio.play('step', 0.3);
        if (px === exitX && py === exitY) finish(true);
      }

      function finish(win) {
        if (ended) return;
        ended = true; won = win;
        var score = win ? Math.max(100, 1400 - Math.round(time * 4) - used * 45) : 0;
        rt.end({
          won: win,
          score: score,
          message: win ? '你听见了出口。' : '时间耗尽，迷宫重新归于黑暗。',
          stats: [
            { label: '用时', value: time.toFixed(1) + 's' },
            { label: '声呐', value: used + ' 次' },
            { label: '步数', value: trail.length }
          ]
        });
      }

      generate();
      rt.setScore(0);
      rt.setHud({ '声呐': '● ● ●', '用时': '0s' });
      rt.setStatus('点击 / 空格发出声呐，方向键移动');

      return {
        update: function (dt) {
          if (ended) return;
          time += dt;
          if (rt.pointer.clicked) { started = true; pulse(); }
          else if (rt.wasPressed('Space')) { started = true; pulse(); }
          if (rt.wasPressed('ArrowLeft') || rt.wasPressed('KeyA')) move(-1, 0);
          if (rt.wasPressed('ArrowRight') || rt.wasPressed('KeyD')) move(1, 0);
          if (rt.wasPressed('ArrowUp') || rt.wasPressed('KeyW')) move(0, -1);
          if (rt.wasPressed('ArrowDown') || rt.wasPressed('KeyS')) move(0, 1);
          for (var i = 0; i < reveal.length; i++) if (reveal[i] > 0) reveal[i] = Math.max(0, reveal[i] - dt);
          if (cooldown > 0) cooldown = Math.max(0, cooldown - dt);
          if (wave > 0) wave = Math.max(0, wave - dt * 1.6);
          if (flash > 0) flash = Math.max(0, flash - dt * 2);
          if (time > 120) finish(false);
          rt.setScore(won ? 100 : Math.max(0, Math.round(1000 - time * 5 - used * 20)));
          var pips = '● '.repeat(pulses) + '○ '.repeat(Math.max(0, 3 - pulses));
          rt.setHud({ '声呐': pips.trim(), '用时': Math.round(time) + 's', '步数': trail.length });
          if (time > 110) rt.setStatus('最后十秒。');
        },

        render: function (c) {
          c.fillStyle = '#03060a';
          c.fillRect(0, 0, W, H);
          var grd = c.createRadialGradient(px * CELL + BX + CELL / 2, py * CELL + BY + CELL / 2, 10, px * CELL + BX + CELL / 2, py * CELL + BY + CELL / 2, CELL * 7);
          grd.addColorStop(0, 'rgba(103,232,249,0.10)');
          grd.addColorStop(1, 'rgba(3,6,10,0)');
          c.fillStyle = grd;
          c.fillRect(0, 0, W, H);

          for (var y = 0; y < N; y++) {
            for (var x = 0; x < N; x++) {
              var i = idx(x, y);
              var dist = Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));
              var visible = reveal[i] > 0 || dist < 1.25;
              if (!visible) continue;
              var alpha = Math.min(1, reveal[i] * 0.85 + (dist < 1.4 ? 0.25 : 0));
              if (map[i] === 1) {
                c.fillStyle = 'rgba(185,240,255,' + (alpha * 0.22) + ')';
                c.fillRect(BX + x * CELL + 2, BY + y * CELL + 2, CELL - 4, CELL - 4);
                c.strokeStyle = 'rgba(103,232,249,' + alpha + ')';
                c.lineWidth = 1.4;
                c.strokeRect(BX + x * CELL + 2.5, BY + y * CELL + 2.5, CELL - 5, CELL - 5);
              } else {
                c.fillStyle = 'rgba(255,255,255,' + (alpha * 0.035) + ')';
                c.fillRect(BX + x * CELL, BY + y * CELL, CELL, CELL);
              }
            }
          }

          var ex = BX + exitX * CELL + CELL / 2, ey = BY + exitY * CELL + CELL / 2;
          var pulse = 0.6 + Math.sin(rt.time * 3) * 0.25;
          c.beginPath();
          c.arc(ex, ey, CELL * 0.38, 0, 6.2832);
          c.fillStyle = 'rgba(74,222,128,' + (0.16 + pulse * 0.12) + ')';
          c.fill();
          c.strokeStyle = 'rgba(74,222,128,' + pulse + ')';
          c.lineWidth = 2;
          c.stroke();

          for (var t = 0; t < trail.length; t++) {
            var pt = trail[t];
            c.fillStyle = 'rgba(103,232,249,' + (0.04 + t / trail.length * 0.16) + ')';
            c.beginPath();
            c.arc(BX + pt[0] * CELL + CELL / 2, BY + pt[1] * CELL + CELL / 2, CELL * 0.10, 0, 6.2832);
            c.fill();
          }

          if (wave > 0) {
            c.beginPath();
            c.arc(BX + px * CELL + CELL / 2, BY + py * CELL + CELL / 2, (1 - wave) * CELL * 5.5 + CELL, 0, 6.2832);
            c.strokeStyle = 'rgba(103,232,249,' + (wave * 0.55) + ')';
            c.lineWidth = 2;
            c.stroke();
          }

          c.beginPath();
          c.arc(BX + px * CELL + CELL / 2, BY + py * CELL + CELL / 2, CELL * 0.30, 0, 6.2832);
          c.fillStyle = '#e0fbff';
          c.shadowColor = '#67e8f9';
          c.shadowBlur = 18;
          c.fill();
          c.shadowBlur = 0;

          c.strokeStyle = 'rgba(103,232,249,0.22)';
          c.lineWidth = 1;
          c.strokeRect(BX - 4, BY - 4, CELL * N + 8, CELL * N + 8);

          c.fillStyle = 'rgba(255,255,255,0.32)';
          c.font = '600 10px "Consolas", monospace';
          c.fillText('SONAR MAZE / 13×13', BX, BY - 14);
          c.fillText('PULSES ' + pulses + ' / 3', BX + CELL * N - 92, BY - 14);

          if (rt.time < 4) {
            c.fillStyle = 'rgba(224,251,255,' + (1 - rt.time / 4) * 0.65 + ')';
            c.font = '600 13px "PingFang SC", "Microsoft YaHei", sans-serif';
            c.textAlign = 'center';
            c.fillText('点击或按空格发声呐，方向键移动', W / 2, BY + CELL * N + 22);
            c.textAlign = 'left';
          }
        }
      };
    }
  });
})();
