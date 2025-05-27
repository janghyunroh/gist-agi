// othello_ai_system.js
// Advanced Intelligent System for Othello AI Arena
// Features: rule probing, branch-factor measurement, meta-heuristic weight tuning,
// full-time PV, IDDFS+α–β, MCTS hybrid search

const CONFIG = {
  // meta parameters
  randomSimulations: 200,      // number of random playouts for weight tuning
  pvDepthStart: 6,            // initial PV search depth
  mctsThresholdBF: 5,         // BF threshold to switch to MCTS in dynamic search
  maxMoveTime: 1000           // max ms per move
};

function analyzeStage(stageConfig, initialBoard, validMoves, api) {
  const t0 = performance.now();
  const deadlineAnalysis = t0 + 60000;
  const myPlayer = 1; // Black

  // 1) Probe rules
  const flags = probeRules(stageConfig, initialBoard, api);

  // 2) Base static weights
  let weights = basePositionWeights(stageConfig.boardSize, flags);

  // 3) Branching factor
  const avgBF = measureBranchingFactor(api, initialBoard, myPlayer);

  // 4) Meta-heuristic weight tuning
  const samples = simulateRandomGames(api, initialBoard, myPlayer, CONFIG.randomSimulations);
  const coeffs = linearRegression(samples.features, samples.results);
  weights = applyCoeffs(stageConfig.boardSize, flags, coeffs);

  // 5) Full-time PV search
  const fullPV = fullTimePVSearch(initialBoard, myPlayer, validMoves, api, weights, deadlineAnalysis);

  // 6) Extract only my moves
  const myPV = extractMyPV(fullPV, myPlayer);
  const pvLimit = Math.max(2, Math.floor(CONFIG.pvDepthStart / 2));

  // 7) Closure state
  let pvIndex = 0;
  let timeUsed = 0;

  return function strategy(board, player, validMoves) {
    const start = performance.now();
    const remainingTime = 10000 - timeUsed;
    const emptyCount = board.flat().filter(c => c === 0).length;
    const alloc = remainingTime / Math.max(emptyCount, 1);
    const timeForMove = Math.min(alloc, CONFIG.maxMoveTime);
    const deadline = start + timeForMove;

    if (validMoves.length === 0) return null;

    // PV phase
    if (player === myPlayer && pvIndex < Math.min(pvLimit, myPV.length)) {
      const mv = myPV[pvIndex++];
      timeUsed += performance.now() - start;
      return mv;
    }

    // Dynamic scheduling
    const bf = measureBranchingFactor(api, board, player);
    let bestMove;
    if (bf > CONFIG.mctsThresholdBF) {
      bestMove = mctsSearch(board, player, validMoves, api, weights, deadline);
    } else {
      bestMove = iddfsAlphaBeta(board, player, validMoves, api, weights, new Map(), CONFIG.pvDepthStart, deadline);
    }

    timeUsed += performance.now() - start;
    return bestMove;
  };
}

// --- Rule Probing ---
function probeRules(stageConfig, board, api) {
  const flags = { allowOnBlocked: false, fewerContinue: false };
  for (const c of stageConfig.initialBlocked || []) {
    if (api.simulateMove(board, 1, c.r, c.c).valid) {
      flags.allowOnBlocked = true;
      break;
    }
  }
  const test = board.map(r => [...r]);
  let removed = 0;
  for (let i = 0; i < test.length && removed < test.length * test.length - 1; i++) {
    for (let j = 0; j < test.length && removed < test.length * test.length - 1; j++) {
      if (test[i][j] === 1) { test[i][j] = 0; removed++; }
    }
  }
  flags.fewerContinue = api.getValidMoves(test, 1).length > 0;
  return flags;
}

// --- Static Weights ---
function basePositionWeights(N, flags) {
  const W = Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => {
      if ((i === 0 || i === N - 1) && (j === 0 || j === N - 1)) return 120;
      if (i === 0 || i === N - 1 || j === 0 || j === N - 1) return 20;
      return 5;
    })
  );
  return W;
}

// --- Branching Factor ---
function measureBranchingFactor(api, board, player) {
  return api.getValidMoves(board, player).length;
}

