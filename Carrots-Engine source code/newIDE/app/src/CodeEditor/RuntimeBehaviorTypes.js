// @flow
import optionalRequire from '../Utils/OptionalRequire';
const localGDJSFinder = optionalRequire('../GameEngineFinder/LocalGDJSFinder');
const findGDJS =
  localGDJSFinder && typeof localGDJSFinder.findGDJS === 'function'
    ? localGDJSFinder.findGDJS
    : null;
const fs = optionalRequire('fs');
const path = optionalRequire('path');

export type RuntimeBehaviorTypesByType = { [string]: string };

let runtimeBehaviorTypesByTypePromise: ?Promise<RuntimeBehaviorTypesByType> =
  null;

const registerBehaviorPattern =
  /gdjs\.registerBehavior\s*\(\s*(['"`])([^'"`]+)\1\s*,\s*([A-Za-z0-9_$.]+)/g;

const isRuntimeSourceFile = (filename: string): boolean =>
  filename.endsWith('.ts') || filename.endsWith('.js');

const isTypeReference = (value: string): boolean =>
  /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/.test(value);

const isExistingDirectory = (directoryPath: string): boolean => {
  if (!directoryPath) return false;
  try {
    return fs.existsSync(directoryPath) && fs.lstatSync(directoryPath).isDirectory();
  } catch (error) {
    return false;
  }
};

const getRuntimeSourceFiles = (rootPath: string): Array<string> => {
  const sourceFiles = [];
  const foldersToRead = [rootPath];

  while (foldersToRead.length) {
    const currentFolderPath = foldersToRead.pop();
    if (!currentFolderPath) continue;

    let entries;
    try {
      entries = fs.readdirSync(currentFolderPath);
    } catch (error) {
      continue;
    }

    entries.forEach(entryName => {
      const entryPath = path.join(currentFolderPath, entryName);
      let entryStats;
      try {
        entryStats = fs.lstatSync(entryPath);
      } catch (error) {
        return;
      }

      if (entryStats.isDirectory()) {
        foldersToRead.push(entryPath);
        return;
      }

      if (entryStats.isFile() && isRuntimeSourceFile(entryName)) {
        sourceFiles.push(entryPath);
      }
    });
  }

  return sourceFiles;
};

const extractBehaviorTypesFromContent = (
  content: string,
  output: RuntimeBehaviorTypesByType
) => {
  registerBehaviorPattern.lastIndex = 0;
  let match = registerBehaviorPattern.exec(content);
  while (match) {
    const runtimeBehaviorType = match[2];
    const constructorTypeReference = match[3].replace(/\s+/g, '');
    if (runtimeBehaviorType && isTypeReference(constructorTypeReference)) {
      output[runtimeBehaviorType] = constructorTypeReference;
    }

    match = registerBehaviorPattern.exec(content);
  }
};

const loadRuntimeBehaviorTypesByType = async (): Promise<RuntimeBehaviorTypesByType> => {
  if (!fs || !path || !findGDJS) return {};

  let gdjsRoot = '';
  try {
    const findResult = await findGDJS();
    gdjsRoot = (findResult && findResult.gdjsRoot) || '';
  } catch (error) {
    return {};
  }
  if (!gdjsRoot) return {};

  const sourceRootCandidates = [
    path.join(gdjsRoot, 'Runtime-sources'),
    path.join(gdjsRoot, 'Runtime'),
    path.join(gdjsRoot, 'Extensions'),
    path.join(gdjsRoot, 'GDJS', 'Extensions'),
  ].filter(isExistingDirectory);
  if (!sourceRootCandidates.length) return {};

  const behaviorTypesByType = {};
  const runtimeSourceFiles = Array.from(
    new Set(
      sourceRootCandidates.flatMap(sourceRoot =>
        getRuntimeSourceFiles(sourceRoot)
      )
    )
  );
  runtimeSourceFiles.forEach(sourceFilePath => {
    let content;
    try {
      content = fs.readFileSync(sourceFilePath, 'utf8');
    } catch (error) {
      return;
    }

    extractBehaviorTypesFromContent(content, behaviorTypesByType);
  });

  return behaviorTypesByType;
};

export const preloadRuntimeBehaviorTypesByType = (): void => {
  if (!runtimeBehaviorTypesByTypePromise) {
    runtimeBehaviorTypesByTypePromise = loadRuntimeBehaviorTypesByType().catch(
      error => {
        console.error('Unable to preload runtime behavior types.', error);
        return {};
      }
    );
  }
};

export const getRuntimeBehaviorTypesByType = (): Promise<RuntimeBehaviorTypesByType> => {
  preloadRuntimeBehaviorTypesByType();
  return runtimeBehaviorTypesByTypePromise || Promise.resolve({});
};
