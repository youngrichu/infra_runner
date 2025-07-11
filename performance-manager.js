// Performance Manager - Modern optimization system for Infrastructure Runner
import * as THREE from 'three';

/**
 * Universal Object Pool for Three.js objects
 * Based on: https://kingdavvid.hashnode.dev/introduction-to-object-pooling-in-threejs
 */
export class ObjectPool {
    constructor(createFn, resetFn, initialSize = 50, maxSize = 200) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.pool = [];
        this.maxSize = maxSize;
        this.activeObjects = new Set();
        this.totalCreated = 0;
        this.poolHits = 0;
        this.poolMisses = 0;
        
        // Pre-populate pool
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.createFn());
            this.totalCreated++;
        }
        
        // Object pool initialized with initial and max size
    }
    
    acquire() {
        let obj;
        
        if (this.pool.length > 0) {
            obj = this.pool.pop();
            this.poolHits++;
        } else {
            obj = this.createFn();
            this.totalCreated++;
            this.poolMisses++;
        }
        
        this.activeObjects.add(obj);
        return obj;
    }
    
    release(obj) {
        if (!this.activeObjects.has(obj)) return false;
        
        this.activeObjects.delete(obj);
        
        if (this.pool.length < this.maxSize) {
            this.resetFn(obj);
            this.pool.push(obj);
            return true;
        }
        
        // Pool is full, dispose the object
        this.disposeObject(obj);
        return false;
    }
    
    disposeObject(obj) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(mat => mat.dispose());
            } else {
                obj.material.dispose();
            }
        }
        obj.userData = {};
    }
    
    getStats() {
        const hitRate = this.poolHits / (this.poolHits + this.poolMisses) * 100;
        return {
            available: this.pool.length,
            active: this.activeObjects.size,
            total: this.totalCreated,
            hitRate: hitRate.toFixed(1) + '%'
        };
    }
    
    releaseAll() {
        this.activeObjects.forEach(obj => this.release(obj));
    }
}

/**
 * Instanced Rendering Manager for repeated objects
 */
export class InstancedRenderingManager {
    constructor(scene) {
        this.scene = scene;
        this.instancedMeshes = new Map();
        this.instanceData = new Map();
        this.maxInstances = 100;
        
        // Temporary matrix for updates
        this.tempMatrix = new THREE.Matrix4();
        this.tempVector = new THREE.Vector3();
        this.tempQuaternion = new THREE.Quaternion();
    }
    
    createInstancedMesh(geometry, material, type, maxCount = this.maxInstances) {
        const instancedMesh = new THREE.InstancedMesh(geometry, material, maxCount);
        instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        instancedMesh.count = 0; // Start with 0 visible instances
        
        this.instancedMeshes.set(type, instancedMesh);
        this.instanceData.set(type, {
            instances: [],
            activeCount: 0,
            maxCount: maxCount
        });
        
        this.scene.add(instancedMesh);
        // Instanced mesh created with max instances
        
        return instancedMesh;
    }
    
    addInstance(type, position, rotation = new THREE.Euler(), scale = new THREE.Vector3(1, 1, 1)) {
        const data = this.instanceData.get(type);
        const mesh = this.instancedMeshes.get(type);
        
        if (!data || !mesh || data.activeCount >= data.maxCount) {
            // Cannot add instance: limit reached or type not found
            return null;
        }
        
        // Create transform matrix
        this.tempQuaternion.setFromEuler(rotation);
        this.tempMatrix.compose(position, this.tempQuaternion, scale);
        
        // Set matrix for this instance
        mesh.setMatrixAt(data.activeCount, this.tempMatrix);
        mesh.instanceMatrix.needsUpdate = true;
        
        // Store instance data
        const instanceInfo = {
            index: data.activeCount,
            position: position.clone(),
            active: true
        };
        
        data.instances[data.activeCount] = instanceInfo;
        data.activeCount++;
        mesh.count = data.activeCount;
        
        return instanceInfo;
    }
    
    removeInstance(type, instanceInfo) {
        const data = this.instanceData.get(type);
        const mesh = this.instancedMeshes.get(type);
        
        if (!data || !mesh || !instanceInfo.active) return;
        
        instanceInfo.active = false;
        
        // Move this instance far away (lazy removal)
        this.tempVector.set(0, -1000, 0);
        this.tempMatrix.makeTranslation(this.tempVector.x, this.tempVector.y, this.tempVector.z);
        mesh.setMatrixAt(instanceInfo.index, this.tempMatrix);
        mesh.instanceMatrix.needsUpdate = true;
    }
    
