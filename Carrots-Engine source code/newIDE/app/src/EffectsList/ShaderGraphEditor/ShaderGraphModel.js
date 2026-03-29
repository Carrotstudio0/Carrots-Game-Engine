// @flow

export const SHADER_GRAPH_EFFECT_TYPE = 'Scene3D::ShaderGraph';
export const SHADER_GRAPH_DEFINITION_PARAMETER = 'shaderGraphDefinition';
export const SHADER_GRAPH_FRAGMENT_SHADER_PARAMETER = 'fragmentShader';
export const SHADER_GRAPH_VERSION_PARAMETER = 'shaderGraphVersion';
export const SHADER_GRAPH_STRENGTH_PARAMETER = 'strength';
export const SHADER_GRAPH_ENABLED_PARAMETER = 'enabled';
export const SHADER_GRAPH_VERSION = 1;

export const SHADER_GRAPH_NODE_WIDTH = 236;
export const SHADER_GRAPH_NODE_HEADER_HEIGHT = 38;
export const SHADER_GRAPH_NODE_PORT_HEIGHT = 32;
export const SHADER_GRAPH_NODE_FOOTER_HEIGHT = 26;
export const SHADER_GRAPH_CANVAS_WIDTH = 2400;
export const SHADER_GRAPH_CANVAS_HEIGHT = 1600;

export const shaderGraphPortColors = {
  float: '#37d6bb',
  vec2: '#ffba49',
  vec4: '#ff708d',
};

const makePort = (id, label, type, extra = {}) => ({
  id,
  label,
  type,
  ...extra,
});

