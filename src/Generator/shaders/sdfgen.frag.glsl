precision highp float;

uniform int resolution;
uniform sampler2D uTriangles;
uniform int triangleBufferSize;

uniform vec3 localExtents;

struct Triangle {
	vec3 a, b, c;
};

// // TODO: Simplify by using RGBA
// vec3[3] getTriangle(int index) {
// 	int TEXTURE_SIZE = 1800; // 1800;
// 	int TRIANGLES_PER_ROW = TEXTURE_SIZE / 9;
// 	ivec2 p = ivec2((index * 9) % TEXTURE_SIZE, index / TRIANGLES_PER_ROW);

//     float a0 = texelFetch(uTriangles, ivec2(p.x + 0, p.y), 0).r;
//     float a1 = texelFetch(uTriangles, ivec2(p.x + 1, p.y), 0).r;
//     float a2 = texelFetch(uTriangles, ivec2(p.x + 2, p.y), 0).r;

//     float b0 = texelFetch(uTriangles, ivec2(p.x + 3, p.y), 0).r;
//     float b1 = texelFetch(uTriangles, ivec2(p.x + 4, p.y), 0).r;
//     float b2 = texelFetch(uTriangles, ivec2(p.x + 5, p.y), 0).r;

//     float c0 = texelFetch(uTriangles, ivec2(p.x + 6, p.y), 0).r;
//     float c1 = texelFetch(uTriangles, ivec2(p.x + 7, p.y), 0).r;
//     float c2 = texelFetch(uTriangles, ivec2(p.x + 8, p.y), 0).r;

//     vec3 a = vec3(a0, a1, a2);
//     vec3 b = vec3(b0, b1, b2);
//     vec3 c = vec3(c0, c1, c2);

//     return vec3[3](a, b, c);
// }

// // TODO: Simplify by using RGBA
// vec3[3] getTriangle(int index) {
// 	// int TEXTURE_SIZE = 1800; // 1800;
// 	// int TRIANGLES_PER_ROW = TEXTURE_SIZE / 9;
// 	// ivec2 p = ivec2((index * 9) % TEXTURE_SIZE, index / TRIANGLES_PER_ROW);

// 	// index = 0 = 0, 1, 2
// 	// index = 1 = 3, 4, 5

// 	int x = index * 3;
//     vec3 a = texelFetch(uTriangles, ivec2(x+0, 0), 0).rgb;
//     vec3 b = texelFetch(uTriangles, ivec2(x+1, 0), 0).rgb;
//     vec3 c = texelFetch(uTriangles, ivec2(x+2, 0), 0).rgb;

//     return vec3[3](a, b, c);
// }

// TODO: Simplify by using RGBA
vec3[3] getTriangle(int index) {
	int TEXTURE_SIZE = 1800 / 4; // 1800;
	int TRIANGLES_PER_ROW = TEXTURE_SIZE / 3;
	ivec2 p = ivec2((index * 3) % TEXTURE_SIZE, index / TRIANGLES_PER_ROW);

	// index = 0 = 0, 1, 2
	// index = 1 = 3, 4, 5

    vec3 a = texelFetch(uTriangles, ivec2(p.x+0, p.y), 0).rgb;
    vec3 b = texelFetch(uTriangles, ivec2(p.x+1, p.y), 0).rgb;
    vec3 c = texelFetch(uTriangles, ivec2(p.x+2, p.y), 0).rgb;

    return vec3[3](a, b, c);
}

Triangle triangleBuffer(int index) {
    vec3[3] trianglesVertices = getTriangle(index);

    Triangle t;
    t.a = trianglesVertices[0];
    t.b = trianglesVertices[1];
    t.c = trianglesVertices[2];

    return t;
}

vec3 TriangleNormal(Triangle triangle) {
	return normalize(cross(triangle.b - triangle.a, triangle.c - triangle.a));
}

float dot2(vec3 v) {
	return dot(v, v);
}

/* Returns the unsigned distance between the input position and triangle.
Developed by Inigo Quilez. */
float DistanceToTriangle(vec3 p, Triangle triangle) {
    // prepare data    
    vec3 v21 = triangle.b - triangle.a; vec3 p1 = p - triangle.a;
    vec3 v32 = triangle.c - triangle.b; vec3 p2 = p - triangle.b;
    vec3 v13 = triangle.a - triangle.c; vec3 p3 = p - triangle.c;

    vec3 nor = cross( v21, v13 );

    return sqrt( // inside/outside test    
                 (sign(dot(cross(v21,nor),p1)) + 
                  sign(dot(cross(v32,nor),p2)) + 
                  sign(dot(cross(v13,nor),p3))<2.0) 
                  ?
                  // 3 edges    
                  min( min( 
                  dot2(v21*clamp(dot(v21,p1)/dot2(v21),0.0,1.0)-p1), 
                  dot2(v32*clamp(dot(v32,p2)/dot2(v32),0.0,1.0)-p2) ), 
                  dot2(v13*clamp(dot(v13,p3)/dot2(v13),0.0,1.0)-p3) )
                  :
                  // 1 face    
                  dot(nor,p1)*dot(nor,p1)/dot2(nor) );
}

