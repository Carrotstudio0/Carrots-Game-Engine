// @flow

import * as React from 'react';
import * as THREE from 'three';
import {
  DEFAULT_SHADER_GRAPH_FRAGMENT_SHADER,
  SHADER_GRAPH_VERTEX_SHADER,
} from './ShaderGraphGenerator';

const createPreviewTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext('2d');
  if (!context) {
    return new THREE.Texture();
  }

  const skyGradient = context.createLinearGradient(0, 0, 0, 620);
  skyGradient.addColorStop(0, '#8db9ea');
  skyGradient.addColorStop(0.54, '#5f95cd');
  skyGradient.addColorStop(1, '#d2e8ff');
  context.fillStyle = skyGradient;
  context.fillRect(0, 0, 1024, 620);

  const sunGlow = context.createRadialGradient(760, 174, 10, 760, 174, 240);
  sunGlow.addColorStop(0, 'rgba(255, 246, 214, 0.96)');
  sunGlow.addColorStop(0.4, 'rgba(255, 221, 165, 0.42)');
  sunGlow.addColorStop(1, 'rgba(255, 221, 165, 0)');
  context.fillStyle = sunGlow;
  context.fillRect(520, 0, 504, 460);

  context.globalAlpha = 0.34;
  context.fillStyle = '#eef7ff';
  const cloudBands = [
    { x: 154, y: 146, w: 278, h: 70 },
    { x: 386, y: 112, w: 336, h: 80 },
    { x: 652, y: 158, w: 286, h: 66 },
  ];
  cloudBands.forEach(band => {
    context.beginPath();
    context.ellipse(band.x, band.y, band.w / 2, band.h / 2, 0, 0, Math.PI * 2);
    context.fill();
  });
  context.globalAlpha = 1;

  context.fillStyle = '#5d748e';
  context.beginPath();
  context.moveTo(0, 620);
  context.lineTo(122, 516);
  context.lineTo(252, 602);
  context.lineTo(416, 464);
  context.lineTo(576, 594);
  context.lineTo(712, 510);
  context.lineTo(900, 624);
  context.lineTo(1024, 548);
  context.lineTo(1024, 620);
  context.closePath();
  context.fill();

  const groundGradient = context.createLinearGradient(0, 620, 0, 1024);
  groundGradient.addColorStop(0, '#4f5d66');
  groundGradient.addColorStop(0.62, '#2c353d');
  groundGradient.addColorStop(1, '#1a2328');
  context.fillStyle = groundGradient;
  context.fillRect(0, 620, 1024, 404);

  context.fillStyle = '#313b42';
  context.beginPath();
  context.moveTo(410, 620);
  context.lineTo(614, 620);
  context.lineTo(784, 1024);
  context.lineTo(240, 1024);
  context.closePath();
  context.fill();

  context.strokeStyle = 'rgba(236, 246, 255, 0.2)';
  context.lineWidth = 2;
  for (let index = 0; index <= 18; index++) {
    const t = index / 18;
    const y = 620 + t * t * 404;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(1024, y);
    context.stroke();
  }

  context.strokeStyle = 'rgba(255, 245, 223, 0.4)';
  context.lineWidth = 3;
  for (let index = 0; index <= 7; index++) {
    const t = index / 7;
    const x = 512 + (t - 0.5) * 560;
    context.beginPath();
    context.moveTo(512, 620);
    context.lineTo(x, 1024);
    context.stroke();
  }

  const sphereGradient = context.createRadialGradient(288, 648, 26, 320, 694, 180);
  sphereGradient.addColorStop(0, '#f7fdff');
  sphereGradient.addColorStop(0.35, '#dbe6ee');
  sphereGradient.addColorStop(1, '#8e9ca7');
  context.fillStyle = sphereGradient;
  context.beginPath();
  context.arc(320, 722, 140, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = 'rgba(0, 0, 0, 0.26)';
  context.beginPath();
  context.ellipse(336, 850, 170, 45, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#202a33';
  context.fillRect(648, 590, 220, 250);
  context.fillStyle = '#38596d';
  context.fillRect(648, 590, 36, 250);
  context.fillStyle = '#6de0d9';
  context.fillRect(694, 644, 70, 154);
  context.fillStyle = '#ff7d5c';
  context.fillRect(782, 644, 56, 154);
  context.fillStyle = 'rgba(0, 0, 0, 0.24)';
  context.beginPath();
  context.ellipse(758, 850, 184, 36, 0, 0, Math.PI * 2);
  context.fill();

  const vignette = context.createRadialGradient(512, 512, 250, 512, 512, 740);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.46)');
  context.fillStyle = vignette;
  context.fillRect(0, 0, 1024, 1024);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};

