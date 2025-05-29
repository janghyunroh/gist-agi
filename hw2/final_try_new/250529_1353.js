// othello_ai_system.js
// Partial Hybrid: PV + MCTS Focus with α–β fallback
// Added stable square heuristic for absolute stability detection

const CONFIG = {
  // meta parameters
  randomSimulations: 200,    // for potential future tuning
  pvDepthStart: 6,           // initial depth for PV search
  pvLimitMoves: 2,           // use first 2 moves from PV
  mctsThresholdBF: 3,        // use α–β when branching factor <= 3
  maxMoveTime: 1000          // ms per move cap
};

function analyzeStage(stageConfig, initialBoard, validMoves, api) {
  const startAnalysis = performance.now();
  const deadlineAnalysis = startAnalysis + 60000;
  const myPlayer = 1;
  const initialKey = boardToKey(initialBoard);

  // 1) Rule probing
  const flags = probeRules(stageConfig, initialBoard, api);

    // 2) Learned position weights via meta-heuristic regression
  // compute feature vectors and run random simulations + regression within analysis budget
  let weights = basePositionWeights(
    stageConfig.boardSize,
    initialBoard,
    api,
    deadlineAnalysis
  );

  // 3) PV search using full analysis time
  const fullPV = fullTimePVSearch(
    initialBoard, myPlayer, validMoves, api, weights, deadlineAnalysis
  );
  const myPV = extractMyPV(fullPV, myPlayer);

  // 4) Prepare strategy closure
  let pvIndex = 0;
  let timeUsed = 0;

  return function strategy(board, player, validMoves) {
    // reset per-match state
    if (boardToKey(board) === initialKey) {
      pvIndex = 0;
      timeUsed = 0;
    }

    const turnStart = performance.now();
    const remainingTime = 10000 - timeUsed;
    const empties = board.flat().filter(c => c === 0).length;
    const alloc = remainingTime / Math.max(empties, 1);
    const timeForMove = Math.min(alloc, CONFIG.maxMoveTime);
    const deadlineMove = turnStart + timeForMove;

    if (validMoves.length === 0) return null;

    // PV phase: first few moves
    if (player === myPlayer && pvIndex < Math.min(CONFIG.pvLimitMoves, myPV.length)) {
      const mv = myPV[pvIndex++];
      timeUsed += performance.now() - turnStart;
      return mv;
    }

    // Stable square heuristic: prefer absolutely stable moves
    const stableMoves = validMoves.filter(mv => isStable(board, mv.row, mv.col, player));
    if (stableMoves.length) {
      timeUsed += performance.now() - turnStart;
      return stableMoves[0];
    }

    // Branching factor for fallback decision
    const bf = api.getValidMoves(board, player).length;
    let move;
    if (bf <= CONFIG.mctsThresholdBF) {
      // low branching: deep α–β search
      move = iddfsAlphaBeta(
        board, player, validMoves, api,
        weights, new Map(), CONFIG.pvDepthStart,
        deadlineMove
      );
    } else {
      // mid/high branching: MCTS
      move = mctsSearch(
        board, player, validMoves, api,
        weights, deadlineMove
      );
    }

    timeUsed += performance.now() - turnStart;
    return move;
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
// basePositionWeights is executed during the initial 60-second analysis phase.
// It replaces the fixed template weights with a data-driven matrix learned via meta-heuristic regression:
//  1) For each cell (r,c), we compute a feature vector describing its properties (corner, edge, blocked neighbors).
//  2) We run random short simulations from the initial board, collect final board evaluation scores, and pair each cell's feature vector with the resulting score.
//  3) We perform linear regression to learn a weight for each feature, effectively learning how each feature contributes to a good outcome.
//  4) We reconstruct the position weight matrix by applying the learned feature weights to each cell's feature vector.
// This yields a fully general position weight matrix tailored to any stage without hard‑coding specific rule flags.
function basePositionWeights(N, initialBoard, api, deadline) {
  // 1) Compute feature vectors for all cells
  const features = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const isCorner = ((r === 0 || r === N-1) && (c === 0 || c === N-1)) ? 1 : 0;
      const isEdge = (r === 0 || r === N-1 || c === 0 || c === N-1) ? 1 : 0;
      const blockedNeighbours = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]
        .reduce((sum, [dr, dc]) => {
          const nr = r + dr, nc = c + dc;
          return sum + (nr >= 0 && nr < N && nc >= 0 && nc < N && initialBoard[nr][nc] === 3 ? 1 : 0);
        }, 0);
      features.push({ r, c, vector: [isCorner, isEdge, blockedNeighbours] });
    }
  }

  // 2) Run random simulations to collect (feature, score) data
  const X = [];
  const y = [];
  const sims = CONFIG.randomSimulations;
  for (let k = 0; k < sims; k++) {
    if (performance.now() > deadline) break;
    let board = initialBoard.map(row => [...row]);
    let player = 1;
    // short rollout (10 moves)
    for (let t = 0; t < 10; t++) {
      const moves = api.getValidMoves(board, player);
      if (!moves.length) break;
      const mv = moves[Math.floor(Math.random() * moves.length)];
      const res = api.simulateMove(board, player, mv.row, mv.col);
      board = res.resultingBoard;
      player = 3 - player;
    }
    const score = api.evaluateBoard(board, 1).totalScore;
    // associate each cell feature with this score
    for (const f of features) {
      X.push(f.vector);
      y.push(score);
    }
  }

  // 3) Perform linear regression on collected data
  const w = [0, 0, 0];
  const lr = 0.01;
  const iterations = 50;
  const m = X.length;
  for (let it = 0; it < iterations; it++) {
    const grad = [0, 0, 0];
    for (let i = 0; i < m; i++) {
      const pred = w[0] * X[i][0] + w[1] * X[i][1] + w[2] * X[i][2];
      const err = pred - y[i];
      grad[0] += err * X[i][0];
      grad[1] += err * X[i][1];
      grad[2] += err * X[i][2];
    }
    w[0] -= lr * grad[0] / m;
    w[1] -= lr * grad[1] / m;
    w[2] -= lr * grad[2] / m;
  }

  // 4) Reconstruct weight matrix using learned coefficients
  const weights = Array.from({ length: N }, () => Array(N).fill(0));
  for (const f of features) {
    const val = w[0] * f.vector[0] + w[1] * f.vector[1] + w[2] * f.vector[2];
    weights[f.r][f.c] = val;
  }

  return weights;
}


