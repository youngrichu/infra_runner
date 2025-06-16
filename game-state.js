// game-state.js
// Manages different game states and transitions between them

// Game state constants
export const STATES = {
    SPLASH: 'splash',         // Initial loading/splash screen
    START_MENU: 'startMenu',  // Main menu screen
    PLAYING: 'playing',       // Active gameplay
    GAME_OVER: 'gameOver',    // Game over screen with score display
    USER_INFO: 'userInfo',    // Collecting user info for leaderboard
    LEADERBOARD: 'leaderboard' // Leaderboard display
};

export class GameStateManager {
    constructor() {
        // Initialize with splash screen state
        this.currentState = STATES.SPLASH;
        this.previousState = null;
        
        // State change callbacks
        this.onStateChangeCallbacks = [];
        
        // Player data for leaderboard
        this.playerData = {
            name: '',
            score: 0,
            blueprints: 0,
            waterDrops: 0,
            energyCells: 0,
            date: null
        };
        
        // Timer for splash screen auto-transition
        this.splashTimer = null;
    }
    
    // Change to a new state
    changeState(newState) {
        if (newState === this.currentState) return;
        
        this.previousState = this.currentState;
        this.currentState = newState;
        
        // Notify all listeners about state change
        this.notifyStateChange();
        
        // Performance: Only log state changes in debug mode
        if (window.gameDebug || this.currentState === 'playing') {
            console.log(`Game state changed: ${this.previousState} -> ${this.currentState}`);
        }
    }
    
    // Get current state
    getCurrentState() {
        return this.currentState;
    }
    
    // Check if a specific state is active
    isState(state) {
        return this.currentState === state;
    }
    
    // Register callback for state changes
    onStateChange(callback) {
        if (typeof callback === 'function') {
            this.onStateChangeCallbacks.push(callback);
        }
    }
    
    // Notify all listeners about state change
    notifyStateChange() {
        for (const callback of this.onStateChangeCallbacks) {
            callback(this.currentState, this.previousState);
        }
    }
    
    // Start splash screen with auto-transition to start menu
    startSplashScreen(duration = 3000) {
        this.changeState(STATES.SPLASH);
        
        // Auto-transition to start menu after duration
        this.splashTimer = setTimeout(() => {
            this.changeState(STATES.START_MENU);
        }, duration);
    }
    
    // Start the game
    startGame() {
        this.changeState(STATES.PLAYING);
    }
    
    // End the game and show game over screen
    endGame(score, collectableStats) {
        // Store score data
        this.playerData.score = score;
        this.playerData.blueprints = collectableStats.blueprints;
        this.playerData.waterDrops = collectableStats.waterDrops;
        this.playerData.energyCells = collectableStats.energyCells;
        this.playerData.date = new Date();
        
        this.changeState(STATES.GAME_OVER);
    }
    
    // Show user info collection screen
    showUserInfoScreen() {
        this.changeState(STATES.USER_INFO);
    }
    
    // Save user info and show leaderboard
    saveUserInfo(name) {
        this.playerData.name = name;
        this.changeState(STATES.LEADERBOARD);
    }
    
    // Show leaderboard screen
    showLeaderboard() {
        this.changeState(STATES.LEADERBOARD);
    }
    
    // Return to start menu
    returnToMenu() {
        this.changeState(STATES.START_MENU);
    }
    
    // Get player data
    getPlayerData() {
        return { ...this.playerData };
    }
    
    // Clean up resources
    destroy() {
        if (this.splashTimer) {
            clearTimeout(this.splashTimer);
            this.splashTimer = null;
        }
        this.onStateChangeCallbacks = [];
    }
}
