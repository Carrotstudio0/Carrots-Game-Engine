var gdjs;(function(r){const u={uniforms:{tDiffuse:{value:null},tSceneColor:{value:null},temperature:{value:-.3},tint:{value:-.1},saturation:{value:.8},contrast:{value:1.2},brightness:{value:.95}},vertexShader:`
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      precision highp float;

      uniform sampler2D tDiffuse;
      uniform sampler2D tSceneColor;
      uniform float temperature;
      uniform float tint;
      uniform float saturation;
      uniform float contrast;
      uniform float brightness;
      varying vec2 vUv;

      vec3 applyTemperatureAndTint(vec3 color, float temp, float tintShift) {
        // Temperature: negative cools (blue), positive warms (orange).
        color += vec3(temp * 0.12, temp * 0.03, -temp * 0.12);

        // Tint: negative -> green, positive -> magenta.
        color += vec3(tintShift * 0.05, -tintShift * 0.1, tintShift * 0.05);
        return color;
      }

      vec3 applySaturation(vec3 color, float sat) {
        float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
        return mix(vec3(luma), color, sat);
      }

      vec3 applyContrast(vec3 color, float ctr) {
        return (color - 0.5) * ctr + 0.5;
      }

      void main() {
        vec4 inputColor = texture2D(tDiffuse, vUv);
        vec3 sceneColor = texture2D(tSceneColor, vUv).rgb;

        // Keep current stack output as primary source while integrating shared capture.
        vec3 color = mix(sceneColor, inputColor.rgb, 0.85);

        color = applyTemperatureAndTint(color, temperature, tint);
        color = applySaturation(color, saturation);
        color = applyContrast(color, contrast);
        color *= brightness;

        gl_FragColor = vec4(clamp(color, 0.0, 1.0), inputColor.a);
      }
    `};r.PixiFiltersTools.registerFilterCreator("Scene3D::ColorGrading",new class{makeFilter(l,h){return typeof THREE=="undefined"?new r.PixiFiltersTools.EmptyFilter:new class{constructor(){this.shaderPass=new THREE_ADDONS.ShaderPass(u),r.markScene3DPostProcessingPass(this.shaderPass,"COLORGRADE"),this._isEnabled=!1,this._effectEnabled=!0,this._temperature=-.3,this._tint=-.1,this._saturation=.8,this._contrast=1.2,this._brightness=.95,this.shaderPass.enabled=!0}isEnabled(e){return this._isEnabled}setEnabled(e,t){return this._isEnabled===t?!0:t?this.applyEffect(e):this.removeEffect(e)}applyEffect(e){return e instanceof r.Layer?(e.getRenderer().addPostProcessingPass(this.shaderPass),this._isEnabled=!0,!0):!1}removeEffect(e){return e instanceof r.Layer?(e.getRenderer().removePostProcessingPass(this.shaderPass),this._isEnabled=!1,!0):!1}updatePreRender(e){if(!this._isEnabled||!this._effectEnabled||!(e instanceof r.Layer))return;const s=e.getRuntimeScene().getGame().getRenderer().getThreeRenderer(),a=e.getRenderer(),i=a.getThreeScene(),n=a.getThreeCamera();if(!s||!i||!n)return;if(!r.isScene3DPostProcessingEnabled(e)){this.shaderPass.enabled=!1;return}const o=r.captureScene3DSharedTextures(e,s,i,n);!o||(this.shaderPass.enabled=!0,this.shaderPass.uniforms.tSceneColor.value=o.colorTexture,this.shaderPass.uniforms.temperature.value=this._temperature,this.shaderPass.uniforms.tint.value=this._tint,this.shaderPass.uniforms.saturation.value=this._saturation,this.shaderPass.uniforms.contrast.value=this._contrast,this.shaderPass.uniforms.brightness.value=this._brightness)}updateDoubleParameter(e,t){e==="temperature"?(this._temperature=r.evtTools.common.clamp(-2,2,t),this.shaderPass.uniforms.temperature.value=this._temperature):e==="tint"?(this._tint=r.evtTools.common.clamp(-2,2,t),this.shaderPass.uniforms.tint.value=this._tint):e==="saturation"?(this._saturation=Math.max(0,t),this.shaderPass.uniforms.saturation.value=this._saturation):e==="contrast"?(this._contrast=Math.max(0,t),this.shaderPass.uniforms.contrast.value=this._contrast):e==="brightness"&&(this._brightness=Math.max(0,t),this.shaderPass.uniforms.brightness.value=this._brightness)}getDoubleParameter(e){return e==="temperature"?this._temperature:e==="tint"?this._tint:e==="saturation"?this._saturation:e==="contrast"?this._contrast:e==="brightness"?this._brightness:0}updateStringParameter(e,t){}updateColorParameter(e,t){}getColorParameter(e){return 0}updateBooleanParameter(e,t){e==="enabled"&&(this._effectEnabled=t,this.shaderPass.enabled=t)}getNetworkSyncData(){return{t:this._temperature,ti:this._tint,s:this._saturation,c:this._contrast,b:this._brightness,e:this._effectEnabled}}updateFromNetworkSyncData(e){this._temperature=r.evtTools.common.clamp(-2,2,e.t),this._tint=r.evtTools.common.clamp(-2,2,e.ti),this._saturation=Math.max(0,e.s),this._contrast=Math.max(0,e.c),this._brightness=Math.max(0,e.b),this._effectEnabled=!!e.e,this.shaderPass.uniforms.temperature.value=this._temperature,this.shaderPass.uniforms.tint.value=this._tint,this.shaderPass.uniforms.saturation.value=this._saturation,this.shaderPass.uniforms.contrast.value=this._contrast,this.shaderPass.uniforms.brightness.value=this._brightness,this.shaderPass.enabled=this._effectEnabled}}}})})(gdjs||(gdjs={}));
//# sourceMappingURL=ColorGradingEffect.js.map
