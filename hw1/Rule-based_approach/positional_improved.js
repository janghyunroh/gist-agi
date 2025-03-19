// 사용 가능 변수
// board: 8x8 2차원 배열 (0=EMPTY, 1=BLACK, 2=WHITE)
// player: 현재 턴 플레이어 (1 또는 2)

//======================== 사용 변수 ========================
/**
 * 1. 
 * 2. 
 * 3.
 * 4.
 */


// 1. 방향 배열(돌 뒤집기에 사용)
const directions = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

// 2. 위치 가중치 테이블
const positionWeights = [
  [100, -30, 10, 5, 5, 10, -30, 100],
  [-30, -50, -2, -2, -2, -2, -50, -30],
  [10, -2, 1, 1, 1, 1, -2, 10],
  [5, -2, 1, 1, 1, 1, -2, 5],
  [5, -2, 1, 1, 1, 1, -2, 5],
  [10, -2, 1, 1, 1, 1, -2, 10],
  [-30, -50, -2, -2, -2, -2, -50, -30],
  [100, -30, 10, 5, 5, 10, -30, 100]
];

// 3. 보드 깊은 복사 함수
function cloneBoard(bd) {
  return bd.map(function(row) { return row.slice(); });
}
  
// 4. 유효한 수 계산 함수 (오셀로 규칙에 따른)
function computeValidMoves(bd, p) {
  var moves = [];
  for (var row = 0; row < bd.length; row++) {
    for (var col = 0; col < bd[0].length; col++) {
      if (bd[row][col] !== 0) continue; // 빈 칸이 아니면 패스
      var valid = false;
      for (var i = 0; i < directions.length; i++) {
        var dr = directions[i][0], dc = directions[i][1];
        var r = row + dr, c = col + dc;
        var foundOpponent = false;
        while (r >= 0 && r < bd.length && c >= 0 && c < bd[0].length && bd[r][c] === 3 - p) {
          foundOpponent = true;
          r += dr;
          c += dc;
        }
        if (foundOpponent && r >= 0 && r < bd.length && c >= 0 && c < bd[0].length && bd[r][c] === p) {
          valid = true;
          break;
        }
      }
      if (valid) moves.push({ row: row, col: col });
    }
  }
  return moves;
}



//======================== 보드 평가 요소 ========================
/**
 * 1. 위치 가중치 점수
 * 2. 디스크 개수 점수
 * 3. 모빌리티 점수
 * 4. 프론티어 점수
 * 5. 안전성 보너스
 */


// 1. 위치 가중치 점수 계산 함수
function computePosScore(bd, p) {
  var score = 0
  for (var r = 0; r < bd.length; r++) {
    for (var c = 0; c < bd[0].length; c++) {

      if (bd[r][c] === p) score += positionWeights[r][c];
      else if (bd[r][c] === 3 - p) score -= positionWeights[r][c];
      
    }
  }
  return score
}
  
// 2. 디스크 점수: 보드 전체의 (내 돌 개수) - (상대 돌 개수) 구하는 함수
function computeDiskScore(bd, p) {
  var cnt = 0;
  for (var r = 0; r < bd.length; r++) {
    for (var c = 0; c < bd[0].length; c++) {
      if (bd[r][c] === p) cnt++;
      else if(bd[r][c] === 3 - p) cnt--;
    }
  }
  return cnt;
}
  
// 3. 모빌리티 점수: 보드에서 (내가 둘 수 있는 수의 개수) - (상대 둘 수 있는 수의 개수)
function computeMobilityScore(bd, p) {
  var myMoves = computeValidMoves(bd, p);
  var oppMoves = computeValidMoves(bd, 3 - p);
  return myMoves.length - oppMoves.length;
}
  
// 4. 프론티어 점수: p의 돌 중 인접 칸에 빈 칸이 있는 돌의 개수(빈 칸이 하나라도 있으면 세기)
function computeFrontierScore(bd, p) {
  var frontier = 0;

  for (var r = 0; r < bd.length; r++) {
    for (var c = 0; c < bd[0].length; c++) {

      for (var i = 0; i < directions.length; i++) {
        var dr = directions[i][0], dc = directions[i][1];
        var nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < bd.length && nc >= 0 && nc < bd[0].length) {
          if (bd[nr][nc] === 0) { // 0은 EMPTY

            if(bd[r][c] === p) frontier++; //내 돌인 경우
            else if(bd[r][c] === 3 - p) frontier--; //상대 돌인 경우

            break;
          }
        }
      }
    }
  }
  return frontier;
}

// 5. 안정성 보너스: 코너에 착수하면 추가 보너스
function computeStabilityScore(move) {
  if ((move.row === 0 || move.row === 7) && (move.col === 0 || move.col === 7)) {
    return 50;
  }
  return 0;
}
  
//======================== 보드 평가 요소 ========================
/**
 * 1. 착수 시뮬레이션 함수
 * 2. 착수 후 보드 평가 함수
 */

// 1. 가상 착수 함수: 보드 복사본에 대해 주어진 move({row, col})를 p의 돌로 두고 오셀로 규칙에 따라 돌 뒤집기
function simulateMove(bd, move, p) {
  bd[move.row][move.col] = p;
  var opp = 3 - p;

  for (var i = 0; i < directions.length; i++) {
    var dr = directions[i][0], dc = directions[i][1];
    var r = move.row + dr, c = move.col + dc;
    var toFlip = [];
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
  
// 2. 평가 함수: 여러 요소(위치, 모빌리티, 프론티어, 돌 차이)를 고려하여 보드 평가 (플레이어 p 관점)
function evaluateBoard(bd, p) {

  var posScore = computePosScore(bd, p);
  var mobilityScore = computeMobilityScore(bd, p);
  var frontierScore = computeFrontierScore(bd, p);
  var diskScore = computeDiskScore(bd, p);
  var stabilityBonus = computeStabilityScore(bd, p);
  
  const W_POS = 1.0
  const W_MOBILITY = 4.5
  const W_FRONTIER = 3.0
  const W_DISC = 1.8;
  const W_STABILITY = 0.0;

  return W_POS * posScore + W_MOBILITY * mobilityScore + W_FRONTIER * frontierScore + W_DISC * diskScore + W_STABILITY * stabilityBonus;
}
  
//======================== 최종 전략 ========================
  
// 최종 전략 - 종합 점수 계산하여 착수
function heuristicOthelloStrategy() {
  var validMoves = computeValidMoves(board, player);
  if (!validMoves || validMoves.length === 0) return null;
  var bestMove = null;
  var bestEval = -Infinity;
  
  for (var i = 0; i < validMoves.length; i++) {
    var move = validMoves[i];
    var boardCopy = cloneBoard(board);
    boardCopy = simulateMove(boardCopy, move, player);
    var evalScore = evaluateBoard(boardCopy, player);
    if (evalScore > bestEval) {
      bestEval = evalScore;
      bestMove = move;
    }
  }
  return bestMove;
}
  
// 전략 수행
return heuristicOthelloStrategy();
  