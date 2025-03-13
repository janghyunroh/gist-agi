// Game constants
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;
const BOARD_SIZE = 8;

// Game state
let board = [];
let currentPlayer = BLACK;
let gameRunning = false;
let moveLog = [];
// Add this new variable for strategy storage
let savedStrategies = {};
let gameStartLogged = false;

// DOM elements
const boardElement = document.getElementById('board');
const statusElement = document.getElementById('status');
const blackScoreElement = document.getElementById('black-score');
const whiteScoreElement = document.getElementById('white-score');
const blackAISelect = document.getElementById('black-ai');
const whiteAISelect = document.getElementById('white-ai');
const startButton = document.getElementById('start-btn');
const resetButton = document.getElementById('reset-btn');
const gameLogElement = document.getElementById('game-log');
const jsCodeElement = document.getElementById('js-code');
const strategyNameInput = document.getElementById('strategy-name');
// Replace applyJsButton with these two new buttons
const saveStrategyButton = document.getElementById('save-strategy');
const clearEditorButton = document.getElementById('clear-editor');
// Add reference to strategy list
const strategyListElement = document.getElementById('strategy-list');
const strategyFileInput = document.getElementById('strategy-file-input');
const uploadStrategiesButton = document.getElementById('upload-strategies');

// [KEEP ALL STANDARD GAME FUNCTIONS]
// initializeBoard, updateBoardDisplay, countDiscs, isValidMove, getValidMoves, makeMove...

// Initialize the game board
function initializeBoard() {
    // Create empty board
    board = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(EMPTY));
    
    // Place initial pieces
    board[3][3] = WHITE;
    board[3][4] = BLACK;
    board[4][3] = BLACK;
    board[4][4] = WHITE;
    
    // Create visual board
    boardElement.innerHTML = '';
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            boardElement.appendChild(cell);
        }
    }
    
    // Update the display
    updateBoardDisplay();
}

// Update the visual representation of the board
function updateBoardDisplay() {
    const cells = boardElement.querySelectorAll('.cell');
    cells.forEach(cell => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        
        // Clear cell content
        cell.innerHTML = '';
        
        // Add disc if needed
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
    
    // Update scores
    const scores = countDiscs();
    blackScoreElement.textContent = scores.black;
    whiteScoreElement.textContent = scores.white;
}

// Count discs of each color
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


// Check if a move is valid
function isValidMove(row, col, player) {
    // Must be an empty cell
    if (board[row][col] !== EMPTY) {
        return false;
    }
    
    const opponent = player === BLACK ? WHITE : BLACK;
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
    ];
    
    // Check in each direction
    for (const [dr, dc] of directions) {
        let r = row + dr;
        let c = col + dc;
        let foundOpponent = false;
        
        // Follow line of opponent pieces
        while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === opponent) {
            foundOpponent = true;
            r += dr;
            c += dc;
        }
        
        // If line ends with our piece, it's a valid move
        if (foundOpponent && r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
            return true;
        }
    }
    
    return false;
}

// Get all valid moves for a player
function getValidMoves(player) {
    const moves = [];
    
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (isValidMove(row, col, player)) {
                moves.push({ row, col });
            }
        }
    }
    
    return moves;
}

// Make a move
function makeMove(row, col, player) {
    // Place the piece
    board[row][col] = player;
    
    // Log the move
    const playerName = player === BLACK ? "Black" : "White";
    const colLetter = String.fromCharCode(97 + col); // 'a' through 'h'
    const rowNumber = row + 1; // 1 through 8
    const moveText = `${playerName}: ${colLetter}${rowNumber}`;
    moveLog.push(moveText);
    gameLogElement.innerHTML = moveLog.join('<br>');
    gameLogElement.scrollTop = gameLogElement.scrollHeight;
    
    // Flip opponent pieces
    const opponent = player === BLACK ? WHITE : BLACK;
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
    ];
    
    for (const [dr, dc] of directions) {
        let r = row + dr;
        let c = col + dc;
        const piecesToFlip = [];
        
        // Collect opponent pieces in this direction
        while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === opponent) {
            piecesToFlip.push([r, c]);
            r += dr;
            c += dc;
        }
        
        // If line ends with our piece, flip all collected pieces
        if (piecesToFlip.length > 0 && r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
            for (const [fr, fc] of piecesToFlip) {
                board[fr][fc] = player;
            }
        }
    }
    
    updateBoardDisplay();
}



