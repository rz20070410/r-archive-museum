# Rz神次元游戏箱 · 游戏开发契约（GAME API）

本文件是唯一的接口契约。**游戏文件只允许写自己的 `src/games/<id>.js`，不要修改 `index.html`、`src/app.js`、`src/core/*`、`assets/css/*`**（这些由 Lead 维护）。新增游戏已在 `index.html` 里预留好 `<script>` 标签，文件名必须是约定的文件名。

## 1. 技术约束

- 纯浏览器端原生 JS（ES2017+），**不能用 ES module / import / export**。所有文件用经典 `<script>` 顺序加载，通过全局对象 `window.Arcade` 注册。
- 不允许依赖任何外部 CDN、字体、图片、音频。所有画面用 Canvas 2D API 程序化绘制，音效用 `rt.audio.play()` 合成。
- 一个游戏 = 一个文件，文件形如：

```js
/* 游戏：贪吃蛇 */
(function () {
  'use strict';

  Arcade.register({
    id: 'snake',
    /* ...元数据... */
    create: function (rt) {
      /* 初始化 */
      return {
        update: function (dt) { /* dt 单位：秒，已 clamp 到 <= 0.05 */ },
        render: function (ctx) { /* 逻辑坐标系绘制 */ },
        onKeyDown: function (code, event) {},
        onPointerDown: function (x, y) {},
        onPointerMove: function (x, y) {},
        onPointerUp: function (x, y) {},
        destroy: function () {}
      };
    }
  });
})();
```

- 逻辑分辨率固定为元数据里的 `width` / `height`，引擎负责 DPR 缩放与 CSS 自适应；`render(ctx)` 内不需要处理缩放。
- 每一帧引擎都会：调用 `update(dt)` → `render(ctx)`。`create()` 返回的对象里 `update` 和 `render` 必填，其余可选。
- 游戏**必须能反复创建**：点「再来一局」会先调用 `destroy()`，再重新调用 `create(rt)`。所有状态都放在 `create` 的闭包里，不要用模块级可变状态。
- `create(rt)` 里不要写 `requestAnimationFrame`、不要 `addEventListener`（除 `rt.canvas` 上的可选用法外，推荐全部用回调）。生命周期由引擎管理。
- 坐标原点在画布左上角，y 轴向下。

## 2. 元数据字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | ✅ | 唯一 id，必须和文件名一致（如 `snake`） |
| `title` | string | ✅ | 中文名，2–6 字 |
| `subtitle` | string | ✅ | 一句话卖点，≤ 14 字 |
| `description` | string | ✅ | 1–2 句介绍，30–70 字 |
| `icon` | string | ✅ | 单个 emoji |
| `accent` / `accent2` | string | ✅ | 主题色（hex），用于卡片渐变与 HUD 高亮，`accent` 亮、`accent2` 深 |
| `tags` | string[] | ✅ | 1–2 个，从 `['街机','益智','休闲','经典','挑战','对战','策略','卡牌']` 里选 |
| `difficulty` | string | ✅ | `简单` / `中等` / `困难` |
| `width` / `height` | number | ✅ | 逻辑分辨率，建议 16:12 或 3:4，控制在 720×540 左右 |
| `controls` | object[] | ✅ | `[{ keys: '↑ ↓ ← →', action: '移动' }]`，2–4 条 |
| `tips` | string | ❌ | 一句玩法提示 |
| `order` | number | ❌ | 大厅排序权重，越小越靠前（默认 100） |
| `create` | function | ✅ | 工厂函数，见上 |

## 3. `rt` 运行时 API（引擎注入）

### 尺寸 / 时间
- `rt.width`, `rt.height` — 逻辑宽高（等于元数据）。
- `rt.time` — 自本局开始经过的秒数。
- `rt.frame` — 帧序号（从 0 递增）。

### 分数 / HUD
- `rt.score` — 当前分数（只读）。
- `rt.setScore(n)` — 设置当前分数。引擎会自动更新「最高分」并刷新 HUD。
- `rt.best` — 该游戏历史最高分。
- `rt.setHud(obj)` — 额外 HUD 徽章，如 `{ '等级': 3, '生命': '❤❤❤' }`；传 `{}` 清空。值会被转成字符串。
- `rt.setStatus(text)` — HUD 下方一行小字提示（如「按空格开始」），传 `''` 清空。

### 结束一局
```js
rt.end({
  score: 1200,          // 必填，最终分数（也会自动同步给 HUD / 最高分）
  message: '你吃到了 12 颗豆子',  // 可选，结算文案
  won: false,           // true 时结算标题显示「通关！」
  stats: [              // 可选，结算面板的数据行
    { label: '吃掉豆子', value: 12 },
    { label: '存活时间', value: '45.2s' }
  ]
});
```
调用后引擎会停止循环、显示结算面板，玩家可「再来一局」或「返回大厅」。**调用后不要再改状态**。

