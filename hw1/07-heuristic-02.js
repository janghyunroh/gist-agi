function heuristicStrategy(board, player, getValidMoves) {
    // 보드를 깊은 복사하는 함수
    function cloneBoard(bd) {
      return bd.map(row => row.slice());
    }
    
    // 상대 플레이어를 반환하는 함수
    function opponent(p) {
      return p === BLACK ? WHITE : BLACK;
    }
    
    // 주어진 이동을 시뮬레이션하여, 결과 보드 상태를 반환하는 함수
    // 실제 board를 건드리지 않고, 이동 후 돌 뒤집기 규칙을 적용합니다.
    function simulateMove(bd, move, p) {
      const newBoard = cloneBoard(bd);
      newBoard[move.row][move.col] = p;
      const opp = opponent(p);
      const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
      ];
      for (const [dr, dc] of directions) {
        let r = move.row + dr;
        let c = move.col + dc;
        const piecesToFlip = [];
        while (
          r >= 0 && r < BOARD_SIZE &&
          c >= 0 && c < BOARD_SIZE &&
          newBoard[r][c] === opp
        ) {
          piecesToFlip.push([r, c]);
          r += dr;
          c += dc;
        }
        if (
          piecesToFlip.length > 0 &&
          r >= 0 && r < BOARD_SIZE &&
          c >= 0 && c < BOARD_SIZE &&
          newBoard[r][c] === p
        ) {
          piecesToFlip.forEach(([fr, fc]) => {
            newBoard[fr][fc] = p;
          });
        }
      }
      return newBoard;
    }
    
    // 위치별 가중치 배열 (코너는 매우 유리, 인접 칸은 불리하게 평가)
    const weights = [
      [100, -20, 10, 5, 5, 10, -20, 100],
      [-20, -50, -2, -2, -2, -2, -50, -20],
      [10, -2, -1, -1, -1, -1, -2, 10],
      [5, -2, -1, -1, -1, -1, -2, 5],
      [5, -2, -1, -1, -1, -1, -2, 5],
      [10, -2, -1, -1, -1, -1, -2, 10],
      [-20, -50, -2, -2, -2, -2, -50, -20],
      [100, -20, 10, 5, 5, 10, -20, 100]
    ];
    
    // 보드 평가 함수: 현재 보드 상태에서 플레이어의 돌 위치에 따른 가중치 합을 계산
    // 상대 돌에 대해서는 가중치를 빼줍니다.
    function evaluateBoard(bd, p) {
      let score = 0;
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (bd[r][c] === p) {
            score += weights[r][c];
          } else if (bd[r][c] === opponent(p)) {
            score -= weights[r][c];
          }
        }
      }
      return score;
    }
    
    // 현재 플레이어의 유효 수를 계산합니다.
    const validMoves = getValidMoves(player);
    if (validMoves.length === 0) return null;
    
    // 각 유효한 수에 대해 시뮬레이션 후 보드 평가를 수행하여 최고 점수를 주는 수를 선택합니다.
    let bestMove = validMoves[0];
    let bestScore = -Infinity;
    
    for (const move of validMoves) {
      const newBoard = simulateMove(board, move, player);
      const score = evaluateBoard(newBoard, player);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    
    return bestMove;
}

return heuristicStrategy(board, player, getValidMoves)