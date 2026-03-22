const fs = require('fs');
const path = require('path');

const srcRoot = path.resolve(__dirname, '..', '..');

const collectJavaScriptFiles = directoryPath =>
  fs.readdirSync(directoryPath, { withFileTypes: true }).flatMap(entry => {
    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'locales') {
        return [];
      }
      return collectJavaScriptFiles(absolutePath);
    }

    if (!entry.name.endsWith('.js') || entry.name.endsWith('.spec.js')) {
      return [];
    }

    return [absolutePath];
  });

const compatFiles = new Set([
  'Utils/PixiCompat/applyPixiCompat.js',
  'Utils/PixiCompat/EditorPixiAdapter.js',
]);

const adapterOnlyFiles = new Set(['Utils/PixiCompat/EditorPixiAdapter.js']);

const auditRules = [
  {
    name: 'legacy PIXI.Texture.from({ resource })',
    pattern: /PIXI\.Texture\.from\(\{\s*resource:/g,
    allowedFiles: compatFiles,
  },
  {
    name: 'legacy baseTexture.resource access',
    pattern: /baseTexture\.resource\./g,
    allowedFiles: compatFiles,
  },
  {
    name: 'legacy baseTexture.valid access',
    pattern: /baseTexture\.valid/g,
    allowedFiles: compatFiles,
  },
  {
    name: 'legacy baseTexture.scaleMode access',
    pattern: /baseTexture\.scaleMode/g,
    allowedFiles: compatFiles,
  },
  {
    name: 'legacy renderTexture.current access',
    pattern: /renderTexture\.current/g,
    allowedFiles: new Set(),
  },
  {
    name: 'legacy renderTexture.sourceFrame access',
    pattern: /renderTexture\.sourceFrame/g,
    allowedFiles: new Set(),
  },
  {
    name: 'legacy renderTexture.bind call',
    pattern: /renderTexture\.bind\(/g,
    allowedFiles: new Set(),
  },
  {
    name: 'legacy renderTexture.clear call',
    pattern: /renderTexture\.clear\(/g,
    allowedFiles: new Set(),
  },
  {
    name: 'legacy Pixi private _glTextures access',
    pattern: /\._glTextures\b/g,
    allowedFiles: adapterOnlyFiles,
  },
  {
    name: 'legacy Pixi CONTEXT_UID access',
    pattern: /\bCONTEXT_UID\b/g,
    allowedFiles: adapterOnlyFiles,
  },
  {
    name: 'legacy pixiRenderer.reset alias usage',
    pattern: /pixiRenderer\.reset\(/g,
    allowedFiles: new Set(),
  },
  {
    name: 'Pixi addEventListener alias usage',
    pattern:
      /\b(?:interceptingSprite|objectButton|backgroundArea|pixiDisplayObject)\.addEventListener\(|_pixiObject\.addEventListener\(/g,
    allowedFiles: new Set(),
  },
  {
    name: 'Pixi removeEventListener alias usage',
    pattern:
      /\b(?:interceptingSprite|objectButton|backgroundArea|pixiDisplayObject)\.removeEventListener\(|_pixiObject\.removeEventListener\(/g,
    allowedFiles: new Set(),
  },
];

describe('Pixi legacy source audit', () => {
  it('keeps editor-side Pixi v8 migrations inside the compat boundary', () => {
    const files = collectJavaScriptFiles(srcRoot);
    const violations = [];

    files.forEach(absolutePath => {
      const relativePath = path
        .relative(srcRoot, absolutePath)
        .replace(/\\/g, '/');
      const contents = fs.readFileSync(absolutePath, 'utf8');

      auditRules.forEach(rule => {
        if (rule.allowedFiles.has(relativePath)) {
          return;
        }

        rule.pattern.lastIndex = 0;
        if (rule.pattern.test(contents)) {
          violations.push(`${relativePath}: ${rule.name}`);
        }
      });
    });

    expect(violations).toEqual([]);
  });
});
