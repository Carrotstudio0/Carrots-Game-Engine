// @flow
import optionalRequire from '../Utils/OptionalRequire';
import newNameGenerator from '../Utils/NewNameGenerator';
import {
  allResourceKindsAndMetadata,
  createNewResource,
  type ResourceKind,
} from './ResourceSource';
import { applyResourceDefaults } from './ResourceUtils';
import { runResourceImport } from './AssetImportPipeline';

const fs = optionalRequire('fs');
const path = optionalRequire('path');

type ExtensionToKind = { [string]: ResourceKind };

export type DroppedFilesImportSummary = {|
  importedResourceNames: Array<string>,
  unsupportedFilePaths: Array<string>,
  failedFilePaths: Array<string>,
|};

const extensionToKind: ExtensionToKind = allResourceKindsAndMetadata.reduce(
  (accumulator, metadata) => {
    metadata.fileExtensions.forEach(fileExtension => {
      const normalizedExtension = fileExtension.toLowerCase();
      if (!accumulator[normalizedExtension]) {
        // $FlowFixMe[incompatible-type]
        accumulator[normalizedExtension] = metadata.kind;
      }
    });
    return accumulator;
  },
  {}
);

const detectResourceKindFromJson = async (
  filePath: string
): Promise<ResourceKind> => {
  if (!fs || !fs.promises || !fs.promises.readFile) return 'json';

  try {
    const rawContent = await fs.promises.readFile(filePath, 'utf8');
    const parsed = JSON.parse(rawContent);
    if (!parsed || typeof parsed !== 'object') return 'json';

    if (Array.isArray(parsed.bones) && parsed.skeleton) return 'spine';

    if (
      parsed.type === 'map' ||
      (Array.isArray(parsed.layers) && Array.isArray(parsed.tilesets))
    ) {
      return 'tilemap';
    }

    if (
      parsed.type === 'tileset' ||
      (parsed.tilewidth != null &&
        parsed.tileheight != null &&
        (parsed.image || parsed.columns != null || parsed.tiles))
    ) {
      return 'tileset';
    }
  } catch (error) {
    // Invalid JSON or unreadable file: fallback to generic JSON resource.
  }

  return 'json';
};

const inferResourceKindFromPath = async (
  filePath: string
): Promise<?ResourceKind> => {
  if (!path) return null;
  const fileExtension = path.extname(filePath).replace(/^\./, '').toLowerCase();
  if (!fileExtension) return null;

  if (fileExtension === 'json') {
    return detectResourceKindFromJson(filePath);
  }

  return extensionToKind[fileExtension] || null;
};

const collectFilesRecursively = async (
  candidatePath: string,
  files: Array<string>
): Promise<void> => {
  if (!fs || !fs.promises || !fs.promises.stat) return;
  try {
    const stats = await fs.promises.stat(candidatePath);
    if (stats.isFile()) {
      files.push(candidatePath);
      return;
    }

    if (!stats.isDirectory() || !fs.promises.readdir || !path) return;
    const entries = await fs.promises.readdir(candidatePath);
    await Promise.all(
      entries.map(entry =>
        collectFilesRecursively(path.join(candidatePath, entry), files)
      )
    );
  } catch (error) {
    // Ignore inaccessible entries.
  }
};

const getUniqueAssetPath = (
  projectFolderPath: string,
  resourcesManager: any,
  sourceFilePath: string
): ?{| relativePath: string, absolutePath: string |} => {
  if (!path || !fs || !fs.existsSync) return null;

  const sourceBasename = path.basename(sourceFilePath);
  const sourceExtension = path.extname(sourceBasename).toLowerCase();
  const sourceNameWithoutExtension = path.basename(
    sourceBasename,
    sourceExtension
  );

  const uniqueNameWithoutExtension = newNameGenerator(
    sourceNameWithoutExtension,
    tentativeName => {
      const tentativeRelativePath = path.join(
        'Assets',
        tentativeName + sourceExtension
      );
      const tentativeAbsolutePath = path.join(
        projectFolderPath,
        tentativeRelativePath
      );
      return (
        fs.existsSync(tentativeAbsolutePath) ||
        resourcesManager.hasResource(tentativeRelativePath)
      );
    }
  );

  const relativePath = path.join(
    'Assets',
    uniqueNameWithoutExtension + sourceExtension
  );
  const absolutePath = path.join(projectFolderPath, relativePath);
  return { relativePath, absolutePath };
};

export const importDroppedFilesToAssets = async ({
  project,
  droppedFilePaths,
}: {|
  project: gdProject,
  droppedFilePaths: Array<string>,
|}): Promise<DroppedFilesImportSummary> => {
  const summary: DroppedFilesImportSummary = {
    importedResourceNames: [],
    unsupportedFilePaths: [],
    failedFilePaths: [],
  };

  if (!path || !fs || !fs.promises || !fs.promises.copyFile || !fs.promises.mkdir)
    return summary;

  const projectFilePath = project.getProjectFile();
  if (!projectFilePath) return summary;

  const projectFolderPath = path.dirname(projectFilePath);
  const assetsFolderPath = path.join(projectFolderPath, 'Assets');
  await fs.promises.mkdir(assetsFolderPath, { recursive: true });

  const uniqueDroppedPaths = Array.from(new Set(droppedFilePaths.filter(Boolean)));
  const allFiles = [];
  for (const droppedPath of uniqueDroppedPaths) {
    // eslint-disable-next-line no-await-in-loop
    await collectFilesRecursively(droppedPath, allFiles);
  }

  const resourcesManager = project.getResourcesManager();
  const uniqueFiles = Array.from(new Set(allFiles));

  for (const sourceFilePath of uniqueFiles) {
    // eslint-disable-next-line no-await-in-loop
    const resourceKind = await inferResourceKindFromPath(sourceFilePath);
    if (!resourceKind) {
      summary.unsupportedFilePaths.push(sourceFilePath);
      continue;
    }

    const uniqueAssetPath = getUniqueAssetPath(
      projectFolderPath,
      resourcesManager,
      sourceFilePath
    );
    if (!uniqueAssetPath) {
      summary.failedFilePaths.push(sourceFilePath);
      continue;
    }

    try {
      // eslint-disable-next-line no-await-in-loop
      await fs.promises.copyFile(sourceFilePath, uniqueAssetPath.absolutePath);
    } catch (error) {
      summary.failedFilePaths.push(sourceFilePath);
      continue;
    }

    const resource = createNewResource(resourceKind);
    if (!resource) {
      summary.failedFilePaths.push(sourceFilePath);
      continue;
    }

    const resourceName = uniqueAssetPath.relativePath;
    resource.setFile(resourceName);
    resource.setName(resourceName);
    applyResourceDefaults(project, resource);

    const hasCreatedResource = resourcesManager.addResource(resource);
    resource.delete();

    if (!hasCreatedResource) {
      summary.failedFilePaths.push(sourceFilePath);
      continue;
    }

    summary.importedResourceNames.push(resourceName);

    try {
      const createdResource = resourcesManager.getResource(resourceName);
      // eslint-disable-next-line no-await-in-loop
      await runResourceImport({
        project,
        resource: createdResource,
        force: true,
      });
    } catch (error) {
      summary.failedFilePaths.push(sourceFilePath);
    }
  }

  return summary;
};
