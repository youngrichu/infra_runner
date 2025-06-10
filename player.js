import { LANES, COLORS, GAME_CONFIG, PHYSICS } from './constants.js';

export class Player {
    constructor(scene) {
        this.scene = scene;
        this.mesh = null;
        this.lane = LANES.CENTER;
        this.isJumping = false;
        this.velocityY = 0;
        this.hasDoubleJumped = false;
        this.canDoubleJump = false;
        
        this.createPlayer();
    }

    createPlayer() {
        const geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
        const material = new THREE.MeshStandardMaterial({ color: COLORS.PLAYER.DEFAULT });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(0, GAME_CONFIG.GROUND_HEIGHT, 0);
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);
    }

    moveLeft() {
        if (this.lane > LANES.LEFT) {
            this.lane--;
        }
    }

    moveRight() {
        if (this.lane < LANES.RIGHT) {
            this.lane++;
        }
    }

    jump() {
        // Regular jump if not jumping
        if (!this.isJumping) {
            this.isJumping = true;
            this.velocityY = GAME_CONFIG.INITIAL_JUMP_VELOCITY;
            this.hasDoubleJumped = false;
        } 
        // Double jump if Wind Power is active and we haven't used double jump yet
        else if (this.canDoubleJump && !this.hasDoubleJumped) {
            this.velocityY = GAME_CONFIG.DOUBLE_JUMP_VELOCITY;
            this.hasDoubleJumped = true;
            this.createJumpEffect();
        }
    }

    createJumpEffect() {
        const particleCount = 10;
        const particles = [];
        
        const particleGeometry = new THREE.SphereGeometry(0.05, 8, 8);
        const particleMaterial = new THREE.MeshStandardMaterial({ 
            color: COLORS.PLAYER.WIND_POWER,
            transparent: true,
            opacity: 0.7
        });
        
        for (let i = 0; i < particleCount; i++) {
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            particle.position.copy(this.mesh.position);
            particle.userData = {
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.1,
                    Math.random() * 0.1,
                    (Math.random() - 0.5) * 0.1
                ),
                life: 30
            };
            this.scene.add(particle);
            particles.push(particle);
        }
        
        const updateParticles = () => {
            let allDead = true;
            
            for (let i = particles.length - 1; i >= 0; i--) {
                const particle = particles[i];
                particle.position.add(particle.userData.velocity);
                particle.userData.life--;
                
                particle.material.opacity = particle.userData.life / 30 * 0.7;
                
                if (particle.userData.life <= 0) {
                    this.scene.remove(particle);
                    particles.splice(i, 1);
                } else {
                    allDead = false;
                }
            }
            
            if (!allDead) {
                requestAnimationFrame(updateParticles);
            }
        };
        
        updateParticles();
    }

    updatePosition(isFlying, waterSlideObjects) {
        const targetX = LANES.POSITIONS[this.lane];
        this.mesh.position.x += (targetX - this.mesh.position.x) * GAME_CONFIG.LANE_SWITCH_SPEED;

        // Handle helicopter flying power-up
        if (isFlying) {
            const flyHeight = PHYSICS.FLYING_HEIGHT;
            this.mesh.position.y += (flyHeight - this.mesh.position.y) * 0.1;
        }
        // Handle normal jumping or falling
        else if (this.isJumping) {
            this.mesh.position.y += this.velocityY;
            this.velocityY += GAME_CONFIG.GRAVITY;
            if (this.mesh.position.y <= GAME_CONFIG.GROUND_HEIGHT) {
                this.mesh.position.y = GAME_CONFIG.GROUND_HEIGHT;
                this.isJumping = false;
                this.velocityY = 0;
                this.hasDoubleJumped = false;
            }
        }
        
        // Water slide guidance
        if (waterSlideObjects && waterSlideObjects.length > 0) {
            const slideSegment = waterSlideObjects[0];
            if (slideSegment) {
                let closestLane = 0;
                let minDistance = Math.abs(LANES.POSITIONS[0] - slideSegment.position.x);
                
                for (let i = 1; i < LANES.POSITIONS.length; i++) {
                    const distance = Math.abs(LANES.POSITIONS[i] - slideSegment.position.x);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestLane = i;
                    }
                }
                
                if (this.lane !== closestLane) {
                    this.mesh.position.x += (LANES.POSITIONS[closestLane] - this.mesh.position.x) * 0.05;
                }
            }
        }
    }

    getCollisionBox() {
        const playerBox = new THREE.Box3().setFromObject(this.mesh);
        const shrinkAmount = PHYSICS.COLLISION_SHRINK;
        playerBox.min.x += shrinkAmount;
        playerBox.max.x -= shrinkAmount;
        playerBox.min.z += shrinkAmount;
        playerBox.max.z -= shrinkAmount;
        return playerBox;
    }

    setColor(color) {
        this.mesh.material.color.set(color);
    }

    resetToNormalColor() {
        this.mesh.material.color.set(COLORS.PLAYER.DEFAULT);
    }

    setDoubleJumpAbility(canDoubleJump) {
        this.canDoubleJump = canDoubleJump;
        if (!canDoubleJump) {
            this.hasDoubleJumped = false;
        }
    }

    reset() {
        this.lane = LANES.CENTER;
        this.mesh.position.set(LANES.POSITIONS[this.lane], GAME_CONFIG.GROUND_HEIGHT, 0);
        this.isJumping = false;
        this.velocityY = 0;
        this.hasDoubleJumped = false;
        this.canDoubleJump = false;
        this.resetToNormalColor();
    }

    getPosition() {
        return this.mesh.position;
    }

    setPosition(x, y, z) {
        this.mesh.position.set(x, y, z);
    }
}