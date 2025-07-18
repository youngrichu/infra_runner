export class APIClient {
    constructor(baseURL = 'https://infra-runner-leaderboard-api.onrender.com/') {
        this.baseURL = baseURL;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
            },
            ...options,
        };

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            // API request failed
            throw error;
        }
    }

    async submitScore(playerData) {
        return this.request('api/leaderboard/submit', {
            method: 'POST',
            body: playerData,
        });
    }

    async getTopScores(limit = 10) {
        return this.request(`api/leaderboard/top?limit=${limit}`);
    }

    async getPlayerBestScore(email) {
        return this.request(`api/leaderboard/player/${encodeURIComponent(email)}`);
    }

    async getOrganizationLeaderboard(organizationName, limit = 10) {
        return this.request(`api/leaderboard/organization/${encodeURIComponent(organizationName)}?limit=${limit}`);
    }

    async getRecentScores(limit = 10) {
        return this.request(`api/leaderboard/recent?limit=${limit}`);
    }

    async getStatistics() {
        return this.request('api/leaderboard/statistics');
    }
}