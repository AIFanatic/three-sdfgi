import { Box3, Box3Helper, BoxBufferGeometry, BufferGeometry, Color, DataTexture, FloatType, InstancedMesh, Line, LineBasicMaterial, MathUtils, Matrix4, Mesh, MeshBasicMaterial, Object3D, RedFormat, Scene, SphereBufferGeometry, Vector2, Vector3 } from "three";

interface RayTriangleIntersectionHitResult {
    triangleId: number;
    isBackFace: boolean;
    distance: number;
};

interface RayTriangleIntersectionResult {
    hits: RayTriangleIntersectionHitResult[];
    totalHits: number;
    backHits: number;
};

interface GeometryInfo {
    scale: number;
    bbox: {
        center: Vector3;
        size: Vector3;
    }
}

export class SDFGenerateCPU {
    private scene: Scene;
    private geometry: BufferGeometry;
    private resolution: number;

    constructor(scene: Scene, geometry: BufferGeometry, resolution: number) {
        this.scene = scene;
        this.resolution = resolution;
        
        // Prep
        this.geometry = geometry.clone();
        this.geometry = this.geometry.toNonIndexed();
        const geometryInfo = this.GetGeometryInfo(geometry);
        const scale = geometryInfo.scale;
        const centerInv = new Vector3().copy(geometryInfo.bbox.center).negate();
        this.geometry = this.geometry.translate(centerInv.x, centerInv.y, centerInv.z);
        this.geometry = this.geometry.scale(scale, scale, scale);

        //// SDF BBox
        this.DrawBox(new Vector3(), new Vector3(1,1,1));

        //// Scaled BBox
        const scaledBBoxSize = geometryInfo.bbox.size.clone().multiplyScalar(geometryInfo.scale);
        this.DrawBox(new Vector3(), scaledBBoxSize);




        const triangles = this.GetTriangles(this.geometry);
        
        // Debug
        this.DrawTriangleNormals(triangles);

        // SDF Generation
        const texture = this.ComputeSDF(scaledBBoxSize, triangles, this.resolution);

        this.DrawSDFTexture(texture);
    }

    // Visualization
    private DrawBox(center: Vector3, size: Vector3) {
        const box = new Box3().setFromCenterAndSize(center, size);
        const boxHelper = new Box3Helper(box);
        this.scene.add(boxHelper);
    }
    private DrawSphere(position: Vector3, radius: number, color: number) {
        const geometry = new SphereBufferGeometry(radius);
        const material = new MeshBasicMaterial({color: color});
        const mesh = new Mesh(geometry, material);
        mesh.position.copy(position);
        this.scene.add(mesh);
    }
    private DrawLine(from: Vector3, to: Vector3, color: number) {
        const material = new LineBasicMaterial({
            color: color
        });

        const points = [];
        points.push(from);
        points.push(to);

        const geometry = new BufferGeometry().setFromPoints( points );

        const line = new Line( geometry, material );
        this.scene.add( line );
    }

    private DrawRay(origin: Vector3, direction: Vector3, color: number = 0x0000ff, distance: number = 1000) {
        const to = origin.clone().add(direction.clone().multiplyScalar(distance));
        this.DrawLine(origin, to, color);
    }

    private DrawTriangleNormals(triangles: Vector3[][]) {
        for(let triangle of triangles) {
            const normal = this.TriangleNormal(triangle);
            this.DrawLine(triangle[0], triangle[0].clone().add(normal.multiplyScalar(0.02)), 0xffff00);
        }
    }

    private DrawGridSpheres(sphereRadius: number, resolution: number, color: number): InstancedMesh {
        const geometry = new SphereBufferGeometry(sphereRadius);
        const material = new MeshBasicMaterial({transparent: true, opacity: 0.5});
        const mesh = new InstancedMesh(geometry, material, resolution*resolution*resolution);

        let dummyObject3D = new Object3D();
        const dummycolor = new Color().setHex(color);

        // const step = 1.0 / resolution;
        // let i = 0;
        // for (let x = 0; x < resolution; x++) {
        //     for (let y = 0; y < resolution; y++) {
        //         for (let z = 0; z < resolution; z++) {
        //             dummyObject3D.position
        //                 .set(x, y, z) // Absolute coords
        //                 .multiplyScalar(step) // Normalize 0-1
        //                 .subScalar(0.5) // Normalize -0.5 0.5
        //                 .addScalar(step/2); // Center in grid cell
        //             dummyObject3D.updateMatrix();
        //             mesh.setMatrixAt(i, dummyObject3D.matrix);
        //             mesh.setColorAt(i, dummycolor);
        //             i++;
        //         }
        //     }
        // }

        // this.scene.add(mesh);
        return mesh;
    }

