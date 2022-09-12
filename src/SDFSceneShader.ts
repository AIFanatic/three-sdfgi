import { Color, Data3DTexture, DataTexture, EventDispatcher, FloatType, LinearFilter, Matrix4, Mesh, OrthographicCamera, PlaneBufferGeometry, RedFormat, RGBAFormat, Scene, ShaderMaterial, UnsignedByteType, Vector2, Vector3, WebGLRenderer, WebGLRenderTarget } from "three";

import cloudVertexShader from './shaders/scenesdfgen.vert.glsl';
import cloudFragmentShader from './shaders/scenesdfgen.frag.glsl';
import { ReadPixelsAsync } from "./ReadPixelsAsync";
import { SDFMesh } from "./SDFMesh";

enum COMMANDS {
    NONE,
    INCREASE,
    DECREASE,
    REPLACE,
    UPDATE
};

interface SDFSceneShaderEvents {
    type: "updated";
};

export class SDFSceneShader extends EventDispatcher<SDFSceneShaderEvents> {

    private sdfResolution: number;
    private width: number;
    private height: number;

    private canvas: HTMLCanvasElement;
    private camera: OrthographicCamera;
    private renderer: WebGLRenderer;
    private scene: Scene;
    private mesh: Mesh;
    private material: ShaderMaterial;
    
    private renderTargetRead: WebGLRenderTarget;
    private renderTargetWrite: WebGLRenderTarget;
    private outputBufferTexture: DataTexture;

    private sceneMap: Map<string, SDFMesh>;

    constructor(renderer: WebGLRenderer, sdfResolution: number) {
        super();
        this.sdfResolution = sdfResolution;
        this.width = this.sdfResolution * this.sdfResolution;
        this.height = 0;
        this.sceneMap = new Map();

        this.canvas = this.CreateCanvas();

        this.camera = new OrthographicCamera(-1, 1, 1, -1, -1, 1);
        this.renderer = new WebGLRenderer({canvas: this.canvas});
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(1);
        this.renderer.autoClear = false;
        this.renderer.autoClearColor = false;
        this.renderer.autoClearDepth = false;
        this.renderer.autoClearStencil = false;

        this.material = new ShaderMaterial({
            uniforms: {
                uScene: {
                    value: null
                },
                uSDF: {
                    value: null
                },
                uSDFMatrix: {
                    value: new Matrix4()
                },
                sdfResolution: {
                    value: this.sdfResolution
                },
                dimensions: {
                    value: new Vector2()
                },
                boxCenter: {
                    value: new Vector3()
                },
                boxSize: {
                    value: new Vector3()
                },
                boxMatrix: {
                    value: new Matrix4()
                },
                iTime: {
                    value: 0
                },
                
                command: {
                    value: COMMANDS.NONE
                },
                replaceIndex: {
                    value: 0
                }
            },
            vertexShader: cloudVertexShader,
            fragmentShader: cloudFragmentShader,
            depthTest: false,
        });
        
        this.mesh = new Mesh(new PlaneBufferGeometry(2, 2), this.material);
        this.scene = new Scene();
        this.scene.add(this.mesh);
        
        this.renderTargetRead = new WebGLRenderTarget(this.width, this.height, {
            format:  RedFormat,
            type: FloatType,
            minFilter: LinearFilter,
            magFilter: LinearFilter,
            stencilBuffer: false,
            depthBuffer: false
        });
        this.renderTargetWrite = this.renderTargetRead.clone();

        this.outputBufferTexture = new DataTexture(
            new Float32Array(this.width * this.height),
            this.width, this.height
        )
        this.outputBufferTexture.format = RedFormat;
        this.outputBufferTexture.type = FloatType;
        this.outputBufferTexture.minFilter = LinearFilter;
        this.outputBufferTexture.magFilter = LinearFilter;
        this.outputBufferTexture.unpackAlignment = 1;
        // this.outputBufferTexture.internalFormat = "R16F"; // Mobile support
    }

    private CreateCanvas(): HTMLCanvasElement {
        const canvas: HTMLCanvasElement = document.createElement("canvas");
        const debugElement = document.querySelector("#debug");
        const container = document.createElement("div");
        const title = document.createElement("h3");
        title.textContent = "SDFSceneShader";
        container.appendChild(title);
        container.appendChild(canvas);
        debugElement.appendChild(container);

        return canvas;
    }

