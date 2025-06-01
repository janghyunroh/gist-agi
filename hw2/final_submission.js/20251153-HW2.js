/* =========================================================
   Othello Intelligent System - minimax + custom evaluation function(mobility)
   ========================================================= */
function analyzeStage(stageCfg, initialBoard, _initValid, api){

  /* ---------- 0. GLobal 타이머 ---------- */
  const TOTAL_BUDGET = 10_000;   let timeUsed = 0;

  /* ---------- 1. 보드 메타 ---------- */
  const ROWS = initialBoard.length;
  const COLS = initialBoard[0].length;
  const EMPTY=0, BLACK=1, WHITE=2, BLOCKED=3;
  const opp   = p => 3 - p;
  const isBig = Math.max(ROWS, COLS) > 8;

  /* ---------- 2. 안전한 위치 가중치 테이블 ---------- */
  const base8 = [
    [120,-20, 20,  5,  5, 20,-20,120], 
    [-20,-40,-5,-5,-5,-5,-40,-20],
    [ 20, -5, 15,  3,  3, 15, -5, 20], 
    [  5, -5,  3,  3,  3,  3, -5,  5],
    [  5, -5,  3,  3,  3,  3, -5,  5], 
    [ 20, -5, 15,  3,  3, 15, -5, 20],
    [-20,-40,-5,-5,-5,-5,-40,-20],     
    [120,-20, 20,  5,  5, 20,-20,120]
  ];

  // base8 행렬을 기반으로 weight matrix를 크기에 따라 생성하는 함수
  function buildPosWeights(){
    // 분모가 0이면 (ROWS==1) → 전부 0
    if (ROWS < 2 || COLS < 2) {
      return Array.from({length: ROWS}, _=> Array(COLS).fill(0));
    }
    const tbl = Array.from({length: ROWS}, _=> Array(COLS).fill(0));
    for (let r=0; r<ROWS; r++){
      const rr = Math.min(7, Math.max(0, Math.round(r*7/(ROWS-1))));
      for (let c=0; c<COLS; c++){
        const cc = Math.min(7, Math.max(0, Math.round(c*7/(COLS-1))));
        tbl[r][c] = base8[rr][cc];
      }
    }
    // 블록 칸은 0
    (stageCfg.initialBlocked||[]).forEach(({r,c})=>{
      if(r>=0 && r<ROWS && c>=0 && c<COLS) tbl[r][c] = 0;
    });
    return tbl;
  }
  const posW = buildPosWeights();

  /* ---------- 3. 휴리스틱 보조 함수 ---------- */
  const dirs=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const countDiscs = (b,p)=> b.flat().filter(v=>v===p).length;
  const countMob   = (b,p)=> api.getValidMoves(b,p).length;
  function countFront(b,p){
    let f=0;
    for(let r=0;r<ROWS;r++){
      for(let c=0;c<COLS;c++){
        if(b[r][c]!==p) continue;
        for(const [dr,dc] of dirs){
          const nr=r+dr,nc=c+dc;
          if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&b[nr][nc]===EMPTY){f++;break;}
        }
      }
    }
    return f;
  }

  /* ---------- 4. 평가 함수 ---------- */
  const WP=1, WM=5, WF=3, WD=2;
  function evaluate(b,me){
    const en=opp(me);
    let pos=0;
    for(let r=0;r<ROWS;r++)
      for(let c=0;c<COLS;c++){
        if(b[r][c]===me)      pos+=posW[r][c];
        else if(b[r][c]===en) pos-=posW[r][c];
      }
    const mob=countMob(b,me)-countMob(b,en);
    const fr =countFront(b,en)-countFront(b,me);
    const ds =countDiscs(b,me)-countDiscs(b,en);
    return WP*pos + WM*mob + WF*fr + WD*ds;
  }

  /* ---------- 5. 캐시 & 깊이·분기 정책 ---------- */
  const TT=new Map(), hash=(b,d,p)=>p+"|"+d+"|"+b.flat().join("");
  function depthPolicy(empty,tLeft){
    if(!isBig) return 6;
    if(tLeft<600) return 3;
    const ratio = empty / (ROWS*COLS);
    if(ratio>0.75) return 3;
    if(ratio>0.50) return 4;
    if(ratio>0.25) return 5;
    return 7;
  }
  function pruneMoves(mv){
    if(!isBig) return mv;
    return mv.map(m=>({...m,w:posW[m.row][m.col]}))
             .sort((a,b)=>b.w-a.w)
             .slice(0,6);
  }

  /* ---------- 6. Minimax + αβ ---------- */
  function minimax(bd,ply,a,b,cur,root){
    const k=hash(bd,ply,cur); if(TT.has(k)) return TT.get(k);
    if(ply===0){const v=evaluate(bd,root); TT.set(k,v); return v;}

    const moves=api.getValidMoves(bd,cur);
    if(!moves.length){
      const oppMoves=api.getValidMoves(bd,opp(cur));
      if(!oppMoves.length){const v=evaluate(bd,root); TT.set(k,v); return v;}
      const v=minimax(bd,ply-1,a,b,opp(cur),root); TT.set(k,v); return v;
    }

    let best;
    if(cur===root){
      best=-Infinity;
      for(const m of moves){
        const nb=api.simulateMove(bd,cur,m.row,m.col).resultingBoard;
        best=Math.max(best,minimax(nb,ply-1,a,b,opp(cur),root));
        if((a=Math.max(a,best))>=b) break;
      }
    }else{
      best=Infinity;
      for(const m of moves){
        const nb=api.simulateMove(bd,cur,m.row,m.col).resultingBoard;
        best=Math.min(best,minimax(nb,ply-1,a,b,opp(cur),root));
        if((b=Math.min(b,best))<=a) break;
      }
    }
    TT.set(k,best); return best;
  }

  /* ---------- 7. 전략 함수 ---------- */
  return function strategy(board,player,validMoves){
    if(!validMoves.length) return null;

    const start = performance.now();
    const timeLeft = TOTAL_BUDGET - timeUsed;
    const empty = board.flat().filter(v=>v===EMPTY).length;
    const maxD  = depthPolicy(empty,timeLeft);
    const cand  = pruneMoves(validMoves);

    let best=cand[0], bestV=-Infinity;
    for(let d=3; d<=maxD; d++){
      for(const mv of cand){
        const after=api.simulateMove(board,player,mv.row,mv.col).resultingBoard;
        const v=minimax(after,d-1,-1e9,1e9,opp(player),player);
        if(v>bestV){bestV=v; best=mv;}
      }
      if(performance.now()-start > timeLeft*0.6) break;
    }

    timeUsed += performance.now() - start;
    return best;
  };
}
