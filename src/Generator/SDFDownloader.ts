import { Mesh } from "three";
import { SDFGenerate } from "./SDFGenerate";

export class SDFDownloader {
    private sdfResolution: number;

    constructor(sdfResolution: number, meshes: Mesh[]) {
        this.sdfResolution = sdfResolution;

        const debugContainer = document.querySelector("#debug");

        const container = document.createElement("div");
        const title = document.createElement("h3");
        title.textContent = "SDFDownloader";
        container.appendChild(title);

        for (let mesh of meshes) {
            const meshContainer = document.createElement("div");
            const meshButton = document.createElement("button");
            meshButton.textContent = `Generate SDF for ${mesh.name}`;
            meshButton.style.width = "100%";
            meshButton.addEventListener("click", () => {this.onMeshButtonClicked(mesh)})

            meshContainer.appendChild(meshButton);
            container.appendChild(meshContainer);
        }

        debugContainer.appendChild(container);
    }

    private onMeshButtonClicked(mesh: Mesh) {
        const sdf = SDFGenerate.Generate(mesh.geometry, this.sdfResolution);
        SDFGenerate.SaveAsPNG(sdf, mesh.name);
    }
}