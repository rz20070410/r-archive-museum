# 中国象棋 · 第三方源码

来源：https://github.com/j32ryc/xiangqi
作者：j32ryc
许可：MIT（见同目录 LICENSE）

本目录保存原项目的规则引擎、AI、渲染与应用层源码，作为移植参考：

- `engine.js` → 规则引擎（走法生成、将军判定、中文记谱），基本原样移植进游戏文件
- `ai.js` → Alpha-Beta 搜索 + 评估函数，基本原样移植进游戏文件
- `render.js` → Canvas 棋盘/棋子绘制，按本站固定分辨率与霓虹视觉适配
- `app.js` → 对局流程与交互参考

游戏内实际运行的是 `src/games/xiangqi.js` 中适配到本街机引擎的版本。
