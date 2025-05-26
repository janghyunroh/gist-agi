// othello_ai_system.js
// Intelligent System for Othello AI Arena with configurable IDDFS and MCTS

// Configuration
const CONFIG = {
    useMCTS: true,            // Set true to use MCTS instead of IDDFS+α–β
    depthMultiplier: 2,        // Multiply base depth by this factor for deeper search
    mctsIterations: 1000,      // Fallback iterations for MCTS if deadline exceeded
  };
  
  function analyzeStage(stageConfig, initialBoard, validMoves, api) {
    const analysisStart = performance.now();
    const analysisDeadline = analysisStart + 60_000; // 60s for analysis
  
    // Persist game timing info
    let totalTimeSpent = 0;
  
    // 1) Rule probing
    const flags = probeRules(stageConfig, initialBoard, api);
  
    // 2) Generate static position weights
    const weights = generateStaticWeights(stageConfig, initialBoard, flags);
  
    // 3) Build opening book (first 1-2 moves)
    const openingBook = buildOpeningBook(initialBoard, validMoves, api, weights, flags);
  
    // 4) Transposition table (shared across moves)
    const tt = new Map();
  
    // 5) Decide base search depth
    const baseDepth = determineDepth(stageConfig, flags);
    const maxDepth = baseDepth * CONFIG.depthMultiplier;
  
    // Strategy function closure
    return function strategy(board, player, validMoves) {
      const moveStart = performance.now();
      const remainingTotalTime = 10000 - totalTimeSpent;
  
      // Dynamic time allocation based on empty cells
      const emptyCount = board.flat().filter(v => v === 0).length;
      const alloc = remainingTotalTime / Math.max(emptyCount, 1);
      const timeLimit = Math.min(alloc, 1000); // ms per move cap
      const deadline = moveStart + timeLimit;
  
      if (validMoves.length === 0) return null;
  
      // Opening book lookup
      const key = boardToKey(board) + '|' + player;
      if (openingBook[key]) {
        totalTimeSpent += performance.now() - moveStart;
        return openingBook[key];
      }
  
      // Move ordering by static weights
      validMoves.sort((a, b) => weights[b.row][b.col] - weights[a.row][a.col]);
  
      let bestMove;
      if (CONFIG.useMCTS) {
        // MCTS-based move selection
        bestMove = mctsSearch(board, player, validMoves, api, weights, deadline);
      } else {
        // IDDFS+α–β move selection
        bestMove = iddfsAlphaBeta(
          board, player, validMoves, api,
          weights, tt, maxDepth, deadline
        );
      }
  
      totalTimeSpent += performance.now() - moveStart;
      return bestMove;
    };
  }
  
  // --- IDDFS+α–β Implementation ---
  function iddfsAlphaBeta(board, player, validMoves, api, weights, tt, maxDepth, deadline) {
    let bestMove = validMoves[0];
    for (let depth = 1; depth <= maxDepth; depth++) {
      if (performance.now() >= deadline) break;
      const res = alphaBeta(board, player, depth, -Infinity, Infinity, api, weights, tt, deadline);
      if (res.move) bestMove = res.move;
    }
    return bestMove;
  }
  
  function alphaBeta(board, player, depth, alpha, beta, api, weights, tt, deadline) {
    if (performance.now() >= deadline) return { score: 0, move: null };
    const key = boardToKey(board) + '|' + player;
    if (tt.has(key)) return tt.get(key);
    const valid = api.getValidMoves(board, player);
    if (depth === 0 || valid.length === 0) {
      const ev = api.evaluateBoard(board, player).totalScore;
      const se = staticEval(board, weights, player);
      return { score: ev + se, move: null };
    }
    let bestMove = null;
    let bestScore = player === 1 ? -Infinity : Infinity;
    for (const mv of valid) {
      const res = api.simulateMove(board, player, mv.row, mv.col);
      if (!res.valid) continue;
      const child = alphaBeta(res.resultingBoard, 3 - player, depth - 1, alpha, beta, api, weights, tt, deadline);
      const sc = child.score;
      if (player === 1) {
        if (sc > bestScore) { bestScore = sc; bestMove = mv; }
        alpha = Math.max(alpha, sc);
      } else {
        if (sc < bestScore) { bestScore = sc; bestMove = mv; }
        beta = Math.min(beta, sc);
      }
      if (beta <= alpha) break;
    }
    const out = { score: bestScore, move: bestMove };
    tt.set(key, out);
    return out;
  }
  
  // --- MCTS Implementation ---
  class MCTSNode {
    constructor(board, player, move = null, parent = null) {
      this.board = board;
      this.player = player;
      this.move = move;
      this.parent = parent;
      this.children = [];
      this.visits = 0;
      this.wins = 0;
    }
    isLeaf() { return this.children.length === 0; }
  }
  
  function mctsSearch(rootBoard, rootPlayer, validMoves, api, weights, deadline) {
    const root = new MCTSNode(rootBoard, rootPlayer);
    while (performance.now() < deadline) {
      let node = treePolicy(root, api, validMoves);
      const reward = defaultPolicy(node, api, weights);
      backup(node, reward);
    }
    // Choose the child with highest visit count
    const next = root.children.reduce((a, b) => a.visits > b.visits ? a : b, root.children[0]);
    return next ? next.move : validMoves[0];
  }
  
  function treePolicy(node, api, validMoves) {
    while (true) {
      const valid = api.getValidMoves(node.board, node.player);
      if (valid.length === 0) return node;
      if (node.isLeaf()) {
        expand(node, valid, api);
        return node.children[0];
      } else {
        node = bestUCT(node);
      }
    }
  }
  
  function expand(node, valid, api) {
    for (const mv of valid) {
      const res = api.simulateMove(node.board, node.player, mv.row, mv.col);
      if (!res.valid) continue;
      node.children.push(new MCTSNode(res.resultingBoard, 3 - node.player, mv, node));
    }
  }
  
  function bestUCT(node) {
    const C = Math.sqrt(2);
    return node.children.reduce((best, child) => {
      const uct = (child.wins / (child.visits + 1)) + C * Math.sqrt(Math.log(node.visits + 1) / (child.visits + 1));
      return uct > (best.uct || -Infinity) ? Object.assign(child, { uct }) : best;
    }, {});
  }
  
  function defaultPolicy(node, api, weights) {
    let board = node.board.map(r => [...r]);
    let player = node.player;
    // Play randomly until terminal or small depth
    for (let i = 0; i < 10; i++) {
      const moves = api.getValidMoves(board, player);
      if (moves.length === 0) break;
      const mv = moves[Math.floor(Math.random() * moves.length)];
      const res = api.simulateMove(board, player, mv.row, mv.col);
      board = res.resultingBoard;
      player = 3 - player;
    }
    const evalObj = api.evaluateBoard(board, node.player);
    return evalObj.totalScore;
  }
  
  function backup(node, reward) {
    while (node) {
      node.visits++;
      node.wins += reward;
      node = node.parent;
    }
  }
  
  // --- Utility Functions ---
  function probeRules(stageConfig, board, api) {
    const flags = { allowOnBlocked: false, fewerPiecesContinue: false };
    for (const c of (stageConfig.initialBlocked || [])) {
      if (api.simulateMove(board, 1, c.r, c.c).valid) { flags.allowOnBlocked = true; break; }
    }
    const testBoard = board.map(r => [...r]);
    let removed = 0;
    for (let i = 0; i < testBoard.length && removed < testBoard.length*testBoard.length-1; i++) {
      for (let j = 0; j < testBoard.length && removed < testBoard.length*testBoard.length-1; j++) {
        if (testBoard[i][j] === 1) { testBoard[i][j] = 0; removed++; }
      }
    }
    flags.fewerPiecesContinue = api.getValidMoves(testBoard, 1).length > 0;
    return flags;
  }
  
  function generateStaticWeights(stageConfig, board, flags) {
    const N = stageConfig.boardSize;
    const W = Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => {
      if ((i === 0 || i === N - 1) && (j === 0 || j === N - 1)) return 120;
      else if (i === 0 || i === N - 1 || j === 0 || j === N - 1) return 20;
      else return 5;
    }));
    if (flags.allowOnBlocked) {
      for (const c of (stageConfig.initialBlocked || [])) {
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
          const r = c.r + di, cc = c.c + dj;
          if (r >= 0 && r < N && cc >= 0 && cc < N) W[r][cc] += 10;
        }
      }
    }
    return W;
  }
  
  function generateStaticStaticEval(board, weights, player) {
    const N = board.length;
    let ev = 0;
    const opp = 3 - player;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (board[i][j] === player) ev += weights[i][j];
        else if (board[i][j] === opp) ev -= weights[i][j];
      }
    }
    return ev;
  }
  
  function buildOpeningBook(board, validMoves, api, weights, flags) {
    const book = {};
    const key = boardToKey(board) + '|' + 1;
    let bestSc = -Infinity, bestMv = null;
    for (const mv of validMoves) {
      const res = api.simulateMove(board, 1, mv.row, mv.col);
      if (!res.valid) continue;
      const e = api.evaluateBoard(res.resultingBoard, 1).totalScore;
      const se = generateStaticStaticEval(res.resultingBoard, weights, 1);
      const sc = e + se;
      if (sc > bestSc) { bestSc = sc; bestMv = mv; }
    }
    if (bestMv) book[key] = bestMv;
    return book;
  }
  
  function determineDepth(stageConfig, flags) {
    const base = stageConfig.boardSize >= 8 ? 6 : 5;
    return flags.allowOnBlocked ? base - 1 : base;
  }
  
  function boardToKey(board) {
    return board.flat().join(',');
  }
  