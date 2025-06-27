import * as THREE from 'three';
import { LANES, COLORS, SPAWN_CONFIG, SCORING, COLLECTABLE_SPAWN_WEIGHTS, PHYSICS } from './constants.js';
import { CollisionUtils } from './collision-utils.js';

export class CollectableManager {
    constructor(scene) {
        this.scene = scene;
        this.collectables = [];
        this.gameController = null; // Will be set by game.js
        
        // "Shuffle bag" system for fair power-up spawning
        this.powerUpDeck = [];
        this.shufflePowerUpDeck();

        // Fair power-up spawning system (like Subway Surfers)
        this.lastPowerUpTime = Date.now(); // Initialize with current time
        this.powerUpInterval = 25000; // Guarantee power-up every 25 seconds
        this.regularCollectionsCount = 0;
        this.powerUpAfterCollections = 8; // Or after collecting 8 regular items
    }

    shufflePowerUpDeck() {
        console.log('Shuffling power-up deck...');
        this.powerUpDeck = [...COLLECTABLE_SPAWN_WEIGHTS.POWER_UPS];
        // Fisher-Yates shuffle algorithm
        for (let i = this.powerUpDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.powerUpDeck[i], this.powerUpDeck[j]] = [this.powerUpDeck[j], this.powerUpDeck[i]];
        }
        console.log('Power-up deck shuffled:', this.powerUpDeck);
    }

    setGameController(gameController) {
        this.gameController = gameController;
    }

    createCollectable(playerZ, obstacles) {
        // Only spawn regular collectibles here - power-ups are handled separately
        const regularCollectibles = COLLECTABLE_SPAWN_WEIGHTS.REGULAR;
        const type = regularCollectibles[Math.floor(Math.random() * regularCollectibles.length)];

        // Find clear position - ALWAYS use exact lane positions
        let spawnPosition;
        let positionClear = false;
        let attempts = 0;
        const maxAttempts = 10;
        const currentObstacles = obstacles || (this.gameController ? this.gameController.getObstacles() : []);

        while (!positionClear && attempts < maxAttempts) {
            const laneIndex = Math.floor(Math.random() * LANES.COUNT);
            const zPos = playerZ - 60 - (Math.random() * 20);
            // STRICT: Use exact lane positions with NO deviation
            spawnPosition = new THREE.Vector3(LANES.POSITIONS[laneIndex], 0.7, zPos);

            positionClear = true;
            if (currentObstacles && currentObstacles.length > 0) {
                for (const obstacle of currentObstacles) {
                    const obstacleBox = new THREE.Box3().setFromObject(obstacle.mesh);
                    const collectiblePreviewBox = new THREE.Box3(
                        new THREE.Vector3(spawnPosition.x - 0.5, spawnPosition.y - 0.5, spawnPosition.z - 0.5),
                        new THREE.Vector3(spawnPosition.x + 0.5, spawnPosition.y + 0.5, spawnPosition.z + 0.5)
                    );
                    if (collectiblePreviewBox.intersectsBox(obstacleBox)) {
                        positionClear = false;
                        break;
                    }
                }
            }
            attempts++;
        }

        if (!positionClear) {
            return;
        }

        const collectableMesh = this.createCollectableMesh(type, spawnPosition, currentObstacles);
        if (collectableMesh) {
            this.collectables.push({ mesh: collectableMesh, type: type });
        }
    }

    createPowerUp(playerZ, obstacles) {
        if (this.powerUpDeck.length === 0) {
            this.shufflePowerUpDeck();
        }

        const type = this.powerUpDeck.pop();
        console.log(`Spawning power-up from deck: ${type}. Deck size: ${this.powerUpDeck.length}`);

        // Find clear position - ALWAYS use exact lane positions
        let spawnPosition;
        let positionClear = false;
        let attempts = 0;
        const maxAttempts = 10;
        const currentObstacles = obstacles || (this.gameController ? this.gameController.getObstacles() : []);

        while (!positionClear && attempts < maxAttempts) {
            const laneIndex = Math.floor(Math.random() * LANES.COUNT);
            const zPos = playerZ - 40; // Spawn closer for guaranteed visibility
            // STRICT: Use exact lane positions with NO deviation
            spawnPosition = new THREE.Vector3(LANES.POSITIONS[laneIndex], 0.7, zPos);

            positionClear = true;
            if (currentObstacles && currentObstacles.length > 0) {
                for (const obstacle of currentObstacles) {
                    const obstacleBox = new THREE.Box3().setFromObject(obstacle.mesh);
                    const collectiblePreviewBox = new THREE.Box3(
                        new THREE.Vector3(spawnPosition.x - 0.5, spawnPosition.y - 0.5, spawnPosition.z - 0.5),
                        new THREE.Vector3(spawnPosition.x + 0.5, spawnPosition.y + 0.5, spawnPosition.z + 0.5)
                    );
                    if (collectiblePreviewBox.intersectsBox(obstacleBox)) {
                        positionClear = false;
                        break;
                    }
                }
            }
            attempts++;
        }

        if (!positionClear) {
            // Force spawn in center lane if no clear position found
            spawnPosition = new THREE.Vector3(LANES.POSITIONS[LANES.CENTER], 1.2, playerZ - 40);
        }

        const collectableMesh = this.createCollectableMesh(type, spawnPosition, currentObstacles);
        if (collectableMesh) {
            this.collectables.push({ mesh: collectableMesh, type: type });
            console.log(`Guaranteed power-up spawned: ${type}`);
        }
    }

    createCollectableMesh(type, spawnPosition, obstacles) {
        let geometry, material, color;

        switch (type) {
            case 'blueprint':
                geometry = new THREE.BoxGeometry(0.3, 0.3, 0.05);
                color = COLORS.COLLECTABLES.BLUEPRINT;
                break;
            case 'waterDrop':
                geometry = new THREE.SphereGeometry(0.2, 16, 16);
                color = COLORS.COLLECTABLES.WATER_DROP;
                break;
            case 'energyCell':
                geometry = new THREE.CylinderGeometry(0.15, 0.15, 0.4, 32);
                color = COLORS.COLLECTABLES.ENERGY_CELL;
                break;
            case 'hardHat':
                geometry = new THREE.ConeGeometry(0.2, 0.4, 32);
                color = COLORS.COLLECTABLES.HARD_HAT;
                break;
            case 'helicopter':
                return this.createHelicopterMesh(spawnPosition);
            case 'solarPower':
                return this.createSolarPowerMesh(spawnPosition);
            case 'windPower':
                return this.createWindPowerMesh(spawnPosition);
            case 'waterPipeline':
                geometry = new THREE.TorusGeometry(0.2, 0.05, 16, 16);
                color = COLORS.COLLECTABLES.WATER_PIPELINE;
                break;
            default:
                return null;
        }
        
        material = new THREE.MeshStandardMaterial({ color: color });
        const collectableMesh = new THREE.Mesh(geometry, material);
        collectableMesh.position.copy(spawnPosition); // Use exact spawn position
        
        // Adjust height if above obstacles
        this.adjustHeightForObstacles(collectableMesh, obstacles);
        
        collectableMesh.castShadow = true;
        this.scene.add(collectableMesh);
        return collectableMesh;
    }

    createHelicopterMesh(spawnPosition) {
        const geometry = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 8);
        const rotorGeometry = new THREE.BoxGeometry(0.5, 0.05, 0.1);
        const material = new THREE.MeshStandardMaterial({ color: COLORS.COLLECTABLES.HELICOPTER });
        
        const collectableMesh = new THREE.Mesh(geometry, material);
        const rotor = new THREE.Mesh(rotorGeometry, material);
        rotor.position.y = 0.1;
        collectableMesh.add(rotor);
        
        // STRICT: Use exact spawn position with NO deviation
        collectableMesh.position.set(spawnPosition.x, spawnPosition.y, spawnPosition.z);
        
        collectableMesh.castShadow = true;
        this.scene.add(collectableMesh);
        return collectableMesh;
    }

    createSolarPowerMesh(spawnPosition) {
        const geometry = new THREE.CircleGeometry(0.25, 16);
        const material = new THREE.MeshStandardMaterial({ 
            color: COLORS.COLLECTABLES.SOLAR_POWER, 
            side: THREE.DoubleSide 
        });
        const solarMesh = new THREE.Mesh(geometry, material);
        solarMesh.rotation.x = -Math.PI / 2;
        
        // STRICT: Use exact spawn position with NO deviation
        solarMesh.position.set(spawnPosition.x, spawnPosition.y, spawnPosition.z);
        
        solarMesh.castShadow = true;
        this.scene.add(solarMesh);
        return solarMesh;
    }

    createWindPowerMesh(spawnPosition) {
        const geometry = new THREE.SphereGeometry(0.2, 16, 16);
        const material = new THREE.MeshStandardMaterial({ 
            color: COLORS.COLLECTABLES.WIND_POWER, 
            transparent: true, 
            opacity: 0.7 
        });
        const windMesh = new THREE.Mesh(geometry, material);
        
        // Add particle effects
        const particleGeometry = new THREE.SphereGeometry(0.05, 8, 8);
        const particleMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.5 
        });
        
        for (let i = 0; i < 5; i++) {
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            particle.position.set(
                (Math.random() - 0.5) * 0.3,
                (Math.random() - 0.5) * 0.3,
                (Math.random() - 0.5) * 0.3
            );
            windMesh.add(particle);
        }
        
        // STRICT: Use exact spawn position with NO deviation
        windMesh.position.set(spawnPosition.x, spawnPosition.y, spawnPosition.z);
        
        windMesh.castShadow = true;
        this.scene.add(windMesh);
        return windMesh;
    }

    createAerialCollectable(playerPosition) {
        const geometry = new THREE.OctahedronGeometry(0.3, 0);
        const material = new THREE.MeshStandardMaterial({ 
            color: COLORS.COLLECTABLES.AERIAL_STAR,
            emissive: 0xffaa00,
            metalness: 0.7,
            roughness: 0.3
        });
        
        const collectableMesh = new THREE.Mesh(geometry, material);
        
        const laneIndex = Math.floor(Math.random() * LANES.COUNT);
        
        collectableMesh.position.set(
            LANES.POSITIONS[laneIndex],
            playerPosition.y + 0.9, // Perfect visual offset to match flying character appearance
            playerPosition.z - 30 - (Math.random() * 20)
        );
        
        collectableMesh.userData = {
            rotationSpeed: 0.05 + Math.random() * 0.05
        };
        
        collectableMesh.castShadow = true;
        this.scene.add(collectableMesh);
        this.collectables.push({ mesh: collectableMesh, type: 'aerialStar' });
    }

    createSolarOrb(playerPosition) {
        // Create a light bulb/solar energy orb that appears during solar boost
        const geometry = new THREE.SphereGeometry(0.25, 16, 16);
        const material = new THREE.MeshStandardMaterial({ 
            color: COLORS.COLLECTABLES.SOLAR_ORB,
            emissive: 0xffaa00,
            emissiveIntensity: 0.4,
            metalness: 0.3,
            roughness: 0.1,
            transparent: true,
            opacity: 0.9
        });
        
        const collectableMesh = new THREE.Mesh(geometry, material);
        
        // Add a glowing inner core
        const coreGeometry = new THREE.SphereGeometry(0.15, 8, 8);
        const coreMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffff88,
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.7
        });
        const core = new THREE.Mesh(coreGeometry, coreMaterial);
        collectableMesh.add(core);
        
        // Add light rays (4 extending lines)
        for (let i = 0; i < 4; i++) {
            const rayGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8);
            const rayMaterial = new THREE.MeshStandardMaterial({
                color: COLORS.COLLECTABLES.SOLAR_ORB,
                emissive: 0xffcc00,
                emissiveIntensity: 0.3,
                transparent: true,
                opacity: 0.6
            });
            const ray = new THREE.Mesh(rayGeometry, rayMaterial);
            
            // Position rays in cross pattern
            if (i < 2) {
                ray.rotation.z = (i * Math.PI) + (Math.PI / 4); // Diagonal rays
            } else {
                ray.rotation.x = ((i - 2) * Math.PI) + (Math.PI / 4); // Other diagonal rays
            }
            
            collectableMesh.add(ray);
        }
        
        const laneIndex = Math.floor(Math.random() * LANES.COUNT);
        
        collectableMesh.position.set(
            LANES.POSITIONS[laneIndex],
            playerPosition.y + 0.5, // Slightly closer to player than aerial stars
            playerPosition.z - 25 - (Math.random() * 15)
        );
        
        collectableMesh.userData = {
            rotationSpeed: 0.08 + Math.random() * 0.04, // Faster rotation than aerial stars
            pulseSpeed: 0.03 + Math.random() * 0.02
        };
        
        collectableMesh.castShadow = true;
        this.scene.add(collectableMesh);
        this.collectables.push({ mesh: collectableMesh, type: 'solarOrb' });
    }

    adjustHeightForObstacles(collectableMesh, obstacles) {
        let yOffset = 0;
        for (const obstacle of obstacles) {
            if (Math.abs(obstacle.mesh.position.x - collectableMesh.position.x) < 1 && 
                Math.abs(obstacle.mesh.position.z - collectableMesh.position.z) < 1 &&
                obstacle.mesh.position.y > 0.1) {
                yOffset = obstacle.mesh.geometry.parameters.height ? 
                    obstacle.mesh.geometry.parameters.height + 0.2 : 0.5;
                break;
            }
        }
        collectableMesh.position.y += yOffset;
    }

    startSpawning() {
        this.spawnCollectable();
    }

    spawnCollectable() {
        if (!this.gameController || !this.gameController.isGameActive()) {
            return;
        }
        
        const playerZ = this.gameController.getPlayerPosition().z;
        const obstacles = this.gameController.getObstacles();
        this.createCollectable(playerZ, obstacles);
        
        setTimeout(() => {
            this.spawnCollectable(); // Recursive call without parameters
        }, Math.random() * SPAWN_CONFIG.COLLECTABLE_INTERVAL.MAX + SPAWN_CONFIG.COLLECTABLE_INTERVAL.MIN);
    }

    updateCollectables(gameSpeed, cameraZ) {
        for (let i = this.collectables.length - 1; i >= 0; i--) {
            const collectable = this.collectables[i];
            collectable.mesh.position.z += gameSpeed;
            
            // Rotate aerial stars
            if (collectable.type === 'aerialStar' && collectable.mesh.userData.rotationSpeed) {
                collectable.mesh.rotation.y += collectable.mesh.userData.rotationSpeed;
                collectable.mesh.rotation.x += collectable.mesh.userData.rotationSpeed * 0.5;
            }
            
            // Animate solar orbs
            if (collectable.type === 'solarOrb' && collectable.mesh.userData.rotationSpeed) {
                collectable.mesh.rotation.y += collectable.mesh.userData.rotationSpeed;
                collectable.mesh.rotation.z += collectable.mesh.userData.rotationSpeed * 0.3;
                
                // Pulsing glow effect
                if (collectable.mesh.userData.pulseSpeed) {
                    const time = Date.now() * 0.001;
                    const pulse = Math.sin(time * collectable.mesh.userData.pulseSpeed * 10) * 0.5 + 0.5;
                    collectable.mesh.material.emissiveIntensity = 0.3 + (pulse * 0.3);
                }
            }
            
            if (collectable.mesh.position.z > cameraZ + 5) {
                this.scene.remove(collectable.mesh);
                this.collectables.splice(i, 1);
            }
        }
    }

    checkCollisions(playerBox) {
        const collectedItems = [];
        
        // Get current game speed and magnet status for enhanced collision detection
        const gameSpeed = this.gameController ? this.gameController.getGameSpeed() : 0;
        const hasMagnetEffect = this.gameController && this.gameController.powerUpManager ? 
                              this.gameController.powerUpManager.getSolarBoostStatus() : false;
        
        for (let i = this.collectables.length - 1; i >= 0; i--) {
            const collectable = this.collectables[i];
            const collectableBox = new THREE.Box3().setFromObject(collectable.mesh);
            
            // Skip aerial stars if player is not flying
            if (collectable.type === 'aerialStar') {
                const isFlying = this.gameController && this.gameController.powerUpManager && 
                                this.gameController.powerUpManager.getFlyingStatus();
                if (!isFlying) {
                    continue; // Don't collect aerial stars when not flying
                }
            }
            
            // Skip solar orbs if player doesn't have solar boost
            if (collectable.type === 'solarOrb') {
                const hasSolarBoost = this.gameController && this.gameController.powerUpManager && 
                                     this.gameController.powerUpManager.getSolarBoostStatus();
                if (!hasSolarBoost) {
                    continue; // Don't collect solar orbs when not in solar boost mode
                }
            }
            
            // Use enhanced collision detection for collectibles
            let collisionDetected = false;
            
            if (gameSpeed > PHYSICS.HIGH_SPEED_THRESHOLD) {
                // High-speed: Use enhanced collision detection with larger collection radius
                collisionDetected = CollisionUtils.checkCollectableCollision(
                    playerBox, 
                    collectableBox, 
                    gameSpeed, 
                    hasMagnetEffect
                );
            } else {
                // Low-speed: Use standard collision detection
                collisionDetected = playerBox.intersectsBox(collectableBox);
            }
            
            if (collisionDetected) {
                this.scene.remove(collectable.mesh);
                this.collectables.splice(i, 1);
                collectedItems.push(collectable.type);
                
                // Debug logging for high-speed collections
                if (gameSpeed > 0.2) {
                    console.log(`High-speed collection: ${collectable.type} at speed: ${gameSpeed.toFixed(3)}`);
                }
                
                // Track regular collections for fair power-up spawning
                const regularTypes = ['blueprint', 'waterDrop', 'energyCell'];
                if (regularTypes.includes(collectable.type)) {
                    this.regularCollectionsCount++;
                    console.log(`Regular collections count: ${this.regularCollectionsCount}`);
                }
            }
        }
        
        return collectedItems;
    }

    applyMagnetEffect(playerPosition, magnetRadius, magnetSpeed) {
        for (const collectable of this.collectables) {
            const distance = playerPosition.distanceTo(collectable.mesh.position);
            if (distance < magnetRadius) {
                const direction = new THREE.Vector3()
                    .subVectors(playerPosition, collectable.mesh.position)
                    .normalize();
                collectable.mesh.position.add(direction.multiplyScalar(magnetSpeed));
            }
        }
    }

    getCollectables() {
        return this.collectables;
    }

    // NEW: Check if a power-up should be spawned (Subway Surfers style)
    shouldSpawnPowerUp() {
        const currentTime = Date.now();
        const timeSinceLastPowerUp = currentTime - this.lastPowerUpTime;
        
        // Power-up should spawn if:
        // 1. Time interval reached (25 seconds)
        // 2. OR collected enough regular items (8 items)
        if (timeSinceLastPowerUp >= this.powerUpInterval || 
            this.regularCollectionsCount >= this.powerUpAfterCollections) {
            return true;
        }
        return false;
    }
    
    // NEW: Mark that a power-up was spawned
    markPowerUpSpawned() {
        this.lastPowerUpTime = Date.now();
        this.regularCollectionsCount = 0; // Reset collection counter
        console.log('Power-up spawned - timers reset');
    }
    
    reset() {
        this.collectables.forEach(collectable => this.scene.remove(collectable.mesh));
        this.collectables = [];
        
        // Reset and reshuffle the power-up deck
        this.shufflePowerUpDeck();
        
        // Reset fair spawning system
        this.lastPowerUpTime = Date.now();
        this.regularCollectionsCount = 0;
    }

    removeAerialStars() {
        // Remove all aerial stars from the scene when helicopter power-up ends
        for (let i = this.collectables.length - 1; i >= 0; i--) {
            const collectable = this.collectables[i];
            if (collectable.type === 'aerialStar') {
                this.scene.remove(collectable.mesh);
                this.collectables.splice(i, 1);
                console.log('Removed aerial star after helicopter ended');
            }
        }
    }

    removeSolarOrbs() {
        // Remove all solar orbs from the scene when solar power-up ends
        for (let i = this.collectables.length - 1; i >= 0; i--) {
            const collectable = this.collectables[i];
            if (collectable.type === 'solarOrb') {
                this.scene.remove(collectable.mesh);
                this.collectables.splice(i, 1);
                console.log('Removed solar orb after solar boost ended');
            }
        }
    }
}