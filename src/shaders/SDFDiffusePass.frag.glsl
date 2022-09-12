struct Ray {
    vec3 origin;
    vec3 dir;
};

in Ray vRay;

uniform float sceneResolution;
uniform highp sampler2D sdfTextures2D;
uniform sampler2D sdfMatrices;
uniform sampler2D sdfExtents;
uniform float sdfCount;

uniform vec3 lightPosition;
uniform float lightIntensity;

uniform int debugMode;

#define MAX_STEPS 100
#define MAX_DIST 100.
#define SURF_DIST 0.01



struct HitResult{
    bool hit;
    float t;	//hit = origin + direction * t
};

bool isPointInAABB(vec3 p, vec3 aabbMin, vec3 aabbMax){
    return 
        p.x >= aabbMin.x &&
        p.y >= aabbMin.y &&
        p.z >= aabbMin.z &&
        p.x <= aabbMax.x &&
        p.y <= aabbMax.y &&
        p.z <= aabbMax.z;
}

HitResult intersectAABB(vec3 rayOrigin, vec3 rayDir, vec3 boxMin, vec3 boxMax) {
    HitResult result;
    result.hit = false;
    result.t = 100000.0;	//will be replaced by min

    vec3 tMin = (boxMin - rayOrigin) / rayDir;
    vec3 tMax = (boxMax - rayOrigin) / rayDir;
    vec3 t1 = min(tMin, tMax);
    vec3 t2 = max(tMin, tMax);
    float tNear = max(max(t1.x, t1.y), t1.z);
    float tFar = min(min(t2.x, t2.y), t2.z);
    // return vec2(tNear, tFar);
    result.hit = tNear <= tFar;
    if (result.hit) {
        result.t = tNear;
    }
    return result;
}

HitResult rayAABBIntersection(vec3 rayOrigin, vec3 rayDirection, vec3 aabbMin, vec3 aabbMax){

    HitResult result;
    result.hit = false;
    result.t = 100000.0;	//will be replaced by min

    //search for bounding box intersection
    float intersection =  rayOrigin.x < 0.0 ? aabbMin.x : aabbMax.x;

    float tx = (intersection - rayOrigin.x) / rayDirection.x;
    vec3 planeIntersection = rayOrigin + tx * rayDirection;
    if( tx > 0.0 &&
        planeIntersection.y >= aabbMin.y &&
        planeIntersection.y <= aabbMax.y &&
        planeIntersection.z >= aabbMin.z &&
        planeIntersection.z <= aabbMax.z){
        result.t = min(result.t, tx);
        result.hit = true;
    }

    intersection =  rayOrigin.y < 0.0 ? aabbMin.y : aabbMax.y;
    float ty = (intersection - rayOrigin.y) / rayDirection.y;
    planeIntersection = rayOrigin + ty * rayDirection;
    if( ty > 0.0 && 
        planeIntersection.x >= aabbMin.x &&
        planeIntersection.x <= aabbMax.x &&
        planeIntersection.z >= aabbMin.z &&
        planeIntersection.z <= aabbMax.z){
        result.t = min(result.t, ty);
        result.hit = true;
    }

    intersection =  rayOrigin.z < 0.0 ? aabbMin.z : aabbMax.z;
    float tz = (intersection - rayOrigin.z) / rayDirection.z;
    planeIntersection = rayOrigin + tz * rayDirection;
    if( tz > 0.0 &&
        planeIntersection.x >= aabbMin.x &&
        planeIntersection.x <= aabbMax.x &&
        planeIntersection.y >= aabbMin.y &&
        planeIntersection.y <= aabbMax.y){
        result.t = min(result.t, tz);
        result.hit = true;
    }
    return result;
}

mat4 GetMatrixFromTexture(sampler2D tex, int index) {
    mat4 matrix;
    matrix[0] = texelFetch(tex, ivec2(0, index), 0);
    matrix[1] = texelFetch(tex, ivec2(1, index), 0);
    matrix[2] = texelFetch(tex, ivec2(2, index), 0);
    matrix[3] = texelFetch(tex, ivec2(3, index), 0);

    return matrix;
}

vec3 GetExtentsFromTexture(sampler2D tex, int index) {
    vec3 extents = texelFetch(tex, ivec2(0, index), 0).rgb;
    return extents;
}

