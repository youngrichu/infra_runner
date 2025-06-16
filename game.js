import * as THREE from 'three';
import { Player } from './player.js';
import { DirectModelEnvironment } from './direct-model-environment.js';
import { ObstacleManager } from './obstacles.js';
import { CollectableManager } from './collectables.js';
import { PowerUpManager } from './powerups.js';
import { UIManager } from './ui.js';
import { InputManager } from './input.js';
import { GAME_CONFIG, SCORING, SPAWN_CONFIG, PHYSICS } from './constants.js';
import { GameStateManager, STATES } from './game-state.js';
import { LeaderboardManager } from './leaderboard.js';

export class Game {
    constructor() {
        // Core Three.js components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        
        // Game managers
        this.player = null;
        this.environment = null;
        this.obstacleManager = null;
        this.collectableManager = null;
        this.powerUpManager = null;
        this.uiManager = null;
        this.inputManager = null;

        // New managers for state & leaderboard
        this.stateManager = new GameStateManager();
        this.leaderboardManager = new LeaderboardManager();
        
        // Performance optimization: Cache playing state to avoid checking every frame
        this.isCurrentlyPlaying = false;
        
        // Game state
        this.gameActive = true;
        this.gameSpeed = { value: GAME_CONFIG.INITIAL_SPEED }; // Using object for reference
        
        // CRITICAL FIX: Improved spawning system to handle dual tracking
        this.improvedSpawningFix = {
            reset: () => {
                // Reset any additional spawning state if needed
                if (this.collectableManager && this.collectableManager.spawnHistory) {
                    this.collectableManager.spawnHistory.lastPowerUpDistance = -100;
                    console.log('✅ Improved spawning system reset - dual tracking synchronized');
                }
            }
        };
        
        this.init();
    }

    async init() { // Make init async
        this.setupThreeJS();
        await this.createManagers(); // Await manager creation
        this.setupInputManager();
        this.setupStateHandlers();
        this.startSpawning();
        this.animate();

        // Kick off splash -> menu flow
        this.stateManager.startSplashScreen();
    }

    setupThreeJS() {
        // Scene setup
        this.scene = new THREE.Scene();

        // Camera setup
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 5;
        this.camera.position.y = 2;
        this.camera.lookAt(0, 0, 0);

        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.getElementById('game-container').appendChild(this.renderer.domElement);
    }

    async createManagers() { // Make createManagers async
        // Create managers in dependency order
        this.environment = new DirectModelEnvironment(this.scene);
        this.player = new Player(this.scene);
        await this.player.initialize(); // Await player initialization

        this.obstacleManager = new ObstacleManager(this.scene);
        this.collectableManager = new CollectableManager(this.scene);
        this.powerUpManager = new PowerUpManager(this.scene, this.player);
        this.uiManager = new UIManager();
        
        // Set game controller references so managers can access current game state
        this.environment.setGameController(this);
        this.obstacleManager.setGameController(this);
        this.collectableManager.setGameController(this);
        
        // Set game speed reference for power-ups
        this.powerUpManager.setGameSpeedReference(this.gameSpeed);
        
        // Set collectable manager reference for power-ups (to remove aerial stars)
        this.powerUpManager.setCollectableManager(this.collectableManager);
    }

    setupInputManager() {
        this.inputManager = new InputManager(this.player, this);
        // Optional: Enable mobile controls
        this.inputManager.setupMobileControls();
    }

    // ------------------------------------------------------------------
    //                     STATE & UI EVENT HANDLERS
    // ------------------------------------------------------------------

