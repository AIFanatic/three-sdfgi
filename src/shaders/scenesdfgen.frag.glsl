precision highp float;

uniform highp sampler2D uScene;
uniform highp sampler3D uSDF;
uniform vec3 boxCenter;
uniform vec3 boxSize;
uniform mat4 boxMatrix;

uniform float sdfResolution;

uniform int command;
uniform float replaceIndex;

#define COMMAND_NONE 0
#define COMMAND_INCREASE 1
#define COMMAND_DECREASE 2
#define COMMAND_REPLACE 3
#define COMMAND_UPDATE 4

uniform bool SCENE_ONLY;

uniform float iTime;

float map(float x, float in_min, float in_max, float out_min, float out_max) {
	return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

bool boxContainsPoint(vec3 point, vec3 minExtents, vec3 maxExtents) {
	return point.x < minExtents.x || point.x > maxExtents.x ||
	point.y < minExtents.y || point.y > maxExtents.y ||
	point.z < minExtents.z || point.z > maxExtents.z ? false : true;
}

float boxDistanceToPoint(vec3 point, vec3 minExtents, vec3 maxExtents) {
	vec3 clampedPoint = clamp(point, minExtents, maxExtents);
	return length(clampedPoint - point);
}

vec3 boxClosestPoint(vec3 point, vec3 minExtents, vec3 maxExtents) {
	return vec3(
		clamp(point.x, minExtents.x, maxExtents.x),
		clamp(point.y, minExtents.y, maxExtents.y),
		clamp(point.z, minExtents.z, maxExtents.z)
	);
}


#define FLOAT_MAX  1.70141184e38
#define FLOAT_MIN  1.17549435e-38

lowp vec4 encode_float(highp float v) {
	highp float av = abs(v);

	//Handle special cases
	if(av < FLOAT_MIN) {
		return vec4(0.0, 0.0, 0.0, 0.0);
	} else if(v > FLOAT_MAX) {
		return vec4(127.0, 128.0, 0.0, 0.0) / 255.0;
	} else if(v < -FLOAT_MAX) {
		return vec4(255.0, 128.0, 0.0, 0.0) / 255.0;
	}

	highp vec4 c = vec4(0,0,0,0);

	//Compute exponent and mantissa
	highp float e = floor(log2(av));
	highp float m = av * pow(2.0, -e) - 1.0;

	//Unpack mantissa
	c[1] = floor(128.0 * m);
	m -= c[1] / 128.0;
	c[2] = floor(32768.0 * m);
	m -= c[2] / 32768.0;
	c[3] = floor(8388608.0 * m);

	//Unpack exponent
	highp float ebias = e + 127.0;
	c[0] = floor(ebias / 2.0);
	ebias -= c[0] * 2.0;
	c[1] += floor(ebias) * 128.0; 

	//Unpack sign bit
	c[0] += 128.0 * step(0.0, -v);

	//Scale back to range
	return c / 255.0;
}


// note: the 0.1s here an there are voodoo related to precision
float decode_float(vec4 v) {
	vec4 bits = v * 255.0;
	float sign = mix(-1.0, 1.0, step(bits[3], 128.0));
	float expo = floor(mod(bits[3] + 0.1, 128.0)) * 2.0 +
	floor((bits[2] + 0.1) / 128.0) - 127.0;
	float sig = bits[0] +
	bits[1] * 256.0 +
	floor(mod(bits[2] + 0.1, 128.0)) * 256.0 * 256.0;
	return sign * (1.0 + sig / 8388607.0) * pow(2.0, expo);
}

void main() {
	float bboxLength = 0.5;

	// from fragCoord to 0-1 range
	vec2 uv = gl_FragCoord.xy / vec2(sdfResolution * sdfResolution, sdfResolution);

	float x1 = mod(uv.x * sdfResolution, 1.0);
	float y1 = uv.y;
	float z2 = floor(gl_FragCoord.x / sdfResolution) / sdfResolution;
	float z3 = ceil(gl_FragCoord.x / sdfResolution) / sdfResolution;

	float z1 = (z2 + z3) / 2.0;

	float x = map(x1, 0.0, 1.0, -bboxLength, bboxLength);
	float y = map(y1, 0.0, 1.0, -bboxLength, bboxLength);
	float z = map(z1, 0.0, 1.0, -bboxLength, bboxLength);

	// vec3 p = vec3(x, z, y); // sampler3D output
	vec3 p = vec3(x, y, z); // sampler2D output

	// float col = decode_float(texelFetch(uScene, ivec2(gl_FragCoord.x, gl_FragCoord.y), 0));
	// float col = texelFetch(uScene, ivec2(gl_FragCoord.x, gl_FragCoord.y), 0).r;
	// float EPSILON = 0.000001;
	// if (col > -EPSILON && col < EPSILON) {
	// 	col = 10.0;
	// }

	float col = texelFetch(uScene, ivec2(gl_FragCoord.x, gl_FragCoord.y), 0).r;
	gl_FragColor = vec4(col, col < 0.0 ? 1.0 : 0.0, 0.0, 1.0);
	if (command == COMMAND_REPLACE) {
		float resolution = sdfResolution;
		float upperBound = (replaceIndex + 1.0) * resolution;
		float lowerBound = upperBound - resolution;

		if (gl_FragCoord.y < upperBound && gl_FragCoord.y > lowerBound) {
			p.y -= replaceIndex;
			p += 0.5;

			// col = texture(uSDF, p.xzy).r; // Using scene combiner
			col = texture(uSDF, p.xyz).r; // Using sdfTextures
			gl_FragColor = vec4(col, col < 0.0 ? 1.0 : 0.0, 0.0, 1.0);
		}
	}
	else if (command == COMMAND_UPDATE) {

	}
}