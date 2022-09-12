import { BufferGeometry, Data3DTexture, Mesh, MeshBasicMaterial, Vector3 } from "three";
import { SDFGenerate } from "./Generator/SDFGenerate";
import { SDFMeshMaterial } from "./SDFMeshMaterial";

export class SDFMesh extends Mesh {
    public material: SDFMeshMaterial;
    public sdf: Data3DTexture;

    constructor(geometry: BufferGeometry, material: MeshBasicMaterial, sdf?: Data3DTexture) {
        super(geometry, material);

        this.userData.isSDF = true;

        this.material = new SDFMeshMaterial({ color: material.color.getHex() });
        
        // Get geometry info and scale geometry to fit in a 1 by 1 box
        const processedGeometryInfo = SDFGenerate.GetGeometryInfo(geometry);
        const centerInv = new Vector3().copy(processedGeometryInfo.center).negate();
        geometry = geometry.translate(centerInv.x, centerInv.y, centerInv.z);
        geometry = geometry.scale(processedGeometryInfo.scale, processedGeometryInfo.scale, processedGeometryInfo.scale);

        // Move geometry back to original place by changing mesh matrix
        this.position.copy(processedGeometryInfo.center);
        this.scale.multiplyScalar(1/processedGeometryInfo.scale);

        this.sdf = !sdf ? SDFGenerate.Generate(geometry, 64) : sdf;
    }
}