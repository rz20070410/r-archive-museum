/* 游戏：三重同步 —— 三层旋转环，依次在缺口对齐时锁定 */
(function () {
  'use strict';

  var TAU = Math.PI * 2;

  function norm(a) {
    while (a < 0) a += TAU;
    while (a >= TAU) a -= TAU;
    return a;
  }

  Arcade.register({
    id: 'syncrings',
    title: '三重同步',
    subtitle: '在缺口对齐的瞬间锁定',
    description: '三层异速旋转的圆环，每层只有一个缺口。高亮环转到顶端时按下，把三层依次锁定。越往后速度越快，容错越低。',
    icon: '◉',
    accent: '#c4b5fd',
    accent2: '#6d28d9',
    tags: ['街机', '挑战'],
    difficulty: '困难',
    width: 640,
    height: 640,
    order: 91,
    tips: '看最外圈的高亮缺口，不要同时追三圈；按下去的瞬间以高亮环为准。',
    controls: [
      { keys: '空格 / 点击', action: '锁定当前环' },
      { keys: 'R', action: '重新开始' }
    ],

    create: function (rt) {
      var W = rt.width, H = rt.height;
      var cx = W / 2, cy = H / 2 - 16;
      var rings = [];
      var active = 0;
      var lives = 3;
      var level = 1;
      var locks = 0;
      var score = 0;
      var time = 0;
      var ended = false;
      var flash = 0;
      var missFlash = 0;
      var particles = [];
      var lastPointer = 0;

      function buildRings() {
        rings = [];
        var radii = [92, 154, 218];
        var colors = ['#f5f5f7', '#a5b4fc', '#67e8f9'];
        for (var i = 0; i < 3; i++) {
          var gapW = Math.max(0.25, 0.52 - level * 0.022);
          rings.push({
            r: radii[i],
            angle: rt.rand(0, TAU),
            speed: (i % 2 ? -1 : 1) * (0.9 + level * 0.14 + i * 0.35),
            gap: gapW,
            color: colors[i],
            w: 7 - i * 1.4
          });
        }
        active = 0;
      }

      function resetLevel() {
        locks = 0;
        buildRings();
      }

      function tryLock() {
        if (ended) return;
        var ring = rings[active];
        var pointer = -Math.PI / 2;
        var diff = Math.abs(norm(ring.angle - pointer + Math.PI) - Math.PI);
        if (diff < ring.gap * 0.58) {
          locks++;
          score += 120 + level * 30;
          rt.audio.play('level', 0.5);
          flash = 0.3;
          for (var i = 0; i < 14; i++) {
            var a = rt.rand(0, TAU), r = ring.r;
            particles.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: Math.cos(a) * rt.rand(30, 100), vy: Math.sin(a) * rt.rand(30, 100), life: 0.7, color: ring.color });
          }
          if (locks >= 3) {
            level++;
            score += 300;
            resetLevel();
            rt.setHud({ '等级': level, '生命': '●'.repeat(lives), '锁定': '0 / 3' });
          } else {
            active++;
            rt.setHud({ '等级': level, '生命': '●'.repeat(lives), '锁定': locks + ' / 3' });
          }
        } else {
          lives--;
          missFlash = 0.5;
          rt.audio.play('error', 0.6);
          if (lives <= 0) finish(false);
          else rt.setHud({ '等级': level, '生命': '●'.repeat(lives), '锁定': locks + ' / 3' });
        }
      }

      function finish(win) {
        if (ended) return;
        ended = true;
        rt.end({
          won: win,
          score: score,
          message: win ? '三重同步完成。' : '同步失败，节奏散架了。',
          stats: [
            { label: '等级', value: level },
            { label: '锁定', value: locks + ' / 3' },
            { label: '生存', value: time.toFixed(1) + 's' }
          ]
        });
      }

      buildRings();
      rt.setScore(0);
      rt.setHud({ '等级': 1, '生命': '●●●', '锁定': '0 / 3' });
      rt.setStatus('空格 / 点击：在缺口对齐时锁定');

      return {
        update: function (dt) {
          if (ended) return;
          time += dt;
          for (var i = 0; i < rings.length; i++) rings[i].angle = norm(rings[i].angle + rings[i].speed * dt);
          if ((rt.pointer.clicked || rt.wasPressed('Space')) && time - lastPointer > 0.15) {
            lastPointer = time;
            tryLock();
          }
          for (var p = particles.length - 1; p >= 0; p--) {
            var q = particles[p];
            q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.98; q.vy *= 0.98; q.life -= dt;
            if (q.life <= 0) particles.splice(p, 1);
          }
          if (flash > 0) flash = Math.max(0, flash - dt);
          if (missFlash > 0) missFlash = Math.max(0, missFlash - dt);
          rt.setScore(score);
        },

        render: function (c) {
          c.fillStyle = '#05040a';
          c.fillRect(0, 0, W, H);
          var bg = c.createRadialGradient(cx, cy, 20, cx, cy, 360);
          bg.addColorStop(0, 'rgba(109,40,217,0.16)');
          bg.addColorStop(0.55, 'rgba(196,181,253,0.04)');
          bg.addColorStop(1, 'rgba(5,4,10,0)');
          c.fillStyle = bg;
          c.fillRect(0, 0, W, H);

          c.strokeStyle = 'rgba(255,255,255,0.06)';
          c.lineWidth = 1;
          for (var g = 0; g < 3; g++) {
            c.beginPath();
            c.arc(cx, cy, [92, 154, 218][g], 0, TAU);
            c.stroke();
          }

          var pointer = -Math.PI / 2;
          c.strokeStyle = 'rgba(255,255,255,' + (0.2 + flash * 0.5) + ')';
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(cx, cy - 250);
          c.lineTo(cx, cy - 70);
          c.stroke();

          for (var i = 0; i < rings.length; i++) {
            var ring = rings[i];
            var isActive = i === active;
            c.lineWidth = ring.w;
            c.strokeStyle = ring.color;
            c.globalAlpha = isActive ? 1 : 0.3;
            c.beginPath();
            c.arc(cx, cy, ring.r, ring.angle + ring.gap / 2, ring.angle + TAU - ring.gap / 2);
            c.stroke();
            c.globalAlpha = 1;
            if (isActive) {
              c.strokeStyle = 'rgba(255,255,255,0.9)';
              c.lineWidth = 2;
              c.beginPath();
              c.arc(cx, cy, ring.r + 11, -Math.PI / 2 - ring.gap * 0.58, -Math.PI / 2 + ring.gap * 0.58);
              c.stroke();
              var tipX = cx + Math.cos(ring.angle) * ring.r;
              var tipY = cy + Math.sin(ring.angle) * ring.r;
              c.beginPath();
              c.arc(tipX, tipY, 5, 0, TAU);
              c.fillStyle = '#fff';
              c.shadowColor = ring.color;
              c.shadowBlur = 20;
              c.fill();
              c.shadowBlur = 0;
            }
          }

          c.beginPath();
          c.arc(cx, cy, 44, 0, TAU);
          c.fillStyle = 'rgba(255,255,255,0.05)';
          c.fill();
          c.strokeStyle = 'rgba(255,255,255,0.22)';
          c.lineWidth = 1;
          c.stroke();
          c.fillStyle = '#f5f5f7';
          c.font = '650 30px "Consolas", monospace';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(String(level).padStart(2, '0'), cx, cy);
          c.font = '8px "Consolas", monospace';
          c.fillStyle = 'rgba(255,255,255,0.4)';
          c.fillText('LEVEL', cx, cy + 24);

          for (var p = 0; p < particles.length; p++) {
            var q = particles[p];
            c.globalAlpha = Math.max(0, q.life);
            c.fillStyle = q.color;
            c.fillRect(q.x, q.y, 2, 2);
          }
          c.globalAlpha = 1;

          c.textAlign = 'left';
          c.textBaseline = 'alphabetic';
          c.font = '600 10px "Consolas", monospace';
          c.fillStyle = 'rgba(255,255,255,0.36)';
          c.fillText('SYNC RINGS / THREE LAYERS', 34, 36);
          c.fillText('LIVES ' + '●'.repeat(Math.max(0, lives)) + '○'.repeat(Math.max(0, 3 - lives)), W - 140, 36);

          if (flash > 0) {
            c.fillStyle = 'rgba(255,255,255,' + flash * 0.12 + ')';
            c.fillRect(0, 0, W, H);
          }
          if (missFlash > 0) {
            c.fillStyle = 'rgba(255,80,120,' + missFlash * 0.16 + ')';
            c.fillRect(0, 0, W, H);
          }
          if (time < 3) {
            c.textAlign = 'center';
            c.font = '600 13px "PingFang SC", "Microsoft YaHei", sans-serif';
            c.fillStyle = 'rgba(245,245,247,' + (1 - time / 3) * 0.8 + ')';
            c.fillText('三层缺口都对准顶端的瞬间依次按下', cx, H - 30);
          }
        }
      };
    }
  });
})();