    setupStateHandlers() {
        // React to state changes
        this.stateManager.onStateChange((state) => {
            // Performance optimization: Cache playing state
            this.isCurrentlyPlaying = (state === STATES.PLAYING);
            
            switch (state) {
                case STATES.SPLASH:
                    this.uiManager.showSplash();
                    break;
                case STATES.START_MENU:
                    this.uiManager.hideSplash();
                    this.uiManager.hideLeaderboard();
                    this.uiManager.hideUserInfo();
                    this.uiManager.showStartMenu();
                    // Pause game logic
                    this.gameActive = false;
                    break;
                case STATES.PLAYING:
                    this.uiManager.hideStartMenu();
                    this.uiManager.hideLeaderboard();
                    this.uiManager.hideUserInfo();
                    this.restartGame(); // Ensure fresh run
                    this.gameActive = true;
                    break;
                case STATES.USER_INFO:
                    this.uiManager.showUserInfo();
                    break;
                case STATES.LEADERBOARD:
                    // Update table then show
                    this.uiManager.updateLeaderboard(this.leaderboardManager.getScores());
                    this.uiManager.hideUserInfo();
                    this.uiManager.showLeaderboard();
                    // Stop gameplay until menu
                    this.gameActive = false;
                    break;
            }
        });

        // Wire UI events
        this.uiManager.onStartButtonClicked = () => this.handleStartGame();
        this.uiManager.onUserInfoSubmitted   = (name) => this.handleUserInfo(name);
        this.uiManager.onLeaderboardBack     = () => this.stateManager.returnToMenu();
    }

    handleStartGame() {
        this.stateManager.startGame(); // Triggers PLAYING state
    }

    handleUserInfo(name) {
        // Save info into state manager
        this.stateManager.saveUserInfo(name);
        // Persist to leaderboard
        this.leaderboardManager.addScore(this.stateManager.getPlayerData());
        // Show leaderboard
        this.stateManager.showLeaderboard();
    }

    getGameSpeed() {
        return this.gameSpeed.value;
    }

    // Public methods for managers to access current game state
    // getPlayerPosition() is already defined below
    // isGameActive() is already defined below

    startSpawning() {
        this.obstacleManager.startSpawning();
        this.environment.startSpawning();
        this.collectableManager.startSpawning();
    }

    updateGameLogic() {
        // Performance optimization: Use cached playing state instead of checking every frame
        if (!this.isCurrentlyPlaying || !this.gameActive) return;
        
        // Pause most game logic if player is stumbling
        if (this.player.isStumbling) {
            // Only update player position to handle stumble animation, but pause everything else
            this.player.updatePosition(
                this.powerUpManager.getFlyingStatus(),
                this.powerUpManager.getWaterSlideObjects(),
                this.gameSpeed.value
            );
            return; // Skip all other game logic during stumble
        }

        // Update player position
        this.player.updatePosition(
            this.powerUpManager.getFlyingStatus(),
            this.powerUpManager.getWaterSlideObjects(),
            this.gameSpeed.value  // Pass game speed for animation state management
        );

        // Update all objects
        this.updateAllObjects();

        // Check collisions
        this.checkCollisions();

        // NEW: Fair power-up spawning system (like Subway Surfers)
        if (this.collectableManager.shouldSpawnPowerUp()) {
            const playerZ = this.player.getPosition().z;
            const obstacles = this.obstacleManager.getObstacles();
            this.collectableManager.createPowerUp(playerZ, obstacles);
            this.collectableManager.markPowerUpSpawned();
        }

        // Handle aerial collectibles when flying
        if (this.powerUpManager.getFlyingStatus() && Math.random() < SPAWN_CONFIG.AERIAL_SPAWN_CHANCE) {
            this.collectableManager.createAerialCollectable(this.player.getPosition());
        }
        
        // Handle solar orbs when solar boost is active
        if (this.powerUpManager.getSolarBoostStatus() && Math.random() < SPAWN_CONFIG.SOLAR_ORB_SPAWN_CHANCE) {
            this.collectableManager.createSolarOrb(this.player.getPosition());
        }

        // Update camera
        this.updateCamera();

        // Update game speed and score
        this.updateGameSpeed();
        
        // Update power-up timers
        const frameTime = 1000 / 60; // Assuming 60 FPS
        this.powerUpManager.updateTimers(frameTime);
        
        // Update UI timers
        this.uiManager.updatePowerUpTimers();

        // Apply magnet effect if solar boost is active
        if (this.powerUpManager.getSolarBoostStatus()) {
            // Performance: Only log occasionally to avoid console spam
            if (!this.magnetLogCounter) this.magnetLogCounter = 0;
            if (this.magnetLogCounter++ % 300 === 0) {
                console.log('✨ DEBUG: Applying magnet effect - Solar boost is active');
            }
            this.collectableManager.applyMagnetEffect(
                this.player.getPosition(),
                PHYSICS.MAGNET_RADIUS,
                PHYSICS.MAGNET_PULL_SPEED
            );
        }
    }

