// @flow
import * as React from 'react';
import { type I18n as I18nType } from '@lingui/core';
import { type FiltersState, useFilters } from '../UI/Search/FiltersChooser';
import {
  getObjectsRegistry,
  type ObjectsRegistry,
  type ObjectShortHeader,
  type ExtensionDependency,
} from '../Utils/GDevelopServices/Extension';
import { type Filters } from '../Utils/GDevelopServices/Filters';
import {
  useSearchStructuredItem,
  type SearchResult,
} from '../UI/Search/UseSearchStructuredItem';
import PreferencesContext from '../MainFrame/Preferences/PreferencesContext';
import { OBJECTS_FETCH_TIMEOUT } from '../Utils/GlobalFetchTimeouts';

const gd: libGDevelop = global.gd;

const emptySearchText = '';

// $FlowFixMe[underconstrained-implicit-instantiation]
const noExcludedTiers = new Set();
const excludedExperimentalTiers = new Set(['experimental']);

const builtInObjectTypes = [
  'Sprite',
  'TiledSpriteObject::TiledSprite',
  'PanelSpriteObject::PanelSprite',
  'Scene3D::Cube3DObject',
  'Scene3D::Model3DObject',
  'TextObject::Text',
  'BBText::BBText',
  'BitmapText::BitmapTextObject',
  'TextInput::TextInputObject',
  'Video::VideoObject',
  'Lighting::LightObject',
  'ParticleSystem::ParticleEmitter',
  'TileMap::TileMap',
  'TileMap::CollisionMask',
  'PrimitiveDrawing::Drawer',
];

type TranslatedObjectShortHeader = {
  ...ObjectShortHeader,
  englishFullName: string,
  englishDescription: string,
};

export type ObjectCategory = {
  categoryId: string,
  name: string,
  tags: [],
  tier: '',
};

const getSectionId = (name: string) => `section-${name}`;

type ObjectSection = {|
  key: string,
  name: string,
|};

const getObjectSections = (i18n: I18nType): Array<ObjectSection> => [
  { key: 'featured', name: i18n._('Most used') },
  { key: 'scene-2d', name: i18n._('2D objects') },
  { key: 'scene-3d', name: i18n._('3D objects') },
  { key: 'lights-audio', name: i18n._('Lights and audio') },
  { key: 'ui-input', name: i18n._('UI and input') },
  { key: 'physics-gameplay', name: i18n._('Physics and gameplay') },
  { key: 'effects', name: i18n._('Visual effects') },
  { key: 'network', name: i18n._('Network and online') },
  { key: 'other', name: i18n._('Other objects') },
];

const keywordMatch = (source: string, keywords: Array<string>) =>
  keywords.some(keyword => source.includes(keyword));

const getObjectSectionKey = (
  objectShortHeader: ObjectShortHeader,
  featuredTypes: Set<string>
): string => {
  if (featuredTypes.has(objectShortHeader.type)) return 'featured';

  const category = (objectShortHeader.category || '').toLowerCase();
  const tags = (objectShortHeader.tags || []).map(tag =>
    String(tag).toLowerCase()
  );
  const searchableText = [
    objectShortHeader.type || '',
    objectShortHeader.name || '',
    objectShortHeader.fullName || '',
    objectShortHeader.description || '',
    category,
    ...tags,
  ]
    .join(' ')
    .toLowerCase();

  const isNetwork =
    category === 'network' ||
    keywordMatch(searchableText, ['multiplayer', 'network', 'lobby', 'online']);
  if (isNetwork) return 'network';

  const hasLightsOrAudio = keywordMatch(searchableText, [
    'light',
    'spotlight',
    'pointlight',
    'directional',
    'rectarea',
    'audio',
    'sound',
    'music',
    'listener',
    'reverb',
  ]);
  if (hasLightsOrAudio) return 'lights-audio';

  const is3D =
    keywordMatch(searchableText, [' 3d', '3d ', 'scene3d::']) ||
    tags.some(tag => tag === '3d');
  if (is3D) return 'scene-3d';

  const isUiOrInput =
    category === 'user interface' ||
    category === 'input' ||
    category === 'text' ||
    keywordMatch(searchableText, [
      'ui',
      'button',
      'text',
      'input',
      'touch',
      'joystick',
      'slider',
      'toggle',
      'dialog',
      'hud',
    ]);
  if (isUiOrInput) return 'ui-input';

  const isPhysicsOrGameplay =
    category === 'game mechanic' ||
    keywordMatch(searchableText, [
      'physics',
      'collision',
      'platformer',
      'top-down',
      'pathfind',
      'character',
      'controller',
    ]);
  if (isPhysicsOrGameplay) return 'physics-gameplay';

  const isVisualEffect =
    category === 'visual effect' ||
    keywordMatch(searchableText, [
      'particle',
      'effect',
      'explosion',
      'fire',
      'smoke',
      'splash',
      'vfx',
    ]);
  if (isVisualEffect) return 'effects';

  if (category === 'general') return 'scene-2d';
  return 'other';
};

