import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MODEL_CONFIGURATIONS } from './model-configurations.js';

export class OnboardingModelViewer {
    constructor() {
        this.viewers = new Map();
        this.loader = new GLTFLoader();
        this.dracoLoader = new DRACOLoader();
        this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        this.loader.setDRACOLoader(this.dracoLoader);
        this.loadedModels = new Map();
        this.animationIds = new Map();
    }

    async createModelViewer(containerId, modelKey, description) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Create canvas element
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 120;
        canvas.style.maxWidth = '100%';
        canvas.style.height = 'auto';
        canvas.style.borderRadius = '8px';
        canvas.style.background = 'linear-gradient(135deg, #1a1a1a, #2a2a2a)';
        canvas.style.border = '1px solid #333';
        
        // Create scene
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setSize(120, 120);
        renderer.setClearColor(0x000000, 0);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Add lighting (matching main game lighting)
        const ambientLight = new THREE.AmbientLight(0xFFE5B4, 0.9); // Warm beige, brighter for small viewer
        scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xFFFFE0, 1.2); // Warm white, brighter
        directionalLight.position.set(2, 2, 2);
        directionalLight.castShadow = true;
        scene.add(directionalLight);

        // Add fill lighting from opposite side
        const fillLight = new THREE.DirectionalLight(0xFFE5B4, 0.4);
        fillLight.position.set(-2, 1, -1);
        scene.add(fillLight);
        
        // Add top-down light for better visibility
        const topLight = new THREE.DirectionalLight(0xFFFFE0, 0.6);
        topLight.position.set(0, 3, 0);
        scene.add(topLight);

        // Position camera for optimal viewing
        camera.position.set(0.5, 0.5, 2.5); // Slightly elevated and offset
        camera.lookAt(0, 0, 0);

        // Load and add model
        let model;
        try {
            model = await this.loadModel(modelKey);
        } catch (error) {
            console.warn(`Failed to load model ${modelKey}, using fallback`);
            model = this.createFallbackModel(modelKey);
        }

        if (model) {
            // First, ensure the model is properly positioned
            scene.add(model);
            
            // Calculate bounding box after adding to scene
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            // Center the model precisely
            model.position.set(-center.x, -center.y, -center.z);
            
            // Scale model to fit viewer properly
            const maxDim = Math.max(size.x, size.y, size.z);
            const targetSize = 1.8; // Much larger to make models clearly visible
            const scale = targetSize / maxDim;
            model.scale.multiplyScalar(scale);
            
            // Recalculate after scaling and position for perfect centering
            box.setFromObject(model);
            const newCenter = box.getCenter(new THREE.Vector3());
            model.position.set(-newCenter.x, -newCenter.y, -newCenter.z);
            
            // Slight adjustment for better viewing angle
            model.position.y -= 0.1; // Move slightly down for better framing
        }

        // Animation loop - simple rotation only
        let rotationSpeed = 0.01;
        const animate = () => {
            if (model) {
                model.rotation.y += rotationSpeed;
            }
            renderer.render(scene, camera);
            const animationId = requestAnimationFrame(animate);
            this.animationIds.set(containerId, animationId);
        };

        animate();

        // Store viewer data
        this.viewers.set(containerId, {
            scene,
            camera,
            renderer,
            model,
            canvas
        });

        // Replace container content
        container.innerHTML = `
            <div style="text-align: center;">
                <div style="margin-bottom: 8px;"></div>
                <div style="font-size: 12px; color: #ccc;">${description}</div>
            </div>
        `;
        container.children[0].children[0].appendChild(canvas);

        return canvas;
    }

    async loadModel(modelKey) {
        if (this.loadedModels.has(modelKey)) {
            return this.loadedModels.get(modelKey).clone();
        }

        const config = MODEL_CONFIGURATIONS[modelKey];
        if (!config) {
            throw new Error(`No configuration found for model: ${modelKey}`);
        }

        return new Promise((resolve, reject) => {
            this.loader.load(
                config.path,
                (gltf) => {
                    const model = gltf.scene;
                    
                    // Apply scaling from configuration
                    if (config.scale) {
                        model.scale.set(...config.scale);
                    }
                    
                    // Enhance materials for better visibility (matching main game)
                    model.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            if (child.material) {
                                // Clone material to avoid affecting main game
                                child.material = child.material.clone();
                                
                                // Enhance brightness and visibility
                                child.material.metalness = 0.2; // Slight metallic for better light response
                                child.material.roughness = 0.6; // Smoother surface
                                
                                // Boost material brightness
                                if (child.material.color) {
                                    child.material.color.multiplyScalar(1.2);
                                }
                                
                                // Add slight emissive glow for better visibility
                                child.material.emissive = new THREE.Color(0x222222);
                                
                                // Ensure material responds to lighting
                                child.material.needsUpdate = true;
                            }
                        }
                    });
                    
                    this.loadedModels.set(modelKey, model);
                    resolve(model.clone());
                },
                undefined,
                (error) => {
                    console.error(`Error loading model ${modelKey}:`, error);
                    reject(error);
                }
            );
        });
    }

    createFallbackModel(modelKey) {
        const config = MODEL_CONFIGURATIONS[modelKey];
        let geometry;
        let color = 0x666666;

        // Create appropriate fallback based on model type
        switch (config?.fallback) {
            case 'box':
                geometry = new THREE.BoxGeometry(0.5, 0.5, 0.1);
                color = 0x4a90e2; // Blue for blueprints
                break;
            case 'sphere':
                geometry = new THREE.SphereGeometry(0.3, 16, 16);
                color = 0x00bcd4; // Cyan for water
                break;
            case 'cylinder':
                geometry = new THREE.CylinderGeometry(0.2, 0.2, 0.6, 16);
                color = 0xffc107; // Yellow for energy cells
                break;
            case 'cone':
                geometry = new THREE.ConeGeometry(0.25, 0.5, 16);
                color = 0xff9800; // Orange for hard hat
                break;
            case 'circle':
                geometry = new THREE.CircleGeometry(0.35, 16);
                color = 0xffc107; // Yellow for solar panel
                break;
            default:
                geometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
                break;
        }

        const material = new THREE.MeshPhongMaterial({ 
            color: color,
            shininess: 50,
            emissive: new THREE.Color(color).multiplyScalar(0.15),
            metalness: 0.2,
            roughness: 0.6
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        return mesh;
    }

    cleanup() {
        // Stop all animations
        this.animationIds.forEach((id) => {
            cancelAnimationFrame(id);
        });
        this.animationIds.clear();

        // Dispose of all viewers
        this.viewers.forEach((viewer) => {
            if (viewer.renderer) {
                viewer.renderer.dispose();
            }
            if (viewer.scene) {
                viewer.scene.traverse((child) => {
                    if (child.geometry) {
                        child.geometry.dispose();
                    }
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(material => material.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
            }
        });
        this.viewers.clear();
    }
}

// Global instance for the onboarding system
export const onboardingModelViewer = new OnboardingModelViewer();