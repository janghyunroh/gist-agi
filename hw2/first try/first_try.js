/**
 * Analyze the given stage and return a strategy function for that stage.
 * @param {string} stageName    - Name/ID of the stage (for reference or tuning).
 * @param {number} boardSize    - Board dimension (assumed square).
 * @param {Array<Array<number>>} boardMatrix - 2D array representing initial board state (0=empty, 1=Player1, 2=Player2, -1=blocked).
 * @param {Array} validMoves    - Initial valid moves array (each move could be [x,y] or similar coordinate).
 */
function analyzeStage(stageName, boardSize, boardMatrix, validMoves) {
    // 1. Compute positional weight matrix based on board structure
    const weights = Array.from({ length: boardSize }, () => Array(boardSize).fill(0));
    // Identify corners and edges considering blocked cells
    for (let i = 0; i < boardSize; i++) {
        for (let j = 0; j < boardSize; j++) {
            if (boardMatrix[i][j] === -1) continue; // skip blocked cells
            const topBlocked = (i === 0) || (boardMatrix[i-1][j] === -1);
            const bottomBlocked = (i === boardSize-1) || (boardMatrix[i+1][j] === -1);
            const leftBlocked = (j === 0) || (boardMatrix[i][j-1] === -1);
            const rightBlocked = (j === boardSize-1) || (boardMatrix[i][j+1] === -1);
            // Corner of playable area if two perpendicular adjacent sides are blocked/out of bounds
            if ((topBlocked && leftBlocked) || (topBlocked && rightBlocked) ||
                (bottomBlocked && leftBlocked) || (bottomBlocked && rightBlocked)) {
                weights[i][j] += 100;  // assign high corner weight
            }
            // Edge position if one side is blocked/out of bounds (and not already a corner)
            else if (topBlocked || bottomBlocked || leftBlocked || rightBlocked) {
                weights[i][j] += 20;   // moderate edge weight
            }
        }
    }
    // Penalize X-square positions (diagonal adjacent to corners that are playable)
    const cornerCoords = [[0,0], [0, boardSize-1], [boardSize-1, 0], [boardSize-1, boardSize-1]];
    cornerCoords.forEach(([ci, cj]) => {
        if (ci < 0 || cj < 0 || ci >= boardSize || cj >= boardSize) return;
        if (boardMatrix[ci][cj] === 0) {
            // corner is empty and playable (not blocked), identify X-squares
            const xSquares = [[ci+1, cj+1], [ci+1, cj-1], [ci-1, cj+1], [ci-1, cj-1]];
            xSquares.forEach(([xi, xj]) => {
                if (xi >= 0 && xi < boardSize && xj >= 0 && xj < boardSize) {
                    if (boardMatrix[xi][xj] === 0) {
                        // Give a strong negative weight early in the game
                        weights[xi][xj] -= 50;
                    }
                }
            });
        }
    });
    // (Additional tuning: adjust weights for C-squares, interior, etc., as needed)

    // 2. Define the strategy function using the computed weights
    function studentStrategy(board, player, validMoves, makeMove) {
        let bestMove = null;
        let bestScore = -Infinity;
        // Determine opponent's ID (assuming 1 or 2)
        const opponent = (player === 1 ? 2 : 1);

        for (const move of validMoves) {
            const [x, y] = move;
            // Simulate the move on a copy of the board
            const newBoard = simulateMove(board, player, x, y);
            // Compute heuristic score for this move
            let score = 0;
            // (a) Positional weights score: sum weights for player's pieces minus opponent's
            for (let i = 0; i < boardSize; i++) {
                for (let j = 0; j < boardSize; j++) {
                    if (newBoard[i][j] === player) score += weights[i][j];
                    else if (newBoard[i][j] === opponent) score -= weights[i][j];
                }
            }
            // (b) Mobility score: difference in number of moves next turn
            const myMovesNext = countValidMoves(newBoard, player).length;
            const oppMovesNext = countValidMoves(newBoard, opponent).length;
            // Since opponent moves next, we prioritize minimizing oppMoves
            score += (myMovesNext - oppMovesNext) * 5;
            // (c) Corner capture bonus or X-square penalty (already mostly handled by weights)
            if (weights[x][y] > 80) {
                score += 50; // if move itself is a corner, big bonus
            }
            // (d) Additional heuristic checks (e.g., avoid move that gives opponent corner)
            // If our move makes a corner available to opponent, apply penalty:
            if (willGiveOpponentCorner(newBoard, opponent)) {
                score -= 100;
            }

            // Choose the move with the highest score
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        // Return the chosen move using makeMove callback
        if (bestMove) {
            return makeMove(bestMove);
        } else {
            // If somehow no move is chosen (shouldn't happen if validMoves not empty)
            return makeMove(validMoves[0]);
        }
    }

    // Return the strategy function for this stage
    return studentStrategy;
}

// Helper: simulate the given move and return the new board state
function simulateMove(board, player, x, y) {
    const newBoard = board.map(row => [...row]);  // shallow copy 2D array
    newBoard[x][y] = player;
    // Flip opponent pieces along all 8 directions
    const opponent = (player === 1 ? 2 : 1);
    const directions = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
    for (const [dx, dy] of directions) {
        let nx = x + dx, ny = y + dy;
        let toFlip = [];
        // Traverse in this direction
        while (nx >= 0 && nx < board.length && ny >= 0 && ny < board.length && newBoard[nx][ny] === opponent) {
            toFlip.push([nx, ny]);
            nx += dx; ny += dy;
        }
        // If we ended with a player disk, flip all in between
        if (nx >= 0 && nx < board.length && ny >= 0 && ny < board.length && newBoard[nx][ny] === player) {
            for (const [fx, fy] of toFlip) {
                newBoard[fx][fy] = player;
            }
        }
    }
    return newBoard;
}

// Helper: count valid moves for a given board state and player
function countValidMoves(board, player) {
    const opponent = (player === 1 ? 2 : 1);
    const validMoves = [];
    const size = board.length;
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            if (board[i][j] !== 0) continue; // skip non-empty
            // Check if placing here flips at least one opponent piece
            let canFlip = false;
            for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) {
                let nx = i + dx, ny = j + dy;
                let seenOpp = false;
                // traverse direction
                while (nx >= 0 && nx < size && ny >= 0 && ny < size && board[nx][ny] === opponent) {
                    seenOpp = true;
                    nx += dx; ny += dy;
                }
                if (seenOpp && nx >= 0 && nx < size && ny >= 0 && ny < size && board[nx][ny] === player) {
                    canFlip = true;
                    break;
                }
            }
            if (canFlip) validMoves.push([i, j]);
        }
    }
    return validMoves;
}

// Helper: check if a board state gives opponent a new corner opportunity
function willGiveOpponentCorner(board, opponent) {
    const size = board.length;
    const opponentMoves = countValidMoves(board, opponent);
    for (const [x, y] of opponentMoves) {
        // If any opponent move is a corner position
        if ((x === 0 && y === 0) || (x === 0 && y === size-1) ||
            (x === size-1 && y === 0) || (x === size-1 && y === size-1)) {
            return true;
        }
    }
    return false;
}

return analyzeStage;
