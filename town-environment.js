import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LANES, COLORS, SPAWN_CONFIG } from './constants.js';

export class TownEnvironment {
    constructor(scene) {
        this.scene = scene;
        this.ground = null;
        this.townScene = null;
        this.townScenes = []; // Array for multiple town scene instances
        this.streetDecorations = [];
        this.gameController = null;
        
        // GLB model loader
        this.gltfLoader = new GLTFLoader();
        this.isTownLoaded = false;
        this.townTemplate = null; // Store the town template for cloning
        
        this.setupScene();
        this.setupLighting();
        this.createGround();
        
        // Load town scene asynchronously
        this.loadTownScene();
    }

    setGameController(gameController) {
        this.gameController = gameController;
    }

    setupScene() {
        // Enhanced African sky with gradient effect
        const skyColors = {
            top: new THREE.Color(0xFF6B35),     // Vibrant orange-red (African sunset)
            middle: new THREE.Color(0xFFDAB9),  // Warm peach
            bottom: new THREE.Color(0x87CEEB)   // Light blue
        };
        
        // Create gradient sky
        this.scene.background = skyColors.middle;
        this.scene.fog = new THREE.Fog(skyColors.middle, 50, 200); // Extended fog for depth
    }

    setupLighting() {
        // Optimized lighting for town scene
        const ambientLight = new THREE.AmbientLight(0xFFE5B4, 0.8); // Slightly brighter ambient
        this.scene.add(ambientLight);

        // Main directional light
        const directionalLight = new THREE.DirectionalLight(0xFFFFE0, 0.7);
        directionalLight.position.set(10, 20, 15);
        directionalLight.castShadow = true;
        
        // Optimized shadow settings
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 1;
        directionalLight.shadow.camera.far = 100;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
        
        this.scene.add(directionalLight);
        
        console.log('Town environment lighting setup complete');
    }

    async loadTownScene() {
        try {
            console.log('Loading town scene from: ./assets/city/model/simple_town_scene.glb');
            const gltf = await this.gltfLoader.loadAsync('./assets/city/model/simple_town_scene.glb');
            
            // Store the town template for cloning
            this.townTemplate = gltf.scene;
            
            // Apply enhancements to the template
            this.enhanceTownScene(this.townTemplate);
            
            // Create the first town scene instance
            this.createTownInstance(0);
        
        // Also create some immediate simple buildings as backup
        this.createSimpleBuilding(-20);
        this.createSimpleBuilding(-40);
        this.createSimpleBuilding(-60);
            
            this.isTownLoaded = true;
            console.log('Town scene loaded successfully!');
            
        } catch (error) {
            console.error('Error loading town scene:', error);
            console.log('Creating fallback environment...');
            this.createFallbackEnvironment();
        }
    }

    enhanceTownScene(townScene) {
        // Apply African color themes and optimizations
        const africanColors = [
            0xFF6347, // Terracotta
            0x0047AB, // Bold blue
            0xFFD700, // Golden yellow
            0x663399, // Royal purple
            0x228B22, // Forest green
            0xDC143C  // Crimson red
        ];

        let buildingCount = 0;
        
        townScene.traverse((child) => {
            if (child.isMesh) {
                // Enable shadows
                child.castShadow = true;
                child.receiveShadow = true;
                
                // Apply African color themes to buildings
                if (child.material && buildingCount % 3 === 0) { // Every 3rd building gets color enhancement
                    child.material = child.material.clone();
                    const randomColor = africanColors[Math.floor(Math.random() * africanColors.length)];
                    child.material.color = new THREE.Color(randomColor);
                    child.material.color.multiplyScalar(0.7); // Tone down for realism
                }
                
                // Optimize materials
                if (child.material) {
                    child.material.roughness = Math.min(child.material.roughness || 0.5, 0.8);
                    child.material.metalness = Math.max(child.material.metalness || 0.1, 0.0);
                }
                
                buildingCount++;
            }
        });

        // Get bounding box for positioning
        const bbox = new THREE.Box3().setFromObject(townScene);
        const size = bbox.getSize(new THREE.Vector3());
        
        console.log(`Town scene enhanced: ${buildingCount} meshes, size: ${size.x.toFixed(1)} x ${size.y.toFixed(1)} x ${size.z.toFixed(1)}`);
    }

