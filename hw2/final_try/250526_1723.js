// othello_ai_system.js
// Intelligent System for Othello AI Arena with Principal Variation (PV) and optional MCTS

const CONFIG = {
    useMCTS: true,            // true to use MCTS instead of IDDFS+α–β
    depthMultiplier: 2,        // factor to multiply base depth for PV search
    mctsIterations: 1000,      // iterations for MCTS rollouts if needed
  };
  
  function analyzeStage(stageConfig, initialBoard, validMoves, api) {
    const analysisStart = performance.now();
    const analysisDeadline = analysisStart + 60000;
    let totalTimeSpent = 0;
  
    // 1) Rule probing
    const flags = probeRules(stageConfig, initialBoard, api);
  
    // 2) Static weights
    const weights = generateStaticWeights(stageConfig, initialBoard, flags);
  
    // 3) Determine search depth
    const baseDepth = determineDepth(stageConfig, flags);
    const maxDepth = baseDepth * CONFIG.depthMultiplier;
  
    // 4) Compute Principal Variation (PV)
    let openingPV = [];
    if (CONFIG.useMCTS) {
      // MCTS produces only first move; PV of length 1
      openingPV[0] = mctsSearch(initialBoard, 1, validMoves, api, weights, analysisDeadline);
    } else {
      const pvResult = iddfsPVAlphaBeta(
        initialBoard, 1, validMoves, api,
        weights, new Map(), maxDepth, analysisDeadline
      );
      openingPV = pvResult.pv;
    }
  
    // 5) Strategy closure
    let pvIndex = 0;
    return function strategy(board, player, validMoves) {
      const moveStart = performance.now();
      const remainingTime = 10000 - totalTimeSpent;
      const emptyCount = board.flat().filter(v=>v===0).length;
      const alloc = remainingTime / Math.max(emptyCount,1);
      const timeLimit = Math.min(alloc, 1000);
      const deadline = moveStart + timeLimit;
  
      if (validMoves.length === 0) return null;
  
      // PV phase
      if (pvIndex < openingPV.length) {
        const mv = openingPV[pvIndex++];
        totalTimeSpent += performance.now() - moveStart;
        return mv;
      }
  
      // Fallback search
      validMoves.sort((a,b) => weights[b.row][b.col] - weights[a.row][a.col]);
      let bestMove;
      if (CONFIG.useMCTS) {
        bestMove = mctsSearch(board, player, validMoves, api, weights, deadline);
      } else {
        bestMove = iddfsAlphaBeta(board, player, validMoves, api, weights, new Map(), maxDepth, deadline);
      }
  
      totalTimeSpent += performance.now() - moveStart;
      return bestMove;
    };
  }
  
  // --- IDDFS+α–β with PV extraction ---
  function iddfsPVAlphaBeta(board, player, validMoves, api, weights, tt, maxDepth, deadline) {
    let bestPv = [validMoves[0]];
    for (let depth=1; depth<=maxDepth; depth++) {
      if (performance.now() >= deadline) break;
      const res = alphaBetaPV(board, player, depth, -Infinity, Infinity, api, weights, tt, deadline);
      if (res.pv && res.pv.length) bestPv = res.pv;
    }
    return { pv: bestPv };
  }
  
  function alphaBetaPV(board, player, depth, alpha, beta, api, weights, tt, deadline) {
    if (performance.now() >= deadline) return { score: 0, pv: [] };
    const key = boardToKey(board) + '|' + player + '|' + depth;
    if (tt.has(key)) return tt.get(key);
    const valid = api.getValidMoves(board, player);
    if (depth===0 || valid.length===0) {
      const e = api.evaluateBoard(board, player).totalScore;
      const se = staticEval(board, weights, player);
      return { score: e+se, pv: [] };
    }
    let bestScore = player===1 ? -Infinity : Infinity;
    let bestPv = [];
    for (const mv of valid) {
      const res = api.simulateMove(board, player, mv.row, mv.col);
      if (!res.valid) continue;
      const child = alphaBetaPV(res.resultingBoard, 3-player, depth-1, alpha, beta, api, weights, tt, deadline);
      const sc = child.score;
      if ((player===1 && sc>bestScore) || (player===2 && sc<bestScore)) {
        bestScore = sc;
        bestPv = [mv, ...child.pv];
      }
      if (player===1) alpha = Math.max(alpha, sc);
      else beta = Math.min(beta, sc);
      if (beta<=alpha) break;
    }
    const out = { score: bestScore, pv: bestPv };
    tt.set(key, out);
    return out;
  }
  
  // --- MCTS (unchanged) ---
  class MCTSNode { /* ... as before ... */ }
  function mctsSearch(rootBoard, rootPlayer, validMoves, api, weights, deadline) { /* ... */ }
  function treePolicy(node, api) { /* ... */ }
  function expand(node, valid, api) { /* ... */ }
  function bestUCT(node) { /* ... */ }
  function defaultPolicy(node, api, weights) { /* ... */ }
  function backup(node, reward) { /* ... */ }
  
  // --- Utilities ---
  function probeRules(stageConfig, board, api) { /* ... */ }
  function generateStaticWeights(stageConfig, board, flags) { /* ... */ }
  function staticEval(board, weights, player) { /* ... */ }
  function determineDepth(stageConfig, flags) { /* ... */ }
  function boardToKey(board) { return board.flat().join(','); }
  