// @flow

import {
  getShaderGraphNodeDefinition,
  sanitizeShaderGraphDefinition,
} from './ShaderGraphModel';

export const SHADER_GRAPH_VERTEX_SHADER = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SHADER_GRAPH_VALIDATION_VERTEX_SHADER = `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = (aPosition + 1.0) * 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const DEFAULT_SHADER_GRAPH_FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uTime;
uniform float uMixStrength;
varying vec2 vUv;

void main() {
  vec4 sceneColor = texture2D(tDiffuse, vUv);
  vec4 shaderGraphColor = sceneColor;
  gl_FragColor = mix(sceneColor, shaderGraphColor, clamp(uMixStrength, 0.0, 1.0));
}
`;

const formatFloat = value => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return '0.0';
  }
  if (Math.abs(numericValue) < 0.000001) {
    return '0.0';
  }
  const fixedValue = numericValue.toFixed(4).replace(/\.?0+$/, '');
  return fixedValue.includes('.') ? fixedValue : `${fixedValue}.0`;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const hexToRgb = hex => {
  const safeHex = typeof hex === 'string' ? hex.replace('#', '') : 'ffffff';
  const normalizedHex = safeHex.length === 6 ? safeHex : 'ffffff';
  return {
    r: parseInt(normalizedHex.slice(0, 2), 16) / 255,
    g: parseInt(normalizedHex.slice(2, 4), 16) / 255,
    b: parseInt(normalizedHex.slice(4, 6), 16) / 255,
  };
};

const helperImplementations = {
  clampUv: `
vec2 shaderGraphClampUv(vec2 uv) {
  return clamp(uv, vec2(0.0), vec2(1.0));
}
`,
  waveUv: `
vec2 shaderGraphWaveUv(
  vec2 uv,
  float timeValue,
  float amplitude,
  float frequency,
  float speed
) {
  float wave = sin((uv.y + timeValue * speed) * frequency * 6.28318530718);
  vec2 displacedUv = uv + vec2(wave * amplitude, 0.0);
  return shaderGraphClampUv(displacedUv);
}
`,
  vignette: `
vec4 shaderGraphApplyVignette(
  vec4 color,
  vec2 uv,
  float intensity,
  float softness,
  vec2 resolution
) {
  vec2 centeredUv = (uv - vec2(0.5)) * 2.0;
  float aspect = resolution.x / max(resolution.y, 1.0);
  centeredUv.x *= aspect;
  float distanceFromCenter = length(centeredUv);
  float edgeStart = clamp(1.0 - max(softness, 0.05), 0.0, 0.99);
  float vignetteMask = smoothstep(edgeStart, 1.0, distanceFromCenter);
  float blendFactor = clamp(intensity, 0.0, 2.0) * vignetteMask;
  vec3 result = mix(color.rgb, color.rgb * vec3(0.04, 0.06, 0.09), clamp(blendFactor, 0.0, 1.0));
  return vec4(result, color.a);
}
`,
  posterize: `
vec4 shaderGraphPosterize(vec4 color, float steps) {
  float safeSteps = max(2.0, floor(steps));
  vec3 posterized = floor(color.rgb * safeSteps) / safeSteps;
  return vec4(posterized, color.a);
}
`,
};

const getPort = (node, portId, kind) => {
  const definition = getShaderGraphNodeDefinition(node.type);
  const ports = kind === 'input' ? definition.inputs : definition.outputs;
  return ports.find(port => port.id === portId) || null;
};

