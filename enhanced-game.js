// Enhanced Game with Performance Optimizations for new-take branch
import * as THREE from 'three';
import { Player } from './player.js';
import { DirectModelEnvironment } from './direct-model-environment.js';
import { ObstacleManager } from './obstacles.js';
import { CollectableManager } from './collectables.js';
import { PowerUpManager } from './powerups.js';
import { UIManager } from './ui.js';
import { InputManager } from './input.js';
import { PlayerRegistration } from './player-registration.js';
import { GAME_CONFIG, SCORING, SPAWN_CONFIG, PHYSICS, STATES } from './constants.js';

// Import our performance optimizations
import { 
    PerformanceMonitor, 
    AdaptiveQualityManager, 
    FrustumCullingManager,
    ObjectPool 
} from './performance-manager.js';
import { GamepadInputIntegration } from './gamepad-manager.js';

export class EnhancedGame {
    constructor() {
        // Performance systems
        this.performanceMonitor = new PerformanceMonitor();
        this.adaptiveQuality = null;
        this.frustumCuller = null;
        
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
        this.gamepadIntegration = null;
        
        // Game state
        this.gameActive = true;
        this.gameSpeed = { value: GAME_CONFIG.INITIAL_SPEED };
        
        // Performance tracking
        this.frameCounter = 0;
        this.lastPerformanceReport = 0;
        
        // Countdown state
        this.countdownActive = false;
        this.countdownTimeoutId = null;
        this.animationId = null;
        
        this.init();
    }

    async init() {
        
        await this.setupEnhancedThreeJS();
        await this.createManagers();
        this.setupEnhancedInputManager();
        this.setupPerformanceMonitoring();
        this.startSpawning();
        this.animate();
        
    }

