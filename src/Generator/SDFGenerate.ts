import { BufferGeometry, DataTexture, Data3DTexture, FloatType, LinearFilter, Mesh, OrthographicCamera, PlaneBufferGeometry, RedFormat, RGBAFormat, Scene, ShaderMaterial, UnsignedByteType, Vector3, WebGLRenderer, WebGLRenderTarget, HalfFloatType, MeshBasicMaterial, SphereGeometry } from "three";

import cloudVertexShader from './shaders/sdfgen.vert.glsl';
import cloudFragmentShader from './shaders/sdfgen.frag.glsl';

export interface GeometryInfo {
    scale: number;
    center: Vector3;
};

export class SDFGenerate {
    
    private static CreateCanvas(): HTMLCanvasElement {
        const canvas: HTMLCanvasElement = document.createElement("canvas");
        const debugElement = document.querySelector("#debug");
        const container = document.createElement("div");
        const title = document.createElement("h3");
        title.textContent = "SDFGenerate";
        container.appendChild(title);
        container.appendChild(canvas);
        debugElement.appendChild(container);

        return canvas;
    }

    public static GetGeometryInfo(geometry: BufferGeometry): GeometryInfo {
        geometry.computeBoundingBox();
        const bboxSize = new Vector3();
        const bboxCenter = new Vector3();
        geometry.boundingBox.getSize(bboxSize);
        geometry.boundingBox.getCenter(bboxCenter);
        
        // Scale geometry to fit in a 1,1,1 box
        const extents = bboxSize.clone().multiplyScalar(0.5);
        
        let scale = 1.0;
        const biggestExtent = Math.max(extents.x, extents.y, extents.z);
        if (biggestExtent > 0.4) {
            scale = 0.4 / biggestExtent; // 0.5 = sdfBboxLength
        }

        console.log("scale", scale)

        return {
            scale: scale,
            center: bboxCenter
        };
    }

    private static GetInputTextureV2(geometry: BufferGeometry): DataTexture {
        // 1800 * 1800 = 3240000 / 3 = 1080000
        // Allows for 1080000 vertices max
        const TEXTURE_SIZE = 1800;
        if (geometry.index !== null) {
            geometry = geometry.toNonIndexed();
        }
        const positions = geometry.getAttribute("position").array;
        const triangles = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE);

        for (let i = 0, j=0; i < positions.length; i+=3, j+=4) {
            triangles[j+0] = positions[i+0];
            triangles[j+1] = positions[i+1];
            triangles[j+2] = positions[i+2];
            triangles[j+3] = 0;
        }

        const texture = new DataTexture(
            triangles,
            TEXTURE_SIZE / 4,
            TEXTURE_SIZE / 4
        );
        texture.format = RGBAFormat;
        texture.type = FloatType;
        texture.minFilter = LinearFilter;
        texture.magFilter = LinearFilter;
        texture.unpackAlignment = 1;
        texture.needsUpdate = true;

        return texture;
    }

    private static GetOutputTexture(renderer: WebGLRenderer, renderTarget: WebGLRenderTarget, sdfResolution: number): Data3DTexture {
        const width = sdfResolution * sdfResolution;
        const height = sdfResolution;

        const buffer = new Float32Array(width * height);
        renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, buffer);
        const texture = new Data3DTexture(
            buffer,
            sdfResolution, sdfResolution, sdfResolution
        )
        texture.format = RedFormat;
        texture.type = FloatType;
        texture.internalFormat = "R16F"; // Mobile support
        texture.minFilter = LinearFilter;
        texture.magFilter = LinearFilter;
        texture.unpackAlignment = 1;
        texture.needsUpdate = true;
        
        return texture;
    }

    public static Generate(geometry: BufferGeometry, sdfResolution: number): Data3DTexture {
        const width = sdfResolution * sdfResolution;
        const height = sdfResolution;

        geometry = geometry.clone();
        if (geometry.index !== null) {
            geometry = geometry.toNonIndexed();
        }
        const canvas = this.CreateCanvas();

        const camera = new OrthographicCamera(-1, 1, 1, -1, -1, 1);
        let renderer = new WebGLRenderer({canvas: canvas, alpha: true});
        renderer.autoClear = false;
        renderer.setSize(width, height);
        renderer.setPixelRatio(1);

        geometry.computeBoundingBox();

        const geometryInfo = this.GetGeometryInfo(geometry);
        const centerInv = new Vector3().copy(geometryInfo.center).negate();
        geometry = geometry.translate(centerInv.x, centerInv.y, centerInv.z);
        geometry = geometry.scale(geometryInfo.scale, geometryInfo.scale, geometryInfo.scale);


        const size = new Vector3();
        geometry.boundingBox.getSize(size);

        const inputTexture = this.GetInputTextureV2(geometry);
        const triangleCount = geometry.getAttribute("position").array.length / 9;
        const lm = new ShaderMaterial({
            uniforms: {
                iResolution: {
                    value: new Vector3(width, height, 1.0)
                },
                uTriangles: {
                    value: inputTexture
                },
                triangleBufferSize: {
                    value: triangleCount
                },
                resolution: {
                    value: sdfResolution
                },
                localExtents: {
                    value: size
                }
            },
            vertexShader: cloudVertexShader,
            fragmentShader: cloudFragmentShader,
        });
        
        const l = new Mesh(new PlaneBufferGeometry(2, 2), lm);
        const sdfScene = new Scene();
        sdfScene.add(l);
        
        const renderTarget = new WebGLRenderTarget(width, height, {
            format:  RedFormat,
            type: FloatType,
            minFilter: LinearFilter,
            magFilter: LinearFilter,
        });

        // For output
        renderer.setRenderTarget(renderTarget);
        renderer.render(sdfScene, camera);

        // For debugging
        renderer.setRenderTarget(null);
        renderer.render(sdfScene, camera);

        const texture = this.GetOutputTexture(renderer, renderTarget, sdfResolution);

        renderer.dispose();
        renderer.forceContextLoss();
        canvas.remove();
        
        return texture;
    }

    public static SaveAsPNG(sdf: Data3DTexture, name: string) {
        const buf = new Uint8ClampedArray(sdf.image.data.buffer);

        const canvas = document.createElement("canvas");
        canvas.width = sdf.image.width * sdf.image.depth;
        canvas.height = sdf.image.height;
        const ctx = canvas.getContext("2d");
        
        const imgData = ctx.getImageData(0,0, canvas.width, canvas.height);
        imgData.data.set(buf);

        ctx.putImageData(imgData, 0, 0);

        canvas.toBlob((blob) => {
            var link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            var fileName = `${name}.png`;
            link.download = fileName;
            link.click();
        }, "image/png", 1)
    }

    public static LoadFromPNG(url: string): Promise<Data3DTexture> {
        return new Promise<Data3DTexture>((resolve, reject) => {
            const img = new Image();
            img.src = url;
            img.onload = start;
            
            function start() {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img,0,0);
    
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
                const buffer = new Float32Array(imageData.data.buffer);

                const resolution = canvas.height;
                const texture = new Data3DTexture(buffer, resolution, resolution, resolution);
                texture.format = RedFormat;
                texture.type = FloatType;
                texture.internalFormat = "R16F";
                texture.minFilter = LinearFilter;
                texture.magFilter = LinearFilter;
                texture.unpackAlignment = 1;
                texture.needsUpdate = true;

                resolve(texture);
            }
        })
    }
}