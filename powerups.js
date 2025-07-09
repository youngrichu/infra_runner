import * as THREE from 'three';
import { LANES, COLORS, POWER_UP_DURATIONS, PHYSICS } from './constants.js';

export class PowerUpManager {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.collectableManager = null; // Will be set by game.js
        this.obstacleManager = null; // Will be set by game.js
        
        // Power-up states
        this.isInvincible = false;
        this.invincibilityTimer = 0;
        this.isFlying = false;
        this.flyingTimer = 0;
        this.hasSolarBoost = false;
        this.solarBoostTimer = 0;
        this.hasWindPower = false;
        this.windPowerTimer = 0;
        this.hasWaterSlide = false;
        this.waterSlideTimer = 0;
        
        this.waterSlideObjects = [];
        this.gameSpeed = null; // Will be set by reference
        this.pushedObstacles = []; // Track obstacles being pushed by flood
    }

    setGameSpeedReference(gameSpeedRef) {
        this.gameSpeed = gameSpeedRef;
    }

    setCollectableManager(collectableManager) {
        this.collectableManager = collectableManager;
    }

    setObstacleManager(obstacleManager) {
        this.obstacleManager = obstacleManager;
    }

    activateInvincibility(duration = POWER_UP_DURATIONS.INVINCIBILITY) {
        this.isInvincible = true;
        this.invincibilityTimer = duration;
        this.player.setColor(COLORS.PLAYER.INVINCIBLE);
        console.log("Hard Hat Shield ACTIVE!");
    }

    deactivateInvincibility() {
        this.isInvincible = false;
        this.updatePlayerColor();
        console.log("Hard Hat Shield DEACTIVATED!");
    }

    activateHelicopter(duration = POWER_UP_DURATIONS.HELICOPTER) {
        console.log("Activating Jetpack with duration:", duration);
        this.isFlying = true;
        this.flyingTimer = duration;
        this.player.setPosition(
            this.player.getPosition().x,
            PHYSICS.FLYING_HEIGHT,
            this.player.getPosition().z
        );
        this.player.setColor(COLORS.PLAYER.FLYING);
        console.log("Jetpack ACTIVE!");
    }

    deactivateHelicopter() {
        this.isFlying = false;
        // Remove all aerial stars when helicopter ends
        if (this.collectableManager) {
            this.collectableManager.removeAerialStars();
        }
        // Initiate controlled fall
        this.player.isJumping = true;
        this.player.velocityY = 0;
        this.updatePlayerColor();
        console.log("Jetpack DEACTIVATED!");
    }

    activateSolarPower(duration = POWER_UP_DURATIONS.SOLAR_BOOST) {
        this.hasSolarBoost = true;
        this.solarBoostTimer = duration;
        if (this.gameSpeed) {
            this.gameSpeed.value *= 1.5;
        }
        this.player.setColor(COLORS.PLAYER.SOLAR_BOOST);
        console.log("Solar Power Boost ACTIVE!");
    }

    deactivateSolarPower() {
        this.hasSolarBoost = false;
        // Remove all solar orbs when solar boost ends
        if (this.collectableManager) {
            this.collectableManager.removeSolarOrbs();
        }
        if (this.gameSpeed) {
            this.gameSpeed.value /= 1.5;
        }
        this.updatePlayerColor();
        console.log("Solar Power Boost DEACTIVATED!");
    }

    activateWindPower(duration = POWER_UP_DURATIONS.WIND_POWER) {
        this.hasWindPower = true;
        this.windPowerTimer = duration;
        this.player.setDoubleJumpAbility(true);
        this.player.setColor(COLORS.PLAYER.WIND_POWER);
        console.log("Wind Power ACTIVE!");
    }

    deactivateWindPower() {
        this.hasWindPower = false;
        this.player.setDoubleJumpAbility(false);
        this.updatePlayerColor();
        console.log("Wind Power DEACTIVATED!");
    }

    activateWaterSlide(duration = POWER_UP_DURATIONS.WATER_SLIDE) {
        console.log("Activating fire-hydrant with duration:", duration);
        this.hasWaterSlide = true;
        this.waterSlideTimer = duration;
        this.createWaterSlidePath();
        this.player.setColor(COLORS.PLAYER.WATER_SLIDE);
        console.log("fire-hydrant ACTIVE!");
    }

    deactivateWaterSlide() {
        this.hasWaterSlide = false;
        this.removeWaterSlidePath();
        this.updatePlayerColor();
        console.log("fire-hydrant DEACTIVATED!");
    }

    createWaterSlidePath() {
        this.removeWaterSlidePath();
        
        if (!this.obstacleManager) {
            console.warn("ObstacleManager not available for water pipe targeting");
            return;
        }
        
        // Create continuous water stream effect across all lanes
        const playerPos = this.player.getPosition();
        const streamLength = 50; // Number of segments per lane
        const streamGeometry = new THREE.BoxGeometry(0.8, 0.2, 2);
        const streamMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x00aaff,
            transparent: true,
            opacity: 0.7,
            emissive: 0x0066cc,
            emissiveIntensity: 0.3
        });
        
        // Create water stream segments across all lanes for continuous clearing
        for (let lane = 0; lane < LANES.COUNT; lane++) {
            for (let i = 0; i < streamLength; i++) {
                const streamSegment = new THREE.Mesh(streamGeometry, streamMaterial);
                streamSegment.position.set(
                    LANES.POSITIONS[lane],
                    0.1,
                    playerPos.z - 10 - (i * 2) // 2 unit spacing between segments
                );
                streamSegment.lane = lane;
                streamSegment.segmentIndex = i;
                this.scene.add(streamSegment);
                this.waterSlideObjects.push(streamSegment);
            }
        }
        
        console.log(`Water pipe streams created for continuous obstacle clearing`);
    }

    removeWaterSlidePath() {
        for (const obj of this.waterSlideObjects) {
            this.scene.remove(obj);
        }
        this.waterSlideObjects = [];
    }

    updatePlayerColor() {
        // Set color based on active power-ups (priority order)
        if (this.isInvincible) {
            this.player.setColor(COLORS.PLAYER.INVINCIBLE);
        } else if (this.isFlying) {
            this.player.setColor(COLORS.PLAYER.FLYING);
        } else if (this.hasSolarBoost) {
            this.player.setColor(COLORS.PLAYER.SOLAR_BOOST);
        } else if (this.hasWindPower) {
            this.player.setColor(COLORS.PLAYER.WIND_POWER);
        } else if (this.hasWaterSlide) {
            this.player.setColor(COLORS.PLAYER.WATER_SLIDE);
        } else {
            this.player.resetToNormalColor();
        }
    }

    updateTimers(deltaTime) {
        // Update invincibility
        if (this.isInvincible) {
            this.invincibilityTimer -= deltaTime;
            if (this.invincibilityTimer <= 0) {
                this.deactivateInvincibility();
            }
        }
        
        // Update helicopter
        if (this.isFlying) {
            this.flyingTimer -= deltaTime;
            if (this.flyingTimer <= 0) {
                this.deactivateHelicopter();
            }
        }
        
        // Update solar boost
        if (this.hasSolarBoost) {
            this.solarBoostTimer -= deltaTime;
            if (this.solarBoostTimer <= 0) {
                this.deactivateSolarPower();
            }
        }
        
        // Update wind power
        if (this.hasWindPower) {
            this.windPowerTimer -= deltaTime;
            if (this.windPowerTimer <= 0) {
                this.deactivateWindPower();
            }
        }
        
        // Update water slide
        if (this.hasWaterSlide) {
            this.waterSlideTimer -= deltaTime;
            if (this.waterSlideTimer <= 0) {
                this.deactivateWaterSlide();
            }
        }
    }

    updateWaterSlidePosition(gameSpeed) {
        if (this.hasWaterSlide) {
            // Keep water streams positioned relative to player, not moving with game speed
            const playerPos = this.player.getPosition();
            
            // Update water stream positions to stay ahead of player
            let streamIndex = 0;
            for (let lane = 0; lane < LANES.COUNT; lane++) {
                for (let i = 0; i < 50; i++) { // 50 segments per lane
                    if (streamIndex < this.waterSlideObjects.length) {
                        const streamSegment = this.waterSlideObjects[streamIndex];
                        // Keep streams positioned ahead of player
                        streamSegment.position.z = playerPos.z - 10 - (i * 2);
                        streamIndex++;
                    }
                }
            }
            
            // Continuously check for and clear obstacles
            this.clearObstaclesInWaterPath();
        }
    }

    clearObstaclesInWaterPath() {
        if (!this.obstacleManager) return;
        
        const obstacles = this.obstacleManager.getObstacles();
        const playerPos = this.player.getPosition();
        
        // Check all obstacles within the water stream range
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obstacle = obstacles[i];
            const obstaclePos = obstacle.mesh.position;
            
            // Check if obstacle is within the water stream area (ahead of player)
            const isInRange = obstaclePos.z < playerPos.z + 5 && obstaclePos.z > playerPos.z - 150;
            
            if (isInRange && !obstacle.beingPushed) {
                // Mark obstacle as being pushed and start animation
                obstacle.beingPushed = true;
                obstacle.originalX = obstaclePos.x;
                obstacle.pushStartTime = Date.now();
                obstacle.pushDirection = Math.random() > 0.5 ? 1 : -1; // Randomly push left or right
                
                // Create water splash effect when flood hits obstacle
                this.createFloodHitEffect(obstaclePos);
                
                // Add to pushed obstacles list for animation
                this.pushedObstacles.push(obstacle);
                
                console.log(`Obstacle being swept away by flood at lane: ${obstaclePos.x}, direction: ${obstacle.pushDirection > 0 ? 'right' : 'left'}`);
            }
        }
        
        // Update pushed obstacles animation
        this.updatePushedObstacles();
    }

    updatePushedObstacles() {
        const obstacles = this.obstacleManager.getObstacles();
        
        for (let i = this.pushedObstacles.length - 1; i >= 0; i--) {
            const obstacle = this.pushedObstacles[i];
            const currentTime = Date.now();
            const pushDuration = currentTime - obstacle.pushStartTime;
            const maxPushDuration = 2000; // 2 seconds to push obstacle off screen
            
            if (pushDuration < maxPushDuration) {
                // Calculate push progress (0 to 1)
                const progress = pushDuration / maxPushDuration;
                const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease-out cubic for realistic physics
                
                // Push obstacle horizontally off the track
                const pushDistance = 15; // Total distance to push
                const newX = obstacle.originalX + (obstacle.pushDirection * pushDistance * easeProgress);
                obstacle.mesh.position.x = newX;
                
                // Add slight rotation for realism
                obstacle.mesh.rotation.y = obstacle.pushDirection * easeProgress * Math.PI * 0.3;
                obstacle.mesh.rotation.z = obstacle.pushDirection * easeProgress * Math.PI * 0.1;
                
                // Scale down slightly as it gets pushed away
                const scale = 1 - (easeProgress * 0.2);
                obstacle.mesh.scale.setScalar(scale);
            } else {
                // Animation complete - remove obstacle
                this.scene.remove(obstacle.mesh);
                
                // Remove from obstacles array
                const obstacleIndex = obstacles.findIndex(obs => obs === obstacle);
                if (obstacleIndex !== -1) {
                    obstacles.splice(obstacleIndex, 1);
                }
                
                // Remove from pushed obstacles
                this.pushedObstacles.splice(i, 1);
                
                console.log(`Obstacle completely swept away by flood`);
            }
        }
    }

    createWaterSplashEffect(position) {
        // Create multiple dramatic water splash effects
        const effects = [];
        
        // Main large splash
        const mainSplashGeometry = new THREE.SphereGeometry(1.5, 16, 12);
        const mainSplashMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x00ccff,
            transparent: true,
            opacity: 0.9,
            emissive: 0x0099cc,
            emissiveIntensity: 0.5
        });
        
        const mainSplash = new THREE.Mesh(mainSplashGeometry, mainSplashMaterial);
        mainSplash.position.copy(position);
        mainSplash.position.y += 1;
        this.scene.add(mainSplash);
        effects.push(mainSplash);
        
        // Create particle-like smaller splashes around the main one
        for (let i = 0; i < 8; i++) {
            const particleSplashGeometry = new THREE.SphereGeometry(0.3, 8, 6);
            const particleSplashMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x66ddff,
                transparent: true,
                opacity: 0.8,
                emissive: 0x0066cc,
                emissiveIntensity: 0.4
            });
            
            const particleSplash = new THREE.Mesh(particleSplashGeometry, particleSplashMaterial);
            particleSplash.position.copy(position);
            particleSplash.position.x += (Math.random() - 0.5) * 3;
            particleSplash.position.y += Math.random() * 2 + 0.5;
            particleSplash.position.z += (Math.random() - 0.5) * 3;
            this.scene.add(particleSplash);
            effects.push(particleSplash);
        }
        
        // Create water burst ring effect
        const ringGeometry = new THREE.RingGeometry(0.5, 2, 16);
        const ringMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x00aaff,
            transparent: true,
            opacity: 0.7,
            emissive: 0x0088cc,
            emissiveIntensity: 0.3,
            side: THREE.DoubleSide
        });
        
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.copy(position);
        ring.position.y += 0.1;
        ring.rotation.x = -Math.PI / 2;
        this.scene.add(ring);
        effects.push(ring);
        
        // Animate all effects with dramatic scaling and fading
        let splashTime = 0;
        const animateSplash = () => {
            splashTime += 0.08;
            
            // Animate main splash - expand and fade
            mainSplash.scale.setScalar(1 + splashTime * 2);
            mainSplash.material.opacity = Math.max(0, 0.9 - splashTime);
            
            // Animate particle splashes - random movement and scaling
            for (let i = 1; i < effects.length - 1; i++) {
                const particle = effects[i];
                particle.scale.setScalar(1 + splashTime * 1.5);
                particle.material.opacity = Math.max(0, 0.8 - splashTime);
                particle.position.y += 0.1; // Rise up
            }
            
            // Animate ring - expand outward
            const ring = effects[effects.length - 1];
            ring.scale.setScalar(1 + splashTime * 3);
            ring.material.opacity = Math.max(0, 0.7 - splashTime);
            
            if (splashTime < 1.2) {
                requestAnimationFrame(animateSplash);
            } else {
                // Remove all effects after animation
                effects.forEach(effect => this.scene.remove(effect));
            }
        };
        animateSplash();
    }

    createFloodHitEffect(position) {
        // Create initial impact splash when flood hits obstacle
        const impactSplashGeometry = new THREE.SphereGeometry(0.8, 12, 8);
        const impactSplashMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x0099ff,
            transparent: true,
            opacity: 0.9,
            emissive: 0x0066cc,
            emissiveIntensity: 0.6
        });
        
        const impactSplash = new THREE.Mesh(impactSplashGeometry, impactSplashMaterial);
        impactSplash.position.copy(position);
        impactSplash.position.y += 0.5;
        this.scene.add(impactSplash);
        
        // Create water spray particles
        const sprayParticles = [];
        for (let i = 0; i < 12; i++) {
            const sprayGeometry = new THREE.SphereGeometry(0.15, 6, 4);
            const sprayMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x66ccff,
                transparent: true,
                opacity: 0.8,
                emissive: 0x0044aa,
                emissiveIntensity: 0.4
            });
            
            const spray = new THREE.Mesh(sprayGeometry, sprayMaterial);
            spray.position.copy(position);
            spray.position.y += 0.3;
            
            // Random spray direction (outward from impact point)
            const angle = (i / 12) * Math.PI * 2;
            spray.velocity = {
                x: Math.cos(angle) * (2 + Math.random()),
                y: 1 + Math.random() * 2,
                z: Math.sin(angle) * (2 + Math.random())
            };
            
            this.scene.add(spray);
            sprayParticles.push(spray);
        }
        
        // Animate flood impact effect
        let effectTime = 0;
        const animateFloodEffect = () => {
            effectTime += 0.06;
            
            // Animate main impact splash
            impactSplash.scale.setScalar(1 + effectTime * 2);
            impactSplash.material.opacity = Math.max(0, 0.9 - effectTime);
            
            // Animate spray particles
            sprayParticles.forEach(spray => {
                spray.position.x += spray.velocity.x * 0.1;
                spray.position.y += spray.velocity.y * 0.1;
                spray.position.z += spray.velocity.z * 0.1;
                
                // Apply gravity
                spray.velocity.y -= 0.15;
                
                // Fade out
                spray.material.opacity = Math.max(0, 0.8 - effectTime);
                spray.scale.setScalar(Math.max(0.1, 1 - effectTime * 0.5));
            });
            
            if (effectTime < 1.5) {
                requestAnimationFrame(animateFloodEffect);
            } else {
                // Clean up effects
                this.scene.remove(impactSplash);
                sprayParticles.forEach(spray => this.scene.remove(spray));
            }
        };
        animateFloodEffect();
    }

    // Getters for game logic
    getInvincibilityStatus() {
        return this.isInvincible;
    }

    getFlyingStatus() {
        return this.isFlying;
    }

    getSolarBoostStatus() {
        return this.hasSolarBoost;
    }

    getWaterSlideStatus() {
        return this.hasWaterSlide;
    }

    getWaterSlideObjects() {
        return this.waterSlideObjects;
    }

    getActiveTimers() {
        return {
            invincibility: this.isInvincible ? this.invincibilityTimer : 0,
            flying: this.isFlying ? this.flyingTimer : 0,
            solarBoost: this.hasSolarBoost ? this.solarBoostTimer : 0,
            windPower: this.hasWindPower ? this.windPowerTimer : 0,
            waterSlide: this.hasWaterSlide ? this.waterSlideTimer : 0
        };
    }

    reset() {
        // Reset all power-up states
        this.isInvincible = false;
        this.invincibilityTimer = 0;
        this.isFlying = false;
        this.flyingTimer = 0;
        this.hasSolarBoost = false;
        this.solarBoostTimer = 0;
        this.hasWindPower = false;
        this.windPowerTimer = 0;
        this.hasWaterSlide = false;
        this.waterSlideTimer = 0;
        
        // Clean up water slide
        this.removeWaterSlidePath();
        
        // Clean up pushed obstacles
        this.pushedObstacles = [];
        
        // Reset player abilities and color
        this.player.setDoubleJumpAbility(false);
        this.player.resetToNormalColor();
    }
}