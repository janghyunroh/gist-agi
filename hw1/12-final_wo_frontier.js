/* 
Othello/Reversi minimax 알고리즘 수정 버전
1. 평가 함수에 metric 추가. 
 - 기존 expert의 evaluation metric에는 

*/

/** Given Global Varialbes
 * 1. player
 * 2. 
 */

/** Additional Global Variables
 * 1. directions matrix
 * 2. positionWeights matrix
 */
const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
];



/** Functions
 * 
 * 
 */
// 보드 깊은 복사 함수
function cloneBoard(bd) {
return bd.map(row => row.slice());
}

// 유효한 수 계산 함수: 현재 보드에서 플레이어 p가 둘 수 있는 모든 위치 반환
function computeValidMoves(bd, p) {
    const moves = [];
    for (let r = 0; r < bd.length; r++) {
        for (let c = 0; c < bd[0].length; c++) {
        if (bd[r][c] !== 0) continue;
        let valid = false;
        for (const [dr, dc] of directions) {
            let rTemp = r + dr, cTemp = c + dc;
            let foundOpp = false;
            while (rTemp >= 0 && rTemp < bd.length && cTemp >= 0 && cTemp < bd[0].length && bd[rTemp][cTemp] === 3 - p) {
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

/** 
 * 1. positionWeights
 * 2. countDisc: 
 * 3. countMobility
 * 4. countFrontier
 * 
 */

// 
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

// 평가 함수: 플레이어 aiPlayer 관점에서 보드 평가
function evaluateBoard(bd, aiPlayer) {

    const opp = 3 - aiPlayer;

    // 각 요소의 가중치(Tuning based on tournaments result)
    const W_POS = 1.0;
    const W_MOBILITY = 5.0;
    const W_FRONTIER = 3.0;
    const W_DISC = 2.0;

    //position score: (플레이어 모든 돌 가중치 합) - (상대 모든 돌 가중치 합)
    let posScore = 0;
    for (let r = 0; r < bd.length; r++) {
        for (let c = 0; c < bd[0].length; c++) {
            if (bd[r][c] === aiPlayer) posScore += positionWeights[r][c];
            else if (bd[r][c] === opp) posScore -= positionWeights[r][c];
        }
    }

    //moiblity score: (플레이어 착수 가능 수 개수) - (상대 착수 가능 수 개수)
    const mobilityScore = countMobility(bd, aiPlayer) - countMobility(bd, opp);

    //disc score: 
    const discScore = countDiscs(bd, aiPlayer) - countDiscs(bd, opp);

    return W_POS * posScore + W_MOBILITY * mobilityScore + W_DISC * discScore;
}

/** makeMyStrategyMove: 최종 착수 함수
 * 
 * @param {*} board 
 * @param {*} aiPlayer 
 * @returns 
 */
function makeMyStrategyMove(board, aiPlayer) {

    const MAX_DEPTH = 6;
    let bestScore = -Infinity;
    let bestMove = null;

    // minimax 함수: 현재 보드 상태를 평가하여 점수를 반환
    // currentPlayer: 이번 턴에 두는 플레이어
    function minimax(bd, depth, alpha, beta, currentPlayer) {
        // 기저 사례: 깊이 0이면 평가 함수 호출
        if (depth === 0) return evaluateBoard(bd, aiPlayer);
        
        let moves = computeValidMoves(bd, currentPlayer);
        // 만약 현재 플레이어가 둘 수 있는 수가 없으면, 상대 턴으로 넘김
        if (moves.length === 0) {
            const nextPlayer = (currentPlayer === aiPlayer ? (3 - aiPlayer) : aiPlayer);
            // 상대도 둘 수 없으면 종료 상태이므로 평가 함수 호출
            if (computeValidMoves(bd, nextPlayer).length === 0) {
                return evaluateBoard(bd, aiPlayer);
            }
            return minimax(bd, depth - 1, alpha, beta, nextPlayer);
        }
        
        const nextPlayer = (currentPlayer === aiPlayer ? (3 - aiPlayer) : aiPlayer);
        
        if (currentPlayer === aiPlayer) {
            // Maximizing player
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
        } 
        else {
            // Minimizing player
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

    const validMoves = computeValidMoves(board, aiPlayer);
    if (validMoves.length === 0) return null;

    // AI 턴에서는 가능한 모든 수에 대해 minimax 평가 후 최고 점수를 주는 수를 선택
    for (const move of validMoves) {
        let boardCopy = cloneBoard(board);
        simulateMove(boardCopy, move, aiPlayer);
        // 다음 턴은 상대 플레이어 (3 - aiPlayer)부터 시작
        const score = minimax(boardCopy, MAX_DEPTH, -Infinity, Infinity, 3 - aiPlayer);
        if (score > bestScore) {
        bestScore = score;
        bestMove = move;
        }
    }

    return bestMove;
}

// 최종 호출 예시:
// 전역 변수 board와 player(현재 AI의 돌 색)가 있다고 가정할 때:
return makeMyStrategyMove(board, player);
