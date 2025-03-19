// 가능한 move 중 우선 순위에 있는 것 
// 우선순위가 같은 경우 나중에 고른 것

// Available variables:
// board: 8x8 array where 0=empty, 1=black, 2=white
// player: 1 for black, 2 for white
// getValidMoves(player): returns array of valid moves for player

// priorities
// X, C 칸을 기피하는 가중치 추가
const proirities = [
    [ 2, -1,  1,   1,   1,  1,  -1,   2],
    [-1, -1,  0,   0,   0,  0,  -1,  -1],
    [ 1,  0,  0,   0,   0,  0,   0,   1],
    [ 1,  0,  0,   0,   0,  0,   0,   1],
    [ 1,  0,  0,   0,   0,  0,   0,   1],
    [ 1,  0,  0,   0,   0,  0,   0,   1],
    [-1, -1,  0,   0,   0,  0,  -1,  -1],
    [ 2, -1,  1,   1,   1,  1,  -1,   2]
];

// 유효 수 불러오기
const validMoves = getValidMoves(player);
if (validMoves.length === 0) return null;

// making decision

let maxPriority = -Infinity
let validmove = []
for(const move of validMoves){
    const positionPriority = proirities[move.row][move.col]
    if(positionPriority > maxPriority) {
        maxPriority = positionPriority
        validmove.length = 0
        validmove.push(move)
    }
    else if(positionPriority == maxPriority) {
        validmove.push(move)
    }
}

const randomIndex = Math.floor(Math.random() * validmove.length);
return validmove[randomIndex];

/**
 * 결과: 
 */