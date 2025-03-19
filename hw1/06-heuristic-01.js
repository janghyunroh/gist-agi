// // 환경에서 사용 가능한 전역 객체:
// // board: 8x8 2차원 배열 (각 칸: 0=EMPTY, 1=BLACK, 2=WHITE)
// // player: 현재 턴 플레이어 (1 또는 2)

// // 1. 보드 깊은 복사 함수
// function cloneBoard(bd) {
//     return bd.map(function(row) { return row.slice(); });
//   }
  
//   // 2. 상대 플레이어 반환 함수
//   function opponent(p) {
//     return p === 1 ? 2 : 1;
//   }
  
//   // 3. 유효한 수 계산 함수 (오셀로 규칙에 따른)
//   function computeValidMoves(bd, p) {
//     var moves = [];
//     var directions = [
//       [-1, -1], [-1, 0], [-1, 1],
//       [0, -1],           [0, 1],
//       [1, -1],  [1, 0],  [1, 1]
//     ];
//     for (var row = 0; row < bd.length; row++) {
//       for (var col = 0; col < bd[0].length; col++) {
//         if (bd[row][col] !== 0) continue; // 빈 칸이 아니면 패스
//         var valid = false;
//         for (var i = 0; i < directions.length; i++) {
//           var dr = directions[i][0], dc = directions[i][1];
//           var r = row + dr, c = col + dc;
//           var foundOpponent = false;
//           while (r >= 0 && r < bd.length && c >= 0 && c < bd[0].length && bd[r][c] === opponent(p)) {
//             foundOpponent = true;
//             r += dr;
//             c += dc;
//           }
//           if (foundOpponent && r >= 0 && r < bd.length && c >= 0 && c < bd[0].length && bd[r][c] === p) {
//             valid = true;
//             break;
//           }
//         }
//         if (valid) moves.push({ row: row, col: col });
//       }
//     }
//     return moves;
//   }
  
//   // 4. 가상 착수 함수: 보드 복사본에 대해 주어진 move({row, col})를 p의 돌로 두고 오셀로 규칙에 따라 돌 뒤집기
//   function simulateMove(bd, move, p) {
//     bd[move.row][move.col] = p;
//     var opp = opponent(p);
//     var directions = [
//       [-1, -1], [-1, 0], [-1, 1],
//       [0, -1],           [0, 1],
//       [1, -1],  [1, 0],  [1, 1]
//     ];
//     for (var i = 0; i < directions.length; i++) {
//       var dr = directions[i][0], dc = directions[i][1];
//       var r = move.row + dr, c = move.col + dc;
//       var toFlip = [];
//       while (r >= 0 && r < bd.length && c >= 0 && c < bd[0].length && bd[r][c] === opp) {
//         toFlip.push({ row: r, col: c });
//         r += dr;
//         c += dc;
//       }
//       if (toFlip.length > 0 &&
//           r >= 0 && r < bd.length && c >= 0 && c < bd[0].length &&
//           bd[r][c] === p) {
//         for (var j = 0; j < toFlip.length; j++) {
//           bd[toFlip[j].row][toFlip[j].col] = p;
//         }
//       }
//     }
//     return bd;
//   }
  
//   // 5. 돌 개수 세기 함수
//   function countDiscs(bd, p) {
//     var cnt = 0;
//     for (var r = 0; r < bd.length; r++) {
//       for (var c = 0; c < bd[0].length; c++) {
//         if (bd[r][c] === p) cnt++;
//       }
//     }
//     return cnt;
//   }
  
//   // 6. 모빌리티: 보드에서 p가 둘 수 있는 수의 개수
//   function countMobility(bd, p) {
//     var moves = computeValidMoves(bd, p);
//     return moves ? moves.length : 0;
//   }
  
