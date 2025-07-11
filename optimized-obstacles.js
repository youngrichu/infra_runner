// Optimized Obstacles Manager with Modern Performance Techniques
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LANES, OBSTACLE_TYPES, SPAWN_CONFIG, SCORING, PHYSICS } from './constants.js';
import { ObjectPool, InstancedRenderingManager, FrustumCullingManager } from './performance-manager.js';
import { CollisionUtils, PositionTracker } from './collision-utils.js';

export class OptimizedObstacleManager {
    constructor(scene, performanceMonitor) {
        this.scene = scene;
        this.performanceMonitor = performanceMonitor;
        this.gameController = null;
        
        // Modern performance systems
        this.objectPools = new Map();
        this.instancedRenderer = new InstancedRenderingManager(scene);
        this.frustumCuller = new FrustumCullingManager();
        
        // Obstacle management
        this.obstacles = [];
        this.activeInstances = new Map(); // Track instanced obstacles
        this.lastObstacleType = '';
        
        // Smart spawning system
        this.SPAWN_HORIZON = 50;
        this.DESPAWN_DISTANCE = 30;
        this.MIN_OBSTACLE_SPACING = 4;
        this.MAX_OBSTACLE_SPACING = 8;
        this.playerPositionTracker = new PositionTracker();
        
        // Asset loading
        this.loader = new GLTFLoader();
        this.loadedModels = new Map();
        this.loadingPromises = new Map();
        this.priorityModelsLoaded = false;
        this.allModelsLoaded = false;
        
        // Priority loading queues
        this.priorityModels = ['pothole', 'constructionBarrier', 'cone'];
        this.backgroundModels = ['rubble', 'trafficBarrier', 'floorHole'];
        
        // Performance tracking
        this.spawnCounter = 0;
        this.poolEfficiency = 0;
        this.renderingMode = 'hybrid'; // 'individual', 'instanced', or 'hybrid'
        
        this.initializeOptimizedSystem();
    }
    
    async initializeOptimizedSystem() {
        // Initializing optimized obstacle system
        
        // Initialize object pools for each obstacle type
        this.initializeObjectPools();
        
        // Initialize instanced rendering for high-frequency obstacles
        this.initializeInstancedRendering();
        
        // Start progressive asset loading
        await this.loadPriorityAssets();
        this.loadBackgroundAssets(); // Load in background
        
        // Optimized obstacle system ready
    }
    
    initializeObjectPools() {
        for (const [type, config] of Object.entries(OBSTACLE_TYPES)) {
            const pool = new ObjectPool(
                () => this.createFallbackObstacle(type),
                (mesh) => this.resetObstacle(mesh),
                20, // Initial size
                100 // Max size
            );
            
            this.objectPools.set(type, pool);
        }
        
        // Object pools initialized for obstacle types
    }
    
    initializeInstancedRendering() {
        // Initialize instanced meshes for most common obstacles
        const commonObstacles = ['pothole', 'cone', 'rubble'];
        
        for (const type of commonObstacles) {
            const config = OBSTACLE_TYPES[type];
            const geometry = config.geometry();
            const material = new THREE.MeshLambertMaterial({ 
                color: config.color,
                transparent: false,
                fog: true
            });
            
            this.instancedRenderer.createInstancedMesh(geometry, material, type, 50);
        }
        
        // Instanced rendering initialized for common obstacles
    }
    
    async loadPriorityAssets() {
        // Loading priority obstacle models
        
        const loadPromises = this.priorityModels.map(type => this.loadModel(type));
        await Promise.allSettled(loadPromises);
        
        this.priorityModelsLoaded = true;
        // Priority models loaded - enhanced visual quality activated
    }
    
    async loadBackgroundAssets() {
        // Loading background obstacle models
        
        const loadPromises = this.backgroundModels.map(type => this.loadModel(type));
        await Promise.allSettled(loadPromises);
        
        this.allModelsLoaded = true;
        this.upgradeExistingObstacles();
        // All obstacle models loaded - maximum visual quality achieved
    }
    
    async loadModel(type) {
        if (this.loadedModels.has(type) || this.loadingPromises.has(type)) {
            return this.loadingPromises.get(type);
        }
        
        const config = this.getModelConfig(type);
        if (!config) return null;
        
        const loadPromise = this.loader.loadAsync(config.path)
            .then(gltf => {
                this.loadedModels.set(type, gltf);
                // GLB model loaded successfully
                return gltf;
            })
            .catch(error => {
                // Failed to load GLB model, using fallback
                return null;
            });
        
        this.loadingPromises.set(type, loadPromise);
        return loadPromise;
    }
    
