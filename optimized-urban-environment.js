import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LANES, COLORS, SPAWN_CONFIG } from './constants.js';

export class OptimizedUrbanEnvironment {
    constructor(scene) {
        this.scene = scene;
        this.ground = null;
        this.buildingPack = null;
        this.buildingTemplates = []; // Individual building assets from pack
        this.activeBuildings = []; // Currently spawned buildings
        this.streetDecorations = [];
        this.gameController = null;
        
        // Optimized road dimensions for 3-lane system
        this.roadWidth = 8; // Reduced from 12 to better fit [-2, 0, 2] lanes
        this.laneWidth = this.roadWidth / 3; // ~2.67 units per lane
        this.sidewalkWidth = 3; // Reduced sidewalk width
        
        // GLB model loader
        this.gltfLoader = new GLTFLoader();
        this.isPackLoaded = false;
        
        this.setupScene();
        this.setupLighting();
        this.createOptimizedRoad();
        
        // Load optimized building pack
        this.loadBuildingPack();
    }

    setGameController(gameController) {
        this.gameController = gameController;
    }

    setupScene() {
        // Lighter sky for better performance
        this.scene.background = new THREE.Color(0xFFDAB9); // Warm peach
        this.scene.fog = new THREE.Fog(0xFFDAB9, 40, 150); // Shorter fog distance
    }

    setupLighting() {
        // Simplified lighting for better performance
        const ambientLight = new THREE.AmbientLight(0xFFE5B4, 0.8);
        this.scene.add(ambientLight);

        // Single optimized directional light
        const directionalLight = new THREE.DirectionalLight(0xFFFFE0, 0.6);
        directionalLight.position.set(10, 15, 10);
        directionalLight.castShadow = true;
        
        // Reduced shadow quality for performance
        directionalLight.shadow.mapSize.width = 1024; // Reduced from 2048
        directionalLight.shadow.mapSize.height = 1024;
        directionalLight.shadow.camera.near = 1;
        directionalLight.shadow.camera.far = 80; // Reduced range
        directionalLight.shadow.camera.left = -40;
        directionalLight.shadow.camera.right = 40;
        directionalLight.shadow.camera.top = 40;
        directionalLight.shadow.camera.bottom = -40;
        
        this.scene.add(directionalLight);
        
        console.log('Optimized lighting setup for better performance');
    }

    async loadBuildingPack() {
        try {
            console.log('Loading optimized building pack...');
            const gltf = await this.gltfLoader.loadAsync('./assets/city/model/simple_town_pack.glb');
            
            this.buildingPack = gltf.scene;
            
            // Extract individual building templates from pack
            this.extractBuildingTemplates(this.buildingPack);
            
            // Create initial buildings
            this.spawnInitialBuildings();
            
            this.isPackLoaded = true;
            console.log(`Building pack loaded! ${this.buildingTemplates.length} building types available`);
            
        } catch (error) {
            console.error('Error loading building pack:', error);
            console.log('Creating simple fallback buildings...');
            this.createSimpleFallbackBuildings();
        }
    }

    extractBuildingTemplates(pack) {
        this.buildingTemplates = [];
        
        // Look for individual building objects in the pack
        pack.traverse((child) => {
            if (child.isGroup && child.children.length > 0) {
                // Each group likely represents a building
                const building = child.clone();
                
                // Apply African colors
                this.enhanceBuilding(building);
                
                // Store as template
                this.buildingTemplates.push(building);
            } else if (child.isMesh && child.geometry) {
                // Individual mesh buildings
                const building = child.clone();
                this.enhanceBuilding(building);
                this.buildingTemplates.push(building);
            }
        });
        
        console.log(`Extracted ${this.buildingTemplates.length} building templates from pack`);
    }