    createTownInstance(zPosition) {
        if (!this.townTemplate) return;

        // Clone the town template
        const townInstance = this.townTemplate.clone();
        
        // Get bounding box for proper positioning
        const bbox = new THREE.Box3().setFromObject(townInstance);
        const size = bbox.getSize(new THREE.Vector3());
        
        console.log(`Original town size: ${size.x.toFixed(1)} x ${size.y.toFixed(1)} x ${size.z.toFixed(1)}`);
        console.log(`Original bbox min Y: ${bbox.min.y.toFixed(1)}, max Y: ${bbox.max.y.toFixed(1)}`);
        
        // MUCH smaller scale for the massive town scene
        const scale = 0.01 + Math.random() * 0.005; // 0.01 to 0.015 scale (very small!)
        townInstance.scale.setScalar(scale);
        
        // Recalculate bbox after scaling
        const scaledBbox = new THREE.Box3().setFromObject(townInstance);
        const scaledSize = scaledBbox.getSize(new THREE.Vector3());
        
        // Position on ground level (Y = 0)
        const groundY = -scaledBbox.min.y; // This should put the bottom at Y=0
        
        // Position closer to the road for visibility
        const sideOffset = (this.townScenes.length % 2 === 0) ? -8 : 8; // Much closer: 8 units
        
        townInstance.position.set(sideOffset, groundY, zPosition);
        
        // Small rotation for variety
        townInstance.rotation.y = (Math.random() - 0.5) * 0.2;

        this.scene.add(townInstance);
        this.townScenes.push({
            object: townInstance,
            zPosition: zPosition,
            length: scaledSize.z
        });

        console.log(`Town instance: X=${sideOffset}, Y=${groundY.toFixed(1)}, Z=${zPosition}, scale=${scale.toFixed(3)}`);
        console.log(`Scaled size: ${scaledSize.x.toFixed(1)} x ${scaledSize.y.toFixed(1)} x ${scaledSize.z.toFixed(1)}`);
    }

    createFallbackEnvironment() {
        // Simple fallback if town scene fails to load
        console.log('Creating fallback environment...');
        
        for (let i = 0; i < 8; i++) {
            const z = -i * 40;
            this.createSimpleBuilding(z);
        }
    }

    createSimpleBuilding(zPosition) {
        const group = new THREE.Group();
        
        // Simple colorful building
        const height = 4 + Math.random() * 6;
        const width = 2 + Math.random() * 2;
        const depth = 2 + Math.random() * 2;
        
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({
            color: [0xFF6347, 0x0047AB, 0xFFD700, 0x663399, 0x228B22][Math.floor(Math.random() * 5)],
            roughness: 0.7,
            metalness: 0.1
        });
        
        const building = new THREE.Mesh(geometry, material);
        building.position.y = height / 2;
        building.castShadow = true;
        building.receiveShadow = true;
        group.add(building);
        
        // Position away from road
        const side = Math.random() < 0.5 ? -25 : 25;
        group.position.set(side, 0, zPosition);
        
        this.scene.add(group);
        this.townScenes.push({
            object: group,
            zPosition: zPosition,
            length: depth
        });
    }

