export class UIManager {
    constructor() {
        this.scoreElement = null;
        this.gameOverElement = null;
        this.splashElement = null;       
        this.startMenuElement = null;    
        this.userInfoElement = null;     
        this.leaderboardElement = null;  

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
        this.createSplashScreen();
        this.createStartMenuScreen();
        this.createUserInfoScreen();
        this.createLeaderboardScreen();
    }

    createScoreDisplay() {
        this.scoreElement = document.createElement('div');
        this.scoreElement.className = 'score-display';
        document.body.appendChild(this.scoreElement);
        this.updateScoreDisplay();
    }

    createGameOverScreen() {
        this.gameOverElement = document.createElement('div');
        this.gameOverElement.className = 'game-over';
        this.gameOverElement.style.display = 'none';
        this.gameOverElement.innerHTML = `
            <div class="game-over-title">GAME OVER</div>
            <div class="game-over-stats" id="game-over-stats"></div>
            <div class="game-over-instruction">Press R to Restart</div>
        `;
        document.body.appendChild(this.gameOverElement);
    }

    /* ------------------------------------------------------------------ */
    /*                            NEW SCREENS                             */
    /* ------------------------------------------------------------------ */

    createSplashScreen() {
        this.splashElement = document.createElement('div');
        this.splashElement.className = 'splash-screen';
        this.splashElement.innerHTML = `
            <div class="splash-logo">Infrastructure Runner</div>
            <div class="splash-subtitle">African City Edition</div>
        `;
        document.body.appendChild(this.splashElement);
        this.hideElement(this.splashElement);
    }

    createStartMenuScreen() {
        this.startMenuElement = document.createElement('div');
        this.startMenuElement.className = 'start-menu';
        
        const title = document.createElement('h1');
        title.className = 'game-title';
        title.innerText = 'Infrastructure Runner';
        
        const subtitle = document.createElement('p');
        subtitle.innerText = 'African City Edition';
        subtitle.style.fontSize = '18px';
        subtitle.style.marginBottom = '40px';
        subtitle.style.opacity = '0.8';
        
        const playBtn = document.createElement('button');
        playBtn.className = 'menu-button';
        playBtn.innerText = 'Play';
        
        this.startMenuElement.appendChild(title);
        this.startMenuElement.appendChild(subtitle);
        this.startMenuElement.appendChild(playBtn);
        document.body.appendChild(this.startMenuElement);
        this.hideElement(this.startMenuElement);

        // Expose event so game.js can hook into starting game
        this.onStartButtonClicked = null;
        playBtn.addEventListener('click', () => {
            if (typeof this.onStartButtonClicked === 'function') {
                this.onStartButtonClicked();
            }
        });
    }