    private swap() {
        const temp = this.renderTargetRead;
        this.renderTargetRead = this.renderTargetWrite;
        this.renderTargetWrite = temp;
    }

    private render() {
        // For output
        this.renderer.setRenderTarget(this.renderTargetWrite);
        this.renderer.render(this.scene, this.camera);

        // For debugging
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.scene, this.camera);

        const buffer = new Float32Array(this.width * this.height);
        // const gl = this.renderer.getContext() as WebGL2RenderingContext;
        // gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
        this.renderer.readRenderTargetPixels(this.renderTargetWrite, 0, 0, this.width, this.height, buffer);
        this.outputBufferTexture = new DataTexture(
            buffer,
            this.width, this.height
        )
        this.outputBufferTexture.format = RedFormat;
        this.outputBufferTexture.type = FloatType;
        this.outputBufferTexture.minFilter = LinearFilter;
        this.outputBufferTexture.magFilter = LinearFilter;
        this.outputBufferTexture.unpackAlignment = 1;
        this.outputBufferTexture.needsUpdate = true;

        this.swap();

        this.dispatchEvent({ type: "updated" });
    }

    public GetSDFCount(): number {
        return this.height / this.sdfResolution;
    }

    public Decrease () {
        if (this.height - this.sdfResolution < 0) {
            console.warn("Scene texture cant be smaller than 0");
            return;
        }
        this.height -= this.sdfResolution;

        this.material.uniforms.uScene.value = this.outputBufferTexture;
        this.material.uniforms.command.value = COMMANDS.DECREASE;

        this.renderTargetRead.setSize(this.width, this.height);
        this.renderTargetWrite.setSize(this.width, this.height);

        this.render();
    }

    // TODO: Higher max cap
    public Increase () {
        this.height += this.sdfResolution;
        
        this.renderer.setSize(this.width, this.height);
        
        this.material.uniforms.uScene.value = this.outputBufferTexture;
        this.material.uniforms.command.value = COMMANDS.INCREASE;

        this.renderTargetRead.setSize(this.width, this.height);
        this.renderTargetWrite.setSize(this.width, this.height);

        this.render();
    }

    public Replace(index: number, sdf: Data3DTexture) {
        if (this.height < (index + 1) * this.sdfResolution) {
            console.warn(`Cant replace at index ${index}, texture size is ${this.height}.`);
            return;
        }

        this.material.uniforms.uScene.value = this.outputBufferTexture;
        this.material.uniforms.uSDF.value = sdf;
        this.material.uniforms.replaceIndex.value = index;
        this.material.uniforms.command.value = COMMANDS.REPLACE;

        this.render();
    }

    public Insert(sdf: Data3DTexture) {
        this.Increase();
        const sdfCount = this.GetSDFCount();
        this.Replace(sdfCount - 1, sdf);
    }

    public GetScene(): DataTexture {
        return this.outputBufferTexture;
    }

    public update(scene: Scene) {
        scene.traverse(object => {
            if (object.userData.isSDF) {
                const sdfMesh = object as SDFMesh;

                if (!this.sceneMap.has(sdfMesh.uuid)) {
                    this.Insert(sdfMesh.sdf);
                    // sdfMesh.material.SetSDFIndex(this.GetSDFCount()-1);
                    this.sceneMap.set(sdfMesh.uuid, sdfMesh);
                }
            }
        })
    }

    // public GetScene3D(): Data3DTexture {
    //     const sdfCount = this.GetSDFCount();

    //     // TODO: Dont create this here
    //     const outputBufferTexture3D = new Data3DTexture(
    //         this.outputBufferTexture.image.data,
    //         this.sdfResolution, this.sdfResolution, this.sdfResolution * sdfCount
    //     )
    //     outputBufferTexture3D.format = RedFormat;
    //     outputBufferTexture3D.type = FloatType;
    //     outputBufferTexture3D.internalFormat = "R16F";
    //     outputBufferTexture3D.minFilter = LinearFilter;
    //     outputBufferTexture3D.magFilter = LinearFilter;
    //     outputBufferTexture3D.unpackAlignment = 1;
    //     outputBufferTexture3D.needsUpdate = true;

    //     return outputBufferTexture3D;
    // }
}