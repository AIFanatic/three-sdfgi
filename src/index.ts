import { BufferGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GUI } from '../node_modules/three/examples/jsm/libs/lil-gui.module.min';

import { EffectComposer } from '../node_modules/three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from '../node_modules/three/examples/jsm/postprocessing/RenderPass';

import { STLLoader } from "../node_modules/three/examples/jsm/loaders/STLLoader";
import { GLTFLoader } from "../node_modules/three/examples/jsm/loaders/GLTFLoader";

import Stats from "three/examples/jsm/libs/stats.module.js";
import { SDFSceneShader } from "./SDFSceneShader";
import { SDFMesh } from "./SDFMesh";
import { SDFSceneMatrices } from "./SDFSceneMatrices";
import { SDFSceneExtents } from "./SDFSceneExtents";
import { DebugMode, SDFDiffusePass } from "./SDFDiffusePass";
import { SDFGenerate } from "./Generator/SDFGenerate";
import { SDFDownloader } from "./Generator/SDFDownloader";


const canvas = document.querySelector("#canvasContainer");
const renderer = new WebGLRenderer({canvas: canvas});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const scene = new Scene();
const camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
camera.position.z = 2;
const controls = new OrbitControls(camera, renderer.domElement);

const stats = Stats()
document.body.appendChild(stats.dom)

const MESH_SDF_RESOLUTION = 64;
const SCENE_SDF_RESOLUTION = 64;

const MODEL_DIRECTORY = "cornell_box_08";
const GLTF_FILENAME = "cornell_box_08.gltf";
// const MODEL_DIRECTORY = "sponza";
// const GLTF_FILENAME = "sponza.gltf";
const LOAD_FROM_PNG = true;

function LoadSTL(url: string): Promise<BufferGeometry> {
    const loader = new STLLoader();

    return new Promise((resolve, reject) => {
        return loader.load(url, geometry => {
            resolve(geometry);
        });
    })
}

function LoadGLTF(url: string): Promise<Mesh[]> {
    const loader = new GLTFLoader();

    return new Promise((resolve, reject) => {
        return loader.load(url, gltf => {
            let meshes = [];
            gltf.scene.traverse(mesh => {
                if (mesh.isMesh) {
                    meshes.push(mesh);
                }
            });
            resolve(meshes);
            return;
        });
    })
}