// From: https://www.shadertoy.com/view/wds3zr
// Lookup in tiled 3D texture atlas
// texture is grid x grid array of tiles
vec4 TileLookup(sampler2D Texture, vec3 xyz)  {
    vec2 Tiles = vec2(sceneResolution, sdfCount);
    // adjust for tile border
    vec2 pixPerTile = vec2(textureSize(Texture,0)) / Tiles;
    xyz.xy = fract(xyz.xy);
    xyz.xy = (xyz.xy * pixPerTile + 0.5) / (pixPerTile + 1.);

    // xy scaled down to the size the slice will be in the texture
	vec2 tilexy = xyz.xy / Tiles;
    
    // z scaled up to slice number (with possible fraction between slices)
    float numtiles = Tiles.x * Tiles.y;
    float tilez0 = fract(xyz.z) * numtiles;
    float tilez1 = fract(xyz.z + 1./numtiles) * numtiles;

    // look up slice below current z
    float z0 = floor(tilez0);
    vec2 uv0 = tilexy + vec2(fract(z0 / Tiles.x), floor(z0 / Tiles.x) / Tiles.y);
    vec4 tx0 = texture(Texture, uv0); 

    // look up slice above current z
    float z1 = floor(tilez1);
    vec2 uv1 = tilexy + vec2(fract(z1 / Tiles.x), floor(z1 / Tiles.x) / Tiles.y);
    vec4 tx1 = texture(Texture, uv1);
    
    // blend slices
    return mix(tx0, tx1, fract(tilez0));
}

float QueryTexture(sampler2D tex, vec3 p) {
    float x = mod(p.x / sceneResolution, 1.0 / sceneResolution);
    float y = p.y;
    float z = floor(p.z * sceneResolution) / sceneResolution;
    
    vec2 pos = vec2(x + z, y);

    vec4 color = TileLookup(tex, p);
    float pixel = color.r;


    // float pixel2 = texture(tex, pos).r;
    // float pixel3 = (pixel + pixel2) / 2.0;

    return pixel;
}

// float QuerySDFTextureArray(vec3 p, float index) {
//     vec3 pLocal = p.yzx; // Swizzle p to match true orientation
//     pLocal.z -= 0.5 * sdfCount;
//     pLocal.z += 0.5; // Change z to the beggining of the texture
//     pLocal.z += index; // Move z to the corrent texture position
//     pLocal.z /= sdfCount; // Divide z by the number of sdfs on the texture

//     float sdfDist = texture(sdfTextures, pLocal + 0.5).r;
//     return sdfDist;
// }

float QuerySDFTexture2DArray(vec3 p, float index) {
    vec3 pLocal = p; // Swizzle p to match true orientation
    pLocal.z -= 0.5 * sdfCount;
    pLocal.z += 0.5; // Change z to the beggining of the texture
    pLocal.z += index; // Move z to the corrent texture position
    pLocal.z /= sdfCount; // Divide z by the number of sdfs on the texture

    float sdfDist = QueryTexture(sdfTextures2D, pLocal + 0.5);
    return sdfDist;
}

vec3 GetNormal(vec3 p, float index) {
	float d = QuerySDFTexture2DArray(p, index);
    vec2 e = vec2(.01, 0);
    
    vec3 n = d - vec3(
        QuerySDFTexture2DArray(p-e.xyy, index),
        QuerySDFTexture2DArray(p-e.yxy, index),
        QuerySDFTexture2DArray(p-e.yyx, index));
    
    return normalize(n);
}

vec3 calcNormal( in vec3 pos, float index ) {
    vec2 e = vec2(1.0,-1.0)*0.5773*0.0005;
    return normalize( e.xyy*QuerySDFTexture2DArray( pos + e.xyy, index ) + 
					  e.yyx*QuerySDFTexture2DArray( pos + e.yyx, index ) + 
					  e.yxy*QuerySDFTexture2DArray( pos + e.yxy, index ) + 
					  e.xxx*QuerySDFTexture2DArray( pos + e.xxx, index ) );
}

vec3 normalFromSDF(vec3 uv, vec3 extends, float index){
    float extendsMax = max(extends.x, max(extends.y, extends.z));
    vec3 extendsNormalized = extends.xyz / extendsMax;
    vec3 epsilon = vec3(0.15) / vec3(64) / extendsNormalized;	//voxels are anisotropic so epsilon must be scaled per axis
    return normalize(vec3(
        QuerySDFTexture2DArray(uv + vec3(epsilon.x, 0, 0), index) - QuerySDFTexture2DArray(uv - vec3(epsilon.x, 0, 0), index),
        QuerySDFTexture2DArray(uv + vec3(0, epsilon.y, 0), index) - QuerySDFTexture2DArray(uv - vec3(0, epsilon.y, 0), index),
        QuerySDFTexture2DArray(uv + vec3(0, 0, epsilon.z), index) - QuerySDFTexture2DArray(uv - vec3(0, 0, epsilon.z), index)
    ));
}

vec3 localSamplePositionToUV(vec3 localPosition, vec3 AABBExtends){
    return localPosition / AABBExtends + 0.5;
}

struct RayResult {
    float dist;
    bool hit;
    vec3 normal;
    int hitCount;
};

