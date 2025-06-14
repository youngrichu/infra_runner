// Enhanced Version 9 - Smart Pooling + Progressive Enhancement
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LANES, COLORS, SPAWN_CONFIG, SCORING, COLLECTABLE_SPAWN_WEIGHTS, PHYSICS } from './constants.js';
import { CollisionUtils } from './collision-utils.js';

export class CollectableManager {
    constructor(scene) {
        this.scene = scene;
        this.collectables = [];
        this.gameController = null;
        
        // Fair power-up spawning system
        this.lastPowerUpTime = 0;
        this.powerUpInterval = 25000;
        this.regularCollectionsCount = 0;
        this.powerUpAfterCollections = 8;
        
        // EXPO FIX: Smart collectible spawning system (like obstacles)
        this.COLLECTIBLE_SPAWN_HORIZON = 45; // Spawn 45 units ahead (beyond camera view)
        this.COLLECTIBLE_DESPAWN_DISTANCE = 20; // Remove collectibles 20 units behind player
        this.MIN_COLLECTIBLE_SPACING = 6; // Minimum distance between collectibles
        this.MAX_COLLECTIBLE_SPACING = 12; // Maximum distance between collectibles
        this.COLLECTIBLE_DENSITY = 0.6; // 60% of possible positions have collectibles
        this.POWER_UP_DENSITY = 0.15; // 15% of collectibles are power-ups
        this.collectiblePattern = this.generateCollectiblePattern(60); // Pre-generate pattern
        this.collectiblePatternIndex = 0;
        
        // Smart Pooling System
        this.loader = new GLTFLoader();
        this.loadedModels = new Map();
        this.loadingPromises = new Map();
        this.fallbackObjects = new Map();
        
        // Phase-based loading
        this.priorityModelsLoaded = false;
        this.allModelsLoaded = false;
        
        // PRIORITY MODELS: Most frequently collected (load these first)
        this.priorityModels = ['blueprint', 'waterDrop', 'energyCell'];
        this.backgroundModels = ['hardHat', 'helicopter', 'solarPower', 'windPower', 'waterPipeline'];
        
        // GLB Model Configuration
        this.modelConfig = {
            'blueprint': {
                path: './assets/Collectibles/Blueprint.glb',
                scale: [0.6, 0.6, 0.6],
                yPos: 0.7,
                rotation: [0, 0, 0],
                animation: 'float',
                fallback: () => new THREE.BoxGeometry(0.3, 0.3, 0.05)
            },
            'waterDrop': {
                path: './assets/Collectibles/A_simple_water_droplet.glb',  // Your new model
                scale: [0.5, 0.5, 0.5],        // Start with this, adjust if needed
                yPos: 0.7,                     // Standard collectible height
                rotation: [0, 0, 0],
                animation: 'float',
                fallback: () => new THREE.SphereGeometry(0.2, 16, 16)
            },
            'energyCell': {
                path: './assets/Collectibles/Power Box.glb',
                scale: [0.4, 0.4, 0.4],
                yPos: 0.7,
                rotation: [0, 0, 0],
                animation: 'pulse',
                fallback: () => new THREE.CylinderGeometry(0.15, 0.15, 0.4, 32)
            },
            'hardHat': {
                path: './assets/Collectibles/Hardhat.glb',
                scale: [0.001, 0.001, 0.001], // SUPER TINY - practically invisible for testing
                yPos: 0.6,
                rotation: [0, 0, 0],
                animation: 'float',
                fallback: () => new THREE.ConeGeometry(0.02, 0.04, 32) // Also tiny fallback
            },
            'helicopter': {
                path: './assets/Collectibles/Jetpack.glb',
                scale: [0.3, 0.3, 0.3],
                yPos: 0.6,
                rotation: [0, 0, 0],
                animation: 'helicopter',
                fallback: () => new THREE.CylinderGeometry(0.1, 0.1, 0.05, 8)
            },
            'solarPower': {
                path: './assets/Collectibles/Flat Solar Panel.glb',
                scale: [0.7, 0.7, 0.7],
                yPos: 0.7,
                rotation: [0, 0, 0], // Flat orientation to show solar cells from the front
                animation: 'pulse',
                fallback: () => new THREE.CircleGeometry(0.25, 16)
            },
            'windPower': {
                path: './assets/Collectibles/Trampoline.glb',
                scale: [0.15, 0.15, 0.15], // Balanced size - visible but not overwhelming
                yPos: 0.1,
                rotation: [0, 0, 0],
                animation: 'float',
                fallback: () => new THREE.SphereGeometry(0.1, 16, 16)
            },
            'waterPipeline': {
                path: './assets/Collectibles/Pipes.glb',
                scale: [0.25, 0.25, 0.25], // Further reduced size for better proportions
                yPos: 0.7,
                rotation: [0, 0, 0],
                animation: 'spin',
                fallback: () => new THREE.TorusGeometry(0.2, 0.05, 16, 16)
            }
        };
        
        this.initializeSmartPooling();
    }

