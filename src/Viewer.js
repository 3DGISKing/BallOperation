import * as THREE from '../vendor/three.js-r123/build/three.module.js'
import {OrbitControls} from '../vendor/three.js-r123/examples/jsm/controls/OrbitControls.js'
import {SelectionBox} from '../vendor/three.js-r123/examples/jsm/interactive/SelectionBox.js';
import {SelectionHelper} from '../vendor/three.js-r123/examples/jsm/interactive/SelectionHelper.js';
import {EffectComposer} from '../vendor/three.js-r123/examples/jsm/postprocessing/EffectComposer.js';
import {UnrealBloomPass} from '../vendor/three.js-r123/examples/jsm/postprocessing/UnrealBloomPass.js';
import {RenderPass} from '../vendor/three.js-r123/examples/jsm/postprocessing/RenderPass.js';
import {ShaderPass} from '../vendor/three.js-r123/examples/jsm/postprocessing/ShaderPass.js';

import {InputHandler} from "./InputHandler.js";
import {Ball} from "./Ball.js";
import {EventDispatcher} from "./EventDispatcher.js";

const Vector3 = THREE.Vector3;
let camera, scene, renderer, controls;
const sceneBoundingRadius = 50;
const near = 1;
const far = sceneBoundingRadius * 10;

const initCameraPosition = new Vector3(0, 0, sceneBoundingRadius * 10);

const ENTIRE_SCENE = 0, BLOOM_SCENE = 1;

const bloomLayer = new THREE.Layers();

bloomLayer.set(BLOOM_SCENE);

const darkMaterial = new THREE.MeshBasicMaterial({color: "black"});
const materials = {};

class Viewer extends EventDispatcher {
    constructor(containerId) {
        super();

        this._container = document.getElementById(containerId);

        this._balls = [];
        this._ballMeshes = [];
        this._gridSize = 10;

        this._raycaster = new THREE.Raycaster();

        this._enableControl = false;
        this._debug = false;

        this._initThreejs();
        this._setupScene();

        this._selectionBox = new SelectionBox(camera, scene);
        this._helper = new SelectionHelper(this._selectionBox, this._renderer, 'selectBox');

        this.inputHandler = new InputHandler(this);

        this.inputHandler.setScene(this._scene);
        this.inputHandler.addInputListener(this);

        this._registerEvents();

        this._loop(0);
    }

    get renderer() {
        return this._renderer;
    }

    get camera() {
        return this._camera;
    }

    get scene() {
        return this._scene;
    }

    get planeMesh() {
        return this._planeMesh;
    }

    hitBall(vector2, excludeBall) {
        const mouse = new THREE.Vector2();

        const renderer = this.renderer;

        mouse.x = (vector2.x / renderer.domElement.clientWidth) * 2 - 1;
        mouse.y = -(vector2.y / renderer.domElement.clientHeight) * 2 + 1;

        this._raycaster.setFromCamera(mouse, this._camera);

        const intersects = this._raycaster.intersectObjects(this._ballMeshes);

        if (intersects.length > 0) {
            if (intersects[0].object.uuid === excludeBall.sphereMesh.uuid)
                return null;

            return intersects[0].object.ball;
        } else
            return null;
    }

    _registerEvents() {
        let mousedown = (e) => {

        };

        let drag = (e) => {

        };

        let drop = (e) => {

        };

        this.addEventListener('mousedown', mousedown);
        this.addEventListener('drag', drag);
        this.addEventListener('drop', drop);

        const selectionBox = this._selectionBox;
        const helper = this._helper;

        this._renderer.domElement.addEventListener('pointerdown', function (event) {
            for (const item of selectionBox.collection) {
                if (!item.ball)
                    continue;

                if (!item.ball.visible)
                    continue;

                item.ball.deselect();
            }

            selectionBox.startPoint.set(
                (event.clientX / window.innerWidth) * 2 - 1,
                -(event.clientY / window.innerHeight) * 2 + 1,
                0.5);

        });

        this._renderer.domElement.addEventListener('pointermove', function (event) {
            if (helper.isDown) {
                for (let i = 0; i < selectionBox.collection.length; i++) {
                    if (!selectionBox.collection[i].ball)
                        continue;

                    if (!selectionBox.collection[i].ball.visible)
                        continue;

                    selectionBox.collection[i].ball.deselect();
                }

                selectionBox.endPoint.set(
                    (event.clientX / window.innerWidth) * 2 - 1,
                    -(event.clientY / window.innerHeight) * 2 + 1,
                    0.5);

                const allSelected = selectionBox.select();

                for (let i = 0; i < allSelected.length; i++) {
                    if (!allSelected[i].ball)
                        continue;

                    if (!allSelected[i].ball.visible)
                        continue;

                    allSelected[i].ball.select();
                }
            }
        });

        this._renderer.domElement.addEventListener('pointerup', function (event) {
            selectionBox.endPoint.set(
                (event.clientX / window.innerWidth) * 2 - 1,
                -(event.clientY / window.innerHeight) * 2 + 1,
                0.5);

            const allSelected = selectionBox.select();

            for (let i = 0; i < allSelected.length; i++) {

                if (!allSelected[i].ball)
                    continue;

                if (!allSelected[i].ball.visible)
                    continue;

                allSelected[i].ball.select();
            }
        });

        document.getElementById('add').addEventListener('click', () => {
            this.onAdd();
        });

        document.getElementById('split').addEventListener('click', () => {
            this.onSplit();
        });
    }

