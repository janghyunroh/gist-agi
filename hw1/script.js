// Othello (Reversi) AI implementation with the described strategy.
const SIZE = 8;

// 위치 가중치 매트릭스: 코너는 높은 값, 코너 인접 위험 지역은 음수 값, 가장자리와 중앙은 적절한 값.
const weightMatrix = [
    [120, -20,  20,   5,   5,  20, -20, 120],
    [-20, -40,  -5,  -5,  -5,  -5, -40, -20],
    [ 20,  -5,  15,   3,   3,  15,  -5,  20],
    [  5,  -5,   3,   3,   3,   3,  -5,   5],
    [  5,  -5,   3,   3,   3,   3,  -5,   5],
    [ 20,  -5,  15,   3,   3,  15,  -5,  20],
    [-20, -40,  -5,  -5,  -5,  -5, -40, -20],
    [120, -20,  20,   5,   5,  20, -20, 120]
];

// 8방향 이동을 나타내는 델타 (상,하,좌,우 및 대각선).
const directions = [
    [-1,  0], [1,  0], [0, -1], [0,  1],
    [-1, -1], [-1,  1], [1, -1], [1,  1]
];

// 현재 플레이어가 놓을 수 있는 모든 합법적인 수를 반환.
function getValidMoves(board, player) {
    const moves = [];
    for (let x = 0; x < SIZE; x++) {
        for (let y = 0; y < SIZE; y++) {
            if (board[x][y] !== 0) continue;  // 빈 칸만 체크
            const flips = getFlipsForMove(board, x, y, player);
            if (flips.length > 0) {
                moves.push({ x: x, y: y, flips: flips });
            }
        }
    }
    return moves;
}

// (x, y)에 `player`가 돌을 놓았을 때 뒤집히는 상대 돌들의 좌표 목록을 반환. 유효하지 않은 수면 빈 배열 반환.
function getFlipsForMove(board, x, y, player) {
    if (board[x][y] !== 0) return [];
    const opponent = -player;
    const flips = [];
    for (const [dx, dy] of directions) {
        let nx = x + dx;
        let ny = y + dy;
        const lineFlips = [];
        // 상대 돌이 연속되는 동안 전진
        while (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE && board[nx][ny] === opponent) {
            lineFlips.push([nx, ny]);
            nx += dx;
            ny += dy;
        }
        // 연속된 상대 돌 뒤에 자신의 돌이 있으면 유효한 방향
        if (lineFlips.length > 0 && nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE && board[nx][ny] === player) {
            flips.push(...lineFlips);
        }
    }
    return flips;
}

// 주어진 수를 보드에 적용하여 새로운 보드 상태를 반환.
function applyMove(board, move, player) {
    const { x, y, flips } = move;
    const newBoard = board.map(row => row.slice());  // 보드 복제
    newBoard[x][y] = player;
    for (const [fx, fy] of flips) {
        newBoard[fx][fy] = player;
    }
    return newBoard;
}

// 평가 함수: `player` 입장에서 현재 보드의 점수를 계산.
// 위치 가중치, 모빌리티(이동 가능 수 차), 코너 점유, 디스크 개수 차이를 고려.
function evaluateBoard(board, player) {
    const opponent = -player;
    // 이동 가능 수 계산
    const playerMoves = getValidMoves(board, player);
    const opponentMoves = getValidMoves(board, opponent);
    // 양 플레이어 모두 움직일 수 없으면 게임 종료 상태 -> 최종 점수 평가
    if (playerMoves.length === 0 && opponentMoves.length === 0) {
        let playerDiscs = 0, oppDiscs = 0;
        for (let i = 0; i < SIZE; i++) {
            for (let j = 0; j < SIZE; j++) {
                if (board[i][j] === player) playerDiscs++;
                else if (board[i][j] === opponent) oppDiscs++;
            }
        }
        if (playerDiscs > oppDiscs) return 10000;    // 승리
        if (playerDiscs < oppDiscs) return -10000;   // 패배
        return 0;                                    // 무승부
    }
    // 위치 가중치 합 및 돌 개수 계산
    let weightScore = 0;
    let playerDiscs = 0, oppDiscs = 0;
    for (let i = 0; i < SIZE; i++) {
        for (let j = 0; j < SIZE; j++) {
            const piece = board[i][j];
            if (piece === 0) continue;
            if (piece === player) playerDiscs++;
            else if (piece === opponent) oppDiscs++;
            // 자신의 돌이면 가중치 더하고, 상대 돌이면 가중치 뺌
            weightScore += piece * player * weightMatrix[i][j];
        }
    }
    // 코너 점유 개수 계산
    const cornerPositions = [ [0,0], [0,7], [7,0], [7,7] ];
    let playerCorners = 0, oppCorners = 0;
    for (const [cx, cy] of cornerPositions) {
        if (board[cx][cy] === player) playerCorners++;
        else if (board[cx][cy] === opponent) oppCorners++;
    }
    // 모빌리티: 이동 가능 수 차이
    const mobilityScore = playerMoves.length - opponentMoves.length;
    // 디스크 개수 차이 (코인 파리티)
    const discDiff = playerDiscs - oppDiscs;
    // 코너 점유 차이
    const cornerDiff = playerCorners - oppCorners;
    // 가중치 설정: 모빌리티에 적당한 가중치 부여, 게임 진행 상황에 따라 디스크 개수 차이 가중치 조절
    const mobilityWeight = 5;
    const totalDiscs = playerDiscs + oppDiscs;
    let discWeight;
    if (totalDiscs > 50) {        // 후반: 빈 칸 적음 -> 디스크 우위 중요
        discWeight = 2;
    } else if (totalDiscs > 20) { // 중반: 약하게 반영
        discWeight = 1;
    } else {                      // 초반: 디스크 개수 우위는 중요하지 않음 (오히려 불리할 수도)
        discWeight = 0;
    }
    const cornerWeight = 25;  // 코너는 이미 weightScore에 반영되어 있으므로 추가 보너스를 작게 부여
    // 최종 평가값 계산
    const score = weightScore 
                + mobilityWeight * mobilityScore 
                + discWeight * discDiff 
                + cornerWeight * cornerDiff;
    return score;
}

