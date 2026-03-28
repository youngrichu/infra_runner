// Enhanced Version 9 - Smart Pooling + Progressive Enhancement
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { LANES, COLORS, SPAWN_CONFIG, SCORING, COLLECTABLE_SPAWN_WEIGHTS, PHYSICS } from './constants.js';
import { CollisionUtils } from './collision-utils.js';
import { MODEL_CONFIGURATIONS, getModelConfig, shouldLoadModel, PRIORITY_LOADING_ORDER } from './model-configurations.js';

// Expose MODEL_CONFIGURATIONS globally for onboarding viewer
window.MODEL_CONFIGURATIONS = MODEL_CONFIGURATIONS;

export class CollectableManager {
    constructor(scene) {
        this.scene = scene;
        this.collectables = [];
        this.gameController = null; // Will be set by game.js

        // "Shuffle bag" system for fair power-up spawning
        this.powerUpDeck = [];
        this.shufflePowerUpDeck();

        // Smart pattern-based spawning constants
        this.COLLECTIBLE_SPAWN_HORIZON = 45;
        this.MIN_COLLECTIBLE_SPACING = 6;
        this.MAX_COLLECTIBLE_SPACING = 12;
        this.COLLECTIBLE_DENSITY = 0.6;
        this.POWER_UP_DENSITY = 0.15;
        this.collectiblePattern = this.generateCollectiblePattern(60);
        this.collectiblePatternIndex = 0;

        // Fair power-up spawning system (like Subway Surfers)
        this.lastPowerUpTime = Date.now(); // Initialize with current time
        this.powerUpInterval = 10000; // Guarantee power-up every 10 seconds
        this.regularCollectionsCount = 0;
        this.powerUpAfterCollections = 3; // Or after collecting 3 regular items

        // GLB Model loading system with Draco support (maintaining performance optimizations)
        this.loader = new GLTFLoader();
        this.dracoLoader = new DRACOLoader();
        this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        this.loader.setDRACOLoader(this.dracoLoader);
        this.loadedModels = new Map();
        this.loadingPromises = new Map();
        this.priorityModelsLoaded = false;

        // Pre-create and cache geometries and materials for fallback meshes
        this.cacheFallbackResources();

        // Model loading will be initialized explicitly by game.js during setup
    }

    cacheFallbackResources() {
        this.cachedGeometries = {
            'blueprint': new THREE.BoxGeometry(0.3, 0.3, 0.05),
            'waterDrop': new THREE.SphereGeometry(0.2, 16, 16),
            'energyCell': new THREE.CylinderGeometry(0.15, 0.15, 0.4, 32),
            'hardHat': new THREE.ConeGeometry(0.2, 0.4, 32),
            'waterPipeline': new THREE.TorusGeometry(0.2, 0.05, 16, 16),
            'helicopterMain': new THREE.CylinderGeometry(0.2, 0.2, 0.1, 8),
            'helicopterRotor': new THREE.BoxGeometry(0.5, 0.05, 0.1),
            'solarPower': new THREE.CircleGeometry(0.25, 16),
            'windPowerMain': new THREE.SphereGeometry(0.2, 16, 16),
            'windPowerParticle': new THREE.SphereGeometry(0.05, 8, 8),
            'aerialStar': new THREE.OctahedronGeometry(0.3, 0),
            'solarOrbMain': new THREE.SphereGeometry(0.25, 16, 16),
            'solarOrbCore': new THREE.SphereGeometry(0.15, 8, 8),
            'solarOrbRay': new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8)
        };