// --- Full-Time PV Search ---
function fullTimePVSearch(board, player, validMoves, api, weights, deadline) {
  let bestPV = [];
  let depth = CONFIG.pvDepthStart;
  const tt = new Map();
  while (performance.now() < deadline) {
    const res = alphaBetaPV(
      board, player, depth,
      -Infinity, Infinity,
      api, weights, tt, deadline
    );
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
    const r = api.simulateMove(board, player, mv.row, mv.col);
    if (!r.valid) continue;
    const child = alphaBetaPV(r.resultingBoard, 3 - player, depth - 1, alpha, beta, api, weights, tt, deadline);
    if ((player === 1 && child.score > bestScore) || (player === 2 && child.score < bestScore)) {
      bestScore = child.score;
      bestPV = [mv, ...child.pv];
    }
    if (player === 1) alpha = Math.max(alpha, child.score);
    else beta = Math.min(beta, child.score);
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
    const r = api.simulateMove(board, player, mv.row, mv.col);
    if (!r.valid) continue;
    const child = alphaBeta(r.resultingBoard, 3 - player, depth - 1, alpha, beta, api, weights, tt, deadline);
    if ((player === 1 && child.score > bestScore) || (player === 2 && child.score < bestScore)) {
      bestScore = child.score;
      bestMove = mv;
    }
    if (player === 1) alpha = Math.max(alpha, child.score);
    else beta = Math.min(beta, child.score);
    if (beta <= alpha) break;
  }
  const out = { score: bestScore, move: bestMove };
  tt.set(key, out);
  return out;
}

