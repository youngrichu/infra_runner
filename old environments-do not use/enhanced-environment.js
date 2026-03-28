import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LANES, COLORS, SPAWN_CONFIG } from './constants.js';

export class EnhancedEnvironment {
    constructor(scene) {
        this.scene = scene;
        this.ground = null;
        this.cityModels = []; // Simplified - no separate arrays
        this.streetDecorations = [];
        this.gameController = null;
        
        // GLB model loader
        this.gltfLoader = new GLTFLoader();
        this.buildingTemplates = []; // Store individual building templates
        this.isModelLoaded = false;
        
        this.setupScene();
        this.setupLighting();
        this.createGround();
        
        // Load city model asynchronously without blocking
        this.loadCityModel();
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
        this.scene.fog = new THREE.Fog(skyColors.middle, 40, 120);
    }

    setupLighting() {
        // Simplified lighting for better performance
        const ambientLight = new THREE.AmbientLight(0xFFE5B4, 0.7); // Slightly brighter ambient
        this.scene.add(ambientLight);

        // Single directional light instead of multiple lights
        const directionalLight = new THREE.DirectionalLight(0xFFFFE0, 0.8);
        directionalLight.position.set(5, 10, 7.5);
        directionalLight.castShadow = true;
        
        // Reduced shadow map size for better performance
        directionalLight.shadow.mapSize.width = 1024; // Reduced from 2048
        directionalLight.shadow.mapSize.height = 1024;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 30; // Reduced from 50
        
        this.scene.add(directionalLight);
        
        console.log('Simplified lighting setup for better performance');
    }

    async loadCityModel() {
        try {
            console.log('Loading city model from: ./assets/city/model/city.glb');
            // Use lower priority loading to avoid blocking main thread
            const gltf = await this.gltfLoader.loadAsync('./assets/city/model/city.glb');
            
            // Extract only building components, not the entire city
            this.extractBuildingComponents(gltf.scene);
            this.isModelLoaded = true;
            
            console.log('City components extracted successfully!');
            
        } catch (error) {
            console.error('Error loading city model:', error);
            console.log('Using fallback buildings only...');
            this.isModelLoaded = false;
            
            // Don't create fallback immediately - let the game start first
            setTimeout(() => {
                this.createFallbackCityscape();
            }, 2000);
        }
    }

    extractBuildingComponents(cityScene) {
        // Extract meaningful building groups, not individual meshes
        this.buildingTemplates = [];
        const extractedGroups = new Set();
        
        // Look for complete building groups/objects
        cityScene.traverse((child) => {
            if (child.isGroup || (child.isMesh && child.parent && child.parent.children.length > 1)) {
                // Get the parent group that represents a complete building
                const buildingGroup = child.isGroup ? child : child.parent;
                
                // Avoid duplicates
                if (!extractedGroups.has(buildingGroup.uuid)) {
                    extractedGroups.add(buildingGroup.uuid);
                    
                    // Clone the entire building group
                    const buildingClone = buildingGroup.clone();
                    
                    // Ensure proper ground positioning
                    const bbox = new THREE.Box3().setFromObject(buildingClone);
                    const yOffset = -bbox.min.y; // Move bottom to ground level
                    buildingClone.position.y = yOffset;
                    
                    // Apply African color enhancement
                    this.enhanceBuildingGroup(buildingClone);
                    
                    // Store as template for spawning
                    this.buildingTemplates.push(buildingClone);
                }
            }
        });
        
        // If no good groups found, fall back to larger individual meshes
        if (this.buildingTemplates.length < 10) {
            console.log('Few building groups found, adding larger individual meshes');
            cityScene.traverse((child) => {
                if (child.isMesh && child.geometry) {
                    const bbox = new THREE.Box3().setFromObject(child);
                    const size = bbox.getSize(new THREE.Vector3());
                    
                    // Only take larger meshes that could be buildings
                    if (size.x > 1 && size.z > 1 && size.y > 1) {
                        const buildingClone = child.clone();
                        
                        // Fix positioning to ground
                        const yOffset = -bbox.min.y;
                        buildingClone.position.y = yOffset;
                        
                        this.enhanceSingleBuilding(buildingClone);
                        this.buildingTemplates.push(buildingClone);
                    }
                }
            });
        }
        
        console.log(`Extracted ${this.buildingTemplates.length} building components (groups + large meshes)`);
        
        // Start building spawning immediately after extraction
        if (this.gameController) {
            // Spawn buildings very close and visible immediately
            for (let i = 0; i < 6; i++) {
                setTimeout(() => {
                    const playerZ = this.gameController.getPlayerPosition().z;
                    this.spawnSingleBuilding(playerZ - (i * 15) - 5); // Much closer spacing
                }, i * 300); // Faster stagger
            }
        }
    }

