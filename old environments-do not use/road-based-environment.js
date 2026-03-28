import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { LANES, COLORS, SPAWN_CONFIG } from './constants.js';

export class RoadBasedEnvironment {
    constructor(scene) {
        this.scene = scene;
        this.ground = null;
        this.townTemplate = null;
        this.roadCorridors = []; // Consistent road segments
        this.streetDecorations = [];
        this.gameController = null;
        
        // Road-based positioning
        this.mainRoadDirection = new THREE.Vector3(0, 0, -1); // Player runs toward -Z
        this.roadWidth = 12; // Width of the main road corridor
        this.sidewalkWidth = 4; // Width of sidewalks on each side
        
        // GLB model loader
        this.gltfLoader = new GLTFLoader();
        
        // Setup DRACO loader for compressed GLB files
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        this.gltfLoader.setDRACOLoader(dracoLoader);
        
        this.isTownLoaded = false;
        
        // Town scene analysis
        this.roadSegments = []; // Identified road segments from the town
        this.currentRoadIndex = 0;
        
        this.setupScene();
        this.setupLighting();
        this.createMainRoad();
        
        // Load and analyze town scene
        this.loadAndAnalyzeTownScene();
    }

    setGameController(gameController) {
        this.gameController = gameController;
    }

    setupScene() {
        // Enhanced African sky
        const skyColors = {
            top: new THREE.Color(0xFF6B35),     // Vibrant orange-red
            middle: new THREE.Color(0xFFDAB9),  // Warm peach
            bottom: new THREE.Color(0x87CEEB)   // Light blue
        };
        
        this.scene.background = skyColors.middle;
        this.scene.fog = new THREE.Fog(skyColors.middle, 60, 250); // Extended for urban depth
    }

    setupLighting() {
        // Urban lighting setup
        const ambientLight = new THREE.AmbientLight(0xFFE5B4, 0.7);
        this.scene.add(ambientLight);

        // Main directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xFFFFE0, 0.8);
        directionalLight.position.set(15, 25, 20);
        directionalLight.castShadow = true;
        
        // Optimized shadow settings for urban environment
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 1;
        directionalLight.shadow.camera.far = 150;
        directionalLight.shadow.camera.left = -60;
        directionalLight.shadow.camera.right = 60;
        directionalLight.shadow.camera.top = 60;
        directionalLight.shadow.camera.bottom = -60;
        
        this.scene.add(directionalLight);
        
        console.log('Road-based environment lighting setup complete');
    }

    async loadAndAnalyzeTownScene() {
        try {
            console.log('Loading and analyzing town scene for road extraction...');
            const gltf = await this.gltfLoader.loadAsync('./assets/city/model/simple_town_scene.glb');
            
            this.townTemplate = gltf.scene;
            
            // Analyze the town structure to find road corridors
            this.analyzeRoadStructure(this.townTemplate);
            
            // Apply urban enhancements
            this.enhanceUrbanEnvironment(this.townTemplate);
            
            // Create the first road corridor
            this.createRoadCorridor(0);
            
            this.isTownLoaded = true;
            console.log('Town scene loaded and road analysis complete!');
            
        } catch (error) {
            console.error('Error loading town scene:', error);
            this.createFallbackUrbanCorridor();
        }
    }

    analyzeRoadStructure(townScene) {
        // Analyze the town scene to identify potential road corridors
        const bbox = new THREE.Box3().setFromObject(townScene);
        const size = bbox.getSize(new THREE.Vector3());
        const center = bbox.getCenter(new THREE.Vector3());
        
        console.log(`Town analysis: Size ${size.x.toFixed(1)} x ${size.z.toFixed(1)}, Center: ${center.x.toFixed(1)}, ${center.z.toFixed(1)}`);
        
        // Define multiple road segments through the town
        // These represent different "streets" the player can run down
        this.roadSegments = [
            {
                name: "Main Avenue",
                startOffset: { x: 0, z: 0 },
                direction: { x: 0, z: -1 }, // Running toward -Z
                buildingStyle: "mixed",
                description: "Primary commercial street"
            },
            {
                name: "Market Street", 
                startOffset: { x: -200, z: 0 },
                direction: { x: 0, z: -1 },
                buildingStyle: "commercial",
                description: "Bustling market area"
            },
            {
                name: "Residential Boulevard",
                startOffset: { x: 200, z: 0 },
                direction: { x: 0, z: -1 },
                buildingStyle: "residential", 
                description: "Quiet residential area"
            },
            {
                name: "Industrial Corridor",
                startOffset: { x: -400, z: 0 },
                direction: { x: 0, z: -1 },
                buildingStyle: "industrial",
                description: "Industrial and warehouse district"
            }
        ];
        
        console.log(`Identified ${this.roadSegments.length} potential road corridors`);
    }

