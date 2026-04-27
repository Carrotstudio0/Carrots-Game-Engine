var gdjs;(function(x){const T=new x.Logger("Light object"),f=class{constructor(t,i){this._texture=null;this._normalMapTexture=null;this._light=null;this._softShadowFilter=null;this._antialiasingFilter=null;this._debugMode=!1;this._debugLight=null;this._debugGraphics=null;this._lightIconSprite=null;this._object=t,this._instanceContainer=i,this._manager=t.getObstaclesManager(),this._radius=t.getRadius();const e=t._color;this._color=[e[0]/255,e[1]/255,e[2]/255],this._lightType=t.getLightType(),this._intensity=t.getIntensity(),this._directionAngle=t.getDirectionAngle(),this._specularStrength=t.getSpecularStrength(),this._specularShininess=t.getSpecularShininess(),this._shadowSoftness=t.getShadowSoftness(),this._falloffModel=t.getFalloffModel(),this._antialiasing=t.getAntialiasing(),this._edgeSmoothing=t.getEdgeSmoothing(),this.updateTexture(),this._center=new Float32Array([t.x,t.y]),this._defaultVertexBuffer=new Float32Array(8),this._vertexBuffer=new Float32Array([t.x-this._radius,t.y+this._radius,t.x+this._radius,t.y+this._radius,t.x+this._radius,t.y-this._radius,t.x-this._radius,t.y-this._radius]),this._indexBuffer=new Uint16Array([0,1,2,0,2,3]),this.updateMesh(),this._isPreview=i.getGame().isPreview(),this._lightBoundingPoly=x.Polygon.createRectangle(0,0),this.updateDebugMode();const n=this._object.getInstanceContainer().getGame();if(n.isInGameEdition()){const o=n.getImageManager().getPIXITexture("InGameEditor-LightIcon");this._lightIconSprite=new PIXI.Sprite(o),this._lightIconSprite.anchor.x=.5,this._lightIconSprite.anchor.y=.5,this._debugGraphics=new PIXI.Graphics,this._debugLight=new PIXI.Container,this._debugLight.addChild(this._debugGraphics),this._debugLight.addChild(this._lightIconSprite),this._radius=0}const s=this.getRendererObject();s&&i.getLayer("").getRenderer().addRendererObject(s,t.getZOrder())}destroy(){this._lightIconSprite&&(this._lightIconSprite.removeFromParent(),this._lightIconSprite.destroy(),this._lightIconSprite=null),this._debugGraphics&&(this._debugGraphics.removeFromParent(),this._debugGraphics.destroy(),this._debugGraphics=null),this._light&&(this._light.removeFromParent(),this._light.destroy(),this._light=null),this._softShadowFilter&&(this._softShadowFilter.destroy(),this._softShadowFilter=null),this._antialiasingFilter&&(this._antialiasingFilter.destroy(),this._antialiasingFilter=null)}static _verticesWithAngleComparator(t,i){return t.angle<i.angle?-1:t.angle>i.angle?1:0}static _computeClosestIntersectionPoint(t,i,e,n){const s=t.getX(),o=t.getY(),a=s+n*Math.cos(i),c=o+n*Math.sin(i);let _=n*n;const l=[null,null];for(const g of e){const d=x.Polygon.raycastTest(g,s,o,a,c);d.collision&&d.closeSqDist<=_&&(_=d.closeSqDist,l[0]=d.closeX,l[1]=d.closeY)}return l[0]!==null&&l[1]!==null?l:null}getRendererObject(){return this._debugLight?this._debugLight:this._light}ensureUpToDate(){if(this._object.getInstanceContainer().getGame().isInGameEdition()){if(!this._debugLight)return;this._debugLight.x=this._object.getX(),this._debugLight.y=this._object.getY();const t=this._object._color,i=[t[0]/255,t[1]/255,t[2]/255];if(this._radius===this._object.getRadius()&&this._color[0]===i[0]&&this._color[1]===i[1]&&this._color[2]===i[2])return;if(this._debugGraphics){this._radius=this._object.getRadius(),this._color[0]=i[0],this._color[1]=i[1],this._color[2]=i[2];const e=2;this._debugGraphics.clear(),this._debugGraphics.lineStyle(e,x.rgbToHexNumber(t[0],t[1],t[2]),.8),this._debugGraphics.drawCircle(0,0,Math.max(1,this._radius-e))}return}this._object.isHidden()||(this._debugGraphics&&this._updateDebugGraphics(),this.updateLightParameters(),this._updateBuffers())}updateMesh(){if(this._object.getInstanceContainer().getGame().isInGameEdition())return;if(!PIXI.utils.isWebGLSupported()){T.warn("This device does not support webgl, which is required for Lighting Extension.");return}this.updateTexture(),this._syncRuntimeLightProperties();const t={center:this._center,radius:this._radius,color:this._color,intensity:this._intensity,lightType:this._lightType==="directional"?1:0,directionAngle:this._directionAngle,specularStrength:this._specularStrength,specularShininess:this._specularShininess,falloffModel:this._falloffModel==="sdf"?1:0,edgeSmoothing:this._edgeSmoothing,useTexture:this._texture?1:0,useNormalMap:this._normalMapTexture?1:0,uSampler:this._texture||PIXI.Texture.WHITE,uNormalSampler:this._normalMapTexture||PIXI.Texture.WHITE},i=PIXI.Shader.from(f.defaultVertexShader,f.enhancedFragmentShader,t),e=new PIXI.Geometry;e.addAttribute("aVertexPosition",this._vertexBuffer,2).addIndex(this._indexBuffer),this._light?(this._light.shader=i,this._light.geometry=e):(this._light=new PIXI.Mesh(e,i),this._light.blendMode=PIXI.BLEND_MODES.ADD),this._updateFilters()}updateRadius(){!this._light||(this._radius=this._object.getRadius(),this._light.shader.uniforms.radius=this._radius)}updateColor(){if(!this._light)return;const t=this._object._color;this._color=[t[0]/255,t[1]/255,t[2]/255],this._light.shader.uniforms.color=this._color}updateTexture(){const t=this._instanceContainer.getGame().getImageManager(),i=this._object.getTexture();this._texture=i!==""?t.getPIXITexture(i):null;const e=this._object.getNormalMap();this._normalMapTexture=e!==""?t.getPIXITexture(e):null}updateLightParameters(){this._syncRuntimeLightProperties(),!!this._light&&(this._light.shader.uniforms.intensity=this._intensity,this._light.shader.uniforms.lightType=this._lightType==="directional"?1:0,this._light.shader.uniforms.directionAngle=this._directionAngle,this._light.shader.uniforms.specularStrength=this._specularStrength,this._light.shader.uniforms.specularShininess=this._specularShininess,this._light.shader.uniforms.falloffModel=this._falloffModel==="sdf"?1:0,this._light.shader.uniforms.edgeSmoothing=this._edgeSmoothing,this._light.shader.uniforms.useTexture=this._texture?1:0,this._light.shader.uniforms.useNormalMap=this._normalMapTexture?1:0,this._light.shader.uniforms.uSampler=this._texture||PIXI.Texture.WHITE,this._light.shader.uniforms.uNormalSampler=this._normalMapTexture||PIXI.Texture.WHITE,this._updateFilters())}_syncRuntimeLightProperties(){this._lightType=this._object.getLightType(),this._intensity=this._object.getIntensity(),this._directionAngle=this._object.getDirectionAngle(),this._specularStrength=this._object.getSpecularStrength(),this._specularShininess=this._object.getSpecularShininess(),this._shadowSoftness=this._object.getShadowSoftness(),this._falloffModel=this._object.getFalloffModel(),this._antialiasing=this._object.getAntialiasing(),this._edgeSmoothing=this._object.getEdgeSmoothing()}_updateFilters(){if(!this._light)return;const t=[];if(this._antialiasing!=="none"){this._antialiasingFilter||(this._antialiasingFilter=new PIXI.FXAAFilter);const e=this._antialiasingFilter;e.enabled=!0,e.multisample=PIXI.MSAA_QUALITY[this._antialiasing.toUpperCase()]||PIXI.MSAA_QUALITY.LOW,t.push(this._antialiasingFilter)}else this._antialiasingFilter&&(this._antialiasingFilter.destroy(),this._antialiasingFilter=null);const i=PIXI.BlurFilter||PIXI.filters&&PIXI.filters.BlurFilter;if(this._shadowSoftness<=0||!i)this._softShadowFilter&&(this._softShadowFilter.destroy(),this._softShadowFilter=null);else{this._softShadowFilter||(this._softShadowFilter=new i);const e=this._softShadowFilter;e.blur=Math.min(64,this._shadowSoftness),e.quality=1,e.multisample=this._antialiasing!=="none"?PIXI.MSAA_QUALITY[this._antialiasing.toUpperCase()]||PIXI.MSAA_QUALITY.LOW:PIXI.MSAA_QUALITY.NONE,t.push(this._softShadowFilter)}this._light.filters=t.length?t:null}updateDebugMode(){!this._light||(this._debugMode=this._object.getDebugMode(),!this._debugLight&&(this._isPreview||this._debugMode)&&(this._debugLight=new PIXI.Container,this._debugLight.addChild(this._light)),this._debugMode&&!this._debugGraphics&&(this._debugGraphics=new PIXI.Graphics,this._debugLight.addChild(this._debugGraphics)),!this._debugMode&&this._debugGraphics&&(this._debugLight.removeChild(this._debugGraphics),this._debugGraphics.destroy(),this._debugGraphics=null),this.ensureUpToDate())}_updateDebugGraphics(){const t=this._debugGraphics,i=this._computeLightVertices();if(!i.length){t.clear(),t.lineStyle(1,16711680,1).moveTo(this._object.x,this._object.y).lineTo(this._object.x-this._radius,this._object.y+this._radius).lineTo(this._object.x+this._radius,this._object.y+this._radius).moveTo(this._object.x,this._object.y).lineTo(this._object.x+this._radius,this._object.y+this._radius).lineTo(this._object.x+this._radius,this._object.y-this._radius).moveTo(this._object.x,this._object.y).lineTo(this._object.x+this._radius,this._object.y-this._radius).lineTo(this._object.x-this._radius,this._object.y-this._radius).moveTo(this._object.x,this._object.y).lineTo(this._object.x-this._radius,this._object.y-this._radius).lineTo(this._object.x-this._radius,this._object.y+this._radius);return}const e=new Array(2*i.length+2);e[0]=this._object.x,e[1]=this._object.y;for(let s=2;s<2*i.length+2;s+=2)e[s]=i[s/2-1][0],e[s+1]=i[s/2-1][1];t.clear(),t.moveTo(e[2],e[3]);const n=e.length;for(let s=2;s<n;s+=2){const o=s%4==0?16711680:65280,a=s+2>=n?2:s+2,c=s+3>=n?3:s+3;t.lineStyle(1,o,1).lineTo(e[s],e[s+1]).lineTo(e[a],e[c]).moveTo(e[0],e[1]).lineTo(e[s],e[s+1]).moveTo(e[0],e[1]).lineTo(e[a],e[c])}}_updateBuffers(){if(!this._light)return;this._center[0]=this._object.x,this._center[1]=this._object.y;const t=this._computeLightVertices();if(t.length===0){this._defaultVertexBuffer[0]=this._object.x-this._radius,this._defaultVertexBuffer[1]=this._object.y+this._radius,this._defaultVertexBuffer[2]=this._object.x+this._radius,this._defaultVertexBuffer[3]=this._object.y+this._radius,this._defaultVertexBuffer[4]=this._object.x+this._radius,this._defaultVertexBuffer[5]=this._object.y-this._radius,this._defaultVertexBuffer[6]=this._object.x-this._radius,this._defaultVertexBuffer[7]=this._object.y-this._radius,this._light.shader.uniforms.center=this._center,this._light.geometry.getBuffer("aVertexPosition").update(this._defaultVertexBuffer),this._light.geometry.getIndex().update(f._defaultIndexBuffer);return}const i=t.length;let e=!1,n=null,s=null;this._vertexBuffer.length>2*i+2&&(this._vertexBuffer.length<4*i+4?(e=!0,n=this._vertexBuffer.subarray(0,2*i+2),s=this._indexBuffer.subarray(0,3*i)):(this._vertexBuffer=new Float32Array(2*i+2),this._indexBuffer=new Uint16Array(3*i))),this._vertexBuffer.length<2*i+2&&(this._vertexBuffer=new Float32Array(2*i+2),this._indexBuffer=new Uint16Array(3*i)),this._vertexBuffer[0]=this._object.x,this._vertexBuffer[1]=this._object.y;for(let o=2;o<2*i+2;o+=2)this._vertexBuffer[o]=t[o/2-1][0],this._vertexBuffer[o+1]=t[o/2-1][1];for(let o=0;o<3*i;o+=3)this._indexBuffer[o]=0,this._indexBuffer[o+1]=o/3+1,o/3+1!==i?this._indexBuffer[o+2]=o/3+2:this._indexBuffer[o+2]=1;this._light.shader.uniforms.center=this._center,e?(this._light.geometry.getBuffer("aVertexPosition").update(n),this._light.geometry.getIndex().update(s)):(this._light.geometry.getBuffer("aVertexPosition").update(this._vertexBuffer),this._light.geometry.getIndex().update(this._indexBuffer))}_computeLightVertices(){const t=[];this._manager&&this._manager.getAllObstaclesAround(this._object,this._radius,t);const i=this._object.getX()-this._radius,e=this._object.getY()-this._radius,n=this._object.getX()+this._radius,s=this._object.getY()+this._radius;if(t.length===0)return t;const o=this._object.getHitBoxes()[0];for(let r=0;r<4;r++)this._lightBoundingPoly.vertices[r][0]=o.vertices[r][0],this._lightBoundingPoly.vertices[r][1]=o.vertices[r][1];const a=[];a.push(this._lightBoundingPoly);for(let r=0;r<t.length;r++){const u=t[r].owner.getHitBoxesAround(i,e,n,s);for(const b of u)a.push(b)}let c=this._object.x+this._radius,_=this._object.x-this._radius,l=this._object.y+this._radius,g=this._object.y-this._radius;const d=[];for(let r=1;r<a.length;r++){const u=a[r].vertices,b=u.length;for(let h=0;h<b;h++)d.push(u[h]),u[h][0]<_&&(_=u[h][0]),u[h][0]>c&&(c=u[h][0]),u[h][1]<g&&(g=u[h][1]),u[h][1]>l&&(l=u[h][1])}a[0].vertices[0][0]=_,a[0].vertices[0][1]=g,a[0].vertices[1][0]=c,a[0].vertices[1][1]=g,a[0].vertices[2][0]=c,a[0].vertices[2][1]=l,a[0].vertices[3][0]=_,a[0].vertices[3][1]=l;const y=Math.sqrt(Math.max((this._object.x-_)*(this._object.x-_)+(this._object.y-g)*(this._object.y-g),(c-this._object.x)*(c-this._object.x)+(this._object.y-g)*(this._object.y-g),(c-this._object.x)*(c-this._object.x)+(l-this._object.y)*(l-this._object.y),(this._object.x-_)*(this._object.x-_)+(l-this._object.y)*(l-this._object.y)));for(let r=0;r<4;r++)d.push(a[0].vertices[r]);const m=[],M=d.length;for(let r=0;r<M;r++){const u=d[r][0]-this._object.x,b=d[r][1]-this._object.y,h=Math.atan2(b,u),S=f._computeClosestIntersectionPoint(this._object,h,a,y);S&&m.push({vertex:S,angle:h});const j=f._computeClosestIntersectionPoint(this._object,h+1e-4,a,y);j&&m.push({vertex:j,angle:h+1e-4});const P=f._computeClosestIntersectionPoint(this._object,h-1e-4,a,y);P&&m.push({vertex:P,angle:h-1e-4})}m.sort(f._verticesWithAngleComparator);const I=m.length;if(I===0)return[];const v=[m[0].vertex];for(let r=1;r<I;r++)m[r].angle!==m[r-1].angle&&v.push(m[r].vertex);return v}};let p=f;p._defaultIndexBuffer=new Uint16Array([0,1,2,0,2,3]),p.defaultVertexShader=`
  precision highp float;
  attribute vec2 aVertexPosition;

  uniform mat3 translationMatrix;
  uniform mat3 projectionMatrix;
  varying vec2 vPos;

  void main() {
      vPos = aVertexPosition;
      gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
  }`,p.enhancedFragmentShader=`
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
  }`,x.LightRuntimeObjectPixiRenderer=p,x.LightRuntimeObjectRenderer=p})(gdjs||(gdjs={}));
//# sourceMappingURL=lightruntimeobject-pixi-renderer.js.map