const createNodeId = prefix =>
  `${prefix}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;

const clone = value => JSON.parse(JSON.stringify(value));

export const shaderGraphNodeDefinitions = {
  output: {
    type: 'output',
    title: 'Output',
    category: 'Output',
    color: '#ff8c5a',
    description: 'Final post-processing color sent to the screen.',
    inputs: [makePort('color', 'Color', 'vec4', { defaultExpression: 'sceneColor' })],
    outputs: [],
    createData: () => ({}),
  },
  screenColor: {
    type: 'screenColor',
    title: 'Screen Color',
    category: 'Inputs',
    color: '#63c8ff',
    description: 'Current rendered scene color.',
    inputs: [],
    outputs: [makePort('color', 'Scene', 'vec4')],
    createData: () => ({}),
  },
  uv: {
    type: 'uv',
    title: 'UV',
    category: 'Inputs',
    color: '#63c8ff',
    description: 'Normalized screen coordinates.',
    inputs: [],
    outputs: [makePort('uv', 'UV', 'vec2')],
    createData: () => ({}),
  },
  time: {
    type: 'time',
    title: 'Time',
    category: 'Inputs',
    color: '#63c8ff',
    description: 'Time from scene start in seconds.',
    inputs: [],
    outputs: [makePort('time', 'Time', 'float')],
    createData: () => ({}),
  },
  float: {
    type: 'float',
    title: 'Float',
    category: 'Parameters',
    color: '#37d6bb',
    description: 'Scalar numeric value.',
    inputs: [],
    outputs: [makePort('value', 'Value', 'float')],
    controls: [
      {
        id: 'value',
        label: 'Value',
        type: 'float',
        step: 0.01,
        min: -4,
        max: 4,
        defaultValue: 1,
      },
    ],
    createData: () => ({
      value: 1,
    }),
  },
  color: {
    type: 'color',
    title: 'Color',
    category: 'Parameters',
    color: '#ff708d',
    description: 'RGBA constant color.',
    inputs: [],
    outputs: [makePort('color', 'Color', 'vec4')],
    controls: [
      {
        id: 'color',
        label: 'Tint',
        type: 'color',
        defaultValue: '#6fe8ff',
      },
      {
        id: 'alpha',
        label: 'Alpha',
        type: 'float',
        step: 0.01,
        min: 0,
        max: 1,
        defaultValue: 1,
      },
    ],
    createData: () => ({
      color: '#6fe8ff',
      alpha: 1,
    }),
  },
  sampleScene: {
    type: 'sampleScene',
    title: 'Sample Scene',
    category: 'Sampling',
    color: '#9d83ff',
    description: 'Samples the scene color at a custom UV.',
    inputs: [makePort('uv', 'UV', 'vec2', { defaultExpression: 'vUv' })],
    outputs: [makePort('color', 'Color', 'vec4')],
    createData: () => ({}),
  },
  addColor: {
    type: 'addColor',
    title: 'Add',
    category: 'Math',
    color: '#ff9f43',
    description: 'Adds two color vectors.',
    inputs: [
      makePort('a', 'A', 'vec4', { defaultExpression: 'sceneColor' }),
      makePort('b', 'B', 'vec4', { defaultExpression: 'vec4(0.0)' }),
    ],
    outputs: [makePort('color', 'Color', 'vec4')],
    createData: () => ({}),
  },
  multiplyColor: {
    type: 'multiplyColor',
    title: 'Multiply',
    category: 'Math',
    color: '#ff9f43',
    description: 'Multiplies two color vectors.',
    inputs: [
      makePort('a', 'A', 'vec4', { defaultExpression: 'sceneColor' }),
      makePort('b', 'B', 'vec4', { defaultExpression: 'vec4(1.0)' }),
    ],
    outputs: [makePort('color', 'Color', 'vec4')],
    createData: () => ({}),
  },
  mixColor: {
    type: 'mixColor',
    title: 'Mix',
    category: 'Math',
    color: '#ff9f43',
    description: 'Interpolates between two colors.',
    inputs: [
      makePort('a', 'A', 'vec4', { defaultExpression: 'sceneColor' }),
      makePort('b', 'B', 'vec4', { defaultExpression: 'vec4(1.0)' }),
      makePort('t', 'T', 'float', { usesControlValue: 'factor' }),
    ],
    outputs: [makePort('color', 'Color', 'vec4')],
    controls: [
      {
        id: 'factor',
        label: 'Factor',
        type: 'float',
        step: 0.01,
        min: 0,
        max: 1,
        defaultValue: 0.5,
      },
    ],
    createData: () => ({
      factor: 0.5,
    }),
  },
  addFloat: {
    type: 'addFloat',
    title: 'Add Float',
    category: 'Math',
    color: '#37d6bb',
    description: 'Adds two float values.',
    inputs: [
      makePort('a', 'A', 'float', { defaultExpression: '0.0' }),
      makePort('b', 'B', 'float', { defaultExpression: '0.0' }),
    ],
    outputs: [makePort('value', 'Value', 'float')],
    createData: () => ({}),
  },
  multiplyFloat: {
    type: 'multiplyFloat',
    title: 'Multiply Float',
    category: 'Math',
    color: '#37d6bb',
    description: 'Multiplies two float values.',
    inputs: [
      makePort('a', 'A', 'float', { defaultExpression: '1.0' }),
      makePort('b', 'B', 'float', { defaultExpression: '1.0' }),
    ],
    outputs: [makePort('value', 'Value', 'float')],
    createData: () => ({}),
  },
  sine: {
    type: 'sine',
    title: 'Sine',
    category: 'Math',
    color: '#37d6bb',
    description: 'Sine wave from a float input.',
    inputs: [makePort('value', 'Value', 'float', { defaultExpression: '0.0' })],
    outputs: [makePort('value', 'Value', 'float')],
    createData: () => ({}),
  },
  waveUv: {
    type: 'waveUv',
    title: 'Wave UV',
    category: 'Distortion',
    color: '#8f7dff',
    description: 'Applies animated horizontal wave distortion to UVs.',
    inputs: [
      makePort('uv', 'UV', 'vec2', { defaultExpression: 'vUv' }),
      makePort('time', 'Time', 'float', { defaultExpression: 'uTime' }),
      makePort('amplitude', 'Amp', 'float', { usesControlValue: 'amplitude' }),
      makePort('frequency', 'Freq', 'float', { usesControlValue: 'frequency' }),
      makePort('speed', 'Speed', 'float', { usesControlValue: 'speed' }),
    ],
    outputs: [makePort('uv', 'UV', 'vec2')],
    controls: [
      {
        id: 'amplitude',
        label: 'Amplitude',
        type: 'float',
        step: 0.001,
        min: 0,
        max: 0.08,
        defaultValue: 0.014,
      },
      {
        id: 'frequency',
        label: 'Frequency',
        type: 'float',
        step: 0.1,
        min: 0.5,
        max: 30,
        defaultValue: 14,
      },
      {
        id: 'speed',
        label: 'Speed',
        type: 'float',
        step: 0.05,
        min: -6,
        max: 6,
        defaultValue: 1.4,
      },
    ],
    createData: () => ({
      amplitude: 0.014,
      frequency: 14,
      speed: 1.4,
    }),
  },
  vignette: {
    type: 'vignette',
    title: 'Vignette',
    category: 'Post FX',
    color: '#ff708d',
    description: 'Darkens the screen toward the edges.',
    inputs: [
      makePort('color', 'Color', 'vec4', { defaultExpression: 'sceneColor' }),
      makePort('uv', 'UV', 'vec2', { defaultExpression: 'vUv' }),
      makePort('intensity', 'Intensity', 'float', {
        usesControlValue: 'intensity',
      }),
      makePort('softness', 'Softness', 'float', {
        usesControlValue: 'softness',
      }),
    ],
    outputs: [makePort('color', 'Color', 'vec4')],
    controls: [
      {
        id: 'intensity',
        label: 'Intensity',
        type: 'float',
        step: 0.01,
        min: 0,
        max: 1.5,
        defaultValue: 0.42,
      },
      {
        id: 'softness',
        label: 'Softness',
        type: 'float',
        step: 0.01,
        min: 0.05,
        max: 1,
        defaultValue: 0.58,
      },
    ],
    createData: () => ({
      intensity: 0.42,
      softness: 0.58,
    }),
  },
  posterize: {
    type: 'posterize',
    title: 'Posterize',
    category: 'Post FX',
    color: '#ff708d',
    description: 'Reduces color levels for stylized shading.',
    inputs: [
      makePort('color', 'Color', 'vec4', { defaultExpression: 'sceneColor' }),
      makePort('steps', 'Steps', 'float', { usesControlValue: 'steps' }),
    ],
    outputs: [makePort('color', 'Color', 'vec4')],
    controls: [
      {
        id: 'steps',
        label: 'Steps',
        type: 'float',
        step: 1,
        min: 2,
        max: 16,
        defaultValue: 5,
      },
    ],
    createData: () => ({
      steps: 5,
    }),
  },
};

export const shaderGraphNodePalette = [
  {
    category: 'Inputs',
    nodeTypes: ['screenColor', 'uv', 'time'],
  },
  {
    category: 'Parameters',
    nodeTypes: ['float', 'color'],
  },
  {
    category: 'Sampling',
    nodeTypes: ['sampleScene'],
  },
  {
    category: 'Math',
    nodeTypes: ['addColor', 'multiplyColor', 'mixColor', 'addFloat', 'multiplyFloat', 'sine'],
  },
  {
    category: 'Distortion',
    nodeTypes: ['waveUv'],
  },
  {
    category: 'Post FX',
    nodeTypes: ['vignette', 'posterize'],
  },
];

export const getShaderGraphNodeDefinition = type =>
  shaderGraphNodeDefinitions[type] || shaderGraphNodeDefinitions.output;

export const getShaderGraphNodeHeight = node => {
  const definition = getShaderGraphNodeDefinition(node.type);
  const rowCount = Math.max(
    definition.inputs.length,
    definition.outputs.length,
    1
  );
  const footerHeight =
    definition.controls && definition.controls.length
      ? SHADER_GRAPH_NODE_FOOTER_HEIGHT
      : 12;
  return (
    SHADER_GRAPH_NODE_HEADER_HEIGHT +
    rowCount * SHADER_GRAPH_NODE_PORT_HEIGHT +
    footerHeight
  );
};

const createNode = (type, x, y, forcedId) => {
  const definition = getShaderGraphNodeDefinition(type);
  return {
    id: forcedId || createNodeId(type),
    type,
    x,
    y,
    data: definition.createData ? definition.createData() : {},
  };
};

export const createShaderGraphNode = (type, x, y) => createNode(type, x, y);

export const createSoftVignetteShaderGraph = () => ({
  version: SHADER_GRAPH_VERSION,
  nodes: [
    createNode('screenColor', 120, 300, 'screen-color'),
    createNode('uv', 120, 520, 'uv'),
    createNode('vignette', 650, 330, 'vignette'),
    createNode('output', 1180, 360, 'output'),
  ],
  connections: [
    {
      fromNodeId: 'screen-color',
      fromPortId: 'color',
      toNodeId: 'vignette',
      toPortId: 'color',
    },
    {
      fromNodeId: 'uv',
      fromPortId: 'uv',
      toNodeId: 'vignette',
      toPortId: 'uv',
    },
    {
      fromNodeId: 'vignette',
      fromPortId: 'color',
      toNodeId: 'output',
      toPortId: 'color',
    },
  ],
});

export const createHeatDistortionShaderGraph = () => ({
  version: SHADER_GRAPH_VERSION,
  nodes: [
    createNode('uv', 120, 240, 'uv'),
    createNode('time', 120, 520, 'time'),
    createNode('waveUv', 640, 300, 'wave-uv'),
    createNode('sampleScene', 1170, 320, 'sample-scene'),
    createNode('output', 1690, 350, 'output'),
  ],
  connections: [
    {
      fromNodeId: 'uv',
      fromPortId: 'uv',
      toNodeId: 'wave-uv',
      toPortId: 'uv',
    },
    {
      fromNodeId: 'time',
      fromPortId: 'time',
      toNodeId: 'wave-uv',
      toPortId: 'time',
    },
    {
      fromNodeId: 'wave-uv',
      fromPortId: 'uv',
      toNodeId: 'sample-scene',
      toPortId: 'uv',
    },
    {
      fromNodeId: 'sample-scene',
      fromPortId: 'color',
      toNodeId: 'output',
      toPortId: 'color',
    },
  ],
});

export const createNeonPosterizeShaderGraph = () => ({
  version: SHADER_GRAPH_VERSION,
  nodes: [
    createNode('screenColor', 110, 210, 'screen-color'),
    {
      ...createNode('color', 120, 510, 'tint'),
      data: { color: '#44f1ff', alpha: 1 },
    },
    {
      ...createNode('mixColor', 640, 260, 'mix'),
      data: { factor: 0.58 },
    },
    {
      ...createNode('posterize', 1170, 290, 'posterize'),
      data: { steps: 5 },
    },
    createNode('output', 1690, 320, 'output'),
  ],
  connections: [
    {
      fromNodeId: 'screen-color',
      fromPortId: 'color',
      toNodeId: 'mix',
      toPortId: 'a',
    },
    {
      fromNodeId: 'tint',
      fromPortId: 'color',
      toNodeId: 'mix',
      toPortId: 'b',
    },
    {
      fromNodeId: 'mix',
      fromPortId: 'color',
      toNodeId: 'posterize',
      toPortId: 'color',
    },
    {
      fromNodeId: 'posterize',
      fromPortId: 'color',
      toNodeId: 'output',
      toPortId: 'color',
    },
  ],
});

export const shaderGraphTemplates = [
  {
    id: 'soft-vignette',
    label: 'Soft Vignette',
    description: 'Rounded cinematic edge darkening.',
    createGraph: createSoftVignetteShaderGraph,
  },
  {
    id: 'heat-distortion',
    label: 'Heat Distortion',
    description: 'Animated wavy screen-space refraction.',
    createGraph: createHeatDistortionShaderGraph,
  },
  {
    id: 'neon-posterize',
    label: 'Neon Posterize',
    description: 'Stylized bright cyan posterized pass.',
    createGraph: createNeonPosterizeShaderGraph,
  },
];

export const createDefaultShaderGraph = () => createSoftVignetteShaderGraph();

const coerceNumber = (value, fallback) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const coerceColor = (value, fallback) => {
  if (typeof value !== 'string') {
    return fallback;
  }
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return value.toLowerCase();
  }
  return fallback;
};

const sanitizeNode = rawNode => {
  if (!rawNode || typeof rawNode !== 'object' || typeof rawNode.type !== 'string') {
    return null;
  }
  const definition = shaderGraphNodeDefinitions[rawNode.type];
  if (!definition) {
    return null;
  }
  const defaultData = definition.createData ? definition.createData() : {};
  const nextData = { ...defaultData, ...(rawNode.data || {}) };
  if (definition.controls) {
    definition.controls.forEach(control => {
      if (control.type === 'float') {
        nextData[control.id] = coerceNumber(
          nextData[control.id],
          control.defaultValue
        );
      }
      if (control.type === 'color') {
        nextData[control.id] = coerceColor(
          nextData[control.id],
          control.defaultValue
        );
      }
    });
  }

  return {
    id: typeof rawNode.id === 'string' ? rawNode.id : createNodeId(rawNode.type),
    type: rawNode.type,
    x: coerceNumber(rawNode.x, 120),
    y: coerceNumber(rawNode.y, 120),
    data: nextData,
  };
};

const sanitizeConnection = rawConnection => {
  if (!rawConnection || typeof rawConnection !== 'object') {
    return null;
  }
  if (
    typeof rawConnection.fromNodeId !== 'string' ||
    typeof rawConnection.fromPortId !== 'string' ||
    typeof rawConnection.toNodeId !== 'string' ||
    typeof rawConnection.toPortId !== 'string'
  ) {
    return null;
  }
  return {
    fromNodeId: rawConnection.fromNodeId,
    fromPortId: rawConnection.fromPortId,
    toNodeId: rawConnection.toNodeId,
    toPortId: rawConnection.toPortId,
  };
};

export const sanitizeShaderGraphDefinition = rawGraph => {
  if (!rawGraph || typeof rawGraph !== 'object') {
    return createDefaultShaderGraph();
  }

  const nodes = Array.isArray(rawGraph.nodes)
    ? rawGraph.nodes.map(sanitizeNode).filter(Boolean)
    : [];
  const connections = Array.isArray(rawGraph.connections)
    ? rawGraph.connections.map(sanitizeConnection).filter(Boolean)
    : [];

  const hasOutput = nodes.some(node => node.type === 'output');
  if (!hasOutput) {
    nodes.push(createNode('output', 1180, 360, 'output'));
  }

  return {
    version: SHADER_GRAPH_VERSION,
    nodes: nodes.length ? nodes : createDefaultShaderGraph().nodes,
    connections,
  };
};

export const parseShaderGraphDefinition = source => {
  if (!source) {
    return createDefaultShaderGraph();
  }
  try {
    return sanitizeShaderGraphDefinition(JSON.parse(source));
  } catch (error) {
    console.warn('Unable to parse shader graph definition, using default.', error);
    return createDefaultShaderGraph();
  }
};

export const serializeShaderGraphDefinition = graph =>
  JSON.stringify(sanitizeShaderGraphDefinition(graph));

export const isShaderGraphEffect = effect =>
  !!effect &&
  typeof effect.getEffectType === 'function' &&
  effect.getEffectType() === SHADER_GRAPH_EFFECT_TYPE;

export const getShaderGraphDefinitionFromEffect = effect => {
  if (
    !effect ||
    typeof effect.hasStringParameter !== 'function' ||
    !effect.hasStringParameter(SHADER_GRAPH_DEFINITION_PARAMETER)
  ) {
    return createDefaultShaderGraph();
  }
  return parseShaderGraphDefinition(
    effect.getStringParameter(SHADER_GRAPH_DEFINITION_PARAMETER)
  );
};

export const getShaderGraphStrengthFromEffect = effect => {
  if (
    !effect ||
    typeof effect.hasDoubleParameter !== 'function' ||
    !effect.hasDoubleParameter(SHADER_GRAPH_STRENGTH_PARAMETER)
  ) {
    return 1;
  }
  return coerceNumber(effect.getDoubleParameter(SHADER_GRAPH_STRENGTH_PARAMETER), 1);
};

export const getShaderGraphPortColor = type =>
  shaderGraphPortColors[type] || '#cfd8ea';

export const getShaderGraphNodeSummary = node => {
  const definition = getShaderGraphNodeDefinition(node.type);
  if (!definition.controls || !definition.controls.length) {
    return null;
  }
  return definition.controls
    .slice(0, 2)
    .map(control => {
      const rawValue = node.data ? node.data[control.id] : control.defaultValue;
      if (control.type === 'color') {
        return rawValue || control.defaultValue;
      }
      const numericValue = coerceNumber(rawValue, control.defaultValue);
      return Number.isInteger(numericValue)
        ? `${control.label}: ${numericValue}`
        : `${control.label}: ${numericValue.toFixed(2)}`;
    })
    .join(' • ');
};

export const duplicateShaderGraph = graph =>
  sanitizeShaderGraphDefinition(clone(graph));
