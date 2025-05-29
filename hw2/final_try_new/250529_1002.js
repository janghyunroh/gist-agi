/*
 * Othello Intelligent System
 * Fixed: custom evaluation uses passed W and api to avoid undefined W
 */

const CONFIG = {
  randomSimulations: 200,
  pvDepthStart: 6,
  pvLimitMoves: 2,
  mctsThresholdBF: 3,
  maxMoveTime: 200,
  gameTimeLimit: 10000
};

function analyzeStage(stageConfig, initialBoard, validMoves, api) {
  const N = stageConfig.boardSize;

  // Rule probing
  const flags = probeRules(stageConfig, initialBoard, api);
  // Positional weights
  const W = basePositionWeights(N, flags, stageConfig.initialBlocked);

  // Build opening PV for both players
  const startAnalysis = performance.now();
  const deadlineAnalysis = startAnalysis + 60000;
  const initMoves = {1: validMoves, 2: api.getValidMoves(initialBoard,2)};
  const pvMap = {1:[],2:[]};
  for (const pl of [1,2]) {
    const fullPV = fullTimePVSearch(initialBoard, pl, initMoves[pl], api, W, deadlineAnalysis);
    pvMap[pl] = extractMyPV(fullPV, pl).slice(0, CONFIG.pvLimitMoves);
  }

  // Transposition table
  const tt = new Map();
  function ttGet(key, depth) { const e=tt.get(key); return e && e.depth>=depth?e.score:null; }
  function ttSet(key, score, depth) { tt.set(key,{score,depth}); }

  // Game time
  let timeUsed=0;
  const pvIndex={1:0,2:0};

  return function strategy(board, player, validMoves) {
    if (!validMoves.length) return null;
    const t0 = performance.now();
    const rem = Math.max(CONFIG.gameTimeLimit - timeUsed,0);
    const empties = board.flat().filter(c=>c===0).length;
    const budget = Math.min(CONFIG.maxMoveTime, rem/Math.max(empties,1));
    const deadlineMove = t0 + budget;

    // PV
    const list = pvMap[player]||[];
    const i = pvIndex[player]++;
    if (i<list.length) {
      const mv = list[i];
      if (validMoves.some(m=>m.row===mv.row&&m.col===mv.col)){
        timeUsed += performance.now()-t0;
        return mv;
      }
    }

    // Search fallback
    let bestMove=null;
    if (validMoves.length<=CONFIG.mctsThresholdBF) {
      bestMove = iddfsAlphaBeta(board, player, validMoves, api, W, tt, CONFIG.pvDepthStart, deadlineMove);
    } else {
      bestMove = mctsSearch(board, player, validMoves, api, W, deadlineMove);
    }

    timeUsed += performance.now()-t0;
    return bestMove||validMoves[0];
  };
}