    onAdd() {
        const selectedBalls = this._balls.filter(ball => ball.selected);

        if (selectedBalls.length < 2) {
            alert('Please select more than 2!');
            return;
        }

        let totalDiameter = 0;

        const children = [];

        const totalRectInGrid = new THREE.Box2();

        for (const ball of selectedBalls) {
            ball.visible = false;
            totalDiameter += ball.diameter;
            children.push(ball);

            totalRectInGrid.union(ball.getRectInGrid());

            ball.deselect();
        }

        console.log(totalRectInGrid);

        const center = totalRectInGrid.getCenter(new THREE.Vector2());

        this._newBall({
            children: children,
            viewer: this,
            centerGridX: center.x,
            centerGridY: center.y,
            diameter: totalDiameter,
            color: Math.random() * 0xffffff
        })
    }

    onSplit() {
        const selectedBalls = this._balls.filter(ball => ball.selected);

        if (selectedBalls.length !== 1) {
            alert('Please select exactly one');
            return;
        }

        const selectedBall = selectedBalls[0];

        if (!selectedBall.hasChildBall()) {
            alert('Selected does not have components. Can not separate it!.');
            return;
        }

        const childrenBalls = selectedBall.childrenBalls;

        for (const ball of childrenBalls)
            ball.visible = true;

        this._scene.remove(selectedBall);
    }

    _newBall(options) {
        const ball = new Ball(options);

        this._ballMeshes.push(ball.sphereMesh);

        this._balls.push(ball);
    }

    _oneGridUnitSize() {
        const size = sceneBoundingRadius * 2;
        return size / this._gridSize;
    }

    _initThreejs() {
        const width = this._container.offsetWidth;
        const height = this._container.offsetHeight;

        const aspect = height / width;

        const orthoCameraViewRadius = sceneBoundingRadius * 2;

        camera = new THREE.OrthographicCamera(-orthoCameraViewRadius, orthoCameraViewRadius, orthoCameraViewRadius * aspect, -orthoCameraViewRadius * aspect, near, far);

        this._camera = camera;

        camera.position.copy(initCameraPosition);

        // scene
        scene = new THREE.Scene();

        this._scene = scene;
        scene.background = new THREE.Color(0x000000);

        //renderer
        renderer = new THREE.WebGLRenderer({antialias: true});

        renderer.toneMapping = THREE.ReinhardToneMapping;

        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.shadowMap.enabled = true;
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(width, height);

        this._renderer = renderer;

        const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 1.5, 0.4, 0.85);

        const params = {
            exposure: 1,
            bloomStrength: 1,
            bloomThreshold: 0,
            bloomRadius: 1
        };

        bloomPass.threshold = params.bloomThreshold;
        bloomPass.strength = params.bloomStrength;
        bloomPass.radius = params.bloomRadius;

        const bloomComposer = new EffectComposer(renderer);

        this._composer = bloomComposer;

        const renderPass = new RenderPass(scene, this._camera);

        bloomComposer.renderToScreen = false;
        bloomComposer.addPass(renderPass);
        bloomComposer.addPass(bloomPass);

        const finalPass = new ShaderPass(
            new THREE.ShaderMaterial({
                uniforms: {
                    baseTexture: {value: null},
                    bloomTexture: {value: bloomComposer.renderTarget2.texture}
                },
                vertexShader: document.getElementById('vertexshader').textContent,
                fragmentShader: document.getElementById('fragmentshader').textContent,
                defines: {}
            }), "baseTexture"
        );