        this.cachedMaterials = {
            'blueprint': new THREE.MeshStandardMaterial({ color: COLORS.COLLECTABLES.BLUEPRINT }),
            'waterDrop': new THREE.MeshStandardMaterial({ color: COLORS.COLLECTABLES.WATER_DROP }),
            'energyCell': new THREE.MeshStandardMaterial({ color: COLORS.COLLECTABLES.ENERGY_CELL }),
            'hardHat': new THREE.MeshStandardMaterial({ color: COLORS.COLLECTABLES.HARD_HAT }),
            'waterPipeline': new THREE.MeshStandardMaterial({ color: COLORS.COLLECTABLES.WATER_PIPELINE }),
            'helicopter': new THREE.MeshStandardMaterial({ color: COLORS.COLLECTABLES.HELICOPTER }),
            'solarPower': new THREE.MeshStandardMaterial({ color: COLORS.COLLECTABLES.SOLAR_POWER, side: THREE.DoubleSide }),
            'windPowerMain': new THREE.MeshStandardMaterial({ color: COLORS.COLLECTABLES.WIND_POWER, transparent: true, opacity: 0.7 }),
            'windPowerParticle': new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }),
            'aerialStar': new THREE.MeshStandardMaterial({ color: COLORS.COLLECTABLES.AERIAL_STAR, emissive: 0xffaa00, metalness: 0.7, roughness: 0.3 }),
            'solarOrbMain': new THREE.MeshStandardMaterial({ color: COLORS.COLLECTABLES.SOLAR_ORB, emissive: 0xffaa00, emissiveIntensity: 0.4, metalness: 0.3, roughness: 0.1, transparent: true, opacity: 0.9 }),
            'solarOrbCore': new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffff88, emissiveIntensity: 0.8, transparent: true, opacity: 0.7 }),
            'solarOrbRay': new THREE.MeshStandardMaterial({ color: COLORS.COLLECTABLES.SOLAR_ORB, emissive: 0xffcc00, emissiveIntensity: 0.3, transparent: true, opacity: 0.6 })
        };

        // Cache geometries for collection effects
        this.cachedEffectGeometries = {
            'powerUpParticle': new THREE.SphereGeometry(0.08, 8, 8),
            'regularParticle': new THREE.SphereGeometry(0.04, 8, 8),
            'powerUpRing': new THREE.RingGeometry(0.1, 0.2, 16)
        };

        // Cache magical glow geometries
        this.cachedGlowGeometries = {
            'rays': new THREE.PlaneGeometry(4, 4),
            'bottom': new THREE.PlaneGeometry(2.5, 2.5),
            'inner': new THREE.SphereGeometry(0.6, 32, 32),
            'particle': new THREE.SphereGeometry(0.05, 8, 8)
        };
    }

    shufflePowerUpDeck() {
        this.powerUpDeck = [...COLLECTABLE_SPAWN_WEIGHTS.POWER_UPS];
        // Fisher-Yates shuffle algorithm
        for (let i = this.powerUpDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.powerUpDeck[i], this.powerUpDeck[j]] = [this.powerUpDeck[j], this.powerUpDeck[i]];
        }
    }

    generateCollectiblePattern(length) {
        const pattern = [];
        let currentPosition = 0;
        const regularTypes = ['blueprint', 'waterDrop', 'energyCell'];
        const powerUpTypes = ['hardHat', 'helicopter', 'solarPower', 'windPower', 'waterPipeline'];

        for (let i = 0; i < length; i++) {
            const spacing = this.MIN_COLLECTIBLE_SPACING +
                Math.random() * (this.MAX_COLLECTIBLE_SPACING - this.MIN_COLLECTIBLE_SPACING);
            currentPosition += spacing;

            if (Math.random() < this.COLLECTIBLE_DENSITY) {
                const isPowerUp = Math.random() < this.POWER_UP_DENSITY;
                const availableTypes = isPowerUp ? powerUpTypes : regularTypes;
                const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
                pattern.push({
                    position: currentPosition,
                    type: type,
                    isPowerUp: isPowerUp,
                    lane: Math.floor(Math.random() * 3)
                });
            }
        }
        return pattern;
    }

    async initializeModelLoading() {
        // Loading models (collectables, power-ups, obstacles)

        // Load priority models first (collectables, power-ups, and obstacles)
        const priorityTypes = PRIORITY_LOADING_ORDER;

        await this.loadPriorityModels(priorityTypes);
        this.priorityModelsLoaded = true;
        // Models ready (collectables, power-ups, obstacles)
    }

    async loadPriorityModels(modelTypes) {
        const loadPromises = modelTypes
            .filter(type => shouldLoadModel(type))
            .map(type => this.loadModel(type));

        const results = await Promise.allSettled(loadPromises);

        // Log results
        results.forEach((result, index) => {
            const type = modelTypes.filter(t => shouldLoadModel(t))[index];
            if (result.status === 'fulfilled' && result.value) {
                // Model loaded successfully
            } else {
                // Model failed to load
            }
        });
    }

    async loadModel(type) {
        if (this.loadedModels.has(type) || this.loadingPromises.has(type)) {
            return this.loadingPromises.get(type);
        }

        const config = getModelConfig(type);
        if (!config || !shouldLoadModel(type)) {
            return null;
        }

        // Check if asset is preloaded first
        const fileName = config.path.split('/').pop(); // Extract filename from path
        const preloadedKey = `collectable_${fileName}`;

        if (window.assetPreloader && window.assetPreloader.getLoadedAsset(preloadedKey)) {
            const gltf = window.assetPreloader.getLoadedAsset(preloadedKey);
            this.loadedModels.set(type, gltf);
            // Using preloaded collectable model
            return Promise.resolve(gltf);
        }

        // Fallback to loading if not preloaded
        const loadPromise = this.loader.loadAsync(config.path)
            .then(gltf => {
                this.loadedModels.set(type, gltf);
                // Model loaded successfully
                return gltf;
            })
            .catch(error => {
                // Model failed to load, using fallback
                return null;
            });

        this.loadingPromises.set(type, loadPromise);
        return loadPromise;
    }

    setGameController(gameController) {
        this.gameController = gameController;
        if (gameController && gameController.obstacleManager) {
            this.obstacleManager = gameController.obstacleManager;
        }
    }

    createCollectable(playerZ, obstacles) {
        // SMART SPAWNING: Heavily favor priority models for better consistency
        const regularCollectibles = COLLECTABLE_SPAWN_WEIGHTS.REGULAR;
        let type;
        
        if (this.priorityModelsLoaded && Math.random() < 0.9) {
            // 90% chance to use priority models (guaranteed GLB quality)
            type = this.priorityModels[Math.floor(Math.random() * this.priorityModels.length)];
        } else {
            // 10% chance for variety
            type = regularCollectibles[Math.floor(Math.random() * regularCollectibles.length)];
        }

        // Find clear position using exact lane positions
        let spawnPosition;
        let positionClear = false;
        let attempts = 0;
        const maxAttempts = 10;

        while (!positionClear && attempts < maxAttempts) {
            const laneIndex = Math.floor(Math.random() * LANES.COUNT);
            const zPos = playerZ - 60 - (Math.random() * 20);
            const xPos = LANES.POSITIONS[laneIndex];

            if (this.isPositionClear(xPos, zPos)) {
                spawnPosition = new THREE.Vector3(xPos, 0.7, zPos);
                positionClear = true;
            }
            attempts++;
        }

        if (!positionClear) return;

        const currentObstacles = obstacles || (this.obstacleManager ? this.obstacleManager.obstacles : []);
        const collectableMesh = this.createCollectableMesh(type, spawnPosition, currentObstacles);
        if (collectableMesh) {
            this.collectables.push({ mesh: collectableMesh, type: type });
        }
    }

    createPowerUp(playerZ, obstacles) {
        if (this.powerUpDeck.length === 0) {
            this.shufflePowerUpDeck();
        }

        const type = this.powerUpDeck.pop();
        // Spawning power-up from deck

        // Find clear position
        let spawnPosition;
        let positionClear = false;
        let attempts = 0;
        const maxAttempts = 10;

        while (!positionClear && attempts < maxAttempts) {
            const laneIndex = Math.floor(Math.random() * LANES.COUNT);
            const zPos = playerZ - 40;
            const xPos = LANES.POSITIONS[laneIndex];

            if (this.isPositionClear(xPos, zPos)) {
                spawnPosition = new THREE.Vector3(xPos, 0.7, zPos);
                positionClear = true;
            }
            attempts++;
        }

        if (!positionClear) {
            spawnPosition = new THREE.Vector3(LANES.POSITIONS[LANES.CENTER], 0.7, playerZ - 40); // Fixed: ground level, not floating
        }

        const currentObstacles = obstacles || (this.obstacleManager ? this.obstacleManager.obstacles : []);
        const collectableMesh = this.createCollectableMesh(type, spawnPosition, currentObstacles);
        if (collectableMesh) {
            this.collectables.push({ mesh: collectableMesh, type: type });
            // Guaranteed power-up spawned
        }
    }

    createCollectableMesh(type, spawnPosition, obstacles) {
        // Try to create GLB model first, fallback to original geometry
        const glbMesh = this.tryCreateGLBMesh(type, spawnPosition);
        if (glbMesh) {
            this.adjustHeightForObstacles(glbMesh, obstacles);
            // Add spinning animation to GLB models
            this.addSpinningAnimation(glbMesh, type);
            return glbMesh;
        }

        // Fallback to original geometry system
        let geometry, material;

        switch (type) {
            case 'blueprint':
            case 'waterDrop':
            case 'energyCell':
            case 'hardHat':
            case 'waterPipeline':
                geometry = this.cachedGeometries[type];
                material = this.cachedMaterials[type];
                break;
            case 'helicopter':
                return this.createHelicopterMesh(spawnPosition);
            case 'solarPower':
                return this.createSolarPowerMesh(spawnPosition);
            case 'windPower':
                return this.createWindPowerMesh(spawnPosition);
            default:
                return null;
        }

        const collectableMesh = new THREE.Mesh(geometry, material);
        collectableMesh.position.copy(spawnPosition);

        // Adjust height if above obstacles
        this.adjustHeightForObstacles(collectableMesh, obstacles);

        // Add spinning animation to fallback geometry
        this.addSpinningAnimation(collectableMesh, type);

        collectableMesh.castShadow = true;
        this.scene.add(collectableMesh);
        return collectableMesh;
    }

    tryCreateGLBMesh(type, spawnPosition) {
        const config = getModelConfig(type);
        if (!config || !shouldLoadModel(type)) {
            // No config available or model skipped
            return null;
        }

        const gltf = this.loadedModels.get(type);
        if (!gltf) {
            // Model not loaded yet, trigger loading for next time
            // Model not loaded yet, using fallback
            this.loadModel(type);
            return null;
        }

        try {
            // Clone the GLB scene
            const modelScene = gltf.scene.clone();

            // Apply the calculated scale from our analysis
            const scale = config.scale;
            modelScene.scale.set(scale[0], scale[1], scale[2]);


            // Position the model
            modelScene.position.copy(spawnPosition);

            // Enhanced lighting and visibility for all meshes in the model
            modelScene.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                    // Enhanced material processing for problem models
                    if (child.material) {
                        // Clone material to avoid affecting other instances
                        child.material = child.material.clone();

                        // Special handling for problematic dark models  
                        const isDarkModel = ['waterDrop', 'rubble', 'blueprint', 'constructionBarrier', 'windPower', 'pothole', 'waterPipeline', 'solarPower', 'helicopter', 'hardHat'].includes(type);

                        // Ensure materials respond well to lighting
                        child.material.roughness = Math.min(child.material.roughness || 0.7, 0.8);
                        child.material.metalness = Math.max(child.material.metalness || 0.0, 0.1);

                        // Add stronger emissive glow for better visibility
                        if (!child.material.emissive || child.material.emissive.isColor) {
                            child.material.emissive = child.material.emissive || new THREE.Color(0x222222);
                            child.material.emissiveIntensity = isDarkModel ? 0.25 : 0.15; // Extra glow for dark models
                        }

                        // More aggressive brightening for problem models
                        if (child.material.color && child.material.color.isColor) {
                            const brightness = (child.material.color.r + child.material.color.g + child.material.color.b) / 3;

                            if (isDarkModel) {
                                // Force brighten problematic models regardless of current brightness
                                child.material.color.multiplyScalar(3.0);
                                // Force brightened material for better visibility
                            } else {
                                if (brightness < 0.5) {
                                    child.material.color.multiplyScalar(2.0);
                                } else if (brightness < 0.7) {
                                    child.material.color.multiplyScalar(1.3);
                                }
                            }
                        }

                        // Force material properties for dark models
                        if (isDarkModel) {
                            child.material.roughness = 0.6; // Less rough for more reflection
                            child.material.metalness = 0.2; // Slight metallic for better light response

                            // Add ambient enhancement
                            if (child.material.emissive) {
                                child.material.emissive.multiplyScalar(1.5);
                            }

                            // Special pothole road-blending effect
                            if (type === 'pothole') {
                                // Create a gradient effect by adding a darker ring around edges
                                child.material.transparent = true;
                                child.material.opacity = 0.9; // Slightly transparent for blending

                                // Add road-like coloring to blend with asphalt
                                if (child.material.color) {
                                    // Mix with road color (#404040) for better blending
                                    const roadColor = new THREE.Color(0x404040);
                                    child.material.color.lerp(roadColor, 0.3); // 30% road color mix
                                }

                                // Add subtle emission to make it look like a real hole
                                child.material.emissive = new THREE.Color(0x1a1a1a); // Very dark emission
                                child.material.emissiveIntensity = 0.1;
                            }
                        }
                    }
                }
            });

            // Add animation data to the GLB model
            this.addSpinningAnimation(modelScene, type);

            // Add to scene
            this.scene.add(modelScene);

            // Using GLB model for collectable
            return modelScene;

        } catch (error) {
            // GLB creation failed, using fallback
            return null;
        }
    }

    createHelicopterMesh(spawnPosition) {
        // Try GLB model first (Jet-Pack)
        const glbMesh = this.tryCreateGLBMesh('helicopter', spawnPosition);
        if (glbMesh) {
            return glbMesh;
        }

        // Fallback to original helicopter geometry
        const geometry = this.cachedGeometries['helicopterMain'];
        const rotorGeometry = this.cachedGeometries['helicopterRotor'];
        const material = this.cachedMaterials['helicopter'];

        const collectableMesh = new THREE.Mesh(geometry, material);
        const rotor = new THREE.Mesh(rotorGeometry, material);
        rotor.position.y = 0.1;
        collectableMesh.add(rotor);

        collectableMesh.position.set(spawnPosition.x, spawnPosition.y, spawnPosition.z);

        // Add spinning animation
        this.addSpinningAnimation(collectableMesh, 'helicopter');

        collectableMesh.castShadow = true;
        this.scene.add(collectableMesh);
        return collectableMesh;
    }

    createSolarPowerMesh(spawnPosition) {
        // Try GLB model first (Solar Panel Ground)
        const glbMesh = this.tryCreateGLBMesh('solarPower', spawnPosition);
        if (glbMesh) {
            return glbMesh;
        }

        // Fallback to original solar panel geometry
        const geometry = this.cachedGeometries['solarPower'];
        const material = this.cachedMaterials['solarPower'];
        const solarMesh = new THREE.Mesh(geometry, material);
        solarMesh.rotation.x = -Math.PI / 2;

        solarMesh.position.set(spawnPosition.x, spawnPosition.y, spawnPosition.z);

        // Add spinning animation
        this.addSpinningAnimation(solarMesh, 'solarPower');

        solarMesh.castShadow = true;
        this.scene.add(solarMesh);
        return solarMesh;
    }

    createWindPowerMesh(spawnPosition) {
        // Try GLB model first (Boots)
        const glbMesh = this.tryCreateGLBMesh('windPower', spawnPosition);
        if (glbMesh) {
            return glbMesh;
        }

        // Fallback to original wind power geometry with particles
        const geometry = this.cachedGeometries['windPowerMain'];
        const material = this.cachedMaterials['windPowerMain'];
        const windMesh = new THREE.Mesh(geometry, material);

        // Add particle effects
        const particleGeometry = this.cachedGeometries['windPowerParticle'];
        const particleMaterial = this.cachedMaterials['windPowerParticle'];

        for (let i = 0; i < 5; i++) {
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            particle.position.set(
                (Math.random() - 0.5) * 0.3,
                (Math.random() - 0.5) * 0.3,
                (Math.random() - 0.5) * 0.3
            );
            windMesh.add(particle);
        }

        windMesh.position.set(spawnPosition.x, spawnPosition.y, spawnPosition.z);

        // Add spinning animation
        this.addSpinningAnimation(windMesh, 'windPower');

        windMesh.castShadow = true;
        this.scene.add(windMesh);
        return windMesh;
    }

    createAerialCollectable(playerPosition) {
        const laneIndex = Math.floor(Math.random() * LANES.COUNT);
        const spawnPosition = new THREE.Vector3(
            LANES.POSITIONS[laneIndex],
            2.5, // Fixed height for aerial stars - high enough to be clearly aerial
            playerPosition.z - 30 - (Math.random() * 20)
        );

        // Try GLB model first (Star)
        const glbMesh = this.tryCreateGLBMesh('aerialStar', spawnPosition);
        if (glbMesh) {
            glbMesh.userData = {
                rotationSpeed: 0.015 + Math.random() * 0.005  // Match the subtle speed
            };
            this.collectables.push({ mesh: glbMesh, type: 'aerialStar' });
            return;
        }

        // Fallback to original octahedron geometry
        const geometry = this.cachedGeometries['aerialStar'];
        const material = this.cachedMaterials['aerialStar'];

        const collectableMesh = new THREE.Mesh(geometry, material);
        collectableMesh.position.copy(spawnPosition);

        collectableMesh.userData = {
            rotationSpeed: 0.015 + Math.random() * 0.005  // Match the subtle speed
        };

        collectableMesh.castShadow = true;
        this.scene.add(collectableMesh);
        this.collectables.push({ mesh: collectableMesh, type: 'aerialStar' });
    }

    createSolarOrb(playerPosition) {
        // Create a light bulb/solar energy orb that appears during solar boost
        const geometry = this.cachedGeometries['solarOrbMain'];
        const material = this.cachedMaterials['solarOrbMain'].clone();

        const collectableMesh = new THREE.Mesh(geometry, material);

        // Add a glowing inner core
        const coreGeometry = this.cachedGeometries['solarOrbCore'];
        const coreMaterial = this.cachedMaterials['solarOrbCore'].clone();
        const core = new THREE.Mesh(coreGeometry, coreMaterial);
        collectableMesh.add(core);

        // Add light rays (4 extending lines)
        const rayGeometry = this.cachedGeometries['solarOrbRay'];
        const rayMaterial = this.cachedMaterials['solarOrbRay'].clone();
        for (let i = 0; i < 4; i++) {
            const ray = new THREE.Mesh(rayGeometry, rayMaterial);

            // Position rays in cross pattern
            if (i < 2) {
                ray.rotation.z = (i * Math.PI) + (Math.PI / 4); // Diagonal rays
            } else {
                ray.rotation.x = ((i - 2) * Math.PI) + (Math.PI / 4); // Other diagonal rays
            }

            collectableMesh.add(ray);
        }

        const laneIndex = Math.floor(Math.random() * LANES.COUNT);

        collectableMesh.position.set(
            LANES.POSITIONS[laneIndex],
            playerPosition.y + 0.5,
            playerPosition.z - 25 - (Math.random() * 15)
        );

        collectableMesh.userData = {
            animationType: 'pulse',
            originalY: spawnPosition.y,
            animationTime: 0,
            rotationSpeed: 0.08 + Math.random() * 0.04,
            pulseSpeed: 0.03 + Math.random() * 0.02,
            isFallback: !loadedModel
        };

        collectableMesh.castShadow = true;
        this.scene.add(collectableMesh);
        this.collectables.push({ mesh: collectableMesh, type: 'solarOrb' });
    }

    addSpinningAnimation(collectableMesh, type) {
        collectableMesh.userData = collectableMesh.userData || {};

        const powerUps = ['hardHat', 'helicopter', 'solarPower', 'windPower', 'waterPipeline'];

        if (powerUps.includes(type)) {
            // Debug logging to track power-up glow effect
            console.log(`Adding glow effect to power-up: ${type}`);

            // Power-ups get subtle bouncing animation (no rotation to preserve front face)
            collectableMesh.userData.bounceSpeed = 1.0; // Subtle bounce speed
            collectableMesh.userData.bounceOffset = Math.random() * Math.PI * 2; // Random phase offset
            collectableMesh.userData.bounceHeight = 0.12; // Subtle bounce height
            collectableMesh.userData.baseY = collectableMesh.position.y; // Store original Y position
            collectableMesh.userData.isPowerUp = true; // Flag to identify power-ups

            // Add magical glow effect for power-ups
            this.addMagicalGlow(collectableMesh, type);
        } else {
            // Regular collectibles get very subtle, consistent spinning
            collectableMesh.userData.rotationSpeed = 0.015 + (Math.random() * 0.005); // Subtle spinning
        }
    }

    createRayTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const context = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = canvas.width / 2;

        context.clearRect(0, 0, canvas.width, canvas.height);

        // Draw rays
        const rayCount = 12;
        context.fillStyle = '#FFFFFF';

        for (let i = 0; i < rayCount; i++) {
            context.beginPath();
            context.moveTo(centerX, centerY);
            const angle = (i / rayCount) * Math.PI * 2;
            const width = (Math.PI * 2) / (rayCount * 2); // Half width for gaps

            context.arc(centerX, centerY, radius, angle - width / 2, angle + width / 2);
            context.lineTo(centerX, centerY);
            context.fill();
        }

        // Soften edges
        const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        context.globalCompositeOperation = 'destination-in';
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    createGlowTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const context = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = canvas.width / 2;

        const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.5)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    addMagicalGlow(collectableMesh, type) {
        // Create magical glow effect around power-ups
        const glowGroup = new THREE.Group();

        // Get power-up specific color
        const glowColor = this.getPowerUpGlowColor(type);

        // Debug logging to track glow creation
        console.log(`Creating magical glow for ${type} with color:`, glowColor);

        // 1. Rotating Sunburst Rays (Behind)
        if (!this.rayTexture) this.rayTexture = this.createRayTexture();

        const raysGeometry = this.cachedGlowGeometries['rays'];
        const raysMaterial = new THREE.MeshBasicMaterial({
            color: glowColor,
            map: this.rayTexture,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const rays = new THREE.Mesh(raysGeometry, raysMaterial);
        rays.position.z = -0.5; // Slightly behind
        glowGroup.add(rays);

        // 2. Bottom Glow (Ground illumination)
        if (!this.glowTexture) this.glowTexture = this.createGlowTexture();

        const bottomGlowGeometry = this.cachedGlowGeometries['bottom'];
        const bottomGlowMaterial = new THREE.MeshBasicMaterial({
            color: glowColor,
            map: this.glowTexture,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const bottomGlow = new THREE.Mesh(bottomGlowGeometry, bottomGlowMaterial);
        bottomGlow.rotation.x = -Math.PI / 2; // Lay flat
        bottomGlow.position.y = -0.5; // At feet level
        glowGroup.add(bottomGlow);

        // 3. Inner bright core glow (Intense)
        const innerGlowGeometry = this.cachedGlowGeometries['inner'];
        const innerGlowMaterial = new THREE.MeshBasicMaterial({
            color: glowColor,
            transparent: true,
            opacity: 0.4,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const innerGlow = new THREE.Mesh(innerGlowGeometry, innerGlowMaterial);
        glowGroup.add(innerGlow);

        // 4. Dynamic Sparkles/Particles
        const particleCount = 12;
        const particles = [];

        const particleGeometry = this.cachedGlowGeometries['particle'];
        const particleMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending
        });

        for (let i = 0; i < particleCount; i++) {
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);

            // Position particles in a circle around the power-up
            const angle = (i / particleCount) * Math.PI * 2;
            const radius = 1.0 + Math.random() * 0.5;
            particle.position.set(
                Math.cos(angle) * radius,
                (Math.random() - 0.5) * 1.0,
                Math.sin(angle) * radius
            );

            particle.userData = {
                originalAngle: angle,
                orbitRadius: radius,
                verticalSpeed: 0.5 + Math.random() * 1.0,
                orbitSpeed: 1.0 + Math.random() * 1.0,
                yOffset: Math.random() * Math.PI * 2
            };

            particles.push(particle);
            glowGroup.add(particle);
        }

        // Store glow components for animation
        collectableMesh.userData.glowGroup = glowGroup;
        collectableMesh.userData.glowLayers = [innerGlow, rays, bottomGlow];
        collectableMesh.userData.glowParticles = particles;
        collectableMesh.userData.glowTime = 0;

        // Add glow group to the collectable
        collectableMesh.add(glowGroup);
    }

    getPowerUpGlowColor(type) {
        // Return appropriate glow colors for each power-up type
        switch (type) {
            case 'hardHat':
                return new THREE.Color(0xffa500); // Orange glow
            case 'helicopter':
                return new THREE.Color(0x00ffff); // Cyan glow
            case 'solarPower':
                return new THREE.Color(0xffff00); // Yellow glow
            case 'windPower':
                return new THREE.Color(0x00ff88); // Green glow
            case 'waterPipeline':
                return new THREE.Color(0x0088ff); // Blue glow
            default:
                return new THREE.Color(0xffffff); // White glow fallback
        }
    }

    adjustHeightForObstacles(collectableMesh, obstacles) {
        let yOffset = 0;
        for (const obstacle of obstacles) {
            if (Math.abs(obstacle.mesh.position.x - collectableMesh.position.x) < 1 &&
                Math.abs(obstacle.mesh.position.z - collectableMesh.position.z) < 1 &&
                obstacle.mesh.position.y > 0.1) {
                yOffset = obstacle.mesh.geometry.parameters.height ?
                    obstacle.mesh.geometry.parameters.height + 0.2 : 0.5;
                break;
            }
        }
        collectableMesh.position.y += yOffset;
        if (collectableMesh.userData) {
            collectableMesh.userData.originalY += yOffset;
        }
    }

    startSpawning() {

        // Spawning logic is now handled in the update loop, not time-based
    }

    // Legacy method - kept for compatibility but no longer used
    spawnCollectable() {
        if (!this.gameController || !this.gameController.isGameActive()) {
            return;
        }

        const playerZ = this.gameController.getPlayerPosition().z;
        const obstacles = this.gameController.getObstacles();
        this.createCollectable(playerZ, obstacles);

        setTimeout(() => {
            this.spawnCollectable(); // Recursive call without parameters
        }, Math.random() * SPAWN_CONFIG.COLLECTABLE_INTERVAL.MAX + SPAWN_CONFIG.COLLECTABLE_INTERVAL.MIN);
    }

    updateCollectables(gameSpeed, cameraZ) {
        const time = Date.now() * 0.001;

        for (let i = this.collectables.length - 1; i >= 0; i--) {
            const collectable = this.collectables[i];
            collectable.mesh.position.z += gameSpeed;

            // Apply bouncing animation to power-ups (no rotation to preserve front face)
            if (collectable.mesh.userData.isPowerUp && collectable.mesh.userData.bounceSpeed) {
                const bounceOffset = Math.sin(time * collectable.mesh.userData.bounceSpeed + collectable.mesh.userData.bounceOffset);
                const newY = collectable.mesh.userData.baseY + (bounceOffset * collectable.mesh.userData.bounceHeight);
                collectable.mesh.position.y = newY;

                // Animate magical glow effect
                this.updateMagicalGlow(collectable.mesh, time);
            }

            // Apply subtle spinning to regular collectibles
            if (collectable.mesh.userData.rotationSpeed) {
                collectable.mesh.rotation.y += collectable.mesh.userData.rotationSpeed;
            }

            // Special handling for specific types
            if (collectable.type === 'solarOrb') {
                // Solar orbs get multi-axis rotation and pulsing
                if (collectable.mesh.userData.rotationSpeed) {
                    collectable.mesh.rotation.z += collectable.mesh.userData.rotationSpeed * 0.3;
                }

                // Pulsing glow effect
                if (collectable.mesh.userData.pulseSpeed) {
                    const pulse = Math.sin(time * collectable.mesh.userData.pulseSpeed * 10) * 0.5 + 0.5;
                    collectable.mesh.material.emissiveIntensity = 0.3 + (pulse * 0.3);
                }
            } else if (collectable.type === 'aerialStar') {
                // Aerial stars get simple Y-axis rotation only (as it was before)
                if (collectable.mesh.userData.rotationSpeed) {
                    collectable.mesh.rotation.y += collectable.mesh.userData.rotationSpeed;
                }
            }

            if (collectable.mesh.position.z > cameraZ + 5) {
                this.scene.remove(collectable.mesh);
                this.collectables.splice(i, 1);
            } else {
                // Far culling: Hide collectables that are too far ahead (beyond fog)
                const distanceAhead = Math.abs(collectable.mesh.position.z - cameraZ);
                if (distanceAhead > 160) {
                    collectable.mesh.visible = false;
                } else {
                    collectable.mesh.visible = true;
                }
            }
        }

        // Update collection effects
        this.updateCollectionEffects();
    }

    updateMagicalGlow(collectableMesh, time) {
        if (!collectableMesh.userData.glowGroup) return;

        collectableMesh.userData.glowTime = time;

        // Animate glow layers (Inner, Rays, Bottom)
        if (collectableMesh.userData.glowLayers) {
            const [inner, rays, bottom] = collectableMesh.userData.glowLayers;

            // Pulse inner core
            if (inner) {
                const pulse = Math.sin(time * 3.0) * 0.5 + 0.5;
                inner.material.opacity = 0.4 + (pulse * 0.2);
                inner.scale.setScalar(0.9 + (pulse * 0.1));
            }

            // Rotate rays
            if (rays) {
                rays.rotation.z = time * 0.5; // Slow rotation
                const rayPulse = Math.sin(time * 2.0) * 0.5 + 0.5;
                rays.material.opacity = 0.4 + (rayPulse * 0.2);
            }

            // Pulse bottom glow
            if (bottom) {
                const bottomPulse = Math.sin(time * 4.0) * 0.5 + 0.5;
                bottom.material.opacity = 0.6 + (bottomPulse * 0.2);
                const scale = 1.0 + (bottomPulse * 0.2);
                bottom.scale.setScalar(scale);
            }
        }

        // Animate floating particles
        if (collectableMesh.userData.glowParticles) {
            collectableMesh.userData.glowParticles.forEach((particle, index) => {
                // Orbit
                const angle = particle.userData.originalAngle + (time * particle.userData.orbitSpeed);
                const radius = particle.userData.orbitRadius;

                particle.position.x = Math.cos(angle) * radius;
                particle.position.z = Math.sin(angle) * radius;

                // Vertical bobbing
                particle.position.y = Math.sin(time * particle.userData.verticalSpeed + particle.userData.yOffset) * 0.5;

                // Twinkle
                const twinkle = Math.sin(time * 10.0 + index) * 0.5 + 0.5;
                particle.material.opacity = 0.4 + (twinkle * 0.6);
                const scale = 0.8 + (twinkle * 0.4);
                particle.scale.setScalar(scale);
            });
        }
    }

    checkCollisions(playerBox) {
        const collectedItems = [];

        // Get current game speed and magnet status for enhanced collision detection
        const gameSpeed = this.gameController ? this.gameController.getGameSpeed() : 0;
        const hasMagnetEffect = this.gameController && this.gameController.powerUpManager ?
            this.gameController.powerUpManager.getSolarBoostStatus() : false;

        for (let i = this.collectables.length - 1; i >= 0; i--) {
            const collectable = this.collectables[i];
            const collectableBox = new THREE.Box3().setFromObject(collectable.mesh);

            // Skip aerial stars if player is not flying
            if (collectable.type === 'aerialStar') {
                const isFlying = this.gameController && this.gameController.powerUpManager &&
                    this.gameController.powerUpManager.getFlyingStatus();
                if (!isFlying) {
                    continue; // Don't collect aerial stars when not flying
                }
            }

            // Skip solar orbs if player doesn't have solar boost
            if (collectable.type === 'solarOrb') {
                const hasSolarBoost = this.gameController && this.gameController.powerUpManager &&
                    this.gameController.powerUpManager.getSolarBoostStatus();
                if (!hasSolarBoost) {
                    continue; // Don't collect solar orbs when not in solar boost mode
                }
            }

            // Use enhanced collision detection for collectibles
            let collisionDetected = false;

            if (gameSpeed > PHYSICS.HIGH_SPEED_THRESHOLD) {
                collisionDetected = CollisionUtils.checkCollectableCollision(
                    playerBox,
                    collectableBox,
                    gameSpeed,
                    hasMagnetEffect
                );
            } else {
                collisionDetected = playerBox.intersectsBox(collectableBox);
            }

            if (collisionDetected) {
                // Create collection effect before removing the collectable
                this.createCollectionEffect(collectable.mesh.position, collectable.type);

                this.scene.remove(collectable.mesh);
                this.collectables.splice(i, 1);
                collectedItems.push(collectable.type);

                // High-speed collection detected

                // Track regular collections for fair power-up spawning
                const regularTypes = ['blueprint', 'waterDrop', 'energyCell'];
                if (regularTypes.includes(collectable.type)) {
                    this.regularCollectionsCount++;
                    // Regular collection counted for power-up spawning
                }
            }
        }

        return collectedItems;
    }

    createCollectionEffect(position, type) {
        const powerUps = ['hardHat', 'helicopter', 'solarPower', 'windPower', 'waterPipeline'];
        const isPowerUp = powerUps.includes(type);

        // Create particle burst effect
        const particleCount = isPowerUp ? 12 : 6;
        const particleGeometry = isPowerUp ? this.cachedEffectGeometries['powerUpParticle'] : this.cachedEffectGeometries['regularParticle'];

        // Cache particle materials
        if (!this.cachedEffectMaterials) this.cachedEffectMaterials = {};
        if (!this.cachedEffectMaterials[type]) {
            this.cachedEffectMaterials[type] = new THREE.MeshStandardMaterial({
                color: this.getCollectableColor(type),
                emissive: this.getCollectableColor(type),
                emissiveIntensity: 0.3,
                transparent: true,
                opacity: 0.8
            });
        }
        // Clone the material to ensure fading out this burst doesn't fade all other bursts
        const particleMaterial = this.cachedEffectMaterials[type].clone();

        for (let i = 0; i < particleCount; i++) {
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);

            particle.position.copy(position);

            // Random burst direction
            const angle = (i / particleCount) * Math.PI * 2;
            const radius = 0.3 + Math.random() * 0.2;
            const height = (Math.random() - 0.5) * 0.3;

            particle.userData = {
                velocity: new THREE.Vector3(
                    Math.cos(angle) * radius,
                    height + 0.1,
                    Math.sin(angle) * radius
                ),
                life: 1.0,
                decay: 0.02 + Math.random() * 0.01
            };

            this.scene.add(particle);
            this.collectionEffects = this.collectionEffects || [];
            this.collectionEffects.push(particle);
        }

        // Create extra effects for power-ups
        if (isPowerUp) {
            // Create a expanding ring effect
            const ringGeometry = this.cachedEffectGeometries['powerUpRing'];

            // Cache ring materials
            if (!this.cachedRingMaterials) this.cachedRingMaterials = {};
            if (!this.cachedRingMaterials[type]) {
                this.cachedRingMaterials[type] = new THREE.MeshStandardMaterial({
                    color: this.getCollectableColor(type),
                    emissive: this.getCollectableColor(type),
                    emissiveIntensity: 0.5,
                    transparent: true,
                    opacity: 0.6,
                    side: THREE.DoubleSide
                });
            }
            const ringMaterial = this.cachedRingMaterials[type];

            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.position.copy(position);
            ring.rotation.x = -Math.PI / 2;

            ring.userData = {
                scale: 1.0,
                expansion: 0.1,
                life: 1.0,
                decay: 0.03
            };

            this.scene.add(ring);
            this.collectionEffects = this.collectionEffects || [];
            this.collectionEffects.push(ring);
        }
    }

    getCollectableColor(type) {
        const colors = {
            'blueprint': 0x4A90E2,
            'waterDrop': 0x00CED1,
            'energyCell': 0xFFD700,
            'hardHat': 0xFF8C00,
            'helicopter': 0x808080,
            'solarPower': 0xFFD700,
            'windPower': 0x32CD32,
            'waterPipeline': 0x1E90FF,
            'aerialStar': 0xFFD700,
            'solarOrb': 0xFFD700
        };
        return colors[type] || 0xFFFFFF;
    }

    updateCollectionEffects() {
        if (!this.collectionEffects) return;

        for (let i = this.collectionEffects.length - 1; i >= 0; i--) {
            const effect = this.collectionEffects[i];

            if (effect.userData.velocity) {
                // Particle effect
                effect.position.add(effect.userData.velocity);
                effect.userData.velocity.y -= 0.01; // Gravity
                effect.userData.velocity.multiplyScalar(0.95); // Air resistance

                effect.userData.life -= effect.userData.decay;
                effect.material.opacity = effect.userData.life;

                if (effect.userData.life <= 0) {
                    this.scene.remove(effect);
                    this.collectionEffects.splice(i, 1);
                }
            } else if (effect.userData.expansion) {
                // Ring effect
                effect.userData.scale += effect.userData.expansion;
                effect.scale.setScalar(effect.userData.scale);

                effect.userData.life -= effect.userData.decay;
                effect.material.opacity = effect.userData.life * 0.6;

                if (effect.userData.life <= 0) {
                    this.scene.remove(effect);
                    this.collectionEffects.splice(i, 1);
                }
            }
        }
    }

    applyMagnetEffect(playerPosition, magnetRadius, magnetSpeed) {
        let affectedCount = 0;
        for (const collectable of this.collectables) {
            const distance = playerPosition.distanceTo(collectable.mesh.position);
            if (distance < magnetRadius) {
                const direction = new THREE.Vector3()
                    .subVectors(playerPosition, collectable.mesh.position)
                    .normalize();
                collectable.mesh.position.add(direction.multiplyScalar(magnetSpeed));
                affectedCount++;
            }
        }
        if (affectedCount > 0) {
            console.log(`🧢 DEBUG: Magnet effect applied to ${affectedCount} collectibles (radius: ${magnetRadius}, speed: ${magnetSpeed})`);
        }
    }

    getCollectables() {
        return this.collectables;
    }

    shouldSpawnPowerUp() {
        const currentTime = Date.now();
        const timeSinceLastPowerUp = currentTime - this.lastPowerUpTime;

        // Power-up should spawn if:
        // 1. Time interval reached (25 seconds)
        // 2. OR collected enough regular items (8 items)
        if (timeSinceLastPowerUp >= this.powerUpInterval ||
            this.regularCollectionsCount >= this.powerUpAfterCollections) {
            return true;
        }
        return false;
    }

    // NEW: Mark that a power-up was spawned
    markPowerUpSpawned() {
        this.lastPowerUpTime = Date.now();
        this.regularCollectionsCount = 0; // Reset collection counter
        // Power-up spawned - timers reset
    }

    reset() {
        this.collectables.forEach(collectable => this.scene.remove(collectable.mesh));
        this.collectables = [];

        // Clean up collection effects
        if (this.collectionEffects) {
            this.collectionEffects.forEach(effect => this.scene.remove(effect));
            this.collectionEffects = [];
        }

        // Reset and reshuffle the power-up deck
        this.shufflePowerUpDeck();

        // Reset fair spawning system
        this.lastPowerUpTime = Date.now();
        this.regularCollectionsCount = 0;
        this.lastSpawnZ = 0;
        
        // EXPO FIX: Reset smart spawning system
        this.collectiblePatternIndex = 0;
        this.collectiblePattern = this.generateCollectiblePattern(60);
        
        // CRITICAL FIX: Reset spawn history for power-up distance tracking
        this.spawnHistory = {
            lastTypes: [],
            maxHistory: 5,
            lastPowerUpDistance: -100,  // ✅ FIXED: Allows immediate power-up spawning
            minPowerUpSpacing: 80,
            currentDistance: 0
        };
        
        console.log('✅ CollectableManager reset - power-up distance tracking reset to -100');
    }

    removeAerialStars() {
        for (let i = this.collectables.length - 1; i >= 0; i--) {
            const collectable = this.collectables[i];
            if (collectable.type === 'aerialStar') {
                this.scene.remove(collectable.mesh);
                this.collectables.splice(i, 1);
                // Aerial star removed after helicopter ended
            }
        }
    }

    removeSolarOrbs() {
        for (let i = this.collectables.length - 1; i >= 0; i--) {
            const collectable = this.collectables[i];
            if (collectable.type === 'solarOrb') {
                this.scene.remove(collectable.mesh);
                this.collectables.splice(i, 1);
                // Solar orb removed after solar boost ended
            }
        }
    }

    // NEW: Create obstacle GLB mesh (for use by obstacle manager)
    createObstacleGLBMesh(type, spawnPosition) {
        const config = getModelConfig(type);
        if (!config || !shouldLoadModel(type)) {
            // No obstacle config available or skipped
            return null;
        }

        const gltf = this.loadedModels.get(type);
        if (!gltf) {
            // Model not loaded yet, trigger loading for next time
            // Obstacle model not loaded yet, using fallback
            this.loadModel(type);
            return null;
        }

        try {
            // Clone the GLB scene
            const modelScene = gltf.scene.clone();

            // Apply the calculated scale from our analysis
            const scale = config.scale;
            modelScene.scale.set(scale[0], scale[1], scale[2]);

            // Position the model
            modelScene.position.copy(spawnPosition);

            // Fix Y positioning for GLB obstacle models (ground them properly)
            if (type === 'constructionBarrier') {
                // Plastic barrier should sit on ground
                modelScene.position.y = 0.3; // Half the height of the barrier
            } else if (type === 'rubble') {
                // Cinder block should sit on ground
                modelScene.position.y = 0.1; // Lower to ground level
            } else if (type === 'cone') {
                // Traffic cone should sit on ground
                modelScene.position.y = 0.2; // Adjust to ground level
            } else if (type === 'pothole') {
                // Pothole should be visible at ground level (not below)
                modelScene.position.y = 0.05; // Slightly above ground to ensure visibility
            }

            // Enhanced lighting and visibility for all meshes in the obstacle model
            modelScene.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                    // Enhanced material processing for problem models
                    if (child.material) {
                        // Clone material to avoid affecting other instances
                        child.material = child.material.clone();

                        // Special handling for problematic dark models  
                        const isDarkModel = ['waterDrop', 'rubble', 'blueprint', 'constructionBarrier', 'windPower', 'pothole', 'waterPipeline', 'solarPower', 'helicopter', 'hardHat'].includes(type);

                        // Ensure materials respond well to lighting
                        child.material.roughness = Math.min(child.material.roughness || 0.7, 0.8);
                        child.material.metalness = Math.max(child.material.metalness || 0.0, 0.1);

                        // Add stronger emissive glow for better visibility
                        if (!child.material.emissive || child.material.emissive.isColor) {
                            child.material.emissive = child.material.emissive || new THREE.Color(0x222222);
                            child.material.emissiveIntensity = isDarkModel ? 0.25 : 0.15; // Extra glow for dark models
                        }

                        // More aggressive brightening for problem models
                        if (child.material.color && child.material.color.isColor) {
                            const brightness = (child.material.color.r + child.material.color.g + child.material.color.b) / 3;

                            if (isDarkModel) {
                                // Force brighten problematic models regardless of current brightness
                                child.material.color.multiplyScalar(3.0);
                                // Force brightened obstacle material for better visibility
                            } else {
                                if (brightness < 0.5) {
                                    child.material.color.multiplyScalar(2.0);
                                } else if (brightness < 0.7) {
                                    child.material.color.multiplyScalar(1.3);
                                }
                            }
                        }

                        // Force material properties for dark models
                        if (isDarkModel) {
                            child.material.roughness = 0.6; // Less rough for more reflection
                            child.material.metalness = 0.2; // Slight metallic for better light response

                            // Add ambient enhancement
                            if (child.material.emissive) {
                                child.material.emissive.multiplyScalar(1.5);
                            }

                            // Special pothole road-blending effect
                            if (type === 'pothole') {
                                // Create a gradient effect by adding a darker ring around edges
                                child.material.transparent = true;
                                child.material.opacity = 0.9; // Slightly transparent for blending

                                // Add road-like coloring to blend with asphalt
                                if (child.material.color) {
                                    // Mix with road color (#404040) for better blending
                                    const roadColor = new THREE.Color(0x404040);
                                    child.material.color.lerp(roadColor, 0.3); // 30% road color mix
                                }

                                // Add subtle emission to make it look like a real hole
                                child.material.emissive = new THREE.Color(0x1a1a1a); // Very dark emission
                                child.material.emissiveIntensity = 0.1;
                            }
                        }
                    }
                }
            });

            // Add to scene
            this.scene.add(modelScene);

            // Using GLB obstacle model
            return modelScene;

        } catch (error) {
            // GLB obstacle creation failed, using fallback
            return null;
        }
    }
}