import { DataTexture, FloatType, Matrix4, Mesh, RedFormat, RGBAFormat, Scene, Vector3 } from "three";

export class SDFSceneExtents {
    private sdfExtents: DataTexture;

    private tempVector3: Vector3;
    
    constructor() {
        this.sdfExtents = new DataTexture(new Float32Array(), 3, 0);
        this.sdfExtents.format = RGBAFormat;
        this.sdfExtents.type = FloatType;

        this.tempVector3 = new Vector3();
    }

    // https://github.com/mrdoob/three.js/pull/23228#issuecomment-1082808224
    // Saves 2 shader texture queries and texture size
    private UpdateSDFExtentsLength(length: number) {
        this.sdfExtents = new DataTexture(new Float32Array(length * 3), 1, length);
        // @ts-ignore
        this.sdfExtents.format = "RGB";
        this.sdfExtents.internalFormat = 'RGB9_E5';
        this.sdfExtents.type = FloatType;
    }

    private UpdateSDFExtentsTexture(sdfExtents: Vector3[]) {
        if (sdfExtents.length != this.sdfExtents.image.height) {
            this.UpdateSDFExtentsLength(sdfExtents.length);
        }
        
        const bufferArray = [];

        for (let extent of sdfExtents) {
            bufferArray.push(extent.x, extent.y, extent.z);
        }
        const buffer = new Float32Array(bufferArray);
        this.sdfExtents.image.data.set(buffer);
        this.sdfExtents.needsUpdate = true;
    }

    public GetSDFExtentsTexture(): DataTexture {
        return this.sdfExtents;
    }

    // TODO: Optimize
    public update(scene: Scene) {
        let sdfMeshExtents = [];
        scene.traverse(object => {
            if (object.userData.isSDF) {
                const mesh = object as Mesh;
                if (!mesh.geometry.boundingBox) {
                    mesh.geometry.computeBoundingBox();
                }
                mesh.geometry.boundingBox.getSize(this.tempVector3);
                sdfMeshExtents.push(this.tempVector3.clone());
            }
        })
        this.UpdateSDFExtentsTexture(sdfMeshExtents);
    }
}