// Helpers
const directions=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
function extractMyPV(fullPV,player){const off=player===1?0:1;return fullPV.filter((_,i)=>i%2===off);}  
function probeRules(sc,bd,api){const f={allowOnBlocked:false,fewerContinue:false};(sc.initialBlocked||[]).some(b=>{if(api.simulateMove(bd,1,b.r,b.c).valid){f.allowOnBlocked=true;return true;}});const t=bd.map(r=>[...r]);let rem=0;for(let i=0;i<t.length&&rem<t.length*t.length-1;i++)for(let j=0;j<t.length&&rem<t.length*t.length-1;j++)if(t[i][j]===1){t[i][j]=0;rem++;}f.fewerContinue=api.getValidMoves(t,1).length>0;return f;}
function basePositionWeights(N,flags,blocked){const W=Array.from({length:N},(_,i)=>Array.from({length:N},(_,j)=>{if((i===0||i===N-1)&&(j===0||j===N-1))return 120;if(i===0||i===N-1||j===0||j===N-1)return 20;return 5;}));if(!flags.allowOnBlocked)(blocked||[]).forEach(b=>{if(b.r>=0&&b.r<N&&b.c>=0&&b.c<N)W[b.r][b.c]=-Infinity;});return W;}
function fullTimePVSearch(bd,pl,mv,api,W,dl){let bestPV=[];let d=CONFIG.pvDepthStart;const ttPV=new Map();while(performance.now()<dl){const r=alphaBetaPV(bd,pl,d,-Infinity,Infinity,api,W,ttPV,dl);if(r.pv.length>bestPV.length)bestPV=r.pv.slice();d++;}return bestPV;}
function alphaBetaPV(bd,pl,depth,alpha,beta,api,W,ttPV,dl){if(performance.now()>=dl)return{score:0,pv:[]};const key=boardToKey(bd)+'|'+pl+'|'+depth;if(ttPV.has(key))return ttPV.get(key);const moves=api.getValidMoves(bd,pl);if(depth===0||!moves.length){const sc=evaluateCustom(bd,pl,W,api);return{score:sc,pv:[]};}let bestScore=pl===1?-Infinity:Infinity;let bestPV=[];for(const m of moves){if(performance.now()>=dl)break;const res=api.simulateMove(bd,pl,m.row,m.col);if(!res.valid)continue;const child=alphaBetaPV(res.resultingBoard,3-pl,depth-1,alpha,beta,api,W,ttPV,dl);if((pl===1&&child.score>bestScore)||(pl===2&&child.score<bestScore)){bestScore=child.score;bestPV=[m,...child.pv];}alpha=pl===1?Math.max(alpha,child.score):alpha;beta=pl===2?Math.min(beta,child.score):beta;if(beta<=alpha)break;}const out={score:bestScore,pv:bestPV};ttPV.set(key,out);return out;}
function iddfsAlphaBeta(bd,pl,mv,api,W,tt,initDepth,dl){let bestMv=mv[0];let d=initDepth;while(performance.now()<dl){const res=alphaBeta(bd,pl,d,-Infinity,Infinity,api,W,tt,dl);if(res.move)bestMv=res.move;d++;}return bestMv;}
function alphaBeta(bd,pl,depth,alpha,beta,api,W,tt,dl){if(performance.now()>=dl)return{score:0,move:null};const key=boardToKey(bd)+'|'+pl+'|'+depth;const c=ttGet(key,depth);if(c!==null)return{score:c,move:null};const moves=api.getValidMoves(bd,pl);if(depth===0||!moves.length){const sc=evaluateCustom(bd,pl,W,api);return{score:sc,move:null};}let bestMv=null;let bestSc=pl===1?-Infinity:Infinity;for(const m of moves){if(performance.now()>=dl)break;const res=api.simulateMove(bd,pl,m.row,m.col);if(!res.valid)continue;const child=alphaBeta(res.resultingBoard,3-pl,depth-1,alpha,beta,api,W,tt,dl);if((pl===1&&child.score>bestSc)||(pl===2&&child.score<bestSc)){bestSc=child.score;bestMv=m;}alpha=pl===1?Math.max(alpha,child.score):alpha;beta=pl===2?Math.min(beta,child.score):beta;if(beta<=alpha)break;}ttSet(key,bestSc,depth);return{score:bestSc,move:bestMv};}
function defaultPolicy(node,api,W){let b=node.board.map(r=>[...r]);let p=node.player;for(let i=0;i<20;i++){const ms=api.getValidMoves(b,p);if(!ms.length)break;const m=ms[Math.floor(Math.random()*ms.length)];const res=api.simulateMove(b,p,m.row,m.col);b=res.resultingBoard;p=3-p;}return evaluateCustom(b,node.player,W,api);}function backup(node,r){while(node){node.visits++;node.wins+=r;node=node.parent;}}class MCTSNode{constructor(b,p,m=null,pr=null){this.board=b;this.player=p;this.move=m;this.parent=pr;this.children=[];this.visits=0;this.wins=0;}isLeaf(){return this.children.length===0;}}function expand(n,api){const ms=api.getValidMoves(n.board,n.player);for(const m of ms){const r=api.simulateMove(n.board,n.player,m.row,m.col);if(!r.valid)continue;n.children.push(new MCTSNode(r.resultingBoard,3-n.player,m,n));}}function bestUCT(n){const C=Math.sqrt(2);let best=null,bv=-Infinity;for(const c of n.children){const u=(c.wins/(c.visits+1))+C*Math.sqrt(Math.log(n.visits+1)/(c.visits+1));if(u>bv){bv=u;best=c;}}return best;}function treePolicy(n,api){while(true){const ms=api.getValidMoves(n.board,n.player);if(!ms.length) return n;if(n.isLeaf()){expand(n,api);if(!n.children.length)return n;return n.children[0];}const nxt=bestUCT(n);if(!nxt)return n;n=nxt;}}function mctsSearch(bd,pl,mv,api,W,dl){const root=new MCTSNode(bd,pl);while(performance.now()<dl){const leaf=treePolicy(root,api);const r=defaultPolicy(leaf,api,W);backup(leaf,r);}let best=null;let maxV=-1;for(const c of root.children)if(c.visits>maxV){maxV=c.visits;best=c;}return best?best.move:mv[0];}
// Custom evaluation & helpers
function evaluateCustom(bd,player,W,api){const opp=3-player;let pos=0;for(let i=0;i<bd.length;i++)for(let j=0;j<bd.length;j++){if(bd[i][j]===player)pos+=W[i][j];else if(bd[i][j]===opp)pos-=W[i][j];}const mob=countMobility(bd,player,api)-countMobility(bd,opp,api);const fro=countFrontier(bd,opp)-countFrontier(bd,player);const disc=countDiscs(bd,player)-countDiscs(bd,opp);const W_POS=1,W_MOB=5,W_FRO=3,W_DIS=2;return W_POS*pos+W_MOB*mob+W_FRO*fro+W_DIS*disc;}function countDiscs(bd,p){let c=0;bd.forEach(r=>r.forEach(v=>{if(v===p)c++;}));return c;}function countMobility(bd,p,api){return api.getValidMoves(bd,p).length;}function countFrontier(bd,p){let f=0;for(let i=0;i<bd.length;i++)for(let j=0;j<bd.length;j++){if(bd[i][j]!==p)continue;for(const[dr,dc]of directions){const ni=i+dr,nj=j+dc;if(ni>=0&&ni<bd.length&&nj>=0&&nj<bd.length&&bd[ni][nj]===0){f++;break;}}}return f;}function boardToKey(bd){return bd.flat().join(',');}

// Export
if(typeof module!=='undefined') module.exports={analyzeStage};