    createOptimizedObstacle(type, position, lane) {
        this.spawnCounter++;
        
        // Decide rendering strategy based on frequency and performance
        const useInstancing = this.shouldUseInstancing(type);
        
        if (useInstancing) {
            return this.createInstancedObstacle(type, position, lane);
        } else {
            return this.createPooledObstacle(type, position, lane);
        }
    }
    
    shouldUseInstancing(type) {
        // Use instancing for high-frequency obstacles in good performance conditions
        const commonTypes = ['pothole', 'cone', 'rubble'];
        const hasInstancedMesh = this.instancedRenderer.instancedMeshes.has(type);
        const goodPerformance = this.performanceMonitor.getMetrics().fps > 45;
        
        return commonTypes.includes(type) && hasInstancedMesh && goodPerformance;
    }
    
    createInstancedObstacle(type, position, lane) {
        const rotation = new THREE.Euler(0, Math.random() * Math.PI, 0);
        const scale = new THREE.Vector3(1, 1, 1);
        
        const instanceInfo = this.instancedRenderer.addInstance(type, position, rotation, scale);
        
        if (instanceInfo) {
            const obstacle = {
                type: type,
                position: position.clone(),
                lane: lane,
                boundingBox: this.calculateBoundingBox(type, position),
                collisionEnabled: true,
                isInstanced: true,
                instanceInfo: instanceInfo,
                id: `instanced_${type}_${this.spawnCounter}`
            };
            
            this.obstacles.push(obstacle);
            this.activeInstances.set(obstacle.id, obstacle);
            
            return obstacle;
        }
        
        // Fallback to pooled if instancing fails
        return this.createPooledObstacle(type, position, lane);
    }
    
    createPooledObstacle(type, position, lane) {
        const pool = this.objectPools.get(type);
        const mesh = pool.acquire();
        
        // Configure mesh
        mesh.position.copy(position);
        mesh.position.y = OBSTACLE_TYPES[type].yPos;
        mesh.rotation.y = Math.random() * Math.PI;
        mesh.visible = true;
        mesh.userData = {
            type: type,
            lane: lane,
            spawned: Date.now(),
            isPooled: true
        };
        
        // Try to upgrade to GLB model if available
        this.upgradeToGLBModel(mesh, type);
        
        // Add to scene and tracking
        this.scene.add(mesh);
        this.frustumCuller.addCullableObject(mesh);
        
        const obstacle = {
            type: type,
            position: position.clone(),
            lane: lane,
            mesh: mesh,
            boundingBox: this.calculateBoundingBox(type, position),
            collisionEnabled: true,
            isInstanced: false,
            id: `pooled_${type}_${this.spawnCounter}`
        };
        
        this.obstacles.push(obstacle);
        return obstacle;
    }
    
    upgradeToGLBModel(mesh, type) {
        const gltf = this.loadedModels.get(type);
        if (!gltf) return false;
        
        try {
            // Clone the GLB model
            const glbScene = gltf.scene.clone();
            const config = this.getModelConfig(type);
            
            // Apply transformations
            glbScene.scale.set(...config.scale);
            glbScene.rotation.set(...config.rotation);
            
            // Replace geometry and material
            mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
            
            // Use first mesh from GLB
            const firstMesh = glbScene.children.find(child => child.isMesh);
            if (firstMesh) {
                mesh.geometry = firstMesh.geometry;
                mesh.material = firstMesh.material;
            }
            
            mesh.userData.isGLB = true;
            mesh.userData.upgraded = Date.now();
            
            return true;
        } catch (error) {
            // Failed to upgrade to GLB model
            return false;
        }
    }
    