//   // 7. 프론티어: p의 돌 중 인접 칸에 빈 칸이 있는 돌의 개수 (뒤집힐 위험)
//   function countFrontier(bd, p) {
//     var frontier = 0;
//     var directions = [
//       [-1, -1], [-1, 0], [-1, 1],
//       [0, -1],           [0, 1],
//       [1, -1],  [1, 0],  [1, 1]
//     ];
//     for (var r = 0; r < bd.length; r++) {
//       for (var c = 0; c < bd[0].length; c++) {
//         if (bd[r][c] === p) {
//           for (var i = 0; i < directions.length; i++) {
//             var dr = directions[i][0], dc = directions[i][1];
//             var nr = r + dr, nc = c + dc;
//             if (nr >= 0 && nr < bd.length && nc >= 0 && nc < bd[0].length) {
//               if (bd[nr][nc] === 0) { // 0은 EMPTY
//                 frontier++;
//                 break;
//               }
//             }
//           }
//         }
//       }
//     }
//     return frontier;
//   }
  
//   // 8. 위치 가중치 테이블
//   var positionWeights = [
//     [100, -30, 10, 5, 5, 10, -30, 100],
//     [-30, -50, -2, -2, -2, -2, -50, -30],
//     [10, -2, 1, 1, 1, 1, -2, 10],
//     [5, -2, 1, 1, 1, 1, -2, 5],
//     [5, -2, 1, 1, 1, 1, -2, 5],
//     [10, -2, 1, 1, 1, 1, -2, 10],
//     [-30, -50, -2, -2, -2, -2, -50, -30],
//     [100, -30, 10, 5, 5, 10, -30, 100]
//   ];
  
//   // 9. 평가 함수: 여러 요소(위치, 모빌리티, 프론티어, 돌 차이)를 고려하여 보드 평가 (플레이어 p 관점)
//   function evaluateBoard(bd, p) {
//     var opp = opponent(p);
//     var posScore = 0;
//     for (var r = 0; r < bd.length; r++) {
//       for (var c = 0; c < bd[0].length; c++) {
//         if (bd[r][c] === p) {
//           posScore += positionWeights[r][c];
//         } else if (bd[r][c] === opp) {
//           posScore -= positionWeights[r][c];
//         }
//       }
//     }
//     var mobilityScore = countMobility(bd, p) - countMobility(bd, opp);
//     var frontierScore = countFrontier(bd, opp) - countFrontier(bd, p);
//     var discScore = countDiscs(bd, p) - countDiscs(bd, opp);
    
//     var W_POS = 1.0, W_MOBILITY = 5.0, W_FRONTIER = 3.0, W_DISC = 2.0;
//     return W_POS * posScore + W_MOBILITY * mobilityScore + W_FRONTIER * frontierScore + W_DISC * discScore;
//   }
  
//   // 10. 안정성 보너스: 코너에 착수하면 추가 보너스
//   function stabilityBonus(move) {
//     if ((move.row === 0 || move.row === 7) && (move.col === 0 || move.col === 7)) {
//       return 50;
//     }
//     return 0;
//   }
  
//   // 11. 휴리스틱 전략: computeValidMoves를 통해 얻은 유효한 수들을 평가하여 최적의 수 선택
//   function heuristicOthelloStrategy() {
//     var validMoves = computeValidMoves(board, player);
//     if (!validMoves || validMoves.length === 0) return null;
//     var bestMove = null;
//     var bestEval = -Infinity;
    
//     for (var i = 0; i < validMoves.length; i++) {
//       var move = validMoves[i];
//       var boardCopy = cloneBoard(board);
//       boardCopy = simulateMove(boardCopy, move, player);
//       var evalScore = evaluateBoard(boardCopy, player);
//       evalScore += stabilityBonus(move);
//       if (evalScore > bestEval) {
//         bestEval = evalScore;
//         bestMove = move;
//       }
//     }
//     return bestMove;
//   }
  
//   // 최종적으로, 이 스크립트는 실행 시 최적의 수({row, col} 객체)를 result 변수에 저장하고, 그 값을 평가값으로 내보냅니다.
//   return heuristicOthelloStrategy();
  