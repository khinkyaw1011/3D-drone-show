import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { float, fract, length, pass, rand, screenUV, smoothstep, time, uniform } from 'three/tsl';
import { type Camera, RenderPipeline, type Scene, type WebGPURenderer } from 'three/webgpu';
import type { SceneSettings } from '../types';

/** Scene pass -> bloom -> exposure -> vignette -> grain. Tone mapping is applied by the pipeline's output transform. */
export function createPostFX(renderer: WebGPURenderer, scene: Scene, camera: Camera, bloomScale = 0.5) {
  const u = { grain: uniform(0.12), vignette: uniform(0.45), exposure: uniform(1) };
  const scenePass = pass(scene, camera);
  const color = scenePass.getTextureNode('output');
  const bloomPass = bloom(color, 0.9, 0.6, 0.1);
  bloomPass.setResolutionScale(bloomScale);

  const lit = color.add(bloomPass).mul(u.exposure);
  const vignette = float(1).sub(u.vignette.mul(smoothstep(0.3, 1.05, length(screenUV.sub(0.5)).mul(1.5))));
  const grain = rand(screenUV.add(fract(time))).sub(0.5).mul(u.grain).mul(0.09);

  const pipeline = new RenderPipeline(renderer);
  pipeline.outputNode = lit.mul(vignette).add(grain);

  const apply = (scene: Pick<SceneSettings, 'bloom' | 'grain' | 'vignette' | 'exposure'>) => {
    bloomPass.strength.value = scene.bloom.strength;
    bloomPass.radius.value = scene.bloom.radius;
    bloomPass.threshold.value = scene.bloom.threshold;
    u.grain.value = scene.grain;
    u.vignette.value = scene.vignette;
    u.exposure.value = scene.exposure;
  };
  return {
    apply,
    render: () => pipeline.render(),
    setCamera: (next: Camera) => {
      scenePass.camera = next;
    },
    dispose: () => {
      bloomPass.dispose();
      pipeline.dispose();
    },
  };
}
