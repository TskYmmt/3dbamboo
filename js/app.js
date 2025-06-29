class TanabataApp {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.bambooModel = null;
        this.tanzakuList = [];
        this.selectedTanzaku = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.controls = null;
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            q: false,
            e: false,
            shift: false
        };
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.isPointerLocked = false;
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.velocity = new THREE.Vector3();
        
        // Virtual joystick for mobile
        this.joystickActive = false;
        this.joystickCenter = { x: 0, y: 0 };
        this.joystickOffset = { x: 0, y: 0 };
        
        // API settings
        // Use same origin for production deployment (render.com)
        this.apiBaseUrl = window.location.origin;
        this.loadingTanzaku = false;
        
        // Loading tracking
        this.loadingStates = {
            bambooModel: false,
            imageTanzaku: false,
            existingTanzaku: false
        };
        this.allAssetsLoaded = false;
        
        this.init();
    }

    init() {
        this.setupScene();
        this.setupLights();
        this.setupControls();
        this.loadBambooModel();
        this.setupEventListeners();
        this.loadImageTanzaku();
        this.loadExistingTanzaku();
        this.animate();
        
        // Expose developer commands to console
        this.exposeDevModeToConsole();
        
        // Show entry modal on load
        document.getElementById('qr-entry').classList.remove('hidden');
    }

    checkAllAssetsLoaded() {
        const allLoaded = Object.values(this.loadingStates).every(state => state === true);
        
        if (allLoaded && !this.allAssetsLoaded) {
            this.allAssetsLoaded = true;
            
            // Hide loading indicator and enable enter button
            const loadingIndicator = document.getElementById('loading-indicator');
            const enterBtn = document.getElementById('enter-btn');
            const loadingText = document.getElementById('loading-text');
            
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            if (enterBtn) enterBtn.disabled = false;
            if (loadingText) loadingText.textContent = '読み込み完了！';
            
            console.log('All assets loaded successfully!');
        }
    }

    updateLoadingState(asset, loaded = true) {
        this.loadingStates[asset] = loaded;
        const loadingText = document.getElementById('loading-text');
        
        const loadedCount = Object.values(this.loadingStates).filter(state => state === true).length;
        const totalAssets = Object.keys(this.loadingStates).length;
        
        if (loadingText) {
            loadingText.textContent = `読み込み中... (${loadedCount}/${totalAssets})`;
        }
        
        this.checkAllAssetsLoaded();
    }

    // Helper function to create fetch with timeout
    fetchWithTimeout(url, options = {}, timeout = 10000) {
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), timeout)
            )
        ]);
    }

    setupScene() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        
        // Camera
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        this.camera.position.set(0, 10, 35);
        if (this.bambooModel) {
            const box = new THREE.Box3().setFromObject(this.bambooModel);
            const center = box.getCenter(new THREE.Vector3());
            this.camera.lookAt(center);
        } else {
            this.camera.lookAt(0, 5, 0);
        }
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: document.getElementById('three-canvas'),
            antialias: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    setupLights() {
        // Ambient light
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);
        
        // Directional light (sun)
        const directional = new THREE.DirectionalLight(0xffffff, 0.8);
        directional.position.set(5, 10, 5);
        directional.castShadow = true;
        directional.shadow.camera.near = 0.1;
        directional.shadow.camera.far = 50;
        directional.shadow.camera.left = -10;
        directional.shadow.camera.right = 10;
        directional.shadow.camera.top = 10;
        directional.shadow.camera.bottom = -10;
        directional.shadow.mapSize.width = 1024;
        directional.shadow.mapSize.height = 1024;
        this.scene.add(directional);
    }

    setupControls() {
        // Set initial camera position (moved much further back)
        this.camera.position.set(0, 10, 35);
        this.camera.lookAt(0, 5, 0);
        
        if (!this.isMobile) {
            // PC: Setup pointer lock for mouse look
            this.setupPointerLock();
        } else {
            // Mobile: Setup virtual joystick
            this.setupVirtualJoystick();
        }
    }

    setupPointerLock() {
        const canvas = this.renderer.domElement;
        
        // Click to lock pointer
        canvas.addEventListener('click', () => {
            if (!this.isPointerLocked) {
                canvas.requestPointerLock();
            }
        });
        
        // Pointer lock events
        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = document.pointerLockElement === canvas;
        });
        
        // Mouse movement for looking around
        document.addEventListener('mousemove', (e) => {
            if (this.isPointerLocked) {
                const sensitivity = 0.002;
                this.euler.setFromQuaternion(this.camera.quaternion);
                this.euler.y -= e.movementX * sensitivity;
                this.euler.x -= e.movementY * sensitivity;
                this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));
                this.camera.quaternion.setFromEuler(this.euler);
            }
        });
    }

    setupVirtualJoystick() {
        // Create virtual controls HTML
        const controlsHTML = `
            <div id="virtual-controls" class="virtual-controls">
                <div id="movement-pad" class="movement-pad">
                    <button class="pad-btn up-btn" data-key="w">↑</button>
                    <button class="pad-btn left-btn" data-key="a">←</button>
                    <button class="pad-btn center-btn"></button>
                    <button class="pad-btn right-btn" data-key="d">→</button>
                    <button class="pad-btn down-btn" data-key="s">↓</button>
                </div>
                <div id="vertical-pad" class="vertical-pad">
                    <button class="pad-btn vertical-up-btn" data-key="q">↑</button>
                    <button class="pad-btn vertical-down-btn" data-key="e">↓</button>
                </div>
                <div id="pinch-help" class="pinch-help">ピンチで前後移動</div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', controlsHTML);
        
        // Setup pad events
        this.setupDigitalPadEvents();
        this.setupFullScreenLookEvents();
        this.setupPinchControls();
    }

    setupPinchControls() {
        let initialDistance = 0;
        let isPinching = false;
        
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const dx = touch2.clientX - touch1.clientX;
                const dy = touch2.clientY - touch1.clientY;
                initialDistance = Math.sqrt(dx * dx + dy * dy);
                isPinching = true;
            }
        });
        
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && isPinching) {
                e.preventDefault();
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const dx = touch2.clientX - touch1.clientX;
                const dy = touch2.clientY - touch1.clientY;
                const currentDistance = Math.sqrt(dx * dx + dy * dy);
                
                const deltaDistance = currentDistance - initialDistance;
                
                if (Math.abs(deltaDistance) > 10) { // Threshold to avoid jitter
                    if (deltaDistance > 0) {
                        // Pinch out = move forward 
                        this.keys.w = true;
                        this.keys.s = false;
                    } else {
                        // Pinch in = move backward
                        this.keys.s = true;
                        this.keys.w = false;
                    }
                    initialDistance = currentDistance;
                }
            }
        });
        
        document.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                isPinching = false;
                this.keys.w = false;
                this.keys.s = false;
            }
        });
    }

    setupDigitalPadEvents() {
        const padButtons = document.querySelectorAll('.pad-btn');
        
        padButtons.forEach(button => {
            const key = button.dataset.key;
            if (!key) return; // Skip center button
            
            // Touch events
            button.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.keys[key] = true;
                button.classList.add('active');
            });
            
            button.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.keys[key] = false;
                button.classList.remove('active');
            });
            
            // Mouse events for testing
            button.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.keys[key] = true;
                button.classList.add('active');
            });
            
            button.addEventListener('mouseup', (e) => {
                e.preventDefault();
                this.keys[key] = false;
                button.classList.remove('active');
            });
            
            button.addEventListener('mouseleave', (e) => {
                this.keys[key] = false;
                button.classList.remove('active');
            });
        });
    }

    setupFullScreenLookEvents() {
        let lastTouch = null;
        let isPadTouch = false;
        
        document.addEventListener('touchstart', (e) => {
            // Check if touch is on movement pad or vertical pad
            const movementPad = document.getElementById('movement-pad');
            const verticalPad = document.getElementById('vertical-pad');
            if ((movementPad && movementPad.contains(e.target)) || 
                (verticalPad && verticalPad.contains(e.target))) {
                isPadTouch = true;
                return;
            }
            
            // Only handle single touch for look (not pinch)
            if (e.touches.length === 1) {
                isPadTouch = false;
                lastTouch = e.touches[0];
            } else {
                // Multiple touches - clear lastTouch to prevent view jumping
                lastTouch = null;
            }
        });
        
        document.addEventListener('touchmove', (e) => {
            // Skip if touching movement pad or pinching
            if (isPadTouch || e.touches.length !== 1) return;
            
            // Skip if tanzaku editor is open
            const tanzakuEditor = document.getElementById('tanzaku-editor');
            if (tanzakuEditor && !tanzakuEditor.classList.contains('hidden')) return;
            
            if (lastTouch) {
                e.preventDefault();
                const touch = e.touches[0];
                const deltaX = touch.clientX - lastTouch.clientX;
                const deltaY = touch.clientY - lastTouch.clientY;
                
                const sensitivity = 0.005;
                this.euler.setFromQuaternion(this.camera.quaternion);
                this.euler.y -= deltaX * sensitivity;
                this.euler.x -= deltaY * sensitivity;
                this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));
                this.camera.quaternion.setFromEuler(this.euler);
                
                lastTouch = touch;
            }
        });
        
        document.addEventListener('touchend', (e) => {
            if (e.touches.length === 0) {
                lastTouch = null;
                isPadTouch = false;
            } else if (e.touches.length === 1) {
                // If going from multi-touch to single touch, reset lastTouch to prevent jumping
                lastTouch = e.touches[0];
            } else {
                // Still multi-touch, clear lastTouch
                lastTouch = null;
            }
        });
    }



    loadBambooModel() {
        // Load the GLB bamboo model
        const loader = new THREE.GLTFLoader();
        loader.load('models/bamboo.glb', 
            (gltf) => {
                this.bambooModel = gltf.scene;
                
                // Scale up the model 20x
                this.bambooModel.scale.set(20, 20, 20);
                
                // Enable shadows for all meshes in the model
                this.bambooModel.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                this.scene.add(this.bambooModel);
                this.updateLoadingState('bambooModel');
            },
            (xhr) => {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            (error) => {
                console.error('Error loading bamboo model:', error);
                // Fallback to procedural bamboo
                this.createImprovedBamboo();
                this.updateLoadingState('bambooModel');
            }
        );
        
        // Add ground
        const groundGeometry = new THREE.CircleGeometry(20, 32);
        const groundMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x3a5f3a,
            side: THREE.DoubleSide
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    
    createImprovedBamboo() {
        // Create a more detailed bamboo model
        const bambooGroup = new THREE.Group();
        
        // Main bamboo culms (stems)
        const mainBamboos = [
            { x: 0, z: 0, height: 12, radius: 0.4 },
            { x: -2, z: 1, height: 10, radius: 0.35 },
            { x: 1.5, z: -1.5, height: 11, radius: 0.3 },
            { x: -1, z: -2, height: 9, radius: 0.25 },
            { x: 2, z: 2, height: 8, radius: 0.2 }
        ];
        
        mainBamboos.forEach(bamboo => {
            this.createBambooCulm(bambooGroup, bamboo.x, bamboo.z, bamboo.height, bamboo.radius);
        });
        
        // Add leaves around the bamboo
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2;
            const radius = 3 + Math.random() * 2;
            const leaf = this.createBambooLeaf();
            leaf.position.set(
                Math.cos(angle) * radius,
                6 + Math.random() * 4,
                Math.sin(angle) * radius
            );
            leaf.rotation.y = angle + Math.random() * 0.5;
            bambooGroup.add(leaf);
        }
        
        this.bambooModel = bambooGroup;
        this.scene.add(this.bambooModel);
    }
    
    createBambooCulm(parent, x, z, height, radius) {
        const segmentHeight = 2;
        const segments = Math.floor(height / segmentHeight);
        
        const bambooMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x6cbf47,
            shininess: 30
        });
        
        for (let i = 0; i < segments; i++) {
            // Main segment
            const segmentGeometry = new THREE.CylinderGeometry(
                radius * (1 - i * 0.05), 
                radius * (1 - (i - 1) * 0.05), 
                segmentHeight, 
                12
            );
            const segment = new THREE.Mesh(segmentGeometry, bambooMaterial);
            segment.position.set(x, i * segmentHeight + segmentHeight/2, z);
            segment.castShadow = true;
            segment.receiveShadow = true;
            parent.add(segment);
            
            // Node between segments
            if (i > 0) {
                const nodeGeometry = new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, 0.2, 12);
                const node = new THREE.Mesh(nodeGeometry, bambooMaterial);
                node.position.set(x, i * segmentHeight, z);
                parent.add(node);
            }
        }
    }
    
    createBambooLeaf() {
        const leafGroup = new THREE.Group();
        const leafMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x5a8a5c,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        });
        
        // Create leaf shape using PlaneGeometry
        const leafGeometry = new THREE.PlaneGeometry(0.8, 2);
        const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
        
        // Bend the leaf slightly
        leaf.rotation.x = Math.random() * 0.3;
        leaf.rotation.z = Math.random() * 0.2;
        
        leafGroup.add(leaf);
        return leafGroup;
    }

    createTanzaku(text) {
        const tanzakuGroup = new THREE.Group();
        
        // Create tanzaku mesh
        const geometry = new THREE.BoxGeometry(1.5, 3, 0.05);
        const material = new THREE.MeshPhongMaterial({
            color: new THREE.Color().setHSL(Math.random(), 0.7, 0.8),
            side: THREE.DoubleSide
        });
        const tanzaku = new THREE.Mesh(geometry, material);
        tanzaku.castShadow = true;
        tanzaku.receiveShadow = true;
        
        // Create texture from canvas drawing
        const texture = new THREE.CanvasTexture(text);
        const textMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });
        const textPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(1.35, 2.7),
            textMaterial
        );
        textPlane.position.z = 0.035; // Further in front of the tanzaku surface
        
        tanzakuGroup.add(tanzaku);
        tanzakuGroup.add(textPlane);
        
        // Add string
        const stringGeometry = new THREE.CylinderGeometry(0.01, 0.01, 2);
        const stringMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
        const string = new THREE.Mesh(stringGeometry, stringMaterial);
        string.position.y = 2.5;
        tanzakuGroup.add(string);
        
        // Random initial position around bamboo
        const angle = Math.random() * Math.PI * 2;
        const radius = 2 + Math.random() * 3;
        tanzakuGroup.position.set(
            Math.cos(angle) * radius,
            -1 + Math.random() * 1,
            Math.sin(angle) * radius
        );
        
        // Add some rotation
        tanzakuGroup.rotation.y = angle;
        tanzakuGroup.userData = { 
            movable: true,
            textCanvas: text 
        };
        
        this.scene.add(tanzakuGroup);
        this.tanzakuList.push(tanzakuGroup);
        
        return tanzakuGroup;
    }

    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Tanzaku selection events
        const canvas = this.renderer.domElement;
        canvas.addEventListener('click', (e) => {
            if (!this.isPointerLocked) {
                // Normal click when pointer is not locked
                this.onCanvasClick(e);
            } else {
                // When pointer is locked, treat click as center screen interaction
                this.selectTanzakuInCenter();
            }
        });
        
        // WASD keyboard controls
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
        
        // UI buttons
        document.getElementById('enter-btn').addEventListener('click', () => {
            document.getElementById('qr-entry').classList.add('hidden');
        });
        
        document.getElementById('add-tanzaku-btn').addEventListener('click', () => {
            this.showTanzakuEditor();
        });
        
        document.getElementById('submit-tanzaku-btn').addEventListener('click', () => {
            this.submitTanzaku();
        });
        
        document.getElementById('cancel-tanzaku-btn').addEventListener('click', () => {
            this.hideTanzakuEditor();
        });
        
        document.getElementById('clear-btn').addEventListener('click', () => {
            this.clearDrawingCanvas();
        });
        
        // Setup drawing canvas
        this.setupDrawingCanvas();
        this.setupCanvasZoom();
        
        // Developer mode event listeners
        this.setupDeveloperModeListeners();
    }

    setupDrawingCanvas() {
        const canvas = document.getElementById('drawing-canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size
        canvas.width = 300;
        canvas.height = 600;
        
        // Drawing state
        let isDrawing = false;
        let lastX = 0;
        let lastY = 0;
        
        // Configure drawing style
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Clear canvas with paper texture
        this.clearDrawingCanvas();
        
        // Touch events
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const touch = e.touches[0];
            lastX = (touch.clientX - rect.left) * (canvas.width / rect.width);
            lastY = (touch.clientY - rect.top) * (canvas.height / rect.height);
            isDrawing = true;
        });
        
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!isDrawing) return;
            
            const rect = canvas.getBoundingClientRect();
            const touch = e.touches[0];
            const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
            const y = (touch.clientY - rect.top) * (canvas.height / rect.height);
            
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(x, y);
            ctx.stroke();
            
            lastX = x;
            lastY = y;
        });
        
        canvas.addEventListener('touchend', () => {
            isDrawing = false;
        });
        
        // Mouse events for desktop testing
        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            lastX = (e.clientX - rect.left) * (canvas.width / rect.width);
            lastY = (e.clientY - rect.top) * (canvas.height / rect.height);
            isDrawing = true;
        });
        
        canvas.addEventListener('mousemove', (e) => {
            if (!isDrawing) return;
            
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) * (canvas.width / rect.width);
            const y = (e.clientY - rect.top) * (canvas.height / rect.height);
            
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(x, y);
            ctx.stroke();
            
            lastX = x;
            lastY = y;
        });
        
        canvas.addEventListener('mouseup', () => {
            isDrawing = false;
        });
    }

    setupCanvasZoom() {
        const container = document.getElementById('canvas-container');
        let scale = 1;
        let initialDistance = 0;
        let isZooming = false;

        // Touch events for pinch zoom
        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const dx = touch2.clientX - touch1.clientX;
                const dy = touch2.clientY - touch1.clientY;
                initialDistance = Math.sqrt(dx * dx + dy * dy);
                isZooming = true;
            }
        });

        container.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && isZooming) {
                e.preventDefault();
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const dx = touch2.clientX - touch1.clientX;
                const dy = touch2.clientY - touch1.clientY;
                const currentDistance = Math.sqrt(dx * dx + dy * dy);
                
                const scaleFactor = currentDistance / initialDistance;
                const newScale = Math.max(0.5, Math.min(3, scale * scaleFactor)); // Limit between 0.5x and 3x
                
                container.style.transform = `scale(${newScale})`;
                
                initialDistance = currentDistance;
                scale = newScale;
            }
        });

        container.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                isZooming = false;
            }
        });

        // Mouse wheel for desktop
        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            scale = Math.max(0.5, Math.min(3, scale * delta));
            container.style.transform = `scale(${scale})`;
        });
    }

    clearDrawingCanvas() {
        const canvas = document.getElementById('drawing-canvas');
        const ctx = canvas.getContext('2d');
        
        // Clear with paper-like color
        ctx.fillStyle = '#fffbf0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    showTanzakuEditor() {
        document.getElementById('tanzaku-editor').classList.remove('hidden');
        this.clearDrawingCanvas();
    }

    hideTanzakuEditor() {
        document.getElementById('tanzaku-editor').classList.add('hidden');
    }

    async submitTanzaku() {
        const canvas = document.getElementById('drawing-canvas');
        const tanzaku = this.createTanzaku(canvas);
        
        // Save to server
        await this.saveTanzakuToServer(tanzaku);
        
        this.hideTanzakuEditor();
        
        // Enter tanzaku placement mode
        this.selectedTanzaku = tanzaku;
        tanzaku.children[0].material.emissive = new THREE.Color(0xffff00);
        tanzaku.children[0].material.emissiveIntensity = 0.3;
        
        // Show placement message
        this.showPlacementMessage();
    }

    showPlacementMessage() {
        // Create placement message overlay
        const messageHTML = `
            <div id="placement-message" class="placement-message">
                <div class="message-content">
                    <h3>短冊を飾りたい場所をタップしてください</h3>
                    <p>竹の表面をタップすると短冊が移動します</p>
                    <button id="placement-ok-btn" class="primary-btn" style="margin-top: 15px;">OK</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', messageHTML);
        
        // Add click handler for OK button
        document.getElementById('placement-ok-btn').addEventListener('click', () => {
            this.hidePlacementMessage();
        });
    }

    hidePlacementMessage() {
        const message = document.getElementById('placement-message');
        if (message) {
            message.remove();
        }
    }

    async loadExistingTanzaku() {
        if (this.loadingTanzaku) return;
        this.loadingTanzaku = true;
        
        try {
            const response = await this.fetchWithTimeout(`${this.apiBaseUrl}/api/tanzaku`, {}, 5000);
            const data = await response.json();
            
            if (data.success) {
                // Clear existing tanzaku
                this.tanzakuList.forEach(tanzaku => {
                    this.scene.remove(tanzaku);
                });
                this.tanzakuList = [];
                
                // Load tanzaku from server
                for (const tanzakuData of data.tanzaku) {
                    const tanzaku = await this.createTanzakuFromData(tanzakuData);
                    // Only add to scene and list if creation was successful
                    if (tanzaku) {
                        this.scene.add(tanzaku);
                        this.tanzakuList.push(tanzaku);
                    }
                }
                
                const textTanzaku = data.tanzaku.filter(t => !t.isImageTanzaku);
                const imageTanzaku = data.tanzaku.filter(t => t.isImageTanzaku);
                console.log(`Loaded ${data.tanzaku.length} total tanzaku from server:`);
                console.log(`- Text tanzaku: ${textTanzaku.length}`);
                console.log(`- Image tanzaku: ${imageTanzaku.length}`);
                console.log(`- Actually added to scene: ${this.tanzakuList.length}`);
            }
        } catch (error) {
            console.error('Failed to load tanzaku from server:', error);
        } finally {
            this.loadingTanzaku = false;
            this.updateLoadingState('existingTanzaku');
        }
    }

    async saveTanzakuToServer(tanzakuGroup) {
        try {
            // Convert canvas to base64
            const textCanvas = tanzakuGroup.userData.textCanvas;
            const textData = textCanvas.toDataURL('image/png');
            
            const tanzakuData = {
                position: {
                    x: tanzakuGroup.position.x,
                    y: tanzakuGroup.position.y,
                    z: tanzakuGroup.position.z
                },
                rotation: {
                    x: tanzakuGroup.rotation.x,
                    y: tanzakuGroup.rotation.y,
                    z: tanzakuGroup.rotation.z
                },
                textData: textData,
                timestamp: new Date().toISOString()
            };
            
            const response = await this.fetchWithTimeout(`${this.apiBaseUrl}/api/tanzaku`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(tanzakuData)
            }, 5000);
            
            const result = await response.json();
            if (result.success) {
                tanzakuGroup.userData.serverId = result.tanzaku.id;
                console.log('Tanzaku saved to server:', result.tanzaku.id);
            } else {
                console.error('Failed to save tanzaku:', result.error);
            }
        } catch (error) {
            console.error('Error saving tanzaku to server:', error);
        }
    }

    async createTanzakuFromData(tanzakuData) {
        return new Promise((resolve) => {
            // Check if this is an image tanzaku
            if (tanzakuData.isImageTanzaku) {
                // Handle image tanzaku
                const loader = new THREE.TextureLoader();
                // Add cache buster to force reload of updated images
                const imagePath = tanzakuData.imagePath.split('?')[0] + '?v=' + Date.now();
                loader.load(
                    imagePath,
                    (texture) => {
                        const tanzaku = this.createImageTanzakuFromTexture(texture, tanzakuData.imageIndex);
                        
                        // Set position and rotation from server data
                        tanzaku.position.set(
                            tanzakuData.position.x,
                            tanzakuData.position.y,
                            tanzakuData.position.z
                        );
                        tanzaku.rotation.set(
                            tanzakuData.rotation.x,
                            tanzakuData.rotation.y,
                            tanzakuData.rotation.z
                        );
                        
                        // Store server ID and additional metadata
                        tanzaku.userData.serverId = tanzakuData.id;
                        tanzaku.userData.isFromServer = true;
                        tanzaku.userData.isImageTanzaku = true;
                        tanzaku.userData.imageIndex = tanzakuData.imageIndex;
                        tanzaku.userData.imagePath = tanzakuData.imagePath;
                        
                        resolve(tanzaku);
                    },
                    undefined,
                    (error) => {
                        console.error(`Error loading image tanzaku ${tanzakuData.imagePath}:`, error);
                        resolve(null); // Return null for failed loads
                    }
                );
            } else {
                // Handle regular text tanzaku
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 300;
                    canvas.height = 600;
                    const ctx = canvas.getContext('2d');
                    
                    // Clear with paper texture
                    ctx.fillStyle = '#fffbf0';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    
                    // Draw the loaded image
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    // Create tanzaku
                    const tanzaku = this.createTanzaku(canvas);
                    
                    // Set position and rotation from server data
                    tanzaku.position.set(
                        tanzakuData.position.x,
                        tanzakuData.position.y,
                        tanzakuData.position.z
                    );
                    tanzaku.rotation.set(
                        tanzakuData.rotation.x,
                        tanzakuData.rotation.y,
                        tanzakuData.rotation.z
                    );
                    
                    // Store server ID
                    tanzaku.userData.serverId = tanzakuData.id;
                    tanzaku.userData.isFromServer = true;
                    
                    resolve(tanzaku);
                };
                img.src = tanzakuData.textData;
            }
        });
    }

    async updateTanzakuOnServer(tanzakuGroup) {
        if (!tanzakuGroup.userData.serverId) return;
        
        try {
            const tanzakuData = {
                position: {
                    x: tanzakuGroup.position.x,
                    y: tanzakuGroup.position.y,
                    z: tanzakuGroup.position.z
                },
                rotation: {
                    x: tanzakuGroup.rotation.x,
                    y: tanzakuGroup.rotation.y,
                    z: tanzakuGroup.rotation.z
                }
            };

            // Add image tanzaku specific data if this is an image tanzaku
            if (tanzakuGroup.userData.isImageTanzaku) {
                tanzakuData.isImageTanzaku = true;
                tanzakuData.imageIndex = tanzakuGroup.userData.imageIndex;
                tanzakuData.imagePath = tanzakuGroup.userData.imagePath;
            }
            
            const response = await this.fetchWithTimeout(`${this.apiBaseUrl}/api/tanzaku/${tanzakuGroup.userData.serverId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(tanzakuData)
            }, 5000);
            
            const result = await response.json();
            if (result.success) {
                const tanzakuType = tanzakuGroup.userData.isImageTanzaku ? 'Image tanzaku' : 'Tanzaku';
                console.log(`${tanzakuType} position updated on server`);
            } else {
                console.error('Failed to update tanzaku:', result.error);
            }
        } catch (error) {
            console.error('Error updating tanzaku on server:', error);
        }
    }

    onCanvasClick(e) {
        this.checkTanzakuSelection(e.clientX, e.clientY);
    }


    onKeyDown(e) {
        switch(e.code) {
            case 'KeyW':
                this.keys.w = true;
                break;
            case 'KeyA':
                this.keys.a = true;
                break;
            case 'KeyS':
                this.keys.s = true;
                break;
            case 'KeyD':
                this.keys.d = true;
                break;
            case 'KeyQ':
                this.keys.q = true;
                break;
            case 'KeyE':
                this.keys.e = true;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.keys.shift = true;
                break;
            case 'Escape':
                if (this.isPointerLocked) {
                    document.exitPointerLock();
                }
                break;
            case 'KeyF':
                // F key to select/interact with tanzaku
                this.selectTanzakuInCenter();
                break;
            case 'KeyD':
                // Ctrl+Shift+D to toggle developer mode
                if (e.ctrlKey && e.shiftKey) {
                    e.preventDefault();
                    this.toggleDeveloperMode();
                }
                break;
        }
    }

    onKeyUp(e) {
        switch(e.code) {
            case 'KeyW':
                this.keys.w = false;
                break;
            case 'KeyA':
                this.keys.a = false;
                break;
            case 'KeyS':
                this.keys.s = false;
                break;
            case 'KeyD':
                this.keys.d = false;
                break;
            case 'KeyQ':
                this.keys.q = false;
                break;
            case 'KeyE':
                this.keys.e = false;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.keys.shift = false;
                break;
        }
    }

    handleKeyboardMovement() {
        if (!this.camera) return;
        
        const moveSpeed = this.keys.shift ? 1.0 : 0.3; // Minecraft-like speed
        const direction = new THREE.Vector3();
        
        // Get camera's local coordinate system for minecraft-style movement
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        
        // Remove Y component from forward and right for ground-based movement
        forward.y = 0;
        right.y = 0;
        forward.normalize();
        right.normalize();
        
        // Calculate movement direction
        if (this.keys.w) direction.add(forward);
        if (this.keys.s) direction.sub(forward);
        if (this.keys.d) direction.add(right);
        if (this.keys.a) direction.sub(right);
        
        // Vertical movement (flying) - Y axis for up/down
        if (this.keys.q) direction.y += 1; // Q = up (positive Y)
        if (this.keys.e) direction.y -= 1; // E = down (negative Y)
        
        // Apply movement
        if (direction.length() > 0) {
            direction.normalize().multiplyScalar(moveSpeed);
            this.camera.position.add(direction);
        }
    }

    selectTanzakuInCenter() {
        // Select tanzaku at screen center (crosshair)
        this.checkTanzakuSelection(window.innerWidth / 2, window.innerHeight / 2);
    }

    checkTanzakuSelection(clientX, clientY) {
        this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Check for tanzaku intersections first
        const tanzakuIntersects = this.raycaster.intersectObjects(this.tanzakuList, true);
        
        if (tanzakuIntersects.length > 0) {
            const clickedObject = tanzakuIntersects[0].object;
            const tanzakuGroup = clickedObject.parent;
            
            if (tanzakuGroup.userData.movable) {
                if (this.selectedTanzaku === tanzakuGroup) {
                    // Second click - try to snap to bamboo surface
                    this.snapTanzakuToBamboo(tanzakuGroup);
                    
                    // Update position on server
                    this.updateTanzakuOnServer(tanzakuGroup);
                    
                    this.selectedTanzaku = null;
                    
                    // Remove highlight
                    tanzakuGroup.children[0].material.emissive = new THREE.Color(0x000000);
                    tanzakuGroup.children[0].material.emissiveIntensity = 0;
                    
                    // Hide placement message if visible
                    this.hidePlacementMessage();
                } else {
                    // First click - select tanzaku
                    if (this.selectedTanzaku) {
                        this.selectedTanzaku.children[0].material.emissive = new THREE.Color(0x000000);
                        this.selectedTanzaku.children[0].material.emissiveIntensity = 0;
                    }
                    this.selectedTanzaku = tanzakuGroup;
                    
                    // Add highlight
                    tanzakuGroup.children[0].material.emissive = new THREE.Color(0xffff00);
                    tanzakuGroup.children[0].material.emissiveIntensity = 0.3;
                }
            }
        } else if (this.selectedTanzaku) {
            // Click on bamboo or empty space with selected tanzaku - snap to surface
            this.snapTanzakuToBamboo(this.selectedTanzaku);
            
            // Update position on server
            this.updateTanzakuOnServer(this.selectedTanzaku);
            
            this.selectedTanzaku.children[0].material.emissive = new THREE.Color(0x000000);
            this.selectedTanzaku.children[0].material.emissiveIntensity = 0;
            this.selectedTanzaku = null;
            
            // Hide placement message if visible
            this.hidePlacementMessage();
        }
    }

    snapTanzakuToBamboo(tanzakuGroup) {
        // Raycast to find bamboo surface
        const allIntersects = this.raycaster.intersectObjects(this.scene.children, true);
        
        for (let intersect of allIntersects) {
            // Skip if it's a tanzaku
            if (this.tanzakuList.includes(intersect.object.parent)) continue;
            
            // Found bamboo surface
            const hitPoint = intersect.point;
            const normal = intersect.face.normal.clone();
            
            // Orient tanzaku to hang down from the surface first
            const up = new THREE.Vector3(0, -1, 0); // Tanzaku hangs down
            const right = new THREE.Vector3().crossVectors(normal, up).normalize();
            const forward = new THREE.Vector3().crossVectors(up, right).normalize();
            
            // Create rotation matrix
            const matrix = new THREE.Matrix4();
            matrix.makeBasis(right, up, forward);
            tanzakuGroup.rotation.setFromRotationMatrix(matrix);
            
            // Position the tanzaku so the STRING TOP (attachment point) is at the hit point
            // The string extends from y=1.5 to y=3.5 (length=2, center at y=2.5)
            // So the string TOP (attachment point) is at y=3.5 from tanzaku center
            const stringTopOffset = new THREE.Vector3(0, 3.5, 0); // String top is 3.5 units above tanzaku center
            stringTopOffset.applyMatrix4(matrix); // Apply rotation to offset
            
            // Position tanzaku so string TOP is at hit point (move away from surface slightly)
            const surfaceOffset = normal.multiplyScalar(0.05); // Small offset from surface
            const finalPosition = hitPoint.clone().sub(surfaceOffset).add(stringTopOffset);
            tanzakuGroup.position.copy(finalPosition);
            
            break; // Use first valid intersection
        }
    }

    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
    }

    async loadImageTanzaku() {
        console.log('Starting to load image tanzaku...');
        
        // Check if image tanzaku already exist on server
        let existingImageTanzaku = [];
        try {
            const response = await this.fetchWithTimeout(`${this.apiBaseUrl}/api/tanzaku`, {}, 5000);
            const data = await response.json();
            
            if (data.success) {
                existingImageTanzaku = data.tanzaku.filter(t => t.isImageTanzaku);
                console.log('Found existing image tanzaku:', existingImageTanzaku.length);
                
                // If image tanzaku already exist, load them with saved positions
                if (existingImageTanzaku.length > 0) {
                    console.log('Loading existing image tanzaku with saved positions');
                    this.loadExistingImageTanzaku(existingImageTanzaku);
                    
                    // Check if we need to create missing image tanzaku
                    const existingIndices = existingImageTanzaku.map(t => t.imageIndex);
                    const allIndices = [0, 1, 2]; // We have 3 images
                    const missingIndices = allIndices.filter(index => !existingIndices.includes(index));
                    
                    if (missingIndices.length > 0) {
                        console.log('Creating missing image tanzaku for indices:', missingIndices);
                        this.createMissingImageTanzaku(missingIndices);
                    }
                    
                    // Mark image tanzaku as loaded since they already exist
                    this.updateLoadingState('imageTanzaku');
                    return;
                }
            }
        } catch (error) {
            console.error('Error checking existing tanzaku:', error);
            // Mark as loaded even on error to not block the loading screen
            this.updateLoadingState('imageTanzaku');
        }
        
        // Load the three image files as tanzaku (with cache busting)
        const timestamp = Date.now();
        const imageFiles = [
            `img/blue1.png?v=${timestamp}`,
            `img/logo_asukoe (2).png?v=${timestamp}`,
            `img/コフレちゃん（背景透過データ）.png?v=${timestamp}`
        ];

        console.log('Creating new image tanzaku:', imageFiles);
        const loader = new THREE.TextureLoader();
        let imagesToLoad = imageFiles.length;
        let imagesLoaded = 0;
        
        imageFiles.forEach((imagePath, index) => {
            loader.load(
                imagePath,
                (texture) => {
                    console.log(`Image ${imagePath} loaded successfully`);
                    this.createImageTanzaku(texture, index);
                    
                    // Track loading progress
                    imagesLoaded++;
                    if (imagesLoaded === imagesToLoad) {
                        this.updateLoadingState('imageTanzaku');
                    }
                },
                (progress) => {
                    console.log(`Loading ${imagePath}: ${(progress.loaded / progress.total * 100)}%`);
                },
                (error) => {
                    console.error(`Error loading image ${imagePath}:`, error);
                    
                    // Track loading progress even on error
                    imagesLoaded++;
                    if (imagesLoaded === imagesToLoad) {
                        this.updateLoadingState('imageTanzaku');
                    }
                }
            );
        });
    }

    async loadExistingImageTanzaku(existingImageTanzaku) {
        const loader = new THREE.TextureLoader();
        
        for (const savedTanzaku of existingImageTanzaku) {
            try {
                // Load the texture for this image tanzaku
                const texture = await new Promise((resolve, reject) => {
                    const timestamp = Date.now();
                    const imagePath = `${savedTanzaku.imagePath}?v=${timestamp}`;
                    loader.load(
                        imagePath,
                        resolve,
                        undefined,
                        reject
                    );
                });
                
                // Create the tanzaku group with the loaded texture
                const tanzakuGroup = this.createImageTanzakuFromTexture(texture, savedTanzaku.imageIndex);
                
                // Restore the saved position and rotation
                tanzakuGroup.position.set(
                    savedTanzaku.position.x,
                    savedTanzaku.position.y,
                    savedTanzaku.position.z
                );
                tanzakuGroup.rotation.set(
                    savedTanzaku.rotation.x,
                    savedTanzaku.rotation.y,
                    savedTanzaku.rotation.z
                );
                
                // Set the server ID for future updates
                tanzakuGroup.userData.serverId = savedTanzaku.id;
                
                this.scene.add(tanzakuGroup);
                this.tanzakuList.push(tanzakuGroup);
                
                console.log(`Loaded existing image tanzaku ${savedTanzaku.imageIndex} at position:`, savedTanzaku.position);
                
            } catch (error) {
                console.error('Error loading existing image tanzaku:', error);
            }
        }
    }

    createMissingImageTanzaku(missingIndices) {
        const loader = new THREE.TextureLoader();
        const imageFiles = [
            'img/blue1.png',
            'img/logo_asukoe (2).png',
            'img/コフレちゃん（背景透過データ）.png'
        ];
        
        missingIndices.forEach(index => {
            if (index < imageFiles.length) {
                const timestamp = Date.now();
                const imagePath = `${imageFiles[index]}?v=${timestamp}`;
                
                loader.load(
                    imagePath,
                    (texture) => {
                        console.log(`Missing image ${imagePath} loaded successfully`);
                        this.createImageTanzaku(texture, index);
                    },
                    (progress) => {
                        console.log(`Loading missing ${imagePath}: ${(progress.loaded / progress.total * 100)}%`);
                    },
                    (error) => {
                        console.error(`Error loading missing image ${imagePath}:`, error);
                    }
                );
            }
        });
    }

    createImageTanzaku(texture, index) {
        const tanzakuGroup = this.createImageTanzakuFromTexture(texture, index);
        
        // Position image tanzaku around the scene with specific positions
        const positions = [
            { x: 5.934956815092061, y: 5.9869101424380045, z: 4.613929204689042 }, // imageIndex 0
            { x: -5.3257223989631655, y: 9.931149710454356, z: 14.168334512234656 }, // imageIndex 1
            { x: -6.1904721782677035, y: 4.358002440325047, z: 3.351045455481746 } // imageIndex 2 (コフレちゃん)
        ];
        
        const rotations = [
            { x: 0, y: 1.0484629410666864, z: 0 }, // imageIndex 0
            { x: 0, y: -0.27998882959408394, z: 0 }, // imageIndex 1
            { x: 0, y: -0.26234971708790594, z: 0 } // imageIndex 2 (コフレちゃん)
        ];
        
        if (index < positions.length) {
            const pos = positions[index];
            const rot = rotations[index];
            tanzakuGroup.position.set(pos.x, pos.y, pos.z);
            tanzakuGroup.rotation.set(rot.x, rot.y, rot.z);
        } else {
            // Fallback to default positioning for any additional images
            const angles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25];
            const radii = [4, 5, 6];
            const heights = [-0.5, 0, 0.5];
            
            const angle = angles[index % angles.length];
            const radius = radii[index % radii.length];
            const height = heights[index % heights.length];
            
            tanzakuGroup.position.set(
                Math.cos(angle) * radius,
                height,
                Math.sin(angle) * radius
            );
            tanzakuGroup.rotation.y = angle + Math.PI;
        }
        
        this.scene.add(tanzakuGroup);
        this.tanzakuList.push(tanzakuGroup);
        
        // Save image tanzaku to server
        this.saveImageTanzakuToServer(tanzakuGroup);
        
        console.log(`Image tanzaku ${index} created and added to scene`);
    }

    createImageTanzakuFromTexture(texture, index) {
        const tanzakuGroup = new THREE.Group();
        
        // Create tanzaku base (same as regular tanzaku)
        const geometry = new THREE.BoxGeometry(1.5, 3, 0.05);
        const material = new THREE.MeshPhongMaterial({
            color: 0xffffff, // White base for image display
            side: THREE.DoubleSide
        });
        const tanzaku = new THREE.Mesh(geometry, material);
        tanzaku.castShadow = true;
        tanzaku.receiveShadow = true;
        
        // Create image plane
        const imageMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });
        const imagePlane = new THREE.Mesh(
            new THREE.PlaneGeometry(1.35, 2.7),
            imageMaterial
        );
        imagePlane.position.z = 0.035; // Slightly in front of tanzaku
        
        tanzakuGroup.add(tanzaku);
        tanzakuGroup.add(imagePlane);
        
        // Add string (same as regular tanzaku)
        const stringGeometry = new THREE.CylinderGeometry(0.01, 0.01, 2);
        const stringMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
        const string = new THREE.Mesh(stringGeometry, stringMaterial);
        string.position.y = 2.5;
        tanzakuGroup.add(string);
        
        // Set userData
        tanzakuGroup.userData = { 
            movable: true,
            isImageTanzaku: true,
            imageIndex: index,
            imagePath: this.getImagePathByIndex(index) // Store the image path for reconstruction
        };
        
        return tanzakuGroup;
    }

    getImagePathByIndex(index) {
        const imageFiles = [
            'img/blue1.png',
            'img/logo_asukoe (2).png',
            'img/コフレちゃん（背景透過データ）.png'
        ];
        return imageFiles[index] || imageFiles[0]; // Fallback to first image
    }

    async saveImageTanzakuToServer(tanzakuGroup) {
        try {
            const tanzakuData = {
                position: {
                    x: tanzakuGroup.position.x,
                    y: tanzakuGroup.position.y,
                    z: tanzakuGroup.position.z
                },
                rotation: {
                    x: tanzakuGroup.rotation.x,
                    y: tanzakuGroup.rotation.y,
                    z: tanzakuGroup.rotation.z
                },
                textData: 'IMAGE_TANZAKU', // Dummy text data for image tanzaku
                isImageTanzaku: true,
                imageIndex: tanzakuGroup.userData.imageIndex,
                imagePath: tanzakuGroup.userData.imagePath.split('?')[0], // Remove query params when saving
                timestamp: new Date().toISOString()
            };
            
            const response = await this.fetchWithTimeout(`${this.apiBaseUrl}/api/tanzaku`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(tanzakuData)
            }, 5000);
            
            const result = await response.json();
            if (result.success) {
                tanzakuGroup.userData.serverId = result.tanzaku.id;
                console.log('Image tanzaku saved to server:', result.tanzaku.id);
            } else {
                console.error('Failed to save image tanzaku:', result.error);
            }
        } catch (error) {
            console.error('Error saving image tanzaku to server:', error);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Handle keyboard movement
        this.handleKeyboardMovement();
        
        // Gentle rotation animation for tanzaku
        this.tanzakuList.forEach(tanzaku => {
            tanzaku.rotation.y += 0.001;
            tanzaku.children[0].rotation.z = Math.sin(Date.now() * 0.001) * 0.05;
        });
        
        this.renderer.render(this.scene, this.camera);
    }
    
    // Developer Mode Functions
    toggleDeveloperMode() {
        const devModal = document.getElementById('developer-mode');
        devModal.classList.toggle('hidden');
        console.log('Developer mode toggled');
    }
    
    // Expose developer mode functions to console
    exposeDevModeToConsole() {
        // Make app instance globally accessible
        window.tanabataApp = this;
        
        // Define console commands
        window.devMode = () => {
            this.toggleDeveloperMode();
        };
        
        window.exportTanzaku = () => {
            this.exportTanzakuData();
        };
        
        window.clearAllTanzaku = () => {
            this.clearAllTanzaku();
        };
        
        window.checkServerData = async () => {
            try {
                const response = await this.fetchWithTimeout(`${this.apiBaseUrl}/api/tanzaku`);
                const result = await response.json();
                console.log('Server tanzaku data:', result);
                return result;
            } catch (error) {
                console.error('Failed to check server data:', error);
            }
        };
        
        console.log('%c=== Tanabata Developer Commands ===', 'color: #667eea; font-weight: bold; font-size: 14px;');
        console.log('%cdevMode()        - デベロッパーモードを開く/閉じる', 'color: #333;');
        console.log('%cexportTanzaku()  - 短冊データをエクスポート', 'color: #333;');
        console.log('%cclearAllTanzaku() - 全ての短冊を削除', 'color: #333;');
        console.log('%ccheckServerData() - サーバーのデータを確認', 'color: #333;');
        console.log('%c=====================================', 'color: #667eea;');
    }
    
    setupDeveloperModeListeners() {
        // Export tanzaku data
        document.getElementById('export-tanzaku-btn').addEventListener('click', () => {
            this.exportTanzakuData();
        });
        
        // Import tanzaku data
        document.getElementById('import-tanzaku-btn').addEventListener('click', () => {
            document.getElementById('import-file-input').click();
        });
        
        document.getElementById('import-file-input').addEventListener('change', (e) => {
            this.importTanzakuData(e);
        });
        
        // Clear all tanzaku
        document.getElementById('clear-all-tanzaku-btn').addEventListener('click', () => {
            this.clearAllTanzaku();
        });
        
        // Close developer mode
        document.getElementById('close-dev-mode-btn').addEventListener('click', () => {
            document.getElementById('developer-mode').classList.add('hidden');
        });
    }
    
    async exportTanzakuData() {
        const statusEl = document.getElementById('dev-status');
        statusEl.textContent = 'エクスポート中...';
        statusEl.className = 'status-message';
        
        try {
            const response = await this.fetchWithTimeout(`${this.apiBaseUrl}/api/tanzaku`);
            const result = await response.json();
            
            if (result.success) {
                const exportData = {
                    exportDate: new Date().toISOString(),
                    tanzakuCount: result.tanzaku.length,
                    tanzaku: result.tanzaku
                };
                
                const dataStr = JSON.stringify(exportData, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                
                const link = document.createElement('a');
                link.href = URL.createObjectURL(dataBlob);
                link.download = `tanzaku_export_${new Date().toISOString().split('T')[0]}.json`;
                link.click();
                
                statusEl.textContent = `${result.tanzaku.length}件の短冊をエクスポートしました`;
                statusEl.className = 'status-message success';
            } else {
                throw new Error(result.error || 'エクスポートに失敗しました');
            }
        } catch (error) {
            console.error('Export error:', error);
            statusEl.textContent = `エラー: ${error.message}`;
            statusEl.className = 'status-message error';
        }
        
        setTimeout(() => {
            statusEl.textContent = '';
            statusEl.className = 'status-message';
        }, 5000);
    }
    
    async importTanzakuData(event) {
        const statusEl = document.getElementById('dev-status');
        const file = event.target.files[0];
        
        if (!file) return;
        
        statusEl.textContent = 'インポート中...';
        statusEl.className = 'status-message';
        
        try {
            const fileText = await file.text();
            const importData = JSON.parse(fileText);
            
            // Validate import data structure
            if (!importData.tanzaku || !Array.isArray(importData.tanzaku)) {
                throw new Error('無効なファイル形式です');
            }
            
            // Clear existing tanzaku first
            await this.clearAllTanzaku(false); // Don't show status message
            
            // Import each tanzaku
            let importCount = 0;
            for (const tanzakuData of importData.tanzaku) {
                try {
                    const response = await this.fetchWithTimeout(`${this.apiBaseUrl}/api/tanzaku`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(tanzakuData)
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                        importCount++;
                        // Create 3D tanzaku object
                        this.createTanzakuFromData(result.tanzaku);
                    }
                } catch (error) {
                    console.error('Failed to import tanzaku:', error);
                }
            }
            
            statusEl.textContent = `${importCount}件の短冊をインポートしました`;
            statusEl.className = 'status-message success';
            
        } catch (error) {
            console.error('Import error:', error);
            statusEl.textContent = `エラー: ${error.message}`;
            statusEl.className = 'status-message error';
        }
        
        // Reset file input
        event.target.value = '';
        
        setTimeout(() => {
            statusEl.textContent = '';
            statusEl.className = 'status-message';
        }, 5000);
    }
    
    async clearAllTanzaku(showStatus = true) {
        const statusEl = document.getElementById('dev-status');
        
        if (showStatus) {
            const confirm = window.confirm('全ての短冊を削除しますか？この操作は取り消せません。');
            if (!confirm) return;
            
            statusEl.textContent = '削除中...';
            statusEl.className = 'status-message';
        }
        
        try {
            // Clear server data first
            const response = await this.fetchWithTimeout(`${this.apiBaseUrl}/api/tanzaku/clear`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'サーバーでの削除に失敗しました');
            }
            
            // Remove all tanzaku from 3D scene only after server deletion succeeds
            this.tanzakuList.forEach(tanzaku => {
                this.scene.remove(tanzaku);
            });
            this.tanzakuList = [];
            
            console.log('All tanzaku cleared from server and scene');
            
            if (showStatus) {
                statusEl.textContent = '全ての短冊を削除しました';
                statusEl.className = 'status-message success';
                
                setTimeout(() => {
                    statusEl.textContent = '';
                    statusEl.className = 'status-message';
                }, 3000);
            }
        } catch (error) {
            console.error('Clear error:', error);
            if (showStatus) {
                statusEl.textContent = `エラー: ${error.message}`;
                statusEl.className = 'status-message error';
                
                setTimeout(() => {
                    statusEl.textContent = '';
                    statusEl.className = 'status-message';
                }, 5000);
            }
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TanabataApp();
});