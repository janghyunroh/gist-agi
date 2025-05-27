/*
 * Othello Intelligent System
 * Updated: Generate PV for both players and reference each player's PV correctly
 * Hybrid PV + MCTS + α–β Fallback with unified time accounting
 */

const CONFIG = {
  randomSimulations: 200,
  pvDepthStart: 6,
  pvLimitMoves: 2,
  mctsThresholdBF: 3,
  maxMoveTime: 200,       // ms cap per move
  gameTimeLimit: 10000    // total ms per game
};

function analyzeStage(stageConfig, initialBoard, validMoves, api) {
  const N = stageConfig.boardSize;

  // Rule probing and flags
  const flags = probeRules(stageConfig, initialBoard, api);
  // Positional weights
  const W = basePositionWeights(N, flags, stageConfig.initialBlocked);

  // Analysis phase: generate PV for both Black(1) and White(2)
  const startAnalysis = performance.now();
  const deadlineAnalysis = startAnalysis + 60000;

  // Initial valid moves per player
  const initMoves = {
    1: validMoves,
    2: api.getValidMoves(initialBoard, 2)
  };

  // Generate full PV sequences
  const pvMap = {1: [], 2: []};
  for (const player of [1, 2]) {
    const fullPV = fullTimePVSearch(
      initialBoard, player, initMoves[player], api, W, deadlineAnalysis
    );
    pvMap[player] = extractMyPV(fullPV, player).slice(0, CONFIG.pvLimitMoves);
  }

  // TT for α–β
  const tt = new Map();
  function ttGet(key, depth) {
    const e = tt.get(key);
    return e && e.depth >= depth ? e.score : null;
  }
  function ttSet(key, score, depth) {
    tt.set(key, { score, depth });
  }

  // Game-time trackers
  let timeUsed = 0;
  const pvIndexMap = {1: 0, 2: 0};

  return function strategy(board, player, validMoves, makeMove) {
    if (!validMoves.length) return null;
    const turnStart = performance.now();

    // Time budget
    const remainingTime = Math.max(CONFIG.gameTimeLimit - timeUsed, 0);
    const empties = board.flat().filter(c => c === 0).length;
    const budget = Math.min(CONFIG.maxMoveTime, remainingTime / Math.max(empties,1));
    const deadlineMove = turnStart + budget;

    // PV move if available for this player
    const pvList = pvMap[player] || [];
    const idx = pvIndexMap[player];
    if (idx < pvList.length) {
      const cand = pvList[idx];
      pvIndexMap[player]++;
      // validate
      if (validMoves.some(m => m.row === cand.row && m.col === cand.col)) {
        timeUsed += performance.now() - turnStart;
        return cand;
      }
    }

    // Search fallback
    let bestMove = null;
    if (validMoves.length <= CONFIG.mctsThresholdBF) {
      bestMove = iddfsAlphaBeta(
        board, player, validMoves, api, W, tt,
        CONFIG.pvDepthStart, deadlineMove
      );
    } else {
      bestMove = mctsSearch(board, player, validMoves, api, W, deadlineMove);
    }

    timeUsed += performance.now() - turnStart;
    return bestMove || validMoves[0];
  };
}

// --- Rule Probing ---
function probeRules(stageConfig, board, api) {
  const flags = { allowOnBlocked: false, fewerContinue: false };
  (stageConfig.initialBlocked || []).some(b => {
    if (api.simulateMove(board, 1, b.r, b.c).valid) {
      flags.allowOnBlocked = true;
      return true;
    }
  });
  const test = board.map(r => [...r]);
  let removed = 0;
  for (let i = 0; i < test.length && removed < test.length*test.length -1; i++) {
    for (let j = 0; j < test.length && removed < test.length*test.length -1; j++) {
      if (test[i][j] === 1) { test[i][j] = 0; removed++; }
    }
  }
  flags.fewerContinue = api.getValidMoves(test, 1).length > 0;
  return flags;
}

// --- Static Weights ---
function basePositionWeights(N, flags, blocked) {
  const W = Array.from({length:N},(_,i) =>
    Array.from({length:N},(_,j) => {
      if ((i===0||i===N-1)&&(j===0||j===N-1)) return 120;
      if (i===0||i===N-1||j===0||j===N-1) return 20;
      return 5;
    })
  );
  if (!flags.allowOnBlocked) {
    (blocked||[]).forEach(b => {
      if (b.r>=0&&b.r<N&&b.c>=0&&b.c<N) W[b.r][b.c] = -Infinity;
    });
  }
  return W;
}

// --- Full-Time PV Search ---
function fullTimePVSearch(board, player, validMoves, api, weights, deadline) {
  let bestPV = [];
  let depth = CONFIG.pvDepthStart;
  const ttPV = new Map();
  while (performance.now() < deadline) {
    const res = alphaBetaPV(board, player, depth, -Infinity, Infinity, api, weights, ttPV, deadline);
    if (res.pv.length > bestPV.length) bestPV = res.pv.slice();
    depth++;
  }
  return bestPV;
}

