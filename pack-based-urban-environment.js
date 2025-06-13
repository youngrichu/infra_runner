import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LANES, COLORS, SPAWN_CONFIG } from './constants.js';

export class PackBasedUrbanEnvironment {
    constructor(scene) {
        this.scene = scene;
        this.ground = null;
        this.activeBuildings = [];
        this.streetDecorations = [];
        this.gameController = null;
        
        // Road dimensions
        this.roadWidth = 8;
        this.sidewalkWidth = 3;
        
        // GLB model system
        this.gltfLoader = new GLTFLoader();
        this.buildingPack = null;
        this.curatedBuildings = []; // Carefully selected complete buildings
        this.isPackLoaded = false;
        this.currentBuildingIndex = 0;
        
        this.setupScene();
        this.setupLighting();
        this.createOptimizedRoad();
        
        // Load and curate the building pack
        this.loadAndCurateBuildingPack();
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
        
        console.log('Pack-based urban environment setup complete');
    }

    async loadAndCurateBuildingPack() {
        try {
            console.log('Loading building pack for curation...');
            const gltf = await this.gltfLoader.loadAsync('./assets/city/model/simple_town_pack.glb');
            
            this.buildingPack = gltf.scene;
            
            // Carefully analyze and curate the pack
            this.curateBuildingsFromPack();
            
            // Create initial urban scene
            this.spawnInitialPackBuildings();
            
            this.isPackLoaded = true;
            console.log(`Building pack loaded! ${this.curatedBuildings.length} buildings curated`);
            
        } catch (error) {
            console.error('Error loading building pack:', error);
            this.createFallbackBuildings();
        }
    }

    curateBuildingsFromPack() {
        this.curatedBuildings = [];
        const potentialBuildings = [];
        
        console.log('Analyzing building pack structure...');
        
        // First pass: collect all potential building objects
        this.buildingPack.traverse((child) => {
            if (child.isGroup || child.isMesh) {
                // Calculate bounding box to understand size
                const bbox = new THREE.Box3().setFromObject(child);
                const size = bbox.getSize(new THREE.Vector3());
                
                // Look for objects that could be complete buildings
                const volume = size.x * size.y * size.z;
                const aspectRatio = size.y / Math.max(size.x, size.z);
                
                // Building criteria:
                // 1. Reasonable volume (not tiny decorations)
                // 2. Vertical aspect (taller than wide)
                // 3. Has some complexity (groups with children or substantial meshes)
                if (volume > 10 && aspectRatio > 0.5) {
                    potentialBuildings.push({
                        object: child,
                        size: size,
                        volume: volume,
                        aspectRatio: aspectRatio,
                        type: child.isGroup ? 'group' : 'mesh',
                        childCount: child.isGroup ? child.children.length : 0
                    });
                }
            }
        });
        
        console.log(`Found ${potentialBuildings.length} potential buildings`);
        
        // Sort by volume (larger buildings first) and select best candidates
        potentialBuildings.sort((a, b) => b.volume - a.volume);
        
        // Select top buildings, preferring groups over individual meshes
        const maxBuildings = Math.min(12, potentialBuildings.length);
        for (let i = 0; i < maxBuildings; i++) {
            const candidate = potentialBuildings[i];
            
            // Clone and prepare the building
            const building = candidate.object.clone();
            
            // Enhance the building with African themes
            this.enhancePackBuilding(building);
            
            // Add metadata
            building.userData = {
                originalSize: candidate.size,
                volume: candidate.volume,
                type: this.classifyBuilding(candidate),
                index: i
            };
            
            this.curatedBuildings.push(building);
            
            console.log(`Curated building ${i}: ${building.userData.type}, volume: ${candidate.volume.toFixed(1)}, size: ${candidate.size.x.toFixed(1)}x${candidate.size.y.toFixed(1)}x${candidate.size.z.toFixed(1)}`);
        }
        
        console.log(`Successfully curated ${this.curatedBuildings.length} buildings from pack`);
    }

