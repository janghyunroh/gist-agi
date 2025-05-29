// othello_ai_system.js
// Partial Hybrid: PV + MCTS Focus with α–β fallback + Learned Position Weights
// Stable square heuristic + Black-box rule probing

const CONFIG = {
  // Timing and simulation
  randomSimulations: 200,
  shortRolloutLength: 10,
  regressionIterations: 50,
  regressionLearningRate: 0.01,
  pvDepthStart: 6,
  pvLimitMoves: 2,
  mctsThresholdBF: 3,
  maxMoveTime: 1000
};

function analyzeStage(stageConfig, initialBoard, validMoves, api) {
  const startAnalysis = performance.now();
  const deadlineAnalysis = startAnalysis + 60000;
  const myPlayer = 1;
  const initialKey = boardToKey(initialBoard);

  // 1) Rule probing for occlusion/fewer-pieces
  const flags = probeRules(stageConfig, initialBoard, api);

  // 2) Learned position weights via regression
  const weights = basePositionWeights(
    initialBoard.length,
    initialBoard,
    api,
    deadlineAnalysis
  );

  // 3) PV search
  let fullPV = [];
  let depth = CONFIG.pvDepthStart;
  const ttPV = new Map();
  while (performance.now() < deadlineAnalysis) {
    const res = alphaBetaPV(
      initialBoard, myPlayer, depth,
      -Infinity, Infinity,
      api, weights, ttPV, deadlineAnalysis
    );
    if (res.pv.length > fullPV.length) fullPV = res.pv;
    depth++;
  }
  const myPV = extractMyPV(fullPV, myPlayer);

  // 4) Strategy closure
  let pvIndex = 0, timeUsed = 0;
  return function strategy(board, player, validMoves) {
    // Reset on new match
    if (boardToKey(board) === initialKey) {
      pvIndex = 0;
      timeUsed = 0;
    }

    const turnStart = performance.now();
    const remainingTime = 10000 - timeUsed;
    const empties = board.flat().filter(c => c === 0).length;
    const timeForMove = Math.min(remainingTime / Math.max(empties, 1), CONFIG.maxMoveTime);
    const deadlineMove = turnStart + timeForMove;

    if (!validMoves || validMoves.length === 0) return null;

    // PV phase
    if (player === myPlayer && pvIndex < Math.min(CONFIG.pvLimitMoves, myPV.length)) {
      const mv = myPV[pvIndex++];
      timeUsed += performance.now() - turnStart;
      return mv;
    }

    // Stable heuristic
    const stable = validMoves.filter(mv => isStable(board, mv.row, mv.col, player, flags.occlusion));
    if (stable.length) {
      timeUsed += performance.now() - turnStart;
      return stable[0];
    }

    // Branching decision
    const bf = api.getValidMoves(board, player).length;
    let move;
    if (bf <= CONFIG.mctsThresholdBF) {
      move = iddfsAlphaBeta(
        board, player, validMoves, api,
        weights, new Map(), CONFIG.pvDepthStart, deadlineMove
      );
    } else {
      move = mctsSearch(
        board, player, validMoves, api, weights, deadlineMove
      );
    }

    timeUsed += performance.now() - turnStart;
    return move;
  };
}

// --- Rule Probing ---
function probeRules(stageConfig, board, api) {
  // flag.occlusion = true if blocked cells do NOT act as anchors (occlusion rule)
  const flags = { occlusion: false, fewerContinue: false };
  for (const c of stageConfig.initialBlocked || []) {
    // if simulateMove succeeds on blocked cell, occlusion rule applies
    if (api.simulateMove(board, 1, c.r, c.c).valid) {
      flags.occlusion = true;
      break;
    }
  }
  // Test fewer-pieces-continue
  const test = board.map(r => [...r]);
  let removed = 0;
  const N = board.length;
  for (let i = 0; i < N && removed < N*N/2; i++) {
    for (let j = 0; j < N && removed < N*N/2; j++) {
      if (test[i][j] === 1) { test[i][j] = 0; removed++; }
    }
  }
  flags.fewerContinue = api.getValidMoves(test, 1).length > 0;
  return flags;
}

