# 第三方开源许可

本站包含的第三方代码均保留原始版权与许可声明。除下列内容外，其余游戏与站点代码均为本项目原创。

## 中国象棋（Xiangqi）

- 项目：<https://github.com/j32ryc/xiangqi>
- 作者：j32ryc
- 使用方式：规则引擎与 Alpha-Beta AI 基本原样移植，渲染与交互按本站引擎重写
- 源码留档：`vendor/xiangqi/`（engine.js / ai.js / render.js / app.js）
- 运行文件：`src/games/xiangqi.js`（文件头保留版权声明）

```
MIT License

Copyright (c) 2026 j32ryc

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Survivor（弹幕生存）

- 项目：<https://github.com/ricardo-foundry/canvas-vampire-survivors>
- 许可：MIT（完整许可证：`vendor/survivor/LICENSE`）
- 使用方式：完整游戏以独立页面嵌入（iframe），源码、许可与 UPSTREAM 信息保留在 `vendor/survivor/`
- 修改：移除了 Service Worker 注册（避免静态站点缓存旧版本）；未修改游戏逻辑与素材

## Hextris（六边形消除）

- 项目：<https://github.com/hextris/hextris>
- 许可：GPL-3.0（完整许可证：`vendor/hextris/LICENSE.md`）
- 使用方式：完整游戏以独立页面嵌入（iframe），完整对应源码随包提供于 `vendor/hextris/`
- 修改（依据 GPL-3.0 标注）：
  - 移除原站的广告、外部字体、统计脚本与向外部 IP 上报分数的请求
  - 隐藏原站的社交分享与商店推广按钮
  - 移除 Service Worker / 离线缓存
- Hextris 作为独立作品按 GPL-3.0 分发；本站其余代码不属于该作品。

## 玩法参考（未复制代码）

以下开源项目仅用于玩法研究，站点内均为原创实现：

- 合成大西瓜玩法参考：[choshinyoung/watermelon](https://github.com/choshinyoung/watermelon)（MIT）
- 羊了个羊玩法参考：[liyupi/yulegeyu](https://github.com/liyupi/yulegeyu)（无许可证，仅借鉴规则）
- 桌球玩法参考：[henshmi/Classic-Pool-Game](https://github.com/henshmi/Classic-Pool-Game)（MIT）
- 塔防玩法参考：[oldj/html5-tower-defense](https://github.com/oldj/html5-tower-defense)（MIT）
- 纸牌接龙玩法参考：[gcedo/react-solitaire](https://github.com/gcedo/react-solitaire)（MIT）
- SkiFree / Pac-Man 等仅作为品类与手感参考。


## React Bits（视觉参考）

部分视觉动效（Glare Hover、Spotlight Card、Shiny Text、Star Border、Light Rays、Click Spark 等）参考自 [React Bits](https://github.com/DavidHDev/react-bits)，并以原生 CSS/JS 重写。

React Bits 使用 MIT + Commons Clause 许可：允许作为网站/产品的一部分使用，但不得单独销售或再分发组件本身及移植版。许可证全文：https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md
