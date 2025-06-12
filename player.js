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
        
        // Simple animation system - running + stumble
        this.mixer = null;
        this.currentAction = null;
        this.stumbleAction = null;
        this.clock = new THREE.Clock();
        
        // Stumble state
        this.isStumbling = false;
        this.stumbleEndTime = 0;
        this.stumbleAnimationDuration = 1500; // Default 1.5 seconds max, will be updated when animation loads
        this.stumbleSpeedMultiplier = 1.0; // Speed multiplier for animation playback
        this.gameOverCallback = null; // Callback to trigger game over after stumble
    }

    async initialize() {
        console.log('Loading player model...');
        await this.createSimplePlayer();
        console.log('Player ready!');
    }

    async createSimplePlayer() {
        // Load running animation first
        await this.loadRunningAnimation();
        // Then load stumble animation
        await this.loadStumbleAnimation();
    }
    
    async loadRunningAnimation() {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            loader.load(
                'assets/models/Running.glb',
                (gltf) => {
                    console.log('Loaded running model');
                    
                    this.mesh = gltf.scene;
                    this.mesh.scale.set(0.8, 0.8, 0.8);
                    this.mesh.rotation.y = Math.PI;
                    this.mesh.visible = true;
                    
                    // Position properly
                    const visualOffset = GAME_CONFIG.PLAYER_VISUAL_OFFSET;
                    this.mesh.position.set(0, GAME_CONFIG.GROUND_HEIGHT + visualOffset, 0);
                    
                    // Setup shadows
                    this.mesh.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                        }
                    });
                    
                    this.scene.add(this.mesh);
                    
                    // Setup running animation
                    if (gltf.animations && gltf.animations.length > 0) {
                        this.mixer = new THREE.AnimationMixer(this.mesh);
                        this.currentAction = this.mixer.clipAction(gltf.animations[0]);
                        this.currentAction.setLoop(THREE.LoopRepeat);
                        this.currentAction.play();
                        console.log('Playing running animation');
                    }
                    
                    console.log('Running model loaded and visible:', this.mesh.visible);
                    resolve();
                },
                undefined,
                (error) => {
                    console.error('Failed to load running model:', error);
                    this.createFallbackPlayer();
                    resolve();
                }
            );
        });
    }
    
    async loadStumbleAnimation() {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            console.log('Attempting to load stumble animation...');
            loader.load(
                'assets/models/Stumble Backwards.glb',
                (gltf) => {
                    console.log('Loaded stumble animation successfully');
                    console.log('GLTF scene:', gltf.scene);
                    console.log('GLTF animations:', gltf.animations);
                    console.log('Main mixer available:', !!this.mixer);
                    
                    // Create stumble animation action if we have a mixer
                    if (this.mixer && gltf.animations && gltf.animations.length > 0) {
                        // Create a separate mesh for stumble animation
                        this.stumbleMesh = gltf.scene;
                        // Use even smaller scale to make stumble character smaller
                        this.stumbleMesh.scale.set(0.008, 0.008, 0.008);
                        this.stumbleMesh.rotation.y = Math.PI;
                        this.stumbleMesh.visible = false; // Hide initially
                        
                        // Position same as running mesh with tiny offset for extremely small model
                        this.stumbleMesh.position.copy(this.mesh.position);
                        this.stumbleMesh.position.y -= 0.015; // Smaller offset for smaller 0.008 scale model
                        
                        console.log('Stumble mesh created, position:', this.stumbleMesh.position);
                        console.log('Stumble mesh scale:', this.stumbleMesh.scale);
                        
                        // Setup shadows
                        this.stumbleMesh.traverse((child) => {
                            if (child.isMesh) {
                                child.castShadow = true;
                            }
                        });
                        
                        this.scene.add(this.stumbleMesh);
                        console.log('Stumble mesh added to scene');
                        
                        // Create stumble mixer and action
                        this.stumbleMixer = new THREE.AnimationMixer(this.stumbleMesh);
                        this.stumbleAction = this.stumbleMixer.clipAction(gltf.animations[0]);
                        this.stumbleAction.setLoop(THREE.LoopOnce);
                        this.stumbleAction.clampWhenFinished = true;
                        
                        // Store the animation duration for proper timing, but cap it at 1.5 seconds max for better game flow
                        const actualDuration = gltf.animations[0].duration * 1000; // Convert to milliseconds
                        this.stumbleAnimationDuration = Math.min(actualDuration, 1500); // Cap at 1.5 seconds maximum
                        
                        // Calculate speed multiplier to fit animation in shorter time if needed
                        this.stumbleSpeedMultiplier = actualDuration / this.stumbleAnimationDuration;
                        
                        console.log('Stumble animation ready - Action created:', !!this.stumbleAction);
                        console.log('Animation name:', gltf.animations[0].name);
                        console.log('Animation duration:', gltf.animations[0].duration);
                        console.log('Stumble duration will be:', this.stumbleAnimationDuration, 'ms');
                    } else {
                        console.log('Could not setup stumble animation - missing requirements:');
                        console.log('- Mixer available:', !!this.mixer);
                        console.log('- Animations available:', gltf.animations ? gltf.animations.length : 0);
                    }
                    
                    resolve();
                },
                undefined,
                (error) => {
                    console.error('Failed to load stumble animation:', error);
                    // Continue without stumble animation
                    resolve();
                }
            );
        });
    }

    createFallbackPlayer() {
        console.log('Creating fallback player');
        const geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
        const material = new THREE.MeshStandardMaterial({ color: COLORS.PLAYER.DEFAULT });
        this.mesh = new THREE.Mesh(geometry, material);
        
        const visualOffset = GAME_CONFIG.PLAYER_VISUAL_OFFSET;
        this.mesh.position.set(0, GAME_CONFIG.GROUND_HEIGHT + visualOffset, 0);
        this.mesh.castShadow = true;
        this.mesh.visible = true;
        
        this.scene.add(this.mesh);
        console.log('Fallback player created and visible:', this.mesh.visible);
    }

    // Method to trigger stumble animation when hitting obstacles
    triggerStumble(gameOverCallback = null) {
        console.log('triggerStumble called - stumbleAction available:', !!this.stumbleAction);
        console.log('stumbleMesh available:', !!this.stumbleMesh);
        
        if (!this.stumbleAction || !this.stumbleMesh) {
            console.log('No stumble animation or mesh available');
            return false; // Return false to indicate we should do game over instead
        }
        
        // Store the game over callback for when stumble ends
        this.gameOverCallback = gameOverCallback;
        
        console.log('Player stumbled!');
        this.isStumbling = true;
        this.stumbleEndTime = Date.now() + this.stumbleAnimationDuration; // Use actual animation duration
        console.log(`Stumble will last for ${this.stumbleAnimationDuration}ms`);
        
        // Sync positions before switching (with tiny stumble offset)
        this.stumbleMesh.position.copy(this.mesh.position);
        this.stumbleMesh.position.y -= 0.015; // Apply smaller stumble-specific offset
        
        // Hide running mesh and show stumble mesh
        this.mesh.visible = false;
        this.stumbleMesh.visible = true;
        
        console.log('Switched to stumble mesh - visible:', this.stumbleMesh.visible);
        console.log('Running mesh visible:', this.mesh.visible);
        console.log('Stumble mesh position:', this.stumbleMesh.position);
        
        // Start stumble animation with explicit configuration
        this.stumbleAction.reset();
        this.stumbleAction.time = 0; // Start from beginning
        this.stumbleAction.enabled = true;
        this.stumbleAction.setEffectiveWeight(1.0);
        // Speed up animation if needed to fit in shorter duration
        const timeScale = this.stumbleSpeedMultiplier || 1.0;
        this.stumbleAction.setEffectiveTimeScale(timeScale);
        this.stumbleAction.play();
        
        console.log('Animation speed multiplier:', timeScale);
        
        // Force the mixer to update immediately
        this.stumbleMixer.update(0);
        
        // Debug animation state
        console.log('Stumble action playing:', this.stumbleAction.isRunning());
        console.log('Stumble action enabled:', this.stumbleAction.enabled);
        console.log('Stumble action weight:', this.stumbleAction.getEffectiveWeight());
        console.log('Stumble action time:', this.stumbleAction.time);
        
        // Pause/stop running animation completely
        if (this.currentAction) {
            this.currentAction.stop();
            console.log('Stopped running animation');
        }
        if (this.mixer) {
            this.mixer.stopAllAction();
            console.log('Stopped all actions on main mixer');
        }
        
        return true; // Return true to indicate stumble was triggered
    }
    
    // Method to end stumble and trigger game over
    endStumble() {
        console.log('Stumble animation completed - triggering game over');
        this.isStumbling = false;
        
        // Stop stumble animation
        if (this.stumbleAction) {
            this.stumbleAction.stop();
            console.log('Stopped stumble animation');
        }
        
        // Hide stumble mesh
        if (this.stumbleMesh) {
            this.stumbleMesh.visible = false;
        }
        
        // Trigger game over through callback
        if (this.gameOverCallback) {
            console.log('Calling game over callback');
            this.gameOverCallback();
            this.gameOverCallback = null; // Clear the callback
        } else {
            console.log('No game over callback available');
        }
        
        console.log('Game over should be triggered');
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
        console.log('Jump called, isJumping:', this.isJumping);
        // Regular jump if not jumping
        if (!this.isJumping) {
            this.isJumping = true;
            this.velocityY = GAME_CONFIG.INITIAL_JUMP_VELOCITY;
            this.hasDoubleJumped = false;
            console.log('Started jumping with velocity:', this.velocityY);
        } 
        // Double jump if Wind Power is active and we haven't used double jump yet
        else if (this.canDoubleJump && !this.hasDoubleJumped) {
            this.velocityY = GAME_CONFIG.DOUBLE_JUMP_VELOCITY;
            this.hasDoubleJumped = true;
            this.createJumpEffect();
            console.log('Double jump activated');
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

    updatePosition(isFlying, waterSlideObjects, gameSpeed) {
        if (!this.mesh) return;
        
        // Check if stumble should end
        if (this.isStumbling && Date.now() > this.stumbleEndTime) {
            this.endStumble();
        }
        
        // If stumbling, only update animation mixers and exit - no movement allowed
        if (this.isStumbling) {
            // Update animation mixers
            const deltaTime = this.clock.getDelta();
            if (this.mixer) {
                this.mixer.update(deltaTime);
            }
            if (this.stumbleMixer) {
                this.stumbleMixer.update(deltaTime);
                
                // Debug stumble animation during playback
                if (this.stumbleAction) {
                    console.log('Stumble animation time:', this.stumbleAction.time.toFixed(2), '/', this.stumbleAnimationDuration/1000);
                    console.log('Stumble action still running:', this.stumbleAction.isRunning());
                }
            }
            return; // Exit early - no other movement during stumble
        }
        
        const targetX = LANES.POSITIONS[this.lane];
        
        // Update both running and stumble mesh positions
        this.mesh.position.x += (targetX - this.mesh.position.x) * GAME_CONFIG.LANE_SWITCH_SPEED;
        if (this.stumbleMesh) {
            this.stumbleMesh.position.x = this.mesh.position.x; // Keep X in sync
            this.stumbleMesh.position.y = this.mesh.position.y - 0.015; // Maintain smaller stumble Y offset
            this.stumbleMesh.position.z = this.mesh.position.z; // Keep Z in sync
        }

        // Handle helicopter flying power-up
        if (isFlying) {
            const flyHeight = PHYSICS.FLYING_HEIGHT;
            this.mesh.position.y += (flyHeight - this.mesh.position.y) * 0.1;
            if (this.stumbleMesh) {
                this.stumbleMesh.position.y = this.mesh.position.y - 0.015; // Maintain smaller stumble Y offset
            }
        }
        // Handle normal jumping or falling (but not while stumbling)
        else if (this.isJumping && !this.isStumbling) {
            this.mesh.position.y += this.velocityY;
            if (this.stumbleMesh) {
                this.stumbleMesh.position.y = this.mesh.position.y - 0.015; // Maintain smaller stumble Y offset
            }
            this.velocityY += GAME_CONFIG.GRAVITY;
            
            const visualGroundHeight = GAME_CONFIG.GROUND_HEIGHT + GAME_CONFIG.PLAYER_VISUAL_OFFSET;
            console.log('Jump - Y position:', this.mesh.position.y.toFixed(2), 'Ground height:', visualGroundHeight.toFixed(2), 'Velocity:', this.velocityY.toFixed(3));
            
            if (this.mesh.position.y <= visualGroundHeight) {
                this.mesh.position.y = visualGroundHeight;
                if (this.stumbleMesh) {
                    this.stumbleMesh.position.y = visualGroundHeight - 0.015; // Maintain smaller stumble Y offset
                }
                this.isJumping = false;
                this.velocityY = 0;
                this.hasDoubleJumped = false;
                console.log('Landing complete');
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
                    if (this.stumbleMesh) {
                        this.stumbleMesh.position.x = this.mesh.position.x; // Keep X in sync only
                    }
                }
            }
        }

        // Update animation mixers
        const deltaTime = this.clock.getDelta();
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }
        // Note: stumbleMixer is only updated during stumble (handled above)
    }

    getCollisionBox() {
        if (!this.mesh) return new THREE.Box3();

        // Use the position of the currently visible mesh
        const activeMesh = this.isStumbling && this.stumbleMesh ? this.stumbleMesh : this.mesh;
        const playerPos = activeMesh.position;
        
        // Debug logging for collision box
        if (this.isStumbling) {
            console.log('Using stumble mesh for collision box, position:', playerPos);
        }
        
        const boxWidth = 0.2;
        const boxHeight = 1.0;
        const boxDepth = 0.3;
        
        const modelVisualCenter = playerPos.y + (boxHeight * 0.15);
        
        const playerBox = new THREE.Box3(
            new THREE.Vector3(
                playerPos.x - boxWidth / 2,
                modelVisualCenter - boxHeight / 2,
                playerPos.z - boxDepth / 2
            ),
            new THREE.Vector3(
                playerPos.x + boxWidth / 2,
                modelVisualCenter + boxHeight / 2,
                playerPos.z + boxDepth / 2
            )
        );

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
        const visualGroundHeight = GAME_CONFIG.GROUND_HEIGHT + GAME_CONFIG.PLAYER_VISUAL_OFFSET;
        
        if (this.mesh) {
            this.mesh.position.set(LANES.POSITIONS[this.lane], visualGroundHeight, 0);
            this.mesh.visible = true; // Make sure running mesh is visible
        }
        
        if (this.stumbleMesh) {
            this.stumbleMesh.position.set(LANES.POSITIONS[this.lane], visualGroundHeight - 0.015, 0); // Apply smaller stumble offset
            this.stumbleMesh.visible = false; // Hide stumble mesh
        }
        
        this.isJumping = false;
        this.velocityY = 0;
        this.hasDoubleJumped = false;
        this.canDoubleJump = false;
        this.isStumbling = false; // Reset stumble state
        this.gameOverCallback = null; // Clear any pending callback
        this.resetToNormalColor();
        
        // Resume running animation if it was paused
        if (this.currentAction) {
            this.currentAction.paused = false;
        }
    }

    getPosition() {
        return this.mesh ? this.mesh.position : new THREE.Vector3();
    }

    setPosition(x, y, z) {
        if (this.mesh) {
            this.mesh.position.set(x, y, z);
        }
    }

    // For compatibility
    adjustAnimationSpeed(gameSpeed) {
        // Can be used later for animation speed scaling
    }

    playAnimation(name) {
        // Can be used later for animation switching
    }
    
    // DEBUG: Method to manually test stumble animation
    testStumble() {
        console.log('=== MANUAL STUMBLE TEST ===');
        this.triggerStumble();
    }
    
    // DEBUG: Method to check animation state
    checkAnimationState() {
        console.log('=== ANIMATION STATE CHECK ===');
        console.log('Is stumbling:', this.isStumbling);
        console.log('Stumble mesh visible:', this.stumbleMesh ? this.stumbleMesh.visible : 'N/A');
        console.log('Running mesh visible:', this.mesh ? this.mesh.visible : 'N/A');
        
        if (this.stumbleAction) {
            console.log('Stumble action exists:', true);
            console.log('Stumble action running:', this.stumbleAction.isRunning());
            console.log('Stumble action enabled:', this.stumbleAction.enabled);
            console.log('Stumble action time:', this.stumbleAction.time);
            console.log('Stumble action weight:', this.stumbleAction.getEffectiveWeight());
        } else {
            console.log('Stumble action exists:', false);
        }
        
        if (this.stumbleMixer) {
            console.log('Stumble mixer exists:', true);
        } else {
            console.log('Stumble mixer exists:', false);
        }
    }
    
    // Method to adjust stumble animation settings
    adjustStumbleSettings(scale, yOffset) {
        if (this.stumbleMesh) {
            this.stumbleMesh.scale.set(scale, scale, scale);
            console.log(`Updated stumble scale to: ${scale}`);
            console.log(`Updated stumble Y offset to: ${yOffset}`);
            // Update the offset used throughout the code
            // Note: This is a simple version - in production you'd want to store the offset as a property
        }
    }
}
