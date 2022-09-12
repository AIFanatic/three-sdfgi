import { Data3DTexture, DataTexture, MathUtils, Mesh, OrthographicCamera, PerspectiveCamera, PlaneBufferGeometry, ShaderMaterial, Vector2, Vector3, WebGLRenderer, WebGLRenderTarget } from 'three';
import { Pass } from '../node_modules/three/examples/jsm/postprocessing/Pass';

import SDFDifusePassVertexShader from './shaders/SDFDiffusePass.vert.glsl';
import SDFDifusePassFragmentShader from './shaders/SDFDiffusePass.frag.glsl';

export enum DebugMode {
    NONE,
    SDF,
    HITCOUNT,
    NORMAL,
    LIGHT
};

export class SDFDiffusePass extends Pass {
    private camera: PerspectiveCamera;
    private sceneResolution: number;
    private fsQuadCamera: OrthographicCamera;

    private mesh: Mesh;
    private material: ShaderMaterial;

    public renderToScreen: boolean;

    public renderTarget: WebGLRenderTarget;

    constructor(camera: PerspectiveCamera, sceneResolution: number) {
        super();
        this.camera = camera;
        this.sceneResolution = sceneResolution;
        this.fsQuadCamera = new OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );
		
        this.material = new ShaderMaterial( {
			uniforms: {
                sceneResolution: {
                    value: this.sceneResolution
                },
                sdfTextures2D: {
                    value: null
                },
                sdfMatrices: {
                    value: null
                },
                sdfExtents: {
                    value: null
                },
                sdfCount: {
                    value: 0
                },
                cameraPosition: {value: new Vector3()},
                cameraDirection: {value: new Vector3()},
                cameraAspect: {value: camera.aspect},
                cameraFov: {value: camera.fov},

                lightPosition: { value: new Vector3() },
                lightColor: { value: new Vector3() },
                lightIntensity: { value: 0 },

                debugMode: { value: -1 }

            },
			vertexShader: SDFDifusePassVertexShader,
			fragmentShader: SDFDifusePassFragmentShader
		});

        const geometry = new PlaneBufferGeometry(2, 2);
        this.mesh = new Mesh(geometry, this.material);
    }

    public SetSDFTextures2D(sdfTextures2D: DataTexture) {
        this.material.uniforms.sdfTextures2D.value = sdfTextures2D;
        this.material.uniforms.sdfCount.value = sdfTextures2D.image.height / this.sceneResolution;
    }

    public SetSDFMatrices(sdfMatrices: DataTexture) {
        this.material.uniforms.sdfMatrices.value = sdfMatrices;
    }
    
    public SetSDFExtents(sdfExtents: DataTexture) {
        this.material.uniforms.sdfExtents.value = sdfExtents;
    }

    public SetLightPosition(position: Vector3) {
        this.material.uniforms.lightPosition.value.copy(position);
    }

    public SetLightIntensity(intensity: number) {
        this.material.uniforms.lightIntensity.value = intensity;
    }

    public SetDebugMode(mode: DebugMode) {
        this.material.uniforms.debugMode.value = mode;
    }

    private UpdateCameraUniforms() {
        this.camera.getWorldPosition(this.material.uniforms.cameraPosition.value);
        this.camera.getWorldDirection(this.material.uniforms.cameraDirection.value);
    }

    public render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget /*, deltaTime, maskActive */ ) {
        if (this.material.uniforms.sdfCount.value == 0) return;
        
        this.UpdateCameraUniforms();

		if ( this.renderToScreen ) {
			renderer.setRenderTarget( null );
            renderer.render(this.mesh, this.fsQuadCamera);
		} else {
			renderer.setRenderTarget( writeBuffer );
            renderer.render(this.mesh, this.fsQuadCamera);
            this.renderTarget = writeBuffer;
		}
    }
}