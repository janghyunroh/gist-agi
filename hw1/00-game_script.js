// Game constants
const BOARD_SIZE = 8;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

// Game state
let board = [];
let currentPlayer = BLACK;
let gameHistory = [];
let aiThinking = false;

// DOM elements
const boardElement = document.getElementById('board');
const statusElement = document.getElementById('status');
const blackScoreElement = document.getElementById('black-score');
const whiteScoreElement = document.getElementById('white-score');
const newGameButton = document.getElementById('new-game');
const undoButton = document.getElementById('undo');
const aiLevelSelect = document.getElementById('ai-level');

// Create the board cells
function createBoard() {
    boardElement.innerHTML = '';
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            cell.addEventListener('click', () => handleCellClick(row, col));
            boardElement.appendChild(cell);
        }
    }
}

// Initialize a new game
function initGame() {
    // Create an empty board
    board = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(EMPTY));
    
    // Place the initial four discs
    board[3][3] = WHITE;
    board[3][4] = BLACK;
    board[4][3] = BLACK;
    board[4][4] = WHITE;
    
    currentPlayer = BLACK;
    gameHistory = [];
    updateBoard();
    updateStatus();
    undoButton.disabled = true;
}

// Update the visual board based on the game state
function updateBoard() {
    // Update the cells
    const cells = boardElement.querySelectorAll('.cell');
    cells.forEach(cell => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        cell.innerHTML = '';
        cell.className = 'cell';
        
        if (board[row][col] === BLACK) {
            const disc = document.createElement('div');
            disc.className = 'disc black';
            cell.appendChild(disc);
        } else if (board[row][col] === WHITE) {
            const disc = document.createElement('div');
            disc.className = 'disc white';
            cell.appendChild(disc);
        }
    });
    
    // Highlight valid moves
    if (currentPlayer === BLACK) {
        const validMoves = getValidMoves(BLACK);
        validMoves.forEach(move => {
            const cell = boardElement.querySelector(`[data-row="${move.row}"][data-col="${move.col}"]`);
            cell.classList.add('valid');
        });
    }
    
    // Update scores
    const scores = countDiscs();
    blackScoreElement.textContent = scores.black;
    whiteScoreElement.textContent = scores.white;
}

// Update the game status message
function updateStatus() {
    const blackValidMoves = getValidMoves(BLACK);
    const whiteValidMoves = getValidMoves(WHITE);
    
    if (blackValidMoves.length === 0 && whiteValidMoves.length === 0) {
        // Game over
        const scores = countDiscs();
        if (scores.black > scores.white) {
            statusElement.textContent = 'Game over. Black wins!';
            statusElement.style.backgroundColor = '#333';
        } else if (scores.white > scores.black) {
            statusElement.textContent = 'Game over. White wins!';
            statusElement.style.backgroundColor = '#999';
        } else {
            statusElement.textContent = 'Game over. It\'s a tie!';
            statusElement.style.backgroundColor = '#666';
        }
    } else if (currentPlayer === BLACK && blackValidMoves.length === 0) {
        // Black has no moves
        currentPlayer = WHITE;
        statusElement.textContent = 'Black has no valid moves. White\'s turn.';
        statusElement.style.backgroundColor = '#999';
        setTimeout(makeAIMove, 1000);
    } else if (currentPlayer === WHITE && whiteValidMoves.length === 0) {
        // White has no moves
        currentPlayer = BLACK;
        statusElement.textContent = 'White has no valid moves. Black\'s turn.';
        statusElement.style.backgroundColor = '#333';
    } else {
        // Normal turn
        if (currentPlayer === BLACK) {
            statusElement.textContent = 'Black\'s turn';
            statusElement.style.backgroundColor = '#333';
        } else {
            statusElement.textContent = 'White\'s turn (AI is thinking...)';
            statusElement.style.backgroundColor = '#999';
            if (!aiThinking) {
                aiThinking = true;
                setTimeout(makeAIMove, 1000);
            }
        }
    }
}

// Handle a cell click
function handleCellClick(row, col) {
    if (aiThinking || currentPlayer !== BLACK) return;
    
    if (isValidMove(row, col, BLACK)) {
        // Save the current state for undo
        saveGameState();
        
        // Make the move
        makeMove(row, col, BLACK);
        currentPlayer = WHITE;
        updateBoard();
        updateStatus();
        undoButton.disabled = false;
    }
}

