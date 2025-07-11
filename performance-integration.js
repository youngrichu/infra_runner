import { GPUOptimizer } from './gpu-optimizer.js';
import { JSPerformanceManager } from './js-performance-manager.js';
import { MemoryOptimizer } from './memory-optimizer.js';
import { FrameOptimizer } from './frame-optimizer.js';

export class PerformanceIntegration {
    constructor(renderer, scene) {
        this.renderer = renderer;
        this.scene = scene;
        
        // Initialize all optimizers
        this.gpuOptimizer = new GPUOptimizer(renderer);
        this.jsPerformanceManager = new JSPerformanceManager();
        this.memoryOptimizer = new MemoryOptimizer();
        this.frameOptimizer = new FrameOptimizer();
        
        // Performance monitoring
        this.performanceData = {
            frameDrops: 0,
            averageFrameTime: 16.67,
            gpuMemoryUsage: 0,
            jsHeapSize: 0,
            lastUpdate: performance.now()
        };
        
        this.setupOptimizations();
        // Performance Integration System activated
    }

    setupOptimizations() {
        // Configure GPU optimizations
        this.gpuOptimizer.configureRenderer();
        
        // Setup memory pools for Three.js objects
        this.memoryOptimizer.setupThreeJSPools();
        
        // Setup performance monitoring
        this.startPerformanceMonitoring();
    }

    // Optimized building spawning using all systems
    createOptimizedBuildingSpawner(environment) {
        const spawner = this.jsPerformanceManager.createOptimizedBuildingSpawner();
        const lod = this.frameOptimizer.createAdaptiveLOD();
        
        return {
            spawnBuilding: (template, position, cameraPosition) => {
                const distance = position.distanceTo(cameraPosition);
                
                // Don't spawn if too far (LOD system)
                if (!lod.shouldRender(distance)) {
                    return null;
                }
                
                // Get objects from memory pools
                const tempPos = this.memoryOptimizer.getFromPool('Vector3');
                const tempRot = this.memoryOptimizer.getFromPool('Euler');
                const tempScale = this.memoryOptimizer.getFromPool('Vector3');
                
                if (tempPos && tempRot && tempScale) {
                    tempPos.copy(position);
                    tempRot.set(0, Math.random() * 0.3, 0);
                    
                    const lodLevel = lod.getLODLevel(distance);
                    const scale = 0.006 * lod.getDetailScale(distance);
                    tempScale.setScalar(scale);
                    
                    const building = spawner.spawnBuilding(template, tempPos, tempRot, tempScale);
                    
                    // Return objects to pools
                    this.memoryOptimizer.returnToPool('Vector3', tempPos);
                    this.memoryOptimizer.returnToPool('Euler', tempRot);
                    this.memoryOptimizer.returnToPool('Vector3', tempScale);
                    
                    return building;
                }
                
                // Fallback if pools are empty
                const building = template.clone();
                building.position.copy(position);
                building.scale.setScalar(0.006);
                return building;
            },
            
            batchSpawnBuildings: async (spawnData) => {
                // Break into micro-tasks to prevent blocking
                const chunks = this.jsPerformanceManager.breakIntoMicroTasks(spawnData, 3);
                
                for (const chunk of chunks) {
                    await this.jsPerformanceManager.executeTasksOverFrames(
                        chunk.map(data => () => this.spawnBuilding(data.template, data.position, data.cameraPosition))
                    );
                }
            }
        };
    }

    // Create optimized game loop
    createOptimizedGameLoop(originalGameLoop) {
        const animationLoop = this.frameOptimizer.createOptimizedAnimationLoop((deltaTime, frameMonitor) => {
            // Execute with frame monitoring
            const frameData = {
                deltaTime,
                qualityLevel: this.frameOptimizer.currentQualityLevel,
                frameMonitor
            };
            
            // Schedule cleanup tasks at low priority
            this.frameOptimizer.frameScheduler.scheduleTask(() => {
                this.gpuOptimizer.cleanupGPUMemory();
            }, 'low');
            
            this.frameOptimizer.frameScheduler.scheduleTask(() => {
                this.updatePerformanceData();
            }, 'low');
            
            // Execute main game loop
            originalGameLoop(frameData);
        });
        
        return animationLoop;
    }

    // Performance monitoring and reporting
    startPerformanceMonitoring() {
        setInterval(() => {
            this.updatePerformanceData();
            this.reportPerformanceStats();
        }, 5000); // Report every 5 seconds
    }

    updatePerformanceData() {
        const gpuStats = this.gpuOptimizer.getGPUStats();
        const memoryStats = this.memoryOptimizer.getMemoryStats();
        const frameStats = this.frameOptimizer.getPerformanceStats();
        
        this.performanceData = {
            ...this.performanceData,
            gpuDrawCalls: gpuStats.drawCalls,
            gpuTextures: gpuStats.textures,
            gpuGeometries: gpuStats.geometries,
            memoryHeapUsed: memoryStats.heapUsed,
            averageFrameTime: parseFloat(frameStats.averageFrameTime),
            currentQuality: parseFloat(frameStats.currentQuality),
            lastUpdate: performance.now()
        };
    }

    reportPerformanceStats() {
        const stats = this.getComprehensiveStats();
        
        // Monitor performance metrics silently
        // Performance stats are tracked internally for optimization decisions
    }

    getComprehensiveStats() {
        return {
            performance: {
                averageFrameTime: this.performanceData.averageFrameTime + 'ms',
                currentQuality: this.frameOptimizer.currentQualityLevel * 100 + '%',
                frameDrops: this.performanceData.frameDrops
            },
            gpu: {
                drawCalls: this.performanceData.gpuDrawCalls || 0,
                textures: this.performanceData.gpuTextures || 0,
                geometries: this.performanceData.gpuGeometries || 0
            },
            memory: {
                heapUsed: this.performanceData.memoryHeapUsed ? 
                    (this.performanceData.memoryHeapUsed / 1024 / 1024).toFixed(1) + 'MB' : 'N/A',
                objectPools: this.memoryOptimizer.getMemoryStats().pools
            }
        };
    }

    // Emergency performance mode
    enableEmergencyMode() {
        // Emergency Performance Mode enabled
        
        // Drastically reduce quality
        this.frameOptimizer.currentQualityLevel = 0.3;
        
        // Disable expensive features
        this.renderer.shadowMap.enabled = false;
        this.renderer.antialias = false;
        
        // More aggressive cleanup
        this.gpuOptimizer.cleanupGPUMemory();
        this.memoryOptimizer.triggerMemoryCleanup();
        
        // Reduce frame rate target temporarily
        this.frameOptimizer.frameTime = 33.33; // 30fps
    }

    // Restore normal performance mode
    restoreNormalMode() {
        // Normal Performance Mode restored
        
        this.frameOptimizer.currentQualityLevel = 1.0;
        this.frameOptimizer.frameTime = 16.67; // 60fps
        this.frameOptimizer.adaptiveQuality = true;
    }
}

// Export a factory function for easy integration
export function createPerformanceOptimizedGame(renderer, scene, gameLoop) {
    const performance = new PerformanceIntegration(renderer, scene);
    const optimizedLoop = performance.createOptimizedGameLoop(gameLoop);
    
    return {
        performance,
        start: () => optimizedLoop.start(),
        stop: () => optimizedLoop.stop(),
        getStats: () => performance.getComprehensiveStats()
    };
}