    enhanceBuilding(building) {
        const africanColors = [0xFF6347, 0x0047AB, 0xFFD700, 0x663399, 0x228B22, 0xDC143C];
        const randomColor = africanColors[Math.floor(Math.random() * africanColors.length)];
        
        building.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                if (child.material && Math.random() < 0.6) { // 60% chance for color
                    child.material = child.material.clone();
                    child.material.color = new THREE.Color(randomColor);
                    child.material.color.multiplyScalar(0.75);
                }
            }
        });
    }

    createOptimizedRoad() {
        // Create road texture with proper lane markings for 3 lanes
        const canvas = document.createElement('canvas');
        canvas.width = 256; // Reduced from 512 for performance
        canvas.height = 256;
        const context = canvas.getContext('2d');

        // Asphalt base
        context.fillStyle = '#404040';
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Road texture (lighter for performance)
        context.fillStyle = '#4A4A4A';
        for(let i = 0; i < 50; i++) { // Reduced from 120
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const size = Math.random() * 3 + 1;
            context.fillRect(x, y, size, size);
        }

        // Clear 3-lane markings aligned with LANES.POSITIONS [-2, 0, 2]
        // Lane positions: Left lane center at 1/6, Center at 3/6 (half), Right at 5/6
        
        // Lane divider lines (white dashed)
        context.fillStyle = '#FFFFFF';
        for(let i = 0; i < canvas.height; i += 20) { // Smaller dashes
            // Left lane divider (at 1/3)
            context.fillRect(canvas.width/3 - 1, i, 2, 10);
            // Right lane divider (at 2/3)  
            context.fillRect((canvas.width * 2/3) - 1, i, 2, 10);
        }
        
        // Road edges (yellow solid)
        context.fillStyle = '#FFDD00';
        context.fillRect(0, 0, 3, canvas.height); // Left edge
        context.fillRect(canvas.width - 3, 0, 3, canvas.height); // Right edge

        const roadTexture = new THREE.CanvasTexture(canvas);
        roadTexture.wrapS = THREE.RepeatWrapping;
        roadTexture.wrapT = THREE.RepeatWrapping;
        roadTexture.repeat.set(1, 150); // Adjusted repeat for proper lane marking size

        // Optimized road geometry - proper width for 3 lanes
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

        // Create sidewalks
        this.createOptimizedSidewalks();

        this.ground = this.road;
        console.log(`Optimized road created: ${this.roadWidth}m wide with clear 3-lane markings`);
    }

    createOptimizedSidewalks() {
        // Simplified sidewalks
        const sidewalkGeometry = new THREE.PlaneGeometry(this.sidewalkWidth, 1500);
        const sidewalkMaterial = new THREE.MeshStandardMaterial({
            color: 0xB0B0B0,
            roughness: 0.9
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
    }

    spawnInitialBuildings() {
        // Spawn a few buildings immediately for visual content
        for (let i = 0; i < 4; i++) {
            this.spawnBuilding(-20 - (i * 30));
        }
    }

    spawnBuilding(zPosition) {
        if (this.buildingTemplates.length === 0) {
            this.createSimpleBuilding(zPosition);
            return;
        }
        
        // Select random building template
        const template = this.buildingTemplates[Math.floor(Math.random() * this.buildingTemplates.length)];
        const building = template.clone();
        
        // Reasonable scale for pack buildings
        const scale = 0.8 + Math.random() * 0.6; // 0.8 to 1.4 scale
        building.scale.setScalar(scale);
        
        // Position calculation
        const bbox = new THREE.Box3().setFromObject(building);
        const groundY = -bbox.min.y;
        
        // Position behind sidewalks with proper urban setback
        const side = Math.random() < 0.5 ? 'left' : 'right';
        const setback = 6 + Math.random() * 4; // 6-10 units from road edge
        const xOffset = side === 'left' ? 
            -(this.roadWidth/2 + this.sidewalkWidth + setback) : 
            (this.roadWidth/2 + this.sidewalkWidth + setback);
        
        building.position.set(xOffset, groundY, zPosition);
        
        // Small rotation for variety
        building.rotation.y = (Math.random() - 0.5) * 0.2;
        
        this.scene.add(building);
        this.activeBuildings.push({
            object: building,
            zPosition: zPosition
        });

        console.log(`Building spawned at X: ${xOffset.toFixed(1)}, Z: ${zPosition}, scale: ${scale.toFixed(2)}`);
    }

    createSimpleBuilding(zPosition) {
        // Performance-optimized simple building
        const height = 3 + Math.random() * 4;
        const width = 2 + Math.random() * 2;
        const depth = 2 + Math.random() * 2;
        
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({
            color: [0xFF6347, 0x0047AB, 0xFFD700, 0x663399, 0x228B22][Math.floor(Math.random() * 5)],
            roughness: 0.7
        });
        
        const building = new THREE.Mesh(geometry, material);
        building.position.y = height / 2;
        building.castShadow = true;
        building.receiveShadow = true;
        
        // Position properly behind sidewalks
        const side = Math.random() < 0.5 ? 'left' : 'right';
        const setback = 6 + Math.random() * 3;
        const xOffset = side === 'left' ? 
            -(this.roadWidth/2 + this.sidewalkWidth + setback) : 
            (this.roadWidth/2 + this.sidewalkWidth + setback);
        
        building.position.x = xOffset;
        building.position.z = zPosition;
        
        this.scene.add(building);
        this.activeBuildings.push({
            object: building,
            zPosition: zPosition
        });
    }

    createSimpleFallbackBuildings() {
        // Create immediate simple buildings if pack loading fails
        for (let i = 0; i < 6; i++) {
            this.createSimpleBuilding(-i * 25);
        }
    }

    startSpawning() {
        this.spawnUrbanElements();
    }

    spawnUrbanElements() {
        if (!this.gameController || !this.gameController.isGameActive()) {
            return;
        }

        const playerZ = this.gameController.getPlayerPosition().z;
        const spawnZ = playerZ - 60;

        // Spawn buildings less frequently for performance
        if (Math.random() < 0.3) { // 30% chance
            this.spawnBuilding(spawnZ);
        }

        // Occasional street decoration
        if (Math.random() < 0.2) { // 20% chance
            this.createStreetTree(spawnZ);
        }

        setTimeout(() => {
            this.spawnUrbanElements();
        }, 3000); // Every 3 seconds (less frequent)
    }

    createStreetTree(zPosition) {
        // Simple tree for performance
        const trunkHeight = 2.5 + Math.random() * 1;
        
        const trunkGeometry = new THREE.CylinderGeometry(0.15, 0.2, trunkHeight, 6);
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.set(
            Math.random() < 0.5 ? -(this.roadWidth/2 + 2) : (this.roadWidth/2 + 2),
            trunkHeight / 2,
            zPosition
        );
        trunk.castShadow = true;
        this.scene.add(trunk);
        this.streetDecorations.push(trunk);

        // Simple crown
        const crownGeometry = new THREE.SphereGeometry(1, 6, 4);
        const crownMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.8 });
        const crown = new THREE.Mesh(crownGeometry, crownMaterial);
        crown.position.set(trunk.position.x, trunkHeight + 0.7, zPosition);
        crown.castShadow = true;
        this.scene.add(crown);
        this.streetDecorations.push(crown);
    }

    updateModels(gameSpeed, cameraZ) {
        // Update buildings
        for (let i = this.activeBuildings.length - 1; i >= 0; i--) {
            const building = this.activeBuildings[i];
            building.object.position.z += gameSpeed;
            building.zPosition += gameSpeed;

            // Remove buildings that are far behind
            if (building.zPosition > cameraZ + 80) {
                this.scene.remove(building.object);
                this.activeBuildings.splice(i, 1);
            }
        }

        // Update street decorations
        for (let i = this.streetDecorations.length - 1; i >= 0; i--) {
            this.streetDecorations[i].position.z += gameSpeed;
            if (this.streetDecorations[i].position.z > cameraZ + 25) {
                this.scene.remove(this.streetDecorations[i]);
                this.streetDecorations.splice(i, 1);
            }
        }
    }

    updateGround(cameraZ) {
        // Update road position
        if (this.road) {
            this.road.position.z = cameraZ - (this.road.geometry.parameters.height / 2) + 75;
        }
    }

    reset() {
        // Clear all buildings
        this.activeBuildings.forEach(building => this.scene.remove(building.object));
        this.activeBuildings = [];

        // Clear all street decorations
        this.streetDecorations.forEach(decoration => this.scene.remove(decoration));
        this.streetDecorations = [];

        // Respawn initial buildings if pack is loaded
        if (this.isPackLoaded) {
            this.spawnInitialBuildings();
        }
    }

    getGround() {
        return this.road;
    }

    // Legacy compatibility
    updateBuildings(gameSpeed, cameraZ) {
        this.updateModels(gameSpeed, cameraZ);
    }
}
