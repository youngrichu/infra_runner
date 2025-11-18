import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { LANES, COLORS, SPAWN_CONFIG } from './constants.js';

// Verify DRACO loader is imported
// DRACOLoader imported for model compression support

export class DirectModelEnvironment {
    constructor(scene) {
        this.scene = scene;
        this.ground = null;
        this.activeBuildings = [];
        this.streetDecorations = [];
        this.gameController = null;

        // Performance tracking - initialize immediately
        this.performanceData = {
            frameDrops: 0,
            lastFrameTime: performance.now(),
            spawnDelay: 800
        };

        // Road dimensions
        this.roadWidth = 8;
        this.sidewalkWidth = 3;

        // Model templates
        this.gltfLoader = new GLTFLoader();

        // Setup DRACO loader for compressed GLB files
        const dracoLoader = new DRACOLoader();
        // Try both local and CDN paths for maximum compatibility
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        dracoLoader.setDecoderConfig({ type: 'js' });
        this.gltfLoader.setDRACOLoader(dracoLoader);

        // DRACO loader configured and attached to GLTFLoader

        this.buildingTemplates = {}; // Store loaded building models
        this.buildingPool = new Map(); // Object pool for building instances
        this.treeTemplate = null;
        this.currentBuildingIndex = 0;
        this.modelsLoaded = false;

        // Building file names categorized by complexity for LOD
        this.buildingFiles = [
            '001.glb', '002.glb', '006.glb', '007.glb', '008.glb',
            '009.glb', '0010.glb', '0011.glb', '0012.glb'
        ];

        // LOD categorization: simpler models for distance rendering
        this.lodCategories = {
            detailed: ['001.glb', '002.glb', '006.glb'],  // Complex models for close viewing
            medium: ['007.glb', '008.glb', '009.glb'],    // Medium complexity for mid-distance  
            simple: ['0010.glb', '0011.glb', '0012.glb']  // Simpler models for far distance
        };

        this.setupScene();
        this.setupLighting();
        this.createOptimizedRoad();

        // Load the specific models (restore original working system)
        this.loadSpecificModels();
    }

    setGameController(gameController) {
        this.gameController = gameController;
    }