const getItemIdsGroupedBySection = ({
  featuredObjectShortHeaders,
  allObjectShortHeaders,
  i18n,
}: {|
  featuredObjectShortHeaders: Array<ObjectShortHeader>,
  allObjectShortHeaders: Array<ObjectShortHeader>,
  i18n: I18nType,
|}): Array<string> => {
  const objectsByType: { [string]: ObjectShortHeader } = {};
  allObjectShortHeaders.forEach(objectShortHeader => {
    objectsByType[objectShortHeader.type] = objectShortHeader;
  });

  const featuredObjectsByType: { [string]: ObjectShortHeader } = {};
  featuredObjectShortHeaders.forEach(objectShortHeader => {
    if (objectsByType[objectShortHeader.type]) {
      featuredObjectsByType[objectShortHeader.type] =
        objectsByType[objectShortHeader.type];
    }
  });

  const featuredTypes = new Set(Object.keys(featuredObjectsByType));
  const objectSections = getObjectSections(i18n);
  const objectIdsBySection = new Map<string, Array<string>>(
    objectSections.map(section => [section.key, []])
  );

  Object.keys(featuredObjectsByType).forEach(type => {
    const featuredObjectIds = objectIdsBySection.get('featured');
    if (featuredObjectIds) featuredObjectIds.push(type);
  });

  const nonFeaturedObjects = allObjectShortHeaders
    .filter(objectShortHeader => !featuredTypes.has(objectShortHeader.type))
    .sort((objectA, objectB) =>
      objectA.fullName
        .toLowerCase()
        .localeCompare(objectB.fullName.toLowerCase())
    );

  nonFeaturedObjects.forEach(objectShortHeader => {
    const sectionKey = getObjectSectionKey(objectShortHeader, featuredTypes);
    const sectionObjectIds = objectIdsBySection.get(sectionKey);
    if (sectionObjectIds) sectionObjectIds.push(objectShortHeader.type);
  });

  const itemIdsGroupedBySection = [];
  for (const section of objectSections) {
    const sectionObjectIds = objectIdsBySection.get(section.key);
    if (!sectionObjectIds || sectionObjectIds.length === 0) {
      continue;
    }

    itemIdsGroupedBySection.push(getSectionId(section.key));
    itemIdsGroupedBySection.push(...sectionObjectIds);
  }

  return itemIdsGroupedBySection;
};

type ObjectStoreState = {|
  filters: ?Filters,
  searchResults: ?Array<SearchResult<ObjectShortHeader | ObjectCategory>>,
  fetchObjects: () => void,
  error: ?Error,
  searchText: string,
  setSearchText: string => void,
  allCategories: string[],
  chosenCategory: string,
  setChosenCategory: string => void,
  setInstalledObjectMetadataList: (
    installedObjectMetadataList: Array<ObjectShortHeader>
  ) => void,
  translatedObjectShortHeadersByType: {
    [name: string]: TranslatedObjectShortHeader,
  },
  filtersState: FiltersState,
|};

export const ObjectStoreContext: React.Context<ObjectStoreState> = React.createContext<ObjectStoreState>(
  {
    filters: null,
    searchResults: null,
    fetchObjects: () => {},
    error: null,
    searchText: '',
    setSearchText: () => {},
    allCategories: [],
    // '' means all categories.
    chosenCategory: '',
    setChosenCategory: () => {},
    setInstalledObjectMetadataList: () => {},
    translatedObjectShortHeadersByType: {},
    filtersState: {
      chosenFilters: new Set(),
      addFilter: () => {},
      removeFilter: () => {},
      chosenCategory: null,
      setChosenCategory: () => {},
    },
  }
);

