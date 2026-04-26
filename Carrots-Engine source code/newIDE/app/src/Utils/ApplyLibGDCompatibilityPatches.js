// @flow

const getFirstVectorStringValue = (vector: any): string => {
  if (!vector) return '';

  const size =
    typeof vector.size === 'function'
      ? vector.size()
      : typeof vector.length === 'number'
      ? vector.length
      : 0;
  if (!size) return '';

  let value = '';
  if (typeof vector.at === 'function') {
    value = vector.at(0);
  } else if (typeof vector.get === 'function') {
    value = vector.get(0);
  } else if (typeof vector.toJSArray === 'function') {
    const array = vector.toJSArray();
    value = Array.isArray(array) ? array[0] : '';
  }

  return typeof value === 'string' ? value : '';
};

/**
 * Patch missing methods that differ between libGD.js builds.
 * This prevents runtime crashes when a compatible fallback API exists.
 */
const applyLibGDCompatibilityPatches = (gd: libGDevelop) => {
  if (!gd) return;

  const initialInstancePrototype = gd.InitialInstance?.prototype;
  if (initialInstancePrototype) {
    if (typeof initialInstancePrototype.getParentPersistentUuid !== 'function') {
      // Older libGD versions did not include parent UUID support.
      initialInstancePrototype.getParentPersistentUuid = function() {
        return '';
      };
    }

    if (typeof initialInstancePrototype.setParentPersistentUuid !== 'function') {
      initialInstancePrototype.setParentPersistentUuid = function(
        _parentPersistentUuid: string
      ) {
        return this;
      };
    }
  }

  const resourcesContainerPrototype = gd.ResourcesContainer?.prototype;
  if (
    resourcesContainerPrototype &&
    typeof resourcesContainerPrototype.getResourceNameWithFile !== 'function' &&
    typeof resourcesContainerPrototype.getResourceNamesWithFile === 'function'
  ) {
    resourcesContainerPrototype.getResourceNameWithFile = function(
      fileName: string
    ) {
      const matchingNames = this.getResourceNamesWithFile(fileName);
      if (!matchingNames) return '';

      let resourceName = '';
      try {
        resourceName = getFirstVectorStringValue(matchingNames);
      } finally {
        if (typeof matchingNames.delete === 'function') {
          matchingNames.delete();
        }
      }

      return resourceName;
    };
  }
};

export default applyLibGDCompatibilityPatches;
