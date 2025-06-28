import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { LANES, COLORS, SPAWN_CONFIG } from './constants.js';

// Verify DRACO loader is imported
console.log('DRACOLoader imported:', DRACOLoader);

export class DirectModelEnvironment {
    constructor(scene) {
        this.scene = scene;
        this.ground = null;
        this.activeBuildings = [];
        this.streetDecorations = [];
        this.gameController = null;
        
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
        
        console.log('DRACO loader configured and attached to GLTFLoader');
        
        this.buildingTemplates = {}; // Store loaded building models
        this.treeTemplate = null;
        this.currentBuildingIndex = 0;
        this.modelsLoaded = false;
        
        // Building file names
        this.buildingFiles = [
            '001.glb', '002.glb', '006.glb', '007.glb', '008.glb', 
            '009.glb', '0010.glb', '0011.glb', '0012.glb'
        ];
        
        this.setupScene();
        this.setupLighting();
        this.createOptimizedRoad();
        
        // Load the specific models
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
        directionalLight.castShadow = true;
        
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        directionalLight.shadow.camera.near = 1;
        directionalLight.shadow.camera.far = 80;
        directionalLight.shadow.camera.left = -40;
        directionalLight.shadow.camera.right = 40;
        directionalLight.shadow.camera.top = 40;
        directionalLight.shadow.camera.bottom = -40;
        
        this.scene.add(directionalLight);
        
        console.log('Direct model environment setup complete');
    }

