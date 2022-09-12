struct Ray {
    vec3 origin;
    vec3 dir;
};

out Ray vRay;

uniform vec3 cameraDirection;
uniform float cameraAspect;
uniform float cameraFov;

varying vec2 vUv;

#define PI 3.14159265359
void perspectiveCamera(in vec2 uv, in vec3 position, in vec3 cameraDirection, in float fov, in float aspect, out vec3 origin, out vec3 dir) {
    vec2 st = uv * 2.0 - 1.0;
    float radian = fov * PI / 180.0;
    float h = tan(radian * 0.5);
    float w = h * aspect;
    vec3 right = normalize(cross(cameraDirection, vec3(0.0, 1.0, 0.0)));
    vec3 up = normalize(cross(right, cameraDirection));
    dir = normalize(right * w * st.x + up * h * st.y + cameraDirection);
    origin = position;
}

void main() {
    vUv = uv;
    perspectiveCamera(uv, cameraPosition, cameraDirection, cameraFov, cameraAspect, vRay.origin, vRay.dir);

    // gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = vec4(position, 1.0);
}