    async setupEnhancedThreeJS() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, 200);

        // Camera setup
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 5;
        this.camera.position.y = 2;
        this.camera.lookAt(0, 0, 0);

        // Enhanced renderer with mobile optimization
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
        
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = isMobile ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        
        // Add canvas styles for proper mobile display
        this.renderer.domElement.style.display = 'block';
        this.renderer.domElement.style.touchAction = 'none'; // Prevent scrolling on touch
        
        document.getElementById('game-container').appendChild(this.renderer.domElement);
        
        // Store mobile flag for later use
        this.isMobile = isMobile;

        // Initialize performance systems
        this.adaptiveQuality = new AdaptiveQualityManager(this.renderer);
        this.frustumCuller = new FrustumCullingManager(this.camera);
        
    }

    async createManagers() {
        // Create environment
        this.environment = new DirectModelEnvironment(this.scene);
        this.environment.setGameController && this.environment.setGameController(this);

        // Create player with enhanced physics
        this.player = new Player(this.scene);
        await this.player.initialize();

        // Enhanced obstacle manager with object pooling
        this.obstacleManager = new ObstacleManager(this.scene);
        this.obstacleManager.setGameController(this);
        
        // Enhance obstacle manager with object pooling
        this.enhanceObstacleManager();

        // Create other managers
        this.collectableManager = new CollectableManager(this.scene);
        this.collectableManager.setGameController && this.collectableManager.setGameController(this);

        this.powerUpManager = new PowerUpManager(this.scene, this.player);
        this.powerUpManager.setGameSpeedReference(this.gameSpeed);

        this.uiManager = new UIManager(this);
        
    }

    enhanceObstacleManager() {
        // Add object pooling to existing obstacle manager
        const originalCreateObstacle = this.obstacleManager.createObstacle.bind(this.obstacleManager);
        
        // Create object pools for each obstacle type
        this.obstacleManager.objectPools = new Map();
        
        for (const [type, config] of Object.entries(OBSTACLE_TYPES)) {
            const pool = new ObjectPool(
                () => {
                    const material = new THREE.MeshStandardMaterial({ color: config.color });
                    const mesh = new THREE.Mesh(config.geometry(), material);
                    mesh.castShadow = true;
                    mesh.userData = { type, pooled: true };
                    return mesh;
                },
                (mesh) => {
                    mesh.position.set(0, 0, 0);
                    mesh.visible = false;
                    if (mesh.parent) mesh.parent.remove(mesh);
                },
                10, // Initial size
                50  // Max size
            );
            this.obstacleManager.objectPools.set(type, pool);
        }

        // Override createObstacle to use object pooling
        this.obstacleManager.createObstacle = (playerZ) => {
            const availableTypes = Object.keys(OBSTACLE_TYPES).filter(type => type !== this.obstacleManager.lastObstacleType);
            const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
            const obstacleConfig = OBSTACLE_TYPES[type];

            // Get obstacle from pool
            const pool = this.obstacleManager.objectPools.get(type);
            const obstacleMesh = pool.acquire();
            
            const laneIndex = Math.floor(Math.random() * LANES.COUNT);
            
            obstacleMesh.position.set(
                LANES.POSITIONS[laneIndex], 
                obstacleConfig.yPos, 
                playerZ - 50
            );
            obstacleMesh.visible = true;
            this.scene.add(obstacleMesh);
            
            // Add to frustum culling
            this.frustumCuller.addCullableObject(obstacleMesh);
            
            this.obstacleManager.obstacles.push({ mesh: obstacleMesh, type: type });
            this.obstacleManager.lastObstacleType = type;
        };

        // Enhanced obstacle cleanup with pooling
        const originalReset = this.obstacleManager.reset.bind(this.obstacleManager);
        this.obstacleManager.reset = () => {
            // Return all obstacles to pools
            this.obstacleManager.obstacles.forEach(obstacle => {
                this.scene.remove(obstacle.mesh);
                this.frustumCuller.removeCullableObject(obstacle.mesh);
                
                const pool = this.obstacleManager.objectPools.get(obstacle.type);
                if (pool) {
                    pool.release(obstacle.mesh);
                }
            });
            
            this.obstacleManager.obstacles = [];
            this.obstacleManager.lastObstacleType = '';
            this.obstacleManager.lastObstacleZ = 0;
            
            if (this.obstacleManager.playerPositionTracker) {
                this.obstacleManager.playerPositionTracker.clearAll();
            }
            this.obstacleManager.frameCounter = 0;
        };

    }

    setupEnhancedInputManager() {
        // Cleanup existing input manager if it exists
        if (this.inputManager && typeof this.inputManager.destroy === 'function') {
            this.inputManager.destroy();
        }
        
        // Setup original input manager
        this.inputManager = new InputManager(this.player, this);
        
        // Add gamepad integration
        this.gamepadIntegration = new GamepadInputIntegration(this.inputManager);
        
        // Enhanced input processing
        const originalUpdate = this.inputManager.update;
        this.inputManager.update = () => {
            // Process gamepad input
            const gamepadCommands = this.gamepadIntegration.updateGamepadInput();
            
            // Process gamepad commands
            for (const command of gamepadCommands) {
                this.processInputCommand(command);
            }
        };
        
    }

    processInputCommand(command) {
        if (!this.gameActive) return;
        
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
        // Performance metrics callback
        this.performanceMonitor.onMetricsUpdate((metrics) => {
            // Update adaptive quality
            if (this.adaptiveQuality) {
                this.adaptiveQuality.updateFPS(metrics.frameTime / 1000);
            }
            
            // Performance warnings
            if (metrics.fps < 30) {
            }
        });
        
        // Enhanced window resize handling with mobile optimization
        const handleResize = () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            
            // Update renderer size with proper pixel ratio
            const pixelRatio = Math.min(window.devicePixelRatio, this.isMobile ? 2 : 3);
            this.renderer.setPixelRatio(pixelRatio);
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            
            // Force canvas to fill container properly
            this.renderer.domElement.style.width = '100%';
            this.renderer.domElement.style.height = '100%';
            
        };
        
        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', () => {
            // Add delay to handle orientation change properly
            setTimeout(handleResize, 100);
        });
        
    }

    getGameSpeed() {
        return this.gameSpeed.value;
    }

    startSpawning() {
        this.obstacleManager.startSpawning();
        this.environment.startSpawning && this.environment.startSpawning();
        this.collectableManager.startSpawning && this.collectableManager.startSpawning();
    }

    updateGameLogic() {
        if (!this.gameActive) return;
        
        // Update performance monitoring
        const deltaTime = this.performanceMonitor.update(this.renderer);
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

        // Update all objects
        this.updateAllObjects();

        // Update frustum culling
        this.frustumCuller.update();

        // Check collisions
        this.checkCollisions();

        // Update camera
        this.updateCamera();

        // Update game speed and score
        this.updateGameSpeed();
        
        // Update power-up timers
        const frameTime = 1000 / 60;
        this.powerUpManager.updateTimers(frameTime);
        
        // Update UI timers with same deltaTime
        this.uiManager.updatePowerUpTimers && this.uiManager.updatePowerUpTimers(frameTime);

        // Apply magnet effect if solar boost is active
        if (this.powerUpManager.getSolarBoostStatus()) {
            this.collectableManager.applyMagnetEffect && this.collectableManager.applyMagnetEffect(
                this.player.getPosition(),
                PHYSICS.MAGNET_RADIUS,
                PHYSICS.MAGNET_PULL_SPEED
            );
        }

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
        this.environment.updateBuildings && this.environment.updateBuildings(this.gameSpeed.value, this.camera.position.z);
        this.environment.updateGround && this.environment.updateGround(this.camera.position.z);

        // Update collectables
        this.collectableManager.updateCollectables && this.collectableManager.updateCollectables(this.gameSpeed.value, this.camera.position.z);

        // Update power-up effects
        this.powerUpManager.updateWaterSlidePosition && this.powerUpManager.updateWaterSlidePosition(this.gameSpeed.value);
    }

    checkCollisions() {
        const playerBox = this.player.getCollisionBox();

        // Enhanced collision detection
        if (!this.powerUpManager.getInvincibilityStatus() && 
            !this.player.isStumbling && 
            !this.powerUpManager.getFlyingStatus()) {
            
            const collision = this.obstacleManager.checkCollisions(
                playerBox,
                this.powerUpManager.getWaterSlideObjects && this.powerUpManager.getWaterSlideObjects(),
                this.powerUpManager.getWaterSlideStatus && this.powerUpManager.getWaterSlideStatus()
            );
            
            if (collision) {
                
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
        const collectedItems = this.collectableManager.checkCollisions && this.collectableManager.checkCollisions(playerBox);
        if (collectedItems) {
            this.handleCollectedItems(collectedItems);
        }
    }

    handleCollectedItems(collectedItems) {
        for (const itemType of collectedItems) {
            // Trigger haptic feedback for power-ups
            if (['hardHat', 'helicopter', 'solarPower', 'windPower', 'waterPipeline'].includes(itemType)) {
                this.gamepadIntegration.onPowerUp();
            }
            
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
                    this.uiManager.addPowerUpToUI && this.uiManager.addPowerUpToUI('🛡️ Hard Hat Shield', 5);
                    break;
                case 'helicopter':
                    this.uiManager.updateScore(SCORING.POWER_UP);
                    this.powerUpManager.activateHelicopter();
                    this.uiManager.addPowerUpToUI && this.uiManager.addPowerUpToUI('🚁 Helicopter Ride', 10);
                    break;
                case 'solarPower':
                    this.uiManager.updateScore(SCORING.POWER_UP);
                    this.powerUpManager.activateSolarPower();
                    this.uiManager.addPowerUpToUI && this.uiManager.addPowerUpToUI('🌟 Solar Power Boost', 8);
                    break;
                case 'windPower':
                    this.uiManager.updateScore(SCORING.POWER_UP);
                    this.powerUpManager.activateWindPower();
                    this.uiManager.addPowerUpToUI && this.uiManager.addPowerUpToUI('💨 Wind Power', 15);
                    break;
                case 'waterPipeline':
                    this.uiManager.updateScore(SCORING.POWER_UP);
                    this.powerUpManager.activateWaterSlide();
                    this.uiManager.addPowerUpToUI && this.uiManager.addPowerUpToUI('🚰 Water Pipeline', 12);
                    break;
            }
        }
    }

    updateCamera() {
        // Smoothly update camera's x position to follow the player
        const cameraTargetX = this.player.getPosition().x;
        this.camera.position.x += (cameraTargetX - this.camera.position.x) * GAME_CONFIG.CAMERA_FOLLOW_SPEED;

        // Enhanced camera Y tracking
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
        // Time-based speed increment to prevent frame rate affecting game speed
        const now = performance.now();
        if (!this.lastSpeedUpdate) {
            this.lastSpeedUpdate = now;
        }
        
        const deltaTime = now - this.lastSpeedUpdate;
        if (deltaTime >= 16.67) { // ~60fps equivalent (1000ms / 60fps = 16.67ms)
            this.gameSpeed.value += GAME_CONFIG.SPEED_INCREMENT;
            this.lastSpeedUpdate = now;
        }
        
        // Update score based on solar boost status
        if (this.powerUpManager.getSolarBoostStatus()) {
            this.uiManager.updateScore(SCORING.SOLAR_BOOST_RATE);
        } else {
            this.uiManager.updateScore(SCORING.BASE_RATE);
        }
    }

    reportPerformanceMetrics() {
        const now = Date.now();
        if (now - this.lastPerformanceReport > 5000) { // Every 5 seconds
            const metrics = this.performanceMonitor.getMetrics();
            
            
            if (this.obstacleManager.objectPools) {
            }
            
            if (this.adaptiveQuality) {
                const qualityStats = this.adaptiveQuality.getStats();
            }
            
            this.lastPerformanceReport = now;
        }
    }

    gameOver() {
        this.gameActive = false;
        this.uiManager.showGameOver();
        const stats = this.uiManager.getCollectableStats();
    }

    restartGame() {
        
        // STOP the existing animation loop to prevent multiple loops
        this.stopAnimation();
        
        // Reset game state
        this.gameActive = true;
        this.gameSpeed.value = GAME_CONFIG.INITIAL_SPEED;
        this.lastSpeedUpdate = null; // Reset speed timer
        
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
        
        // Recreate input manager properly
        this.setupEnhancedInputManager();
        
        // Position player at safe starting location ahead of obstacle spawn zone
        // Obstacles spawn at playerZ - 50, so position player ahead to ensure safety
        const safeStartZ = this.camera.position.z - 5;
        this.player.setPosition(0, this.player.getPosition().y, safeStartZ);
        
        // Reset performance counters
        this.frameCounter = 0;
        this.lastPerformanceReport = Date.now();
        
        // Start game immediately - no countdown on restart
        this.gameActive = true;
        this.startSpawning();
        
        // Only start animation if not already running
        if (!this.animationId) {
            this.animate();
        }
        
    }

    // Public interface methods
    isGameActive() {
        return this.gameActive;
    }

    getPlayerPosition() {
        return this.player.getPosition();
    }

    getObstacles() {
        return this.obstacleManager.getObstacles();
    }

    showCountdown() {
        
        // Clear countdown state first
        this.countdownActive = true;
        if (this.countdownTimeoutId) {
            clearTimeout(this.countdownTimeoutId);
            this.countdownTimeoutId = null;
        }
        
        // Position player at safe starting location ahead of obstacle spawn zone
        // Obstacles spawn at playerZ - 50, so position player ahead to ensure safety
        const safeStartZ = this.camera.position.z - 5;
        this.player.setPosition(0, this.player.getPosition().y, safeStartZ);
        
        // Show countdown in UI
        this.uiManager.showCountdown((skipped) => {
            this.onCountdownComplete();
        });
        
        // Set up character ready animation
        if (this.player && this.player.setReadyState) {
            this.player.setReadyState(true);
        }
    }

    onCountdownComplete() {
        
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
        this.environment.reset && this.environment.reset();
        this.obstacleManager.reset && this.obstacleManager.reset();
        this.collectableManager.reset && this.collectableManager.reset();
        this.powerUpManager.reset && this.powerUpManager.reset();
        
        // Reset game speed to initial value
        this.gameSpeed.value = GAME_CONFIG.INITIAL_SPEED;
        
        // Now actually start the game
        this.gameActive = true;
        this.startSpawning();
        
    }

    animate() {
        // Make sure we don't have multiple animation loops running
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        this.animationId = requestAnimationFrame(() => {
            // Clear the animation ID to avoid recursive issues
            this.animationId = null;
            this.animate();
        });

        this.updateGameLogic();
        
        // Manual reset renderer info for accurate performance tracking
        this.renderer.info.reset();
        
        this.renderer.render(this.scene, this.camera);
    }

    stopAnimation() {
        if (this.animationId) {
            console.log('🛑 Stopping animation loop:', this.animationId);
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        } else {
            console.log('🛑 No animation to stop');
        }
    }

    // Cleanup
    destroy() {
        
        if (this.gamepadIntegration) {
            this.gamepadIntegration.gamepadManager.destroy();
        }
        
        if (this.renderer) {
            this.renderer.dispose();
        }
        
    }

    // Add startNewGame method for consistent "New Game" functionality
    startNewGame() {
        if (!this.playerRegistration) {
            this.playerRegistration = new PlayerRegistration(() => {
                // After registration, restart the game
                this.restartGame();
            });
        }
        this.playerRegistration.show();
    }
}

// Initialize the enhanced game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.enhancedGame = new EnhancedGame();
});