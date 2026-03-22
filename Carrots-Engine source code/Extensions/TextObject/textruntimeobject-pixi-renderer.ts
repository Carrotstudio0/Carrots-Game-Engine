namespace gdjs {
  class TextRuntimeObjectPixiRenderer {
    _object: gdjs.TextRuntimeObject;
    _fontManager: any;
    _text: PIXI.Text;
    _justCreated: boolean = true;

    constructor(
      runtimeObject: gdjs.TextRuntimeObject,
      instanceContainer: gdjs.RuntimeInstanceContainer
    ) {
      this._object = runtimeObject;
      this._fontManager = instanceContainer.getGame().getFontManager();
      this._text = new PIXI.Text(' ', { align: 'left' });
      this._text.anchor.x = 0.5;
      this._text.anchor.y = 0.5;
      instanceContainer
        .getLayer('')
        .getRenderer()
        .addRendererObject(this._text, runtimeObject.getZOrder());
      this._text.text =
        runtimeObject._str.length === 0 ? ' ' : runtimeObject._str;

      //Work around a PIXI.js bug. See updateTime method.
      this.updateStyle();
      this.updatePosition();
    }

    getRendererObject() {
      return this._text;
    }

    ensureUpToDate() {
      if (this._justCreated) {
        // Keep compatibility with Pixi v7 and v8 text internals.
        this._refreshTextLayoutIfNeeded();

        //Width seems not to be correct when text is not rendered yet.
        this.updatePosition();
        this._justCreated = false;
      }
    }

    updateStyle(): void {
      const fontName =
        '"' + this._fontManager.getFontFamily(this._object._fontName) + '"';
      const style = new PIXI.TextStyle({
        fontStyle: this._object._italic ? 'italic' : 'normal',
        fontWeight: this._object._bold ? 'bold' : 'normal',
        fontSize: this._object._characterSize,
        fontFamily: fontName,
        fill: this._object._useGradient
          ? this._createGradientFill()
          : this._getColorHex(),
        align: this._object._textAlign as PIXI.TextStyleAlign | undefined,
        wordWrap: this._object._wrapping,
        wordWrapWidth: this._object._wrappingWidth,
        breakWords: true,
        stroke: {
          color: gdjs.rgbToHexNumber(
            this._object._outlineColor[0],
            this._object._outlineColor[1],
            this._object._outlineColor[2]
          ),
          width: this._object._isOutlineEnabled
            ? this._object._outlineThickness
            : 0,
          miterLimit: 3,
        },
        dropShadow: this._object._shadow
          ? {
              color: gdjs.rgbToHexNumber(
                this._object._shadowColor[0],
                this._object._shadowColor[1],
                this._object._shadowColor[2]
              ),
              alpha: this._object._shadowOpacity / 255,
              blur: this._object._shadowBlur,
              angle: gdjs.toRad(this._object._shadowAngle),
              distance: this._object._shadowDistance,
            }
          : false,
      });
      const extraPaddingForShadow = this._object._shadow
        ? this._object._shadowDistance + this._object._shadowBlur
        : 0;
      style.padding = Math.ceil(this._object._padding + extraPaddingForShadow);
      style.lineHeight = this._object._lineHeight;
      this._text.style = style;
      this.updatePosition();

      this._refreshTextLayoutIfNeeded();
    }

    updatePosition(): void {
      if (this._object.isWrapping() && this._text.width !== 0) {
        const alignmentX =
          this._object._textAlign === 'right'
            ? 1
            : this._object._textAlign === 'center'
              ? 0.5
              : 0;

        const width = this._object.getWrappingWidth();

        // A vector from the custom size center to the renderer center.
        const centerToCenterX = (width - this._text.width) * (alignmentX - 0.5);

        this._text.position.x = this._object.x + width / 2;
        this._text.anchor.x = 0.5 - centerToCenterX / this._text.width;
      } else {
        this._text.position.x = this._object.x + this._text.width / 2;
        this._text.anchor.x = 0.5;
      }

      const alignmentY =
        this._object._verticalTextAlignment === 'bottom'
          ? 1
          : this._object._verticalTextAlignment === 'center'
            ? 0.5
            : 0;
      this._text.position.y =
        this._object.y + this._text.height * (0.5 - alignmentY);
      this._text.anchor.y = 0.5;
    }

    updateAngle(): void {
      this._text.rotation = gdjs.toRad(this._object.angle);
    }

    updateOpacity(): void {
      this._text.alpha = this._object.opacity / 255;
    }

    updateString(): void {
      this._text.text =
        this._object._str.length === 0 ? ' ' : this._object._str;

      // Keep compatibility with Pixi v7 and v8 text internals.
      this._refreshTextLayoutIfNeeded();
    }

    getWidth(): float {
      return this._text.width;
    }

    getHeight(): float {
      return this._text.height;
    }

    _getColorHex() {
      return gdjs.rgbToHexNumber(
        this._object._color[0],
        this._object._color[1],
        this._object._color[2]
      );
    }

    _createGradientFill() {
      const gradient = new PIXI.FillGradient({
        start: { x: 0, y: 0 },
        end:
          this._object._gradientType === 'LINEAR_VERTICAL'
            ? { x: 0, y: 1 }
            : { x: 1, y: 0 },
        textureSpace: 'local',
      });
      const lastColorIndex = Math.max(this._object._gradient.length - 1, 1);
      for (
        let colorIndex = 0;
        colorIndex < this._object._gradient.length;
        colorIndex++
      ) {
        gradient.addColorStop(
          colorIndex / lastColorIndex,
          '#' +
            gdjs.rgbToHex(
              this._object._gradient[colorIndex][0],
              this._object._gradient[colorIndex][1],
              this._object._gradient[colorIndex][2]
            )
        );
      }
      return gradient;
    }

    /**
     * Get x-scale of the text.
     */
    getScaleX(): float {
      return this._text.scale.x;
    }

    /**
     * Get y-scale of the text.
     */
    getScaleY(): float {
      return this._text.scale.y;
    }

    /**
     * Set the text object scale.
     * @param newScale The new scale for the text object.
     */
    setScale(newScale: float): void {
      this._text.scale.x = newScale;
      this._text.scale.y = newScale;
    }

    /**
     * Set the text object x-scale.
     * @param newScale The new x-scale for the text object.
     */
    setScaleX(newScale: float): void {
      this._text.scale.x = newScale;
    }

    /**
     * Set the text object y-scale.
     * @param newScale The new y-scale for the text object.
     */
    setScaleY(newScale: float): void {
      this._text.scale.y = newScale;
    }

    private _refreshTextLayoutIfNeeded(): void {
      const textAsAny = this._text as PIXI.Text & {
        updateText?: (respectDirty?: boolean) => void;
        updateBounds?: () => void;
      };
      if (textAsAny.updateText) {
        textAsAny.updateText(false);
        return;
      }
      if (textAsAny.updateBounds) {
        textAsAny.updateBounds();
      }
    }

    destroy() {
      this._text.destroy(true);
    }
  }

  // Register the class to let the engine use it.
  /**
   * @category Renderers > Text
   */
  export const TextRuntimeObjectRenderer = TextRuntimeObjectPixiRenderer;
  /**
   * @category Renderers > Text
   */
  export type TextRuntimeObjectRenderer = TextRuntimeObjectPixiRenderer;
}
