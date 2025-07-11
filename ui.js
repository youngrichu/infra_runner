export class UIManager {
    constructor(gameController = null) {
        this.scoreElement = null;
        this.gameOverElement = null;
        this.powerUpElements = [];
        this.activePowerUps = [];
        this.gameController = gameController;
        
        this.score = 0;
        this.blueprints = 0;
        this.waterDrops = 0;
        this.energyCells = 0;
        
        // Leaderboard integration
        this.leaderboardData = [];
        this.isSubmittingScore = false;
        this.scoreSubmitted = false;
        this.currentViewType = 'all'; // Default to all players
        
        this.createUI();
        this.setupResizeHandler();
    }

    createUI() {
        this.createScoreDisplay();
        this.createGameOverScreen();
    }

    createScoreDisplay() {
        this.scoreElement = document.createElement('div');
        this.scoreElement.style.position = 'absolute';
        this.scoreElement.style.top = '10px';
        this.scoreElement.style.left = '10px';
        this.scoreElement.style.color = 'white';
        this.scoreElement.style.fontFamily = 'Arial, sans-serif';
        this.scoreElement.style.fontSize = 'clamp(16px, 4vw, 24px)';
        this.scoreElement.style.zIndex = '1000';
        this.scoreElement.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
        this.scoreElement.style.padding = '5px';
        this.scoreElement.style.borderRadius = '5px';
        this.scoreElement.style.backgroundColor = 'rgba(0,0,0,0.3)';
        this.scoreElement.style.maxWidth = 'calc(100vw - 20px)';
        this.scoreElement.style.wordWrap = 'break-word';
        document.body.appendChild(this.scoreElement);
        this.updateScoreDisplay();
    }

    createGameOverScreen() {
        this.gameOverElement = document.createElement('div');
        this.gameOverElement.style.position = 'fixed';
        this.gameOverElement.style.top = '50%';
        this.gameOverElement.style.left = '50%';
        this.gameOverElement.style.transform = 'translate(-50%, -50%)';
        this.gameOverElement.style.color = '#ff4444';
        this.gameOverElement.style.fontFamily = 'Arial, sans-serif';
        this.gameOverElement.style.fontSize = 'clamp(24px, 8vw, 48px)';
        this.gameOverElement.style.textAlign = 'center';
        this.gameOverElement.style.zIndex = '1001';
        this.gameOverElement.style.display = 'none';
        this.gameOverElement.style.backgroundColor = 'rgba(0,0,0,0.9)';
        this.gameOverElement.style.padding = 'clamp(15px, 5vw, 30px)';
        this.gameOverElement.style.borderRadius = '15px';
        this.gameOverElement.style.border = '2px solid #ff4444';
        this.gameOverElement.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
        this.gameOverElement.style.maxWidth = '95vw';
        this.gameOverElement.style.minWidth = '280px';
        this.gameOverElement.style.maxHeight = '85vh';
        this.gameOverElement.style.overflow = 'auto';
        this.gameOverElement.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
        this.gameOverElement.style.wordWrap = 'break-word';
        this.gameOverElement.innerHTML = '';
        document.body.appendChild(this.gameOverElement);
    }

    updateScore(points) {
        this.score += points;
        this.updateScoreDisplay();
    }

    updateCollectables(type, points) {
        switch (type) {
            case 'blueprint':
                this.blueprints++;
                break;
            case 'waterDrop':
                this.waterDrops++;
                break;
            case 'energyCell':
                this.energyCells++;
                break;
        }
        this.updateScore(points);
    }

    updateScoreDisplay() {
        this.scoreElement.innerHTML = `Score: ${Math.floor(this.score)} | BP: ${this.blueprints} | WD: ${this.waterDrops} | EC: ${this.energyCells}`;
    }

    getScore() {
        return this.score;
    }

    getCollectableStats() {
        return {
            blueprints: this.blueprints,
            waterDrops: this.waterDrops,
            energyCells: this.energyCells
        };
    }

    showGameOver() {
        this.gameOverElement.style.display = 'block';
        const isMobile = window.innerWidth <= 768;
        const isVerySmall = window.innerWidth <= 480;
        
        // Detect device type for appropriate restart instructions
        const hasGamepad = navigator.getGamepads().some(gp => gp !== null);
        const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        let restartText = '';
        if (hasTouch && isMobile) {
            restartText = 'Tap anywhere to restart';
        } else if (hasGamepad) {
            restartText = 'Press any button to restart';
        } else {
            restartText = 'Click to restart';
        }
        
        this.gameOverElement.innerHTML = `
            <div class="game-over-container">
                <!-- Header -->
                <div class="game-over-header">
                    <div class="game-over-title">GAME OVER</div>
                    <div class="restart-instruction">${restartText}</div>
                </div>
                
                <!-- Player Stats Card -->
                <div class="stats-card">
                    <div class="final-score">
                        <span class="score-label">Final Score</span>
                        <span class="score-value">${Math.floor(this.score)}</span>
                    </div>
                    <div class="collectibles-grid">
                        <div class="collectible-stat">
                            <span class="collectible-icon"><i class="ti ti-file-text"></i></span>
                            <span class="collectible-label">Blueprints</span>
                            <span class="collectible-value">${this.blueprints}</span>
                        </div>
                        <div class="collectible-stat">
                            <span class="collectible-icon"><i class="ti ti-droplet"></i></span>
                            <span class="collectible-label">Water</span>
                            <span class="collectible-value">${this.waterDrops}</span>
                        </div>
                        <div class="collectible-stat">
                            <span class="collectible-icon"><i class="ti ti-bolt"></i></span>
                            <span class="collectible-label">Energy Cells</span>
                            <span class="collectible-value">${this.energyCells}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Submission Status -->
                <div id="leaderboard-status" class="submission-status">
                    ${this.getLeaderboardStatusHTML()}
                </div>
                
                <!-- Tabbed Interface -->
                <div class="tabs-container">
                    <div class="tab-headers">
                        <button class="tab-header active" data-tab="top-scores"><i class="ti ti-trophy"></i> Top Scores</button>
                        <button class="tab-header" data-tab="my-rank"><i class="ti ti-chart-bar"></i> My Rank</button>
                        <button class="tab-header" data-tab="search"><i class="ti ti-search"></i> Search</button>
                    </div>
                    
                    <div class="tab-content">
                        <!-- Top Scores Tab -->
                        <div class="tab-panel active" id="top-scores-panel">
                            <div class="leaderboard-controls">
                                <div class="view-options">
                                    <button class="view-btn active" data-view="all">All Players</button>
                                    <button class="view-btn" data-view="organization">My Organization</button>
                                </div>
                                <div class="results-count">
                                    <span id="results-count">Loading...</span>
                                </div>
                            </div>
                            <div class="leaderboard-container">
                                <div id="leaderboard-list" class="leaderboard-list">
                                    ${this.getLeaderboardHTML()}
                                </div>
                            </div>
                        </div>
                        
                        <!-- My Rank Tab -->
                        <div class="tab-panel" id="my-rank-panel">
                            <div class="rank-container">
                                <div id="my-rank-display" class="my-rank-display">
                                    ${this.getMyRankHTML()}
                                </div>
                            </div>
                        </div>
                        
                        <!-- Search Tab -->
                        <div class="tab-panel" id="search-panel">
                            <div class="search-container">
                                <input type="text" id="search-input" class="search-input" placeholder="Search players or organizations...">
                                <div class="search-filters">
                                    <label class="filter-option">
                                        <input type="radio" name="search-type" value="player" checked>
                                        <span>Player Name</span>
                                    </label>
                                    <label class="filter-option">
                                        <input type="radio" name="search-type" value="organization">
                                        <span>Organization</span>
                                    </label>
                                </div>
                                <div id="search-results" class="search-results">
                                    <div class="search-placeholder">Enter a name to search...</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Action Buttons -->
                <div class="action-buttons">
                    <button id="restart-button" class="primary-button">
                        <i class="ti ti-refresh"></i> Restart Game
                    </button>
                    <button id="new-game-button" class="secondary-button">
                        <i class="ti ti-user-plus"></i> New Game
                    </button>
                </div>
            </div>
        `;
        
        // Add comprehensive styles for new game over screen
        if (!document.getElementById('game-over-styles')) {
            const style = document.createElement('style');
            style.id = 'game-over-styles';
            style.textContent = `
                .game-over-container {
                    width: 100%;
                    max-width: min(600px, 90vw);
                    margin: 0 auto;
                    padding: 20px;
                    box-sizing: border-box;
                }
                
                .game-over-header {
                    text-align: center;
                    margin-bottom: 25px;
                }
                
                .game-over-title {
                    font-size: clamp(28px, 8vw, 48px);
                    font-weight: bold;
                    color: #ff4444;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
                    margin-bottom: 8px;
                }
                
                .restart-instruction {
                    font-size: clamp(14px, 4vw, 18px);
                    color: #ffaaaa;
                    animation: pulse 2s infinite;
                }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }
                
                .stats-card {
                    background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 15px;
                    padding: 20px;
                    margin-bottom: 20px;
                    backdrop-filter: blur(10px);
                }
                
                .final-score {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                    border-bottom: 1px solid rgba(255,255,255,0.2);
                }
                
                .score-label {
                    font-size: clamp(18px, 5vw, 24px);
                    color: #ffffff;
                    font-weight: bold;
                }
                
                .score-value {
                    font-size: clamp(24px, 6vw, 36px);
                    color: #FFD700;
                    font-weight: bold;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
                }
                
                .collectibles-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                    gap: 15px;
                }
                
                .collectible-stat {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 15px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 10px;
                    border: 1px solid rgba(255,255,255,0.15);
                }
                
                .collectible-icon {
                    font-size: 24px;
                    margin-bottom: 8px;
                }
                
                .collectible-label {
                    font-size: clamp(12px, 3vw, 14px);
                    color: #cccccc;
                    margin-bottom: 5px;
                }
                
                .collectible-value {
                    font-size: clamp(18px, 4vw, 22px);
                    color: #ffffff;
                    font-weight: bold;
                }
                
                .submission-status {
                    text-align: center;
                    padding: 12px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    font-size: clamp(14px, 3.5vw, 16px);
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                }
                
                .tabs-container {
                    background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
                    border-radius: 15px;
                    overflow: hidden;
                    margin-bottom: 20px;
                    border: 1px solid rgba(255,255,255,0.15);
                    backdrop-filter: blur(10px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }
                
                .tab-headers {
                    display: flex;
                    background: linear-gradient(135deg, rgba(0,0,0,0.4), rgba(0,0,0,0.3));
                    border-bottom: 1px solid rgba(255,255,255,0.2);
                }
                
                .tab-header {
                    flex: 1 1 auto;
                    min-width: 160px;
                    padding: 16px 12px;
                    background: none;
                    border: none;
                    color: #cccccc;
                    font-size: clamp(13px, 3.5vw, 15px);
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    border-right: 1px solid rgba(255,255,255,0.1);
                    position: relative;
                    text-align: center;
                    white-space: nowrap;
                }
                
                .tab-header:last-child {
                    border-right: none;
                }
                
                .tab-header.active {
                    background: linear-gradient(135deg, rgba(255,107,53,0.25), rgba(255,107,53,0.15));
                    color: #FFD700;
                    font-weight: 600;
                    box-shadow: inset 0 -3px 0 #FF6B35;
                }
                
                .tab-header.active::before {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 3px;
                    background: linear-gradient(90deg, #FF6B35, #FFD700);
                }
                
                .tab-header:hover:not(.active) {
                    background: linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.08));
                    color: #ffffff;
                    transform: translateY(-1px);
                }
                
                .tab-content {
                    height: 400px;
                    overflow: hidden;
                }
                
                .tab-panel {
                    display: none;
                    padding: 15px;
                    height: 100%;
                    box-sizing: border-box;
                    overflow-y: auto;
                    animation: fadeIn 0.3s ease;
                }
                
                .tab-panel.active {
                    display: block;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                .leaderboard-controls {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                    flex-wrap: wrap;
                    gap: 12px;
                    padding: 0 4px;
                }
                
                .view-options {
                    display: flex;
                    gap: 6px;
                }
                
                .view-btn {
                    padding: 8px 16px;
                    background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 8px;
                    color: #cccccc;
                    font-size: clamp(11px, 2.5vw, 13px);
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    text-transform: capitalize;
                    backdrop-filter: blur(10px);
                }
                
                .view-btn.active {
                    background: linear-gradient(135deg, rgba(255,107,53,0.3), rgba(255,107,53,0.2));
                    color: #FFD700;
                    border-color: #FF6B35;
                    box-shadow: 0 2px 8px rgba(255,107,53,0.2);
                }
                
                .view-btn:hover:not(.active) {
                    background: linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.1));
                    transform: translateY(-1px);
                }
                
                .results-count {
                    font-size: clamp(11px, 2.5vw, 13px);
                    color: #999999;
                    font-weight: 500;
                    background: rgba(255,255,255,0.05);
                    padding: 6px 12px;
                    border-radius: 6px;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                
                .leaderboard-container {
                    max-height: 300px;
                    overflow-y: auto;
                    border-radius: 12px;
                    background: rgba(0,0,0,0.3);
                    border: 1px solid rgba(255,255,255,0.15);
                    margin-top: 10px;
                }
                
                .leaderboard-list {
                    padding: 8px;
                }
                
                .leaderboard-entry {
                    display: flex;
                    align-items: center;
                    padding: 12px 16px;
                    margin: 4px 0;
                    background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04));
                    border-radius: 10px;
                    border: 1px solid rgba(255,255,255,0.1);
                    transition: all 0.3s ease;
                    backdrop-filter: blur(10px);
                }
                
                .leaderboard-entry:hover {
                    background: linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.08));
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                }
                
                .leaderboard-entry.current-player {
                    background: linear-gradient(135deg, rgba(255,107,53,0.25), rgba(255,107,53,0.15));
                    border-color: #FF6B35;
                    box-shadow: 0 0 0 1px rgba(255,107,53,0.3);
                }
                
                .player-rank {
                    font-size: clamp(12px, 2.8vw, 14px);
                    color: #FFD700;
                    font-weight: 600;
                    margin-right: 16px;
                    min-width: 35px;
                    text-align: center;
                    background: rgba(255,215,0,0.1);
                    border-radius: 6px;
                    padding: 4px 8px;
                    border: 1px solid rgba(255,215,0,0.2);
                }
                
                .player-info {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    margin-right: 12px;
                }
                
                .player-name {
                    font-size: clamp(14px, 3.2vw, 16px);
                    color: #ffffff;
                    font-weight: 600;
                    margin-bottom: 2px;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
                }
                
                .player-organization {
                    font-size: clamp(11px, 2.5vw, 13px);
                    color: #cccccc;
                    opacity: 0.85;
                    font-weight: 400;
                }
                
                .player-score {
                    font-size: clamp(14px, 3.2vw, 16px);
                    color: #FFD700;
                    font-weight: 700;
                    text-align: right;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
                    background: rgba(255,215,0,0.1);
                    border-radius: 6px;
                    padding: 6px 12px;
                    border: 1px solid rgba(255,215,0,0.2);
                    min-width: 60px;
                }
                
                .search-container {
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                }
                
                .search-input {
                    width: 100%;
                    padding: 14px 16px;
                    border: 1px solid rgba(255,255,255,0.3);
                    border-radius: 12px;
                    background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
                    color: #ffffff;
                    font-size: clamp(14px, 3.5vw, 16px);
                    margin-bottom: 15px;
                    box-sizing: border-box;
                    backdrop-filter: blur(10px);
                    transition: all 0.3s ease;
                }
                
                .search-input::placeholder {
                    color: #999999;
                }
                
                .search-input:focus {
                    outline: none;
                    border-color: #FF6B35;
                    box-shadow: 0 0 0 3px rgba(255,107,53,0.2);
                    background: linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.08));
                    transform: translateY(-1px);
                }
                
                .search-filters {
                    display: flex;
                    gap: 24px;
                    margin-bottom: 15px;
                    justify-content: center;
                    padding: 8px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 8px;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                
                .filter-option {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    font-size: clamp(13px, 3vw, 15px);
                    color: #cccccc;
                    font-weight: 500;
                    transition: all 0.3s ease;
                    padding: 6px 12px;
                    border-radius: 6px;
                }
                
                .filter-option:hover {
                    background: rgba(255,255,255,0.1);
                    color: #ffffff;
                }
                
                .filter-option input[type="radio"] {
                    accent-color: #FF6B35;
                    width: 16px;
                    height: 16px;
                }
                
                .search-results {
                    flex: 1;
                    overflow-y: auto;
                    border-radius: 12px;
                    background: rgba(0,0,0,0.3);
                    border: 1px solid rgba(255,255,255,0.15);
                    padding: 8px;
                    backdrop-filter: blur(10px);
                }
                
                .search-placeholder {
                    text-align: center;
                    color: #999999;
                    font-style: italic;
                    padding: 40px 20px;
                    font-size: clamp(14px, 3.5vw, 16px);
                }
                
                .my-rank-display {
                    text-align: center;
                    padding: 20px;
                    height: 100%;
                    box-sizing: border-box;
                    overflow-y: auto;
                }
                
                .my-rank-card {
                    background: linear-gradient(135deg, rgba(255,107,53,0.25), rgba(255,215,0,0.15));
                    border: 2px solid #FF6B35;
                    border-radius: 16px;
                    padding: 30px;
                    margin: 20px 0;
                    backdrop-filter: blur(10px);
                    box-shadow: 0 8px 24px rgba(255,107,53,0.2);
                    position: relative;
                    overflow: hidden;
                }
                
                .my-rank-card::before {
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: radial-gradient(circle, rgba(255,215,0,0.1) 0%, transparent 70%);
                    animation: rotate 20s linear infinite;
                }
                
                @keyframes rotate {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                .my-rank-position {
                    font-size: clamp(32px, 8vw, 48px);
                    color: #FFD700;
                    font-weight: 700;
                    margin-bottom: 12px;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
                    position: relative;
                    z-index: 1;
                }
                
                .my-rank-details {
                    font-size: clamp(16px, 4vw, 20px);
                    color: #ffffff;
                    margin-bottom: 25px;
                    position: relative;
                    z-index: 1;
                    line-height: 1.4;
                }
                
                .my-rank-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                    gap: 16px;
                    margin-top: 25px;
                    position: relative;
                    z-index: 1;
                }
                
                .rank-stat {
                    background: linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.08));
                    border-radius: 12px;
                    padding: 16px;
                    border: 1px solid rgba(255,255,255,0.2);
                    backdrop-filter: blur(10px);
                    transition: all 0.3s ease;
                }
                
                .rank-stat:hover {
                    background: linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.12));
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                }
                
                .rank-stat-label {
                    font-size: clamp(12px, 3vw, 14px);
                    color: #cccccc;
                    margin-bottom: 8px;
                    font-weight: 500;
                }
                
                .rank-stat-value {
                    font-size: clamp(18px, 4.5vw, 24px);
                    color: #FFD700;
                    font-weight: 700;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
                }
                
                .action-buttons {
                    display: flex;
                    justify-content: center;
                    gap: 15px;
                    margin-top: 20px;
                    flex-wrap: wrap;
                }
                
                .primary-button {
                    background: linear-gradient(45deg, #FF6B35, #FFD700);
                    border: none;
                    color: white;
                    padding: 15px 30px;
                    font-size: clamp(14px, 3.5vw, 18px);
                    font-weight: bold;
                    border-radius: 25px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    text-transform: uppercase;
                    box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
                    flex: 1;
                    min-width: 140px;
                    max-width: 200px;
                }
                
                .primary-button:hover {
                    transform: translateY(-2px) scale(1.05);
                    box-shadow: 0 6px 20px rgba(255, 107, 53, 0.4);
                }
                
                .primary-button:active {
                    transform: translateY(0) scale(0.98);
                }
                
                .secondary-button {
                    background: linear-gradient(45deg, #4A90E2, #357ABD);
                    border: none;
                    color: white;
                    padding: 15px 30px;
                    font-size: clamp(14px, 3.5vw, 18px);
                    font-weight: bold;
                    border-radius: 25px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    text-transform: uppercase;
                    box-shadow: 0 4px 12px rgba(74, 144, 226, 0.3);
                    flex: 1;
                    min-width: 140px;
                    max-width: 200px;
                }
                
                .secondary-button:hover {
                    transform: translateY(-2px) scale(1.05);
                    box-shadow: 0 6px 20px rgba(74, 144, 226, 0.4);
                    background: linear-gradient(45deg, #5A9FE5, #4A8ACD);
                }
                
                .secondary-button:active {
                    transform: translateY(0) scale(0.98);
                }
                
                /* Responsive design breakpoints */
                @media (min-width: 1200px) {
                    .game-over-container {
                        max-width: 700px;
                    }
                }
                
                @media (min-width: 992px) and (max-width: 1199px) {
                    .game-over-container {
                        max-width: 600px;
                    }
                }
                
                @media (min-width: 769px) and (max-width: 991px) {
                    .game-over-container {
                        max-width: 500px;
                    }
                }
                
                /* Mobile optimizations */
                @media (max-width: 768px) {
                    .game-over-container {
                        max-width: 95vw;
                        padding: 15px;
                    }
                    
                    .stats-card {
                        padding: 15px;
                    }
                    
                    .collectibles-grid {
                        grid-template-columns: repeat(3, 1fr);
                    }
                    
                    .tab-content {
                        height: 350px;
                    }
                    
                    .tab-panel {
                        padding: 12px;
                    }
                    
                    .leaderboard-controls {
                        flex-direction: column;
                        align-items: stretch;
                    }
                    
                    .view-options {
                        justify-content: center;
                    }
                    
                    .search-filters {
                        justify-content: center;
                    }
                    
                    .leaderboard-container {
                        max-height: 250px;
                    }
                }
                
                @media (max-width: 480px) {
                    .game-over-container {
                        max-width: 98vw;
                        padding: 10px;
                    }
                    
                    .collectibles-grid {
                        grid-template-columns: repeat(3, 1fr);
                        gap: 10px;
                    }
                    
                    .collectible-stat {
                        padding: 10px;
                    }
                    
                    .tab-header {
                        padding: 12px 12px;
                        font-size: clamp(12px, 3vw, 14px);
                    }
                    
                    .tab-content {
                        height: 300px;
                    }
                    
                    .tab-panel {
                        padding: 10px;
                    }
                    
                    .leaderboard-container {
                        max-height: 200px;
                    }
                    
                    .action-buttons {
                        flex-direction: column;
                        gap: 10px;
                    }
                    
                    .primary-button, .secondary-button {
                        max-width: 100%;
                        min-width: 200px;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Initialize interactive features
        this.initializeGameOverInteractions();
        
        // Game over screen displayed with final score and stats
        
        // Load leaderboard and submit score
        this.loadLeaderboard();
        this.submitScoreToLeaderboard();
    }

    hideGameOver() {
        this.gameOverElement.style.display = 'none';
    }

    addPowerUpToUI(name, durationSeconds) {
        const powerUpElement = document.createElement('div');
        powerUpElement.style.position = 'absolute';
        const topOffset = 50 + (window.innerWidth <= 768 ? 35 : 50); // Account for score display height
        powerUpElement.style.top = `${topOffset + this.powerUpElements.length * (window.innerWidth <= 768 ? 25 : 30)}px`;
        powerUpElement.style.left = '10px';
        powerUpElement.style.color = 'white';
        powerUpElement.style.fontFamily = 'Arial, sans-serif';
        powerUpElement.style.fontSize = 'clamp(12px, 3vw, 16px)';
        powerUpElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        powerUpElement.style.padding = 'clamp(3px, 1vw, 5px)';
        powerUpElement.style.borderRadius = '5px';
        powerUpElement.style.zIndex = '1000';
        powerUpElement.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
        powerUpElement.style.maxWidth = 'calc(100vw - 20px)';
        powerUpElement.style.wordWrap = 'break-word';
        powerUpElement.innerHTML = `${name}: ${durationSeconds}s`;
        document.body.appendChild(powerUpElement);
        
        const powerUp = {
            element: powerUpElement,
            name: name,
            duration: durationSeconds * 1000, // Convert to milliseconds for consistency
            remainingTime: durationSeconds * 1000
        };
        this.powerUpElements.push(powerUp);
        this.activePowerUps.push(powerUp);
    }

    removePowerUpFromUI(powerUp) {
        if (powerUp.element && powerUp.element.parentNode) {
            document.body.removeChild(powerUp.element);
        }
        this.powerUpElements = this.powerUpElements.filter(p => p !== powerUp);
        this.activePowerUps = this.activePowerUps.filter(p => p !== powerUp);
        
        // Reposition remaining power-ups
        this.powerUpElements.forEach((p, index) => {
            if (p.element) {
                const topOffset = 50 + (window.innerWidth <= 768 ? 35 : 50);
                p.element.style.top = `${topOffset + index * (window.innerWidth <= 768 ? 25 : 30)}px`;
            }
        });
    }

    updatePowerUpTimers(deltaTime) {
        // Update timers and remove expired ones
        for (let i = this.activePowerUps.length - 1; i >= 0; i--) {
            const powerUp = this.activePowerUps[i];
            powerUp.remainingTime -= deltaTime;
            
            if (powerUp.remainingTime <= 0) {
                // Power-up expired, remove it
                this.removePowerUpFromUI(powerUp);
            } else if (powerUp.element) {
                // Update display
                const remainingSeconds = powerUp.remainingTime / 1000;
                powerUp.element.innerHTML = `${powerUp.name}: ${remainingSeconds.toFixed(1)}s`;
            }
        }
    }

    getScore() {
        return this.score;
    }

    getCollectableStats() {
        return {
            blueprints: this.blueprints,
            waterDrops: this.waterDrops,
            energyCells: this.energyCells
        };
    }

    setGameController(gameController) {
        this.gameController = gameController;
    }
    
    reset() {
        this.score = 0;
        this.blueprints = 0;
        this.waterDrops = 0;
        this.energyCells = 0;
        
        // Clear power-up UI elements
        this.powerUpElements.forEach(p => {
            if (p.element && p.element.parentNode) {
                p.element.parentNode.removeChild(p.element);
            }
        });
        this.powerUpElements = [];
        this.activePowerUps = [];
        
        this.hideGameOver();
        this.updateScoreDisplay();
    }

    // Leaderboard integration methods
    getLeaderboardStatusHTML() {
        if (this.isSubmittingScore) {
            return `<div style="color: #FFD700; text-align: center;"><i class="ti ti-upload"></i> Submitting score...</div>`;
        } else if (this.scoreSubmitted) {
            return `<div style="color: #4CAF50; text-align: center;"><i class="ti ti-check"></i> Score submitted successfully!</div>`;
        } else {
            return `<div style="color: #ff9800; text-align: center;"><i class="ti ti-alert-triangle"></i> Score not submitted</div>`;
        }
    }

    getLeaderboardHTML() {
        if (!this.leaderboardData || this.leaderboardData.length === 0) {
            return '<div style="color: #888; text-align: center; padding: 20px; font-size: clamp(14px, 3.5vw, 16px);">Loading leaderboard...</div>';
        }

        const currentPlayerName = this.gameController?.stateManager?.playerData?.playerName || '';
        let html = '';
        
        this.leaderboardData.forEach((score, index) => {
            const rank = index + 1;
            const isCurrentPlayer = score.player_name === currentPlayerName;
            // Only highlight current player when viewing organization
            const entryClass = (isCurrentPlayer && this.currentViewType === 'organization') ? 'leaderboard-entry current-player' : 'leaderboard-entry';
            
            html += `
                <div class="${entryClass}">
                    <span class="player-rank">#${rank}</span>
                    <div class="player-info">
                        <div class="player-name">${this.truncateText(score.player_name, 20)}</div>
                        <div class="player-organization">${this.truncateText(score.organization_name || 'Unknown', 25)}</div>
                    </div>
                    <div class="player-score">${Math.floor(score.score)}</div>
                </div>
            `;
        });

        return html;
    }

    getMyRankHTML() {
        if (!this.gameController?.stateManager?.playerData?.playerName) {
            return '<div class="search-placeholder" style="font-size: clamp(14px, 3.5vw, 16px);">Player data not available</div>';
        }

        const playerName = this.gameController.stateManager.playerData.playerName;
        const playerRank = this.findPlayerRank(playerName);
        const totalPlayers = this.leaderboardData?.length || 0;
        
        if (playerRank === -1) {
            return `
                <div class="my-rank-card">
                    <div class="my-rank-position">Not Ranked</div>
                    <div class="my-rank-details">Your score hasn't been recorded yet</div>
                </div>
            `;
        }

        const percentile = totalPlayers > 0 ? Math.round((1 - (playerRank - 1) / totalPlayers) * 100) : 0;
        const playerData = this.leaderboardData[playerRank - 1];
        
        return `
            <div class="my-rank-card">
                <div class="my-rank-position">#${playerRank}</div>
                <div class="my-rank-details">
                    Out of ${totalPlayers} players<br>
                    Top ${percentile}% performer
                </div>
                <div class="my-rank-stats">
                    <div class="rank-stat">
                        <div class="rank-stat-label">Score</div>
                        <div class="rank-stat-value">${Math.floor(playerData?.score || this.score || 0)}</div>
                    </div>
                    <div class="rank-stat">
                        <div class="rank-stat-label">Blueprints</div>
                        <div class="rank-stat-value">${playerData?.blueprintsCollected || playerData?.blueprints || this.blueprints || 0}</div>
                    </div>
                    <div class="rank-stat">
                        <div class="rank-stat-label">Water</div>
                        <div class="rank-stat-value">${playerData?.waterDropsCollected || playerData?.water_drops || this.waterDrops || 0}</div>
                    </div>
                    <div class="rank-stat">
                        <div class="rank-stat-label">Energy Cells</div>
                        <div class="rank-stat-value">${playerData?.energyCellsCollected || playerData?.energy_cells || this.energyCells || 0}</div>
                    </div>
                </div>
            </div>
        `;
    }

    updateLeaderboard(leaderboardData) {
        this.leaderboardData = leaderboardData;
        
        // Update all displays
        const displayElement = document.getElementById('leaderboard-list');
        if (displayElement) {
            displayElement.innerHTML = this.getLeaderboardHTML();
        }
        
        const myRankDisplay = document.getElementById('my-rank-display');
        if (myRankDisplay) {
            myRankDisplay.innerHTML = this.getMyRankHTML();
        }
        
        const resultsCount = document.getElementById('results-count');
        if (resultsCount) {
            resultsCount.textContent = `${leaderboardData.length} players`;
        }
    }

    // New helper methods
    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    findPlayerRank(playerName) {
        if (!this.leaderboardData || !playerName) return -1;
        
        const index = this.leaderboardData.findIndex(player => player.player_name === playerName);
        return index !== -1 ? index + 1 : -1;
    }

    initializeGameOverInteractions() {
        setTimeout(() => {
            this.initializeTabSystem();
            this.initializeViewControls();
            this.initializeSearchFeature();
            this.initializeRestartButton();
        }, 100);
    }

    initializeTabSystem() {
        const tabHeaders = document.querySelectorAll('.tab-header');
        const tabPanels = document.querySelectorAll('.tab-panel');
        
        tabHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const tabName = header.getAttribute('data-tab');
                
                // Update active tab header
                tabHeaders.forEach(h => h.classList.remove('active'));
                header.classList.add('active');
                
                // Update active tab panel
                tabPanels.forEach(panel => panel.classList.remove('active'));
                const targetPanel = document.getElementById(tabName + '-panel');
                if (targetPanel) {
                    targetPanel.classList.add('active');
                }
            });
        });
    }

    initializeViewControls() {
        const viewButtons = document.querySelectorAll('.view-btn');
        
        viewButtons.forEach(button => {
            button.addEventListener('click', () => {
                const viewType = button.getAttribute('data-view');
                
                // Update active view button
                viewButtons.forEach(b => b.classList.remove('active'));
                button.classList.add('active');
                
                // Store current view type
                this.currentViewType = viewType;
                
                // Filter leaderboard based on view type
                this.filterLeaderboard(viewType);
            });
        });
    }

    initializeSearchFeature() {
        const searchInput = document.getElementById('search-input');
        const searchFilters = document.querySelectorAll('input[name="search-type"]');
        
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    const query = searchInput.value.trim();
                    const searchType = document.querySelector('input[name="search-type"]:checked')?.value || 'player';
                    this.performSearch(query, searchType);
                }, 300);
            });
        }
        
        searchFilters.forEach(filter => {
            filter.addEventListener('change', () => {
                const query = searchInput?.value.trim() || '';
                if (query) {
                    this.performSearch(query, filter.value);
                }
            });
        });
    }

    initializeRestartButton() {
        const restartButton = document.getElementById('restart-button');
        if (restartButton && this.gameController) {
            restartButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.gameController.restartGame();
            });
            restartButton.addEventListener('touchend', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.gameController.restartGame();
            });
        }
        
        const newGameButton = document.getElementById('new-game-button');
        if (newGameButton && this.gameController) {
            newGameButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.gameController.startNewGame();
            });
            newGameButton.addEventListener('touchend', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.gameController.startNewGame();
            });
        }
    }

    filterLeaderboard(viewType) {
        if (!this.leaderboardData) return;
        
        let filteredData = this.leaderboardData;
        
        if (viewType === 'organization') {
            const playerOrganization = this.gameController?.stateManager?.playerData?.organizationName;
            if (playerOrganization) {
                filteredData = this.leaderboardData.filter(player => 
                    player.organization_name === playerOrganization
                );
            }
        }
        
        // Update display with filtered data
        const displayElement = document.getElementById('leaderboard-list');
        if (displayElement) {
            displayElement.innerHTML = this.getFilteredLeaderboardHTML(filteredData, viewType);
        }
        
        const resultsCount = document.getElementById('results-count');
        if (resultsCount) {
            resultsCount.textContent = `${filteredData.length} players`;
        }
    }

    getFilteredLeaderboardHTML(data, viewType = 'all') {
        if (!data || data.length === 0) {
            return '<div style="color: #888; text-align: center; padding: 20px; font-size: clamp(14px, 3.5vw, 16px);">No players found</div>';
        }

        const currentPlayerName = this.gameController?.stateManager?.playerData?.playerName || '';
        let html = '';
        
        data.forEach((score, index) => {
            const rank = index + 1;
            const isCurrentPlayer = score.player_name === currentPlayerName;
            // Only highlight current player when viewing organization
            const entryClass = (isCurrentPlayer && viewType === 'organization') ? 'leaderboard-entry current-player' : 'leaderboard-entry';
            
            html += `
                <div class="${entryClass}">
                    <span class="player-rank">#${rank}</span>
                    <div class="player-info">
                        <div class="player-name">${this.truncateText(score.player_name, 20)}</div>
                        <div class="player-organization">${this.truncateText(score.organization_name || 'Unknown', 25)}</div>
                    </div>
                    <div class="player-score">${Math.floor(score.score)}</div>
                </div>
            `;
        });

        return html;
    }

    performSearch(query, searchType) {
        const searchResults = document.getElementById('search-results');
        if (!searchResults) return;
        
        if (!query) {
            searchResults.innerHTML = '<div class="search-placeholder" style="font-size: clamp(14px, 3.5vw, 16px);">Enter a name to search...</div>';
            return;
        }
        
        if (!this.leaderboardData || this.leaderboardData.length === 0) {
            searchResults.innerHTML = '<div class="search-placeholder" style="font-size: clamp(14px, 3.5vw, 16px);">No data available</div>';
            return;
        }
        
        const results = this.leaderboardData.filter(player => {
            const searchField = searchType === 'organization' ? 
                (player.organization_name || '').toLowerCase() : 
                player.player_name.toLowerCase();
            return searchField.includes(query.toLowerCase());
        });
        
        if (results.length === 0) {
            searchResults.innerHTML = '<div class="search-placeholder" style="font-size: clamp(14px, 3.5vw, 16px);">No matches found</div>';
            return;
        }
        
        searchResults.innerHTML = this.getFilteredLeaderboardHTML(results, 'search');
    }

    updateLeaderboardStatus(isSubmitting, submitted) {
        this.isSubmittingScore = isSubmitting;
        this.scoreSubmitted = submitted;
        const statusElement = document.getElementById('leaderboard-status');
        if (statusElement) {
            statusElement.innerHTML = this.getLeaderboardStatusHTML();
        }
    }

    async submitScoreToLeaderboard() {
        if (!this.gameController || !this.gameController.leaderboardManager) {
            // Leaderboard manager not available
            return;
        }

        try {
            this.updateLeaderboardStatus(true, false);
            
            const gameStats = {
                score: Math.floor(this.score),
                duration: this.gameController.stateManager.getGameDuration(),
                blueprints: this.blueprints,
                waterDrops: this.waterDrops,
                energyCells: this.energyCells
            };

            await this.gameController.leaderboardManager.submitScore(gameStats);
            this.updateLeaderboardStatus(false, true);
            
            // Refresh leaderboard display
            const leaderboardData = await this.gameController.leaderboardManager.getTopScores(10);
            this.updateLeaderboard(leaderboardData);
            
        } catch (error) {
            // Failed to submit score to leaderboard
            this.updateLeaderboardStatus(false, false);
        }
    }

    async loadLeaderboard() {
        if (!this.gameController || !this.gameController.leaderboardManager) {
            return;
        }

        try {
            // Load more scores to support search and ranking features
            const leaderboardData = await this.gameController.leaderboardManager.getTopScores(100);
            this.updateLeaderboard(leaderboardData);
        } catch (error) {
            // Failed to load leaderboard data
        }
    }
    
    setupResizeHandler() {
        window.addEventListener('resize', () => {
            // Update power-up positions on resize
            this.repositionPowerUps();
        });
        
        // Also handle orientation change
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.repositionPowerUps();
            }, 100); // Small delay to allow for orientation change to complete
        });
    }
    
    repositionPowerUps() {
        this.powerUpElements.forEach((p, index) => {
            if (p.element) {
                const topOffset = 50 + (window.innerWidth <= 768 ? 35 : 50);
                p.element.style.top = `${topOffset + index * (window.innerWidth <= 768 ? 25 : 30)}px`;
                p.element.style.fontSize = 'clamp(12px, 3vw, 16px)';
                p.element.style.padding = 'clamp(3px, 1vw, 5px)';
            }
        });
    }

    showCountdown(callback) {
        // Creating countdown display
        
        // Create countdown overlay
        const countdownOverlay = document.createElement('div');
        countdownOverlay.id = 'countdown-overlay';
        countdownOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 2000;
            font-family: Arial, sans-serif;
            color: white;
            text-align: center;
            user-select: none;
        `;
        
        // Ready message
        const readyMessage = document.createElement('div');
        readyMessage.style.cssText = `
            font-size: clamp(24px, 6vw, 36px);
            margin-bottom: 30px;
            color: #FFD700;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
            animation: pulse 1.5s infinite;
        `;
        readyMessage.textContent = 'Get Ready!';
        
        // Countdown number
        const countdownNumber = document.createElement('div');
        countdownNumber.style.cssText = `
            font-size: clamp(72px, 15vw, 120px);
            font-weight: bold;
            margin-bottom: 30px;
            color: #FF6B35;
            text-shadow: 4px 4px 8px rgba(0,0,0,0.8);
            animation: countdownBounce 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        `;
        
        // Skip instruction
        const skipMessage = document.createElement('div');
        skipMessage.style.cssText = `
            font-size: clamp(14px, 3.5vw, 18px);
            color: #AAA;
            margin-top: 20px;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
        `;
        skipMessage.innerHTML = 'Tap anywhere or press any key to skip';
        
        // Add CSS animations
        if (!document.getElementById('countdown-styles')) {
            const style = document.createElement('style');
            style.id = 'countdown-styles';
            style.textContent = `
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.7; transform: scale(1.05); }
                }
                @keyframes countdownBounce {
                    0% { transform: scale(0.3); opacity: 0; }
                    50% { transform: scale(1.2); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes countdownGo {
                    0% { transform: scale(1); opacity: 1; color: #FF6B35; }
                    50% { transform: scale(1.3); opacity: 1; color: #4CAF50; }
                    100% { transform: scale(1.1); opacity: 0; color: #4CAF50; }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Assemble overlay
        countdownOverlay.appendChild(readyMessage);
        countdownOverlay.appendChild(countdownNumber);
        countdownOverlay.appendChild(skipMessage);
        document.body.appendChild(countdownOverlay);
        
        // Countdown logic
        const numbers = [3, 2, 1, 'GO!'];
        let currentIndex = 0;
        let skipped = false;
        
        const updateCountdown = () => {
            if (skipped) return;
            
            const currentNumber = numbers[currentIndex];
            countdownNumber.textContent = currentNumber;
            
            // Apply special styling for GO!
            if (currentNumber === 'GO!') {
                countdownNumber.style.color = '#4CAF50';
                countdownNumber.style.animation = 'countdownGo 1s ease-out';
            } else {
                countdownNumber.style.color = '#FF6B35';
                countdownNumber.style.animation = 'countdownBounce 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            }
            
            currentIndex++;
            
            if (currentIndex >= numbers.length) {
                // Countdown complete
                setTimeout(() => {
                    if (!skipped) {
                        document.body.removeChild(countdownOverlay);
                        callback(false);
                    }
                }, 800);
            } else {
                // Continue countdown
                setTimeout(updateCountdown, 900);
            }
        };
        
        // Skip functionality
        const skipCountdown = () => {
            if (skipped) return;
            skipped = true;
            document.body.removeChild(countdownOverlay);
            callback(true);
        };
        
        // Add event listeners for skip
        const keyHandler = (e) => {
            e.preventDefault();
            document.removeEventListener('keydown', keyHandler);
            countdownOverlay.removeEventListener('click', skipCountdown);
            countdownOverlay.removeEventListener('touchstart', skipCountdown);
            skipCountdown();
        };
        
        document.addEventListener('keydown', keyHandler);
        countdownOverlay.addEventListener('click', skipCountdown);
        countdownOverlay.addEventListener('touchstart', skipCountdown);
        
        // Start countdown
        updateCountdown();
    }
}