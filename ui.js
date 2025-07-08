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
        this.gameOverElement.style.cursor = 'pointer';
        this.gameOverElement.innerHTML = 'GAME OVER<br><span style="font-size: 0.5em; color: #ffaaaa;">Tap to Restart</span>';
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
        const statsSize = isVerySmall ? '0.5em' : isMobile ? '0.6em' : '0.7em';
        const instructionSize = isVerySmall ? '0.35em' : isMobile ? '0.4em' : '0.5em';
        const titleSize = isVerySmall ? '0.8em' : '1em';
        const gapSize = isVerySmall ? '5px' : '10px';
        
        // Detect device type for appropriate restart instructions
        const hasGamepad = navigator.getGamepads().some(gp => gp !== null);
        const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        let restartText = '';
        if (hasTouch && isMobile) {
            restartText = 'Tap anywhere to restart';
        } else if (hasGamepad) {
            restartText = 'Press any button or R to restart';
        } else {
            restartText = 'Press R or click to restart';
        }
        
        this.gameOverElement.innerHTML = `
            <div style="margin-bottom: 15px; font-size: ${titleSize};">GAME OVER</div>
            <div style="font-size: ${instructionSize}; color: #ffaaaa; margin-bottom: 15px; animation: pulse 2s infinite;">${restartText}</div>
            <div style="font-size: ${statsSize}; color: #ffffff; line-height: 1.3;">
                <div style="margin-bottom: 8px;"><strong>Final Score: ${Math.floor(this.score)}</strong></div>
                <div style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: ${gapSize}; margin-top: 10px; padding: 0 5px;">
                    <div style="text-align: center; min-width: 60px;">🔵<br><span style="font-size: 0.9em;">Blueprints</span><br><strong>${this.blueprints}</strong></div>
                    <div style="text-align: center; min-width: 60px;">💧<br><span style="font-size: 0.9em;">Water Drops</span><br><strong>${this.waterDrops}</strong></div>
                    <div style="text-align: center; min-width: 60px;">⚡<br><span style="font-size: 0.9em;">Energy Cells</span><br><strong>${this.energyCells}</strong></div>
                </div>
                
                <!-- Leaderboard submission status -->
                <div id="leaderboard-status" style="margin-top: 15px; padding: 10px; border-radius: 8px; font-size: 0.8em;">
                    ${this.getLeaderboardStatusHTML()}
                </div>
                
                <!-- Leaderboard display -->
                <div id="leaderboard-display" style="margin-top: 15px; max-height: 150px; overflow-y: auto;">
                    ${this.getLeaderboardHTML()}
                </div>
                
                <div style="margin-top: 20px;">
                    <button id="restart-button" style="
                        background: linear-gradient(45deg, #FF6B35, #FFD700);
                        border: none;
                        color: white;
                        padding: ${isVerySmall ? '8px 16px' : '12px 24px'};
                        font-size: ${instructionSize};
                        font-weight: bold;
                        border-radius: 25px;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        text-transform: uppercase;
                        box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
                    ">🔄 Restart Game</button>
                </div>
            </div>
        `;
        
        // Add pulse animation for restart text
        if (!document.getElementById('restart-animation-style')) {
            const style = document.createElement('style');
            style.id = 'restart-animation-style';
            style.textContent = `
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }
                #restart-button:hover {
                    transform: translateY(-2px) scale(1.05);
                    box-shadow: 0 6px 20px rgba(255, 107, 53, 0.4);
                }
                #restart-button:active {
                    transform: translateY(0) scale(0.98);
                }
            `;
            document.head.appendChild(style);
        }
        
        // Add restart button functionality
        setTimeout(() => {
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
        }, 100);
        
        console.log('Game Over! Final Score:', Math.floor(this.score));
        console.log(`Blueprints: ${this.blueprints}, Water Drops: ${this.waterDrops}, Energy Cells: ${this.energyCells}`);
        
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
            return `<div style="color: #FFD700; text-align: center;">📤 Submitting score...</div>`;
        } else if (this.scoreSubmitted) {
            return `<div style="color: #4CAF50; text-align: center;">✅ Score submitted successfully!</div>`;
        } else {
            return `<div style="color: #ff9800; text-align: center;">⚠️ Score not submitted</div>`;
        }
    }

    getLeaderboardHTML() {
        if (!this.leaderboardData || this.leaderboardData.length === 0) {
            return '<div style="color: #888; text-align: center; padding: 20px;">Loading leaderboard...</div>';
        }

        const topScores = this.leaderboardData.slice(0, 5);
        let html = '<div style="color: #FFD700; text-align: center; margin-bottom: 10px; font-weight: bold;">Top Scores</div>';
        
        topScores.forEach((score, index) => {
            const rank = index + 1;
            const emoji = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : rank + 'th';
            const nameLimit = 12;
            const displayName = score.player_name.length > nameLimit ? 
                score.player_name.substring(0, nameLimit) + '...' : score.player_name;
            
            html += '<div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 10px; margin: 2px 0; background: rgba(255,255,255,0.1); border-radius: 4px; font-size: 0.9em;"><span>' + emoji + ' ' + displayName + '</span><span style="color: #FFD700; font-weight: bold;">' + Math.floor(score.score) + '</span></div>';
        });

        return html;
    }

    updateLeaderboard(leaderboardData) {
        this.leaderboardData = leaderboardData;
        const displayElement = document.getElementById('leaderboard-display');
        if (displayElement) {
            displayElement.innerHTML = this.getLeaderboardHTML();
        }
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
            console.warn('Leaderboard manager not available');
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
            console.error('Failed to submit score:', error);
            this.updateLeaderboardStatus(false, false);
        }
    }

    async loadLeaderboard() {
        if (!this.gameController || !this.gameController.leaderboardManager) {
            return;
        }

        try {
            const leaderboardData = await this.gameController.leaderboardManager.getTopScores(10);
            this.updateLeaderboard(leaderboardData);
        } catch (error) {
            console.error('Failed to load leaderboard:', error);
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
}