// Rename strategies to builtInStrategies (for clarity)
const builtInStrategies = {
    // [KEEP ALL BUILT-IN STRATEGIES]
    // random, greedy, corners, positional
    // Random strategy - choose a random valid move
    random: function(player) {
        const validMoves = getValidMoves(player);
        if (validMoves.length === 0) return null;
        return validMoves[Math.floor(Math.random() * validMoves.length)];
    },
    
    // Greedy strategy - maximize pieces flipped
    greedy: function(player) {
        const validMoves = getValidMoves(player);
        if (validMoves.length === 0) return null;
        
        let bestMove = null;
        let mostFlips = -1;
        
        for (const move of validMoves) {
            // Create board copy
            const tempBoard = board.map(row => [...row]);
            
            // Count flips for this move
            const opponent = player === BLACK ? WHITE : BLACK;
            let flips = 0;
            
            // Try the move and count flips
            tempBoard[move.row][move.col] = player;
            
            const directions = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1],           [0, 1],
                [1, -1],  [1, 0],  [1, 1]
            ];
            
            for (const [dr, dc] of directions) {
                let r = move.row + dr;
                let c = move.col + dc;
                const piecesToFlip = [];
                
                while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && tempBoard[r][c] === opponent) {
                    piecesToFlip.push([r, c]);
                    r += dr;
                    c += dc;
                }
                
                if (piecesToFlip.length > 0 && r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && tempBoard[r][c] === player) {
                    flips += piecesToFlip.length;
                }
            }
            
            if (flips > mostFlips) {
                mostFlips = flips;
                bestMove = move;
            }
        }
        
        return bestMove;
    },
    
    // Corner strategy - prioritize corners and edges
    corners: function(player) {
        const validMoves = getValidMoves(player);
        if (validMoves.length === 0) return null;
        
        // Check for corner moves first
        const cornerMoves = validMoves.filter(move => 
            (move.row === 0 || move.row === 7) && (move.col === 0 || move.col === 7)
        );
        
        if (cornerMoves.length > 0) {
            return cornerMoves[0];
        }
        
        // Then check for edge moves
        const edgeMoves = validMoves.filter(move => 
            move.row === 0 || move.row === 7 || move.col === 0 || move.col === 7
        );
        
        if (edgeMoves.length > 0) {
            return edgeMoves[0];
        }
        
        // Otherwise use greedy strategy
        return builtInStrategies.greedy(player);
    },
    
    // Positional strategy - uses weighted board positions
    positional: function(player) {
        const validMoves = getValidMoves(player);
        if (validMoves.length === 0) return null;
        
        // Position weights - corners are best, edges next, avoid squares next to corners
        const positionWeights = [
            [100, -20, 10, 5, 5, 10, -20, 100],
            [-20, -30, -5, -5, -5, -5, -30, -20],
            [10, -5, 1, 1, 1, 1, -5, 10],
            [5, -5, 1, 1, 1, 1, -5, 5],
            [5, -5, 1, 1, 1, 1, -5, 5],
            [10, -5, 1, 1, 1, 1, -5, 10],
            [-20, -30, -5, -5, -5, -5, -30, -20],
            [100, -20, 10, 5, 5, 10, -20, 100]
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
    },
    
    // Custom strategy defined by user
    custom: function(player) {
        // Get the custom strategy code
        const strategyCode = jsCodeElement.value;
        
        try {
            // Create a function from the code
            const customStrategyFn = new Function('board', 'player', 'getValidMoves', 'makeMove', strategyCode);
            
            // Execute the custom strategy
            return customStrategyFn(board, player, getValidMoves, makeMove);
        } catch (error) {
            console.error("Error in custom strategy:", error);
            moveLog.push(`Error in custom strategy: ${error.message}`);
            gameLogElement.innerHTML = moveLog.join('<br>');
            
            // Fall back to greedy strategy if there's an error
            return strategies.greedy(player);
        }
    }
};

