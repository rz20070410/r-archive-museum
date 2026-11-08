/* 游戏：塔防 —— 布阵升级，守住基地 */
(function () {
  'use strict';

  var W = 720;
  var H = 540;

  var FX = 12;          /* 战场左上角 */
  var FY = 56;
  var FW = 696;
  var FH = 418;         /* 战场底边 = 474 */
  var BOT_Y = 480;      /* 底部面板 */
  var BOT_H = 52;

  var PLOT_SIZE = 40;

  /* 固定 S 形路径：左侧出生点 -> 右侧基地 */
  var PATH = [
    { x: -40, y: 124 },
    { x: 612, y: 124 },
    { x: 612, y: 258 },
    { x: 110, y: 258 },
    { x: 110, y: 396 },
    { x: 700, y: 396 }
  ];

  var SEGS = [];
  var PATH_LEN = 0;
  (function () {
    for (var i = 0; i < PATH.length - 1; i++) {
      var a = PATH[i];
      var b = PATH[i + 1];
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var len = Math.sqrt(dx * dx + dy * dy);
      SEGS.push({
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        len: len, acc: PATH_LEN,
        ang: Math.atan2(dy, dx),
        nx: dx / len, ny: dy / len
      });
      PATH_LEN += len;
    }
  })();

  /* 建造格（固定位置，紧贴路径两侧） */
  var PLOT_POS = [
    [190, 82], [310, 82], [430, 82], [550, 82],
    [160, 166], [275, 166], [390, 166], [505, 166],
    [160, 210], [275, 210], [390, 210], [505, 210],
    [160, 304], [275, 304], [390, 304], [505, 304],
    [160, 348], [275, 348], [390, 348], [505, 348],
    [160, 442], [275, 442], [390, 442], [505, 442]
  ];

  /* 三种塔：0 箭塔 / 1 冰塔 / 2 炮塔 */
  var TOWER_DEFS = [
    {
      key: 'arrow',
      name: '箭塔',
      cost: 40,
      color: '#38bdf8',
      glow: '#0ea5e9',
      desc: '单体高频',
      levels: [
        { dmg: 13, cd: 0.55, range: 112 },
        { dmg: 20, cd: 0.48, range: 116 },
        { dmg: 30, cd: 0.40, range: 122 }
      ],
      upCost: [60, 100]
    },
    {
      key: 'frost',
      name: '冰塔',
      cost: 60,
      color: '#a78bfa',
      glow: '#8b5cf6',
      desc: '减速控场',
      levels: [
        { dmg: 6, cd: 0.95, range: 102, slow: 0.42, slowT: 1.5 },
        { dmg: 10, cd: 0.85, range: 106, slow: 0.50, slowT: 1.8 },
        { dmg: 15, cd: 0.75, range: 112, slow: 0.58, slowT: 2.2 }
      ],
      upCost: [85, 135]
    },
    {
      key: 'cannon',
      name: '炮塔',
      cost: 80,
      color: '#fb923c',
      glow: '#f97316',
      desc: '范围爆炸',
      levels: [
        { dmg: 24, cd: 1.50, range: 124, splash: 46 },
        { dmg: 38, cd: 1.35, range: 128, splash: 52 },
        { dmg: 56, cd: 1.20, range: 134, splash: 60 }
      ],
      upCost: [110, 165]
    }
  ];

  var KIND_DEFS = {
    grunt: { hp: 1.0, spd: 1.0, r: 11, dmg: 1, reward: 1.0, color: '#fb7185', glow: '#f43f5e' },
    runner: { hp: 0.7, spd: 1.35, r: 9, dmg: 1, reward: 0.85, color: '#fbbf24', glow: '#f59e0b' },
    tank: { hp: 2.6, spd: 0.72, r: 15, dmg: 2, reward: 1.8, color: '#a78bfa', glow: '#8b5cf6' },
    boss: { hp: 7.0, spd: 0.6, r: 21, dmg: 5, reward: 5.0, color: '#f43f5e', glow: '#be123c' }
  };

  var MAX_ENEMIES = 80;
  var MAX_BULLETS = 120;
  var MAX_PARTICLES = 240;

  function waveHp(w) {
    return 34 * Math.pow(1.32, w - 1);
  }

  function waveSpeed(w) {
    return 66 + w * 3;
  }

  function waveReward(w) {
    return 4 + w * 1.1;
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

  function easeOutBack(t) {
    var c = 1.70158;
    var u = t - 1;
    return 1 + (c + 1) * u * u * u + c * u * u;
  }

  Arcade.register({
    id: 'tower',
    title: '塔防',
    subtitle: '布阵升级，守住基地',
    description: '在 S 形路径旁建造箭塔、冰塔与炮塔，抵挡 10 波敌人。击杀赚金币、升级强火力，守住基地就赢下这一局。',
    icon: '🛡️',
    accent: '#38bdf8',
    accent2: '#8b5cf6',
    tags: ['策略', '挑战'],
    difficulty: '困难',
    width: W,
    height: H,
    order: 45,
    tips: '别把金币全压在一种塔上：冰塔减速配炮塔群伤才是后期答案。波次之间提前召唤能赚额外金币。',
    controls: [
      { keys: '鼠标 / 触摸点击', action: '建造 / 选择 / 按钮' },
      { keys: '1 / 2 / 3', action: '建造箭塔 / 冰塔 / 炮塔' },
      { keys: '空格', action: '提前召唤下一波' },
      { keys: 'U / S', action: '升级 / 出售选中塔' }
    ],

    create: function (rt) {
      var ctx = null;

      var BTN_NEXT = { id: 'next', x: 452, y: 10, w: 152, h: 34 };
      var BTN_SPEED = { id: 'speed', x: 612, y: 10, w: 88, h: 34 };
      var CARD_RECTS = [
        { id: 'card0', x: 24, y: 486, w: 116, h: 40 },
        { id: 'card1', x: 148, y: 486, w: 116, h: 40 },
        { id: 'card2', x: 272, y: 486, w: 116, h: 40 }
      ];
      var BTN_UP = { id: 'upgrade', x: 560, y: 486, w: 68, h: 40 };
      var BTN_SELL = { id: 'sell', x: 634, y: 486, w: 62, h: 40 };

      var plots;
      var towers;
      var enemies;
      var bullets;
      var particles;
      var rings;
      var floaters;

      var gold;
      var baseHp;
      var wave;
      var waveCleared;
      var kills;
      var towersBuilt;
      var score;
      var elapsed;

      var phase;        /* prep | wave | ending */
      var prepTimer;
      var spawnList;
      var spawnIdx;
      var spawnTimer;
      var spawnGap;
      var speedMul;

      var selectedPlot;
      var selectedTower;
      var hoverPlot;
      var hoverTower;
      var hoverBtn;

      var shake;
      var damageFlash;
      var bannerT;
      var bannerWave;
      var endTimer;
      var endResult;
      var ended;
      var shotSfxCd;

      var hudDirty;
      var statusDirty;

      var bgGrad;
      var auraGrad;
      var dangerGrad;

      var pScratch = { x: 0, y: 0, ang: 0 };

      /* ---------- 路径工具 ---------- */

      function posAt(d, out) {
        var i;
        if (d <= 0) {
          var s0 = SEGS[0];
          out.x = s0.x1 + s0.nx * d;
          out.y = s0.y1 + s0.ny * d;
          out.ang = s0.ang;
          return out;
        }
        for (i = 0; i < SEGS.length; i++) {
          var s = SEGS[i];
          if (d <= s.acc + s.len || i === SEGS.length - 1) {
            var t = (d - s.acc) / s.len;
            if (t < 0) t = 0;
            if (t > 1) t = 1;
            out.x = s.x1 + (s.x2 - s.x1) * t;
            out.y = s.y1 + (s.y2 - s.y1) * t;
            out.ang = s.ang;
            return out;
          }
        }
        var last = PATH[PATH.length - 1];
        out.x = last.x;
        out.y = last.y;
        out.ang = 0;
        return out;
      }

      function setEnemyPos(e) {
        posAt(e.dist, e);
      }

      /* ---------- 分数 / HUD ---------- */

      function refreshScore() {
        score = kills * 12 + waveCleared * 120 + baseHp * 25;
        rt.setScore(score);
      }

      function updateHud() {
        rt.setHud({
          '金币': gold,
          '波次': wave + '/10',
          '基地': baseHp + '/20'
        });
      }

      function updateStatus() {
        if (phase === 'prep') {
          rt.setStatus('点击空地建塔 · 1/2/3 选塔型 · 空格提前召唤下一波');
        } else if (phase === 'wave') {
          rt.setStatus('U 升级选中塔 · S 出售 · 空格在波次间提前召唤');
        } else {
          rt.setStatus('');
        }
      }

      /* ---------- 粒子 / 飘字 ---------- */

      function addBurst(x, y, color, count, power) {
        for (var i = 0; i < count; i++) {
          var a = rt.rand(0, Math.PI * 2);
          var sp = rt.rand(38, 165) * (power || 1);
          particles.push({
            x: x,
            y: y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp - 18,
            g: 150,
            life: rt.rand(0.3, 0.7),
            max: 0.7,
            r: rt.rand(1.5, 3.3),
            color: color
          });
        }
        if (particles.length > MAX_PARTICLES) {
          particles.splice(0, particles.length - MAX_PARTICLES);
        }
      }

      function addRing(x, y, color, sp) {
        rings.push({
          x: x,
          y: y,
          r: 10,
          sp: sp || 190,
          life: 0.45,
          max: 0.45,
          color: color
        });
        if (rings.length > 18) rings.splice(0, rings.length - 18);
      }

      function addFloater(x, y, text, color) {
        floaters.push({
          x: x,
          y: y,
          text: text,
          color: color,
          life: 0.9,
          max: 0.9
        });
        if (floaters.length > 24) floaters.splice(0, floaters.length - 24);
      }

      /* ---------- 波次 ---------- */

      function buildWaveList(w) {
        var list = [];
        var count = 6 + w * 2;
        for (var i = 0; i < count; i++) {
          var kind = 'grunt';
          if (w >= 2 && i % 3 === 1) kind = 'runner';
          if (w >= 3 && i % 4 === 2) kind = 'tank';
          list.push(kind);
        }
        if (w === 10) list.push('boss');
        return list;
      }

      function spawnEnemy(kind) {
        if (enemies.length >= MAX_ENEMIES) return;
        var def = KIND_DEFS[kind];
        var hp = Math.max(8, Math.round(waveHp(wave) * def.hp));
        var spd = waveSpeed(wave) * def.spd;
        enemies.push({
          kind: kind,
          def: def,
          x: -40,
          y: 124,
          ang: 0,
          dist: 0,
          hp: hp,
          maxHp: hp,
          speed: spd,
          slowF: 1,
          slowT: 0,
          hit: 0,
          reward: Math.max(2, Math.round(waveReward(wave) * def.reward)),
          dmg: def.dmg,
          r: def.r,
          alive: true
        });
        setEnemyPos(enemies[enemies.length - 1]);
      }

      function startWave() {
        if (phase !== 'prep' || wave >= 10) return;
        if (prepTimer > 0.25) {
          var bonus = 8 + (wave + 1) * 3;
          gold += bonus;
          addFloater(360, 150, '提前召唤 +' + bonus + ' 金币', '#fbbf24');
        }
        wave += 1;
        phase = 'wave';
        spawnList = buildWaveList(wave);
        spawnIdx = 0;
        spawnGap = Math.max(0.34, 0.78 - wave * 0.04);
        spawnTimer = 0.35;
        bannerT = 1.5;
        bannerWave = wave;
        rt.audio.play('level', 0.7);
        hudDirty = true;
        statusDirty = true;
      }

      function completeWave() {
        waveCleared = wave;
        var bonus = 15 + wave * 5;
        gold += bonus;
        addFloater(360, 200, '第 ' + wave + ' 波完成 +' + bonus + ' 金币', '#34d399');
        rt.audio.play('score', 0.8);
        refreshScore();
        hudDirty = true;
        if (wave >= 10) {
          endGame(true);
        } else {
          phase = 'prep';
          prepTimer = 10;
          statusDirty = true;
        }
      }

      function endGame(won) {
        if (phase === 'ending') return;
        phase = 'ending';
        endResult = { won: won };
        endTimer = won ? 1.5 : 1.3;
        if (won) {
          addFloater(360, 210, '全部击退！', '#34d399');
          rt.audio.play('level', 0.9);
        } else {
          shake = 14;
          rt.audio.play('explode', 0.7);
        }
        statusDirty = true;
      }

      function finish() {
        rt.end({
          score: score,
          won: !!(endResult && endResult.won),
          message: endResult && endResult.won
            ? '10 波敌人全部击退，基地安然无恙！'
            : '基地被攻破了，换个布阵再试一次吧。',
          stats: [
            { label: '击杀', value: kills },
            { label: '到达波次', value: wave + ' / 10' },
            { label: '剩余基地', value: baseHp + ' / 20' },
            { label: '建造塔数', value: towersBuilt },
            { label: '用时', value: elapsed.toFixed(1) + 's' }
          ]
        });
      }

      /* ---------- 敌人逻辑 ---------- */

      function leak(e) {
        baseHp -= e.dmg;
        if (baseHp < 0) baseHp = 0;
        shake = Math.min(16, shake + 6);
        damageFlash = 0.5;
        addBurst(654, 396, '#f43f5e', 14, 1.3);
        addFloater(640, 352, '-' + e.dmg + ' 基地', '#f87171');
        rt.audio.play('hit', 0.8);
        refreshScore();
        hudDirty = true;
        if (baseHp <= 0) endGame(false);
      }

      function killEnemy(e) {
        if (!e.alive) return;
        e.alive = false;
        var idx = enemies.indexOf(e);
        if (idx >= 0) enemies.splice(idx, 1);
        kills++;
        gold += e.reward;
        addBurst(e.x, e.y, e.def.color, 7, 0.85);
        addFloater(e.x, e.y - e.r - 6, '+' + e.reward, '#fbbf24');
        rt.audio.play('pop', 0.35);
        refreshScore();
        hudDirty = true;
      }

      function hitEnemy(e, dmg, b) {
        if (!e.alive) return;
        e.hp -= dmg;
        e.hit = 0.12;
        if (b && b.slow > 0) {
          var mul = 1 - b.slow;
          if (e.slowT <= 0) e.slowF = mul;
          else if (mul < e.slowF) e.slowF = mul;
          if (e.slowT < b.slowT) e.slowT = b.slowT;
        }
        if (e.hp <= 0) killEnemy(e);
      }

      function updateEnemies(dt) {
        for (var i = enemies.length - 1; i >= 0; i--) {
          var e = enemies[i];
          if (e.hit > 0) e.hit -= dt;
          var sp = e.speed;
          if (e.slowT > 0) {
            e.slowT -= dt;
            if (e.slowT <= 0) {
              e.slowT = 0;
              e.slowF = 1;
            } else {
              sp *= e.slowF;
            }
          }
          e.dist += sp * dt;
          if (e.dist >= PATH_LEN - 46) {
            leak(e);
            enemies.splice(i, 1);
            continue;
          }
          setEnemyPos(e);
        }
      }

      /* ---------- 塔逻辑 ---------- */

      function findTarget(tw, range) {
        var best = null;
        var bestDist = -1;
        var r2 = range * range;
        for (var i = 0; i < enemies.length; i++) {
          var e = enemies[i];
          var dx = e.x - tw.x;
          var dy = e.y - tw.y;
          if (dx * dx + dy * dy > r2) continue;
          if (e.dist > bestDist) {
            bestDist = e.dist;
            best = e;
          }
        }
        return best;
      }

      function fire(tw, target, st) {
        var def = TOWER_DEFS[tw.type];
        var bx = tw.x + Math.cos(tw.angle) * 12;
        var by = tw.y + Math.sin(tw.angle) * 12;
        if (bullets.length >= MAX_BULLETS) return;
        if (def.key === 'cannon') {
          bullets.push({
            type: 2,
            x: bx, y: by,
            tx: target.x, ty: target.y,
            spd: 320,
            dmg: st.dmg,
            splash: st.splash,
            color: def.color,
            ang: tw.angle
          });
        } else {
          bullets.push({
            type: def.key === 'frost' ? 1 : 0,
            x: bx, y: by,
            target: target,
            spd: def.key === 'frost' ? 470 : 660,
            dmg: st.dmg,
            slow: st.slow || 0,
            slowT: st.slowT || 0,
            color: def.color,
            ang: tw.angle
          });
        }
        if (shotSfxCd <= 0) {
          rt.audio.play(def.key === 'cannon' ? 'shoot' : 'blip', def.key === 'cannon' ? 0.3 : 0.12);
          shotSfxCd = 0.08;
        }
      }

      function updateTowers(dt) {
        for (var i = 0; i < towers.length; i++) {
          var tw = towers[i];
          if (tw.spawn > 0) tw.spawn = Math.max(0, tw.spawn - dt);
          if (tw.flash > 0) tw.flash -= dt;
          var st = TOWER_DEFS[tw.type].levels[tw.lvl];
          tw.cd -= dt;
          if (tw.cd > 0) continue;
          var target = findTarget(tw, st.range);
          if (!target) {
            tw.cd = 0;
            continue;
          }
          tw.angle = Math.atan2(target.y - tw.y, target.x - tw.x);
          fire(tw, target, st);
          tw.cd = st.cd;
          tw.flash = 0.1;
        }
      }

      function explodeCannon(b) {
        addBurst(b.tx, b.ty, b.color, 13, 1.4);
        addRing(b.tx, b.ty, b.color, 230);
        shake = Math.min(10, shake + 3);
        rt.audio.play('explode', 0.3);
        var rr = b.splash;
        for (var i = enemies.length - 1; i >= 0; i--) {
          var e = enemies[i];
          var dx = e.x - b.tx;
          var dy = e.y - b.ty;
          var lim = rr + e.r;
          if (dx * dx + dy * dy <= lim * lim) hitEnemy(e, b.dmg, null);
        }
      }

      function updateBullets(dt) {
        for (var i = bullets.length - 1; i >= 0; i--) {
          var b = bullets[i];
          if (b.type === 2) {
            var dx = b.tx - b.x;
            var dy = b.ty - b.y;
            var d = Math.sqrt(dx * dx + dy * dy);
            if (d <= 8) {
              explodeCannon(b);
              bullets.splice(i, 1);
              continue;
            }
            var step = b.spd * dt;
            if (step > d) step = d;
            b.x += (dx / d) * step;
            b.y += (dy / d) * step;
            b.ang = Math.atan2(dy, dx);
          } else {
            var tgt = b.target;
            if (!tgt || !tgt.alive) {
              bullets.splice(i, 1);
              continue;
            }
            var dx2 = tgt.x - b.x;
            var dy2 = tgt.y - b.y;
            var d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
            var step2 = b.spd * dt;
            if (d2 <= step2 + tgt.r) {
              hitEnemy(tgt, b.dmg, b);
              addBurst(tgt.x, tgt.y, b.color, 3, 0.5);
              bullets.splice(i, 1);
              continue;
            }
            b.x += (dx2 / d2) * step2;
            b.y += (dy2 / d2) * step2;
            b.ang = Math.atan2(dy2, dx2);
          }
        }
      }

      /* ---------- 特效更新 ---------- */

      function updateEffects(dt) {
        var i;
        for (i = particles.length - 1; i >= 0; i--) {
          var p = particles[i];
          p.life -= dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 0.94;
          p.vy *= 0.94;
          p.vy += p.g * dt;
          if (p.life <= 0) particles.splice(i, 1);
        }
        for (i = rings.length - 1; i >= 0; i--) {
          var r = rings[i];
          r.life -= dt;
          r.r += r.sp * dt;
          if (r.life <= 0) rings.splice(i, 1);
        }
        for (i = floaters.length - 1; i >= 0; i--) {
          var f = floaters[i];
          f.life -= dt;
          f.y -= 30 * dt;
          if (f.life <= 0) floaters.splice(i, 1);
        }
      }

      /* ---------- 玩家操作 ---------- */

      function hitRect(r, x, y) {
        return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
      }

      function buttonAt(x, y) {
        if (hitRect(BTN_NEXT, x, y)) return 'next';
        if (hitRect(BTN_SPEED, x, y)) return 'speed';
        if (y >= BOT_Y) {
          for (var i = 0; i < 3; i++) {
            if (hitRect(CARD_RECTS[i], x, y)) return 'card' + i;
          }
          if (hitRect(BTN_UP, x, y)) return 'upgrade';
          if (hitRect(BTN_SELL, x, y)) return 'sell';
        }
        return '';
      }

      function towerAt(x, y) {
        for (var i = 0; i < towers.length; i++) {
          var tw = towers[i];
          var dx = tw.x - x;
          var dy = tw.y - y;
          if (dx * dx + dy * dy <= 22 * 22) return tw;
        }
        return null;
      }

      function plotAt(x, y) {
        for (var i = 0; i < plots.length; i++) {
          var p = plots[i];
          var dx = p.x - x;
          var dy = p.y - y;
          if (dx * dx + dy * dy <= 24 * 24) return p;
        }
        return null;
      }

      function buildOnSelected(typeIndex) {
        if (phase === 'ending') return;
        if (!selectedPlot) {
          rt.audio.play('error', 0.25);
          addFloater(360, 300, '先点击一块建造格', '#fbbf24');
          return;
        }
        if (selectedPlot.tower) return;
        var def = TOWER_DEFS[typeIndex];
        if (gold < def.cost) {
          rt.audio.play('error', 0.3);
          addFloater(selectedPlot.x, selectedPlot.y - 28, '金币不足', '#f87171');
          return;
        }
        gold -= def.cost;
        var tw = {
          plot: selectedPlot,
          x: selectedPlot.x,
          y: selectedPlot.y,
          type: typeIndex,
          lvl: 0,
          cd: 0,
          angle: -Math.PI / 2,
          flash: 0.15,
          spawn: 0.3,
          invested: def.cost
        };
        selectedPlot.tower = tw;
        towers.push(tw);
        towersBuilt++;
        selectedTower = tw;
        selectedPlot = null;
        addBurst(tw.x, tw.y, def.color, 12, 1);
        addRing(tw.x, tw.y, def.color, 200);
        addFloater(tw.x, tw.y - 26, '-' + def.cost, '#fbbf24');
        rt.audio.play('power', 0.6);
        hudDirty = true;
      }

      function upgradeSelected() {
        if (phase === 'ending' || !selectedTower) {
          if (!selectedTower) rt.audio.play('error', 0.22);
          return;
        }
        var tw = selectedTower;
        var def = TOWER_DEFS[tw.type];
        if (tw.lvl >= 2) {
          rt.audio.play('error', 0.22);
          return;
        }
        var cost = def.upCost[tw.lvl];
        if (gold < cost) {
          rt.audio.play('error', 0.3);
          addFloater(tw.x, tw.y - 28, '金币不足', '#f87171');
          return;
        }
        gold -= cost;
        tw.lvl += 1;
        tw.invested += cost;
        tw.flash = 0.22;
        addBurst(tw.x, tw.y, def.color, 14, 1.1);
        addRing(tw.x, tw.y, def.color, 230);
        addFloater(tw.x, tw.y - 28, 'Lv' + (tw.lvl + 1), def.color);
        rt.audio.play('level', 0.6);
        hudDirty = true;
      }

      function sellSelected() {
        if (phase === 'ending' || !selectedTower) {
          if (!selectedTower) rt.audio.play('error', 0.22);
          return;
        }
        var tw = selectedTower;
        var refund = Math.floor(tw.invested * 0.6);
        gold += refund;
        var idx = towers.indexOf(tw);
        if (idx >= 0) towers.splice(idx, 1);
        tw.plot.tower = null;
        selectedTower = null;
        addFloater(tw.x, tw.y - 26, '+' + refund, '#fbbf24');
        addBurst(tw.x, tw.y, '#94a3b8', 9, 0.8);
        rt.audio.play('click', 0.7);
        hudDirty = true;
      }

      function handleButton(id) {
        if (id === 'speed') {
          speedMul = speedMul === 1 ? 2 : 1;
          rt.audio.play('toggle', 0.6);
          return;
        }
        if (id === 'next') {
          if (phase === 'prep') startWave();
          else rt.audio.play('error', 0.2);
          return;
        }
        if (id === 'card0') buildOnSelected(0);
        else if (id === 'card1') buildOnSelected(1);
        else if (id === 'card2') buildOnSelected(2);
        else if (id === 'upgrade') upgradeSelected();
        else if (id === 'sell') sellSelected();
      }

      /* ---------- 初始化 ---------- */

      function reset() {
        plots = [];
        for (var i = 0; i < PLOT_POS.length; i++) {
          plots.push({ x: PLOT_POS[i][0], y: PLOT_POS[i][1], tower: null });
        }
        towers = [];
        enemies = [];
        bullets = [];
        particles = [];
        rings = [];
        floaters = [];

        gold = 100;
        baseHp = 20;
        wave = 0;
        waveCleared = 0;
        kills = 0;
        towersBuilt = 0;
        score = 0;
        elapsed = 0;

        phase = 'prep';
        prepTimer = 16;
        spawnList = [];
        spawnIdx = 0;
        spawnTimer = 0;
        spawnGap = 0.8;
        speedMul = 1;

        selectedPlot = null;
        selectedTower = null;
        hoverPlot = null;
        hoverTower = null;
        hoverBtn = '';

        shake = 0;
        damageFlash = 0;
        bannerT = 0;
        bannerWave = 0;
        endTimer = 0;
        endResult = null;
        ended = false;
        shotSfxCd = 0;

        hudDirty = true;
        statusDirty = true;

        rt.setScore(0);
      }

      /* ---------- 绘制：场景 ---------- */

      function drawBackground(t) {
        if (!bgGrad) {
          bgGrad = ctx.createLinearGradient(0, 0, W, H);
          bgGrad.addColorStop(0, '#070b16');
          bgGrad.addColorStop(0.5, '#0a1122');
          bgGrad.addColorStop(1, '#120c24');
          auraGrad = ctx.createRadialGradient(360, 300, 40, 360, 300, 420);
          auraGrad.addColorStop(0, 'rgba(56, 189, 248, 0.10)');
          auraGrad.addColorStop(0.6, 'rgba(139, 92, 246, 0.05)');
          auraGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
          dangerGrad = ctx.createRadialGradient(360, 300, 120, 360, 300, 420);
          dangerGrad.addColorStop(0, 'rgba(244, 63, 94, 0)');
          dangerGrad.addColorStop(0.65, 'rgba(244, 63, 94, 0.05)');
          dangerGrad.addColorStop(1, 'rgba(244, 63, 94, 0.35)');
        }
        ctx.fillStyle = bgGrad;
        ctx.fillRect(-20, -20, W + 40, H + 40);
        ctx.fillStyle = auraGrad;
        ctx.fillRect(-20, -20, W + 40, H + 40);

        ctx.strokeStyle = 'rgba(96, 120, 190, 0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var x = 0; x <= W; x += 36) {
          ctx.moveTo(x + 0.5, -20);
          ctx.lineTo(x + 0.5, H + 20);
        }
        for (var y = 0; y <= H; y += 36) {
          ctx.moveTo(-20, y + 0.5);
          ctx.lineTo(W + 20, y + 0.5);
        }
        ctx.stroke();

        var scan = (t * 0.04) % 1;
        ctx.fillStyle = 'rgba(56, 189, 248, 0.02)';
        ctx.fillRect(-20, scan * 620 - 60, W + 40, 80);
      }

      function drawField() {
        ctx.save();
        ctx.shadowColor = 'rgba(56, 189, 248, 0.22)';
        ctx.shadowBlur = 22;
        ctx.fillStyle = 'rgba(7, 14, 28, 0.72)';
        roundRect(ctx, FX, FY, FW, FH, 16);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, FX + 0.5, FY + 0.5, FW - 1, FH - 1, 16);
        ctx.stroke();

        /* 四角装饰 */
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 2;
        var cs = 16;
        var corners = [
          [FX + 8, FY + 8, 1, 1],
          [FX + FW - 8, FY + 8, -1, 1],
          [FX + 8, FY + FH - 8, 1, -1],
          [FX + FW - 8, FY + FH - 8, -1, -1]
        ];
        for (var i = 0; i < corners.length; i++) {
          var c = corners[i];
          ctx.beginPath();
          ctx.moveTo(c[0], c[1] + c[3] * cs);
          ctx.lineTo(c[0], c[1]);
          ctx.lineTo(c[0] + c[2] * cs, c[1]);
          ctx.stroke();
        }
      }

      function pathStroke() {
        ctx.beginPath();
        ctx.moveTo(PATH[0].x, PATH[0].y);
        for (var i = 1; i < PATH.length; i++) ctx.lineTo(PATH[i].x, PATH[i].y);
      }

      function drawPath(t) {
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.10)';
        ctx.lineWidth = 54;
        pathStroke();
        ctx.stroke();

        ctx.strokeStyle = '#0a1424';
        ctx.lineWidth = 44;
        pathStroke();
        ctx.stroke();

        ctx.strokeStyle = '#101d33';
        ctx.lineWidth = 36;
        pathStroke();
        ctx.stroke();

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.20)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([14, 18]);
        ctx.lineDashOffset = -(t * 24) % 32;
        pathStroke();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      function drawChevrons(t) {
        var off = (t * 46) % 64;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        for (var d = off; d < PATH_LEN - 12; d += 64) {
          posAt(d, pScratch);
          var c = Math.cos(pScratch.ang);
          var s = Math.sin(pScratch.ang);
          ctx.beginPath();
          ctx.moveTo(pScratch.x - c * 6 - s * 5, pScratch.y - s * 6 + c * 5);
          ctx.lineTo(pScratch.x + c * 3, pScratch.y + s * 3);
          ctx.lineTo(pScratch.x - c * 6 + s * 5, pScratch.y - s * 6 - c * 5);
          ctx.stroke();
        }
      }

      function drawPlots(t) {
        for (var i = 0; i < plots.length; i++) {
          var p = plots[i];
          var occupied = !!p.tower;
          var selected = (p === selectedPlot);
          var hovered = (p === hoverPlot);
          var x = p.x - PLOT_SIZE / 2;
          var y = p.y - PLOT_SIZE / 2;

          if (!occupied) {
            ctx.fillStyle = selected
              ? 'rgba(56, 189, 248, 0.16)'
              : (hovered ? 'rgba(56, 189, 248, 0.10)' : 'rgba(56, 189, 248, 0.04)');
            roundRect(ctx, x, y, PLOT_SIZE, PLOT_SIZE, 10);
            ctx.fill();
          }

          ctx.save();
          if (selected) {
            ctx.strokeStyle = 'rgba(125, 211, 252, 0.95)';
            ctx.lineWidth = 2;
            ctx.setLineDash([7, 5]);
            ctx.lineDashOffset = -(t * 20) % 24;
          } else if (hovered && !occupied) {
            ctx.strokeStyle = 'rgba(125, 211, 252, 0.7)';
            ctx.lineWidth = 1.6;
            ctx.setLineDash([6, 5]);
          } else {
            ctx.strokeStyle = 'rgba(56, 189, 248, ' + (occupied ? 0.16 : 0.26) + ')';
            ctx.lineWidth = 1.2;
            ctx.setLineDash([6, 5]);
          }
          roundRect(ctx, x + 0.5, y + 0.5, PLOT_SIZE - 1, PLOT_SIZE - 1, 10);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();

          if (!occupied) {
            ctx.strokeStyle = selected ? 'rgba(186, 230, 253, 0.95)' : 'rgba(56, 189, 248, 0.35)';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(p.x - 7, p.y);
            ctx.lineTo(p.x + 7, p.y);
            ctx.moveTo(p.x, p.y - 7);
            ctx.lineTo(p.x, p.y + 7);
            ctx.stroke();
          }
        }
      }

      function drawBase(t) {
        var bx = 676;
        var by = 396;
        var low = baseHp <= 6;
        var pulse = low ? 0.55 + 0.45 * Math.sin(t * 7) : 1;

        ctx.save();
        ctx.shadowColor = low
          ? 'rgba(248, 113, 113, ' + (0.45 + pulse * 0.45).toFixed(3) + ')'
          : 'rgba(56, 189, 248, 0.55)';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#0d1a30';
        roundRect(ctx, bx - 30, by - 38, 60, 76, 12);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = low ? 'rgba(248, 113, 113, 0.85)' : 'rgba(56, 189, 248, 0.6)';
        ctx.lineWidth = 2;
        roundRect(ctx, bx - 29, by - 37, 58, 74, 11);
        ctx.stroke();

        /* 盾牌 */
        ctx.save();
        ctx.translate(bx, by - 2);
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(14, -9);
        ctx.lineTo(14, 4);
        ctx.quadraticCurveTo(14, 15, 0, 20);
        ctx.quadraticCurveTo(-14, 15, -14, 4);
        ctx.lineTo(-14, -9);
        ctx.closePath();
        ctx.fillStyle = low ? 'rgba(248, 113, 113, 0.22)' : 'rgba(56, 189, 248, 0.18)';
        ctx.fill();
        ctx.strokeStyle = low ? '#f87171' : '#7dd3fc';
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.fillStyle = low ? 'rgba(254, 205, 211, 0.9)' : 'rgba(186, 230, 253, 0.9)';
        ctx.font = '900 15px "Consolas", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('HP', 0, 4);
        ctx.restore();

        /* 血条 */
        var bw = 52;
        var bh = 6;
        var bxx = bx - 26;
        var byy = by - 52;
        ctx.fillStyle = 'rgba(8, 14, 26, 0.9)';
        roundRect(ctx, bxx, byy, bw, bh, 3);
        ctx.fill();
        var ratio = Math.max(0, baseHp / 20);
        ctx.fillStyle = ratio > 0.5 ? '#34d399' : ratio > 0.25 ? '#fbbf24' : '#f87171';
        roundRect(ctx, bxx, byy, Math.max(1.5, bw * ratio), bh, 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
        ctx.lineWidth = 1;
        roundRect(ctx, bxx + 0.5, byy + 0.5, bw - 1, bh - 1, 3);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.font = '700 10px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillStyle = low ? '#f87171' : 'rgba(186, 230, 253, 0.85)';
        ctx.fillText('基地 ' + baseHp + '/20', bx, by + 52);
      }

      function drawSpawn(t) {
        var sx = 24;
        var sy = 124;
        ctx.save();
        ctx.shadowColor = 'rgba(139, 92, 246, 0.8)';
        ctx.shadowBlur = 16;
        ctx.strokeStyle = 'rgba(167, 139, 250, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(t * 0.8);
        ctx.strokeStyle = 'rgba(167, 139, 250, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 9]);
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        var pulse = 0.5 + 0.5 * Math.sin(t * 4);
        ctx.fillStyle = 'rgba(139, 92, 246, ' + (0.14 + pulse * 0.2).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(sx, sy, 8 + pulse * 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.font = '700 10px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillStyle = 'rgba(196, 181, 253, 0.8)';
        ctx.fillText('出生点', 8, 158);
      }

      /* ---------- 绘制：塔 / 敌人 / 子弹 ---------- */

      function drawRange(x, y, range, color, t) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.30;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([6, 6]);
        ctx.lineDashOffset = -(t * 18) % 24;
        ctx.beginPath();
        ctx.arc(x, y, range, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
      }

      function drawTower(tw, t) {
        var def = TOWER_DEFS[tw.type];
        var st = def.levels[tw.lvl];
        var scale = 1;
        if (tw.spawn > 0) {
          var p = 1 - tw.spawn / 0.3;
          scale = 0.4 + 0.6 * easeOutBack(p);
        }

        if (tw === selectedTower || tw === hoverTower) {
          drawRange(tw.x, tw.y, st.range, def.color, t);
        }

        ctx.save();
        ctx.translate(tw.x, tw.y);
        if (scale !== 1) ctx.scale(scale, scale);

        ctx.fillStyle = '#0c1828';
        roundRect(ctx, -19, -19, 38, 38, 9);
        ctx.fill();
        ctx.strokeStyle = def.color;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.4;
        roundRect(ctx, -18.5, -18.5, 37, 37, 9);
        ctx.stroke();
        ctx.globalAlpha = 1;

        ctx.save();
        ctx.shadowColor = def.glow;
        ctx.shadowBlur = tw.flash > 0 ? 18 : 9;
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.rotate(tw.angle);
        if (tw.type === 0) {
          ctx.fillStyle = '#e0f2fe';
          ctx.beginPath();
          ctx.moveTo(15, 0);
          ctx.lineTo(0, -5);
          ctx.lineTo(2, 0);
          ctx.lineTo(0, 5);
          ctx.closePath();
          ctx.fill();
        } else if (tw.type === 1) {
          ctx.fillStyle = '#ede9fe';
          ctx.beginPath();
          ctx.moveTo(12, 0);
          ctx.lineTo(6, -5);
          ctx.lineTo(2, 0);
          ctx.lineTo(6, 5);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#c4b5fd';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(3, 0, 9, -Math.PI * 0.3, Math.PI * 0.3);
          ctx.stroke();
        } else {
          ctx.fillStyle = '#fdba74';
          roundRect(ctx, 0, -5, 17, 10, 3);
          ctx.fill();
          ctx.fillStyle = '#431407';
          ctx.beginPath();
          ctx.arc(16, 0, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        var lv = tw.lvl + 1;
        for (var i = 0; i < 3; i++) {
          ctx.fillStyle = i < lv ? def.color : 'rgba(148, 163, 184, 0.25)';
          ctx.beginPath();
          ctx.arc(-8 + i * 8, 15, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      function drawTowers(t) {
        for (var i = 0; i < towers.length; i++) drawTower(towers[i], t);
      }

      function drawEnemy(e, t) {
        var def = e.def;
        var r = e.r;
        var ratio = Math.max(0, e.hp / e.maxHp);

        ctx.save();
        ctx.translate(e.x, e.y);

        if (e.slowT > 0) {
          ctx.strokeStyle = 'rgba(167, 139, 250, 0.55)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
          ctx.stroke();
        }

        var shadow = e.kind === 'boss';
        if (shadow) {
          ctx.save();
          ctx.shadowColor = def.glow;
          ctx.shadowBlur = 16;
        }
        ctx.fillStyle = def.color;
        if (e.kind === 'grunt') {
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
        } else if (e.kind === 'runner') {
          ctx.beginPath();
          ctx.moveTo(r * 1.15, 0);
          ctx.lineTo(0, -r);
          ctx.lineTo(-r * 1.15, 0);
          ctx.lineTo(0, r);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          for (var i = 0; i < 6; i++) {
            var a = Math.PI / 3 * i + (e.kind === 'boss' ? t * 0.6 : 0);
            var px = Math.cos(a) * r;
            var py = Math.sin(a) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        }
        if (shadow) ctx.restore();

        ctx.fillStyle = 'rgba(8, 12, 24, 0.55)';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
        ctx.fill();

        if (e.hit > 0) {
          ctx.globalAlpha = Math.min(0.75, e.hit * 5);
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        var bw = Math.max(20, r * 2 + 4);
        var by = -r - 10;
        ctx.fillStyle = 'rgba(6, 10, 20, 0.85)';
        roundRect(ctx, -bw / 2, by, bw, 4, 2);
        ctx.fill();
        ctx.fillStyle = ratio > 0.6 ? '#34d399' : ratio > 0.3 ? '#fbbf24' : '#f87171';
        roundRect(ctx, -bw / 2, by, Math.max(1.5, bw * ratio), 4, 2);
        ctx.fill();

        ctx.restore();
      }

      function drawEnemies(t) {
        for (var i = 0; i < enemies.length; i++) drawEnemy(enemies[i], t);
      }

      function drawBullets() {
        for (var i = 0; i < bullets.length; i++) {
          var b = bullets[i];
          if (b.type === 2) {
            ctx.fillStyle = 'rgba(251, 146, 60, 0.25)';
            ctx.beginPath();
            ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fed7aa';
            ctx.beginPath();
            ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
            ctx.fill();
          } else if (b.type === 1) {
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.rotate(b.ang || 0);
            ctx.fillStyle = '#ddd6fe';
            ctx.beginPath();
            ctx.moveTo(5, 0);
            ctx.lineTo(0, -3);
            ctx.lineTo(-5, 0);
            ctx.lineTo(0, 3);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          } else {
            var c = Math.cos(b.ang || 0);
            var s = Math.sin(b.ang || 0);
            ctx.strokeStyle = '#bae6fd';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(b.x - c * 12, b.y - s * 12);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            ctx.fillStyle = '#f0f9ff';
            ctx.beginPath();
            ctx.arc(b.x, b.y, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      function drawParticles() {
        for (var i = 0; i < particles.length; i++) {
          var p = particles[i];
          ctx.globalAlpha = Math.max(0, p.life / p.max) * 0.9;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      function drawRings() {
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
      }

      function drawFloaters() {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 12px "PingFang SC", "Microsoft YaHei", sans-serif';
        for (var i = 0; i < floaters.length; i++) {
          var f = floaters[i];
          ctx.globalAlpha = Math.max(0, f.life / f.max);
          ctx.fillStyle = f.color;
          ctx.fillText(f.text, f.x, f.y);
        }
        ctx.globalAlpha = 1;
      }

      /* ---------- 绘制：UI ---------- */

      function drawButton(r, label, enabled, color, fs) {
        var hov = hoverBtn === r.id && enabled;
        ctx.save();
        if (hov) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 12;
        }
        ctx.fillStyle = enabled
          ? (hov ? 'rgba(28, 48, 76, 0.98)' : 'rgba(18, 32, 54, 0.95)')
          : 'rgba(18, 24, 38, 0.7)';
        roundRect(ctx, r.x, r.y, r.w, r.h, 9);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = enabled ? color : 'rgba(100, 116, 139, 0.35)';
        ctx.globalAlpha = enabled ? (hov ? 1 : 0.6) : 0.5;
        ctx.lineWidth = hov ? 2 : 1.4;
        roundRect(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 9);
        ctx.stroke();
        ctx.globalAlpha = 1;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = enabled ? '#e2e8f0' : 'rgba(148, 163, 184, 0.6)';
        ctx.font = '700 ' + fs + 'px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
      }

      function drawTowerIcon(def, cx, cy, s) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.strokeStyle = def.color;
        ctx.globalAlpha = 0.65;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, 9 * s, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = def.color;
        if (def.key === 'arrow') {
          ctx.beginPath();
          ctx.moveTo(0, -6 * s);
          ctx.lineTo(4.6 * s, 4.5 * s);
          ctx.lineTo(-4.6 * s, 4.5 * s);
          ctx.closePath();
          ctx.fill();
        } else if (def.key === 'frost') {
          ctx.beginPath();
          ctx.moveTo(0, -6.5 * s);
          ctx.lineTo(4.6 * s, 0);
          ctx.lineTo(0, 6.5 * s);
          ctx.lineTo(-4.6 * s, 0);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, 4 * s, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(-1.8 * s, -6.5 * s, 3.6 * s, 5 * s);
        }
        ctx.restore();
      }

      function drawTopBar(t) {
        ctx.fillStyle = 'rgba(9, 16, 30, 0.9)';
        roundRect(ctx, FX, 8, FW, 40, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
        ctx.lineWidth = 1;
        roundRect(ctx, FX + 0.5, 8.5, FW - 1, 39, 12);
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(56, 189, 248, 0.9)';
        ctx.font = '900 11px "Consolas", monospace';
        ctx.fillText('NEON TOWER', 24, 28);

        var status;
        if (phase === 'prep') {
          status = '布防中 · 点击空地建造防御塔';
        } else if (phase === 'wave') {
          status = '第 ' + wave + ' / 10 波 · 场上 ' + enemies.length + ' 只敌人';
        } else {
          status = endResult && endResult.won ? '防线完成' : '基地失守';
        }
        ctx.fillStyle = 'rgba(226, 232, 240, 0.92)';
        ctx.font = '700 13px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText(status, 128, 28);

        var nextLabel;
        var nextEnabled;
        if (phase === 'prep') {
          nextLabel = '开始第 ' + (wave + 1) + ' 波 · ' + Math.ceil(Math.max(0, prepTimer)) + 's';
          nextEnabled = true;
        } else if (phase === 'wave') {
          nextLabel = '波次进行中';
          nextEnabled = false;
        } else {
          nextLabel = '战斗结束';
          nextEnabled = false;
        }
        drawButton(BTN_NEXT, nextLabel, nextEnabled, '#38bdf8', 12);
        drawButton(BTN_SPEED, speedMul === 2 ? '速度 2×' : '速度 1×', phase !== 'ending', '#8b5cf6', 12);
      }

      function drawTowerCard(i, t) {
        var def = TOWER_DEFS[i];
        var r = CARD_RECTS[i];
        var afford = gold >= def.cost;
        var canBuild = !!selectedPlot && afford && !selectedPlot.tower;
        var hov = hoverBtn === r.id;

        ctx.save();
        if (canBuild) {
          ctx.shadowColor = def.glow;
          ctx.shadowBlur = 10 + Math.sin(t * 5) * 3;
        }
        ctx.fillStyle = hov ? 'rgba(30, 48, 78, 0.98)' : 'rgba(18, 30, 50, 0.92)';
        roundRect(ctx, r.x, r.y, r.w, r.h, 9);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = def.color;
        ctx.globalAlpha = canBuild ? 0.9 : (afford ? 0.45 : 0.2);
        ctx.lineWidth = canBuild ? 1.8 : 1.2;
        roundRect(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 9);
        ctx.stroke();
        ctx.globalAlpha = 1;

        drawTowerIcon(def, r.x + 18, r.y + 20, 0.82);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = afford ? '#e2e8f0' : 'rgba(148, 163, 184, 0.6)';
        ctx.font = '700 12px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText(def.name, r.x + 34, r.y + 17);

        ctx.fillStyle = afford ? '#fbbf24' : 'rgba(248, 113, 113, 0.8)';
        ctx.font = '700 11px "Consolas", monospace';
        ctx.fillText(def.cost + ' 金', r.x + 34, r.y + 32);

        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
        ctx.font = '700 9px "Consolas", monospace';
        ctx.fillText(String(i + 1), r.x + r.w - 8, r.y + 13);
      }

      function drawBottomBar(t) {
        ctx.fillStyle = 'rgba(9, 16, 30, 0.9)';
        roundRect(ctx, FX, BOT_Y, FW, BOT_H, 14);
        ctx.fill();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
        ctx.lineWidth = 1;
        roundRect(ctx, FX + 0.5, BOT_Y + 0.5, FW - 1, BOT_H - 1, 14);
        ctx.stroke();

        for (var i = 0; i < 3; i++) drawTowerCard(i, t);

        /* 选中信息 */
        var x = 396;
        var y1 = 503;
        var y2 = 519;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        if (selectedTower) {
          var def = TOWER_DEFS[selectedTower.type];
          var st = def.levels[selectedTower.lvl];
          ctx.fillStyle = def.color;
          ctx.font = '700 12px "PingFang SC", "Microsoft YaHei", sans-serif';
          ctx.fillText(def.name + ' Lv' + (selectedTower.lvl + 1), x, y1);
          var detail;
          if (def.key === 'frost') {
            detail = '减速 ' + Math.round(st.slow * 100) + '% · ' + st.slowT.toFixed(1) + 's · 伤害 ' + st.dmg;
          } else if (def.key === 'cannon') {
            detail = '伤害 ' + st.dmg + ' · 范围 ' + st.splash + ' · 冷却 ' + st.cd.toFixed(2) + 's';
          } else {
            detail = '伤害 ' + st.dmg + ' · 射速 ' + st.cd.toFixed(2) + 's';
          }
          ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
          ctx.font = '600 10px "PingFang SC", "Microsoft YaHei", sans-serif';
          ctx.fillText(detail, x, y2);
        } else if (selectedPlot) {
          ctx.fillStyle = '#7dd3fc';
          ctx.font = '700 12px "PingFang SC", "Microsoft YaHei", sans-serif';
          ctx.fillText('建造格已选中', x, y1);
          ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
          ctx.font = '600 10px "PingFang SC", "Microsoft YaHei", sans-serif';
          ctx.fillText('点击塔卡或按 1/2/3 建造', x, y2);
        } else {
          ctx.fillStyle = 'rgba(226, 232, 240, 0.78)';
          ctx.font = '700 12px "PingFang SC", "Microsoft YaHei", sans-serif';
          ctx.fillText('布防阶段', x, y1);
          ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
          ctx.font = '600 10px "PingFang SC", "Microsoft YaHei", sans-serif';
          ctx.fillText('点击空地建塔 · 点击塔可升级出售', x, y2);
        }

        /* 升级 / 出售 */
        var upEnabled = !!selectedTower && selectedTower.lvl < 2 && gold >= TOWER_DEFS[selectedTower.type].upCost[selectedTower.lvl];
        var upLabel;
        if (!selectedTower) upLabel = '升级 —';
        else if (selectedTower.lvl >= 2) upLabel = '已满级';
        else upLabel = '升级 ' + TOWER_DEFS[selectedTower.type].upCost[selectedTower.lvl];
        drawButton(BTN_UP, upLabel, upEnabled, '#34d399', 10);

        var sellLabel = selectedTower ? '出售 +' + Math.floor(selectedTower.invested * 0.6) : '出售 —';
        drawButton(BTN_SELL, sellLabel, !!selectedTower, '#f87171', 10);
      }

      function drawWaveBanner() {
        if (bannerT <= 0) return;
        var alpha = Math.min(1, (1.5 - bannerT) * 6, bannerT * 2.2);
        if (alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.save();
        ctx.shadowColor = 'rgba(56, 189, 248, 0.9)';
        ctx.shadowBlur = 24;
        ctx.fillStyle = '#e0f2fe';
        ctx.font = '900 34px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText('第 ' + bannerWave + ' 波', 360, 208);
        ctx.restore();
        ctx.fillStyle = 'rgba(165, 200, 240, 0.9)';
        ctx.font = '700 13px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText('敌人来袭', 360, 242);
        ctx.restore();
      }

      function drawDanger(t) {
        if (baseHp > 6 || phase === 'ending') return;
        var pulse = 0.35 + 0.35 * Math.sin(t * 6);
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.fillStyle = dangerGrad;
        ctx.fillRect(-20, -20, W + 40, H + 40);
        ctx.restore();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '900 14px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillStyle = 'rgba(248, 113, 113, ' + (0.6 + pulse * 0.4).toFixed(3) + ')';
        ctx.fillText('基地告急！', 360, 118);
      }

      function drawEnding() {
        var a = Math.min(0.55, (1.5 - endTimer) * 0.9);
        ctx.fillStyle = 'rgba(5, 8, 18, ' + a.toFixed(3) + ')';
        ctx.fillRect(-20, -20, W + 40, H + 40);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var win = !!(endResult && endResult.won);
        ctx.save();
        ctx.shadowColor = win ? 'rgba(52, 211, 153, 0.9)' : 'rgba(244, 63, 94, 0.9)';
        ctx.shadowBlur = 26;
        ctx.fillStyle = win ? '#a7f3d0' : '#fecdd3';
        ctx.font = '900 36px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText(win ? '防线守住！' : '基地失守', 360, 240);
        ctx.restore();
        ctx.fillStyle = 'rgba(203, 213, 225, 0.85)';
        ctx.font = '600 14px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText(win ? '10 波敌人已全部击退' : '正在统计战果…', 360, 284);
      }

      reset();

      return {
        update: function (dt) {
          elapsed += dt;
          var sdt = dt * speedMul;

          if (shake > 0) shake = Math.max(0, shake - dt * 30);
          if (damageFlash > 0) damageFlash = Math.max(0, damageFlash - dt * 2);
          if (bannerT > 0) bannerT = Math.max(0, bannerT - dt);
          if (shotSfxCd > 0) shotSfxCd = Math.max(0, shotSfxCd - dt);

          if (hudDirty) {
            updateHud();
            hudDirty = false;
          }
          if (statusDirty) {
            updateStatus();
            statusDirty = false;
          }

          if (phase === 'ending') {
            updateEffects(dt);
            endTimer -= dt;
            if (endTimer <= 0 && !ended) {
              ended = true;
              finish();
            }
            return;
          }

          if (phase === 'prep') {
            prepTimer -= sdt;
            if (prepTimer <= 0) startWave();
          } else if (phase === 'wave') {
            spawnTimer -= sdt;
            while (spawnTimer <= 0 && spawnIdx < spawnList.length) {
              spawnEnemy(spawnList[spawnIdx]);
              spawnIdx++;
              spawnTimer += spawnGap;
            }
          }

          updateEnemies(sdt);
          updateTowers(sdt);
          updateBullets(sdt);
          updateEffects(sdt);

          if (phase === 'wave' && spawnIdx >= spawnList.length && enemies.length === 0) {
            completeWave();
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
          drawField();
          drawPath(t);
          drawChevrons(t);
          drawPlots(t);
          drawBase(t);
          drawSpawn(t);
          drawTowers(t);
          drawEnemies(t);
          drawBullets();
          drawParticles();
          drawRings();
          drawFloaters();
          drawWaveBanner();
          if (damageFlash > 0) {
            ctx.fillStyle = 'rgba(244, 63, 94, ' + Math.min(0.32, damageFlash * 0.5).toFixed(3) + ')';
            roundRect(ctx, FX, FY, FW, FH, 16);
            ctx.fill();
          }
          drawDanger(t);
          drawTopBar(t);
          drawBottomBar(t);
          if (phase === 'ending') drawEnding();
          ctx.restore();
        },

        onKeyDown: function (code) {
          if (ended) return;
          if (code === 'Space') {
            if (phase === 'prep') startWave();
            return;
          }
          if (code === 'Digit1' || code === 'Numpad1') buildOnSelected(0);
          else if (code === 'Digit2' || code === 'Numpad2') buildOnSelected(1);
          else if (code === 'Digit3' || code === 'Numpad3') buildOnSelected(2);
          else if (code === 'KeyU') upgradeSelected();
          else if (code === 'KeyS') sellSelected();
        },

        onPointerDown: function (x, y) {
          if (ended) return;
          var btn = buttonAt(x, y);
          if (btn) {
            handleButton(btn);
            return;
          }
          if (y >= BOT_Y) return;
          if (y < FY) return;

          var tw = towerAt(x, y);
          if (tw) {
            selectedTower = tw;
            selectedPlot = null;
            rt.audio.play('click', 0.5);
            return;
          }
          var pl = plotAt(x, y);
          if (pl) {
            if (pl.tower) {
              selectedTower = pl.tower;
              selectedPlot = null;
            } else {
              selectedPlot = pl;
              selectedTower = null;
            }
            rt.audio.play('click', 0.5);
            return;
          }
          selectedTower = null;
          selectedPlot = null;
          rt.audio.play('click', 0.28);
        },

        onPointerMove: function (x, y) {
          hoverBtn = buttonAt(x, y);
          hoverPlot = null;
          hoverTower = null;
          if (hoverBtn) return;
          if (x >= FX && x <= FX + FW && y >= FY && y <= FY + FH) {
            hoverTower = towerAt(x, y);
            if (!hoverTower) hoverPlot = plotAt(x, y);
          }
        }
      };
    }
  });
})();
