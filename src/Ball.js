import * as THREE from '../vendor/three.js-r123/build/three.module.js'
import {Utils} from "./utils.js";

const ENTIRE_SCENE = 0, BLOOM_SCENE = 1;

export class Ball extends THREE.Object3D{
    /**
     * @param options
     * @param options.viewer
     * @param options.centerGridX
     * @param options.centerGridY
     * @param options.diameter
     * @param options.color
     */
    constructor(options) {
        super();

        this._selected = false;
        this._diameter = options.diameter; // in grid unit
        this._color = options.color;

        const viewer = options.viewer;
        const oneGridUnitSize = viewer._oneGridUnitSize();
        this._realDiameter = options.diameter * oneGridUnitSize;

        this._viewer = viewer;

        const geometry = new THREE.SphereGeometry( this._realDiameter / 2, 32, 32 );

        const material = new THREE.MeshPhongMaterial( {
            color: options.color
        } );

        this._sphereMeshMaterial = material;

        const sphereMesh = new THREE.Mesh( geometry, material );

        sphereMesh.ball = this;

        this._sphereMesh = sphereMesh;

        const centerX = (options.centerGridX) * oneGridUnitSize;
        const centerY = (options.centerGridY) * oneGridUnitSize;

        const position = new THREE.Vector3(centerX, centerY, 0);

        const min = new THREE.Vector3(centerX - this._realDiameter / 2, centerY - this._realDiameter / 2, 0);
        const max = new THREE.Vector3(centerX + this._realDiameter / 2, centerY + this._realDiameter / 2, 0);

        viewer.camera.updateMatrixWorld();

        let screenMin = min.project(viewer.camera);
        let screenMax = max.project(viewer.camera);

        const widthHalf  = viewer.renderer.domElement.clientWidth / 2;
        const heightHalf  = viewer.renderer.domElement.clientHeight / 2;

        screenMin.x = ( screenMin.x * widthHalf ) + widthHalf;
        screenMin.y = - ( screenMin.y * heightHalf ) + heightHalf;

        screenMax.x = ( screenMax.x * widthHalf ) + widthHalf;
        screenMax.y = - ( screenMax.y * heightHalf ) + heightHalf;

        this._rect = new THREE.Box2(screenMin, screenMax);

        sphereMesh.position.copy(position);

        let drag = (e) => {
            let I = Utils.getMouseIntersection(
                e.drag.end,
                e.viewer.camera,
                e.viewer,
                {pickClipped: true});

            if (I) {
                if(e.drag.object.uuid === sphereMesh.uuid) {
                    // sphereMesh.position.set(I.location.x, I.location.y, 0);
                }
            }
        };

        sphereMesh.addEventListener('drag', drag);

        let drop = (e) => {
            //const hitBall = viewer.hitBall(e.drag.end, this);
        };

        sphereMesh.addEventListener('drop', drop);

        this.add(sphereMesh);

        viewer.scene.add( this );

        this._childrenBalls = [];

        if(options.children)
            this._childrenBalls = options.children;

        this._centerGridX = options.centerGridX;
        this._centerGridY = options.centerGridY;

        const size = 6;
        let textGeo = new THREE.TextGeometry( this._diameter.toString(), {
            font: viewer.font,
            size: size,
            height: 1,
            bevelEnabled: true,
            bevelThickness: 1,
            bevelSize: 0.2,
            curveSegments: 4
        } );

        textGeo.computeBoundingBox();
        textGeo.computeVertexNormals();

        const textSize = textGeo.boundingBox.getSize(new THREE.Vector3());

        textGeo = new THREE.BufferGeometry().fromGeometry( textGeo );

        const materials = [
            new THREE.MeshPhongMaterial( { color: 0xffffff } ), // front
            new THREE.MeshPhongMaterial( { color: 0xffffff } ) // side
        ];

        let textMesh = new THREE.Mesh( textGeo, materials );

        textMesh.position.x = centerX - textSize.x / 2 - 1;
        textMesh.position.y = centerY - textSize.y / 2;
        textMesh.position.z = this._realDiameter;

        this.add(textMesh);
    }

    select() {
        this._sphereMeshMaterial.color.setHex(0xff0000);

        this._selected = true;

        this._sphereMesh.layers.enable( BLOOM_SCENE );
    }

    deselect() {
        this._sphereMeshMaterial.color.setHex(this._color);

        this._selected = false;

        this._sphereMesh.layers.disable( BLOOM_SCENE );
    }

    get selected() {
        return this._selected;
    }

    get sphereMesh () {
        return this._sphereMesh;
    }

    get box2() {
        return this._rect;
    }

    get diameter() {
        return this._diameter;
    }

    get centerGridX() {
        return this._centerGridX;
    }

    get centerGridY() {
        return this._centerGridY;
    }

    getRectInGrid() {
        return new THREE.Box2(new THREE.Vector2(this._centerGridX - this._diameter / 2, this._centerGridY - this._diameter / 2 ),
                             new THREE.Vector2(this._centerGridY + this._diameter / 2, this._centerGridY + this._diameter / 2));
    }

    hasChildBall() {
        return this._childrenBalls.length > 0;
    }

    get childrenBalls() {
        return this._childrenBalls;
    }
}