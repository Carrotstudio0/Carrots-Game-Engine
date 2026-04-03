const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');

const readJson = relativePath => {
  const absolutePath = path.join(repoRoot, relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
};

const readText = relativePath =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const fail = message => {
  console.error(message);
  process.exitCode = 1;
};

const checkDependencies = () => {
  const gdjsPackage = readJson('GDJS/package.json');
  const idePackage = readJson('newIDE/app/package.json');
  const threeAddonsPackage = readJson('SharedLibs/ThreeAddons/package.json');

  const expectedThreeVersion = gdjsPackage.devDependencies?.three;
  const expectedPixiVersion = gdjsPackage.devDependencies?.['pixi.js'];

  const mismatches = [];

  if (idePackage.dependencies?.three !== expectedThreeVersion) {
    mismatches.push(
      `newIDE/app/package.json dependencies.three=${idePackage.dependencies?.three} (expected ${expectedThreeVersion})`
    );
  }

  if (idePackage.dependencies?.['pixi.js'] !== expectedPixiVersion) {
    mismatches.push(
      `newIDE/app/package.json dependencies.pixi.js=${idePackage.dependencies?.['pixi.js']} (expected ${expectedPixiVersion})`
    );
  }

  if (threeAddonsPackage.devDependencies?.three !== expectedThreeVersion) {
    mismatches.push(
      `SharedLibs/ThreeAddons/package.json devDependencies.three=${threeAddonsPackage.devDependencies?.three} (expected ${expectedThreeVersion})`
    );
  }

  if (mismatches.length) {
    fail(
      `Dependency drift detected for WebGPU stack:\n- ${mismatches.join('\n- ')}`
    );
  }
};

const forbiddenPatterns = [
  {
    label: 'THREE.WebGLRenderer constructor',
    pattern: /new\s+THREE\.WebGLRenderer\s*\(/,
  },
  {
    label: 'PIXI.WebGLRenderer constructor',
    pattern: /new\s+PIXI\.WebGLRenderer\s*\(/,
  },
  {
    label: 'Direct WebGL context creation',
    pattern: /getContext\(\s*['"]webgl2?['"]/,
  },
  {
    label: 'Three private __webglTexture interop',
    pattern: /__webglTexture/,
  },
  {
    label: 'Legacy Three.js ShaderMaterial constructor',
    pattern: /new\s+THREE\.ShaderMaterial\s*\(/,
  },
  {
    label: 'Legacy Three.js RawShaderMaterial constructor',
    pattern: /new\s+THREE\.RawShaderMaterial\s*\(/,
  },
  {
    label: 'Legacy onBeforeCompile shader hook',
    pattern: /\.onBeforeCompile\b/,
  },
];

const guardedFiles = [
  'GDJS/Runtime/runtimegame.ts',
  'GDJS/Runtime/runtimescene.ts',
  'GDJS/Runtime/debugger-client/abstract-debugger-client.ts',
  'GDJS/Runtime/pixi-renderers/runtimegame-pixi-renderer.ts',
  'GDJS/Runtime/pixi-renderers/runtimescene-pixi-renderer.ts',
  'GDJS/Runtime/pixi-renderers/layer-pixi-renderer.ts',
  'newIDE/app/src/MainFrame/index.js',
  'newIDE/app/src/InstancesEditor/index.js',
  'newIDE/app/src/InstancesEditor/InstancesRenderer/index.js',
  'newIDE/app/src/InstancesEditor/InstancesRenderer/LayerRenderer.js',
  'newIDE/app/src/ObjectEditor/Editors/Model3DAnimationEditor.js',
  'newIDE/app/src/ResourcesList/ResourcePreview/Resource3DPreview.worker.js',
  'newIDE/app/src/ProjectCreation/NewProjectSetupDialog.js',
  'newIDE/app/src/ProjectManager/ProjectPropertiesDialog.js',
  'newIDE/app/src/Utils/ThreeRenderingQuality.js',
  'newIDE/app/src/Utils/WebGL.js',
  'newIDE/app/src/MainFrame/Preferences/PreferencesContext.js',
];

const checkForbiddenPatterns = () => {
  const violations = [];

  for (const relativePath of guardedFiles) {
    const content = readText(relativePath);
    for (const { label, pattern } of forbiddenPatterns) {
      if (pattern.test(content)) {
        violations.push(`${relativePath}: ${label}`);
      }
    }
  }

  if (violations.length) {
    fail(`WebGL usage detected in WebGPU-only guarded files:\n- ${violations.join('\n- ')}`);
  }
};

const run = () => {
  checkDependencies();
  checkForbiddenPatterns();

  if (!process.exitCode) {
    console.log('WebGPU-only checks passed.');
  }
};

run();
