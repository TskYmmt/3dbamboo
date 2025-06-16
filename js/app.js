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
        this.apiBaseUrl = window.location.origin;
        this.loadingTanzaku = false;
        
        this.init();
    }

    init() {
        this.setupScene();
        this.setupLights();
        this.setupControls();
        this.loadBambooModel();
        this.setupEventListeners();
        this.loadExistingTanzaku();
        this.animate();
        
        // Show entry modal on load
        document.getElementById('qr-entry').classList.remove('hidden');
    }

    setupScene() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        
        // Camera
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        this.camera.position.set(0, 5, 10);
        if (this.bambooModel) {
            const box = new THREE.Box3().setFromObject(this.bambooModel);
            const center = box.getCenter(new THREE.Vector3());
            this.camera.lookAt(center);
        } else {
            this.camera.lookAt(0, 3, 0);
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
        // Set initial camera position
        this.camera.position.set(0, 5, 10);
        this.camera.lookAt(0, 3, 0);
        
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
                    <button class="pad-btn up-btn" data-key="q">↑</button>
                    <button class="pad-btn left-btn" data-key="a">←</button>
                    <button class="pad-btn center-btn"></button>
                    <button class="pad-btn right-btn" data-key="d">→</button>
                    <button class="pad-btn down-btn" data-key="e">↓</button>
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
            // Check if touch is on movement pad
            const movementPad = document.getElementById('movement-pad');
            if (movementPad && movementPad.contains(e.target)) {
                isPadTouch = true;
                return;
            }
            
            // Only handle single touch for look (not pinch)
            if (e.touches.length === 1) {
                isPadTouch = false;
                lastTouch = e.touches[0];
            }
        });
        
        document.addEventListener('touchmove', (e) => {
            // Skip if touching movement pad or pinching
            if (isPadTouch || e.touches.length !== 1) return;
            
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
            },
            (xhr) => {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            (error) => {
                console.error('Error loading bamboo model:', error);
                // Fallback to procedural bamboo
                this.createImprovedBamboo();
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
            color: 0x4a7c4e,
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
        const geometry = new THREE.BoxGeometry(1, 2, 0.05);
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
            new THREE.PlaneGeometry(0.9, 1.8),
            textMaterial
        );
        textPlane.position.z = 0.026;
        
        tanzakuGroup.add(tanzaku);
        tanzakuGroup.add(textPlane);
        
        // Add string
        const stringGeometry = new THREE.CylinderGeometry(0.01, 0.01, 1);
        const stringMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
        const string = new THREE.Mesh(stringGeometry, stringMaterial);
        string.position.y = 1.5;
        tanzakuGroup.add(string);
        
        // Random initial position around bamboo
        const angle = Math.random() * Math.PI * 2;
        const radius = 2 + Math.random() * 3;
        tanzakuGroup.position.set(
            Math.cos(angle) * radius,
            3 + Math.random() * 4,
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
            const response = await fetch(`${this.apiBaseUrl}/api/tanzaku`);
            const data = await response.json();
            
            if (data.success) {
                // Clear existing tanzaku
                this.tanzakuList.forEach(tanzaku => {
                    this.scene.remove(tanzaku);
                });
                this.tanzakuList = [];
                
                // Load tanzaku from server
                for (const tanzakuData of data.tanzaku) {
                    await this.createTanzakuFromData(tanzakuData);
                }
                
                console.log(`Loaded ${data.tanzaku.length} tanzaku from server`);
            }
        } catch (error) {
            console.error('Failed to load tanzaku from server:', error);
        } finally {
            this.loadingTanzaku = false;
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
            
            const response = await fetch(`${this.apiBaseUrl}/api/tanzaku`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(tanzakuData)
            });
            
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
            // Create canvas from base64 data
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
            
            const response = await fetch(`${this.apiBaseUrl}/api/tanzaku/${tanzakuGroup.userData.serverId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(tanzakuData)
            });
            
            const result = await response.json();
            if (result.success) {
                console.log('Tanzaku position updated on server');
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
            // The string extends from y=1.0 to y=2.0 (length=1, center at y=1.5)
            // So the string TOP (attachment point) is at y=2.0 from tanzaku center
            const stringTopOffset = new THREE.Vector3(0, 2.0, 0); // String top is 2.0 units above tanzaku center
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
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TanabataApp();
});