    createUserInfoScreen() {
        this.userInfoElement = document.createElement('div');
        this.userInfoElement.className = 'user-info';
        
        const container = document.createElement('div');
        container.className = 'user-info-container';
        
        const title = document.createElement('h2');
        title.className = 'user-info-title';
        title.innerText = 'Great Run! Enter Your Name';
        
        const form = document.createElement('div');
        form.className = 'user-info-form';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 15;
        input.className = 'user-info-input';
        input.placeholder = 'Your Name';
        
        const submitBtn = document.createElement('button');
        submitBtn.innerText = 'Submit Score';
        
        form.appendChild(input);
        form.appendChild(submitBtn);
        container.appendChild(title);
        container.appendChild(form);
        this.userInfoElement.appendChild(container);
        document.body.appendChild(this.userInfoElement);
        this.hideElement(this.userInfoElement);

        this.onUserInfoSubmitted = null; // callback(name)
        
        const submitScore = () => {
            const name = input.value.trim() || 'Anonymous';
            if (typeof this.onUserInfoSubmitted === 'function') {
                this.onUserInfoSubmitted(name);
            }
        };
        
        submitBtn.addEventListener('click', submitScore);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submitScore();
        });
    }

    createLeaderboardScreen() {
        this.leaderboardElement = document.createElement('div');
        this.leaderboardElement.className = 'leaderboard';

        const container = document.createElement('div');
        container.className = 'leaderboard-container';
        
        const title = document.createElement('h2');
        title.className = 'leaderboard-title';
        title.innerText = 'Top Scores';
        container.appendChild(title);

        // Create professional table
        this.leaderboardTable = document.createElement('table');
        this.leaderboardTable.className = 'leaderboard-table';
        container.appendChild(this.leaderboardTable);

        // Back button
        const backBtn = document.createElement('button');
        backBtn.className = 'leaderboard-back';
        backBtn.innerText = 'Back to Menu';
        container.appendChild(backBtn);
        
        this.leaderboardElement.appendChild(container);
        document.body.appendChild(this.leaderboardElement);
        this.hideElement(this.leaderboardElement);

        this.onLeaderboardBack = null; // callback()
        backBtn.addEventListener('click', () => {
            if (typeof this.onLeaderboardBack === 'function') {
                this.onLeaderboardBack();
            }
        });
    }

    /* --------------------------- Screen Helpers ------------------------ */

    showElement(el) { if (el) el.style.display = 'flex'; }
    hideElement(el) { if (el) el.style.display = 'none'; }

    showSplash() { this.showElement(this.splashElement); }
    hideSplash() { this.hideElement(this.splashElement); }

    showStartMenu() { this.showElement(this.startMenuElement); }
    hideStartMenu() { this.hideElement(this.startMenuElement); }

    showUserInfo() { 
        // Focus on input when showing user info screen
        this.showElement(this.userInfoElement);
        setTimeout(() => {
            const input = this.userInfoElement.querySelector('.user-info-input');
            if (input) input.focus();
        }, 100);
    }
    hideUserInfo() { this.hideElement(this.userInfoElement); }

    showLeaderboard() { this.showElement(this.leaderboardElement); }
    hideLeaderboard() { this.hideElement(this.leaderboardElement); }

    /* --------------------------- Leaderboard --------------------------- */

    /**
     * Update leaderboard table with an array of entries:
     * [{ name, score, blueprints, waterDrops, energyCells, date }, ...]
     */
    updateLeaderboard(entries = []) {
        if (!this.leaderboardTable) return;

        console.log('🏆 DEBUG: Updating leaderboard with', entries.length, 'entries:', entries);

        // Clear existing rows
        this.leaderboardTable.innerHTML = '';

        // Header row
        const headerRow = document.createElement('tr');
        ['Rank','Name','Score','Blueprints','Water','Energy','Date'].forEach(h => {
            const th = document.createElement('th');
            th.innerText = h;
            headerRow.appendChild(th);
        });
        this.leaderboardTable.appendChild(headerRow);

        if (entries.length === 0) {
            // Show "no scores yet" message
            const emptyRow = document.createElement('tr');
            const emptyCell = document.createElement('td');
            emptyCell.colSpan = 7;
            emptyCell.style.textAlign = 'center';
            emptyCell.style.padding = '40px';
            emptyCell.style.opacity = '0.7';
            emptyCell.innerText = 'No scores yet - be the first!';
            emptyRow.appendChild(emptyCell);
            this.leaderboardTable.appendChild(emptyRow);
            return;
        }

        entries.forEach((entry, idx) => {
            const row = document.createElement('tr');
            
            // Add rank styling for top 3
            if (idx === 0) row.className = 'rank-1';
            else if (idx === 1) row.className = 'rank-2';
            else if (idx === 2) row.className = 'rank-3';
            
            const cells = [
                idx + 1,
                entry.name || 'Anonymous',
                (entry.score || 0).toLocaleString(),
                entry.blueprints || 0,
                entry.waterDrops || 0,
                entry.energyCells || 0,
                entry.date ? new Date(entry.date).toLocaleDateString() : 'Today'
            ];
            
            cells.forEach(val => {
                const td = document.createElement('td');
                td.innerText = val;
                row.appendChild(td);
            });
            this.leaderboardTable.appendChild(row);
        });
        
        console.log('✅ Leaderboard updated successfully');
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
        if (this.scoreElement) {
            this.scoreElement.innerHTML = `
                <div class="score-value">Score: ${Math.floor(this.score)}</div>
                <div>BP: ${this.blueprints} | WD: ${this.waterDrops} | EC: ${this.energyCells}</div>
            `;
        }
    }

    showGameOver() {
        const statsElement = this.gameOverElement.querySelector('#game-over-stats');
        if (statsElement) {
            statsElement.innerHTML = `
                <div><span class="stat-label">Final Score:</span> ${Math.floor(this.score)}</div>
                <div><span class="stat-label">Blueprints:</span> ${this.blueprints}</div>
                <div><span class="stat-label">Water Drops:</span> ${this.waterDrops}</div>
                <div><span class="stat-label">Energy Cells:</span> ${this.energyCells}</div>
            `;
        }
        this.gameOverElement.style.display = 'block';
        console.log('Game Over! Final Score:', Math.floor(this.score));
        console.log(`Blueprints: ${this.blueprints}, Water Drops: ${this.waterDrops}, Energy Cells: ${this.energyCells}`);
    }

    hideGameOver() {
        this.gameOverElement.style.display = 'none';
    }

    addPowerUpToUI(name, durationSeconds) {
        const powerUpElement = document.createElement('div');
        powerUpElement.className = 'power-up';
        powerUpElement.style.top = `${70 + this.powerUpElements.length * 60}px`;
        
        powerUpElement.innerHTML = `
            <span class="power-up-icon">${name.substring(0, 2)}</span>
            <span>${name.substring(3)}</span>
            <span class="power-up-timer">${durationSeconds}s</span>
        `;
        
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
                p.element.style.top = `${70 + index * 60}px`;
            }
        });
    }

    // Performance optimized: Only update timers every 100ms instead of every frame
    updatePowerUpTimers() {
        // Only update every 6 frames (about 100ms at 60fps) to reduce performance impact
        if (!this.timerUpdateCounter) this.timerUpdateCounter = 0;
        this.timerUpdateCounter++;
        if (this.timerUpdateCounter % 6 !== 0) return;

        for (const powerUp of this.activePowerUps) {
            const elapsed = (Date.now() - powerUp.startTime) / 1000;
            const remaining = Math.max(0, powerUp.duration - elapsed);
            const timerElement = powerUp.element?.querySelector('.power-up-timer');
            if (timerElement) {
                timerElement.innerText = `${remaining.toFixed(1)}s`;
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
        this.timerUpdateCounter = 0;
        
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