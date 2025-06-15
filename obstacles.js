// EXPO-READY Version 9 - CRITICAL GLB Loading & Memory Leak Fixes
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LANES, OBSTACLE_TYPES, SPAWN_CONFIG, SCORING, PHYSICS } from './constants.js';
import { CollisionUtils, PositionTracker } from './collision-utils.js';

export class ObstacleManager {
    constructor(scene) {
        this.scene = scene;
        this.obstacles = [];
        this.lastObstacleType = '';
        this.gameController = null;
        
        // EXPO FIX: Smart spawning system (replaces distance-based spawning)
        this.SPAWN_HORIZON = 40; // Spawn 40 units ahead (beyond camera view)
        this.DESPAWN_DISTANCE = 25; // Remove obstacles 25 units behind player
        this.MIN_OBSTACLE_SPACING = 8; // Minimum distance between obstacles
        this.MAX_OBSTACLE_SPACING = 16; // Maximum distance between obstacles
        this.TARGET_DENSITY = 0.75; // 75% of possible positions have obstacles
        this.obstaclePattern = this.generateObstaclePattern(50); // Pre-generate pattern
        this.patternIndex = 0;
        
        // High-speed collision detection
        this.playerPositionTracker = new PositionTracker();
        this.frameCounter = 0;
        
        // Smart Pooling System
        this.loader = new GLTFLoader();
        this.loadedModels = new Map();
        this.loadingPromises = new Map();
        
        // EXPO FIX: Memory monitoring
        this.memoryMonitor = {
            lastCheck: Date.now(),
            objectCount: 0,
            maxMemoryMB: 0,
            disposeCount: 0
        };
        
        // Phase-based loading
        this.priorityModelsLoaded = false;
        this.allModelsLoaded = false;
        
        // PRIORITY MODELS: Most commonly spawned (load these first)
        this.priorityModels = ['pothole', 'constructionBarrier', 'cone'];
        this.backgroundModels = ['rubble', 'trafficBarrier', 'floorHole'];
        
        // GLB Model Configuration
        this.modelConfig = {
            'pothole': {
                path: './assets/Obstacles/Pothole.glb',
                scale: [0.8, 0.8, 0.8],
                yPos: 0.1,
                rotation: [0, 0, 0],
                fallback: () => new THREE.CylinderGeometry(0.5, 0.5, 0.1, 32)
            },
            'constructionBarrier': {
                path: './assets/Obstacles/Barricade.glb',
                scale: [0.6, 0.6, 0.6],
                yPos: 0.3,
                rotation: [0, 0, 0],
                fallback: () => new THREE.BoxGeometry(1.5, 0.8, 0.3)
            },
            'cone': {
                path: './assets/Obstacles/Traffic Cone.glb',
                scale: [0.8, 0.8, 0.8],
                yPos: 0.4,
                rotation: [0, 0, 0],
                fallback: () => new THREE.ConeGeometry(0.3, 0.8, 32)
            },
            'rubble': {
                path: './assets/Obstacles/rubble.glb',
                scale: [0.1, 0.1, 0.1],
                yPos: 0.05,
                rotation: [0, Math.random() * Math.PI, 0],
                fallback: () => new THREE.BoxGeometry(0.2, 0.1, 0.2)
            },
            'trafficBarrier': {
                path: './assets/Obstacles/Traffic Barrier.glb',
                scale: [0.8, 0.7, 0.8],
                yPos: 0.35,
                rotation: [0, 0, 0],
                fallback: () => new THREE.BoxGeometry(1.5, 0.7, 0.3)
            },
            'floorHole': {
                path: './assets/Obstacles/Floor Hole.glb',
                scale: [0.9, 0.9, 0.9],
                yPos: 0.05,
                rotation: [0, 0, 0],
                fallback: () => new THREE.CylinderGeometry(0.6, 0.6, 0.05, 32)
            }
        };
        
        this.initializeSmartPooling();
        
        // EXPO FIX: Start memory monitoring
        this.startMemoryMonitoring();
    }

    // EXPO FIX: Generate smart obstacle pattern with good spacing
    generateObstaclePattern(length) {
        const pattern = [];
        let currentPosition = 0;
        const availableTypes = ['pothole', 'constructionBarrier', 'cone', 'rubble', 'trafficBarrier', 'floorHole'];
        
        for (let i = 0; i < length; i++) {
            // Random spacing within our range
            const spacing = this.MIN_OBSTACLE_SPACING + 
                          Math.random() * (this.MAX_OBSTACLE_SPACING - this.MIN_OBSTACLE_SPACING);
            
            currentPosition += spacing;
            
            // Randomly skip some positions to create natural gaps
            if (Math.random() < this.TARGET_DENSITY) {
                const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
                pattern.push({
                    position: currentPosition,
                    type: type,
                    lane: Math.floor(Math.random() * 3) // 0, 1, or 2
                });
            }
        }
        

        return pattern;
    }

