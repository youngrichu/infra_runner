import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LANES, COLORS, SPAWN_CONFIG } from './constants.js';

export class ReliableUrbanEnvironment {
    constructor(scene) {
        this.scene = scene;
        this.ground = null;
        this.activeBuildings = []; // Currently spawned buildings
        this.streetDecorations = [];
        this.gameController = null;
        
        // Optimized road dimensions
        this.roadWidth = 8; // Perfect for 3-lane system
        this.laneWidth = this.roadWidth / 3; 
        this.sidewalkWidth = 3;
        
        // Building templates - manually curated
        this.buildingTemplates = [];
        this.currentBuildingStyle = 0; // Cycle through different neighborhood styles
        
        this.setupScene();
        this.setupLighting();
        this.createOptimizedRoad();
        this.createBuildingTemplates(); // Manual building creation
        this.spawnInitialBuildings();
    }

    setGameController(gameController) {
        this.gameController = gameController;
    }

    setupScene() {
        this.scene.background = new THREE.Color(0xFFDAB9); // Warm peach
        this.scene.fog = new THREE.Fog(0xFFDAB9, 40, 150);
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xFFE5B4, 0.8);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xFFFFE0, 0.6);
        directionalLight.position.set(10, 15, 10);
        directionalLight.castShadow = true;
        
        // Performance-optimized shadows
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        directionalLight.shadow.camera.near = 1;
        directionalLight.shadow.camera.far = 80;
        directionalLight.shadow.camera.left = -40;
        directionalLight.shadow.camera.right = 40;
        directionalLight.shadow.camera.top = 40;
        directionalLight.shadow.camera.bottom = -40;
        
        this.scene.add(directionalLight);
        
        console.log('Reliable urban environment setup complete');
    }

    createBuildingTemplates() {
        // Create curated African urban building templates
        this.buildingTemplates = [
            this.createOfficeTemplate(),
            this.createResidentialTemplate(),
            this.createCommercialTemplate(),
            this.createMixedUseTemplate(),
            this.createTraditionalTemplate(),
            this.createModernTemplate()
        ];
        
        console.log(`Created ${this.buildingTemplates.length} curated building templates`);
    }

    createOfficeTemplate() {
        const group = new THREE.Group();
        
        // Main office tower
        const towerGeometry = new THREE.BoxGeometry(4, 12, 3);
        const towerMaterial = new THREE.MeshStandardMaterial({
            color: 0x0047AB, // Corporate blue
            roughness: 0.3,
            metalness: 0.2
        });
        const tower = new THREE.Mesh(towerGeometry, towerMaterial);
        tower.position.y = 6;
        tower.castShadow = true;
        tower.receiveShadow = true;
        group.add(tower);
        
        // Glass facade effect
        for (let floor = 0; floor < 5; floor++) {
            const windowGeometry = new THREE.PlaneGeometry(3.5, 2);
            const windowMaterial = new THREE.MeshStandardMaterial({
                color: 0x87CEEB,
                transparent: true,
                opacity: 0.4,
                metalness: 0.8,
                roughness: 0.1
            });
            const windows = new THREE.Mesh(windowGeometry, windowMaterial);
            windows.position.set(2.1, 2 + (floor * 2.2), 0);
            group.add(windows);
        }
        
        // Building name/sign
        const signGeometry = new THREE.BoxGeometry(3, 0.5, 0.1);
        const signMaterial = new THREE.MeshStandardMaterial({ color: 0xFFD700 });
        const sign = new THREE.Mesh(signGeometry, signMaterial);
        sign.position.set(0, 11, 1.6);
        group.add(sign);
        
        group.userData = { type: 'office', name: 'Office Tower' };
        return group;
    }

    createResidentialTemplate() {
        const group = new THREE.Group();
        
        // Main residential building
        const buildingGeometry = new THREE.BoxGeometry(6, 8, 4);
        const buildingMaterial = new THREE.MeshStandardMaterial({
            color: 0xFF6347, // Warm terracotta
            roughness: 0.7,
            metalness: 0.0
        });
        const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
        building.position.y = 4;
        building.castShadow = true;
        building.receiveShadow = true;
        group.add(building);
        
        // Balconies
        for (let floor = 0; floor < 3; floor++) {
            const balconyGeometry = new THREE.BoxGeometry(5, 0.2, 1);
            const balconyMaterial = new THREE.MeshStandardMaterial({ color: 0xDEB887 });
            const balcony = new THREE.Mesh(balconyGeometry, balconyMaterial);
            balcony.position.set(0, 2 + (floor * 2.5), 2.6);
            balcony.castShadow = true;
            group.add(balcony);
        }
        
        // Colorful accents (African style)
        const accentGeometry = new THREE.BoxGeometry(0.3, 8, 4.2);
        const accentMaterial = new THREE.MeshStandardMaterial({ color: 0xFFD700 });
        const accent = new THREE.Mesh(accentGeometry, accentMaterial);
        accent.position.set(-3.2, 4, 0);
        group.add(accent);
        
        group.userData = { type: 'residential', name: 'Residential Complex' };
        return group;
    }

    createCommercialTemplate() {
        const group = new THREE.Group();
        
        // Commercial/retail building
        const shopGeometry = new THREE.BoxGeometry(8, 5, 3);
        const shopMaterial = new THREE.MeshStandardMaterial({
            color: 0x663399, // Rich purple
            roughness: 0.6,
            metalness: 0.1
        });
        const shop = new THREE.Mesh(shopGeometry, shopMaterial);
        shop.position.y = 2.5;
        shop.castShadow = true;
        shop.receiveShadow = true;
        group.add(shop);
        
        // Storefront windows
        const windowGeometry = new THREE.PlaneGeometry(7, 2);
        const windowMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.6
        });
        const storefront = new THREE.Mesh(windowGeometry, windowMaterial);
        storefront.position.set(0, 1.5, 1.6);
        group.add(storefront);
        
        // Awning
        const awningGeometry = new THREE.BoxGeometry(8.5, 0.1, 1.5);
        const awningMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
        const awning = new THREE.Mesh(awningGeometry, awningMaterial);
        awning.position.set(0, 3, 2.2);
        group.add(awning);
        
        group.userData = { type: 'commercial', name: 'Shopping Center' };
        return group;
    }

    createMixedUseTemplate() {
        const group = new THREE.Group();
        
        // Mixed-use building (shop below, apartments above)
        const baseGeometry = new THREE.BoxGeometry(5, 3, 3);
        const baseMaterial = new THREE.MeshStandardMaterial({ color: 0xDC143C });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = 1.5;
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);
        
        const upperGeometry = new THREE.BoxGeometry(5, 6, 3);
        const upperMaterial = new THREE.MeshStandardMaterial({ color: 0xFFD700 });
        const upper = new THREE.Mesh(upperGeometry, upperMaterial);
        upper.position.y = 6;
        upper.castShadow = true;
        upper.receiveShadow = true;
        group.add(upper);
        
        // Roof detail
        const roofGeometry = new THREE.BoxGeometry(5.5, 0.5, 3.5);
        const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.y = 9.5;
        group.add(roof);
        
        group.userData = { type: 'mixed', name: 'Mixed Use Building' };
        return group;
    }

    createTraditionalTemplate() {
        const group = new THREE.Group();
        
        // Traditional African inspired building
        const buildingGeometry = new THREE.BoxGeometry(4, 4, 4);
        const buildingMaterial = new THREE.MeshStandardMaterial({
            color: 0xCD853F, // Earth tone
            roughness: 0.8,
            metalness: 0.0
        });
        const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
        building.position.y = 2;
        building.castShadow = true;
        building.receiveShadow = true;
        group.add(building);
        
        // Traditional flat roof
        const roofGeometry = new THREE.BoxGeometry(4.5, 0.3, 4.5);
        const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xA0522D });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.y = 4.3;
        group.add(roof);
        
        // Decorative elements
        const decorGeometry = new THREE.BoxGeometry(0.2, 4, 4.2);
        const decorMaterial = new THREE.MeshStandardMaterial({ color: 0xFFD700 });
        const decor = new THREE.Mesh(decorGeometry, decorMaterial);
        decor.position.set(2.2, 2, 0);
        group.add(decor);
        
        group.userData = { type: 'traditional', name: 'Traditional Building' };
        return group;
    }

    createModernTemplate() {
        const group = new THREE.Group();
        
        // Modern high-rise
        const towerGeometry = new THREE.BoxGeometry(3, 15, 3);
        const towerMaterial = new THREE.MeshStandardMaterial({
            color: 0x228B22, // Modern green
            roughness: 0.2,
            metalness: 0.4
        });
        const tower = new THREE.Mesh(towerGeometry, towerMaterial);
        tower.position.y = 7.5;
        tower.castShadow = true;
        tower.receiveShadow = true;
        group.add(tower);
        
        // Modern glass sections
        for (let section = 0; section < 6; section++) {
            const glassGeometry = new THREE.PlaneGeometry(2.8, 2);
            const glassMaterial = new THREE.MeshStandardMaterial({
                color: 0x87CEEB,
                transparent: true,
                opacity: 0.3,
                metalness: 0.9,
                roughness: 0.1
            });
            const glass = new THREE.Mesh(glassGeometry, glassMaterial);
            glass.position.set(1.6, 1 + (section * 2.3), 0);
            group.add(glass);
        }
        
        group.userData = { type: 'modern', name: 'Modern Tower' };
        return group;
    }

    createOptimizedRoad() {
        // Create clear 3-lane road texture
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

        // Lane markings - aligned with [-2, 0, 2] positions
        context.fillStyle = '#FFFFFF';
        for(let i = 0; i < canvas.height; i += 20) {
            // Left lane divider
            context.fillRect(canvas.width/3 - 1, i, 2, 10);
            // Right lane divider
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

        this.createOptimizedSidewalks();
        this.ground = this.road;
        
        console.log('Optimized 3-lane road created with clear markings');
    }

    createOptimizedSidewalks() {
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
        // Create initial cityscape
        for (let i = 0; i < 6; i++) {
            this.spawnCuratedBuilding(-20 - (i * 40));
        }
    }

    spawnCuratedBuilding(zPosition) {
        // Select building template in a planned way (not random)
        const templateIndex = this.currentBuildingStyle % this.buildingTemplates.length;
        const template = this.buildingTemplates[templateIndex];
        this.currentBuildingStyle++;
        
        const building = template.clone();
        
        // Appropriate scaling
        const scale = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
        building.scale.setScalar(scale);
        
        // Proper urban positioning
        const side = Math.random() < 0.5 ? 'left' : 'right';
        const setback = 8 + Math.random() * 6; // 8-14 units behind sidewalk
        const xOffset = side === 'left' ? 
            -(this.roadWidth/2 + this.sidewalkWidth + setback) : 
            (this.roadWidth/2 + this.sidewalkWidth + setback);
        
        building.position.set(xOffset, 0, zPosition);
        building.rotation.y = (Math.random() - 0.5) * 0.1; // Subtle rotation
        
        this.scene.add(building);
        this.activeBuildings.push({
            object: building,
            zPosition: zPosition,
            type: template.userData.type,
            name: template.userData.name
        });

        console.log(`${template.userData.name} spawned at X: ${xOffset.toFixed(1)}, Z: ${zPosition}`);
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

        // Spawn buildings with planned variety
        if (Math.random() < 0.4) { // 40% chance
            this.spawnCuratedBuilding(spawnZ);
        }

        // Add street trees occasionally
        if (Math.random() < 0.2) {
            this.createStreetTree(spawnZ);
        }

        setTimeout(() => {
            this.spawnUrbanElements();
        }, 2500); // Every 2.5 seconds
    }

    createStreetTree(zPosition) {
        // Simple street tree
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
        // Update buildings
        for (let i = this.activeBuildings.length - 1; i >= 0; i--) {
            const building = this.activeBuildings[i];
            building.object.position.z += gameSpeed;
            building.zPosition += gameSpeed;

            if (building.zPosition > cameraZ + 80) {
                this.scene.remove(building.object);
                this.activeBuildings.splice(i, 1);
            }
        }

        // Update decorations
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

        this.currentBuildingStyle = 0;
        this.spawnInitialBuildings();
    }

    getGround() {
        return this.road;
    }

    updateBuildings(gameSpeed, cameraZ) {
        this.updateModels(gameSpeed, cameraZ);
    }

    // Get current neighborhood info for UI/features
    getCurrentNeighborhood() {
        const buildingTypes = ['office', 'residential', 'commercial', 'mixed', 'traditional', 'modern'];
        const currentType = buildingTypes[this.currentBuildingStyle % buildingTypes.length];
        
        const neighborhoods = {
            office: 'Business District',
            residential: 'Housing Quarter',
            commercial: 'Shopping District', 
            mixed: 'Mixed Development',
            traditional: 'Heritage Area',
            modern: 'New Town'
        };
        
        return neighborhoods[currentType] || 'Urban Area';
    }
}
