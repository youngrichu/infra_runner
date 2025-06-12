import * as THREE from 'three';
import { Player } from './player.js';
import { Environment } from './environment.js';
import { ObstacleManager } from './obstacles.js';
import { CollectableManager } from './collectables.js';
import { PowerUpManager } from './powerups.js';
import { UIManager } from './ui.js';
import { InputManager } from './input.js';
import { GAME_CONFIG, SCORING, SPAWN_CONFIG, PHYSICS } from './constants.js';

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
        this.gameSpeed = { value: GAME_CONFIG.INITIAL_SPEED }; // Using object for reference
        
        this.init();
    }

    async init() { // Make init async
        this.setupThreeJS();
        await this.createManagers(); // Await manager creation
        this.setupInputManager();
        this.startSpawning();
        this.animate();
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
        this.environment = new Environment(this.scene);
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
        if (!this.gameActive) return;
        
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

        // Handle aerial collectibles when flying
        if (this.powerUpManager.getFlyingStatus() && Math.random() < SPAWN_CONFIG.AERIAL_SPAWN_CHANCE) {
            this.collectableManager.createAerialCollectable(this.player.getPosition());
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

        // Check obstacle collisions (if not invincible and not stumbling)
        if (!this.powerUpManager.getInvincibilityStatus() && !this.player.isStumbling) {
            const collision = this.obstacleManager.checkCollisions(
                playerBox,
                this.powerUpManager.getWaterSlideObjects(),
                this.powerUpManager.getWaterSlideStatus()
            );
            
            if (collision) {
                console.log('*** COLLISION DETECTED ***');
                console.log('Player isStumbling:', this.player.isStumbling);
                
                // Try to trigger stumble animation with game over callback
                console.log('Attempting to trigger stumble...');
                const stumbleTriggered = this.player.triggerStumble(() => this.gameOver());
                console.log('Stumble triggered result:', stumbleTriggered);
                
                if (!stumbleTriggered) {
                    // If stumble animation not available, immediate game over
                    console.log('Stumble animation not available - Game Over!');
                    this.gameOver();
                    return;
                }
                
                // Stumble was successfully triggered, continue playing
                console.log('Player stumbled but continues playing!');
                return;
            }
        }

        // Check collectable collisions
        const collectedItems = this.collectableManager.checkCollisions(playerBox);
        this.handleCollectedItems(collectedItems);
    }

    handleCollectedItems(collectedItems) {
        for (const itemType of collectedItems) {
            console.log(`Collected item: ${itemType}`);
            
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
                    console.log('Collected aerial star! +150 points');
                    break;
                    
                // Power-ups
                case 'hardHat':
                    this.uiManager.updateScore(SCORING.POWER_UP);
                    this.powerUpManager.activateInvincibility();
                    this.uiManager.addPowerUpToUI('🛡️ Hard Hat Shield', 5);
                    break;
                case 'helicopter':
                    this.uiManager.updateScore(SCORING.POWER_UP);
                    this.powerUpManager.activateHelicopter();
                    this.uiManager.addPowerUpToUI('🚁 Helicopter Ride', 10);
                    break;
                case 'solarPower':
                    this.uiManager.updateScore(SCORING.POWER_UP);
                    this.powerUpManager.activateSolarPower();
                    this.uiManager.addPowerUpToUI('🌟 Solar Power Boost', 8);
                    break;
                case 'windPower':
                    this.uiManager.updateScore(SCORING.POWER_UP);
                    this.powerUpManager.activateWindPower();
                    this.uiManager.addPowerUpToUI('💨 Wind Power', 15);
                    break;
                case 'waterPipeline':
                    this.uiManager.updateScore(SCORING.POWER_UP);
                    this.powerUpManager.activateWaterSlide();
                    this.uiManager.addPowerUpToUI('🚰 Water Pipeline', 12);
                    break;
            }
        }
    }

    updateCamera() {
        // Smoothly update camera's x position to follow the player
        const cameraTargetX = this.player.getPosition().x;
        this.camera.position.x += (cameraTargetX - this.camera.position.x) * GAME_CONFIG.CAMERA_FOLLOW_SPEED;

        // Camera's Y position follows player's Y position for jumps
        const cameraTargetY = this.player.getPosition().y + 1.5;
        this.camera.position.y += (cameraTargetY - this.camera.position.y) * GAME_CONFIG.CAMERA_FOLLOW_SPEED;

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
        // console.log("Current Game Speed:", this.gameSpeed.value.toFixed(4)); // For debugging speed changes
        
        // Update score based on solar boost status
        if (this.powerUpManager.getSolarBoostStatus()) {
            this.uiManager.updateScore(SCORING.SOLAR_BOOST_RATE);
        } else {
            this.uiManager.updateScore(SCORING.BASE_RATE);
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
        
        // Restart spawning
        this.startSpawning();
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
    new Game();
});