    createGround() {
        // Enhanced road with African-inspired design (keeping your existing road system)
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const context = canvas.getContext('2d');

        // Create gradient road base with warm tones
        const gradient = context.createLinearGradient(0, 0, canvas.width, 0);
        gradient.addColorStop(0, '#4A4A4A');
        gradient.addColorStop(0.5, '#5A5A5A');
        gradient.addColorStop(1, '#4A4A4A');
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Add road texture with warm highlights
        context.fillStyle = '#6A6A6A';
        for(let i = 0; i < 100; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const size = Math.random() * 6 + 2;
            context.fillRect(x, y, size, size);
        }

        // Enhanced road markings with African-inspired patterns
        context.fillStyle = '#FFD700'; // Gold markings
        context.fillRect(canvas.width/2 - 3, 0, 6, canvas.height);
        
        // Add decorative side patterns
        context.fillStyle = '#FF6347'; // Terracotta accents
        for(let i = 0; i < canvas.height; i += 50) {
            context.fillRect(50, i, 20, 10);
            context.fillRect(canvas.width - 70, i, 20, 10);
        }

        const roadTexture = new THREE.CanvasTexture(canvas);
        roadTexture.wrapS = THREE.RepeatWrapping;
        roadTexture.wrapT = THREE.RepeatWrapping;
        roadTexture.repeat.set(3, 300);

        // Create main road
        const roadGeometry = new THREE.PlaneGeometry(LANES.POSITIONS[LANES.RIGHT] * 2 + 4, 1500);
        const roadMaterial = new THREE.MeshStandardMaterial({
            map: roadTexture,
            side: THREE.DoubleSide,
            roughness: 0.8,
            metalness: 0.1
        });
        
        this.road = new THREE.Mesh(roadGeometry, roadMaterial);
        this.road.rotation.x = -Math.PI / 2;
        this.road.receiveShadow = true;
        this.scene.add(this.road);

        // Create side areas with vibrant colors
        this.sideAreas = [];
        this.lastSideAreaZ = 0;
        this.spawnInitialSideAreas();

        this.ground = this.road;
    }