    private DrawSDFTexture(texture: DataTexture) {
        const canvas = document.createElement("canvas");
        canvas.width = texture.image.width;
        canvas.height = texture.image.height;
        const ctx = canvas.getContext("2d");
        const image = ctx.createImageData(texture.image.width, texture.image.height);

        for (let i = 0, j = 0; j < texture.image.data.length; i+=4, j++) {
            const sdfDist = texture.image.data[j];
            
            if (sdfDist < 0) {
                image.data[i+0] = (sdfDist * -1) * 255;
                image.data[i+1] = 255;
                image.data[i+2] = 0;
                image.data[i+3] = 255;
            }
            else {
                image.data[i+0] = sdfDist * 255;
                image.data[i+1] = 0;
                image.data[i+2] = 0;
                image.data[i+3] = 255;
            }
        }

        ctx.putImageData(image, 0, 0);

        document.body.appendChild(canvas);
    }

    // SDF Generation

    //// Geometry Prep
    private GetGeometryInfo(geometry: BufferGeometry): GeometryInfo {
        let geometryInfo: GeometryInfo = {
            scale: 1,
            bbox: {
                center: new Vector3(),
                size: new Vector3()
            }
        }

        if (!geometry.boundingBox) {
            geometry.computeBoundingBox();
        }

        const bbox = geometry.boundingBox;
        bbox.getSize(geometryInfo.bbox.size);
        bbox.getCenter(geometryInfo.bbox.center);

        // Scale geometry to fit in a 1,1,1 box
        const extents = geometryInfo.bbox.size.clone().multiplyScalar(0.5);

        const biggestExtent = Math.max(extents.x, extents.y, extents.z);
        if (biggestExtent > 0.5) {
            geometryInfo.scale = 0.5 / biggestExtent; // 0.5 = sdfBboxLength
        }

        return geometryInfo;
    }

    //// Actual SDF Stuff
    private GetTriangles(geometry: BufferGeometry) {
        const positions = geometry.getAttribute("position").array;
        let triangles: Vector3[][] = [];
        for (let i = 0; i < positions.length; i+=9) {
            const a = new Vector3(positions[i+0], positions[i+1], positions[i+2]);
            const b = new Vector3(positions[i+3], positions[i+4], positions[i+5]);
            const c = new Vector3(positions[i+6], positions[i+7], positions[i+8]);

            triangles.push([a, b, c]);
        }
        return triangles;
    }
    
    private TriangleNormal(triangle: Vector3[]) {
        const a = triangle[0];
        const b = triangle[1];
        const c = triangle[2];
        const ba = b.clone().sub(a);
        const ca = c.clone().sub(a);
        return new Vector3().crossVectors(ba, ca).normalize();
    }

    private RayIntersectsTriangle(o: Vector3, d: Vector3, triangle: Vector3[]) {
        const EPSILON = 0.0000001;
    
        const v0 = triangle[0].clone();
        const v1 = triangle[1].clone();
        const v2 = triangle[2].clone();
    
        let e1: Vector3, e2: Vector3, h: Vector3, s: Vector3, q: Vector3;
        let a: number, f, u, v, t;
    
        e1 = v1.clone().sub(v0);
        e2 = v2.clone().sub(v0);
    
        h = new Vector3().crossVectors(d, e2);
        a = e1.clone().dot(h);
    
        if (Math.abs(a) < EPSILON) {
            return false;  // ray is parallel to triangle
        }
    
        f = 1.0 / a;
        s = o.clone().sub(v0);
        u = f * s.clone().dot(h);
    
        if (u < -EPSILON || u > 1.0) {
            return false;
        }
    
        q = new Vector3().crossVectors(s, e1);
        v = f * d.clone().dot(q);
    
        if (v < EPSILON || u + v > 1.0) {
            return false;
        }
    
        t = f * e2.clone().dot(q);
    
        return (t >= 0.0) ? true : false;
    }

    private RayTriangleIntersectionClosest(triangles: Vector3[][], origin: Vector3, direction: Vector3): RayTriangleIntersectionHitResult {
        let intersectionClosest: RayTriangleIntersectionHitResult = {
            triangleId: -1,
            isBackFace: false,
            distance: 100000000
        };

        let rayClosestDistance = 100000000.0;
        for (let i = 0; i < triangles.length; i++) {
            const triangle = triangles[i];

            const intersects = this.RayIntersectsTriangle(origin, direction, triangle);

            if (intersects) {
                const rayDistance = this.DistanceToTriangle(triangle, origin);
                if (rayDistance < rayClosestDistance) {
                    const normal = this.TriangleNormal(triangle);
                    const isBackhit = direction.clone().dot(normal) > 0.0;
    
                    intersectionClosest.triangleId = i;
                    intersectionClosest.isBackFace = isBackhit;
                    intersectionClosest.distance = rayDistance;

                    rayClosestDistance = rayDistance;
                    
                    // // Debug
                    // intersectionClosest.hits.push({
                    //     triangleId: i,
                    //     isBackFace: isBackhit
                    // })
                }
            }
        }

        return intersectionClosest;
    }

