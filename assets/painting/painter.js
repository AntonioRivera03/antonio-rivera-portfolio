// Paints one layer of the valley in the browser: raymarches it (valley.glsl), then brushes it
// (brush.glsl). scripts/build-valley.mjs loads this into headless Chrome and calls paintValley.
/* global window, document */
window.paintValley = async function paintValley({
  scene, brush, width, height, layer, samples = 2, radius = [4, 7], sharpness = 8, strokes = 1,
  vignette = 0.22, tile = 256, format = "image/webp", quality = 0.9,
}) {
  const LAYERS = { sky: 0, range: 1, hills: 2, near: 3, all: 4 };
  const gl = document.createElement("canvas").getContext("webgl2", { antialias: false, premultipliedAlpha: false });
  if (!gl) throw new Error("WebGL2 is unavailable.");
  if (!gl.getExtension("EXT_color_buffer_float")) throw new Error("Float render targets are unavailable.");

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, "#version 300 es\nin vec2 aPos;\nvoid main() { gl_Position = vec4(aPos, 0.0, 1.0); }");
  const program = (source) => {
    const p = gl.createProgram();
    gl.attachShader(p, vertex);
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, source.trim()));
    gl.bindAttribLocation(p, 0, "aPos");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  };
  const passes = Object.fromEntries(brush.split(/^\/\/\/\/ (\w+)$/m).slice(1).reduce((all, part, i, parts) => (i % 2 ? all : [...all, [part, parts[i + 1]]]), []));
  const programs = { scene: program(scene), ...Object.fromEntries(Object.entries(passes).map(([name, source]) => [name, program(source)])) };

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const texture = (format = gl.RGBA16F) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, format, width, height);
    for (const [key, value] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, key, value);
    return t;
  };
  const target = (...textures) => {
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    textures.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
    gl.drawBuffers(textures.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("Framebuffer is incomplete.");
    return fbo;
  };
  // Waits for the GPU between tiles, so no single draw runs long enough to be killed.
  const settle = () => new Promise((resolve) => {
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const check = () => {
      if (gl.clientWaitSync(sync, 0, 0) === gl.TIMEOUT_EXPIRED) setTimeout(check, 2);
      else { gl.deleteSync(sync); resolve(); }
    };
    check();
  });
  const run = async (name, fbo, uniforms = {}, inputs = {}, tiled = false) => {
    const p = programs[name];
    gl.useProgram(p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    Object.entries(inputs).forEach(([key, t], unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.uniform1i(gl.getUniformLocation(p, key), unit);
    });
    for (const [key, [kind, ...values]] of Object.entries(uniforms)) gl[`uniform${kind}`](gl.getUniformLocation(p, key), ...values);
    const step = tiled ? tile : Math.max(width, height);
    gl.enable(gl.SCISSOR_TEST);
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        gl.viewport(0, 0, width, height);
        gl.scissor(x, y, Math.min(step, width - x), Math.min(step, height - y));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        if (tiled) await settle();
      }
    }
    gl.disable(gl.SCISSOR_TEST);
    await settle();
  };

  const color = texture(), aux = texture(), tensor = texture(), blurred = texture(), painted = texture(), out = texture(gl.RGBA8);
  await run("scene", target(color, aux), { uRes: ["2f", width, height], uLayer: ["1i", LAYERS[layer]], uSamples: ["1i", samples] }, {}, true);
  let source = color;
  for (let i = 0; i < strokes; i++) {
    await run("tensor", target(tensor), {}, { uSrc: source });
    await run("blur", target(blurred), { uDir: ["2f", 1, 0], uSigma: ["1f", 2] }, { uSrc: tensor });
    await run("blur", target(tensor), { uDir: ["2f", 0, 1], uSigma: ["1f", 2] }, { uSrc: blurred });
    const into = source === painted ? color : painted;
    await run("kuwahara", target(into), { uRadius: ["2f", ...radius], uSharp: ["1f", sharpness] }, { uSrc: source, uTfm: tensor, uAux: aux }, true);
    source = into;
  }
  await run("output", target(out), { uVignette: ["1f", vignette] }, { uSrc: source });

  const pixels = new Uint8ClampedArray(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const flipped = new Uint8ClampedArray(pixels.length);
  const row = width * 4;
  for (let y = 0; y < height; y++) flipped.set(pixels.subarray((height - 1 - y) * row, (height - y) * row), y * row);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").putImageData(new ImageData(flipped, width, height), 0, 0);
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return canvas.toDataURL(format, quality);
};