    createAfricanTree(x, z) {
        // Simple but effective tree for decoration
        const trunkHeight = 3 + Math.random() * 2;
        
        // Trunk
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
        const crownGeometry = new THREE.SphereGeometry(1.5, 8, 6);
        const crownMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x228B22,
            roughness: 0.8
        });
        const crown = new THREE.Mesh(crownGeometry, crownMaterial);
        crown.position.set(x, trunkHeight + 1, z);
        crown.castShadow = true;
        this.scene.add(crown);
        this.streetDecorations.push(crown);
    }

    spawnInitialSideAreas() {
        // Create colorful side areas
        for (let i = 0; i < 15; i++) {
            this.spawnSideAreaSegment(
                this.gameController ? 
                this.gameController.getPlayerPosition().z - i * SPAWN_CONFIG.SIDE_AREA_LENGTH : 
                -i * SPAWN_CONFIG.SIDE_AREA_LENGTH
            );
        }
    }

    spawnSideAreaSegment(currentZ) {
        const segmentLength = SPAWN_CONFIG.SIDE_AREA_LENGTH;
        const segmentWidth = SPAWN_CONFIG.SIDE_AREA_WIDTH;
        
        // African-inspired surface colors
        const colors = [0xFF6347, 0x32CD32, 0xFFD700, 0xDEB887, 0x663399];
        const color = colors[Math.floor(Math.random() * colors.length)];

        const geometry = new THREE.PlaneGeometry(segmentWidth, segmentLength);
        const material = new THREE.MeshStandardMaterial({ 
            color: color,
            side: THREE.DoubleSide,
            roughness: 0.8,
            metalness: 0.1
        });

        // Left side
        const leftArea = new THREE.Mesh(geometry, material);
        leftArea.rotation.x = -Math.PI / 2;
        leftArea.position.set(
            -(this.road.geometry.parameters.width / 2 + segmentWidth / 2), 
            0, 
            currentZ - segmentLength / 2
        );
        leftArea.receiveShadow = true;
        this.scene.add(leftArea);
        this.sideAreas.push(leftArea);

        // Right side
        const rightArea = new THREE.Mesh(geometry, material.clone());
        rightArea.rotation.x = -Math.PI / 2;
        rightArea.position.set(
            this.road.geometry.parameters.width / 2 + segmentWidth / 2, 
            0, 
            currentZ - segmentLength / 2
        );
        rightArea.receiveShadow = true;
        this.scene.add(rightArea);
        this.sideAreas.push(rightArea);

        this.lastSideAreaZ = currentZ - segmentLength;
    }

    startSpawning() {
        // Start spawning decorative elements
        this.spawnEnvironmentElements();
    }

    spawnEnvironmentElements() {
        if (!this.gameController || !this.gameController.isGameActive()) {
            return;
        }

        const playerZ = this.gameController.getPlayerPosition().z;
        const spawnZ = playerZ - 60; // Spawn ahead

        // Spawn trees occasionally
        if (Math.random() < 0.2) {
            const side = Math.random() < 0.5 ? 
                LANES.POSITIONS[LANES.LEFT] - 8 : 
                LANES.POSITIONS[LANES.RIGHT] + 8;
            this.createAfricanTree(side, spawnZ);
        }

        // Spawn new town scene instances as needed
        this.checkTownSceneSpawning(spawnZ);

        setTimeout(() => {
            this.spawnEnvironmentElements();
        }, 2000); // Spawn every 2 seconds
    }

    checkTownSceneSpawning(currentZ) {
        if (!this.isTownLoaded) return;

        // Check if we need to spawn a new town scene instance
        const lastTownZ = this.townScenes.length > 0 ? 
            Math.min(...this.townScenes.map(t => t.zPosition)) : 0;

        // Spawn new town scene more frequently (every 40 units instead of 100)
        if (currentZ < lastTownZ - 40) {
            this.createTownInstance(currentZ - 20); // Closer spawning
        }
    }

    updateModels(gameSpeed, cameraZ) {
        // Update town scenes - they move with the world
        for (let i = this.townScenes.length - 1; i >= 0; i--) {
            const townInstance = this.townScenes[i];
            townInstance.object.position.z += gameSpeed;
            townInstance.zPosition += gameSpeed;

            // Remove town scenes that are too far behind
            if (townInstance.zPosition > cameraZ + 100) {
                this.scene.remove(townInstance.object);
                this.townScenes.splice(i, 1);
            }
        }

        // Update street decorations
        for (let i = this.streetDecorations.length - 1; i >= 0; i--) {
            this.streetDecorations[i].position.z += gameSpeed;
            if (this.streetDecorations[i].position.z > cameraZ + 20) {
                this.scene.remove(this.streetDecorations[i]);
                this.streetDecorations.splice(i, 1);
            }
        }
    }

    updateGround(cameraZ) {
        // Update road position
        if (this.road) {
            this.road.position.z = cameraZ - (this.road.geometry.parameters.height / 2) + 50;
        }

        // Update side areas
        for (let i = this.sideAreas.length - 1; i >= 0; i--) {
            if (this.sideAreas[i].position.z > cameraZ + SPAWN_CONFIG.SIDE_AREA_DESPAWN_OFFSET) {
                this.scene.remove(this.sideAreas[i]);
                this.sideAreas.splice(i, 1);
            }
        }

        // Spawn new side area segments
        if (this.lastSideAreaZ > cameraZ - SPAWN_CONFIG.SIDE_AREA_SPAWN_TRIGGER_OFFSET) {
            this.spawnSideAreaSegment(this.lastSideAreaZ);
        }
    }

    reset() {
        // Clear all town scenes
        this.townScenes.forEach(townInstance => this.scene.remove(townInstance.object));
        this.townScenes = [];

        // Clear all street decorations
        this.streetDecorations.forEach(decoration => this.scene.remove(decoration));
        this.streetDecorations = [];

        // Clear all side areas
        this.sideAreas.forEach(area => this.scene.remove(area));
        this.sideAreas = [];
        
        this.lastSideAreaZ = 0;

        // Recreate initial town scene if loaded
        if (this.isTownLoaded) {
            this.createTownInstance(0);
        }
    }

    getGround() {
        return this.road;
    }

    // Legacy compatibility methods
    updateBuildings(gameSpeed, cameraZ) {
        this.updateModels(gameSpeed, cameraZ);
    }
}
