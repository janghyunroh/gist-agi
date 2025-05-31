function analyzeStage(stageName, boardSize, boardMatrix, initialValidMoves) {
    const BLOCKED = 3;
    const dirs8 = [
      [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]
    ];
  
    // 1) Positional Weight Matrix 계산
    const weights = Array.from({ length: boardSize }, () => Array(boardSize).fill(0));
    for (let i = 0; i < boardSize; i++) {
      for (let j = 0; j < boardSize; j++) {
        if (boardMatrix[i][j] === BLOCKED) continue;
        const top    = i === 0 || boardMatrix[i-1]?.[j] === BLOCKED;
        const bottom = i === boardSize-1 || boardMatrix[i+1]?.[j] === BLOCKED;
        const left   = j === 0 || boardMatrix[i]?.[j-1] === BLOCKED;
        const right  = j === boardSize-1 || boardMatrix[i]?.[j+1] === BLOCKED;
        if ((top && left) || (top && right) || (bottom && left) || (bottom && right)) {
          weights[i][j] = 100;
        } else if (top || bottom || left || right) {
          weights[i][j] = 20;
        }
      }
    }
    // X-square penalty
    [[0,0],[0,boardSize-1],[boardSize-1,0],[boardSize-1,boardSize-1]].forEach(([ci,cj]) => {
      if (boardMatrix[ci][cj] === 0) {
        [[ci+1,cj+1],[ci+1,cj-1],[ci-1,cj+1],[ci-1,cj-1]].forEach(([xi,xj]) => {
          if (
            xi >= 0 && xi < boardSize &&
            xj >= 0 && xj < boardSize &&
            boardMatrix[xi][xj] === 0
          ) weights[xi][xj] -= 50;
        });
      }
    });
  
    // studentStrategy: 자체적으로 모든 helper와 평가 함수를 포함
    function studentStrategy(board, player, validMoves, makeMove) {
      const opponent = player === 1 ? 2 : 1;
      const simulations = 800;
      const C = Math.sqrt(2);
  
      // --- Helper Functions ---
      function frontierEmptyCells(b) {
        let cnt = 0;
        for (let i = 0; i < b.length; i++) {
          for (let j = 0; j < b.length; j++) {
            if (b[i][j] !== 0) continue;
            for (const [dx,dy] of dirs8) {
              const x = i+dx, y = j+dy;
              if (x>=0&&x<b.length&&y>=0&&y<b.length&&(b[x][y]===1||b[x][y]===2)) {
                cnt++; break;
              }
            }
          }
        }
        return cnt;
      }
  
      function getValidMoves(bd, pl) {
        const opp = pl === 1 ? 2 : 1;
        const moves = [];
        for (let i = 0; i < bd.length; i++) {
          for (let j = 0; j < bd.length; j++) {
            if (bd[i][j] !== 0) continue;
            for (const [dx,dy] of dirs8) {
              let x = i+dx, y = j+dy, seen = false;
              while (x>=0&&x<bd.length&&y>=0&&y<bd.length && bd[x][y]===opp) {
                seen = true; x+=dx; y+=dy;
              }
              if (seen && x>=0&&x<bd.length&&y>=0&&y<bd.length && bd[x][y]===pl) {
                moves.push({row:i,col:j}); break;
              }
            }
          }
        }
        return moves;
      }
  
      function simulateMove(bd, pl, r, c) {
        const opp = pl === 1 ? 2 : 1;
        const nb = bd.map(rw=>rw.slice());
        nb[r][c] = pl;
        for (const [dx,dy] of dirs8) {
          let x = r+dx, y = c+dy, flips = [];
          while (x>=0&&x<bd.length&&y>=0&&y<bd.length && nb[x][y]===opp) {
            flips.push([x,y]); x+=dx; y+=dy;
          }
          if (x>=0&&x<bd.length&&y>=0&&y<bd.length && nb[x][y]===pl) {
            flips.forEach(([fx,fy])=>nb[fx][fy]=pl);
          }
        }
        return nb;
      }
  
      function countDiscs(bd) {
        return bd.reduce((a,row)=>{
          row.forEach(v => { if (v===1) a.black++; else if (v===2) a.white++; });
          return a;
        }, {black:0, white:0});
      }
  
      function evaluateBoard(bd, rootPlayer) {
        const opp = rootPlayer === 1 ? 2 : 1;
        // 1) Mobility
        const m = getValidMoves(bd, rootPlayer).length - getValidMoves(bd, opp).length;
        // 2) Frontier
        const f = - frontierEmptyCells(bd);
        // 3) Parity
        const {black,white} = countDiscs(bd);
        const my = rootPlayer===1?black:white, yo = rootPlayer===1?white:black;
        const p = my - yo;
        // 4) Positional
        let pos = 0;
        for (let i=0;i<bd.length;i++) for (let j=0;j<bd.length;j++) {
          if (bd[i][j]=== rootPlayer) pos += weights[i][j];
          else if (bd[i][j]=== opp) pos -= weights[i][j];
        }
        return m + f + p + pos;
      }
  
      // --- MCTS 노드 정의 ---
      class Node {
        constructor(bd, pl, mv=null, parent=null) {
          this.board = bd; this.player = pl;
          this.move = mv; this.parent = parent;
          this.children = [];
          this.visits = 0; this.wins = 0;
        }
        untriedMoves() {
          const all = getValidMoves(this.board, this.player);
          const tried = new Set(this.children.map(c=>`${c.move.row},${c.move.col}`));
          return all.filter(m => !tried.has(`${m.row},${m.col}`));
        }
        isFullyExpanded() {
          return this.untriedMoves().length === 0;
        }
        bestChild() {
          return this.children.reduce((best, c) => {
            const u = (c.wins/c.visits) + C * Math.sqrt(Math.log(this.visits)/c.visits);
            return u > best.score ? {node:c, score:u} : best;
          }, {node:null, score:-Infinity}).node;
        }
      }
  
      // --- Rollout(시뮬레이션) ---
      function rollout(bd, curPl) {
        let b = bd.map(r=>r.slice()), p = curPl;
        const depthLimit = 10;
        for (let d=0; d<depthLimit; d++) {
          const moves = getValidMoves(b, p);
          if (!moves.length) {
            const opp2 = p===1?2:1;
            if (!getValidMoves(b, opp2).length) break;
            p = opp2; continue;
          }
          // RootPlayer 입장에선 maximize, 상대턴에선 minimize
          let pick = moves[0];
          pick = moves.reduce((best,m) => {
            const nb = simulateMove(b, p, m.row, m.col);
            const score = evaluateBoard(nb, player);
            const bestNb = simulateMove(b, p, best.row, best.col);
            const bestScore = evaluateBoard(bestNb, player);
            if ( (p===player && score>bestScore) ||
                 (p!==player && score<bestScore) ) return m;
            return best;
          }, pick);
          b = simulateMove(b, p, pick.row, pick.col);
          p = p===1?2:1;
        }
        return evaluateBoard(b, player) > 0 ? 1 : 0;
      }
  
      // --- MCTS Main Loop ---
      const root = new Node(board, player);
      for (let i=0; i<simulations; i++) {
        // Selection
        let node = root;
        while (node.isFullyExpanded() && node.children.length) {
          node = node.bestChild();
        }
        // Expansion
        const um = node.untriedMoves();
        if (um.length) {
          const m = um[Math.floor(Math.random()*um.length)];
          const nb = simulateMove(node.board, node.player, m.row, m.col);
          const child = new Node(nb, node.player===1?2:1, m, node);
          node.children.push(child);
          node = child;
        }
        // Simulation
        const reward = rollout(node.board, node.player);
        // Backpropagation
        let cur=node, r=reward;
        while (cur) {
          cur.visits++;
          cur.wins += r;
          r = 1 - r;
          cur = cur.parent;
        }
      }
  
      // 가장 많이 방문된 자식 선택
      const best = root.children.reduce((a,b)=> a.visits>b.visits? a:b );
      return makeMove(best.move.row, best.move.col);
    }
  
    return studentStrategy;
  }


  return analyzeStage;