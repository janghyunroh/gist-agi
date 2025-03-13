// 가능한 move 중 랜덤으로 하나를 return 하는 AI

// Available variables:
// board: 8x8 array where 0=empty, 1=black, 2=white
// player: 1 for black, 2 for white
// getValidMoves(player): returns array of valid moves for player


const validMoves = getValidMoves(player);
if (validMoves.length === 0) return null;

const randomIndex = Math.floor(Math.random() * validMoves.length);

return validMoves[randomIndex];