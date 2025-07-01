export class UIManager {
    constructor() {
        this.scoreElement = null;
        this.gameOverElement = null;
        this.powerUpElements = [];
        this.activePowerUps = [];
        
        this.score = 0;
        this.blueprints = 0;
        this.waterDrops = 0;
        this.energyCells = 0;
        
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
        this.gameOverElement.innerHTML = 'GAME OVER<br><span style="font-size: 0.5em; color: #ffaaaa;">Press R to Restart</span>';
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

    showGameOver() {
        this.gameOverElement.style.display = 'block';
        const isMobile = window.innerWidth <= 768;
        const isVerySmall = window.innerWidth <= 480;
        const statsSize = isVerySmall ? '0.5em' : isMobile ? '0.6em' : '0.7em';
        const instructionSize = isVerySmall ? '0.35em' : isMobile ? '0.4em' : '0.5em';
        const titleSize = isVerySmall ? '0.8em' : '1em';
        const gapSize = isVerySmall ? '5px' : '10px';
        
        this.gameOverElement.innerHTML = `
            <div style="margin-bottom: 15px; font-size: ${titleSize};">GAME OVER</div>
            <div style="font-size: ${instructionSize}; color: #ffaaaa; margin-bottom: 15px;">Press R to Restart</div>
            <div style="font-size: ${statsSize}; color: #ffffff; line-height: 1.3;">
                <div style="margin-bottom: 8px;"><strong>Final Score: ${Math.floor(this.score)}</strong></div>
                <div style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: ${gapSize}; margin-top: 10px; padding: 0 5px;">
                    <div style="text-align: center; min-width: 60px;">🔵<br><span style="font-size: 0.9em;">Blueprints</span><br><strong>${this.blueprints}</strong></div>
                    <div style="text-align: center; min-width: 60px;">💧<br><span style="font-size: 0.9em;">Water Drops</span><br><strong>${this.waterDrops}</strong></div>
                    <div style="text-align: center; min-width: 60px;">⚡<br><span style="font-size: 0.9em;">Energy Cells</span><br><strong>${this.energyCells}</strong></div>
                </div>
            </div>
        `;
        console.log('Game Over! Final Score:', Math.floor(this.score));
        console.log(`Blueprints: ${this.blueprints}, Water Drops: ${this.waterDrops}, Energy Cells: ${this.energyCells}`);
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