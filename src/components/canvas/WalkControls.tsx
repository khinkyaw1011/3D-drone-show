'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { MathUtils } from 'three';
import { padLayout } from '@/engine/formations/fit';

const EYE_HEIGHT = 1.7;
const WALK_SPEED = 7; // world units per second: a brisk walk at the show's scale
const LOOK_SPEED = 0.0032;
const ARENA_RADIUS = 160;
const KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};

/**
 * First-person view from the ground: drag to look around (all the way up at the show),
 * walk with WASD / arrow keys. On touch screens the left third of the screen is a
 * movement stick and the rest looks around.
 */
export function WalkControls({ enabled }: { enabled: boolean }) {
  const camera = useThree((s) => s.camera);
  const dom = useThree((s) => s.gl.domElement);
  const state = useRef({ yaw: 0, pitch: 0.32, move: [0, 0] as [number, number], keys: new Set<string>() });

  // Start in the crowd, facing the show.
  useEffect(() => {
    const { depth, center } = padLayout(1200);
    camera.position.set(0, EYE_HEIGHT, center[2] + depth / 2 + 34);
    state.current.yaw = 0;
    state.current.pitch = 0.32;
  }, [camera]);

  useEffect(() => {
    if (!enabled) return;
    const s = state.current;
    const pointers = new Map<number, { x: number; y: number; stick: boolean; ox: number; oy: number }>();

    const down = (e: PointerEvent) => {
      const stick = e.pointerType === 'touch' && e.clientX < window.innerWidth / 3;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, stick, ox: e.clientX, oy: e.clientY });
      dom.setPointerCapture(e.pointerId);
    };
    const moveHandler = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      if (p.stick) {
        s.move = [MathUtils.clamp((e.clientX - p.ox) / 60, -1, 1), MathUtils.clamp((p.oy - e.clientY) / 60, -1, 1)];
      } else {
        s.yaw -= (e.clientX - p.x) * LOOK_SPEED;
        // Straight up is allowed: the whole point is to stand under the show and look at the sky.
        s.pitch = MathUtils.clamp(s.pitch - (e.clientY - p.y) * LOOK_SPEED, -0.5, Math.PI / 2 - 0.02);
      }
      p.x = e.clientX;
      p.y = e.clientY;
    };
    const up = (e: PointerEvent) => {
      if (pointers.get(e.pointerId)?.stick) s.move = [0, 0];
      pointers.delete(e.pointerId);
    };
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable], [role="slider"]');
    const keyDown = (e: KeyboardEvent) => {
      if (!(e.code in KEYS) || typing(e)) return;
      s.keys.add(e.code);
      e.preventDefault();
    };
    const keyUp = (e: KeyboardEvent) => s.keys.delete(e.code);
    const blur = () => s.keys.clear();

    dom.addEventListener('pointerdown', down);
    dom.addEventListener('pointermove', moveHandler);
    dom.addEventListener('pointerup', up);
    dom.addEventListener('pointercancel', up);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', blur);
    return () => {
      dom.removeEventListener('pointerdown', down);
      dom.removeEventListener('pointermove', moveHandler);
      dom.removeEventListener('pointerup', up);
      dom.removeEventListener('pointercancel', up);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', blur);
      s.keys.clear();
      s.move = [0, 0];
    };
  }, [dom, enabled]);

  useFrame((_, dt) => {
    const s = state.current;
    let [strafe, forward] = s.move;
    for (const code of s.keys) {
      strafe += KEYS[code][0];
      forward += KEYS[code][1];
    }
    const length = Math.hypot(strafe, forward);
    if (length > 0) {
      const step = (WALK_SPEED * Math.min(dt, 0.05)) / Math.max(1, length);
      // Forward is where the viewer is facing on the ground plane.
      camera.position.x += (-Math.sin(s.yaw) * forward + Math.cos(s.yaw) * strafe) * step;
      camera.position.z += (-Math.cos(s.yaw) * forward - Math.sin(s.yaw) * strafe) * step;
      const distance = Math.hypot(camera.position.x, camera.position.z);
      if (distance > ARENA_RADIUS) camera.position.multiplyScalar(ARENA_RADIUS / distance);
    }
    camera.position.y = EYE_HEIGHT;
    camera.rotation.set(s.pitch, s.yaw, 0, 'YXZ');
  });

  return null;
}