export const buildShaderGraphProgram = rawGraph => {
  const graph = sanitizeShaderGraphDefinition(rawGraph);
  const diagnostics = [];
  const helperNames = new Set();
  const nodesById = {};
  graph.nodes.forEach(node => {
    nodesById[node.id] = node;
  });

  const inputConnectionsByKey = {};
  graph.connections.forEach(connection => {
    const key = `${connection.toNodeId}:${connection.toPortId}`;
    inputConnectionsByKey[key] = connection;
  });

  const expressionCache = {};
  const dependencyStack = [];

  const makeFallbackExpression = portType => {
    if (portType === 'float') {
      return '0.0';
    }
    if (portType === 'vec2') {
      return 'vUv';
    }
    return 'sceneColor';
  };

  const getControlValueExpression = (node, controlId, fallbackValue) => {
    const definition = getShaderGraphNodeDefinition(node.type);
    const control = definition.controls
      ? definition.controls.find(candidate => candidate.id === controlId)
      : null;
    if (!control) {
      return fallbackValue;
    }

    const rawValue =
      node.data && node.data[controlId] !== undefined
        ? node.data[controlId]
        : control.defaultValue;
    if (control.type === 'color') {
      const color = hexToRgb(rawValue || control.defaultValue);
      return `vec4(${formatFloat(color.r)}, ${formatFloat(color.g)}, ${formatFloat(
        color.b
      )}, ${formatFloat(
        node.data && node.data.alpha !== undefined ? node.data.alpha : 1
      )})`;
    }
    return formatFloat(
      rawValue !== undefined && rawValue !== null ? rawValue : control.defaultValue
    );
  };

  const resolveNodeOutput = (nodeId, outputId) => {
    const cacheKey = `${nodeId}:${outputId}`;
    if (expressionCache[cacheKey]) {
      return expressionCache[cacheKey];
    }

    const node = nodesById[nodeId];
    if (!node) {
      diagnostics.push({
        severity: 'error',
        message: `Missing node "${nodeId}" referenced by a connection.`,
      });
      return 'sceneColor';
    }

    if (dependencyStack.includes(cacheKey)) {
      diagnostics.push({
        severity: 'error',
        message: `Cycle detected near "${nodeId}". Shader Graph requires acyclic connections.`,
      });
      const outputPort = getPort(node, outputId, 'output');
      return makeFallbackExpression(outputPort ? outputPort.type : 'vec4');
    }

    dependencyStack.push(cacheKey);
    const definition = getShaderGraphNodeDefinition(node.type);
    let expression = 'sceneColor';

    const resolveInput = inputId => {
      const inputPort = getPort(node, inputId, 'input');
      const inputConnection = inputConnectionsByKey[`${node.id}:${inputId}`];
      if (inputConnection) {
        const sourceNode = nodesById[inputConnection.fromNodeId];
        if (!sourceNode) {
          diagnostics.push({
            severity: 'error',
            message: `Connection source "${inputConnection.fromNodeId}" no longer exists.`,
          });
          return makeFallbackExpression(inputPort ? inputPort.type : 'vec4');
        }
        const sourcePort = getPort(
          sourceNode,
          inputConnection.fromPortId,
          'output'
        );
        if (!sourcePort || !inputPort || sourcePort.type !== inputPort.type) {
          diagnostics.push({
            severity: 'error',
            message: `Type mismatch between "${sourceNode.type}" and "${node.type}".`,
          });
          return makeFallbackExpression(inputPort ? inputPort.type : 'vec4');
        }
        return resolveNodeOutput(
          inputConnection.fromNodeId,
          inputConnection.fromPortId
        );
      }

      if (inputPort && inputPort.usesControlValue) {
        return getControlValueExpression(
          node,
          inputPort.usesControlValue,
          makeFallbackExpression(inputPort.type)
        );
      }
      if (inputPort && inputPort.defaultExpression) {
        return inputPort.defaultExpression;
      }
      return makeFallbackExpression(inputPort ? inputPort.type : 'vec4');
    };

    if (definition.type === 'screenColor') {
      expression = 'sceneColor';
    } else if (definition.type === 'uv') {
      expression = 'vUv';
    } else if (definition.type === 'time') {
      expression = 'uTime';
    } else if (definition.type === 'float') {
      expression = getControlValueExpression(node, 'value', '1.0');
    } else if (definition.type === 'color') {
      expression = getControlValueExpression(node, 'color', 'vec4(1.0)');
    } else if (definition.type === 'sampleScene') {
      helperNames.add('clampUv');
      expression = `texture2D(tDiffuse, shaderGraphClampUv(${resolveInput('uv')}))`;
    } else if (definition.type === 'addColor') {
      expression = `(${resolveInput('a')} + ${resolveInput('b')})`;
    } else if (definition.type === 'multiplyColor') {
      expression = `(${resolveInput('a')} * ${resolveInput('b')})`;
    } else if (definition.type === 'mixColor') {
      expression = `mix(${resolveInput('a')}, ${resolveInput('b')}, clamp(${resolveInput(
        't'
      )}, 0.0, 1.0))`;
    } else if (definition.type === 'addFloat') {
      expression = `(${resolveInput('a')} + ${resolveInput('b')})`;
    } else if (definition.type === 'multiplyFloat') {
      expression = `(${resolveInput('a')} * ${resolveInput('b')})`;
    } else if (definition.type === 'sine') {
      expression = `sin(${resolveInput('value')})`;
    } else if (definition.type === 'waveUv') {
      helperNames.add('clampUv');
      helperNames.add('waveUv');
      expression = `shaderGraphWaveUv(${resolveInput('uv')}, ${resolveInput(
        'time'
      )}, ${resolveInput('amplitude')}, ${resolveInput('frequency')}, ${resolveInput(
        'speed'
      )})`;
    } else if (definition.type === 'vignette') {
      helperNames.add('vignette');
      expression = `shaderGraphApplyVignette(${resolveInput('color')}, ${resolveInput(
        'uv'
      )}, ${resolveInput('intensity')}, ${resolveInput(
        'softness'
      )}, uResolution)`;
    } else if (definition.type === 'posterize') {
      helperNames.add('posterize');
      expression = `shaderGraphPosterize(${resolveInput('color')}, ${resolveInput(
        'steps'
      )})`;
    } else {
      diagnostics.push({
        severity: 'warning',
        message: `Unsupported node "${definition.title}" ignored.`,
      });
      expression = 'sceneColor';
    }

    dependencyStack.pop();
    expressionCache[cacheKey] = expression;
    return expression;
  };

  const outputNode =
    graph.nodes.find(node => node.type === 'output') || graph.nodes[0] || null;
  if (!outputNode) {
    return {
      fragmentShader: DEFAULT_SHADER_GRAPH_FRAGMENT_SHADER,
      usesTime: false,
      diagnostics: [
        {
          severity: 'error',
          message: 'Shader Graph is empty.',
        },
      ],
    };
  }

  const outputConnection = inputConnectionsByKey[`${outputNode.id}:color`];
  if (!outputConnection) {
    diagnostics.push({
      severity: 'warning',
      message: 'Output is not connected. The graph currently passes the scene through.',
    });
  }

  const shaderGraphColorExpression = outputConnection
    ? resolveNodeOutput(outputConnection.fromNodeId, outputConnection.fromPortId)
    : 'sceneColor';
  const usesTime = shaderGraphColorExpression.includes('uTime');

  const helperBlocks = Array.from(helperNames)
    .map(helperName => helperImplementations[helperName])
    .filter(Boolean)
    .join('\n');

  const fragmentShader = `
precision highp float;

uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uTime;
uniform float uMixStrength;
varying vec2 vUv;

${helperBlocks}

void main() {
  vec4 sceneColor = texture2D(tDiffuse, vUv);
  vec4 shaderGraphColor = ${shaderGraphColorExpression};
  gl_FragColor = mix(
    sceneColor,
    shaderGraphColor,
    clamp(uMixStrength, 0.0, 1.0)
  );
}
`.trim();

  return {
    fragmentShader,
    diagnostics,
    usesTime,
  };
};