    updateInstance(type, instanceInfo, position, rotation, scale) {
        const mesh = this.instancedMeshes.get(type);
        if (!mesh || !instanceInfo.active) return;
        
        this.tempQuaternion.setFromEuler(rotation);
        this.tempMatrix.compose(position, this.tempQuaternion, scale);
        mesh.setMatrixAt(instanceInfo.index, this.tempMatrix);
        mesh.instanceMatrix.needsUpdate = true;
        
        instanceInfo.position.copy(position);
    }
    
    getStats() {
        const stats = {};
        for (const [type, data] of this.instanceData.entries()) {
            stats[type] = {
                active: data.activeCount,
                max: data.maxCount,
                usage: `${(data.activeCount / data.maxCount * 100).toFixed(1)}%`
            };
        }
        return stats;
    }
}

/**
 * Frustum Culling Manager for performance optimization
 */
export class FrustumCullingManager {
    constructor(camera) {
        this.camera = camera;
        this.frustum = new THREE.Frustum();
        this.cameraMatrix = new THREE.Matrix4();
        this.cullableObjects = new Set();
        this.visibleObjects = new Set();
        this.culledObjects = new Set();
        this.lastUpdateTime = 0;
        this.updateInterval = 100; // Update every 100ms instead of every frame
    }
    
    addCullableObject(object) {
        this.cullableObjects.add(object);
        // Ensure object has a bounding box
        if (!object.userData.boundingBox) {
            object.geometry && object.geometry.computeBoundingBox();
            object.userData.boundingBox = object.geometry?.boundingBox?.clone();
        }
    }
    
    removeCullableObject(object) {
        this.cullableObjects.delete(object);
        this.visibleObjects.delete(object);
        this.culledObjects.delete(object);
    }
    
    update(forceUpdate = false) {
        const now = Date.now();
        if (!forceUpdate && now - this.lastUpdateTime < this.updateInterval) {
            return;
        }
        
        this.lastUpdateTime = now;
        
        // Update frustum
        this.cameraMatrix.multiplyMatrices(
            this.camera.projectionMatrix,
            this.camera.matrixWorldInverse
        );
        this.frustum.setFromProjectionMatrix(this.cameraMatrix);
        
        // Check each cullable object
        for (const object of this.cullableObjects) {
            if (!object.parent) {
                // Object was removed from scene
                this.removeCullableObject(object);
                continue;
            }
            
            const wasVisible = object.visible;
            const isInFrustum = this.isObjectInFrustum(object);
            
            object.visible = isInFrustum;
            
            if (isInFrustum) {
                this.visibleObjects.add(object);
                this.culledObjects.delete(object);
            } else {
                this.visibleObjects.delete(object);
                this.culledObjects.add(object);
            }
        }
    }
    
    isObjectInFrustum(object) {
        if (!object.userData.boundingBox) return true;
        
        // Transform bounding box to world space
        const box = object.userData.boundingBox.clone();
        box.applyMatrix4(object.matrixWorld);
        
        return this.frustum.intersectsBox(box);
    }
    
    getStats() {
        return {
            total: this.cullableObjects.size,
            visible: this.visibleObjects.size,
            culled: this.culledObjects.size,
            cullRate: `${(this.culledObjects.size / this.cullableObjects.size * 100).toFixed(1)}%`
        };
    }
}

/**
 * Adaptive Quality Manager - Adjusts quality based on performance
 */
export class AdaptiveQualityManager {
    constructor(renderer) {
        this.renderer = renderer;
        this.targetFPS = 60;
        this.minFPS = 45;
        this.fpsHistory = [];
        this.historySize = 30; // 30 frame average
        
        this.qualityLevels = {
            ultra: {
                shadowMapSize: 2048,
                antialias: true,
                pixelRatio: window.devicePixelRatio,
                lodBias: 1.0,
                enableBloom: true
            },
            high: {
                shadowMapSize: 1024,
                antialias: true,
                pixelRatio: Math.min(window.devicePixelRatio, 2),
                lodBias: 0.8,
                enableBloom: true
            },
            medium: {
                shadowMapSize: 512,
                antialias: false,
                pixelRatio: 1,
                lodBias: 0.6,
                enableBloom: false
            },
            low: {
                shadowMapSize: 256,
                antialias: false,
                pixelRatio: 1,
                lodBias: 0.4,
                enableBloom: false
            }
        };
        
        this.currentQuality = this.detectInitialQuality();
        this.applyQuality(this.currentQuality);
        
        // Adaptive quality initialized with initial settings
    }
    
