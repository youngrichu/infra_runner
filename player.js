import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
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
        
        // Sliding state
        this.isSliding = false;
        this.slideStartTime = 0;
        this.slideDuration = 800; // 0.8 seconds
        
        // Animation system - running + flying + stumble + sliding
        this.mixer = null;
        this.currentAction = null;
        this.stumbleAction = null;
        this.stumbleMesh = null;
        this.stumbleMixer = null;
        this.flyingAction = null;
        this.flyingMesh = null;
        this.flyingMixer = null;
        this.slidingAction = null;
        this.slidingMesh = null;
        this.slidingMixer = null;
        this.clock = new THREE.Clock();
        
        // Flying state
        this.isFlying = false;
        this.flyingHoverOffset = 0; // For subtle hovering motion
        this.flyingTime = 0; // Track time spent flying
        
        // Stumble state
        this.isStumbling = false;
        this.stumbleEndTime = 0;
        this.stumbleAnimationDuration = 1500; // Default 1.5 seconds max, will be updated when animation loads
        this.stumbleSpeedMultiplier = 1.0; // Speed multiplier for animation playback
        this.gameOverCallback = null; // Callback to trigger game over after stumble
        
        // Ready state (for countdown)
        this.isReady = false;
        this.readyAnimationTime = 0;
    }

    async initialize() {
        await this.createSimplePlayer();
    }

    async createSimplePlayer() {
        // Load running animation first
        await this.loadRunningAnimation();
        // Then load flying animation
        await this.loadFlyingAnimation();
        // Load stumble animation
        await this.loadStumbleAnimation();
        // Finally load sliding animation
        await this.loadSlidingAnimation();
    }
    
    async loadRunningAnimation() {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            
            // Setup DRACO loader for compressed GLB files
            const dracoLoader = new DRACOLoader();
            dracoLoader.setDecoderPath('/draco/gltf/');
            loader.setDRACOLoader(dracoLoader);
            
            loader.load(
                '/assets/models/Running.glb',
                (gltf) => {
                    
                    this.mesh = gltf.scene;
                    this.mesh.scale.set(0.8, 0.8, 0.8);
                    this.mesh.rotation.y = Math.PI;
                    this.mesh.visible = true;
                    
                    // Position properly
                    const visualOffset = GAME_CONFIG.PLAYER_VISUAL_OFFSET;
                    this.mesh.position.set(0, GAME_CONFIG.GROUND_HEIGHT + visualOffset, 0);
                    
                    // Setup shadows consistently
                    this.mesh.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                    
                    this.scene.add(this.mesh);
                    
                    // Setup running animation
                    if (gltf.animations && gltf.animations.length > 0) {
                        this.mixer = new THREE.AnimationMixer(this.mesh);
                        this.currentAction = this.mixer.clipAction(gltf.animations[0]);
                        this.currentAction.setLoop(THREE.LoopRepeat);
                        this.currentAction.play();
                    }
                    
                    resolve();
                },
                undefined,
                (error) => {
                    this.createFallbackPlayer();
                    resolve();
                }
            );
        });
    }
    
    async loadSlidingAnimation() {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            
            // Setup DRACO loader for compressed GLB files
            const dracoLoader = new DRACOLoader();
            dracoLoader.setDecoderPath('/draco/gltf/');
            loader.setDRACOLoader(dracoLoader);
            
            console.log('Loading sliding animation from: /assets/models/Running-Slide.glb');
            
            loader.load(
                '/assets/models/Running-Slide.glb',
                (gltf) => {
                    console.log('Sliding animation loaded successfully:', gltf);
                    
                    // Create sliding mesh with appropriate scale
                    this.slidingMesh = gltf.scene;
                    this.slidingMesh.scale.set(0.8, 0.8, 0.8); // Match running mesh scale
                    this.slidingMesh.rotation.y = Math.PI;
                    this.slidingMesh.visible = false; // Hide initially
                    
                    // Position same as running mesh
                    const visualOffset = GAME_CONFIG.PLAYER_VISUAL_OFFSET;
                    this.slidingMesh.position.set(0, GAME_CONFIG.GROUND_HEIGHT + visualOffset, 0);
                    
                    // Store reference to running character materials for copying
                    this.runningMaterials = [];
                    if (this.mesh) {
                        this.mesh.traverse((child) => {
                            if (child.isMesh && child.material) {
                                this.runningMaterials.push(child.material);
                            }
                        });
                    }
                    
                    // Setup shadows and lighting to match running character
                    let materialIndex = 0;
                    this.slidingMesh.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            
                            // Copy material from running character if available
                            if (this.runningMaterials[materialIndex] && child.material) {
                                const runningMaterial = this.runningMaterials[materialIndex];
                                
                                // Clone the running character's material
                                child.material = runningMaterial.clone();
                                child.material.needsUpdate = true;
                            }
                            materialIndex++;
                        }
                    });
                    
                    this.scene.add(this.slidingMesh);
                    console.log('Sliding mesh added to scene');
                    console.log('Sliding mesh details:', {
                        position: this.slidingMesh.position,
                        scale: this.slidingMesh.scale,
                        rotation: this.slidingMesh.rotation,
                        visible: this.slidingMesh.visible,
                        children: this.slidingMesh.children.length
                    });
                    
                    // Setup sliding animation
                    if (gltf.animations && gltf.animations.length > 0) {
                        this.slidingMixer = new THREE.AnimationMixer(this.slidingMesh);
                        this.slidingAction = this.slidingMixer.clipAction(gltf.animations[0]);
                        this.slidingAction.setLoop(THREE.LoopRepeat);
                        console.log('Sliding animation setup complete');
                        // Don't play yet - will be triggered when sliding starts
                    } else {
                        console.warn('No animations found in sliding model');
                    }
                    
                    resolve();
                },
                (progress) => {
                    console.log('Loading sliding animation progress:', progress);
                },
                (error) => {
                    console.error('Failed to load sliding animation:', error);
                    resolve(); // Continue without sliding animation
                }
            );
        });
    }
    
    async loadFlyingAnimation() {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            
            // Setup DRACO loader for compressed GLB files
            const dracoLoader = new DRACOLoader();
            dracoLoader.setDecoderPath('/draco/gltf/');
            loader.setDRACOLoader(dracoLoader);
            
            loader.load(
                '/assets/models/Flying.glb',
                (gltf) => {
                    
                    // Create flying mesh
                    this.flyingMesh = gltf.scene;
                    this.flyingMesh.scale.set(0.08, 0.08, 0.08); // Much smaller to prevent parade balloon effect
                    this.flyingMesh.rotation.y = Math.PI;
                    this.flyingMesh.visible = false; // Hide initially
                    
                    // Position same as running mesh
                    const visualOffset = GAME_CONFIG.PLAYER_VISUAL_OFFSET;
                    this.flyingMesh.position.set(0, GAME_CONFIG.GROUND_HEIGHT + visualOffset, 0);
                    
                    // Setup shadows consistently
                    this.flyingMesh.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                    
                    this.scene.add(this.flyingMesh);
                    
                    // Create flying mixer and action for static pose
                    if (gltf.animations && gltf.animations.length > 0) {
                        this.flyingMixer = new THREE.AnimationMixer(this.flyingMesh);
                        this.flyingAction = this.flyingMixer.clipAction(gltf.animations[0]);
                        this.flyingAction.setLoop(THREE.LoopOnce); // Only play once
                        this.flyingAction.clampWhenFinished = true; // Stay at end frame
                    }
                    
                    resolve();
                },
                undefined,
                (error) => {
                    resolve(); // Continue without flying animation
                }
            );
        });
    }
    
    async loadStumbleAnimation() {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            
            // Setup DRACO loader for compressed GLB files
            const dracoLoader = new DRACOLoader();
            dracoLoader.setDecoderPath('/draco/gltf/');
            loader.setDRACOLoader(dracoLoader);
            
            loader.load(
                '/assets/models/Stumble Backwards.glb',
                (gltf) => {
                    
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
                        
                        
                        // Store reference to running character materials for copying
                        this.runningMaterials = [];
                        if (this.mesh) {
                            this.mesh.traverse((child) => {
                                if (child.isMesh && child.material) {
                                    this.runningMaterials.push(child.material);
                                }
                            });
                        }
                        
                        // Setup shadows and lighting to match running character
                        let materialIndex = 0;
                        this.stumbleMesh.traverse((child) => {
                            if (child.isMesh) {
                                child.castShadow = true;
                                child.receiveShadow = true;
                                
                                // Copy material from running character if available
                                if (this.runningMaterials[materialIndex] && child.material) {
                                    const runningMaterial = this.runningMaterials[materialIndex];
                                    
                                    // Clone the running character's material
                                    child.material = runningMaterial.clone();
                                    child.material.needsUpdate = true;
                                    
                                }
                                materialIndex++;
                            }
                        });
                        
                        this.scene.add(this.stumbleMesh);
                        
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
                        
                    } else {
                    }
                    
                    resolve();
                },
                undefined,
                (error) => {
                    // Continue without stumble animation
                    resolve();
                }
            );
        });
    }

    createFallbackPlayer() {
        const geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
        const material = new THREE.MeshStandardMaterial({ color: COLORS.PLAYER.DEFAULT });
        this.mesh = new THREE.Mesh(geometry, material);
        
        const visualOffset = GAME_CONFIG.PLAYER_VISUAL_OFFSET;
        this.mesh.position.set(0, GAME_CONFIG.GROUND_HEIGHT + visualOffset, 0);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.visible = true;
        
        this.scene.add(this.mesh);
    }

    // Method to trigger stumble animation when hitting obstacles
    triggerStumble(gameOverCallback = null) {
        
        if (!this.stumbleAction || !this.stumbleMesh) {
            return false; // Return false to indicate we should do game over instead
        }
        
        // Store the game over callback for when stumble ends
        this.gameOverCallback = gameOverCallback;
        
        this.isStumbling = true;
        this.stumbleEndTime = Date.now() + this.stumbleAnimationDuration; // Use actual animation duration
        
        // Sync positions before switching (with tiny stumble offset)
        this.stumbleMesh.position.copy(this.mesh.position);
        this.stumbleMesh.position.y -= 0.015; // Apply smaller stumble-specific offset
        
        // Hide running mesh and show stumble mesh
        this.mesh.visible = false;
        this.stumbleMesh.visible = true;
        
        
        // Start stumble animation with explicit configuration
        this.stumbleAction.reset();
        this.stumbleAction.time = 0; // Start from beginning
        this.stumbleAction.enabled = true;
        this.stumbleAction.setEffectiveWeight(1.0);
        // Speed up animation if needed to fit in shorter duration
        const timeScale = this.stumbleSpeedMultiplier || 1.0;
        this.stumbleAction.setEffectiveTimeScale(timeScale);
        this.stumbleAction.play();
        
        
        // Force the mixer to update immediately
        this.stumbleMixer.update(0);
        
        // Debug animation state
        
        // Pause/stop running animation completely
        if (this.currentAction) {
            this.currentAction.stop();
        }
        if (this.mixer) {
            this.mixer.stopAllAction();
        }
        
        return true; // Return true to indicate stumble was triggered
    }
    
    // Method to end stumble and trigger game over
    endStumble() {
        this.isStumbling = false;
        
        // Stop stumble animation
        if (this.stumbleAction) {
            this.stumbleAction.stop();
        }
        
        // Hide stumble mesh
        if (this.stumbleMesh) {
            this.stumbleMesh.visible = false;
        }
        
        // Trigger game over through callback
        if (this.gameOverCallback) {
            this.gameOverCallback();
            this.gameOverCallback = null; // Clear the callback
        } else {
        }
        
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
        // Can't jump while sliding
        if (this.isSliding) return;
        
        // Regular jump if not jumping
        if (!this.isJumping) {
            console.log('👍 DEBUG: Regular jump executed');
            this.isJumping = true;
            this.velocityY = GAME_CONFIG.INITIAL_JUMP_VELOCITY;
            this.hasDoubleJumped = false;
        } 
        // Double jump if Wind Power is active and we haven't used double jump yet
        else if (this.canDoubleJump && !this.hasDoubleJumped) {
            console.log(`✨ DEBUG: Double jump executed! (canDoubleJump: ${this.canDoubleJump}, hasDoubleJumped: ${this.hasDoubleJumped})`);
            this.velocityY = GAME_CONFIG.DOUBLE_JUMP_VELOCITY;
            this.hasDoubleJumped = true;
            this.createJumpEffect();
        }
    }
    
    slide() {
        // Can't slide while jumping or already sliding
        if (this.isJumping || this.isSliding) return;
        
        this.isSliding = true;
        this.slideStartTime = Date.now();
        
        // Debug logging
        console.log('Started sliding - slidingMesh:', !!this.slidingMesh, 'slidingAction:', !!this.slidingAction);
        if (this.slidingMesh) {
            console.log('Sliding mesh visible before switch:', this.slidingMesh.visible);
            console.log('Sliding mesh position:', this.slidingMesh.position);
            console.log('Sliding mesh scale:', this.slidingMesh.scale);
            console.log('Running mesh position for comparison:', this.mesh.position);
            
            // Remove temporary test code that was interfering with animation switching
        }
        
        // Immediately switch to sliding animation
        this.updateAnimationState(false);
        
        console.log('Started sliding');
    }
    

    
    // Fallback methods for when sliding model is not available
    startSlideAnimation() {
        if (!this.mesh) return;
        
        // Create sliding pose: crouch down and lean forward
        this.originalScale = this.mesh.scale.clone();
        this.originalRotation = this.mesh.rotation.clone();
        this.originalPosition = this.mesh.position.clone();
        
        // Animate to sliding pose
        this.animateToSlide();
    }
    
    animateToSlide() {
        if (!this.mesh || !this.isSliding) return;
        
        const slideProgress = Math.min((Date.now() - this.slideStartTime) / 200, 1); // 200ms to reach full slide
        
        // Scale down vertically to simulate crouching
        const targetScaleY = 0.6;
        this.mesh.scale.y = THREE.MathUtils.lerp(this.originalScale.y, targetScaleY, slideProgress);
        
        // Lean forward
        const targetRotationX = 0.3; // Lean forward
        this.mesh.rotation.x = THREE.MathUtils.lerp(this.originalRotation.x, targetRotationX, slideProgress);
        
        // Lower the position slightly
        const targetY = this.originalPosition.y - 0.15;
        this.mesh.position.y = THREE.MathUtils.lerp(this.originalPosition.y, targetY, slideProgress);
        
        if (slideProgress < 1) {
            requestAnimationFrame(() => this.animateToSlide());
        }
    }
    
    endSlideAnimation() {
        if (!this.mesh || !this.originalScale) return;
        
        // Animate back to normal pose
        this.animateFromSlide();
    }
    
    animateFromSlide() {
        if (!this.mesh || this.isSliding) return;
        
        const returnDuration = 200; // 200ms to return to normal
        const startTime = Date.now();
        
        const animate = () => {
            if (!this.mesh || this.isSliding) return;
            
            const progress = Math.min((Date.now() - startTime) / returnDuration, 1);
            
            // Return to original scale
            this.mesh.scale.y = THREE.MathUtils.lerp(this.mesh.scale.y, this.originalScale.y, progress);
            
            // Return to original rotation
            this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, this.originalRotation.x, progress);
            
            // Return to original position
            this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, this.originalPosition.y, progress);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Ensure exact original values
                this.mesh.scale.copy(this.originalScale);
                this.mesh.rotation.copy(this.originalRotation);
                this.mesh.position.copy(this.originalPosition);
            }
        };
        
        animate();
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
        
        // Handle ready state animation during countdown
        if (this.isReady) {
            this.updateReadyAnimation();
            return; // Exit early - no movement during ready state
        }
        
        // Check if stumble should end
        if (this.isStumbling && Date.now() > this.stumbleEndTime) {
            this.endStumble();
        }
        
        // Handle sliding state
        if (this.isSliding) {
            const currentTime = Date.now();
            if (currentTime - this.slideStartTime > this.slideDuration) {
                this.isSliding = false;
                // Immediately switch back to running animation
                this.updateAnimationState(isFlying);
                console.log('Ended sliding');
            }
        }
        
        // Handle animation switching based on state
        this.updateAnimationState(isFlying);
        
        // If stumbling, only update animation mixers and exit - no movement allowed
        if (this.isStumbling) {
        // Update animation mixers - only stumble mixer during stumble
            const deltaTime = this.clock.getDelta();
            // Don't update main mixer during stumble to save CPU
            if (this.stumbleMixer) {
                this.stumbleMixer.update(deltaTime);
                
                // Debug stumble animation during playback (commented out for cleaner logs)
                // if (this.stumbleAction) {
                // }
            }
            return; // Exit early - no other movement during stumble
        }
        
        const targetX = LANES.POSITIONS[this.lane];
        const currentX = this.mesh.position.x;
        const distance = targetX - currentX;

        // --- IMPROVED FIX: Better lane switching with multiple safeguards ---
        const absDistance = Math.abs(distance);
        
        if (absDistance < 0.05) {
            // Snap to target if very close
            this.mesh.position.x = targetX;
        } else {
            // Calculate movement for this frame
            const movement = distance * GAME_CONFIG.LANE_SWITCH_SPEED;
            
            // Ensure minimum movement to prevent getting stuck
            const minMovement = 0.02;
            if (absDistance > minMovement && Math.abs(movement) < minMovement) {
                // Force minimum movement in the correct direction
                this.mesh.position.x += Math.sign(distance) * minMovement;
            } else {
                this.mesh.position.x += movement;
            }
            
            // Safety check: if we overshot, snap to target
            const newDistance = targetX - this.mesh.position.x;
            if (Math.sign(distance) !== Math.sign(newDistance)) {
                this.mesh.position.x = targetX;
            }
        }
        
        // Update all mesh positions (running, flying, stumble, sliding)
        if (this.flyingMesh) {
            // Always keep flying mesh in sync with main position, but add floating effect when flying
            this.flyingMesh.position.x = this.mesh.position.x;
            this.flyingMesh.position.z = this.mesh.position.z;
        }
        if (this.stumbleMesh) {
            this.stumbleMesh.position.x = this.mesh.position.x; // Keep X in sync
            this.stumbleMesh.position.y = this.mesh.position.y - 0.015; // Maintain smaller stumble Y offset
            this.stumbleMesh.position.z = this.mesh.position.z; // Keep Z in sync
        }
        if (this.slidingMesh) {
            this.slidingMesh.position.x = this.mesh.position.x; // Keep X in sync
            this.slidingMesh.position.z = this.mesh.position.z; // Keep Z in sync
            // Y position is handled by the sliding animation itself
        }

        // Handle helicopter flying power-up with smooth hovering
        if (isFlying) {
            this.isFlying = true;
            this.flyingTime += 0.016; // Approximate delta time for smooth hovering
            
            const flyHeight = PHYSICS.FLYING_HEIGHT;
            // Create more pronounced hovering motion since animation is static
            const primaryHover = Math.sin(this.flyingTime * 1.2) * 0.25; // More pronounced
            const secondaryHover = Math.sin(this.flyingTime * 2.5) * 0.08; // Subtle secondary
            this.flyingHoverOffset = primaryHover + secondaryHover;
            
            const targetHeight = flyHeight + this.flyingHoverOffset;
            
            this.mesh.position.y += (targetHeight - this.mesh.position.y) * 0.08;
            if (this.flyingMesh) {
                this.flyingMesh.position.y = this.mesh.position.y;
                // Log every 60 frames (about once per second)
                if (Math.floor(this.flyingTime * 60) % 60 === 0) {
                }
            }
            if (this.stumbleMesh) {
                this.stumbleMesh.position.y = this.mesh.position.y - 0.015;
            }
        } else {
            this.isFlying = false;
            this.flyingTime = 0;
            this.flyingHoverOffset = 0;
        }
        // Handle normal jumping or falling (but not while stumbling or flying)
        if (this.isJumping && !this.isStumbling && !isFlying) {
            this.mesh.position.y += this.velocityY;
            if (this.flyingMesh) {
                this.flyingMesh.position.y = this.mesh.position.y;
            }
            if (this.stumbleMesh) {
                this.stumbleMesh.position.y = this.mesh.position.y - 0.015; // Maintain smaller stumble Y offset
            }
            this.velocityY += GAME_CONFIG.GRAVITY;
            
            const visualGroundHeight = GAME_CONFIG.GROUND_HEIGHT + GAME_CONFIG.PLAYER_VISUAL_OFFSET;
            
            if (this.mesh.position.y <= visualGroundHeight) {
                this.mesh.position.y = visualGroundHeight;
                if (this.flyingMesh) {
                    this.flyingMesh.position.y = visualGroundHeight;
                }
                if (this.stumbleMesh) {
                    this.stumbleMesh.position.y = visualGroundHeight - 0.015; // Maintain smaller stumble Y offset
                }
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
                    if (this.flyingMesh) {
                        this.flyingMesh.position.x = this.mesh.position.x;
                    }
                    if (this.stumbleMesh) {
                        this.stumbleMesh.position.x = this.mesh.position.x; // Keep X in sync only
                    }
                }
            }
        }

        // Update animation mixers with performance optimization
        const deltaTime = this.clock.getDelta();
        
        // Only update active mixers to save CPU
        if (this.mixer && this.mesh && this.mesh.visible) {
            this.mixer.update(deltaTime);
        }
        
        // Only update flying mixer when needed
        if (this.flyingMixer && this.isFlying && this.flyingMesh && this.flyingMesh.visible) {
            // For static flying pose, update much less frequently
            if (Math.random() < 0.1) { // Only 10% of frames
                this.flyingMixer.update(0);
            }
        }
        
        // Update sliding mixer when sliding
        if (this.slidingMixer && this.isSliding && this.slidingMesh && this.slidingMesh.visible) {
            this.slidingMixer.update(deltaTime);
        }
        
        // Note: stumbleMixer is only updated during stumble (handled above)
    }

    updateAnimationState(isFlying) {
        // Don't change animations while stumbling
        if (this.isStumbling) return;
        
        // Switch to sliding animation
        if (this.isSliding && this.slidingMesh && this.slidingAction && !this.slidingMesh.visible) {
            
            console.log('Switching to sliding animation - conditions met');
            console.log('Running mesh visible before:', this.mesh.visible);
            
            // Sync position and rotation BEFORE making the mesh visible
            this.slidingMesh.position.copy(this.mesh.position);
            this.slidingMesh.rotation.copy(this.mesh.rotation);
            
            // Hide running mesh, show sliding mesh
            this.mesh.visible = false;
            this.slidingMesh.visible = true;
            
            console.log('After visibility switch - running mesh:', this.mesh.visible, 'sliding mesh:', this.slidingMesh.visible);
            
            // Stop running animation
            if (this.currentAction) {
                this.currentAction.stop();
            }
            
            // Start sliding animation
            this.slidingAction.reset();
            this.slidingAction.enabled = true;
            this.slidingAction.setEffectiveWeight(1.0);
            this.slidingAction.play();
            
            // Force update to apply the animation immediately
            if (this.slidingMixer) {
                this.slidingMixer.update(0);
            }
            
            console.log('Switched to sliding animation');
            
        }
        // Switch back from sliding to running
        else if (!this.isSliding && this.slidingMesh && this.slidingMesh.visible) {
            
            // Sync position and rotation BEFORE making the mesh visible
            this.mesh.position.copy(this.slidingMesh.position);
            this.mesh.rotation.copy(this.slidingMesh.rotation);

            // Hide sliding mesh, show running mesh
            this.slidingMesh.visible = false;
            this.mesh.visible = true;
            
            // Stop sliding animation
            if (this.slidingAction) {
                this.slidingAction.stop();
            }
            
            // Restart running animation
            if (this.currentAction) {
                this.currentAction.reset();
                this.currentAction.enabled = true;
                this.currentAction.setEffectiveWeight(1.0);
                this.currentAction.play();
            }
            
            console.log('Switched back to running animation');
            
        }
        
        // Switch to flying animation
        if (isFlying && this.flyingMesh && this.flyingAction && !this.flyingMesh.visible) {
            
            // --- FIX: Sync position and rotation BEFORE making the mesh visible ---
            this.flyingMesh.position.copy(this.mesh.position);
            this.flyingMesh.rotation.copy(this.mesh.rotation);
            
            // Hide running mesh, show flying mesh
            this.mesh.visible = false;
            this.flyingMesh.visible = true;
            
            // Stop running animation
            if (this.currentAction) {
                this.currentAction.stop();
            }
            
            // Create completely static flying pose - lock to a good frame
            this.flyingAction.reset();
            this.flyingAction.enabled = true;
            this.flyingAction.setEffectiveWeight(1.0);
            
            // Try to find a good flying pose frame (middle of animation)
            const animationDuration = this.flyingAction.getClip().duration;
            const goodPoseTime = animationDuration * 0.3; // 30% through animation
            this.flyingAction.time = goodPoseTime;
            this.flyingAction.setEffectiveTimeScale(0); // Stop animation completely
            this.flyingAction.play();
            
            // Force update to apply the pose
            if (this.flyingMixer) {
                this.flyingMixer.update(0);
            }
            
        }
        // Switch back to running animation
        else if (!isFlying && this.flyingMesh && this.flyingMesh.visible) {
            
            // --- FIX: Sync position and rotation BEFORE making the mesh visible ---
            this.mesh.position.copy(this.flyingMesh.position);
            this.mesh.rotation.copy(this.flyingMesh.rotation);

            // Hide flying mesh, show running mesh
            this.flyingMesh.visible = false;
            this.mesh.visible = true;
            
            // Reset flying animation for next use
            if (this.flyingAction) {
                this.flyingAction.stop();
                this.flyingAction.setEffectiveTimeScale(1.0); // Reset time scale
            }
            
            // Restart running animation
            if (this.currentAction) {
                this.currentAction.reset();
                this.currentAction.enabled = true;
                this.currentAction.setEffectiveWeight(1.0);
                this.currentAction.play();
            }
            
        }
    }

    getCollisionBox() {
        if (!this.mesh) return new THREE.Box3();

        // Use the position of the currently visible mesh
        let activeMesh = this.mesh;
        if (this.isStumbling && this.stumbleMesh && this.stumbleMesh.visible) {
            activeMesh = this.stumbleMesh;
        } else if (this.flyingMesh && this.flyingMesh.visible) {
            activeMesh = this.flyingMesh;
        } else if (this.isSliding && this.slidingMesh && this.slidingMesh.visible) {
            activeMesh = this.slidingMesh;
        }
        const playerPos = activeMesh.position;
        
        // Debug logging for collision box
        if (this.isStumbling) {
        }
        
        // Dynamically adjust collision box width during lane changes
        let boxWidth = 0.2; // Base width
        let boxHeight = 1.0;
        let boxDepth = 0.3;
        
        // Reduce collision box height when sliding
        if (this.isSliding) {
            boxHeight *= 0.4; // Make collision box 60% shorter when sliding
        }
        
        // Shrink collision box width during lane changes
        const targetX = LANES.POSITIONS[this.lane];
        const currentX = this.mesh.position.x;
        const distance = Math.abs(targetX - currentX);
        if (distance > 0.05) { // If we're switching lanes
            boxWidth *= 0.6; // Make collision box 40% narrower during lane changes
        }
        
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
        console.log(`💨 DEBUG: Setting double jump ability to ${canDoubleJump}`);
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
        
        if (this.flyingMesh) {
            this.flyingMesh.position.set(LANES.POSITIONS[this.lane], visualGroundHeight, 0);
            this.flyingMesh.visible = false; // Hide flying mesh
        }
        
        if (this.stumbleMesh) {
            this.stumbleMesh.position.set(LANES.POSITIONS[this.lane], visualGroundHeight - 0.015, 0); // Apply smaller stumble offset
            this.stumbleMesh.visible = false; // Hide stumble mesh
        }
        
        if (this.slidingMesh) {
            this.slidingMesh.position.set(LANES.POSITIONS[this.lane], visualGroundHeight, 0);
            this.slidingMesh.visible = false; // Hide sliding mesh
        }
        
        this.isJumping = false;
        this.velocityY = 0;
        this.hasDoubleJumped = false;
        this.canDoubleJump = false;
        this.isStumbling = false; // Reset stumble state
        this.isFlying = false; // Reset flying state
        this.isSliding = false; // Reset sliding state
        this.flyingTime = 0;
        this.flyingHoverOffset = 0;
        this.gameOverCallback = null; // Clear any pending callback
        this.resetToNormalColor();
        
        // Stop all animations
        if (this.slidingAction) {
            this.slidingAction.stop();
        }
        
        // Reset any sliding animation transformations
        if (this.mesh && this.originalScale) {
            this.mesh.scale.copy(this.originalScale);
            this.mesh.rotation.copy(this.originalRotation);
            this.mesh.position.copy(this.originalPosition);
        }
        
        // Restart running animation properly
        if (this.currentAction) {
            this.currentAction.reset();
            this.currentAction.paused = false;
            this.currentAction.enabled = true;
            this.currentAction.setEffectiveWeight(1.0);
            this.currentAction.play();
        }
    }

    getPosition() {
        // Return the position of the currently active/visible mesh
        if (this.isFlying && this.flyingMesh && this.flyingMesh.visible) {
            return this.flyingMesh.position;
        } else if (this.isStumbling && this.stumbleMesh && this.stumbleMesh.visible) {
            return this.stumbleMesh.position;
        } else if (this.isSliding && this.slidingMesh && this.slidingMesh.visible) {
            return this.slidingMesh.position;
        } else {
            return this.mesh ? this.mesh.position : new THREE.Vector3();
        }
    }

    setPosition(x, y, z) {
        if (this.mesh) {
            this.mesh.position.set(x, y, z);
        }
    }

    // For compatibility
    adjustAnimationSpeed(gameSpeed) {
        // Optimize animation speed based on game speed
        if (this.currentAction && gameSpeed > 0.15) {
            // Speed up animation slightly at high speeds
            this.currentAction.setEffectiveTimeScale(1 + (gameSpeed - 0.15) * 2);
        } else if (this.currentAction) {
            this.currentAction.setEffectiveTimeScale(1);
        }
    }

    playAnimation(name) {
        // Can be used later for animation switching
    }
    
    // DEBUG: Method to manually test stumble animation
    testStumble() {
        this.triggerStumble();
    }
    
    // DEBUG: Method to check animation state
    checkAnimationState() {
        
        if (this.stumbleAction) {
                    } else {
        }
        
        if (this.stumbleMixer) {
        } else {
        }
    }
    
    // Method to adjust stumble animation settings
    adjustStumbleSettings(scale, yOffset) {
        if (this.stumbleMesh) {
            this.stumbleMesh.scale.set(scale, scale, scale);
            // Update the offset used throughout the code
            // Note: This is a simple version - in production you'd want to store the offset as a property
        }
    }
    
    // Ready state methods for countdown
    setReadyState(isReady) {
        this.isReady = isReady;
        this.readyAnimationTime = 0;
        
        if (isReady) {
            // Enter ready pose - character looking focused and ready to run
            this.enterReadyPose();
        } else {
            // Exit ready pose - return to normal running state
            this.exitReadyPose();
        }
    }
    
    enterReadyPose() {
        if (!this.mesh) return;
        
        // Set character to a focused, ready-to-run pose
        // Slightly lean forward and look ahead
        this.mesh.rotation.x = -0.05; // Slight forward lean
        this.mesh.position.y = GAME_CONFIG.GROUND_HEIGHT + GAME_CONFIG.PLAYER_VISUAL_OFFSET + 0.02; // Slight crouch
        
        // Make sure character is visible and properly positioned
        this.mesh.visible = true;
        this.mesh.position.x = LANES.POSITIONS[this.lane];
        
    }
    
    exitReadyPose() {
        if (!this.mesh) return;
        
        // Return to normal position and rotation
        this.mesh.rotation.x = 0;
        this.mesh.position.y = GAME_CONFIG.GROUND_HEIGHT + GAME_CONFIG.PLAYER_VISUAL_OFFSET;
        
    }
    
    updateReadyAnimation() {
        if (!this.mesh) return;
        
        // Update animation mixers during ready state
        const deltaTime = this.clock.getDelta();
        
        // Continue running the running animation but slowly
        if (this.mixer && this.mesh.visible) {
            this.mixer.update(deltaTime * 0.3); // Slow down the animation
        }
        
        // Add a subtle breathing/ready motion
        this.readyAnimationTime += deltaTime;
        const breathingOffset = Math.sin(this.readyAnimationTime * 2) * 0.01;
        this.mesh.position.y = GAME_CONFIG.GROUND_HEIGHT + GAME_CONFIG.PLAYER_VISUAL_OFFSET + 0.02 + breathingOffset;
        
        // Subtle head movement looking ahead
        const headMovement = Math.sin(this.readyAnimationTime * 1.5) * 0.02;
        this.mesh.rotation.x = -0.05 + headMovement;
    }
}
