// Optimized Game Controller with Modern Performance Systems
import * as THREE from 'three';
import { Player } from './player.js';
import { DirectModelEnvironment } from './direct-model-environment.js';
import { OptimizedObstacleManager } from './optimized-obstacles.js';
import { CollectableManager } from './collectables.js';
import { PowerUpManager } from './powerups.js';
import { UIManager } from './ui.js';
import { InputManager } from './input.js';
import { GAME_CONFIG, SCORING, SPAWN_CONFIG, PHYSICS } from './constants.js';
import { GameStateManager, STATES } from './game-state.js';
import { LeaderboardManager } from './leaderboard.js';
import { PlayerRegistration } from './player-registration.js';
import { 
    PerformanceMonitor, 
    AdaptiveQualityManager, 
    FrustumCullingManager,
    ObjectPool 
} from './performance-manager.js';
import { GamepadInputIntegration } from './gamepad-manager.js';

export class OptimizedGame {
    constructor() {
        // Performance monitoring
        this.performanceMonitor = new PerformanceMonitor();
        this.adaptiveQuality = null;
        this.frustumCuller = null;
        
        // Core Three.js components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        
        // Game managers (will be optimized versions)
        this.player = null;
        this.environment = null;
        this.obstacleManager = null;
        this.collectableManager = null;
        this.powerUpManager = null;
        this.uiManager = null;
        this.inputManager = null;
        this.gamepadIntegration = null;

        // State management
        this.stateManager = new GameStateManager();
        this.leaderboardManager = new LeaderboardManager();
        this.playerRegistration = null;
        
        // Performance optimization flags
        this.isCurrentlyPlaying = false;
        this.enableInstancedRendering = true;
        this.enableFrustumCulling = true;
        this.enableAdaptiveQuality = true;
        
        // Game state
        this.gameActive = true;
        this.gameSpeed = { value: GAME_CONFIG.INITIAL_SPEED };
        
        // Performance metrics tracking
        this.frameCounter = 0;
        this.lastPerformanceReport = 0;
        this.performanceReportInterval = 5000; // Report every 5 seconds
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Optimized Infrastructure Runner...');
        
        await this.setupOptimizedThreeJS();
        await this.createOptimizedManagers();
        this.setupInputSystems();
        this.setupStateHandlers();
        this.setupPerformanceMonitoring();
        this.startSpawning();
        this.animate();

        // Start game flow with player registration
        this.checkPlayerRegistration();
        
        console.log('✅ Optimized game initialization complete');
    }

    async setupOptimizedThreeJS() {
        console.log('⚙️ Setting up optimized Three.js renderer...');
        
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, 200); // Add fog for depth

        // Camera setup with optimized settings
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
        this.camera.position.set(0, 2, 5);
        this.camera.lookAt(0, 0, 0);

        // Optimized renderer with fallback support
        this.renderer = await this.createOptimalRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Better quality shadows
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        
        // Performance optimizations
        this.renderer.info.autoReset = false; // Manual reset for better performance tracking
        
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        // Initialize adaptive quality system
        if (this.enableAdaptiveQuality) {
            this.adaptiveQuality = new AdaptiveQualityManager(this.renderer);
        }

        // Initialize frustum culling
        if (this.enableFrustumCulling) {
            this.frustumCuller = new FrustumCullingManager(this.camera);
        }
        