        finalPass.needsSwap = true;

        const finalComposer = new EffectComposer(renderer);

        this._finalComposer = finalComposer;

        finalComposer.addPass(renderPass);
        finalComposer.addPass(finalPass);


        this._container.appendChild(renderer.domElement);

        if (this._enableControl) {
            controls = new OrbitControls(camera, renderer.domElement);

            controls.maxPolarAngle = Math.PI * 0.5;
            controls.minDistance = 0;
            controls.maxDistance = sceneBoundingRadius * 10;
        }

        window.addEventListener('resize', this.onWindowResize.bind(this), false);
    }

    _setupScene() {
        if (this._debug)
            this._setupSceneDebugHelpers();

        this._setupLights();
        this._setupMyScene();
    }

    _setupSceneDebugHelpers() {
        const axesHelper = new THREE.AxesHelper(sceneBoundingRadius * 1.5);
        scene.add(axesHelper);

        const size = sceneBoundingRadius * 2;
        const divisions = this._gridSize;

        const gridHelper = new THREE.GridHelper(size, divisions);

        gridHelper.rotation.set(Math.PI / 2, 0, 0);
        scene.add(gridHelper);
    }

    _setupLights() {
        scene.add(new THREE.AmbientLight(0x404040, 0.2));

        camera.add(new THREE.PointLight(0xffffff, 0.9));

        scene.add(camera);
    }

    _setupMyScene() {
        let geometry = new THREE.PlaneGeometry(sceneBoundingRadius * 2, sceneBoundingRadius * 2, 32);
        let material = new THREE.MeshBasicMaterial({color: 0xffff00, side: THREE.DoubleSide});

        const planeMesh = new THREE.Mesh(geometry, material);

        this._planeMesh = planeMesh;

        // for get intersection point
        //scene.add( planeMesh );

        this._loadFonts();
    }

    _loadFonts() {
        const fontName = "optimer";
        const fontWeight = "bold";

        const loader = new THREE.FontLoader();

        loader.setPath('https://threejs.org/examples/fonts/');

        loader.load(fontName + '_' + fontWeight + '.typeface.json', (response) => {
            this._font = response;
            this._addBalls();
        });
    }

    _addBalls() {
        this._newBall({
            viewer: this,
            centerGridX: -4,
            centerGridY: -3,
            diameter: 1,
            color: 0x30273c
        });

        this._newBall({
            viewer: this,
            centerGridX: -3,
            centerGridY: -2,
            diameter: 1,
            color: 0xcd7b43
        });

        this._newBall({
            viewer: this,
            centerGridX: 0,
            centerGridY: 0,
            diameter: 2,
            color: 0x77a358
        });

        this._newBall({
            viewer: this,
            centerGridX: 3,
            centerGridY: 1,
            diameter: 3,
            color: 0x0146ad
        })
    }

    get font() {
        return this._font;
    }

    onWindowResize() {
        const width = this._container.offsetWidth;
        const height = this._container.offsetHeight;

        const aspect = height / width;

        const orthoCameraViewRadius = sceneBoundingRadius * 2;

        camera.left = -orthoCameraViewRadius;
        camera.right = orthoCameraViewRadius;
        camera.top = orthoCameraViewRadius * aspect;
        camera.bottom = - orthoCameraViewRadius * aspect;

        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }

    _loop(now) {
        this._render();

        window.requestAnimationFrame(this._loop.bind(this));
    }

    _render() {
        this.renderBloom(true);
        this._finalComposer.render();
    }

    renderBloom(mask) {
        if (mask === true) {
            this._scene.traverse(darkenNonBloomed);
            this._composer.render();
            this._scene.traverse(restoreMaterial);

        } else {
            camera.layers.set(BLOOM_SCENE);
            bloomComposer.render();
            camera.layers.set(ENTIRE_SCENE);
        }
    }
}

function darkenNonBloomed(obj) {
    if (obj.isMesh && bloomLayer.test(obj.layers) === false) {

        materials[obj.uuid] = obj.material;
        obj.material = darkMaterial;
    }
}

function restoreMaterial(obj) {
    if (materials[obj.uuid]) {
        obj.material = materials[obj.uuid];
        delete materials[obj.uuid];
    }
}

export default Viewer;

