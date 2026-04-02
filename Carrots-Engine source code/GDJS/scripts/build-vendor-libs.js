const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { rollup } = require('rollup');
const { nodeResolve } = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');

const gdjsRoot = path.join(__dirname, '..');
const gdevelopRoot = path.join(gdjsRoot, '..');
const runtimePixiRenderersPath = path.join(gdjsRoot, 'Runtime', 'pixi-renderers');
const spineVendorPath = path.join(
  gdevelopRoot,
  'Extensions',
  'Spine',
  'spine-pixi-v8'
);

const bundles = [
  {
    entry: path.join(__dirname, 'vendor', 'three.entry.js'),
    output: path.join(runtimePixiRenderersPath, 'three.js'),
    globalName: 'THREE',
  },
  {
    entry: path.join(__dirname, 'vendor', 'three-webgpu.entry.js'),
    output: path.join(runtimePixiRenderersPath, 'three.webgpu.js'),
    globalName: 'THREE_WEBGPU',
  },
  {
    entry: path.join(__dirname, 'vendor', 'three-tsl.entry.js'),
    output: path.join(runtimePixiRenderersPath, 'three.tsl.js'),
    globalName: 'THREE_TSL',
  },
  {
    entry: path.join(__dirname, 'vendor', 'three-addons.entry.js'),
    output: path.join(runtimePixiRenderersPath, 'ThreeAddons.js'),
    globalName: 'THREE_ADDONS',
    external: ['three'],
    globals: {
      three: 'THREE',
    },
  },
  {
    entry: path.join(__dirname, 'vendor', 'pixi.entry.js'),
    output: path.join(runtimePixiRenderersPath, 'pixi.js'),
    globalName: 'PIXI',
  },
  {
    entry: path.join(__dirname, 'vendor', 'spine-pixi-v8.entry.js'),
    output: path.join(spineVendorPath, 'spine-pixi-v8.js'),
    globalName: 'spine',
    external: ['pixi.js'],
    globals: {
      'pixi.js': 'PIXI',
    },
  },
];

const normalizeNewlines = (content) => content.replace(/\r\n/g, '\n');

const hashOf = (content) =>
  crypto.createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 12);

const appendPixiCompatShim = (code) => {
  return `${code}
(function () {
  if (typeof PIXI === 'undefined' || !PIXI) return;
  var pixi = PIXI;
  if (!pixi.filters) pixi.filters = {};
  if (!pixi.Renderer && pixi.WebGLRenderer) pixi.Renderer = pixi.WebGLRenderer;
  if (!pixi.BaseTexture && pixi.TextureSource) pixi.BaseTexture = pixi.TextureSource;
  if (pixi.BaseTexture && !pixi.BaseTexture.removeFromCache && pixi.Texture && pixi.Texture.removeFromCache) {
    pixi.BaseTexture.removeFromCache = pixi.Texture.removeFromCache;
  }
  if (!pixi.RENDERER_TYPE && pixi.RendererType) pixi.RENDERER_TYPE = pixi.RendererType;
  if (!pixi.TEXT_GRADIENT) {
    pixi.TEXT_GRADIENT = {
      LINEAR_VERTICAL: 0,
      LINEAR_HORIZONTAL: 1,
    };
  }
  if (!pixi.BLEND_MODES) {
    if (pixi.BlendMode) {
      pixi.BLEND_MODES = pixi.BlendMode;
    } else {
      pixi.BLEND_MODES = {
        NORMAL: 'normal',
        ADD: 'add',
        MULTIPLY: 'multiply',
        SCREEN: 'screen',
        OVERLAY: 'overlay',
        DARKEN: 'darken',
        LIGHTEN: 'lighten',
        COLOR_DODGE: 'color-dodge',
        COLOR_BURN: 'color-burn',
        HARD_LIGHT: 'hard-light',
        SOFT_LIGHT: 'soft-light',
        DIFFERENCE: 'difference',
        EXCLUSION: 'exclusion',
        HUE: 'hue',
        SATURATION: 'saturation',
        COLOR: 'color',
        LUMINOSITY: 'luminosity',
        ERASE: 'erase',
        SUBTRACT: 'subtract',
        XOR: 'xor',
      };
    }
  }
  if (!pixi.settings) pixi.settings = {};
  if (typeof pixi.settings.ROUND_PIXELS === 'undefined') pixi.settings.ROUND_PIXELS = false;
  if (!pixi.utils) pixi.utils = {};
  if (!pixi.utils.hex2rgb) {
    pixi.utils.hex2rgb = function (hex, out) {
      var rgb = out || [0, 0, 0];
      rgb[0] = ((hex >> 16) & 255) / 255;
      rgb[1] = ((hex >> 8) & 255) / 255;
      rgb[2] = (hex & 255) / 255;
      return rgb;
    };
  }
  if (!pixi.utils.hex2string) {
    pixi.utils.hex2string = function (hex) {
      var normalized = (hex >>> 0).toString(16);
      while (normalized.length < 6) normalized = '0' + normalized;
      return '#' + normalized;
    };
  }
  if (!pixi.utils.string2hex) {
    pixi.utils.string2hex = function (value) {
      if (typeof value !== 'string') return 0;
      var normalized = value.trim();
      if (!normalized) return 0;
      if (normalized[0] === '#') normalized = normalized.slice(1);
      if (normalized.length === 3) {
        normalized =
          normalized[0] +
          normalized[0] +
          normalized[1] +
          normalized[1] +
          normalized[2] +
          normalized[2];
      }
      var parsed = Number.parseInt(normalized, 16);
      return Number.isFinite(parsed) ? parsed : 0;
    };
  }
  if (!pixi.utils.rgb2hex) {
    pixi.utils.rgb2hex = function (rgb) {
      return (
        ((Math.round((rgb[0] || 0) * 255) & 255) << 16) |
        ((Math.round((rgb[1] || 0) * 255) & 255) << 8) |
        (Math.round((rgb[2] || 0) * 255) & 255)
      );
    };
  }
  if (!pixi.utils.isWebGLSupported && pixi.isWebGLSupported) {
    pixi.utils.isWebGLSupported = pixi.isWebGLSupported;
  }
})();
`;
};

