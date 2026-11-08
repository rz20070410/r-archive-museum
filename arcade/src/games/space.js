/* 游戏：太空射击 —— 孤舰深入星海 */
(function () {
  'use strict';

  var FONT_UI = '"PingFang SC", "Microsoft YaHei", sans-serif';
  var FONT_NUM = '"Consolas", monospace';

  var ENEMY = {
    grunt: { w: 30, h: 26, hp: 1, score: 25, color: '#fb7185' },
    gunner: { w: 38, h: 30, hp: 3, score: 45, color: '#f472b6' },
    elite: { w: 56, h: 42, hp: 9, score: 160, color: '#fbbf24' },
    boss: { w: 168, h: 96, hp: 70, score: 2000, color: '#ec4899' }
  };

  var POWER = {
    spread: { char: '散', color: '#22d3ee', name: '散射火力' },
    shield: { char: '盾', color: '#818cf8', name: '能量护盾' },
    life: { char: '心', color: '#f43f5e', name: '增援僚机' },
    bomb: { char: '弹', color: '#fbbf24', name: '清屏炸弹' }
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
    id: 'space',
    title: '太空射击',
    subtitle: '孤舰深入星海，火力全开',
    description: '驾驶孤舰穿过三层视差星海，用弹幕撕开敌机编队。每五波迎来 Boss，散射、护盾、炸弹与增援决定你能飞多远。',
    icon: '🚀',
    accent: '#818cf8',
    accent2: '#ec4899',
    tags: ['街机', '挑战'],
    difficulty: '困难',
    width: 720,
    height: 540,
    order: 40,
    tips: 'Boss 的扇形弹幕有固定节奏，贴着屏幕下缘小幅横向移动最省命。',
    controls: [
      { keys: '← → / A D', action: '移动战机' },
      { keys: '鼠标 / 触摸', action: '拖动战机' },
      { keys: '空格', action: '加速射击' },
      { keys: 'X / Shift', action: '释放炸弹' }
    ],

    create: function (rt) {
      var colors = rt.colors;

      /* ---------- 布局 ---------- */
      var W = rt.width;
      var H = rt.height;
      var PLAYER_Y = H - 62;
      var PLAYER_SPEED = 440;
      var PLAYER_HIT_R = 12;
      var MAX_PARTICLES = 280;
      var MAX_ENEMY_BULLETS = 130;

      var FIRE_INTERVAL = 0.118;
      var FIRE_INTERVAL_FAST = 0.074;
      var BULLET_SPEED = 660;

      var WEAPON = [
        [{ ox: 0, ang: 0 }],
        [{ ox: -8, ang: 0 }, { ox: 8, ang: 0 }],
        [{ ox: -12, ang: -0.13 }, { ox: 0, ang: 0 }, { ox: 12, ang: 0.13 }]
      ];

      /* ---------- 状态 ---------- */
      var ctx = null;
      var bgGrad = null;
      var nebulaA = null;
      var nebulaB = null;
      var planetGrad = null;

      var phase = 'playing';
      var score = 0;
      var wave = 0;
      var lives = 3;
      var bombs = 1;
      var weaponLv = 1;
      var kills = 0;
      var shotsFired = 0;
      var shotsHit = 0;
      var maxWave = 1;
      var timeAlive = 0;
      var overTimer = 0;
      var ended = false;
      var hudDirty = true;
      var statusText = '';

      var shake = 0;
      var flash = 0;
      var flashRGB = '244,63,94';

      var player = { x: W / 2, y: PLAYER_Y, vx: 0, bank: 0 };
      var mouseActive = true;
      var lastPtrX = W / 2;
      var invT = 1.6;          // 开局短暂无敌，避免一上来就被打
      var shieldT = 0;
      var fireT = 0;
      var engineT = 0;
      var hitSoundT = 0;

      var waveClearing = false;
      var waveDelay = 0;
      var boss = null;
      var banner = null;

      var enemies = [];
      var playerBullets = [];
      var enemyBullets = [];
      var powerups = [];
      var particles = [];
      var popups = [];
      var stars = [[], [], []];

      /* ================= 初始化 ================= */
      (function initStars() {
        var specs = [
          { n: 70, minS: 0.8, maxS: 1.4, speed: 14, alpha: 0.36, colors: ['#8b95b5'] },
          { n: 44, minS: 1.2, maxS: 2.0, speed: 38, alpha: 0.62, colors: ['#c7d2fe', '#a5b4fc'] },
          { n: 22, minS: 1.8, maxS: 2.8, speed: 88, alpha: 0.95, colors: ['#ffffff', '#bae6fd', '#f9a8d4'] }
        ];
        for (var l = 0; l < 3; l++) {
          var sp = specs[l];
          for (var i = 0; i < sp.n; i++) {
            stars[l].push({
              x: rt.rand(0, W),
              y: rt.rand(0, H),
              s: rt.rand(sp.minS, sp.maxS),
              sp: sp.speed * rt.rand(0.75, 1.35),
              a: sp.alpha * rt.rand(0.6, 1),
              tw: rt.rand(0, Math.PI * 2),
              col: rt.pick(sp.colors)
            });
          }
        }
      })();

      startWave(1, true);

      /* ================= 工具 ================= */
      function setStatus(text) {
        if (text === statusText) return;
        statusText = text;
        rt.setStatus(text);
      }

      function pad2(n) {
        return n < 10 ? '0' + n : String(n);
      }

      function updateHud() {
        var hearts = '';
        var i;
        for (i = 0; i < lives; i++) hearts += '♥';
        if (!hearts) hearts = '—';
        var bombStr = '';
        for (i = 0; i < bombs; i++) bombStr += '✦';
        if (!bombStr) bombStr = '—';
        rt.setHud({
          波次: wave,
          生命: hearts,
          火力: 'Lv' + weaponLv,
          炸弹: bombStr
        });
      }

      function addScore(n) {
        score += n;
        rt.setScore(score);
      }

      function addParticles(x, y, color, count, power) {
        var room = MAX_PARTICLES - particles.length;
        if (room <= 0) return;
        if (count > room) count = room;
        for (var i = 0; i < count; i++) {
          var a = rt.rand(0, Math.PI * 2);
          var sp = rt.rand(40, 230) * (power || 1);
          particles.push({
            x: x, y: y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            life: rt.rand(0.26, 0.72),
            max: 0.72,
            size: rt.rand(1.8, 4.2),
            color: color,
            grav: rt.rand(20, 90)
          });
        }
      }

      function addPopup(x, y, text, color) {
        if (popups.length > 20) popups.shift();
        popups.push({ x: x, y: y, vy: -42, text: text, color: color, life: 0.9, max: 0.9 });
      }

      /* ================= 敌机 / 波次 ================= */
      function addEnemy(type, x, y, delay, targetY) {
        var cfg = ENEMY[type];
        var hp = cfg.hp;
        if (type === 'grunt') hp = 1 + Math.floor(wave / 8);
        else if (type === 'gunner') hp = 3 + Math.floor(wave / 5);
        else if (type === 'elite') hp = 9 + wave;
        enemies.push({
          type: type,
          x: x, y: y,
          w: cfg.w, h: cfg.h,
          hp: hp, maxHp: hp,
          color: cfg.color,
          score: cfg.score,
          delay: delay,
          age: 0,
          targetY: targetY,
          drift: rt.rand(26, 54),
          phase: rt.rand(0, Math.PI * 2),
          fireT: rt.rand(1.8, 3.0),
          hitFlash: 0,
          vx: type === 'elite' ? (x < W * 0.5 ? 76 : -76) : 0,
          vy: 0,
          dead: false
        });
      }

      function spawnBoss(n) {
        var hp = 70 + wave * 14;
        boss = {
          type: 'boss',
          x: W / 2,
          y: -110,
          w: ENEMY.boss.w,
          h: ENEMY.boss.h,
          hp: hp, maxHp: hp,
          color: ENEMY.boss.color,
          score: 2000 + wave * 120,
          delay: 0,
          age: 0,
          targetY: 124,
          drift: 0,
          phase: 0,
          fireT: 2.2,
          pattern: 0,
          spin: 0,
          enterT: 0,
          hitFlash: 0,
          vx: 0, vy: 0,
          dead: false
        };
        enemies.push(boss);
      }

      function startWave(n, prewarm) {
        wave = n;
        if (n > maxWave) maxWave = n;
        waveClearing = false;
        waveDelay = 0;
        boss = null;
        hudDirty = true;

        var bossWave = n % 5 === 0;
        if (bossWave) {
          spawnBoss(n);
          banner = {
            title: 'BOSS 来袭',
            sub: '第 ' + n + ' 波 · 击破核心',
            life: 2.1, max: 2.1, color: '#ec4899'
          };
          rt.audio.play('level', 0.75);
          return;
        }

        var count = Math.min(11, 4 + Math.ceil(n * 0.6));
        var cols = 5;
        for (var i = 0; i < count; i++) {
          var col = i % cols;
          var row = Math.floor(i / cols);
          var x = W * 0.5 + (col - 2) * 100 + (row % 2) * 26;
          var y = prewarm ? 54 + row * 56 : -46 - row * 56 - (i % cols) * 5;
          var delay = prewarm ? 0 : 0.1 + i * 0.13;
          var type = 'grunt';
          if (n >= 2 && (i + n) % 4 === 0) type = 'gunner';
          if (n >= 4 && i === 2) type = 'elite';
          addEnemy(type, x, y, delay, 102 + row * 52);
        }

        banner = {
          title: '第 ' + n + ' 波',
          sub: '敌机 ' + count + ' 架 · 保持移动',
          life: 1.7, max: 1.7, color: colors.accent
        };
        rt.audio.play(n === 1 ? 'blip' : 'click', 0.5);
      }

      function waveComplete() {
        waveClearing = true;
        waveDelay = 1.9;
        var bonus = 80 * wave;
        addScore(bonus);
        banner = {
          title: '第 ' + wave + ' 波 完成',
          sub: '波次奖励 +' + bonus,
          life: 1.5, max: 1.5, color: colors.success
        };
        rt.audio.play('power', 0.5);
        hudDirty = true;
      }

      function enemyBulletSpeed() {
        return Math.min(340, 188 + wave * 6 + timeAlive * 1.4);
      }

      function enemyFireInterval(e) {
        var base = e.type === 'elite' ? 1.5 : Math.max(0.62, 2.1 - wave * 0.05);
        return base * Math.max(0.55, 1 - timeAlive * 0.004);
      }

      function fireEnemyBullet(x, y, ang, sp, color, r) {
        if (enemyBullets.length >= MAX_ENEMY_BULLETS) return;
        enemyBullets.push({
          x: x, y: y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          r: r || 4,
          color: color || '#fb7185'
        });
      }

      function fireAimed(e, count, spread, color) {
        var base = Math.atan2(player.y - e.y, player.x - e.x);
        var sp = enemyBulletSpeed();
        for (var k = 0; k < count; k++) {
          var ang = base + (k - (count - 1) / 2) * spread;
          fireEnemyBullet(e.x + Math.cos(ang) * e.h * 0.3, e.y + e.h * 0.3, ang, sp, color, 4);
        }
      }

      /* ================= 玩家 ================= */
      function playerFire() {
        var fast = rt.keys.has('Space');
        fireT = fast ? FIRE_INTERVAL_FAST : FIRE_INTERVAL;
        var shots = WEAPON[weaponLv - 1];
        for (var i = 0; i < shots.length; i++) {
          var s = shots[i];
          if (playerBullets.length > 60) break;
          playerBullets.push({
            x: player.x + s.ox,
            y: player.y - 22,
            vx: Math.sin(s.ang) * BULLET_SPEED,
            vy: -Math.cos(s.ang) * BULLET_SPEED,
            ang: s.ang,
            r: 3,
            dmg: 1,
            dead: false
          });
          shotsFired += 1;
        }
        rt.audio.play('shoot', 0.16);
      }

      function hitPlayer() {
        if (phase !== 'playing') return;
        if (invT > 0) return;
        if (shieldT > 0) {
          shieldT = 0;
          invT = 1.1;
          shake = Math.max(shake, 6);
          addParticles(player.x, player.y, colors.accent, 20, 1.1);
          addPopup(player.x, player.y - 34, '护盾破碎', colors.accent);
          rt.audio.play('hit', 0.7);
          return;
        }
        lives -= 1;
        invT = 2.2;
        shieldT = 0;
        if (weaponLv > 1) weaponLv -= 1;
        shake = 18;
        flash = 0.75;
        flashRGB = '244,63,94';
        addParticles(player.x, player.y, colors.danger, 34, 2);
        addParticles(player.x, player.y, colors.warn, 14, 1.4);
        addPopup(player.x, player.y - 34, '机体受损', colors.danger);
        rt.audio.play('explode', 0.8);
        hudDirty = true;
        if (lives <= 0) {
          lives = 0;
          phase = 'over';
          overTimer = 0;
          hudDirty = true;
          addParticles(player.x, player.y, '#ffffff', 24, 2.4);
          rt.audio.play('explode', 1);
        }
      }

      function useBomb() {
        if (phase !== 'playing' || bombs <= 0) return;
        bombs -= 1;
        hudDirty = true;
        shake = 20;
        flash = 0.85;
        flashRGB = '255,255,255';
        rt.audio.play('explode', 0.9);
        var i;
        for (i = enemyBullets.length - 1; i >= 0; i--) {
          addParticles(enemyBullets[i].x, enemyBullets[i].y, '#fbbf24', 1, 0.5);
        }
        enemyBullets.length = 0;
        for (i = 0; i < enemies.length; i++) {
          if (enemies[i].delay > 0) continue;
          damageEnemy(enemies[i], 4);
        }
        addPopup(player.x, player.y - 48, '清屏炸弹！', colors.warn);
        addParticles(player.x, player.y, colors.warn, 26, 2.2);
      }

      /* ================= 伤害 / 死亡 ================= */
      function damageEnemy(e, dmg) {
        e.hp -= dmg;
        e.hitFlash = 1;
        addParticles(e.x + rt.rand(-e.w * 0.3, e.w * 0.3), e.y + rt.rand(-e.h * 0.3, e.h * 0.3),
          e.color, e.type === 'boss' ? 2 : 3, 0.7);
        if (hitSoundT <= 0) {
          rt.audio.play('hit', 0.3);
          hitSoundT = 0.08;
        }
        if (e.hp <= 0 && !e.dead) killEnemy(e);
      }

      function killEnemy(e) {
        if (e.dead) return;
        e.dead = true;
        kills += 1;
        addScore(e.score);
        addPopup(e.x, e.y - e.h * 0.4, '+' + e.score, e.color);
        shake = Math.max(shake, e.type === 'boss' ? 20 : e.type === 'elite' ? 9 : 3);
        if (e.type === 'boss') {
          flash = 0.8;
          flashRGB = '236,72,153';
          for (var i = 0; i < 5; i++) {
            addParticles(e.x + rt.rand(-60, 60), e.y + rt.rand(-36, 36), rt.pick(['#ffffff', '#f9a8d4', '#fbbf24']), 22, 2.4);
          }
          addScore(500 + wave * 100);
          addPopup(W / 2, 200, 'BOSS 击破！', colors.warn);
          rt.audio.play('explode', 1);
          rt.audio.play('win', 0.5);
          boss = null;
          maybeDrop(e, 1);
        } else {
          addParticles(e.x, e.y, e.color, e.type === 'elite' ? 24 : 12, 1.2);
          addParticles(e.x, e.y, '#ffffff', e.type === 'elite' ? 8 : 4, 1);
          rt.audio.play(e.type === 'elite' ? 'explode' : 'pop', 0.5);
          maybeDrop(e, e.type === 'elite' ? 0.45 : 0.12);
        }
        hudDirty = true;
      }

      function maybeDrop(e, chance) {
        if (powerups.length >= 4) return;
        if (rt.rand(0, 1) > chance) return;
        var roll = rt.rand(0, 1);
        var type;
        if (roll < 0.36) type = 'spread';
        else if (roll < 0.62) type = 'shield';
        else if (roll < 0.78) type = 'life';
        else type = 'bomb';
        powerups.push({
          x: e.x, y: e.y,
          vy: 78,
          type: type,
          phase: rt.rand(0, Math.PI * 2)
        });
      }

      function applyPowerup(p) {
        var info = POWER[p.type];
        rt.audio.play('power', 0.7);
        addParticles(p.x, p.y, info.color, 14, 1.2);
        addPopup(player.x, player.y - 40, info.name, info.color);
        if (p.type === 'spread') {
          if (weaponLv < 3) weaponLv += 1;
          else addScore(120);
        } else if (p.type === 'shield') {
          shieldT = 6;
        } else if (p.type === 'life') {
          if (lives < 5) lives += 1;
          else addScore(100);
        } else if (p.type === 'bomb') {
          if (bombs < 3) bombs += 1;
          else addScore(80);
        }
        hudDirty = true;
      }

      /* ================= 更新 ================= */
      function tickEffects(dt) {
        var i;
        for (i = particles.length - 1; i >= 0; i--) {
          var p = particles[i];
          p.life -= dt;
          if (p.life <= 0) { particles.splice(i, 1); continue; }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += p.grav * dt;
          p.vx *= 0.988;
          p.vy *= 0.988;
        }
        for (i = popups.length - 1; i >= 0; i--) {
          var pp = popups[i];
          pp.life -= dt;
          pp.y += pp.vy * dt;
          if (pp.life <= 0) popups.splice(i, 1);
        }
        for (i = 0; i < enemies.length; i++) {
          if (enemies[i].hitFlash > 0) enemies[i].hitFlash = Math.max(0, enemies[i].hitFlash - dt * 4);
        }
        if (banner) {
          banner.life -= dt;
          if (banner.life <= 0) banner = null;
        }
        if (shake > 0) shake = Math.max(0, shake - dt * 46);
        if (flash > 0) flash = Math.max(0, flash - dt * 2.4);
        if (hitSoundT > 0) hitSoundT = Math.max(0, hitSoundT - dt);
      }

      function updateStars(dt) {
        for (var l = 0; l < 3; l++) {
          var arr = stars[l];
          for (var i = 0; i < arr.length; i++) {
            var s = arr[i];
            s.y += s.sp * dt;
            if (s.y > H + 4) {
              s.y = -4;
              s.x = rt.rand(0, W);
            }
          }
        }
      }

      function updatePlayer(dt) {
        var move = 0;
        if (rt.keys.has('ArrowLeft') || rt.keys.has('KeyA')) move -= 1;
        if (rt.keys.has('ArrowRight') || rt.keys.has('KeyD')) move += 1;
        var oldX = player.x;
        if (move !== 0) {
          mouseActive = false;
          player.x += move * PLAYER_SPEED * dt;
        } else if (mouseActive) {
          player.x += (rt.pointer.x - player.x) * Math.min(1, dt * 16);
        }
        player.x = rt.clamp(player.x, 26, W - 26);
        player.vx = (player.x - oldX) / Math.max(dt, 0.0001);
        player.bank += ((player.vx / 900) - player.bank) * Math.min(1, dt * 10);

        if (invT > 0) invT = Math.max(0, invT - dt);
        if (shieldT > 0) shieldT = Math.max(0, shieldT - dt);
        engineT += dt;

        // 自动射击（按住空格加速）
        fireT -= dt;
        if (fireT <= 0) playerFire();

        if (rt.wasPressed('KeyX') || rt.wasPressed('ShiftLeft') || rt.wasPressed('ShiftRight')) {
          useBomb();
        }
      }

      function updateEnemies(dt) {
        for (var i = enemies.length - 1; i >= 0; i--) {
          var e = enemies[i];
          if (e.dead) continue;
          if (e.delay > 0) {
            e.delay -= dt;
            continue;
          }
          e.age += dt;
          if (e.type === 'boss') {
            updateBoss(e, dt);
          } else if (e.type === 'elite') {
            updateElite(e, dt);
          } else {
            updateFlyer(e, dt);
          }
          if (e.y > H + 70) e.dead = true;
        }
      }

      function updateFlyer(e, dt) {
        if (e.y < e.targetY) {
          e.y = Math.min(e.targetY, e.y + 70 * dt);
        } else {
          // 悬停后持续下压，保证波次节奏不会拖太久
          e.y += 44 * dt;
        }
        e.x += Math.sin(e.age * 1.3 + e.phase) * e.drift * dt;
        if (e.y > -10 && e.delay <= 0) {
          e.fireT -= dt;
          if (e.fireT <= 0) {
            e.fireT = enemyFireInterval(e);
            if (e.type === 'gunner') fireAimed(e, 3, 0.2, e.color);
            else fireAimed(e, 1, 0, e.color);
          }
        }
      }

      function updateElite(e, dt) {
        e.y += (e.targetY - e.y) * Math.min(1, dt * 2.2);
        e.x += e.vx * dt;
        // 横向飞出屏幕后离场，否则该波会永远卡住
        if (e.x < -90 || e.x > W + 90) {
          e.dead = true;
          return;
        }
        e.fireT -= dt;
        if (e.fireT <= 0 && e.x > -20 && e.x < W + 20) {
          e.fireT = enemyFireInterval(e);
          fireAimed(e, 3, 0.22, e.color);
        }
      }

      function updateBoss(e, dt) {
        if (e.enterT < 1) {
          e.enterT = Math.min(1, e.enterT + dt * 0.75);
          var k = e.enterT * e.enterT * (3 - 2 * e.enterT);
          e.y = -110 + (e.targetY + 110) * k;
          return;
        }
        e.x = W / 2 + Math.sin(e.age * 0.65) * (W * 0.29);
        e.y = e.targetY + Math.sin(e.age * 1.3) * 10;
        e.fireT -= dt;
        if (e.fireT <= 0) {
          e.fireT = Math.max(0.78, 1.75 - wave * 0.03);
          e.pattern = (e.pattern + 1) % 3;
          var sp = enemyBulletSpeed() * 0.92;
          if (e.pattern === 0) {
            // 扇形弹幕
            for (var k2 = 0; k2 < 9; k2++) {
              var ang = Math.PI * (0.28 + 0.44 * (k2 / 8));
              fireEnemyBullet(e.x, e.y + 28, ang, sp * 0.9, '#f472b6', 5);
            }
            rt.audio.play('blip', 0.3);
          } else if (e.pattern === 1) {
            // 三连追踪
            fireAimed(e, 3, 0.2, '#fbbf24');
            rt.audio.play('blip', 0.3);
          } else {
            // 旋转双针
            e.spin += 0.55;
            var baseAng = Math.PI / 2 + Math.sin(e.spin) * 0.9;
            fireEnemyBullet(e.x - 50, e.y + 20, baseAng, sp, '#f9a8d4', 4);
            fireEnemyBullet(e.x + 50, e.y + 20, Math.PI - baseAng, sp, '#f9a8d4', 4);
            rt.audio.play('blip', 0.25);
          }
        }
      }

      function updatePlayerBullets(dt) {
        for (var i = playerBullets.length - 1; i >= 0; i--) {
          var b = playerBullets[i];
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (b.y < -24 || b.x < -20 || b.x > W + 20) playerBullets.splice(i, 1);
        }
      }

      function updateEnemyBullets(dt) {
        for (var i = enemyBullets.length - 1; i >= 0; i--) {
          var b = enemyBullets[i];
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (b.y > H + 24 || b.y < -40 || b.x < -30 || b.x > W + 30) enemyBullets.splice(i, 1);
        }
      }

      function updatePowerups(dt) {
        for (var i = powerups.length - 1; i >= 0; i--) {
          var p = powerups[i];
          p.y += p.vy * dt;
          if (p.y > H + 26) { powerups.splice(i, 1); continue; }
          var dx = p.x - player.x;
          var dy = p.y - player.y;
          if (dx * dx + dy * dy < 34 * 34) {
            applyPowerup(p);
            powerups.splice(i, 1);
          }
        }
      }

      function collideBullets() {
        for (var i = playerBullets.length - 1; i >= 0; i--) {
          var b = playerBullets[i];
          for (var j = 0; j < enemies.length; j++) {
            var e = enemies[j];
            if (e.dead || e.delay > 0) continue;
            if (b.x > e.x - e.w / 2 && b.x < e.x + e.w / 2 &&
                b.y > e.y - e.h / 2 && b.y < e.y + e.h / 2) {
              playerBullets.splice(i, 1);
              shotsHit += 1;
              damageEnemy(e, b.dmg);
              break;
            }
          }
        }
      }

      function collidePlayer() {
        if (phase !== 'playing') return;
        var i;
        for (i = enemyBullets.length - 1; i >= 0; i--) {
          var b = enemyBullets[i];
          var dx = b.x - player.x;
          var dy = b.y - player.y;
          var rr = b.r + PLAYER_HIT_R;
          if (dx * dx + dy * dy < rr * rr) {
            enemyBullets.splice(i, 1);
            addParticles(b.x, b.y, b.color, 5, 0.7);
            hitPlayer();
            if (phase !== 'playing') return;
          }
        }
        for (i = 0; i < enemies.length; i++) {
          var e = enemies[i];
          if (e.dead || e.delay > 0) continue;
          var ex = e.x - player.x;
          var ey = e.y - player.y;
          var range = (e.w + e.h) * 0.3 + PLAYER_HIT_R;
          if (ex * ex + ey * ey < range * range) {
            damageEnemy(e, 5);
            hitPlayer();
            if (phase !== 'playing') return;
          }
        }
      }

      function cleanup() {
        var i;
        for (i = enemies.length - 1; i >= 0; i--) {
          if (enemies[i].dead) enemies.splice(i, 1);
        }
        for (i = playerBullets.length - 1; i >= 0; i--) {
          if (playerBullets[i].dead) playerBullets.splice(i, 1);
        }
      }

      function updateWave(dt) {
        if (waveClearing) {
          waveDelay -= dt;
          if (waveDelay <= 0) startWave(wave + 1, false);
          return;
        }
        if (enemies.length === 0) waveComplete();
      }

      function statusTextNow() {
        if (phase === 'over') return '机体损毁…';
        if (shieldT > 0) return '能量护盾生效中';
        if (boss) return 'BOSS 战 · X / Shift 释放炸弹';
        if (bombs > 0) return '空格加速射击 · X / Shift 炸弹';
        return '拖动 / ← → 移动 · 空格加速射击';
      }

      /* ================= 主循环 ================= */
      return {
        update: function (dt) {
          timeAlive += dt;
          tickEffects(dt);
          updateStars(dt);
          if (hudDirty) {
            hudDirty = false;
            updateHud();
          }
          setStatus(statusTextNow());

          if (phase === 'over') {
            overTimer += dt;
            if (!ended && overTimer >= 1.3) {
              ended = true;
              var acc = shotsFired > 0 ? Math.round((shotsHit / shotsFired) * 100) : 0;
              rt.end({
                score: score,
                message: '孤舰在星海中沉没，抵达第 ' + maxWave + ' 波',
                stats: [
                  { label: '到达波次', value: maxWave },
                  { label: '击落敌机', value: kills },
                  { label: '命中率', value: acc + '%' },
                  { label: '存活时间', value: timeAlive.toFixed(1) + 's' }
                ]
              });
            }
            return;
          }

          updatePlayer(dt);
          updateEnemies(dt);
          updatePlayerBullets(dt);
          updateEnemyBullets(dt);
          updatePowerups(dt);
          collideBullets();
          collidePlayer();
          cleanup();
          if (phase === 'playing') updateWave(dt);
        },

        render: function (c) {
          ctx = c;
          ensureGradients();
          var t = rt.time;

          var sx = shake > 1 ? rt.rand(-shake, shake) : 0;
          var sy = shake > 1 ? rt.rand(-shake, shake) : 0;

          ctx.save();
          ctx.translate(sx, sy);
          drawBackground();
          drawStars(t);
          drawPowerups(t);
          drawEnemyBullets();
          drawEnemies(t);
          drawPlayerBullets();
          drawPlayer(t);
          drawParticles();
          drawPopups();
          ctx.restore();

          drawHud(t);
          drawBossBar();
          drawBanner();
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
        },

        destroy: function () {
          enemies.length = 0;
          playerBullets.length = 0;
          enemyBullets.length = 0;
          powerups.length = 0;
          particles.length = 0;
          popups.length = 0;
        }
      };

      /* ================= 绘制 ================= */
      function ensureGradients() {
        if (bgGrad) return;
        bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, '#05060f');
        bgGrad.addColorStop(0.45, '#080b1c');
        bgGrad.addColorStop(1, '#0d0820');

        nebulaA = ctx.createRadialGradient(W * 0.18, H * 0.28, 10, W * 0.18, H * 0.28, W * 0.42);
        nebulaA.addColorStop(0, 'rgba(99,102,241,0.20)');
        nebulaA.addColorStop(0.55, 'rgba(99,102,241,0.07)');
        nebulaA.addColorStop(1, 'rgba(99,102,241,0)');

        nebulaB = ctx.createRadialGradient(W * 0.84, H * 0.62, 12, W * 0.84, H * 0.62, W * 0.44);
        nebulaB.addColorStop(0, 'rgba(236,72,153,0.16)');
        nebulaB.addColorStop(0.6, 'rgba(236,72,153,0.05)');
        nebulaB.addColorStop(1, 'rgba(236,72,153,0)');

        var pr = Math.min(W, H) * 0.14;
        var pcx = W * 0.79;
        var pcy = H * 0.2;
        planetGrad = ctx.createRadialGradient(pcx - pr * 0.35, pcy - pr * 0.4, pr * 0.1, pcx, pcy, pr);
        planetGrad.addColorStop(0, 'rgba(129,140,248,0.30)');
        planetGrad.addColorStop(0.55, 'rgba(55,48,120,0.24)');
        planetGrad.addColorStop(1, 'rgba(8,8,24,0)');
      }

      function drawBackground() {
        ctx.fillStyle = bgGrad;
        ctx.fillRect(-30, -30, W + 60, H + 60);
        ctx.fillStyle = nebulaA;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = nebulaB;
        ctx.fillRect(0, 0, W, H);

        // 远处行星 + 光环
        var pr = Math.min(W, H) * 0.14;
        var pcx = W * 0.79;
        var pcy = H * 0.2;
        ctx.fillStyle = planetGrad;
        ctx.beginPath();
        ctx.arc(pcx, pcy, pr, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.translate(pcx, pcy);
        ctx.rotate(-0.36);
        ctx.strokeStyle = 'rgba(129,140,248,0.16)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, pr * 1.62, pr * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(236,72,153,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, pr * 1.9, pr * 0.48, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      function drawStars(t) {
        for (var l = 0; l < 3; l++) {
          var arr = stars[l];
          for (var i = 0; i < arr.length; i++) {
            var s = arr[i];
            var a = s.a * (0.72 + 0.28 * Math.sin(t * 2 + s.tw));
            if (a <= 0.02) continue;
            ctx.globalAlpha = a;
            ctx.fillStyle = s.col;
            ctx.fillRect(s.x, s.y, s.s, s.s);
          }
        }
        ctx.globalAlpha = 1;
      }

      function drawEnemies(t) {
        for (var i = 0; i < enemies.length; i++) {
          var e = enemies[i];
          if (e.dead || e.delay > 0) continue;
          if (e.type === 'boss') drawBoss(e, t);
          else if (e.type === 'elite') drawElite(e, t);
          else if (e.type === 'gunner') drawGunner(e, t);
          else drawGrunt(e, t);
          if (e.hitFlash > 0) {
            ctx.globalAlpha = Math.min(0.8, e.hitFlash);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(e.x, e.y, Math.min(e.w, e.h) * 0.42, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      }

      function drawGrunt(e, t) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.beginPath();
        ctx.moveTo(0, e.h * 0.5);
        ctx.lineTo(-e.w * 0.5, -e.h * 0.12);
        ctx.lineTo(-e.w * 0.22, -e.h * 0.5);
        ctx.lineTo(e.w * 0.22, -e.h * 0.5);
        ctx.lineTo(e.w * 0.5, -e.h * 0.12);
        ctx.closePath();
        ctx.fillStyle = 'rgba(62,16,44,0.96)';
        ctx.fill();
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 1.9;
        ctx.stroke();
        // 机翼高光
        ctx.fillStyle = 'rgba(255,255,255,0.30)';
        ctx.fillRect(-e.w * 0.34, -e.h * 0.34, e.w * 0.1, e.h * 0.34);
        ctx.fillRect(e.w * 0.24, -e.h * 0.34, e.w * 0.1, e.h * 0.34);
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(0, -2, 3.4 + Math.sin(t * 5 + e.phase) * 0.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(0, -2, 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      function drawGunner(e, t) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.beginPath();
        ctx.moveTo(0, e.h * 0.48);
        ctx.lineTo(-e.w * 0.5, e.h * 0.1);
        ctx.lineTo(-e.w * 0.34, -e.h * 0.45);
        ctx.lineTo(e.w * 0.34, -e.h * 0.45);
        ctx.lineTo(e.w * 0.5, e.h * 0.1);
        ctx.closePath();
        ctx.fillStyle = 'rgba(66,18,42,0.96)';
        ctx.fill();
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillRect(-e.w * 0.32, -e.h * 0.3, e.w * 0.1, e.h * 0.5);
        ctx.fillRect(e.w * 0.22, -e.h * 0.3, e.w * 0.1, e.h * 0.5);
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(0, e.h * 0.12, 4 + Math.sin(t * 6 + e.phase) * 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      function drawElite(e, t) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(0, e.h * 0.5);
        ctx.lineTo(-e.w * 0.5, e.h * 0.18);
        ctx.lineTo(-e.w * 0.42, -e.h * 0.3);
        ctx.lineTo(-e.w * 0.14, -e.h * 0.5);
        ctx.lineTo(e.w * 0.14, -e.h * 0.5);
        ctx.lineTo(e.w * 0.42, -e.h * 0.3);
        ctx.lineTo(e.w * 0.5, e.h * 0.18);
        ctx.closePath();
        ctx.fillStyle = 'rgba(40,26,8,0.94)';
        ctx.fill();
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(-e.w * 0.3, -e.h * 0.08, e.w * 0.6, 3);
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(0, e.h * 0.02, 6 + Math.sin(t * 4 + e.phase) * 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(0, e.h * 0.02, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      function drawBoss(e, t) {
        var hw = e.w * 0.5;
        var hh = e.h * 0.5;
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 24;

        // 主体：倒三角舰体 + 两翼
        ctx.beginPath();
        ctx.moveTo(0, hh * 0.94);
        ctx.lineTo(-hw * 0.3, hh * 0.44);
        ctx.lineTo(-hw * 0.94, hh * 0.28);
        ctx.lineTo(-hw * 0.76, -hh * 0.1);
        ctx.lineTo(-hw * 0.5, -hh * 0.28);
        ctx.lineTo(-hw * 0.34, -hh * 0.88);
        ctx.lineTo(hw * 0.34, -hh * 0.88);
        ctx.lineTo(hw * 0.5, -hh * 0.28);
        ctx.lineTo(hw * 0.76, -hh * 0.1);
        ctx.lineTo(hw * 0.94, hh * 0.28);
        ctx.lineTo(hw * 0.3, hh * 0.44);
        ctx.closePath();
        ctx.fillStyle = 'rgba(74,18,58,0.97)';
        ctx.fill();
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2.6;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 翼面分割线
        ctx.strokeStyle = 'rgba(249,168,212,0.32)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-hw * 0.74, -hh * 0.08);
        ctx.lineTo(-hw * 0.2, hh * 0.22);
        ctx.moveTo(hw * 0.74, -hh * 0.08);
        ctx.lineTo(hw * 0.2, hh * 0.22);
        ctx.stroke();

        // 侧翼炮口
        for (var s = -1; s <= 1; s += 2) {
          var cx = s * hw * 0.66;
          var cy = hh * 0.02;
          ctx.fillStyle = 'rgba(20,6,20,0.9)';
          roundRect(ctx, cx - 10, cy - 6, 20, 26, 4);
          ctx.fill();
          ctx.strokeStyle = 'rgba(249,168,212,0.85)';
          ctx.lineWidth = 1.4;
          ctx.stroke();
          ctx.fillStyle = 'rgba(251,191,36,' + (0.5 + Math.sin(t * 6 + s) * 0.3).toFixed(3) + ')';
          ctx.beginPath();
          ctx.arc(cx, cy + 21, 3.4, 0, Math.PI * 2);
          ctx.fill();
        }

        // 顶部引擎
        ctx.fillStyle = 'rgba(30,8,28,0.9)';
        ctx.fillRect(-hw * 0.2, -hh * 0.92, hw * 0.4, 6);

        // 核心底座
        ctx.fillStyle = 'rgba(24,6,24,0.92)';
        ctx.beginPath();
        ctx.arc(0, hh * 0.14, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(249,168,212,0.5)';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        // 核心光球
        var pulse = 1 + Math.sin(t * 4) * 0.08;
        var core = ctx.createRadialGradient(-3, hh * 0.14 - 4, 1, 0, hh * 0.14, 19 * pulse);
        core.addColorStop(0, '#ffffff');
        core.addColorStop(0.35, '#fbcfe8');
        core.addColorStop(0.7, 'rgba(236,72,153,0.75)');
        core.addColorStop(1, 'rgba(236,72,153,0)');
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(0, hh * 0.14, 19 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-2, hh * 0.14 - 2, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      function drawEnemyBullets() {
        for (var i = 0; i < enemyBullets.length; i++) {
          var b = enemyBullets[i];
          ctx.fillStyle = b.color;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r * 0.42, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      function drawPlayerBullets() {
        for (var i = 0; i < playerBullets.length; i++) {
          var b = playerBullets[i];
          ctx.save();
          ctx.translate(b.x, b.y);
          ctx.rotate(-b.ang);
          ctx.fillStyle = 'rgba(129,140,248,0.55)';
          ctx.fillRect(-2.6, -9, 5.2, 17);
          ctx.fillStyle = '#e0e7ff';
          ctx.fillRect(-1.2, -8, 2.4, 13);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-0.7, -7, 1.4, 6);
          ctx.restore();
        }
      }

      function drawPlayer(t) {
        var blink = invT > 0 ? (0.32 + 0.68 * Math.abs(Math.sin(t * 22))) : 1;
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.globalAlpha = blink;
        ctx.rotate(player.bank * 0.28);

        // 引擎尾焰
        var f = 10 + Math.sin(engineT * 30) * 4;
        var flame = ctx.createLinearGradient(0, 10, 0, 22 + f);
        flame.addColorStop(0, 'rgba(255,255,255,0.95)');
        flame.addColorStop(0.4, 'rgba(165,180,252,0.85)');
        flame.addColorStop(1, 'rgba(236,72,153,0)');
        ctx.fillStyle = flame;
        ctx.beginPath();
        ctx.moveTo(-7, 8);
        ctx.lineTo(0, 20 + f);
        ctx.lineTo(7, 8);
        ctx.closePath();
        ctx.fill();

        ctx.shadowColor = colors.accent;
        ctx.shadowBlur = 18;
        var hull = ctx.createLinearGradient(-18, 0, 18, 0);
        hull.addColorStop(0, '#ec4899');
        hull.addColorStop(0.5, '#c7d2fe');
        hull.addColorStop(1, '#818cf8');
        ctx.beginPath();
        ctx.moveTo(0, -24);
        ctx.lineTo(7, -8);
        ctx.lineTo(20, 8);
        ctx.lineTo(9, 6);
        ctx.lineTo(0, 14);
        ctx.lineTo(-9, 6);
        ctx.lineTo(-20, 8);
        ctx.lineTo(-7, -8);
        ctx.closePath();
        ctx.fillStyle = hull;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(224,231,255,0.9)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // 座舱
        ctx.beginPath();
        ctx.ellipse(0, -7, 4.6, 7.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#e0e7ff';
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, -9, 2.2, 3.6, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#22d3ee';
        ctx.fill();

        ctx.restore();
        ctx.globalAlpha = 1;

        // 护盾
        if (shieldT > 0) {
          var sp = 0.35 + Math.sin(t * 6) * 0.15;
          ctx.save();
          ctx.translate(player.x, player.y);
          ctx.globalAlpha = shieldT < 1.2 ? shieldT / 1.2 : 1;
          ctx.strokeStyle = 'rgba(129,140,248,' + sp.toFixed(3) + ')';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 32, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(236,72,153,' + (sp * 0.7).toFixed(3) + ')';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(0, 0, 36, t * 2, t * 2 + Math.PI * 1.2);
          ctx.stroke();
          ctx.restore();
          ctx.globalAlpha = 1;
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
        ctx.font = '900 16px ' + FONT_NUM;
        for (var i = 0; i < popups.length; i++) {
          var pp = popups[i];
          ctx.globalAlpha = Math.max(0, Math.min(1, pp.life / pp.max));
          ctx.fillStyle = pp.color;
          ctx.fillText(pp.text, pp.x, pp.y);
        }
        ctx.globalAlpha = 1;
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

          ctx.globalAlpha = 0.32 + Math.sin(t * 6 + p.phase) * 0.18;
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

      function drawHud(t) {
        ctx.fillStyle = 'rgba(5,7,18,0.55)';
        ctx.fillRect(0, 0, W, 34);
        ctx.fillStyle = 'rgba(129,140,248,0.28)';
        ctx.fillRect(0, 34, W, 1);

        ctx.textAlign = 'left';
        ctx.font = '700 10px ' + FONT_NUM;
        ctx.fillStyle = 'rgba(139,149,181,0.9)';
        ctx.fillText('WAVE', 18, 13);
        ctx.font = '900 18px ' + FONT_NUM;
        ctx.fillStyle = colors.accent;
        ctx.fillText(pad2(wave), 18, 30);

        // 生命
        ctx.textAlign = 'center';
        ctx.font = '700 16px ' + FONT_UI;
        var hx = W / 2 - 46;
        for (var i = 0; i < 5; i++) {
          if (i < lives) {
            var pulse = lives === 1 ? 0.55 + 0.45 * Math.sin(t * 8) : 1;
            ctx.globalAlpha = pulse;
            ctx.fillStyle = lives === 1 ? colors.danger : colors.accent2;
            ctx.fillText('♥', hx, 24);
          } else {
            ctx.globalAlpha = 0.15;
            ctx.fillStyle = colors.muted;
            ctx.fillText('♥', hx, 24);
          }
          hx += 18;
        }
        ctx.globalAlpha = 1;

        // 炸弹
        ctx.font = '700 13px ' + FONT_UI;
        ctx.fillStyle = colors.warn;
        var bx = W / 2 + 58;
        for (var b = 0; b < bombs; b++) {
          ctx.fillText('✦', bx, 23);
          bx += 16;
        }

        // 最高分
        ctx.textAlign = 'right';
        ctx.font = '700 10px ' + FONT_NUM;
        ctx.fillStyle = 'rgba(139,149,181,0.9)';
        ctx.fillText('BEST', W - 18, 13);
        ctx.font = '900 15px ' + FONT_NUM;
        ctx.fillStyle = 'rgba(232,236,255,0.92)';
        ctx.fillText(String(rt.best), W - 18, 30);
        ctx.textAlign = 'left';
      }

      function drawBossBar() {
        if (!boss || boss.dead || boss.enterT < 0.35) return;
        var bw = Math.min(400, W * 0.56);
        var bx = W / 2 - bw / 2;
        var by = 42;
        ctx.fillStyle = 'rgba(8,10,24,0.78)';
        roundRect(ctx, bx - 3, by - 3, bw + 6, 16, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(236,72,153,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
        var ratio = Math.max(0, boss.hp / boss.maxHp);
        if (ratio > 0) {
          var g = ctx.createLinearGradient(bx, by, bx + bw, by);
          g.addColorStop(0, '#f43f5e');
          g.addColorStop(1, '#ec4899');
          roundRect(ctx, bx, by, Math.max(6, bw * ratio), 10, 5);
          ctx.fillStyle = g;
          ctx.fill();
        }
        ctx.font = '700 10px ' + FONT_NUM;
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(249,168,212,0.95)';
        ctx.fillText('BOSS', bx - 8, by + 8);
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(232,236,255,0.72)';
        ctx.fillText(Math.max(0, Math.ceil(boss.hp)) + ' / ' + boss.maxHp, bx + bw + 8, by + 8);
        ctx.textAlign = 'left';
      }

      function drawBanner() {
        if (!banner) return;
        var age = banner.max - banner.life;
        var pop = Math.min(1, age / 0.2);
        var alpha = Math.min(1, banner.life / 0.3);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(W / 2, H * 0.42);
        ctx.scale(0.9 + pop * 0.1, 0.9 + pop * 0.1);
        ctx.fillStyle = 'rgba(8,8,22,0.7)';
        roundRect(ctx, -190, -48, 380, 96, 16);
        ctx.fill();
        ctx.strokeStyle = banner.color;
        ctx.globalAlpha = alpha * 0.7;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center';
        ctx.font = '900 26px ' + FONT_UI;
        ctx.fillStyle = banner.color;
        ctx.fillText(banner.title, 0, 2);
        ctx.font = '700 14px ' + FONT_UI;
        ctx.fillStyle = 'rgba(232,236,255,0.85)';
        ctx.fillText(banner.sub, 0, 30);
        ctx.restore();
      }

      function drawOverlays(t) {
        if (lives === 1 && phase !== 'over') {
          var g = ctx.createRadialGradient(W / 2, H / 2, 150, W / 2, H / 2, 440);
          g.addColorStop(0, 'rgba(244,63,94,0)');
          g.addColorStop(1, 'rgba(244,63,94,0.5)');
          ctx.globalAlpha = 0.32 + Math.sin(t * 6) * 0.16;
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, W, H);
          ctx.globalAlpha = 1;
        }
        if (flash > 0) {
          ctx.fillStyle = 'rgba(' + flashRGB + ',' + Math.min(0.55, flash * 0.7).toFixed(3) + ')';
          ctx.fillRect(0, 0, W, H);
        }
        if (phase === 'over') {
          var k = Math.min(1, overTimer / 1.0);
          ctx.fillStyle = 'rgba(4,5,14,' + (0.3 + k * 0.4).toFixed(3) + ')';
          ctx.fillRect(0, 0, W, H);
          ctx.textAlign = 'center';
          ctx.font = '900 34px ' + FONT_UI;
          ctx.fillStyle = 'rgba(244,63,94,' + k.toFixed(3) + ')';
          ctx.fillText('机体损毁', W / 2, 246);
          ctx.font = '700 13px ' + FONT_NUM;
          ctx.fillStyle = 'rgba(232,236,255,' + (0.65 * k).toFixed(3) + ')';
          ctx.fillText('FINAL SCORE ' + score + ' · WAVE ' + maxWave, W / 2, 280);
          ctx.textAlign = 'left';
        }
      }
    }
  });
})();
