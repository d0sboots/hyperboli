"use strict";

const canvas = document.getElementById("canvas");
const content = document.getElementById("content");
var gl = canvas.getContext("webgl2", {antialias: true});

function loadShader(program, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.log('Unable to compile shader:\n' + gl.getShaderInfoLog(shader));
  }
  gl.attachShader(program, shader);
}

// "attribs" is an array of the names of 'in' attributes,
// while "uniforms" is an array of the names of uniforms.
function initShaderProgram(vsSource, fsSource, attribs, uniforms) {
  const shaderProgram = gl.createProgram();
  loadShader(shaderProgram, gl.VERTEX_SHADER, vsSource);
  loadShader(shaderProgram, gl.FRAGMENT_SHADER, fsSource);

  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.log('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
    return null;
  }

  const attribsResult = {}
  for (const a of attribs) {
    attribsResult[a] = gl.getAttribLocation(shaderProgram, a);
  }
  const uniformsResult = {}
  for (const u of uniforms) {
    uniformsResult[u] = gl.getUniformLocation(shaderProgram, u);
  }

  return {
    program: shaderProgram,
    attribs: attribsResult,
    uniforms: uniformsResult,
  };
}

function initBuffersSpinner(squareAttribs) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

  // TRIANGLE_FAN data, 2 points per tri
  const vertexData = [
    -1.05, -1.05,
    1.05, -1.05,
    1.05, 1.05,
    -1.05, 1.05,
  ];

  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array(vertexData),
    gl.STATIC_DRAW);

  const numComponents = 2;
  const type = gl.FLOAT;
  const normalize = false;
  const stride = 0;
  const offset = 0;
  gl.vertexAttribPointer(squareAttribs.position, numComponents, type, normalize, stride, offset);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.enableVertexAttribArray(squareAttribs.position);
  gl.bindVertexArray(null);

  return {
    vertex: vao,
    vertexCount: vertexData.length / numComponents,
  };
}

function initGLStateSpinner() {
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clearDepth(1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);

  const squareShaderInfo = initShaderProgram(
   `#version 300 es

    in vec2 position;
    out vec2 coords;
    uniform mat2 projMatrix;

    void main() {
      gl_Position = vec4(projMatrix * position, 0.0, 1.0);
      coords = position;
    }`,

   `#version 300 es
    precision highp float;

    in vec2 coords;
    out vec4 color;
    uniform float aliasUnit;
    const float innerRadius = 10.0 / 14.0;
    const float middleRadius = (1.0 + innerRadius) / 2.0;
    const float headRadius = (1.0 - innerRadius) / 2.0;
    const float PI = 3.14159265358979;

    void main() {
      float dist = length(coords);
      if (dist > 1.0 + aliasUnit || dist < innerRadius - aliasUnit) {
        color = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }
      // This is a pile of stuff to anti-alias the sharp lines in the spinner,
      // and avoid branches while doing it.
      float head_dist = length(vec2(coords.x, coords.y - middleRadius));
      float gradient = atan(coords.x, -coords.y) / (2.0 * PI) + 0.5;
      bool in_head = coords.x < 0.0 && head_dist < headRadius + aliasUnit;
      float radiusPart = in_head ? headRadius : innerRadius;
      bool test = dist < 1.0 - aliasUnit || in_head;
      float edge0 = test ? radiusPart - aliasUnit : 1.0 + aliasUnit;
      float edge1 = test ? radiusPart + aliasUnit : 1.0 - aliasUnit;
      float step = smoothstep(edge0, edge1, in_head ? head_dist : dist);
      float grey = gradient * step + (in_head ? 1.0 - step : 0.0);
      color = vec4(grey, grey, grey, 1.0);
    }`,
    ["position"],
    ["projMatrix", "aliasUnit"],
  );
  const buffers = initBuffersSpinner(squareShaderInfo.attribs);
  return {
    buffers: buffers,
    shaders: {
      square: squareShaderInfo,
    }
  };
}

