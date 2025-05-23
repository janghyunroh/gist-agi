// --- Constants and Environment ---

// board: 8x8 array (0=empty, 1=BLACK, 2=WHITE)
// player: current player (1 for Black, 2 for White)
// getValidMoves(player): returns array of valid moves for player

// additional environmental variables

// 1) 방향 매트릭스(돌 뒤집기에서 쓰임)
const directions = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

// 2) 가중치 매트릭스(보드 평가에 사용)
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

// 1. 보드 깊은 복사 함수
function cloneBoard(bd) {
  return bd.map(function(row) { return row.slice(); });
}
  
// 2. validmove 함수 직접 구현(시뮬레이션에서 쓰기 위함) - Expert 코드 분석후 가져 옴. 
function computeValidMoves(bd, p) {
  var moves = [];
  
  //보드의 각 칸에 대해 계산
  for (var row = 0; row < bd.length; row++) {
    for (var col = 0; col < bd[0].length; col++) {

      // 빈 칸이 아니면 패스
      if (bd[row][col] !== 0) continue; 


      var valid = false;
      for (var i = 0; i < directions.length; i++) { //해당 칸에서 해당 방향으로 1칸 
        var dr = directions[i][0], dc = directions[i][1];
        var r = row + dr, c = col + dc;
        var foundOpp = false;

        // 해당 방향으로 계속 이동하면서 상대 돌들을 모두 지나침!
        while (r >= 0 && r < bd.length && c >= 0 && c < bd[0].length && bd[r][c] === 3 - p) { 
          foundOpp = true;
          r += dr;
          c += dc;
        }

        // 모두 지나친 뒤에 거기에 내 돌이 있으면 둘 수 있음. 
        if (foundOpp && r >= 0 && r < bd.length && c >= 0 && c < bd[0].length && bd[r][c] === p) {
          valid = true; //flag 설정. 
          break;
        }
      }
      if (valid) moves.push({ row: row, col: col });
    }
  }
  return moves;
}

// 3. 가상 착수 함수: 주어진 보드 복사본에 대해 move({row, col})를 p의 돌로 두고 돌 뒤집기
function simulateMove(bd, move, p) {
  bd[move.row][move.col] = p;
  var opp = 3 - p;

  //뒤집을 수 있는 모든 방향의 상대 돌을 모두 뒤집기
  for (var i = 0; i < directions.length; i++) {
    var dr = directions[i][0], dc = directions[i][1];
    var r = move.row + dr, c = move.col + dc;
    var toFlip = [];

    //
    while (r >= 0 && r < bd.length && c >= 0 && c < bd[0].length && bd[r][c] === opp) {
      toFlip.push({ row: r, col: c });
      r += dr;
      c += dc;
    }
    if (toFlip.length > 0 &&
        r >= 0 && r < bd.length && c >= 0 && c < bd[0].length &&
        bd[r][c] === p) {
      for (var j = 0; j < toFlip.length; j++) {
        bd[toFlip[j].row][toFlip[j].col] = p;
      }
    }
  }
  return bd;
}

// 5. 보드 전체에 대한 p의 돌 개수 세기 함수
function countDiscs(bd, p) {
  var cnt = 0;
  for (var r = 0; r < bd.length; r++) {
    for (var c = 0; c < bd[0].length; c++) {
      if (bd[r][c] === p) cnt++;
    }
  }
  return cnt;
}

// 6. 모빌리티 계산: 주어진 보드에서 플레이어 p의 유효한 수의 개수
function countMobility(bd, p) {
  var moves = computeValidMoves(bd, p);
  return moves ? moves.length : 0;
}

