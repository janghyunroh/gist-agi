// 사용 가능 변수
// board: 8x8 2차원 배열 (0=EMPTY, 1=BLACK, 2=WHITE)
// player: 현재 턴 플레이어 (1 또는 2)

  //========================  기타 변수 및 함수 ========================
  /**
   * [변수들]
   * 1. directions matrix: 돌 뒤집는 시뮬레이션에 활용
   * 2. positionWeights: 위치 가중치 계산에 사용
   * 
   * [함수들]
   * 1. cloneBoard: 시뮬레이션 위한 보드 복사 함수
   * 2. computeValidMoves: 주어진 보드에서 특정 플레이어(흑/백)의 가능 수 - 시뮬레이션 위함
   * 3. simulateMove: 착수 및 착수 후 보드 상태 변경, 변경된 보드를 반환 
   */

  const directions = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];
  
  const positionWeights = [
    [120, -20, 20,  5,  5, 20, -20, 120],
    [-20, -40, -5, -5, -5, -5, -40, -20],
    [ 20,  -5, 15,  3,  3, 15,  -5,  20],
    [  5,  -5,  3,  3,  3,  3,  -5,   5],
    [  5,  -5,  3,  3,  3,  3,  -5,   5],
    [ 20,  -5, 15,  3,  3, 15,  -5,  20],
    [-20, -40, -5, -5, -5, -5, -40, -20],
    [120, -20, 20,  5,  5, 20, -20, 120]
  ];
  
  // 보드 복사 함수
  function cloneBoard(bd) {
    return bd.map(row => row.slice());
  }
  
  // 유효한 수 계산 함수: 현재 보드에서 플레이어 p가 둘 수 있는 모든 위치 반환
  function computeValidMoves(bd, p) {
    const opp = 3 - p
    const moves = [];
    for (let r = 0; r < bd.length; r++) {
      for (let c = 0; c < bd[0].length; c++) {
        if (bd[r][c] !== 0) continue;
        let valid = false;
        for (const [dr, dc] of directions) {
          let rTemp = r + dr, cTemp = c + dc;
          let foundOpp = false;
          while (rTemp >= 0 && rTemp < bd.length && cTemp >= 0 && cTemp < bd[0].length && bd[rTemp][cTemp] === opp) {
            foundOpp = true;
            rTemp += dr;
            cTemp += dc;
          }
          if (foundOpp && rTemp >= 0 && rTemp < bd.length && cTemp >= 0 && cTemp < bd[0].length && bd[rTemp][cTemp] === p) {
            valid = true;
            break;
          }
        }
        if (valid) moves.push({ row: r, col: c });
      }
    }
    return moves;
  }
  
  // 착수 시뮬레이션 함수: 주어진 보드에서 플레이어 p가 move 위치에 돌을 놓고 뒤집는 동작 수행 (보드를 직접 수정)
  function simulateMove(bd, move, p) {
    bd[move.row][move.col] = p;
    const opp = 3 - p;
    for (const [dr, dc] of directions) {
      let r = move.row + dr, c = move.col + dc;
      const toFlip = [];
      while (r >= 0 && r < bd.length && c >= 0 && c < bd[0].length && bd[r][c] === opp) {
        toFlip.push({ row: r, col: c });
        r += dr;
        c += dc;
      }
      if (toFlip.length > 0 && r >= 0 && r < bd.length && c >= 0 && c < bd[0].length && bd[r][c] === p) {
        for (const pos of toFlip) {
          bd[pos.row][pos.col] = p;
        }
      }
    }
    return bd;
  }
  