// --- Learned Position Weights ---
function basePositionWeights(N, initialBoard, api, deadline) {
  // 1) Compute feature vectors for all cells
  const features = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const isCorner = ((r === 0 || r === N - 1) && (c === 0 || c === N - 1)) ? 1 : 0;
      const isEdge   = (r === 0 || r === N - 1 || c === 0 || c === N - 1) ? 1 : 0;
      const blockedNeighbours = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]
        .reduce((sum, [dr, dc]) => {
          const rr = r + dr, cc = c + dc;
          return sum + ((rr >= 0 && rr < N && cc >= 0 && cc < N && initialBoard[rr][cc] === 3) ? 1 : 0);
        }, 0);
      features.push({ r, c, vec: [isCorner, isEdge, blockedNeighbours] });
    }
  }

  // 2) Collect training data via random simulations
  const X = [];
  const y = [];
  for (let k = 0; k < CONFIG.randomSimulations; k++) {
    if (performance.now() > deadline) break;
    let b = initialBoard.map(row => [...row]);
    let p = 1;
    for (let t = 0; t < CONFIG.shortRolloutLength; t++) {
      const mvs = api.getValidMoves(b, p);
      if (!mvs.length) break;
      const mv = mvs[Math.floor(Math.random() * mvs.length)];
      const res = api.simulateMove(b, p, mv.row, mv.col);
      b = res.resultingBoard;
      p = 3 - p;
    }
    const score = api.evaluateBoard(b, 1).totalScore;
    for (const f of features) {
      X.push(f.vec);
      y.push(score);
    }
  }

  // 3) Linear regression
  const w = [0, 0, 0];
  const m = X.length;
  for (let it = 0; it < CONFIG.regressionIterations; it++) {
    const grad = [0, 0, 0];
    for (let i = 0; i < m; i++) {
      const [a, b, c] = X[i];
      const err = (w[0] * a + w[1] * b + w[2] * c) - y[i];
      grad[0] += err * a;
      grad[1] += err * b;
      grad[2] += err * c;
    }
    for (let j = 0; j < 3; j++) {
      w[j] -= CONFIG.regressionLearningRate * (grad[j] / m);
    }
  }

  // 4) Construct weight matrix
  const weights = Array.from({ length: N }, () => Array(N).fill(0));
  for (const f of features) {
    const [a, b, c] = f.vec;
    weights[f.r][f.c] = w[0] * a + w[1] * b + w[2] * c;
  }

  return weights;
}

// --- PV Alpha-Beta for search ---
function alphaBetaPV(board, player, depth, alpha, beta, api, weights, tt, deadline) {
  if (performance.now()>=deadline) return {score:0,pv:[]};
  const key = boardToKey(board)+'|'+player+'|'+depth;
  if (tt.has(key)) return tt.get(key);
  const moves = api.getValidMoves(board,player);
  if (depth===0||!moves.length) {
    const ev = api.evaluateBoard(board,player).totalScore;
    const se = staticEval(board,weights,player);
    return {score:ev+se,pv:[]};
  }
  let bestScore = player===1?-Infinity:Infinity;
  let bestPV = [];
  for (const mv of moves) {
    if (performance.now()>=deadline) break;
    const res = api.simulateMove(board,player,mv.row,mv.col);
    if (!res.valid) continue;
    const child = alphaBetaPV(res.resultingBoard,3-player,depth-1,alpha,beta,api,weights,tt,deadline);
    if ((player===1&&child.score>bestScore)||(player===2&&child.score<bestScore)) {
      bestScore = child.score;
      bestPV = [mv, ...child.pv];
    }
    if (player===1) alpha = Math.max(alpha, child.score);
    else beta = Math.min(beta, child.score);
    if (beta <= alpha) break;
  }
  const out = { score: bestScore, pv: bestPV };
  tt.set(key, out);
  return out;
}

// --- Alpha-Beta search ---
function alphaBeta(board, player, depth, alpha, beta, api, weights, tt, deadline) {
  if (performance.now()>=deadline) return {score:0,move:null};
  const key = boardToKey(board)+'|'+player+'|'+depth;
  if (tt.has(key)) return tt.get(key);
  const moves = api.getValidMoves(board,player);
  if (depth===0||!moves.length) {
    const ev = api.evaluateBoard(board,player).totalScore;
    const se = staticEval(board,weights,player);
    return {score:ev+se,move:null};
  }
  let bestMove = null;
  let bestScore = player===1?-Infinity:Infinity;
  for (const mv of moves) {
    if (performance.now()>=deadline) break;
    const res = api.simulateMove(board,player,mv.row,mv.col);
    if (!res.valid) continue;
    const child = alphaBeta(res.resultingBoard,3-player,depth-1,alpha,beta,api,weights,tt,deadline);
    if ((player===1&&child.score>bestScore)||(player===2&&child.score<bestScore)) {
      bestScore = child.score;
      bestMove = mv;
    }
    if (player===1) alpha = Math.max(alpha, child.score);
    else beta = Math.min(beta, child.score);
    if (beta <= alpha) break;
  }
  const out = { score: bestScore, move: bestMove };
  tt.set(key, out);
  return out;
}

