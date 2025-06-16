import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LANES, COLORS, SPAWN_CONFIG } from './constants.js';

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
        
        // Model templates and materials (reusable to prevent memory leaks)
        this.gltfLoader = new GLTFLoader();
        this.buildingTemplates = {};
        this.sharedMaterials = {}; // Reuse materials instead of cloning
        this.treeTemplate = null;
        this.currentBuildingIndex = 0;
        this.modelsLoaded = false;
        
        // RESTORED: Improved building density tracking
        this.buildingDensity = {
            spacing: 12,                    // Fixed spacing every 12 units (no randomness)
            leftSide: { lastZ: 0 },         // Track last building position on left
            rightSide: { lastZ: 0 },        // Track last building position on right
            guaranteedCoverage: true        // Always spawn on both sides
        };
        
        // Building file names (all GLB models for visual quality)
        this.buildingFiles = [
            '001.glb', '002.glb', '006.glb', '007.glb', '008.glb', 
            '009.glb', '0010.glb', '0011.glb', '0012.glb'
        ];
        
        this.setupScene();
        this.setupLighting();
        this.createOptimizedRoad();
        this.loadSpecificModels();
        
        console.log('🔄 RESTORED DirectModelEnvironment with optimizations');
    }

    setGameController(gameController) {
        this.gameController = gameController;
    }

    setupScene() {
        this.scene.background = new THREE.Color(0xFFDAB9);
        // Removed fog to eliminate gray cloud effect - cleaner visual presentation
        // this.scene.fog = new THREE.Fog(0xFFDAB9, 40, 150);
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
        
        console.log('✅ Direct model environment setup complete');
    }

    async loadSpecificModels() {
        console.log('🏗️ Loading specific building and tree models...');
        
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

            // Load tree model with FIXED smaller scale for urban environment
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

            const results = await Promise.all([...buildingPromises, treePromise]);
            const successfulBuildings = results.filter(r => r && r !== 'tree');
            
            console.log(`🎯 Loaded ${successfulBuildings.length} buildings and ${results.includes('tree') ? '1 tree model' : 'no tree'}`);
            
            this.modelsLoaded = true;
            this.createConsistentUrbanScene();
            
        } catch (error) {
            console.error('Error loading models:', error);
            this.createFallbackScene();
        }
    }

    enhanceBuilding(building, filename) {
        // Apply African colors to buildings with SHARED materials to prevent memory leaks
        const africanColors = [
            0xFF6347, // Terracotta
            0x0047AB, // Bold blue
            0xFFD700, // Golden yellow
            0x663399, // Royal purple
            0x228B22, // Forest green
            0xDC143C  // Crimson red
        ];
        
        const buildingIndex = this.buildingFiles.indexOf(filename);
        const color = africanColors[buildingIndex % africanColors.length];
        
        // RESTORED: Create shared material for this building type to prevent memory leaks
        const materialKey = `building_${filename}_${color.toString(16)}`;
        if (!this.sharedMaterials[materialKey]) {
            this.sharedMaterials[materialKey] = new THREE.MeshStandardMaterial({
                color: new THREE.Color(color).multiplyScalar(0.8 + Math.random() * 0.2),
                roughness: 0.8,
                metalness: 0.0
            });
        }
        
        let meshCount = 0;
        building.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = false; // Performance optimization
                child.receiveShadow = true;
                
                // RESTORED: Use shared material instead of cloning (prevents memory leaks)
                if (child.material && meshCount % 4 === 0) {
                    child.material = this.sharedMaterials[materialKey];
                }
                
                meshCount++;
            }
        });
        
        console.log(`Enhanced ${filename} with ${meshCount} meshes, using shared material: ${materialKey}`);
    }

    enhanceTree(tree) {
        // RESTORED: Use shared materials for trees to prevent memory leaks
        if (!this.sharedMaterials.treeTrunk) {
            this.sharedMaterials.treeTrunk = new THREE.MeshStandardMaterial({
                color: 0x8B4513,
                roughness: 0.9
            });
        }
        if (!this.sharedMaterials.treeFoliage) {
            this.sharedMaterials.treeFoliage = new THREE.MeshStandardMaterial({
                color: 0x228B22,
                roughness: 0.8
            });
        }
        
        tree.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                // RESTORED: Use shared materials instead of cloning
                if (child.material) {
                    if (child.material.color.r < 0.5) {
                        child.material = this.sharedMaterials.treeFoliage; // Green foliage
                    } else {
                        child.material = this.sharedMaterials.treeTrunk; // Brown trunk
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

        // RESTORED: Keep vertical lane markings but remove horizontal crosswalk stripes
        context.fillStyle = '#505050'; // Slightly lighter road base
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Road texture details
        context.fillStyle = '#555555';
        for(let i = 0; i < 40; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const size = Math.random() * 2 + 1;
            context.fillRect(x, y, size, size);
        }

        // RESTORED: Vertical lane markings (these are good)
        context.fillStyle = '#FFFFFF';
        for(let i = 0; i < canvas.height; i += 25) {
            context.fillRect(canvas.width/3 - 1, i, 2, 12);
            context.fillRect((canvas.width * 2/3) - 1, i, 2, 12);
        }
        
        // Road edges
        context.fillStyle = '#FFDD00';
        context.fillRect(0, 0, 2, canvas.height);
        context.fillRect(canvas.width - 2, 0, 2, canvas.height);

        const roadTexture = new THREE.CanvasTexture(canvas);
        roadTexture.wrapS = THREE.RepeatWrapping;
        roadTexture.wrapT = THREE.RepeatWrapping;
        roadTexture.repeat.set(1, 100);

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

        this.createEnhancedSidewalks();
        this.ground = this.road;
        
        console.log('✅ Enhanced road created');
    }

    createEnhancedSidewalks() {
        // RESTORED: Better sidewalk definition
        const sidewalkGeometry = new THREE.PlaneGeometry(this.sidewalkWidth, 1500);
        const sidewalkMaterial = new THREE.MeshStandardMaterial({
            color: 0xC0C0C0, // Lighter concrete color
            roughness: 0.9,
            metalness: 0.0
        });
        
        // Left sidewalk
        const leftSidewalk = new THREE.Mesh(sidewalkGeometry, sidewalkMaterial);
        leftSidewalk.rotation.x = -Math.PI / 2;
        leftSidewalk.position.x = -(this.roadWidth/2 + this.sidewalkWidth/2);
        leftSidewalk.position.y = 0.02;
        leftSidewalk.receiveShadow = true;
        this.scene.add(leftSidewalk);
        
        // Right sidewalk
        const rightSidewalk = new THREE.Mesh(sidewalkGeometry, sidewalkMaterial.clone());
        rightSidewalk.rotation.x = -Math.PI / 2;
        rightSidewalk.position.x = (this.roadWidth/2 + this.sidewalkWidth/2);
        rightSidewalk.position.y = 0.02;
        rightSidewalk.receiveShadow = true;
        this.scene.add(rightSidewalk);
        
        // Store references for updating during gameplay
        this.pavements = [leftSidewalk, rightSidewalk];
        
        // RESTORED: Add curbs for better separation
        this.createCurbs();
    }

    createCurbs() {
        const curbHeight = 0.1;
        const curbWidth = 0.2;
        const curbLength = 1500;
        
        const curbGeometry = new THREE.BoxGeometry(curbWidth, curbHeight, curbLength);
        const curbMaterial = new THREE.MeshStandardMaterial({
            color: 0x808080,
            roughness: 0.9
        });
        
        // Left curb
        const leftCurb = new THREE.Mesh(curbGeometry, curbMaterial);
        leftCurb.position.x = -(this.roadWidth/2);
        leftCurb.position.y = curbHeight/2;
        leftCurb.castShadow = true;
        leftCurb.receiveShadow = true;
        this.scene.add(leftCurb);
        
        // Right curb
        const rightCurb = new THREE.Mesh(curbGeometry, curbMaterial.clone());
        rightCurb.position.x = (this.roadWidth/2);
        rightCurb.position.y = curbHeight/2;
        rightCurb.castShadow = true;
        rightCurb.receiveShadow = true;
        this.scene.add(rightCurb);
        
        // Store curb references for updating during gameplay
        this.curbs = [leftCurb, rightCurb];
        
        console.log('✅ Enhanced curbs created for better street definition');
    }

    // RESTORED: Create consistent urban scene with guaranteed coverage
    createConsistentUrbanScene() {
        if (!this.modelsLoaded) {
            console.log('Models not loaded yet, waiting...');
            setTimeout(() => this.createConsistentUrbanScene(), 1000);
            return;
        }
        
        console.log('🏙️ Creating CONSISTENT urban canyon with guaranteed building coverage...');
        
        // RESTORED: Guaranteed building coverage - spawn on EVERY position for both sides
        const spacing = this.buildingDensity.spacing;
        const numBuildings = 30; // More buildings for complete coverage
        
        for (let i = 0; i < numBuildings; i++) {
            const z = -20 - (i * spacing); // Consistent spacing, no randomness
            
            // GUARANTEED: Always spawn on both sides (no random chance)
            this.spawnConsistentBuilding(z, 'left');
            this.spawnConsistentBuilding(z, 'right');
            
            // Update tracking
            this.buildingDensity.leftSide.lastZ = z;
            this.buildingDensity.rightSide.lastZ = z;
        }
        
        // RESTORED: Small trees placement (FIXED size)
        for (let i = 0; i < 3; i++) {
            this.spawnSmallUrbanTree(-80 - (i * 80)); // 3 trees every 80 units - moderate spacing
        }
        
        console.log(`🎯 Created consistent urban canyon with ${numBuildings * 2} buildings`);
    }

    // RESTORED: Consistent building spawning with no randomness
    spawnConsistentBuilding(zPosition, side) {
        const loadedBuildings = Object.keys(this.buildingTemplates);
        if (loadedBuildings.length === 0) {
            this.createFallbackBuilding(zPosition, side);
            return;
        }
        
        // Cycle through buildings for variety but consistent placement
        const buildingKey = loadedBuildings[this.currentBuildingIndex % loadedBuildings.length];
        this.currentBuildingIndex++;
        
        const template = this.buildingTemplates[buildingKey];
        const building = template.clone();
        
        // RESTORED: Consistent scale with slight variation for realism
        const scale = 0.005 + Math.random() * 0.003; // 0.005 to 0.008 (good size)
        building.scale.setScalar(scale);
        
        building.rotation.y = 0; // Face forward
        
        // Calculate position for consistent urban canyon effect
        const bbox = new THREE.Box3().setFromObject(building);
        const size = bbox.getSize(new THREE.Vector3());
        const groundY = -bbox.min.y;
        
        // RESTORED: Consistent positioning for urban canyon effect (closer to street)
        let xOffset;
        if (side === 'left') {
            xOffset = -7 - Math.random() * 3; // X = -7 to -10 (closer than before)
            xOffset -= (size.x / 2);
        } else {
            xOffset = 7 + Math.random() * 3;  // X = +7 to +10 (closer than before)
            xOffset += (size.x / 2);
        }
        
        // Safety check
        if (Math.abs(xOffset) < 6) {
            xOffset = side === 'left' ? -10 : 10;
        }
        
        building.position.set(xOffset, groundY, zPosition);
        
        // Minimal rotation for variety
        building.rotation.y += (Math.random() - 0.5) * 0.2; // Less rotation
        
        this.scene.add(building);
        this.activeBuildings.push({
            object: building,
            zPosition: zPosition,
            type: buildingKey,
            scale: scale,
            side: side
        });

        // DEBUG: Log building details with material info
        let materialInfo = 'unknown';
        building.traverse((child) => {
            if (child.isMesh && child.material) {
                const color = child.material.color ? child.material.color.getHexString() : 'no-color';
                if (color.includes('808080') || color.includes('666666') || color.includes('999999')) {
                    console.warn(`🔍 GRAY MATERIAL DETECTED in ${buildingKey}: color=${color}`);
                    materialInfo = `GRAY-${color}`;
                }
            }
        });
        
        console.log(`Building ${buildingKey}: ${side} side, X=${xOffset.toFixed(1)}, Z=${zPosition}, scale=${scale.toFixed(4)}, materials=${materialInfo}`);
    }

    // RESTORED: FIXED small tree spawning
    spawnSmallUrbanTree(zPosition) {
        if (!this.treeTemplate) {
            console.log('Tree template not loaded');
            return;
        }
        
        const tree = this.treeTemplate.clone();
        
        // FIXED: Much smaller tree size (was 0.015-0.025, now 0.004-0.006)
        const scale = 0.004 + Math.random() * 0.002; // 0.004 to 0.006 (small but visible)
        tree.scale.setScalar(scale);
        
        const bbox = new THREE.Box3().setFromObject(tree);
        const groundY = -bbox.min.y;
        
        // RESTORED: Position trees well outside road area
        const side = Math.random() < 0.5 ? 'left' : 'right';
        let xOffset;
        
        if (side === 'left') {
            xOffset = -10; // Much further left - definitely off road
        } else {
            xOffset = 10;  // Much further right - definitely off road
        }
        
        tree.position.set(xOffset, groundY, zPosition);
        
        this.scene.add(tree);
        this.streetDecorations.push({
            object: tree,
            zPosition: zPosition,
            side: side
        });

        console.log(`🌳 FIXED Tree: ${side} side, X=${xOffset}, Z=${zPosition}, scale=${scale.toFixed(4)} (small!)`);
    }

    createFallbackBuilding(zPosition, side) {
        const height = 4 + Math.random() * 4;
        const width = 2 + Math.random() * 1.5;
        const depth = 2 + Math.random() * 1.5;
        
        const geometry = new THREE.BoxGeometry(width, height, depth);
        
        // RESTORED: Use shared materials for fallback buildings to prevent memory leaks
        const colors = [0xFF6347, 0x0047AB, 0xFFD700, 0x663399, 0x228B22];
        const colorIndex = Math.floor(Math.random() * colors.length);
        const materialKey = `fallback_${colorIndex}`;
        
        if (!this.sharedMaterials[materialKey]) {
            this.sharedMaterials[materialKey] = new THREE.MeshStandardMaterial({
                color: colors[colorIndex],
                roughness: 0.7
            });
        }
        
        const building = new THREE.Mesh(geometry, this.sharedMaterials[materialKey]);
        building.position.y = height / 2;
        building.castShadow = true;
        building.receiveShadow = true;
        
        // Consistent positioning
        let xOffset;
        if (side === 'left') {
            xOffset = -8 - Math.random() * 3;
            xOffset -= (width / 2);
        } else {
            xOffset = 8 + Math.random() * 3;
            xOffset += (width / 2);
        }
        
        if (Math.abs(xOffset) < 6) {
            xOffset = side === 'left' ? -10 : 10;
        }
        
        building.position.x = xOffset;
        building.position.z = zPosition;
        
        this.scene.add(building);
        this.activeBuildings.push({
            object: building,
            zPosition: zPosition,
            type: 'Fallback',
            scale: 1.0,
            side: side
        });
        
        console.log(`Fallback building: ${side} side, X=${xOffset.toFixed(1)}, Z=${zPosition}`);
    }

    createFallbackScene() {
        console.log('Creating consistent fallback urban scene...');
        const spacing = this.buildingDensity.spacing;
        
        for (let i = 0; i < 30; i++) {
            const z = -20 - (i * spacing);
            this.createFallbackBuilding(z, 'left');
            this.createFallbackBuilding(z, 'right');
        }
    }

    startSpawning() {
        this.continuousUrbanSpawning();
    }

    // RESTORED: Robust continuous spawning with better tracking
    continuousUrbanSpawning() {
        if (!this.gameController || !this.gameController.isGameActive()) {
            setTimeout(() => this.continuousUrbanSpawning(), 1000);
            return;
        }

        const playerZ = this.gameController.getPlayerPosition().z;
        const spawnDistance = 150; // Increased spawn distance for better coverage
        const spacing = this.buildingDensity.spacing;

        // RESTORED: More aggressive spawning logic - ensure buildings always spawn
        // Left side spawning
        if (this.buildingDensity.leftSide.lastZ > playerZ - spawnDistance) {
            const newZ = this.buildingDensity.leftSide.lastZ - spacing;
            this.spawnConsistentBuilding(newZ, 'left');
            this.buildingDensity.leftSide.lastZ = newZ;
        }

        // Right side spawning  
        if (this.buildingDensity.rightSide.lastZ > playerZ - spawnDistance) {
            const newZ = this.buildingDensity.rightSide.lastZ - spacing;
            this.spawnConsistentBuilding(newZ, 'right');
            this.buildingDensity.rightSide.lastZ = newZ;
        }

        // FALLBACK: If both sides haven't spawned in a while, force spawn
        const leftGap = playerZ - this.buildingDensity.leftSide.lastZ;
        const rightGap = playerZ - this.buildingDensity.rightSide.lastZ;
        
        if (leftGap > 50) { // If left side gap is too large, force spawn
            const forceZ = playerZ - 80;
            this.spawnConsistentBuilding(forceZ, 'left');
            this.buildingDensity.leftSide.lastZ = forceZ;
        }
        
        if (rightGap > 50) { // If right side gap is too large, force spawn
            const forceZ = playerZ - 80;
            this.spawnConsistentBuilding(forceZ, 'right');
            this.buildingDensity.rightSide.lastZ = forceZ;
        }

        // Spawn small trees occasionally
        if (Math.random() < 0.015) { // 1.5% chance - occasional but not rare
            this.spawnSmallUrbanTree(playerZ - 120);
        }

        // More frequent checking to prevent gaps
        setTimeout(() => {
            this.continuousUrbanSpawning();
        }, 500); // Check every 500ms
    }

    // RESTORED: Proper memory cleanup to prevent memory leaks
    disposeObject(object) {
        if (object.geometry) {
            object.geometry.dispose();
        }
        
        // Only dispose materials if they're not shared (to avoid disposing reused materials)
        if (object.material && !Object.values(this.sharedMaterials).includes(object.material)) {
            if (Array.isArray(object.material)) {
                object.material.forEach(material => {
                    if (material.map) material.map.dispose();
                    material.dispose();
                });
            } else {
                if (object.material.map) object.material.map.dispose();
                object.material.dispose();
            }
        }
        
        // Recursively dispose children
        if (object.children) {
            object.children.forEach(child => this.disposeObject(child));
        }
    }

    updateModels(gameSpeed, cameraZ) {
        // RESTORED: Update buildings with proper memory cleanup
        for (let i = this.activeBuildings.length - 1; i >= 0; i--) {
            const building = this.activeBuildings[i];
            building.object.position.z += gameSpeed;
            building.zPosition += gameSpeed;

            if (building.zPosition > cameraZ + 80) {
                // RESTORED: Proper cleanup before removal
                this.disposeObject(building.object);
                this.scene.remove(building.object);
                this.activeBuildings.splice(i, 1);
            }
        }

        // RESTORED: Update trees with proper memory cleanup
        for (let i = this.streetDecorations.length - 1; i >= 0; i--) {
            const decoration = this.streetDecorations[i];
            decoration.object.position.z += gameSpeed;
            decoration.zPosition += gameSpeed;

            if (decoration.zPosition > cameraZ + 40) {
                // RESTORED: Proper cleanup before removal
                this.disposeObject(decoration.object);
                this.scene.remove(decoration.object);
                this.streetDecorations.splice(i, 1);
            }
        }
    }

    updateGround(cameraZ) {
        // Update main road position
        if (this.road) {
            this.road.position.z = cameraZ - (this.road.geometry.parameters.height / 2) + 75;
        }
        
        // RESTORED: Update pavements to follow camera (prevents disappearing)
        if (this.pavements) {
            this.pavements.forEach(pavement => {
                pavement.position.z = cameraZ - (pavement.geometry.parameters.height / 2) + 75;
            });
        }
        
        // RESTORED: Update curbs to follow camera
        if (this.curbs) {
            this.curbs.forEach(curb => {
                curb.position.z = cameraZ - (curb.geometry.parameters.depth / 2) + 75;
            });
        }
    }

    reset() {
        // RESTORED: Proper cleanup with memory disposal
        this.activeBuildings.forEach(building => {
            this.disposeObject(building.object);
            this.scene.remove(building.object);
        });
        this.activeBuildings = [];

        this.streetDecorations.forEach(decoration => {
            this.disposeObject(decoration.object);
            this.scene.remove(decoration.object);
        });
        this.streetDecorations = [];

        this.currentBuildingIndex = 0;
        
        // Reset density tracking
        this.buildingDensity.leftSide.lastZ = 0;
        this.buildingDensity.rightSide.lastZ = 0;
        
        // Force garbage collection hint (if available)
        if (window.gc) {
            window.gc();
        }
        
        if (this.modelsLoaded) {
            this.createConsistentUrbanScene();
        }
        
        console.log('✅ Environment reset with proper memory cleanup');
    }

    getGround() {
        return this.road;
    }

    updateBuildings(gameSpeed, cameraZ) {
        this.updateModels(gameSpeed, cameraZ);
    }
}
