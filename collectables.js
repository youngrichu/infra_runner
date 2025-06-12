import * as THREE from 'three';
import { LANES, COLORS, SPAWN_CONFIG, SCORING, COLLECTABLE_SPAWN_WEIGHTS } from './constants.js';

export class CollectableManager {
    constructor(scene) {
        this.scene = scene;
        this.collectables = [];
        this.gameController = null; // Will be set by game.js
        
        // Fair power-up spawning system (like Subway Surfers)
        this.lastPowerUpTime = 0;
        this.powerUpInterval = 25000; // Guarantee power-up every 25 seconds
        this.regularCollectionsCount = 0;
        this.powerUpAfterCollections = 8; // Or after collecting 8 regular items
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

    // NEW: Separate method for power-up spawning
    createPowerUp(playerZ, obstacles) {
        const powerUps = COLLECTABLE_SPAWN_WEIGHTS.POWER_UPS;
        const type = powerUps[Math.floor(Math.random() * powerUps.length)];

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
            
            if (collectable.mesh.position.z > cameraZ + 5) {
                this.scene.remove(collectable.mesh);
                this.collectables.splice(i, 1);
            }
        }
    }

    checkCollisions(playerBox) {
        const collectedItems = [];
        
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
            
            if (playerBox.intersectsBox(collectableBox)) {
                this.scene.remove(collectable.mesh);
                this.collectables.splice(i, 1);
                collectedItems.push(collectable.type);
                
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
}