    // EXPO FIX: Smart obstacle spawning ahead of player
    spawnAheadObstacles(playerZ) {
        const spawnThreshold = playerZ - this.SPAWN_HORIZON; // Spawn horizon ahead
        
        // Check if we need to spawn more obstacles
        while (this.needsMoreObstacles(spawnThreshold)) {
            this.spawnNextPatternObstacle();
        }
    }

    // EXPO FIX: Check if we need more obstacles in the spawn horizon
    needsMoreObstacles(spawnThreshold) {
        // Check if we have any obstacles within the spawn horizon
        const obstaclesInRange = this.obstacles.filter(obs => 
            obs.mesh.position.z <= spawnThreshold
        );
        
        // If we have fewer than 6 obstacles in the horizon, spawn more
        return obstaclesInRange.length < 6;
    }

    // EXPO FIX: Spawn next obstacle from pattern
    spawnNextPatternObstacle() {
        // Get next obstacle from pattern
        if (this.patternIndex >= this.obstaclePattern.length) {
            // Regenerate pattern if we've used it all
            this.obstaclePattern = this.generateObstaclePattern(50);
            this.patternIndex = 0;

        }
        
        const obstacleData = this.obstaclePattern[this.patternIndex];
        this.patternIndex++;
        
        if (!this.gameController) {
            console.warn('⚠️ No game controller - cannot spawn obstacle');
            return;
        }
        
        // Calculate spawn position
        const playerZ = this.gameController.getPlayerPosition().z;
        const spawnZ = playerZ - this.SPAWN_HORIZON - obstacleData.position;
        
        // Create the obstacle mesh
        const obstacleMesh = this.createObstacleMesh(obstacleData.type);
        if (!obstacleMesh) {
            console.warn(`Failed to create obstacle mesh for type: ${obstacleData.type}`);
            return;
        }
        
        // Position the obstacle
        const lanePositions = [-2, 0, 2]; // LANES.POSITIONS
        obstacleMesh.position.set(
            lanePositions[obstacleData.lane], 
            obstacleMesh.position.y, 
            spawnZ
        );
        
        // Create obstacle object
        const obstacle = {
            mesh: obstacleMesh,
            type: obstacleData.type,
            lane: obstacleData.lane,
            id: `obstacle_${Date.now()}_${Math.random()}`,
            collisionEnabled: obstacleMesh.userData.isGLB ? 
                this.verifyMeshVisibility(obstacleMesh) : true,
            createdAt: Date.now()
        };
        
        // Add to scene and track
        this.scene.add(obstacleMesh);
        this.obstacles.push(obstacle);
        

    }

    // EXPO FIX: Enhanced memory monitoring for expo reliability
    startMemoryMonitoring() {
        setInterval(() => {
            if (performance.memory) {
                const usedMB = Math.round(performance.memory.usedJSHeapSize / 1048576);
                const totalMB = Math.round(performance.memory.totalJSHeapSize / 1048576);
                
                this.memoryMonitor.maxMemoryMB = Math.max(this.memoryMonitor.maxMemoryMB, usedMB);
                this.memoryMonitor.objectCount = this.scene.children.length;
                
                // EXPO WARNING: Alert if memory growing dangerously
                if (usedMB > 150) {
                    console.warn(`🚨 EXPO WARNING: High memory usage detected: ${usedMB}MB`);
                }
                
                // EXPO CRITICAL: Force garbage collection hint if memory too high
                if (usedMB > 200) {
                    console.error(`🔥 EXPO CRITICAL: Memory usage dangerous: ${usedMB}MB - forcing cleanup`);
                    this.forceMemoryCleanup();
                }
            }
        }, 10000); // Check every 10 seconds
    }

    // EXPO FIX: Emergency memory cleanup
    forceMemoryCleanup() {
        console.warn('🧹 Emergency memory cleanup triggered');
        
        // Remove distant obstacles more aggressively
        const player = this.gameController?.player;
        if (player) {
            this.removeObstaclesBehindPlayer(player.mesh.position.z + 200); // More aggressive cleanup in correct direction
        }
        
        // Suggest garbage collection
        if (window.gc) {
            window.gc();
        }
    }