// --- MCTS Policies ---
function defaultPolicy(node, api, weights, rootPlayer) {
  let b = node.board.map(r => [...r]), p = node.player;
  for (let i = 0; i < 20; i++) {
    const ms = api.getValidMoves(b, p);
    if (!ms.length) break;
    const mv = ms[Math.floor(Math.random() * ms.length)];
    const rr = api.simulateMove(b, p, mv.row, mv.col);
    b = rr.resultingBoard; p = 3 - p;
  }
  return api.evaluateBoard(b, rootPlayer).totalScore;
}

function backup(node, reward) {
  while (node) { node.visits++; node.wins += reward; node = node.parent; }
}

class MCTSNode {
  constructor(board, player, move = null, parent = null) {
    this.board = board; this.player = player; this.move = move; this.parent = parent;
    this.children = []; this.visits = 0; this.wins = 0;
  }
  isLeaf() { return this.children.length === 0; }
}

function expand(node, moves, api) {
  for (const mv of moves) {
    const r = api.simulateMove(node.board, node.player, mv.row, mv.col);
    if (!r.valid) continue;
    node.children.push(new MCTSNode(r.resultingBoard, 3 - node.player, mv, node));
  }
}

function bestUCT(node) {
  const C = Math.sqrt(2);
  let best = null, bv = -Infinity;
  for (const c of node.children) {
    const u = (c.wins / (c.visits + 1)) + C * Math.sqrt(Math.log(node.visits + 1) / (c.visits + 1));
    if (u > bv) { bv = u; best = c; }
  }
  return best;
}

function treePolicy(node, api) {
  while (true) {
    const ms = api.getValidMoves(node.board, node.player);
    if (!ms.length) return node;
    if (node.isLeaf()) { expand(node, ms, api); if (!node.children.length) return node; return node.children[0]; }
    const nxt = bestUCT(node);
    if (!nxt) return node; node = nxt;
  }
}

function mctsSearch(board, player, validMoves, api, weights, deadline) {
  const root = new MCTSNode(board, player);
  while (performance.now() < deadline) {
    const leaf = treePolicy(root, api);
    const reward = defaultPolicy(leaf, api, weights);
    backup(leaf, reward);
  }
  let best = null, mvC = -1;
  for (const c of root.children) if (c.visits > mvC) { mvC = c.visits; best = c; }
  return best ? best.move : validMoves[0];
}

// --- Utilities ---
function staticEval(board, weights, player) {
  let sc = 0, opp = 3 - player;
  for (let i = 0; i < board.length; i++) for (let j = 0; j < board.length; j++) {
    if (board[i][j] === player) sc += weights[i][j];
    else if (board[i][j] === opp) sc -= weights[i][j];
  }
  return sc;
}

function extractMyPV(fullPV, player) {
  const off = player === 1 ? 0 : 1;
  return fullPV.filter((_, i) => i % 2 === off);
}

function isStable(board, r, c, player) {
  const N = board.length;
  const opp = 3 - player;
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]]; // N,S,W,E
  const okDir = ([dx,dy]) => {
    let x = r + dx, y = c + dy;
    while (x >= 0 && x < N && y >= 0 && y < N) {
      if (board[x][y] === 0 || board[x][y] === opp) return false;
      if (board[x][y] === 3) return true; // blocked anchor
      x += dx; y += dy;
    }
    return true; // reached edge
  };
  // stable if vertical or horizontal fully anchored
  if (okDir(dirs[0]) && okDir(dirs[1])) return true;
  if (okDir(dirs[2]) && okDir(dirs[3])) return true;
  return false;
}

function boardToKey(board) { return board.flat().join(','); }
