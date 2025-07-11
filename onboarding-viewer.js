// Simple onboarding model viewer that works with both dev and production
export class OnboardingModelViewer {
    constructor() {
        this.viewers = new Map();
        this.loadedModels = new Map();
        this.animationIds = new Map();
        
        // Will be initialized in init() method
        this.THREE = null;
        this.GLTFLoader = null;
        this.DRACOLoader = null;
        this.MODEL_CONFIGURATIONS = null;
        this.loader = null;
        this.dracoLoader = null;
    }
    
    async init() {
        // Check if we're in a development environment by trying to access import.meta
        let isDevelopment = false;
        try {
            // This will work in development but may not in production
            isDevelopment = import.meta.env?.DEV || false;
        } catch (e) {
            isDevelopment = false;
        }
        
        // Also check if global variables are already available (production case)
        const hasGlobals = window.THREE && window.MODEL_CONFIGURATIONS;
        
        if (!isDevelopment || hasGlobals) {
            // Production mode or globals already available
            console.log('Using global Three.js (production mode)');
            
            // Wait for global Three.js and MODEL_CONFIGURATIONS if not available
            if (!window.THREE || !window.MODEL_CONFIGURATIONS) {
                console.log('Waiting for Three.js and MODEL_CONFIGURATIONS to load...');
                await new Promise(resolve => {
                    const checkGlobals = () => {
                        if (window.THREE && window.THREE.GLTFLoader && window.MODEL_CONFIGURATIONS) {
                            resolve();
                        } else {
                            setTimeout(checkGlobals, 100);
                        }
                    };
                    checkGlobals();
                });
            }
            
            this.THREE = window.THREE;
            this.GLTFLoader = window.THREE.GLTFLoader;
            this.DRACOLoader = window.THREE.DRACOLoader;
            this.MODEL_CONFIGURATIONS = window.MODEL_CONFIGURATIONS;
        } else {
            // Development mode - try dynamic imports
            try {
                console.log('Development mode: Loading modules dynamically');
                const [threeModule, gltfModule, dracoModule, configModule] = await Promise.all([
                    import('three'),
                    import('three/examples/jsm/loaders/GLTFLoader.js'),
                    import('three/examples/jsm/loaders/DRACOLoader.js'),
                    import('./model-configurations.js')
                ]);
                
                this.THREE = threeModule;
                this.GLTFLoader = gltfModule.GLTFLoader;
                this.DRACOLoader = dracoModule.DRACOLoader;
                this.MODEL_CONFIGURATIONS = configModule.MODEL_CONFIGURATIONS;
                
                console.log('Loaded Three.js modules (development mode)');
            } catch (error) {
                // Fallback to global variables even in development
                console.log('Dynamic imports failed, falling back to globals:', error.message);
                
                await new Promise(resolve => {
                    const checkGlobals = () => {
                        if (window.THREE && window.THREE.GLTFLoader && window.MODEL_CONFIGURATIONS) {
                            resolve();
                        } else {
                            setTimeout(checkGlobals, 100);
                        }
                    };
                    checkGlobals();
                });
                
                this.THREE = window.THREE;
                this.GLTFLoader = window.THREE.GLTFLoader;
                this.DRACOLoader = window.THREE.DRACOLoader;
                this.MODEL_CONFIGURATIONS = window.MODEL_CONFIGURATIONS;
            }
        }
        
        if (!this.THREE || !this.MODEL_CONFIGURATIONS) {
            throw new Error('Three.js or MODEL_CONFIGURATIONS not available');
        }
        
        console.log('Onboarding viewer initialized with', Object.keys(this.MODEL_CONFIGURATIONS).length, 'model configurations');
        this.initializeLoaders();
        return this;
    }
    
