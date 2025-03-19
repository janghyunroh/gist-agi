function mctsStrategy(board, player, getValidMoves) {
    // 보드 깊은 복사 함수
    function cloneBoard(bd) {
      return bd.map(row => row.slice());
    }
    
    // 상대 플레이어 반환 함수
    function opponent(p) {
      return p === BLACK ? WHITE : BLACK;
    }
    
    // MCTS 트리 노드를 나타내는 클래스
    class Node {
      // root 노드에서는 extraValidMoves 인자를 통해 미리 계산한 validMoves를 전달할 수 있음.
      // 자식 노드에서는 전달하지 않으면, getValidMoves를 호출하여 계산하도록 할 수 있음.
      constructor(board, player, move = null, parent = null, extraValidMoves = null) {
        this.board = cloneBoard(board);
        this.player = player; // 이 노드에서 이동을 진행할 플레이어
        this.move = move;     // 부모 노드에서 이 노드로 온 이동 (없으면 null)
        this.parent = parent;
        this.children = [];
        this.visits = 0;
        this.wins = 0; // 루트 플레이어 관점에서의 누적 승리 보상
        // 만약 extraValidMoves가 제공되면, root 노드의 validMoves로 사용
        this.untriedMoves = extraValidMoves ? extraValidMoves.slice() : getValidMoves(player, this.board);
      }
    }
    
    // UCB1 값 계산 함수
    function ucb1(child, parentVisits) {
      return (child.wins / child.visits) + Math.sqrt(2 * Math.log(parentVisits) / child.visits);
    }
    
    // 현재 노드의 자식 중 UCB1 값이 가장 높은 노드를 선택
    function bestChild(node) {
      let bestScore = -Infinity;
      let best = null;
      for (const child of node.children) {
        const score = ucb1(child, node.visits);
        if (score > bestScore) {
          bestScore = score;
          best = child;
        }
      }
      return best;
    }
    
    // 시뮬레이션: 현재 보드 상태에서 무작위로 끝까지 플레이하여 루트 플레이어 관점의 보상 반환
    // 보상: 승리 → 1, 패배 → 0, 무승부 → 0.5
    function simulate(simBoard, currentPlayer, rootPlayer) {
      let boardSim = cloneBoard(simBoard);
      let p = currentPlayer;
      
      while (true) {
        const moves = getValidMoves(p, boardSim);
        if (moves.length === 0) {
          const oppMoves = getValidMoves(opponent(p), boardSim);
          if (oppMoves.length === 0) break; // 게임 종료
          p = opponent(p);
          continue;
        }
        // 무작위 이동 선택
        const randomMove = moves[Math.floor(Math.random() * moves.length)];
        applyMove(boardSim, randomMove.row, randomMove.col, p);
        p = opponent(p);
      }
      
      // 단순하게 돌 개수로 승패 평가
      let black = 0, white = 0;
      for (let r = 0; r < boardSim.length; r++) {
        for (let c = 0; c < boardSim[r].length; c++) {
          if (boardSim[r][c] === BLACK) black++;
          else if (boardSim[r][c] === WHITE) white++;
        }
      }
      if (black === white) return 0.5;
      const winner = black > white ? BLACK : WHITE;
      return winner === rootPlayer ? 1 : 0;
    }
    
    // 시뮬레이션용 이동 적용 함수 (in-place로 보드 수정)
    function applyMove(bd, row, col, p) {
      bd[row][col] = p;
      const opp = opponent(p);
      const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
      ];
      for (const [dr, dc] of directions) {
        let r = row + dr;
        let c = col + dc;
        const piecesToFlip = [];
        while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && bd[r][c] === opp) {
          piecesToFlip.push([r, c]);
          r += dr;
          c += dc;
        }
        if (piecesToFlip.length > 0 &&
            r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && bd[r][c] === p) {
          piecesToFlip.forEach(([fr, fc]) => {
            bd[fr][fc] = p;
          });
        }
      }
    }
    
    // MCTS 파라미터
    const ITERATIONS = 10;
    
    // 최상위에서 유효한 수들을 한 번 계산하여 root 노드에 전달
    const rootValidMoves = getValidMoves(player);
    
    // 루트 노드 생성 (현재 보드와 플레이어 상태에서 시작)
    const root = new Node(board, player, null, null, rootValidMoves);
    const rootPlayer = player;
    
    // MCTS 메인 루프: ITERATIONS만큼 탐색
    for (let i = 0; i < ITERATIONS; i++) {
      let node = root;
      let boardSim = cloneBoard(root.board);
      let simPlayer = root.player;
      
      // 1. 선택 단계: 자식 노드가 없고 미확장 노드가 나올 때까지 선택
      while (node.untriedMoves.length === 0 && node.children.length > 0) {
        node = bestChild(node);
        applyMove(boardSim, node.move.row, node.move.col, simPlayer);
        simPlayer = opponent(simPlayer);
      }
      
      // 2. 확장 단계: 미확장 이동이 있으면 하나 확장
      if (node.untriedMoves.length > 0) {
        const index = Math.floor(Math.random() * node.untriedMoves.length);
        const move = node.untriedMoves.splice(index, 1)[0];
        const newBoard = cloneBoard(boardSim);
        applyMove(newBoard, move.row, move.col, simPlayer);
        const child = new Node(newBoard, opponent(simPlayer), move, node);
        node.children.push(child);
        node = child;
        simPlayer = opponent(simPlayer);
        boardSim = newBoard;
      }
      
      // 3. 시뮬레이션 단계: 노드 상태에서 무작위 플레이아웃
      const reward = simulate(boardSim, simPlayer, rootPlayer);
      
      // 4. 역전파 단계: 루트까지 방문횟수와 승률 업데이트
      while (node !== null) {
        node.visits += 1;
        if (node.player === rootPlayer) {
          node.wins += reward;
        } else {
          node.wins += (1 - reward);
        }
        node = node.parent;
      }
    }
    
    // 최종적으로, 루트 자식 노드 중 방문 횟수가 가장 많은 노드의 이동을 선택
    let bestChildNode = null;
    let mostVisits = -Infinity;
    for (const child of root.children) {
      if (child.visits > mostVisits) {
        mostVisits = child.visits;
        bestChildNode = child;
      }
    }
    
    return bestChildNode ? bestChildNode.move : null;
}
  
// 최종적으로 mctsStrategy 함수를 호출하여 {row, col} 쌍을 반환합니다.
mctsStrategy(board, player, getValidMoves);
  