        console.log('✅ Optimized renderer initialized');
    }

    async createOptimalRenderer() {
        // Try WebGPU first (future-ready), fallback to WebGL2, then WebGL1
        if (navigator.gpu && window.WebGPURenderer) {
            try {
                console.log('🔮 Attempting WebGPU renderer...');
                const webgpuRenderer = new window.WebGPURenderer({ antialias: true });
                await webgpuRenderer.init();
                console.log('✅ WebGPU renderer initialized');
                return webgpuRenderer;
            } catch (e) {
                console.log('⚠️ WebGPU failed, falling back to WebGL');
            }
        }

        // WebGL with optimized settings
        const context = document.createElement('canvas').getContext('webgl2') || 
                        document.createElement('canvas').getContext('webgl');
        
        const webglVersion = context instanceof WebGL2RenderingContext ? 'WebGL2' : 'WebGL1';
        console.log(`🎮 Using ${webglVersion} renderer`);

        return new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
            stencil: false,
            depth: true,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance'
        });
    }

    async createOptimizedManagers() {
        console.log('🔧 Creating optimized game managers...');
        
        // Environment (keep existing for now)
        this.environment = new DirectModelEnvironment(this.scene);
        this.environment.setGameController(this);

        // Player with enhanced physics
        this.player = new Player(this.scene);
        await this.player.initialize();

        // Optimized obstacle manager with modern techniques
        this.obstacleManager = new OptimizedObstacleManager(this.scene, this.performanceMonitor);
        this.obstacleManager.setGameController(this);

        // Collectables (TODO: Optimize this next)
        this.collectableManager = new CollectableManager(this.scene);
        this.collectableManager.setGameController(this);

        // Power-ups
        this.powerUpManager = new PowerUpManager(this.scene, this.player);
        this.powerUpManager.setGameSpeedReference(this.gameSpeed);
        this.powerUpManager.setCollectableManager(this.collectableManager);

        // UI Manager
        this.uiManager = new UIManager();
        
        console.log('✅ Optimized managers created');
    }

    setupInputSystems() {
        console.log('🎮 Setting up input systems...');
        
        // Original input manager
        this.inputManager = new InputManager(this.player, this);
        this.inputManager.setupMobileControls();
        
        // Gamepad integration
        this.gamepadIntegration = new GamepadInputIntegration(this.inputManager);
        
        // Enhanced input processing
        this.inputManager.originalUpdate = this.inputManager.update;
        this.inputManager.update = () => {
            // Original input processing
            if (this.inputManager.originalUpdate) {
                this.inputManager.originalUpdate();
            }
            
            // Add gamepad input
            const gamepadCommands = this.gamepadIntegration.updateGamepadInput();
            
            // Process gamepad commands
            for (const command of gamepadCommands) {
                this.processInputCommand(command);
            }
        };
        
        console.log('✅ Input systems configured');
    }

    processInputCommand(command) {
        if (!this.isCurrentlyPlaying || !this.gameActive) return;
        
        switch (command) {
            case 'jump':
                this.player.jump();
                this.gamepadIntegration.onJump();
                break;
            case 'moveLeft':
                this.player.moveLeft();
                break;
            case 'moveRight':
                this.player.moveRight();
                break;
            case 'restart':
                if (!this.gameActive) {
                    this.restartGame();
                }
                break;
        }
    }

    setupPerformanceMonitoring() {
        console.log('📊 Setting up performance monitoring...');
        
        // Performance metrics callback
        this.performanceMonitor.onMetricsUpdate((metrics) => {
            // Update adaptive quality based on performance
            if (this.adaptiveQuality) {
                this.adaptiveQuality.updateFPS(metrics.frameTime / 1000);
            }
            
            // Log performance warnings
            if (metrics.fps < 30) {
                console.warn(`⚠️ Performance warning: ${metrics.fps}fps`);
            }
            
            if (metrics.memoryUsage > 150) {
                console.warn(`⚠️ Memory warning: ${metrics.memoryUsage.toFixed(1)}MB`);
            }
        });
        
        // Window resize optimization
        window.addEventListener('resize', () => {
            this.handleWindowResize();
        });
        
        console.log('✅ Performance monitoring active');
    }

    setupStateHandlers() {
        // Enhanced state management with performance considerations
        this.stateManager.onStateChange((state) => {
            this.isCurrentlyPlaying = (state === STATES.PLAYING);
            
            switch (state) {
                case STATES.SPLASH:
                    this.uiManager.showSplash();
                    this.pausePerformanceIntensiveOperations();
                    break;
                case STATES.START_MENU:
                    this.uiManager.hideSplash();
                    this.uiManager.hideLeaderboard();
                    this.uiManager.hideUserInfo();
                    this.uiManager.showStartMenu();
                    this.gameActive = false;
                    this.pausePerformanceIntensiveOperations();
                    break;
                case STATES.PLAYING:
                    this.uiManager.hideStartMenu();
                    this.uiManager.hideLeaderboard();
                    this.uiManager.hideUserInfo();
                    this.restartGame();
                    this.gameActive = true;
                    this.resumePerformanceIntensiveOperations();
                    break;
                case STATES.USER_INFO:
                    this.uiManager.showUserInfo();
                    this.pausePerformanceIntensiveOperations();
                    break;
                case STATES.LEADERBOARD:
                    this.uiManager.updateLeaderboard(this.leaderboardManager.getScores());
                    this.uiManager.hideUserInfo();
                    this.uiManager.showLeaderboard();
                    this.gameActive = false;
                    this.pausePerformanceIntensiveOperations();
                    break;
            }
        });

        // UI event handlers
        this.uiManager.onStartButtonClicked = () => this.handleStartGame();
        this.uiManager.onUserInfoSubmitted = (name) => this.handleUserInfo(name);
        this.uiManager.onLeaderboardBack = () => this.stateManager.returnToMenu();
    }

    pausePerformanceIntensiveOperations() {
        // Reduce rendering quality during menu states
        if (this.adaptiveQuality) {
            this.adaptiveQuality.forceQuality = 'low';
        }
    }

    resumePerformanceIntensiveOperations() {
        // Resume normal rendering quality
        if (this.adaptiveQuality) {
            this.adaptiveQuality.forceQuality = null;
        }
    }

    updateGameLogic() {
        // Performance optimization: Use cached playing state
        if (!this.isCurrentlyPlaying || !this.gameActive) return;
        
        // Update performance monitoring
        const deltaTime = this.performanceMonitor.update(this.renderer);
        
        // Frame counter for performance reporting
        this.frameCounter++;
        
        // Pause game logic if player is stumbling
        if (this.player.isStumbling) {
            this.player.updatePosition(
                this.powerUpManager.getFlyingStatus(),
                this.powerUpManager.getWaterSlideObjects(),
                this.gameSpeed.value
            );
            return;
        }

        // Update player
        this.player.updatePosition(
            this.powerUpManager.getFlyingStatus(),
            this.powerUpManager.getWaterSlideObjects(),
            this.gameSpeed.value
        );

        // Update input systems
        this.inputManager.update();

        // Update all game objects
        this.updateAllObjects();

        // Update frustum culling
        if (this.frustumCuller) {
            this.frustumCuller.update();
        }

        // Check collisions
        this.checkCollisions();

        // Enhanced power-up spawning
        this.handlePowerUpSpawning();

        // Handle special collectibles
        this.handleSpecialCollectibles();

        // Update camera
        this.updateCamera();

        // Update game speed and score
        this.updateGameSpeed();
        
        // Update power-up timers
        this.powerUpManager.updateTimers(deltaTime);
        this.uiManager.updatePowerUpTimers(deltaTime);

        // Apply magnet effect
        this.applyMagnetEffect();

        // Performance reporting
        this.reportPerformanceMetrics();
    }

    updateAllObjects() {
        // Update obstacles with performance tracking
        const obstacleScore = this.obstacleManager.updateObstacles(
            this.gameSpeed.value,
            this.camera.position.z,
            this.gameActive
        );
        this.uiManager.updateScore(obstacleScore);

        // Update environment
        this.environment.updateBuildings(this.gameSpeed.value, this.camera.position.z);
        this.environment.updateGround(this.camera.position.z);

        // Update collectables
        this.collectableManager.updateCollectables(this.gameSpeed.value, this.camera.position.z);

        // Update power-up effects
        this.powerUpManager.updateWaterSlidePosition(this.gameSpeed.value);
    }

    checkCollisions() {
        const playerBox = this.player.getCollisionBox();

        // Enhanced collision detection
        if (!this.powerUpManager.getInvincibilityStatus() && 
            !this.player.isStumbling && 
            !this.powerUpManager.getFlyingStatus()) {
            
            const collision = this.obstacleManager.checkCollisions(
                playerBox,
                this.powerUpManager.getWaterSlideObjects(),
                this.powerUpManager.getWaterSlideStatus()
            );
            
            if (collision) {
                console.log('*** COLLISION DETECTED ***');
                
                // Trigger haptic feedback
                this.gamepadIntegration.onCollision();
                
                const stumbleTriggered = this.player.triggerStumble(() => this.gameOver());
                
                if (!stumbleTriggered) {
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
            // Trigger haptic feedback for power-ups
            if (['hardHat', 'helicopter', 'solarPower', 'windPower', 'waterPipeline'].includes(itemType)) {
                this.gamepadIntegration.onPowerUp();
            }
            
            // Process collection (same as original)
            switch (itemType) {
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
                case 'hardHat':
                    this.uiManager.updateScore(SCORING.POWER_UP);
                    this.powerUpManager.activateInvincibility();
                    this.uiManager.addPowerUpToUI('🛡️ Hard Hat Shield', 5);
                    this.collectableManager.markPowerUpSpawned();
                    break;
                case 'helicopter':
                    this.uiManager.updateScore(SCORING.POWER_UP);
                    this.powerUpManager.activateHelicopter();
                    this.uiManager.addPowerUpToUI('🚁 Helicopter Ride', 10);
                    this.collectableManager.markPowerUpSpawned();
                    break;
                case 'solarPower':
                    this.uiManager.updateScore(SCORING.POWER_UP);
                    this.powerUpManager.activateSolarPower();
                    this.uiManager.addPowerUpToUI('🌟 Solar Power Boost', 8);
                    this.collectableManager.markPowerUpSpawned();
                    break;
                case 'windPower':
                    this.uiManager.updateScore(SCORING.POWER_UP);
                    this.powerUpManager.activateWindPower();
                    this.uiManager.addPowerUpToUI('💨 Wind Power', 15);
                    this.collectableManager.markPowerUpSpawned();
                    break;
                case 'waterPipeline':
                    this.uiManager.updateScore(SCORING.POWER_UP);
                    this.powerUpManager.activateWaterSlide();
                    this.uiManager.addPowerUpToUI('🚰 Water Pipeline', 12);
                    this.collectableManager.markPowerUpSpawned();
                    break;
            }
        }
    }

    handlePowerUpSpawning() {
        if (this.collectableManager.shouldSpawnPowerUp()) {
            const playerZ = this.player.getPosition().z;
            const obstacles = this.obstacleManager.getObstacles();
            this.collectableManager.createPowerUp(playerZ, obstacles);
            this.collectableManager.markPowerUpSpawned();
        }
    }

    handleSpecialCollectibles() {
        // Aerial collectibles when flying
        if (this.powerUpManager.getFlyingStatus() && Math.random() < SPAWN_CONFIG.AERIAL_SPAWN_CHANCE) {
            this.collectableManager.createAerialCollectable(this.player.getPosition());
        }
        
        // Solar orbs when solar boost is active
        if (this.powerUpManager.getSolarBoostStatus() && Math.random() < SPAWN_CONFIG.SOLAR_ORB_SPAWN_CHANCE) {
            this.collectableManager.createSolarOrb(this.player.getPosition());
        }
    }

    applyMagnetEffect() {
        if (this.powerUpManager.getSolarBoostStatus()) {
            this.collectableManager.applyMagnetEffect(
                this.player.getPosition(),
                PHYSICS.MAGNET_RADIUS,
                PHYSICS.MAGNET_PULL_SPEED
            );
        }
    }

    updateCamera() {
        // Enhanced camera system with smooth following
        const cameraTargetX = this.player.getPosition().x;
        this.camera.position.x += (cameraTargetX - this.camera.position.x) * GAME_CONFIG.CAMERA_FOLLOW_SPEED;

        // Dynamic camera Y positioning
        let cameraTargetY;
        if (this.powerUpManager && this.powerUpManager.getFlyingStatus()) {
            cameraTargetY = this.player.getPosition().y + 1.0;
            this.camera.position.y += (cameraTargetY - this.camera.position.y) * (GAME_CONFIG.CAMERA_FOLLOW_SPEED * 0.8);
        } else {
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
        this.gameSpeed.value += GAME_CONFIG.SPEED_INCREMENT;
        
        // Update score with boost consideration
        if (this.powerUpManager.getSolarBoostStatus()) {
            this.uiManager.updateScore(SCORING.SOLAR_BOOST_RATE);
        } else {
            this.uiManager.updateScore(SCORING.BASE_RATE);
        }
    }

    reportPerformanceMetrics() {
        const now = Date.now();
        if (now - this.lastPerformanceReport > this.performanceReportInterval) {
            const metrics = this.performanceMonitor.getMetrics();
            const obstacleStats = this.obstacleManager.getPerformanceStats();
            const gamepadStats = this.gamepadIntegration.getStats();
            
            console.log('📊 Performance Report:');
            console.log(`   FPS: ${metrics.fps} | Frame Time: ${metrics.frameTime.toFixed(1)}ms`);
            console.log(`   Memory: ${metrics.memoryUsage.toFixed(1)}MB | Draw Calls: ${metrics.drawCalls}`);
            console.log(`   Obstacles: ${obstacleStats.obstacles.total} (${obstacleStats.obstacles.instanced} instanced)`);
            console.log(`   Gamepad: ${gamepadStats.connected} connected`);
            
            if (this.adaptiveQuality) {
                const qualityStats = this.adaptiveQuality.getStats();
                console.log(`   Quality: ${qualityStats.quality} | Avg FPS: ${qualityStats.avgFPS}`);
            }
            
            this.lastPerformanceReport = now;
        }
    }

    // Game state methods
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
    }

    restartGame() {
        console.log('🔄 Restarting optimized game...');
        
        // Reset game state
        this.gameActive = true;
        this.gameSpeed.value = GAME_CONFIG.INITIAL_SPEED;
        this.stateManager.setState(STATES.PLAYING);
        this.stateManager.resetGame();
        
        // Reset camera
        this.camera.position.set(0, 2, 5);
        
        // Reset all managers
        this.player.reset();
        this.environment.reset();
        this.obstacleManager.reset();
        this.collectableManager.reset();
        this.powerUpManager.reset();
        this.uiManager.reset();
        this.inputManager.reset();
        
        // Reset performance counters
        this.frameCounter = 0;
        this.lastPerformanceReport = Date.now();
        
        // Restart spawning
        this.startSpawning();
        this.uiManager.updateScoreDisplay && this.uiManager.updateScoreDisplay();
    }

    startSpawning() {
        this.obstacleManager.startSpawning();
        this.environment.startSpawning();
        this.collectableManager.startSpawning();
    }

    handleWindowResize() {
        const newAspect = window.innerWidth / window.innerHeight;
        this.camera.aspect = newAspect;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Notify adaptive quality system
        if (this.adaptiveQuality) {
            this.adaptiveQuality.onResize(window.innerWidth, window.innerHeight);
        }
    }

    // Event handlers
    handleStartGame() {
        this.stateManager.startGame();
    }

    handleUserInfo(name) {
        this.stateManager.saveUserInfo(name);
        this.leaderboardManager.addScore(this.stateManager.getPlayerData());
        this.stateManager.showLeaderboard();
    }

    // Player registration methods
    checkPlayerRegistration() {
        console.log('🔍 Checking player registration...');
        
        // Check if player data exists
        const storedData = PlayerRegistration.getStoredPlayerData();
        console.log('📊 Stored player data:', storedData);
        
        if (storedData) {
            // Player already registered, set up the game
            console.log('✅ Player already registered, setting up game...');
            this.registerPlayer(storedData.playerName, storedData.email, storedData.organizationName);
            this.stateManager.setState(STATES.MENU);
        } else {
            // Show registration form
            console.log('📝 No player data found, showing registration form...');
            this.stateManager.setState(STATES.PLAYER_REGISTRATION);
            this.showPlayerRegistration();
        }
    }

    showPlayerRegistration() {
        console.log('🎮 Showing player registration form...');
        try {
            if (!this.playerRegistration) {
                console.log('🏗️ Creating new PlayerRegistration instance...');
                this.playerRegistration = new PlayerRegistration((name, email, organization) => {
                    console.log('📋 Player registration completed:', { name, email, organization });
                    this.registerPlayer(name, email, organization);
                    this.stateManager.setState(STATES.MENU);
                });
            }
            console.log('👀 Showing registration form...');
            this.playerRegistration.show();
        } catch (error) {
            console.error('❌ Error showing player registration:', error);
        }
    }

    registerPlayer(name, email, organization) {
        // Set player data in state manager
        this.stateManager.setPlayerData(name, email, organization);
        
        // Set player data in leaderboard manager
        this.leaderboardManager.setPlayerData(name, email, organization);
        
        console.log(`Player registered: ${name} (${email}) from ${organization}`);
    }

    // Public interface methods
    getGameSpeed() {
        return this.gameSpeed.value;
    }

    isGameActive() {
        return this.gameActive;
    }

    getPlayerPosition() {
        return this.player.getPosition();
    }

    getObstacles() {
        return this.obstacleManager.getObstacles();
    }

    // Main animation loop
    animate() {
        requestAnimationFrame(() => this.animate());

        this.updateGameLogic();
        
        // Manual reset renderer info for accurate performance tracking
        this.renderer.info.reset();
        
        this.renderer.render(this.scene, this.camera);
    }

    // Cleanup
    destroy() {
        console.log('🧹 Cleaning up optimized game...');
        
        if (this.gamepadIntegration) {
            this.gamepadIntegration.gamepadManager.destroy();
        }
        
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        console.log('✅ Optimized game cleanup complete');
    }
}

// Initialize the optimized game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Starting Optimized Infrastructure Runner...');
    window.optimizedGame = new OptimizedGame();
});