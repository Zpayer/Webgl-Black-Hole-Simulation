precision highp float;

varying vec2 vUV;
uniform float uTime;
uniform vec2 uResolution;
uniform float uMass;
uniform float uBrightness;
uniform vec3 uCameraPos;
uniform mat3 uCameraRot;
uniform vec3 uInnerColor;
uniform vec3 uOuterColor;
uniform float uSpin;

const float PI = 3.14159265359;
const int MAX_STEPS = 150;
const float MAX_DIST = 100.0;

float hash(vec2 p) {
    p = fract(p * vec2(443.897, 441.423));
    p += dot(p, p.yx + 19.19);
    return fract(p.x * p.y);
}

vec3 getStars(vec3 dir) {
    vec2 uv = vec2(atan(dir.z, dir.x) / (2.0 * PI), acos(clamp(dir.y, -1.0, 1.0)) / PI);

    vec3 col = vec3(0.0);

    for(int i = 0; i < 40; i++) {
        float layer = float(i);
        float scale = 60.0 * pow(2.0, layer);
        vec2 id = floor(uv * scale);
        vec2 gv = fract(uv * scale) - 0.5;

        float n = hash(id + layer * 17.3);
        float te = 0.945;
        if(n > te) {
            vec2 offs = (vec2(hash(id + layer * 23.1), hash(id + layer * 31.7)) - 0.5) * 0.8;
            float d = length(gv - offs);
            float brightness = (n - te) * 20.0;
            col += brightness * exp(-d * d * scale * 2.0) / (1.0 + d * scale);
        }
    }

    return col;
}

vec3 getDisk(vec3 pos) {
    float r = length(pos.xz);
    float h = abs(pos.y);

    float innerR = uMass * 3.0;
    float outerR = uMass * 10.0;
    float thickness = 0.2;

    if(r > innerR && r < outerR && h < thickness - 0.1) {
        float temp = smoothstep(outerR, innerR, r);
        temp = pow(temp, 0.7);

        float angle = atan(pos.z, pos.x);
        float rotation = angle + uTime * uSpin * sqrt(uMass / r);

        float pattern = sin(rotation * 10.0 - r * 2.0) * 0.5 + 0.5;
        float intensity = (1.0 - h / thickness) * (0.6 + pattern * 0.4);

        return mix(uOuterColor, uInnerColor, temp) * intensity * temp * uBrightness;
    }

    return vec3(0.0);
}

vec3 trace(vec3 ro, vec3 rd) {
    vec3 pos = ro;
    vec3 dir = rd;
    float totalDist = 0.0;

    for(int i = 0; i < MAX_STEPS; i++) {
        float r = length(pos);

        if(r < uMass * 2.0) {
            return vec3(0.0);
        }

        vec3 diskCol = getDisk(pos);
        if(length(diskCol) > 0.01) {
            return diskCol;
        }

        float rs = uMass * 2.0;
        float deflection = 1.5 * rs / (r * r);

        vec3 toCenter = normalize(-pos);
        vec3 perpDir = dir - dot(dir, toCenter) * toCenter;

        dir = normalize(dir + toCenter * deflection * 0.1);

        float stepSize = 0.13 + r * 0.02;
        pos += dir * stepSize;
        totalDist += stepSize;

        if(totalDist > MAX_DIST) {
            return getStars(dir);
        }
    }

    return getStars(dir);
}

void main() {
    vec2 uv = vUV * vec2(uResolution.x / uResolution.y, 1.0);

    vec3 rd = normalize(uCameraRot * vec3(uv, -2.0));

    vec3 col = trace(uCameraPos, rd);

    //vec3 toCenter = -uCameraPos;
    //vec3 closest = uCameraPos + rd * max(0.0, dot(toCenter, rd));
    //float d = length(closest);
    //float photonR = uMass * 2.5;

    //if(d < photonR * 0.5) {
    //    float ring = exp(-pow((d - photonR) / (photonR * 0.3), 2.0));
    //    col += vec3(1.0, 1.0, 1.0) * ring * 0.5 * uBrightness;
    //}

    col = col / (col + 1.0);
    col = pow(col, vec3(0.4545));
    gl_FragColor = vec4(col, 1.0);
}