//======================== 평가 함수 ========================
/**
 * 1. countDiscs: 보드 전체에 있는 각 플레이어의 돌 개수 세기
 * 2. countMobility: 보드에서 플레이어가 둘 수 있는 move 개수 세기
 * 3. countFrontier: 보드에서 플레이어 돌 중 빈 칸 주위에 있는 돌 세기
 */

  // 돌 개수 세기 함수
  function countDiscs(bd, p) {
    let cnt = 0;
    for (let r = 0; r < bd.length; r++) {
      for (let c = 0; c < bd[0].length; c++) {
        if (bd[r][c] === p) cnt++;
      }
    }
    return cnt;
  }
  
  // 모빌리티 계산 함수: 플레이어 p가 둘 수 있는 수의 개수
  function countMobility(bd, p) {
    return computeValidMoves(bd, p).length;
  }
  
  // 프론티어 계산 함수: 플레이어 p의 돌 중 인접한 빈 칸이 있는 돌의 수
  function countFrontier(bd, p) {
    let frontier = 0;
    for (let r = 0; r < bd.length; r++) {
      for (let c = 0; c < bd[0].length; c++) {
        if (bd[r][c] === p) {
          for (const [dr, dc] of directions) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < bd.length && nc >= 0 && nc < bd[0].length && bd[nr][nc] === 0) {
              frontier++;
              break;
            }
          }
        }
      }
    }
    return frontier;
  }

  //======================== 전략 구현에 직접 쓰이는 함수 ========================
  /**
   * 1. evaluateBoard: 주어진 보드를 평가하여 minimax의 평가 점수를 결정
   * 2. makeMyStrategyMove: 최종 전략 함수. 
   */
  
  // 평가 함수: 플레이어 aiPlayer 관점에서 보드 평가
  function evaluateBoard(bd, player) {
    const opp = 3 - player;

    // 1. position score 계산
    let posScore = 0;
    for (let r = 0; r < bd.length; r++) {
      for (let c = 0; c < bd[0].length; c++) {
        if (bd[r][c] === player) posScore += positionWeights[r][c];
        else if (bd[r][c] === opp) posScore -= positionWeights[r][c];
      }
    }

    // 2. mobility score 계산
    const mobilityScore = countMobility(bd, player) - countMobility(bd, opp);

    // 3. frontier score 계산
    const frontierScore = countFrontier(bd, opp) - countFrontier(bd, player);

    // 4. disk score 계산
    const discScore = countDiscs(bd, player) - countDiscs(bd, opp);
    
    // 각 요소의 가중치는 튜닝에 따라 조정 가능
    const W_POS = 1.0;
    const W_MOBILITY = 5.0;
    const W_FRONTIER = 3.0;
    const W_DISC = 2.0;

    return W_POS * posScore + W_MOBILITY * mobilityScore + W_FRONTIER * frontierScore + W_DISC * discScore;
  }
  
  // MyStrategy: minimax 알고리즘(알파-베타 가지치기) 기반 최적의 수 선택 함수
  function studentStrategy(board, player) {
    const opp = 3 - player;
    const MAX_DEPTH = 6;
    let bestScore = -Infinity;
    let bestMove = null;
    
    // minimax 함수: 현재 보드 상태를 평가하여 점수를 반환
    // currentPlayer: 이번 턴에 두는 플레이어
    // 아래 함수는 othello-arena에 있던 expert의 코드를 참고하여 만들었음. 
    function minimax(bd, depth, alpha, beta, currentPlayer) {

      // termination: 깊이 0이면 평가 함수 호출
      if (depth === 0) return evaluateBoard(bd, player);
      
      let moves = computeValidMoves(bd, currentPlayer);
      // 만약 현재 플레이어가 둘 수 있는 수가 없으면, 상대 턴으로 넘김
      if (moves.length === 0) {
        const nextPlayer = (currentPlayer === player ? opp : player);
        // 상대도 둘 수 없으면 종료 상태이므로 평가 함수 호출
        if (computeValidMoves(bd, nextPlayer).length === 0) {
          return evaluateBoard(bd, player);
        }
        return minimax(bd, depth - 1, alpha, beta, nextPlayer);
      }
      
      const nextPlayer = (currentPlayer === player ? opp : player);
      
      if (currentPlayer === player) {
        // 내 차례인 경우 -> 점수 최대화
        let maxEval = -Infinity;
        for (const move of moves) {
          let boardCopy = cloneBoard(bd);
          simulateMove(boardCopy, move, currentPlayer);
          const evalScore = minimax(boardCopy, depth - 1, alpha, beta, nextPlayer);
          maxEval = Math.max(maxEval, evalScore);
          alpha = Math.max(alpha, evalScore);
          if (beta <= alpha) break; // 베타 컷오프
        }
        return maxEval;
      } else {
        // 상대 차례인 경우 -> 점수 최소화
        let minEval = Infinity;
        for (const move of moves) {
          let boardCopy = cloneBoard(bd);
          simulateMove(boardCopy, move, currentPlayer);
          const evalScore = minimax(boardCopy, depth - 1, alpha, beta, nextPlayer);
          minEval = Math.min(minEval, evalScore);
          beta = Math.min(beta, evalScore);
          if (beta <= alpha) break; // 알파 컷오프
        }
        return minEval;
      }
    }
    
    const validMoves = computeValidMoves(board, player);
    if (validMoves.length === 0) return null;
    
    // AI 턴에서는 가능한 모든 수에 대해 minimax 평가 후 최고 점수를 주는 수를 선택
    for (const move of validMoves) {
      let boardCopy = cloneBoard(board);
      simulateMove(boardCopy, move, player);
      // 다음 턴은 상대 플레이어부터 시작
      const score = minimax(boardCopy, MAX_DEPTH, -Infinity, Infinity, opp);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    
    return bestMove;
  }
  
  // 최종 호출
  return studentStrategy(board, player);
  