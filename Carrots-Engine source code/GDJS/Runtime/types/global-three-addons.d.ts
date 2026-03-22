import { GLTFLoader, GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { SelectionBox } from 'three/addons/interactive/SelectionBox.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BrightnessContrastShader } from 'three/addons/shaders/BrightnessContrastShader.js';
import { ColorCorrectionShader } from 'three/addons/shaders/ColorCorrectionShader.js';
import { HueSaturationShader } from 'three/addons/shaders/HueSaturationShader.js';
import { ExposureShader } from 'three/addons/shaders/ExposureShader.js';

declare global {
  namespace THREE_ADDONS {
    export {
      GLTFLoader,
      GLTF,
      FBXLoader,
      DRACOLoader,
      SkeletonUtils,
      TransformControls,
      SelectionBox,
      EffectComposer,
      OutlinePass,
      Pass,
      RenderPass,
      ShaderPass,
      SMAAPass,
      OutputPass,
      UnrealBloomPass,
      BrightnessContrastShader,
      ColorCorrectionShader,
      HueSaturationShader,
      ExposureShader,
    };
  }
}
