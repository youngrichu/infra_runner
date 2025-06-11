import { LANES, COLORS, SPAWN_CONFIG } from './constants.js';

export class Environment {
    constructor(scene) {
        this.scene = scene;
        this.ground = null;
        this.buildings = [];
        this.streetDecorations = []; // For trees, streetlights, etc.
        this.gameController = null; // Will be set by game.js
        
        this.setupScene();
        this.setupLighting();
        this.createGround();
    }

    setGameController(gameController) {
        this.gameController = gameController;
    }

    setupScene() {
        this.scene.background = new THREE.Color(COLORS.ENVIRONMENT.SKY_WARM);
        this.scene.fog = new THREE.Fog(COLORS.ENVIRONMENT.SKY_WARM, 50, 150); // Add fog, use warm sky color
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7.5);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
    }

    createGround() {
        // Create a canvas for the road texture
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const context = canvas.getContext('2d');

        // Fill background
        context.fillStyle = COLORS.ENVIRONMENT.ROAD_BASE;
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Add some road texture details
        context.fillStyle = COLORS.ENVIRONMENT.ROAD_TEXTURE;
        for(let i = 0; i < 50; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            context.fillRect(x, y, 4, 4);
        }

        // Create lines for road markings
        context.fillStyle = COLORS.ENVIRONMENT.ROAD_MARKINGS;
        context.fillRect(canvas.width/2 - 2, 0, 4, canvas.height);

        const roadTexture = new THREE.CanvasTexture(canvas);
        roadTexture.wrapS = THREE.RepeatWrapping;
        roadTexture.wrapT = THREE.RepeatWrapping;
        roadTexture.repeat.set(2, 200);

        // Create the main road
        const roadGeometry = new THREE.PlaneGeometry(LANES.POSITIONS[LANES.RIGHT] * 2 + 2, 1000); // Width based on lanes
        const roadMaterial = new THREE.MeshStandardMaterial({
            map: roadTexture,
            side: THREE.DoubleSide
        });
        this.road = new THREE.Mesh(roadGeometry, roadMaterial);
        this.road.rotation.x = -Math.PI / 2;
        this.road.receiveShadow = true;
        this.scene.add(this.road);

        // Create extended ground on the sides - this will now be managed by a dedicated spawning system
        this.sideAreas = [];
        this.lastSideAreaZ = 0; // Keep track of the last Z position for side areas
        this.spawnInitialSideAreas();

        // Keep a reference to the main road for other calculations if needed
        this.ground = this.road;
    }

    createBuilding(x, z, isInfrastructure = false) {
        let height, width, depth, color;
        const buildingType = Math.random();

        if (isInfrastructure) {
            height = Math.random() * 1 + 0.5;
            width = 0.3;
            depth = 2;
            color = COLORS.BUILDINGS.INFRASTRUCTURE;
        } else {
            // More varied building types for a cityscape
            if (buildingType < 0.3) { // Tall, slender building
                height = Math.random() * 8 + 10; // Taller range
                width = Math.random() * 1 + 1.5;
                depth = Math.random() * 1 + 1.5;
                color = COLORS.BUILDINGS.COMMERCIAL_HIGHRISE[Math.floor(Math.random() * COLORS.BUILDINGS.COMMERCIAL_HIGHRISE.length)];
            } else if (buildingType < 0.7) { // Wider, medium-height building
                height = Math.random() * 5 + 4;
                width = Math.random() * 2 + 2.5;
                depth = Math.random() * 2 + 2;
                color = COLORS.BUILDINGS.RESIDENTIAL_MIDRISE[Math.floor(Math.random() * COLORS.BUILDINGS.RESIDENTIAL_MIDRISE.length)];
            } else { // Smaller, under-construction look
                height = Math.random() * 3 + 1;
                width = Math.random() * 1.5 + 1;
                depth = Math.random() * 1.5 + 1;
                color = COLORS.BUILDINGS.UNDER_CONSTRUCTION[Math.floor(Math.random() * COLORS.BUILDINGS.UNDER_CONSTRUCTION.length)];
            }
        }

        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({ color: color });
        const building = new THREE.Mesh(geometry, material);
        building.position.set(x, height / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        this.scene.add(building);

        if (!isInfrastructure) {
            this.buildings.push(building);
        }
        return building;
    }

    startSpawning() {
        this.spawnBuildings();
        this.spawnStreetDecorations();
        // Initial side areas are spawned in createGround, continuous spawning handled in updateGround
    }

    spawnStreetDecorations() {
        if (!this.gameController || !this.gameController.isGameActive()) {
            return;
        }

        const playerZ = this.gameController.getPlayerPosition().z;
        const z = playerZ - 100; // Spawn ahead of the player

        // Randomly decide to spawn a tree or nothing for now
        if (Math.random() < SPAWN_CONFIG.STREET_DECORATION_CHANCE) {
            const side = Math.random() < 0.5 ? LANES.POSITIONS[LANES.LEFT] - SPAWN_CONFIG.STREET_DECORATION_OFFSET : LANES.POSITIONS[LANES.RIGHT] + SPAWN_CONFIG.STREET_DECORATION_OFFSET;
            this.createTree(side, z);
        }

        setTimeout(() => {
            this.spawnStreetDecorations();
        }, Math.random() * SPAWN_CONFIG.STREET_DECORATION_INTERVAL.MAX + SPAWN_CONFIG.STREET_DECORATION_INTERVAL.MIN);
    }

    createTree(x, z) {
        const trunkHeight = 2;
        const trunkRadius = 0.1;
        const foliageHeight = 1.5;
        const foliageRadius = 0.5;

        const trunkGeometry = new THREE.CylinderGeometry(trunkRadius, trunkRadius, trunkHeight, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: COLORS.ENVIRONMENT.TREE_TRUNK });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.set(x, trunkHeight / 2, z);
        trunk.castShadow = true;
        this.scene.add(trunk);
        this.streetDecorations.push(trunk);

        const foliageGeometry = new THREE.ConeGeometry(foliageRadius, foliageHeight, 8);
        const foliageMaterial = new THREE.MeshStandardMaterial({ color: COLORS.ENVIRONMENT.TREE_FOLIAGE });
        const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
        foliage.position.set(x, trunkHeight + foliageHeight / 2, z);
        foliage.castShadow = true;
        this.scene.add(foliage);
        this.streetDecorations.push(foliage);

        return [trunk, foliage]; // Return array of meshes for easier management if needed
    }

    spawnBuildings() {
        if (!this.gameController || !this.gameController.isGameActive()) {
            return;
        }

        const playerZ = this.gameController.getPlayerPosition().z;
        const z = playerZ - SPAWN_CONFIG.BUILDING_SPAWN_DISTANCE_AHEAD; // Spawn further ahead

        // Spawn a cluster of buildings for a denser feel
        const clusterSize = Math.floor(Math.random() * SPAWN_CONFIG.BUILDING_CLUSTER_SIZE.MAX) + SPAWN_CONFIG.BUILDING_CLUSTER_SIZE.MIN;
        for (let i = 0; i < clusterSize; i++) {
            const offsetX = (Math.random() - 0.5) * SPAWN_CONFIG.BUILDING_CLUSTER_SPREAD; // Spread buildings in a cluster
            const offsetZ = (Math.random() - 0.5) * SPAWN_CONFIG.BUILDING_CLUSTER_SPREAD;
            const side = Math.random() < 0.5 ? LANES.LEFT : LANES.RIGHT;
            let buildingX;
            if (side === LANES.LEFT) {
                buildingX = LANES.POSITIONS[LANES.LEFT] - SPAWN_CONFIG.BUILDING_OFFSET_FROM_ROAD - offsetX;
            } else {
                buildingX = LANES.POSITIONS[LANES.RIGHT] + SPAWN_CONFIG.BUILDING_OFFSET_FROM_ROAD + offsetX;
            }
            this.createBuilding(buildingX, z + offsetZ);
        }

        setTimeout(() => {
            this.spawnBuildings();
        }, Math.random() * SPAWN_CONFIG.BUILDING_INTERVAL.MAX + SPAWN_CONFIG.BUILDING_INTERVAL.MIN);
    }

    spawnInitialSideAreas() {
        // Spawn a few initial side areas to fill the view
        for (let i = 0; i < 10; i++) {
            this.spawnSideAreaSegment(this.gameController ? this.gameController.getPlayerPosition().z - i * SPAWN_CONFIG.SIDE_AREA_LENGTH : -i * SPAWN_CONFIG.SIDE_AREA_LENGTH);
        }
    }

    spawnSideAreaSegment(currentZ) {
        const segmentLength = SPAWN_CONFIG.SIDE_AREA_LENGTH;
        const segmentWidth = SPAWN_CONFIG.SIDE_AREA_WIDTH;
        const types = ['pavement', 'greenery', 'construction', 'greenery']; // Added 'greenery' again to increase its chance
        const chosenType = types[Math.floor(Math.random() * types.length)];
        let color;

        switch (chosenType) {
            case 'greenery':
                color = COLORS.ENVIRONMENT.GREENERY;
                break;
            case 'construction':
                color = COLORS.ENVIRONMENT.CONSTRUCTION_GROUND;
                break;
            case 'pavement':
            default:
                color = COLORS.ENVIRONMENT.PAVEMENT;
                break;
        }

        const geometry = new THREE.PlaneGeometry(segmentWidth, segmentLength);
        const material = new THREE.MeshStandardMaterial({ color: color, side: THREE.DoubleSide });

        // Left side
        const leftArea = new THREE.Mesh(geometry, material);
        leftArea.rotation.x = -Math.PI / 2;
        leftArea.position.set(- (this.road.geometry.parameters.width / 2 + segmentWidth / 2), 0, currentZ - segmentLength / 2);
        leftArea.receiveShadow = true;
        this.scene.add(leftArea);
        this.sideAreas.push(leftArea);

        // Right side
        const rightArea = new THREE.Mesh(geometry, material);
        rightArea.rotation.x = -Math.PI / 2;
        rightArea.position.set(this.road.geometry.parameters.width / 2 + segmentWidth / 2, 0, currentZ - segmentLength / 2);
        rightArea.receiveShadow = true;
        this.scene.add(rightArea);
        this.sideAreas.push(rightArea);

        this.lastSideAreaZ = currentZ - segmentLength;
    }

    updateBuildings(gameSpeed, cameraZ) {
        for (let i = this.buildings.length - 1; i >= 0; i--) {
            this.buildings[i].position.z += gameSpeed;
            if (this.buildings[i].position.z > cameraZ + 10) {
                this.scene.remove(this.buildings[i]);
                this.buildings.splice(i, 1);
            }
        }

        // Update street decorations
        for (let i = this.streetDecorations.length - 1; i >= 0; i--) {
            this.streetDecorations[i].position.z += gameSpeed;
            if (this.streetDecorations[i].position.z > cameraZ + 10) {
                this.scene.remove(this.streetDecorations[i]);
                this.streetDecorations.splice(i, 1);
            }
        }
    }

    updateGround(cameraZ) {
        if (this.road) {
            this.road.position.z = cameraZ - (this.road.geometry.parameters.height / 2) + 50;
        }

        // Update and spawn new side areas
        for (let i = this.sideAreas.length - 1; i >= 0; i--) {
            this.sideAreas[i].position.z = cameraZ - (this.road.geometry.parameters.height / 2) + 50 + (this.sideAreas[i].userData.initialZOffset || 0) ;
            // A more robust way to handle Z positioning relative to camera might be needed
            // For now, we'll simplify and assume they move with the road, then despawn/respawn
            if (this.sideAreas[i].position.z > cameraZ + SPAWN_CONFIG.SIDE_AREA_DESPAWN_OFFSET) {
                this.scene.remove(this.sideAreas[i]);
                this.sideAreas.splice(i, 1);
            }
        }
        // Spawn new segments if needed
        if (this.lastSideAreaZ > cameraZ - SPAWN_CONFIG.SIDE_AREA_SPAWN_TRIGGER_OFFSET) {
            this.spawnSideAreaSegment(this.lastSideAreaZ);
        }
    }

    reset() {
        // Clear all buildings
        this.buildings.forEach(building => this.scene.remove(building));
        this.buildings = [];

        // Clear all street decorations
        this.streetDecorations.forEach(decoration => this.scene.remove(decoration));
        this.streetDecorations = [];

        // Clear all side areas
        this.sideAreas.forEach(area => this.scene.remove(area));
        this.sideAreas = [];
    }

    getGround() {
        return this.road; // Return the main road for player interaction
    }
}