    // EXPO FIX: Generate smart collectible pattern with good spacing
    generateCollectiblePattern(length) {
        const pattern = [];
        let currentPosition = 0;
        const regularTypes = ['blueprint', 'waterDrop', 'energyCell'];
        const powerUpTypes = ['hardHat', 'helicopter', 'solarPower', 'windPower', 'waterPipeline'];
        
        for (let i = 0; i < length; i++) {
            // Random spacing within our range
            const spacing = this.MIN_COLLECTIBLE_SPACING + 
                          Math.random() * (this.MAX_COLLECTIBLE_SPACING - this.MIN_COLLECTIBLE_SPACING);
            
            currentPosition += spacing;
            
            // Randomly decide whether to place a collectible
            if (Math.random() < this.COLLECTIBLE_DENSITY) {
                // Decide if this should be a power-up (less frequent)
                const isPowerUp = Math.random() < this.POWER_UP_DENSITY;
                const availableTypes = isPowerUp ? powerUpTypes : regularTypes;
                const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
                
                pattern.push({
                    position: currentPosition,
                    type: type,
                    isPowerUp: isPowerUp,
                    lane: Math.floor(Math.random() * 3) // 0, 1, or 2
                });
            }
        }
        
        console.log(`💎 Generated collectible pattern with ${pattern.length} items over ${currentPosition.toFixed(1)} units`);
        return pattern;
    }

    // EXPO FIX: Smart collectible spawning ahead of player
    spawnAheadCollectibles(playerZ) {
        const spawnThreshold = playerZ - this.COLLECTIBLE_SPAWN_HORIZON; // Spawn horizon ahead
        
        // Check if we need to spawn more collectibles
        while (this.needsMoreCollectibles(spawnThreshold)) {
            this.spawnNextPatternCollectible();
        }
    }

    // EXPO FIX: Check if we need more collectibles in the spawn horizon
    needsMoreCollectibles(spawnThreshold) {
        // Check if we have any collectibles within the spawn horizon
        const collectiblesInRange = this.collectables.filter(col => 
            col.mesh.position.z <= spawnThreshold
        );
        
        // If we have fewer than 4 collectibles in the horizon, spawn more
        return collectiblesInRange.length < 4;
    }

