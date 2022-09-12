# THREE.JS SDFGI
[Live demo](https://aifanatic.github.io/three-sdfgi/dist/index.html)
<p align=center>
<img src="./screenshots/showcase.gif">
</p>

*Note: This project is not finished and the code is not particularly clean or performant.*

## Description
An attempt at implementing global illumination using signed distance fields in THREE.js.
<br>
While researching this topic I could either find a lot of examples with code using primitives only or no code at all that use meshes, with the exception of huge codebases like UE and Godot.
<br>
Therefore, the goal is to share some code that is semi functional for others to use with as many references as possible to SDF mesh articles/codebases.
<br>

### What works
- SDF generation on the GPU with support for meshes with holes.
- Global illumination and shadows.

### What needs to be explored further
- Better SDF generation (sponza has some issues).
- Efficient SDF ray marching, by combining all the SDF's into a scene SDF.
<br>
This was explored but it has several caveats:
-  - Either the scene is static, or performance of combining several SDF's in real time becomes a problem, especially using WebGL only.
-  - SDF resolution becomes a problem due to the cubic nature of SDF's.
- Shadows using the depth buffer and trace against the SDF's.

## References
[Gaukler/PlainRenderer](https://github.com/Gaukler/PlainRenderer) A lot of the code is based on this project, huge thanks for making it public and MIT.
<br>
[Dynamic Occlusion with Signed Distance Fields](https://advances.realtimerendering.com/s2015/DynamicOcclusionWithSignedDistanceFields.pdf)
<br>
[Lumen Technical Details](https://docs.unrealengine.com/5.0/en-US/lumen-technical-details-in-unreal-engine/)
<br>
[Upcoming Global Illumination improvements in Ogre-Next](https://www.ogre3d.org/2021/10/25/upcoming-global-illumination-improvements-in-ogre-next)
<br>
[GPU-based clay simulation and
ray-tracing tech in Claybook](https://ubm-twvideo01.s3.amazonaws.com/o1/vault/gdc2018/presentations/Aaltonen_Sebastian_GPU_Based_Clay.pdf)
<br>
[Godot: Addition of SDFGI](https://github.com/godotengine/godot/pull/39827)
<br>
[Kosmonaut Blog](https://kosmonautblog.wordpress.com/2017/05/01/signed-distance-field-rendering-journey-pt-1/)
<br>
[SIGNED DISTANCE FIELDS IN UNITY](https://colourmath.com/2018/development/signed-distance-fields-in-unity/)
<br>
[[TUT] RayMarching for Dummies!](https://www.shadertoy.com/view/XlGBW3)
<br>
[Inigo Quilez Website](https://iquilezles.org/)