    async initializeSmartPooling() {
        // PHASE 1: Load priority models first (fast game start)
        await this.loadPriorityModels();
        
        // PHASE 2: Background load remaining models
        this.loadBackgroundModels();
    }

    async loadPriorityModels() {

        
        const priorityPromises = this.priorityModels.map(async (type) => {
            const config = this.modelConfig[type];
            if (!config) return null;
            
            try {
                const gltf = await this.loadModel(config.path);
                if (gltf && gltf.scene) {
                    this.loadedModels.set(type, gltf.scene);
                    // EXPO FIX: Progressive enhancement with visual verification
                    this.upgradeExistingFallbacks(type);
                    
                    return type;
                } else {
                    throw new Error(`Invalid GLB structure for ${type}`);
                }
            } catch (error) {
                console.warn(`⚠️ Failed to load priority model ${type}: ${error.message}`);
                this.loadedModels.set(type, null);
                return null;
            }
        });

        await Promise.allSettled(priorityPromises);
        this.priorityModelsLoaded = true;

    }

    async loadBackgroundModels() {

        
        const backgroundPromises = this.backgroundModels.map(async (type) => {
            const config = this.modelConfig[type];
            if (!config) return null;
            
            try {
                const gltf = await this.loadModel(config.path);
                if (gltf && gltf.scene) {
                    this.loadedModels.set(type, gltf.scene);
                    // EXPO FIX: Progressive enhancement with visual verification
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

    }

    // EXPO FIX: Enhanced upgradeExistingFallbacks with proper disposal
    upgradeExistingFallbacks(modelType) {
        // Find all existing obstacles of this type that use fallback geometry
        for (let i = 0; i < this.obstacles.length; i++) {
            const obstacle = this.obstacles[i];
            
            if (obstacle.type === modelType && obstacle.mesh.userData.isFallback) {
                // Get current position and remove old fallback
                const position = obstacle.mesh.position.clone();
                const rotation = obstacle.mesh.rotation.clone();
                
                // EXPO FIX: Proper disposal of fallback mesh
                this.disposeMesh(obstacle.mesh);
                this.scene.remove(obstacle.mesh);
                
                // Create new GLB-based mesh with visual verification
                const newMesh = this.createObstacleMesh(modelType);
                if (newMesh && this.verifyMeshVisibility(newMesh)) {
                    newMesh.position.copy(position);
                    newMesh.rotation.copy(rotation);
                    
                    // EXPO FIX: Add to scene and verify it's visible
                    this.scene.add(newMesh);
                    
                    // CRITICAL: Only enable collision after visual verification
                    obstacle.mesh = newMesh;
                    obstacle.collisionEnabled = true; // Now safe to enable collision
                } else {
                    console.warn(`❌ Failed to upgrade ${modelType} - GLB not visible`);
                    // Keep the old fallback if GLB upgrade fails
                }
            }
        }
    }

    // EXPO FIX: CRITICAL - Collision-visual synchronization
    verifyMeshVisibility(mesh) {
        if (!mesh) return false;
        
        // Check if mesh has visible geometry
        let hasVisibleGeometry = false;
        let geometryCount = 0;
        mesh.traverse((child) => {
            if (child.isMesh && child.geometry && child.material) {
                hasVisibleGeometry = true;
                geometryCount++;
            }
        });
        
        // Check if mesh is properly positioned and scaled
        const hasValidTransform = mesh.scale.length() > 0.01 && 
                                 isFinite(mesh.position.x) && 
                                 isFinite(mesh.position.y) && 
                                 isFinite(mesh.position.z);
        
        // Check if mesh is actually visible
        const isVisible = hasVisibleGeometry && hasValidTransform && mesh.visible;
        
        if (!isVisible) {
            console.warn(`❌ GLB Model visibility check failed for ${mesh.userData.obstacleType}`);
        }
        
        return isVisible;
    }

    // EXPO FIX: CRITICAL - Create obstacle mesh with collision-visual synchronization
    createObstacleMesh(type) {
        const config = this.modelConfig[type];
        if (!config) {
            console.error(`❌ No config found for obstacle type: ${type}`);
            return null;
        }

        const loadedModel = this.loadedModels.get(type);
        
        if (loadedModel) {
            // GLB model is available - create with visual verification
            const clonedModel = loadedModel.clone();
            
            // Apply configuration
            clonedModel.scale.set(...config.scale);
            clonedModel.position.y = config.yPos;
            clonedModel.rotation.set(...config.rotation);
            
            // Add metadata
            clonedModel.userData = {
                obstacleType: type,
                isFallback: false,
                isGLB: true,
                createdAt: Date.now()
            };
            
            // CRITICAL: Verify visibility before allowing collision
            if (this.verifyMeshVisibility(clonedModel)) {
                return clonedModel;
            } else {
                // GLB failed visibility check - dispose and fall back to fallback
                console.warn(`⚠️ GLB ${type} failed visibility check - using fallback`);
                this.disposeMesh(clonedModel);
                return this.createFallbackMesh(type, config);
            }
        } else {
            // GLB not loaded yet - use fallback
            return this.createFallbackMesh(type, config);
        }
    }

    // EXPO FIX: Create fallback mesh with proper marking
    createFallbackMesh(type, config) {
        const fallbackGeometry = config.fallback();
        const fallbackMaterial = new THREE.MeshStandardMaterial({
            color: OBSTACLE_TYPES[type]?.color || 0x8B4513,
            roughness: 0.7,
            metalness: 0.1
        });
        
        const fallbackMesh = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
        
        // Apply configuration
        fallbackMesh.scale.set(...config.scale);
        fallbackMesh.position.y = config.yPos;
        fallbackMesh.rotation.set(...config.rotation);
        
        // Enable shadows
        fallbackMesh.castShadow = true;
        fallbackMesh.receiveShadow = true;
        
        // Add metadata
        fallbackMesh.userData = {
            obstacleType: type,
            isFallback: true,
            isGLB: false,
            createdAt: Date.now()
        };
        
        return fallbackMesh;
    }

    // EXPO FIX: Enhanced collision detection with safety checks
    checkCollisions(playerBox, waterSlideObjects = [], waterSlideStatus = false) {
        this.frameCounter++;
        
        // Get game speed from game controller if available
        const gameSpeed = this.gameController ? this.gameController.getGameSpeed() : 0;
        
        // Estimate player position from collision box center
        const playerPosition = new THREE.Vector3();
        playerBox.getCenter(playerPosition);
        
        // Track player position for swept collision detection
        this.playerPositionTracker.updatePosition('player', playerPosition);
        const playerPrevPos = this.playerPositionTracker.getPreviousPosition('player') || playerPosition;
        
        // Check each obstacle
        for (let i = 0; i < this.obstacles.length; i++) {
            const obstacle = this.obstacles[i];
            
            // CRITICAL: Only check collision if collision is enabled (visible obstacle)
            if (!obstacle.collisionEnabled) {
                continue; // Skip invisible obstacles
            }
            
            // Skip collision if water slide is active and obstacle is cleared by water slide
            if (waterSlideStatus && waterSlideObjects.includes(obstacle.mesh)) {
                continue; // Water slide clears this obstacle
            }
            
            const obstacleBox = new THREE.Box3().setFromObject(obstacle.mesh);
            
            // Use swept collision detection for high-speed gameplay
            const collision = CollisionUtils.checkSweptCollision(
                playerBox,
                playerPrevPos,
                obstacleBox,
                gameSpeed
            );
            
            if (collision) {
                // Only trigger collision if obstacle is actually visible
                if (this.verifyMeshVisibility(obstacle.mesh)) {
                    return obstacle;
                } else {
                    // Invisible obstacle detected - disable collision and warn
                    console.warn(`🚨 EXPO CRITICAL: Invisible obstacle collision prevented! ${obstacle.type}`);
                    obstacle.collisionEnabled = false;
                    continue;
                }
            }
        }
        
        return null;
    }

    // EXPO FIX: Enhanced obstacle cleanup with proper disposal
    removeObstaclesBehindPlayer(playerZ) {
        const removalThreshold = playerZ + this.DESPAWN_DISTANCE; // Remove obstacles behind player
        let removedCount = 0;
        
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obstacle = this.obstacles[i];
            
            if (obstacle.mesh.position.z > removalThreshold) { // Remove obstacles in positive Z (behind player)
                // Remove from scene and dispose
                this.scene.remove(obstacle.mesh);
                this.disposeMesh(obstacle.mesh);
                
                // Remove from array
                this.obstacles.splice(i, 1);
                removedCount++;
                
                // Track position cleanup
                this.playerPositionTracker.clearPosition(obstacle.id);
            }
        }
        
        if (removedCount > 0) {
            this.memoryMonitor.disposeCount += removedCount;
        }
    }

    // EXPO FIX: Comprehensive mesh disposal to prevent memory leaks
    disposeMesh(mesh) {
        if (!mesh) return;
        
        mesh.traverse((child) => {
            if (child.isMesh) {
                // Dispose geometry
                if (child.geometry) {
                    child.geometry.dispose();
                }
                
                // Dispose materials
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => {
                            this.disposeMaterial(mat);
                        });
                    } else {
                        this.disposeMaterial(child.material);
                    }
                }
            }
        });
        
        // Clear userData and references
        mesh.userData = {};
        mesh.parent = null;
    }