    updateObstacles(gameSpeed, cameraZ, gameActive) {
        if (!gameActive) return 0;
        
        const playerPosition = this.gameController?.getPlayerPosition() || { z: cameraZ };
        
        // Update frustum culling
        this.frustumCuller.update();
        
        let obstaclesPassedScore = 0;
        const obstaclesToRemove = [];
        
        // Update individual obstacles
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obstacle = this.obstacles[i];
            
            // Move obstacle based on game speed
            obstacle.position.z += gameSpeed;
            
            if (obstacle.isInstanced) {
                // Update instanced obstacle
                this.instancedRenderer.updateInstance(
                    obstacle.type,
                    obstacle.instanceInfo,
                    obstacle.position,
                    new THREE.Euler(0, 0, 0),
                    new THREE.Vector3(1, 1, 1)
                );
            } else if (obstacle.mesh) {
                // Update individual mesh
                obstacle.mesh.position.z = obstacle.position.z;
            }
            
            // Update bounding box
            obstacle.boundingBox.setFromCenterAndSize(
                obstacle.position,
                this.getBoundingBoxSize(obstacle.type)
            );
            
            // Check if obstacle should be removed
            if (obstacle.position.z > cameraZ + this.DESPAWN_DISTANCE) {
                obstaclesToRemove.push(i);
                
                // Award score for passing obstacle
                if (obstacle.position.z > playerPosition.z) {
                    obstaclesPassedScore += SCORING.OBSTACLE_PASSED;
                }
            }
        }
        
        // Remove old obstacles
        for (const index of obstaclesToRemove) {
            this.removeObstacle(index);
        }
        
        // Spawn new obstacles
        this.spawnObstaclesAhead(playerPosition.z);
        
