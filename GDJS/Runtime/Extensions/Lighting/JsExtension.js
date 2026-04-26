//@ts-check
/// <reference path="../JsExtensionTypes.d.ts" />
/**
 * This is a declaration of an extension for GDevelop 5.
 *
 * ℹ️ Changes in this file are watched and automatically imported if the editor
 * is running. You can also manually run `node import-GDJS-Runtime.js` (in newIDE/app/scripts).
 *
 * The file must be named "JsExtension.js", otherwise GDevelop won't load it.
 * ⚠️ If you make a change and the extension is not loaded, open the developer console
 * and search for any errors.
 *
 * More information on https://github.com/4ian/GDevelop/blob/master/newIDE/README-extensions.md
 */

/** @type {ExtensionModule} */
module.exports = {
  createExtension: function (_, gd) {
    const extension = new gd.PlatformExtension();
    extension
      .setExtensionInformation(
        'Lighting',
        _('Lights'),

        'This provides a 2D light object, and a behavior to mark other 2D objects as being obstacles for the lights. This is a great way to create a special atmosphere to your game, along with effects, make it more realistic or to create gameplays based on lights.',
        'Harsimran Virk',
        'MIT'
      )
      .setShortDescription(
        'Advanced 2D lighting with point/directional modes, normal mapping, specular highlights, and configurable hard/soft shadows.'
      )
      .setDimension('2D')
      .setCategory('Visual effect')
      .setTags('light');

    const lightObstacleBehavior = new gd.BehaviorJsImplementation();
    lightObstacleBehavior.updateProperty = function (
      behaviorContent,
      propertyName,
      newValue
    ) {
      return false;
    };

    lightObstacleBehavior.getProperties = function (behaviorContent) {
      const behaviorProperties = new gd.MapStringPropertyDescriptor();

      return behaviorProperties;
    };

    lightObstacleBehavior.initializeContent = function (behaviorContent) {};
    extension
      .addBehavior(
        'LightObstacleBehavior',
        _('Light Obstacle Behavior'),
        'LightObstacleBehavior',
        _(
          'Flag objects as being obstacles to 2D lights. The light emitted by light objects will be stopped by the object. This does not work on 3D objects and 3D games.'
        ),
        '',
        'CppPlatform/Extensions/lightObstacleIcon32.png',
        'LightObstacleBehavior',
        //@ts-ignore The class hierarchy is incorrect leading to a type error, but this is valid.
        lightObstacleBehavior,
        new gd.BehaviorsSharedData()
      )
      .setIncludeFile('Extensions/Lighting/lightobstacleruntimebehavior.js')
      .addIncludeFile('Extensions/Lighting/lightruntimeobject.js')
      .addIncludeFile(
        'Extensions/Lighting/lightruntimeobject-pixi-renderer.js'
      );

    const lightObject = new gd.ObjectJsImplementation();

    lightObject.updateProperty = function (propertyName, newValue) {
      const objectContent = this.content;
      if (propertyName === 'radius') {
        objectContent.radius = parseFloat(newValue);
        return true;
      }

      if (propertyName === 'color') {
        objectContent.color = newValue;
        return true;
      }

      if (propertyName === 'debugMode') {
        objectContent.debugMode = newValue === '1';
        return true;
      }

      if (propertyName === 'texture') {
        objectContent.texture = newValue;
        return true;
      }

      if (propertyName === 'normalMap') {
        objectContent.normalMap = newValue;
        return true;
      }

      if (propertyName === 'lightType') {
        objectContent.lightType =
          newValue === 'directional' ? 'directional' : 'point';
        return true;
      }

      if (propertyName === 'intensity') {
        objectContent.intensity = Math.max(0, parseFloat(newValue) || 0);
        return true;
      }

      if (propertyName === 'directionAngle') {
        objectContent.directionAngle = parseFloat(newValue) || 0;
        return true;
      }

      if (propertyName === 'specularStrength') {
        objectContent.specularStrength = Math.max(0, parseFloat(newValue) || 0);
        return true;
      }

      if (propertyName === 'specularShininess') {
        objectContent.specularShininess = Math.max(
          1,
          parseFloat(newValue) || 1
        );
        return true;
      }

      if (propertyName === 'shadowSoftness') {
        objectContent.shadowSoftness = Math.max(0, parseFloat(newValue) || 0);
        return true;
      }

      if (propertyName === 'falloffModel') {
        objectContent.falloffModel = newValue === 'sdf' ? 'sdf' : 'quadratic';
        return true;
      }

      if (propertyName === 'antialiasing') {
        const isKnownQuality =
          newValue === 'none' ||
          newValue === 'low' ||
          newValue === 'medium' ||
          newValue === 'high';
        objectContent.antialiasing = isKnownQuality ? newValue : 'none';
        return true;
      }

      if (propertyName === 'edgeSmoothing') {
        objectContent.edgeSmoothing = Math.max(0, parseFloat(newValue) || 0);
        return true;
      }

      return false;
    };

    lightObject.getProperties = function () {
      const objectProperties = new gd.MapStringPropertyDescriptor();
      const objectContent = this.content;
      const getNumberOrDefault = (value, defaultValue) =>
        typeof value === 'number' && Number.isFinite(value)
          ? value
          : defaultValue;

      objectProperties.set(
        'radius',
        new gd.PropertyDescriptor(objectContent.radius.toString())
          .setType('number')
          .setLabel(_('Radius'))
      );

      objectProperties.set(
        'color',
        new gd.PropertyDescriptor(objectContent.color)
          .setType('color')
          .setLabel(_('Color'))
      );

      objectProperties
        .getOrCreate('lightType')
        .setValue(objectContent.lightType || 'point')
        .setType('choice')
        .addChoice('point', _('Point'))
        .addChoice('directional', _('Directional'))
        .setLabel(_('Light type'))
        .setGroup(_('Lighting'));

      objectProperties
        .getOrCreate('intensity')
        .setValue(getNumberOrDefault(objectContent.intensity, 1).toString())
        .setType('number')
        .setLabel(_('Intensity'))
        .setGroup(_('Lighting'));

      objectProperties
        .getOrCreate('directionAngle')
        .setValue(getNumberOrDefault(objectContent.directionAngle, 0).toString())
        .setType('number')
        .setLabel(_('Direction angle (degrees)'))
        .setGroup(_('Lighting'));

      objectProperties
        .getOrCreate('specularStrength')
        .setValue(
          getNumberOrDefault(objectContent.specularStrength, 0).toString()
        )
        .setType('number')
        .setLabel(_('Specular strength'))
        .setGroup(_('Advanced'));

      objectProperties
        .getOrCreate('specularShininess')
        .setValue(
          getNumberOrDefault(objectContent.specularShininess, 32).toString()
        )
        .setType('number')
        .setLabel(_('Specular shininess'))
        .setGroup(_('Advanced'));

      objectProperties
        .getOrCreate('shadowSoftness')
        .setValue(getNumberOrDefault(objectContent.shadowSoftness, 0).toString())
        .setType('number')
        .setLabel(_('Shadow softness (0 = hard shadows)'))
        .setGroup(_('Advanced'));

      objectProperties
        .getOrCreate('falloffModel')
        .setValue(objectContent.falloffModel || 'quadratic')
        .setType('choice')
        .addChoice('quadratic', _('Quadratic'))
        .addChoice('sdf', _('SDF'))
        .setLabel(_('Falloff model'))
        .setGroup(_('Lighting'));

      objectProperties
        .getOrCreate('antialiasing')
        .setValue(objectContent.antialiasing || 'high')
        .setType('choice')
        .addChoice('none', _('None'))
        .addChoice('low', _('Low'))
        .addChoice('medium', _('Medium'))
        .addChoice('high', _('High'))
        .setLabel(_('Anti-aliasing (MSAA/FXAA)'))
        .setDescription(
          _(
            'Quality level used to smooth jagged light edges. Higher values are smoother but can cost more performance.'
          )
        )
        .setGroup(_('Lighting'));

      objectProperties
        .getOrCreate('edgeSmoothing')
        .setValue(getNumberOrDefault(objectContent.edgeSmoothing, 1).toString())
        .setType('number')
        .setLabel(_('Edge smoothing width'))
        .setDescription(
          _(
            'Additional smoothing width in pixels at light borders. Increase to reduce jagged edges.'
          )
        )
        .setGroup(_('Advanced'));

      objectProperties.set(
        'debugMode',
        new gd.PropertyDescriptor(objectContent.debugMode ? 'true' : 'false')
          .setType('boolean')
          .setLabel(_('Debug mode'))
          .setDescription(
            _(
              'When activated, display the lines used to render the light - useful to understand how the light is rendered on screen.'
            )
          )
          .setGroup(_('Advanced'))
      );

      objectProperties
        .getOrCreate('texture')
        .setValue(objectContent.texture)
        .setType('resource')
        .addExtraInfo('image')
        .setLabel(_('Light texture (optional)'))
        .setDescription(
          _(
            "A texture to be used to display the light. If you don't specify a texture, the light is rendered as fading from bright, in its center, to dark."
          )
        );

      objectProperties
        .getOrCreate('normalMap')
        .setValue(objectContent.normalMap || '')
        .setType('resource')
        .addExtraInfo('image')
        .setLabel(_('Normal map (optional)'))
        .setDescription(
          _(
            'Optional normal map used for per-pixel normal and specular lighting. Blue/purple tangent-space normal maps are recommended.'
          )
        )
        .setGroup(_('Advanced'));

      return objectProperties;
    };
    lightObject.content = {
      radius: 50,
      color: '255;255;255',
      lightType: 'point',
      intensity: 1,
      directionAngle: 0,
      specularStrength: 0,
      specularShininess: 32,
      shadowSoftness: 0,
      falloffModel: 'quadratic',
      antialiasing: 'high',
      edgeSmoothing: 1,
      debugMode: false,
      texture: '',
      normalMap: '',
    };

    lightObject.updateInitialInstanceProperty = function (
      instance,
      propertyName,
      newValue
    ) {
      return false;
    };

    lightObject.getInitialInstanceProperties = function (instance) {
      const instanceProperties = new gd.MapStringPropertyDescriptor();

      return instanceProperties;
    };

    const object = extension
      .addObject(
        'LightObject',
        _('Light'),
        _(
          'Displays a 2D light on the scene, with a customizable radius and color. Then add the Light Obstacle behavior to the objects that must act as obstacle to the lights.'
        ),
        'CppPlatform/Extensions/lightIcon32.png',
        lightObject
      )
      .setIncludeFile('Extensions/Lighting/lightruntimeobject.js')
      .addIncludeFile('Extensions/Lighting/lightruntimeobject-pixi-renderer.js')
      .addIncludeFile('Extensions/Lighting/lightobstacleruntimebehavior.js')
      .setCategory('Visual effect')
      .addDefaultBehavior('EffectCapability::EffectBehavior');

    object
      .addInGameEditorResource()
      .setResourceName('InGameEditor-LightIcon')
      .setFilePath('Extensions/Lighting/InGameEditor/LightIcon.png')
      .setKind('image');

    object
      .addAction(
        'SetRadius',
        _('Light radius'),
        _('Set the radius of light object'),
        _('Set the radius of _PARAM0_ to: _PARAM1_'),
        '',
        'CppPlatform/Extensions/lightIcon24.png',
        'CppPlatform/Extensions/lightIcon16.png'
      )
      .addParameter('object', _('Object'), 'LightObject', false)
      .addParameter('expression', _('Radius'), '', false)
      .getCodeExtraInformation()
      .setFunctionName('setRadius');

    object
      .addAction(
        'SetColor',
        _('Light color'),
        _('Set the color of light object in format "R;G;B" string.'),
        _('Set the color of _PARAM0_ to: _PARAM1_'),
        '',
        'res/actions/color24.png',
        'res/actions/color.png'
      )
      .addParameter('object', _('Object'), 'LightObject', false)
      .addParameter('color', _('Color'), '', false)
      .getCodeExtraInformation()
      .setFunctionName('setColor');

    object
      .addAction(
        'SetIntensity',
        _('Light intensity'),
        _('Set the intensity multiplier of light object.'),
        _('Set the intensity of _PARAM0_ to: _PARAM1_'),
        '',
        'CppPlatform/Extensions/lightIcon24.png',
        'CppPlatform/Extensions/lightIcon16.png'
      )
      .addParameter('object', _('Object'), 'LightObject', false)
      .addParameter('expression', _('Intensity'), '', false)
      .getCodeExtraInformation()
      .setFunctionName('setIntensity');

    object
      .addAction(
        'SetLightType',
        _('Light type'),
        _('Set the type of light object (point or directional).'),
        _('Set the type of _PARAM0_ to: _PARAM1_'),
        '',
        'CppPlatform/Extensions/lightIcon24.png',
        'CppPlatform/Extensions/lightIcon16.png'
      )
      .addParameter('object', _('Object'), 'LightObject', false)
      .addParameter('string', _('Type ("point" or "directional")'), '', false)
      .getCodeExtraInformation()
      .setFunctionName('setLightType');

    object
      .addAction(
        'SetDirectionAngle',
        _('Direction angle'),
        _('Set the directional angle (degrees) of light object.'),
        _('Set the directional angle of _PARAM0_ to: _PARAM1_'),
        '',
        'CppPlatform/Extensions/lightIcon24.png',
        'CppPlatform/Extensions/lightIcon16.png'
      )
      .addParameter('object', _('Object'), 'LightObject', false)
      .addParameter('expression', _('Direction angle (degrees)'), '', false)
      .getCodeExtraInformation()
      .setFunctionName('setDirectionAngle');

    object
      .addAction(
        'SetSpecularStrength',
        _('Specular strength'),
        _('Set the specular highlight strength of light object.'),
        _('Set the specular strength of _PARAM0_ to: _PARAM1_'),
        '',
        'CppPlatform/Extensions/lightIcon24.png',
        'CppPlatform/Extensions/lightIcon16.png'
      )
      .addParameter('object', _('Object'), 'LightObject', false)
      .addParameter('expression', _('Specular strength'), '', false)
      .getCodeExtraInformation()
      .setFunctionName('setSpecularStrength');

    object
      .addAction(
        'SetSpecularShininess',
        _('Specular shininess'),
        _('Set the specular shininess of light object.'),
        _('Set the specular shininess of _PARAM0_ to: _PARAM1_'),
        '',
        'CppPlatform/Extensions/lightIcon24.png',
        'CppPlatform/Extensions/lightIcon16.png'
      )
      .addParameter('object', _('Object'), 'LightObject', false)
      .addParameter('expression', _('Specular shininess'), '', false)
      .getCodeExtraInformation()
      .setFunctionName('setSpecularShininess');

    object
      .addAction(
        'SetShadowSoftness',
        _('Shadow softness'),
        _('Set the softness of light shadows (0 = hard).'),
        _('Set the shadow softness of _PARAM0_ to: _PARAM1_'),
        '',
        'CppPlatform/Extensions/lightIcon24.png',
        'CppPlatform/Extensions/lightIcon16.png'
      )
      .addParameter('object', _('Object'), 'LightObject', false)
      .addParameter('expression', _('Shadow softness'), '', false)
      .getCodeExtraInformation()
      .setFunctionName('setShadowSoftness');

    object
      .addAction(
        'SetFalloffModel',
        _('Falloff model'),
        _('Set the falloff model used by light object.'),
        _('Set the falloff model of _PARAM0_ to: _PARAM1_'),
        '',
        'CppPlatform/Extensions/lightIcon24.png',
        'CppPlatform/Extensions/lightIcon16.png'
      )
      .addParameter('object', _('Object'), 'LightObject', false)
      .addParameter('string', _('Falloff model ("quadratic" or "sdf")'), '', false)
      .getCodeExtraInformation()
      .setFunctionName('setFalloffModel');

    object
      .addAction(
        'SetNormalMap',
        _('Normal map'),
        _('Set the normal map resource used by light object.'),
        _('Set the normal map of _PARAM0_ to: _PARAM1_'),
        '',
        'CppPlatform/Extensions/lightIcon24.png',
        'CppPlatform/Extensions/lightIcon16.png'
      )
      .addParameter('object', _('Object'), 'LightObject', false)
      .addParameter('string', _('Normal map resource name'), '', false)
      .getCodeExtraInformation()
      .setFunctionName('setNormalMap');

    object
      .addAction(
        'SetAntialiasing',
        _('Light anti-aliasing'),
        _('Set anti-aliasing quality used to smooth light edges.'),
        _('Set anti-aliasing of _PARAM0_ to: _PARAM1_'),
        '',
        'res/actions/antialiasing24.png',
        'res/actions/antialiasing.png'
      )
      .addParameter('object', _('Object'), 'LightObject', false)
      .addParameter(
        'string',
        _('Quality ("none", "low", "medium", "high")'),
        '',
        false
      )
      .getCodeExtraInformation()
      .setFunctionName('setAntialiasing');

    object
      .addAction(
        'SetEdgeSmoothing',
        _('Edge smoothing'),
        _('Set light edge smoothing width in pixels.'),
        _('Set edge smoothing of _PARAM0_ to: _PARAM1_'),
        '',
        'res/actions/antialiasing24.png',
        'res/actions/antialiasing.png'
      )
      .addParameter('object', _('Object'), 'LightObject', false)
      .addParameter('expression', _('Edge smoothing width'), '', false)
      .getCodeExtraInformation()
      .setFunctionName('setEdgeSmoothing');

    return extension;
  },

  runExtensionSanityTests: function (gd, extension) {
    return [];
  },

  registerEditorConfigurations: function (objectsEditorService) {
    objectsEditorService.registerEditorConfiguration(
      'Lighting::LightObject',
      objectsEditorService.getDefaultObjectJsImplementationPropertiesEditor({
        helpPagePath: '/all-features/lighting/reference',
      })
    );
  },
  /**
   * Register renderers for instance of objects on the scene editor.
   *
   * ℹ️ Run `node import-GDJS-Runtime.js` (in newIDE/app/scripts) if you make any change.
   */
  registerInstanceRenderers: function (objectsRenderingService) {
    const RenderedInstance = objectsRenderingService.RenderedInstance;
    const PIXI = objectsRenderingService.PIXI;

    /**
     * Renderer for instances of LightObject inside the IDE.
     */
    class RenderedLightObjectInstance extends RenderedInstance {
      _radius = 0;
      _color = 0;
      /** @type {PIXI.Graphics} The circle to show the radius of the light */
      _radiusGraphics;

      constructor(
        project,
        instance,
        associatedObjectConfiguration,
        pixiContainer,
        pixiResourcesLoader
      ) {
        super(
          project,
          instance,
          associatedObjectConfiguration,
          pixiContainer,
          pixiResourcesLoader
        );

        // The icon in the middle.
        const lightIconSprite = new PIXI.Sprite(
          PIXI.Texture.from('CppPlatform/Extensions/lightIcon32.png')
        );
        lightIconSprite.anchor.x = 0.5;
        lightIconSprite.anchor.y = 0.5;

        this._radiusGraphics = new PIXI.Graphics();

        this._pixiObject = new PIXI.Container();
        this._pixiObject.addChild(lightIconSprite);
        this._pixiObject.addChild(this._radiusGraphics);
        this._pixiContainer.addChild(this._pixiObject);
        this.update();
      }

      onRemovedFromScene() {
        super.onRemovedFromScene();
        // Keep textures because they are shared by all sprites.
        this._pixiObject.destroy({ children: true });
      }

      /**
       * Return the path to the thumbnail of the specified object.
       */
      static getThumbnail(project, resourcesLoader, objectConfiguration) {
        return 'CppPlatform/Extensions/lightIcon32.png';
      }

      /**
       * This is called to update the PIXI object on the scene editor
       */
      update() {
        const object = gd.castObject(
          this._associatedObjectConfiguration,
          gd.ObjectJsImplementation
        );

        this._pixiObject.position.x = this._instance.getX();
        this._pixiObject.position.y = this._instance.getY();

        let radiusGraphicsDirty = false;

        let radius = object.content.radius;
        if (radius <= 0) radius = 1;
        if (radius !== this._radius) {
          this._radius = radius;
          radiusGraphicsDirty = true;
        }

        const color = objectsRenderingService.rgbOrHexToHexNumber(
          object.content.color
        );
        if (color !== this._color) {
          this._color = color;
          radiusGraphicsDirty = true;
        }

        if (radiusGraphicsDirty) {
          const radiusBorderWidth = 2;
          this._radiusGraphics.clear();
          this._radiusGraphics.lineStyle(radiusBorderWidth, color, 0.8);
          this._radiusGraphics.drawCircle(
            0,
            0,
            Math.max(1, this._radius - radiusBorderWidth)
          );
        }
      }

      /**
       * Return the width of the instance, when it's not resized.
       */
      getDefaultWidth() {
        return this._radius * 2;
      }

      /**
       * Return the height of the instance, when it's not resized.
       */
      getDefaultHeight() {
        return this._radius * 2;
      }

      getOriginX() {
        return (this._radius / this.getDefaultWidth()) * this.getWidth();
      }

      getOriginY() {
        return (this._radius / this.getDefaultHeight()) * this.getHeight();
      }
    }

    objectsRenderingService.registerInstanceRenderer(
      'Lighting::LightObject',
      RenderedLightObjectInstance
    );
  },
};
