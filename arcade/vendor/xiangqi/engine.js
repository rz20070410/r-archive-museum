/*!
 * 中国象棋 · 规则引擎 (Xiangqi rules engine)
 * 棋盘用长度 90 的一维数组表示：index = row * 9 + col
 * row 0 在上方（黑方底线），row 9 在下方（红方底线）
 * 正数为红方棋子，负数为黑方棋子
 */
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
})(typeof window !== 'undefined' ? window : globalThis);
