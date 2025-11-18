import * as THREE from 'three';
import { LANES, OBSTACLE_TYPES, SPAWN_CONFIG, SCORING, PHYSICS } from './constants.js';
import { CollisionUtils, PositionTracker } from './collision-utils.js';

export class ObstacleManager {
    constructor(scene) {
        this.scene = scene;
        this.obstacles = [];
        this.lastObstacleType = '';
        this.lastObstacleZ = 0;
        this.gameController = null; // Will be set by game.js

        // High-speed collision detection
        this.playerPositionTracker = new PositionTracker();
        this.frameCounter = 0;
    }

    setGameController(gameController) {
        this.gameController = gameController;
    }

    createObstacle(playerZ) {
        // Filter out the last used obstacle type to prevent repetition
        const availableTypes = Object.keys(OBSTACLE_TYPES).filter(type => type !== this.lastObstacleType);
        const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        const obstacleConfig = OBSTACLE_TYPES[type];

        let spawnPosition;
        if (type === 'electricLine') {
            // Electric line spans across all lanes, position at center of road
            spawnPosition = new THREE.Vector3(
                0, // Center of road
                obstacleConfig.yPos,
                playerZ - 50
            );
        } else {
            // Regular obstacles spawn in specific lanes
            const laneIndex = Math.floor(Math.random() * LANES.COUNT);
            spawnPosition = new THREE.Vector3(
                LANES.POSITIONS[laneIndex],
                obstacleConfig.yPos,
                playerZ - 50
            );
        }

        // Try to create GLB model first (using collectables manager GLB system)
        let obstacleMesh = null;
        if (this.gameController && this.gameController.collectableManager) {
            obstacleMesh = this.gameController.collectableManager.createObstacleGLBMesh(type, spawnPosition);
        }

        // Fallback to original geometry if GLB failed
        if (!obstacleMesh) {
            const geometry = obstacleConfig.geometry();

            // Handle group-based obstacles (like electric lines)
            if (geometry instanceof THREE.Group) {
                obstacleMesh = geometry;
                obstacleMesh.position.copy(spawnPosition);
                // Set shadows for all children in the group
                obstacleMesh.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.castShadow = true;
                    }
                });
            } else {
                // Handle regular geometry-based obstacles
                const material = new THREE.MeshStandardMaterial({ color: obstacleConfig.color });
                obstacleMesh = new THREE.Mesh(geometry, material);
                obstacleMesh.position.copy(spawnPosition);
                obstacleMesh.castShadow = true;
            }

            this.scene.add(obstacleMesh);
        }

        this.obstacles.push({ mesh: obstacleMesh, type: type });
        this.lastObstacleType = type;
    }

    startSpawning() {
        this.spawnObstacle();
    }

    spawnObstacle() {
        // Check if game is still active using the game controller
        if (!this.gameController || !this.gameController.isGameActive()) {
            return;
        }

        const playerZ = this.gameController.getPlayerPosition().z;
        const minDistance = SPAWN_CONFIG.OBSTACLE_MIN_DISTANCE;
        const currentZ = playerZ - 50;

        if (Math.abs(currentZ - this.lastObstacleZ) >= minDistance) {
            this.createObstacle(playerZ);
            this.lastObstacleZ = currentZ;

            let spawnIntervalMin = SPAWN_CONFIG.OBSTACLE_INTERVAL.MIN;
            let spawnIntervalMax = SPAWN_CONFIG.OBSTACLE_INTERVAL.MAX;

            if (SPAWN_CONFIG.OBSTACLE_DYNAMIC_INTERVAL.ENABLED) {
                const gameSpeed = this.gameController.getGameSpeed();
                const reduction = gameSpeed * SPAWN_CONFIG.OBSTACLE_DYNAMIC_INTERVAL.SPEED_SENSITIVITY;

                spawnIntervalMin = Math.max(
                    SPAWN_CONFIG.OBSTACLE_INTERVAL.MIN - reduction,
                    SPAWN_CONFIG.OBSTACLE_DYNAMIC_INTERVAL.MIN_CLAMP
                );
                spawnIntervalMax = Math.max(
                    SPAWN_CONFIG.OBSTACLE_INTERVAL.MAX - reduction,
                    spawnIntervalMin + SPAWN_CONFIG.OBSTACLE_DYNAMIC_INTERVAL.MAX_CLAMP_MIN_OFFSET // Ensure max is always greater than min
                );
            }

            const timeoutDuration = Math.random() * (spawnIntervalMax - spawnIntervalMin) + spawnIntervalMin;

            setTimeout(() => {
                this.spawnObstacle(); // Recursive call without parameters
            }, timeoutDuration);
        } else {
            setTimeout(() => {
                this.spawnObstacle(); // Try again soon
            }, 500);
        }
    }

    updateObstacles(gameSpeed, cameraZ, gameActive) {
        let scoreGained = 0;

        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            this.obstacles[i].mesh.position.z += gameSpeed;
            if (this.obstacles[i].mesh.position.z > cameraZ + 5) {
                this.scene.remove(this.obstacles[i].mesh);
                this.obstacles.splice(i, 1);
                if (gameActive) {
                    scoreGained += SCORING.OBSTACLE_PASSED;
                }
            } else {
                // Far culling: Hide obstacles that are too far ahead (beyond fog)
                const distanceAhead = Math.abs(this.obstacles[i].mesh.position.z - cameraZ);
                if (distanceAhead > 160) {
                    this.obstacles[i].mesh.visible = false;
                } else {
                    this.obstacles[i].mesh.visible = true;
                }
            }
        }

        return scoreGained;
    }

    checkCollisions(playerBox, waterSlideObjects, hasWaterSlide) {
        // Update position tracking
        this.frameCounter++;
        const playerCenter = new THREE.Vector3();
        playerBox.getCenter(playerCenter);

        // Get previous player position for swept collision detection
        const playerPrevPos = this.playerPositionTracker.getPreviousPosition('player');
        this.playerPositionTracker.updatePosition('player', playerCenter);

        // Default to current position if no previous position available
        const effectivePrevPos = playerPrevPos || playerCenter;

        // Get current game speed for collision detection
        const gameSpeed = this.gameController ? this.gameController.getGameSpeed() : 0;

        for (let i = 0; i < this.obstacles.length; i++) {
            const obstacleBox = new THREE.Box3().setFromObject(this.obstacles[i].mesh);

            // Check if player is protected by water slide
            let isProtectedByWaterSlide = false;

            if (hasWaterSlide && waterSlideObjects && waterSlideObjects.length > 0) {
                const slideSegment = waterSlideObjects[0];
                if (slideSegment) {
                    const slideLaneX = slideSegment.position.x;
                    const obstacleLaneX = this.obstacles[i].mesh.position.x;

                    if (Math.abs(slideLaneX - obstacleLaneX) < 0.5 &&
                        this.obstacles[i].mesh.position.z < playerBox.max.z + 5 &&
                        this.obstacles[i].mesh.position.z > playerBox.max.z - 50) {
                        isProtectedByWaterSlide = true;
                    }
                }
            }

            // Use advanced collision detection for high speeds
            let collisionDetected = false;
            if (gameSpeed > PHYSICS.HIGH_SPEED_THRESHOLD) {
                // High-speed: Use swept collision detection
                collisionDetected = CollisionUtils.checkSweptCollision(
                    playerBox,
                    effectivePrevPos,
                    obstacleBox,
                    gameSpeed
                );
            } else {
                // Low-speed: Use standard collision detection
                collisionDetected = playerBox.intersectsBox(obstacleBox);
            }

            if (!isProtectedByWaterSlide && collisionDetected) {
                // Special handling for electric line obstacle
                if (this.obstacles[i].type === 'electricLine') {
                    // Check if player is sliding or jumping high enough
                    const playerHeight = playerBox.max.y;
                    const wireHeight = 1.2; // Height of the electric wire

                    // Allow passing if player is sliding (low collision box) or jumping high enough
                    if (this.gameController && this.gameController.player) {
                        const player = this.gameController.player;
                        if (player.isSliding || playerHeight > wireHeight + 0.3) {
                            continue; // No collision, player can pass
                        }
                    }
                }
                return true;
            }
        }
        return false;
    }

    getObstacles() {
        return this.obstacles;
    }

    reset() {
        this.obstacles.forEach(obstacle => this.scene.remove(obstacle.mesh));
        this.obstacles = [];
        this.lastObstacleType = '';
        this.lastObstacleZ = 0;

        // Reset collision tracking
        this.playerPositionTracker.clearAll();
        this.frameCounter = 0;
    }
}