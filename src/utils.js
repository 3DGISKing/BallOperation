import * as THREE from '../vendor/three.js-r123/build/three.module.js'

export class Utils{
    static mouseToRay(mouse, camera, width, height){

        let normalizedMouse = {
            x: (mouse.x / width) * 2 - 1,
            y: -(mouse.y / height) * 2 + 1
        };

        let vector = new THREE.Vector3(normalizedMouse.x, normalizedMouse.y, 0.5);
        let origin = camera.position.clone();
        vector.unproject(camera);
        let direction = new THREE.Vector3().subVectors(vector, origin).normalize();

        let ray = new THREE.Ray(origin, direction);

        return ray;
    }


    static getMouseIntersection (mouse, camera, viewer, params = {}) {
        let renderer = viewer.renderer;

        let nmouse = {
            x: (mouse.x / renderer.domElement.clientWidth) * 2 - 1,
            y: -(mouse.y / renderer.domElement.clientHeight) * 2 + 1
        };

        let pickParams = {};

        if(params.pickClipped){
            pickParams.pickClipped = params.pickClipped;
        }

        pickParams.x = mouse.x;
        pickParams.y = renderer.domElement.clientHeight - mouse.y;

        let raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(nmouse, camera);

        const intersects = raycaster.intersectObject(viewer.planeMesh);

        if(intersects) {
            const intersect = intersects[0];

            if(!intersect)
                return null;

            return {
                location: intersect.point,
                distance: intersect.distance,
            };
        }
        else {
            return null;
        }
    }
}