const parseShaderInfoLog = log => {
  if (!log) {
    return [];
  }

  return log
    .split(/\r?\n/)
    .filter(Boolean)
    .map(entry => {
      const webglMatch = entry.match(/ERROR:\s*\d+:(\d+):\s*(.*)/i);
      if (webglMatch) {
        return {
          message: webglMatch[2] || entry,
          startLineNumber: clamp(parseInt(webglMatch[1], 10) || 1, 1, 9999),
          startColumn: 1,
          endLineNumber: clamp(parseInt(webglMatch[1], 10) || 1, 1, 9999),
          endColumn: 120,
        };
      }

      const angleMatch = entry.match(/0:(\d+)\((\d+)\):\s*error\s*(.*)/i);
      if (angleMatch) {
        return {
          message: angleMatch[3] || entry,
          startLineNumber: clamp(parseInt(angleMatch[1], 10) || 1, 1, 9999),
          startColumn: clamp(parseInt(angleMatch[2], 10) || 1, 1, 9999),
          endLineNumber: clamp(parseInt(angleMatch[1], 10) || 1, 1, 9999),
          endColumn: clamp(parseInt(angleMatch[2], 10) || 1, 1, 9999) + 12,
        };
      }

      return {
        message: entry,
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 120,
      };
    });
};

let shaderValidationGl = null;

const getShaderValidationGl = () => {
  if (shaderValidationGl) {
    return shaderValidationGl;
  }

  if (typeof document === 'undefined') {
    return null;
  }

  const canvas = document.createElement('canvas');
  shaderValidationGl =
    canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  return shaderValidationGl;
};

export const validateGeneratedShader = fragmentShader => {
  if (typeof document === 'undefined') {
    return {
      isValid: true,
      markers: [],
      log: '',
    };
  }

  const gl = getShaderValidationGl();
  if (!gl) {
    return {
      isValid: true,
      markers: [],
      log: '',
    };
  }

  const compileShader = (type, source) => {
    const shader = gl.createShader(type);
    if (!shader) {
      return { compiled: false, shader: null, log: 'Unable to allocate shader.' };
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const compiled = !!gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    const log = gl.getShaderInfoLog(shader) || '';
    return {
      compiled,
      shader,
      log,
    };
  };

  const vertexShader = compileShader(
    gl.VERTEX_SHADER,
    SHADER_GRAPH_VALIDATION_VERTEX_SHADER
  );
  const fragmentShaderCompilation = compileShader(
    gl.FRAGMENT_SHADER,
    fragmentShader
  );

  let programLog = '';
  let linked = false;

  if (
    vertexShader.compiled &&
    fragmentShaderCompilation.compiled &&
    vertexShader.shader &&
    fragmentShaderCompilation.shader
  ) {
    const program = gl.createProgram();
    if (program) {
      gl.attachShader(program, vertexShader.shader);
      gl.attachShader(program, fragmentShaderCompilation.shader);
      gl.linkProgram(program);
      linked = !!gl.getProgramParameter(program, gl.LINK_STATUS);
      programLog = gl.getProgramInfoLog(program) || '';
      gl.deleteProgram(program);
    }
  }

  if (vertexShader.shader) {
    gl.deleteShader(vertexShader.shader);
  }
  if (fragmentShaderCompilation.shader) {
    gl.deleteShader(fragmentShaderCompilation.shader);
  }

  const combinedLog = [
    vertexShader.log,
    fragmentShaderCompilation.log,
    programLog,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    isValid: vertexShader.compiled && fragmentShaderCompilation.compiled && linked,
    markers: parseShaderInfoLog(combinedLog),
    log: combinedLog,
  };
};
