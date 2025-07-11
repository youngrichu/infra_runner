export const STATES = {
    LOADING: 'loading',
    MENU: 'menu',
    PLAYER_REGISTRATION: 'player_registration',
    GETTING_READY: 'getting_ready',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'game_over',
    LEADERBOARD: 'leaderboard'
};

export class GameStateManager {
    constructor() {
        this.currentState = STATES.LOADING;
        this.previousState = null;
        this.gameStartTime = null;
        this.gameEndTime = null;
        this.playerData = null;
        this.gameStats = {
            score: 0,
            blueprints: 0,
            waterDrops: 0,
            energyCells: 0,
            duration: 0
        };
        this.listeners = new Map();
    }

    setState(newState) {
        if (newState === this.currentState) {
            return;
        }

        this.previousState = this.currentState;
        this.currentState = newState;

        // Handle state-specific logic
        switch (newState) {
            case STATES.PLAYING:
                this.gameStartTime = Date.now();
                break;
            case STATES.GAME_OVER:
                this.gameEndTime = Date.now();
                if (this.gameStartTime) {
                    this.gameStats.duration = Math.floor((this.gameEndTime - this.gameStartTime) / 1000);
                }
                break;
        }

        this.emit('stateChanged', {
            currentState: this.currentState,
            previousState: this.previousState
        });
    }

    getState() {
        return this.currentState;
    }

    getPreviousState() {
        return this.previousState;
    }

    setPlayerData(playerName, email, organizationName) {
        this.playerData = {
            playerName,
            email,
            organizationName
        };
        this.emit('playerDataSet', this.playerData);
    }

    getPlayerData() {
        return this.playerData;
    }

    clearPlayerData() {
        this.playerData = null;
        this.emit('playerDataCleared');
    }

    updateGameStats(stats) {
        this.gameStats = { ...this.gameStats, ...stats };
        this.emit('gameStatsUpdated', this.gameStats);
    }

    getGameStats() {
        return { ...this.gameStats };
    }

    getGameDuration() {
        if (!this.gameStartTime) {
            return 0;
        }
        
        const endTime = this.gameEndTime || Date.now();
        return Math.floor((endTime - this.gameStartTime) / 1000);
    }

    resetGame() {
        this.gameStartTime = null;
        this.gameEndTime = null;
        this.gameStats = {
            score: 0,
            blueprints: 0,
            waterDrops: 0,
            energyCells: 0,
            duration: 0
        };
        this.emit('gameReset');
    }

    // Event system
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Error in game state event listener:', error);
                }
            });
        }
    }

    // Utility methods
    isPlaying() {
        return this.currentState === STATES.PLAYING;
    }

    isGameOver() {
        return this.currentState === STATES.GAME_OVER;
    }

    isInMenu() {
        return this.currentState === STATES.MENU;
    }

    needsPlayerRegistration() {
        return !this.playerData;
    }

    isGettingReady() {
        return this.currentState === STATES.GETTING_READY;
    }
}