    updateAllObjects() {
        // Update obstacles and gain score for passed obstacles
        const obstacleScore = this.obstacleManager.updateObstacles(
            this.gameSpeed.value,
            this.camera.position.z,
            this.gameActive
        );
        this.uiManager.updateScore(obstacleScore);

        // Update buildings
        this.environment.updateBuildings(this.gameSpeed.value, this.camera.position.z);

        // Update collectables
        this.collectableManager.updateCollectables(this.gameSpeed.value, this.camera.position.z);

        // Update environment
        this.environment.updateGround(this.camera.position.z);

        // Update water slide if active
        this.powerUpManager.updateWaterSlidePosition(this.gameSpeed.value);
    }

    checkCollisions() {
        const playerBox = this.player.getCollisionBox();

        // Check obstacle collisions (if not invincible, not stumbling, and not flying)
        if (!this.powerUpManager.getInvincibilityStatus() && !this.player.isStumbling && !this.powerUpManager.getFlyingStatus()) {
            const collision = this.obstacleManager.checkCollisions(
                playerBox,
                this.powerUpManager.getWaterSlideObjects(),
                this.powerUpManager.getWaterSlideStatus()
            );
            
            if (collision) {
                // Performance: Reduce collision logging
                console.log('*** COLLISION DETECTED ***');
                
                // Try to trigger stumble animation with game over callback
                const stumbleTriggered = this.player.triggerStumble(() => this.gameOver());
                
                if (!stumbleTriggered) {
                    // If stumble animation not available, immediate game over
                    this.gameOver();
                    return;
                }
                return;
            }
        }

        // Check collectable collisions
        const collectedItems = this.collectableManager.checkCollisions(playerBox);
        this.handleCollectedItems(collectedItems);
    }

    handleCollectedItems(collectedItems) {
        for (const itemType of collectedItems) {
            switch (itemType) {
                // Regular collectibles
                case 'blueprint':
                    this.uiManager.updateCollectables('blueprint', SCORING.BLUEPRINT);
                    break;
                case 'waterDrop':
                    this.uiManager.updateCollectables('waterDrop', SCORING.WATER_DROP);
                    break;
                case 'energyCell':
                    this.uiManager.updateCollectables('energyCell', SCORING.ENERGY_CELL);
                    break;
                case 'aerialStar':
                    this.uiManager.updateScore(SCORING.AERIAL_STAR);
                    break;
                case 'solarOrb':
                    this.uiManager.updateScore(SCORING.SOLAR_ORB);
                    break;
                    
                // Power-ups
                case 'hardHat':
                    this.uiManager.updateScore(SCORING.POWER_UP);
                    this.powerUpManager.activateInvincibility();
                    this.uiManager.addPowerUpToUI('🛡️ Hard Hat Shield', 5);
                    this.collectableManager.markPowerUpSpawned(); // Reset fair spawning timer
                    break;
                case 'helicopter':
                    this.uiManager.updateScore(SCORING.POWER_UP);
                    this.powerUpManager.activateHelicopter();
                    this.uiManager.addPowerUpToUI('🚁 Helicopter Ride', 10);
                    this.collectableManager.markPowerUpSpawned(); // Reset fair spawning timer
                    break;
                case 'solarPower':
                    this.uiManager.updateScore(SCORING.POWER_UP);
                    this.powerUpManager.activateSolarPower();
                    this.uiManager.addPowerUpToUI('🌟 Solar Power Boost', 8);
                    this.collectableManager.markPowerUpSpawned(); // Reset fair spawning timer
                    break;
                case 'windPower':
                    this.uiManager.updateScore(SCORING.POWER_UP);
                    this.powerUpManager.activateWindPower();
                    this.uiManager.addPowerUpToUI('💨 Wind Power', 15);
                    this.collectableManager.markPowerUpSpawned(); // Reset fair spawning timer
                    break;
                case 'waterPipeline':
                    this.uiManager.updateScore(SCORING.POWER_UP);
                    this.powerUpManager.activateWaterSlide();
                    this.uiManager.addPowerUpToUI('🚰 Water Pipeline', 12);
                    this.collectableManager.markPowerUpSpawned(); // Reset fair spawning timer
                    break;
            }
        }
    }