void RayMarchResult(vec3 ro, vec3 rd, int index, inout RayResult result) {
    mat4 sdfMatrix = GetMatrixFromTexture(sdfMatrices, index);
    vec3 localExtents = GetExtentsFromTexture(sdfExtents, index);
    vec3 sdfMaxLocal = localExtents * 0.5;
    vec3 sdfMinLocal = -sdfMaxLocal;

    vec3 rayStartLocal = (sdfMatrix * vec4(ro, 1.0)).xyz;
    vec3 rayEndLocal   = (sdfMatrix * vec4(ro + rd, 1)).xyz;

    vec3 rayDirection = rayEndLocal - rayStartLocal;
    rayDirection /= length(rayDirection);

    vec3 p = rayStartLocal;

    float hitDistanceLocal = 0.0;


    if (!isPointInAABB(p, sdfMinLocal, sdfMaxLocal)) {
        HitResult aabbHit = rayAABBIntersection(p, rayDirection, sdfMinLocal, sdfMaxLocal);

        if(!aabbHit.hit) {
            return;
        }
        //move sample point to intersection
        float distanceToAABB = aabbHit.t;
        p += rayDirection * distanceToAABB;
        hitDistanceLocal = distanceToAABB;
    }

    float localToGlobalScale = 1.0 / length(sdfMatrix[0].xyz);
    float distanceThreshold = length(localExtents / 64.0) * 0.25;


    //skip object if AABB intersection is further away than current closest hit
    if(localToGlobalScale * hitDistanceLocal > result.dist) {
        return;
    }

    vec3 localExtendsHalf = localExtents * 0.5;
    localExtendsHalf += 0.05; //bias

    for(int i=0; i<MAX_STEPS; i++) {
        if (p.x > localExtendsHalf.x || p.y > localExtendsHalf.y || p.z > localExtendsHalf.z ||
            p.x < -localExtendsHalf.x || p.y < -localExtendsHalf.y || p.z < -localExtendsHalf.z) {
                break;
            }

        float sdfDist = QuerySDFTexture2DArray(p, float(index));

        // if (result.dist > MAX_DIST) break;

        if (sdfDist < distanceThreshold) {
            result.hit = true;
            
            float distanceGlobal = hitDistanceLocal * localToGlobalScale;
            if(distanceGlobal < result.dist) {
                result.dist = hitDistanceLocal * localToGlobalScale;
                result.hitCount = i;

                result.normal = calcNormal(p, float(index));
                // Remove translation so we have a rotation matrix for normal calculation
                mat4 rMatrix = sdfMatrix;
                rMatrix[3] = vec4(0, 0, 0, 1);
                result.normal = (inverse(rMatrix) * vec4(result.normal / localToGlobalScale, 1.0)).xyz;
            }
            break;
        };

        p += rayDirection * abs(sdfDist);
        hitDistanceLocal += abs(sdfDist);
    }
    
    return;
}

// TODO: 
// [x] Distance
// [x] Correct normals
// [x] Lighting
// [x] Correct position, scale, rotation
// [x?] Correct position, scale, rotation (bigger than box of size 1)
// [x] Fix inside mesh bugs
// [x] Fix inside looking outside bugs

void main() {
    vec3 ro = vRay.origin;
    vec3 rd = normalize(vRay.dir);

    // perspectiveCamera(vUv, cameraPosition, cameraDirection, cameraFov, cameraAspect, ro, rd);

    vec3 color = vec3(0.0, 0.0, 0.0);
    
    RayResult closestHit;
    closestHit.dist = 1000000.0;
    for (int i = 0; i < int(sdfCount); i++) {
        RayMarchResult(ro, rd, i, closestHit);
    }

    gl_FragColor = vec4(color, 1.0);

    if (closestHit.hit) {
        vec3 p = ro + rd * closestHit.dist;
        vec3 l = normalize(lightPosition-p);
        vec3 n = closestHit.normal;
        
        float dif = clamp(dot(n, l), 0., 1.);
        dif *= lightIntensity;


        vec3 lro = p + n * SURF_DIST * 2.0;
        vec3 lrd = l;
        RayResult lightClosestHit;
        lightClosestHit.dist = 1000000.0;
        for (int i = 0; i < int(sdfCount); i++) {
            RayMarchResult(lro, lrd, i, lightClosestHit);
        }
        float d = lightClosestHit.dist;
        if(d<length(lightPosition-p)) dif *= .1;


        if (debugMode == 1) {
            color = vec3(closestHit.dist / 6.0);
        }
        else if (debugMode == 2) {
            color = vec3(float(closestHit.hitCount) / float(MAX_STEPS), 0.0, 0.0);
        }
        else if (debugMode == 3) {
            color = vec3(closestHit.normal);
        }
        else {
            color = vec3(dif);
        }

        gl_FragColor = vec4(color, 1.0);
    }
}