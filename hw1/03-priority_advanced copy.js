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
 * 다 이김! 흑/백 상관없이 모든 AI를 이겼음. 
 * X와 C를 끝까지 기피하는 것만으로 이 정도 승률이 나옴. 
 * 자기 자신과 붙이면 백이 무조건 이김. 근데 이건 알고리즘이 결정적이라 그럴 수도 있는 거 같음. 
 * 동일 priority에 대해 랜덤으로 선택하는 옵션을 둬보자!
 */