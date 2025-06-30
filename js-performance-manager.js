export class JSPerformanceManager {
    constructor() {
        this.taskQueue = [];
        this.frameScheduler = new FrameScheduler();
        this.executionProfiler = new ExecutionProfiler();
        
        console.log('JS Performance Manager initialized');
    }

    // Break large tasks into smaller chunks
    breakIntoMicroTasks(task, chunkSize = 5) {
        const chunks = [];
        for (let i = 0; i < task.length; i += chunkSize) {
            chunks.push(task.slice(i, i + chunkSize));
        }
        return chunks;
    }

    // Execute tasks across multiple frames
    async executeTasksOverFrames(tasks) {
        for (const task of tasks) {
            await this.frameScheduler.scheduleTask(() => {
                task();
            });
        }
    }

    // Optimize object creation to reduce GC pressure
    createOptimizedBuildingSpawner() {
        return {
            // Pre-allocate arrays to avoid runtime allocation
            tempPosition: new THREE.Vector3(),
            tempRotation: new THREE.Euler(),
            tempScale: new THREE.Vector3(),
            
            // Reuse objects instead of creating new ones
            spawnBuilding(template, position, rotation, scale) {
                this.tempPosition.copy(position);
                this.tempRotation.copy(rotation);
                this.tempScale.copy(scale);
                
                const building = template.clone();
                building.position.copy(this.tempPosition);
                building.rotation.copy(this.tempRotation);
                building.scale.copy(this.tempScale);
                
                return building;
            }
        };
    }

    // Reduce function call overhead
    optimizeCriticalPaths() {
        // Cache frequently accessed properties
        const cache = {
            mathPi: Math.PI,
            mathPi2: Math.PI * 2,
            performance: performance,
            now: performance.now.bind(performance)
        };
        
        return cache;
    }
}

class FrameScheduler {
    constructor() {
        this.tasks = [];
        this.running = false;
        this.frameCount = 0;
        this.maxTasksPerFrame = 3; // Limit tasks per frame
    }

    scheduleTask(task) {
        return new Promise((resolve) => {
            this.tasks.push({ task, resolve });
            if (!this.running) {
                this.startProcessing();
            }
        });
    }

    startProcessing() {
        this.running = true;
        this.processFrame();
    }

    processFrame() {
        const startTime = performance.now();
        const frameTimeLimit = 12; // 12ms to stay under 16.67ms budget
        let tasksProcessed = 0;

        while (this.tasks.length > 0 && 
               performance.now() - startTime < frameTimeLimit && 
               tasksProcessed < this.maxTasksPerFrame) {
            
            const { task, resolve } = this.tasks.shift();
            task();
            resolve();
            tasksProcessed++;
        }

        if (this.tasks.length > 0) {
            requestAnimationFrame(() => this.processFrame());
        } else {
            this.running = false;
        }
    }
}

class ExecutionProfiler {
    constructor() {
        this.profiles = new Map();
    }

    profile(name, fn) {
        const start = performance.now();
        const result = fn();
        const duration = performance.now() - start;
        
        if (!this.profiles.has(name)) {
            this.profiles.set(name, { total: 0, count: 0, avg: 0 });
        }
        
        const profile = this.profiles.get(name);
        profile.total += duration;
        profile.count++;
        profile.avg = profile.total / profile.count;
        
        // Warn about slow functions
        if (duration > 5) {
            console.warn(`Slow function detected: ${name} took ${duration.toFixed(2)}ms`);
        }
        
        return result;
    }

    getReport() {
        const report = {};
        for (const [name, profile] of this.profiles) {
            report[name] = {
                averageTime: profile.avg.toFixed(2) + 'ms',
                totalTime: profile.total.toFixed(2) + 'ms',
                callCount: profile.count
            };
        }
        return report;
    }
}