    // EXPO FIX: Spawn next collectible from pattern
    spawnNextPatternCollectible() {
        // Get next collectible from pattern
        if (this.collectiblePatternIndex >= this.collectiblePattern.length) {
            // Regenerate pattern if we've used it all
            this.collectiblePattern = this.generateCollectiblePattern(60);
            this.collectiblePatternIndex = 0;
            console.log('🔄 Regenerated collectible pattern');
        }
        
        const collectibleData = this.collectiblePattern[this.collectiblePatternIndex];
        this.collectiblePatternIndex++;
        
        if (!this.gameController) {
            console.warn('⚠️ No game controller - cannot spawn collectible');
            return;
        }
        
        // Calculate spawn position
        const playerZ = this.gameController.getPlayerPosition().z;
        const spawnZ = playerZ - this.COLLECTIBLE_SPAWN_HORIZON - collectibleData.position;
        
        // Check if this position conflicts with obstacles
        const obstacles = this.gameController.getObstacles();
        const lanePositions = [-2, 0, 2]; // LANES.POSITIONS
        const spawnPosition = new THREE.Vector3(
            lanePositions[collectibleData.lane], 
            0.7, 
            spawnZ
        );
        
        // Simple obstacle avoidance - if obstacle too close, try different lane
        let finalLane = collectibleData.lane;
        let positionClear = this.isPositionClearOfObstacles(spawnPosition, obstacles);
        
        if (!positionClear) {
            // Try other lanes
            for (let laneTest = 0; laneTest < 3; laneTest++) {
                const testPosition = new THREE.Vector3(lanePositions[laneTest], 0.7, spawnZ);
                if (this.isPositionClearOfObstacles(testPosition, obstacles)) {
                    finalLane = laneTest;
                    spawnPosition.x = lanePositions[laneTest];
                    positionClear = true;
                    break;
                }
            }
        }
        
        // If still no clear position, skip this collectible
        if (!positionClear) {
            console.log(`⚠️ Skipping collectible at Z=${spawnZ.toFixed(1)} - too close to obstacles`);
            return;
        }
        
        // Create the collectible mesh
        const collectableMesh = this.createCollectableMesh(collectibleData.type, spawnPosition, obstacles);
        if (!collectableMesh) {
            console.warn(`Failed to create collectible mesh for type: ${collectibleData.type}`);
            return;
        }
        
        // Add to tracking
        this.collectables.push({ 
            mesh: collectableMesh, 
            type: collectibleData.type, 
            isPowerUp: collectibleData.isPowerUp,
            lane: finalLane
        });
        
        console.log(`💎 Smart spawned: ${collectibleData.type} at Z=${spawnZ.toFixed(1)} (lane ${finalLane}), player at Z=${playerZ.toFixed(1)}`);
    }

    // EXPO FIX: Check if position is clear of obstacles
    isPositionClearOfObstacles(position, obstacles) {
        const checkRadius = 2.5; // Safe distance from obstacles
        
        for (const obstacle of obstacles) {
            const obstaclePos = obstacle.mesh.position;
            const distance = Math.sqrt(
                Math.pow(position.x - obstaclePos.x, 2) + 
                Math.pow(position.z - obstaclePos.z, 2)
            );
            
            if (distance < checkRadius) {
                return false; // Too close to obstacle
            }
        }
        
        return true; // Position is clear
    }

    // EXPO FIX: Enhanced cleanup of collectibles behind player
    removeCollectiblesBehindPlayer(playerZ) {
        const removalThreshold = playerZ + this.COLLECTIBLE_DESPAWN_DISTANCE; // Remove collectibles behind player
        let removedCount = 0;
        
        for (let i = this.collectables.length - 1; i >= 0; i--) {
            const collectable = this.collectables[i];
            
            if (collectable.mesh.position.z > removalThreshold) { // Remove collectibles in positive Z (behind player)
                // Remove from scene
                this.scene.remove(collectable.mesh);
                
                // Remove from array
                this.collectables.splice(i, 1);
                removedCount++;
            }
        }
        
        if (removedCount > 0) {
            console.log(`🧹 Cleaned up ${removedCount} collectibles behind player`);
        }
    }

    async initializeSmartPooling() {
        console.log('💎 Starting Smart Pooling for Collectibles...');
        
        // PHASE 1: Load priority models first (instant game start)
        await this.loadPriorityModels();
        
        // PHASE 2: Background load remaining models + special models
        this.loadBackgroundModels();
    }

