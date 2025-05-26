// othello_ai_system.js
// Complete Intelligent System for Othello AI Arena

function analyzeStage(stageConfig, initialBoard, validMoves, api) {
    const analysisStart = performance.now();
    const analysisDeadline = analysisStart + 60_000; // 60s for analysis
  
    // 1) Rule probing
    const flags = probeRules(stageConfig, initialBoard, api);
  
    // 2) Generate static position weights
    const weights = generateStaticWeights(stageConfig, initialBoard, flags);
  
    // 3) Build opening book (first 1-2 moves)
    const openingBook = buildOpeningBook(initialBoard, validMoves, api, weights, flags);
  
    // 4) Transposition table
    const tt = new Map();
  
    // 5) Decide search parameters
    const searchParams = {
      maxDepth: determineDepth(stageConfig, flags),
      timeLimitPerMove: 500,    // ms per move
      totalTimeLimit: 10000     // total 10s
    };
  
    // Return the strategy function
    return function strategy(board, player, validMoves, makeMove) {
      if (validMoves.length === 0) return null;
  
      // Opening book lookup
      const key = boardToKey(board);
      if (openingBook[key]) {
        return openingBook[key];
      }
  
      // Iterative deepening alpha-beta search
      const moveDeadline = performance.now() + searchParams.timeLimitPerMove;
      const bestMove = iddfsAlphaBeta(
        board, player, validMoves, api,
        weights, tt, searchParams, moveDeadline
      );
      return bestMove;
    };
  }
  
  // --- Helper Components ---
  
  // Probe hidden rules by lightweight simulation
  function probeRules(stageConfig, board, api) {
    const flags = { allowOnBlocked: false, fewerPiecesContinue: false };
  
    // Test blocked cell rule
    for (const cell of (stageConfig.initialBlocked || [])) {
      const sim = api.simulateMove(board, 1, cell.r, cell.c);
      if (sim.valid) {
        flags.allowOnBlocked = true;
        break;
      }
    }
  
    // Test fewerPiecesContinue: simulate a board with one piece of opponent
    if (!flags.fewerPiecesContinue) {
      const testBoard = board.map(r => [...r]);
      // remove all but one black piece
      let removed = 0;
      for (let i = 0; i < testBoard.length && removed < testBoard.length*testBoard.length-1; i++) {
        for (let j = 0; j < testBoard.length && removed < testBoard.length*testBoard.length-1; j++) {
          if (testBoard[i][j] === 1) { testBoard[i][j] = 0; removed++; }
        }
      }
      const moves = api.getValidMoves(testBoard, 1);
      // if moves exist even with few pieces, assume default; else flag
      flags.fewerPiecesContinue = moves.length > 0;
    }
  
    return flags;
  }
  
  // Generate a weight matrix for static evaluation
  function generateStaticWeights(stageConfig, board, flags) {
    const N = stageConfig.boardSize;
    const W = [];
    for (let i = 0; i < N; i++) {
      W[i] = [];
      for (let j = 0; j < N; j++) {
        // corner
        if ((i === 0 || i === N-1) && (j === 0 || j === N-1)) W[i][j] = 120;
        // edge
        else if (i === 0 || i === N-1 || j === 0 || j === N-1) W[i][j] = 20;
        // inner
        else W[i][j] = 5;
      }
    }
    // adjust blocked neighbors if needed
    if (flags.allowOnBlocked) {
      for (const cell of (stageConfig.initialBlocked || [])) {
        for (let di=-1; di<=1; di++) for (let dj=-1; dj<=1; dj++) {
          const r = cell.r+di, c = cell.c+dj;
          if (r>=0 && r<N && c>=0 && c<N) W[r][c] += 10;
        }
      }
    }
    return W;
  }
  
  // Build a small opening book by evaluating first moves
  function buildOpeningBook(board, validMoves, api, weights, flags) {
    const book = {};
    const sims = [];
    for (const mv of validMoves) {
      const res = api.simulateMove(board, 1, mv.row, mv.col);
      if (!res.valid) continue;
      const score = api.evaluateBoard(res.resultingBoard, 1).totalScore + weights[mv.row][mv.col];
      sims.push({ key: boardToKey(board), move: mv, score });
    }
    if (sims.length) {
      sims.sort((a,b) => b.score - a.score);
      book[sims[0].key] = sims[0].move;
    }
    return book;
  }
  
  // Decide search depth based on stage and flags
  function determineDepth(stageConfig, flags) {
    const base = stageConfig.boardSize >= 8 ? 5 : 4;
    return flags.allowOnBlocked ? base - 1 : base;
  }
  
  // Serialize board to string key
  function boardToKey(board) {
    return board.flat().join(',');
  }
  
  // Iterative Deepening DFS with alpha-beta pruning
  function iddfsAlphaBeta(
    board, player, validMoves, api,
    weights, tt, searchParams, deadline
  ) {
    let bestMove = validMoves[0];
    for (let depth = 1; depth <= searchParams.maxDepth; depth++) {
      const result = alphaBeta(
        board, player, depth,
        -Infinity, Infinity,
        api, weights, tt, deadline
      );
      if (performance.now() >= deadline) break;
      if (result.move) bestMove = result.move;
    }
    return bestMove;
  }
  
  // Alpha-beta search returning best score and move
  function alphaBeta(
    board, player, depth, alpha, beta,
    api, weights, tt, deadline
  ) {
    if (performance.now() >= deadline) return { score: 0, move: null };
    const key = boardToKey(board) + '|' + depth + '|' + player;
    if (tt.has(key)) return tt.get(key);
  
    const valid = api.getValidMoves(board, player);
    if (depth === 0 || valid.length === 0) {
      const evalObj = api.evaluateBoard(board, player);
      return { score: evalObj.totalScore, move: null };
    }
  
    let bestMove = null;
    let bestScore = (player === 1) ? -Infinity : Infinity;
    for (const mv of valid) {
      const res = api.simulateMove(board, player, mv.row, mv.col);
      if (!res.valid) continue;
      const child = alphaBeta(
        res.resultingBoard, 3-player, depth-1,
        alpha, beta, api, weights, tt, deadline
      );
      const score = child.score;
      if (player === 1) {
        if (score > bestScore) { bestScore = score; bestMove = mv; }
        alpha = Math.max(alpha, score);
      } else {
        if (score < bestScore) { bestScore = score; bestMove = mv; }
        beta = Math.min(beta, score);
      }
      if (beta <= alpha) break;
    }
  
    const result = { score: bestScore, move: bestMove };
    tt.set(key, result);
    return result;
  }
  