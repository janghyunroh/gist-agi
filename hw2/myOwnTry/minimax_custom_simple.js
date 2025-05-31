/* =========================================================
   analyzeStage – 시간 예산 10 s 대응 + 8×8 성능 유지
   ========================================================= */
function analyzeStage(stageCfg, initialBoard, _initialValid, api) {

  /* ---------- 0. 전-국 타이머 ---------- */
  const TOTAL_BUDGET = 10_000;          // 10 초(ms) / 한 판
  let   timeUsed    = 0;                // 누적 사용 시간

  /* ---------- 1. 보드 메타 ---------- */
  const N        = stageCfg.boardSize;  // 가로=세로
  const EMPTY    = 0, BLACK = 1, WHITE = 2, BLOCKED = 3;
  const opp      = p => 3 - p;
  const isBig    = N > 8;               // 9×9 이상을 “대형”으로 간주

  /* ---------- 2. 위치 가중치 ---------- */
  const base8 = [                       // 8×8 가중치
    [120,-20, 20,  5,  5, 20,-20,120], [-20,-40,-5,-5,-5,-5,-40,-20],
    [ 20, -5, 15,  3,  3, 15, -5, 20], [  5, -5,  3,  3,  3,  3, -5,  5],
    [  5, -5,  3,  3,  3,  3, -5,  5], [ 20, -5, 15,  3,  3, 15, -5, 20],
    [-20,-40,-5,-5,-5,-5,-40,-20],     [120,-20, 20,  5,  5, 20,-20,120]
  ];
  function makeWeights(n){
    if(n === 8) return base8;           // 8×8 은 원본 사용
    const tbl = Array.from({length:n}, _=>Array(n).fill(0));
    for(let r=0;r<n;r++){
      for(let c=0;c<n;c++){
        const rr = Math.round(r * 7 / (n-1));
        const cc = Math.round(c * 7 / (n-1));
        tbl[r][c] = base8[rr][cc];
      }
    }
    (stageCfg.initialBlocked||[]).forEach(({r,c})=>{
      if(r<n && c<n) tbl[r][c] = 0;
    });
    return tbl;
  }
  const posW = makeWeights(N);

  /* ---------- 3. 보드 평가 ---------- */
  function evaluate(board, me){
    const base = api.evaluateBoard(board, me).totalScore;
    let pos = 0;
    for(let r=0;r<N;r++) for(let c=0;c<N;c++){
      if(board[r][c] === me)         pos += posW[r][c];
      else if(board[r][c] === opp(me)) pos -= posW[r][c];
    }
    // 가중치: 8×8은 원래 깊은 탐색에 의존 → 미세 보정(0.3)
    // 대형 보드는 휴리스틱 가치를 조금 더 반영(0.5)
    const k = isBig ? 0.5 : 0.3;
    return base + k * pos;
  }

  /* ---------- 4. 트랜스포지션 캐시 ---------- */
  const TT = new Map();
  const hash = (bd, ply, pl) => pl + "|" + ply + "|" + bd.flat().join("");

  /* ---------- 5. 깊이 정책 ---------- */
  function depthPolicy(empty, timeLeft){
    if(!isBig) return 6;               // 8×8 고정 깊이 = 6
    if(timeLeft < 600) return 3;       // 잔여 0.6 s 이하면 안전 깊이
    if(empty > 60)      return 3;
    if(empty > 40)      return 4;
    if(empty > 20)      return 5;
    return 7;                          // 엔드게임
  }

  /* ---------- 6. 후보수 상한 ---------- */
  function pruneMoves(board, player, moves){
    if(!isBig) return moves;           // 8×8 은 전체 탐색
    const K = 6;                       // 대형 보드는 상위 6개만
    return moves
      .map(m => ({...m, w: posW[m.row][m.col]}))
      .sort((a,b) => b.w - a.w)
      .slice(0, K);
  }

  /* ---------- 7. 미니맥스 + αβ ---------- */
  function minimax(board, ply, α, β, cur, root){
    const key = hash(board, ply, cur);
    if(TT.has(key)) return TT.get(key);
    if(ply === 0){
      const v = evaluate(board, root);
      TT.set(key, v);  return v;
    }
    const moves = api.getValidMoves(board, cur);
    if(!moves.length){
      const oppMoves = api.getValidMoves(board, opp(cur));
      if(!oppMoves.length){            // 양측 패스 → 종국
        const v = evaluate(board, root);
        TT.set(key, v);  return v;
      }
      const v = minimax(board, ply-1, α, β, opp(cur), root);
      TT.set(key, v);  return v;
    }

    let best;
    if(cur === root){                  // MAX
      best = -Infinity;
      for(const m of moves){
        const next = api.simulateMove(board, cur, m.row, m.col).resultingBoard;
        const sc   = minimax(next, ply-1, α, β, opp(cur), root);
        if(sc > best) best = sc;
        if((α = Math.max(α, sc)) >= β) break;
      }
    }else{                             // MIN
      best =  Infinity;
      for(const m of moves){
        const next = api.simulateMove(board, cur, m.row, m.col).resultingBoard;
        const sc   = minimax(next, ply-1, α, β, opp(cur), root);
        if(sc < best) best = sc;
        if((β = Math.min(β, sc)) <= α) break;
      }
    }
    TT.set(key, best);
    return best;
  }

  /* ---------- 8. 전략 함수 ---------- */
  return function strategy(board, player, validMoves){
    if(!validMoves.length) return null;

    const t0        = performance.now();
    const timeLeft  = TOTAL_BUDGET - timeUsed;
    const empty     = board.flat().filter(x => x === EMPTY).length;
    const maxDepth  = depthPolicy(empty, timeLeft);
    const movesCand = pruneMoves(board, player, validMoves);

    /* 반복 깊이 증가 – 잔여시간 60 % 쓰면 중단 */
    let bestM = movesCand[0], bestV = -Infinity;
    for(let depth = 3; depth <= maxDepth; depth++){
      for(const mv of movesCand){
        const after = api.simulateMove(board, player, mv.row, mv.col).resultingBoard;
        const v = minimax(after, depth-1, -1e9, 1e9, opp(player), player);
        if(v > bestV){ bestV = v; bestM = mv; }
      }
      if(performance.now() - t0 > timeLeft * 0.6) break;
    }

    timeUsed += performance.now() - t0;
    return bestM;
  };
}
