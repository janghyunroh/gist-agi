// 가능한 move 중 우선순위에 있는 것들 중에서 랜덤.

// Available variables:
// board: 8x8 array where 0=empty, 1=black, 2=white
// player: 1 for black, 2 for white
// getValidMoves(player): returns array of valid moves for player


const corners = [{row: 1, col: 1}, {row: 8, col: 1}, {row: 1, col: 8}, {row: 8, col: 8}]

const validMoves = getValidMoves(player);
if (validMoves.length === 0) return null;

const randomIndex = Math.floor(Math.random() * validMoves.length);

return validMoves[randomIndex];