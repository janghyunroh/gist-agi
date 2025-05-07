// intelligent-system.js

const intelligentSystem = (function() {
    // --- 상수 & 헬퍼 ---
    const BOARD_SIZE = 8;
    const EMPTY = 0, BLACK = 1, WHITE = 2;
    const dirs8 = [
      [-1,-1],[-1,0],[-1,1],
      [0,-1],        [0,1],
      [1,-1],[1,0],[1,1],
    ];
  
    function cloneBoard(board) {
      return board.map(r=>r.slice());
    }
    function inBounds(r,c) {
      return r>=0 && r<BOARD_SIZE && c>=0 && c<BOARD_SIZE;
    }
    function countDiscs(board) {
      let tot=0, byColor={0:0,1:0,2:0};
      board.forEach(r=>r.forEach(c=>{ if(c!==EMPTY){ tot++; byColor[c]++; }}));
      return { total: tot, byColor };
    }
  
    // 돌 뒤집기 판정
    function getFlips(board, player, r, c) {
      if (board[r][c]!==EMPTY) return [];
      const opp=3-player, flips=[];
      for (let [dr,dc] of dirs8) {
        let rr=r+dr, cc=c+dc, line=[];
        while(inBounds(rr,cc) && board[rr][cc]===opp){
          line.push([rr,cc]);
          rr+=dr; cc+=dc;
        }
        if(line.length>0 && inBounds(rr,cc) && board[rr][cc]===player){
          flips.push(...line);
        }
      }
      return flips;
    }
    function getValidMoves(board, player){
      const moves=[];
      for(let r=0;r<BOARD_SIZE;r++)for(let c=0;c<BOARD_SIZE;c++){
        if(getFlips(board,player,r,c).length>0) moves.push({row:r,col:c});
      }
      return moves;
    }
    function applyMove(board, player, move){
      const flips=getFlips(board,player,move.row,move.col);
      if(!flips.length) return false;
      board[move.row][move.col]=player;
      flips.forEach(([r,c])=>board[r][c]=player);
      return true;
    }
  
    // --- 보드 피처 분석 ---
    function isStable(board,r,c){
      if(board[r][c]===EMPTY) return false;
      const p=board[r][c];
      for(let [dr,dc] of dirs8){
        let rr=r, cc=c;
        while(inBounds(rr+dr,cc+dc) && board[rr+dr][cc+dc]===p){
          rr+=dr; cc+=dc;
        }
        if(inBounds(rr+dr,cc+dc) && board[rr+dr][cc+dc]!==p){
          return false;
        }
      }
      return true;
    }
  
    function analyzeBoard(board, player) {
      const opp = 3-player;
      const valid = getValidMoves(board,player).length;
      const oppValid = getValidMoves(board,opp).length;
      // 코너
      const corners = [
        board[0][0], board[0][7],
        board[7][0], board[7][7]
      ];
      const myCorners = corners.filter(x=>x===player).length;
      const oppCorners = corners.filter(x=>x===opp).length;
      // 에지
      let myEdges=0, oppEdges=0;
      for(let i=1;i<7;i++){
        [[0,i],[7,i],[i,0],[i,7]].forEach(([r,c])=>{
          if(board[r][c]===player) myEdges++;
          if(board[r][c]===opp) oppEdges++;
        });
      }
      // 안정된 돌
      let myStable=0, oppStable=0;
      for(let r=0;r<8;r++)for(let c=0;c<8;c++){
        if(board[r][c]===player && isStable(board,r,c)) myStable++;
        if(board[r][c]===opp && isStable(board,r,c)) oppStable++;
      }
      const discCounts = countDiscs(board).byColor;
      return {
        mobility: valid,
        oppMobility: oppValid,
        cornerControl: myCorners - oppCorners,
        edgeControl: myEdges - oppEdges,
        stability: myStable - oppStable,
        discDiff: discCounts[player] - discCounts[opp]
      };
    }
  
    // --- 게임 단계 분석 함수 (새로 추가) ---
    function analyzeStage(board) {
      const tot = countDiscs(board).total;
      if (tot < 20)      return 'opening';
      else if (tot < 58) return 'midgame';
      else               return 'endgame';
    }
  
    // --- 단계별 가중치 ---
    const stageWeights = {
      opening: {
        mobility: 4.0, oppMobility: -4.0,
        cornerControl: 30.0, edgeControl: 5.0,
        stability: 8.0, discDiff: 0.5
      },
      midgame: {
        mobility: 2.0, oppMobility: -2.0,
        cornerControl: 25.0, edgeControl: 5.0,
        stability: 10.0, discDiff: 1.0
      },
      endgame: {
        mobility: 1.0, oppMobility: -1.0,
        cornerControl: 20.0, edgeControl: 2.0,
        stability: 5.0, discDiff: 2.0
      }
    };
  
    // --- 평가 함수: analyzeStage 결과로 동적 가중합 ---
    function evaluateNode(state) {
      const { board, player } = state;
      const feats = analyzeBoard(board, player);
      const stage = analyzeStage(board);
      const w = stageWeights[stage];
      let score = 0;
      for (let k in feats) {
        score += (feats[k] || 0) * (w[k] || 0);
      }
      return score;
    }
  
    // --- MCTS 구현 ---
    class MCTSNode {
      constructor(state, parent=null, move=null) {
        this.state = state;
        this.parent = parent;
        this.move = move;
        this.children = [];
        this.visits = 0;
        this.value = 0;
        this.untriedMoves = getValidMoves(state.board, state.player);
      }
    }
    function uct(child) {
      return (child.value/ (child.visits||1)) +
             Math.sqrt(2 * Math.log((child.parent.visits||1)) / (child.visits||1));
    }
    function runMCTS(rootState, timeLimitMs) {
      const end = Date.now() + timeLimitMs;
      const root = new MCTSNode(rootState);
      while (Date.now() < end) {
        // selection
        let node = root;
        while (node.untriedMoves.length === 0 && node.children.length>0) {
          node = node.children.reduce((a,b)=> uct(a)>uct(b)?a:b);
        }
        // expansion
        if (node.untriedMoves.length>0) {
          const mv = node.untriedMoves.splice(
            Math.floor(Math.random()*node.untriedMoves.length),1
          )[0];
          const nb = cloneBoard(node.state.board);
          applyMove(nb, node.state.player, mv);
          const nextPl = getValidMoves(nb, 3-node.state.player).length>0
                       ? 3-node.state.player
                       : node.state.player;
          const child = new MCTSNode({board:nb, player:nextPl}, node, mv);
          node.children.push(child);
          node = child;
        }
        // simulation
        let sim = { board: cloneBoard(node.state.board), player: node.state.player };
        while (true) {
          const moves = getValidMoves(sim.board, sim.player);
          if (moves.length===0) {
            sim.player = 3 - sim.player;
            if (getValidMoves(sim.board, sim.player).length===0) break;
            continue;
          }
          const mv = moves[Math.floor(Math.random()*moves.length)];
          applyMove(sim.board, sim.player, mv);
          sim.player = 3 - sim.player;
        }
        const cnt = countDiscs(sim.board).byColor;
        const winner = cnt[BLACK]===cnt[WHITE]
                       ? 0
                       : (cnt[BLACK]>cnt[WHITE]?BLACK:WHITE);
        let reward = (winner===0?0:(winner===rootState.player?1:-1));
        // leaf 평가
        if (node.visits===0) reward += evaluateNode(node.state);
  
        // backprop
        while (node) {
          node.visits++;
          node.value += reward;
          node = node.parent;
        }
      }
      // best move
      const best = root.children.reduce((a,b)=> a.visits>b.visits?a:b);
      return best.move;
    }
  
    // --- 전략 함수 ---
    function studentStrategy(board, player, timeLimitMs) {
      const mv = runMCTS({board:cloneBoard(board), player}, timeLimitMs);
      return mv || {row:null, col:null};
    }
  
    // 반드시 맨 끝에!
    return studentStrategy;
  })();
  
  // 외부 사용 예:
  // const strategy = intelligentSystem;
  // const move = strategy(currentBoard, currentPlayer, 1000);
  