// --- Iterative Deepening DFS + Alpha-Beta ---
function iddfsAlphaBeta(board, player, validMoves, api, weights, tt, initDepth, deadline) {
  let bestMove = validMoves[0];
  let depth = initDepth;
  while (performance.now()<deadline) {
    const res = alphaBeta(board, player, depth, -Infinity, Infinity, api, weights, tt, deadline);
    if (res.move) bestMove = res.move;
    depth++;
  }
  return bestMove;
}

// --- Static Evaluation ---
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

// --- MCTS Utilities ---
function defaultPolicy(node, api, weights) {
  let b = node.board.map(r => [...r]);
  let p = node.player;
  for (let i = 0; i < 20; i++) {
    const mvs = api.getValidMoves(b, p);
    if (!mvs.length) break;
    const mv = mvs[Math.floor(Math.random() * mvs.length)];
    const res = api.simulateMove(b, p, mv.row, mv.col);
    if (!res.valid) break;
    b = res.resultingBoard;
    p = 3 - p;
  }
  return api.evaluateBoard(b, node.player).totalScore;
}

function backup(node, reward) {
  let n = node;
  while (n) {
    n.visits++;
    n.wins += reward;
    n = n.parent;
  }
}

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

function expand(node, api) {
  const moves = api.getValidMoves(node.board, node.player);
  for (const mv of moves) {
    const res = api.simulateMove(node.board, node.player, mv.row, mv.col);
    if (!res.valid) continue;
    const child = new MCTSNode(res.resultingBoard, 3 - node.player, mv, node);
    node.children.push(child);
  }
}

function bestUCT(node) {
  const C = Math.sqrt(2);
  let best = null;
  let bestVal = -Infinity;
  for (const c of node.children) {
    const u = (c.wins / (c.visits + 1)) + C * Math.sqrt(Math.log(node.visits + 1) / (c.visits + 1));
    if (u > bestVal) {
      bestVal = u;
      best = c;
    }
  }
  return best;
}

function treePolicy(node, api) {
  let n = node;
  while (true) {
    const moves = api.getValidMoves(n.board, n.player);
    if (!moves.length) return n;
    if (n.isLeaf()) {
      expand(n, api);
      if (n.children.length === 0) return n;
      return n.children[0];
    }
    const next = bestUCT(n);
    if (!next) return n;
    n = next;
  }
}

function mctsSearch(board, player, validMoves, api, weights, deadline) {
  const root = new MCTSNode(board, player);
  while (performance.now() < deadline) {
    const leaf = treePolicy(root, api);
    const reward = defaultPolicy(leaf, api, weights);
    backup(leaf, reward);
  }
  let bestChild = null;
  let maxVisits = -Infinity;
  for (const c of root.children) {
    if (c.visits > maxVisits) {
      maxVisits = c.visits;
      bestChild = c;
    }
  }
  return bestChild ? bestChild.move : validMoves[0];
}

// ... rest of code unchanged ...

// --- Extract own moves from principal variation ---
function extractMyPV(fullPV, player) {
  const offset = player === 1 ? 0 : 1;
  return fullPV.filter((_, idx) => idx % 2 === offset);
}

// --- Stable Square Heuristic ---
// allowOcclusion = flags.occlusion
function isStable(board, r, c, player, allowOcclusion) {
  const N = board.length;
  const opp = 3 - player;
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];

  function ok([dx, dy]) {
    let x = r + dx, y = c + dy;
    while (x >= 0 && x < N && y >= 0 && y < N) {
      const cell = board[x][y];
      if (cell === 0 || cell === opp) return false;
      if (cell === 3) {
        // blocked cell anchors only if occlusion is not in effect
        if (!allowOcclusion) return true;
        // else continue past the blocked cell
      }
      x += dx;
      y += dy;
    }
    return true;
  }

  return (ok(dirs[0]) && ok(dirs[1])) || (ok(dirs[2]) && ok(dirs[3]));
}

function boardToKey(board) { return board.flat().join(','); }
