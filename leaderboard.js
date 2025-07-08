import { APIClient } from './api-client.js';

export class LeaderboardManager {
    constructor() {
        this.apiClient = new APIClient();
        this.socket = null;
        this.isConnected = false;
        this.playerData = null;
        this.currentScores = [];
        this.listeners = new Map();
        
        this.initializeSocket();
    }

    initializeSocket() {
        try {
            // Load Socket.IO from CDN if not already loaded
            if (typeof io === 'undefined') {
                this.loadSocketIO().then(() => {
                    this.connectSocket();
                }).catch(error => {
                    console.warn('Failed to load Socket.IO:', error);
                    // Continue without real-time features
                });
            } else {
                this.connectSocket();
            }
        } catch (error) {
            console.warn('Socket.IO initialization failed:', error);
            // Continue without real-time features
        }
    }

    async loadSocketIO() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.socket.io/4.7.4/socket.io.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    connectSocket() {
        try {
            this.socket = io('http://localhost:3001');
            
            this.socket.on('connect', () => {
                this.isConnected = true;
                console.log('Connected to leaderboard server');
            });

            this.socket.on('disconnect', () => {
                this.isConnected = false;
                console.log('Disconnected from leaderboard server');
            });

            this.socket.on('scoreSubmitted', (data) => {
                this.emit('scoreSubmitted', data);
            });

            this.socket.on('leaderboardUpdated', (data) => {
                this.currentScores = data;
                this.emit('leaderboardUpdated', data);
            });

        } catch (error) {
            console.warn('Failed to connect to leaderboard server:', error);
        }
    }

    setPlayerData(playerName, email, organizationName) {
        this.playerData = {
            playerName,
            email,
            organizationName
        };
    }

    async submitScore(gameStats) {
        if (!this.playerData) {
            throw new Error('Player data not set. Call setPlayerData() first.');
        }

        const scoreData = {
            ...this.playerData,
            score: gameStats.score,
            gameDuration: gameStats.duration,
            blueprintsCollected: gameStats.blueprints || 0,
            waterDropsCollected: gameStats.waterDrops || 0,
            energyCellsCollected: gameStats.energyCells || 0
        };

        try {
            const result = await this.apiClient.submitScore(scoreData);
            this.emit('scoreSubmitted', result);
            return result;
        } catch (error) {
            console.error('Failed to submit score:', error);
            throw error;
        }
    }

    async getTopScores(limit = 10) {
        try {
            const result = await this.apiClient.getTopScores(limit);
            return result.data;
        } catch (error) {
            console.error('Failed to get top scores:', error);
            return [];
        }
    }

    async getPlayerBestScore(email) {
        try {
            const result = await this.apiClient.getPlayerBestScore(email);
            return result.data;
        } catch (error) {
            console.error('Failed to get player best score:', error);
            return null;
        }
    }

    async getOrganizationLeaderboard(organizationName, limit = 10) {
        try {
            const result = await this.apiClient.getOrganizationLeaderboard(organizationName, limit);
            return result.data;
        } catch (error) {
            console.error('Failed to get organization leaderboard:', error);
            return [];
        }
    }

    async getRecentScores(limit = 10) {
        try {
            const result = await this.apiClient.getRecentScores(limit);
            return result.data;
        } catch (error) {
            console.error('Failed to get recent scores:', error);
            return [];
        }
    }

    async getStatistics() {
        try {
            const result = await this.apiClient.getStatistics();
            return result.data;
        } catch (error) {
            console.error('Failed to get statistics:', error);
            return null;
        }
    }

    // Event system for real-time updates
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
                    console.error('Error in leaderboard event listener:', error);
                }
            });
        }
    }

    // Legacy method for backward compatibility
    getScores() {
        return this.currentScores;
    }

    // Legacy method for backward compatibility
    addScore(playerData) {
        console.warn('addScore is deprecated. Use submitScore instead.');
        return this.submitScore(playerData);
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}