// @flow

import {
  extractFbxEmbeddedResourcePathsFromArrayBuffer,
  extractFbxEmbeddedResourcePathsFromText,
  getFbxDependencyLookupKeys,
} from './FbxDependencyResolver';

const toArrayBuffer = (text: string): ArrayBuffer => {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index++) {
    bytes[index] = text.charCodeAt(index) & 0xff;
  }
  return bytes.buffer;
};

describe('FbxDependencyResolver', () => {
  it('extracts and deduplicates embedded texture paths from text', () => {
    expect(
      extractFbxEmbeddedResourcePathsFromText(`
        Texture: "textures/Body.png"
        Texture: "textures\\\\Body.png"
        Texture: "effects/sparkle.JPG"
        Texture: "http://example.com/ignore.png"
        Texture: "data:image/png;base64,abc"
      `)
    ).toEqual(['textures/Body.png', 'effects/sparkle.JPG']);
  });

  it('extracts embedded texture paths from array buffers', () => {
    expect(
      extractFbxEmbeddedResourcePathsFromArrayBuffer(
        toArrayBuffer('Texture: "assets/characters/hero_diffuse.webp"')
      )
    ).toEqual(['assets/characters/hero_diffuse.webp']);
  });

  it('provides stable lookup keys for dependency matching', () => {
    expect(getFbxDependencyLookupKeys('textures/My%20Texture.png')).toEqual(
      expect.arrayContaining([
        'textures/My%20Texture.png',
        'textures/My Texture.png',
        'My%20Texture.png',
        'My Texture.png',
      ])
    );
  });
});