// Modify makeAIMove function to handle custom strategies from localStorage
async function makeAIMove() {
    if (!gameRunning) return;
    
    const aiType = currentPlayer === BLACK ? blackAISelect.value : whiteAISelect.value;
    
    // Determine which strategy to use
    let strategy;
    if (aiType.startsWith('custom_')) {
        // Get custom strategy name from the ID
        const strategyName = aiType.replace('custom_', '');
        const strategyCode = savedStrategies[strategyName];
        
        if (strategyCode) {
            try {
                // Create a function from the code
                const customStrategyFn = new Function('board', 'player', 'getValidMoves', 'makeMove', strategyCode);
                
                // Only log strategy names at the beginning of the game
                if (!gameStartLogged) {
                    const blackName = blackAISelect.options[blackAISelect.selectedIndex].text;
                    const whiteName = whiteAISelect.options[whiteAISelect.selectedIndex].text;
                    moveLog.push(`Game started: ${blackName} (Black) vs ${whiteName} (White)`);
                    gameLogElement.innerHTML = moveLog.join('<br>');
                    gameLogElement.scrollTop = gameLogElement.scrollHeight;
                    gameStartLogged = true;
                }
                
                // Execute the custom strategy
                strategy = async (player) => {
                    return await customStrategyFn(board, player, getValidMoves, makeMove);
                };
            } catch (error) {
                console.error(`Error in custom strategy "${strategyName}":`, error);
                moveLog.push(`Error in custom strategy "${strategyName}": ${error.message}`);
                gameLogElement.innerHTML = moveLog.join('<br>');
                gameLogElement.scrollTop = gameLogElement.scrollHeight;
                
                // Fall back to greedy strategy if there's an error
                strategy = builtInStrategies.greedy;
            }
        } else {
            // Strategy not found, fall back to greedy
            strategy = builtInStrategies.greedy;
        }
    } else {
        // Use built-in strategy
        // Only log strategy names at the beginning of the game
    if (!gameStartLogged) {
        const blackName = blackAISelect.options[blackAISelect.selectedIndex].text;
        const whiteName = whiteAISelect.options[whiteAISelect.selectedIndex].text;
        moveLog.push(`Game started: ${blackName} (Black) vs ${whiteName} (White)`);
        gameLogElement.innerHTML = moveLog.join('<br>');
        gameLogElement.scrollTop = gameLogElement.scrollHeight;
        gameStartLogged = true;
    }
        strategy = builtInStrategies[aiType];
    }
    
    if (!strategy) {
        console.error("Strategy not found:", aiType);
        return;
    }
    
    try {
        // Get move
        const move = await strategy(currentPlayer);
        
        if (!move) {
            // No valid moves, check if game is over
            const opponent = currentPlayer === BLACK ? WHITE : BLACK;
            const opponentMoves = getValidMoves(opponent);
            
            if (opponentMoves.length === 0) {
                // Game over
                endGame();
                return;
            }
            
            // Pass turn to opponent
            const playerName = currentPlayer === BLACK ? "Black" : "White";
            moveLog.push(`${playerName} passes (no valid moves)`);
            gameLogElement.innerHTML = moveLog.join('<br>');
            gameLogElement.scrollTop = gameLogElement.scrollHeight;
            
            currentPlayer = opponent;
            updateStatus();
            
            // Schedule next AI move
            setTimeout(makeAIMove, 250);
            return;
        }
        
        // Make the move
        makeMove(move.row, move.col, currentPlayer);
        
        // Switch players
        currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
        updateStatus();
        
        // Schedule next AI move
        setTimeout(makeAIMove, 250);
    } catch (error) {
        console.error("Error in AI move:", error);
        moveLog.push(`Error in AI move: ${error.message}`);
        gameLogElement.innerHTML = moveLog.join('<br>');
        endGame();
    }
}

// [KEEP OTHER GAME FUNCTIONS]
// updateStatus, endGame, startGame, resetGame
// Update game status
function updateStatus() {
    const scores = countDiscs();
    const playerText = currentPlayer === BLACK ? "Black" : "White";
    
    if (gameRunning) {
        statusElement.textContent = `${playerText}'s turn (${scores.black}-${scores.white})`;
        statusElement.style.backgroundColor = currentPlayer === BLACK ? '#333' : '#999';
    } else {
        // Game over
        if (scores.black > scores.white) {
            statusElement.textContent = `Game over. Black wins! (${scores.black}-${scores.white})`;
            statusElement.style.backgroundColor = '#333';
        } else if (scores.white > scores.black) {
            statusElement.textContent = `Game over. White wins! (${scores.black}-${scores.white})`;
            statusElement.style.backgroundColor = '#999';
        } else {
            statusElement.textContent = `Game over. It's a tie! (${scores.black}-${scores.white})`;
            statusElement.style.backgroundColor = '#666';
        }
    }
}

