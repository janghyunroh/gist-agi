// othello_ai_system.js
// Enhanced Intelligent System for Othello AI Arena

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
  
    // 4) Transposition table
    const tt = new Map();
  
    // 5) Decide base search parameters
    const searchParams = {
      maxDepth: determineDepth(stageConfig, flags),
      maxMoveTime: 500,    // base ms per move
      totalTimeLimit: 10000 // total 10s
    };
  
    // Strategy function closure variables
    return function strategy(board, player, validMoves) {
      const moveStart = performance.now();
      const remainingTotalTime = searchParams.totalTimeLimit - totalTimeSpent;
  
      // Dynamic time allocation based on empty cells
      const emptyCount = board.flat().filter(v => v === 0).length;
      const alloc = remainingTotalTime / Math.max(emptyCount, 1);
      const timeLimit = Math.min(alloc, searchParams.maxMoveTime);
      const deadline = moveStart + timeLimit;
  
      // Early exit if no moves
      if (validMoves.length === 0) return null;
  
      // Opening book lookup
      const key = boardToKey(board) + '|' + player;
      if (openingBook[key]) {
        totalTimeSpent += performance.now() - moveStart;
        return openingBook[key];
      }
  
      // Move ordering by static weights
      validMoves.sort((a, b) => weights[b.row][b.col] - weights[a.row][a.col]);
  
      // Iterative deepening alpha-beta search
      const bestMove = iddfsAlphaBeta(
        board, player, validMoves, api,
        weights, tt, searchParams.maxDepth, deadline
      );
  
      totalTimeSpent += performance.now() - moveStart;
      return bestMove;
    };
  }
  
  // Probe hidden rules by lightweight simulation
  function probeRules(stageConfig, board, api) {
    const flags = { allowOnBlocked: false, fewerPiecesContinue: false };
    // blocked cell rule
    for (const c of (stageConfig.initialBlocked || [])) {
      if (api.simulateMove(board, 1, c.r, c.c).valid) {
        flags.allowOnBlocked = true;
        break;
      }
    }
    // fewerPiecesContinue rule
    const testBoard = board.map(r => [...r]);
    let removed = 0;
    for (let i=0;i<testBoard.length&&removed<testBoard.length*testBoard.length-1;i++){
      for(let j=0;j<testBoard.length&&removed<testBoard.length*testBoard.length-1;j++){
        if(testBoard[i][j]===1){testBoard[i][j]=0;removed++;}
      }
    }
    flags.fewerPiecesContinue = api.getValidMoves(testBoard,1).length>0;
    return flags;
  }
  
  // Generate static weights matrix
  function generateStaticStaticEval(board, weights, player) {
    const N = board.length;
    let eval = 0;
    const opp = 3 - player;
    for (let i=0;i<N;i++){
      for(let j=0;j<N;j++){
        if(board[i][j]===player) eval += weights[i][j];
        else if(board[i][j]===opp) eval -= weights[i][j];
      }
    }
    return eval;
  }
  
  function generateStaticWeights(stageConfig, board, flags) {
    const N = stageConfig.boardSize;
    const W = Array.from({length:N},(_,i)=>Array.from({length:N},(_,j)=>{
      if ((i===0||i===N-1)&&(j===0||j===N-1)) return 120;
      else if (i===0||i===N-1||j===0||j===N-1) return 20;
      else return 5;
    }));
    if (flags.allowOnBlocked) {
      for (const c of (stageConfig.initialBlocked||[])){
        for (let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++){
          const r=c.r+di, cc=c.c+dj;
          if(r>=0&&r<N&&cc>=0&&cc<N)W[r][cc]+=10;
        }
      }
    }
    return W;
  }
  
  // Build opening book caching best move per position
  function buildOpeningBook(board, validMoves, api, weights, flags) {
    const book = {};
    const key = boardToKey(board) + '|' + 1;
    let bestScore = -Infinity, bestMove = null;
    for (const mv of validMoves) {
      const res = api.simulateMove(board, 1, mv.row, mv.col);
      if (!res.valid) continue;
      const evalObj = api.evaluateBoard(res.resultingBoard,1);
      const staticEval = generateStaticStaticEval(res.resultingBoard, weights,1);
      const score = evalObj.totalScore + staticEval;
      if (score > bestScore) { bestScore=score; bestMove=mv; }
    }
    if(bestMove) book[key] = bestMove;
    return book;
  }
  
  // Decide search depth
  function determineDepth(stageConfig, flags) {
    const base = stageConfig.boardSize>=8?6:5;
    return flags.allowOnBlocked?base-1:base;
  }
  
  // Serialize board to key
  function boardToKey(board) {
    return board.flat().join(',');
  }
  
  // Iterative Deepening DFS with alpha-beta
  function iddfsAlphaBeta(board,player,validMoves,api,weights,tt,maxDepth,deadline) {
    let bestMove = validMoves[0];
    for (let depth=1;depth<=maxDepth;depth++){
      if (performance.now()>=deadline) break;
      const res = alphaBeta(board,player,depth,-Infinity,Infinity,api,weights,tt,deadline);
      if(res.move) bestMove=res.move;
    }
    return bestMove;
  }
  
  // Alpha-beta search
  function alphaBeta(board,player,depth,alpha,beta,api,weights,tt,deadline) {
    if (performance.now()>=deadline) return {score:0,move:null};
    const key = boardToKey(board) + '|' + player;
    if (tt.has(key)) return tt.get(key);
    const valid = api.getValidMoves(board,player);
    if(depth===0||valid.length===0){
      const e = api.evaluateBoard(board,player).totalScore;
      const se = generateStaticStaticEval(board,weights,player);
      return {score:e+se,move:null};
    }
    let bestMove=null;
    let bestScore = player===1? -Infinity: Infinity;
    for(const mv of valid){
      const res = api.simulateMove(board,player,mv.row,mv.col);
      if(!res.valid) continue;
      const child = alphaBeta(res.resultingBoard,3-player,depth-1,alpha,beta,api,weights,tt,deadline);
      const sc = child.score;
      if(player===1){ if(sc>bestScore){bestScore=sc;bestMove=mv;} alpha=Math.max(alpha,sc);} 
      else      { if(sc<bestScore){bestScore=sc;bestMove=mv;} beta =Math.min(beta, sc);} 
      if(beta<=alpha) break;
    }
    const out={score:bestScore,move:bestMove};
    tt.set(key,out);
    return out;
  }
  