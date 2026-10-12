import { float, length, normalView, smoothstep, uniform, uv } from 'three/tsl';
import { AdditiveBlending, Color, DoubleSide, MeshBasicNodeMaterial } from 'three/webgpu';

const additive = { transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false } as const;

/** A searchlight beam: an open cone, bright at the lamp and thinning into the sky. */
export function createBeamMaterial() {
  const u = { color: uniform(new Color('#7cf7e4')), intensity: uniform(0.35) };
  const material = new MeshBasicNodeMaterial(additive);
  material.colorNode = u.color;
  // CylinderGeometry's v runs 0 at the bottom (lamp) to 1 at the top.
  // Soft shaft, not a solid cone: strongest where we look through its middle, gone at the silhouette.
  const core = normalView.z.abs().pow(2.5);
  material.opacityNode = float(1).sub(uv().y).pow(1.6).mul(core).mul(u.intensity).mul(0.09);
  return { material, uniforms: u };
}

/** The pool of light a fleet throws on the ground beneath it. */
export function createGroundGlowMaterial() {
  const u = { color: uniform(new Color('#ffd27a')), intensity: uniform(0.5) };
  const material = new MeshBasicNodeMaterial(additive);
  material.colorNode = u.color;
  material.opacityNode = smoothstep(1, 0, length(uv().sub(0.5)).mul(2)).pow(2).mul(u.intensity).mul(0.22);
  return { material, uniforms: u };
}
