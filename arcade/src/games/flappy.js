/* 游戏：像素鸟 —— 重力拍翼 / 视差山谷 / 奖牌挑战 */
(function () {
  'use strict';

  var GROUND_H = 96;
  var PIPE_W = 72;
  var GRAVITY = 1520;
  var FLAP_V = -430;

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

  function hitRect(cx, cy, cr, rx, ry, rw, rh) {
    var nx = Math.max(rx, Math.min(cx, rx + rw));
    var ny = Math.max(ry, Math.min(cy, ry + rh));
    var dx = cx - nx;
    var dy = cy - ny;
    return dx * dx + dy * dy < cr * cr;
  }

  Arcade.register({
    id: 'flappy',
    title: '像素鸟',
    subtitle: '一拍一世界，别撞管子',
    description: '一按一拍翅膀，在霓虹山谷间穿过一根根发光管道。间隙会随分数慢慢收窄，铜牌 10 分、银牌 20 分、金牌 30 分，飞到哪一步？',
    icon: '🐤',
    accent: '#facc15',
    accent2: '#ef4444',
    tags: ['休闲', '挑战'],
    difficulty: '困难',
    width: 480,
    height: 720,
    order: 70,
    tips: '别急着连拍，让鸟落到管道口下沿再拍一下，节奏比手速更重要。',
    controls: [
      { keys: '空格 / ↑ / W', action: '拍翼' },
      { keys: '鼠标 / 触摸点击', action: '拍翼' },
      { keys: 'P / Esc · R', action: '暂停 · 重开' }
    ],

    create: function (rt) {
      var W = rt.width;
      var H = rt.height;
      var GY = H - GROUND_H;
      var BIRD_X = Math.round(W * 0.27);
      var BIRD_START_Y = Math.round(GY * 0.5);

      var colors = rt.colors;
      var state = 'ready';            // ready | playing | dying
      var bird = { x: BIRD_X, y: BIRD_START_Y, vy: 0, rot: 0, wing: 0 };
      var pipes = [];
      var particles = [];
      var stars = [];
      var clouds = [];

      var score = 0;
      var best = rt.best;
      var timeAlive = 0;
      var worldScroll = 0;
      var shake = 0;
      var flash = 0;
      var deathTimer = 0;
      var ended = false;

      var CLOUD_WRAP = W + 260;
      var PIPE_GAP_BASE = 208;
      var PIPE_GAP_MIN = 140;
      var PIPE_SPACING = 232;

      /* ---------- 初始化 ---------- */
      function init() {
        bird.x = BIRD_X;
        bird.y = BIRD_START_Y;
        bird.vy = 0;
        bird.rot = 0;
        bird.wing = 0;

        pipes = [];
        particles = [];
        stars = [];
        clouds = [];

        state = 'ready';
        score = 0;
        best = rt.best;
        timeAlive = 0;
        worldScroll = 0;
        shake = 0;
        flash = 0;
        deathTimer = 0;
        ended = false;

        for (var i = 0; i < 46; i++) {
          stars.push({
            x: rt.rand(0, W),
            y: rt.rand(6, GY * 0.78),
            r: rt.rand(0.6, 1.7),
            ph: rt.rand(0, Math.PI * 2)
          });
        }
        for (var j = 0; j < 7; j++) {
          clouds.push({
            baseX: rt.rand(0, CLOUD_WRAP),
            y: rt.rand(60, GY * 0.5),
            s: rt.rand(0.7, 1.45),
            spd: rt.rand(0.7, 1.35)
          });
        }

        rt.setScore(0);
        rt.setHud({});
        rt.setStatus('');
      }

      function medalOf(s) {
        if (s >= 30) return { name: '金牌', icon: '🥇', color: '#fbbf24', need: 30 };
        if (s >= 20) return { name: '银牌', icon: '🥈', color: '#cbd5e1', need: 20 };
        if (s >= 10) return { name: '铜牌', icon: '🥉', color: '#f97316', need: 10 };
        return null;
      }

      function updateStatus() {
        if (state === 'ready') {
          rt.setStatus('按空格 / 点击开始');
          return;
        }
        if (state !== 'playing') {
          rt.setStatus('');
          return;
        }
        if (score < 10) rt.setStatus('铜牌还差 ' + (10 - score) + ' 分');
        else if (score < 20) rt.setStatus('银牌还差 ' + (20 - score) + ' 分');
        else if (score < 30) rt.setStatus('金牌还差 ' + (30 - score) + ' 分');
        else rt.setStatus('金牌到手 · 继续刷新最高分');
      }

      /* ---------- 动作 ---------- */
      function startGame() {
        state = 'playing';
        timeAlive = 0;
        rt.audio.play('click', 0.6);
        spawnPipe();
        updateStatus();
      }

      function flap() {
        bird.vy = FLAP_V;
        bird.wing = 0;
        bird.rot = -0.45;
        rt.audio.play('jump', 0.55);
        for (var i = 0; i < 3; i++) addFeather(bird.x - 8, bird.y + 4, '#fde68a');
      }

      function tap() {
        if (state === 'ready') {
          startGame();
          flap();
        } else if (state === 'playing') {
          flap();
        }
      }

      function addFeather(x, y, color) {
        if (particles.length > 240) return;
        particles.push({
          x: x + rt.rand(-10, 10),
          y: y + rt.rand(-9, 9),
          vx: rt.rand(-110, 30),
          vy: rt.rand(-80, 50),
          g: 210,
          rot: rt.rand(0, Math.PI * 2),
          vr: rt.rand(-7, 7),
          life: rt.rand(0.45, 1.05),
          max: 1.05,
          w: rt.rand(3, 7),
          h: rt.rand(1.6, 3.4),
          color: color
        });
      }

      function spawnPipe() {
        var gap = Math.max(PIPE_GAP_MIN, PIPE_GAP_BASE - score * 2.6);
        var margin = 76;
        var cy = rt.rand(margin + gap / 2, GY - margin - gap / 2);
        pipes.push({ x: W + 52, gapY: cy, gap: gap, scored: false });
      }

      function pumpScore() {
        score++;
        rt.setScore(score);
        if (score > best) best = score;
        rt.audio.play('pop', 0.75);
        for (var i = 0; i < 4; i++) addFeather(bird.x - 12, bird.y, '#fef08a');
        updateStatus();
      }

      function die() {
        if (state !== 'playing') return;
        state = 'dying';
        deathTimer = 0;
        shake = 14;
        flash = 0.65;
        bird.vy = -300;
        rt.audio.play('hit', 0.9);
        rt.setStatus('');
        for (var i = 0; i < 24; i++) {
          addFeather(bird.x, bird.y, i % 3 === 0 ? '#fef08a' : (i % 3 === 1 ? '#facc15' : '#fb923c'));
        }
      }

      function endGame() {
        var medal = medalOf(score);
        var stats = [
          { label: '奖牌', value: medal ? medal.icon + ' ' + medal.name : '未获得' },
          { label: '通过管道', value: score },
          { label: '最佳成绩', value: Math.max(rt.best, score) },
          { label: '存活时间', value: timeAlive.toFixed(1) + 's' }
        ];
        var message;
        if (medal) {
          message = '获得' + medal.name + '！穿过 ' + score + ' 根管道';
        } else {
          message = '穿过 ' + score + ' 根管道，铜牌还差 ' + (10 - score) + ' 分';
        }
        rt.end({ score: score, message: message, stats: stats });
      }

      /* ---------- 更新 ---------- */
      function updateParticles(dt) {
        for (var i = particles.length - 1; i >= 0; i--) {
          var p = particles[i];
          p.life -= dt;
          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
          p.vy += p.g * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 0.99;
          p.rot += p.vr * dt;
        }
      }

      init();

      return {
        update: function (dt) {
          if (rt.frame <= 1) updateStatus();
          if (shake > 0) shake = Math.max(0, shake - dt * 42);
          if (flash > 0) flash = Math.max(0, flash - dt * 1.8);
          updateParticles(dt);

          if (state === 'ready') {
            timeAlive = 0;
            worldScroll += 26 * dt;
            bird.wing += dt;
            bird.y = BIRD_START_Y + Math.sin(rt.time * 2.6) * 7;
            bird.rot = Math.sin(rt.time * 2.6) * 0.07;
            if (rt.wasPressed('Space') || rt.wasPressed('ArrowUp') || rt.wasPressed('KeyW')) tap();
            return;
          }

          if (state === 'dying') {
            timeAlive += dt;
            deathTimer += dt;
            worldScroll += 18 * dt;
            bird.vy += GRAVITY * 1.1 * dt;
            bird.y += bird.vy * dt;
            bird.rot += 7.2 * dt;
            if (bird.y > GY - 12) {
              bird.y = GY - 12;
              bird.vy = 0;
              bird.rot = 1.45;
            }
            if (deathTimer > 0.78 && !ended) {
              ended = true;
              endGame();
            }
            return;
          }

          /* playing */
          timeAlive += dt;
          bird.wing += dt;
          var speed = 150 + Math.min(96, score * 3.2);
          worldScroll += speed * dt;

          if (rt.wasPressed('Space') || rt.wasPressed('ArrowUp') || rt.wasPressed('KeyW')) tap();

          bird.vy += GRAVITY * dt;
          if (bird.vy > 900) bird.vy = 900;
          bird.y += bird.vy * dt;

          if (bird.y < 16) {
            bird.y = 16;
            if (bird.vy < 0) bird.vy = 80;
          }

          var target = rt.clamp(bird.vy / 700, -0.5, 1.05);
          bird.rot += (target - bird.rot) * Math.min(1, dt * 9);

          if (!pipes.length || pipes[pipes.length - 1].x < W - PIPE_SPACING) spawnPipe();

          for (var i = pipes.length - 1; i >= 0; i--) {
            var p = pipes[i];
            p.x -= speed * dt;
            if (!p.scored && p.x + PIPE_W * 0.5 < bird.x) {
              p.scored = true;
              pumpScore();
            }
            if (p.x + PIPE_W < -60) pipes.splice(i, 1);
          }

          for (var j = 0; j < pipes.length; j++) {
            var q = pipes[j];
            if (q.x > bird.x + 24 || q.x + PIPE_W < bird.x - 24) continue;
            var gapTop = q.gapY - q.gap * 0.5;
            var gapBot = q.gapY + q.gap * 0.5;
            if (hitRect(bird.x, bird.y, 11.5, q.x, -60, PIPE_W, gapTop + 60) ||
                hitRect(bird.x, bird.y, 11.5, q.x, gapBot, PIPE_W, GY - gapBot)) {
              die();
              break;
            }
          }

          if (state === 'playing' && bird.y + 12 >= GY) {
            bird.y = GY - 12;
            die();
          }
        },

        render: function (c) {
          var t = rt.time;
          var sx = shake > 0 ? rt.rand(-shake, shake) : 0;
          var sy = shake > 0 ? rt.rand(-shake, shake) : 0;

          c.save();
          c.translate(sx, sy);

          /* 天空渐变 */
          var sky = c.createLinearGradient(0, 0, 0, GY);
          sky.addColorStop(0, '#060a16');
          sky.addColorStop(0.32, '#101a3a');
          sky.addColorStop(0.6, '#1b2350');
          sky.addColorStop(0.84, '#122a45');
          sky.addColorStop(1, '#0b3a4a');
          c.fillStyle = sky;
          c.fillRect(-30, -30, W + 60, GY + 60);

          /* 星点 */
          for (var i = 0; i < stars.length; i++) {
            var st = stars[i];
            var tw = 0.35 + 0.35 * Math.sin(t * 2.2 + st.ph);
            c.globalAlpha = tw;
            c.fillStyle = '#dbeafe';
            c.beginPath();
            c.arc(st.x, st.y, st.r, 0, Math.PI * 2);
            c.fill();
          }
          c.globalAlpha = 1;

          /* 地平线冷光 */
          var glow = c.createLinearGradient(0, GY - 190, 0, GY);
          glow.addColorStop(0, 'rgba(34, 211, 238, 0)');
          glow.addColorStop(1, 'rgba(34, 211, 238, 0.13)');
          c.fillStyle = glow;
          c.fillRect(0, GY - 190, W, 190);

          /* 云层（视差 0.30） */
          var cshift = (worldScroll * 0.30) % CLOUD_WRAP;
          for (var m = 0; m < clouds.length; m++) {
            var cl = clouds[m];
            var cx = ((cl.baseX - cshift) % CLOUD_WRAP + CLOUD_WRAP) % CLOUD_WRAP - 130;
            if (cx < -150 || cx > W + 150) continue;
            var cs = cl.s;
            c.fillStyle = 'rgba(129, 140, 248, 0.13)';
            c.beginPath();
            c.ellipse(cx, cl.y, 44 * cs, 15 * cs, 0, 0, Math.PI * 2);
            c.ellipse(cx - 30 * cs, cl.y + 5 * cs, 25 * cs, 11 * cs, 0, 0, Math.PI * 2);
            c.ellipse(cx + 31 * cs, cl.y + 4 * cs, 27 * cs, 12 * cs, 0, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = 'rgba(165, 180, 252, 0.09)';
            c.beginPath();
            c.ellipse(cx - 6 * cs, cl.y - 5 * cs, 30 * cs, 9 * cs, 0, 0, Math.PI * 2);
            c.fill();
          }

          /* 远山（视差 0.10） */
          drawMountainLayer(c, (worldScroll * 0.10) % 150, 150, GY - 44, 90, 46, 1.2, '#0d1330', 'rgba(56,189,248,0.20)');

          /* 近山（视差 0.22） */
          drawMountainLayer(c, (worldScroll * 0.22) % 205, 205, GY - 10, 62, 40, 2.3, '#080c1c', 'rgba(34,211,238,0.32)');

          /* 管道 */
          for (var p = 0; p < pipes.length; p++) drawPipe(c, pipes[p]);

          /* 地面 */
          drawGround(c);

          /* 鸟 */
          drawBird(c);

          /* 羽毛粒子 */
          c.lineCap = 'round';
          for (var k = 0; k < particles.length; k++) {
            var pt = particles[k];
            c.globalAlpha = Math.max(0, pt.life / pt.max);
            c.strokeStyle = pt.color;
            c.lineWidth = pt.h;
            var ca = Math.cos(pt.rot);
            var sa = Math.sin(pt.rot);
            c.beginPath();
            c.moveTo(pt.x - pt.w * ca, pt.y - pt.w * sa);
            c.lineTo(pt.x + pt.w * ca, pt.y + pt.w * sa);
            c.stroke();
          }
          c.globalAlpha = 1;
          c.lineCap = 'butt';
          c.lineWidth = 1;

          c.restore();

          /* 顶部压暗，保证分数 / 奖牌进度压在管道上也清晰 */
          var topShade = c.createLinearGradient(0, 0, 0, 150);
          topShade.addColorStop(0, 'rgba(3, 6, 16, 0.62)');
          topShade.addColorStop(1, 'rgba(3, 6, 16, 0)');
          c.fillStyle = topShade;
          c.fillRect(0, 0, W, 150);

          /* 暗角 */
          var vg = c.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.8);
          vg.addColorStop(0, 'rgba(0,0,0,0)');
          vg.addColorStop(1, 'rgba(0,0,0,0.38)');
          c.fillStyle = vg;
          c.fillRect(0, 0, W, H);

          /* 画布内分数 / 奖牌进度 */
          c.textAlign = 'left';
          c.font = '700 10px "Consolas", monospace';
          c.fillStyle = 'rgba(148, 163, 184, 0.75)';
          c.fillText('BEST ' + Math.max(rt.best, score), 18, 30);

          if (state === 'ready') {
            drawReady(c, t);
          } else {
            c.textAlign = 'center';
            c.font = '900 52px "Consolas", monospace';
            c.fillStyle = '#ffffff';
            c.shadowColor = 'rgba(250, 204, 21, 0.85)';
            c.shadowBlur = 20;
            c.fillText(String(score), W / 2, 88);
            c.shadowBlur = 0;

            var next = score < 10 ? 10 : score < 20 ? 20 : score < 30 ? 30 : 0;
            if (next) {
              var prev = next - 10;
              var pr = rt.clamp((score - prev) / (next - prev), 0, 1);
              var barW = 148;
              var barX = W / 2 - barW / 2;
              var barY = 106;
              c.fillStyle = 'rgba(255,255,255,0.14)';
              roundRect(c, barX, barY, barW, 7, 3.5);
              c.fill();
              var mc = next === 10 ? '#f97316' : (next === 20 ? '#cbd5e1' : '#fbbf24');
              var mn = next === 10 ? '铜牌' : (next === 20 ? '银牌' : '金牌');
              /* 奖牌徽章：绶带 + 圆牌，小尺寸下也能一眼认出 */
              var mbX = barX - 16;
              var mbY = barY + 3.5;
              c.fillStyle = mc;
              c.fillRect(mbX - 5, mbY - 12, 4, 7);
              c.fillRect(mbX + 1, mbY - 12, 4, 7);
              c.beginPath();
              c.arc(mbX, mbY, 8, 0, Math.PI * 2);
              c.fill();
              c.fillStyle = 'rgba(0,0,0,0.30)';
              c.beginPath();
              c.arc(mbX, mbY, 5, 0, Math.PI * 2);
              c.fill();
              c.fillStyle = mc;
              c.beginPath();
              c.arc(mbX, mbY, 3, 0, Math.PI * 2);
              c.fill();
              /* 进度条 */
              c.fillStyle = 'rgba(255,255,255,0.14)';
              roundRect(c, barX, barY, barW, 7, 3.5);
              c.fill();
              c.fillStyle = mc;
              roundRect(c, barX, barY, Math.max(4, barW * pr), 7, 3.5);
              c.fill();
              c.font = '700 10px "PingFang SC", "Microsoft YaHei", sans-serif';
              c.fillStyle = 'rgba(203, 213, 225, 0.82)';
              c.fillText(mn + '还差 ' + (next - score) + ' 分', W / 2, barY + 23);
            } else {
              c.textAlign = 'center';
              c.font = '700 11px "PingFang SC", "Microsoft YaHei", sans-serif';
              c.fillStyle = 'rgba(251, 191, 36, 0.9)';
              c.fillText('🥇 金牌已到手', W / 2, 128);
            }
          }

          /* 受击闪白 */
          if (flash > 0) {
            c.fillStyle = 'rgba(255, 236, 179, ' + (flash * 0.4).toFixed(3) + ')';
            c.fillRect(0, 0, W, H);
          }
        },

        onPointerDown: function () {
          tap();
        }
      };

      /* ---------- 绘制工具（闭包内；函数声明会提升，上面的 return 对象可安全引用） ---------- */
      function drawMountainLayer(c, off, step, baseY, amp, freq, phase, fill, ridge) {
        var i, x, h;
        c.beginPath();
        c.moveTo(-step - off, baseY);
        for (i = -1; i <= Math.ceil(W / step) + 2; i++) {
          x = i * step - off;
          h = amp * (0.55 + 0.45 * Math.sin(i * freq + phase));
          c.lineTo(x + step * 0.5, baseY - h);
          c.lineTo(x + step, baseY);
        }
        c.lineTo(W + step * 2, GY + 10);
        c.lineTo(-step - off, GY + 10);
        c.closePath();
        c.fillStyle = fill;
        c.fill();

        c.beginPath();
        for (i = -1; i <= Math.ceil(W / step) + 2; i++) {
          x = i * step - off;
          h = amp * (0.55 + 0.45 * Math.sin(i * freq + phase));
          if (i === -1) c.moveTo(x + step * 0.5, baseY - h);
          else c.lineTo(x + step * 0.5, baseY - h);
        }
        c.strokeStyle = ridge;
        c.lineWidth = 1.5;
        c.stroke();
      }

      function drawPipeBody(c, x, y, h) {
        if (h <= 0) return;
        c.fillStyle = 'rgba(34, 211, 238, 0.07)';
        c.fillRect(x - 9, y, PIPE_W + 18, h);
        var g = c.createLinearGradient(x, 0, x + PIPE_W, 0);
        g.addColorStop(0, '#0c4a5a');
        g.addColorStop(0.18, '#22d3ee');
        g.addColorStop(0.46, '#0891b2');
        g.addColorStop(0.78, '#0e7490');
        g.addColorStop(1, '#083344');
        c.fillStyle = g;
        c.fillRect(x, y, PIPE_W, h);
        c.fillStyle = 'rgba(255,255,255,0.20)';
        c.fillRect(x + 9, y, 5, h);
        c.fillStyle = 'rgba(0,0,0,0.22)';
        c.fillRect(x + PIPE_W - 12, y, 4, h);
        c.strokeStyle = 'rgba(103, 232, 249, 0.5)';
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(x + 0.75, y);
        c.lineTo(x + 0.75, y + h);
        c.moveTo(x + PIPE_W - 0.75, y);
        c.lineTo(x + PIPE_W - 0.75, y + h);
        c.stroke();
      }

      function drawPipeCap(c, x, y, h) {
        var w = PIPE_W + 14;
        var cx = x - 7;
        var g = c.createLinearGradient(cx, 0, cx + w, 0);
        g.addColorStop(0, '#0c4a5a');
        g.addColorStop(0.16, '#67e8f9');
        g.addColorStop(0.45, '#22d3ee');
        g.addColorStop(0.8, '#0e7490');
        g.addColorStop(1, '#083344');
        c.fillStyle = g;
        c.fillRect(cx, y, w, h);
        c.fillStyle = 'rgba(255,255,255,0.25)';
        c.fillRect(cx + 3, y + (h > 20 ? 3 : 0), w - 6, 3);
        c.strokeStyle = 'rgba(165, 243, 252, 0.75)';
        c.lineWidth = 1.5;
        c.strokeRect(cx + 0.75, y + 0.75, w - 1.5, h - 1.5);
      }

      function drawPipe(c, p) {
        var gapTop = p.gapY - p.gap * 0.5;
        var gapBot = p.gapY + p.gap * 0.5;
        drawPipeBody(c, p.x, 0, gapTop - 26);
        drawPipeCap(c, p.x, gapTop - 26, 26);
        drawPipeBody(c, p.x, gapBot, GY - gapBot - 26);
        drawPipeCap(c, p.x, gapBot, 26);
      }

      function drawGround(c) {
        var g = c.createLinearGradient(0, GY, 0, H);
        g.addColorStop(0, '#141d36');
        g.addColorStop(0.35, '#0d1425');
        g.addColorStop(1, '#070a14');
        c.fillStyle = g;
        c.fillRect(0, GY, W, H - GY);

        c.save();
        c.shadowColor = '#22d3ee';
        c.shadowBlur = 14;
        c.strokeStyle = 'rgba(34, 211, 238, 0.8)';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(0, GY + 1);
        c.lineTo(W, GY + 1);
        c.stroke();
        c.restore();

        var off = worldScroll % 44;
        for (var x = -off - 44; x < W + 44; x += 44) {
          c.fillStyle = 'rgba(34, 211, 238, 0.075)';
          c.beginPath();
          c.moveTo(x, GY + 12);
          c.lineTo(x + 15, GY + 12);
          c.lineTo(x + 6, GY + 50);
          c.lineTo(x - 9, GY + 50);
          c.closePath();
          c.fill();
        }

        var off2 = (worldScroll * 1.0) % 62;
        for (var i = -1; i < 10; i++) {
          var gx = i * 62 - off2;
          c.fillStyle = 'rgba(52, 211, 153, 0.42)';
          c.beginPath();
          c.moveTo(gx, GY + 2);
          c.lineTo(gx + 7, GY + 2);
          c.lineTo(gx + 3.5, GY - 9);
          c.closePath();
          c.fill();
        }

        c.fillStyle = 'rgba(255,255,255,0.05)';
        for (var k = 0; k < 5; k++) {
          c.fillRect(0, GY + 64 + k * 8, W, 1);
        }
      }

      function drawBird(c) {
        var wingPhase = Math.sin(Math.min(bird.wing, 0.4) * 26) * 0.7 * Math.max(0, 1 - bird.wing / 0.4);
        if (state === 'ready') wingPhase = Math.sin(rt.time * 5) * 0.25;

        c.save();
        c.translate(bird.x, bird.y);
        c.rotate(bird.rot);

        /* 尾羽 */
        c.fillStyle = '#f59e0b';
        c.strokeStyle = 'rgba(80, 40, 6, 0.55)';
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(-14, -3);
        c.lineTo(-25, -9);
        c.lineTo(-22, 4);
        c.closePath();
        c.fill();
        c.stroke();

        /* 身体 */
        var bg = c.createLinearGradient(0, -15, 0, 15);
        bg.addColorStop(0, '#fef9c3');
        bg.addColorStop(0.5, '#fde047');
        bg.addColorStop(1, '#f59e0b');
        c.fillStyle = bg;
        c.shadowColor = '#facc15';
        c.shadowBlur = 16;
        c.beginPath();
        c.ellipse(0, 0, 17.5, 13.5, 0, 0, Math.PI * 2);
        c.fill();
        c.shadowBlur = 0;
        c.strokeStyle = 'rgba(69, 26, 3, 0.55)';
        c.lineWidth = 2;
        c.stroke();

        /* 肚皮 */
        c.fillStyle = 'rgba(255, 251, 235, 0.8)';
        c.beginPath();
        c.ellipse(2, 5, 10.5, 6.5, 0, 0, Math.PI * 2);
        c.fill();

        /* 翅膀 */
        c.save();
        c.translate(-3, 1);
        c.rotate(wingPhase * 0.55);
        c.fillStyle = '#fde68a';
        c.strokeStyle = 'rgba(120, 53, 15, 0.55)';
        c.lineWidth = 1.5;
        c.beginPath();
        c.ellipse(0, 3.5, 11, 6.5, 0.18, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.restore();

        /* 眼睛 */
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(7.5, -5, 5.2, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#111827';
        c.beginPath();
        c.arc(9, -5, 2.5, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(9.9, -6.2, 0.9, 0, Math.PI * 2);
        c.fill();

        /* 喙 */
        c.fillStyle = '#fb923c';
        c.strokeStyle = 'rgba(120, 53, 15, 0.5)';
        c.lineWidth = 1.4;
        c.beginPath();
        c.moveTo(12, -1);
        c.lineTo(26, 3.5);
        c.lineTo(12, 7.5);
        c.closePath();
        c.fill();
        c.stroke();

        /* 呆毛 */
        c.strokeStyle = '#fbbf24';
        c.lineWidth = 2.6;
        c.beginPath();
        c.moveTo(-1, -13);
        c.quadraticCurveTo(1, -20, 6, -18);
        c.stroke();

        c.restore();
      }

      function drawReady(c, t) {
        var pulse = 0.5 + 0.5 * Math.sin(t * 4.2);

        c.fillStyle = 'rgba(6, 10, 22, 0.6)';
        roundRect(c, W / 2 - 152, 116, 304, 146, 16);
        c.fill();
        c.strokeStyle = 'rgba(250, 204, 21, ' + (0.28 + pulse * 0.16).toFixed(3) + ')';
        c.lineWidth = 1.5;
        c.stroke();

        c.textAlign = 'center';
        c.font = '900 24px "Consolas", monospace';
        c.fillStyle = '#facc15';
        c.shadowColor = 'rgba(250, 204, 21, 0.9)';
        c.shadowBlur = 20;
        c.fillText('FLAPPY NEON', W / 2, 156);
        c.shadowBlur = 0;

        c.font = '600 16px "PingFang SC", "Microsoft YaHei", sans-serif';
        c.fillStyle = 'rgba(232, 236, 255, 0.95)';
        c.fillText('按空格 / 点击开始', W / 2, 192);

        c.font = '600 12px "PingFang SC", "Microsoft YaHei", sans-serif';
        c.fillStyle = 'rgba(139, 149, 181, ' + (0.55 + pulse * 0.4).toFixed(3) + ')';
        c.fillText('一拍一世界，别撞管子', W / 2, 219);

        c.font = '600 11px "PingFang SC", "Microsoft YaHei", sans-serif';
        c.fillStyle = 'rgba(148, 163, 184, 0.7)';
        c.fillText('铜牌 10 · 银牌 20 · 金牌 30', W / 2, 245);
      }
    }
  });
})();
