import * as THREE from 'three';
import { Player } from './player.js';
import { DirectModelEnvironment } from './direct-model-environment.js';
import { ObstacleManager } from './obstacles.js';
import { CollectableManager } from './collectables.js';
import { PowerUpManager } from './powerups.js';
import { UIManager } from './ui.js';
import { InputManager } from './input.js';
import { GAME_CONFIG, SCORING, SPAWN_CONFIG, PHYSICS, COUNTDOWN_CONFIG } from './constants.js';
import { GameStateManager, STATES } from './game-state.js';
import { LeaderboardManager } from './leaderboard.js';
import { PlayerRegistration } from './player-registration.js';

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
        
        // Game state
        this.gameActive = true;
        this.gamePaused = false; // Add pause state
        this.gameSpeed = { value: GAME_CONFIG.INITIAL_SPEED }; // Using object for reference
        
        // State management
        this.stateManager = new GameStateManager();
        this.leaderboardManager = new LeaderboardManager();
        this.playerRegistration = null;
        
        // Countdown state
        this.countdownActive = false;
        this.countdownTimeoutId = null;
        this.animationId = null;
        
        this.init();
    }

    async init() { // Make init async
        this.setupThreeJS();
        await this.createManagers(); // Await manager creation
        this.setupInputManager();
        
        // Check player registration BEFORE starting game
        this.checkPlayerRegistration();
    }

    setupThreeJS() {
        // Scene setup
        this.scene = new THREE.Scene();

        // Camera setup
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 5;
        this.camera.position.y = 2;
        this.camera.lookAt(0, 0, 0);

        // Enhanced renderer setup with mobile optimization
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const rendererOptions = {
            antialias: !isMobile, // Disable antialiasing on mobile for better performance
            alpha: false,
            stencil: false,
            powerPreference: isMobile ? 'low-power' : 'high-performance'
        };
        
        this.renderer = new THREE.WebGLRenderer(rendererOptions);
        
        // Set proper pixel ratio for crisp rendering on high-DPI displays
        const pixelRatio = Math.min(window.devicePixelRatio, isMobile ? 2 : 3); // Limit to 2 on mobile
        this.renderer.setPixelRatio(pixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        this.renderer.shadowMap.enabled = false;
        
        // Set output color space for better color accuracy
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        
        // Add canvas styles for proper mobile display
        this.renderer.domElement.style.display = 'block';
        this.renderer.domElement.style.touchAction = 'none'; // Prevent scrolling on touch
        
        document.getElementById('game-container').appendChild(this.renderer.domElement);
        
        // Store mobile flag for later use
        this.isMobile = isMobile;
    }

    async createManagers() { // Make createManagers async
        // Create managers in dependency order
        this.environment = new DirectModelEnvironment(this.scene);
        this.player = new Player(this.scene);
        await this.player.initialize(); // Await player initialization

        this.obstacleManager = new ObstacleManager(this.scene);
        this.collectableManager = new CollectableManager(this.scene);
        await this.collectableManager.initializeModelLoading(); // Await model loading before game starts
        this.powerUpManager = new PowerUpManager(this.scene, this.player);
        this.uiManager = new UIManager(this);
        
        // Set game controller references so managers can access current game state
        this.environment.setGameController(this);
        this.obstacleManager.setGameController(this);
        this.collectableManager.setGameController(this);
        this.uiManager.setGameController(this);
        
        // Set game speed reference for power-ups
        this.powerUpManager.setGameSpeedReference(this.gameSpeed);
        
        // Set collectable manager reference for power-ups (to remove aerial stars)
        this.powerUpManager.setCollectableManager(this.collectableManager);
        
        // Set obstacle manager reference for power-ups (for water pipe targeting)
        this.powerUpManager.setObstacleManager(this.obstacleManager);
        
        // Setup resize handling
        this.setupResizeHandling();
    }

    setupInputManager() {
        this.inputManager = new InputManager(this.player, this);
        // Optional: Enable mobile controls
        this.inputManager.setupMobileControls();
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
        if (!this.gameActive || this.gamePaused) return;
        
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
        
        // Update UI timers with same deltaTime
        this.uiManager.updatePowerUpTimers(frameTime);

        // Apply magnet effect if solar boost is active
        if (this.powerUpManager.getSolarBoostStatus()) {
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
                // Collision detected with obstacle
                // Player stumbling state checked
                
                // Try to trigger stumble animation with game over callback
                // Attempting to trigger stumble animation
                const stumbleTriggered = this.player.triggerStumble(() => this.gameOver());
                // Stumble trigger result processed
                
                if (!stumbleTriggered) {
                    // If stumble animation not available, immediate game over
                    // Stumble animation not available - Game Over
                    this.gameOver();
                    return;
                }
                
                // Stumble was successfully triggered, continue playing
                // Player stumbled but continues playing
                return;
            }
        }

        // Check collectable collisions
        const collectedItems = this.collectableManager.checkCollisions(playerBox);
        this.handleCollectedItems(collectedItems);
    }

    handleCollectedItems(collectedItems) {
        for (const itemType of collectedItems) {
            // Item collected successfully
            
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
                    // Collected aerial star bonus
                    break;
                case 'solarOrb':
                    this.uiManager.updateScore(SCORING.SOLAR_ORB);
                    // Collected solar orb bonus
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
                    this.uiManager.addPowerUpToUI('Jetpack', 10);
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
                    this.uiManager.addPowerUpToUI('fire-hydrant', 12);
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
        // Game speed incremented for progressive difficulty
        
        // Update score based on solar boost status
        if (this.powerUpManager.getSolarBoostStatus()) {
            this.uiManager.updateScore(SCORING.SOLAR_BOOST_RATE);
        } else {
            this.uiManager.updateScore(SCORING.BASE_RATE);
        }
    }

    gameOver() {
        this.gameActive = false;
        const finalScore = this.uiManager.getScore();
        const stats = this.uiManager.getCollectableStats();
        
        // Update game state manager with final game stats
        this.stateManager.setState(STATES.GAME_OVER);
        this.stateManager.updateGameStats({
            score: finalScore,
            blueprints: stats.blueprints,
            waterDrops: stats.waterDrops,
            energyCells: stats.energyCells
        });
        
        // Show game over UI
        this.uiManager.showGameOver();
        // Game Over with final score
        // Final game statistics recorded
    }

    restartGame() {
        // STOP the existing animation loop to prevent multiple loops
        this.stopAnimation();
        
        // Reset game state completely
        this.gameActive = true;
        this.gameSpeed.value = GAME_CONFIG.INITIAL_SPEED;
        this.stateManager.resetGame();
        
        // Reset camera position
        this.camera.position.z = 5;
        this.camera.position.x = 0;
        this.camera.position.y = 2;
        
        // Reset all managers completely
        this.player.reset();
        this.environment.reset();
        this.obstacleManager.reset();
        this.collectableManager.reset();
        this.powerUpManager.reset();
        this.uiManager.reset();
        this.inputManager.reset();
        
        // Start game immediately - no countdown on restart
        this.stateManager.setState(STATES.PLAYING);
        this.startSpawning();
        this.animate();
        
        // Game restarted completely
    }

    startNewGame() {
        // Starting new game with user registration
        
        // STOP the existing animation loop to prevent multiple loops
        this.stopAnimation();
        
        // Clear stored player data to force new registration
        PlayerRegistration.clearStoredPlayerData();
        
        // Reset game state completely
        this.gameActive = false;
        this.gameSpeed.value = GAME_CONFIG.INITIAL_SPEED;
        this.stateManager.resetGame();
        
        // Reset camera position
        this.camera.position.z = 5;
        this.camera.position.x = 0;
        this.camera.position.y = 2;
        
        // Reset all managers completely
        this.player.reset();
        this.environment.reset();
        this.obstacleManager.reset();
        this.collectableManager.reset();
        this.powerUpManager.reset();
        this.uiManager.reset();
        this.inputManager.reset();
        
        // Clear leaderboard data and state
        this.leaderboardManager.clearPlayerData();
        this.stateManager.clearPlayerData();
        
        // Start the registration process
        this.stateManager.setState(STATES.PLAYER_REGISTRATION);
        this.showPlayerRegistration();
        
        // New game started - showing registration form
    }

    setupResizeHandling() {
        // Add event listeners for resize
        window.addEventListener('resize', () => this.handleWindowResize());
        window.addEventListener('orientationchange', () => {
            // Add delay to handle orientation change properly
            setTimeout(() => this.handleWindowResize(), 100);
        });
    }
    
    handleWindowResize() {
        // Update camera aspect ratio
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        
        // Update renderer size with proper pixel ratio
        const pixelRatio = Math.min(window.devicePixelRatio, this.isMobile ? 2 : 3);
        this.renderer.setPixelRatio(pixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Force canvas to fill container properly
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        
        // Screen resized with new dimensions and pixel ratio
    }

    // Game pause/resume functionality
    pauseGame() {
        this.gamePaused = true;
        // Game paused for onboarding
    }

    resumeGame() {
        this.gamePaused = false;
        // Game resumed after onboarding
    }

    // Public methods for managers to access current game state
    isGameActive() {
        return this.gameActive && !this.gamePaused;
    }

    getPlayerPosition() {
        return this.player.getPosition();
    }

    getObstacles() {
        return this.obstacleManager.getObstacles();
    }

    // Player registration methods
    checkPlayerRegistration() {
        // Checking player registration
        
        try {
            // Check if player data exists
            const storedData = PlayerRegistration.getStoredPlayerData();
            // Stored player data checked
            
            if (storedData) {
                // Player already registered, show countdown then start the game
                // Player already registered, showing countdown
                this.registerPlayer(storedData.playerName, storedData.email, storedData.organizationName);
                this.showCountdown();
            } else {
                // Show registration form first
                // No player data found, showing registration form
                this.stateManager.setState(STATES.PLAYER_REGISTRATION);
                this.showPlayerRegistration();
            }
        } catch (error) {
            // Error in checkPlayerRegistration, using fallback
            // Fallback: just show countdown and start the game
            // Fallback: showing countdown without registration
            this.showCountdown();
        }
    }
    
    startGame() {
        // Starting game directly (bypassing countdown)
        try {
            this.stateManager.setState(STATES.PLAYING);
            this.gameActive = true;
            this.startSpawning();
            this.animate();
            // Game started successfully
        } catch (error) {
            // Error starting game
        }
    }

    showPlayerRegistration() {
        // Showing player registration form
        try {
            // Disable input manager during registration
            if (this.inputManager) {
                this.inputManager.disable();
            }
            
            if (!this.playerRegistration) {
                // Creating new PlayerRegistration instance
                this.playerRegistration = new PlayerRegistration((name, email, organization) => {
                    // Player registration completed
                    this.registerPlayer(name, email, organization);
                    // Re-enable input manager
                    if (this.inputManager) {
                        this.inputManager.enable();
                    }
                    // NOW show countdown before starting the game
                    this.showCountdown();
                });
            }
            // Showing registration form
            this.playerRegistration.show();
        } catch (error) {
            // Error showing player registration
        }
    }

    registerPlayer(name, email, organization) {
        // Set player data in state manager
        this.stateManager.setPlayerData(name, email, organization);
        
        // Set player data in leaderboard manager
        this.leaderboardManager.setPlayerData(name, email, organization);
        
        // Player registered successfully
    }

    showCountdown() {
        // Starting countdown
        
        // Set state to getting ready
        this.stateManager.setState(STATES.GETTING_READY);
        this.countdownActive = true;
        
        // Show countdown in UI
        this.uiManager.showCountdown((skipped) => {
            // Countdown completed or skipped
            this.onCountdownComplete();
        });
        
        // Set up character ready animation
        if (this.player && this.player.setReadyState) {
            this.player.setReadyState(true);
        }
    }

    onCountdownComplete() {
        // Countdown complete, starting game
        
        // Clear countdown state
        this.countdownActive = false;
        if (this.countdownTimeoutId) {
            clearTimeout(this.countdownTimeoutId);
            this.countdownTimeoutId = null;
        }
        
        // Reset character ready state
        if (this.player && this.player.setReadyState) {
            this.player.setReadyState(false);
        }
        
        // IMPORTANT: Reset environment again to ensure clean state
        // This ensures all buildings and decorations are cleared and regenerated
        this.environment.reset();
        this.obstacleManager.reset();
        this.collectableManager.reset();
        this.powerUpManager.reset();
        
        // Reset game speed to initial value
        this.gameSpeed.value = GAME_CONFIG.INITIAL_SPEED;
        
        // Now actually start the game
        this.stateManager.setState(STATES.PLAYING);
        this.gameActive = true;
        this.startSpawning();
        this.animate();
        
        // Game started after countdown
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());

        this.updateGameLogic();
        this.renderer.render(this.scene, this.camera);
    }

    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
}

// Game will be initialized by the loading manager or onboarding system
// No auto-initialization here

// Function to initialize game after onboarding
window.initializeGame = function() {
    // Prevent multiple game instances - clean up any existing instance
    if (window.gameInstance) {
        // Cleaning up existing game instance
        window.gameInstance.gameActive = false; // Stop the existing game
        window.gameInstance = null;
    }
    
    // Initializing new game instance after onboarding completion
    window.gameInstance = new Game();
    return window.gameInstance;
};