// 알파-베타 가지치기와 Minimax를 사용하여 최적 수의 점수를 계산.
function alphaBeta(board, depth, alpha, beta, currentPlayer, maxPlayer) {
    const opponent = -currentPlayer;
    const moves = getValidMoves(board, currentPlayer);
    // 깊이 제한에 도달하거나 (탐색 깊이 0) 혹은 현재 턴에 수가 없을 경우 평가
    if (depth === 0 || moves.length === 0) {
        if (moves.length === 0) {
            // 현재 플레이어가 둘 곳이 없으면 패스 또는 게임 종료 검사
            const oppMoves = getValidMoves(board, opponent);
            if (oppMoves.length === 0) {
                // 양측 모두 둘 수 없으면 게임 종료
                return evaluateBoard(board, maxPlayer);
            }
            // 현재 플레이어는 둘 수 없지만 게임이 끝나지 않으면 패스 처리 (깊이 유지)
            return alphaBeta(board, depth, alpha, beta, opponent, maxPlayer);
        }
        // 깊이 제한 도달
        return evaluateBoard(board, maxPlayer);
    }
    if (currentPlayer === maxPlayer) {
        // 최대화 단계 (AI 턴)
        let maxEval = -Infinity;
        // 코너 수를 우선 탐색하도록 정렬
        moves.sort((a, b) => {
            const aCorner = ( (a.x === 0 || a.x === 7) && (a.y === 0 || a.y === 7) );
            const bCorner = ( (b.x === 0 || b.x === 7) && (b.y === 0 || b.y === 7) );
            return (aCorner === bCorner) ? 0 : (aCorner ? -1 : 1);
        });
        for (const move of moves) {
            const newBoard = applyMove(board, move, currentPlayer);
            const evalScore = alphaBeta(newBoard, depth - 1, alpha, beta, opponent, maxPlayer);
            if (evalScore > maxEval) maxEval = evalScore;
            if (evalScore > alpha) alpha = evalScore;
            if (alpha >= beta) break;  // 가지치기
        }
        return maxEval;
    } else {
        // 최소화 단계 (상대 턴)
        let minEval = Infinity;
        moves.sort((a, b) => {
            const aCorner = ( (a.x === 0 || a.x === 7) && (a.y === 0 || a.y === 7) );
            const bCorner = ( (b.x === 0 || b.x === 7) && (b.y === 0 || b.y === 7) );
            return (aCorner === bCorner) ? 0 : (aCorner ? -1 : 1);
        });
        for (const move of moves) {
            const newBoard = applyMove(board, move, currentPlayer);
            const evalScore = alphaBeta(newBoard, depth - 1, alpha, beta, opponent, maxPlayer);
            if (evalScore < minEval) minEval = evalScore;
            if (evalScore < beta) beta = evalScore;
            if (alpha >= beta) break;
        }
        return minEval;
    }
}

// 주어진 보드와 플레이어에 대해 최적의 수를 찾는 함수.
// 코너 수가 있으면 즉시 선택하고, 그렇지 않으면 알파-베타 탐색으로 최선 수를 결정.
function findBestMove(board, player) {
    const moves = getValidMoves(board, player);
    if (moves.length === 0) {
        return null;  // 둘 수 있는 곳이 없으면 패스
    }
    // 코너 수가 가능한 경우 최우선 선택
    for (const move of moves) {
        if ((move.x === 0 || move.x === SIZE-1) && (move.y === 0 || move.y === SIZE-1)) {
            return { x: move.x, y: move.y };
        }
    }
    // 알파-베타 탐색으로 최적 수 결정
    const maxDepth = 5;  // 탐색 깊이 제한 (성능에 따라 조절 가능)
    let bestScore = -Infinity;
    let bestMove = null;
    for (const move of moves) {
        const newBoard = applyMove(board, move, player);
        const score = alphaBeta(newBoard, maxDepth - 1, -Infinity, Infinity, -player, player);
        if (score > bestScore) {
            bestScore = score;
            bestMove = { x: move.x, y: move.y };
        }
    }
    return bestMove;
}
