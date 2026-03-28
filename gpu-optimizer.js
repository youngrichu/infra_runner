import * as THREE from 'three';

export class GPUOptimizer {
    constructor(renderer) {
        this.renderer = renderer;
        this.textureCache = new Map();
        this.geometryCache = new Map();
        this.materialCache = new Map();
        this.renderQueue = [];
        this.lastCleanup = 0;
        
        // GPU memory monitoring
        this.gpuMemoryUsage = {
            textures: 0,
            geometries: 0,
            materials: 0,
            total: 0
        };
    }

    // Reduce GPU blocking by managing texture memory
    optimizeTextures() {
        // Use smaller texture sizes for distant objects
        const textureOptimizer = {
            maxTextureSize: 512, // Reduce from default 2048
            minTextureSize: 64,
            
            createOptimizedTexture(originalTexture, distance) {
                const cacheKey = `${originalTexture.uuid}_${distance}`;
                if (this.textureCache.has(cacheKey)) {
                    return this.textureCache.get(cacheKey);
                }
                
                // Use smaller textures for distant objects
                let size = distance > 50 ? 64 : distance > 25 ? 128 : 256;
                
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                
                // Simple solid color instead of complex texture for distant objects
                if (distance > 50) {
                    ctx.fillStyle = originalTexture.color || '#888888';
                    ctx.fillRect(0, 0, size, size);
                } else {
                    // Use original but downscaled
                    if (originalTexture.image) {
                        ctx.drawImage(originalTexture.image, 0, 0, size, size);
                    }
                }
                
                const optimizedTexture = new THREE.CanvasTexture(canvas);
                optimizedTexture.minFilter = THREE.LinearFilter;
                optimizedTexture.magFilter = THREE.LinearFilter;
                
                this.textureCache.set(cacheKey, optimizedTexture);
                return optimizedTexture;
            }
        };
        
        return textureOptimizer;
    }

    // Implement GPU memory cleanup
    cleanupGPUMemory() {
        const now = performance.now();
        if (now - this.lastCleanup < 5000) return; // Cleanup every 5 seconds
        
        // Clean unused textures
        for (const [key, texture] of this.textureCache) {
            if (texture.refCount === 0) {
                texture.dispose();
                this.textureCache.delete(key);
            }
        }
        
        // Clean unused geometries
        for (const [key, geometry] of this.geometryCache) {
            if (geometry.refCount === 0) {
                geometry.dispose();
                this.geometryCache.delete(key);
            }
        }
        
        // Force WebGL context cleanup
        if (this.renderer.info.memory.textures > 50) {
            this.renderer.renderLists.dispose();
            this.renderer.dispose();
        }
        
        this.lastCleanup = now;
    }

    // Reduce draw calls by batching
    createInstancedGeometry(baseGeometry, positions, scales) {
        const instancedGeometry = new THREE.InstancedBufferGeometry();
        instancedGeometry.copy(baseGeometry);
        
        // Instance positions
        const instancePositions = new Float32Array(positions.length * 3);
        positions.forEach((pos, i) => {
            instancePositions[i * 3] = pos.x;
            instancePositions[i * 3 + 1] = pos.y;
            instancePositions[i * 3 + 2] = pos.z;
        });
        
        // Instance scales
        const instanceScales = new Float32Array(scales);
        
        instancedGeometry.setAttribute('instancePosition', 
            new THREE.InstancedBufferAttribute(instancePositions, 3));
        instancedGeometry.setAttribute('instanceScale', 
            new THREE.InstancedBufferAttribute(instanceScales, 1));
        instancedGeometry.instanceCount = positions.length;
        
        return instancedGeometry;
    }

    // Optimize renderer settings for performance
    configureRenderer() {
        // Reduce GPU load
        this.renderer.shadowMap.enabled = false; // Disable shadows for performance
        this.renderer.shadowMap.type = THREE.BasicShadowMap;
        this.renderer.antialias = false; // Disable AA for performance
        this.renderer.powerPreference = "high-performance";
        
        // Reduce precision for mobile/low-end devices
        this.renderer.capabilities.precision = 'mediump';
        
        // Optimize rendering
        this.renderer.sortObjects = false; // Skip sorting for performance
        this.renderer.autoClear = false; // Manual clearing for control
    }

    // Monitor GPU performance
    getGPUStats() {
        const info = this.renderer.info;
        return {
            drawCalls: info.render.calls,
            triangles: info.render.triangles,
            textures: info.memory.textures,
            geometries: info.memory.geometries,
            memoryUsage: this.gpuMemoryUsage.total
        };
    }
}