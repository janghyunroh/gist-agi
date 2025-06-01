/* =========================================================
   analyzeStage – API evaluateBoard() 버전
   ========================================================= */
function analyzeStage(stageCfg, initialBoard, _initialValid, api) {

  /* ---------- 0. 전-국 타이머 ---------- */
  const TOTAL_BUDGET = 10_000;
  let   timeUsed     = 0;

  /* ---------- 1. 보드 메타 ---------- */
  const N     = stageCfg.boardSize;
  const EMPTY = 0, BLACK = 1, WHITE = 2, BLOCKED = 3;
  const opp   = p => 3 - p;
  const isBig = N > 8;

  /* ---------- 2. (선택) 가중치 테이블 ---------- */
  // 이제 평가는 API가 하므로, move-ordering용으로만 사용
  const base8 = [ /* … 기존 8×8 테이블 … */ ];
  function weight(r, c){
    if(N === 8) return base8[r][c];
    const rr = Math.round(r * 7 / (N - 1));
    const cc = Math.round(c * 7 / (N - 1));
    return base8[rr][cc];
  }

  /* ---------- 3. 트랜스포지션 캐시 ---------- */
  const TT = new Map();
  const hash = (bd, ply, pl) => pl + "|" + ply + "|" + bd.flat().join("");

  /* ---------- 4. 깊이·분기 정책 ---------- */
  function depthPolicy(empty, tLeft){
    if(!isBig) return 6;
    if(tLeft < 600) return 3;
    if(empty > 60)  return 3;
    if(empty > 40)  return 4;
    if(empty > 20)  return 5;
    return 7;
  }
  function pruneMoves(moves){
    if(!isBig) return moves;
    return moves
      .map(m => ({...m, w: weight(m.row, m.col)}))
      .sort((a,b) => b.w - a.w)
      .slice(0, 6);               // 상위 6수
  }

  /* ---------- 5. 미니맥스 + αβ ---------- */
  function minimax(board, ply, alpha, beta, cur, root){
    const key = hash(board, ply, cur);
    if(TT.has(key)) return TT.get(key);

    if(ply === 0){
      const v = api.evaluateBoard(board, root).totalScore;
      TT.set(key, v); return v;
    }

    const moves = api.getValidMoves(board, cur);
    if(!moves.length){
      const oppMoves = api.getValidMoves(board, opp(cur));
      if(!oppMoves.length){
        const v = api.evaluateBoard(board, root).totalScore;
        TT.set(key, v); return v;
      }
      const v = minimax(board, ply-1, alpha, beta, opp(cur), root);
      TT.set(key, v); return v;
    }

    let best;
    if(cur === root){
      best = -Infinity;
      for(const m of moves){
        const next = api.simulateMove(board, cur, m.row, m.col).resultingBoard;
        best = Math.max(best, minimax(next, ply-1, alpha, beta, opp(cur), root));
        alpha = Math.max(alpha, best);
        if(beta <= alpha) break;
      }
    }else{
      best =  Infinity;
      for(const m of moves){
        const next = api.simulateMove(board, cur, m.row, m.col).resultingBoard;
        best = Math.min(best, minimax(next, ply-1, alpha, beta, opp(cur), root));
        beta = Math.min(beta, best);
        if(beta <= alpha) break;
      }
    }
    TT.set(key, best);
    return best;
  }

  /* ---------- 6. 전략 함수 ---------- */
  return function strategy(board, player, validMoves){
    if(!validMoves.length) return null;

    const t0       = performance.now();
    const timeLeft = TOTAL_BUDGET - timeUsed;
    const empty    = board.flat().filter(x => x === EMPTY).length;
    const maxDepth = depthPolicy(empty, timeLeft);
    const moves    = pruneMoves(validMoves);

    let bestMove = moves[0], bestScore = -Infinity;
    for(let d = 3; d <= maxDepth; d++){
      for(const mv of moves){
        const after = api.simulateMove(board, player, mv.row, mv.col).resultingBoard;
        const v = minimax(after, d-1, -1e9, 1e9, opp(player), player);
        if(v > bestScore){ bestScore = v; bestMove = mv; }
      }
      if(performance.now() - t0 > timeLeft * 0.6) break;
    }

    timeUsed += performance.now() - t0;
    return bestMove;
  };
}
