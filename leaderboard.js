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
                    // Continue without real-time features
                });
            } else {
                this.connectSocket();
            }
        } catch (error) {
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
            // Use production URL, fallback to localhost for development
            const socketURL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                ? 'http://localhost:3001' 
                : 'https://fortunate-korry-zaraytech-a15c471e.koyeb.app';
            this.socket = io(socketURL);
            
            this.socket.on('connect', () => {
                this.isConnected = true;
            });

            this.socket.on('disconnect', () => {
                this.isConnected = false;
            });

            this.socket.on('scoreSubmitted', (data) => {
                this.emit('scoreSubmitted', data);
            });

            this.socket.on('leaderboardUpdated', (data) => {
                this.currentScores = data;
                this.emit('leaderboardUpdated', data);
            });

        } catch (error) {
        }
    }

    setPlayerData(playerName, email, organizationName) {
        this.playerData = {
            playerName,
            email,
            organizationName
        };
    }

    clearPlayerData() {
        this.playerData = null;
        this.emit('playerDataCleared');
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
            throw error;
        }
    }

    async getTopScores(limit = 10) {
        try {
            const result = await this.apiClient.getTopScores(limit);
            return result.data;
        } catch (error) {
            return [];
        }
    }

    async getPlayerBestScore(email) {
        try {
            const result = await this.apiClient.getPlayerBestScore(email);
            return result.data;
        } catch (error) {
            return null;
        }
    }

    async getOrganizationLeaderboard(organizationName, limit = 10) {
        try {
            const result = await this.apiClient.getOrganizationLeaderboard(organizationName, limit);
            return result.data;
        } catch (error) {
            return [];
        }
    }

    async getRecentScores(limit = 10) {
        try {
            const result = await this.apiClient.getRecentScores(limit);
            return result.data;
        } catch (error) {
            return [];
        }
    }

    async getStatistics() {
        try {
            const result = await this.apiClient.getStatistics();
            return result.data;
        } catch (error) {
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
        return this.submitScore(playerData);
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}