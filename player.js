import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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
        this.mixer = null; // Animation mixer
        this.animations = {}; // Store animations
        this.clock = new THREE.Clock(); // Clock for animation updates
    }

    async initialize() {
        return new Promise((resolve, reject) => {
            this.createPlayer(resolve, reject);
        });
    }

    createPlayer(resolve, reject) {
        const loader = new GLTFLoader();
        loader.load(
            'assets/models/low-poly_construction_workers_animated.glb',
            (gltf) => {
                this.mesh = gltf.scene;
                this.mesh.scale.set(0.3, 0.3, 0.3); // Reduced player scale, adjust as needed
                // Adjust position so visual model center aligns with collision box center
                // Collision box center will be at GROUND_HEIGHT + (boxHeight * 0.15)
                // We need to offset the model down so its visual center appears at collision box center
                const visualOffset = GAME_CONFIG.PLAYER_VISUAL_OFFSET; // Adjust this value to align model with collision box
                this.mesh.position.set(0, GAME_CONFIG.GROUND_HEIGHT + visualOffset, 0);
                this.mesh.rotation.y = Math.PI; // Rotate to face forward if needed

                this.mesh.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        // If you need to change material color, you might do it here
                        // For example, if the model has a default material you want to override:
                        // child.material = new THREE.MeshStandardMaterial({ color: COLORS.PLAYER.DEFAULT });
                    }
                });

                this.scene.add(this.mesh);

                // Store animations
                gltf.animations.forEach((clip) => {
                    this.animations[clip.name] = clip;
                });

                // Setup animation mixer
                this.mixer = new THREE.AnimationMixer(this.mesh);
                
                // Play a default animation (e.g., 'Idle' or 'Run')
                // You'll need to know the names of the animations in your GLB file
                // For now, let's assume there's an animation named 'Run'
                const runAction = this.mixer.clipAction(this.animations['Run'] || gltf.animations[0]); // Fallback to first animation
                if (runAction) {
                    runAction.play();
                } else {
                    console.warn('Player model loaded, but no "Run" animation found, or no animations present.');
                }
                resolve(); // Resolve the promise on successful load
            },
            undefined, // onProgress callback (optional)
            (error) => {
                console.error('An error happened while loading the player model:', error);
                // Fallback to a simple box if loading fails
                const geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
                const material = new THREE.MeshStandardMaterial({ color: COLORS.PLAYER.DEFAULT });
                this.mesh = new THREE.Mesh(geometry, material);
                const visualOffset = GAME_CONFIG.PLAYER_VISUAL_OFFSET; // Same offset as GLB model
                this.mesh.position.set(0, GAME_CONFIG.GROUND_HEIGHT + visualOffset, 0);
                this.mesh.castShadow = true;
                this.scene.add(this.mesh);
                // Resolve even on fallback to allow the game to proceed
                // For stricter error handling, you might use reject(error) here
                resolve(); 
            }
        );
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
            const visualGroundHeight = GAME_CONFIG.GROUND_HEIGHT + GAME_CONFIG.PLAYER_VISUAL_OFFSET; // Account for visual offset
            if (this.mesh.position.y <= visualGroundHeight) {
                this.mesh.position.y = visualGroundHeight;
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

        // Update animation mixer
        if (this.mixer) {
            this.mixer.update(this.clock.getDelta());
        }
    }

    getCollisionBox() {
        if (!this.mesh) return new THREE.Box3();

        // Create a fixed-size collision box based on the player's position
        // This avoids issues with the GLB model's internal structure and origin
        const playerPos = this.mesh.position;
        
        // Define collision box dimensions (width, height, depth)
        const boxWidth = 0.2;   // Much smaller width to allow precise maneuvering between obstacles
        const boxHeight = 1.0;  // Reasonable height for the player
        const boxDepth = 0.3;   // Slightly reduced depth for better collision precision
        
        // Create collision box that follows the player's Y position during jumps
        // The GLB model is scaled to 0.3 and positioned at ground height
        // We need to adjust for the visual center of the scaled model
        const modelVisualCenter = playerPos.y + (boxHeight * 0.15); // Adjust for 0.3 scale
        
        const playerBox = new THREE.Box3(
            new THREE.Vector3(
                playerPos.x - boxWidth / 2,
                modelVisualCenter - boxHeight / 2,  // Bottom of box (centered on visual model)
                playerPos.z - boxDepth / 2
            ),
            new THREE.Vector3(
                playerPos.x + boxWidth / 2,
                modelVisualCenter + boxHeight / 2,  // Top of box (centered on visual model)
                playerPos.z + boxDepth / 2
            )
        );

        // Optional: Visualize the collision box
        if (GAME_CONFIG.DEBUG_COLLISIONS && this.scene) {
            if (!this.collisionBoxHelper) {
                this.collisionBoxHelper = new THREE.Box3Helper(playerBox, 0xffff00);
                this.scene.add(this.collisionBoxHelper);
            } else {
                this.collisionBoxHelper.box.copy(playerBox);
            }
        }

        return playerBox;
    }

    setColor(color) {
        if (this.mesh && this.mesh.traverse) {
            this.mesh.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (child.material.isMeshStandardMaterial) {
                        child.material.color.set(color);
                    } else {
                        // If not standard material, you might need a different approach
                        // or create a new material with the desired color.
                        // For simplicity, we'll try to set it, but it might not work for all material types.
                        if (child.material.color) {
                            child.material.color.set(color);
                        }
                    }
                }
            });
        }
    }

    resetToNormalColor() {
        this.setColor(COLORS.PLAYER.DEFAULT);
    }

    setDoubleJumpAbility(canDoubleJump) {
        this.canDoubleJump = canDoubleJump;
        if (!canDoubleJump) {
            this.hasDoubleJumped = false;
        }
    }

    reset() {
        this.lane = LANES.CENTER;
        const visualGroundHeight = GAME_CONFIG.GROUND_HEIGHT + GAME_CONFIG.PLAYER_VISUAL_OFFSET; // Account for visual offset
        this.mesh.position.set(LANES.POSITIONS[this.lane], visualGroundHeight, 0);
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
        if (this.mesh) {
            this.mesh.position.set(x, y, z);
        }
    }

    // Call this method to switch animations
    playAnimation(name) {
        if (this.mixer && this.animations[name]) {
            this.mixer.stopAllAction();
            const action = this.mixer.clipAction(this.animations[name]);
            action.play();
        } else {
            console.warn(`Animation "${name}" not found for player.`);
        }
    }
}