const buildShaderMaterial = ({
  texture,
  fragmentShader,
  mixStrength,
}: {
  texture: THREE.Texture,
  fragmentShader: string,
  mixStrength: number,
}) =>
  new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: texture },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uMixStrength: { value: mixStrength },
    },
    vertexShader: SHADER_GRAPH_VERTEX_SHADER,
    fragmentShader: fragmentShader || DEFAULT_SHADER_GRAPH_FRAGMENT_SHADER,
  });

type Props = {
  fragmentShader: string,
  mixStrength: number,
  animate: boolean,
  previewMode?: 'postfx' | 'material',
};

export default function ShaderGraphPreview({
  fragmentShader,
  mixStrength,
  animate,
  previewMode = 'postfx',
}: Props): React.Node {
  const containerRef = React.useRef<?HTMLDivElement>(null);
  const rendererRef = React.useRef<?THREE.WebGLRenderer>(null);
  const sceneRef = React.useRef<?THREE.Scene>(null);
  const cameraRef = React.useRef<?THREE.Camera>(null);
  const meshRef = React.useRef<?THREE.Mesh>(null);
  const materialPreviewRootRef = React.useRef<?THREE.Object3D>(null);
  const materialRef = React.useRef<?THREE.ShaderMaterial>(null);
  const animationFrameRef = React.useRef<?number>(null);
  const textureRef = React.useRef<?THREE.Texture>(null);
  const resizeObserverRef = React.useRef<?ResizeObserver>(null);
  const animateRef = React.useRef<boolean>(animate || previewMode === 'material');
  const previewModeRef = React.useRef<'postfx' | 'material'>(previewMode);
  const fragmentShaderRef = React.useRef<string>(fragmentShader);
  const mixStrengthRef = React.useRef<number>(mixStrength);
  const lastRenderSizeRef = React.useRef<{ width: number, height: number }>({
    width: 0,
    height: 0,
  });

  React.useEffect(
    () => {
      fragmentShaderRef.current = fragmentShader;
    },
    [fragmentShader]
  );

  React.useEffect(
    () => {
      mixStrengthRef.current = mixStrength;
    },
    [mixStrength]
  );

  const renderPreviewFrame = React.useCallback((timeMs?: number = 0) => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const material = materialRef.current;
    const container = containerRef.current;
    if (!renderer || !scene || !camera || !material || !container) {
      return;
    }

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    const shouldResize =
      width !== lastRenderSizeRef.current.width ||
      height !== lastRenderSizeRef.current.height;
    if (shouldResize) {
      renderer.setSize(width, height, false);
      lastRenderSizeRef.current = { width, height };
    }
    if (camera instanceof THREE.PerspectiveCamera && shouldResize) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    material.uniforms.uResolution.value.set(width, height);
    material.uniforms.uTime.value = timeMs / 1000;
    if (
      previewModeRef.current === 'material' &&
      materialPreviewRootRef.current
    ) {
      materialPreviewRootRef.current.rotation.y = timeMs * 0.00032;
    }
    renderer.render(scene, camera);
  }, []);

  const stopAnimationLoop = React.useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const startAnimationLoop = React.useCallback(() => {
    if (animationFrameRef.current) {
      return;
    }

    const render = timeMs => {
      renderPreviewFrame(timeMs);
      if (!animateRef.current) {
        animationFrameRef.current = null;
        return;
      }
      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);
  }, [renderPreviewFrame]);

  React.useEffect(
    () => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      textureRef.current = createPreviewTexture();

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      rendererRef.current = renderer;
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      let camera: THREE.Camera;
      let mesh: THREE.Mesh;
      if (previewMode === 'material') {
        const perspectiveCamera = new THREE.PerspectiveCamera(38, 1, 0.1, 30);
        perspectiveCamera.position.set(0.85, 0.78, 2.6);
        perspectiveCamera.lookAt(0, 0.42, 0);
        camera = perspectiveCamera;

        scene.background = new THREE.Color(0x0f1824);
        const hemisphereLight = new THREE.HemisphereLight(0xb6f2db, 0x243129, 1.2);
        const keyLight = new THREE.DirectionalLight(0xffe4bf, 1.55);
        keyLight.position.set(3.2, 4.2, 2.2);
        scene.add(hemisphereLight);
        scene.add(keyLight);

        const root = new THREE.Group();
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.75, 120, 80),
          buildShaderMaterial({
            texture: textureRef.current,
            fragmentShader: fragmentShaderRef.current,
            mixStrength: mixStrengthRef.current,
          })
        );
        sphere.position.y = 0.65;
        root.add(sphere);

        const pedestal = new THREE.Mesh(
          new THREE.CylinderGeometry(0.76, 0.84, 0.18, 48, 1),
          new THREE.MeshStandardMaterial({
            color: 0x2f3d46,
            roughness: 0.68,
            metalness: 0.12,
          })
        );
        pedestal.position.y = -0.12;
        root.add(pedestal);

        const floor = new THREE.Mesh(
          new THREE.PlaneGeometry(8, 8),
          new THREE.MeshStandardMaterial({
            color: 0x18212b,
            roughness: 0.9,
            metalness: 0.05,
          })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.22;
        scene.add(floor);

        scene.add(root);
        mesh = sphere;
        materialPreviewRootRef.current = root;
      } else {
        camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(2, 2),
          buildShaderMaterial({
            texture: textureRef.current,
            fragmentShader: fragmentShaderRef.current,
            mixStrength: mixStrengthRef.current,
          })
        );
        scene.add(mesh);
        materialPreviewRootRef.current = null;
      }

      sceneRef.current = scene;
      cameraRef.current = camera;
      meshRef.current = mesh;
      materialRef.current = (mesh.material: any);

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserverRef.current = new ResizeObserver(() => {
          renderPreviewFrame();
        });
        resizeObserverRef.current.observe(container);
      }

      renderPreviewFrame();

      return () => {
        stopAnimationLoop();
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect();
          resizeObserverRef.current = null;
        }
        if (sceneRef.current) {
          sceneRef.current.traverse(node => {
            const mesh = (node: any);
            if (mesh.geometry && typeof mesh.geometry.dispose === 'function') {
              mesh.geometry.dispose();
            }
            if (mesh.material) {
              if (Array.isArray(mesh.material)) {
                mesh.material.forEach(material => material.dispose());
              } else if (typeof mesh.material.dispose === 'function') {
                mesh.material.dispose();
              }
            }
          });
        }
        materialRef.current = null;
        meshRef.current = null;
        materialPreviewRootRef.current = null;
        sceneRef.current = null;
        cameraRef.current = null;
        if (textureRef.current) {
          textureRef.current.dispose();
          textureRef.current = null;
        }
        renderer.dispose();
        rendererRef.current = null;
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
      };
    },
    [previewMode, renderPreviewFrame, stopAnimationLoop]
  );

  React.useEffect(
    () => {
      const shouldAnimate = animate || previewMode === 'material';
      previewModeRef.current = previewMode;
      animateRef.current = shouldAnimate;
      if (shouldAnimate) {
        startAnimationLoop();
      } else {
        stopAnimationLoop();
        renderPreviewFrame();
      }
    },
    [
      animate,
      previewMode,
      renderPreviewFrame,
      startAnimationLoop,
      stopAnimationLoop,
    ]
  );

  React.useEffect(
    () => {
      const renderer = rendererRef.current;
      const texture = textureRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const mesh = meshRef.current;
      if (!renderer || !texture || !scene || !camera || !mesh) {
        return;
      }

      const container = containerRef.current;
      if (!container) {
        return;
      }

      if (materialRef.current) {
        materialRef.current.dispose();
      }
      mesh.material = buildShaderMaterial({
        texture,
        fragmentShader,
        mixStrength: mixStrengthRef.current,
      });
      materialRef.current = (mesh.material: any);
      materialRef.current.uniforms.uMixStrength.value = mixStrengthRef.current;
      renderPreviewFrame();
    },
    [fragmentShader, renderPreviewFrame]
  );

  React.useEffect(
    () => {
      if (!materialRef.current) {
        return;
      }
      materialRef.current.uniforms.uMixStrength.value = mixStrength;
      renderPreviewFrame();
    },
    [mixStrength, renderPreviewFrame]
  );

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 240,
        borderRadius: 16,
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 22% 18%, rgba(66, 201, 142, 0.22), rgba(8, 14, 23, 0.88) 58%), radial-gradient(circle at 86% 24%, rgba(255, 157, 74, 0.2), rgba(8, 14, 23, 0.02) 50%)',
        boxShadow: 'inset 0 0 0 1px rgba(104, 216, 165, 0.25)',
      }}
    />
  );
}
