uniform sampler2D tDiffuse;
uniform vec3 color;

varying vec4 vWorldPosition;
varying vec3 vNormal;
varying vec4 vTexCoords;

void main() {
    vec2 uv = (vTexCoords.xy / vTexCoords.w) * 0.5 + 0.5;

    vec3 diffuseColor = texture(tDiffuse, uv).rgb;

    diffuseColor *= color;

    // this makes sure we don't render the textture also on the back of the object
    vec3 projectorDirection = normalize(cameraPosition - vWorldPosition.xyz);
    float dotProduct = dot(vNormal, projectorDirection);
    if (dotProduct < 0.0) {
        diffuseColor = color;
    }


    gl_FragColor = vec4(diffuseColor, 1.0);



    // // Normal lighting for comparison
    // vec3 to_light;
    // vec3 vertex_normal;
    // float cos_angle;

    // vec3 u_Light_position = vec3(0, 5, 1);
    // // Calculate a vector from the fragment location to the light source
    // to_light = u_Light_position - vWorldPosition.xyz;
    // to_light = normalize( to_light );

    // // The vertex's normal vector is being interpolated across the primitive
    // // which can make it un-normalized. So normalize the vertex's normal vector.
    // vertex_normal = normalize( vNormal );

    // // Calculate the cosine of the angle between the vertex's normal vector
    // // and the vector going to the light.
    // cos_angle = dot(vertex_normal, to_light);
    // cos_angle = clamp(cos_angle, 0.0, 1.0);

    // // Scale the color of this fragment based on its angle to the light.
    // gl_FragColor = vec4(color * cos_angle, 1.0);
}