    updateCamera() {
        // Smoothly update camera's x position to follow the player
        const cameraTargetX = this.player.getPosition().x;
        this.camera.position.x += (cameraTargetX - this.camera.position.x) * GAME_CONFIG.CAMERA_FOLLOW_SPEED;

        // Enhanced camera Y tracking - different behavior for flying vs. ground
        let cameraTargetY;
        if (this.powerUpManager && this.powerUpManager.getFlyingStatus()) {
            // During flying: higher camera position with smoother tracking
            cameraTargetY = this.player.getPosition().y + 1.0; // Closer to flying player
            this.camera.position.y += (cameraTargetY - this.camera.position.y) * (GAME_CONFIG.CAMERA_FOLLOW_SPEED * 0.8); // Smoother for flying
        } else {
            // Normal ground tracking
            cameraTargetY = this.player.getPosition().y + 1.5;
            this.camera.position.y += (cameraTargetY - this.camera.position.y) * GAME_CONFIG.CAMERA_FOLLOW_SPEED;
        }

        // Move camera forward
        this.camera.position.z -= this.gameSpeed.value;
        this.player.setPosition(
            this.player.getPosition().x,
            this.player.getPosition().y,
            this.camera.position.z - 5
        );
    }

    updateGameSpeed() {
        // Increase game speed gradually
        this.gameSpeed.value += GAME_CONFIG.SPEED_INCREMENT;

        
        // Update score based on solar boost status
        if (this.powerUpManager.getSolarBoostStatus()) {
            this.uiManager.updateScore(SCORING.SOLAR_BOOST_RATE);
        } else {
            this.uiManager.updateScore(SCORING.BASE_RATE);
        }
    }

    gameOver() {
        this.gameActive = false;
        // Capture stats & hand off to state manager
        const finalScore = this.uiManager.getScore();
        const stats = this.uiManager.getCollectableStats();
        this.stateManager.endGame(finalScore, stats);
        // Directly transition to user info capture
        this.stateManager.showUserInfoScreen();
    }

    restartGame() {
        // Reset game state
        this.gameActive = true;
        this.gameSpeed.value = GAME_CONFIG.INITIAL_SPEED;
        
        // Reset camera position
        this.camera.position.z = 5;
        this.camera.position.x = 0;
        this.camera.position.y = 2;
        
        // Reset all managers
        this.player.reset();
        this.environment.reset();
        this.obstacleManager.reset();
        this.collectableManager.reset();
        this.powerUpManager.reset();
        this.uiManager.reset();
        this.inputManager.reset();
        
        // CRITICAL FIX: Reset improved spawning system that was blocking power-ups
        if (this.improvedSpawningFix) {
            this.improvedSpawningFix.reset();
            console.log('✅ Reset improved spawning system - power-ups will now spawn after restart');
        }
        
        // Restart spawning
        this.startSpawning();

        // Ensure score counters start at zero
        this.uiManager.updateScoreDisplay && this.uiManager.updateScoreDisplay();
    }

    handleWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Public methods for managers to access current game state
    isGameActive() {
        return this.gameActive;
    }

    getPlayerPosition() {
        return this.player.getPosition();
    }

    getObstacles() {
        return this.obstacleManager.getObstacles();
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        this.updateGameLogic();
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.game = new Game(); // Make game globally accessible for debugging
});