    enhanceBuildingGroup(buildingGroup) {
        // Apply African colors to entire building group
        const africanColors = [0xFF6347, 0x0047AB, 0xFFD700, 0x663399, 0x228B22, 0xDC143C];
        const randomColor = africanColors[Math.floor(Math.random() * africanColors.length)];
        
        buildingGroup.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material = child.material.clone();
                child.material.color = new THREE.Color(randomColor);
                child.material.color.multiplyScalar(0.8);
            }
        });
    }

    enhanceSingleBuilding(buildingClone) {
        const africanColors = [0xFF6347, 0x0047AB, 0xFFD700, 0x663399, 0x228B22, 0xDC143C];
        const randomColor = africanColors[Math.floor(Math.random() * africanColors.length)];
        
        if (buildingClone.material) {
            buildingClone.material = buildingClone.material.clone();
            buildingClone.material.color = new THREE.Color(randomColor);
            buildingClone.material.color.multiplyScalar(0.8);
        }
    }

    createFallbackCityscape() {
        // Create immediate fallback buildings for content
        console.log('Creating immediate fallback buildings...');
        
        if (this.gameController) {
            for (let i = 0; i < 5; i++) {
                const playerZ = this.gameController.getPlayerPosition().z;
                this.createEnhancedBuilding(playerZ - (i * 20) - 10);
            }
        }
    }

    createEnhancedBuilding(zPosition) {
        // Create vibrant African-inspired geometric buildings with PROPER SETBACKS
        const africanColors = [
            0xFF6347, // Vibrant terracotta
            0x0047AB, // Bold blue
            0xFFD700, // Golden yellow
            0x663399, // Rich purple
            0x228B22, // Forest green
            0xDC143C  // Crimson red
        ];

        const buildingTypes = ['tower', 'compound', 'modern', 'traditional'];
        const type = buildingTypes[Math.floor(Math.random() * buildingTypes.length)];
        const color = africanColors[Math.floor(Math.random() * africanColors.length)];
        
        // Determine which side of the road
        const side = Math.random() < 0.5 ? 'left' : 'right';
        
        let building;
        
        switch(type) {
            case 'tower':
                building = this.createAfricanTower(color, zPosition, side);
                break;
            case 'compound':
                building = this.createAfricanCompound(color, zPosition, side);
                break;
            case 'modern':
                building = this.createModernBuilding(color, zPosition, side);
                break;
            default:
                building = this.createTraditionalBuilding(color, zPosition, side);
        }
        
        if (building) {
            this.cityModels.push(building);
        }
    }

    createAfricanTower(color, zPosition, side) {
        const group = new THREE.Group();
        
        // Main tower
        const height = 8 + Math.random() * 6;
        const geometry = new THREE.BoxGeometry(2, height, 2);
        const material = new THREE.MeshStandardMaterial({ 
            color: color,
            roughness: 0.3,
            metalness: 0.1
        });
        const tower = new THREE.Mesh(geometry, material);
        tower.position.y = height / 2;
        tower.castShadow = true;
        tower.receiveShadow = true;
        group.add(tower);
        
        // Add geometric pattern
        for (let i = 0; i < 3; i++) {
            const patternGeometry = new THREE.BoxGeometry(0.2, 1, 2.2);
            const patternMaterial = new THREE.MeshStandardMaterial({ color: 0xFFD700 });
            const pattern = new THREE.Mesh(patternGeometry, patternMaterial);
            pattern.position.set(1.1, 2 + i * 2, 0);
            pattern.castShadow = true;
            group.add(pattern);
        }
        
        // Position with proper setback
        const roadWidth = LANES.POSITIONS[LANES.RIGHT] * 2 + 4;
        const setback = 20 + Math.random() * 10; // 20-30 units from road
        const xOffset = side === 'left' ? -(roadWidth / 2 + setback) : (roadWidth / 2 + setback);
        
        group.position.set(xOffset, 0, zPosition);
        
        this.scene.add(group);
        return group;
    }

    createAfricanCompound(color, zPosition, side) {
        const group = new THREE.Group();
        
        // Central courtyard style building
        const buildings = [
            { x: 0, z: 0, w: 3, h: 3, d: 3 },
            { x: 4, z: 0, w: 2, h: 2, d: 2 },
            { x: 0, z: 4, w: 2, h: 2.5, d: 2 },
            { x: -3, z: 2, w: 1.5, h: 2, d: 1.5 }
        ];
        
        buildings.forEach(b => {
            const geometry = new THREE.BoxGeometry(b.w, b.h, b.d);
            const material = new THREE.MeshStandardMaterial({ 
                color: new THREE.Color(color).multiplyScalar(0.8 + Math.random() * 0.4),
                roughness: 0.7
            });
            const building = new THREE.Mesh(geometry, material);
            building.position.set(b.x, b.h / 2, b.z);
            building.castShadow = true;
            building.receiveShadow = true;
            group.add(building);
        });
        
        // Position with proper setback
        const roadWidth = LANES.POSITIONS[LANES.RIGHT] * 2 + 4;
        const setback = 25 + Math.random() * 10; // 25-35 units from road
        const xOffset = side === 'left' ? -(roadWidth / 2 + setback) : (roadWidth / 2 + setback);
        
        group.position.set(xOffset, 0, zPosition);
        
        this.scene.add(group);
        return group;
    }

    createModernBuilding(color, zPosition, side) {
        const group = new THREE.Group();
        
        const height = 6 + Math.random() * 4;
        const geometry = new THREE.BoxGeometry(3, height, 2.5);
        const material = new THREE.MeshStandardMaterial({ 
            color: color,
            roughness: 0.2,
            metalness: 0.3
        });
        const building = new THREE.Mesh(geometry, material);
        building.position.y = height / 2;
        building.castShadow = true;
        building.receiveShadow = true;
        group.add(building);
        
        // Add glass panels
        const glassGeometry = new THREE.PlaneGeometry(2.8, height * 0.8);
        const glassMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x87CEEB,
            transparent: true,
            opacity: 0.3,
            metalness: 0.8,
            roughness: 0.1
        });
        const glass = new THREE.Mesh(glassGeometry, glassMaterial);
        glass.position.set(1.51, height / 2, 0);
        group.add(glass);
        
        // Position with proper setback
        const roadWidth = LANES.POSITIONS[LANES.RIGHT] * 2 + 4;
        const setback = 18 + Math.random() * 12; // 18-30 units from road
        const xOffset = side === 'left' ? -(roadWidth / 2 + setback) : (roadWidth / 2 + setback);
        
        group.position.set(xOffset, 0, zPosition);
        
        this.scene.add(group);
        return group;
    }

    createTraditionalBuilding(color, zPosition, side) {
        const group = new THREE.Group();
        
        const height = 4 + Math.random() * 2;
        const geometry = new THREE.BoxGeometry(2.5, height, 2.5);
        const material = new THREE.MeshStandardMaterial({ 
            color: color,
            roughness: 0.8
        });
        const building = new THREE.Mesh(geometry, material);
        building.position.y = height / 2;
        building.castShadow = true;
        building.receiveShadow = true;
        group.add(building);
        
        // Flat roof typical of African architecture
        const roofGeometry = new THREE.BoxGeometry(3, 0.3, 3);
        const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.y = height + 0.15;
        roof.castShadow = true;
        group.add(roof);
        
        // Position with proper setback
        const roadWidth = LANES.POSITIONS[LANES.RIGHT] * 2 + 4;
        const setback = 15 + Math.random() * 8; // 15-23 units from road
        const xOffset = side === 'left' ? -(roadWidth / 2 + setback) : (roadWidth / 2 + setback);
        
        group.position.set(xOffset, 0, zPosition);
        
        this.scene.add(group);
        return group;
    }

    createGround() {
        // Enhanced road with African-inspired design
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
        context.fillStyle = '#FFD700'; // Gold markings instead of white
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

        // Create main road with enhanced material
        const roadGeometry = new THREE.PlaneGeometry(LANES.POSITIONS[LANES.RIGHT] * 2 + 3, 1500);
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

        // Enhanced side areas with vibrant colors
        this.sideAreas = [];
        this.lastSideAreaZ = 0;
        this.spawnInitialSideAreas();

        this.ground = this.road;
    }

    spawnSingleBuilding(zPosition) {
        if (!this.buildingTemplates || this.buildingTemplates.length === 0) {
            console.log('No building templates available');
            return;
        }
        
        // Pick a random building template
        const template = this.buildingTemplates[Math.floor(Math.random() * this.buildingTemplates.length)];
        const building = template.clone();
        
        // Position with closer setback for better visibility
        const side = Math.random() < 0.5 ? 'left' : 'right';
        const roadWidth = LANES.POSITIONS[LANES.RIGHT] * 2 + 4;
        const setback = 8 + Math.random() * 6; // Even closer: 8-14 units
        const xOffset = side === 'left' ? -(roadWidth / 2 + setback) : (roadWidth / 2 + setback);
        
        // Ensure building is firmly on the ground
        const bbox = new THREE.Box3().setFromObject(building);
        const groundY = -bbox.min.y; // Calculate offset to put bottom at Y=0
        
        // Larger scale for immediate visibility
        const scale = 1.2 + Math.random() * 0.8; // Bigger: 1.2-2.0 scale
        building.scale.setScalar(scale);
        building.position.set(xOffset, groundY, zPosition); // Use calculated ground Y
        
        building.castShadow = true;
        building.receiveShadow = true;
        
        // Ensure all children also cast/receive shadows
        building.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        this.scene.add(building);
        this.cityModels.push(building);
        
        console.log(`Spawned GLB building at X: ${xOffset.toFixed(1)}, Y: ${groundY.toFixed(1)}, Z: ${zPosition}, scale: ${scale.toFixed(2)} - Should be on ground!`);
    }

    createAfricanTree(x, z) {
        // Create more authentic African tree varieties
        const treeType = Math.random();
        
        if (treeType < 0.4) {
            return this.createBaobabTree(x, z);
        } else if (treeType < 0.7) {
            return this.createAcaciaTree(x, z);
        } else {
            return this.createPalmTree(x, z);
        }
    }

    createBaobabTree(x, z) {
        // Iconic baobab tree with thick trunk
        const trunkHeight = 3 + Math.random() * 2;
        const trunkRadius = 0.8 + Math.random() * 0.4;
        
        const trunkGeometry = new THREE.CylinderGeometry(trunkRadius, trunkRadius * 1.2, trunkHeight, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x8B4513,
            roughness: 0.9,
            metalness: 0.0
        });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.set(x, trunkHeight / 2, z);
        trunk.castShadow = true;
        this.scene.add(trunk);
        this.streetDecorations.push(trunk);

        // Distinctive baobab crown
        const crownGeometry = new THREE.SphereGeometry(trunkRadius * 1.5, 8, 6);
        const crownMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x228B22,
            roughness: 0.8
        });
        const crown = new THREE.Mesh(crownGeometry, crownMaterial);
        crown.position.set(x, trunkHeight + 0.5, z);
        crown.castShadow = true;
        this.scene.add(crown);
        this.streetDecorations.push(crown);

        return [trunk, crown];
    }

    createAcaciaTree(x, z) {
        // Flat-topped acacia tree
        const trunkHeight = 4 + Math.random() * 2;
        const trunkRadius = 0.2 + Math.random() * 0.1;
        
        const trunkGeometry = new THREE.CylinderGeometry(trunkRadius, trunkRadius * 1.5, trunkHeight, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x654321,
            roughness: 0.9
        });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.set(x, trunkHeight / 2, z);
        trunk.castShadow = true;
        this.scene.add(trunk);
        this.streetDecorations.push(trunk);

        // Flat-topped crown
        const crownGeometry = new THREE.CylinderGeometry(2, 1.5, 1, 8);
        const crownMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x32CD32,
            roughness: 0.7
        });
        const crown = new THREE.Mesh(crownGeometry, crownMaterial);
        crown.position.set(x, trunkHeight + 0.5, z);
        crown.castShadow = true;
        this.scene.add(crown);
        this.streetDecorations.push(crown);

        return [trunk, crown];
    }

    createPalmTree(x, z) {
        // Modern palm tree for urban areas
        const trunkHeight = 5 + Math.random() * 3;
        const segments = 8;
        
        for (let i = 0; i < segments; i++) {
            const segmentHeight = trunkHeight / segments;
            const radius = 0.15 + (i * 0.02);
            
            const segmentGeometry = new THREE.CylinderGeometry(radius, radius + 0.05, segmentHeight, 8);
            const segmentMaterial = new THREE.MeshStandardMaterial({ 
                color: 0xDEB887,
                roughness: 0.8
            });
            const segment = new THREE.Mesh(segmentGeometry, segmentMaterial);
            segment.position.set(x, (i * segmentHeight) + (segmentHeight / 2), z);
            segment.castShadow = true;
            this.scene.add(segment);
            this.streetDecorations.push(segment);
        }

        // Palm fronds
        for (let i = 0; i < 6; i++) {
            const frondGeometry = new THREE.PlaneGeometry(0.3, 2);
            const frondMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x228B22,
                side: THREE.DoubleSide,
                roughness: 0.6
            });
            const frond = new THREE.Mesh(frondGeometry, frondMaterial);
            frond.position.set(x, trunkHeight + 0.5, z);
            frond.rotation.y = (i / 6) * Math.PI * 2;
            frond.rotation.x = -0.3;
            frond.castShadow = true;
            this.scene.add(frond);
            this.streetDecorations.push(frond);
        }
    }

    spawnInitialSideAreas() {
        // Enhanced side areas with vibrant African-inspired colors
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
        
        // Enhanced African-inspired surface types
        const surfaceTypes = [
            { type: 'market', color: 0xFF6347 },      // Vibrant terracotta for markets
            { type: 'garden', color: 0x32CD32 },      // Lush green spaces
            { type: 'plaza', color: 0xFFD700 },       // Golden plaza stones
            { type: 'residential', color: 0xDEB887 },  // Warm beige residential areas
            { type: 'cultural', color: 0x663399 }     // Rich purple cultural zones
        ];
        
        const chosenSurface = surfaceTypes[Math.floor(Math.random() * surfaceTypes.length)];

        const geometry = new THREE.PlaneGeometry(segmentWidth, segmentLength);
        const material = new THREE.MeshStandardMaterial({ 
            color: chosenSurface.color,
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
        // Start with just trees for immediate content
        this.spawnStreetDecorations();
    }

    spawnStreetDecorations() {
        if (!this.gameController || !this.gameController.isGameActive()) {
            return;
        }

        const playerZ = this.gameController.getPlayerPosition().z;
        const z = playerZ - 40; // Spawn much closer to player

        // Reduced chance for better performance
        if (Math.random() < 0.3) { // Reduced from 0.8 to 0.3
            const side = Math.random() < 0.5 ? 
                LANES.POSITIONS[LANES.LEFT] - SPAWN_CONFIG.STREET_DECORATION_OFFSET : 
                LANES.POSITIONS[LANES.RIGHT] + SPAWN_CONFIG.STREET_DECORATION_OFFSET;
            this.createAfricanTree(side, z);
        }

        // Spawn buildings much closer and MORE frequently for IMMEDIATE visibility
        if (this.isModelLoaded && Math.random() < 0.6) { // Increased to 60% chance
            this.spawnSingleBuilding(z - 10); // Very close spawning
        } else if (!this.isModelLoaded && Math.random() < 0.4) {
            this.createEnhancedBuilding(z - 10);
        }

        setTimeout(() => {
            this.spawnStreetDecorations();
        }, 1000); // Much faster spawning for immediate content
    }

    updateModels(gameSpeed, cameraZ) {
        // Update city model instances
        for (let i = this.cityModels.length - 1; i >= 0; i--) {
            this.cityModels[i].position.z += gameSpeed;
            if (this.cityModels[i].position.z > cameraZ + 20) {
                this.scene.remove(this.cityModels[i]);
                this.cityModels.splice(i, 1);
            }
        }

        // Update street decorations
        for (let i = this.streetDecorations.length - 1; i >= 0; i--) {
            this.streetDecorations[i].position.z += gameSpeed;
            if (this.streetDecorations[i].position.z > cameraZ + 15) {
                this.scene.remove(this.streetDecorations[i]);
                this.streetDecorations.splice(i, 1);
            }
        }
    }

    updateGround(cameraZ) {
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
        // Clear all city models
        this.cityModels.forEach(model => this.scene.remove(model));
        this.cityModels = [];

        // Clear all street decorations
        this.streetDecorations.forEach(decoration => this.scene.remove(decoration));
        this.streetDecorations = [];

        // Clear all side areas
        this.sideAreas.forEach(area => this.scene.remove(area));
        this.sideAreas = [];
        
        this.lastSideAreaZ = 0;
    }

    getGround() {
        return this.road;
    }

    // Legacy compatibility methods
    updateBuildings(gameSpeed, cameraZ) {
        this.updateModels(gameSpeed, cameraZ);
    }
}
