
async function main() {
    const canvas = document.getElementById('glCanvas');
    /** @type {WebGL2RenderingContext} */
    const gl = canvas.getContext('webgl2', { antialias: true }) || canvas.getContext('webgl');


    if (!gl) {
        alert('WebGL not supported');
        throw new Error('WebGL not supported');
    }
    function $() {
        return document.querySelector(...arguments);
    }
    /**
 * 
 * @param {HTMLElement} parent 
 * @param {String} tagName 
 * @param {Object} attri 
 */
    function AddHTML(parent, tagName, attri) {
        let el = document.createElement(tagName);
        Object.entries(attri).forEach(([k, v]) => {
            if (k.slice(0, 6) === "event_") {
                el.addEventListener(k.slice(6), v);
            } else {
                switch (k) {
                    case "html":
                        el.innerHTML = v;
                        break;
                    case "text":
                        el.textContent = v;
                        break;
                    case "class":
                        el.className = v;
                        break;
                    default:
                        el.setAttribute(k, v);
                }
            }
        });
        parent.appendChild(el);
        return el;
    }
    function AddControl(label, settings) {
        let div = AddHTML(controls, "div", { class: "control" });
        AddHTML(div, "label", { html: label });
        let input = AddHTML(div, "input", {
            html: label,
            event_input: (e) => {
                input.update(e.target.value);
                if (settings.input) settings.input(e.target.value);
            },
            ...settings,
        });
        input.update = function (vl) {
            this.value = vl;
            val.innerHTML = (settings.type == "range" ? parseFloat(vl).toFixed(1) : vl);
        }

        let val = AddHTML(div, "span", { class: "values" });
        if (settings.value) input.update(settings.value);

        return input
    }
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }
    function compileShader(source, type) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }
    function createProgram(vertexSource, fragmentSource) {
        const vertexShader = compileShader(vertexSource, gl.VERTEX_SHADER);
        const fragmentShader = compileShader(fragmentSource, gl.FRAGMENT_SHADER);

        if (!vertexShader || !fragmentShader) return null;

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        // Check for errors
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error("Program link error:", gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }

        return program;
    }
    function getPinchDistance(e) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        return Math.hypot(dx, dy);
    }
    function getRotationMatrix(angleX, angleY) {
        const cosX = Math.cos(angleX);
        const sinX = Math.sin(angleX);
        const cosY = Math.cos(angleY);
        const sinY = Math.sin(angleY);

        return [
            cosY, sinX * sinY, -cosX * sinY,
            0, cosX, sinX,
            sinY, -sinX * cosY, cosX * cosY
        ];
    }
    function HexToRGB(hex) {
        let arr = [];
        let hex_ = structuredClone(hex);
        if (hex_[0] === "#") hex_ = hex_.slice(1);
        for (let i = 0; i < 3; i++) {
            arr[i] = parseInt("0x" + hex_.slice(i * 2, (i + 1) * 2)) / 255;
        }
        return arr;
    }


    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    async function GET(url) {
        let res = await fetch(url);
        if (!res.ok) throw Error(res);
        return await res.text();
    }


    const fragmentShaderSource = await GET("/shader.frag");
    const vertexShaderSource = await GET("/shader.vert")

    const program = createProgram(vertexShaderSource, fragmentShaderSource);
    gl.useProgram(program);

    const positions = new Float32Array([
        -1, -1,
        1, -1,
        -1, 1,
        1, 1,
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);


    let unifromLocations = {
        add: function (name) {
            this[name] = gl.getUniformLocation(program, name);
        }
    }

    unifromLocations.add("uTime");
    unifromLocations.add("uResolution");
    unifromLocations.add("uMass");
    unifromLocations.add("uBrightness");
    unifromLocations.add("uCameraPos");
    unifromLocations.add("uCameraRot");
    unifromLocations.add("uInnerColor");
    unifromLocations.add("uOuterColor");
    unifromLocations.add("uSpin");


    const Camera = {
        distance: 30,
        angle: { x: 0.18, y: -2.36 }
    }

    const Mouse = {
        dragging: false,
        lastPosition: { x: 0, y: 0 },
        touchDistance: 0,
    }


    const controls = $("#controls");
    const massSlider = AddControl("Mass:", { type: "range", min: "0.5", max: "3", value: "1", step: "0.1" })
    const brightnessSlider = AddControl("Disk Brightness:", { type: "range", min: "0", max: "100", value: "1.5", step: "0.1" })
    const distanceSlider = AddControl("Camera Distance:", {
        type: "range", min: "5", max: "100", value: "15", step: "0.5", input: (v) => {
            Camera.distance = parseFloat(v);
        }
    });
    const spinSLider = AddControl("Spin:", { type: "range", min: "0", max: "100", value: "1.5", step: "0.1" })
    const outColorPicker = AddControl("Outer Color:", { type: "color", value: "#fe4416" });
    const innerColorPicker = AddControl("Inner Color:", { type: "color", value: "#ffffff" });

    canvas.addEventListener('mousedown', (e) => {
        Mouse.dragging = true;
        Mouse.lastPosition.x = e.clientX;
        Mouse.lastPosition.y = e.clientY;
    });

    canvas.addEventListener('mousemove', (e) => {
        if (Mouse.dragging) {
            const dx = e.clientX - Mouse.lastPosition.x;
            const dy = e.clientY - Mouse.lastPosition.y;
            Camera.angle.y += dx * 0.01;
            Camera.angle.x += dy * 0.01;
            Camera.angle.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, Camera.angle.x));
            Mouse.lastPosition.x = e.clientX;
            Mouse.lastPosition.y = e.clientY;
        }
    });

    canvas.addEventListener('mouseup', () => Mouse.dragging = false);
    canvas.addEventListener('mouseleave', () => Mouse.dragging = false);

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        Camera.distance += e.deltaY * 0.02;
        Camera.distance = Math.max(5, Math.min(100, Camera.distance));
        distanceSlider.update(Camera.distance);
    });

    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            Mouse.dragging = true;
            Mouse.lastPosition.x = e.touches[0].clientX;
            Mouse.lastPosition.y = e.touches[0].clientY;
        }
        if (e.touches.length === 2) {
            Mouse.touchDistance = getPinchDist(e);
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();

        if (Mouse.dragging && e.touches.length === 1) {
            const t = e.touches[0];
            const dx = t.clientX - Mouse.lastPosition.x;
            const dy = t.clientY - Mouse.lastPosition.y;

            Camera.angle.y += dx * 0.01;
            Camera.angle.x += dy * 0.01;
            Camera.angle.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, Camera.angle.x));

            Mouse.lastPosition.x = t.clientX;
            Mouse.lastPosition.y = t.clientY;
        }

        if (e.touches.length === 2) {
            const dist = getPinchDistance(e);
            if (lastTouchDist !== 0) {
                const delta = dist - lastTouchDist;
                Camera.distance -= delta * 0.05;
                Camera.distance = Math.max(5, Math.min(100, Camera.distance));
                distanceSlider.update(Camera.distance);
            }
            Mouse.touchDistance = dist;
        }
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
        Mouse.dragging = false;
        Mouse.touchDistance = 0;
    }, { passive: false });

    canvas.addEventListener('touchcancel', () => {
        Mouse.dragging = false;
        Mouse.touchDistance = 0;
    }, { passive: false });


    let startTime = Date.now();

    function render() {
        const time = (Date.now() - startTime) * 0.001;

        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.uniform1f(unifromLocations.uTime, time);
        gl.uniform2f(unifromLocations.uResolution, canvas.width, canvas.height);
        gl.uniform1f(unifromLocations.uMass, parseFloat(massSlider.value));
        gl.uniform1f(unifromLocations.uSpin, parseFloat(spinSLider.value));
        gl.uniform1f(unifromLocations.uBrightness, parseFloat(brightnessSlider.value));
        gl.uniform1f(unifromLocations.uBrightness, parseFloat(brightnessSlider.value));
        gl.uniform3f(unifromLocations.uInnerColor, ...HexToRGB(innerColorPicker.value));
        gl.uniform3f(unifromLocations.uOuterColor, ...HexToRGB(outColorPicker.value));


        const camX = Camera.distance * Math.cos(Camera.angle.x) * Math.cos(Camera.angle.y);
        const camY = Camera.distance * Math.sin(Camera.angle.x);
        const camZ = Camera.distance * Math.cos(Camera.angle.x) * Math.sin(Camera.angle.y);
        gl.uniform3f(unifromLocations.uCameraPos, camX, camY, camZ);


        const rotMatrix = getRotationMatrix(Camera.angle.x, Camera.angle.y);
        gl.uniformMatrix3fv(unifromLocations.uCameraRot, false, rotMatrix);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        requestAnimationFrame(render);
    }

    render();
}
main();