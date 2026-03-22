import 'pixi.js';

declare module 'pixi.js' {
  interface ITextStyle extends TextStyleOptions {}

  type IPointData = PointData;
  type DisplayObject = ContainerChild;
  type BaseTexture<T extends Record<string, any> = any> = TextureSource<T>;
  type Resource = unknown;

  interface Container {
    worldAlpha: number;
  }

  interface Text {
    dirty: boolean;
  }

  interface Texture<TextureSourceType extends TextureSource = TextureSource> {
    valid: boolean;
  }

  namespace Texture {
    function removeFromCache(key: any): void;
  }

  namespace filters {
    interface OutlineFilter extends Filter {
      thickness: number;
      padding: number;
      color: number;
    }
  }

  const BLEND_MODES: Record<string, BLEND_MODES> & {
    NORMAL: BLEND_MODES;
    ADD: BLEND_MODES;
    MULTIPLY: BLEND_MODES;
    SCREEN: BLEND_MODES;
    OVERLAY: BLEND_MODES;
    DARKEN: BLEND_MODES;
    LIGHTEN: BLEND_MODES;
    COLOR_DODGE: BLEND_MODES;
    COLOR_BURN: BLEND_MODES;
    HARD_LIGHT: BLEND_MODES;
    SOFT_LIGHT: BLEND_MODES;
    DIFFERENCE: BLEND_MODES;
    EXCLUSION: BLEND_MODES;
  };

  const defaultFilterVert: string;
}

export {};
