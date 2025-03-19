// 가능한 move 중 우선 순위에 있는 것 
// 우선순위가 같은 경우 나중에 고른 것

// Available variables:
// board: 8x8 array where 0=empty, 1=black, 2=white
// player: 1 for black, 2 for white
// getValidMoves(player): returns array of valid moves for player

// priorities
const proirities = [
    [100, 0,  50,   0,   0,  50, 0, 100],
    [  0, 0,   0,   0,   0,   0, 0,   0],
    [ 50, 0,  50,   0,   0,  50, 0,  50],
    [  0, 0,   0,   0,   0,   0, 0,   0],
    [  0, 0,   0,   0,   0,   0, 0,   0],
    [ 50, 0,  50,   0,   0,  50, 0,  50],
    [  0, 0,   0,   0,   0,   0, 0,   0],
    [100, 0,  50,   0,   0,  50, 0, 100]
];

// 유효 수 불러오기
const validMoves = getValidMoves(player);
if (validMoves.length === 0) return null;

// making decision

let maxPriority = -Infinity
let validmove = null
for(const move of validMoves){
    const positionPriority = proirities[move.row][move.col]
    if(positionPriority > maxPriority) {
        maxPriority = positionPriority
        validmove = move
    }
}

return validmove;

/**
 * 결과
 * random한테만 이기고 greedy한테조차 짐...
 * X, C를 아무 생각없이 먹음
 * 
 */