async function Load() {
    // const cubeHollowGeometry = await LoadSTL("./models/cubehollow_04_center.stl");

    const sdfScene = new SDFSceneShader(renderer, SCENE_SDF_RESOLUTION);
    const sdfSceneMatrices = new SDFSceneMatrices();
    const sdfSceneExtents = new SDFSceneExtents();

    const composer = new EffectComposer( renderer );
    
    
    const sdfDiffusePass = new SDFDiffusePass(camera, SCENE_SDF_RESOLUTION);
    composer.addPass(sdfDiffusePass);
    const renderPass = new RenderPass( scene, camera );
    composer.addPass( renderPass );

    const sponzaMaterial = new MeshBasicMaterial({color: 0xff0000});
    const sponzaMeshes = await LoadGLTF(`./models/${MODEL_DIRECTORY}/${GLTF_FILENAME}`);

    // Use this to download sdf pngs
    const sdfDownloader = new SDFDownloader(MESH_SDF_RESOLUTION, sponzaMeshes)

    for (let i = 0; i < sponzaMeshes.length; i++) {
        // Sponza Mesh_0001_1 SDF is wrong
        if (sponzaMeshes[i].name == "Mesh_0001_1")continue;
        console.log(sponzaMeshes[i].name);

        const sponzaMesh = sponzaMeshes[i];
        const sponzaGeometry = sponzaMesh.geometry;
        
        const geometryInfo = SDFGenerate.GetGeometryInfo(sponzaGeometry);
        let sdfTexture = null;
        if (LOAD_FROM_PNG) sdfTexture = await SDFGenerate.LoadFromPNG(`./models/${MODEL_DIRECTORY}/sdfs/${sponzaMesh.name}.png`);
        else sdfTexture = SDFGenerate.Generate(sponzaGeometry, MESH_SDF_RESOLUTION);
        
        const sponzaMeshLoaded = new SDFMesh(sponzaGeometry, sponzaMaterial, sdfTexture);
        scene.add( sponzaMeshLoaded );
        
        sponzaMeshLoaded.name = sponzaMesh.name;
        sponzaMeshLoaded.position.add(sponzaMesh.position);
        sponzaMeshLoaded.rotation.copy(sponzaMesh.rotation);
        sponzaMeshLoaded.scale.copy(sponzaMesh.scale.divideScalar(geometryInfo.scale));
        
        sdfDiffusePass.SetSDFTextures2D(sdfScene.GetScene());
        console.log(`Loaded ${sponzaMesh.name}`)
    }

    function animate() {
        requestAnimationFrame(animate);

        sdfScene.update(scene);
        sdfSceneMatrices.update(scene);
        sdfSceneExtents.update(scene);
        
        sdfDiffusePass.SetSDFTextures2D(sdfScene.GetScene());
        sdfDiffusePass.SetSDFMatrices(sdfSceneMatrices.GetSDFMatricesTexture());
        sdfDiffusePass.SetSDFExtents(sdfSceneExtents.GetSDFExtentsTexture());

        // TODO: Better way of doing this, doesn't need to be passed every frame
        if (sdfDiffusePass.renderTarget) {
            scene.traverse(object => {
                if (object.userData.isSDF) {
                    const sdfMesh = object as SDFMesh;
                    sdfMesh.material.SetDiffuse(sdfDiffusePass.renderTarget.texture);
                }
            })
        }

        composer.render();

        stats.update();
    }

    animate();

    window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    


    // GUI
    const guiParams = {
        lightPosition: new Vector3(0, 5, 6),
        lightIntensity: 1.0,
        debug: "NONE"
    }

    function onSDFParameterChanged() {
        sdfDiffusePass.SetLightPosition(guiParams.lightPosition);
        sdfDiffusePass.SetLightIntensity(guiParams.lightIntensity);
    }

    function onDebugChanged() {
        if (guiParams.debug == "NONE") {
            sdfDiffusePass.SetDebugMode(DebugMode.NONE);
            composer.addPass(renderPass);
        }
        else {
            let mode: DebugMode = DebugMode.NONE;
            
            if (guiParams.debug == "SDF") mode = DebugMode.SDF;
            else if (guiParams.debug == "HITCOUNT") mode = DebugMode.HITCOUNT;
            else if (guiParams.debug == "NORMAL") mode = DebugMode.NORMAL;
            else if (guiParams.debug == "LIGHT") mode = DebugMode.LIGHT;
            
            sdfDiffusePass.SetDebugMode(mode);
            composer.removePass(renderPass);
        }
    }

    const gui = new GUI();
    gui.close();

    gui.add(guiParams, 'debug', ['NONE', 'SDF', "HITCOUNT", "NORMAL", "LIGHT"]).onChange(onDebugChanged)

    const SDFLight = gui.addFolder('Light');
    SDFLight.add(guiParams, 'lightIntensity', 0, 5, 0.1).onChange(onSDFParameterChanged);
    SDFLight.open();

    const SDFLightPosition = SDFLight.addFolder('Position')
    SDFLightPosition.add(guiParams.lightPosition, 'x', -10, 10, 0.1).onChange(onSDFParameterChanged);
    SDFLightPosition.add(guiParams.lightPosition, 'y', -10, 10, 0.1).onChange(onSDFParameterChanged);
    SDFLightPosition.add(guiParams.lightPosition, 'z', -10, 10, 0.1).onChange(onSDFParameterChanged);
    SDFLightPosition.open();

    onSDFParameterChanged();
}
Load();