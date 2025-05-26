// othello_ai_system.js
// Intelligent System for Othello AI Arena with corrected PV indexing and full-time PV search

const CONFIG = {
    useMCTS: false,            // true to use MCTS instead of IDDFS+α–β
    initialDepth: 6,           // base depth to start PV search
    mctsIterations: 1000,      // iterations for MCTS if used
  };
  
  function analyzeStage(stageConfig, initialBoard, validMoves, api) {
    const analysisStart = performance.now();
    const analysisDeadline = analysisStart + 60000;
  
    // 1) Rule probing
    const flags = probeRules(stageConfig, initialBoard, api);
  
    // 2) Static weights
    const weights = generateStaticWeights(stageConfig, initialBoard, flags);
  
    // 3) PV search using full 60s budget
    let openingPV = [];
    if (CONFIG.useMCTS) {
      // MCTS only yields one move for PV
      openingPV = [ mctsSearch(initialBoard, 1, validMoves, api, weights, analysisDeadline) ];
    } else {
      openingPV = fullTimePVSearch(initialBoard, 1, validMoves, api, weights, analysisDeadline);
    }
  
    // Filter PV to only my moves (player 1=black offset=0, player 2=white offset=1)
    const myPV = openingPV.filter((_, idx) => idx % 2 === 0);
  
    // Strategy closure variables
    let pvIndex = 0;
    let totalTimeSpent = 0;
  
    return function strategy(board, player, validMoves) {
      const moveStart = performance.now();
      const remainingTotalTime = 10000 - totalTimeSpent;
      const emptyCount = board.flat().filter(v => v === 0).length;
      const alloc = remainingTotalTime / Math.max(emptyCount,1);
      const timeLimit = Math.min(alloc, 1000);
      const deadline = moveStart + timeLimit;
  
      if (validMoves.length === 0) return null;
  
      // PV phase: use myPV only for first moves
      if (pvIndex < myPV.length) {
        const mv = myPV[pvIndex++];
        totalTimeSpent += performance.now() - moveStart;
        return mv;
      }
  
      // Move ordering
      validMoves.sort((a,b) => weights[b.row][b.col] - weights[a.row][a.col]);
  
      let bestMove;
      if (CONFIG.useMCTS) {
        bestMove = mctsSearch(board, player, validMoves, api, weights, deadline);
      } else {
        // IDDFS+α–β for remaining moves
        bestMove = iddfsAlphaBeta(board, player, validMoves, api, weights, new Map(), CONFIG.initialDepth, deadline);
      }
  
      totalTimeSpent += performance.now() - moveStart;
      return bestMove;
    };
  }
  
  // Full-time PV search using iterative deepening until deadline
  function fullTimePVSearch(board, player, validMoves, api, weights, deadline) {
    let bestPV = [];
    let depth = CONFIG.initialDepth;
    const tt = new Map();
    while (performance.now() < deadline) {
      const result = alphaBetaPV(board, player, depth, -Infinity, Infinity, api, weights, tt, deadline);
      if (result.pv.length > bestPV.length) bestPV = result.pv;
      depth += 1;
    }
    return bestPV;
  }
  
  // Iterative Deepening DFS with alpha-beta to get PV up to depth
  function alphaBetaPV(board, player, depth, alpha, beta, api, weights, tt, deadline) {
    if (performance.now() >= deadline) return { score: 0, pv: [] };
    const key = boardToKey(board) + '|' + player + '|' + depth;
    if (tt.has(key)) return tt.get(key);
    const valid = api.getValidMoves(board, player);
    if (depth === 0 || valid.length === 0) {
      const e = api.evaluateBoard(board, player).totalScore;
      const se = staticEval(board, weights, player);
      return { score: e + se, pv: [] };
    }
    let bestScore = player === 1 ? -Infinity : Infinity;
    let bestPV = [];
    for (const mv of valid) {
      if (performance.now() >= deadline) break;
      const res = api.simulateMove(board, player, mv.row, mv.col);
      if (!res.valid) continue;
      const child = alphaBetaPV(res.resultingBoard, 3-player, depth-1, alpha, beta, api, weights, tt, deadline);
      const sc = child.score;
      if ((player===1 && sc > bestScore) || (player===2 && sc < bestScore)) {
        bestScore = sc;
        bestPV = [mv, ...child.pv];
      }
      if (player===1) alpha = Math.max(alpha, sc);
      else beta = Math.min(beta, sc);
      if (beta <= alpha) break;
    }
    const out = { score: bestScore, pv: bestPV };
    tt.set(key, out);
    return out;
  }
  
  // IDDFS+α–β for fallback moves (no PV)
  function iddfsAlphaBeta(board, player, validMoves, api, weights, tt, initialDepth, deadline) {
    let bestMove = validMoves[0];
    let depth = initialDepth;
    while (performance.now() < deadline) {
      const res = alphaBeta(board, player, depth, -Infinity, Infinity, api, weights, tt, deadline);
      if (res.move) bestMove = res.move;
      depth += 1;
    }
    return bestMove;
  }
  
  // Standard alpha-beta without PV
  function alphaBeta(board, player, depth, alpha, beta, api, weights, tt, deadline) {
    if (performance.now() >= deadline) return { score: 0, move: null };
    const key = boardToKey(board) + '|' + player;
    if (tt.has(key)) return tt.get(key);
    const valid = api.getValidMoves(board, player);
    if (depth === 0 || valid.length === 0) {
      const e = api.evaluateBoard(board, player).totalScore;
      const se = staticEval(board, weights, player);
      return { score: e + se, move: null };
    }
    let bestMove = null;
    let bestScore = player === 1 ? -Infinity : Infinity;
    for (const mv of valid) {
      if (performance.now() >= deadline) break;
      const res = api.simulateMove(board, player, mv.row, mv.col);
      if (!res.valid) continue;
      const child = alphaBeta(res.resultingBoard, 3-player, depth-1, alpha, beta, api, weights, tt, deadline);
      const sc = child.score;
      if ((player===1 && sc > bestScore) || (player===2 && sc < bestScore)) {
        bestScore = sc;
        bestMove = mv;
      }
      if (player===1) alpha = Math.max(alpha, sc);
      else beta = Math.min(beta, sc);
      if (beta <= alpha) break;
    }
    const out = { score: bestScore, move: bestMove };
    tt.set(key, out);
    return out;
  }
  
  // MCTS components (unchanged)
  class MCTSNode { /* ... */ }
  function mctsSearch(board, player, validMoves, api, weights, deadline) { /* ... */ }
  function treePolicy(node, api) { /* ... */ }
  function expand(node, valid, api) { /* ... */ }
  function bestUCT(node) { /* ... */ }
  function defaultPolicy(node, api, weights) { /* ... */ }
  function backup(node, reward) { /* ... */ }
  
  // Utilities
  function probeRules(stageConfig, board, api) { /* ... */ }
  function generateStaticWeights(stageConfig, board, flags) { /* ... */ }
  function staticEval(board, weights, player) { /* ... */ }
  function determineDepth(stageConfig, flags) { /* ... */ }
  function boardToKey(board) { return board.flat().join(','); }
  