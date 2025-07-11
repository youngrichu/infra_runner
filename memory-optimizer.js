export class MemoryOptimizer {
    constructor() {
        this.objectPools = new Map();
        this.gcStats = {
            collections: 0,
            totalTime: 0,
            lastCollection: 0
        };
        
        // Monitor memory pressure
        this.memoryPressureThreshold = 50 * 1024 * 1024; // 50MB
        this.setupMemoryMonitoring();
        
        // Memory Optimizer initialized
    }

    // Create object pools to reduce GC pressure
    createObjectPool(type, createFn, resetFn, initialSize = 20) {
        const pool = {
            objects: [],
            createFn,
            resetFn,
            inUse: new Set(),
            totalCreated: 0
        };

        // Pre-populate pool
        for (let i = 0; i < initialSize; i++) {
            pool.objects.push(createFn());
            pool.totalCreated++;
        }

        this.objectPools.set(type, pool);
        return pool;
    }

    // Get object from pool instead of creating new
    getFromPool(type) {
        const pool = this.objectPools.get(type);
        if (!pool) return null;

        let obj;
        if (pool.objects.length > 0) {
            obj = pool.objects.pop();
        } else {
            obj = pool.createFn();
            pool.totalCreated++;
        }

        pool.inUse.add(obj);
        return obj;
    }

    // Return object to pool instead of letting GC handle it
    returnToPool(type, obj) {
        const pool = this.objectPools.get(type);
        if (!pool || !pool.inUse.has(obj)) return;

        pool.resetFn(obj);
        pool.inUse.delete(obj);
        
        // Limit pool size to prevent memory bloat
        if (pool.objects.length < 50) {
            pool.objects.push(obj);
        }
    }

    // Optimize Three.js object creation
    setupThreeJSPools() {
        // Vector3 pool
        this.createObjectPool('Vector3', 
            () => new THREE.Vector3(),
            (v) => v.set(0, 0, 0)
        );

        // Euler pool
        this.createObjectPool('Euler',
            () => new THREE.Euler(),
            (e) => e.set(0, 0, 0)
        );

        // Box3 pool
        this.createObjectPool('Box3',
            () => new THREE.Box3(),
            (b) => b.makeEmpty()
        );

        // Matrix4 pool
        this.createObjectPool('Matrix4',
            () => new THREE.Matrix4(),
            (m) => m.identity()
        );

        // Three.js object pools created
    }

    // Reduce string allocations
    createStringCache() {
        const cache = new Map();
        const maxCacheSize = 1000;

        return {
            get(str) {
                if (cache.has(str)) {
                    return cache.get(str);
                }
                
                if (cache.size >= maxCacheSize) {
                    // Remove oldest entries
                    const firstKey = cache.keys().next().value;
                    cache.delete(firstKey);
                }
                
                cache.set(str, str);
                return str;
            },
            
            clear() {
                cache.clear();
            },
            
            size() {
                return cache.size;
            }
        };
    }

    // Batch DOM operations to reduce reflow/repaint
    batchDOMOperations(operations) {
        // Use DocumentFragment for batch DOM updates
        const fragment = document.createDocumentFragment();
        
        requestAnimationFrame(() => {
            operations.forEach(op => op(fragment));
        });
        
        return fragment;
    }

    // Monitor memory usage and trigger cleanup
    setupMemoryMonitoring() {
        if (!performance.memory) return;

        setInterval(() => {
            const memory = performance.memory;
            const usage = memory.usedJSHeapSize;
            
            if (usage > this.memoryPressureThreshold) {
                this.triggerMemoryCleanup();
            }
            
            // Log memory stats
            if (Math.random() < 0.1) { // Log 10% of the time
                // Memory usage monitoring
            }
        }, 5000);
    }

    triggerMemoryCleanup() {
        // Triggering memory cleanup due to pressure
        
        // Clean object pools
        for (const [type, pool] of this.objectPools) {
            // Keep only half the unused objects
            const keepCount = Math.floor(pool.objects.length / 2);
            pool.objects.splice(keepCount);
        }
        
        // Suggest garbage collection (modern browsers)
        if (window.gc) {
            window.gc();
        }
    }

    // Optimize array operations to reduce allocations
    createOptimizedArrayOps() {
        return {
            // Reuse arrays instead of creating new ones
            tempArray: [],
            
            filter(array, predicate) {
                this.tempArray.length = 0;
                for (let i = 0; i < array.length; i++) {
                    if (predicate(array[i])) {
                        this.tempArray.push(array[i]);
                    }
                }
                return [...this.tempArray]; // Return copy
            },
            
            map(array, mapper) {
                this.tempArray.length = 0;
                for (let i = 0; i < array.length; i++) {
                    this.tempArray.push(mapper(array[i]));
                }
                return [...this.tempArray]; // Return copy
            }
        };
    }

    getMemoryStats() {
        const stats = {
            pools: {}
        };
        
        for (const [type, pool] of this.objectPools) {
            stats.pools[type] = {
                available: pool.objects.length,
                inUse: pool.inUse.size,
                totalCreated: pool.totalCreated
            };
        }
        
        if (performance.memory) {
            stats.heapUsed = performance.memory.usedJSHeapSize;
            stats.heapTotal = performance.memory.totalJSHeapSize;
            stats.heapLimit = performance.memory.jsHeapSizeLimit;
        }
        
        return stats;
    }
}