    initializeLoaders() {
        this.loader = new this.GLTFLoader();
        this.dracoLoader = new this.DRACOLoader();
        this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        this.loader.setDRACOLoader(this.dracoLoader);
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
        const scene = new this.THREE.Scene();
        const camera = new this.THREE.PerspectiveCamera(50, 1, 0.1, 1000);
        const renderer = new this.THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setSize(120, 120);
        renderer.setClearColor(0x000000, 0);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = this.THREE.PCFSoftShadowMap;

        // Add lighting (matching main game lighting)
        const ambientLight = new this.THREE.AmbientLight(0xFFE5B4, 0.9);
        scene.add(ambientLight);
        
        const directionalLight = new this.THREE.DirectionalLight(0xFFFFE0, 1.2);
        directionalLight.position.set(2, 2, 2);
        directionalLight.castShadow = true;
        scene.add(directionalLight);

        const fillLight = new this.THREE.DirectionalLight(0xFFE5B4, 0.4);
        fillLight.position.set(-2, 1, -1);
        scene.add(fillLight);
        
        const topLight = new this.THREE.DirectionalLight(0xFFFFE0, 0.6);
        topLight.position.set(0, 3, 0);
        scene.add(topLight);

        // Position camera for optimal viewing
        camera.position.set(0.5, 0.5, 2.5);
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
            scene.add(model);
            
            const box = new this.THREE.Box3().setFromObject(model);
            const center = box.getCenter(new this.THREE.Vector3());
            const size = box.getSize(new this.THREE.Vector3());
            
            model.position.set(-center.x, -center.y, -center.z);
            
            const maxDim = Math.max(size.x, size.y, size.z);
            const targetSize = 1.8;
            const scale = targetSize / maxDim;
            model.scale.multiplyScalar(scale);
            
            box.setFromObject(model);
            const newCenter = box.getCenter(new this.THREE.Vector3());
            model.position.set(-newCenter.x, -newCenter.y, -newCenter.z);
            model.position.y -= 0.1;
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

        const config = this.MODEL_CONFIGURATIONS?.[modelKey];
        if (!config) {
            throw new Error(`No configuration found for model: ${modelKey}`);
        }

        return new Promise((resolve, reject) => {
            this.loader.load(
                config.path,
                (gltf) => {
                    const model = gltf.scene;
                    
                    if (config.scale) {
                        model.scale.set(...config.scale);
                    }
                    
                    model.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            if (child.material) {
                                child.material = child.material.clone();
                                child.material.metalness = 0.2;
                                child.material.roughness = 0.6;
                                
                                if (child.material.color) {
                                    child.material.color.multiplyScalar(1.2);
                                }
                                
                                child.material.emissive = new this.THREE.Color(0x222222);
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
        const config = this.MODEL_CONFIGURATIONS?.[modelKey];
        let geometry;
        let color = 0x666666;

        switch (config?.fallback) {
            case 'box':
                geometry = new this.THREE.BoxGeometry(0.5, 0.5, 0.1);
                color = 0x4a90e2;
                break;
            case 'sphere':
                geometry = new this.THREE.SphereGeometry(0.3, 16, 16);
                color = 0x00bcd4;
                break;
            case 'cylinder':
                geometry = new this.THREE.CylinderGeometry(0.2, 0.2, 0.6, 16);
                color = 0xffc107;
                break;
            case 'cone':
                geometry = new this.THREE.ConeGeometry(0.25, 0.5, 16);
                color = 0xff9800;
                break;
            case 'circle':
                geometry = new this.THREE.CircleGeometry(0.35, 16);
                color = 0xffc107;
                break;
            default:
                geometry = new this.THREE.BoxGeometry(0.4, 0.4, 0.4);
                break;
        }

        const material = new this.THREE.MeshPhongMaterial({ 
            color: color,
            shininess: 50,
            emissive: new this.THREE.Color(color).multiplyScalar(0.15),
            metalness: 0.2,
            roughness: 0.6
        });
        
        const mesh = new this.THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        return mesh;
    }
    
    cleanup() {
        this.animationIds.forEach((id) => {
            cancelAnimationFrame(id);
        });
        this.animationIds.clear();

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