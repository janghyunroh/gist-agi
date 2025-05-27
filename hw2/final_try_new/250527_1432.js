/*
 * Othello Intelligent System
 * analyzeStage implementation using hybrid 1-2 ply search + heuristics
 * Constraints: 60s analysis, 10s total per game (~200ms per move), per-move ~150ms
 */

function analyzeStage(stageConfig, initialBoard, validMoves, api) {
  const N = stageConfig.boardSize;
  const perMoveTimeLimit = 150; // ms budget per move

  // 1. Generate positional weights
  const W = generateWeights(N, stageConfig.initialBlocked);

  // 2. (Optional) Opening book via sampling first moves
  const openingBook = buildOpeningBook(initialBoard, validMoves, api, W);

  // 3. Memoization cache for evaluations
  const evalCache = new Map();

  // 4. Simple board hashing (stringified)
  function boardHash(board) {
    return board.map(r => r.join('')).join('|');
  }

  // Evaluate board with caching
  function cachedEval(board, player) {
    const key = boardHash(board) + ':' + player;
    if (evalCache.has(key)) return evalCache.get(key);
    const e = api.evaluateBoard(board, player).totalScore;
    evalCache.set(key, e);
    return e;
  }

  // Strategy function called each move
  return function strategy(board, player, validMoves, makeMove) {
    if (validMoves.length === 0) return null;
    const startTime = performance.now();
    let bestMove = null;
    let bestScore = -Infinity;
    const opponent = player === 1 ? 2 : 1;

    // Try opening book first
    const h = boardHash(board);
    if (openingBook[h]) {
      return openingBook[h];
    }

    for (const move of validMoves) {
      // timeout check
      if (performance.now() - startTime > perMoveTimeLimit) break;

      // 1-ply simulate
      const sim1 = api.simulateMove(board, player, move.row, move.col);
      if (!sim1.valid) continue;
      const score1 = cachedEval(sim1.resultingBoard, player);

      // 2-ply: assume opponent minimizes our score
      let score2 = Infinity;
      const oppMoves = api.getValidMoves(sim1.resultingBoard, opponent);
      if (oppMoves.length === 0) {
        score2 = score1;
      } else {
        for (const m2 of oppMoves) {
          if (performance.now() - startTime > perMoveTimeLimit) break;
          const sim2 = api.simulateMove(sim1.resultingBoard, opponent, m2.row, m2.col);
          if (!sim2.valid) continue;
          const s2 = cachedEval(sim2.resultingBoard, player);
          if (s2 < score2) score2 = s2;
        }
      }

      // combine heuristics
      const posW = W[move.row][move.col] || 0;
      const combined = 0.4 * posW + 0.6 * (score1 - (score2 === Infinity ? score1 : score2));
      if (combined > bestScore) {
        bestScore = combined;
        bestMove = move;
      }
    }

    // fallback to random if no best move found
    return bestMove || validMoves[Math.floor(Math.random() * validMoves.length)];
  };
}

// Helper: generate positional weights matrix
function generateWeights(N, blocked) {
  const W = Array.from({ length: N }, () => Array(N).fill(0));
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      // corners
      if ((i === 0 || i === N - 1) && (j === 0 || j === N - 1)) W[i][j] = 100;
      // edges
      else if (i === 0 || i === N - 1 || j === 0 || j === N - 1) W[i][j] = 20;
      else W[i][j] = 0;
    }
  }
  // mark blocked as very low priority
  for (const b of blocked) {
    if (b.r >= 0 && b.r < N && b.c >= 0 && b.c < N) {
      W[b.r][b.c] = -Infinity;
    }
  }
  return W;
}

// Helper: build basic opening book by sampling first moves
function buildOpeningBook(initialBoard, validMoves, api, W) {
  const book = {};
  const player = 1; // assume Black starts
  const h0 = initialBoard.map(r => r.join('')).join('|');
  // sample each first move
  let best = null, bestScore = -Infinity;
  for (const move of validMoves) {
    const sim = api.simulateMove(initialBoard, player, move.row, move.col);
    if (!sim.valid) continue;
    const s = api.evaluateBoard(sim.resultingBoard, player).totalScore;
    if (s > bestScore) {
      bestScore = s;
      best = move;
    }
  }
  if (best) book[h0] = best;
  return book;
}

// Export for loader
if (typeof module !== 'undefined') module.exports = { analyzeStage };