    async loadSpecificModels() {
        console.log('Loading specific building and tree models...');
        
        try {
            // Load all building models
            const buildingPromises = this.buildingFiles.map(async (filename) => {
                try {
                    const gltf = await this.gltfLoader.loadAsync(`./assets/city/model/${filename}`);
                    this.buildingTemplates[filename] = gltf.scene.clone();
                    this.enhanceBuilding(this.buildingTemplates[filename], filename);
                    console.log(`✅ Loaded building: ${filename}`);
                    return filename;
                } catch (error) {
                    console.error(`❌ Failed to load building: ${filename}`, error);
                    return null;
                }
            });

            // Load tree model
            const treePromise = this.gltfLoader.loadAsync('./assets/city/model/lowpolytrees.glb')
                .then(gltf => {
                    this.treeTemplate = gltf.scene.clone();
                    this.enhanceTree(this.treeTemplate);
                    console.log('✅ Loaded tree model');
                    return 'tree';
                })
                .catch(error => {
                    console.error('❌ Failed to load tree model', error);
                    return null;
                });

            // Wait for all models to load
            const results = await Promise.all([...buildingPromises, treePromise]);
            const successfulBuildings = results.filter(r => r && r !== 'tree');
            
            console.log(`Loaded ${successfulBuildings.length} buildings and ${results.includes('tree') ? '1 tree model' : 'no tree'}`);
            
            this.modelsLoaded = true;
            
            // Create initial urban scene
            this.createInitialScene();
            
        } catch (error) {
            console.error('Error loading models:', error);
            this.createFallbackScene();
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
        
        console.log(`Enhanced ${filename} with ${meshCount} meshes, color: #${color.toString(16)}`);
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
        for(let i = 0; i < 50; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const size = Math.random() * 3 + 1;
            context.fillRect(x, y, size, size);
        }

        // Lane markings for 3 lanes
        context.fillStyle = '#FFFFFF';
        for(let i = 0; i < canvas.height; i += 20) {
            context.fillRect(canvas.width/3 - 1, i, 2, 10);
            context.fillRect((canvas.width * 2/3) - 1, i, 2, 10);
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
        
        console.log('Road created with clear 3-lane markings');
    }

    createSidewalks() {
        const sidewalkGeometry = new THREE.PlaneGeometry(this.sidewalkWidth, 1500);
        const sidewalkMaterial = new THREE.MeshStandardMaterial({
            color: 0xB0B0B0,
            roughness: 0.9
        });
        
        const leftSidewalk = new THREE.Mesh(sidewalkGeometry, sidewalkMaterial);
        leftSidewalk.rotation.x = -Math.PI / 2;
        leftSidewalk.position.x = -(this.roadWidth/2 + this.sidewalkWidth/2);
        leftSidewalk.position.y = 0.02;
        leftSidewalk.receiveShadow = true;
        this.scene.add(leftSidewalk);
        
        const rightSidewalk = new THREE.Mesh(sidewalkGeometry, sidewalkMaterial.clone());
        rightSidewalk.rotation.x = -Math.PI / 2;
        rightSidewalk.position.x = (this.roadWidth/2 + this.sidewalkWidth/2);
        rightSidewalk.position.y = 0.02;
        rightSidewalk.receiveShadow = true;
        this.scene.add(rightSidewalk);

    }

    createInitialScene() {
        if (!this.modelsLoaded) {
            console.log('Models not loaded yet, waiting...');
            setTimeout(() => this.createInitialScene(), 1000);
            return;
        }
        
        console.log('Creating consistent dense urban scene with loaded models...');
        
        // Create BALANCED initial buildings for both sides
        for (let i = 0; i < 30; i++) { // Increased for better coverage
            const z = -20 - (i * 12); // Every 12 units for denser coverage
            
            // Ensure BOTH sides get buildings consistently
            this.spawnSpecificBuilding(z, 'left');
            this.spawnSpecificBuilding(z - 6, 'right'); // Slight offset for variety
        }
        
        // Trees disabled temporarily
        // for (let i = 0; i < 2; i++) {
        //     this.spawnSpecificTree(-100 - (i * 150));
        // }
    }

    spawnSpecificBuilding(zPosition, forceSide = null) {
        const loadedBuildings = Object.keys(this.buildingTemplates);
        if (loadedBuildings.length === 0) {
            console.log('No buildings loaded, creating fallback');
            this.createFallbackBuilding(zPosition);
            return;
        }
        
        // Cycle through loaded buildings in order
        const buildingKey = loadedBuildings[this.currentBuildingIndex % loadedBuildings.length];
        this.currentBuildingIndex++;
        
        const template = this.buildingTemplates[buildingKey];
        const building = template.clone();
        
        // Slightly larger scale for better visibility while maintaining performance
        const scale = 0.006 + Math.random() * 0.006; // 0.006 to 0.012 scale (better visibility)
        building.scale.setScalar(scale);
        
        // Ensure building faces the road properly (not sideways)
        building.rotation.y = 0; // Face forward first
        
        // Calculate position AFTER scaling and rotation
        const bbox = new THREE.Box3().setFromObject(building);
        const size = bbox.getSize(new THREE.Vector3());
        const groundY = -bbox.min.y;
        
        // Position buildings closer to street edge for dense urban feel (like the reference image)
        const side = forceSide || (Math.random() < 0.5 ? 'left' : 'right');
        let xOffset;
        
        if (side === 'left') {
            // Left side: consistent positioning for urban canyon effect
            xOffset = -10 - Math.random() * 3; // X = -10 to -13 (closer to street)
            // Additional safety: account for building width
            xOffset -= (size.x / 2); // Move further left by half building width
        } else {
            // Right side: consistent positioning
            xOffset = 10 + Math.random() * 3;  // X = +10 to +13 (closer to street)
            // Additional safety: account for building width
            xOffset += (size.x / 2); // Move further right by half building width
        }
        
        // Safety check - if somehow too close to road center
        if (xOffset > -6 && xOffset < 6) {
            xOffset = side === 'left' ? -12 : 12; // Force to safe distance
        }
        
        building.position.set(xOffset, groundY, zPosition);
        
        // Small random rotation AFTER positioning
        building.rotation.y += (Math.random() - 0.5) * 0.3;
        
        this.scene.add(building);
        this.activeBuildings.push({
            object: building,
            zPosition: zPosition,
            type: buildingKey,
            scale: scale
        });

        console.log(`Building ${buildingKey}: X=${xOffset.toFixed(1)} (${side}), Y=${groundY.toFixed(1)}, Z=${zPosition}, scale=${scale.toFixed(4)}, size=${size.x.toFixed(1)}x${size.z.toFixed(1)}`);
    }

    spawnSpecificTree(zPosition) {
        if (!this.treeTemplate) {
            console.log('Tree template not loaded');
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

        console.log(`Tree spawned: X=${xOffset.toFixed(1)} (${side} side), Y=${groundY.toFixed(1)}, Z=${zPosition}, scale=${scale.toFixed(4)}`);
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
        
        console.log(`Fallback building: X=${xOffset.toFixed(1)} (${side}), Z=${zPosition}, size=${width.toFixed(1)}x${depth.toFixed(1)}`);
    }

    createFallbackScene() {
        console.log('Creating consistent dense fallback urban scene...');
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
        const spawnZ = playerZ - 120; // Spawn ahead for coverage

        // GUARANTEED CONSISTENT SPAWNING: Always spawn on both sides
        // Spawn buildings in pairs to ensure both sides are populated
        const buildingZ1 = spawnZ;
        const buildingZ2 = spawnZ - 15; // Second row for density
        
        // ALWAYS spawn on left side (no randomness)
        this.spawnSpecificBuilding(buildingZ1, 'left');
        this.spawnSpecificBuilding(buildingZ2, 'left');
        
        // ALWAYS spawn on right side (no randomness)
        this.spawnSpecificBuilding(buildingZ1 - 8, 'right'); // Slight offset for variety
        this.spawnSpecificBuilding(buildingZ2 - 8, 'right');

        // Trees disabled temporarily
        // if (Math.random() < 0.05) {
        //     this.spawnSpecificTree(spawnZ - 30);
        // }

        setTimeout(() => {
            this.spawnElements();
        }, 800); // Faster spawning for consistent density
    }

    updateModels(gameSpeed, cameraZ) {
        // More aggressive building culling for better performance
        for (let i = this.activeBuildings.length - 1; i >= 0; i--) {
            const building = this.activeBuildings[i];
            building.object.position.z += gameSpeed;
            building.zPosition += gameSpeed;

            // Balanced despawning - not too aggressive to maintain density
            if (building.zPosition > cameraZ + 70) { // Increased back to 70 for better density
                this.scene.remove(building.object);
                this.activeBuildings.splice(i, 1);
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
        if (this.road) {
            this.road.position.z = cameraZ - (this.road.geometry.parameters.height / 2) + 75;
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

    updateBuildings(gameSpeed, cameraZ) {
        this.updateModels(gameSpeed, cameraZ);
    }
}
