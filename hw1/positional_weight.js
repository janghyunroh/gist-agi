// Write your custom Othello strategy here
// Return an object with row and col properties, or null if no moves are possible
// Example: return { row: 3, col: 4 } or return null

// Available variables:
// board: 8x8 array where 0=empty, 1=black, 2=white
// player: 1 for black, 2 for white
// getValidMoves(player): returns array of valid moves for player

// Strategy: Find best move based on position value
const validMoves = getValidMoves(player);
if (validMoves.length === 0) return null;

// Position weights - corners are best, edges next, avoid squares next to corners
const positionWeights = [
    [90, -15, 10, 5, 5, 10, -15, 90],
    [-15, -25, -3, -3, -3, -3, -25, -15],
    [10, -3, 2, 1, 1, 2, -3, 10],
    [5, -3, 1, 1, 1, 1, -3, 5],
    [5, -3, 1, 1, 1, 1, -3, 5],
    [10, -3, 2, 1, 1, 2, -3, 10],
    [-15, -25, -3, -3, -3, -3, -25, -15],
    [90, -15, 10, 5, 5, 10, -15, 90]
];

let bestMove = null;
let bestScore = -Infinity;

for (const move of validMoves) {
    // Score based on position
    const positionScore = positionWeights[move.row][move.col];
    
    if (positionScore > bestScore) {
        bestScore = positionScore;
        bestMove = move;
    }
}

return bestMove;
            