    classifyBuilding(candidate) {
        const { size, volume, aspectRatio, childCount } = candidate;
        
        // Classify based on characteristics
        if (aspectRatio > 2 && volume > 500) {
            return 'High Rise';
        } else if (aspectRatio > 1.5 && volume > 200) {
            return 'Mid Rise';
        } else if (childCount > 5) {
            return 'Complex';
        } else if (volume > 100) {
            return 'Commercial';
        } else {
            return 'Residential';
        }
    }

    enhancePackBuilding(building) {
        const africanColors = [
            0xFF6347, // Terracotta
            0x0047AB, // Bold blue
            0xFFD700, // Golden yellow
            0x663399, // Royal purple
            0x228B22, // Forest green
            0xDC143C  // Crimson red
        ];
        
        let meshCount = 0;
        
        building.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                // Apply African color themes selectively
                if (child.material && meshCount % 3 === 0) { // Every 3rd mesh
                    child.material = child.material.clone();
                    const randomColor = africanColors[Math.floor(Math.random() * africanColors.length)];
                    child.material.color = new THREE.Color(randomColor);
                    child.material.color.multiplyScalar(0.75); // Tone down for realism
                }
                
                meshCount++;
            }
        });
        
        console.log(`Enhanced building with ${meshCount} meshes`);
    }

    createOptimizedRoad() {
        // Same optimized road as before
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const context = canvas.getContext('2d');

        context.fillStyle = '#404040';
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.fillStyle = '#4A4A4A';
        for(let i = 0; i < 50; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const size = Math.random() * 3 + 1;
            context.fillRect(x, y, size, size);
        }

        context.fillStyle = '#FFFFFF';
        for(let i = 0; i < canvas.height; i += 20) {
            context.fillRect(canvas.width/3 - 1, i, 2, 10);
            context.fillRect((canvas.width * 2/3) - 1, i, 2, 10);
        }
        
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

        this.createOptimizedSidewalks();
        this.ground = this.road;
        
        console.log('Optimized 3-lane road created');
    }

    createOptimizedSidewalks() {
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

    spawnInitialPackBuildings() {
        if (this.curatedBuildings.length === 0) {
            console.log('No curated buildings available, creating fallback');
            this.createFallbackBuildings();
            return;
        }
        
        // Create initial urban scene with pack buildings
        for (let i = 0; i < Math.min(6, this.curatedBuildings.length); i++) {
            this.spawnPackBuilding(-20 - (i * 50));
        }
    }

    spawnPackBuilding(zPosition) {
        if (this.curatedBuildings.length === 0) {
            this.createFallbackBuilding(zPosition);
            return;
        }
        
        // Select building in planned sequence (not random)
        const buildingIndex = this.currentBuildingIndex % this.curatedBuildings.length;
        const template = this.curatedBuildings[buildingIndex];
        this.currentBuildingIndex++;
        
        const building = template.clone();
        
        // Calculate appropriate scale based on original size
        const originalSize = template.userData.originalSize;
        let scale;
        
        if (originalSize.y > 100) {
            scale = 0.02 + Math.random() * 0.01; // Very large buildings: 0.02-0.03
        } else if (originalSize.y > 50) {
            scale = 0.05 + Math.random() * 0.02; // Large buildings: 0.05-0.07
        } else if (originalSize.y > 20) {
            scale = 0.1 + Math.random() * 0.05; // Medium buildings: 0.1-0.15
        } else {
            scale = 0.2 + Math.random() * 0.1; // Small buildings: 0.2-0.3
        }
        
        building.scale.setScalar(scale);
        
        // Proper positioning
        const bbox = new THREE.Box3().setFromObject(building);
        const groundY = -bbox.min.y;
        
        const side = Math.random() < 0.5 ? 'left' : 'right';
        const setback = 8 + Math.random() * 6; // 8-14 units behind sidewalk
        const xOffset = side === 'left' ? 
            -(this.roadWidth/2 + this.sidewalkWidth + setback) : 
            (this.roadWidth/2 + this.sidewalkWidth + setback);
        
        building.position.set(xOffset, groundY, zPosition);
        building.rotation.y = (Math.random() - 0.5) * 0.2;
        
        this.scene.add(building);
        this.activeBuildings.push({
            object: building,
            zPosition: zPosition,
            type: template.userData.type,
            scale: scale
        });

        console.log(`${template.userData.type} (pack model) spawned at X: ${xOffset.toFixed(1)}, Z: ${zPosition}, scale: ${scale.toFixed(3)}`);
    }

    createFallbackBuilding(zPosition) {
        // Simple fallback if pack loading fails
        const height = 4 + Math.random() * 6;
        const width = 3 + Math.random() * 2;
        const depth = 3 + Math.random() * 2;
        
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({
            color: [0xFF6347, 0x0047AB, 0xFFD700, 0x663399, 0x228B22][Math.floor(Math.random() * 5)],
            roughness: 0.7
        });
        
        const building = new THREE.Mesh(geometry, material);
        building.position.y = height / 2;
        building.castShadow = true;
        building.receiveShadow = true;
        
        const side = Math.random() < 0.5 ? 'left' : 'right';
        const setback = 8 + Math.random() * 4;
        const xOffset = side === 'left' ? 
            -(this.roadWidth/2 + this.sidewalkWidth + setback) : 
            (this.roadWidth/2 + this.sidewalkWidth + setback);
        
        building.position.x = xOffset;
        building.position.z = zPosition;
        
        this.scene.add(building);
        this.activeBuildings.push({
            object: building,
            zPosition: zPosition,
            type: 'Fallback Building',
            scale: 1.0
        });
        
        console.log(`Fallback building spawned at X: ${xOffset.toFixed(1)}, Z: ${zPosition}`);
    }

    createFallbackBuildings() {
        console.log('Creating fallback buildings...');
        for (let i = 0; i < 6; i++) {
            this.createFallbackBuilding(-20 - (i * 40));
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
        const spawnZ = playerZ - 80;

        // Spawn pack buildings
        if (Math.random() < 0.4) { // 40% chance
            this.spawnPackBuilding(spawnZ);
        }

        // Occasional street tree
        if (Math.random() < 0.2) {
            this.createStreetTree(spawnZ);
        }

        setTimeout(() => {
            this.spawnUrbanElements();
        }, 2500);
    }

    createStreetTree(zPosition) {
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

        const crownGeometry = new THREE.SphereGeometry(1, 6, 4);
        const crownMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.8 });
        const crown = new THREE.Mesh(crownGeometry, crownMaterial);
        crown.position.set(trunk.position.x, trunkHeight + 0.7, zPosition);
        crown.castShadow = true;
        this.scene.add(crown);
        this.streetDecorations.push(crown);
    }

    updateModels(gameSpeed, cameraZ) {
        for (let i = this.activeBuildings.length - 1; i >= 0; i--) {
            const building = this.activeBuildings[i];
            building.object.position.z += gameSpeed;
            building.zPosition += gameSpeed;

            if (building.zPosition > cameraZ + 80) {
                this.scene.remove(building.object);
                this.activeBuildings.splice(i, 1);
            }
        }

        for (let i = this.streetDecorations.length - 1; i >= 0; i--) {
            this.streetDecorations[i].position.z += gameSpeed;
            if (this.streetDecorations[i].position.z > cameraZ + 25) {
                this.scene.remove(this.streetDecorations[i]);
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

        this.streetDecorations.forEach(decoration => this.scene.remove(decoration));
        this.streetDecorations = [];

        this.currentBuildingIndex = 0;
        
        if (this.isPackLoaded) {
            this.spawnInitialPackBuildings();
        }
    }

    getGround() {
        return this.road;
    }

    updateBuildings(gameSpeed, cameraZ) {
        this.updateModels(gameSpeed, cameraZ);
    }
}