    setupScene() {
        this.scene.background = new THREE.Color(0xFFDAB9);
        this.scene.fog = new THREE.Fog(0xFFDAB9, 40, 150);
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xFFE5B4, 0.8);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xFFFFE0, 0.6);
        directionalLight.position.set(10, 15, 10);
        directionalLight.castShadow = false;

        this.scene.add(directionalLight);

        // Direct model environment setup complete
    }

    async startProgressiveLoading() {
        // Progressive loading: Essential models first, then detailed models
        // Starting progressive loading

        // Phase 1: Load essential simple models first for immediate gameplay
        if (window.gameLoadingManager) {
            window.gameLoadingManager.updateProgress(1, 'Loading essential models...');
        }

        try {
            // Load simple models first (can start playing with these)
            const essentialModels = this.lodCategories.simple;
            const essentialCount = await this.loadModelBatch(essentialModels, 'Essential');

            // Verify we have models loaded before proceeding
            if (essentialCount > 0) {
                // Create a basic scene so the game can start
                this.modelsLoaded = true; // Mark as loaded so game can start
                this.createInitialScene();
                // Game ready with essential models
            } else {
                // Fall back to creating a fallback scene
                // No essential models loaded, using fallback
                this.createFallbackScene();
                this.modelsLoaded = true;
            }

            if (window.gameLoadingManager) {
                window.gameLoadingManager.updateProgress(3, 'Game ready! Loading enhanced models...');
            }

            // Phase 2: Load remaining models in background
            setTimeout(() => this.loadRemainingModels(), 100);

        } catch (error) {
            // Error in progressive loading, using fallback
            this.createFallbackScene();
        }
    }

    async loadRemainingModels() {
        // Load medium and detailed models in background
        // Loading remaining models in background

        try {
            // Load medium complexity models
            const mediumModels = this.lodCategories.medium;
            await this.loadModelBatch(mediumModels, 'Medium');

            // Load detailed models
            const detailedModels = this.lodCategories.detailed;
            await this.loadModelBatch(detailedModels, 'Detailed');

            // Load tree model
            await this.loadTreeModel();

            // All models loaded - enhanced graphics available

            if (window.gameLoadingManager) {
                window.gameLoadingManager.updateProgress(5, 'All models loaded!');
            }

        } catch (error) {
            // Error loading remaining models
        }
    }

    async loadModelBatch(modelFiles, batchName) {
        // Loading batch of models

        const promises = modelFiles.map(async (filename) => {
            try {
                let gltf;

                // Check if asset is preloaded first
                if (window.assetPreloader && window.assetPreloader.getLoadedAsset(`building_${filename}`)) {
                    gltf = window.assetPreloader.getLoadedAsset(`building_${filename}`);
                    // Using preloaded building model
                } else {
                    // Fallback to loading if not preloaded
                    gltf = await this.gltfLoader.loadAsync(`./assets/city/model/${filename}`);
                }

                this.buildingTemplates[filename] = gltf.scene.clone();
                this.enhanceBuilding(this.buildingTemplates[filename], filename);
                // Model loaded successfully
                return filename;
            } catch (error) {
                // Failed to load model, using fallback
                return null;
            }
        });

        const results = await Promise.all(promises);
        const successCount = results.filter(r => r !== null).length;
        // Model batch loading complete

        return successCount;
    }

    async loadTreeModel() {
        try {
            let gltf;

            // Check if asset is preloaded first
            if (window.assetPreloader && window.assetPreloader.getLoadedAsset('tree_main')) {
                gltf = window.assetPreloader.getLoadedAsset('tree_main');
                // Using preloaded tree model
            } else {
                // Fallback to loading if not preloaded
                gltf = await this.gltfLoader.loadAsync('./assets/city/model/lowpolytrees.glb');
            }

            this.treeTemplate = gltf.scene.clone();
            this.enhanceTree(this.treeTemplate);
            // Tree model loaded successfully
        } catch (error) {
            // Failed to load tree model
        }
    }

    async loadSpecificModels() {
        // Loading specific building and tree models

        // Update loading progress
        if (window.gameLoadingManager) {
            window.gameLoadingManager.updateProgress(1, 'Loading building models...');
        }

        try {
            // Load all building models with progress tracking
            const buildingPromises = this.buildingFiles.map(async (filename, index) => {
                try {
                    const gltf = await this.gltfLoader.loadAsync(`./assets/city/model/${filename}`);
                    this.buildingTemplates[filename] = gltf.scene.clone();
                    this.enhanceBuilding(this.buildingTemplates[filename], filename);
                    // Building loaded successfully

                    // Update progress for each building loaded
                    if (window.gameLoadingManager) {
                        const progress = 1 + (index + 1) / this.buildingFiles.length * 2; // Buildings take 2 steps (1-3)
                        window.gameLoadingManager.updateProgress(progress, `Loading models... (${index + 1}/${this.buildingFiles.length})`);
                    }

                    return filename;
                } catch (error) {
                    // Failed to load building model
                    return null;
                }
            });

            // Load tree model
            if (window.gameLoadingManager) {
                window.gameLoadingManager.updateProgress(3, 'Loading tree models...');
            }

            const treePromise = this.gltfLoader.loadAsync('./assets/city/model/lowpolytrees.glb')
                .then(gltf => {
                    this.treeTemplate = gltf.scene.clone();
                    this.enhanceTree(this.treeTemplate);
                    // Tree model loaded successfully
                    return 'tree';
                })
                .catch(error => {
                    // Failed to load tree model
                    return null;
                });

            // Wait for all models to load
            const results = await Promise.all([...buildingPromises, treePromise]);
            const successfulBuildings = results.filter(r => r && r !== 'tree');

            // Building and tree models loaded successfully

            if (window.gameLoadingManager) {
                window.gameLoadingManager.updateProgress(4, 'Creating urban scene...');
            }

            this.modelsLoaded = true;

            // Create initial urban scene
            this.createInitialScene();

            // Scene creation complete
            if (window.gameLoadingManager) {
                window.gameLoadingManager.updateProgress(5, 'Ready to play!');
            }

        } catch (error) {
            // Error loading models
            this.createFallbackScene();

            // Still complete loading even if models failed
            if (window.gameLoadingManager) {
                window.gameLoadingManager.updateProgress(5, 'Ready to play!');
            }
        }
    }

    enhanceBuilding(building, filename) {
        // Apply African colors to buildings
        const africanColors = [
            0xFF6347, // Terracotta
            0x0047AB, // Bold blue
            0xFFD700, // Golden yellow
            0x663399, // Royal purple
            0x228B22, // Forest green
            0xDC143C  // Crimson red
        ];

        // Different color for each building type
        const buildingIndex = this.buildingFiles.indexOf(filename);
        const color = africanColors[buildingIndex % africanColors.length];

        let meshCount = 0;
        building.traverse((child) => {
            if (child.isMesh) {
                // Performance optimization: only nearby buildings cast shadows
                child.castShadow = false; // Disabled for performance
                child.receiveShadow = false; // Also disable receive shadows for better performance

                // Apply African color theme based on building type
                if (child.material && meshCount % 4 === 0) { // Every 4th mesh gets color
                    child.material = child.material.clone();
                    child.material.color = new THREE.Color(color);
                    child.material.color.multiplyScalar(0.8 + Math.random() * 0.2); // Slight variation

                    // Performance: reduce material complexity
                    child.material.roughness = 0.8;
                    child.material.metalness = 0.0;
                }

                meshCount++;
            }
        });

        // Enhanced building with African color theme
    }

    selectLODModel(distanceFromCamera) {
        // Select appropriate building category based on distance
        let category;
        if (distanceFromCamera < 60) {
            category = 'detailed';  // Close: use detailed models
        } else if (distanceFromCamera < 120) {
            category = 'medium';    // Medium: use medium complexity
        } else {
            category = 'simple';    // Far: use simple models
        }

        const modelsInCategory = this.lodCategories[category];
        const modelIndex = this.currentBuildingIndex % modelsInCategory.length;
        return modelsInCategory[modelIndex];
    }

    enhanceTree(tree) {
        // Enhance tree with natural colors - PERFORMANCE OPTIMIZED
        tree.traverse((child) => {
            if (child.isMesh) {
                // DISABLE SHADOWS for trees - major performance boost
                child.castShadow = false;
                child.receiveShadow = false;

                if (child.material) {
                    child.material = child.material.clone();
                    // Keep natural tree colors or enhance slightly
                    if (child.material.color.r < 0.5) {
                        // Likely foliage - enhance green
                        child.material.color = new THREE.Color(0x228B22);
                    } else {
                        // Likely trunk - enhance brown
                        child.material.color = new THREE.Color(0x8B4513);
                    }
                }
            }
        });
    }

    createOptimizedRoad() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const context = canvas.getContext('2d');

        // Road base
        context.fillStyle = '#404040';
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Road texture
        context.fillStyle = '#4A4A4A';
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const size = Math.random() * 3 + 1;
            context.fillRect(x, y, size, size);
        }

        // Lane markings for 3 lanes
        context.fillStyle = '#FFFFFF';
        for (let i = 0; i < canvas.height; i += 20) {
            context.fillRect(canvas.width / 3 - 1, i, 2, 10);
            context.fillRect((canvas.width * 2 / 3) - 1, i, 2, 10);
        }

        // Road edges
        context.fillStyle = '#FFDD00';
        context.fillRect(0, 0, 3, canvas.height);
        context.fillRect(canvas.width - 3, 0, 3, canvas.height);

        const roadTexture = new THREE.CanvasTexture(canvas);
        roadTexture.wrapS = THREE.RepeatWrapping;
        roadTexture.wrapT = THREE.RepeatWrapping;
        roadTexture.repeat.set(1, 150);

        const roadGeometry = new THREE.PlaneGeometry(this.roadWidth, 1500);
        const roadMaterial = new THREE.MeshStandardMaterial({
            map: roadTexture,
            side: THREE.DoubleSide,
            roughness: 0.8,
            metalness: 0.0
        });

        this.road = new THREE.Mesh(roadGeometry, roadMaterial);
        this.road.rotation.x = -Math.PI / 2;
        this.road.receiveShadow = true;
        this.scene.add(this.road);

        this.createSidewalks();
        this.ground = this.road;

        // Road created with clear 3-lane markings
    }

    createSidewalks() {
        const sidewalkGeometry = new THREE.PlaneGeometry(this.sidewalkWidth, 1500);
        const sidewalkMaterial = new THREE.MeshStandardMaterial({
            color: 0xB0B0B0,
            roughness: 0.9
        });

        this.leftSidewalk = new THREE.Mesh(sidewalkGeometry, sidewalkMaterial);
        this.leftSidewalk.rotation.x = -Math.PI / 2;
        this.leftSidewalk.position.x = -(this.roadWidth / 2 + this.sidewalkWidth / 2);
        this.leftSidewalk.position.y = 0.02;
        this.leftSidewalk.receiveShadow = true;
        this.scene.add(this.leftSidewalk);

        this.rightSidewalk = new THREE.Mesh(sidewalkGeometry, sidewalkMaterial.clone());
        this.rightSidewalk.rotation.x = -Math.PI / 2;
        this.rightSidewalk.position.x = (this.roadWidth / 2 + this.sidewalkWidth / 2);
        this.rightSidewalk.position.y = 0.02;
        this.rightSidewalk.receiveShadow = true;
        this.scene.add(this.rightSidewalk);
    }

    createInitialScene() {
        if (!this.modelsLoaded) {
            // Models not loaded yet, waiting
            setTimeout(() => this.createInitialScene(), 1000);
            return;
        }

        // Creating consistent dense urban scene with loaded models

        // Create BALANCED initial buildings for both sides with LOD
        for (let i = 0; i < 30; i++) { // Increased for better coverage
            const z = -20 - (i * 12); // Every 12 units for denser coverage

            // Ensure BOTH sides get buildings consistently, using LOD based on distance
            this.spawnSpecificBuilding(z, 'left', 0); // Camera starts at Z=0
            this.spawnSpecificBuilding(z - 6, 'right', 0); // Slight offset for variety
        }

        // Trees disabled temporarily
        // for (let i = 0; i < 2; i++) {
        //     this.spawnSpecificTree(-100 - (i * 150));
        // }
    }

    spawnSpecificBuilding(zPosition, forceSide = null, cameraZ = 0) {
        const loadedBuildings = Object.keys(this.buildingTemplates);
        if (loadedBuildings.length === 0) {
            // No buildings loaded, creating fallback
            this.createFallbackBuilding(zPosition);
            return;
        }

        let buildingKey;

        // Only use LOD system if models are fully loaded
        if (this.modelsLoaded) {
            // Calculate distance from camera for LOD selection
            const distanceFromCamera = Math.abs(zPosition - cameraZ);
            buildingKey = this.selectLODModel(distanceFromCamera);
        } else {
            // Fallback to original cycling method while models are loading
            buildingKey = loadedBuildings[this.currentBuildingIndex % loadedBuildings.length];
        }
        this.currentBuildingIndex++;

        // Try to get from pool first
        let building = this.getBuildingFromPool(buildingKey);
        if (!building) {
            const template = this.buildingTemplates[buildingKey];
            if (!template) {
                // Template not found, creating fallback building
                this.createFallbackBuilding(zPosition, forceSide);
                return;
            }
            building = template.clone();
        }

        // Slightly larger scale for better visibility while maintaining performance
        const scale = 0.006 + Math.random() * 0.006; // 0.006 to 0.012 scale (better visibility)
        building.scale.setScalar(scale);

        // Calculate building dimensions and position with safety margin
        const bbox = new THREE.Box3().setFromObject(building);
        const size = bbox.getSize(new THREE.Vector3());
        const groundY = -bbox.min.y;

        const side = forceSide || (Math.random() < 0.5 ? 'left' : 'right');
        let xOffset;

        if (side === 'left') {
            // Left side: Start from -6 (road edge) and move further left by building width + safety margin
            xOffset = -6 - (size.x / 2) - 2; // 2 units safety margin
        } else {
            // Right side: Start from +6 (road edge) and move further right by building width + safety margin  
            xOffset = 6 + (size.x / 2) + 2; // 2 units safety margin
        }

        building.position.set(xOffset, groundY, zPosition);
        building.rotation.y = (Math.random() - 0.5) * 0.3;

        // Building positioned with calculated offset and width

        this.scene.add(building);
        this.activeBuildings.push({
            object: building,
            zPosition: zPosition,
            type: buildingKey,
            scale: scale
        });

        // Removed detailed logging for performance
    }

    spawnSpecificTree(zPosition) {
        if (!this.treeTemplate) {
            // Tree template not loaded
            return;
        }

        const tree = this.treeTemplate.clone();

        // Much smaller scale for trees - better performance
        const scale = 0.008 + Math.random() * 0.005; // 0.008 to 0.013 scale (smaller)
        tree.scale.setScalar(scale);

        // Position tree AFTER scaling - CLOSE to road but not ON road
        const bbox = new THREE.Box3().setFromObject(tree);
        const groundY = -bbox.min.y;

        // HARDCODED SAFE POSITIONS - no calculations, no randomness, no math
        // Just alternate between left and right with FIXED safe positions
        const isEvenZ = Math.floor(Math.abs(zPosition / 100)) % 2 === 0;
        const side = isEvenZ ? 'left' : 'right';

        let xOffset;
        if (side === 'left') {
            xOffset = -5.5; // HARDCODED left sidewalk center
        } else {
            xOffset = 5.5;  // HARDCODED right sidewalk center
        }

        tree.position.set(xOffset, groundY, zPosition);

        this.scene.add(tree);
        this.streetDecorations.push({
            object: tree,
            zPosition: zPosition
        });

        // Tree spawned with calculated position and scale
    }

    createFallbackBuilding(zPosition, forceSide = null) {
        // Simple fallback if models fail to load
        const height = 3 + Math.random() * 3; // Smaller fallback buildings
        const width = 2 + Math.random() * 1.5;
        const depth = 2 + Math.random() * 1.5;

        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({
            color: [0xFF6347, 0x0047AB, 0xFFD700, 0x663399, 0x228B22][Math.floor(Math.random() * 5)],
            roughness: 0.7
        });

        const building = new THREE.Mesh(geometry, material);
        building.position.y = height / 2;
        building.castShadow = true;
        building.receiveShadow = true;

        // Use forced side or default behavior
        const side = forceSide || (Math.random() < 0.5 ? 'left' : 'right');
        let xOffset;

        if (side === 'left') {
            xOffset = -10 - Math.random() * 3; // X = -10 to -13 (consistent with GLB)
            xOffset -= (width / 2); // Account for building width
        } else {
            xOffset = 10 + Math.random() * 3;  // X = +10 to +13 (consistent with GLB)
            xOffset += (width / 2); // Account for building width
        }

        // Safety check
        if (xOffset > -6 && xOffset < 6) {
            xOffset = side === 'left' ? -12 : 12;
        }

        building.position.x = xOffset;
        building.position.z = zPosition;

        this.scene.add(building);
        this.activeBuildings.push({
            object: building,
            zPosition: zPosition,
            type: 'Fallback',
            scale: 1.0
        });

        // Fallback building created with calculated dimensions
    }

    createFallbackScene() {
        // Creating consistent dense fallback urban scene
        for (let i = 0; i < 30; i++) { // Same high density for fallback
            const z = -20 - (i * 12); // Same close spacing as GLB buildings
            this.createFallbackBuilding(z, 'left');
            this.createFallbackBuilding(z - 6, 'right'); // Ensure both sides
        }
    }

    startSpawning() {
        this.spawnElements();
    }

    spawnElements() {
        if (!this.gameController || !this.gameController.isGameActive()) {
            return;
        }

        const playerZ = this.gameController.getPlayerPosition().z;
        const gameSpeed = this.gameController.getGameSpeed();
        const spawnZ = playerZ - 120; // Spawn ahead for coverage

        // Batch spawn buildings for better performance
        const buildingsToSpawn = [
            { z: spawnZ, side: 'left' },
            { z: spawnZ - 15, side: 'left' },
            { z: spawnZ - 8, side: 'right' },
            { z: spawnZ - 23, side: 'right' }
        ];

        // Batch spawn in single operation with camera position for LOD
        this.batchSpawnBuildings(buildingsToSpawn, playerZ);

        // Trees disabled temporarily
        // if (Math.random() < 0.05) {
        //     this.spawnSpecificTree(spawnZ - 30);
        // }

        // Adaptive spawn timing based on game speed and performance
        const adaptiveDelay = this.calculateAdaptiveSpawnDelay(gameSpeed);
        setTimeout(() => {
            this.spawnElements();
        }, adaptiveDelay);
    }

    updateModels(gameSpeed, cameraZ) {
        // More aggressive building culling for better performance
        for (let i = this.activeBuildings.length - 1; i >= 0; i--) {
            const building = this.activeBuildings[i];
            building.object.position.z += gameSpeed;
            building.zPosition += gameSpeed;

            // Balanced despawning - not too aggressive to maintain density
            if (building.zPosition > cameraZ + 30) { // Optimized: Reduced from 70 to 30 to save draw calls
                this.scene.remove(building.object);
                this.returnBuildingToPool(building.object, building.type);
                this.activeBuildings.splice(i, 1);
            } else {
                // Far culling: Hide buildings that are too far ahead (beyond fog)
                // Fog ends at 150, so anything beyond 160 is invisible anyway
                const distanceAhead = Math.abs(building.zPosition - cameraZ);
                if (distanceAhead > 160) {
                    building.object.visible = false;
                } else {
                    building.object.visible = true;
                }
            }
        }

        // Update trees with aggressive culling
        for (let i = this.streetDecorations.length - 1; i >= 0; i--) {
            const decoration = this.streetDecorations[i];
            decoration.object.position.z += gameSpeed;
            decoration.zPosition += gameSpeed;

            if (decoration.zPosition > cameraZ + 25) { // Very aggressive culling for trees
                this.scene.remove(decoration.object);
                this.streetDecorations.splice(i, 1);
            }
        }
    }

    updateGround(cameraZ) {
        const groundZ = cameraZ - 750 + 75; // Calculate common Z position

        if (this.road) {
            this.road.position.z = groundZ;
        }

        // Update sidewalks to follow camera - fixes disappearing sidewalks at high speeds
        if (this.leftSidewalk) {
            this.leftSidewalk.position.z = groundZ;
        }
        if (this.rightSidewalk) {
            this.rightSidewalk.position.z = groundZ;
        }
    }

    reset() {
        this.activeBuildings.forEach(building => this.scene.remove(building.object));
        this.activeBuildings = [];

        this.streetDecorations.forEach(decoration => this.scene.remove(decoration.object));
        this.streetDecorations = [];

        this.currentBuildingIndex = 0;

        if (this.modelsLoaded) {
            this.createInitialScene();
        }
    }

    getGround() {
        return this.road;
    }

    getBuildingFromPool(buildingKey) {
        if (!this.buildingPool.has(buildingKey)) {
            this.buildingPool.set(buildingKey, []);
        }
        const pool = this.buildingPool.get(buildingKey);
        return pool.length > 0 ? pool.pop() : null;
    }

    returnBuildingToPool(building, buildingKey) {
        // Reset building state for reuse
        building.position.set(0, 0, 0);
        building.rotation.set(0, 0, 0);
        building.scale.setScalar(1);

        if (!this.buildingPool.has(buildingKey)) {
            this.buildingPool.set(buildingKey, []);
        }
        const pool = this.buildingPool.get(buildingKey);

        // Limit pool size to prevent memory bloat
        if (pool.length < 10) {
            pool.push(building);
        }
    }

    batchSpawnBuildings(buildingsToSpawn, cameraZ = 0) {
        const loadedBuildings = Object.keys(this.buildingTemplates);
        if (loadedBuildings.length === 0) return;

        // Process all buildings in a single batch to minimize DOM manipulation
        buildingsToSpawn.forEach(({ z, side }) => {
            let buildingKey;

            // Only use LOD system if models are fully loaded
            if (this.modelsLoaded) {
                // Calculate distance from camera for LOD selection
                const distanceFromCamera = Math.abs(z - cameraZ);
                buildingKey = this.selectLODModel(distanceFromCamera);
            } else {
                // Fallback to original cycling method while models are loading
                buildingKey = loadedBuildings[this.currentBuildingIndex % loadedBuildings.length];
            }
            this.currentBuildingIndex++;

            let building = this.getBuildingFromPool(buildingKey);
            if (!building) {
                const template = this.buildingTemplates[buildingKey];
                if (!template) {
                    // Template not found in batch spawn, skipping
                    return; // Skip this building
                }
                building = template.clone();
            }

            const scale = 0.006 + Math.random() * 0.006;
            building.scale.setScalar(scale);

            // Calculate building width after scaling
            const tempBuilding = building.clone();
            tempBuilding.scale.copy(building.scale);
            const bbox = new THREE.Box3().setFromObject(tempBuilding);
            const buildingWidth = bbox.getSize(new THREE.Vector3()).x;

            let xOffset;
            if (side === 'left') {
                xOffset = -6 - (buildingWidth / 2) - 2; // Road edge - building width - safety margin
            } else {
                xOffset = 6 + (buildingWidth / 2) + 2; // Road edge + building width + safety margin
            }
            building.position.set(xOffset, 0.1, z);
            building.rotation.y = (Math.random() - 0.5) * 0.3;

            this.scene.add(building);
            this.activeBuildings.push({
                object: building,
                zPosition: z,
                type: buildingKey,
                scale: scale
            });
        });
    }

    calculateAdaptiveSpawnDelay(gameSpeed = 0.13) {
        const currentTime = performance.now();
        const frameTime = currentTime - this.performanceData.lastFrameTime;
        this.performanceData.lastFrameTime = currentTime;

        // Base spawn delay, adjusted for game speed to maintain density
        let baseDelay = 800; // Base delay in ms

        // Speed compensation: faster game = faster spawning to maintain visual density
        const speedMultiplier = Math.max(0.3, 1 / (gameSpeed * 5)); // Inverse relationship with speed
        let speedAdjustedDelay = baseDelay * speedMultiplier;

        // Performance compensation: bad performance = slower spawning
        if (frameTime > 20) {
            this.performanceData.spawnDelay = Math.min(this.performanceData.spawnDelay + 100, 1500);
        } else if (frameTime < 12) { // If performance is good, allow faster spawning
            this.performanceData.spawnDelay = Math.max(this.performanceData.spawnDelay - 50, 200);
        }

        // Combine speed adjustment with performance adjustment
        const finalDelay = Math.min(speedAdjustedDelay, this.performanceData.spawnDelay);

        return Math.max(200, finalDelay); // Minimum 200ms to prevent overload
    }

    updateBuildings(gameSpeed, cameraZ) {
        this.updateModels(gameSpeed, cameraZ);
    }
}