// --- Random Simulations ---
function simulateRandomGames(api, board, player, sims) {
  const features = [];
  const results = [];
  for (let k = 0; k < sims; k++) {
    let b = board.map(r => [...r]);
    let p = player;
    for (let d = 0; d < 20; d++) {
      const moves = api.getValidMoves(b, p);
      if (!moves.length) break;
      const mv = moves[Math.floor(Math.random() * moves.length)];
      const res = api.simulateMove(b, p, mv.row, mv.col);
      b = res.resultingBoard;
      p = 3 - p;
    }
    const ev = api.evaluateBoard(b, player);
    features.push([ev.cornerScore, ev.edgeScore, ev.mobilityScore]);
    results.push(ev.totalScore);
  }
  return { features, results };
}

// --- Linear Regression (Gradient Descent) ---
function linearRegression(X, y) {
  const w = [0, 0, 0];
  const lr = 0.01;
  for (let it = 0; it < 100; it++) {
    const grad = [0, 0, 0];
    for (let i = 0; i < X.length; i++) {
      const err = (w[0] * X[i][0] + w[1] * X[i][1] + w[2] * X[i][2]) - y[i];
      grad[0] += err * X[i][0];
      grad[1] += err * X[i][1];
      grad[2] += err * X[i][2];
    }
    w[0] -= lr * grad[0] / X.length;
    w[1] -= lr * grad[1] / X.length;
    w[2] -= lr * grad[2] / X.length;
  }
  return w;
}

// --- Apply Coeffs ---
function applyCoeffs(N, flags, coeffs) {
  const [c1, c2, c3] = coeffs;
  const W = Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => {
      if ((i === 0 || i === N - 1) && (j === 0 || j === N - 1)) return c1;
      if (i === 0 || i === N - 1 || j === 0 || j === N - 1) return c2;
      return c3;
    })
  );
  return W;
}

// --- Full-Time PV Search ---
function fullTimePVSearch(board, player, validMoves, api, weights, deadline) {
  let bestPV = [];
  let depth = CONFIG.pvDepthStart;
  const tt = new Map();
  while (performance.now() < deadline) {
    const res = alphaBetaPV(board, player, depth, -Infinity, Infinity, api, weights, tt, deadline);
    if (res.pv.length > bestPV.length) bestPV = res.pv;
    depth++;
  }
  return bestPV;
}

// --- PV Alpha-Beta ---
function alphaBetaPV(board, player, depth, alpha, beta, api, weights, tt, deadline) {
  if (performance.now() >= deadline) return { score: 0, pv: [] };
  const key = boardToKey(board) + '|' + player + '|' + depth;
  if (tt.has(key)) return tt.get(key);
  const moves = api.getValidMoves(board, player);
  if (depth === 0 || !moves.length) {
    const ev = api.evaluateBoard(board, player).totalScore;
    const se = staticEval(board, weights, player);
    return { score: ev + se, pv: [] };
  }
  let bestScore = player === 1 ? -Infinity : Infinity;
  let bestPV = [];
  for (const mv of moves) {
    if (performance.now() >= deadline) break;
    const res = api.simulateMove(board, player, mv.row, mv.col);
    if (!res.valid) continue;
    const child = alphaBetaPV(res.resultingBoard, 3 - player, depth - 1, alpha, beta, api, weights, tt, deadline);
    const sc = child.score;
    if ((player === 1 && sc > bestScore) || (player === 2 && sc < bestScore)) {
      bestScore = sc;
      bestPV = [mv, ...child.pv];
    }
    if (player === 1) alpha = Math.max(alpha, sc);
    else beta = Math.min(beta, sc);
    if (beta <= alpha) break;
  }
  const out = { score: bestScore, pv: bestPV };
  tt.set(key, out);
  return out;
}

// --- IDDFS + Alpha-Beta ---
function iddfsAlphaBeta(board, player, validMoves, api, weights, tt, initDepth, deadline) {
  let bestMove = validMoves[0];
  let depth = initDepth;
  while (performance.now() < deadline) {
    const res = alphaBeta(board, player, depth, -Infinity, Infinity, api, weights, tt, deadline);
    if (res.move) bestMove = res.move;
    depth++;
  }
  return bestMove;
}

