namespace gdjs {
  /**
   * The PIXI.js renderer for the Bitmap Text runtime object.
   * @category Renderers > Bitmap Text
   */
  export class BitmapTextRuntimeObjectPixiRenderer {
    _object: gdjs.BitmapTextRuntimeObject;
    _pixiObject: PIXI.BitmapText;

    private _getBitmapFontManager(): gdjs.PixiBitmapFontManager {
      return this._object
        .getInstanceContainer()
        .getGame()
        .getBitmapFontManager() as gdjs.PixiBitmapFontManager;
    }

    private _getCurrentBitmapFontInstallKey(): string {
      const fontFamily = this._pixiObject.style.fontFamily;
      return Array.isArray(fontFamily) ? fontFamily[0] || '' : fontFamily || '';
    }

    /**
     * @param runtimeObject The object to render
     * @param instanceContainer The container in which the object is
     */
    constructor(
      runtimeObject: gdjs.BitmapTextRuntimeObject,
      instanceContainer: gdjs.RuntimeInstanceContainer
    ) {
      this._object = runtimeObject;

      // Obtain the bitmap font to use in the object.
      const bitmapFont = instanceContainer
        .getGame()
        .getBitmapFontManager()
        .obtainBitmapFont(
          runtimeObject._bitmapFontResourceName,
          runtimeObject._textureAtlasResourceName
        ) as PIXI.BitmapFont;
      const bitmapFontInstallKey = (
        instanceContainer.getGame().getBitmapFontManager() as gdjs.PixiBitmapFontManager
      ).getBitmapFontInstallKey(
        runtimeObject._bitmapFontResourceName,
        runtimeObject._textureAtlasResourceName
      );
      this._pixiObject = new PIXI.BitmapText({
        text: runtimeObject._text,
        style: {
          fontFamily: bitmapFontInstallKey,
          fontSize: bitmapFont.size,
          align: runtimeObject._textAlign as PIXI.TextStyleAlign | undefined,
        },
      });

      // Set the object on the scene
      instanceContainer
        .getLayer('')
        .getRenderer()
        .addRendererObject(this._pixiObject, runtimeObject.getZOrder());

      this.updateAlignment();
      this.updateTextContent();
      this.updateAngle();
      this.updateOpacity();
      this.updateScale();
      this.updateWrappingWidth();
      this.updateTint();
    }

    getRendererObject() {
      return this._pixiObject;
    }

    onDestroy() {
      // Mark the font from the object as not used anymore.
      this._object
        .getInstanceContainer()
        .getGame()
        .getBitmapFontManager()
        .releaseBitmapFont(this._getCurrentBitmapFontInstallKey());

      this._pixiObject.destroy();
    }

    getFontSize() {
      const fontSize = this._pixiObject.style.fontSize;
      return typeof fontSize === 'number' ? fontSize : Number(fontSize) || 0;
    }

    updateFont(): void {
      const bitmapFontManager = this._getBitmapFontManager();
      // Get the new bitmap font to use
      const bitmapFont = bitmapFontManager.obtainBitmapFont(
        this._object._bitmapFontResourceName,
        this._object._textureAtlasResourceName
      );
      const newBitmapFontInstallKey = bitmapFontManager.getBitmapFontInstallKey(
        this._object._bitmapFontResourceName,
        this._object._textureAtlasResourceName
      );

      // Mark the old font as not used anymore
      bitmapFontManager.releaseBitmapFont(this._getCurrentBitmapFontInstallKey());

      // Update the font used by the object:
      this._pixiObject.style.fontFamily = newBitmapFontInstallKey;
      this._pixiObject.style.fontSize = bitmapFont.size;
      this.updatePosition();
    }

    updateTint(): void {
      this._pixiObject.tint = gdjs.rgbToHexNumber(
        this._object._tint[0],
        this._object._tint[1],
        this._object._tint[2]
      );
    }

    /**
     * Get the tint of the bitmap object as a "R;G;B" string.
     * @returns the tint of bitmap object in "R;G;B" format.
     */
    getTint(): string {
      return (
        this._object._tint[0] +
        ';' +
        this._object._tint[1] +
        ';' +
        this._object._tint[2]
      );
    }

    updateScale(): void {
      this._pixiObject.scale.set(
        Math.max(this._object._scaleX, 0),
        Math.max(this._object._scaleY, 0)
      );
      this.updatePosition();
    }

    getScale() {
      return Math.max(this._pixiObject.scale.x, this._pixiObject.scale.y);
    }

    updateWrappingWidth(): void {
      this._pixiObject.style.wordWrap = this._object._wrapping;
      this._pixiObject.style.wordWrapWidth =
        this._object._wrapping && this._object._scaleX !== 0
          ? this._object._wrappingWidth / this._object._scaleX
          : 0;
      this.updatePosition();
    }

    updateTextContent(): void {
      this._pixiObject.text = this._object._text;
      this.updatePosition();
    }

    updateAlignment(): void {
      this._pixiObject.style.align =
        this._object._textAlign as PIXI.TextStyleAlign;
      this.updatePosition();
    }

    updatePosition(): void {
      if (this._object.isWrapping() && this.getWidth() !== 0) {
        const alignmentX =
          this._object._textAlign === 'right'
            ? 1
            : this._object._textAlign === 'center'
              ? 0.5
              : 0;

        const width = this._object.getWrappingWidth();
        const renderedWidth = this.getWidth();

        // A vector from the custom size center to the renderer center.
        const centerToCenterX = (width - renderedWidth) * (alignmentX - 0.5);

        this._pixiObject.position.x = this._object.x + width / 2;
        this._pixiObject.anchor.x = 0.5 - centerToCenterX / renderedWidth;
      } else {
        this._pixiObject.position.x = this._object.x + this.getWidth() / 2;
        this._pixiObject.anchor.x = 0.5;
      }

      const alignmentY =
        this._object._verticalTextAlignment === 'bottom'
          ? 1
          : this._object._verticalTextAlignment === 'center'
            ? 0.5
            : 0;
      this._pixiObject.position.y =
        this._object.y + this.getHeight() * (0.5 - alignmentY);
      this._pixiObject.anchor.y = 0.5;
    }

    updateAngle(): void {
      this._pixiObject.rotation = gdjs.toRad(this._object.angle);
    }

    updateOpacity(): void {
      this._pixiObject.alpha = this._object._opacity / 255;
    }

    getWidth(): float {
      return this._pixiObject.width;
    }

    getHeight(): float {
      return this._pixiObject.height;
    }
  }

  /**
   * @category Renderers > Bitmap Text
   */
  export const BitmapTextRuntimeObjectRenderer =
    BitmapTextRuntimeObjectPixiRenderer;
}
