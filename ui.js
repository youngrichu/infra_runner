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
        this.scoreElement.style.fontSize = '24px';
        this.scoreElement.style.zIndex = '1000';
        document.body.appendChild(this.scoreElement);
        this.updateScoreDisplay();
    }

    createGameOverScreen() {
        this.gameOverElement = document.createElement('div');
        this.gameOverElement.style.position = 'absolute';
        this.gameOverElement.style.top = '50%';
        this.gameOverElement.style.left = '50%';
        this.gameOverElement.style.transform = 'translate(-50%, -50%)';
        this.gameOverElement.style.color = 'red';
        this.gameOverElement.style.fontFamily = 'Arial, sans-serif';
        this.gameOverElement.style.fontSize = '48px';
        this.gameOverElement.style.textAlign = 'center';
        this.gameOverElement.style.zIndex = '1001';
        this.gameOverElement.style.display = 'none';
        this.gameOverElement.innerHTML = 'GAME OVER<br>Press R to Restart';
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
        this.gameOverElement.innerHTML = `GAME OVER<br>Press R to Restart<br><br>Final Score: ${Math.floor(this.score)}<br>Blueprints: ${this.blueprints}<br>Water Drops: ${this.waterDrops}<br>Energy Cells: ${this.energyCells}`;
        console.log('Game Over! Final Score:', Math.floor(this.score));
        console.log(`Blueprints: ${this.blueprints}, Water Drops: ${this.waterDrops}, Energy Cells: ${this.energyCells}`);
    }

    hideGameOver() {
        this.gameOverElement.style.display = 'none';
    }

    addPowerUpToUI(name, durationSeconds) {
        const powerUpElement = document.createElement('div');
        powerUpElement.style.position = 'absolute';
        powerUpElement.style.top = `${70 + this.powerUpElements.length * 30}px`;
        powerUpElement.style.left = '10px';
        powerUpElement.style.color = 'white';
        powerUpElement.style.fontFamily = 'Arial, sans-serif';
        powerUpElement.style.fontSize = '16px';
        powerUpElement.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        powerUpElement.style.padding = '5px';
        powerUpElement.style.borderRadius = '5px';
        powerUpElement.style.zIndex = '1000';
        powerUpElement.innerHTML = `${name}: ${durationSeconds}s`;
        document.body.appendChild(powerUpElement);
        
        const powerUp = {
            element: powerUpElement,
            name: name,
            duration: durationSeconds,
            startTime: Date.now()
        };
        this.powerUpElements.push(powerUp);
        this.activePowerUps.push(powerUp);
        
        setTimeout(() => {
            this.removePowerUpFromUI(powerUp);
        }, durationSeconds * 1000);
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
                p.element.style.top = `${70 + index * 30}px`;
            }
        });
    }

    updatePowerUpTimers() {
        for (const powerUp of this.activePowerUps) {
            const elapsed = (Date.now() - powerUp.startTime) / 1000;
            const remaining = Math.max(0, powerUp.duration - elapsed);
            if (powerUp.element) {
                powerUp.element.innerHTML = `${powerUp.name}: ${remaining.toFixed(1)}s`;
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
}