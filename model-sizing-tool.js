import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export class ModelSizingTool {
    constructor() {
        this.loader = new GLTFLoader();
        this.dracoLoader = new DRACOLoader();
        this.dracoLoader.setDecoderPath('/draco/gltf/');
        this.loader.setDRACOLoader(this.dracoLoader);
        this.loadedModels = new Map();
        
        // Target sizes for current placeholder shapes
        this.targetSizes = {
            // Collectables (current sizes from collectables.js)
            'waterDrop': new THREE.Vector3(0.4, 0.4, 0.4), // SphereGeometry(0.2) = diameter 0.4
            'blueprint': new THREE.Vector3(0.3, 0.3, 0.05), // BoxGeometry(0.3, 0.3, 0.05)
            'energyCell': new THREE.Vector3(0.3, 0.4, 0.3), // CylinderGeometry(0.15, 0.15, 0.4)
            'aerialStar': new THREE.Vector3(0.6, 0.6, 0.6), // OctahedronGeometry(0.3) = ~0.6 bounding
            
            // Power-ups (current sizes from collectables.js)
            'hardHat': new THREE.Vector3(0.4, 0.4, 0.4), // ConeGeometry(0.2, 0.4)
            'helicopter': new THREE.Vector3(0.5, 0.3, 0.5), // Custom helicopter mesh
            'solarPower': new THREE.Vector3(0.5, 0.1, 0.5), // CircleGeometry(0.25) flat
            'windPower': new THREE.Vector3(0.4, 0.4, 0.4), // SphereGeometry(0.2)
            'waterPipeline': new THREE.Vector3(0.4, 0.4, 0.1), // TorusGeometry(0.2, 0.05)
            
            // Obstacles (current sizes from obstacles.js)
            'pothole': new THREE.Vector3(1.0, 0.2, 1.0), // CylinderGeometry(0.5, 0.5, 0.1)
            'constructionBarrier': new THREE.Vector3(1.5, 1.0, 0.3), // BoxGeometry(1.5, 1, 0.3)
            'cone': new THREE.Vector3(0.6, 0.8, 0.6), // ConeGeometry(0.3, 0.8)
            'rubble': new THREE.Vector3(0.8, 0.4, 0.8) // BoxGeometry(0.8, 0.4, 0.8)
        };
        
        // Model file mappings (using absolute paths for browser compatibility)
        this.modelMappings = {
            // Collectables
            'waterDrop': '/assets/models/collectables/Bucket.glb',
            'blueprint': '/assets/models/collectables/blue_print.glb',
            'energyCell': '/assets/models/collectables/energy-cell.glb',
            'aerialStar': '/assets/models/collectables/Star.glb',
            
            // Power-ups
            'hardHat': '/assets/models/power-ups/hard_hat.glb',
            'helicopter': '/assets/models/power-ups/Jet-Pack.glb',
            'solarPower': '/assets/models/power-ups/Solar Panel Ground.glb',
            'windPower': '/assets/models/power-ups/Boots.glb',
            'waterPipeline': '/assets/models/power-ups/FireHydrant.glb',
            
            // Obstacles
            'pothole': '/assets/models/obstacles/Floor Hole.glb',
            'constructionBarrier': '/assets/models/obstacles/Plastic Barrier.glb',
            'cone': '/assets/models/obstacles/Cone.glb',
            'rubble': '/assets/models/obstacles/Cinder block.glb'
        };
    }
    
    async verifyAndResizeModel(placeholderType) {
        const modelPath = this.modelMappings[placeholderType];
        if (!modelPath) {
            return null;
        }
        
        try {
            
            // Load the model
            const gltf = await this.loader.loadAsync(modelPath);
            this.loadedModels.set(placeholderType, gltf);
            
            // Get model's current bounding box
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const currentSize = box.getSize(new THREE.Vector3());
            const targetSize = this.targetSizes[placeholderType];
            
            // Calculate required scale factors
            const scaleX = targetSize.x / currentSize.x;
            const scaleY = targetSize.y / currentSize.y;
            const scaleZ = targetSize.z / currentSize.z;
            
            // Use uniform scaling (smallest scale factor to ensure it fits)
            const uniformScale = Math.min(scaleX, scaleY, scaleZ);
            
            const analysis = {
                placeholderType,
                modelPath,
                currentSize: {
                    x: currentSize.x.toFixed(3),
                    y: currentSize.y.toFixed(3),
                    z: currentSize.z.toFixed(3)
                },
                targetSize: {
                    x: targetSize.x.toFixed(3),
                    y: targetSize.y.toFixed(3),
                    z: targetSize.z.toFixed(3)
                },
                recommendedScale: [uniformScale.toFixed(3), uniformScale.toFixed(3), uniformScale.toFixed(3)],
                scaleFactors: {
                    x: scaleX.toFixed(3),
                    y: scaleY.toFixed(3),
                    z: scaleZ.toFixed(3)
                },
                finalSize: {
                    x: (currentSize.x * uniformScale).toFixed(3),
                    y: (currentSize.y * uniformScale).toFixed(3),
                    z: (currentSize.z * uniformScale).toFixed(3)
                }
            };
            
            return analysis;
            
        } catch (error) {
            return null;
        }
    }
    
    async verifyAllModels() {
        const results = [];
        
        for (const placeholderType of Object.keys(this.modelMappings)) {
            const analysis = await this.verifyAndResizeModel(placeholderType);
            if (analysis) {
                results.push(analysis);
            }
            
            // Small delay to prevent overwhelming the loader
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Generate summary report
        this.generateSummaryReport(results);
        return results;
    }
    
    generateSummaryReport(results) {
        
        const categories = {
            'Collectables': ['waterDrop', 'blueprint', 'energyCell', 'aerialStar'],
            'Power-ups': ['hardHat', 'helicopter', 'solarPower', 'windPower', 'waterPipeline'],
            'Obstacles': ['pothole', 'constructionBarrier', 'cone', 'rubble']
        };
        
        for (const [category, types] of Object.entries(categories)) {
            
            types.forEach(type => {
                const result = results.find(r => r.placeholderType === type);
                if (result) {
                } else {
                }
            });
        }
        
    }
    
    // Test a single model in a minimal scene (for debugging)
    async testModelInScene(placeholderType, containerElement = null) {
        const analysis = await this.verifyAndResizeModel(placeholderType);
        if (!analysis) return null;
        
        // Create minimal test scene
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        
        if (containerElement) {
            containerElement.appendChild(renderer.domElement);
        }
        
        // Add lighting
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(5, 5, 5);
        scene.add(light);
        
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        scene.add(ambientLight);
        
        // Add model with recommended scale
        const gltf = this.loadedModels.get(placeholderType);
        const model = gltf.scene.clone();
        const scale = parseFloat(analysis.recommendedScale[0]);
        model.scale.set(scale, scale, scale);
        scene.add(model);
        
        // Position camera
        camera.position.set(2, 2, 2);
        camera.lookAt(0, 0, 0);
        
        // Render
        renderer.setSize(400, 400);
        renderer.render(scene, camera);
        
        return { scene, model, analysis };
    }
    
    // Generate configuration object for easy integration
    generateConfigurationCode(results) {
        const config = {};
        
        results.forEach(result => {
            if (result) {
                config[result.placeholderType] = {
                    path: result.modelPath,
                    scale: result.recommendedScale.map(s => parseFloat(s)),
                    originalSize: result.currentSize,
                    targetSize: result.targetSize
                };
            }
        });
        
        
        return config;
    }
}

// Utility function to run analysis from console/testing
export async function runModelAnalysis() {
    const tool = new ModelSizingTool();
    const results = await tool.verifyAllModels();
    const config = tool.generateConfigurationCode(results);
    return { results, config };
}