// 7. 프론티어 계산: 플레이어 p의 돌 중 주변에 빈 칸이 있는 돌의 수
function countFrontier(bd, p) {
  var frontier = 0;
  for (var r = 0; r < bd.length; r++) {
    for (var c = 0; c < bd[0].length; c++) {
      if (bd[r][c] === p) {
        for (var i = 0; i < directions.length; i++) {
          var dr = directions[i][0], dc = directions[i][1];
          var nr = r + dr, nc = c + dc;
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



// 9. 평가 함수: 여러 요소(위치, 모빌리티, 프론티어, 돌 차이)를 고려하여 보드 평가 (플레이어 p 관점)
// 모빌리티는 최종 보드 상태에서의 유효한 수 차이를 평가
function evaluateBoard(bd, p) {
  var opp = 3 - p;
  
  // 위치 평가
  var posScore = 0;
  for (var r = 0; r < bd.length; r++) {
    for (var c = 0; c < bd[0].length; c++) {
      if (bd[r][c] === p) posScore += positionWeights[r][c];
      else if (bd[r][c] === opp) posScore -= positionWeights[r][c];
    }
  }
  
  // 모빌리티 평가: 최종 보드 상태에서의 유효한 수 차이
  var mobilityScore = countMobility(bd, p) - countMobility(bd, opp);
  
  // 프론티어 평가
  var frontierScore = countFrontier(bd, opp) - countFrontier(bd, p);
  
  // 돌 개수 차이 평가
  var discScore = countDiscs(bd, p) - countDiscs(bd, opp);
  
  // 각 요소의 가중치 (튜닝 필요)
  var W_POS = 1.0, W_MOBILITY = 5.0, W_FRONTIER = 3.0, W_DISC = 2.0;
  return W_POS * posScore + W_MOBILITY * mobilityScore + W_FRONTIER * frontierScore + W_DISC * discScore;
}

// 10. 안정성 보너스: 코너에 착수하면 추가 보너스 부여
function stabilityBonus(move) {
  if ((move.row === 0 || move.row === 7) && (move.col === 0 || move.col === 7))
    return 50;
  return 0;
}

// 11. Expert AI: minimax 알고리즘 (depth 6) 기반, 평가 함수에 모빌리티를 포함함
function makeExpertAIMove(validMoves) {
  const MAX_DEPTH = 6;
  let bestScore = -Infinity;
  let bestMove = null;
  
  // minimax 알고리즘에 사용할 함수들
  function computeValidMovesForMinimax(bd, p) {
    var moves = [];
    for (var row = 0; row < bd.length; row++) {
      for (var col = 0; col < bd[0].length; col++) {
        if (bd[row][col] !== 0) continue;
        if (isValidMoveForMinimax(bd, row, col, p))
          moves.push({ row: row, col: col });
      }
    }
    return moves;
  }
  
  function isValidMoveForMinimax(bd, row, col, p) {
    if (bd[row][col] !== 0) return false;
    var opp = 3 - p;

    for (var i = 0; i < directions.length; i++) {
      var dr = directions[i][0], dc = directions[i][1];
      var r = row + dr, c = col + dc;
      var foundOpp = false;
      while (r >= 0 && r < bd.length && c >= 0 && c < bd[0].length && bd[r][c] === opp) {
        foundOpp = true;
        r += dr;
        c += dc;
      }
      if (foundOpp && r >= 0 && r < bd.length && c >= 0 && c < bd[0].length && bd[r][c] === p)
        return true;
    }
    return false;
  }
  
  function countMobilityForMinimax(bd, p) {
    return computeValidMovesForMinimax(bd, p).length;
  }
  
  function makeSimulatedMove(bd, move, p) {
    bd[move.row][move.col] = p;
    var opp = 3 - p;

    directions.forEach(function(dir) {
      var r = move.row + dir[0], c = move.col + dir[1];
      var toFlip = [];
      while (r >= 0 && r < bd.length && c >= 0 && c < bd[0].length && bd[r][c] === opp) {
        toFlip.push({ row: r, col: c });
        r += dir[0];
        c += dir[1];
      }
      if (toFlip.length > 0 && r >= 0 && r < bd.length && c >= 0 && c < bd[0].length && bd[r][c] === p) {
        toFlip.forEach(function(piece) {
          bd[piece.row][piece.col] = p;
        });
      }
    });
    return bd;
  }
  
  function minimax(bd, depth, alpha, beta, maximizingPlayer) {
    if (depth === 0) {
      var score = 0;
      for (var row = 0; row < bd.length; row++) {
        for (var col = 0; col < bd[0].length; col++) {
          if (bd[row][col] === 2) score += positionWeights[row][col];
          else if (bd[row][col] === 1) score -= positionWeights[row][col];
        }
      }
      var mobilityWhite = countMobilityForMinimax(bd, 2);
      var mobilityBlack = countMobilityForMinimax(bd, 1);
      score += 5 * (mobilityWhite - mobilityBlack);
      return score;
    }
    
    const p = maximizingPlayer ? 2 : 1;
    const moves = computeValidMovesForMinimax(bd, p);
    if (moves.length === 0) {
      return minimax(bd, depth - 1, alpha, beta, !maximizingPlayer);
    }
    
    if (maximizingPlayer) {
      let maxEval = -Infinity;
      for (const move of moves) {
        const boardCopy = cloneBoard(bd);
        makeSimulatedMove(boardCopy, move, 2);
        const evalScore = minimax(boardCopy, depth - 1, alpha, beta, false);
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        const boardCopy = cloneBoard(bd);
        makeSimulatedMove(boardCopy, move, 1);
        const evalScore = minimax(boardCopy, depth - 1, alpha, beta, true);
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }
  
  for (const move of validMoves) {
    const boardCopy = cloneBoard(board);
    makeSimulatedMove(boardCopy, move, 2);
    const score = minimax(boardCopy, MAX_DEPTH, -Infinity, Infinity, false);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  
  return bestMove;
}
  
// 최종적으로, 외부에서 유효한 수 배열을 미리 계산하여 Expert AI 전략을 호출합니다.
const validMoves = getValidMoves(player);
return makeExpertAIMove(validMoves);
  