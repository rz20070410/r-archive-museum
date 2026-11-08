/*!
 * 中国象棋 · AI 引擎
 * 负极大值搜索 (Negamax) + Alpha-Beta 剪枝 + 迭代加深
 * + 静态搜索 (Quiescence) + 杀手启发 / 历史启发 + 子力位置价值表
 */
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
})(typeof window !== 'undefined' ? window : globalThis);
