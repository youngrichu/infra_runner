import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LANES, COLORS, SPAWN_CONFIG } from './constants.js';

export class StructuredUrbanEnvironment {
    constructor(scene) {
        this.scene = scene;
        this.ground = null;
        this.buildings = {
            left: [],   // Buildings on left side
            right: []   // Buildings on right side
        };
        this.sidewalks = {
            left: [],
            right: []
        };
        this.streetElements = []; // Trees, streetlights, etc.
        this.gameController = null;
        
        // GLB model loader
        this.gltfLoader = new GLTFLoader();
        this.buildingTemplates = [];
        this.isModelLoaded = false;
        
        // Urban planning parameters
        this.cityBlocks = {
            buildingSpacing: 15,        // Consistent spacing between buildings
            buildingSetback: 25,        // Distance from road to building
            sidewalkWidth: 4,           // Width of sidewalks
            treeSpacing: 20,            // Spacing between trees
            lastBuildingZ: { left: 0, right: 0 },
            lastSidewalkZ: 0,
            lastTreeZ: { left: 0, right: 0 }
        };
        
        this.setupScene();
        this.setupLighting();
        this.createUrbanInfrastructure();
        this.loadCityModel();
    }

    setGameController(gameController) {
        this.gameController = gameController;
    }

    setupScene() {
        // Clear, bright urban sky
        this.scene.background = new THREE.Color(0x87CEEB); // Light blue sky
        this.scene.fog = new THREE.Fog(0x87CEEB, 60, 200);
    }

    setupLighting() {
        // Bright urban lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
        this.scene.add(directionalLight);
    }

    async loadCityModel() {
        try {
            console.log('Loading city model...');
            const gltf = await this.gltfLoader.loadAsync('./assets/city/model/city.glb');
            this.extractAndFixBuildingComponents(gltf.scene);
            this.isModelLoaded = true;
            console.log('City model loaded successfully!');
        } catch (error) {
            console.error('Error loading city model:', error);
            this.isModelLoaded = false;
            this.createFallbackBuildings();
        }
    }

    extractAndFixBuildingComponents(cityScene) {
        this.buildingTemplates = [];
        const processedObjects = new Set();
        
        cityScene.traverse((child) => {
            if (child.isMesh && !processedObjects.has(child.uuid)) {
                processedObjects.add(child.uuid);
                
                // Clone and fix the building
                const building = child.clone();
                
                // Fix materials for proper rendering
                if (building.material) {
                    if (Array.isArray(building.material)) {
                        building.material = building.material.map(mat => {
                            const newMat = mat.clone();
                            newMat.wireframe = false;
                            newMat.transparent = false;
                            newMat.opacity = 1.0;
                            return newMat;
                        });
                    } else {
                        building.material = building.material.clone();
                        building.material.wireframe = false;
                        building.material.transparent = false;
                        building.material.opacity = 1.0;
                    }
                }
                
                // Fix positioning to ground level
                const bbox = new THREE.Box3().setFromObject(building);
                const size = bbox.getSize(new THREE.Vector3());
                
                // Only use buildings that are reasonable size
                if (size.x > 0.5 && size.z > 0.5 && size.y > 0.5) {
                    building.position.y = -bbox.min.y; // Place bottom at ground level
                    this.buildingTemplates.push(building);
                }
            }
        });
        
        console.log(`Extracted ${this.buildingTemplates.length} fixed building templates`);
    }

    createFallbackBuildings() {
        // Create simple geometric buildings as fallback
        for (let i = 0; i < 20; i++) {
            const building = this.createSimpleBuilding();
            this.buildingTemplates.push(building);
        }
        console.log('Created fallback building templates');
    }

