/* ==========================================================================
   R ARCHIVE · home.js
   首页：电影级启动、折射晶体核心、极光冷雾、景深粒子、
   滚动驱动镜头、文字遮罩、空间排版与 WebGL 降级。
   ========================================================================== */
(function () {
  'use strict';

  var Museum = window.Museum;
  if (!Museum) return;
  var U = Museum.util;
  var DATA = window.MUSEUM_GAMES || { games: [], tags: [], count: 0 };
  var GAMES = DATA.games || [];
  var TAG_COUNT = (DATA.tags || []).length;
  var COUNT = DATA.count || GAMES.length;

  var state = {
    active: false,
    root: null,
    raf: 0,
    scrollRaf: 0,
    disposers: [],
    webgl: null,
    fallback: null,
    reduced: false,
    introDone: false,
    ready: false,
    heroParallax: 0
  };

  /* ------------------------------------------------------------------ */
  /* 模板                                                               */
  /* ------------------------------------------------------------------ */
  var PREVIEW_IDS = ['snake', 'suika', 'pool', 'xiangqi', 'minesweeper', 'tetris', 'survivor', 'gomoku'];

  function previewGames() {
    var out = [];
    PREVIEW_IDS.forEach(function (id) {
      var g = GAMES.filter(function (x) { return x.id === id; })[0];
      if (g) out.push(g);
    });
    GAMES.forEach(function (g) { if (out.length < 8 && out.indexOf(g) < 0) out.push(g); });
    return out.slice(0, 8);
  }

  function previewHtml() {
    return previewGames().map(function (g, i) {
      return '<a class="exhibit-strip__item" href="#/game/' + encodeURIComponent(g.id) + '" ' +
        'style="--i:' + i + '" aria-label="查看展品：' + U.esc(g.title) + '">' +
        '<span class="exhibit-strip__no mono">' + U.pad2(i + 1) + '</span>' +
        Museum.coverHtml(g) +
        '<span class="exhibit-strip__name">' + U.esc(g.title) + '</span>' +
        '<span class="exhibit-strip__meta mono">' + U.esc((g.tags || [])[0] || 'EXHIBIT') + '</span>' +
        '</a>';
    }).join('');
  }

  function template() {
    var tags = (DATA.tags || []).slice(0, 8).map(function (t) { return U.esc(t); }).join(' · ');
    return '' +
      '<section class="view view--home" data-view="home">' +
        '<div class="webgl-fallback" id="webgl-fallback" hidden aria-hidden="true">' +
          '<div class="fallback-aurora"></div>' +
          '<div class="fallback-core">' +
            '<span class="fallback-core__ring"></span>' +
            '<span class="fallback-core__ring fallback-core__ring--2"></span>' +
            '<span class="fallback-core__ring fallback-core__ring--3"></span>' +
            '<span class="fallback-core__body"></span>' +
            '<span class="fallback-core__glow"></span>' +
          '</div>' +
          '<div class="fallback-dust"></div>' +
        '</div>' +

        '<header class="hero" id="home-hero">' +
          '<div class="hero__frame">' +
            '<div class="hero__top">' +
              '<p class="kicker kicker--ice">THE DIGITAL COLLECTION</p>' +
            '</div>' +

            '<div class="hero__titlewrap">' +
              '<h1 class="hero__title" aria-label="R-数字藏馆 R ARCHIVE · R-数字藏馆">' +
                '<span class="mask-line hero__line"><span class="hero__serif">R —</span></span>' +
                '<span class="mask-line hero__line hero__line--outline"><span class="hero__outline">数字藏馆</span></span>' +
              '</h1>' +
              '<span class="hero__zh" aria-hidden="true">数字藏馆</span>' +
            '</div>' +

            '<div class="hero__bottom">' +
              '<div class="hero__intro">' +
                '<p class="hero__lede">有些事物，只在你触碰它时发生。<br>' +
                  '穿过一座展厅，翻开一页书，看一缕光如何获得重量。</p>' +
                '<div class="hero__actions">' +
                  '<a class="btn btn-solid" href="#/hall" data-magnetic><span>进入游戏展映</span><i aria-hidden="true">↗</i></a>' +
                  '<a class="btn btn-line" href="#/books" data-magnetic><span>书籍</span><i aria-hidden="true">→</i></a>' +
                '</div>' +
              '</div>' +
              '<dl class="hero__stats" aria-label="馆藏统计">' +
                '<div><dt>EXHIBITS</dt><dd data-stat="exhibits">' + COUNT + '</dd></div>' +
                '<div><dt>GENRES</dt><dd data-stat="genres">' + TAG_COUNT + '</dd></div>' +
              '</dl>' +
            '</div>' +

            '<div class="hero__scroll" aria-hidden="true">' +
              '<span class="mono">SCROLL&nbsp;TO&nbsp;ADVANCE</span><i></i>' +
            '</div>' +
            '<p class="webgl-note" id="webgl-note" hidden>LOW-LIGHT MODE · 静态晶体预览</p>' +
          '</div>' +
        '</header>' +

        '<section class="chapter chapter--core" id="chapter-core" aria-labelledby="chapter-core-title">' +
          '<div class="chapter__aside" data-reveal>' +
            '<p class="kicker">01 / THE CORE</p>' +
            '<p class="chapter__index mono">单晶 · REFRACTIVE CORE</p>' +
          '</div>' +
          '<div class="chapter__body">' +
            '<h2 class="chapter__title display" id="chapter-core-title">' +
              '<span class="mask-line"><span>THE</span></span>' +
              '<span class="mask-line"><span><em>CRYSTAL</em></span></span>' +
              '<span class="mask-line"><span class="outline">CORE</span></span>' +
            '</h2>' +
            '<p class="lede" data-reveal>清晨经过同一扇窗，昨天的光已经不在。' +
              '向前走一步，看看晶体把今天的光留在哪一面。</p>' +
            '<div class="chapter__facts" data-reveal>' +
              '<div><span class="mono">MATERIAL</span><strong>折射玻璃 / 拉丝银</strong></div>' +
              '<div><span class="mono">LIGHT</span><strong>冰蓝点光 · 冷雾</strong></div>' +
              '<div><span class="mono">CAMERA</span><strong>滚动驱动 · 五段镜头</strong></div>' +
            '</div>' +
          '</div>' +
          '<div class="chapter__window" data-reveal aria-hidden="true">' +
            '<span class="chapter__window-label mono">REFRACTION&nbsp;/&nbsp;001</span>' +
            '<i class="chapter__window-line"></i>' +
          '</div>' +
        '</section>' +

        '<section class="chapter chapter--hall" id="chapter-hall" aria-labelledby="chapter-hall-title">' +
          '<div class="chapter__hall-top">' +
            '<p class="kicker">02 / THE EXHIBITS</p>' +
            '<p class="chapter__index mono">' + U.esc(tags) + '</p>' +
          '</div>' +
          '<h2 class="chapter__statement display" id="chapter-hall-title" data-reveal>' +
            '<span class="mask-line"><span>' + COUNT + '</span></span>' +
            '<span class="mask-line"><span><em>件可玩的</em></span></span>' +
            '<span class="mask-line"><span>数字藏品</span></span>' +
          '</h2>' +
          '<p class="chapter__sub lede" data-reveal>从俄罗斯方块到中国象棋，从合成大西瓜到弹幕生存。' +
            '滚动向前，走近一幅画，便走进一种玩法。</p>' +
          '<div class="exhibit-strip" id="exhibit-strip">' + previewHtml() + '</div>' +
          '<div class="chapter__cta" data-reveal>' +
            '<a class="btn btn-line" href="#/hall" data-magnetic><span>浏览游戏展映</span><i aria-hidden="true">↗</i></a>' +
            '<a class="btn btn-ghost" href="#/licenses">开放源代码与许可 <span aria-hidden="true">→</span></a>' +
          '</div>' +
        '</section>' +

        '<section class="chapter chapter--rooms" id="chapter-rooms" aria-labelledby="chapter-rooms-title">' +
          '<p class="kicker">03 / OTHER ROOMS</p>' +
          '<h2 class="chapter__statement display" id="chapter-rooms-title" data-reveal>' +
            '<span class="mask-line"><span>沿着光</span></span>' +
            '<span class="mask-line"><span><em>再走一程</em></span></span>' +
          '</h2>' +
          '<div class="rooms">' +
            '<a class="room room--form" href="#/sculptures"><img src="assets/plates/tide.webp" loading="lazy" alt=""><span class="room__title">数字雕塑</span><span class="room__copy">从时隙的金属圆环，到茉子的脸部轮廓。走近作品，换个角度。</span><span class="room__arrow">↗</span></a>' +
            '<a class="room room--novels" href="#/books" data-magnetic="false">' +
              '<span class="room__no mono">ROOM / 01</span>' +
              '<span class="room__icon" aria-hidden="true">' +
                '<svg viewBox="0 0 60 60" fill="none"><path d="M10 14h18v34H10zM32 14h18v34H32z" stroke="currentColor" stroke-width="1"/>' +
                '<path d="M14 20h10M14 26h10M36 20h10M36 26h10" stroke="currentColor" stroke-width=".8" opacity=".6"/>' +
                '<path d="M30 8v8" stroke="currentColor" stroke-width=".8" opacity=".5"/></svg>' +
              '</span>' +
              '<span class="room__title">书籍</span>' +
              '<span class="room__en mono">THE READING ROOM</span>' +
              '<span class="room__copy">从一只门把手到宇宙诞生，十八部作品，各自留下一种看世界的角度。</span>' +
              '<span class="room__state mono">十八部 · 阅读</span>' +
              '<span class="room__arrow" aria-hidden="true">→</span>' +
            '</a>' +
            '<button type="button" class="room room--vinyl" id="room-vinyl">' +
              '<span class="room__no mono">ROOM / 02</span>' +
              '<span class="room__icon" aria-hidden="true">' +
                '<svg viewBox="0 0 60 60" fill="none"><circle cx="30" cy="30" r="20" stroke="currentColor" stroke-width="1"/>' +
                '<circle cx="30" cy="30" r="6" stroke="currentColor" stroke-width="1"/>' +
                '<path d="M30 10v4M30 46v4M10 30h4M46 30h4" stroke="currentColor" stroke-width=".9" opacity=".6"/></svg>' +
              '</span>' +
              '<span class="room__title">黑银唱片</span>' +
              '<span class="room__en mono">THE VINYL ROOM</span>' +
              '<span class="room__copy">从《过》到《灰色头像》，选一首唱片，让它陪你走过下一间展厅。</span>' +
              '<span class="room__state mono" id="room-vinyl-state">' + (window.MUSEUM_TRACKS || []).length + ' 首馆藏歌曲</span>' +
              '<span class="room__arrow" aria-hidden="true">✦</span>' +
            '</button>' +
          '</div>' +
        '</section>' +

        '<section class="home-outro" aria-labelledby="outro-title">' +
          '<div class="home-outro__inner">' +
            '<p class="kicker kicker--ice">回到入口</p>' +
            '<h2 class="home-outro__title display" id="outro-title" data-reveal>' +
              '<span class="mask-line"><span>每一次回望</span></span>' +
              '<span class="mask-line"><span><em>都有新的光</em></span></span>' +
            '</h2>' +
            '<p class="home-outro__copy" data-reveal>无需登录，没有广告，没有追踪。存档只留在你的浏览器里。<br>' +
              '在这里，游戏保存反应，书页保存犹疑，雕塑保存光经过的痕迹。</p>' +
            '<div class="home-outro__actions" data-reveal>' +
              '<a class="btn btn-solid" href="#/hall" data-magnetic><span>进入展厅</span><i aria-hidden="true">↗</i></a>' +
              '<button type="button" class="btn btn-line" id="home-replay-intro"><span>重放开场</span><i aria-hidden="true">↻</i></button>' +
            '</div>' +
            '<p class="home-outro__fine mono">LOCAL ARCHIVE&nbsp;&nbsp;/&nbsp;&nbsp;NO TRACKING&nbsp;&nbsp;/&nbsp;&nbsp;OPEN LICENSES</p>' +
          '</div>' +
        '</section>' +
      '</section>';
  }

  /* ------------------------------------------------------------------ */
  /* WebGL 场景                                                         */
  /* ------------------------------------------------------------------ */
  function makeEnvTexture(THREE, renderer) {
    var canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    var ctx = canvas.getContext('2d');
    var g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#0a0d11');
    g.addColorStop(0.42, '#1b2330');
    g.addColorStop(0.52, '#0a0d11');
    g.addColorStop(0.78, '#141b24');
    g.addColorStop(1, '#05070a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 512);

    function soft(x, y, rx, ry, color, alpha) {
      var rg = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
      rg.addColorStop(0, 'rgba(' + color + ',' + alpha + ')');
      rg.addColorStop(0.5, 'rgba(' + color + ',' + alpha * 0.35 + ')');
      rg.addColorStop(1, 'rgba(' + color + ',0)');
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, ry / Math.max(rx, ry));
      ctx.translate(-x, -y);
      ctx.fillStyle = rg;
      ctx.fillRect(x - rx * 2, y - ry * 2, rx * 4, ry * 4);
      ctx.restore();
    }
    soft(250, 160, 260, 80, '226,236,248', 0.85);
    soft(760, 210, 220, 60, '160,205,245', 0.55);
    soft(520, 60, 380, 40, '240,247,255', 0.75);
    soft(880, 380, 180, 60, '160,200,235', 0.35);
    ctx.fillStyle = 'rgba(248,251,255,0.9)';
    ctx.fillRect(0, 118, 1024, 2);
    ctx.fillStyle = 'rgba(240,248,255,0.25)';
    ctx.fillRect(0, 124, 1024, 1);

    ctx.fillStyle = "#f3f6fb"; ctx.fillRect(170, 80, 140, 260); ctx.fillRect(670, 100, 58, 175); ctx.fillStyle = "#7997ad"; ctx.fillRect(280, 382, 270, 32); var texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  function makeParticleSprite(THREE) {
    var c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.28, 'rgba(226,238,250,0.55)');
    grad.addColorStop(0.62, 'rgba(170,200,230,0.14)');
    grad.addColorStop(1, 'rgba(120,160,200,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makeAurora(THREE) {
    var geometry = new THREE.PlaneGeometry(2, 2);
    var material = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uScroll: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) }
      },
      vertexShader: [
        'varying vec2 vUv;',
        'void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }'
      ].join('\n'),
      fragmentShader: [
        'precision highp float;',
        'varying vec2 vUv;',
        'uniform float uTime;',
        'uniform vec2 uMouse;',
        'uniform float uScroll;',
        'uniform vec2 uRes;',
        'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
        'float noise(vec2 p){',
        '  vec2 i = floor(p); vec2 f = fract(p);',
        '  vec2 u = f*f*(3.0-2.0*f);',
        '  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x),',
        '             mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);',
        '}',
        'float fbm(vec2 p){',
        '  float v = 0.0; float a = 0.5;',
        '  for(int i=0;i<5;i++){ v += a*noise(p); p = p*2.03 + vec2(11.7, 7.3); a *= 0.5; }',
        '  return v;',
        '}',
        'void main(){',
        '  vec2 uv = (vUv - 0.5);',
        '  uv.x *= max(1.0, uRes.x / max(1.0, uRes.y));',
        '  float t = uTime * 0.022;',
        '  vec2 mouse = uMouse * 0.18;',
        '  vec2 q = uv * 1.25 + vec2(t * 0.6, -t * 0.35) + mouse;',
        '  float n = fbm(q);',
        '  float n2 = fbm(q * 1.9 + vec2(n * 0.9, uScroll * 0.4) - t * 0.7);',
        '  float band = smoothstep(0.28, 0.95, n2 * 0.85 + n * 0.45);',
        '  float curtain = sin((uv.y * 2.2 + n * 2.4 + uScroll * 0.7 - t * 1.4) * 2.4) * 0.5 + 0.5;',
        '  float glow = exp(-length(uv * vec2(0.85, 1.35)) * 1.45);',
        '  vec3 col = vec3(0.016, 0.019, 0.024);',
        '  col += vec3(0.62, 0.70, 0.80) * band * curtain * 0.16 * glow;',
        '  col += vec3(0.10, 0.24, 0.38) * pow(band * curtain, 3.0) * 0.34 * glow;',
        '  col += vec3(0.09, 0.11, 0.14) * (1.0 - glow) * 0.55;',
        '  col += vec3(0.30, 0.36, 0.44) * smoothstep(0.45, 0.5, band) * 0.05;',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n')
    });
    var mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    return mesh;
  }

  function createWebGL(host) {
    var THREE = window.THREE;
    if (!THREE) return null;

    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch (err) {
      return null;
    }
    if (!renderer || !renderer.getContext || !renderer.getContext()) return null;

    var mobile = Museum.env.mobile() || Museum.env.coarse();
    var dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x05070a, 1);
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    if ('toneMapping' in renderer) renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x06080b, 0.036);
    var camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 120);
    camera.position.set(0, 0.2, 10.6);

    var bgScene = new THREE.Scene();
    var bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    var aurora = makeAurora(THREE);
    bgScene.add(aurora);

    var pmrem = new THREE.PMREMGenerator(renderer);
    var envSource = makeEnvTexture(THREE, renderer);
    var envRT = pmrem.fromEquirectangular(envSource);
    scene.environment = envRT.texture;
    envSource.dispose();

    var group = new THREE.Group();
    scene.add(group);

    /* 外部晶体：折射玻璃 */
        // A cut crown and staggered pavilion produce different reflections on each facet.
    const facets = [], sides = 10;
    const point = (i,r,y,phase) => [r*Math.cos(i*2*Math.PI/sides+phase),y,r*Math.sin(i*2*Math.PI/sides+phase)];
    for(let i=0;i<sides;i++) {
      const a=point(i,.70,1.5,.15), b=point(i+1,.70,1.5,.15);
      const c=point(i,1.54,.34,0), d=point(i+1,1.54,.34,0);
      const e=point(i,1.12,-.65,.24), f=point(i+1,1.12,-.65,.24);
      for(const tri of [[[0,1.5,0],b,a],[a,b,c],[b,d,c],[c,d,e],[d,f,e],[e,f,[0,-1.72,0]]]) {
        facets.push(...tri.flat());
      }
    }
    var crystalGeo = new THREE.BufferGeometry();
    crystalGeo.setAttribute('position',new THREE.Float32BufferAttribute(facets,3));
    crystalGeo.computeVertexNormals();
    var crystalMat = new THREE.MeshPhysicalMaterial({
      color: 0xdde8f4,
      flatShading: true, metalness: 0.34,
      roughness: 0.055,
      transmission: 0.58,
      thickness: 1.5,
      ior: 1.55,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.65,
      transparent: true,
      opacity: 0.94,
      attenuationColor: new THREE.Color(0xcfe2f5),
      attenuationDistance: 2.4
    });
    var crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.scale.set(0.89, 1.39, 0.91); crystal.rotation.z = -0.43; group.add(crystal);

    /* 内部发光核 */
    var innerMat = new THREE.MeshBasicMaterial({
      color: 0xbfe0ff,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    var inner = new THREE.Mesh(new THREE.OctahedronGeometry(0.78, 0), innerMat);
    group.add(inner);

    var edgeMat = new THREE.LineBasicMaterial({ color: 0xdfeaf6, transparent: true, opacity: 0.3 });
    var edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(1.12, 0)), edgeMat);
    group.add(edges);

    /* 金属环 */
    var rings = [];
    function addRing(radius, tube, rot, opacity) {
      var mat = new THREE.MeshStandardMaterial({
        color: 0xd7e0ea,
        metalness: 1,
        roughness: 0.16,
        envMapIntensity: 1.5,
        transparent: true,
        opacity: opacity
      });
      var ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 10, 200), mat);
      ring.rotation.set(rot[0], rot[1], rot[2]);
      group.add(ring);
      rings.push(ring);
      return ring;
    }
    addRing(2.85, 0.014, [1.15, 0.2, 0.35], 0.85);
    addRing(3.25, 0.009, [-0.65, 0.9, -0.4], 0.55);
    addRing(2.2, 0.007, [0.35, -1.1, 0.9], 0.4);

    /* 外部笼状银线 */
    var cage = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(2.55, 0)),
      new THREE.LineBasicMaterial({ color: 0xdde8f4, transparent: true, opacity: 0.1 })
    );
    group.add(cage);

    /* 碎片 */
    var shardCount = mobile ? 18 : 34;
    var shardGeo = new THREE.OctahedronGeometry(1, 0);
    var shardMat = new THREE.MeshStandardMaterial({
      color: 0xdde7f2,
      metalness: 0.95,
      roughness: 0.18,
      envMapIntensity: 1.4,
      flatShading: true
    });
    var shards = new THREE.InstancedMesh(shardGeo, shardMat, shardCount);
    shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(shards);
    var shardData = [];
    for (var i = 0; i < shardCount; i++) {
      shardData.push({
        angle: Math.random() * Math.PI * 2,
        radius: 2.5 + Math.random() * 2.6,
        y: (Math.random() - 0.5) * 2.4,
        speed: 0.06 + Math.random() * 0.18,
        spin: (Math.random() - 0.5) * 1.4,
        scale: 0.03 + Math.random() * 0.075,
        tilt: Math.random() * Math.PI,
        phase: Math.random() * Math.PI * 2
      });
    }
    var dummy = new THREE.Object3D();

    /* 粒子：星尘与冷雾 */
    var particleCount = mobile ? 650 : 1500;
    var pGeo = new THREE.BufferGeometry();
    var positions = new Float32Array(particleCount * 3);
    var sizes = new Float32Array(particleCount);
    for (var p = 0; p < particleCount; p++) {
      var r = 3.4 + Math.pow(Math.random(), 0.7) * 9;
      var theta = Math.random() * Math.PI * 2;
      var phi = Math.acos(2 * Math.random() - 1);
      positions[p * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[p * 3 + 1] = (Math.random() - 0.5) * 7.5;
      positions[p * 3 + 2] = r * Math.cos(phi) * 0.82;
      sizes[p] = 0.02 + Math.random() * 0.06;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    var sprite = makeParticleSprite(THREE);
    var pMat = new THREE.PointsMaterial({
      color: 0xdce9f7,
      size: mobile ? 0.07 : 0.062,
      map: sprite,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    const windTime={value:0}, windPointer={value:new THREE.Vector2()};
    pMat.onBeforeCompile=shader=>{
      shader.uniforms.archiveWindTime=windTime;shader.uniforms.archivePointer=windPointer;
      shader.vertexShader='uniform float archiveWindTime; uniform vec2 archivePointer;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>', [
        '#include <begin_vertex>',
        'float w=archiveWindTime*.33 + position.z*.63;',
        'vec2 eddy=position.xy-archivePointer*vec2(4.,2.7);',
        'transformed.xy += vec2(sin(w+position.y),cos(w*.7+position.x))*.17;',
        'transformed.xy += vec2(-eddy.y,eddy.x)*exp(-dot(eddy,eddy)*.23)*.46;'
      ].join('\n'));
    };
    var particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    /* 体积冷雾 */
    var fogTex = makeParticleSprite(THREE);
    const mistTime={value:0};
    const mist=new THREE.Mesh(new THREE.BoxGeometry(7,1.1,4.6),new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,side:THREE.BackSide,
      uniforms:{uTime:mistTime},
      vertexShader:'varying vec3 at; void main(){at=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(at,1.);}',
      fragmentShader:[
        'varying vec3 at;uniform float uTime;',
        'void main(){vec3 o=cameraPosition;vec3 d=normalize(at-o);',
        'vec3 a=(vec3(-3.5,-2.35,-4.8)-o)/d,b=(vec3(3.5,-1.25,-.2)-o)/d;',
        'vec3 lo=min(a,b),hi=max(a,b);float start=max(0.,max(lo.x,max(lo.y,lo.z))),end=min(hi.x,min(hi.y,hi.z));',
        'float stepSize=max(0.,end-start)/8.;float depth=0.;',
        'for(int j=0;j<8;j++){vec3 q=o+d*(start+(float(j)+.5)*stepSize);',
        'float ridge=sin(q.x*1.6+q.z*.9-uTime*.19)*.13+cos(q.z*2.+q.x*.6+uTime*.15)*.09;',
        'float density=exp(-14.*abs(q.y+1.81-ridge))*exp(-.16*(q.x*q.x+(q.z+2.4)*(q.z+2.4)));depth+=density*stepSize;}',
        'gl_FragColor=vec4(.59,.75,.83,1.-exp(-depth*.26));}'
      ].join('\n')
    }));
    mist.position.set(0,-1.8,-2.5);scene.add(mist);
    var fogSprites = [];
    for (var f = 0; f < 4; f++) {
      var sm = new THREE.SpriteMaterial({
        map: fogTex,
        color: f % 2 ? 0x858ba8 : 0xbdbdc4,
        transparent: true,
        opacity: 0.05 + f * 0.012,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      var fog = new THREE.Sprite(sm);
      var scale = 8 + f * 2.6;
      fog.scale.set(scale, scale * 0.62, 1);
      fog.position.set((f - 1.5) * 4.2, -1.6 + f * 0.9, -4.5 - f * 1.6);
      scene.add(fog);
      fogSprites.push(fog);
    }

    /* 灯光 */
    scene.add(new THREE.AmbientLight(0x394553, 0.7));
    var key = new THREE.DirectionalLight(0xf3f8ff, 2.6);
    key.position.set(6, 8, 7);
    scene.add(key);
    var rim = new THREE.PointLight(0x315aff, 24, 34, 1.7);
    rim.position.set(-6.5, 2.4, -4.5);
    scene.add(rim);
    var fill = new THREE.PointLight(0xe2ecf7, 10, 26, 2);
    fill.position.set(4.2, -3.2, 4.5);
    scene.add(fill);

    var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    var scroll = { value: 0, target: 0 };
    var keyframes = [
      { p: 0.0, cam: [0, 0.15, 10.6], look: [0, 0, 0], rot: [0, 0, 0], scale: 1.0 },
      { p: 0.24, cam: [1.9, 1.0, 7.6], look: [0, 0.1, 0], rot: [0.3, 0.85, 0.08], scale: 1.02 },
      { p: 0.52, cam: [-2.2, 0.45, 5.6], look: [0, -0.08, 0], rot: [0.1, -0.42, 0.18], scale: 1.06 },
      { p: 0.78, cam: [0.9, 0.9, 3.8], look: [0, 0.02, 0], rot: [0.42, 1.45, 0.06], scale: 1.1 },
      { p: 1.0, cam: [0, 0.5, 3.0], look: [0, 0, 0], rot: [0.08, 2.0, 0], scale: 1.14 }
    ];
    var lookAt = new THREE.Vector3(0, 0, 0);
    var scrollRange = { hero: 1, total: 1 };

    function sampleKeyframes(t) {
      var a = keyframes[0], b = keyframes[keyframes.length - 1];
      for (var k = 0; k < keyframes.length - 1; k++) {
        if (t >= keyframes[k].p && t <= keyframes[k + 1].p) { a = keyframes[k]; b = keyframes[k + 1]; break; }
      }
      var span = Math.max(0.0001, b.p - a.p);
      var lt = Museum.env.reduced() ? 0 : U.clamp((t - a.p) / span, 0, 1);
      lt = lt * lt * (3 - 2 * lt);
      return {
        cam: [U.lerp(a.cam[0], b.cam[0], lt), U.lerp(a.cam[1], b.cam[1], lt), U.lerp(a.cam[2], b.cam[2], lt)],
        look: [U.lerp(a.look[0], b.look[0], lt), U.lerp(a.look[1], b.look[1], lt), U.lerp(a.look[2], b.look[2], lt)],
        rot: [U.lerp(a.rot[0], b.rot[0], lt), U.lerp(a.rot[1], b.rot[1], lt), U.lerp(a.rot[2], b.rot[2], lt)],
        scale: U.lerp(a.scale, b.scale, lt)
      };
    }

    function updateScrollTargets() {
      var doc = document.documentElement;
      var max = Math.max(1, doc.scrollHeight - window.innerHeight);
      scroll.target = U.clamp(window.scrollY / max, 0, 1);
      var heroEl = document.getElementById('home-hero');
      if (heroEl) {
        var heroMax = Math.max(1, heroEl.offsetHeight);
        state.heroParallax = U.clamp(window.scrollY / heroMax, 0, 1);
      }
    }

    var clock = new THREE.Clock();
    var disposed = false;
    var frameCount = 0;
    var perfStart = 0;
    var perfAdapted = false;

    function renderFrame() {
      var dt = Math.min(clock.getDelta(), 0.05);
      var time = clock.elapsedTime;
      mouse.x = U.damp(mouse.x, mouse.tx, 3.2, dt);
      mouse.y = U.damp(mouse.y, mouse.ty, 3.2, dt);
      scroll.value = U.damp(scroll.value, scroll.target, 3.6, dt);

      var kf = sampleKeyframes(scroll.value);
      camera.position.set(
        kf.cam[0] + mouse.x * 0.55,
        kf.cam[1] + mouse.y * 0.32,
        kf.cam[2] - 3.8 * Math.pow(scroll.value, 2)
      );
      lookAt.set(kf.look[0] + mouse.x * 0.12, kf.look[1] + mouse.y * 0.08, kf.look[2]);
      camera.lookAt(lookAt);

      group.rotation.x = kf.rot[0] + mouse.y * 0.1 + Math.sin(time * 0.21) * 0.03;
      group.rotation.y = kf.rot[1] + mouse.x * 0.16 + time * 0.035;
      group.rotation.z = kf.rot[2] + Math.sin(time * 0.17) * 0.02;
      group.scale.setScalar(kf.scale); group.position.x = (window.innerWidth < 720 ? 0.35 : 2.55) * Math.max(0, 1 - scroll.value * 3);

      if (state.enteredAt) {
        const travel = Math.min(1,(performance.now()-state.enteredAt)/690);
        const eased = travel*travel;
        camera.position.lerp(group.position,eased*.992);
        camera.lookAt(lookAt.lerp(group.position,Math.min(1,travel*2.3)));
      }
      key.position.x = 6 + Math.sin(time*.27)*2 + mouse.x;
      rim.intensity = 20 + 5*Math.sin(time*.36) + 6*scroll.value;
      crystal.rotation.y = time * 0.06;
      crystal.rotation.x = Math.sin(time * 0.22) * 0.08;
      inner.rotation.x = -time * 0.2;
      inner.rotation.y = time * 0.26;
      edges.rotation.copy(inner.rotation);
      var pulse = 1 + Math.sin(time * 1.3) * 0.045;
      inner.scale.setScalar(pulse);
      cage.rotation.y = -time * 0.02;
      cage.rotation.z = time * 0.014;

      rings.forEach(function (ring, idx) {
        ring.rotation.z += dt * (0.08 + idx * 0.045);
        ring.rotation.x += dt * (idx === 1 ? -0.06 : 0.03);
      });

      for (var s = 0; s < shardCount; s++) {
        var d = shardData[s];
        d.angle += dt * d.speed;
        d.phase += dt * 0.3;
        var rr = d.radius + Math.sin(d.phase) * 0.14;
        dummy.position.set(
          Math.cos(d.angle) * rr,
          d.y + Math.sin(d.angle * 1.7 + s) * 0.3,
          Math.sin(d.angle) * rr * 0.82
        );
        dummy.rotation.set(d.tilt + time * d.spin * 0.36, d.angle * 2.2 + time * d.spin * 0.2, d.angle);
        dummy.scale.setScalar(d.scale);
        dummy.updateMatrix();
        shards.setMatrixAt(s, dummy.matrix);
      }
      shards.instanceMatrix.needsUpdate = true;

      mistTime.value=time;windTime.value=time;windPointer.value.set(mouse.x,mouse.y);
      particles.rotation.y = time * 0.012 + scroll.value * 0.24 + mouse.x * 0.12;
      particles.rotation.x = Math.sin(time * 0.05) * 0.03 - mouse.y * 0.08;
      pMat.opacity = 0.5 + Math.sin(time * 0.6) * 0.06;
      fogSprites.forEach(function (fs, idx) {
        fs.position.x += Math.sin(time * 0.08 + idx) * 0.0018;
        fs.material.opacity = (0.045 + idx * 0.012) * (0.85 + Math.sin(time * 0.24 + idx) * 0.2);
      });

      aurora.material.uniforms.uTime.value = time;
      aurora.material.uniforms.uMouse.value.set(mouse.x, mouse.y);
      aurora.material.uniforms.uScroll.value = scroll.value;
      aurora.material.uniforms.uRes.value.set(window.innerWidth, window.innerHeight);

      renderer.autoClear = false; renderer.clear();
      renderer.render(bgScene, bgCamera);
      renderer.clearDepth();
      renderer.render(scene, camera);

      /* 简单自适应：前 2 秒采样，持续掉帧则降 DPR / 粒子量 */
      if (!perfAdapted) {
        frameCount++;
        if (!perfStart) perfStart = performance.now();
        var elapsed = performance.now() - perfStart;
        if (elapsed > 2400 && frameCount > 20) {
          var fps = frameCount / (elapsed / 1000);
          perfAdapted = true;
          if (fps < 46) {
            renderer.setPixelRatio(Math.max(1, dpr * 0.68));
            renderer.setSize(window.innerWidth, window.innerHeight);
            if (fps < 30) pGeo.setDrawRange(0, Math.floor(particleCount * 0.5));
          }
        }
      }
    }

    function loop() {
      if (disposed) return;
      state.raf = requestAnimationFrame(loop);
      renderFrame();
    }

    function onResize() {
      if (disposed) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
      renderer.setSize(window.innerWidth, window.innerHeight);
      updateScrollTargets();
      if (state.reduced) renderFrame();
    }

    function onScroll() {
      updateScrollTargets();
    }

    function onMouse(e) {
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ty = -((e.clientY / window.innerHeight) * 2 - 1);
    }

    function onVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(state.raf);
        state.raf = 0;
      } else if (!state.raf && !state.reduced && !disposed) {
        clock.getDelta();
        loop();
      }
    }

    updateScrollTargets();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onMouse, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    var api = {
      renderer: renderer,
      scene: scene,
      camera: camera,
      host: host,
      renderFrame: renderFrame,
      loop: loop,
      dispose: function () {
        if (disposed) return;
        disposed = true;
        cancelAnimationFrame(state.raf);
        state.raf = 0;
        window.removeEventListener('resize', onResize);
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('pointermove', onMouse);
        document.removeEventListener('visibilitychange', onVisibility);
        try {
          scene.traverse(function (obj) {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
              var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
              mats.forEach(function (m) {
                Object.keys(m).forEach(function (key) {
                  var val = m[key];
                  if (val && val.isTexture && key !== 'envMap') { try { val.dispose(); } catch (e) {} }
                });
                m.dispose();
              });
            }
          });
          bgScene.traverse(function (obj) { if (obj.geometry) obj.geometry.dispose(); if (obj.material) obj.material.dispose(); });
          if (envRT) envRT.dispose();
          pmrem.dispose();
          renderer.dispose();
          if (renderer.forceContextLoss) renderer.forceContextLoss();
        } catch (e) { /* ignore teardown races */ }
      }
    };
    return api;
  }

  /* ------------------------------------------------------------------ */
  /* 降级与装配                                                         */
  /* ------------------------------------------------------------------ */
  function showFallback(root, note) {
    var fallback = root.querySelector('#webgl-fallback');
    if (fallback) {
      fallback.hidden = false;
      fallback.classList.add('is-live');
    }
    document.body.classList.add('no-webgl');
    var n = root.querySelector('#webgl-note');
    if (n) {
      n.hidden = false;
      n.textContent = note || 'LOW-LIGHT MODE · 静态晶体预览';
    }
  }

  function initWebGL(root) {
    var host = document.createElement('div');
    host.className = 'webgl-stage';
    document.body.insertBefore(host, document.body.firstChild);
    state.host = host;

    var api = null;
    try {
      api = createWebGL(host);
    } catch (err) {
      console.warn('[silver-arcade] WebGL 初始化失败，启用静态降级：', err);
      api = null;
    }
    if (!api) {
      if (host.parentNode) host.parentNode.removeChild(host);
      showFallback(root, 'WEBGL UNAVAILABLE · 静态晶体降级');
      return;
    }
    state.webgl = api;
    document.body.classList.remove('no-webgl');
    host.appendChild(api.renderer.domElement);
    api.renderer.domElement.addEventListener('webglcontextlost', function (e) {
      if (!state.active || state.webgl !== api) return;
      e.preventDefault();
      console.warn('[silver-arcade] WebGL context lost，切换静态降级');
      api.dispose();
      state.webgl = null;
      if (host.parentNode) host.parentNode.removeChild(host);
      showFallback(root, 'WEBGL CONTEXT LOST · 静态晶体降级');
      state.host = null;
    }, false);

    state.reduced = Museum.env.reduced();
    api.renderFrame();
    requestAnimationFrame(function () {
      host.classList.add('is-ready');
    });
    if (!state.reduced) api.loop();
  }

  /* ------------------------------------------------------------------ */
  /* 交互与动效                                                         */
  /* ------------------------------------------------------------------ */
  function bind(root) {
    let crossing=0;
    const enterHall=e=>{
      const link=e.target.closest('a[href="#/hall"]');
      if(!link || e.button!==0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || !state.webgl || Museum.env.reduced())return;
      e.preventDefault();if(crossing)return;
      state.enteredAt=performance.now();document.body.classList.add('crossing-threshold');
      crossing=setTimeout(()=>{location.hash='/hall'},690);
    };
    state.disposers.push(U.on(document,'click',enterHall),()=>{clearTimeout(crossing);state.enteredAt=0;document.body.classList.remove('crossing-threshold')});
    var hero = root.querySelector('#home-hero');
    var strip = root.querySelector('#exhibit-strip');
    var vinylRoom = root.querySelector('#room-vinyl');
    var replay = root.querySelector('#home-replay-intro');

    /* 展厅预览条滚动视差 */
    if (strip) {
      var stripRaf = 0;
      var onStripScroll = function () {
        if (stripRaf) return;
        stripRaf = requestAnimationFrame(function () {
          stripRaf = 0;
          if (!strip.isConnected) return;
          var r = strip.getBoundingClientRect();
          var p = U.clamp((window.innerHeight - r.top) / (window.innerHeight + r.height), 0, 1);
          strip.style.setProperty('--strip-p', p.toFixed(3));
        });
      };
      state.disposers.push(U.on(window, 'scroll', onStripScroll, { passive: true }));
      onStripScroll();
    }

    /* 首页滚动：视差变量（镜头在 WebGL 内处理） */
    var scrollRaf = 0;
    function onScroll() {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(function () {
        scrollRaf = 0;
        if (!state.active) return;
        if (hero) hero.style.setProperty('--hp', state.heroParallax.toFixed(3));
        root.style.setProperty('--page-p', (window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight)).toFixed(3));
      });
    }
    state.disposers.push(U.on(window, 'scroll', onScroll, { passive: true }));
    onScroll();

    if (vinylRoom) {
      vinylRoom.addEventListener('click', function () {
        if (window.VinylPlayer && typeof window.VinylPlayer.open === 'function') {
          window.VinylPlayer.open();
        } else {
          Museum.toast('唱片播放器还在装台 · 稍后见');
        }
      });
    }
    if (replay) {
      replay.addEventListener('click', function () {
        if (Museum.intro) Museum.intro.play(true);
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* 首页揭示（等开场结束）                                             */
  /* ------------------------------------------------------------------ */
  function revealHome(replay) {
    var root = state.root;
    if (!root) return;
    state.introDone = true;
    root.classList.add('is-ready');
    document.body.classList.remove('intro-active');
    var lines = U.$$('.hero .mask-line', root);
    if (replay) {
      lines.forEach(function (l) { l.classList.remove('is-in'); });
    }
    requestAnimationFrame(function () {
      lines.forEach(function (l, i) {
        setTimeout(function () { l.classList.add('is-in'); }, 80 + i * 130);
      });
      U.$$('.hero__intro, .hero__lede, .hero__actions, .hero__stats, .hero__scroll, .hero__top', root).forEach(function (n) {
        n.classList.add('is-in');
      });
      var facts = root.querySelectorAll('.hero__stats dd[data-stat]');
      U.$$('.hero__stats dd[data-stat]', root).forEach(function (dd) {
        var key = dd.getAttribute('data-stat');
        if (key === 'exhibits') U.countUp(dd, COUNT, { from: 0, duration: 1300 });
        else if (key === 'genres') U.countUp(dd, TAG_COUNT, { from: 0, duration: 1100 });
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* 生命周期                                                           */
  /* ------------------------------------------------------------------ */
  function mount(rootEl) {
    state.active = true;
    state.root = rootEl;
    state.reduced = Museum.env.reduced();
    state.introDone = false; state.enteredAt=0;
    rootEl.innerHTML = template();
    initWebGL(rootEl);
    bind(rootEl);
    Museum.observeReveal(rootEl);

    state.disposers.push(Museum.events.on('intro:done', function () {
      revealHome(false);
    }));
    state.disposers.push(Museum.events.on('intro:start', function () {
      var root = state.root;
      if (root) {
        root.classList.remove('is-ready');
        U.$$('.hero .mask-line', root).forEach(function (l) { l.classList.remove('is-in'); });
      }
    }));

    if (Museum.intro && Museum.intro.isActive()) {
      /* 等开场结束 */
    } else {
      document.body.classList.remove('intro-active');
      requestAnimationFrame(function () { revealHome(false); });
    }

    U.$$('[data-magnetic]', rootEl).forEach(function (n) { /* fx 在 route:mounted 时统一绑定 */ });
    Museum.fx && Museum.fx.refresh(rootEl);
  }

  function unmount() {
    state.active = false;
    state.disposers.forEach(function (fn) { try { fn(); } catch (e) {} });
    state.disposers = [];
    cancelAnimationFrame(state.raf);
    cancelAnimationFrame(state.scrollRaf);
    state.raf = 0;
    state.scrollRaf = 0;
    if (state.webgl) {
      try { state.webgl.dispose(); } catch (e) {}
      state.webgl = null;
    }
    if (state.host && state.host.parentNode) state.host.parentNode.removeChild(state.host);
    state.host = null;
    var fb = document.getElementById('webgl-fallback');
    if (fb && fb.parentNode) fb.parentNode.removeChild(fb);
    document.body.classList.remove('no-webgl', 'intro-active');
    state.root = null;
  }

  window.HomeView = { mount: mount, unmount: unmount };
})();

