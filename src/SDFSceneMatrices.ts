import { DataTexture, FloatType, Matrix4, RGBAFormat, Scene } from "three";

export class SDFSceneMatrices {
    private sdfMatrices: DataTexture;
    
    constructor() {
        this.sdfMatrices = new DataTexture(new Float32Array(), 4, 0);
        this.sdfMatrices.format = RGBAFormat;
        this.sdfMatrices.type = FloatType;
    }

    private UpdateSDFMatricesLength(length: number) {
        this.sdfMatrices = new DataTexture(new Float32Array(length * 16), 4, length);
        this.sdfMatrices.format = RGBAFormat;
        this.sdfMatrices.type = FloatType;
    }

    private UpdateSDFMatricesTexture(sdfMatrices: Matrix4[]) {
        if (sdfMatrices.length != this.sdfMatrices.image.height) {
            this.UpdateSDFMatricesLength(sdfMatrices.length);
        }
        
        const bufferArray = [];

        for (let matrix of sdfMatrices) {
            bufferArray.push(...matrix.elements);
        }
        const buffer = new Float32Array(bufferArray);
        this.sdfMatrices.image.data.set(buffer);
        this.sdfMatrices.needsUpdate = true;
    }

    public GetSDFMatricesTexture(): DataTexture {
        return this.sdfMatrices;
    }

    // TODO: Optimize
    public update(scene: Scene) {
        let sdfMeshMatrices = [];
        scene.traverse(object => {
            if (object.userData.isSDF) {
                // Only needed for deferred rendering
                object.updateMatrixWorld();
                sdfMeshMatrices.push(object.matrixWorld.clone().invert())
            }
        })
        this.UpdateSDFMatricesTexture(sdfMeshMatrices);
    }
}