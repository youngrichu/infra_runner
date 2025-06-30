// Enhanced Game with Performance Optimizations for new-take branch
import * as THREE from 'three';
import { Player } from './player.js';
import { DirectModelEnvironment } from './direct-model-environment.js';
import { ObstacleManager } from './obstacles.js';
import { CollectableManager } from './collectables.js';
import { PowerUpManager } from './powerups.js';
import { UIManager } from './ui.js';
import { InputManager } from './input.js';
import { GAME_CONFIG, SCORING, SPAWN_CONFIG, PHYSICS } from './constants.js';

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
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Enhanced Infrastructure Runner...');
        
        await this.setupEnhancedThreeJS();
        await this.createManagers();
        this.setupEnhancedInputManager();
        this.setupPerformanceMonitoring();
        this.startSpawning();
        this.animate();
        
        console.log('✅ Enhanced game initialization complete');
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

        // Enhanced renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: false,
            stencil: false,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        // Initialize performance systems
        this.adaptiveQuality = new AdaptiveQualityManager(this.renderer);
        this.frustumCuller = new FrustumCullingManager(this.camera);
        
        console.log('✅ Enhanced renderer initialized');
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

        this.uiManager = new UIManager();
        
        console.log('✅ Enhanced managers created');
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

        console.log('✅ Obstacle manager enhanced with object pooling');
    }

    setupEnhancedInputManager() {
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
        
        console.log('✅ Enhanced input system configured');
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
                console.warn(`⚠️ Performance warning: ${metrics.fps}fps`);
            }
        });
        
        // Window resize handling
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
        
        console.log('✅ Performance monitoring active');
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
        
        // Update UI timers
        this.uiManager.updatePowerUpTimers && this.uiManager.updatePowerUpTimers();

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
        this.gameSpeed.value += GAME_CONFIG.SPEED_INCREMENT;
        
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
            
            console.log('📊 Enhanced Performance Report:');
            console.log(`   FPS: ${metrics.fps} | Frame Time: ${metrics.frameTime.toFixed(1)}ms`);
            console.log(`   Memory: ${metrics.memoryUsage.toFixed(1)}MB | Draw Calls: ${metrics.drawCalls}`);
            
            if (this.obstacleManager.objectPools) {
                console.log(`   Object Pools: ${this.obstacleManager.objectPools.size} types active`);
            }
            
            if (this.adaptiveQuality) {
                const qualityStats = this.adaptiveQuality.getStats();
                console.log(`   Quality: ${qualityStats.quality} | Avg FPS: ${qualityStats.avgFPS}`);
            }
            
            this.lastPerformanceReport = now;
        }
    }

    gameOver() {
        this.gameActive = false;
        this.uiManager.showGameOver();
        console.log('Game Over! Final Score:', Math.floor(this.uiManager.getScore()));
        const stats = this.uiManager.getCollectableStats();
        console.log(`Blueprints: ${stats.blueprints}, Water Drops: ${stats.waterDrops}, Energy Cells: ${stats.energyCells}`);
    }

    restartGame() {
        console.log('🔄 Restarting enhanced game...');
        
        // Reset game state
        this.gameActive = true;
        this.gameSpeed.value = GAME_CONFIG.INITIAL_SPEED;
        
        // Reset camera position
        this.camera.position.z = 5;
        this.camera.position.x = 0;
        this.camera.position.y = 2;
        
        // Reset all managers
        this.player.reset();
        this.environment.reset && this.environment.reset();
        this.obstacleManager.reset();
        this.collectableManager.reset && this.collectableManager.reset();
        this.powerUpManager.reset();
        this.uiManager.reset();
        this.inputManager.reset && this.inputManager.reset();
        
        // Reset performance counters
        this.frameCounter = 0;
        this.lastPerformanceReport = Date.now();
        
        // Restart spawning
        this.startSpawning();
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

    animate() {
        requestAnimationFrame(() => this.animate());

        this.updateGameLogic();
        
        // Manual reset renderer info for accurate performance tracking
        this.renderer.info.reset();
        
        this.renderer.render(this.scene, this.camera);
    }

    // Cleanup
    destroy() {
        console.log('🧹 Cleaning up enhanced game...');
        
        if (this.gamepadIntegration) {
            this.gamepadIntegration.gamepadManager.destroy();
        }
        
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        console.log('✅ Enhanced game cleanup complete');
    }
}

// Initialize the enhanced game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Starting Enhanced Infrastructure Runner...');
    window.enhancedGame = new EnhancedGame();
});