    createSimpleBuilding() {
        const height = 4 + Math.random() * 8;
        const width = 2 + Math.random() * 3;
        const depth = 2 + Math.random() * 3;
        
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(Math.random() * 0.1 + 0.05, 0.7, 0.6),
            roughness: 0.7,
            metalness: 0.1
        });
        
        const building = new THREE.Mesh(geometry, material);
        building.position.y = height / 2;
        building.castShadow = true;
        building.receiveShadow = true;
        
        return building;
    }

    createUrbanInfrastructure() {
        this.createMainRoad();
        this.createSidewalks();
        this.spawnInitialUrbanElements();
    }

    createMainRoad() {
        // Create detailed road with lane markings
        const roadWidth = 16; // Wider road for urban feel
        const roadLength = 2000;
        
        // Road base
        const roadGeometry = new THREE.PlaneGeometry(roadWidth, roadLength);
        const roadMaterial = new THREE.MeshStandardMaterial({
            color: 0x404040,
            roughness: 0.9,
            metalness: 0.1
        });
        
        this.road = new THREE.Mesh(roadGeometry, roadMaterial);
        this.road.rotation.x = -Math.PI / 2;
        this.road.receiveShadow = true;
        this.scene.add(this.road);
        
        // Add lane markings
        this.addLaneMarkings(roadWidth, roadLength);
        
        this.ground = this.road;
    }

    addLaneMarkings(roadWidth, roadLength) {
        // Center line
        const centerLineGeometry = new THREE.PlaneGeometry(0.3, roadLength);
        const centerLineMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.9
        });
        
        const centerLine = new THREE.Mesh(centerLineGeometry, centerLineMaterial);
        centerLine.rotation.x = -Math.PI / 2;
        centerLine.position.y = 0.01;
        this.scene.add(centerLine);
        
        // Side lane markings
        const laneMarkingPositions = [-roadWidth/3, roadWidth/3];
        laneMarkingPositions.forEach(x => {
            for (let z = -roadLength/2; z < roadLength/2; z += 10) {
                const marking = new THREE.Mesh(
                    new THREE.PlaneGeometry(0.2, 4),
                    centerLineMaterial.clone()
                );
                marking.rotation.x = -Math.PI / 2;
                marking.position.set(x, 0.01, z);
                this.scene.add(marking);
            }
        });
    }

    createSidewalks() {
        const roadWidth = 16;
        const sidewalkWidth = this.cityBlocks.sidewalkWidth;
        const sidewalkLength = 2000;
        
        // Left sidewalk
        const leftSidewalkGeometry = new THREE.PlaneGeometry(sidewalkWidth, sidewalkLength);
        const sidewalkMaterial = new THREE.MeshStandardMaterial({
            color: 0xC0C0C0, // Light gray concrete
            roughness: 0.8,
            metalness: 0.0
        });
        
        this.leftSidewalk = new THREE.Mesh(leftSidewalkGeometry, sidewalkMaterial);
        this.leftSidewalk.rotation.x = -Math.PI / 2;
        this.leftSidewalk.position.set(-(roadWidth/2 + sidewalkWidth/2), 0.005, 0);
        this.leftSidewalk.receiveShadow = true;
        this.scene.add(this.leftSidewalk);
        
        // Right sidewalk
        this.rightSidewalk = new THREE.Mesh(leftSidewalkGeometry, sidewalkMaterial.clone());
        this.rightSidewalk.rotation.x = -Math.PI / 2;
        this.rightSidewalk.position.set(roadWidth/2 + sidewalkWidth/2, 0.005, 0);
        this.rightSidewalk.receiveShadow = true;
        this.scene.add(this.rightSidewalk);
        
        // Add sidewalk details (curbs)
        this.addCurbs(roadWidth, sidewalkWidth, sidewalkLength);
    }

    addCurbs(roadWidth, sidewalkWidth, sidewalkLength) {
        const curbHeight = 0.15;
        const curbWidth = 0.3;
        
        // Left curb
        const leftCurbGeometry = new THREE.BoxGeometry(curbWidth, curbHeight, sidewalkLength);
        const curbMaterial = new THREE.MeshStandardMaterial({
            color: 0x808080,
            roughness: 0.9
        });
        
        const leftCurb = new THREE.Mesh(leftCurbGeometry, curbMaterial);
        leftCurb.position.set(-(roadWidth/2 + curbWidth/2), curbHeight/2, 0);
        leftCurb.castShadow = true;
        leftCurb.receiveShadow = true;
        this.scene.add(leftCurb);
        
        // Right curb
        const rightCurb = new THREE.Mesh(leftCurbGeometry, curbMaterial.clone());
        rightCurb.position.set(roadWidth/2 + curbWidth/2, curbHeight/2, 0);
        rightCurb.castShadow = true;
        rightCurb.receiveShadow = true;
        this.scene.add(rightCurb);
    }

    spawnInitialUrbanElements() {
        // Spawn initial buildings for both sides
        for (let i = 0; i < 10; i++) {
            const z = -(i * this.cityBlocks.buildingSpacing);
            this.spawnBuildingAt('left', z);
            this.spawnBuildingAt('right', z);
            this.cityBlocks.lastBuildingZ.left = z;
            this.cityBlocks.lastBuildingZ.right = z;
        }
        
        // Spawn initial trees
        for (let i = 0; i < 15; i++) {
            const z = -(i * this.cityBlocks.treeSpacing);
            this.spawnTreeAt('left', z);
            this.spawnTreeAt('right', z);
            this.cityBlocks.lastTreeZ.left = z;
            this.cityBlocks.lastTreeZ.right = z;
        }
    }

    spawnBuildingAt(side, z) {
        let building;
        
        if (this.isModelLoaded && this.buildingTemplates.length > 0) {
            // Use GLB building template
            const template = this.buildingTemplates[Math.floor(Math.random() * this.buildingTemplates.length)];
            building = template.clone();
            
            // Ensure proper material handling
            building.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material = child.material.map(mat => {
                                const newMat = mat.clone();
                                newMat.wireframe = false;
                                return newMat;
                            });
                        } else {
                            child.material = child.material.clone();
                            child.material.wireframe = false;
                        }
                    }
                }
            });
        } else {
            // Use fallback building
            building = this.createSimpleBuilding();
        }
        
        // Position building
        const roadWidth = 16;
        const setback = this.cityBlocks.buildingSetback;
        const x = side === 'left' ? 
            -(roadWidth/2 + this.cityBlocks.sidewalkWidth + setback) : 
            (roadWidth/2 + this.cityBlocks.sidewalkWidth + setback);
        
        // Ensure building is on ground
        const bbox = new THREE.Box3().setFromObject(building);
        const groundY = -bbox.min.y;
        
        building.position.set(x, groundY, z);
        
        this.scene.add(building);
        this.buildings[side].push(building);
        
        console.log(`Spawned ${this.isModelLoaded ? 'GLB' : 'fallback'} building on ${side} at Z: ${z}`);
    }

    spawnTreeAt(side, z) {
        // Create small, urban-appropriate trees
        const tree = this.createSmallUrbanTree();
        
        const roadWidth = 16;
        const sidewalkWidth = this.cityBlocks.sidewalkWidth;
        const x = side === 'left' ? 
            -(roadWidth/2 + sidewalkWidth/2) : 
            (roadWidth/2 + sidewalkWidth/2);
        
        tree.position.set(x, 0, z);
        this.scene.add(tree);
        this.streetElements.push(tree);
    }

    createSmallUrbanTree() {
        const group = new THREE.Group();
        
        // Small trunk
        const trunkHeight = 1.5;
        const trunkRadius = 0.08;
        
        const trunkGeometry = new THREE.CylinderGeometry(trunkRadius, trunkRadius * 1.2, trunkHeight, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B4513,
            roughness: 0.9
        });
        
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = trunkHeight / 2;
        trunk.castShadow = true;
        group.add(trunk);
        
        // Small canopy
        const canopyRadius = 0.6;
        const canopyHeight = 0.8;
        
        const canopyGeometry = new THREE.SphereGeometry(canopyRadius, 8, 6);
        const canopyMaterial = new THREE.MeshStandardMaterial({
            color: 0x228B22,
            roughness: 0.8
        });
        
        const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
        canopy.position.y = trunkHeight + canopyHeight/2;
        canopy.castShadow = true;
        group.add(canopy);
        
        return group;
    }

    startSpawning() {
        this.continuousSpawning();
    }

    continuousSpawning() {
        if (!this.gameController || !this.gameController.isGameActive()) {
            setTimeout(() => this.continuousSpawning(), 1000);
            return;
        }

        const playerZ = this.gameController.getPlayerPosition().z;
        const spawnAheadDistance = 100;
        
        // Spawn buildings consistently
        ['left', 'right'].forEach(side => {
            if (this.cityBlocks.lastBuildingZ[side] > playerZ - spawnAheadDistance) {
                const newZ = this.cityBlocks.lastBuildingZ[side] - this.cityBlocks.buildingSpacing;
                this.spawnBuildingAt(side, newZ);
                this.cityBlocks.lastBuildingZ[side] = newZ;
            }
        });
        
        // Spawn trees consistently
        ['left', 'right'].forEach(side => {
            if (this.cityBlocks.lastTreeZ[side] > playerZ - spawnAheadDistance) {
                const newZ = this.cityBlocks.lastTreeZ[side] - this.cityBlocks.treeSpacing;
                this.spawnTreeAt(side, newZ);
                this.cityBlocks.lastTreeZ[side] = newZ;
            }
        });
        
        setTimeout(() => this.continuousSpawning(), 500);
    }

    updateBuildings(gameSpeed, cameraZ) {
        // Update left buildings
        for (let i = this.buildings.left.length - 1; i >= 0; i--) {
            this.buildings.left[i].position.z += gameSpeed;
            if (this.buildings.left[i].position.z > cameraZ + 30) {
                this.scene.remove(this.buildings.left[i]);
                this.buildings.left.splice(i, 1);
            }
        }
        
        // Update right buildings
        for (let i = this.buildings.right.length - 1; i >= 0; i--) {
            this.buildings.right[i].position.z += gameSpeed;
            if (this.buildings.right[i].position.z > cameraZ + 30) {
                this.scene.remove(this.buildings.right[i]);
                this.buildings.right.splice(i, 1);
            }
        }
        
        // Update street elements
        for (let i = this.streetElements.length - 1; i >= 0; i--) {
            this.streetElements[i].position.z += gameSpeed;
            if (this.streetElements[i].position.z > cameraZ + 30) {
                this.scene.remove(this.streetElements[i]);
                this.streetElements.splice(i, 1);
            }
        }
    }

    updateGround(cameraZ) {
        // Update main road position
        if (this.road) {
            this.road.position.z = cameraZ - (this.road.geometry.parameters.height / 2) + 100;
        }
        
        // Update sidewalks
        if (this.leftSidewalk) {
            this.leftSidewalk.position.z = cameraZ - (this.leftSidewalk.geometry.parameters.height / 2) + 100;
        }
        if (this.rightSidewalk) {
            this.rightSidewalk.position.z = cameraZ - (this.rightSidewalk.geometry.parameters.height / 2) + 100;
        }
    }

    reset() {
        // Clear all buildings
        ['left', 'right'].forEach(side => {
            this.buildings[side].forEach(building => this.scene.remove(building));
            this.buildings[side] = [];
        });
        
        // Clear street elements
        this.streetElements.forEach(element => this.scene.remove(element));
        this.streetElements = [];
        
        // Reset tracking
        this.cityBlocks.lastBuildingZ = { left: 0, right: 0 };
        this.cityBlocks.lastTreeZ = { left: 0, right: 0 };
    }

    getGround() {
        return this.road;
    }
}
