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
        
        // Animation system - running + flying + stumble
        this.mixer = null;
        this.currentAction = null;
        this.stumbleAction = null;
        this.flyingAction = null;
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
    }

    async initialize() {
        console.log('Loading player model...');
        await this.createSimplePlayer();
        console.log('Player ready!');
    }

    async createSimplePlayer() {
        // Load running animation first
        await this.loadRunningAnimation();
        // Then load flying animation
        await this.loadFlyingAnimation();
        // Finally load stumble animation
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
    
    async loadFlyingAnimation() {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            console.log('Attempting to load flying animation...');
            loader.load(
                'assets/models/Flying.glb',
                (gltf) => {
                    console.log('Loaded flying animation successfully');
                    
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
                    console.log('Flying mesh added to scene');
                    
                    // Create flying mixer and action for static pose
                    if (gltf.animations && gltf.animations.length > 0) {
                        this.flyingMixer = new THREE.AnimationMixer(this.flyingMesh);
                        this.flyingAction = this.flyingMixer.clipAction(gltf.animations[0]);
                        this.flyingAction.setLoop(THREE.LoopOnce); // Only play once
                        this.flyingAction.clampWhenFinished = true; // Stay at end frame
                        console.log('Flying animation ready for static pose');
                    }
                    
                    resolve();
                },
                undefined,
                (error) => {
                    console.error('Failed to load flying animation:', error);
                    resolve(); // Continue without flying animation
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
                                    
                                    console.log('Copied material from running character to stumble character');
                                }
                                materialIndex++;
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
        this.mesh.receiveShadow = true;
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
        
        // Handle animation switching based on state
        this.updateAnimationState(isFlying);
        
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
        
        // Update all mesh positions (running, flying, stumble)
        this.mesh.position.x += (targetX - this.mesh.position.x) * GAME_CONFIG.LANE_SWITCH_SPEED;
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
                    console.log('Flying mesh floating at Y:', this.mesh.position.y.toFixed(2), 'hover offset:', this.flyingHoverOffset.toFixed(2));
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
            console.log('Jump - Y position:', this.mesh.position.y.toFixed(2), 'Ground height:', visualGroundHeight.toFixed(2), 'Velocity:', this.velocityY.toFixed(3));
            
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
                    if (this.flyingMesh) {
                        this.flyingMesh.position.x = this.mesh.position.x;
                    }
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
        // Only update flying mixer if not in static flying mode
        if (this.flyingMixer && (!this.isFlying || !this.flyingMesh || !this.flyingMesh.visible)) {
            this.flyingMixer.update(deltaTime);
        }
        // Note: stumbleMixer is only updated during stumble (handled above)
    }

    updateAnimationState(isFlying) {
        // Don't change animations while stumbling
        if (this.isStumbling) return;
        
        // Switch to flying animation
        if (isFlying && this.flyingMesh && this.flyingAction && !this.flyingMesh.visible) {
            console.log('Switching to flying animation');
            console.log('Flying mesh position before switch:', this.flyingMesh.position);
            console.log('Running mesh position before switch:', this.mesh.position);
            
            // Hide running mesh, show flying mesh
            this.mesh.visible = false;
            this.flyingMesh.visible = true;
            
            // Sync positions before switching
            this.flyingMesh.position.copy(this.mesh.position);
            console.log('Flying mesh position after sync:', this.flyingMesh.position);
            
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
            
            console.log('Flying animation locked to static pose at time:', goodPoseTime, '- mesh visible:', this.flyingMesh.visible);
            console.log('Animation should now be completely static with no looping');
        }
        // Switch back to running animation
        else if (!isFlying && this.flyingMesh && this.flyingMesh.visible) {
            console.log('Switching back to running animation');
            
            // Hide flying mesh, show running mesh
            this.flyingMesh.visible = false;
            this.mesh.visible = true;
            
            // Sync positions before switching
            this.mesh.position.copy(this.flyingMesh.position);
            
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
            
            console.log('Running animation restarted');
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
        }
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
        
        if (this.flyingMesh) {
            this.flyingMesh.position.set(LANES.POSITIONS[this.lane], visualGroundHeight, 0);
            this.flyingMesh.visible = false; // Hide flying mesh
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
        this.isFlying = false; // Reset flying state
        this.flyingTime = 0;
        this.flyingHoverOffset = 0;
        this.gameOverCallback = null; // Clear any pending callback
        this.resetToNormalColor();
        
        // Restart running animation properly
        if (this.currentAction) {
            this.currentAction.reset();
            this.currentAction.paused = false;
            this.currentAction.enabled = true;
            this.currentAction.setEffectiveWeight(1.0);
            this.currentAction.play();
            console.log('Restarted running animation on reset');
        }
    }

    getPosition() {
        // Return the position of the currently active/visible mesh
        if (this.isFlying && this.flyingMesh && this.flyingMesh.visible) {
            return this.flyingMesh.position;
        } else if (this.isStumbling && this.stumbleMesh && this.stumbleMesh.visible) {
            return this.stumbleMesh.position;
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