// End the game
function endGame() {
    gameRunning = false;
    startButton.disabled = false;
    updateStatus();
    // Get final scores
    const scores = countDiscs();

    // Add final score to the game log
    moveLog.push(`Game over: Final score ${scores.black}-${scores.white}`);
    if (scores.black > scores.white) {
        moveLog.push(`Black wins by ${scores.black - scores.white} pieces!`);
    } else if (scores.white > scores.black) {
        moveLog.push(`White wins by ${scores.white - scores.black} pieces!`);
    } else {
        moveLog.push(`It's a tie!`);
    }
    
    moveLog.push("Game over");
    gameLogElement.innerHTML = moveLog.join('<br>');
    gameLogElement.scrollTop = gameLogElement.scrollHeight;
    updateStatus();
}

// Start a new game
async function startGame() {
    // Always reinitialize the board before starting a new game
    initializeBoard();
    
    gameRunning = true;
    currentPlayer = BLACK;
    moveLog = [];
    gameStartLogged = false; // Reset this flag
    gameLogElement.innerHTML = moveLog.join('<br>');
    
    startButton.disabled = true;
    updateStatus();
    
    // Start AI moves
    setTimeout(makeAIMove, 125);
}

// Reset the game
function resetGame() {
    gameRunning = false;
    currentPlayer = BLACK;
    moveLog = ["Game reset"];
    gameStartLogged = false; // Reset this flag
    gameLogElement.innerHTML = moveLog.join('<br>');
    
    initializeBoard();
    startButton.disabled = false;
    statusElement.textContent = "Ready to start";
    statusElement.style.backgroundColor = '#4CAF50';
}


// Add these new functions for strategy management

// Save a strategy
function saveStrategy() {
    const strategyName = strategyNameInput.value.trim();
    const strategyCode = jsCodeElement.value;
    
    if (!strategyName) {
        alert("Please enter a strategy name");
        return;
    }
    
    // Save to our strategy collection
    savedStrategies[strategyName] = strategyCode;
    
    // Save to local storage for persistence
    localStorage.setItem('othelloStrategies', JSON.stringify(savedStrategies));
    
    // Update the UI
    updateStrategyList();
    updateAISelectors();
    
    statusElement.textContent = `Strategy "${strategyName}" saved`;
    statusElement.style.backgroundColor = '#4CAF50';
}

// Clear the editor
function clearEditor() {
    jsCodeElement.value = '';
    strategyNameInput.value = 'My Strategy';
}

// Load a strategy into the editor
function loadStrategy(name) {
    const code = savedStrategies[name];
    if (code) {
        jsCodeElement.value = code;
        strategyNameInput.value = name;
    }
}

// Delete a strategy
function deleteStrategy(name) {
    if (confirm(`Are you sure you want to delete the strategy "${name}"?`)) {
        delete savedStrategies[name];
        localStorage.setItem('othelloStrategies', JSON.stringify(savedStrategies));
        updateStrategyList();
        updateAISelectors();
        
        statusElement.textContent = `Strategy "${name}" deleted`;
        statusElement.style.backgroundColor = '#f44336';
    }
}

// Update the saved strategies list
function updateStrategyList() {
    strategyListElement.innerHTML = '';
    
    const strategyNames = Object.keys(savedStrategies);
    
    if (strategyNames.length === 0) {
        const emptyItem = document.createElement('div');
        emptyItem.className = 'strategy-item';
        emptyItem.innerHTML = '<span>No saved strategies yet</span>';
        strategyListElement.appendChild(emptyItem);
        return;
    }
    
    strategyNames.forEach(name => {
        const item = document.createElement('div');
        item.className = 'strategy-item';
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;
        item.appendChild(nameSpan);
        
        const buttons = document.createElement('div');
        buttons.className = 'buttons';
        
        const loadButton = document.createElement('button');
        loadButton.textContent = 'Edit';
        loadButton.addEventListener('click', () => loadStrategy(name));
        buttons.appendChild(loadButton);
        
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.className = 'delete-btn';
        deleteButton.addEventListener('click', () => deleteStrategy(name));
        buttons.appendChild(deleteButton);
        
        item.appendChild(buttons);
        strategyListElement.appendChild(item);
    });
}

