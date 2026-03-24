// @flow
import axios from 'axios';
import { GDevelopAssetApi } from './ApiConfigs';
import { type Filters } from './Filters';
import { type UserPublicProfile } from './User';
import { retryIfFailed } from '../RetryIfFailed';
import {
  getLocalResourceUrl,
  resolveLocalResourcePath,
} from './LocalResourceUrl';

export type ExampleShortHeader = {|
  id: string,
  slug: string,
  name: string,
  shortDescription: string,
  description: string,
  license: string,
  tags: Array<string>,
  authors?: Array<UserPublicProfile>,
  authorIds?: Array<string>,
  previewImageUrls: Array<string>,
  quickCustomizationImageUrl?: string,
  gdevelopVersion: string,
  codeSizeLevel: string,
  difficultyLevel?: string,
  linkedExampleShortHeaders?: Array<{ slug: string, relation: string }>,
|};

export type Example = {|
  ...ExampleShortHeader,
  projectFileUrl: string,
  authors: Array<string>,
|};

export type AllExamples = {|
  exampleShortHeaders: Array<ExampleShortHeader>,
  filters: Filters,
|};

const USE_LOCAL_EXAMPLES = true;
const LOCAL_EXAMPLES_DATABASE_URL = getLocalResourceUrl('/examples/examples.json');

let cachedLocalExamplesDatabase: ?{
  exampleShortHeaders: Array<ExampleShortHeader>,
  filters: Filters,
  examplesById?: { [string]: Example },
} = null;

const adaptLocalExampleShortHeader = (
  exampleShortHeader: ExampleShortHeader
): ExampleShortHeader => ({
  ...exampleShortHeader,
  previewImageUrls: Array.isArray(exampleShortHeader.previewImageUrls)
    ? exampleShortHeader.previewImageUrls.map(resolveLocalResourcePath)
    : [],
});

const adaptLocalExample = (example: Example): Example => ({
  ...adaptLocalExampleShortHeader(example),
  projectFileUrl: resolveLocalResourcePath(example.projectFileUrl),
});

const loadLocalExamplesDatabase = async () => {
  if (cachedLocalExamplesDatabase) return cachedLocalExamplesDatabase;
  const response = await axios.get(LOCAL_EXAMPLES_DATABASE_URL);
  const rawDatabase = response.data || {};
  const rawExampleShortHeaders = Array.isArray(rawDatabase.exampleShortHeaders)
    ? rawDatabase.exampleShortHeaders
    : [];
  const rawExamplesById =
    rawDatabase.examplesById && typeof rawDatabase.examplesById === 'object'
      ? rawDatabase.examplesById
      : {};

  const adaptedExamplesById: { [string]: Example } = {};
  for (const exampleId in rawExamplesById) {
    if (!Object.prototype.hasOwnProperty.call(rawExamplesById, exampleId)) {
      continue;
    }
    adaptedExamplesById[exampleId] = adaptLocalExample(rawExamplesById[exampleId]);
  }

  cachedLocalExamplesDatabase = {
    ...rawDatabase,
    exampleShortHeaders: rawExampleShortHeaders.map(adaptLocalExampleShortHeader),
    examplesById: adaptedExamplesById,
  };
  return cachedLocalExamplesDatabase;
};

export const listAllExamples = async (): Promise<AllExamples> => {
  let exampleShortHeaders = [];
  let filters = {
    allTags: [],
    defaultTags: [],
    tagsTree: [],
  };

  try {
    // $FlowFixMe[underconstrained-implicit-instantiation]
    const response = await axios.get(`${GDevelopAssetApi.baseUrl}/example`, {
      params: {
        // Could be changed according to the editor environment, but keep
        // reading from the "live" data for now.
        environment: 'live',
      },
    });
    const { exampleShortHeadersUrl, filtersUrl } = response.data;

    [exampleShortHeaders, filters] = await Promise.all([
      retryIfFailed(
        { times: 2 },
        // $FlowFixMe[underconstrained-implicit-instantiation]
        async () => (await axios.get(exampleShortHeadersUrl)).data
      ),
      // $FlowFixMe[underconstrained-implicit-instantiation]
      retryIfFailed({ times: 2 }, async () => (await axios.get(filtersUrl)).data),
    ]);
  } catch (error) {
    console.warn(
      'Unable to load remote examples database, trying local bundled examples only:',
      error
    );
  }

  let mergedExampleShortHeaders = exampleShortHeaders;
  let mergedFilters = filters;

  if (USE_LOCAL_EXAMPLES) {
    try {
      const localDatabase = await loadLocalExamplesDatabase();
      const localExampleShortHeaders =
        localDatabase && localDatabase.exampleShortHeaders
          ? localDatabase.exampleShortHeaders
          : [];

      if (localExampleShortHeaders.length) {
        const mergedById = new Map();
        exampleShortHeaders.forEach(exampleShortHeader => {
          mergedById.set(exampleShortHeader.id, exampleShortHeader);
        });
        localExampleShortHeaders.forEach(exampleShortHeader => {
          // Local examples override remote ones if ids collide.
          mergedById.set(exampleShortHeader.id, exampleShortHeader);
        });

        mergedExampleShortHeaders = Array.from(mergedById.values());

        const localFilters = localDatabase ? localDatabase.filters : null;
        const mergedTagsSet = new Set(
          ([]: Array<string>)
            .concat(filters ? filters.allTags || [] : [])
            .concat(localFilters ? localFilters.allTags || [] : [])
        );
        const mergedTags = Array.from(mergedTagsSet);

        mergedFilters = {
          allTags: mergedTags,
          defaultTags: mergedTags,
          tagsTree:
            (filters && filters.tagsTree) ||
            (localFilters && localFilters.tagsTree) ||
            [],
        };
      }
    } catch (error) {
      console.warn('Unable to load local examples database:', error);
    }
  }

  if (!mergedExampleShortHeaders.length) {
    throw new Error('No example could be loaded from remote or local sources.');
  }

  const allExamples: AllExamples = {
    exampleShortHeaders: mergedExampleShortHeaders,
    filters: mergedFilters,
  };

  return allExamples;
};

export const getExample = async (
  exampleShortHeader: ExampleShortHeader
): Promise<Example> => {
  if (USE_LOCAL_EXAMPLES) {
    try {
      const localDatabase = await loadLocalExamplesDatabase();
      const localExample =
        localDatabase &&
        localDatabase.examplesById &&
        localDatabase.examplesById[exampleShortHeader.id];
      if (localExample) return localExample;
    } catch (error) {
      console.warn('Unable to load local example data:', error);
    }
  }

  // $FlowFixMe[underconstrained-implicit-instantiation]
  const response = await axios.get(
    `${GDevelopAssetApi.baseUrl}/example-v2/${exampleShortHeader.id}`
  );

  return response.data;
};

export const getUserExampleShortHeaders = async (
  authorId: string
): Promise<Array<ExampleShortHeader>> => {
  // $FlowFixMe[underconstrained-implicit-instantiation]
  const response = await axios.get(
    `${GDevelopAssetApi.baseUrl}/example-short-header`,
    {
      params: {
        authorId,
      },
    }
  );

  return response.data;
};