    async loadPriorityModels() {
        console.log('⚡ Phase 1: Loading priority collectible models...');
        
        const priorityPromises = this.priorityModels.map(async (type) => {
            const config = this.modelConfig[type];
            if (!config) return null;
            
            try {
                const gltf = await this.loadModel(config.path);
                if (gltf && gltf.scene) {
                    this.loadedModels.set(type, gltf.scene);
                    console.log(`✅ Priority loaded: ${type}`);
                    
                    // PROGRESSIVE ENHANCEMENT: Upgrade existing fallbacks
                    this.upgradeExistingFallbacks(type);
                    
                    return type;
                } else {
                    throw new Error(`Invalid GLB structure for ${type}`);
                }
            } catch (error) {
                console.warn(`⚠️ Failed to load priority collectible ${type}: ${error.message}`);
                this.loadedModels.set(type, null);
                return null;
            }
        });

        await Promise.allSettled(priorityPromises);
        this.priorityModelsLoaded = true;
        console.log('🎯 Priority collectibles loaded - Regular items 100% GLB!');
    }

    async loadBackgroundModels() {
        console.log('🔄 Phase 2: Background loading power-ups and special models...');
        
        // Load power-up models + lightning bolt for solar orbs
        const allBackgroundModels = [
            ...this.backgroundModels,
            { type: 'lightning', path: './assets/Collectibles/Lightning Bolt.glb' }
        ];
        
        const backgroundPromises = allBackgroundModels.map(async (item) => {
            const type = typeof item === 'string' ? item : item.type;
            const path = typeof item === 'string' ? this.modelConfig[type]?.path : item.path;
            
            if (!path) return null;
            
            try {
                const gltf = await this.loadModel(path);
                if (gltf && gltf.scene) {
                    this.loadedModels.set(type, gltf.scene);
                    console.log(`✅ Background loaded: ${type}`);
                    
                    // PROGRESSIVE ENHANCEMENT: Upgrade existing fallbacks
                    this.upgradeExistingFallbacks(type);
                    
                    return type;
                } else {
                    throw new Error(`Invalid GLB structure for ${type}`);
                }
            } catch (error) {
                console.warn(`⚠️ Failed to load background model ${type}: ${error.message}`);
                this.loadedModels.set(type, null);
                return null;
            }
        });

        await Promise.allSettled(backgroundPromises);
        this.allModelsLoaded = true;
        console.log('🏆 All collectible models loaded - 100% consistency achieved!');
    }

    upgradeExistingFallbacks(modelType) {
        console.log(`🔄 Upgrading collectible fallbacks for: ${modelType}`);
        
        // Find all existing collectibles of this type that use fallback geometry
        for (let i = 0; i < this.collectables.length; i++) {
            const collectable = this.collectables[i];
            
            if (collectable.type === modelType && collectable.mesh.userData.isFallback) {
                // Store current animation state
                const currentAnimationData = collectable.mesh.userData;
                const position = collectable.mesh.position.clone();
                const rotation = collectable.mesh.rotation.clone();
                
                this.scene.remove(collectable.mesh);
                
                // Create new GLB-based mesh
                const newMesh = this.createGLBCollectableMesh(
                    modelType, 
                    this.modelConfig[modelType], 
                    position, 
                    []
                );
                
                if (newMesh) {
                    // Restore animation state
                    newMesh.userData = {
                        ...newMesh.userData,
                        animationTime: currentAnimationData.animationTime || 0
                    };
                    
                    // Update collectable reference
                    collectable.mesh = newMesh;
                    
                    console.log(`✨ Upgraded ${modelType} from fallback to GLB`);
                }
            }
        }
    }