/* Returns the index of the nearest triangle to the input position. */
int NearestTriangleId(vec3 position) {
	int id = -1;
	float prevDist = 10000000.0;
	for (int t = 0; t < int(triangleBufferSize); t++) {
		Triangle triangle = triangleBuffer(t);
		float dist = DistanceToTriangle(position, triangle);
		if (dist < prevDist) {
			prevDist = dist;
			id = t;
		}
	}
	return id;
}

/* Returns whether a ray intersects a triangle. Developed by Möller–Trumbore. */
bool RayIntersectsTriangle(vec3 o, vec3 d, Triangle triangle) {
	const float EPSILON = 0.0000001;

	vec3 e1, e2, h, s, q;
	float a, f, u, v, t;

	e1 = triangle.b - triangle.a;
	e2 = triangle.c - triangle.a;

	h = cross(d, e2);
	a = dot(e1, h);

	if (abs(a) < EPSILON) {
		return false;  // ray is parallel to triangle
	}

	f = 1.0 / a;
	s = o - triangle.a;
	u = f * dot(s, h);

	if (u < -EPSILON || u > 1.0) {
		return false;
	}

	q = cross(s, e1);
	v = f * dot(d, q);

	if (v < EPSILON || u + v > 1.0) {
		return false;
	}

	t = f * dot(e2, q);

	return (t >= 0.0) ? true : false;
}

bool boxContainsPoint(vec3 point, vec3 minExtents, vec3 maxExtents) {
	return point.x < minExtents.x || point.x > maxExtents.x ||
	point.y < minExtents.y || point.y > maxExtents.y ||
	point.z < minExtents.z || point.z > maxExtents.z ? false : true;
}






int RayTriangleIntersectionClosest(vec3 origin, vec3 direction) {
	float closestDistance = 100000000.0;
	int closesTriangleId = -1;

	for (int t = 0; t < int(triangleBufferSize); t++) {
		Triangle triangle = triangleBuffer(t);
		bool intersects = RayIntersectsTriangle(origin, direction, triangle);

		if (intersects) {
			float triangleDistance = DistanceToTriangle(origin, triangle);
			if (triangleDistance < closestDistance) {
				closestDistance = triangleDistance;
				closesTriangleId = t;
			}
		}
	}

	return closesTriangleId;
}



struct RayTriangleIntersectionResult {
    float totalHits;
    float backHits;
};

const float PI = 3.1415;
const float PHI = PI * (3.0 - sqrt(5.0));  // golden angle in radians
const float samples = 225.0;

RayTriangleIntersectionResult RayTriangleSphericalClosest(vec3 origin) {
	RayTriangleIntersectionResult result;
	result.totalHits = 0.0;
	result.backHits = 0.0;

	for (float i = 0.0; i < samples; i++) {
		float y = 1.0 - (i / (samples - 1.0)) * 2.0;  // y goes from 1 to -1
		float radius = sqrt(1.0 - y * y);  // radius at y

		float theta = PHI * i;  // golden angle increment

		float x = cos(theta) * radius;
		float z = sin(theta) * radius;

		vec3 rayDirection = vec3(x, y, z);

		int closestTriangleId = RayTriangleIntersectionClosest(origin, rayDirection);
		if (closestTriangleId != -1) {
			Triangle triangle = triangleBuffer(closestTriangleId);
			vec3 normal = TriangleNormal(triangle);
			bool isBackFace = dot(rayDirection, normal) > 0.0;
		
			result.totalHits++;
			result.backHits += isBackFace ? 1.0 : 0.0;
		}
	}

	return result;
}

void main() {
    int x = int(gl_FragCoord.x) % resolution;
    int y = int(gl_FragCoord.y);
    int z = int(gl_FragCoord.x) / resolution;

	// gl_FragColor = vec4(vec3(float(z), 0.0, 0), 1.0);
	// return;

    vec3 pos = vec3(x, z, y);

	float stepPerCell = 1.0 / float(resolution);

	pos *= stepPerCell;
	pos -= 0.5;
	// pos += stepPerCell / 2.0;

	int nearestTriangle = NearestTriangleId(pos);
	Triangle triangle = triangleBuffer(nearestTriangle);
	float dist = DistanceToTriangle(pos, triangle);

	vec3 maxExtents = localExtents * 0.5;
	vec3 minExtents = -maxExtents;


	float inside = 0.0;
	if (boxContainsPoint(pos, minExtents, maxExtents)) {
		RayTriangleIntersectionResult intersections = RayTriangleSphericalClosest(pos);

		if (intersections.backHits > 0.0) {
			float backHitPercentage = intersections.backHits / samples;
			if (backHitPercentage > 0.5) {
				inside = 1.0;
			}
		}
	}

	if (inside > 0.5) {
		dist *= -1.0;
	}
	gl_FragColor = vec4(vec3(dist, inside, 0.0), 1.0);

}