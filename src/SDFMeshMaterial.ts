import SDFMeshMaterialVertexShader from './shaders/SDFMeshMaterial.vert.glsl';
import SDFMeshMaterialFragmentShader from './shaders/SDFMeshMaterial.frag.glsl';

import { Color, DataTexture, ShaderMaterial } from "three"

export interface SDFMeshMaterialParameters {
    color: number;
}

export class SDFMeshMaterial extends ShaderMaterial {
    constructor(parameters: SDFMeshMaterialParameters) {
        super();

        this.vertexShader = SDFMeshMaterialVertexShader;
        this.fragmentShader = SDFMeshMaterialFragmentShader;

        this.uniforms = {
            color: {
                value: new Color().setHex(parameters.color)
            },
            tDiffuse: {
                value: null
            }
        }
    }

    public SetDiffuse(texture: DataTexture) {
        this.uniforms.tDiffuse.value = texture;
    }
}