// --- Alpha-Beta ---
function alphaBeta(board, player, depth, alpha, beta, api, weights, tt, deadline) {
  if (performance.now() >= deadline) return { score: 0, move: null };
  const key = boardToKey(board) + '|' + player + '|' + depth;
  if (tt.has(key)) return tt.get(key);
  const moves = api.getValidMoves(board, player);
  if (depth === 0 || !moves.length) {
    const ev = api.evaluateBoard(board, player).totalScore;
    const se = staticEval(board, weights, player);
    return { score: ev + se, move: null };
  }
  let bestMove = null;
  let bestScore = player === 1 ? -Infinity : Infinity;
  for (const mv of moves) {
    if (performance.now() >= deadline) break;
    const res = api.simulateMove(board, player, mv.row, mv.col);
    if (!res.valid) continue;
    const child = alphaBeta(res.resultingBoard, 3 - player, depth - 1, alpha, beta, api, weights, tt, deadline);
    const sc = child.score;
    if ((player === 1 && sc > bestScore) || (player === 2 && sc < bestScore)) {
      bestScore = sc;
      bestMove = mv;
    }
    if (player === 1) alpha = Math.max(alpha, sc);
    else beta = Math.min(beta, sc);
    if (beta <= alpha) break;
  }
  const out = { score: bestScore, move: bestMove };
  tt.set(key, out);
  return out;
}

// --- MCTS ---
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

function mctsSearch(board, player, validMoves, api, weights, deadline) {
  const root = new MCTSNode(board, player);
  while (performance.now() < deadline) {
    let node = treePolicy(root, api);
    const reward = defaultPolicy(node, api, weights);
    backup(node, reward);
  }
  let best = null;
  let maxVisits = -1;
  for (const c of root.children) {
    if (c.visits > maxVisits) { maxVisits = c.visits; best = c; }
  }
  return best ? best.move : validMoves[0];
}

function treePolicy(node, api) {
  while (true) {
    const moves = api.getValidMoves(node.board, node.player);
    if (moves.length === 0) return node;
    if (node.isLeaf()) {
      expand(node, moves, api);
      return node.children[0];
    } else {
      node = bestUCT(node);
    }
  }
}

function expand(node, moves, api) {
  for (const mv of moves) {
    const res = api.simulateMove(node.board, node.player, mv.row, mv.col);
    if (!res.valid) continue;
    node.children.push(new MCTSNode(res.resultingBoard, 3 - node.player, mv, node));
  }
}

function bestUCT(node) {
  const C = Math.sqrt(2);
  let best = null;
  let bestVal = -Infinity;
  for (const c of node.children) {
    const uct = (c.wins / (c.visits + 1)) + C * Math.sqrt(Math.log(node.visits + 1) / (c.visits + 1));
    if (uct > bestVal) { bestVal = uct; best = c; }
  }
  return best;
}

function defaultPolicy(node, api, weights) {
  let b = node.board.map(r => [...r]);
  let p = node.player;
  for (let i = 0; i < 20; i++) {
    const moves = api.getValidMoves(b, p);
    if (!moves.length) break;
    const mv = moves[Math.floor(Math.random() * moves.length)];
    const res = api.simulateMove(b, p, mv.row, mv.col);
    b = res.resultingBoard;
    p = 3 - p;
  }
  const ev = api.evaluateBoard(b, node.player);
  return ev.totalScore;
}

function backup(node, reward) {
  while (node) {
    node.visits++;
    node.wins += reward;
    node = node.parent;
  }
}

// --- Utilities ---
function staticEval(board, weights, player) {
  let score = 0;
  const opp = 3 - player;
  for (let i = 0; i < board.length; i++) {
    for (let j = 0; j < board.length; j++) {
      if (board[i][j] === player) score += weights[i][j];
      else if (board[i][j] === opp) score -= weights[i][j];
    }
  }
  return score;
}

function extractMyPV(fullPV, player) {
  const offset = player === 1 ? 0 : 1;
  return fullPV.filter((_, i) => i % 2 === offset);
}

function boardToKey(board) {
  return board.flat().join(',');
}
