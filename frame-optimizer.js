export class FrameOptimizer {
    constructor() {
        this.frameTime = 16.67; // Target 60fps
        this.frameTimeBuffer = [];
        this.maxBufferSize = 60; // 1 second of frames
        this.adaptiveQuality = true;
        this.currentQualityLevel = 1.0;
        
        this.frameBudgets = {
            physics: 4,      // 4ms for physics
            rendering: 8,    // 8ms for rendering  
            spawning: 2,     // 2ms for spawning
            cleanup: 1,      // 1ms for cleanup
            other: 1.67      // 1.67ms buffer
        };
        
        this.frameScheduler = new PriorityFrameScheduler();
    }

    // Monitor frame performance and adapt quality
    measureFramePerformance() {
        const frameStart = performance.now();
        
        return {
            endFrame: () => {
                const frameEnd = performance.now();
                const frameTime = frameEnd - frameStart;
                
                this.frameTimeBuffer.push(frameTime);
                if (this.frameTimeBuffer.length > this.maxBufferSize) {
                    this.frameTimeBuffer.shift();
                }
                
                this.adaptQualityBasedOnPerformance(frameTime);
                return frameTime;
            },
            
            checkBudget: (taskName) => {
                const elapsed = performance.now() - frameStart;
                const budget = this.frameBudgets[taskName] || 1;
                
                if (elapsed > budget) {
                    return false;
                }
                return true;
            }
        };
    }

    adaptQualityBasedOnPerformance(frameTime) {
        if (!this.adaptiveQuality) return;
        
        const avgFrameTime = this.getAverageFrameTime();
        
        // If we're consistently over budget, reduce quality
        if (avgFrameTime > 20) { // Over 50fps
            this.currentQualityLevel = Math.max(0.5, this.currentQualityLevel - 0.1);
        } 
        // If we have headroom, increase quality
        else if (avgFrameTime < 14) { // Under 71fps
            this.currentQualityLevel = Math.min(1.0, this.currentQualityLevel + 0.05);
        }
    }

    getAverageFrameTime() {
        if (this.frameTimeBuffer.length === 0) return 16.67;
        
        const sum = this.frameTimeBuffer.reduce((a, b) => a + b, 0);
        return sum / this.frameTimeBuffer.length;
    }

    // Create adaptive LOD system
    createAdaptiveLOD() {
        return {
            getLODLevel: (distance, baseQuality = this.currentQualityLevel) => {
                const qualityMultiplier = baseQuality;
                
                if (distance > 100 * qualityMultiplier) return 0; // No render
                if (distance > 50 * qualityMultiplier) return 1;  // Low detail
                if (distance > 25 * qualityMultiplier) return 2;  // Medium detail
                return 3; // High detail
            },
            
            shouldRender: (distance) => {
                return distance <= 100 * this.currentQualityLevel;
            },
            
            getDetailScale: (distance) => {
                const maxDistance = 100 * this.currentQualityLevel;
                const factor = Math.max(0, 1 - (distance / maxDistance));
                return Math.max(0.1, factor);
            }
        };
    }

    // Optimize animation loop
    createOptimizedAnimationLoop(gameLoop) {
        let lastFrameTime = 0;
        let frameId = null;
        
        const optimizedLoop = (currentTime) => {
            const deltaTime = currentTime - lastFrameTime;
            lastFrameTime = currentTime;
            
            // Skip frame if we're running too fast (prevents waste)
            if (deltaTime < 8) { // Don't render faster than 120fps
                frameId = requestAnimationFrame(optimizedLoop);
                return;
            }
            
            const frameMonitor = this.measureFramePerformance();
            
            try {
                // Execute frame with budget monitoring
                this.frameScheduler.executeFrame(() => {
                    gameLoop(deltaTime, frameMonitor);
                });
            } catch (error) {
                // Frame execution error - handle gracefully
            } finally {
                const frameTime = frameMonitor.endFrame();
                
                // Schedule next frame
                frameId = requestAnimationFrame(optimizedLoop);
            }
        };
        
        return {
            start: () => {
                frameId = requestAnimationFrame(optimizedLoop);
            },
            stop: () => {
                if (frameId) {
                    cancelAnimationFrame(frameId);
                    frameId = null;
                }
            }
        };
    }

    // Frame time distribution for better performance
    distributeFrameWork(tasks) {
        const timePerTask = this.frameTime / tasks.length;
        const distributedTasks = [];
        
        tasks.forEach((task, index) => {
            distributedTasks.push({
                ...task,
                scheduledTime: index * timePerTask,
                maxExecutionTime: timePerTask
            });
        });
        
        return distributedTasks;
    }

    getPerformanceStats() {
        return {
            averageFrameTime: this.getAverageFrameTime().toFixed(2) + 'ms',
            currentQuality: (this.currentQualityLevel * 100).toFixed(1) + '%',
            frameBudgets: this.frameBudgets,
            frameTimeHistory: this.frameTimeBuffer.slice(-10)
        };
    }
}

class PriorityFrameScheduler {
    constructor() {
        this.highPriorityTasks = [];
        this.normalPriorityTasks = [];
        this.lowPriorityTasks = [];
    }

    scheduleTask(task, priority = 'normal') {
        const taskWrapper = {
            execute: task,
            priority,
            scheduledAt: performance.now()
        };

        switch (priority) {
            case 'high':
                this.highPriorityTasks.push(taskWrapper);
                break;
            case 'low':
                this.lowPriorityTasks.push(taskWrapper);
                break;
            default:
                this.normalPriorityTasks.push(taskWrapper);
        }
    }

    executeFrame(mainGameLoop) {
        const frameStart = performance.now();
        const frameBudget = 14; // 14ms budget for 60fps with 2.67ms buffer
        
        // Execute high priority tasks first
        this.executeTasks(this.highPriorityTasks, frameStart, frameBudget * 0.3);
        
        // Execute main game loop
        if (performance.now() - frameStart < frameBudget * 0.7) {
            mainGameLoop();
        }
        
        // Execute remaining tasks if time permits
        const remaining = frameBudget - (performance.now() - frameStart);
        if (remaining > 1) {
            this.executeTasks(this.normalPriorityTasks, performance.now(), remaining * 0.7);
            this.executeTasks(this.lowPriorityTasks, performance.now(), remaining * 0.3);
        }
    }

    executeTasks(taskArray, startTime, budget) {
        while (taskArray.length > 0 && (performance.now() - startTime) < budget) {
            const task = taskArray.shift();
            try {
                task.execute();
            } catch (error) {
                // Task execution error - handle gracefully
            }
        }
    }
}