    // EXPO FIX: Proper material disposal
    disposeMaterial(material) {
        if (!material) return;
        
        // Dispose textures
        if (material.map) material.map.dispose();
        if (material.normalMap) material.normalMap.dispose();
        if (material.roughnessMap) material.roughnessMap.dispose();
        if (material.metalnessMap) material.metalnessMap.dispose();
        if (material.emissiveMap) material.emissiveMap.dispose();
        if (material.aoMap) material.aoMap.dispose();
        if (material.envMap) material.envMap.dispose();
        if (material.lightMap) material.lightMap.dispose();
        if (material.bumpMap) material.bumpMap.dispose();
        if (material.displacementMap) material.displacementMap.dispose();
        
        // Dispose material
        material.dispose();
    }

    loadModel(path) {
        return new Promise((resolve, reject) => {
            this.loader.load(
                path,
                (gltf) => {
                    // Ensure all materials support shadows
                    gltf.scene.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            
                            // Enhance materials
                            if (child.material) {
                                if (Array.isArray(child.material)) {
                                    child.material.forEach(mat => this.enhanceMaterial(mat));
                                } else {
                                    this.enhanceMaterial(child.material);
                                }
                            }
                        }
                    });
                    resolve(gltf);
                },
                (progress) => {
                    // Optional: Handle loading progress
                },
                (error) => {
                    reject(error);
                }
            );
        });
    }

    enhanceMaterial(material) {
        if (material.isMeshStandardMaterial) {
            material.roughness = Math.min(material.roughness + 0.1, 1.0);
            material.metalness = Math.max(material.metalness - 0.1, 0.0);
        }
    }

    setGameController(gameController) {
        this.gameController = gameController;
    }

    update(player, gameSpeed) {
        // EXPO FIX: Smart cleanup of obstacles behind player
        this.removeObstaclesBehindPlayer(player.mesh.position.z);
        
        // EXPO FIX: Smart spawning of obstacles ahead of player
        this.spawnAheadObstacles(player.mesh.position.z);
        
        this.frameCounter++;
    }

    // EXPO FIX: Complete cleanup for game reset
    cleanup() {
        // Dispose all obstacles
        for (const obstacle of this.obstacles) {
            this.scene.remove(obstacle.mesh);
            this.disposeMesh(obstacle.mesh);
        }
        
        // Clear arrays
        this.obstacles = [];
        
        // Clear position tracking
        this.playerPositionTracker.clearAll();
        
        // EXPO FIX: Reset smart spawning system
        this.lastObstacleType = '';
        this.patternIndex = 0;
        this.obstaclePattern = this.generateObstaclePattern(50);
        
        this.memoryMonitor.disposeCount += this.obstacles.length;
    }

    // EXPO DEBUG: Get current status for monitoring
    getStatus() {
        return {
            obstacleCount: this.obstacles.length,
            priorityLoaded: this.priorityModelsLoaded,
            allLoaded: this.allModelsLoaded,
            memoryMax: this.memoryMonitor.maxMemoryMB,
            disposeCount: this.memoryMonitor.disposeCount,
            collisionEnabledCount: this.obstacles.filter(o => o.collisionEnabled).length
        };
    }

    // COMPATIBILITY: Methods expected by game.js
    startSpawning() {
        // Spawning logic is handled in update() method
    }

    updateObstacles(gameSpeed, cameraZ, gameActive) {
        if (!gameActive) return 0;
        
        // Get player position from game controller
        const player = this.gameController?.player;
        if (!player) return 0;
        
        // Update obstacle positions and cleanup
        this.update(player, gameSpeed);
        
        // Return score for passed obstacles (simplified)
        return 0; // Score is handled elsewhere
    }

    getObstacles() {
        return this.obstacles;
    }

    reset() {
        this.cleanup();
    }
}