type ObjectStoreStateProviderProps = {|
  children: React.Node,
  i18n: I18nType,
  defaultSearchText?: string,
|};

export const ObjectStoreStateProvider = ({
  children,
  i18n,
  defaultSearchText,
}: ObjectStoreStateProviderProps): React.MixedElement => {
  const [
    installedObjectMetadataList,
    setInstalledObjectMetadataList,
  ] = React.useState<Array<ObjectShortHeader>>([]);
  const [
    translatedObjectShortHeadersByType,
    setTranslatedObjectShortHeadersByType,
  ] = React.useState<{
    [string]: TranslatedObjectShortHeader,
  }>({});

  const preferences = React.useContext(PreferencesContext);
  const { showExperimentalExtensions, language } = preferences.values;
  const [firstObjectIds, setFirstObjectIds] = React.useState<Array<string>>([]);
  const [secondObjectIds, setSecondObjectIds] = React.useState<Array<string>>(
    []
  );
  const [loadedLanguage, setLoadedLanguage] = React.useState<?string>(null);
  const [error, setError] = React.useState<?Error>(null);
  const isLoading = React.useRef<boolean>(false);

  const [searchText, setSearchText] = React.useState(
    defaultSearchText || emptySearchText
  );
  const [chosenCategory, setChosenCategory] = React.useState('');
  const filtersState = useFilters();

  const fetchObjects = React.useCallback(
    () => {
      // Don't attempt to load again resources and filters if they
      // were loaded already.
      if (
        (Object.keys(translatedObjectShortHeadersByType).length &&
          loadedLanguage === language) ||
        isLoading.current
      )
        return;

      (async () => {
        setError(null);
        // Reset the search text to avoid showing the previous search results
        // in case they were on a different language.
        setSearchText(emptySearchText);
        isLoading.current = true;

        try {
          const objectsRegistry: ObjectsRegistry = await getObjectsRegistry();
          const objectShortHeaders = objectsRegistry.headers;

          const translatedObjectShortHeadersByType = {};
          objectShortHeaders.forEach(objectShortHeader => {
            const translatedObjectShortHeader: TranslatedObjectShortHeader = {
              ...objectShortHeader,
              fullName: i18n._(objectShortHeader.fullName),
              description: i18n._(objectShortHeader.description),
              englishFullName: objectShortHeader.fullName,
              englishDescription: objectShortHeader.description,
            };

            const objectExtension: ExtensionDependency = {
              extensionName: objectShortHeader.extensionName,
              extensionVersion: objectShortHeader.version,
            };
            // In the repository, `requiredExtensions` doesn't includes its own extension.
            // We add it because we need it to check for updates.
            translatedObjectShortHeader.requiredExtensions = objectShortHeader.requiredExtensions
              ? [objectExtension, ...objectShortHeader.requiredExtensions]
              : [objectExtension];

            translatedObjectShortHeadersByType[
              // $FlowFixMe[prop-missing]
              objectShortHeader.type
            ] = translatedObjectShortHeader;
          });

          console.info(
            `Loaded ${
              objectShortHeaders ? objectShortHeaders.length : 0
            } objects from the extension store.`
          );
          setTranslatedObjectShortHeadersByType(
            translatedObjectShortHeadersByType
          );
          setLoadedLanguage(language);
          setFirstObjectIds(
            objectsRegistry.views.default.firstIds.map(
              ({ extensionName, objectName }) =>
                gd.PlatformExtension.getObjectFullType(
                  extensionName,
                  objectName
                )
            )
          );
          setSecondObjectIds(
            objectsRegistry.views.default.secondIds.map(
              ({ extensionName, objectName }) =>
                gd.PlatformExtension.getObjectFullType(
                  extensionName,
                  objectName
                )
            )
          );
        } catch (error) {
          console.error(
            `Unable to load the objects from the extension store:`,
            error
          );
          setError(error);
        }

        isLoading.current = false;
      })();
    },
    [
      translatedObjectShortHeadersByType,
      isLoading,
      i18n,
      language,
      loadedLanguage,
    ]
  );

  React.useEffect(
    () => {
      // Don't attempt to load again extensions and filters if they
      // were loaded already.
      if (
        (Object.keys(translatedObjectShortHeadersByType).length &&
          loadedLanguage === language) ||
        isLoading.current
      )
        return;

      const timeoutId = setTimeout(() => {
        console.info('Pre-fetching objects from extension store...');
        fetchObjects();
      }, OBJECTS_FETCH_TIMEOUT);
      return () => clearTimeout(timeoutId);
    },
    [
      fetchObjects,
      translatedObjectShortHeadersByType,
      isLoading,
      language,
      loadedLanguage,
    ]
  );

  const allTranslatedObjects = React.useMemo<{
    [name: string]: ObjectShortHeader,
  }>(
    () => {
      const allTranslatedObjects: {
        [name: string]: ObjectShortHeader,
      } = {};
      for (const type in translatedObjectShortHeadersByType) {
        const objectShortHeader: any = {
          ...translatedObjectShortHeadersByType[type],
        };
        delete objectShortHeader.englishFullName;
        delete objectShortHeader.englishDescription;

        allTranslatedObjects[type] = objectShortHeader;
      }
      for (const installedObjectMetadata of installedObjectMetadataList) {
        const repositoryObjectMetadata =
          translatedObjectShortHeadersByType[installedObjectMetadata.type];

        const objectMetadata = repositoryObjectMetadata
          ? {
              // Attributes from the extension repository

              // These attributes are important for the installation and update workflow.
              isInstalled: true,
              tier: repositoryObjectMetadata.tier,
              version: repositoryObjectMetadata.version,
              changelog: repositoryObjectMetadata.changelog,
              url: repositoryObjectMetadata.url,
              // It gives info about the extension that can be displayed to users.
              headerUrl: repositoryObjectMetadata.headerUrl,
              authorIds: repositoryObjectMetadata.authorIds,
              authors: repositoryObjectMetadata.authors,
              // It's empty and not used.
              extensionNamespace: repositoryObjectMetadata.extensionNamespace,
              requiredExtensions: repositoryObjectMetadata.requiredExtensions,

              // Attributes from the installed extension

              // These ones are less important but its better to use the icon of
              // the installed extension since it's used everywhere in the editor.
              previewIconUrl: installedObjectMetadata.previewIconUrl,
              category: installedObjectMetadata.category,
              tags: installedObjectMetadata.tags,
              // Both metadata are supposed to have the same type, but the
              // installed ones are safer to use.
              // It reduces the risk of accessing an extension that doesn't
              // actually exist in the project.
              type: installedObjectMetadata.type,
              name: installedObjectMetadata.name,
              extensionName: installedObjectMetadata.extensionName,

              // Attributes switching between both

              assetStoreTag:
                repositoryObjectMetadata.assetStoreTag ||
                installedObjectMetadata.assetStoreTag,

              // Translations may not be relevant for the installed version.
              // We use the translation only if the not translated texts match.
              fullName:
                installedObjectMetadata.fullName ===
                repositoryObjectMetadata.englishFullName
                  ? repositoryObjectMetadata.fullName
                  : installedObjectMetadata.fullName,
              description:
                installedObjectMetadata.description ===
                repositoryObjectMetadata.englishDescription
                  ? repositoryObjectMetadata.description
                  : installedObjectMetadata.description,
            }
          : installedObjectMetadata;
        // $FlowFixMe[incompatible-type]
        allTranslatedObjects[installedObjectMetadata.type] = objectMetadata;
      }
      return allTranslatedObjects;
    },
    [installedObjectMetadataList, translatedObjectShortHeadersByType]
  );

  const allCategories = React.useMemo(
    () => {
      // $FlowFixMe[underconstrained-implicit-instantiation]
      const categoriesSet = new Set();
      for (const type in allTranslatedObjects) {
        categoriesSet.add(allTranslatedObjects[type].category);
      }
      const sortedCategories = [...categoriesSet].sort((tag1, tag2) =>
        tag1.toLowerCase().localeCompare(tag2.toLowerCase())
      );
      return sortedCategories;
    },
    [allTranslatedObjects]
  );

  const filters = React.useMemo(
    () => {
      // $FlowFixMe[underconstrained-implicit-instantiation]
      const tagsSet = new Set();
      for (const type in allTranslatedObjects) {
        const object = allTranslatedObjects[type];
        object.tags.forEach(tag => {
          if (
            showExperimentalExtensions ||
            !object.tier ||
            !excludedExperimentalTiers.has(object.tier)
          ) {
            tagsSet.add(tag);
          }
        });
      }
      const sortedTags = [...tagsSet].sort((tag1, tag2) =>
        tag1.toLowerCase().localeCompare(tag2.toLowerCase())
      );
      return {
        allTags: sortedTags,
        defaultTags: sortedTags,
        // $FlowFixMe[missing-empty-array-annot]
        tagsTree: [],
      };
    },
    [allTranslatedObjects, showExperimentalExtensions]
  );

  const sectionedObjectItemIds = React.useMemo(
    () => {
      const featuredObjectShortHeaders = [
        ...builtInObjectTypes,
        ...firstObjectIds,
        ...secondObjectIds,
      ]
        .map(type => allTranslatedObjects[type])
        .filter(Boolean);

      return getItemIdsGroupedBySection({
        featuredObjectShortHeaders,
        allObjectShortHeaders: Object.values(allTranslatedObjects),
        i18n,
      });
    },
    [firstObjectIds, secondObjectIds, allTranslatedObjects, i18n]
  );

  const allTranslatedObjectsAndCategories = React.useMemo(
    () => {
      const allTranslatedObjectsAndCategories: {
        [name: string]: ObjectShortHeader | ObjectCategory,
      } = {};
      for (const type in allTranslatedObjects) {
        allTranslatedObjectsAndCategories[type] = allTranslatedObjects[type];
      }
      const activeSectionIds = new Set(
        sectionedObjectItemIds.filter(itemId => itemId.startsWith('section-'))
      );
      for (const section of getObjectSections(i18n)) {
        const sectionId = getSectionId(section.key);
        if (!activeSectionIds.has(sectionId)) continue;
        const sectionCategory: ObjectCategory = {
          categoryId: sectionId,
          name: section.name,
          tags: [],
          tier: '',
        };
        allTranslatedObjectsAndCategories[sectionId] = sectionCategory;
      }
      return allTranslatedObjectsAndCategories;
    },
    [
      allTranslatedObjects,
      i18n,
      sectionedObjectItemIds,
    ]
  );

  const defaultFirstSearchItemIds = React.useMemo(
    () => {
      const uniqueDefaultFirstSearchItemIds = [];
      const alreadyAddedIds = new Set<string>();
      sectionedObjectItemIds.forEach(itemId => {
        if (alreadyAddedIds.has(itemId)) return;
        uniqueDefaultFirstSearchItemIds.push(itemId);
        alreadyAddedIds.add(itemId);
      });
      // An unknown id would make useSearchStructuredItem crash.
      return uniqueDefaultFirstSearchItemIds.filter(
        itemId => allTranslatedObjectsAndCategories[itemId]
      );
    },
    [
      sectionedObjectItemIds,
      allTranslatedObjectsAndCategories,
    ]
  );

  const searchResults: ?Array<
    SearchResult<ObjectShortHeader | ObjectCategory>
  > = useSearchStructuredItem(allTranslatedObjectsAndCategories, {
    searchText,
    chosenItemCategory: chosenCategory,
    chosenCategory: filtersState.chosenCategory,
    chosenFilters: filtersState.chosenFilters,
    excludedTiers: showExperimentalExtensions
      ? noExcludedTiers
      : excludedExperimentalTiers,
    defaultFirstSearchItemIds: defaultFirstSearchItemIds,
    shuffleResults: false,
  });

  const objectStoreState = React.useMemo(
    () => ({
      searchResults,
      fetchObjects,
      filters,
      allCategories,
      chosenCategory,
      setChosenCategory,
      error,
      searchText,
      setSearchText,
      setInstalledObjectMetadataList,
      translatedObjectShortHeadersByType,
      filtersState,
    }),
    [
      searchResults,
      error,
      filters,
      allCategories,
      chosenCategory,
      setChosenCategory,
      searchText,
      setInstalledObjectMetadataList,
      translatedObjectShortHeadersByType,
      filtersState,
      fetchObjects,
    ]
  );

  return (
    // $FlowFixMe[incompatible-type]
    <ObjectStoreContext.Provider value={objectStoreState}>
      {children}
    </ObjectStoreContext.Provider>
  );
};
