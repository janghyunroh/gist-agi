/**
 * analyzeStage: 주어진 스테이지(보드 설정)에서 최적 전략 함수를 생성하여 반환합니다.
 * @param {string} stageName       - 스테이지 이름 또는 식별자
 * @param {number} boardSize       - 보드 크기 (NxN)
 * @param {number[][]} boardMatrix - 초기 보드 상태 (0=EMPTY, 1=BLACK, 2=WHITE, 3=BLOCKED)
 * @param {Array} initialValidMoves- (옵션) 초기 validMoves
 * @returns {Function} studentStrategy
 */
function analyzeStage(stageName, boardSize, boardMatrix, initialValidMoves) {
    const BLOCKED = 3; // 막힌 칸을 나타내는 상수
  
    // --- 1) Positional Weight Matrix 계산 (코너, 엣지, X-square) ---
    const weights = Array.from({ length: boardSize }, () =>
      Array(boardSize).fill(0)
    );
    const dirs8 = [
      [-1, 0], [1, 0], [0, -1], [0, 1],
      [-1, -1], [-1, 1], [1, -1], [1, 1]
    ];
    for (let i = 0; i < boardSize; i++) {
      for (let j = 0; j < boardSize; j++) {
        if (boardMatrix[i][j] === BLOCKED) continue;
        const top    = i === 0 ||
                       boardMatrix[i-1]?.[j] === BLOCKED;
        const bottom = i === boardSize-1 ||
                       boardMatrix[i+1]?.[j] === BLOCKED;
        const left   = j === 0 ||
                       boardMatrix[i]?.[j-1] === BLOCKED;
        const right  = j === boardSize-1 ||
                       boardMatrix[i]?.[j+1] === BLOCKED;
        // Corner
        if ((top && left) || (top && right) || (bottom && left) || (bottom && right)) {
          weights[i][j] = 100;
        }
        // Edge
        else if (top || bottom || left || right) {
          weights[i][j] = 20;
        }
      }
    }
    // X-square penalty
    [[0,0],[0,boardSize-1],[boardSize-1,0],[boardSize-1,boardSize-1]]
      .forEach(([ci,cj]) => {
        if (boardMatrix[ci]?.[cj] === 0) {
          [[ci+1,cj+1],[ci+1,cj-1],[ci-1,cj+1],[ci-1,cj-1]]
            .forEach(([xi,xj]) => {
              if (
                xi >= 0 && xi < boardSize &&
                xj >= 0 && xj < boardSize &&
                boardMatrix[xi][xj] === 0
              ) {
                weights[xi][xj] -= 50;
              }
            });
        }
      });
  
    /**
     * studentStrategy: 매 턴 MCTS + 4단계 평가 함수로 최적 수를 선택
     * @param {number[][]} board       - 현재 보드 상태
     * @param {number} player          - 현재 플레이어 (1=BLACK, 2=WHITE)
     * @param {Array<{row:number,col:number}>} validMoves - 가능한 수 목록
     * @param {Function} makeMove      - 수를 실행하는 콜백: makeMove(r, c)
     */
    function studentStrategy(board, player, validMoves, makeMove) {
      const opponent = player === 1 ? 2 : 1;
      const simulations = 800;           // 시뮬레이션 횟수 제한
      const C = Math.sqrt(2);            // UCB1 상수
  
      // --- MCTS Node 정의 ---
      class Node {
        constructor(board, player, move = null, parent = null) {
          this.board    = board;
          this.player   = player;
          this.move     = move;
          this.parent   = parent;
          this.children = [];
          this.visits   = 0;
          this.wins     = 0;
        }
        // 확장되지 않은 수
        untriedMoves() {
          const all = countValidMoves(this.board, this.player);
          const tried = new Set(this.children.map(c => `${c.move.row},${c.move.col}`));
          return all.filter(m => !tried.has(`${m.row},${m.col}`));
        }
        isFullyExpanded() {
          return this.untriedMoves().length === 0;
        }
        // UCB1 기준 자식 선택
        bestChild() {
          return this.children.reduce((best, child) => {
            const ucb = (child.wins / child.visits) +
                        C * Math.sqrt(Math.log(this.visits) / child.visits);
            return ucb > best.score ? { node: child, score: ucb } : best;
          }, { node: null, score: -Infinity }).node;
        }
      }
  
      // --- Rollout Policy (adversarial / 양측 평가 함수 사용) ---
      function rollout(bd, curPlayer, rootPlayer) {
        let b = bd.map(row => row.slice());
        let p = curPlayer;
        const depthLimit = 10;
        for (let d = 0; d < depthLimit; d++) {
          const moves = countValidMoves(b, p);
          if (!moves.length) {
            const opp = p === 1 ? 2 : 1;
            if (!countValidMoves(b, opp).length) break;
            p = opp;
            continue;
          }
          let mv;
          if (p === rootPlayer) {
            mv = moves.reduce((best, m) => {
              const nb = simulateMove(b, p, m.row, m.col);
              return evaluateBoard(nb, rootPlayer, weights) >
                     evaluateBoard(simulateMove(b, p, best.row, best.col), rootPlayer, weights)
                     ? m : best;
            }, moves[0]);
          } else {
            mv = moves.reduce((worst, m) => {
              const nb = simulateMove(b, p, m.row, m.col);
              return evaluateBoard(nb, rootPlayer, weights) <
                     evaluateBoard(simulateMove(b, p, worst.row, worst.col), rootPlayer, weights)
                     ? m : worst;
            }, moves[0]);
          }
          b = simulateMove(b, p, mv.row, mv.col);
          p = p === 1 ? 2 : 1;
        }
        return evaluateBoard(b, rootPlayer, weights) > 0 ? 1 : 0;
      }
  
      // --- MCTS 메인 루프 ---
      const root = new Node(board, player);
      console.time("MCTS");
      for (let i = 0; i < simulations; i++) {
        // Selection
        let node = root;
        while (node.isFullyExpanded() && node.children.length) {
          node = node.bestChild();
        }
        // Expansion
        const untried = node.untriedMoves();
        if (untried.length) {
          const m = untried[Math.floor(Math.random() * untried.length)];
          const nb = simulateMove(node.board, node.player, m.row, m.col);
          const nextP = node.player === 1 ? 2 : 1;
          const child = new Node(nb, nextP, m, node);
          node.children.push(child);
          node = child;
        }
        // Simulation
        const reward = rollout(node.board, node.player, player);
        // Backpropagation
        let cur = node;
        let r = reward;
        while (cur) {
          cur.visits += 1;
          cur.wins   += r;
          r = 1 - r;
          cur = cur.parent;
        }
      }
      console.timeEnd("MCTS");
  
      // 최종 수 선택: 방문 횟수 기준
      const bestC = root.children.reduce((a, b) => a.visits > b.visits ? a : b);
      return makeMove(bestC.move.row, bestC.move.col);
    }
  
    return studentStrategy;
  }
  
  
  /**
   * evaluateBoard: 4단계 평가 함수
   *  1) Mobility Score
   *  2) Frontier Score
   *  3) Disc Parity Score
   *  4) Positional Score (코너 포함)
   */
  function evaluateBoard(board, player, weights) {
    const opponent = player === 1 ? 2 : 1;
    const N = board.length;
  
    // 1) Mobility
    const mob = countValidMoves(board, player).length
              - countValidMoves(board, opponent).length;
  
    // 2) Frontier (빈칸 중 돌 인접 개수)
    const frontier = - frontierEmptyCells(board);
  
    // 3) Disc Parity
    const { black, white } = countDiscs(board);
    const my  = player === 1 ? black : white;
    const opp = player === 1 ? white : black;
    const parity = my - opp;
  
    // 4) Positional
    let pos = 0;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (board[i][j] === player)      pos += weights[i][j];
        else if (board[i][j] === opponent) pos -= weights[i][j];
      }
    }
  
    return mob + frontier + parity + pos;
  }
  
  
  // --- Helper Functions ---
  
  /** frontierEmptyCells: 빈칸 중 돌(1,2)에 인접한 칸 개수 */
  function frontierEmptyCells(board) {
    const N = board.length;
    const dirs8 = [
      [-1,0],[1,0],[0,-1],[0,1],
      [-1,-1],[-1,1],[1,-1],[1,1]
    ];
    let cnt = 0;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (board[i][j] !== 0) continue;
        for (const [dx,dy] of dirs8) {
          const x = i + dx, y = j + dy;
          if (x>=0&&x<N&&y>=0&&y<N && (board[x][y] === 1 || board[x][y] === 2)) {
            cnt++;
            break;
          }
        }
      }
    }
    return cnt;
  }
  
  /** countValidMoves: 현재 보드와 플레이어에 대한 합법 수 목록 */
  function countValidMoves(board, player) {
    const opp = player === 1 ? 2 : 1;
    const N = board.length;
    const dirs8 = [
      [-1,0],[1,0],[0,-1],[0,1],
      [-1,-1],[-1,1],[1,-1],[1,1]
    ];
    const moves = [];
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (board[i][j] !== 0) continue;
        for (const [dx,dy] of dirs8) {
          let x = i + dx, y = j + dy, seen = false;
          while (x>=0&&x<N&&y>=0&&y<N && board[x][y] === opp) {
            seen = true; x += dx; y += dy;
          }
          if (seen && x>=0&&x<N&&y>=0&&y<N && board[x][y] === player) {
            moves.push({ row: i, col: j });
            break;
          }
        }
      }
    }
    return moves;
  }
  
  /** simulateMove: 돌을 놓고 뒤집기까지 적용한 새 보드 상태 반환 */
  function simulateMove(board, player, r, c) {
    const opp = player === 1 ? 2 : 1;
    const N = board.length;
    const newB = board.map(row => row.slice());
    newB[r][c] = player;
    const dirs8 = [
      [-1,0],[1,0],[0,-1],[0,1],
      [-1,-1],[-1,1],[1,-1],[1,1]
    ];
    for (const [dx,dy] of dirs8) {
      let x = r + dx, y = c + dy;
      const flips = [];
      while (x>=0&&x<N&&y>=0&&y<N && newB[x][y] === opp) {
        flips.push([x,y]); x += dx; y += dy;
      }
      if (x>=0&&x<N&&y>=0&&y<N && newB[x][y] === player) {
        flips.forEach(([fx,fy]) => newB[fx][fy] = player);
      }
    }
    return newB;
  }
  
  /** countDiscs: 보드상의 돌 개수 집계 */
  function countDiscs(board) {
    return board.reduce((acc,row) => {
      row.forEach(v => {
        if (v === 1) acc.black++;
        else if (v === 2) acc.white++;
      });
      return acc;
    }, { black: 0, white: 0 });
  }
  
  // --- 반드시 마지막에 analyzeStage 반환 ---
  return analyzeStage;
  