    detectInitialQuality() {
        const gpu = this.getGPUTier();
        const memory = navigator.deviceMemory || 4;
        const cores = navigator.hardwareConcurrency || 4;
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) return 'medium';
        if (gpu >= 3 && memory >= 8 && cores >= 8) return 'ultra';
        if (gpu >= 2 && memory >= 4 && cores >= 4) return 'high';
        if (gpu >= 1 && memory >= 2) return 'medium';
        return 'low';
    }
    
    getGPUTier() {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return 0;
        
        const renderer = gl.getParameter(gl.RENDERER);
        
        // Simple GPU tier detection
        if (renderer.includes('RTX') || renderer.includes('RX 6') || renderer.includes('RX 7')) return 3;
        if (renderer.includes('GTX 1') || renderer.includes('RX 5') || renderer.includes('Intel Iris')) return 2;
        if (renderer.includes('GTX') || renderer.includes('RX') || renderer.includes('Intel HD')) return 1;
        return 0;
    }
    
    updateFPS(deltaTime) {
        const fps = 1 / deltaTime;
        this.fpsHistory.push(fps);
        
        if (this.fpsHistory.length > this.historySize) {
            this.fpsHistory.shift();
        }
        
        // Check if we need to adjust quality (every 2 seconds)
        if (this.fpsHistory.length >= this.historySize && this.fpsHistory.length % 120 === 0) {
            this.evaluateQuality();
        }
    }
    
    evaluateQuality() {
        const avgFPS = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
        
        if (avgFPS < this.minFPS && this.currentQuality !== 'low') {
            this.downgradeQuality();
        } else if (avgFPS > this.targetFPS + 10 && this.currentQuality !== 'ultra') {
            this.upgradeQuality();
        }
    }
    
    downgradeQuality() {
        const levels = Object.keys(this.qualityLevels);
        const currentIndex = levels.indexOf(this.currentQuality);
        if (currentIndex < levels.length - 1) {
            this.currentQuality = levels[currentIndex + 1];
            this.applyQuality(this.currentQuality);
            // Quality downgraded for better performance
        }
    }
    
    upgradeQuality() {
        const levels = Object.keys(this.qualityLevels);
        const currentIndex = levels.indexOf(this.currentQuality);
        if (currentIndex > 0) {
            this.currentQuality = levels[currentIndex - 1];
            this.applyQuality(this.currentQuality);
            // Quality upgraded with improved performance
        }
    }
    
    applyQuality(quality) {
        const settings = this.qualityLevels[quality];
        
        // Apply renderer settings
        this.renderer.setPixelRatio(settings.pixelRatio);
        
        if (this.renderer.shadowMap) {
            this.renderer.shadowMap.mapSize.setScalar(settings.shadowMapSize);
        }
        
        // Store current settings for other systems to use
        this.currentSettings = settings;
    }
    
    getCurrentSettings() {
        return this.currentSettings;
    }
    
    getStats() {
        const avgFPS = this.fpsHistory.length > 0 
            ? (this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length).toFixed(1)
            : 0;
            
        return {
            quality: this.currentQuality,
            avgFPS: avgFPS,
            samples: this.fpsHistory.length
        };
    }
}

/**
 * Performance Monitor - Tracks and reports performance metrics
 */
export class PerformanceMonitor {
    constructor() {
        this.startTime = performance.now();
        this.frameCount = 0;
        this.lastTime = this.startTime;
        this.fpsCount = 0;
        this.fpsTime = 0;
        
        this.metrics = {
            fps: 0,
            frameTime: 0,
            memoryUsage: 0,
            drawCalls: 0,
            triangles: 0
        };
        
        this.callbacks = new Set();
        this.reportInterval = 2000; // Report every 2 seconds
        this.lastReport = this.startTime;
    }
    
    update(renderer) {
        const now = performance.now();
        const deltaTime = now - this.lastTime;
        
        this.frameCount++;
        this.fpsCount++;
        this.fpsTime += deltaTime;
        
        // Calculate FPS every second
        if (this.fpsTime >= 1000) {
            this.metrics.fps = this.fpsCount;
            this.metrics.frameTime = this.fpsTime / this.fpsCount;
            this.fpsCount = 0;
            this.fpsTime = 0;
        }
        
        // Update render stats
        if (renderer.info) {
            this.metrics.drawCalls = renderer.info.render.calls;
            this.metrics.triangles = renderer.info.render.triangles;
        }
        
        // Update memory usage
        if (performance.memory) {
            this.metrics.memoryUsage = performance.memory.usedJSHeapSize / 1024 / 1024; // MB
        }
        
        // Report metrics periodically
        if (now - this.lastReport >= this.reportInterval) {
            this.reportMetrics();
            this.lastReport = now;
        }
        
        this.lastTime = now;
        return deltaTime;
    }
    
    reportMetrics() {
        // Performance metrics tracked internally
        
        // Call registered callbacks
        for (const callback of this.callbacks) {
            callback(this.metrics);
        }
    }
    
    onMetricsUpdate(callback) {
        this.callbacks.add(callback);
    }
    
    getMetrics() {
        return { ...this.metrics };
    }
}