    private RayTriangleSphericalClosestDraw(triangles: Vector3[][], origin: Vector3): RayTriangleIntersectionResult {
        let intersections: RayTriangleIntersectionResult = {
            hits: [],
            totalHits: 0,
            backHits: 0
        };


        const samples = 100;
        const phi = Math.PI * (3. - Math.sqrt(5.));  // golden angle in radians

        for (let i = 0; i < samples; i++) {
            const y = 1 - (i / (samples - 1)) * 2;  // y goes from 1 to -1
            const radius = Math.sqrt(1 - y * y);  // radius at y

            const theta = phi * i  // golden angle increment
    
            const x = Math.cos(theta) * radius
            const z = Math.sin(theta) * radius
    
            const rayDirection = new Vector3(x, y, z);

            const rayHitIntersection = this.RayTriangleIntersectionClosest(triangles, origin, rayDirection);

            if (rayHitIntersection.triangleId != -1) {
                intersections.hits.push(rayHitIntersection);
                intersections.totalHits ++;
                intersections.backHits += rayHitIntersection.isBackFace ? 1.0 : 0.0;
                
                // Debug
                if (intersections.hits.length > 0) {
                    this.DrawRay(origin, rayDirection, 0x0000ff, rayHitIntersection.distance);
                }
            }
        }

        return intersections;
    }

    private RayTriangleSphericalClosest(triangles: Vector3[][], origin: Vector3): RayTriangleIntersectionResult {
        let intersections: RayTriangleIntersectionResult = {
            hits: [],
            totalHits: 0,
            backHits: 0
        };

        const samples = 225;
        const phi = Math.PI * (3. - Math.sqrt(5.));  // golden angle in radians

        for (let i = 0; i < samples; i++) {
            const y = 1 - (i / (samples - 1)) * 2;  // y goes from 1 to -1
            const radius = Math.sqrt(1 - y * y);  // radius at y

            const theta = phi * i  // golden angle increment
    
            const x = Math.cos(theta) * radius
            const z = Math.sin(theta) * radius
    
            const rayDirection = new Vector3(x, y, z);

            const rayHitIntersection = this.RayTriangleIntersectionClosest(triangles, origin, rayDirection);

            if (rayHitIntersection.triangleId != -1) {
                intersections.hits.push(rayHitIntersection);
                intersections.totalHits ++;
                intersections.backHits += rayHitIntersection.isBackFace ? 1.0 : 0.0;
                
                // // Debug
                // if (intersections.hits.length > 0) {
                //     this.DrawRay(origin, rayDirection, 0x0000ff, rayHitIntersection.distance);
                // }
            }
        }

        return intersections;
    }

    /* Returns the unsigned distance between the input position and triangle.
    Developed by Inigo Quilez. */
    private DistanceToTriangle(triangle: Vector3[], p: Vector3): number {
        function dot(a: Vector3, b: Vector3) {
            return a.clone().dot(b);
        }
        function dot2(v: Vector3): number {
            return dot(v, v);
        }
        function sign(value: number) {
            if (value < 0.0) return -1.0;
            else if (value == 0.0) return 0.0;
            else if (value > 0.0) return 1.0;
        }

        function clamp(value, min, max) {
            if (value > max) return max;
            else if (value < min) return min;
            return value;
        }

        const v1 = triangle[0];
        const v2 = triangle[1];
        const v3 = triangle[2];

        // prepare data    
        const v21 = v2.clone().sub(v1);
        const v32 = v3.clone().sub(v2);
        const v13 = v1.clone().sub(v3);
        const p1 = p.clone().sub(v1);
        const p2 = p.clone().sub(v2);
        const p3 = p.clone().sub(v3);
        const nor = new Vector3().crossVectors(v21, v13);

        return Math.sqrt( // inside/outside test    
                    (sign(dot(new Vector3().crossVectors(v21,nor),p1)) + 
                    sign(dot(new Vector3().crossVectors(v32,nor),p2)) + 
                    sign(dot(new Vector3().crossVectors(v13,nor),p3))<2.0) 
                    ?
                    // 3 edges    
                    Math.min( Math.min( 
                    dot2(v21.clone().multiplyScalar(clamp(dot(v21,p1)/dot2(v21),0.0,1.0)).sub(p1.clone().negate())), 
                    dot2(v32.clone().multiplyScalar(clamp(dot(v32,p2)/dot2(v32),0.0,1.0)).sub(p2.clone().negate())) ), 
                    dot2(v13.clone().multiplyScalar(clamp(dot(v13,p3)/dot2(v13),0.0,1.0)).sub(p3.clone().negate())) )
                    :
                    // 1 face    
                    dot(nor,p1)*dot(nor,p1)/dot2(nor) );
    }


