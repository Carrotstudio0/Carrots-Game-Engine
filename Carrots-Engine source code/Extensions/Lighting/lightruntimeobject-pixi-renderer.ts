namespace gdjs {
  const logger = new gdjs.Logger('Light object');

  /**
   * Pixi renderer for light runtime objects.
   * @category Renderers > 2D Light
   */
  export class LightRuntimeObjectPixiRenderer {
    _object: gdjs.LightRuntimeObject;
    _instanceContainer: gdjs.RuntimeInstanceContainer;
    _manager: gdjs.LightObstaclesManager;
    _radius: number;
    _color: [number, number, number];
    _texture: PIXI.Texture | null = null;
    _normalMapTexture: PIXI.Texture | null = null;
    _lightType: gdjs.LightType;
    _intensity: number;
    _directionAngle: number;
    _specularStrength: number;
    _specularShininess: number;
    _shadowSoftness: number;
    _falloffModel: gdjs.LightFalloffModel;
    _antialiasing: gdjs.LightAntialiasing;
    _edgeSmoothing: number;
    _center: Float32Array;
    _defaultVertexBuffer: Float32Array;
    _vertexBuffer: Float32Array;
    _indexBuffer: Uint16Array;
    _light: PIXI.Mesh<PIXI.Shader> | null = null;
    _softShadowFilter: PIXI.Filter | null = null;
    _antialiasingFilter: PIXI.Filter | null = null;
    _isPreview: boolean;
    _debugMode: boolean = false;
    _debugLight: PIXI.Container | null = null;
    _debugGraphics: PIXI.Graphics | null = null;
    _lightIconSprite: PIXI.Sprite | null = null;

    /**
     * A polygon updated when vertices of the light are computed
     * to be a polygon bounding the light and its obstacles.
     */
    _lightBoundingPoly: gdjs.Polygon;

    constructor(
      runtimeObject: gdjs.LightRuntimeObject,
      instanceContainer: gdjs.RuntimeInstanceContainer
    ) {
      this._object = runtimeObject;
      this._instanceContainer = instanceContainer;
      this._manager = runtimeObject.getObstaclesManager();
      this._radius = runtimeObject.getRadius();
      const objectColor = runtimeObject._color;
      this._color = [
        objectColor[0] / 255,
        objectColor[1] / 255,
        objectColor[2] / 255,
      ];
      this._lightType = runtimeObject.getLightType();
      this._intensity = runtimeObject.getIntensity();
      this._directionAngle = runtimeObject.getDirectionAngle();
      this._specularStrength = runtimeObject.getSpecularStrength();
      this._specularShininess = runtimeObject.getSpecularShininess();
      this._shadowSoftness = runtimeObject.getShadowSoftness();
      this._falloffModel = runtimeObject.getFalloffModel();
      this._antialiasing = runtimeObject.getAntialiasing();
      this._edgeSmoothing = runtimeObject.getEdgeSmoothing();
      this.updateTexture();
      this._center = new Float32Array([runtimeObject.x, runtimeObject.y]);
      this._defaultVertexBuffer = new Float32Array(8);
      this._vertexBuffer = new Float32Array([
        runtimeObject.x - this._radius,
        runtimeObject.y + this._radius,
        runtimeObject.x + this._radius,
        runtimeObject.y + this._radius,
        runtimeObject.x + this._radius,
        runtimeObject.y - this._radius,
        runtimeObject.x - this._radius,
        runtimeObject.y - this._radius,
      ]);
      this._indexBuffer = new Uint16Array([0, 1, 2, 0, 2, 3]);
      this.updateMesh();
      this._isPreview = instanceContainer.getGame().isPreview();
      this._lightBoundingPoly = gdjs.Polygon.createRectangle(0, 0);

      this.updateDebugMode();

      const game = this._object.getInstanceContainer().getGame();
      if (game.isInGameEdition()) {
        const texture = game
          .getImageManager()
          .getPIXITexture('InGameEditor-LightIcon');
        this._lightIconSprite = new PIXI.Sprite(texture);
        this._lightIconSprite.anchor.x = 0.5;
        this._lightIconSprite.anchor.y = 0.5;

        this._debugGraphics = new PIXI.Graphics();

        this._debugLight = new PIXI.Container();
        this._debugLight.addChild(this._debugGraphics);
        this._debugLight.addChild(this._lightIconSprite);
        // Force a 1st rendering of the circle.
        this._radius = 0;
      }

      // Objects will be added in lighting layer, this is just to maintain consistency.
      const rendererObject = this.getRendererObject();
      if (rendererObject) {
        instanceContainer
          .getLayer('')
          .getRenderer()
          .addRendererObject(rendererObject, runtimeObject.getZOrder());
      }
    }

    destroy(): void {
      if (this._lightIconSprite) {
        this._lightIconSprite.removeFromParent();
        this._lightIconSprite.destroy();
        this._lightIconSprite = null;
      }
      if (this._debugGraphics) {
        this._debugGraphics.removeFromParent();
        this._debugGraphics.destroy();
        this._debugGraphics = null;
      }
      if (this._light) {
        this._light.removeFromParent();
        this._light.destroy();
        this._light = null;
      }
      if (this._softShadowFilter) {
        this._softShadowFilter.destroy();
        this._softShadowFilter = null;
      }
      if (this._antialiasingFilter) {
        this._antialiasingFilter.destroy();
        this._antialiasingFilter = null;
      }
      // We dot not destroy the texture, as it is managed by the PixiImageManager.
    }

    static _verticesWithAngleComparator(vertexWithAngleA, vertexWithAngleB) {
      if (vertexWithAngleA.angle < vertexWithAngleB.angle) {
        return -1;
      }
      if (vertexWithAngleA.angle > vertexWithAngleB.angle) {
        return 1;
      }
      return 0;
    }

    static _computeClosestIntersectionPoint(
      lightObject: gdjs.LightRuntimeObject,
      angle: float,
      polygons: Array<gdjs.Polygon>,
      boundingSquareHalfDiag: float
    ) {
      const centerX = lightObject.getX();
      const centerY = lightObject.getY();
      const targetX = centerX + boundingSquareHalfDiag * Math.cos(angle);
      const targetY = centerY + boundingSquareHalfDiag * Math.sin(angle);
      let minSqDist = boundingSquareHalfDiag * boundingSquareHalfDiag;
      const closestPoint: Array<integer | null> = [null, null];
      for (const poly of polygons) {
        const raycastResult = gdjs.Polygon.raycastTest(
          poly,
          centerX,
          centerY,
          targetX,
          targetY
        );
        if (raycastResult.collision && raycastResult.closeSqDist <= minSqDist) {
          minSqDist = raycastResult.closeSqDist;
          closestPoint[0] = raycastResult.closeX;
          closestPoint[1] = raycastResult.closeY;
        }
      }
      if (closestPoint[0] !== null && closestPoint[1] !== null) {
        return closestPoint;
      }
      return null;
    }

    getRendererObject(): PIXI.Mesh | null | PIXI.Container {
      if (this._debugLight) {
        return this._debugLight;
      }
      return this._light;
    }

    ensureUpToDate() {
      if (this._object.getInstanceContainer().getGame().isInGameEdition()) {
        if (!this._debugLight) {
          return;
        }
        this._debugLight.x = this._object.getX();
        this._debugLight.y = this._object.getY();
        const objectColor = this._object._color;
        const normalizedObjectColor: [number, number, number] = [
          objectColor[0] / 255,
          objectColor[1] / 255,
          objectColor[2] / 255,
        ];
        if (
          this._radius === this._object.getRadius() &&
          this._color[0] === normalizedObjectColor[0] &&
          this._color[1] === normalizedObjectColor[1] &&
          this._color[2] === normalizedObjectColor[2]
        ) {
          return;
        }
        if (this._debugGraphics) {
          this._radius = this._object.getRadius();
          this._color[0] = normalizedObjectColor[0];
          this._color[1] = normalizedObjectColor[1];
          this._color[2] = normalizedObjectColor[2];
          const radiusBorderWidth = 2;
          this._debugGraphics.clear();
          this._debugGraphics.lineStyle(
            radiusBorderWidth,
            gdjs.rgbToHexNumber(objectColor[0], objectColor[1], objectColor[2]),
            0.8
          );
          this._debugGraphics.drawCircle(
            0,
            0,
            Math.max(1, this._radius - radiusBorderWidth)
          );
        }
        return;
      }
      if (this._object.isHidden()) {
        return;
      }
      if (this._debugGraphics) {
        this._updateDebugGraphics();
      }
      this.updateLightParameters();
      this._updateBuffers();
    }

    updateMesh(): void {
      if (this._object.getInstanceContainer().getGame().isInGameEdition()) {
        return;
      }
      if (!PIXI.utils.isWebGLSupported()) {
        logger.warn(
          'This device does not support webgl, which is required for Lighting Extension.'
        );
        return;
      }
      this.updateTexture();
      this._syncRuntimeLightProperties();
      const shaderUniforms = {
        center: this._center,
        radius: this._radius,
        color: this._color,
        intensity: this._intensity,
        lightType: this._lightType === 'directional' ? 1 : 0,
        directionAngle: this._directionAngle,
        specularStrength: this._specularStrength,
        specularShininess: this._specularShininess,
        falloffModel: this._falloffModel === 'sdf' ? 1 : 0,
        edgeSmoothing: this._edgeSmoothing,
        useTexture: this._texture ? 1 : 0,
        useNormalMap: this._normalMapTexture ? 1 : 0,
        uSampler: this._texture || PIXI.Texture.WHITE,
        uNormalSampler: this._normalMapTexture || PIXI.Texture.WHITE,
      };
      const shader = PIXI.Shader.from(
        LightRuntimeObjectPixiRenderer.defaultVertexShader,
        LightRuntimeObjectPixiRenderer.enhancedFragmentShader,
        shaderUniforms
      );
      const geometry = new PIXI.Geometry();
      geometry
        .addAttribute('aVertexPosition', this._vertexBuffer, 2)
        .addIndex(this._indexBuffer);
      if (!this._light) {
        this._light = new PIXI.Mesh(geometry, shader);
        this._light.blendMode = PIXI.BLEND_MODES.ADD;
      } else {
        this._light.shader = shader;
        // @ts-ignore - replacing the read-only geometry
        this._light.geometry = geometry;
      }
      this._updateFilters();
    }

    updateRadius(): void {
      if (!this._light) {
        return;
      }
      this._radius = this._object.getRadius();
      this._light.shader.uniforms.radius = this._radius;
    }

    updateColor(): void {
      if (!this._light) {
        return;
      }
      const objectColor = this._object._color;
      this._color = [
        objectColor[0] / 255,
        objectColor[1] / 255,
        objectColor[2] / 255,
      ];
      this._light.shader.uniforms.color = this._color;
    }

    updateTexture(): void {
      const imageManager = this._instanceContainer
        .getGame()
        .getImageManager() as gdjs.PixiImageManager;

      const texture = this._object.getTexture();
      this._texture = texture !== '' ? imageManager.getPIXITexture(texture) : null;

      const normalMap = this._object.getNormalMap();
      this._normalMapTexture =
        normalMap !== '' ? imageManager.getPIXITexture(normalMap) : null;
    }

    updateLightParameters(): void {
      this._syncRuntimeLightProperties();
      if (!this._light) {
        return;
      }
      this._light.shader.uniforms.intensity = this._intensity;
      this._light.shader.uniforms.lightType =
        this._lightType === 'directional' ? 1 : 0;
      this._light.shader.uniforms.directionAngle = this._directionAngle;
      this._light.shader.uniforms.specularStrength = this._specularStrength;
      this._light.shader.uniforms.specularShininess = this._specularShininess;
      this._light.shader.uniforms.falloffModel =
        this._falloffModel === 'sdf' ? 1 : 0;
      this._light.shader.uniforms.edgeSmoothing = this._edgeSmoothing;
      this._light.shader.uniforms.useTexture = this._texture ? 1 : 0;
      this._light.shader.uniforms.useNormalMap = this._normalMapTexture ? 1 : 0;
      this._light.shader.uniforms.uSampler = this._texture || PIXI.Texture.WHITE;
      this._light.shader.uniforms.uNormalSampler =
        this._normalMapTexture || PIXI.Texture.WHITE;
      this._updateFilters();
    }

    private _syncRuntimeLightProperties(): void {
      this._lightType = this._object.getLightType();
      this._intensity = this._object.getIntensity();
      this._directionAngle = this._object.getDirectionAngle();
      this._specularStrength = this._object.getSpecularStrength();
      this._specularShininess = this._object.getSpecularShininess();
      this._shadowSoftness = this._object.getShadowSoftness();
      this._falloffModel = this._object.getFalloffModel();
      this._antialiasing = this._object.getAntialiasing();
      this._edgeSmoothing = this._object.getEdgeSmoothing();
    }

    private _updateFilters(): void {
      if (!this._light) {
        return;
      }

      const activeFilters: PIXI.Filter[] = [];

      if (this._antialiasing !== 'none') {
        if (!this._antialiasingFilter) {
          this._antialiasingFilter = new PIXI.FXAAFilter();
        }

        const antialiasingFilter = this._antialiasingFilter as any;
        antialiasingFilter.enabled = true;
        antialiasingFilter.multisample =
          PIXI.MSAA_QUALITY[this._antialiasing.toUpperCase()] ||
          PIXI.MSAA_QUALITY.LOW;

        activeFilters.push(this._antialiasingFilter as PIXI.Filter);
      } else if (this._antialiasingFilter) {
        this._antialiasingFilter.destroy();
        this._antialiasingFilter = null;
      }

      const BlurFilterClass =
        (PIXI as any).BlurFilter ||
        ((PIXI as any).filters && (PIXI as any).filters.BlurFilter);
      if (this._shadowSoftness <= 0 || !BlurFilterClass) {
        if (this._softShadowFilter) {
          this._softShadowFilter.destroy();
          this._softShadowFilter = null;
        }
      } else {
        if (!this._softShadowFilter) {
          this._softShadowFilter = new BlurFilterClass();
        }
        const blurFilter = this._softShadowFilter as any;
        blurFilter.blur = Math.min(64, this._shadowSoftness);
        blurFilter.quality = 1;
        blurFilter.multisample =
          this._antialiasing !== 'none'
            ? PIXI.MSAA_QUALITY[this._antialiasing.toUpperCase()] ||
              PIXI.MSAA_QUALITY.LOW
            : PIXI.MSAA_QUALITY.NONE;
        activeFilters.push(this._softShadowFilter as PIXI.Filter);
      }

      this._light.filters = activeFilters.length ? activeFilters : null;
    }

    updateDebugMode(): void {
      if (!this._light) {
        return;
      }
      this._debugMode = this._object.getDebugMode();
      if (!this._debugLight && (this._isPreview || this._debugMode)) {
        this._debugLight = new PIXI.Container();
        this._debugLight.addChild(this._light);
      }
      if (this._debugMode && !this._debugGraphics) {
        this._debugGraphics = new PIXI.Graphics();
        (this._debugLight as PIXI.Container).addChild(this._debugGraphics);
      }
      if (!this._debugMode && this._debugGraphics) {
        (this._debugLight as PIXI.Container).removeChild(this._debugGraphics);
        this._debugGraphics.destroy();
        this._debugGraphics = null;
      }
      this.ensureUpToDate();
    }

    _updateDebugGraphics() {
      const debugGraphics = this._debugGraphics as PIXI.Graphics;

      const computedVertices = this._computeLightVertices();
      if (!computedVertices.length) {
        debugGraphics.clear();
        debugGraphics
          .lineStyle(1, 16711680, 1)
          .moveTo(this._object.x, this._object.y)
          .lineTo(this._object.x - this._radius, this._object.y + this._radius)
          .lineTo(this._object.x + this._radius, this._object.y + this._radius)
          .moveTo(this._object.x, this._object.y)
          .lineTo(this._object.x + this._radius, this._object.y + this._radius)
          .lineTo(this._object.x + this._radius, this._object.y - this._radius)
          .moveTo(this._object.x, this._object.y)
          .lineTo(this._object.x + this._radius, this._object.y - this._radius)
          .lineTo(this._object.x - this._radius, this._object.y - this._radius)
          .moveTo(this._object.x, this._object.y)
          .lineTo(this._object.x - this._radius, this._object.y - this._radius)
          .lineTo(this._object.x - this._radius, this._object.y + this._radius);
        return;
      }
      const vertices = new Array(2 * computedVertices.length + 2);
      vertices[0] = this._object.x;
      vertices[1] = this._object.y;
      for (let i = 2; i < 2 * computedVertices.length + 2; i += 2) {
        vertices[i] = computedVertices[i / 2 - 1][0];
        vertices[i + 1] = computedVertices[i / 2 - 1][1];
      }
      debugGraphics.clear();
      debugGraphics.moveTo(vertices[2], vertices[3]);
      const verticesCount = vertices.length;
      for (let i = 2; i < verticesCount; i += 2) {
        const lineColor = i % 4 === 0 ? 16711680 : 65280;
        const lastX = i + 2 >= verticesCount ? 2 : i + 2;
        const lastY = i + 3 >= verticesCount ? 3 : i + 3;
        debugGraphics
          .lineStyle(1, lineColor, 1)
          .lineTo(vertices[i], vertices[i + 1])
          .lineTo(vertices[lastX], vertices[lastY])
          .moveTo(vertices[0], vertices[1])
          .lineTo(vertices[i], vertices[i + 1])
          .moveTo(vertices[0], vertices[1])
          .lineTo(vertices[lastX], vertices[lastY]);
      }
    }

    _updateBuffers() {
      if (!this._light) {
        return;
      }
      this._center[0] = this._object.x;
      this._center[1] = this._object.y;
      const vertices = this._computeLightVertices();

      // Fallback to simple quad when there are no obstacles around.
      if (vertices.length === 0) {
        this._defaultVertexBuffer[0] = this._object.x - this._radius;
        this._defaultVertexBuffer[1] = this._object.y + this._radius;
        this._defaultVertexBuffer[2] = this._object.x + this._radius;
        this._defaultVertexBuffer[3] = this._object.y + this._radius;
        this._defaultVertexBuffer[4] = this._object.x + this._radius;
        this._defaultVertexBuffer[5] = this._object.y - this._radius;
        this._defaultVertexBuffer[6] = this._object.x - this._radius;
        this._defaultVertexBuffer[7] = this._object.y - this._radius;
        this._light.shader.uniforms.center = this._center;
        this._light.geometry
          .getBuffer('aVertexPosition')
          .update(this._defaultVertexBuffer);
        this._light.geometry
          .getIndex()
          .update(LightRuntimeObjectPixiRenderer._defaultIndexBuffer);
        return;
      }
      const verticesCount = vertices.length;

      // If the array buffer which is already allocated is at most
      // twice the size of memory required, we could avoid re-allocation
      // and instead use a subarray. Otherwise, allocate new array buffers as
      // there would be memory wastage.
      let isSubArrayUsed = false;
      let vertexBufferSubArray: Float32Array | null = null;
      let indexBufferSubArray: Uint16Array | null = null;
      if (this._vertexBuffer.length > 2 * verticesCount + 2) {
        if (this._vertexBuffer.length < 4 * verticesCount + 4) {
          isSubArrayUsed = true;
          vertexBufferSubArray = this._vertexBuffer.subarray(
            0,
            2 * verticesCount + 2
          );
          indexBufferSubArray = this._indexBuffer.subarray(
            0,
            3 * verticesCount
          );
        } else {
          this._vertexBuffer = new Float32Array(2 * verticesCount + 2);
          this._indexBuffer = new Uint16Array(3 * verticesCount);
        }
      }

      // When the allocated array buffer has less memory than
      // required, we'll have to allocated new array buffers.
      if (this._vertexBuffer.length < 2 * verticesCount + 2) {
        this._vertexBuffer = new Float32Array(2 * verticesCount + 2);
        this._indexBuffer = new Uint16Array(3 * verticesCount);
      }
      this._vertexBuffer[0] = this._object.x;
      this._vertexBuffer[1] = this._object.y;
      for (let i = 2; i < 2 * verticesCount + 2; i += 2) {
        this._vertexBuffer[i] = vertices[i / 2 - 1][0];
        this._vertexBuffer[i + 1] = vertices[i / 2 - 1][1];
      }
      for (let i = 0; i < 3 * verticesCount; i += 3) {
        this._indexBuffer[i] = 0;
        this._indexBuffer[i + 1] = i / 3 + 1;
        if (i / 3 + 1 !== verticesCount) {
          this._indexBuffer[i + 2] = i / 3 + 2;
        } else {
          this._indexBuffer[i + 2] = 1;
        }
      }
      this._light.shader.uniforms.center = this._center;
      if (!isSubArrayUsed) {
        this._light.geometry
          .getBuffer('aVertexPosition')
          .update(this._vertexBuffer);
        this._light.geometry.getIndex().update(this._indexBuffer);
      } else {
        this._light.geometry
          .getBuffer('aVertexPosition')
          // @ts-ignore
          .update(vertexBufferSubArray);
        // @ts-ignore
        this._light.geometry.getIndex().update(indexBufferSubArray);
      }
    }

    /**
     * Computes the vertices of mesh using raycasting.
     * @returns the vertices of mesh.
     */
    _computeLightVertices(): Array<FloatPoint> {
      const lightObstacles: gdjs.LightObstacleRuntimeBehavior[] = [];
      if (this._manager) {
        this._manager.getAllObstaclesAround(
          this._object,
          this._radius,
          lightObstacles
        );
      }
      const searchAreaLeft = this._object.getX() - this._radius;
      const searchAreaTop = this._object.getY() - this._radius;
      const searchAreaRight = this._object.getX() + this._radius;
      const searchAreaBottom = this._object.getY() + this._radius;

      // Bail out early if there are no obstacles.
      if (lightObstacles.length === 0) {
        // @ts-ignore TODO the array should probably be pass as a parameter.
        return lightObstacles;
      }

      // Synchronize light bounding polygon with the hitbox.
      // Note: we suppose the hitbox is always a single rectangle.
      const objectHitBox = this._object.getHitBoxes()[0];
      for (let i = 0; i < 4; i++) {
        this._lightBoundingPoly.vertices[i][0] = objectHitBox.vertices[i][0];
        this._lightBoundingPoly.vertices[i][1] = objectHitBox.vertices[i][1];
      }

      // Create the list of polygons to compute the light vertices
      const obstaclePolygons: Array<gdjs.Polygon> = [];
      obstaclePolygons.push(this._lightBoundingPoly);
      for (let i = 0; i < lightObstacles.length; i++) {
        const obstacleHitBoxes = lightObstacles[i].owner.getHitBoxesAround(
          searchAreaLeft,
          searchAreaTop,
          searchAreaRight,
          searchAreaBottom
        );
        for (const hitbox of obstacleHitBoxes) {
          obstaclePolygons.push(hitbox);
        }
      }

      let maxX = this._object.x + this._radius;
      let minX = this._object.x - this._radius;
      let maxY = this._object.y + this._radius;
      let minY = this._object.y - this._radius;
      const flattenVertices: Array<FloatPoint> = [];
      for (let i = 1; i < obstaclePolygons.length; i++) {
        const vertices = obstaclePolygons[i].vertices;
        const verticesCount = vertices.length;
        for (let j = 0; j < verticesCount; j++) {
          flattenVertices.push(vertices[j]);
          if (vertices[j][0] < minX) {
            minX = vertices[j][0];
          }
          if (vertices[j][0] > maxX) {
            maxX = vertices[j][0];
          }
          if (vertices[j][1] < minY) {
            minY = vertices[j][1];
          }
          if (vertices[j][1] > maxY) {
            maxY = vertices[j][1];
          }
        }
      }
      obstaclePolygons[0].vertices[0][0] = minX;
      obstaclePolygons[0].vertices[0][1] = minY;
      obstaclePolygons[0].vertices[1][0] = maxX;
      obstaclePolygons[0].vertices[1][1] = minY;
      obstaclePolygons[0].vertices[2][0] = maxX;
      obstaclePolygons[0].vertices[2][1] = maxY;
      obstaclePolygons[0].vertices[3][0] = minX;
      obstaclePolygons[0].vertices[3][1] = maxY;

      // Find the largest diagonal length.
      const boundingSquareHalfDiag = Math.sqrt(
        Math.max(
          (this._object.x - minX) * (this._object.x - minX) +
            (this._object.y - minY) * (this._object.y - minY),
          (maxX - this._object.x) * (maxX - this._object.x) +
            (this._object.y - minY) * (this._object.y - minY),
          (maxX - this._object.x) * (maxX - this._object.x) +
            (maxY - this._object.y) * (maxY - this._object.y),
          (this._object.x - minX) * (this._object.x - minX) +
            (maxY - this._object.y) * (maxY - this._object.y)
        )
      );
      // Add this._object.hitBoxes vertices.
      for (let i = 0; i < 4; i++) {
        flattenVertices.push(obstaclePolygons[0].vertices[i]);
      }
      const closestVertices: Array<any> = [];
      const flattenVerticesCount = flattenVertices.length;
      for (let i = 0; i < flattenVerticesCount; i++) {
        const xdiff = flattenVertices[i][0] - this._object.x;
        const ydiff = flattenVertices[i][1] - this._object.y;
        const angle = Math.atan2(ydiff, xdiff);
        const closestVertex =
          LightRuntimeObjectPixiRenderer._computeClosestIntersectionPoint(
            this._object,
            angle,
            obstaclePolygons,
            boundingSquareHalfDiag
          );
        if (closestVertex) {
          closestVertices.push({ vertex: closestVertex, angle: angle });
        }

        // TODO: Check whether we need to raycast these two extra rays or not.
        const closestVertexOffsetLeft =
          LightRuntimeObjectPixiRenderer._computeClosestIntersectionPoint(
            this._object,
            angle + 0.0001,
            obstaclePolygons,
            boundingSquareHalfDiag
          );
        if (closestVertexOffsetLeft) {
          closestVertices.push({
            vertex: closestVertexOffsetLeft,
            angle: angle + 0.0001,
          });
        }
        const closestVertexOffsetRight =
          LightRuntimeObjectPixiRenderer._computeClosestIntersectionPoint(
            this._object,
            angle - 0.0001,
            obstaclePolygons,
            boundingSquareHalfDiag
          );
        if (closestVertexOffsetRight) {
          closestVertices.push({
            vertex: closestVertexOffsetRight,
            angle: angle - 0.0001,
          });
        }
      }
      closestVertices.sort(
        LightRuntimeObjectPixiRenderer._verticesWithAngleComparator
      );
      const closestVerticesCount = closestVertices.length;
      if (closestVerticesCount === 0) return [];
      const filteredVerticesResult = [closestVertices[0].vertex];
      for (let i = 1; i < closestVerticesCount; i++) {
        if (closestVertices[i].angle !== closestVertices[i - 1].angle) {
          filteredVerticesResult.push(closestVertices[i].vertex);
        }
      }
      return filteredVerticesResult;
    }

    static _defaultIndexBuffer = new Uint16Array([0, 1, 2, 0, 2, 3]);
    static defaultVertexShader = `
  precision highp float;
  attribute vec2 aVertexPosition;

  uniform mat3 translationMatrix;
  uniform mat3 projectionMatrix;
  varying vec2 vPos;

  void main() {
      vPos = aVertexPosition;
      gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
  }`;
    static enhancedFragmentShader = `
  precision highp float;
  uniform vec2 center;
  uniform float radius;
  uniform vec3 color;
  uniform float intensity;
  uniform float lightType;
  uniform float directionAngle;
  uniform float specularStrength;
  uniform float specularShininess;
  uniform float falloffModel;
  uniform float edgeSmoothing;
  uniform float useTexture;
  uniform float useNormalMap;
  uniform sampler2D uSampler;
  uniform sampler2D uNormalSampler;
  varying vec2 vPos;

  float computeFalloff(float distanceToCenter) {
    float safeRadius = max(radius, 0.0001);
    float normalizedDistance = clamp(distanceToCenter / safeRadius, 0.0, 1.0);
    float smoothing = max(0.0, edgeSmoothing);
    float edgeWidth = max(smoothing, 0.0001);
    float radiusMask =
      smoothing > 0.0
        ? 1.0 - smoothstep(safeRadius - edgeWidth, safeRadius + edgeWidth, distanceToCenter)
        : (distanceToCenter <= safeRadius ? 1.0 : 0.0);
    if (falloffModel > 0.5) {
      float sdf = distanceToCenter - safeRadius;
      float sdfWidth = max(edgeWidth, safeRadius * 0.02);
      float sdfFade = 1.0 - smoothstep(0.0, sdfWidth, sdf);
      return sdfFade * radiusMask;
    }
    float fade = max(1.0 - normalizedDistance, 0.0);
    return fade * fade * radiusMask;
  }

  void main() {
    vec2 topleft = vec2(center.x - radius, center.y - radius);
    vec2 texCoord = (vPos - topleft) / (2.0 * max(radius, 0.0001));
    vec2 safeTexCoord = clamp(texCoord, 0.0, 1.0);
    float uvEdgeDistance = min(
      min(texCoord.x, 1.0 - texCoord.x),
      min(texCoord.y, 1.0 - texCoord.y)
    );
    float uvSmoothing = edgeSmoothing / max(radius * 2.0, 1.0);
    float uvMask = edgeSmoothing > 0.0
      ? smoothstep(-uvSmoothing, uvSmoothing, uvEdgeDistance)
      : (uvEdgeDistance > 0.0 ? 1.0 : 0.0);
    if (uvMask <= 0.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
      return;
    }

    float distanceToCenter = length(vPos - center);
    float attenuation = computeFalloff(distanceToCenter) * uvMask;
    if (lightType > 0.5) {
      float angleRad = radians(directionAngle);
      vec2 direction = normalize(vec2(cos(angleRad), sin(angleRad)));
      vec2 fromCenter = vPos - center;
      float fromCenterLength = length(fromCenter);
      vec2 fromCenterDirection =
        fromCenterLength > 0.0001 ? fromCenter / fromCenterLength : vec2(0.0, -1.0);
      float projection = dot(fromCenterDirection, -direction);
      float directionalMask = clamp(0.5 + 0.5 * projection, 0.0, 1.0);
      attenuation *= directionalMask;
    }

    float diffuse = 1.0;
    float specular = 0.0;
    if (useNormalMap > 0.5) {
      vec3 normalSample = texture2D(uNormalSampler, safeTexCoord).xyz * 2.0 - 1.0;
      vec3 normal = normalize(vec3(normalSample.xy, max(normalSample.z, 0.001)));
      vec3 lightDir;
      if (lightType > 0.5) {
        float angleRad = radians(directionAngle);
        lightDir = normalize(vec3(cos(angleRad), sin(angleRad), 0.35));
      } else {
        vec2 toLight = center - vPos;
        lightDir = normalize(vec3(toLight, max(radius, 1.0) * 0.35));
      }
      diffuse = max(dot(normal, lightDir), 0.0);
      vec3 viewDir = vec3(0.0, 0.0, 1.0);
      vec3 halfDir = normalize(lightDir + viewDir);
      specular =
        pow(max(dot(normal, halfDir), 0.0), max(1.0, specularShininess)) *
        specularStrength;
    }

    vec4 baseTextureColor =
      useTexture > 0.5 ? texture2D(uSampler, safeTexCoord) : vec4(1.0);
    vec3 litColor = color * max(0.0, intensity) * attenuation * (diffuse + specular);
    gl_FragColor = vec4(litColor, 1.0) * baseTextureColor;
  }`;
  }

  /**
   * @category Renderers > 2D Light
   */
  // @ts-ignore - Register the class to let the engine use it.
  export const LightRuntimeObjectRenderer = LightRuntimeObjectPixiRenderer;
  /**
   * @category Renderers > 2D Light
   */
  export type LightRuntimeObjectRenderer = LightRuntimeObjectPixiRenderer;
}
