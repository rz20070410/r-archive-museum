/*!
 * 中国象棋 · 霓虹街机移植版（Arcade 640×800 适配层）
 *
 * 规则引擎与 AI 来自开源项目：https://github.com/j32ryc/xiangqi
 * MIT License · Copyright (c) 2026 j32ryc
 * 原始文件：vendor/xiangqi/engine.js（规则引擎）、vendor/xiangqi/ai.js（Alpha-Beta AI）、
 *           vendor/xiangqi/render.js / app.js（渲染与流程参考）
 * 本文件把上述引擎原样封装进局部命名空间，并适配 Arcade 的 create(rt) 生命周期、
 * 固定逻辑分辨率、指针/键盘输入与 Canvas 2D 渲染。
 */
(function () {
  'use strict';

  /* =========================================================================
   * 1) vendor/xiangqi/engine.js —— 原样嵌入
   *    MIT License · Copyright (c) 2026 j32ryc · https://github.com/j32ryc/xiangqi
   * ========================================================================= */
  var Xiangqi = (function () {
    var root = {};
    (function (global) {
      'use strict';

      var EMPTY = 0, KING = 1, ADVISOR = 2, ELEPHANT = 3, HORSE = 4, ROOK = 5, CANNON = 6, PAWN = 7;
      var RED = 1, BLACK = -1;

      var START = [
        -5, -4, -3, -2, -1, -2, -3, -4, -5,
         0,  0,  0,  0,  0,  0,  0,  0,  0,
         0, -6,  0,  0,  0,  0,  0, -6,  0,
        -7,  0, -7,  0, -7,  0, -7,  0, -7,
         0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,
         7,  0,  7,  0,  7,  0,  7,  0,  7,
         0,  6,  0,  0,  0,  0,  0,  6,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,
         5,  4,  3,  2,  1,  2,  3,  4,  5
      ];

      // 棋子汉字：[红, 黑]
      var GLYPH = {
        1: ['帅', '将'],
        2: ['仕', '士'],
        3: ['相', '象'],
        4: ['马', '马'],
        5: ['车', '车'],
        6: ['炮', '砲'],
        7: ['兵', '卒']
      };

      var CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

      function row(s) { return (s / 9) | 0; }
      function col(s) { return s % 9; }
      function sq(r, c) { return r * 9 + c; }
      function onBoard(r, c) { return r >= 0 && r < 10 && c >= 0 && c < 9; }
      function sideOf(p) { return p > 0 ? RED : (p < 0 ? BLACK : 0); }
      function typeOf(p) { return p < 0 ? -p : p; }

      function inPalace(r, c, side) {
        if (c < 3 || c > 5) return false;
        return side === RED ? (r >= 7 && r <= 9) : (r >= 0 && r <= 2);
      }
      function ownHalf(r, side) {
        return side === RED ? r >= 5 : r <= 4;
      }
      function crossedRiver(r, side) {
        return side === RED ? r <= 4 : r >= 5;
      }

      // 走法编码：from * 90 + to
      function mkMove(from, to) { return from * 90 + to; }
      function moveFrom(m) { return (m / 90) | 0; }
      function moveTo(m) { return m % 90; }

      var HORSE_STEP = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
      var HORSE_LEG = [[-1, 0], [-1, 0], [0, -1], [0, 1], [0, -1], [0, 1], [1, 0], [1, 0]];
      var ELEPHANT_STEP = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
      var ADVISOR_STEP = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      var ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];

      /** 生成某一方的全部伪合法走法（未过滤送将） */
      function genMoves(board, side, out) {
        out.length = 0;
        for (var from = 0; from < 90; from++) {
          var p = board[from];
          if (p === EMPTY || sideOf(p) !== side) continue;
          var t = typeOf(p), r = row(from), c = col(from), i, d, nr, nc, to, tp;

          if (t === ROOK || t === CANNON) {
            for (d = 0; d < 4; d++) {
              nr = r + ORTHO[d][0]; nc = c + ORTHO[d][1];
              var jumped = false;
              while (onBoard(nr, nc)) {
                to = sq(nr, nc); tp = board[to];
                if (!jumped) {
                  if (tp === EMPTY) {
                    out.push(mkMove(from, to));
                  } else if (t === ROOK) {
                    if (sideOf(tp) !== side) out.push(mkMove(from, to));
                    break;
                  } else {
                    jumped = true; // 炮：越过炮架后继续寻找目标
                  }
                } else if (tp !== EMPTY) {
                  if (sideOf(tp) !== side) out.push(mkMove(from, to));
                  break;
                }
                nr += ORTHO[d][0]; nc += ORTHO[d][1];
              }
            }
          } else if (t === HORSE) {
            for (i = 0; i < 8; i++) {
              nr = r + HORSE_STEP[i][0]; nc = c + HORSE_STEP[i][1];
              if (!onBoard(nr, nc)) continue;
              if (board[sq(r + HORSE_LEG[i][0], c + HORSE_LEG[i][1])] !== EMPTY) continue; // 蹩马腿
              to = sq(nr, nc);
              if (board[to] === EMPTY || sideOf(board[to]) !== side) out.push(mkMove(from, to));
            }
          } else if (t === ELEPHANT) {
            for (i = 0; i < 4; i++) {
              nr = r + ELEPHANT_STEP[i][0]; nc = c + ELEPHANT_STEP[i][1];
              if (!onBoard(nr, nc) || !ownHalf(nr, side)) continue; // 象不过河
              if (board[sq(r + ELEPHANT_STEP[i][0] / 2, c + ELEPHANT_STEP[i][1] / 2)] !== EMPTY) continue; // 塞象眼
              to = sq(nr, nc);
              if (board[to] === EMPTY || sideOf(board[to]) !== side) out.push(mkMove(from, to));
            }
          } else if (t === ADVISOR) {
            for (i = 0; i < 4; i++) {
              nr = r + ADVISOR_STEP[i][0]; nc = c + ADVISOR_STEP[i][1];
              if (!onBoard(nr, nc) || !inPalace(nr, nc, side)) continue;
              to = sq(nr, nc);
              if (board[to] === EMPTY || sideOf(board[to]) !== side) out.push(mkMove(from, to));
            }
          } else if (t === KING) {
            for (i = 0; i < 4; i++) {
              nr = r + ORTHO[i][0]; nc = c + ORTHO[i][1];
              if (!onBoard(nr, nc) || !inPalace(nr, nc, side)) continue;
              to = sq(nr, nc);
              if (board[to] === EMPTY || sideOf(board[to]) !== side) out.push(mkMove(from, to));
            }
          } else if (t === PAWN) {
            var fwd = side === RED ? -1 : 1;
            nr = r + fwd; nc = c;
            if (onBoard(nr, nc)) {
              to = sq(nr, nc);
              if (board[to] === EMPTY || sideOf(board[to]) !== side) out.push(mkMove(from, to));
            }
            if (crossedRiver(r, side)) { // 过河后可横走
              for (i = -1; i <= 1; i += 2) {
                nc = c + i;
                if (!onBoard(r, nc)) continue;
                to = sq(r, nc);
                if (board[to] === EMPTY || sideOf(board[to]) !== side) out.push(mkMove(from, to));
              }
            }
          }
        }
        return out;
      }

      function findKing(board, side) {
        var target = side === RED ? KING : -KING;
        for (var i = 0; i < 90; i++) if (board[i] === target) return i;
        return -1;
      }

      /** side 方的将/帅是否被攻击（含「白脸将」） */
      function inCheck(board, side) {
        var k = findKing(board, side);
        if (k < 0) return true;
        var kr = row(k), kc = col(k), d, nr, nc, p, t;

        // 车 / 炮 / 对面将
        for (d = 0; d < 4; d++) {
          nr = kr + ORTHO[d][0]; nc = kc + ORTHO[d][1];
          var found = 0;
          while (onBoard(nr, nc)) {
            p = board[sq(nr, nc)];
            if (p !== EMPTY) {
              t = typeOf(p);
              var enemy = sideOf(p) !== side;
              if (found === 0) {
                if (enemy && (t === ROOK || (t === KING && ORTHO[d][1] === 0))) return true;
                found = 1;
              } else {
                if (enemy && t === CANNON) return true;
                break;
              }
            }
            nr += ORTHO[d][0]; nc += ORTHO[d][1];
          }
        }

        // 马（需判断是否被蹩腿）
        for (d = 0; d < 8; d++) {
          nr = kr + HORSE_STEP[d][0]; nc = kc + HORSE_STEP[d][1];
          if (!onBoard(nr, nc)) continue;
          p = board[sq(nr, nc)];
          if (p === EMPTY || sideOf(p) === side || typeOf(p) !== HORSE) continue;
          var lr = Math.abs(kr - nr) === 2 ? nr + (kr > nr ? 1 : -1) : nr;
          var lc = Math.abs(kc - nc) === 2 ? nc + (kc > nc ? 1 : -1) : nc;
          if (board[sq(lr, lc)] === EMPTY) return true;
        }

        // 兵 / 卒
        var pf = side === RED ? -1 : 1; // 敌兵从该方向逼近我方将
        if (onBoard(kr + pf, kc)) {
          p = board[sq(kr + pf, kc)];
          if (p !== EMPTY && sideOf(p) !== side && typeOf(p) === PAWN) return true;
        }
        for (d = -1; d <= 1; d += 2) {
          if (!onBoard(kr, kc + d)) continue;
          p = board[sq(kr, kc + d)];
          if (p !== EMPTY && sideOf(p) !== side && typeOf(p) === PAWN && crossedRiver(kr, -side)) return true;
        }
        return false;
      }

      /** 过滤掉会导致自己被将的走法 */
      function legalMoves(board, side) {
        var pseudo = [];
        genMoves(board, side, pseudo);
        var res = [];
        for (var i = 0; i < pseudo.length; i++) {
          var m = pseudo[i], f = moveFrom(m), t = moveTo(m);
          var cap = board[t];
          board[t] = board[f]; board[f] = EMPTY;
          if (!inCheck(board, side)) res.push(m);
          board[f] = board[t]; board[t] = cap;
        }
        return res;
      }

      function isLegal(board, side, from, to) {
        var moves = legalMoves(board, side), m = mkMove(from, to);
        for (var i = 0; i < moves.length; i++) if (moves[i] === m) return true;
        return false;
      }

      // ---------- 中文记谱 ----------
      function colName(c, side) {
        return side === RED ? CN_NUM[8 - c] : String(c + 1);
      }
      function numName(n, side) {
        return side === RED ? CN_NUM[n - 1] : String(n);
      }

      /** 生成传统中文记谱，如「炮二平五」「马8进7」 */
      function moveToChinese(board, from, to) {
        var p = board[from];
        if (p === EMPTY) return '';
        var side = sideOf(p), t = typeOf(p);
        var name = GLYPH[t][side === RED ? 0 : 1];
        var fr = row(from), fc = col(from), tr = row(to), tc = col(to);

        // 同一纵线上有同种棋子时，用「前 / 中 / 后」区分
        var sameCol = [];
        for (var r = 0; r < 10; r++) if (board[sq(r, fc)] === p) sameCol.push(r);
        if (sameCol.length > 1 && t !== KING) {
          var idx = sameCol.indexOf(fr);
          var order = side === RED ? idx : sameCol.length - 1 - idx; // 0 = 最靠前
          if (sameCol.length === 2) name = (order === 0 ? '前' : '后') + name;
          else if (order === 0) name = '前' + name;
          else if (order === sameCol.length - 1) name = '后' + name;
          else name = CN_NUM[order] + name;
        } else {
          name = name + colName(fc, side);
        }

        if (tr === fr) return name + '平' + colName(tc, side);
        var action = (side === RED ? tr < fr : tr > fr) ? '进' : '退';
        if (t === HORSE || t === ELEPHANT || t === ADVISOR) return name + action + colName(tc, side);
        return name + action + numName(Math.abs(tr - fr), side);
      }

      global.Xiangqi = {
        EMPTY: EMPTY, KING: KING, ADVISOR: ADVISOR, ELEPHANT: ELEPHANT,
        HORSE: HORSE, ROOK: ROOK, CANNON: CANNON, PAWN: PAWN,
        RED: RED, BLACK: BLACK,
        START: START, GLYPH: GLYPH,
        row: row, col: col, sq: sq, onBoard: onBoard,
        sideOf: sideOf, typeOf: typeOf, inPalace: inPalace, crossedRiver: crossedRiver,
        mkMove: mkMove, moveFrom: moveFrom, moveTo: moveTo,
        genMoves: genMoves, legalMoves: legalMoves, isLegal: isLegal,
        inCheck: inCheck, findKing: findKing,
        moveToChinese: moveToChinese
      };
    })(root);
    return root.Xiangqi;
  })();

  /* =========================================================================
   * 2) vendor/xiangqi/ai.js —— 原样嵌入
   *    MIT License · Copyright (c) 2026 j32ryc · https://github.com/j32ryc/xiangqi
   * ========================================================================= */
  var XiangqiAI = (function (Xiangqi) {
    var root = { Xiangqi: Xiangqi };
    (function (global) {
      'use strict';

      var X = global.Xiangqi;
      var RED = X.RED, BLACK = X.BLACK, EMPTY = X.EMPTY;

      // ---------- 子力基础价值 ----------
      var VALUE = [0, 100000, 120, 120, 270, 600, 285, 40];

      // ---------- 位置价值表（红方视角，row 0 在上）----------
      var PST_PAWN = [
         9,  9,  9, 11, 13, 11,  9,  9,  9,
        19, 24, 34, 42, 44, 42, 34, 24, 19,
        19, 24, 32, 37, 37, 37, 32, 24, 19,
        19, 23, 27, 29, 30, 29, 27, 23, 19,
        14, 18, 20, 27, 29, 27, 20, 18, 14,
         7,  0, 13,  0, 16,  0, 13,  0,  7,
         7,  0,  7,  0, 15,  0,  7,  0,  7,
         0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0
      ];

      var PST_HORSE = [
         0, -4,  0,  0,  0,  0,  0, -4,  0,
         0,  2,  4,  4, -2,  4,  4,  2,  0,
         4,  2,  8,  8,  4,  8,  8,  2,  4,
         2,  6,  8,  6, 10,  6,  8,  6,  2,
         4, 12, 16, 14, 12, 14, 16, 12,  4,
         6, 16, 14, 18, 16, 18, 14, 16,  6,
         8, 24, 18, 24, 20, 24, 18, 24,  8,
        12, 14, 16, 20, 18, 20, 16, 14, 12,
         4, 10, 28, 16,  8, 16, 28, 10,  4,
         4,  8, 16, 12,  4, 12, 16,  8,  4
      ];

      var PST_ROOK = [
        -6,  6,  4, 12, 12, 12,  4,  6, -6,
         5,  8,  6, 12, 14, 12,  6,  8,  5,
        -2,  8,  4, 12, 12, 12,  4,  8, -2,
         4,  9,  4, 12, 14, 12,  4,  9,  4,
         8, 12, 12, 14, 15, 14, 12, 12,  8,
         8, 11, 11, 14, 15, 14, 11, 11,  8,
         6, 13, 13, 16, 16, 16, 13, 13,  6,
         6,  8,  7, 14, 16, 14,  7,  8,  6,
         6, 10,  8, 14, 14, 14,  8, 10,  6,
        14, 14, 12, 18, 16, 18, 12, 14, 14
      ];

      var PST_CANNON = [
         6,  4,  0, -10, -12, -10,  0,  4,  6,
         2,  2,  0,  -4, -14,  -4,  0,  2,  2,
         2,  2,  0, -10,  -8, -10,  0,  2,  2,
         0,  0, -2,   4,  10,   4, -2,  0,  0,
         0,  0,  0,   2,   8,   2,  0,  0,  0,
        -2,  0,  4,   2,   6,   2,  4,  0, -2,
         0,  0,  0,   2,   4,   2,  0,  0,  0,
         4,  0,  8,   6,  10,   6,  8,  0,  4,
         0,  2,  4,   6,   6,   6,  4,  2,  0,
         0,  0,  1,   3,   3,   3,  1,  0,  0
      ];

      var PST_ADVISOR = new Array(90).fill(0);
      var PST_ELEPHANT = new Array(90).fill(0);
      var PST_KING = new Array(90).fill(0);
      // 仕：守在九宫要点
      PST_ADVISOR[7 * 9 + 3] = 3; PST_ADVISOR[7 * 9 + 5] = 3;
      PST_ADVISOR[8 * 9 + 4] = 6;
      PST_ADVISOR[9 * 9 + 3] = 2; PST_ADVISOR[9 * 9 + 5] = 2;
      // 相：连环相位置更佳
      PST_ELEPHANT[7 * 9 + 2] = 5; PST_ELEPHANT[7 * 9 + 6] = 5;
      PST_ELEPHANT[9 * 9 + 2] = 3; PST_ELEPHANT[9 * 9 + 6] = 3;
      PST_ELEPHANT[5 * 9 + 0] = 1; PST_ELEPHANT[5 * 9 + 4] = 2; PST_ELEPHANT[5 * 9 + 8] = 1;
      // 帅：老老实实待在底线
      PST_KING[7 * 9 + 3] = 1; PST_KING[7 * 9 + 4] = 5; PST_KING[7 * 9 + 5] = 1;
      PST_KING[8 * 9 + 3] = 3; PST_KING[8 * 9 + 4] = 8; PST_KING[8 * 9 + 5] = 3;
      PST_KING[9 * 9 + 3] = 9; PST_KING[9 * 9 + 4] = 12; PST_KING[9 * 9 + 5] = 9;

      var PST = [null, PST_KING, PST_ADVISOR, PST_ELEPHANT, PST_HORSE, PST_ROOK, PST_CANNON, PST_PAWN];

      var MATE = 30000;
      var INF = 1000000;

      // 黑方镜像索引（上下翻转）
      var MIRROR = new Int8Array(90);
      for (var i = 0; i < 90; i++) MIRROR[i] = (9 - ((i / 9) | 0)) * 9 + (i % 9);

      /** 局面评估，返回红方视角分值 */
      function evaluate(board) {
        var score = 0;
        for (var s = 0; s < 90; s++) {
          var p = board[s];
          if (p === EMPTY) continue;
          if (p > 0) score += VALUE[p] + PST[p][s];
          else score -= VALUE[-p] + PST[-p][MIRROR[s]];
        }
        return score;
      }

      // ---------- 搜索状态 ----------
      var nodes = 0, deadline = 0, aborted = false;
      var killers = [];
      var history = new Int32Array(90 * 90);

      function resetSearch() {
        nodes = 0; aborted = false;
        killers = [];
        for (var i = 0; i < 64; i++) killers.push([0, 0]);
        history = new Int32Array(90 * 90);
      }

      function timeUp() {
        if (aborted) return true;
        if ((nodes & 1023) === 0 && Date.now() > deadline) aborted = true;
        return aborted;
      }

      /** 走法排序打分：吃子按 MVV-LVA，其余用杀手 / 历史启发 */
      function scoreMove(board, m, ply, pvMove) {
        if (m === pvMove) return 10000000;
        var to = X.moveTo(m), victim = board[to];
        if (victim !== EMPTY) {
          var attacker = board[X.moveFrom(m)];
          return 1000000 + VALUE[victim < 0 ? -victim : victim] * 16 - VALUE[attacker < 0 ? -attacker : attacker];
        }
        var k = killers[ply];
        if (k) {
          if (m === k[0]) return 900000;
          if (m === k[1]) return 800000;
        }
        return history[m % (90 * 90)];
      }

      function sortMoves(board, moves, ply, pvMove) {
        var scored = [];
        for (var i = 0; i < moves.length; i++) {
          scored.push([scoreMove(board, moves[i], ply, pvMove), moves[i]]);
        }
        scored.sort(function (a, b) { return b[0] - a[0]; });
        for (var j = 0; j < scored.length; j++) moves[j] = scored[j][1];
        return moves;
      }

      /** 静态搜索：只搜吃子着法，避免地平线效应 */
      function quiesce(board, side, alpha, beta, ply) {
        nodes++;
        if (timeUp()) return 0;

        var stand = evaluate(board) * side;
        if (stand >= beta) return stand;
        if (stand > alpha) alpha = stand;
        if (ply > 24) return stand;

        var moves = [];
        X.genMoves(board, side, moves);
        var caps = [];
        for (var i = 0; i < moves.length; i++) {
          if (board[X.moveTo(moves[i])] !== EMPTY) caps.push(moves[i]);
        }
        sortMoves(board, caps, ply, 0);

        for (var j = 0; j < caps.length; j++) {
          var m = caps[j], f = X.moveFrom(m), t = X.moveTo(m), cap = board[t];
          if ((cap < 0 ? -cap : cap) === X.KING) return MATE - ply; // 可吃将 = 对方上一步非法
          board[t] = board[f]; board[f] = EMPTY;
          if (X.inCheck(board, side)) { board[f] = board[t]; board[t] = cap; continue; }
          var score = -quiesce(board, -side, -beta, -alpha, ply + 1);
          board[f] = board[t]; board[t] = cap;
          if (aborted) return 0;
          if (score >= beta) return score;
          if (score > alpha) alpha = score;
        }
        return alpha;
      }

      function search(board, side, depth, alpha, beta, ply, pvMove) {
        if (depth <= 0) return quiesce(board, side, alpha, beta, ply);
        nodes++;
        if (timeUp()) return 0;

        var checked = X.inCheck(board, side);
        if (checked) depth++; // 被将时延伸一层

        var moves = [];
        X.genMoves(board, side, moves);
        sortMoves(board, moves, ply, pvMove);

        var best = -INF, legalCount = 0, bestMove = 0;
        for (var i = 0; i < moves.length; i++) {
          var m = moves[i], f = X.moveFrom(m), t = X.moveTo(m), cap = board[t];
          board[t] = board[f]; board[f] = EMPTY;
          if (X.inCheck(board, side)) { board[f] = board[t]; board[t] = cap; continue; }
          legalCount++;
          var score = -search(board, -side, depth - 1, -beta, -alpha, ply + 1, 0);
          board[f] = board[t]; board[t] = cap;
          if (aborted) return 0;

          if (score > best) { best = score; bestMove = m; }
          if (score > alpha) {
            alpha = score;
            if (alpha >= beta) {
              if (cap === EMPTY) { // 静着才记入杀手 / 历史
                var k = killers[ply];
                if (k && k[0] !== m) { k[1] = k[0]; k[0] = m; }
                history[m % (90 * 90)] += depth * depth;
              }
              break;
            }
          }
        }

        if (legalCount === 0) return -MATE + ply; // 被将死或困毙，象棋中同判负
        return best;
      }

      /**
       * 搜索最佳着法
       * @param {Int8Array} board 当前局面
       * @param {number} side 走棋方
       * @param {Object} opts { depth, timeMs, noise }
       * @returns {{move:number, score:number, depth:number, nodes:number, ms:number}}
       */
      function think(board, side, opts) {
        opts = opts || {};
        var maxDepth = opts.depth || 4;
        var timeMs = opts.timeMs || 1500;
        var noise = opts.noise || 0;

        resetSearch();
        deadline = Date.now() + timeMs;
        var t0 = Date.now();

        var work = Int8Array.from(board);
        var rootMoves = X.legalMoves(work, side);
        if (rootMoves.length === 0) return { move: 0, score: -MATE, depth: 0, nodes: 0, ms: 0 };

        var bestMove = rootMoves[0], bestScore = 0, reachedDepth = 0;

        for (var depth = 1; depth <= maxDepth; depth++) {
          var alpha = -INF, beta = INF;
          var localBest = 0, localScore = -INF;
          var ordered = rootMoves.slice();
          sortMoves(work, ordered, 0, bestMove);

          for (var i = 0; i < ordered.length; i++) {
            var m = ordered[i], f = X.moveFrom(m), t = X.moveTo(m), cap = work[t];
            work[t] = work[f]; work[f] = EMPTY;
            var score = -search(work, -side, depth - 1, -beta, -alpha, 1, 0);
            work[f] = work[t]; work[t] = cap;
            if (aborted) break;
            if (noise) score += (Math.random() * 2 - 1) * noise;
            if (score > localScore) { localScore = score; localBest = m; }
            if (score > alpha) alpha = score;
          }

          if (aborted && depth > 1) break;
          if (localBest) {
            bestMove = localBest; bestScore = localScore; reachedDepth = depth;
            rootMoves = ordered;
          }
          if (bestScore > MATE - 100 || bestScore < -MATE + 100) break; // 已找到杀棋
          if (Date.now() > deadline) break;
        }

        return {
          move: bestMove, score: Math.round(bestScore), depth: reachedDepth,
          nodes: nodes, ms: Date.now() - t0
        };
      }

      // ---------- 简易开局库：让 AI 前几步走出常见布局 ----------
      var BOOK = {
        1: [ // 红方：当头炮 / 屏风马 / 飞相局 / 挺兵
          [70, 67], [64, 67], [88, 69], [82, 65], [87, 67], [60, 51], [56, 47]
        ],
        '-1': [ // 黑方：屏风马 / 反宫炮 / 飞象 / 挺卒
          [7, 24], [1, 20], [19, 22], [25, 22], [2, 22], [29, 38], [33, 42]
        ]
      };

      /** 开局阶段随机选一个常见着法，找不到则返回 0 */
      function bookMove(board, side, plyCount) {
        if (plyCount > 5) return 0;
        var candidates = BOOK[String(side)] || [];
        var legal = X.legalMoves(board, side);
        var pool = [];
        for (var i = 0; i < candidates.length; i++) {
          var m = X.mkMove(candidates[i][0], candidates[i][1]);
          if (legal.indexOf(m) >= 0) pool.push(m);
        }
        if (!pool.length) return 0;
        return pool[(Math.random() * pool.length) | 0];
      }

      var LEVELS = {
        easy:   { name: '入门', depth: 2, timeMs: 400, noise: 45 },
        normal: { name: '业余', depth: 4, timeMs: 1200, noise: 12 },
        hard:   { name: '高手', depth: 6, timeMs: 2600, noise: 0 },
        master: { name: '大师', depth: 8, timeMs: 5000, noise: 0 }
      };

      global.XiangqiAI = {
        think: think, evaluate: evaluate, bookMove: bookMove, LEVELS: LEVELS, MATE: MATE
      };
    })(root);
    return root.XiangqiAI;
  })(Xiangqi);

  /* =========================================================================
   * 3) Arcade 适配层（本文件原创：布局 / 渲染 / 交互 / 对局流程）
   * ========================================================================= */

  var X = Xiangqi;
  var AI = XiangqiAI;

  var CELL = 57;
  var MARGIN = 40;
  var FRAME_PAD = 8;
  var LINES_W = CELL * 8;
  var LINES_H = CELL * 9;
  var PAPER_W = LINES_W + MARGIN * 2;
  var PAPER_H = LINES_H + MARGIN * 2;
  var FRAME_W = PAPER_W + FRAME_PAD * 2;
  var FRAME_H = PAPER_H + FRAME_PAD * 2;
  var FRAME_X = 44;
  var FRAME_Y = 92;
  var PAPER_X = FRAME_X + FRAME_PAD;
  var PAPER_Y = FRAME_Y + FRAME_PAD;
  var OX = PAPER_X + MARGIN;
  var OY = PAPER_Y + MARGIN;
  var PIECE_R = CELL * 0.44;

  var RED = X.RED;
  var BLACK = X.BLACK;
  var EMPTY = X.EMPTY;

  var FONT_CN = '"PingFang SC", "Microsoft YaHei", sans-serif';
  var FONT_KAI = '"STKaiti", "KaiTi", "Kaiti SC", "Songti SC", "SimSun", serif';
  var FONT_MONO = '"Consolas", monospace';

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
    id: 'xiangqi',
    title: '中国象棋',
    subtitle: '楚河汉界，人机对弈',
    description: '开源中国象棋引擎移植：你执红先行，点击走子，Alpha-Beta AI 执黑应战。支持悔棋、提示与重开，楚河汉界一局定胜负。',
    icon: '♟️',
    accent: '#ef4444',
    accent2: '#f59e0b',
    tags: ['益智', '对战'],
    difficulty: '困难',
    width: 640,
    height: 800,
    order: 85,
    tips: '开局先出车马炮控中路；AI 思考时别急着点，悔棋可一次回退两步。',
    controls: [
      { keys: '点击棋子 / 落点', action: '选子与走子' },
      { keys: 'U / 画布「悔棋」', action: '悔棋（回退两步）' },
      { keys: 'H / 画布「提示」', action: '提示一步好棋' },
      { keys: 'R', action: '重新开始' }
    ],

    create: function (rt) {
      var W = rt.width;
      var H = rt.height;

      /* ---------- 按钮布局（画布内，命中区比视觉略大，方便手机点按） ---------- */
      var BTN = {
        undo: { x: 346, y: 712, w: 78, h: 34, label: '悔棋' },
        hint: { x: 434, y: 712, w: 78, h: 34, label: '提示' },
        restart: { x: 522, y: 712, w: 78, h: 34, label: '重开' }
      };
      var BTN_PAD_X = 6;
      var BTN_PAD_Y = 8;

      function hitButton(b, x, y) {
        return x >= b.x - BTN_PAD_X && x <= b.x + b.w + BTN_PAD_X &&
          y >= b.y - BTN_PAD_Y && y <= b.y + b.h + BTN_PAD_Y;
      }

      /* ---------- 状态 ---------- */
      var board = Int8Array.from(X.START);
      var turn = RED;
      var history = [];
      var positions = {};
      var selected = -1;
      var targets = [];
      var anim = null;
      var phase = 'player';       // player | anim | aiWait | over
      var aiTimer = 0;
      var aiInfo = null;
      var hint = null;
      var hintTimer = 0;
      var movesSinceCapture = 0;
      var elapsed = 0;
      var ended = false;
      var overTimer = 0;
      var overPayload = null;
      var resultText = '';
      var resultKind = '';
      var statusText = '';
      var statusKind = 'info';
      var particles = [];
      var flash = 0;
      var checkPulse = 0;
      var pulse = 0;
      var lastHudSec = -1;
      var bgCanvas = null;
      var bgDpr = 0;

      /* ---------- 基础工具 ---------- */
      function fmtTime(sec) {
        var s = Math.max(0, Math.floor(sec));
        var m = Math.floor(s / 60);
        var ss = s % 60;
        return (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
      }

      function keyOf(b, side) {
        var s = '';
        for (var i = 0; i < 90; i++) s += String.fromCharCode(b[i] + 8);
        return s + (side === RED ? 'r' : 'b');
      }

      function rebuildPositions() {
        positions = {};
        var b = Int8Array.from(X.START);
        var s = RED;
        var k = keyOf(b, s);
        positions[k] = 1;
        for (var i = 0; i < history.length; i++) {
          var h = history[i];
          b[h.to] = h.piece;
          b[h.from] = EMPTY;
          s = -h.side;
          k = keyOf(b, s);
          positions[k] = (positions[k] || 0) + 1;
        }
      }

      function calcIdle() {
        var n = 0;
        for (var i = history.length - 1; i >= 0; i--) {
          if (history[i].captured !== EMPTY) break;
          n++;
        }
        return n;
      }

      function playerCaptures() {
        var n = 0;
        for (var i = 0; i < history.length; i++) {
          if (history[i].side === RED && history[i].captured !== EMPTY) n++;
        }
        return n;
      }

      function setStatus(text, kind) {
        statusText = text;
        statusKind = kind || 'info';
        rt.setStatus(text);
      }

      function syncHud() {
        rt.setHud({ 难度: '高手', 步数: history.length, 用时: fmtTime(elapsed) });
      }

      function sqPos(s) {
        return { x: OX + X.col(s) * CELL, y: OY + X.row(s) * CELL };
      }

      function hitSquare(px, py) {
        var c = Math.round((px - OX) / CELL);
        var r = Math.round((py - OY) / CELL);
        if (r < 0 || r > 9 || c < 0 || c > 8) return -1;
        var x = OX + c * CELL;
        var y = OY + r * CELL;
        if (Math.hypot(px - x, py - y) > CELL * 0.52) return -1;
        return r * 9 + c;
      }

      function legalTargetsFrom(sq) {
        var all = X.legalMoves(board, turn);
        var res = [];
        for (var i = 0; i < all.length; i++) {
          if (X.moveFrom(all[i]) === sq) res.push(X.moveTo(all[i]));
        }
        return res;
      }

      function canUndo() {
        return history.length > 0 && phase !== 'anim' && phase !== 'over';
      }
      function canHint() {
        return phase === 'player' && turn === RED;
      }

      /* ---------- 粒子 ---------- */
      function spawnBurst(sq, count) {
        var p = sqPos(sq);
        for (var i = 0; i < count; i++) {
          var a = rt.rand(0, Math.PI * 2);
          var sp = rt.rand(40, 190);
          particles.push({
            x: p.x, y: p.y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp - 40,
            life: rt.rand(0.22, 0.55),
            max: 0.55,
            r: rt.rand(1.4, 3.2),
            color: i % 3 === 0 ? '#f59e0b' : (i % 3 === 1 ? '#ef4444' : '#fde68a')
          });
        }
        if (particles.length > 200) particles.splice(0, particles.length - 200);
      }

      function updateParticles(dt) {
        for (var i = particles.length - 1; i >= 0; i--) {
          var p = particles[i];
          p.life -= dt;
          if (p.life <= 0) { particles.splice(i, 1); continue; }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 260 * dt;
          p.vx *= 0.97;
        }
      }

      /* ---------- 对局流程 ---------- */
      function applyMove(from, to) {
        var piece = board[from];
        var cap = board[to];
        var mover = turn;
        var text = X.moveToChinese(board, from, to);
        board[to] = piece;
        board[from] = EMPTY;
        history.push({ from: from, to: to, piece: piece, captured: cap, side: mover, text: text });
        turn = -turn;
        if (cap !== EMPTY) movesSinceCapture = 0; else movesSinceCapture++;
        var k = keyOf(board, turn);
        positions[k] = (positions[k] || 0) + 1;

        selected = -1;
        targets = [];
        hint = null;
        anim = { from: from, to: to, piece: piece, cap: cap, t: 0, dur: 0.18 };
        phase = 'anim';

        if (cap !== EMPTY) {
          flash = Math.max(flash, 0.55);
          spawnBurst(to, 16);
          rt.audio.play('hit', 0.6);
        } else {
          rt.audio.play('click', 0.35);
        }
        syncHud();
        if (mover === RED) {
          setStatus('AI 思考中…', 'ai');
        } else {
          setStatus('轮到你走棋', 'info');
        }
      }

      function afterMove() {
        var legal = X.legalMoves(board, turn);
        var checked = X.inCheck(board, turn);

        if (legal.length === 0) {
          if (turn === RED) finishGame('lose', checked ? '绝杀' : '困毙');
          else finishGame('win', checked ? '绝杀' : '困毙');
          return;
        }
        var rep = positions[keyOf(board, turn)] || 0;
        if (rep >= 3) {
          finishGame('draw', '重复');
          return;
        }
        if (movesSinceCapture >= 120) {
          finishGame('draw', '无吃子');
          return;
        }
        if (checked) {
          checkPulse = 1;
          rt.audio.play('level', 0.45);
        }
        if (turn === BLACK) {
          phase = 'aiWait';
          aiTimer = 0.34;
          setStatus(checked ? '将军！AI 思考中…' : 'AI 思考中…', checked ? 'check' : 'ai');
        } else {
          phase = 'player';
          setStatus(checked ? '将军！请应将' : '轮到你走棋 · 点击红子选择', checked ? 'check' : 'info');
        }
      }

      function runAI() {
        var legal = X.legalMoves(board, turn);
        if (legal.length === 0) {
          finishGame('win', '困毙');
          return;
        }
        var t0 = Date.now();
        var mv = 0;
        var book = AI.bookMove(board, turn, history.length);
        if (book) {
          mv = book;
          aiInfo = { depth: 0, ms: Date.now() - t0, nodes: 0, book: true };
        } else {
          var info = AI.think(board, turn, { depth: 4, timeMs: 700 });
          mv = info.move;
          aiInfo = { depth: info.depth, ms: Date.now() - t0, nodes: info.nodes, book: false };
        }
        if (legal.indexOf(mv) < 0) mv = legal[0];
        applyMove(X.moveFrom(mv), X.moveTo(mv));
      }

      function doHint() {
        if (!canHint()) return;
        var legal = X.legalMoves(board, turn);
        if (!legal.length) return;
        var info = AI.think(board, turn, { depth: 3, timeMs: 260 });
        var mv = info.move;
        if (legal.indexOf(mv) < 0) mv = legal[0];
        hint = { from: X.moveFrom(mv), to: X.moveTo(mv) };
        hintTimer = 0;
        rt.audio.play('flip', 0.5);
        setStatus('建议：' + X.moveToChinese(board, hint.from, hint.to), 'hint');
      }

      function doUndo() {
        if (phase === 'anim' || phase === 'over') return;
        if (!history.length) return;
        var steps;
        if (phase === 'aiWait') steps = 1;
        else steps = history.length >= 2 ? 2 : 1;
        for (var i = 0; i < steps && history.length; i++) {
          var h = history.pop();
          board[h.from] = h.piece;
          board[h.to] = h.captured;
          turn = h.side;
        }
        anim = null;
        aiTimer = 0;
        aiInfo = null;
        hint = null;
        selected = -1;
        targets = [];
        phase = turn === RED ? 'player' : 'aiWait';
        if (phase === 'aiWait') aiTimer = 0.34;
        rebuildPositions();
        movesSinceCapture = calcIdle();
        rt.audio.play('blip', 0.35);
        setStatus(turn === RED ? '已悔棋 · 轮到你走棋' : '已悔棋 · AI 思考中…', 'info');
        syncHud();
      }

      function resetGame() {
        board = Int8Array.from(X.START);
        turn = RED;
        history = [];
        positions = {};
        selected = -1;
        targets = [];
        anim = null;
        phase = 'player';
        aiTimer = 0;
        aiInfo = null;
        hint = null;
        hintTimer = 0;
        movesSinceCapture = 0;
        elapsed = 0;
        ended = false;
        overTimer = 0;
        overPayload = null;
        resultText = '';
        resultKind = '';
        particles = [];
        flash = 0;
        checkPulse = 0;
        lastHudSec = -1;
        rebuildPositions();
        rt.setScore(0);
        rt.setHud({});
        syncHud();
        setStatus('轮到你走棋 · 点击红子选择', 'info');
      }

      function finishGame(result, reason) {
        if (phase === 'over') return;
        phase = 'over';
        overTimer = 0;
        resultKind = result;
        var caps = playerCaptures();
        var score;
        if (result === 'win') score = 1200 + caps * 60 + Math.max(0, 900 - Math.floor(elapsed) * 3);
        else if (result === 'draw') score = 500 + caps * 40;
        else score = Math.max(0, 200 + caps * 40 - Math.floor(elapsed) * 2);
        score = Math.round(score);

        resultText = result === 'win' ? '红方胜' : (result === 'lose' ? '黑方胜' : '和棋');
        var msg;
        if (result === 'win') msg = (reason === '绝杀' ? '绝杀！红方获胜' : '困毙！黑方无子可动，红方胜');
        else if (result === 'lose') msg = (reason === '绝杀' ? '黑方绝杀，红方告负' : '红方无子可动，黑方胜');
        else msg = reason === '重复' ? '三次重复局面，判和' : '连续 60 回合无吃子，判和';

        overPayload = {
          score: score,
          won: result === 'win',
          message: msg,
          stats: [
            { label: '步数', value: history.length },
            { label: '用时', value: fmtTime(elapsed) },
            { label: '吃子数', value: caps },
            { label: '结果', value: resultText }
          ]
        };
        rt.setScore(score);
        rt.setStatus('');
        statusText = result === 'win' ? '你赢了！' : (result === 'lose' ? '你输了' : '和棋');
        statusKind = result === 'win' ? 'hint' : 'check';
        rt.audio.play(result === 'win' ? 'power' : (result === 'draw' ? 'level' : 'error'), 0.7);
        for (var i = 0; i < 34; i++) {
          particles.push({
            x: W / 2 + rt.rand(-180, 180),
            y: 330 + rt.rand(-140, 140),
            vx: rt.rand(-120, 120),
            vy: rt.rand(-220, -40),
            life: rt.rand(0.4, 1.0),
            max: 1.0,
            r: rt.rand(1.5, 3.6),
            color: result === 'win' ? '#f59e0b' : (result === 'draw' ? '#94a3b8' : '#ef4444')
          });
        }
        syncHud();
      }

      /* ---------- 静态棋盘（离屏缓存） ---------- */
      var canCache = typeof document !== 'undefined' && document.createElement;

      function ensureBackground() {
        var dpr = 1;
        if (rt.canvas && rt.canvas.width && W > 0) dpr = rt.canvas.width / W;
        if (!isFinite(dpr) || dpr <= 0) dpr = 1;
        dpr = Math.min(2, Math.max(1, dpr));
        if (bgCanvas && bgDpr === dpr) return;
        bgDpr = dpr;
        var cv = document.createElement('canvas');
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
        var g = cv.getContext('2d');
        if (!g) { bgCanvas = null; return; }
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        paintBackground(g);
        bgCanvas = cv;
      }

      function paintBackground(g) {
        /* 深色霓虹底 */
        var bg = g.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#06080c');
        bg.addColorStop(0.5, '#0a0e14');
        bg.addColorStop(1, '#05070a');
        g.fillStyle = bg;
        g.fillRect(0, 0, W, H);

        var glow = g.createRadialGradient(W / 2, 340, 60, W / 2, 340, 520);
        glow.addColorStop(0, 'rgba(239, 68, 68, 0.10)');
        glow.addColorStop(0.55, 'rgba(245, 158, 11, 0.05)');
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        g.fillStyle = glow;
        g.fillRect(0, 0, W, H);

        g.strokeStyle = 'rgba(148, 163, 184, 0.035)';
        g.lineWidth = 1;
        g.beginPath();
        for (var gx = 0; gx <= W; gx += 40) {
          g.moveTo(gx + 0.5, 0);
          g.lineTo(gx + 0.5, H);
        }
        for (var gy = 0; gy <= H; gy += 40) {
          g.moveTo(0, gy + 0.5);
          g.lineTo(W, gy + 0.5);
        }
        g.stroke();

        /* 木质外框 */
        var wood = g.createLinearGradient(FRAME_X, FRAME_Y, FRAME_X + FRAME_W, FRAME_Y + FRAME_H);
        wood.addColorStop(0, '#4a2c17');
        wood.addColorStop(0.35, '#331d0e');
        wood.addColorStop(0.7, '#28160b');
        wood.addColorStop(1, '#1b0f07');
        g.fillStyle = wood;
        roundRect(g, FRAME_X, FRAME_Y, FRAME_W, FRAME_H, 18);
        g.fill();

        /* 木纹 */
        g.save();
        roundRect(g, FRAME_X, FRAME_Y, FRAME_W, FRAME_H, 18);
        g.clip();
        g.globalAlpha = 0.10;
        g.strokeStyle = '#f0b96b';
        for (var i = 0; i < 26; i++) {
          var yy = FRAME_Y + (i / 26) * FRAME_H + Math.sin(i * 1.9) * 3;
          g.lineWidth = 0.6 + (i % 4) * 0.3;
          g.beginPath();
          g.moveTo(FRAME_X, yy);
          for (var xx = FRAME_X; xx <= FRAME_X + FRAME_W; xx += 30) {
            g.lineTo(xx, yy + Math.sin(xx * 0.02 + i * 0.8) * 2.2);
          }
          g.stroke();
        }
        g.restore();

        /* 霓虹描边 */
        g.save();
        g.shadowColor = '#ef4444';
        g.shadowBlur = 20;
        g.strokeStyle = 'rgba(239, 68, 68, 0.55)';
        g.lineWidth = 2;
        roundRect(g, FRAME_X + 1, FRAME_Y + 1, FRAME_W - 2, FRAME_H - 2, 17);
        g.stroke();
        g.restore();
        g.strokeStyle = 'rgba(245, 158, 11, 0.35)';
        g.lineWidth = 1;
        roundRect(g, FRAME_X + 5, FRAME_Y + 5, FRAME_W - 10, FRAME_H - 10, 14);
        g.stroke();

        /* 宣纸棋盘面 */
        var paper = g.createLinearGradient(PAPER_X, PAPER_Y, PAPER_X + PAPER_W, PAPER_Y + PAPER_H);
        paper.addColorStop(0, '#f4e3bd');
        paper.addColorStop(0.45, '#eed8ab');
        paper.addColorStop(1, '#e3c691');
        g.fillStyle = paper;
        roundRect(g, PAPER_X, PAPER_Y, PAPER_W, PAPER_H, 10);
        g.fill();

        /* 纸纹 */
        g.save();
        roundRect(g, PAPER_X, PAPER_Y, PAPER_W, PAPER_H, 10);
        g.clip();
        g.globalAlpha = 0.055;
        g.strokeStyle = '#8a5a24';
        for (var t = 0; t < 40; t++) {
          var py = PAPER_Y + (t / 40) * PAPER_H + Math.sin(t * 1.3) * 2;
          g.lineWidth = 0.6;
          g.beginPath();
          g.moveTo(PAPER_X, py);
          for (var px = PAPER_X; px <= PAPER_X + PAPER_W; px += 24) {
            g.lineTo(px, py + Math.sin(px * 0.03 + t) * 1.4);
          }
          g.stroke();
        }
        g.restore();

        /* 棋盘线 */
        var LINE = 'rgba(88, 54, 22, 0.78)';
        g.strokeStyle = LINE;
        g.lineCap = 'round';

        g.lineWidth = 1.3;
        for (var r = 0; r < 10; r++) {
          g.beginPath();
          g.moveTo(OX, OY + r * CELL);
          g.lineTo(OX + 8 * CELL, OY + r * CELL);
          g.stroke();
        }
        for (var c = 0; c < 9; c++) {
          g.beginPath();
          if (c === 0 || c === 8) {
            g.moveTo(OX + c * CELL, OY);
            g.lineTo(OX + c * CELL, OY + 9 * CELL);
          } else {
            g.moveTo(OX + c * CELL, OY);
            g.lineTo(OX + c * CELL, OY + 4 * CELL);
            g.moveTo(OX + c * CELL, OY + 5 * CELL);
            g.lineTo(OX + c * CELL, OY + 9 * CELL);
          }
          g.stroke();
        }

        /* 九宫斜线 */
        g.lineWidth = 1.2;
        var palaces = [[0, 2], [7, 9]];
        for (var pi = 0; pi < palaces.length; pi++) {
          var p0 = palaces[pi][0];
          var p1 = palaces[pi][1];
          g.beginPath();
          g.moveTo(OX + 3 * CELL, OY + p0 * CELL);
          g.lineTo(OX + 5 * CELL, OY + p1 * CELL);
          g.moveTo(OX + 5 * CELL, OY + p0 * CELL);
          g.lineTo(OX + 3 * CELL, OY + p1 * CELL);
          g.stroke();
        }

        /* 外框双线 */
        var pad = CELL * 0.30;
        g.lineWidth = 2.6;
        g.strokeStyle = 'rgba(80, 46, 16, 0.9)';
        g.strokeRect(OX - pad, OY - pad, 8 * CELL + pad * 2, 9 * CELL + pad * 2);
        g.lineWidth = 1;
        g.strokeStyle = 'rgba(80, 46, 16, 0.5)';
        g.strokeRect(OX - pad * 1.72, OY - pad * 1.72, 8 * CELL + pad * 3.44, 9 * CELL + pad * 3.44);

        /* 炮位 / 兵位准星 */
        var marks = [[2, 1], [2, 7], [7, 1], [7, 7],
                     [3, 0], [3, 2], [3, 4], [3, 6], [3, 8],
                     [6, 0], [6, 2], [6, 4], [6, 6], [6, 8]];
        g.strokeStyle = 'rgba(88, 54, 22, 0.8)';
        g.lineWidth = 1.4;
        var dd = CELL * 0.09, len = CELL * 0.16;
        for (var mi = 0; mi < marks.length; mi++) {
          var mx = OX + marks[mi][1] * CELL;
          var my = OY + marks[mi][0] * CELL;
          var sgn = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
          for (var si = 0; si < 4; si++) {
            var sx = sgn[si][0], sy = sgn[si][1];
            if ((marks[mi][1] === 0 && sx < 0) || (marks[mi][1] === 8 && sx > 0)) continue;
            g.beginPath();
            g.moveTo(mx + sx * dd, my + sy * (dd + len));
            g.lineTo(mx + sx * dd, my + sy * dd);
            g.lineTo(mx + sx * (dd + len), my + sy * dd);
            g.stroke();
          }
        }

        /* 楚河 · 汉界 */
        g.save();
        g.fillStyle = 'rgba(104, 62, 24, 0.5)';
        g.font = '600 ' + Math.round(CELL * 0.52) + 'px ' + FONT_KAI;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        var riverY = OY + 4.5 * CELL;
        var leftChars = ['楚', '河'];
        var rightChars = ['汉', '界'];
        for (var lc = 0; lc < 2; lc++) {
          g.fillText(leftChars[lc], OX + (1.3 + lc * 0.95) * CELL, riverY);
          g.fillText(rightChars[lc], OX + (5.75 + lc * 0.95) * CELL, riverY);
        }
        g.restore();

        /* 纵线坐标（0.58 格距，确保落在宣纸边距内） */
        g.save();
        g.fillStyle = 'rgba(96, 58, 22, 0.62)';
        g.font = '500 ' + Math.round(CELL * 0.25) + 'px ' + FONT_CN;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        var cn = ['九', '八', '七', '六', '五', '四', '三', '二', '一'];
        for (var k = 0; k < 9; k++) {
          g.fillText(cn[k], OX + k * CELL, OY + 9 * CELL + CELL * 0.58);
          g.fillText(String(k + 1), OX + k * CELL, OY - CELL * 0.58);
        }
        g.restore();
      }

      /* ---------- 棋子 ---------- */
      function drawPiece(c, x, y, piece, scale, alpha) {
        var R = PIECE_R * (scale || 1);
        var isRed = piece > 0;
        var t = X.typeOf(piece);
        var glyph = X.GLYPH[t][isRed ? 0 : 1];

        c.save();
        c.globalAlpha = alpha == null ? 1 : alpha;

        /* 投影 */
        c.fillStyle = 'rgba(40, 22, 6, 0.32)';
        c.beginPath();
        c.ellipse(x + R * 0.08, y + R * 0.16, R * 0.98, R * 0.9, 0, 0, Math.PI * 2);
        c.fill();

        /* 棋子本体 */
        var gr = c.createRadialGradient(x - R * 0.36, y - R * 0.42, R * 0.12, x, y, R * 1.08);
        gr.addColorStop(0, '#fffaf0');
        gr.addColorStop(0.42, '#f7e7c6');
        gr.addColorStop(0.82, '#e9d0a3');
        gr.addColorStop(1, '#c9a670');
        c.beginPath();
        c.arc(x, y, R, 0, Math.PI * 2);
        c.fillStyle = gr;
        c.fill();

        /* 外圈 */
        c.lineWidth = Math.max(1.2, R * 0.07);
        c.strokeStyle = 'rgba(122, 80, 34, 0.78)';
        c.stroke();
        c.beginPath();
        c.arc(x, y, R * 0.93, Math.PI * 0.75, Math.PI * 1.75);
        c.lineWidth = Math.max(1, R * 0.05);
        c.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        c.stroke();

        /* 内圈 */
        var main = isRed ? '#b1252b' : '#26333f';
        c.beginPath();
        c.arc(x, y, R * 0.76, 0, Math.PI * 2);
        c.lineWidth = Math.max(1, R * 0.055);
        c.strokeStyle = main;
        c.globalAlpha = (alpha == null ? 1 : alpha) * 0.85;
        c.stroke();
        c.globalAlpha = alpha == null ? 1 : alpha;

        /* 汉字 */
        c.fillStyle = main;
        c.font = '700 ' + Math.round(R * 1.06) + 'px ' + FONT_KAI;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(glyph, x, y + R * 0.04);
        c.restore();
      }

      /* ---------- 动态层 ---------- */
      function drawLastMove(c) {
        if (!history.length) return;
        var last = history[history.length - 1];
        var list = [last.from, last.to];
        for (var i = 0; i < 2; i++) {
          var q = sqPos(list[i]);
          var d = CELL * 0.4;
          var len = CELL * 0.14;
          c.save();
          c.strokeStyle = 'rgba(245, 158, 11, 0.95)';
          c.lineWidth = 2.2;
          c.lineCap = 'round';
          var corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
          for (var k = 0; k < 4; k++) {
            var sx = corners[k][0], sy = corners[k][1];
            c.beginPath();
            c.moveTo(q.x + sx * d, q.y + sy * (d - len));
            c.lineTo(q.x + sx * d, q.y + sy * d);
            c.lineTo(q.x + sx * (d - len), q.y + sy * d);
            c.stroke();
          }
          c.restore();
        }
      }

      function drawCheck(c) {
        if (phase === 'over') return;
        if (!X.inCheck(board, turn)) return;
        var k = X.findKing(board, turn);
        if (k < 0) return;
        var p = sqPos(k);
        var w = 0.5 + 0.5 * Math.sin(pulse * 6);
        var rg = c.createRadialGradient(p.x, p.y, CELL * 0.1, p.x, p.y, CELL * 0.8);
        rg.addColorStop(0, 'rgba(239, 68, 68, ' + (0.38 + 0.25 * w).toFixed(3) + ')');
        rg.addColorStop(1, 'rgba(239, 68, 68, 0)');
        c.fillStyle = rg;
        c.beginPath();
        c.arc(p.x, p.y, CELL * 0.8, 0, Math.PI * 2);
        c.fill();
      }

      function drawPieces(c) {
        for (var i = 0; i < 90; i++) {
          var p = board[i];
          if (p === EMPTY) continue;
          if (anim && (i === anim.from || i === anim.to)) continue;
          var pt = sqPos(i);
          drawPiece(c, pt.x, pt.y, p, i === selected ? 1.06 : 1, 1);
        }
      }

      function drawSelection(c) {
        if (selected < 0 || board[selected] === EMPTY) return;
        var p = sqPos(selected);
        var a = 0.55 + 0.35 * Math.sin(pulse * 8);
        c.save();
        c.beginPath();
        c.arc(p.x, p.y, PIECE_R * 1.2, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(245, 158, 11, ' + a.toFixed(3) + ')';
        c.lineWidth = 3;
        c.shadowColor = 'rgba(245, 158, 11, 0.9)';
        c.shadowBlur = 12;
        c.stroke();
        c.restore();
      }

      function drawTargets(c) {
        for (var i = 0; i < targets.length; i++) {
          var ts = targets[i];
          var tp = sqPos(ts);
          c.save();
          if (board[ts] !== EMPTY) {
            c.beginPath();
            c.arc(tp.x, tp.y, PIECE_R * 1.16, 0, Math.PI * 2);
            c.strokeStyle = 'rgba(239, 68, 68, 0.9)';
            c.lineWidth = 3;
            c.setLineDash([CELL * 0.16, CELL * 0.12]);
            c.stroke();
            c.setLineDash([]);
          } else {
            var a = 0.45 + 0.25 * Math.sin(pulse * 6 + i);
            c.beginPath();
            c.arc(tp.x, tp.y, CELL * 0.14, 0, Math.PI * 2);
            c.fillStyle = 'rgba(245, 158, 11, ' + a.toFixed(3) + ')';
            c.fill();
            c.strokeStyle = 'rgba(245, 158, 11, 0.7)';
            c.lineWidth = 1.5;
            c.stroke();
          }
          c.restore();
        }
      }

      function drawAnim(c) {
        if (!anim) return;
        var k = Math.min(1, anim.t / anim.dur);
        var e = 1 - Math.pow(1 - k, 3);
        var a1 = sqPos(anim.from);
        var a2 = sqPos(anim.to);
        var x = a1.x + (a2.x - a1.x) * e;
        var y = a1.y + (a2.y - a1.y) * e;
        var lift = Math.sin(Math.PI * e) * CELL * 0.12;
        drawPiece(c, x, y - lift, anim.piece, 1 + Math.sin(Math.PI * e) * 0.08, 1);
      }

      function drawHint(c) {
        if (!hint || selected >= 0) return;
        var a = 0.72 + 0.28 * Math.sin(pulse * 7);
        var p1 = sqPos(hint.from);
        var p2 = sqPos(hint.to);
        c.save();
        c.shadowColor = '#22d3ee';
        c.shadowBlur = 10;
        c.strokeStyle = 'rgba(34, 211, 238, ' + a.toFixed(3) + ')';
        c.lineWidth = 3;
        c.setLineDash([CELL * 0.2, CELL * 0.14]);
        c.lineDashOffset = -pulse * 30;
        c.beginPath();
        c.moveTo(p1.x, p1.y);
        c.lineTo(p2.x, p2.y);
        c.stroke();
        c.setLineDash([]);
        c.lineDashOffset = 0;
        /* 起点环 */
        c.beginPath();
        c.arc(p1.x, p1.y, PIECE_R * 1.16, 0, Math.PI * 2);
        c.lineWidth = 2;
        c.stroke();
        /* 终点脉冲环 */
        c.beginPath();
        c.arc(p2.x, p2.y, PIECE_R * (1.18 + 0.1 * Math.sin(pulse * 8)), 0, Math.PI * 2);
        c.lineWidth = 3;
        c.stroke();
        /* 箭头 */
        var ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        var ax = p2.x - Math.cos(ang) * PIECE_R * 1.35;
        var ay = p2.y - Math.sin(ang) * PIECE_R * 1.35;
        c.beginPath();
        c.moveTo(ax, ay);
        c.lineTo(ax - Math.cos(ang - 0.45) * 9, ay - Math.sin(ang - 0.45) * 9);
        c.lineTo(ax - Math.cos(ang + 0.45) * 9, ay - Math.sin(ang + 0.45) * 9);
        c.closePath();
        c.fillStyle = 'rgba(34, 211, 238, ' + a.toFixed(3) + ')';
        c.fill();
        c.restore();
      }

      function drawParticles(c) {
        for (var i = 0; i < particles.length; i++) {
          var p = particles[i];
          c.globalAlpha = Math.max(0, p.life / p.max);
          c.fillStyle = p.color;
          c.beginPath();
          c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          c.fill();
        }
        c.globalAlpha = 1;
      }

      function drawHeader(c) {
        c.fillStyle = 'rgba(10, 14, 20, 0.92)';
        roundRect(c, 24, 10, 592, 70, 16);
        c.fill();
        c.strokeStyle = 'rgba(239, 68, 68, 0.26)';
        c.lineWidth = 1;
        c.stroke();

        /* 印章 */
        var sg = c.createLinearGradient(40, 24, 74, 58);
        sg.addColorStop(0, '#ef4444');
        sg.addColorStop(1, '#991b1b');
        c.fillStyle = sg;
        roundRect(c, 40, 24, 36, 36, 9);
        c.fill();
        c.strokeStyle = 'rgba(255, 255, 255, 0.32)';
        c.lineWidth = 1;
        c.stroke();
        c.fillStyle = '#fff7ed';
        c.font = '700 22px ' + FONT_KAI;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('棋', 58, 43);

        /* 标题 */
        c.textAlign = 'left';
        c.textBaseline = 'alphabetic';
        c.fillStyle = '#f8fafc';
        c.font = '700 20px ' + FONT_CN;
        c.fillText('中国象棋', 90, 38);
        c.fillStyle = 'rgba(148, 163, 184, 0.9)';
        c.font = '500 10px ' + FONT_CN;
        c.fillText('楚河汉界 · 人机对弈', 91, 54);

        /* AI 搜索信息 */
        if (aiInfo) {
          c.fillStyle = 'rgba(148, 163, 184, 0.55)';
          c.font = '500 9px ' + FONT_MONO;
          c.fillText(aiInfo.book ? 'AI · 开局库' : ('AI depth ' + aiInfo.depth + ' · ' + aiInfo.ms + 'ms'),
            91, 68);
        }

        /* 回合胶囊 */
        var pillRed = turn === RED && phase !== 'over';
        var pillText = phase === 'over' ? '对局结束' : (pillRed ? '轮到你走棋' : 'AI 思考中');
        c.fillStyle = pillRed ? 'rgba(239, 68, 68, 0.16)' : 'rgba(56, 189, 248, 0.13)';
        roundRect(c, 398, 20, 198, 28, 14);
        c.fill();
        c.strokeStyle = pillRed ? 'rgba(239, 68, 68, 0.45)' : 'rgba(56, 189, 248, 0.38)';
        c.lineWidth = 1;
        c.stroke();
        c.fillStyle = pillRed ? '#ef4444' : '#38bdf8';
        c.beginPath();
        c.arc(414, 34, 4, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#e2e8f0';
        c.font = '600 12px ' + FONT_CN;
        c.textAlign = 'left';
        c.textBaseline = 'middle';
        c.fillText(pillText, 426, 35);

        /* 状态行 */
        var kindColor = statusKind === 'check' ? '#ef4444'
          : (statusKind === 'hint' ? '#f59e0b'
            : (statusKind === 'ai' ? '#38bdf8' : 'rgba(148, 163, 184, 0.92)'));
        var st = statusText || '';
        if (st.length > 30) st = st.slice(0, 30) + '…';
        c.textAlign = 'right';
        c.textBaseline = 'alphabetic';
        c.font = '600 10px ' + FONT_CN;
        c.fillStyle = kindColor;
        c.fillText(st, 596, 66);
        c.textAlign = 'left';
      }

      function drawButton(c, b, enabled) {
        c.save();
        c.globalAlpha = enabled ? 1 : 0.36;
        var g = c.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
        g.addColorStop(0, 'rgba(239, 68, 68, 0.24)');
        g.addColorStop(1, 'rgba(120, 20, 24, 0.22)');
        c.fillStyle = g;
        roundRect(c, b.x, b.y, b.w, b.h, 9);
        c.fill();
        c.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        c.lineWidth = 1;
        c.stroke();
        c.fillStyle = '#fecaca';
        c.font = '600 13px ' + FONT_CN;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 0.5);
        c.restore();
      }

      function drawFooter(c) {
        c.fillStyle = 'rgba(10, 14, 20, 0.92)';
        roundRect(c, 24, 706, 592, 84, 16);
        c.fill();
        c.strokeStyle = 'rgba(245, 158, 11, 0.22)';
        c.lineWidth = 1;
        c.stroke();

        /* 记谱 */
        c.textAlign = 'left';
        c.textBaseline = 'alphabetic';
        c.fillStyle = 'rgba(148, 163, 184, 0.7)';
        c.font = '500 9px ' + FONT_CN;
        c.fillText('记谱', 42, 726);

        var totalPairs = Math.ceil(history.length / 2);
        var startPair = Math.max(0, totalPairs - 3);
        for (var p = startPair; p < totalPairs; p++) {
          var y = 744 + (p - startPair) * 16;
          var redH = history[p * 2];
          var blackH = history[p * 2 + 1];
          c.fillStyle = 'rgba(148, 163, 184, 0.5)';
          c.font = '500 10px ' + FONT_MONO;
          c.fillText((p + 1) + '.', 42, y);
          c.fillStyle = '#fca5a5';
          c.font = '500 12px ' + FONT_KAI;
          if (redH) c.fillText(redH.text, 72, y);
          c.fillStyle = '#cbd5e1';
          if (blackH) c.fillText(blackH.text, 196, y);
        }

        /* 按钮 */
        drawButton(c, BTN.undo, canUndo());
        drawButton(c, BTN.hint, canHint());
        drawButton(c, BTN.restart, phase !== 'over');

        /* 快捷键提示 */
        c.textAlign = 'right';
        c.textBaseline = 'alphabetic';
        c.fillStyle = 'rgba(148, 163, 184, 0.5)';
        c.font = '500 9px ' + FONT_CN;
        c.fillText('U 悔棋 · H 提示 · R 重开', 600, 766);
        c.textAlign = 'left';
      }

      function drawOver(c) {
        var k = Math.min(1, overTimer / 0.5);
        c.fillStyle = 'rgba(3, 6, 10, ' + (0.52 * k).toFixed(3) + ')';
        c.fillRect(0, 0, W, H);
        c.save();
        c.translate(W / 2, 356);
        var sc = 1 + (1 - k) * 0.3;
        c.scale(sc, sc);
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = '700 36px ' + FONT_KAI;
        var col = resultKind === 'win' ? '#f59e0b' : (resultKind === 'lose' ? '#ef4444' : '#94a3b8');
        c.fillStyle = col;
        c.shadowColor = col;
        c.shadowBlur = 24;
        c.fillText(resultText, 0, 0);
        c.shadowBlur = 0;
        c.font = '600 14px ' + FONT_CN;
        c.fillStyle = 'rgba(226, 232, 240, 0.9)';
        c.fillText(resultKind === 'win' ? '漂亮！点击「再来一局」继续' :
          (resultKind === 'lose' ? '再接再厉，点击「再来一局」' : '势均力敌，点击「再来一局」'), 0, 36);
        c.restore();
      }

      /* ---------- 初始化 ---------- */
      resetGame();

      return {
        update: function (dt) {
          pulse += dt;
          if (phase !== 'over') elapsed += dt;
          var sec = Math.floor(elapsed);
          if (sec !== lastHudSec) {
            lastHudSec = sec;
            syncHud();
          }
          if (flash > 0) flash = Math.max(0, flash - dt * 2.2);
          if (checkPulse > 0) checkPulse = Math.max(0, checkPulse - dt * 1.6);
          if (hint && hintTimer >= 0) {
            hintTimer += dt;
            if (hintTimer > 8) hint = null;
          }
          updateParticles(dt);

          /* 首帧补齐引擎清空的 HUD / 状态栏 */
          if (rt.frame === 1) {
            rt.setHud({});
            syncHud();
            setStatus(statusText || '轮到你走棋 · 点击红子选择', statusKind);
          }

          if (phase === 'anim') {
            anim.t += dt;
            if (anim.t >= anim.dur) {
              anim = null;
              afterMove();
            }
          } else if (phase === 'aiWait') {
            aiTimer -= dt;
            if (aiTimer <= 0) runAI();
          } else if (phase === 'over') {
            overTimer += dt;
            if (overTimer > 0.75 && !ended) {
              ended = true;
              rt.end(overPayload);
            }
          }

          /* 键盘 */
          if (phase === 'player') {
            if (rt.wasPressed('KeyU')) doUndo();
            else if (rt.wasPressed('KeyH')) doHint();
          } else if (phase === 'aiWait') {
            if (rt.wasPressed('KeyU')) doUndo();
          }
        },

        render: function (c) {
          /* 背景缓存（含棋盘） */
          if (canCache) {
            ensureBackground();
            if (bgCanvas) {
              c.drawImage(bgCanvas, 0, 0, W, H);
            } else {
              paintBackground(c);
            }
          } else {
            paintBackground(c);
          }

          drawLastMove(c);
          drawCheck(c);
          drawPieces(c);
          drawSelection(c);
          drawTargets(c);
          drawHint(c);
          drawAnim(c);
          drawParticles(c);

          /* 棋盘霓虹呼吸 */
          c.save();
          c.strokeStyle = 'rgba(239, 68, 68, ' + (0.10 + 0.06 * Math.sin(pulse * 2.2)).toFixed(3) + ')';
          c.lineWidth = 2;
          c.shadowColor = '#ef4444';
          c.shadowBlur = 16;
          roundRect(c, FRAME_X + 1, FRAME_Y + 1, FRAME_W - 2, FRAME_H - 2, 17);
          c.stroke();
          c.restore();

          drawHeader(c);
          drawFooter(c);

          if (flash > 0) {
            c.fillStyle = 'rgba(253, 230, 138, ' + (flash * 0.16).toFixed(3) + ')';
            c.fillRect(0, 0, W, H);
          }
          if (phase === 'over') drawOver(c);
        },

        onPointerDown: function (x, y) {
          if (phase === 'over') return;

          /* 画布按钮 */
          if (hitButton(BTN.undo, x, y)) { doUndo(); return; }
          if (hitButton(BTN.hint, x, y)) { doHint(); return; }
          if (hitButton(BTN.restart, x, y)) { resetGame(); return; }

          if (phase !== 'player' || turn !== RED) return;

          var sq = hitSquare(x, y);
          if (sq < 0) {
            if (selected >= 0) {
              selected = -1;
              targets = [];
              setStatus('轮到你走棋 · 点击红子选择', 'info');
            }
            return;
          }

          if (selected >= 0 && targets.indexOf(sq) >= 0) {
            applyMove(selected, sq);
            return;
          }

          var p = board[sq];
          if (p !== EMPTY && X.sideOf(p) === RED) {
            if (sq === selected) {
              selected = -1;
              targets = [];
              setStatus('轮到你走棋 · 点击红子选择', 'info');
              rt.audio.play('blip', 0.2);
              return;
            }
            selected = sq;
            targets = legalTargetsFrom(sq);
            rt.audio.play('blip', 0.35);
            if (!targets.length) setStatus('该子无路可走', 'info');
            else setStatus('已选子 · 点击落点', 'info');
            return;
          }

          if (selected >= 0) {
            selected = -1;
            targets = [];
            setStatus('轮到你走棋 · 点击红子选择', 'info');
          }
        }
      };
    }
  });
})();