    enhanceUrbanEnvironment(townScene) {
        // Apply consistent African urban colors and materials
        const urbanColorPalettes = {
            commercial: [0xFF6347, 0xFFD700, 0x0047AB], // Terracotta, gold, blue
            residential: [0x228B22, 0xDEB887, 0x663399], // Green, beige, purple
            industrial: [0x696969, 0x8B4513, 0xDC143C],  // Gray, brown, red
            mixed: [0xFF6347, 0x0047AB, 0xFFD700, 0x228B22, 0x663399] // All colors
        };

        let meshCount = 0;
        
        townScene.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                // Apply urban color scheme based on position
                if (child.material && meshCount % 4 === 0) { // Every 4th mesh gets color
                    child.material = child.material.clone();
                    const colors = urbanColorPalettes.mixed;
                    const randomColor = colors[Math.floor(Math.random() * colors.length)];
                    child.material.color = new THREE.Color(randomColor);
                    child.material.color.multiplyScalar(0.8); // Tone down for realism
                }
                
                meshCount++;
            }
        });
        
        console.log(`Enhanced ${meshCount} urban meshes with African color themes`);
    }

    createRoadCorridor(zPosition) {
        if (!this.townTemplate || this.roadSegments.length === 0) {
            this.createFallbackUrbanCorridor(zPosition);
            return;
        }

        // Select which road segment to use (cycle through them)
        const roadSegment = this.roadSegments[this.currentRoadIndex % this.roadSegments.length];
        this.currentRoadIndex++;
        
        // Clone the town template
        const corridorInstance = this.townTemplate.clone();
        
        // Calculate appropriate scale (much smaller than before)
        const scale = 0.008 + Math.random() * 0.004; // 0.008 to 0.012 scale
        corridorInstance.scale.setScalar(scale);
        
        // Position the corridor to create a proper street view
        const bbox = new THREE.Box3().setFromObject(corridorInstance);
        const groundY = -bbox.min.y;
        
        // Position based on the selected road segment
        const offsetX = roadSegment.startOffset.x * scale;
        const offsetZ = roadSegment.startOffset.z * scale;
        
        corridorInstance.position.set(offsetX, groundY, zPosition + offsetZ);
        
        // Orient the corridor so roads align with player movement
        corridorInstance.rotation.y = Math.atan2(roadSegment.direction.x, roadSegment.direction.z);
        
        this.scene.add(corridorInstance);
        this.roadCorridors.push({
            object: corridorInstance,
            zPosition: zPosition,
            roadSegment: roadSegment,
            length: 100 // Estimated corridor length
        });

        console.log(`Road corridor "${roadSegment.name}" created at Z: ${zPosition}, scale: ${scale.toFixed(3)}`);
        
        // Add road-specific decorations
        this.addStreetFurniture(zPosition, roadSegment.buildingStyle);
    }

    addStreetFurniture(zPosition, style) {
        // Add street-appropriate elements based on the road style
        const furnitureSpacing = 15 + Math.random() * 10; // 15-25 units apart
        
        for (let i = 0; i < 3; i++) {
            const furnitureZ = zPosition - (i * furnitureSpacing);
            
            switch (style) {
                case 'commercial':
                    this.createStreetLight(LANES.POSITIONS[LANES.LEFT] - 6, furnitureZ);
                    this.createStreetLight(LANES.POSITIONS[LANES.RIGHT] + 6, furnitureZ);
                    break;
                case 'residential':
                    if (Math.random() < 0.7) this.createAfricanTree(LANES.POSITIONS[LANES.LEFT] - 5, furnitureZ);
                    if (Math.random() < 0.7) this.createAfricanTree(LANES.POSITIONS[LANES.RIGHT] + 5, furnitureZ);
                    break;
                case 'industrial':
                    if (Math.random() < 0.4) this.createUtilityPole(LANES.POSITIONS[LANES.RIGHT] + 8, furnitureZ);
                    break;
                default: // mixed
                    if (Math.random() < 0.5) {
                        this.createAfricanTree(LANES.POSITIONS[LANES.LEFT] - 5, furnitureZ);
                    } else {
                        this.createStreetLight(LANES.POSITIONS[LANES.LEFT] - 6, furnitureZ);
                    }
            }
        }
    }

    createStreetLight(x, z) {
        const group = new THREE.Group();
        
        // Pole
        const poleGeometry = new THREE.CylinderGeometry(0.1, 0.15, 4, 8);
        const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x404040, roughness: 0.8 });
        const pole = new THREE.Mesh(poleGeometry, poleMaterial);
        pole.position.y = 2;
        pole.castShadow = true;
        group.add(pole);
        
        // Light fixture
        const lightGeometry = new THREE.SphereGeometry(0.3, 8, 6);
        const lightMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xFFE5B4, 
            emissive: 0x332211,
            roughness: 0.3 
        });
        const light = new THREE.Mesh(lightGeometry, lightMaterial);
        light.position.y = 4.2;
        group.add(light);
        
        group.position.set(x, 0, z);
        this.scene.add(group);
        this.streetDecorations.push(group);
    }

    createUtilityPole(x, z) {
        const poleGeometry = new THREE.CylinderGeometry(0.15, 0.2, 6, 8);
        const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 });
        const pole = new THREE.Mesh(poleGeometry, poleMaterial);
        pole.position.set(x, 3, z);
        pole.castShadow = true;
        this.scene.add(pole);
        this.streetDecorations.push(pole);
    }

    createAfricanTree(x, z) {
        // Street-appropriate tree
        const trunkHeight = 3 + Math.random() * 1.5;
        
        const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, trunkHeight, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x8B4513,
            roughness: 0.9
        });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.set(x, trunkHeight / 2, z);
        trunk.castShadow = true;
        this.scene.add(trunk);
        this.streetDecorations.push(trunk);

        // Crown
        const crownGeometry = new THREE.SphereGeometry(1.2, 8, 6);
        const crownMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x228B22,
            roughness: 0.8
        });
        const crown = new THREE.Mesh(crownGeometry, crownMaterial);
        crown.position.set(x, trunkHeight + 0.8, z);
        crown.castShadow = true;
        this.scene.add(crown);
        this.streetDecorations.push(crown);
    }

    createMainRoad() {
        // Create the main road that the player runs on
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const context = canvas.getContext('2d');

        // Asphalt base
        const gradient = context.createLinearGradient(0, 0, canvas.width, 0);
        gradient.addColorStop(0, '#3A3A3A');
        gradient.addColorStop(0.5, '#4A4A4A');
        gradient.addColorStop(1, '#3A3A3A');
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Road texture
        context.fillStyle = '#5A5A5A';
        for(let i = 0; i < 120; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const size = Math.random() * 4 + 1;
            context.fillRect(x, y, size, size);
        }

        // Lane markings - align with LANES.POSITIONS [-2, 0, 2]
        context.fillStyle = '#FFFF00'; // Yellow center line at lane 0
        context.fillRect(canvas.width/2 - 2, 0, 4, canvas.height);
        
        // Lane dividers - white dashed lines between lanes
        context.fillStyle = '#FFFFFF';
        for(let i = 0; i < canvas.height; i += 40) {
            // Left lane divider (between lanes -2 and 0)
            context.fillRect(canvas.width/3 - 1, i, 2, 20);
            // Right lane divider (between lanes 0 and 2)
            context.fillRect((canvas.width * 2/3) - 1, i, 2, 20);
        }
        
        // Road edges
        context.fillStyle = '#FFFF00';
        context.fillRect(2, 0, 2, canvas.height); // Left edge
        context.fillRect(canvas.width - 4, 0, 2, canvas.height); // Right edge

        const roadTexture = new THREE.CanvasTexture(canvas);
        roadTexture.wrapS = THREE.RepeatWrapping;
        roadTexture.wrapT = THREE.RepeatWrapping;
        roadTexture.repeat.set(2, 400);

        // Main road geometry - proper urban street width
        const roadGeometry = new THREE.PlaneGeometry(this.roadWidth, 2000);
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
        this.createSidewalks();

        this.ground = this.road;
        console.log(`Main road created: ${this.roadWidth}m wide with proper urban markings`);
    }

    createSidewalks() {
        // Left sidewalk
        const sidewalkGeometry = new THREE.PlaneGeometry(this.sidewalkWidth, 2000);
        const sidewalkMaterial = new THREE.MeshStandardMaterial({
            color: 0xC0C0C0,
            roughness: 0.9,
            metalness: 0.0
        });
        
        const leftSidewalk = new THREE.Mesh(sidewalkGeometry, sidewalkMaterial);
        leftSidewalk.rotation.x = -Math.PI / 2;
        leftSidewalk.position.x = -(this.roadWidth/2 + this.sidewalkWidth/2);
        leftSidewalk.position.y = 0.05; // Slightly raised
        leftSidewalk.receiveShadow = true;
        this.scene.add(leftSidewalk);
        
        // Right sidewalk
        const rightSidewalk = new THREE.Mesh(sidewalkGeometry, sidewalkMaterial.clone());
        rightSidewalk.rotation.x = -Math.PI / 2;
        rightSidewalk.position.x = (this.roadWidth/2 + this.sidewalkWidth/2);
        rightSidewalk.position.y = 0.05;
        rightSidewalk.receiveShadow = true;
        this.scene.add(rightSidewalk);

        console.log('Sidewalks created alongside main road');
    }

    createFallbackUrbanCorridor(zPosition = 0) {
        // Create a simple urban corridor if town scene fails
        console.log('Creating fallback urban corridor...');
        
        const buildingTypes = ['office', 'residential', 'commercial', 'mixed'];
        const selectedType = buildingTypes[Math.floor(Math.random() * buildingTypes.length)];
        
        for (let i = 0; i < 6; i++) {
            const side = i % 2 === 0 ? 'left' : 'right';
            const buildingZ = zPosition - (i * 20);
            this.createUrbanBuilding(buildingZ, side, selectedType);
        }
    }

    createUrbanBuilding(zPosition, side, type) {
        const group = new THREE.Group();
        
        // Building dimensions based on type
        let width, height, depth, color;
        
        switch(type) {
            case 'office':
                width = 4 + Math.random() * 3;
                height = 8 + Math.random() * 6;
                depth = 3 + Math.random() * 2;
                color = [0x0047AB, 0x696969, 0xC0C0C0][Math.floor(Math.random() * 3)];
                break;
            case 'residential':
                width = 3 + Math.random() * 2;
                height = 4 + Math.random() * 3;
                depth = 3 + Math.random() * 2;
                color = [0xFF6347, 0xFFD700, 0x228B22][Math.floor(Math.random() * 3)];
                break;
            case 'commercial':
                width = 5 + Math.random() * 2;
                height = 3 + Math.random() * 2;
                depth = 4 + Math.random() * 2;
                color = [0xDC143C, 0x663399, 0xFFD700][Math.floor(Math.random() * 3)];
                break;
            default: // mixed
                width = 3 + Math.random() * 3;
                height = 4 + Math.random() * 5;
                depth = 3 + Math.random() * 2;
                color = [0xFF6347, 0x0047AB, 0xFFD700, 0x228B22, 0x663399][Math.floor(Math.random() * 5)];
        }
        
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.7,
            metalness: 0.1
        });
        
        const building = new THREE.Mesh(geometry, material);
        building.position.y = height / 2;
        building.castShadow = true;
        building.receiveShadow = true;
        group.add(building);
        
        // Position on proper side of street with setback
        const setback = 8 + Math.random() * 4; // 8-12 units from road edge
        const xOffset = side === 'left' ? 
            -(this.roadWidth/2 + this.sidewalkWidth + setback) : 
            (this.roadWidth/2 + this.sidewalkWidth + setback);
        
        group.position.set(xOffset, 0, zPosition);
        
        this.scene.add(group);
        this.roadCorridors.push({
            object: group,
            zPosition: zPosition,
            roadSegment: { name: `Fallback ${type}`, buildingStyle: type },
            length: depth
        });
        
        console.log(`${type} building created at X: ${xOffset.toFixed(1)}, Z: ${zPosition}`);
    }

    startSpawning() {
        this.spawnUrbanElements();
    }

    spawnUrbanElements() {
        if (!this.gameController || !this.gameController.isGameActive()) {
            return;
        }

        const playerZ = this.gameController.getPlayerPosition().z;
        const spawnZ = playerZ - 80; // Spawn ahead

        // Spawn new road corridors as needed
        this.checkRoadCorridorSpawning(spawnZ);

        setTimeout(() => {
            this.spawnUrbanElements();
        }, 2500); // Spawn every 2.5 seconds
    }

    checkRoadCorridorSpawning(currentZ) {
        // Check if we need to spawn a new road corridor
        const lastCorridorZ = this.roadCorridors.length > 0 ? 
            Math.min(...this.roadCorridors.map(c => c.zPosition)) : 0;

        // Spawn new corridor every 60 units to maintain consistency
        if (currentZ < lastCorridorZ - 60) {
            if (this.isTownLoaded) {
                this.createRoadCorridor(currentZ - 30);
            } else {
                this.createFallbackUrbanCorridor(currentZ - 30);
            }
        }
    }

    updateModels(gameSpeed, cameraZ) {
        // Update road corridors
        for (let i = this.roadCorridors.length - 1; i >= 0; i--) {
            const corridor = this.roadCorridors[i];
            corridor.object.position.z += gameSpeed;
            corridor.zPosition += gameSpeed;

            // Remove corridors that are too far behind
            if (corridor.zPosition > cameraZ + 120) {
                this.scene.remove(corridor.object);
                this.roadCorridors.splice(i, 1);
            }
        }

        // Update street decorations
        for (let i = this.streetDecorations.length - 1; i >= 0; i--) {
            this.streetDecorations[i].position.z += gameSpeed;
            if (this.streetDecorations[i].position.z > cameraZ + 30) {
                this.scene.remove(this.streetDecorations[i]);
                this.streetDecorations.splice(i, 1);
            }
        }
    }

    updateGround(cameraZ) {
        // Update main road position
        if (this.road) {
            this.road.position.z = cameraZ - (this.road.geometry.parameters.height / 2) + 100;
        }
    }

    reset() {
        // Clear all road corridors
        this.roadCorridors.forEach(corridor => this.scene.remove(corridor.object));
        this.roadCorridors = [];

        // Clear all street decorations  
        this.streetDecorations.forEach(decoration => this.scene.remove(decoration));
        this.streetDecorations = [];
        
        // Reset road index
        this.currentRoadIndex = 0;

        // Recreate initial corridor if town is loaded
        if (this.isTownLoaded) {
            this.createRoadCorridor(0);
        }
    }

    getGround() {
        return this.road;
    }

    // Legacy compatibility
    updateBuildings(gameSpeed, cameraZ) {
        this.updateModels(gameSpeed, cameraZ);
    }

    // Public method to get current road info (for future unlocking)
    getCurrentRoadInfo() {
        const currentSegment = this.roadSegments[this.currentRoadIndex % this.roadSegments.length];
        return {
            roadName: currentSegment?.name || "Unknown Street",
            description: currentSegment?.description || "Urban corridor",
            style: currentSegment?.buildingStyle || "mixed"
        };
    }
}