    private boxContainsPoint(point: Vector3, minExtents: Vector3, maxExtents: Vector3): boolean {
        return point.x < minExtents.x || point.x > maxExtents.x ||
        point.y < minExtents.y || point.y > maxExtents.y ||
        point.z < minExtents.z || point.z > maxExtents.z ? false : true;
    }

    private ClosestTriangle(triangles: Vector3[][], position: Vector3): number {
        let smallestDist = 10000000.0;
        let smallestTriangleId = -1;
        for (let i = 0; i < triangles.length; i++) {
            const triangle = triangles[i];
            const triangleDist = this.DistanceToTriangle(triangle, position);
            if (triangleDist < smallestDist) {
                smallestDist = triangleDist;
                smallestTriangleId = i;
            }
        }
        return smallestTriangleId;
    }

    private ComputeSDF(scaledBBoxSize: Vector3, triangles: Vector3[][], resolution: number): DataTexture {
        // Debug mesh
        const debugMesh = this.DrawGridSpheres(0.01, resolution, 0xff0000);
        
        const width = resolution * resolution;
        const height = resolution;
        const buffer = new Float32Array(width * height);
        const texture = new DataTexture(buffer, width, height);
        texture.type = FloatType;
        texture.format = RedFormat;


        const maxExtents = scaledBBoxSize.clone().multiplyScalar(0.5);
        const minExtents = maxExtents.clone().negate();
        
        const step = 1.0 / resolution;
        const position = new Vector3();
        const _color = new Color().setHex(0xff0000);
        let i = 0;
        for (let gl_FragCoordX = 0; gl_FragCoordX < width; gl_FragCoordX++) {
            for (let gl_FragCoordY = 0; gl_FragCoordY < height; gl_FragCoordY++) {
                const x = gl_FragCoordX % resolution;
                const y = gl_FragCoordY;
                const z = Math.floor(gl_FragCoordX / resolution);

                

                // Position calculation
                position
                .set(x, y, z) // Absolute coords
                .multiplyScalar(step) // Normalize 0-1
                .subScalar(0.5) // Normalize -0.5 0.5
                .addScalar(step/2); // Center in grid cell


                // Get closest triangle
                const closestTriangle = this.ClosestTriangle(triangles, position);
                if (closestTriangle == -1) {
                    throw Error("Couldn't find closest triangle, should never happen");
                }

                const triangle = triangles[closestTriangle];
                let triangleDistance = this.DistanceToTriangle(triangle, position);
                let inside = 0;
                // Check if position is inside scaled bbox
                // If position is not inside the box it means the position is outside the mesh
                if (!this.boxContainsPoint(position, minExtents, maxExtents)) {
                    // Debug
                    _color.setHSL(1, 1, 1-triangleDistance);
                    debugMesh.setColorAt(i, _color);
                }
                else {
                    // Inside bbox, check if inside or outside geometry


                    _color.setHSL(0.5, 1, 1-triangleDistance);
                    debugMesh.setColorAt(i, _color);


                    const intersections = this.RayTriangleSphericalClosest(triangles, position);

                    if (intersections.backHits > 0) {
                        // Backhit percentage > 0.5 of total hits means inside the geometry
                        const backHitPercentage = intersections.backHits / (225); // TODO: Dont hard samples here

                        // for(let intersection of intersections.hits) {
                        //     const triangle = triangles[intersection.triangleId];

                        //     const color = intersection.isBackFace ? 0x0000ff : 0xffff00;
                        //     this.DrawSphere(triangle[0], 0.01, color);
                        // }

                        if (backHitPercentage > 0.5) {
                            inside = 1;
                            _color.setHSL(0.2, 1, 1-triangleDistance);
                            debugMesh.setColorAt(i, _color);

                            // Debug
                            this.DrawSphere(position, 0.01, 0x00ff00);

                            // this.RayTriangleSphericalClosestDraw(triangles, position);

                            // console.log(intersections)
                            // return;
                        }
                    }
                    // throw Error("TESTING inside bbox")
                }

                if (inside > 0) {
                    triangleDistance *= -1;
                }

                buffer[i] = triangleDistance;

                i++;
            }
        }

        texture.needsUpdate = true;
        return texture;
    }

}