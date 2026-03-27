// @flow
import optionalRequire from '../Utils/OptionalRequire';

const fs = optionalRequire('fs');
const path = optionalRequire('path');

export type ProjectTypeScriptScriptIncludePosition = 'first' | 'last';
export type ProjectTypeScriptScriptContextKind =
  | 'project'
  | 'scene'
  | 'object'
  | 'behavior';

export type ProjectTypeScriptScript = {|
  id: string,
  name: string,
  source: string,
  transpiledCode: string,
  includePosition: ProjectTypeScriptScriptIncludePosition,
  contextKind: ProjectTypeScriptScriptContextKind,
  sceneName: string,
  objectName: string,
  behaviorName: string,
|};

type ScriptPathResolution = {|
  scriptsRootDirectory: string,
  absoluteFilePath: string,
  relativeScriptPath: string,
|};

type LoadProjectTypeScriptScriptsOptions = {|
  projectFilePath?: ?string,
|};

type SaveProjectTypeScriptScriptsOptions = {|
  projectFilePath?: ?string,
  previousScripts?: ?Array<ProjectTypeScriptScript>,
|};

export const TYPE_SCRIPT_PROJECT_SCRIPTS_EXTENSION_NAME = 'GDevelopEditor';
export const TYPE_SCRIPT_PROJECT_SCRIPTS_PROPERTY_NAME =
  'typeScriptProjectScripts';
export const TYPE_SCRIPT_PROJECT_SCRIPTS_VERSION = 1;
export const TYPE_SCRIPT_PROJECT_SCRIPTS_SOURCE_DIRECTORY = 'source/scripts';

const sanitizeIncludePosition = (
  includePosition: any
): ProjectTypeScriptScriptIncludePosition =>
  includePosition === 'first' ? 'first' : 'last';

const sanitizeContextKind = (
  contextKind: any
): ProjectTypeScriptScriptContextKind => {
  if (contextKind === 'scene') return 'scene';
  if (contextKind === 'object') return 'object';
  if (contextKind === 'behavior') return 'behavior';
  return 'project';
};

const sanitizeScript = (
  rawScript: any,
  index: number
): ProjectTypeScriptScript => {
  const id =
    typeof rawScript.id === 'string' && rawScript.id
      ? rawScript.id
      : `ts-script-${index}`;
  const name =
    typeof rawScript.name === 'string' && rawScript.name
      ? rawScript.name
      : `Script${index + 1}.ts`;

  return {
    id,
    name,
    source: typeof rawScript.source === 'string' ? rawScript.source : '',
    transpiledCode:
      typeof rawScript.transpiledCode === 'string'
        ? rawScript.transpiledCode
        : '',
    includePosition: sanitizeIncludePosition(rawScript.includePosition),
    contextKind: sanitizeContextKind(rawScript.contextKind),
    sceneName: typeof rawScript.sceneName === 'string' ? rawScript.sceneName : '',
    objectName:
      typeof rawScript.objectName === 'string' ? rawScript.objectName : '',
    behaviorName:
      typeof rawScript.behaviorName === 'string' ? rawScript.behaviorName : '',
  };
};

const sanitizeScripts = (rawScripts: any): Array<ProjectTypeScriptScript> => {
  if (!Array.isArray(rawScripts)) return [];

  const usedIds = new Set<string>();
  const uniqueScripts = [];
  rawScripts.forEach((rawScript, index) => {
    const script = sanitizeScript(rawScript, index);
    if (usedIds.has(script.id)) {
      const dedupedScript = {
        ...script,
        id: `${script.id}-${index}`,
      };
      usedIds.add(dedupedScript.id);
      uniqueScripts.push(dedupedScript);
      return;
    }

    usedIds.add(script.id);
    uniqueScripts.push(script);
  });
  return uniqueScripts;
};

const buildSerializedScripts = (
  scripts: Array<ProjectTypeScriptScript>
): string =>
  JSON.stringify({
    version: TYPE_SCRIPT_PROJECT_SCRIPTS_VERSION,
    scripts,
  });