    loadModel(path) {
        return new Promise((resolve, reject) => {
            this.loader.load(
                path,
                (gltf) => {
                    gltf.scene.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            
                            if (child.material) {
                                if (Array.isArray(child.material)) {
                                    child.material.forEach(mat => this.enhanceCollectibleMaterial(mat));
                                } else {
                                    this.enhanceCollectibleMaterial(child.material);
                                }
                            }
                        }
                    });
                    resolve(gltf);
                },
                undefined,
                (error) => reject(error)
            );
        });
    }

    enhanceCollectibleMaterial(material) {
        if (material.isMeshStandardMaterial) {
            material.metalness = Math.min(material.metalness + 0.3, 1.0);
            material.roughness = Math.max(material.roughness - 0.2, 0.1);
            
            if (!material.emissive || material.emissive.r === 0) {
                material.emissive = new THREE.Color(material.color).multiplyScalar(0.1);
            }
        }
    }

    setGameController(gameController) {
        this.gameController = gameController;
    }

    createCollectable(playerZ, obstacles) {
        // SMART SPAWNING: Heavily favor priority models for better consistency
        const regularCollectibles = COLLECTABLE_SPAWN_WEIGHTS.REGULAR;
        let type;
        
        if (this.priorityModelsLoaded && Math.random() < 0.9) {
            // 90% chance to use priority models (guaranteed GLB quality)
            type = this.priorityModels[Math.floor(Math.random() * this.priorityModels.length)];
        } else {
            // 10% chance for variety
            type = regularCollectibles[Math.floor(Math.random() * regularCollectibles.length)];
        }

        // Find clear position using exact lane positions
        let spawnPosition;
        let positionClear = false;
        let attempts = 0;
        const maxAttempts = 10;
        const currentObstacles = obstacles || (this.gameController ? this.gameController.getObstacles() : []);

        while (!positionClear && attempts < maxAttempts) {
            const laneIndex = Math.floor(Math.random() * LANES.COUNT);
            const zPos = playerZ - 60 - (Math.random() * 20);
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

        if (!positionClear) return;

        const collectableMesh = this.createCollectableMesh(type, spawnPosition, currentObstacles);
        if (collectableMesh) {
            this.collectables.push({ mesh: collectableMesh, type: type });
        }
    }

    createPowerUp(playerZ, obstacles) {
        // SMART POWER-UP SPAWNING: Prefer loaded models
        const powerUps = COLLECTABLE_SPAWN_WEIGHTS.POWER_UPS;
        let type;
        
        if (this.allModelsLoaded) {
            // Use any power-up when all loaded
            type = powerUps[Math.floor(Math.random() * powerUps.length)];
        } else {
            // Prefer loaded power-ups if available
            const loadedPowerUps = powerUps.filter(t => this.loadedModels.has(t) && this.loadedModels.get(t) !== null);
            if (loadedPowerUps.length > 0) {
                type = loadedPowerUps[Math.floor(Math.random() * loadedPowerUps.length)];
            } else {
                type = powerUps[Math.floor(Math.random() * powerUps.length)];
            }
        }

        // Find clear position
        let spawnPosition;
        let positionClear = false;
        let attempts = 0;
        const maxAttempts = 10;
        const currentObstacles = obstacles || (this.gameController ? this.gameController.getObstacles() : []);

        while (!positionClear && attempts < maxAttempts) {
            const laneIndex = Math.floor(Math.random() * LANES.COUNT);
            const zPos = playerZ - 40;
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
            spawnPosition = new THREE.Vector3(LANES.POSITIONS[LANES.CENTER], 0.7, playerZ - 40); // Fixed: ground level, not floating
        }

        const collectableMesh = this.createCollectableMesh(type, spawnPosition, currentObstacles);
        if (collectableMesh) {
            this.collectables.push({ mesh: collectableMesh, type: type });
            console.log(`Power-up spawned: ${type} (${this.loadedModels.has(type) && this.loadedModels.get(type) ? 'GLB' : 'fallback'})`);
        }
    }

    createCollectableMesh(type, spawnPosition, obstacles) {
        const config = this.modelConfig[type];
        
        if (config) {
            return this.createGLBCollectableMesh(type, config, spawnPosition, obstacles);
        } else {
            console.warn(`No config found for collectible type: ${type}`);
            return this.createFallbackCollectableMesh(type, spawnPosition, obstacles);
        }
    }

    createGLBCollectableMesh(type, config, spawnPosition, obstacles) {
        let collectableMesh;

        // PROGRESSIVE ENHANCEMENT: Try GLB first, fallback if not loaded
        const loadedModel = this.loadedModels.get(type);
        if (loadedModel && loadedModel !== null) {
            // Use GLB model
            collectableMesh = loadedModel.clone();
            
            if (config.scale) {
                collectableMesh.scale.set(...config.scale);
            }
            
            if (config.rotation) {
                collectableMesh.rotation.set(...config.rotation);
            }
            
            collectableMesh.position.set(spawnPosition.x, spawnPosition.y, spawnPosition.z); // Use actual spawn position, not config.yPos
            
            // DEBUG: Log hard hat spawning details
            if (type === 'hardHat') {
                console.log(`🎩 HARD HAT SPAWNED: Scale=${config.scale}, Position=(${spawnPosition.x.toFixed(2)}, ${spawnPosition.y.toFixed(2)}, ${spawnPosition.z.toFixed(2)})`);
            }
            
            collectableMesh.userData = {
                animationType: config.animation,
                originalY: spawnPosition.y, // Use actual spawn Y position for animation
                animationTime: 0,
                rotationSpeed: 0.02 + Math.random() * 0.03,
                isFallback: false,
                modelType: type
            };
        } else {
            // Use fallback geometry (will be upgraded when GLB loads)
            console.log(`🔄 Using fallback for ${type} (will upgrade when GLB loads)`);
            
            const geometry = config.fallback();
            const material = new THREE.MeshStandardMaterial({ 
                color: this.getCollectibleColor(type),
                metalness: 0.6,
                roughness: 0.3,
                emissive: new THREE.Color(this.getCollectibleColor(type)).multiplyScalar(0.1)
            });
            
            collectableMesh = new THREE.Mesh(geometry, material);
            collectableMesh.position.copy(spawnPosition);
            
            collectableMesh.userData = {
                animationType: 'float',
                originalY: spawnPosition.y,
                animationTime: 0,
                rotationSpeed: 0.02,
                isFallback: true,
                modelType: type
            };
        }

        // Adjust height for obstacles
        this.adjustHeightForObstacles(collectableMesh, obstacles);
        
        // Ensure shadow support
        collectableMesh.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        this.scene.add(collectableMesh);
        return collectableMesh;
    }

    createFallbackCollectableMesh(type, spawnPosition, obstacles) {
        const geometry = new THREE.SphereGeometry(0.2, 16, 16);
        const material = new THREE.MeshStandardMaterial({ 
            color: this.getCollectibleColor(type),
            metalness: 0.5,
            roughness: 0.4
        });
        const collectableMesh = new THREE.Mesh(geometry, material);
        collectableMesh.position.copy(spawnPosition);
        
        this.adjustHeightForObstacles(collectableMesh, obstacles);
        
        collectableMesh.userData = {
            animationType: 'float',
            originalY: spawnPosition.y,
            animationTime: 0,
            rotationSpeed: 0.02,
            isFallback: true,
            modelType: type
        };
        
        collectableMesh.castShadow = true;
        this.scene.add(collectableMesh);
        return collectableMesh;
    }

    getCollectibleColor(type) {
        const colorMap = {
            'blueprint': COLORS.COLLECTABLES.BLUEPRINT,
            'waterDrop': COLORS.COLLECTABLES.WATER_DROP,
            'energyCell': COLORS.COLLECTABLES.ENERGY_CELL,
            'hardHat': COLORS.COLLECTABLES.HARD_HAT,
            'helicopter': COLORS.COLLECTABLES.HELICOPTER,
            'solarPower': COLORS.COLLECTABLES.SOLAR_POWER,
            'windPower': COLORS.COLLECTABLES.WIND_POWER,
            'waterPipeline': COLORS.COLLECTABLES.WATER_PIPELINE
        };
        return colorMap[type] || 0x888888;
    }

    animateCollectable(collectable) {
        if (!collectable.mesh.userData) return;

        const userData = collectable.mesh.userData;
        userData.animationTime += 0.016;

        switch (userData.animationType) {
            case 'float':
                const floatOffset = Math.sin(userData.animationTime * 3) * 0.15;
                collectable.mesh.position.y = userData.originalY + floatOffset;
                collectable.mesh.rotation.y += userData.rotationSpeed;
                break;
                
            case 'spin':
                collectable.mesh.rotation.y += userData.rotationSpeed * 2;
                collectable.mesh.rotation.z += userData.rotationSpeed;
                break;
                
            case 'pulse':
                const pulse = Math.sin(userData.animationTime * 4) * 0.5 + 0.5;
                collectable.mesh.scale.setScalar(0.8 + pulse * 0.3);
                collectable.mesh.rotation.y += userData.rotationSpeed;
                break;
                
            case 'helicopter':
                if (collectable.mesh.children.length > 0) {
                    collectable.mesh.children[0].rotation.y += userData.rotationSpeed;
                }
                const hoverOffset = Math.sin(userData.animationTime * 2) * 0.1;
                collectable.mesh.position.y = userData.originalY + hoverOffset;
                break;
        }
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
            playerPosition.y + 0.9,
            playerPosition.z - 30 - (Math.random() * 20)
        );
        
        collectableMesh.userData = {
            rotationSpeed: 0.05 + Math.random() * 0.05,
            animationType: 'spin',
            originalY: playerPosition.y + 0.9,
            animationTime: 0,
            isFallback: false // Special collectible
        };
        
        collectableMesh.castShadow = true;
        this.scene.add(collectableMesh);
        this.collectables.push({ mesh: collectableMesh, type: 'aerialStar' });
    }

    createSolarOrb(playerPosition) {
        let collectableMesh;
        const laneIndex = Math.floor(Math.random() * LANES.COUNT);
        const spawnPosition = new THREE.Vector3(
            LANES.POSITIONS[laneIndex],
            playerPosition.y + 0.5,
            playerPosition.z - 25 - (Math.random() * 15)
        );

        // Try to use Lightning Bolt GLB model
        const loadedModel = this.loadedModels.get('lightning');
        if (loadedModel && loadedModel !== null) {
            collectableMesh = loadedModel.clone();
            collectableMesh.scale.set(0.5, 0.5, 0.5);
            collectableMesh.position.copy(spawnPosition);
        } else {
            // Enhanced fallback solar orb
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
            
            collectableMesh = new THREE.Mesh(geometry, material);
            collectableMesh.position.copy(spawnPosition);
            
            // Add glowing core for fallback
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
        }
        
        collectableMesh.userData = {
            animationType: 'pulse',
            originalY: spawnPosition.y,
            animationTime: 0,
            rotationSpeed: 0.08 + Math.random() * 0.04,
            pulseSpeed: 0.03 + Math.random() * 0.02,
            isFallback: !loadedModel
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
                yOffset = obstacle.mesh.geometry?.parameters?.height ? 
                    obstacle.mesh.geometry.parameters.height + 0.2 : 0.5;
                break;
            }
        }
        collectableMesh.position.y += yOffset;
        if (collectableMesh.userData) {
            collectableMesh.userData.originalY += yOffset;
        }
    }

    startSpawning() {
        console.log('💎 Collectibles smart spawning started - using pattern-based system');
        // Spawning logic is now handled in the update loop, not time-based
    }

    // Legacy method - kept for compatibility but no longer used
    spawnCollectable() {
        // This method is replaced by the smart pattern-based spawning system
        // All spawning is now handled in spawnAheadCollectibles()
        console.log('⚠️ Legacy spawnCollectable called - using smart spawning instead');
    }

    updateCollectables(gameSpeed, cameraZ) {
        // EXPO FIX: Smart cleanup of collectibles behind player
        this.removeCollectiblesBehindPlayer(cameraZ);
        
        // EXPO FIX: Smart spawning of collectibles ahead of player
        this.spawnAheadCollectibles(cameraZ);
        
        // Update existing collectibles (move and animate)
        for (let i = this.collectables.length - 1; i >= 0; i--) {
            const collectable = this.collectables[i];
            collectable.mesh.position.z += gameSpeed;
            
            this.animateCollectable(collectable);
        }
    }

    checkCollisions(playerBox) {
        const collectedItems = [];
        
        const gameSpeed = this.gameController ? this.gameController.getGameSpeed() : 0;
        const hasMagnetEffect = this.gameController && this.gameController.powerUpManager ? 
                              this.gameController.powerUpManager.getSolarBoostStatus() : false;
        
        for (let i = this.collectables.length - 1; i >= 0; i--) {
            const collectable = this.collectables[i];
            const collectableBox = new THREE.Box3().setFromObject(collectable.mesh);
            
            // Skip aerial stars if not flying
            if (collectable.type === 'aerialStar') {
                const isFlying = this.gameController && this.gameController.powerUpManager && 
                                this.gameController.powerUpManager.getFlyingStatus();
                if (!isFlying) continue;
            }
            
            // Skip solar orbs if no solar boost
            if (collectable.type === 'solarOrb') {
                const hasSolarBoost = this.gameController && this.gameController.powerUpManager && 
                                     this.gameController.powerUpManager.getSolarBoostStatus();
                if (!hasSolarBoost) continue;
            }
            
            // Enhanced collision detection
            let collisionDetected = false;
            
            if (gameSpeed > PHYSICS.HIGH_SPEED_THRESHOLD) {
                collisionDetected = CollisionUtils.checkCollectableCollision(
                    playerBox, 
                    collectableBox, 
                    gameSpeed, 
                    hasMagnetEffect
                );
            } else {
                collisionDetected = playerBox.intersectsBox(collectableBox);
            }
            
            if (collisionDetected) {
                this.scene.remove(collectable.mesh);
                this.collectables.splice(i, 1);
                collectedItems.push(collectable.type);
                
                if (gameSpeed > 0.2) {
                    const modelType = collectable.mesh.userData.isFallback ? 'fallback' : 'GLB';
                    console.log(`Collected: ${collectable.type} (${modelType}) at speed: ${gameSpeed.toFixed(3)}`);
                }
                
                // Track regular collections for power-up spawning
                const regularTypes = ['blueprint', 'waterDrop', 'energyCell'];
                if (regularTypes.includes(collectable.type)) {
                    this.regularCollectionsCount++;
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

    shouldSpawnPowerUp() {
        const currentTime = Date.now();
        const timeSinceLastPowerUp = currentTime - this.lastPowerUpTime;
        
        return timeSinceLastPowerUp >= this.powerUpInterval || 
               this.regularCollectionsCount >= this.powerUpAfterCollections;
    }
    
    markPowerUpSpawned() {
        this.lastPowerUpTime = Date.now();
        this.regularCollectionsCount = 0;
    }
    
    reset() {
        this.collectables.forEach(collectable => this.scene.remove(collectable.mesh));
        this.collectables = [];
        
        // Reset fair spawning system
        this.lastPowerUpTime = Date.now();
        this.regularCollectionsCount = 0;
        
        // EXPO FIX: Reset smart spawning system
        this.collectiblePatternIndex = 0;
        this.collectiblePattern = this.generateCollectiblePattern(60);
        
        console.log('✅ Collectibles reset with new smart pattern');
    }

    removeAerialStars() {
        for (let i = this.collectables.length - 1; i >= 0; i--) {
            const collectable = this.collectables[i];
            if (collectable.type === 'aerialStar') {
                this.scene.remove(collectable.mesh);
                this.collectables.splice(i, 1);
            }
        }
    }

    removeSolarOrbs() {
        for (let i = this.collectables.length - 1; i >= 0; i--) {
            const collectable = this.collectables[i];
            if (collectable.type === 'solarOrb') {
                this.scene.remove(collectable.mesh);
                this.collectables.splice(i, 1);
            }
        }
    }

    // Performance Monitoring
    isReady() {
        return this.priorityModelsLoaded; // Ready when priority models loaded
    }

    getLoadingProgress() {
        const totalModels = Object.keys(this.modelConfig).length + 1; // +1 for lightning
        const loadedCount = this.loadedModels.size;
        return Math.min(loadedCount / totalModels, 1.0);
    }

    getPerformanceStats() {
        const total = this.collectables.length;
        const glbCount = this.collectables.filter(c => !c.mesh.userData.isFallback).length;
        const fallbackCount = total - glbCount;
        
        return {
            total,
            glbCount,
            fallbackCount,
            glbPercentage: total > 0 ? (glbCount / total * 100).toFixed(1) : 0,
            priorityLoaded: this.priorityModelsLoaded,
            allLoaded: this.allModelsLoaded
        };
    }
}