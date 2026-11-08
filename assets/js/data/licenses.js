/* 开源许可与致谢数据 · SILVER ARCADE
 * 本地许可全文保留在 lib/ 与 arcade/vendor/ 内，不在构建中删除或改写。
 * 本文件只做展示，新增依赖时请同步登记来源、许可证与本地全文路径。
 */
window.MUSEUM_LICENSES = {
  updatedAt: '2026-11-08',
  intro: 'R-数字藏馆收藏游戏、书籍与数字雕塑。这里列出所有复用的开源库、旧档案游戏与视觉参考，' +
    '并保留完整许可证文件的路径。代码移植与改编均在各条目下说明。',
  groups: [
    {
      title: '开源库',
      en: 'OPEN-SOURCE LIBRARIES',
      items: [
        {
          name: 'Three.js',
          version: '浏览器本地构建',
          license: 'MIT',
          copyright: 'Copyright © 2010-2023 Three.js Authors',
          local: 'lib/THREE-LICENSE.txt',
          source: 'https://github.com/mrdoob/three.js',
          note: '首页折射晶体、极光着色器、冷雾、粒子与滚动镜头的渲染基础。'
        },
        {
          name: 'Lenis',
          version: '1.x',
          license: 'MIT',
          local: 'arcade/vendor/visual/LENIS-LICENSE',
          source: 'https://github.com/studio-freight/lenis',
          note: '旧档案中保留的平滑滚动库；新版首页镜头由原生 requestAnimationFrame 驱动，未额外引入依赖。'
        },
        {
          name: 'vanilla-tilt.js',
          license: 'MIT',
          local: 'arcade/vendor/visual/TILT-LICENSE',
          source: 'https://github.com/micku7zu/vanilla-tilt.js',
          note: '旧档案中保留；新版微交互为原生实现。'
        }
      ]
    },
    {
      title: '游戏与旧档案',
      en: 'GAMES & LEGACY ARCHIVE',
      items: [
        {
          name: 'R`s GAME BOX 原创游戏合集',
          license: '本站原创 · 保留所有权利',
          local: 'arcade/src/games/',
          note: '贪吃蛇、俄罗斯方块、打砖块、合成大西瓜、2048、扫雷、太空射击、塔防、桌球、记忆翻牌、纸牌接龙、像素鸟、五子棋、中国象棋等原生实现的游戏档案，新版展厅以独立 iframe 舞台原样复用，未重写游戏。'
        },
        {
          name: 'Survivor（弹幕生存）',
          license: 'MIT',
          local: 'arcade/vendor/survivor/LICENSE',
          source: 'https://github.com/ricardo-foundry/canvas-vampire-survivors',
          note: '完整游戏以独立页面嵌入；已移除 Service Worker 注册以适配静态站点。'
        },
        {
          name: 'Hextris（六边形消除）',
          license: 'GPL-3.0',
          local: 'arcade/vendor/hextris/LICENSE.md',
          source: 'https://github.com/hextris/hextris',
          note: '完整游戏以独立页面嵌入；已移除广告、统计与外部分享。'
        },
        {
          name: '中国象棋规则引擎与 AI',
          license: 'MIT',
          local: 'arcade/vendor/xiangqi/LICENSE',
          source: 'https://github.com/j32ryc/xiangqi',
          note: '规则引擎与 Alpha-Beta AI 基本原样移植，渲染与交互按本站引擎重写。'
        },
        {
          name: '旧游戏箱封面 CardArt',
          license: '本站原创',
          local: 'arcade/src/card-art.js',
          note: '旧游戏本体保留原图形。主站首页、游戏展映和详情使用本次生成的 23 幅 AI 图像。'
        }
      ]
    },
    {
      title: '旧档案中的第三方登记',
      en: 'THIRD-PARTY REGISTRY',
      items: [
        {
          name: '旧版第三方许可证总表',
          license: '文件保留',
          local: 'arcade/docs/THIRD_PARTY_LICENSES.md',
          note: '包含 xiangqi、Survivor、Hextris 的原始登记与修改说明，以及仅作玩法参考、未复制代码的项目清单。'
        }
      ]
    },
    {
      title: '视觉与交互参考（未复制代码或素材）',
      en: 'VISUAL REFERENCES',
      items: [
        { name: 'GIATS Portfolio', source: 'https://giats.me/', note: '流体、多层空间与镂空窗口的交互参考。' },
        { name: 'HxnDev Portfolio', source: 'https://hxndev.com/', note: '悬浮水晶、极光与电影镜头的参考。' },
        { name: 'Asmin Tumur Portfolio', source: 'https://asmintumur.vercel.app/', note: '360° 圆柱画廊的参考。' },
        { name: 'Naresh Khatri Portfolio', source: 'https://nareshkhatri.dev/', note: '3D 控制台与按键微交互的参考。' },
        { name: 'Bruno Simon · folio', source: 'https://bruno-simon.com/', note: '雾、风场与动态光照的参考。' },
        {
          name: 'Cinematic 3D Scroll',
          source: 'https://github.com/JosephASG/codrops-cinematic-scroll-animations',
          note: '借鉴连续镜头与章节文字调度。'
        }
      ]
    }
  ],
  notes: [
    '茉子的白龙娘肖像取自本机白龙桌宠素材。原作 CHRONOS 由饶智提供；书籍试读的文字与图片由图书平台提供。',
    '唱片室收录饶智提供的 Music.zip 中的 49 首歌曲，仅在点击播放后加载本地音频。',
    '收藏、最高分、导入的电子书保存在本机。在线试读连接图书平台；共享光标仅在主动开启时发送当前位置。',
    '旧档案中的许可证文件原文保留，未删除、未改写；如后续分发或商用，请按各许可证条款核对。'
  ]
};