const sanitizeScriptPathSegment = (pathSegment: string): string => {
  const withoutReservedCharacters = (pathSegment || '')
    .trim()
    .replace(/[<>:"/\\|?*]/g, '_');
  const sanitizedPathSegment = withoutReservedCharacters
    .split('')
    .map(character => (character.charCodeAt(0) < 32 ? '_' : character))
    .join('');
  return sanitizedPathSegment || 'Script';
};

const normalizeScriptRelativePath = (
  scriptName: string,
  fallbackName: string
): string => {
  const trimmedPath = (scriptName || '').trim();
  const normalizedPath = (trimmedPath || fallbackName)
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  const sanitizedPath = normalizedPath
    .split('/')
    .filter(segment => !!segment)
    .map(sanitizeScriptPathSegment)
    .join('/');
  if (!sanitizedPath) return `${sanitizeScriptPathSegment(fallbackName)}.ts`;
  if (/\.[cm]?[jt]sx?$/i.test(sanitizedPath)) return sanitizedPath;
  return `${sanitizedPath}.ts`;
};

const getProjectFilePath = (
  project: gdProject,
  options?: LoadProjectTypeScriptScriptsOptions | SaveProjectTypeScriptScriptsOptions
): ?string => {
  if (options && options.projectFilePath) return options.projectFilePath;
  if (!project || typeof project.getProjectFile !== 'function') return null;
  const projectFilePath = project.getProjectFile();
  return typeof projectFilePath === 'string' && projectFilePath
    ? projectFilePath
    : null;
};

const getProjectDirectoryPath = (
  project: gdProject,
  options?: LoadProjectTypeScriptScriptsOptions | SaveProjectTypeScriptScriptsOptions
): ?string => {
  if (!fs || !path) return null;
  const projectFilePath = getProjectFilePath(project, options);
  if (!projectFilePath || !path.isAbsolute(projectFilePath)) return null;
  const projectDirectoryPath = path.dirname(projectFilePath);
  if (!projectDirectoryPath) return null;

  try {
    if (!fs.existsSync(projectDirectoryPath)) return null;
  } catch (error) {
    return null;
  }

  return projectDirectoryPath;
};

const getScriptPathResolution = (
  projectDirectoryPath: string,
  script: ProjectTypeScriptScript
): ?ScriptPathResolution => {
  if (!path) return null;
  const scriptsRootDirectory = path.resolve(
    path.join(projectDirectoryPath, TYPE_SCRIPT_PROJECT_SCRIPTS_SOURCE_DIRECTORY)
  );
  const relativeScriptPath = normalizeScriptRelativePath(
    script.name,
    script.id || 'script'
  );
  const absoluteFilePath = path.resolve(
    scriptsRootDirectory,
    ...relativeScriptPath.split('/')
  );
  const relativePathFromScriptsRoot = path.relative(
    scriptsRootDirectory,
    absoluteFilePath
  );
  if (
    !relativePathFromScriptsRoot ||
    relativePathFromScriptsRoot.startsWith('..') ||
    path.isAbsolute(relativePathFromScriptsRoot)
  ) {
    return null;
  }
  return {
    scriptsRootDirectory,
    absoluteFilePath,
    relativeScriptPath: relativeScriptPath.replace(/\\/g, '/'),
  };
};

const ensureDirectoryExists = (directoryPath: string): void => {
  if (!fs || !directoryPath) return;
  fs.mkdirSync(directoryPath, { recursive: true });
};

const deleteFileIfExists = (filePath: string): void => {
  if (!fs || !filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    // Ignore local filesystem cleanup errors.
  }
};

const removeEmptyDirectoriesUpward = (
  startDirectoryPath: string,
  stopAtDirectoryPath: string
) => {
  if (!fs || !path) return;

  let currentDirectoryPath = startDirectoryPath;
  while (currentDirectoryPath && currentDirectoryPath !== stopAtDirectoryPath) {
    try {
      const directoryEntries = fs.readdirSync(currentDirectoryPath);
      if (directoryEntries.length > 0) break;
      fs.rmdirSync(currentDirectoryPath);
      currentDirectoryPath = path.dirname(currentDirectoryPath);
    } catch (error) {
      break;
    }
  }
};

const inferContextFromRelativeScriptPath = (
  relativeScriptPath: string
): {|
  contextKind: ProjectTypeScriptScriptContextKind,
  sceneName: string,
  objectName: string,
  behaviorName: string,
|} => {
  const scriptPath = relativeScriptPath.replace(/\\/g, '/');
  const pathParts = scriptPath.split('/').filter(part => !!part);
  if (pathParts.length >= 3 && pathParts[0] === 'scenes') {
    const sceneName = pathParts[1];
    if (pathParts.length === 3 && pathParts[2] === 'scene.ts') {
      return {
        contextKind: 'scene',
        sceneName,
        objectName: '',
        behaviorName: '',
      };
    }
    if (pathParts.length >= 4 && pathParts[2] === 'objects') {
      const objectName = path.basename(pathParts.slice(3).join('/'), '.ts');
      return {
        contextKind: 'object',
        sceneName,
        objectName,
        behaviorName: '',
      };
    }
    if (pathParts.length >= 4 && pathParts[2] === 'behaviors') {
      const behaviorFileName = path.basename(pathParts.slice(3).join('/'), '.ts');
      const separatorIndex = behaviorFileName.lastIndexOf('.');
      return {
        contextKind: 'behavior',
        sceneName,
        objectName:
          separatorIndex === -1
            ? behaviorFileName
            : behaviorFileName.slice(0, separatorIndex),
        behaviorName:
          separatorIndex === -1 ? '' : behaviorFileName.slice(separatorIndex + 1),
      };
    }
  }
  if (pathParts.length >= 3 && pathParts[0] === 'global') {
    if (pathParts[1] === 'objects') {
      const objectName = path.basename(pathParts.slice(2).join('/'), '.ts');
      return {
        contextKind: 'object',
        sceneName: '',
        objectName,
        behaviorName: '',
      };
    }
    if (pathParts[1] === 'behaviors') {
      const behaviorFileName = path.basename(pathParts.slice(2).join('/'), '.ts');
      const separatorIndex = behaviorFileName.lastIndexOf('.');
      return {
        contextKind: 'behavior',
        sceneName: '',
        objectName:
          separatorIndex === -1
            ? behaviorFileName
            : behaviorFileName.slice(0, separatorIndex),
        behaviorName:
          separatorIndex === -1 ? '' : behaviorFileName.slice(separatorIndex + 1),
      };
    }
  }
  return {
    contextKind: 'project',
    sceneName: '',
    objectName: '',
    behaviorName: '',
  };
};

const discoverScriptsFromLocalFiles = (
  projectDirectoryPath: string
): Array<ProjectTypeScriptScript> => {
  if (!fs || !path) return [];
  const scriptsRootDirectory = path.resolve(
    path.join(projectDirectoryPath, TYPE_SCRIPT_PROJECT_SCRIPTS_SOURCE_DIRECTORY)
  );
  if (!fs.existsSync(scriptsRootDirectory)) return [];

  const discoveredScripts = [];
  const directoriesToRead = [scriptsRootDirectory];
  while (directoriesToRead.length) {
    const currentDirectoryPath = directoriesToRead.pop();
    if (!currentDirectoryPath) continue;

    let directoryEntries = [];
    try {
      directoryEntries = fs.readdirSync(currentDirectoryPath);
    } catch (error) {
      continue;
    }

    directoryEntries.forEach(entryName => {
      const entryPath = path.join(currentDirectoryPath, entryName);
      let entryStats = null;
      try {
        entryStats = fs.lstatSync(entryPath);
      } catch (error) {
        return;
      }

      if (entryStats.isDirectory()) {
        directoriesToRead.push(entryPath);
        return;
      }

      if (!entryStats.isFile() || !/\.[cm]?[jt]sx?$/i.test(entryName)) return;

      const relativeScriptPath = path
        .relative(scriptsRootDirectory, entryPath)
        .replace(/\\/g, '/');
      let scriptSource = '';
      try {
        scriptSource = fs.readFileSync(entryPath, 'utf8');
      } catch (error) {
        scriptSource = '';
      }
      const inferredContext = inferContextFromRelativeScriptPath(
        relativeScriptPath
      );
      discoveredScripts.push({
        id: generateTypeScriptProjectScriptId(),
        name: relativeScriptPath,
        source: scriptSource,
        transpiledCode: '',
        includePosition: 'last',
        contextKind: inferredContext.contextKind,
        sceneName: inferredContext.sceneName,
        objectName: inferredContext.objectName,
        behaviorName: inferredContext.behaviorName,
      });
    });
  }

  return discoveredScripts.sort((a, b) => a.name.localeCompare(b.name));
};

const hydrateScriptsSourceFromLocalFiles = (
  scripts: Array<ProjectTypeScriptScript>,
  projectDirectoryPath: string
): Array<ProjectTypeScriptScript> => {
  if (!fs || !path) return scripts;

  return scripts.map(script => {
    const scriptPathResolution = getScriptPathResolution(projectDirectoryPath, script);
    if (!scriptPathResolution) return script;
    const { absoluteFilePath, relativeScriptPath } = scriptPathResolution;
    if (!fs.existsSync(absoluteFilePath)) {
      return {
        ...script,
        name: relativeScriptPath,
      };
    }
    try {
      return {
        ...script,
        name: relativeScriptPath,
        source: fs.readFileSync(absoluteFilePath, 'utf8'),
      };
    } catch (error) {
      return {
        ...script,
        name: relativeScriptPath,
      };
    }
  });
};

const syncScriptsToLocalFiles = ({
  scripts,
  previousScripts,
  projectDirectoryPath,
}: {|
  scripts: Array<ProjectTypeScriptScript>,
  previousScripts: Array<ProjectTypeScriptScript>,
  projectDirectoryPath: string,
|}): Array<ProjectTypeScriptScript> => {
  if (!fs || !path) return scripts;

  const scriptsRootDirectory = path.resolve(
    path.join(projectDirectoryPath, TYPE_SCRIPT_PROJECT_SCRIPTS_SOURCE_DIRECTORY)
  );
  ensureDirectoryExists(scriptsRootDirectory);
  const previousScriptsById = new Map<string, ProjectTypeScriptScript>();
  previousScripts.forEach(previousScript => {
    previousScriptsById.set(previousScript.id, previousScript);
  });

  const resolvedScripts = scripts.map(script => {
    const scriptPathResolution = getScriptPathResolution(projectDirectoryPath, script);
    if (!scriptPathResolution) return script;
    const { absoluteFilePath, relativeScriptPath } = scriptPathResolution;
    const previousScript = previousScriptsById.get(script.id);
    const previousScriptPathResolution = previousScript
      ? getScriptPathResolution(projectDirectoryPath, previousScript)
      : null;

    let shouldWriteFile = true;
    if (
      previousScript &&
      previousScript.source === script.source &&
      previousScriptPathResolution &&
      previousScriptPathResolution.absoluteFilePath === absoluteFilePath
    ) {
      try {
        shouldWriteFile = !fs.existsSync(absoluteFilePath);
      } catch (error) {
        shouldWriteFile = true;
      }
    }

    ensureDirectoryExists(path.dirname(absoluteFilePath));
    if (shouldWriteFile) {
      try {
        fs.writeFileSync(absoluteFilePath, script.source, 'utf8');
      } catch (error) {
        // Ignore file write errors and keep metadata in project.
      }
    }
    return {
      ...script,
      name: relativeScriptPath,
    };
  });

  const activeScriptPaths = new Set<string>();
  resolvedScripts.forEach(script => {
    const scriptPathResolution = getScriptPathResolution(projectDirectoryPath, script);
    if (!scriptPathResolution) return;
    activeScriptPaths.add(scriptPathResolution.absoluteFilePath);
  });

  previousScripts.forEach(previousScript => {
    const previousScriptPathResolution = getScriptPathResolution(
      projectDirectoryPath,
      previousScript
    );
    if (!previousScriptPathResolution) return;
    const { absoluteFilePath } = previousScriptPathResolution;
    if (activeScriptPaths.has(absoluteFilePath)) return;
    deleteFileIfExists(absoluteFilePath);
    removeEmptyDirectoriesUpward(path.dirname(absoluteFilePath), scriptsRootDirectory);
  });

  return resolvedScripts;
};

export const generateTypeScriptProjectScriptId = (): string =>
  `ts-script-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

export const getProjectTypeScriptScriptsDirectory = (
  project: gdProject,
  options?: LoadProjectTypeScriptScriptsOptions | SaveProjectTypeScriptScriptsOptions
): ?string => {
  const projectDirectoryPath = getProjectDirectoryPath(project, options);
  if (!projectDirectoryPath || !path) return null;
  return path.resolve(
    path.join(projectDirectoryPath, TYPE_SCRIPT_PROJECT_SCRIPTS_SOURCE_DIRECTORY)
  );
};

export const loadProjectTypeScriptScripts = (
  project: gdProject,
  options?: LoadProjectTypeScriptScriptsOptions
): Array<ProjectTypeScriptScript> => {
  try {
    const rawMetadata = project
      .getExtensionProperties()
      .getValue(
        TYPE_SCRIPT_PROJECT_SCRIPTS_EXTENSION_NAME,
        TYPE_SCRIPT_PROJECT_SCRIPTS_PROPERTY_NAME
      );
    const scriptsFromMetadata = rawMetadata
      ? sanitizeScripts(JSON.parse(rawMetadata).scripts)
      : [];
    const projectDirectoryPath = getProjectDirectoryPath(project, options);
    if (!projectDirectoryPath) return scriptsFromMetadata;

    if (scriptsFromMetadata.length) {
      const hydratedScripts = hydrateScriptsSourceFromLocalFiles(
        scriptsFromMetadata,
        projectDirectoryPath
      );
      return syncScriptsToLocalFiles({
        scripts: hydratedScripts,
        previousScripts: hydratedScripts,
        projectDirectoryPath,
      });
    }
    return discoverScriptsFromLocalFiles(projectDirectoryPath);
  } catch (error) {
    return [];
  }
};

export const saveProjectTypeScriptScripts = (
  project: gdProject,
  scripts: Array<ProjectTypeScriptScript>,
  options?: SaveProjectTypeScriptScriptsOptions
): void => {
  const projectDirectoryPath = getProjectDirectoryPath(project, options);
  const previousScripts =
    options && options.previousScripts ? options.previousScripts : [];
  const scriptsToSave = projectDirectoryPath
    ? syncScriptsToLocalFiles({
        scripts,
        previousScripts,
        projectDirectoryPath,
      })
    : scripts;

  project
    .getExtensionProperties()
    .setValue(
      TYPE_SCRIPT_PROJECT_SCRIPTS_EXTENSION_NAME,
      TYPE_SCRIPT_PROJECT_SCRIPTS_PROPERTY_NAME,
      buildSerializedScripts(scriptsToSave)
    );
};
