/* 新版游戏展厅数据 · 由 tools/extract-registry.mjs 从旧版 arcade 注册表提取。
 * 游戏实现与运行仍在 arcade/ 内完整保留；本文件只保存展示用元数据。
 * 重新生成：node tools/extract-registry.mjs
 */
window.MUSEUM_GAMES = {
  "generatedAt": "2026-11-08",
  "source": "arcade/src/games/*.js + arcade/src/external-games.js",
  "count": 23,
  "tags": [
    "街机",
    "经典",
    "益智",
    "休闲",
    "挑战",
    "策略",
    "卡牌",
    "对战"
  ],
  "games": [
    {
      "id": "snake",
      "title": "贪吃蛇",
      "subtitle": "吃得越多，越长越危险",
      "description": "经典街机玩法，方向键控制小蛇吃豆长大。别撞墙、别咬到自己，金色豆子能一口气加 50 分。",
      "icon": "🐍",
      "accent": "#34d399",
      "accent2": "#0ea5e9",
      "tags": [
        "街机",
        "经典"
      ],
      "difficulty": "简单",
      "width": 720,
      "height": 540,
      "controls": [
        {
          "keys": "↑ ↓ ← → / WASD",
          "action": "控制方向"
        },
        {
          "keys": "P / Esc",
          "action": "暂停"
        },
        {
          "keys": "R",
          "action": "重新开始"
        }
      ],
      "tips": "转弯前先想好下一步，贴边蛇行最安全。金色豆子会消失，看到就冲！",
      "order": 10,
      "external": false,
      "playUrl": "arcade/index.html?embed=1#/play/snake",
      "iconArt": "arcade/assets/img/games/snake-icon.webp",
      "bgArt": "arcade/assets/img/games/snake-bg.webp",
      "cover": "svg"
    },
    {
      "id": "tetris",
      "title": "俄罗斯方块",
      "subtitle": "消行、加速、活下去",
      "description": "七种霓虹方块从顶部落下，摆满一行即可消除。等级越高下落越快，连消越多分数越夸张，看看你能撑到第几级。",
      "icon": "🧩",
      "accent": "#22d3ee",
      "accent2": "#3b82f6",
      "tags": [
        "街机",
        "益智"
      ],
      "difficulty": "中等",
      "width": 540,
      "height": 720,
      "controls": [
        {
          "keys": "← → / A D",
          "action": "左右移动"
        },
        {
          "keys": "↑ / X 顺时针 · Z 逆时针",
          "action": "旋转方块"
        },
        {
          "keys": "↓ / 空格",
          "action": "软降 / 硬降"
        },
        {
          "keys": "C / Shift",
          "action": "暂存方块（每回合一次）"
        }
      ],
      "tips": "留一列空竖槽，等 I 型方块一次消四行；连击比单消更值钱。",
      "order": 15,
      "external": false,
      "playUrl": "arcade/index.html?embed=1#/play/tetris",
      "iconArt": "arcade/assets/img/games/tetris-icon.webp",
      "bgArt": "arcade/assets/img/games/tetris-bg.webp",
      "cover": "svg"
    },
    {
      "id": "breakout",
      "title": "打砖块",
      "subtitle": "反弹、拆墙、别掉球",
      "description": "拖动挡板接住小球，把整面霓虹砖墙拆干净。连击能翻倍加分，关卡越高球速越快，接住道具还能多球、加长、减速、加命。",
      "icon": "🧱",
      "accent": "#f472b6",
      "accent2": "#a855f7",
      "tags": [
        "街机",
        "经典"
      ],
      "difficulty": "中等",
      "width": 720,
      "height": 540,
      "controls": [
        {
          "keys": "← → / A D",
          "action": "移动挡板"
        },
        {
          "keys": "鼠标 / 触摸",
          "action": "拖动挡板"
        },
        {
          "keys": "空格 / 点击",
          "action": "发球"
        }
      ],
      "tips": "用挡板边缘击球能打出更大角度；连击越高，单块砖越值钱。",
      "order": 20,
      "external": false,
      "playUrl": "arcade/index.html?embed=1#/play/breakout",
      "iconArt": "arcade/assets/img/games/breakout-icon.webp",
      "bgArt": "arcade/assets/img/games/breakout-bg.webp",
      "cover": "svg"
    },
    {
      "id": "suika",
      "title": "合成大西瓜",
      "subtitle": "合并水果，别让箱子溢出",
      "description": "把水果一颗颗放进箱子，相同的两颗碰撞就会合成更大的水果。从樱桃一路合到西瓜，小心别让果堆越过警戒线。",
      "icon": "🍉",
      "accent": "#fb7185",
      "accent2": "#22c55e",
      "tags": [
        "休闲",
        "挑战"
      ],
      "difficulty": "简单",
      "width": 600,
      "height": 800,
      "controls": [
        {
          "keys": "← → / A D",
          "action": "左右瞄准"
        },
        {
          "keys": "鼠标 / 触摸",
          "action": "移动瞄准线"
        },
        {
          "keys": "空格 / 点击",
          "action": "放下水果"
        }
      ],
      "tips": "落点越靠中间，水果越容易滚到一起合成；大水果尽量放两侧，给新的腾空间。",
      "order": 25,
      "external": false,
      "playUrl": "arcade/index.html?embed=1#/play/suika",
      "iconArt": "arcade/assets/img/games/suika-icon.webp",
      "bgArt": "arcade/assets/img/games/suika-bg.webp",
      "cover": "svg"
    },
    {
      "id": "g2048",
      "title": "2048",
      "subtitle": "合并数字，冲击 2048",
      "description": "在 4×4 棋盘上滑动数字方块，相同的数字相遇就合成更大的数。步步为营，冲出你的 2048 方块！",
      "icon": "🔢",
      "accent": "#fbbf24",
      "accent2": "#f97316",
      "tags": [
        "益智"
      ],
      "difficulty": "简单",
      "width": 600,
      "height": 640,
      "controls": [
        {
          "keys": "↑ ↓ ← → / WASD",
          "action": "滑动合并"
        },
        {
          "keys": "鼠标 / 触摸拖拽",
          "action": "滑动合并"
        },
        {
          "keys": "Z",
          "action": "撤销一步"
        }
      ],
      "tips": "把最大的方块固定在角落，按蛇形顺序排列更容易合成。走错一步可以按 Z 撤销。",
      "order": 30,
      "external": false,
      "playUrl": "arcade/index.html?embed=1#/play/g2048",
      "iconArt": "arcade/assets/img/games/g2048-icon.webp",
      "bgArt": "arcade/assets/img/games/g2048-bg.webp",
      "cover": "svg"
    },
    {
      "id": "sheep",
      "title": "羊了个羊",
      "subtitle": "三张同牌，槽位别满",
      "description": "层层叠叠的卡牌堆成小山，只有露在最上面的牌能点。凑齐三张同图案就会消除，槽位塞满就输了。",
      "icon": "🐑",
      "accent": "#fbbf24",
      "accent2": "#f97316",
      "tags": [
        "益智",
        "休闲"
      ],
      "difficulty": "中等",
      "width": 640,
      "height": 820,
      "controls": [
        {
          "keys": "鼠标 / 触摸",
          "action": "点击卡牌"
        },
        {
          "keys": "画布按钮",
          "action": "撤销 / 洗牌"
        }
      ],
      "tips": "先点边缘的牌，把图案数量摸清再下手；槽位快满时用「撤销」或「洗牌」救急。",
      "order": 35,
      "external": false,
      "playUrl": "arcade/index.html?embed=1#/play/sheep",
      "iconArt": "arcade/assets/img/games/sheep-icon.webp",
      "bgArt": "",
      "cover": "svg"
    },
    {
      "id": "space",
      "title": "太空射击",
      "subtitle": "孤舰深入星海，火力全开",
      "description": "驾驶孤舰穿过三层视差星海，用弹幕撕开敌机编队。每五波迎来 Boss，散射、护盾、炸弹与增援决定你能飞多远。",
      "icon": "🚀",
      "accent": "#818cf8",
      "accent2": "#ec4899",
      "tags": [
        "街机",
        "挑战"
      ],
      "difficulty": "困难",
      "width": 720,
      "height": 540,
      "controls": [
        {
          "keys": "← → / A D",
          "action": "移动战机"
        },
        {
          "keys": "鼠标 / 触摸",
          "action": "拖动战机"
        },
        {
          "keys": "空格",
          "action": "加速射击"
        },
        {
          "keys": "X / Shift",
          "action": "释放炸弹"
        }
      ],
      "tips": "Boss 的扇形弹幕有固定节奏，贴着屏幕下缘小幅横向移动最省命。",
      "order": 40,
      "external": false,
      "playUrl": "arcade/index.html?embed=1#/play/space",
      "iconArt": "arcade/assets/img/games/space-icon.webp",
      "bgArt": "arcade/assets/img/games/space-bg.webp",
      "cover": "svg"
    },
    {
      "id": "tower",
      "title": "塔防",
      "subtitle": "布阵升级，守住基地",
      "description": "在 S 形路径旁建造箭塔、冰塔与炮塔，抵挡 10 波敌人。击杀赚金币、升级强火力，守住基地就赢下这一局。",
      "icon": "🛡️",
      "accent": "#38bdf8",
      "accent2": "#8b5cf6",
      "tags": [
        "策略",
        "挑战"
      ],
      "difficulty": "困难",
      "width": 720,
      "height": 540,
      "controls": [
        {
          "keys": "鼠标 / 触摸点击",
          "action": "建造 / 选择 / 按钮"
        },
        {
          "keys": "1 / 2 / 3",
          "action": "建造箭塔 / 冰塔 / 炮塔"
        },
        {
          "keys": "空格",
          "action": "提前召唤下一波"
        },
        {
          "keys": "U / S",
          "action": "升级 / 出售选中塔"
        }
      ],
      "tips": "别把金币全压在一种塔上：冰塔减速配炮塔群伤才是后期答案。波次之间提前召唤能赚额外金币。",
      "order": 45,
      "external": false,
      "playUrl": "arcade/index.html?embed=1#/play/tower",
      "iconArt": "arcade/assets/img/games/tower-icon.webp",
      "bgArt": "arcade/assets/img/games/tower-bg.webp",
      "cover": "svg"
    },
    {
      "id": "minesweeper",
      "title": "扫雷",
      "subtitle": "十颗雷，一命通关",
      "description": "九乘九的雷区里藏着十颗地雷，第一次点击必定安全。翻开全部安全格即可通关，右键或长按可以插旗标记可疑位置。",
      "icon": "💣",
      "accent": "#a3e635",
      "accent2": "#22c55e",
      "tags": [
        "益智",
        "经典"
      ],
      "difficulty": "中等",
      "width": 600,
      "height": 640,
      "controls": [
        {
          "keys": "鼠标左键 / 点击",
          "action": "翻开格子"
        },
        {
          "keys": "鼠标右键 / 长按",
          "action": "插旗标记"
        },
        {
          "keys": "R",
          "action": "重新开始"
        }
      ],
      "tips": "数字代表周围八格的雷数，从边角起手更安全。",
      "order": 50,
      "external": false,
      "playUrl": "arcade/index.html?embed=1#/play/minesweeper",
      "iconArt": "arcade/assets/img/games/minesweeper-icon.webp",
      "bgArt": "arcade/assets/img/games/minesweeper-bg.webp",
      "cover": "svg"
    },
    {
      "id": "minesweeper-master",
      "title": "扫雷大师版",
      "subtitle": "36 × 36 · 四十颗雷",
      "description": "36 × 36 的超大雷区，四十颗地雷，第一次点击必定安全。翻开全部安全格即可通关，右键或长按可以插旗标记可疑位置。",
      "icon": "💣",
      "accent": "#a3e635",
      "accent2": "#22c55e",
      "tags": [
        "益智",
        "经典"
      ],
      "difficulty": "大师",
      "width": 900,
      "height": 940,
      "controls": [
        {
          "keys": "鼠标左键 / 点击",
          "action": "翻开格子"
        },
        {
          "keys": "鼠标右键 / 长按",
          "action": "插旗标记"
        },
        {
          "keys": "R",
          "action": "重新开始"
        }
      ],
      "tips": "数字代表周围八格的雷数，从边角起手更安全。",
      "order": 51,
      "external": false,
      "playUrl": "arcade/index.html?embed=1#/play/minesweeper-master",
      "iconArt": "arcade/assets/img/games/minesweeper-icon.webp",
      "bgArt": "arcade/assets/img/games/minesweeper-bg.webp",
      "cover": "svg"
    },
    {
      "id": "pool",
      "title": "桌球",
      "subtitle": "瞄准、走位、一杆清台",
      "description": "单人 8 球挑战：拖拽蓄力、走位清台。白球落袋罚杆，8 号球必须最后打进，连击越多分数越高。",
      "icon": "🎱",
      "accent": "#34d399",
      "accent2": "#0ea5e9",
      "tags": [
        "休闲",
        "挑战"
      ],
      "difficulty": "中等",
      "width": 800,
      "height": 540,
      "controls": [
        {
          "keys": "鼠标 / 触摸拖拽",
          "action": "瞄准蓄力，松手击球"
        },
        {
          "keys": "← →",
          "action": "微调角度"
        },
        {
          "keys": "↑ ↓ / 空格",
          "action": "调整力度 / 蓄力"
        },
        {
          "keys": "Enter",
          "action": "以当前力度击球"
        }
      ],
      "tips": "先清彩球再收 8 号；白球贴库时轻推更稳，连击比蛮力更值钱。",
      "order": 55,
      "external": false,
      "playUrl": "arcade/index.html?embed=1#/play/pool",
      "iconArt": "arcade/assets/img/games/pool-icon.webp",
      "bgArt": "arcade/assets/img/games/pool-bg.webp",
      "cover": "svg"
    },
    {
      "id": "memory",
      "title": "记忆翻牌",
      "subtitle": "记住位置，连击配对吧",
      "description": "20 张霓虹卡牌藏着 10 对图案。翻开两张相同的牌即可配对，连续配对触发连击倍率，越多越爽。",
      "icon": "🃏",
      "accent": "#c084fc",
      "accent2": "#6366f1",
      "tags": [
        "益智",
        "休闲"
      ],
      "difficulty": "简单",
      "width": 640,
      "height": 640,
      "controls": [
        {
          "keys": "鼠标点击",
          "action": "翻开卡牌"
        },
        {
          "keys": "触摸点击",
          "action": "翻开卡牌"
        }
      ],
      "tips": "先翻一遍记住位置，再按连击节奏成对翻开；翻错会清空连击，稳一点更划算。",
      "order": 60,
      "external": false,
      "playUrl": "arcade/index.html?embed=1#/play/memory",
      "iconArt": "arcade/assets/img/games/memory-icon.webp",
      "bgArt": "",
      "cover": "svg"
    },
    {
      "id": "solitaire",
      "title": "纸牌接龙",
      "subtitle": "经典纸牌，闲来一局",
      "description": "经典 Klondike 单人纸牌：把同花色从 A 到 K 收进四个目标堆。红黑交替、递减排列，抽 1 张模式，双击自动收牌。",
      "icon": "🎴",
      "accent": "#60a5fa",
      "accent2": "#1d4ed8",
      "tags": [
        "卡牌",
        "经典"
      ],
      "difficulty": "中等",
      "width": 900,
      "height": 700,
      "controls": [
        {
          "keys": "鼠标左键 / 点击",
          "action": "抽牌 / 选牌"
        },
        {
          "keys": "拖拽",
          "action": "拖动牌组"
        },
        {
          "keys": "双击",
          "action": "自动收牌"
        },
        {
          "keys": "Z",
          "action": "撤销一步"
        }
      ],
      "tips": "先把 A 收进目标堆，空列留给 K 能腾出大空间。",
      "order": 65,
      "external": false,
      "playUrl": "arcade/index.html?embed=1#/play/solitaire",
      "iconArt": "arcade/assets/img/games/solitaire-icon.webp",
      "bgArt": "arcade/assets/img/games/solitaire-bg.webp",
      "cover": "svg"
    },
    {
      "id": "flappy",
      "title": "像素鸟",
      "subtitle": "一拍一世界，别撞管子",
      "description": "一按一拍翅膀，在霓虹山谷间穿过一根根发光管道。间隙会随分数慢慢收窄，铜牌 10 分、银牌 20 分、金牌 30 分，飞到哪一步？",
      "icon": "🐤",
      "accent": "#facc15",
      "accent2": "#ef4444",
      "tags": [
        "休闲",
        "挑战"
      ],
      "difficulty": "困难",
      "width": 480,
      "height": 720,
      "controls": [
        {
          "keys": "空格 / ↑ / W",
          "action": "拍翼"
        },
        {
          "keys": "鼠标 / 触摸点击",
          "action": "拍翼"
        },
        {
          "keys": "P / Esc · R",
          "action": "暂停 · 重开"
        }
      ],
      "tips": "别急着连拍，让鸟落到管道口下沿再拍一下，节奏比手速更重要。",
      "order": 70,
      "external": false,
      "playUrl": "arcade/index.html?embed=1#/play/flappy",
      "iconArt": "arcade/assets/img/games/flappy-icon.webp",
      "bgArt": "",
      "cover": "svg"
    },
    {
      "id": "gomoku",
      "title": "五子棋",
      "subtitle": "人机对弈，先连五者胜",
      "description": "十五路棋盘，你执黑先行，AI 执白应战。点击交叉点落子，先连成五子者获胜。AI 会算攻防，也会做双三，别小看它。",
      "icon": "⚫",
      "accent": "#f59e0b",
      "accent2": "#78350f",
      "tags": [
        "益智",
        "对战"
      ],
      "difficulty": "中等",
      "width": 600,
      "height": 600,
      "controls": [
        {
          "keys": "鼠标左键 / 点击",
          "action": "落子"
        },
        {
          "keys": "Z",
          "action": "悔棋"
        },
        {
          "keys": "R",
          "action": "重新开始"
        }
      ],
      "tips": "进攻就是最好的防守，做出双三往往比单纯堵棋更有效。",
      "order": 80,
      "external": false,
      "playUrl": "arcade/index.html?embed=1#/play/gomoku",
      "iconArt": "arcade/assets/img/games/gomoku-icon.webp",
      "bgArt": "arcade/assets/img/games/gomoku-bg.webp",
      "cover": "svg"
    },
    {
      "id": "xiangqi",
      "title": "中国象棋",
      "subtitle": "楚河汉界，人机对弈",
      "description": "开源中国象棋引擎移植：你执红先行，点击走子，Alpha-Beta AI 执黑应战。支持悔棋、提示与重开，楚河汉界一局定胜负。",
      "icon": "♟️",
      "accent": "#ef4444",
      "accent2": "#f59e0b",
      "tags": [
        "益智",
        "对战"
      ],
      "difficulty": "困难",
      "width": 640,
      "height": 800,
      "controls": [
        {
          "keys": "点击棋子 / 落点",
          "action": "选子与走子"
        },
        {
          "keys": "U / 画布「悔棋」",
          "action": "悔棋（回退两步）"
        },
        {
          "keys": "H / 画布「提示」",
          "action": "提示一步好棋"
        },
        {
          "keys": "R",
          "action": "重新开始"
        }
      ],
      "tips": "开局先出车马炮控中路；AI 思考时别急着点，悔棋可一次回退两步。",
      "order": 85,
      "external": false,
      "playUrl": "arcade/index.html?embed=1#/play/xiangqi",
      "iconArt": "arcade/assets/img/games/xiangqi-icon.webp",
      "bgArt": "arcade/assets/img/games/xiangqi-bg.webp",
      "cover": "svg"
    },
    {
      "id": "xiangqi-master",
      "title": "中国象棋大师版",
      "subtitle": "楚河汉界，大师级 AI",
      "description": "大师级中国象棋 AI：更深层 Alpha-Beta 搜索、长时间思考，执黑几乎不给破绽。你执红先行，点击走子，挑战真正的大师。",
      "icon": "♟️",
      "accent": "#ef4444",
      "accent2": "#f59e0b",
      "tags": [
        "益智",
        "对战",
        "挑战"
      ],
      "difficulty": "大师",
      "width": 640,
      "height": 800,
      "controls": [
        {
          "keys": "点击棋子 / 落点",
          "action": "选子与走子"
        },
        {
          "keys": "U / 画布「悔棋」",
          "action": "悔棋（回退两步）"
        },
        {
          "keys": "H / 画布「提示」",
          "action": "提示一步好棋"
        },
        {
          "keys": "R",
          "action": "重新开始"
        }
      ],
      "tips": "大师 AI 会长时间计算，请耐心等待；想赢它，需要比它算得更远。",
      "order": 86,
      "external": false,
      "playUrl": "arcade/index.html?embed=1#/play/xiangqi-master",
      "iconArt": "arcade/assets/img/games/xiangqi-icon.webp",
      "bgArt": "arcade/assets/img/games/xiangqi-bg.webp",
      "cover": "svg"
    },
    {
      "id": "gomoku-master",
      "title": "五子棋大师版",
      "subtitle": "先连五者胜 · 大师 AI",
      "description": "十五路棋盘，你执黑先行。大师版 AI 使用多层搜索与攻防评估，会封死你的活三、反过来做杀。先连成五子者获胜——但它几乎不会给你机会。",
      "icon": "⚫",
      "accent": "#f59e0b",
      "accent2": "#78350f",
      "tags": [
        "益智",
        "对战"
      ],
      "difficulty": "大师",
      "width": 600,
      "height": 600,
      "controls": [
        {
          "keys": "鼠标左键 / 点击",
          "action": "落子"
        },
        {
          "keys": "Z",
          "action": "悔棋"
        },
        {
          "keys": "R",
          "action": "重新开始"
        }
      ],
      "tips": "大师 AI 会提前算到你的活三与冲四；想赢，必须同时制造两个威胁。",
      "order": 88,
      "external": false,
      "playUrl": "arcade/index.html?embed=1#/play/gomoku-master",
      "iconArt": "arcade/assets/img/games/gomoku-icon.webp",
      "bgArt": "arcade/assets/img/games/gomoku-bg.webp",
      "cover": "svg"
    },
    {
      "id": "survivor",
      "title": "弹幕生存",
      "subtitle": "自动攻击 · 武器升级 · 怪潮求生",
      "description": "Survivor：自动攻击的生存冒险，升级武器并挑战首领。",
      "icon": "🦇",
      "accent": "#bb66ff",
      "tags": [
        "街机",
        "挑战"
      ],
      "difficulty": "困难",
      "order": 90,
      "url": "vendor/survivor/index.html",
      "source": "https://github.com/ricardo-foundry/canvas-vampire-survivors",
      "license": "MIT",
      "help": "WASD / 方向键移动；触屏使用游戏自带虚拟摇杆；在设置中选择中文。",
      "external": true,
      "playUrl": "arcade/index.html?embed=1#/play/survivor",
      "iconArt": "arcade/assets/img/games/survivor-icon.webp",
      "bgArt": "arcade/assets/img/games/survivor-bg.webp",
      "cover": "svg"
    },
    {
      "id": "sonar",
      "title": "声呐迷宫",
      "subtitle": "看不见墙，只听见回声",
      "description": "迷宫完全隐藏在黑暗里。每走一步都可能是墙，只能靠声呐脉冲短暂照亮周围。找到右下角出口，用最少的脉冲逃出去。",
      "icon": "📡",
      "accent": "#67e8f9",
      "accent2": "#0e7490",
      "tags": [
        "益智",
        "挑战"
      ],
      "difficulty": "困难",
      "width": 640,
      "height": 640,
      "controls": [
        {
          "keys": "方向键 / WASD",
          "action": "移动"
        },
        {
          "keys": "空格 / 点击",
          "action": "发出声呐"
        },
        {
          "keys": "R",
          "action": "重新生成迷宫"
        }
      ],
      "tips": "声呐会同时照亮周围八格以外的墙，先原地脉冲一次再决定第一步。",
      "order": 90,
      "external": false,
      "playUrl": "arcade/index.html?embed=1#/play/sonar",
      "iconArt": "arcade/assets/img/games/tower-icon.webp",
      "bgArt": "arcade/assets/img/games/tower-bg.webp",
      "cover": "svg"
    },
    {
      "id": "syncrings",
      "title": "三重同步",
      "subtitle": "在缺口对齐的瞬间锁定",
      "description": "三层异速旋转的圆环，每层只有一个缺口。高亮环转到顶端时按下，把三层依次锁定。越往后速度越快，容错越低。",
      "icon": "◉",
      "accent": "#c4b5fd",
      "accent2": "#6d28d9",
      "tags": [
        "街机",
        "挑战"
      ],
      "difficulty": "困难",
      "width": 640,
      "height": 640,
      "controls": [
        {
          "keys": "空格 / 点击",
          "action": "锁定当前环"
        },
        {
          "keys": "R",
          "action": "重新开始"
        }
      ],
      "tips": "看最外圈的高亮缺口，不要同时追三圈；按下去的瞬间以高亮环为准。",
      "order": 91,
      "external": false,
      "playUrl": "arcade/index.html?embed=1#/play/syncrings",
      "iconArt": "arcade/assets/img/games/hextris-icon.webp",
      "bgArt": "arcade/assets/img/games/hextris-bg.webp",
      "cover": "svg"
    },
    {
      "id": "mirror",
      "title": "镜像双生",
      "subtitle": "一步同时走两个自己",
      "description": "你操控左边的「实」与右边的「镜」，它们永远左右对称。两块身体共享方向键，任何一方撞墙都会同时停下。让两个自己分别抵达左下与右下的出口。",
      "icon": "🪞",
      "accent": "#e9d5ff",
      "accent2": "#7e22ce",
      "tags": [
        "益智",
        "挑战"
      ],
      "difficulty": "困难",
      "width": 640,
      "height": 640,
      "controls": [
        {
          "keys": "方向键 / WASD",
          "action": "同时移动两个镜像体"
        },
        {
          "keys": "R",
          "action": "重新开始"
        }
      ],
      "tips": "先让两个自己一起向下，再左右调整；任何一边被墙卡住，整步都会作废。",
      "order": 92,
      "external": false,
      "playUrl": "arcade/index.html?embed=1#/play/mirror",
      "iconArt": "arcade/assets/img/games/gomoku-icon.webp",
      "bgArt": "arcade/assets/img/games/gomoku-bg.webp",
      "cover": "svg"
    },
    {
      "id": "hextris",
      "title": "六边形消除",
      "subtitle": "旋转六边形 · 同色消除",
      "description": "Hextris：旋转中央六边形，连接同色方块并争取高分。",
      "icon": "⬡",
      "accent": "#34b5ee",
      "tags": [
        "益智",
        "挑战"
      ],
      "difficulty": "中等",
      "order": 95,
      "url": "vendor/hextris/index.html",
      "source": "https://github.com/hextris/hextris",
      "license": "GPL-3.0",
      "help": "左右方向键旋转；触屏点击屏幕左右两侧。暂停和重新开始使用游戏内按钮。",
      "external": true,
      "playUrl": "arcade/index.html?embed=1#/play/hextris",
      "iconArt": "arcade/assets/img/games/hextris-icon.webp",
      "bgArt": "arcade/assets/img/games/hextris-bg.webp",
      "cover": "svg"
    }
  ]
};