### 音效
`rt.audio.play(name)`，内置合成音色：
`'click' | 'blip' | 'eat' | 'hit' | 'explode' | 'win' | 'lose' | 'level' | 'pop' | 'toggle' | 'step' | 'merge' | 'flip' | 'shoot' | 'jump' | 'error' | 'power'`
可传第二参数音量 0–1（默认 0.5），如 `rt.audio.play('hit', 0.8)`。

### 输入
- `rt.keys` — `Set<string>`，当前按下的 `KeyboardEvent.code`（如 `'ArrowLeft'`、`'KeyW'`、`'Space'`）。
  - 用 `rt.keys.has('ArrowLeft')` 判断持续按住。
- `rt.wasPressed(code)` — 本帧内是否刚按下（边沿触发，适合跳跃 / 转向 / 开火）。
- `rt.pointer` — `{ x, y, down, clicked }`，坐标为逻辑坐标：
  - `x`,`y` 最近一次指针位置（鼠标或触摸）；
  - `down` 当前是否按住；
  - `clicked` 本帧是否发生了一次按下（边沿触发）。
  - 移动端触摸已统一为 pointer 事件。桌面端鼠标右键不要用。
- `onPointerMove/Down/Up(x, y, event)` 回调可选，收到逻辑坐标，第三个参数是原始 PointerEvent（右键判断用 `event.button === 2`；触屏长按需自己计时）。需要拖拽类交互时用它们更自然。
- `onKeyDown(code, event)` 可选；注意 `event.preventDefault()` 由引擎对方向键/空格统一处理了，不要重复。
- 引擎全局快捷键（不要占用）：`Esc`/`P` 暂停，`R` 重开，`M` 静音，`Enter`（结算时重开）。

### 存档
- `rt.storage.get(key, fallback)` / `rt.storage.set(key, value)` / `rt.storage.del(key)` — 自动按游戏 id 命名空间隔离，值会 JSON 序列化（可存对象）。用于最高关卡、解锁进度、静音偏好等。不要存几 MB 的数据。

### 工具
- `rt.rand(min, max)` — 浮点随机；`rt.randInt(min, max)` — 整数含两端；`rt.pick(arr)` — 随机取一项。
- `rt.clamp(v, min, max)`。
- `rt.colors` — 统一配色：`{ bg, panel, line, text, muted, accent, accent2, danger, success, warn }`（字符串），建议直接沿用，保证全站视觉统一。
- `rt.canvas` — canvas 元素（一般用不到；如需 `getBoundingClientRect` 可以用）。
- `rt.hudElement` — HUD 容器 DOM（不要修改）。

## 4. 视觉与手感要求（重要）

1. **第一帧就要好看**：不要等玩家操作才画内容。开局应有完整的场景（网格、边框、装饰、标题信息），不能是黑屏。
2. **有自己的视觉语言**：深色底 + 霓虹发光（`ctx.shadowBlur` / `shadowColor`）、圆角矩形、渐变、粒子。不要纯白底 + 黑线。
3. **手感**：
   - 有输入反馈（音效 + 视觉缩放/闪烁/粒子）；
   - 有缓动动画（吃豆的放大、砖块碎裂、方块下落、得分飘字），用 `rt.time` 做插值；
   - 有「危险 / 高光」状态（如最后几条命时红色脉冲）。
4. **难度曲线**：开局简单，随时间/分数逐渐加速，但不要失控。
5. **分辨率无关**：所有布局基于 `rt.width/rt.height` 计算，不要写死像素假设窗口大小。
6. **文字用 `ctx.font`**：中文字体用 `'PingFang SC', 'Microsoft YaHei', sans-serif`；数字/英文用 `'Consolas', monospace` 更有街机感。
7. 不要出现 `alert` / `confirm` / `prompt`、不要打开新窗口。
8. 性能：每帧不要创建大量对象/数组；粒子总量 < 300；`ctx.shadowBlur` 不要给每个粒子都开（很贵），只给少量关键元素开。
9. 暂停是引擎负责的：暂停时不会调用 `update`，也不会调用 `render`（引擎会盖一层模糊遮罩）。所以不需要自己处理暂停。

## 5. 自检清单（提交前必须做）

1. `node --check src/games/<id>.js` 通过（Node 路径见下）。
2. 浏览器打开站点，进入游戏，能正常开始、得分、结束、再来一局。
3. 结束时调用 `rt.end()`，结算面板正常出现。
4. 重新开始后没有残留状态（分数、粒子、计时器、标志位都要重置）。
5. 键盘、鼠标/触摸至少各验证一种输入。
6. 连续玩 2 分钟无报错、无明显掉帧。

Node 路径：`C:\Users\rz200\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe`

本地预览：在项目根目录运行 `node serve.mjs`，然后浏览器打开 <http://127.0.0.1:4173>。