        return obstaclesPassedScore;
    }
    
    removeObstacle(index) {
        const obstacle = this.obstacles[index];
        
        if (obstacle.isInstanced) {
            // Remove from instanced rendering
            this.instancedRenderer.removeInstance(obstacle.type, obstacle.instanceInfo);
            this.activeInstances.delete(obstacle.id);
        } else if (obstacle.mesh) {
            // Return to pool
            this.scene.remove(obstacle.mesh);
            this.frustumCuller.removeCullableObject(obstacle.mesh);
            
            const pool = this.objectPools.get(obstacle.type);
            pool.release(obstacle.mesh);
        }
        
        this.obstacles.splice(index, 1);
    }
    
    spawnObstaclesAhead(playerZ) {
        const spawnZ = playerZ - this.SPAWN_HORIZON;
        const needsObstacle = this.obstacles.length === 0 || 
            this.obstacles[this.obstacles.length - 1].position.z > spawnZ + this.MIN_OBSTACLE_SPACING;
        
        if (!needsObstacle) return;
        
        // Smart obstacle type selection
        const availableTypes = Object.keys(OBSTACLE_TYPES);
        let obstacleType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        
        // Avoid repeating the same obstacle type
        if (obstacleType === this.lastObstacleType && availableTypes.length > 1) {
            do {
                obstacleType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
            } while (obstacleType === this.lastObstacleType);
        }
        
        this.lastObstacleType = obstacleType;
        
        // Select lane (avoid spawning in player's current lane if possible)
        const playerLane = this.gameController?.player?.lane || LANES.CENTER;
        const availableLanes = [0, 1, 2].filter(lane => lane !== playerLane);
        const selectedLane = availableLanes.length > 0 
            ? availableLanes[Math.floor(Math.random() * availableLanes.length)]
            : Math.floor(Math.random() * LANES.COUNT);
        
        const position = new THREE.Vector3(
            LANES.POSITIONS[selectedLane],
            0,
            spawnZ
        );
        
        this.createOptimizedObstacle(obstacleType, position, selectedLane);
    }
    
    checkCollisions(playerBox, waterSlideObjects = [], waterSlideActive = false) {
        for (const obstacle of this.obstacles) {
            if (!obstacle.collisionEnabled) continue;
            
            // Skip collision if in water slide safe zone
            if (waterSlideActive && this.isInWaterSlideZone(obstacle.position, waterSlideObjects)) {
                continue;
            }
            
            // Use high-speed collision detection for fast gameplay
            if (this.gameController?.getGameSpeed() > PHYSICS.HIGH_SPEED_THRESHOLD) {
                if (CollisionUtils.checkExpandedCollision(playerBox, obstacle.boundingBox, 1.2)) {
                    return obstacle;
                }
            } else {
                if (playerBox.intersectsBox(obstacle.boundingBox)) {
                    return obstacle;
                }
            }
        }
        
        return null;
    }
    
    // Utility methods
    createFallbackObstacle(type) {
        const config = OBSTACLE_TYPES[type];
        const geometry = config.geometry();
        const material = new THREE.MeshLambertMaterial({ 
            color: config.color,
            transparent: false,
            fog: true
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { type: type, isFallback: true };
        
        return mesh;
    }
    
    resetObstacle(mesh) {
        mesh.position.set(0, 0, 0);
        mesh.rotation.set(0, 0, 0);
        mesh.scale.set(1, 1, 1);
        mesh.visible = false;
        mesh.userData = {};
        
        if (mesh.parent) {
            mesh.parent.remove(mesh);
        }
    }
    
    calculateBoundingBox(type, position) {
        const size = this.getBoundingBoxSize(type);
        const box = new THREE.Box3();
        box.setFromCenterAndSize(position, size);
        return box;
    }
    
    getBoundingBoxSize(type) {
        const config = OBSTACLE_TYPES[type];
        
        // Default sizes based on obstacle type
        const sizeMap = {
            pothole: new THREE.Vector3(1, 0.2, 1),
            constructionBarrier: new THREE.Vector3(1.5, 1, 0.5),
            cone: new THREE.Vector3(0.6, 0.8, 0.6),
            rubble: new THREE.Vector3(0.8, 0.4, 0.8),
            trafficBarrier: new THREE.Vector3(1.8, 0.8, 0.5),
            floorHole: new THREE.Vector3(1.2, 0.1, 1.2)
        };
        
        return sizeMap[type] || new THREE.Vector3(1, 1, 1);
    }
    
    getModelConfig(type) {
        // Use our analyzed configurations with verified scale factors
        const configs = {
            'pothole': {
                path: '/assets/models/obstacles/Floor Hole.glb',
                scale: [0.833, 0.833, 0.833], // From analysis
                rotation: [0, 0, 0]
            },
            'constructionBarrier': {
                path: '/assets/models/obstacles/Plastic Barrier.glb',
                scale: [0.898, 0.898, 0.898], // From analysis
                rotation: [0, 0, 0]
            },
            'cone': {
                path: '/assets/models/obstacles/Cone.glb',
                scale: [0.886, 0.886, 0.886], // From analysis
                rotation: [0, 0, 0]
            },
            'rubble': {
                path: '/assets/models/obstacles/Cinder block.glb',
                scale: [0.000002, 0.000002, 0.000002], // Extremely oversized model - use fallback
                rotation: [0, Math.random() * Math.PI, 0],
                useModelLoading: false // Skip this model, use fallback
            }
        };
        
        return configs[type];
    }
    
    isInWaterSlideZone(position, waterSlideObjects) {
        return waterSlideObjects.some(obj => 
            position.distanceTo(obj.position) < 2.0
        );
    }
    
    upgradeExistingObstacles() {
        let upgradedCount = 0;
        
        for (const obstacle of this.obstacles) {
            if (!obstacle.isInstanced && obstacle.mesh && !obstacle.mesh.userData.isGLB) {
                if (this.upgradeToGLBModel(obstacle.mesh, obstacle.type)) {
                    upgradedCount++;
                }
            }
        }
        
        // Upgraded existing obstacles to GLB models if available
    }
    
    // Performance and stats methods
    getPerformanceStats() {
        const poolStats = {};
        for (const [type, pool] of this.objectPools.entries()) {
            poolStats[type] = pool.getStats();
        }
        
        const instanceStats = this.instancedRenderer.getStats();
        const cullingStats = this.frustumCuller.getStats();
        
        return {
            obstacles: {
                total: this.obstacles.length,
                instanced: this.activeInstances.size,
                pooled: this.obstacles.length - this.activeInstances.size
            },
            pools: poolStats,
            instances: instanceStats,
            culling: cullingStats,
            performance: {
                spawnCount: this.spawnCounter,
                renderingMode: this.renderingMode,
                modelsLoaded: {
                    priority: this.priorityModelsLoaded,
                    all: this.allModelsLoaded
                }
            }
        };
    }
    
    // Interface compatibility methods
    setGameController(controller) {
        this.gameController = controller;
        this.frustumCuller = new FrustumCullingManager(controller.camera);
    }
    
    getObstacles() {
        return this.obstacles;
    }
    
    startSpawning() {
        // Optimized obstacle spawning started
    }
    
    reset() {
        // Remove all obstacles
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            this.removeObstacle(i);
        }
        
        // Release all pooled objects
        for (const pool of this.objectPools.values()) {
            pool.releaseAll();
        }
        
        // Reset counters
        this.spawnCounter = 0;
        this.lastObstacleType = '';
        
        // Optimized obstacle system reset
    }
}