// @flow
import tinyLruModule from 'tiny-lru';

const defaultExport =
  tinyLruModule &&
  typeof tinyLruModule === 'object' &&
  tinyLruModule.default
    ? tinyLruModule.default
    : null;

const lruFactory =
  (tinyLruModule &&
    typeof tinyLruModule === 'object' &&
    typeof tinyLruModule.lru === 'function' &&
    tinyLruModule.lru) ||
  (defaultExport &&
    typeof defaultExport === 'object' &&
    typeof defaultExport.lru === 'function' &&
    defaultExport.lru) ||
  (typeof tinyLruModule === 'function' && tinyLruModule) ||
  (typeof defaultExport === 'function' && defaultExport) ||
  null;

if (typeof lruFactory === 'function') {
  try {
    if (typeof tinyLruModule === 'function' && !tinyLruModule.lru) {
      tinyLruModule.lru = lruFactory;
    }
    if (
      tinyLruModule &&
      typeof tinyLruModule === 'object' &&
      !tinyLruModule.lru
    ) {
      tinyLruModule.lru = lruFactory;
    }

    if (typeof defaultExport === 'function' && !defaultExport.lru) {
      defaultExport.lru = lruFactory;
    }
    if (
      defaultExport &&
      typeof defaultExport === 'object' &&
      !defaultExport.lru
    ) {
      defaultExport.lru = lruFactory;
    }
  } catch (error) {
    // Ignore if export object is sealed/frozen in a specific bundling mode.
  }
}
