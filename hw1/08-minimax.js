
// 

// Available variables:

// board: 8x8 array where 0=empty, 1=black, 2=white
// player: 1 for black, 2 for white
// getValidMoves(player): returns array of valid moves for player




function makeExpertAIMove(validMoves) {
    // Minimax algorithm implementation (depth 6)
    const MAX_DEPTH = 6;
    let bestScore = -Infinity;
    let bestMove = null;
    
    // Position weights (improved from hard level)
    const weights = [
        [120, -20, 20, 5, 5, 20, -20, 120],
        [-20, -40, -5, -5, -5, -5, -40, -20],
        [20, -5, 15, 3, 3, 15, -5, 20],
        [5, -5, 3, 3, 3, 3, -5, 5],
        [5, -5, 3, 3, 3, 3, -5, 5],
        [20, -5, 15, 3, 3, 15, -5, 20],
        [-20, -40, -5, -5, -5, -5, -40, -20],
        [120, -20, 20, 5, 5, 20, -20, 120]
    ];
    
    // Minimax algorithm
    function minimax(board, depth, alpha, beta, maximizingPlayer) {
        // Termination condition
        if (depth === 0) {
            // Board evaluation
            let score = 0;
            for (let row = 0; row < BOARD_SIZE; row++) {
                for (let col = 0; col < BOARD_SIZE; col++) {
                    if (board[row][col] === WHITE) {
                        score += weights[row][col];
                    } else if (board[row][col] === BLACK) {
                        score -= weights[row][col];
                    }
                }
            }
            return score;
        }
        
        // Get valid moves for current player
        const player = maximizingPlayer ? WHITE : BLACK;
        const currentValidMoves = [];
        
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (isValidMoveForMinimax(board, row, col, player)) {
                    currentValidMoves.push({ row, col });
                }
            }
        }
        
        // If no valid moves, pass turn to opponent
        if (currentValidMoves.length === 0) {
            // Recursive call with opponent player
            return minimax(board, depth - 1, alpha, beta, !maximizingPlayer);
        }
        
        if (maximizingPlayer) {
            let maxEval = -Infinity;
            for (const move of currentValidMoves) {
                // Copy the board
                const boardCopy = board.map(row => [...row]);
                
                // Simulate the move
                makeSimulatedMove(boardCopy, move.row, move.col, WHITE);
                
                // Recursive evaluation
                const eval = minimax(boardCopy, depth - 1, alpha, beta, false);
                maxEval = Math.max(maxEval, eval);
                
                // Alpha-beta pruning
                alpha = Math.max(alpha, eval);
                if (beta <= alpha)
                    break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of currentValidMoves) {
                // Copy the board
                const boardCopy = board.map(row => [...row]);
                
                // Simulate the move
                makeSimulatedMove(boardCopy, move.row, move.col, BLACK);
                
                // Recursive evaluation
                const eval = minimax(boardCopy, depth - 1, alpha, beta, true);
                minEval = Math.min(minEval, eval);
                
                // Alpha-beta pruning
                beta = Math.min(beta, eval);
                if (beta <= alpha)
                    break;
            }
            return minEval;
        }
    }
    
    // Function to check valid moves for minimax
    function isValidMoveForMinimax(board, row, col, player) {
        if (board[row][col] !== EMPTY) {
            return false;
        }
        
        const opponent = player === BLACK ? WHITE : BLACK;
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];
        
        for (const [dr, dc] of directions) {
            let r = row + dr;
            let c = col + dc;
            let foundOpponent = false;
            
            while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === opponent) {
                foundOpponent = true;
                r += dr;
                c += dc;
            }
            
            if (foundOpponent && r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
                return true;
            }
        }
        
        return false;
    }
    
    // Function to simulate moves for minimax
    function makeSimulatedMove(board, row, col, player) {
        board[row][col] = player;
        
        // Flip discs
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];
        
        directions.forEach(([dr, dc]) => {
            let r = row + dr;
            let c = col + dc;
            const discsToFlip = [];
            
            while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] !== EMPTY && board[r][c] !== player) {
                discsToFlip.push([r, c]);
                r += dr;
                c += dc;
            }
            
            if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
                discsToFlip.forEach(([fr, fc]) => {
                    board[fr][fc] = player;
                });
            }
        });
    }
    
    // Run minimax algorithm for each valid move
    for (const move of validMoves) {
        // Copy the board
        const boardCopy = board.map(row => [...row]);
        
        // Simulate the move
        makeSimulatedMove(boardCopy, move.row, move.col, WHITE);
        
        // Get minimax evaluation
        const score = minimax(boardCopy, MAX_DEPTH, -Infinity, Infinity, false);
        
        // Update best score
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }
    
    return bestMove || makeHardAIMove(validMoves);
}



const validMoves = getValidMoves(player);
return makeExpertAIMove(validMoves);