window.MUSEUM_LICENSES.groups[0].items.push(...[{"name": "3D Carousel", "license": "MIT", "source": "https://github.com/codrops/3DCarousel", "local": "lib/codrops/Carousel-LICENSE", "note": "先前圆环版采用过此项目的圆柱变换函数；当前展映版已更换为透视镜头。"}, {"name": "Kinetic Type Page Transition", "license": "MIT", "source": "https://github.com/codrops/KineticTypePageTransition", "local": "lib/codrops/Kinetic-LICENSE", "note": "依据 TypeTransition 的多行错位、旋转与放大时间线重新编排，增加不透明交接帧及字形镂空。"}, {"name": "WebGL Fluid Simulation", "license": "MIT", "source": "https://github.com/PavelDoGreat/WebGL-Fluid-Simulation", "local": "lib/fluid/LICENSE", "note": "上一版鼠标流体的来源；此版本已移除鼠标流体。首页的镂空观察窗使用独立、局部的流场。"}, {"name": "epub.js", "license": "BSD-2-Clause", "source": "https://github.com/futurepress/epub.js", "local": "lib/epubjs/license", "note": "解析 EPUB 章节和插图，提供翻页与滚动排版。"}, {"name": "JSZip", "license": "MIT 或 GPLv3", "source": "https://github.com/Stuk/jszip", "local": "lib/jszip/LICENSE.markdown", "note": "本机解包电子书。"}, {"name": "GSAP", "license": "GSAP Standard License", "source": "https://gsap.com/standard-license/", "local": "", "note": "驱动 Codrops 的文字时间线。"}]);

window.MUSEUM_LICENSES.groups[0].items.push(
 {name:'Antique Camera · Maximillan Kamps / UX3D',license:'CC0（保留原标志）',source:'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/AntiqueCamera',local:'sculptures/assets/AntiqueCamera-credits.md',note:'展厅使用原模型及材质。'},
 {name:'Iridescence Abalone · Abby Crawford / Eric Chadwick',license:'CC BY 4.0',source:'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/IridescenceAbalone',local:'sculptures/assets/IridescenceAbalone-credits.md',note:'保留模型署名和虹彩材质。'},
 {name:'Dragon Attenuation · Stanford Computer Graphics Laboratory',license:'Stanford Graphics Library / Adobe 组件另见来源',source:'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/DragonAttenuation',local:'sculptures/assets/Stanford-LICENSE.txt',note:'Stanford 扫描来源允许研究与免费再分发，商业使用须获许可。隐藏布景。'}
);
