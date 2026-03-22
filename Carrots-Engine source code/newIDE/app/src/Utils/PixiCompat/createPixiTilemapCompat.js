// @flow
import { createTextureFromResource } from './EditorPixiAdapter';

type TileOptions = {|
  alpha?: number,
  rotate?: number,
|};

const createPixiTilemapCompat = (PIXI: any) => {
  const settings = {
    use32bitIndex: false,
  };

  const applyGroupD8Transform = (
    sprite: any,
    texture: any,
    x: number,
    y: number,
    rotate: ?number
  ) => {
    if (!rotate || !PIXI.groupD8 || !PIXI.Matrix) {
      sprite.position.set(x, y);
      return;
    }

    const frame = texture && texture.orig ? texture.orig : texture;
    const width = frame && typeof frame.width === 'number' ? frame.width : sprite.width;
    const height =
      frame && typeof frame.height === 'number' ? frame.height : sprite.height;

    const matrix = new PIXI.Matrix();
    matrix.tx = x;
    matrix.ty = y;
    PIXI.groupD8.matrixAppendRotationInv(matrix, rotate, 0, 0, width, height);
    sprite.setFromMatrix(matrix);
  };

  class CompatTileSpriteController {
    _sprite: any;
    _texture: any;
    _x: number;
    _y: number;

    constructor(sprite: any, texture: any, x: number, y: number) {
      this._sprite = sprite;
      this._texture = texture;
      this._x = x;
      this._y = y;
    }

    tileAnimX(_animationFrameWidth: number, _animationLength: number) {
      return this;
    }

    tileAnimY(_animationFrameHeight: number, _animationLength: number) {
      return this;
    }

    tileAnimDivisor(_divisor: number) {
      return this;
    }

    tileAlpha(alpha: number) {
      if (this._sprite) this._sprite.alpha = alpha;
      return this;
    }

    tileRotate(rotate: number) {
      if (this._sprite) {
        applyGroupD8Transform(this._sprite, this._texture, this._x, this._y, rotate);
      }
      return this;
    }
  }

  class CompatCompositeTilemap extends PIXI.Container {
    tileAnim: [number, number];

    constructor() {
      super();
      this.tileAnim = [0, 0];
    }

    clear() {
      const children = this.removeChildren();
      for (const child of children) {
        child.destroy(false);
      }
      return this;
    }

    tile(textureOrResource: any, x: number, y: number, options: TileOptions = {}) {
      const texture =
        typeof textureOrResource === 'string'
          ? createTextureFromResource(textureOrResource)
          : textureOrResource;

      const sprite = new PIXI.Sprite(texture);
      sprite.alpha = typeof options.alpha === 'number' ? options.alpha : 1;
      sprite.anchor.set(0, 0);
      applyGroupD8Transform(sprite, texture, x, y, options.rotate);
      this.addChild(sprite);

      return new CompatTileSpriteController(sprite, texture, x, y);
    }

    destroy(options?: any) {
      this.clear();
      super.destroy(options);
    }
  }

  class CompatTileRenderer {}

  return {
    settings,
    TileRenderer: CompatTileRenderer,
    CompositeTilemap: CompatCompositeTilemap,
    CompositeRectTileLayer: CompatCompositeTilemap,
    Tilemap: CompatCompositeTilemap,
    RectTileLayer: CompatCompositeTilemap,
  };
};

export default createPixiTilemapCompat;
