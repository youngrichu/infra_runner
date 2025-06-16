// leaderboard.js
// Manages player scores and leaderboard functionality using localStorage

export class LeaderboardManager {
    constructor(maxEntries = 10) {
        this.storageKey = 'infraRunnerLeaderboard';
        this.maxEntries = maxEntries;
        this.scores = [];
        this.loadScores();
    }

    // Load scores from localStorage
    loadScores() {
        try {
            const storedScores = localStorage.getItem(this.storageKey);
            this.scores = storedScores ? JSON.parse(storedScores) : [];
        } catch (error) {
            console.error('Error loading leaderboard data:', error);
            this.scores = [];
        }
    }

    // Save scores to localStorage
    saveScores() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.scores));
        } catch (error) {
            console.error('Error saving leaderboard data:', error);
        }
    }

    // Add a new score to the leaderboard
    addScore(playerData) {
        if (!playerData || !playerData.name || typeof playerData.score !== 'number') {
            console.error('Invalid player data for leaderboard');
            return false;
        }

        // Create a leaderboard entry
        const entry = {
            name: playerData.name.substring(0, 15), // Limit name length
            score: Math.floor(playerData.score),
            blueprints: playerData.blueprints || 0,
            waterDrops: playerData.waterDrops || 0,
            energyCells: playerData.energyCells || 0,
            date: playerData.date ? new Date(playerData.date) : new Date()
        };

        // Add entry to scores array
        this.scores.push(entry);
        
        // Sort scores (highest first)
        this.scores.sort((a, b) => b.score - a.score);
        
        // Trim to max entries
        if (this.scores.length > this.maxEntries) {
            this.scores = this.scores.slice(0, this.maxEntries);
        }
        
        // Save to localStorage
        this.saveScores();
        
        // Return the position in the leaderboard (1-based)
        return this.getScorePosition(entry.score);
    }

    // Get all scores
    getScores() {
        return [...this.scores];
    }

    // Get top N scores
    getTopScores(count = this.maxEntries) {
        return this.scores.slice(0, Math.min(count, this.scores.length));
    }

    // Check if a score qualifies for the leaderboard
    qualifiesForLeaderboard(score) {
        // If we don't have max entries yet, any score qualifies
        if (this.scores.length < this.maxEntries) {
            return true;
        }
        
        // Otherwise, check if score is higher than the lowest score
        const lowestScore = this.scores[this.scores.length - 1].score;
        return score > lowestScore;
    }

    // Get position of a score in the leaderboard (1-based, 0 if doesn't qualify)
    getScorePosition(score) {
        for (let i = 0; i < this.scores.length; i++) {
            if (score >= this.scores[i].score) {
                return i + 1;
            }
        }
        
        // If we have fewer than max entries, the score would be last
        if (this.scores.length < this.maxEntries) {
            return this.scores.length + 1;
        }
        
        // Score doesn't qualify
        return 0;
    }

    // Clear all scores
    clearScores() {
        this.scores = [];
        this.saveScores();
    }

    // Create HTML element to display the leaderboard
    createLeaderboardElement() {
        const container = document.createElement('div');
        container.className = 'leaderboard-container';
        
        const title = document.createElement('h2');
        title.textContent = 'Top Scores';
        title.className = 'leaderboard-title';
        container.appendChild(title);
        
        const table = document.createElement('table');
        table.className = 'leaderboard-table';
        
        // Create header row
        const headerRow = document.createElement('tr');
        ['Rank', 'Name', 'Score', 'Blueprints', 'Water', 'Energy', 'Date'].forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            headerRow.appendChild(th);
        });
        table.appendChild(headerRow);
        
        // Create rows for each score
        this.scores.forEach((score, index) => {
            const row = document.createElement('tr');
            
            // Add rank cell
            const rankCell = document.createElement('td');
            rankCell.textContent = `${index + 1}`;
            row.appendChild(rankCell);
            
            // Add name cell
            const nameCell = document.createElement('td');
            nameCell.textContent = score.name;
            row.appendChild(nameCell);
            
            // Add score cell
            const scoreCell = document.createElement('td');
            scoreCell.textContent = score.score.toLocaleString();
            row.appendChild(scoreCell);
            
            // Add blueprints cell
            const blueprintsCell = document.createElement('td');
            blueprintsCell.textContent = score.blueprints;
            row.appendChild(blueprintsCell);
            
            // Add water drops cell
            const waterCell = document.createElement('td');
            waterCell.textContent = score.waterDrops;
            row.appendChild(waterCell);
            
            // Add energy cells cell
            const energyCell = document.createElement('td');
            energyCell.textContent = score.energyCells;
            row.appendChild(energyCell);
            
            // Add date cell
            const dateCell = document.createElement('td');
            dateCell.textContent = new Date(score.date).toLocaleDateString();
            row.appendChild(dateCell);
            
            table.appendChild(row);
        });
        
        container.appendChild(table);
        
        // Add "Back to Menu" button
        const backButton = document.createElement('button');
        backButton.textContent = 'Back to Menu';
        backButton.className = 'leaderboard-button';
        container.appendChild(backButton);
        
        return {
            element: container,
            backButton: backButton
        };
    }
}