// --- PV Alpha-Beta ---
function alphaBetaPV(board, player, depth, alpha, beta, api, weights, ttPV, deadline) {
  if (performance.now() >= deadline) return {score:0,pv:[]};
  const key = boardToKey(board)+'|'+player+'|'+depth;
  if (ttPV.has(key)) return ttPV.get(key);
  const moves = api.getValidMoves(board, player);
  if (!moves.length||depth===0) {
    const ev = api.evaluateBoard(board, player).totalScore;
    const se = staticEval(board, weights, player);
    return {score:ev+se,pv:[]};
  }
  let bestScore = player===1?-Infinity:Infinity;
  let bestPV = [];
  for (const mv of moves) {
    if (performance.now()>=deadline) break;
    const r = api.simulateMove(board,player,mv.row,mv.col);
    if (!r.valid) continue;
    const child = alphaBetaPV(r.resultingBoard,3-player,depth-1,alpha,beta,api,weights,ttPV,deadline);
    if ((player===1&&child.score>bestScore)||(player===2&&child.score<bestScore)) {
      bestScore = child.score;
      bestPV = [mv,...child.pv];
    }
    alpha = player===1?Math.max(alpha,child.score):alpha;
    beta = player===2?Math.min(beta,child.score):beta;
    if (beta<=alpha) break;
  }
  const out={score:bestScore,pv:bestPV}; ttPV.set(key,out); return out;
}

// --- IDDFS + Alpha-Beta with TT ---
function iddfsAlphaBeta(board, player, validMoves, api, weights, tt, initDepth, deadline) {
  let bestMove = validMoves[0];
  let depth = initDepth;
  while (performance.now()<deadline) {
    const res = alphaBeta(board,player,depth,-Infinity,Infinity,api,weights,tt,deadline);
    if (res.move) bestMove = res.move;
    depth++;
  }
  return bestMove;
}

// --- Alpha-Beta with TT ---
function alphaBeta(board, player, depth, alpha, beta, api, weights, tt, deadline) {
  if (performance.now()>=deadline) return {score:0,move:null};
  const key = boardToKey(board)+'|'+player;
  const cached = ttGet(key,depth);
  if (cached!==null) return {score:cached,move:null};
  const moves = api.getValidMoves(board,player);
  if (!moves.length||depth===0) {
    const ev = api.evaluateBoard(board,player).totalScore;
    const se = staticEval(board,weights,player);
    return {score:ev+se,move:null};
  }
  let bestMove=null; let bestScore = player===1?-Infinity:Infinity;
  for (const mv of moves) {
    if (performance.now()>=deadline) break;
    const r = api.simulateMove(board,player,mv.row,mv.col);
    if (!r.valid) continue;
    const child = alphaBeta(r.resultingBoard,3-player,depth-1,alpha,beta,api,weights,tt,deadline);
    if ((player===1&&child.score>bestScore)||(player===2&&child.score<bestScore)) {
      bestScore = child.score;
      bestMove = mv;
    }
    alpha = player===1?Math.max(alpha,child.score):alpha;
    beta = player===2?Math.min(beta,child.score):beta;
    if (beta<=alpha) break;
  }
  ttSet(key,bestScore,depth);
  return {score:bestScore,move:bestMove};
}

// --- MCTS Functions ---
function defaultPolicy(node, api) {
  let b=node.board.map(r=>[...r]); let p=node.player;
  for(let i=0;i<20;i++){const ms=api.getValidMoves(b,p); if(!ms.length) break; const mv=ms[Math.floor(Math.random()*ms.length)]; const rr=api.simulateMove(b,p,mv.row,mv.col); b=rr.resultingBoard; p=3-p;}
  return api.evaluateBoard(b,node.player).totalScore;
}
function backup(node,reward){while(node){node.visits++;node.wins+=reward;node=node.parent;}}
class MCTSNode{constructor(board,player,move=null,parent=null){this.board=board;this.player=player;this.move=move;this.parent=parent;this.children=[];this.visits=0;this.wins=0;}isLeaf(){return this.children.length===0;}}
function expand(node,api){const ms=api.getValidMoves(node.board,node.player);for(const mv of ms){const r=api.simulateMove(node.board,node.player,mv.row,mv.col);if(!r.valid) continue;node.children.push(new MCTSNode(r.resultingBoard,3-node.player,mv,node));}}
function bestUCT(node){const C=Math.sqrt(2);let best=null,bv=-Infinity;for(const c of node.children){const u=(c.wins/(c.visits+1))+C*Math.sqrt(Math.log(node.visits+1)/(c.visits+1));if(u>bv){bv=u;best=c;}}return best;}
function treePolicy(node,api){while(true){const ms=api.getValidMoves(node.board,node.player);if(!ms.length)return node; if(node.isLeaf()){expand(node,api);if(!node.children.length) return node;return node.children[0];}const nxt=bestUCT(node);if(!nxt)return node;node=nxt;}}
function mctsSearch(board,player,validMoves,api,weights,deadline){const root=new MCTSNode(board,player);while(performance.now()<deadline){const leaf=treePolicy(root,api);const reward=defaultPolicy(leaf,api);backup(leaf,reward);}let best=null,maxVisits=-1;for(const c of root.children) if(c.visits>maxVisits){maxVisits=c.visits;best=c;}return best?best.move:validMoves[0];}

// --- Utilities ---
function staticEval(board,weights,player){let score=0;const opp=3-player;for(let i=0;i<board.length;i++){for(let j=0;j<board.length;j++){if(board[i][j]===player)score+=weights[i][j];else if(board[i][j]===opp)score-=weights[i][j];}}return score;}
function extractMyPV(fullPV,player){const offset=player===1?0:1;return fullPV.filter((_,i)=>i%2===offset);} 
function boardToKey(board){return board.flat().join(',');}

// Export for loader
if(typeof module!=='undefined')module.exports={analyzeStage};