// Update AI selectors with custom strategies
function updateAISelectors() {
    // Clear existing custom options
    Array.from(blackAISelect.options).forEach(option => {
        if (option.value.startsWith('custom_')) {
            blackAISelect.removeChild(option);
        }
    });
    
    Array.from(whiteAISelect.options).forEach(option => {
        if (option.value.startsWith('custom_')) {
            whiteAISelect.removeChild(option);
        }
    });
    
    // Add options for each saved strategy
    Object.keys(savedStrategies).forEach(name => {
        const strategyId = `custom_${name}`;
        
        const blackOption = document.createElement('option');
        blackOption.value = strategyId;
        blackOption.textContent = name;
        blackAISelect.appendChild(blackOption);
        
        const whiteOption = document.createElement('option');
        whiteOption.value = strategyId;
        whiteOption.textContent = name;
        whiteAISelect.appendChild(whiteOption);
    });
}

// Load saved strategies from localStorage on page load
function loadSavedStrategies() {
    const savedData = localStorage.getItem('othelloStrategies');
    if (savedData) {
        try {
            savedStrategies = JSON.parse(savedData);
            updateStrategyList();
            updateAISelectors();
        } catch (error) {
            console.error("Error loading saved strategies:", error);
        }
    }
}



// Function to handle file uploads
function uploadStrategyFiles() {
    const files = strategyFileInput.files;
    
    if (files.length === 0) {
        alert('Please select at least one file to upload.');
        return;
    }
    
    // Create a status container
    let statusContainer = document.querySelector('.upload-status');
    if (!statusContainer) {
        statusContainer = document.createElement('div');
        statusContainer.className = 'upload-status';
        document.querySelector('.strategy-upload').appendChild(statusContainer);
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    // Process each file
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const fileName = file.name;
                const strategyCode = e.target.result;
                
                // Extract strategy name from filename (remove .js extension)
                let strategyName = fileName.replace(/\.js$/, '');
                
                // Save the strategy
                savedStrategies[strategyName] = strategyCode;
                localStorage.setItem('othelloStrategies', JSON.stringify(savedStrategies));
                successCount++;
                
                // Update UI after all files are processed
                if (successCount + errorCount === files.length) {
                    updateStrategyList();
                    updateAISelectors();
                    showUploadStatus(successCount, errorCount);
                }
            } catch (error) {
                console.error(`Error processing file ${file.name}:`, error);
                errorCount++;
                
                // Update UI after all files are processed
                if (successCount + errorCount === files.length) {
                    updateStrategyList();
                    updateAISelectors();
                    showUploadStatus(successCount, errorCount);
                }
            }
        };
        
        reader.onerror = function() {
            console.error(`Error reading file ${file.name}`);
            errorCount++;
            
            // Update UI after all files are processed
            if (successCount + errorCount === files.length) {
                updateStrategyList();
                updateAISelectors();
                showUploadStatus(successCount, errorCount);
            }
        };
        
        // Read the file as text
        reader.readAsText(file);
    });
}

// Function to show upload status
function showUploadStatus(successCount, errorCount) {
    const statusContainer = document.querySelector('.upload-status');
    
    if (errorCount === 0) {
        statusContainer.className = 'upload-status upload-success';
        statusContainer.textContent = `Successfully uploaded ${successCount} strategy file${successCount !== 1 ? 's' : ''}.`;
    } else if (successCount === 0) {
        statusContainer.className = 'upload-status upload-error';
        statusContainer.textContent = `Failed to upload ${errorCount} file${errorCount !== 1 ? 's' : ''}.`;
    } else {
        statusContainer.className = 'upload-status';
        statusContainer.textContent = `Uploaded ${successCount} file${successCount !== 1 ? 's' : ''} successfully. Failed to upload ${errorCount} file${errorCount !== 1 ? 's' : ''}.`;
    }
    
    // Clear the file input
    strategyFileInput.value = '';
    
    // Update the status message in the main game area
    statusElement.textContent = `Uploaded ${successCount} strategy file${successCount !== 1 ? 's' : ''}.`;
    statusElement.style.backgroundColor = errorCount === 0 ? '#4CAF50' : '#FF9800';
}



// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    initializeBoard();
    
    // Add event listeners
    startButton.addEventListener('click', startGame);
    resetButton.addEventListener('click', resetGame);
    saveStrategyButton.addEventListener('click', saveStrategy);
    clearEditorButton.addEventListener('click', clearEditor);
    uploadStrategiesButton.addEventListener('click', uploadStrategyFiles);

    // Load saved strategies
    loadSavedStrategies();
});