function initGLStateParaLines() {
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clearDepth(1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);

  const squareShaderInfo = initShaderProgram(
   `#version 300 es

    in vec3 position;
    uniform vec3 camera;

    void main() {
      vec4 f = normalize(camera);
      vec4 l = normalize(camera.z, 0, -camera.x);
      vec4 u = cross(f, l);
      // Transpose vectors to get inverse, because we need to invert
      // the rotation of the camera vector to apply it to the world
      mat4 rot = mat4(transpose(mat3(l, u, f)));
      // We will subtract this position from the world to translate to view-space.
      const vec3 camera_pos = vec3();
      gl_Position = rot * vec4(position - camera_pos, 1.0);
    }`,

   `#version 300 es
    precision highp float;

    in vec2 coords;
    out vec4 color;
    uniform float aliasUnit;
    const float innerRadius = 10.0 / 14.0;
    const float middleRadius = (1.0 + innerRadius) / 2.0;
    const float headRadius = (1.0 - innerRadius) / 2.0;
    const float PI = 3.14159265358979;

    void main() {
      float dist = length(coords);
      if (dist > 1.0 + aliasUnit || dist < innerRadius - aliasUnit) {
        color = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }
      // This is a pile of stuff to anti-alias the sharp lines in the spinner,
      // and avoid branches while doing it.
      float head_dist = length(vec2(coords.x, coords.y - middleRadius));
      float gradient = atan(coords.x, -coords.y) / (2.0 * PI) + 0.5;
      bool in_head = coords.x < 0.0 && head_dist < headRadius + aliasUnit;
      float radiusPart = in_head ? headRadius : innerRadius;
      bool test = dist < 1.0 - aliasUnit || in_head;
      float edge0 = test ? radiusPart - aliasUnit : 1.0 + aliasUnit;
      float edge1 = test ? radiusPart + aliasUnit : 1.0 - aliasUnit;
      float step = smoothstep(edge0, edge1, in_head ? head_dist : dist);
      float grey = gradient * step + (in_head ? 1.0 - step : 0.0);
      color = vec4(grey, grey, grey, 1.0);
    }`,
    ["position"],
    ["camera"],
  );
  const buffers = initBuffersSpinner(squareShaderInfo.attribs);
  return {
    buffers: buffers,
    shaders: {
      square: squareShaderInfo,
    }
  };
}

var first_time; // First animation time
var last_time;  // Last animation time
var gl_state;
const values = new Array(5);
let current = 0;
const projectionMatrix = Float32Array.from([
  1.0, 0.0,
  0.0, 1.0,
]);
const cameraDirection = Float32Array.from([0.0, 0.0, 1.0]);
// Adjust for antialiasing in an isotropic fashion.
// No mathematical basis, this was tuned to look good.
const unitAdjust = 1.55;

function animateSpinner(time) {
  requestAnimationFrame(animateSpinner);

  if (!first_time) {
    first_time = time;
  }
  if (time === last_time || !gl) {
    // Same frame, don't re-render.
    return;
  }
  values[current] = last_time - time;
  last_time = time;

  gl.useProgram(gl_state.shaders.square.program);

  const width = innerWidth;
  const height = innerHeight - content.offsetHeight;
  const scale = Math.min(height, width) * 0.28;
  if (width !== canvas.width || height !== canvas.height) {
    canvas.width = width;
    canvas.height = height;
    gl.uniform1f(gl_state.shaders.square.uniforms.aliasUnit, unitAdjust / scale);
    gl.viewport(0, 0, width, height);
  }

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const speed = 0.004;
  const cos = scale * Math.cos(speed * (time - first_time));
  const sin = scale * Math.sin(speed * (time - first_time));
  projectionMatrix[0] = cos / width;
  projectionMatrix[1] = sin / height;
  projectionMatrix[2] = -sin / width;
  projectionMatrix[3] = cos / height;
  gl.uniformMatrix2fv(
    gl_state.shaders.square.uniforms.projMatrix, false, projectionMatrix);
  gl.bindVertexArray(gl_state.buffers.vertex);
  gl.drawArrays(gl.TRIANGLE_FAN, 0, gl_state.buffers.vertexCount);

  let res = ""
  for (let i = 0; i < 5; ++i) {
    res += values[i]?.toFixed(6);
    if (i === current) {
      res += " X";
    }
    res += "\n";
  }
  current = (current + 1) % 5;
  content.textContent = res;
}

function animateParaLines(time) {
  requestAnimationFrame(animateSpinner);

  if (!first_time) {
    first_time = time;
  }
  if (time === last_time || !gl) {
    // Same frame, don't re-render.
    return;
  }
  last_time = time;

  gl.useProgram(gl_state.shaders.para.program);

  const width = innerWidth;
  const height = innerHeight;
  const scale = Math.min(height, width) * 0.28;
  if (width !== canvas.width || height !== canvas.height) {
    canvas.width = width;
    canvas.height = height;
    gl.uniform1f(gl_state.shaders.square.uniforms.aliasUnit, unitAdjust / scale);
    gl.viewport(0, 0, width, height);
  }

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.uniformVector3fv(
    gl_state.shaders.para.uniforms.camera, false, cameraDirection);
  gl.bindVertexArray(gl_state.buffers.vertex);
  gl.drawElements(gl.LINE_STRIP, gl_state.buffers.elementsCount, gl.GL_UNSIGNED_SHORT, 0);
}

const error_text = document.getElementById("error_text");
const error_text2 = document.getElementById("error_text2");
if (gl !== null) {
  canvas.style.display = "initial";
  error_text.style.display = "none";
  gl_state = initGLStateSpinner();
  requestAnimationFrame(animateSpinner);
} else {
  error_text.replaceChildren("Can't create webgl2 context!");
  error_text2.innerHTML = `Webgl2 is supported by all modern browsers.<br>
Your browser is: <pre style="font-size:1vw">${navigator.userAgent}</pre>`;
}
