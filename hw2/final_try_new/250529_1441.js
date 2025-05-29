// othello_ai_system.js
// Simplified: No PV, only rule probing + learned position weights + hybrid MCTS/α–β

const CONFIG = {
  randomSimulations: 200,
  shortRolloutLength: 10,
  regressionIterations: 50,
  regressionLearningRate: 0.01,
  mctsThresholdBF: 3,
  maxMoveTime: 1000
};

function analyzeStage(stageConfig, initialBoard, validMoves, api) {
  const startAnalysis = performance.now();
  const deadlineAnalysis = startAnalysis + 60000;
  const myPlayer = 1;
  const initialKey = boardToKey(initialBoard);

  // 1) Rule probing flags
  const flags = {};
  flags.blockedCells = stageConfig.initialBlocked || [];
  flags.occlusion = detectOcclusion(initialBoard, api, flags.blockedCells);
  flags.fewerContinue = detectFewerContinue(initialBoard, api);
  flags.cornerMissing = detectCornerMissing(flags.blockedCells, initialBoard.length);

  // 2) Learn position weights via meta-heuristic regression
  const weights = basePositionWeights(
    initialBoard.length,
    initialBoard,
    api,
    deadlineAnalysis
  );

  // Return strategy without PV
  return function strategy(board, player, validMoves) {
    // Reset per-match state
    if (boardToKey(board) === initialKey) {
      // no persistent state now
    }

    const turnStart = performance.now();
    const remainingTime = 10000;
    const empties = board.flat().filter(c => c === 0).length;
    const timeForMove = Math.min(remainingTime / Math.max(empties, 1), CONFIG.maxMoveTime);
    const deadlineMove = turnStart + timeForMove;

    if (!validMoves || validMoves.length === 0) return null;

    // Stable square heuristic
    const stable = validMoves.filter(mv => isStable(board, mv.row, mv.col, player));
    if (stable.length) {
      return stable[0];
    }

    // Branching factor decision
    const bf = validMoves.length;
    let move;
    if (bf <= CONFIG.mctsThresholdBF) {
      // α–β search
      move = iddfsAlphaBeta(
        board, player, validMoves, api,
        weights, new Map(), CONFIG.maxMoveTime, deadlineMove
      );
    } else {
      // MCTS
      move = mctsSearch(
        board, player, validMoves, api,
        weights, deadlineMove
      );
    }

    return move;
  };
}

// --- Rule Probing Helpers ---
function detectOcclusion(board, api, blocked) {
  const N = board.length;
  for (const {r, c} of blocked) {
    for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const rr = r + dr * 2, cc = c + dc * 2;
      if (rr >= 0 && rr < N && cc >= 0 && cc < N) {
        if (api.simulateMove(board, 1, rr, cc).valid) return true;
      }
    }
  }
  return false;
}
function detectFewerContinue(board, api) {
  const N = board.length;
  const copy = board.map(r => [...r]);
  let removed = 0, total = N*N;
  for (let i=0; i<N && removed<total/2; i++) for (let j=0; j<N && removed<total/2; j++) {
    if (copy[i][j] === 1) { copy[i][j] = 0; removed++; }
  }
  return api.getValidMoves(copy, 1).length > 0;
}
function detectCornerMissing(blocked, N) {
  const bSet = new Set(blocked.map(c=>`${c.r},${c.c}`));
  const groups = [
    [[0,1],[1,0],[1,1]],
    [[0,N-2],[1,N-1],[1,N-2]],
    [[N-1,1],[N-2,0],[N-2,1]],
    [[N-1,N-2],[N-2,N-1],[N-2,N-2]]
  ];
  return groups.some(g => g.filter(([r,c])=>bSet.has(`${r},${c}`)).length >= 2);
}

// --- Position Weights via Regression ---
function basePositionWeights(N, initialBoard, api, deadline) {
  // 1. Compute feature vectors
  const features = [];
  for (let r=0; r<N; r++) for (let c=0; c<N; c++) {
    const isCorner = ((r===0||r===N-1)&&(c===0||c===N-1))?1:0;
    const isEdge = (r===0||r===N-1||c===0||c===N-1)?1:0;
    const blockedNeighbours = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]
      .reduce((s,[dr,dc])=>{const rr=r+dr,cc=c+dc;return s+(rr>=0&&rr<N&&cc>=0&&cc<N&&initialBoard[rr][cc]===3?1:0)},0);
    features.push({r,c,vec:[isCorner,isEdge,blockedNeighbours]});
  }
  // 2. Collect data
  const X=[], y=[];
  for (let k=0; k<CONFIG.randomSimulations; k++) {
    if (performance.now()>deadline) break;
    let b=initialBoard.map(r=>[...r]), p=1;
    for (let t=0; t<CONFIG.shortRolloutLength; t++) {
      const mvs=api.getValidMoves(b,p);
      if (!mvs.length) break;
      const mv=mvs[Math.floor(Math.random()*mvs.length)];
      b=api.simulateMove(b,p,mv.row,mv.col).resultingBoard;
      p=3-p;
    }
    const score = api.evaluateBoard(b,1).totalScore;
    for (const f of features) { X.push(f.vec); y.push(score); }
  }
  // 3. Linear regression
  const w=[0,0,0], m=X.length;
  for (let it=0; it<CONFIG.regressionIterations; it++) {
    const grad=[0,0,0];
    for (let i=0; i<m; i++) {
      const [a,b,c]=X[i]; const err=(w[0]*a+w[1]*b+w[2]*c)-y[i];
      grad[0]+=err*a; grad[1]+=err*b; grad[2]+=err*c;
    }
    for (let j=0; j<3; j++) w[j]-=CONFIG.regressionLearningRate*(grad[j]/m);
  }
  // 4. Construct matrix
  const weights=Array.from({length:N},()=>Array(N).fill(0));
  for (const f of features) {
    const [a,b,c]=f.vec; weights[f.r][f.c]=w[0]*a+w[1]*b+w[2]*c;
  }
  return weights;
}

// --- Strategy Helpers: isStable, MCTS, IDDFS/α–β, etc. ---
// (unchanged from previous full implementation)

function isStable(board,r,c,player){const N=board.length,opp=3-player;const dirs=[[1,0],[-1,0],[0,1],[0,-1]];function ok([dx,dy]){let x=r+dx,y=c+dy;while(x>=0&&x<N&&y>=0&&y<N){if(board[x][y]===0||board[x][y]===opp)return false; if(board[x][y]===3)return true; x+=dx;y+=dy;}return true;}return ok(dirs[0])&&ok(dirs[1])||ok(dirs[2])&&ok(dirs[3]);}

// ... include mctsSearch, iddfsAlphaBeta, alphaBeta, defaultPolicy, backup, MCTSNode, expand, bestUCT, treePolicy ...

function boardToKey(board){return board.flat().join(',');}