const buildBundle = async (bundleConfig) => {
  const bundle = await rollup({
    input: bundleConfig.entry,
    external: bundleConfig.external || [],
    plugins: [
      nodeResolve({ browser: true, preferBuiltins: false }),
      commonjs(),
    ],
  });

  try {
    const { output } = await bundle.generate({
      format: 'iife',
      name: bundleConfig.globalName,
      globals: bundleConfig.globals || {},
      exports: 'named',
      compact: true,
      freeze: false,
      esModule: false,
      generatedCode: 'es2015',
      inlineDynamicImports: true,
    });

    const chunk = output.find((entry) => entry.type === 'chunk');
    if (!chunk) {
      throw new Error(`Could not generate code for ${bundleConfig.output}.`);
    }

    let code = normalizeNewlines(chunk.code);
    if (bundleConfig.globalName === 'PIXI') {
      code = appendPixiCompatShim(code);
    }
    return code.endsWith('\n') ? code : `${code}\n`;
  } finally {
    await bundle.close();
  }
};

const syncVendorLibs = async ({ checkOnly }) => {
  const mismatches = [];
  const writtenFiles = [];

  for (const bundleConfig of bundles) {
    const generatedContent = await buildBundle(bundleConfig);
    let currentContent = '';

    try {
      currentContent = normalizeNewlines(
        await fs.readFile(bundleConfig.output, 'utf8')
      );
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    if (currentContent !== generatedContent) {
      mismatches.push({
        output: bundleConfig.output,
        currentHash: hashOf(currentContent),
        generatedHash: hashOf(generatedContent),
      });

      if (!checkOnly) {
        await fs.writeFile(bundleConfig.output, generatedContent, 'utf8');
        writtenFiles.push(bundleConfig.output);
      }
    }
  }

  return { mismatches, writtenFiles };
};

const checkVendorLibs = async () => {
  const { mismatches } = await syncVendorLibs({ checkOnly: true });
  if (!mismatches.length) {
    return;
  }

  const details = mismatches
    .map(
      ({ output, currentHash, generatedHash }) =>
        `- ${path.relative(gdjsRoot, output)} (current=${currentHash}, generated=${generatedHash})`
    )
    .join('\n');

  throw new Error(
    `Vendor libraries are out of date.\n${details}\nRun "npm run build-vendor-libs" in GDJS.`
  );
};

const buildVendorLibs = async () => {
  const { writtenFiles } = await syncVendorLibs({ checkOnly: false });
  if (!writtenFiles.length) {
    console.log('Vendor libraries are already up to date.');
    return;
  }

  console.log(
    `Updated ${writtenFiles.length} vendor file(s):\n${writtenFiles
      .map((output) => `- ${path.relative(gdjsRoot, output)}`)
      .join('\n')}`
  );
};

if (require.main === module) {
  const checkOnly = process.argv.includes('--check');
  (checkOnly ? checkVendorLibs() : buildVendorLibs()).catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  });
}

module.exports = {
  buildVendorLibs,
  checkVendorLibs,
};
