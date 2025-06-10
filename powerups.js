import { LANES, COLORS, POWER_UP_DURATIONS, PHYSICS } from './constants.js';

export class PowerUpManager {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        
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
    }

    setGameSpeedReference(gameSpeedRef) {
        this.gameSpeed = gameSpeedRef;
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
        console.log("Activating Helicopter Ride with duration:", duration);
        this.isFlying = true;
        this.flyingTimer = duration;
        this.player.setPosition(
            this.player.getPosition().x,
            PHYSICS.FLYING_HEIGHT,
            this.player.getPosition().z
        );
        this.player.setColor(COLORS.PLAYER.FLYING);
        console.log("Helicopter Ride ACTIVE!");
    }

    deactivateHelicopter() {
        this.isFlying = false;
        // Initiate controlled fall
        this.player.isJumping = true;
        this.player.velocityY = 0;
        this.updatePlayerColor();
        console.log("Helicopter Ride DEACTIVATED!");
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
        console.log("Activating Water Pipeline with duration:", duration);
        this.hasWaterSlide = true;
        this.waterSlideTimer = duration;
        this.createWaterSlidePath();
        this.player.setColor(COLORS.PLAYER.WATER_SLIDE);
        console.log("Water Pipeline ACTIVE!");
    }

    deactivateWaterSlide() {
        this.hasWaterSlide = false;
        this.removeWaterSlidePath();
        this.updatePlayerColor();
        console.log("Water Pipeline DEACTIVATED!");
    }

    createWaterSlidePath() {
        this.removeWaterSlidePath();
        
        const slideLength = 50;
        const slideGeometry = new THREE.BoxGeometry(1, 0.1, 1);
        const slideMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x00aaff,
            transparent: true,
            opacity: 0.7
        });
        
        const slideLane = Math.floor(Math.random() * LANES.COUNT);
        const playerZ = this.player.getPosition().z;
        
        for (let i = 0; i < slideLength; i++) {
            const slideSegment = new THREE.Mesh(slideGeometry, slideMaterial);
            slideSegment.position.set(
                LANES.POSITIONS[slideLane],
                0.05,
                playerZ - 10 - i
            );
            this.scene.add(slideSegment);
            this.waterSlideObjects.push(slideSegment);
        }
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
            for (const obj of this.waterSlideObjects) {
                obj.position.z += gameSpeed;
            }
        }
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
        
        // Reset player abilities and color
        this.player.setDoubleJumpAbility(false);
        this.player.resetToNormalColor();
    }
}