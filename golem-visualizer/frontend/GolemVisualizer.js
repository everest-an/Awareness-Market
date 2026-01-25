/**
 * Project Golem - 3D Neural Memory Visualizer
 * 可集成的可视化模块
 * 
 * 使用方法:
 * 1. 导入此模块
 * 2. 调用 GolemVisualizer.init(containerElement, configOptions)
 * 3. 使用 GolemVisualizer.query(queryText) 触发查询
 */

class GolemVisualizer {
    constructor(config = {}) {
        this.config = {
            containerId: config.containerId || 'golem-container',
            apiUrl: config.apiUrl || 'http://localhost:8000',
            dataPath: config.dataPath || './golem_cortex.json',
            width: config.width || window.innerWidth,
            height: config.height || window.innerHeight,
            autoRotate: config.autoRotate !== false,
            rotateSpeed: config.rotateSpeed || 0.5,
            fog: config.fog !== false,
            ...config
        };

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.material = null;
        this.geometry = null;
        this.pointsMesh = null;
        this.nodes = [];
        this.isInitialized = false;
    }

    /**
     * 初始化可视化器
     */
    async init() {
        try {
            // 创建容器
            const container = document.getElementById(this.config.containerId);
            if (!container) {
                throw new Error(`Container with ID '${this.config.containerId}' not found`);
            }

            // 初始化Three.js场景
            this._initScene(container);

            // 加载数据
            await this._loadData();

            // 启动动画循环
            this._animate();

            // 响应式调整
            window.addEventListener('resize', () => this._onWindowResize());

            this.isInitialized = true;
            console.log('✅ GolemVisualizer initialized successfully');
        } catch (error) {
            console.error('❌ GolemVisualizer initialization error:', error);
            throw error;
        }
    }

    /**
     * 初始化Three.js场景
     */
    _initScene(container) {
        // 创建场景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050505);
        if (this.config.fog) {
            this.scene.fog = new THREE.FogExp2(0x050505, 0.002);
        }

        // 创建摄像机
        this.camera = new THREE.PerspectiveCamera(
            75,
            this.config.width / this.config.height,
            0.1,
            1000
        );
        this.camera.position.set(0, 20, 120);

        // 创建渲染器
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(this.config.width, this.config.height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(this.renderer.domElement);

        // 导入OrbitControls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.autoRotate = this.config.autoRotate;
        this.controls.autoRotateSpeed = this.config.rotateSpeed;

        // 创建着色器材质
        this.material = this._createShaderMaterial();
    }

    /**
     * 创建自定义着色器材质
     */
    _createShaderMaterial() {
        return new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 }
            },
            vertexShader: `
                attribute vec3 color;
                attribute float activationTime;
                varying vec3 vColor;
                varying float vAlpha;
                uniform float uTime;
                
                void main() {
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    float timeSinceHit = uTime - activationTime;
                    float intensity = 0.0;
                    
                    if (timeSinceHit > 0.0 && timeSinceHit < 3.0) {
                        intensity = 1.0 / (1.0 + timeSinceHit * 3.0);
                        gl_PointSize = (4.0 * (1.0 + intensity * 5.0)) * (300.0 / -mvPosition.z);
                    } else {
                        gl_PointSize = 2.5 * (300.0 / -mvPosition.z);
                    }
                    
                    gl_Position = projectionMatrix * mvPosition;
                    vColor = mix(color, vec3(1.0, 1.0, 1.0), intensity);
                    vAlpha = 0.4 + (intensity * 0.6);
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                varying float vAlpha;
                
                void main() {
                    vec2 coord = gl_PointCoord - vec2(0.5);
                    if(length(coord) > 0.5) discard;
                    float strength = 1.0 - (length(coord) * 2.0);
                    gl_FragColor = vec4(vColor, vAlpha * strength);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
    }

    /**
     * 加载数据并构建点云
     */
    async _loadData() {
        try {
            const response = await fetch(this.config.dataPath);
            if (!response.ok) throw new Error(`Failed to load data: ${response.status}`);

            const data = await response.json();
            this.nodes = data;

            // 构建几何体
            const positions = [];
            const colors = [];
            const activationTimes = [];

            data.forEach(node => {
                positions.push(node.pos[0] * 8, node.pos[1] * 8, node.pos[2] * 8);
                colors.push(node.col[0], node.col[1], node.col[2]);
                activationTimes.push(-100.0);
            });

            // 创建缓冲几何体
            this.geometry = new THREE.BufferGeometry();
            this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            this.geometry.setAttribute('activationTime', new THREE.Float32BufferAttribute(activationTimes, 1));
            this.geometry.attributes.activationTime.setUsage(THREE.DynamicDrawUsage);

            // 创建点云
            this.pointsMesh = new THREE.Points(this.geometry, this.material);
            this.scene.add(this.pointsMesh);

            console.log(`✅ Loaded ${data.length} nodes`);
        } catch (error) {
            console.error('❌ Error loading data:', error);
            throw error;
        }
    }

    /**
     * 执行查询
     */
    async query(queryText) {
        if (!this.isInitialized) {
            throw new Error('Visualizer not initialized. Call init() first.');
        }

        try {
            const response = await fetch(`${this.config.apiUrl}/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: queryText })
            });

            if (!response.ok) throw new Error(`Query failed: ${response.status}`);

            const result = await response.json();

            // 触发脉冲效果
            this._triggerPulse(result.indices);

            return {
                indices: result.indices,
                scores: result.scores,
                topNode: this.nodes[result.indices[0]] || null
            };
        } catch (error) {
            console.error('❌ Query error:', error);
            throw error;
        }
    }

    /**
     * 触发多点脉冲效果
     */
    _triggerPulse(indices) {
        if (!this.geometry) return;

        const currentTime = performance.now() / 1000;
        const activations = this.geometry.attributes.activationTime.array;

        indices.forEach((idx, i) => {
            activations[idx] = currentTime + (i * 0.02);
        });

        this.geometry.attributes.activationTime.needsUpdate = true;
    }

    /**
     * 动画循环
     */
    _animate() {
        requestAnimationFrame(() => this._animate());

        if (this.controls) {
            this.controls.update();
        }

        if (this.material) {
            this.material.uniforms.uTime.value = performance.now() / 1000;
        }

        if (this.renderer) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    /**
     * 窗口调整事件处理
     */
    _onWindowResize() {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;

        if (this.camera) {
            this.camera.aspect = newWidth / newHeight;
            this.camera.updateProjectionMatrix();
        }

        if (this.renderer) {
            this.renderer.setSize(newWidth, newHeight);
        }
    }

    /**
     * 获取节点信息
     */
    getNode(index) {
        return this.nodes[index] || null;
    }

    /**
     * 获取所有节点
     */
    getAllNodes() {
        return this.nodes;
    }

    /**
     * 获取节点总数
     */
    getNodeCount() {
        return this.nodes.length;
    }

    /**
     * 销毁可视化器
     */
    destroy() {
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer.domElement.remove();
        }

        if (this.geometry) {
            this.geometry.dispose();
        }

        if (this.material) {
            this.material.dispose();
        }

        this.isInitialized = false;
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GolemVisualizer;
}