// Make a move
function makeMove(row, col, player) {
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

// Check if a move is valid
function isValidMove(row, col, player) {
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

// Get all valid moves for a player
function getValidMoves(player) {
    const validMoves = [];
    
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (isValidMove(row, col, player)) {
                validMoves.push({ row, col });
            }
        }
    }
    
    return validMoves;
}

// Count the number of discs for each player
function countDiscs() {
    let black = 0;
    let white = 0;
    
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col] === BLACK) {
                black++;
            } else if (board[row][col] === WHITE) {
                white++;
            }
        }
    }
    
    return { black, white };
}

// Save the current game state for undo
function saveGameState() {
    const boardCopy = board.map(row => [...row]);
    gameHistory.push({
        board: boardCopy,
        currentPlayer: currentPlayer
    });
}

// Undo the last move
function undoMove() {
    if (gameHistory.length === 0) return;
    
    const lastState = gameHistory.pop();
    board = lastState.board;
    currentPlayer = lastState.currentPlayer;
    aiThinking = false;
    
    updateBoard();
    updateStatus();
    
    if (gameHistory.length === 0) {
        undoButton.disabled = true;
    }
}

// AI Move Logic
function makeAIMove() {
    if (currentPlayer !== WHITE) {
        aiThinking = false;
        return;
    }
    
    const validMoves = getValidMoves(WHITE);
    if (validMoves.length === 0) {
        currentPlayer = BLACK;
        aiThinking = false;
        updateStatus();
        return;
    }
    
    // Choose a move based on AI level
    let move;
    const aiLevel = aiLevelSelect.value;
    
    switch (aiLevel) {
        case 'easy':
            move = makeEasyAIMove(validMoves);
            break;
        case 'medium':
            move = makeMediumAIMove(validMoves);
            break;
        case 'hard':
            move = makeHardAIMove(validMoves);
            break;
        case 'expert':
            move = makeExpertAIMove(validMoves);
            break;
        default:
            move = makeMediumAIMove(validMoves);
    }
    
    // Save the current state for undo
    saveGameState();
    
    // Make the move
    makeMove(move.row, move.col, WHITE);
    currentPlayer = BLACK;
    aiThinking = false;
    
    updateBoard();
    updateStatus();
    undoButton.disabled = false;
}

// Easy AI: Random move
function makeEasyAIMove(validMoves) {
    const randomIndex = Math.floor(Math.random() * validMoves.length);
    return validMoves[randomIndex];
}

// Medium AI: Prioritize corners and edges
function makeMediumAIMove(validMoves) {
    // Check for corner moves
    for (const move of validMoves) {
        if ((move.row === 0 || move.row === 7) && (move.col === 0 || move.col === 7)) {
            return move;
        }
    }
    
    // Check for edge moves
    const edgeMoves = validMoves.filter(move => 
        move.row === 0 || move.row === 7 || move.col === 0 || move.col === 7
    );
    
    if (edgeMoves.length > 0) {
        const randomIndex = Math.floor(Math.random() * edgeMoves.length);
        return edgeMoves[randomIndex];
    }
    
    // Otherwise, choose a random move
    return makeEasyAIMove(validMoves);
}

// Hard AI: Use a simple evaluation function
function makeHardAIMove(validMoves) {
    let bestScore = -Infinity;
    let bestMove = null;
    
    // Weights for different positions
    const weights = [
        [100, -20, 10, 5, 5, 10, -20, 100],
        [-20, -50, -2, -2, -2, -2, -50, -20],
        [10, -2, -1, -1, -1, -1, -2, 10],
        [5, -2, -1, -1, -1, -1, -2, 5],
        [5, -2, -1, -1, -1, -1, -2, 5],
        [10, -2, -1, -1, -1, -1, -2, 10],
        [-20, -50, -2, -2, -2, -2, -50, -20],
        [100, -20, 10, 5, 5, 10, -20, 100]
    ];
    
    for (const move of validMoves) {
        // Create a copy of the board
        const boardCopy = board.map(row => [...row]);
        
        // Simulate the move
        makeMove(move.row, move.col, WHITE);
        
        // Calculate score based on position weights
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
        
        // If this move is better, remember it
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
        
        // Restore the board
        board = boardCopy;
    }
    
    return bestMove || makeEasyAIMove(validMoves);
}


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


// Event listeners
newGameButton.addEventListener('click', initGame);
undoButton.addEventListener('click', undoMove);

// Initialize the game
createBoard();
initGame();