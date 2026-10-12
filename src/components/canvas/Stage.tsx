'use client';

import { type RootState, useFrame, useThree } from '@react-three/fiber';
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import type { WebGPURenderer } from 'three/webgpu';
import { type PhysicsMoment, ShowPlayer } from '@/engine/playback/ShowPlayer';
import { prefersReducedMotion } from '@/engine/renderer/capabilities';
import { rendererCapabilities } from '@/engine/renderer/createRenderer';
import { createSimulator } from '@/engine/sim/createSimulator';
import type { Capabilities, Show } from '@/engine/types';
import { useCompiledShow } from '@/hooks/useCompiledShow';
import { CameraRig } from './CameraRig';
import { Drones } from './Drones';
import { Fireworks, Ground, LaunchPad, Sky } from './Environment';
import { PostFX } from './PostFX';
import { WalkControls } from './WalkControls';

// Rapier's WASM only loads for shows that actually contain a physics moment.
const PhysicsMoments = lazy(() => import('./PhysicsMoments'));

export interface ShowHandle {
  player: ShowPlayer;
  capabilities: Capabilities;
  /** Live R3F state (renderer, canvas, `advance`, `setDpr`...) for screenshots and video export. */
  getState: () => RootState;
}

export interface StageProps {
  show: Show;
  playing: boolean;
  loop?: boolean;
  /** Playback rate multiplier. */
  speed?: number;
  /** Seek request; a new `nonce` re-applies the same time. */
  seek?: { t?: number; keyframe?: number; nonce: number } | null;
  interactive?: boolean;
  pushToy?: boolean;
  /** Cap below the device tier (thumbnails, hero on phones). */
  maxDrones?: number;
  onTime?: (time: number, index: number, duration: number) => void;
  onStatus?: (status: 'loading' | 'ready' | 'error', error: string | null) => void;
  onReady?: (handle: ShowHandle | null) => void;
  onEnd?: () => void;
}

const UI_TICK_MS = 100;
/** Above this fleet size the airframes are sub-pixel anyway; skip them and draw LEDs only. */
const AIRFRAME_LIMIT = 6000;

/** Everything inside the canvas: environment, drones, camera, post-FX, and the player that drives them. */
export function Stage({
  show,
  playing,
  loop = true,
  speed = 1,
  seek = null,
  interactive = true,
  pushToy = false,
  maxDrones = Infinity,
  onTime,
  onStatus,
  onReady,
  onEnd,
}: StageProps) {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const getState = useThree((s) => s.get);
  const capabilities = useMemo(() => rendererCapabilities(gl), [gl]);
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);
  const count = Math.min(show.droneCount, capabilities.tier.maxDrones, maxDrones);
  const { compiled, show: compiledShow, status, error } = useCompiledShow(show, count);

  const [player, setPlayer] = useState<ShowPlayer | null>(null);
  const [index, setIndex] = useState(0);
  const [physics, setPhysics] = useState<PhysicsMoment | null>(null);
  const callbacks = useRef({ onTime, onEnd });
  const lastTick = useRef({ at: 0, index: -1 });

  useEffect(() => {
    callbacks.current = { onTime, onEnd };
  });

  useEffect(() => {
    const next = new ShowPlayer(createSimulator(count, capabilities), {
      onTime: (time, i) => {
        const now = performance.now();
        const tick = lastTick.current;
        if (i !== tick.index) setIndex(i);
        if (i !== tick.index || now - tick.at > UI_TICK_MS) {
          lastTick.current = { at: now, index: i };
          callbacks.current.onTime?.(time, i, next.duration);
        }
      },
      onPhysics: (moment) => setPhysics(moment.active ? moment : null),
      onEnd: () => callbacks.current.onEnd?.(),
    });
    setPlayer(next);
    return () => {
      next.dispose();
      setPlayer(null);
    };
  }, [count, capabilities]);

  useEffect(() => {
    onReady?.(player ? { player, capabilities, getState } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- report identity changes only
  }, [player, capabilities]);

  useEffect(() => {
    onStatus?.(status, error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, error]);

  const loaded = !!player && !!compiled && !!compiledShow && compiled.count === player.sim.count;

  useEffect(() => {
    if (loaded) player.load(compiledShow, compiled);
  }, [loaded, player, compiled, compiledShow]);

  useEffect(() => {
    if (!player || !loaded) return;
    player.loop = loop;
    player.setTimeScale(speed);
    if (playing) player.play();
    else player.pause();
  }, [player, loaded, playing, loop, speed, compiled]);

  useEffect(() => player?.refresh(show), [player, show]);

  // Only act on seek requests made while this stage is mounted (the store may hold an older one).
  const handledSeek = useRef(seek?.nonce ?? 0);
  useEffect(() => {
    if (!player || !loaded || !seek || seek.nonce === handledSeek.current) return;
    handledSeek.current = seek.nonce;
    // A formation is flown to live from the fleet's current positions; a time is scrubbed to.
    if (seek.keyframe !== undefined) player.flyTo(seek.keyframe);
    else if (seek.t !== undefined) player.seek(seek.t);
  }, [player, loaded, seek]);

  useFrame((state, dt) => player?.update(gl, dt, state.clock.elapsedTime));

  const scene = show.scene;
  const keyframe = show.keyframes[index];
  const look = { ...show.look, ...keyframe?.look };
  const cameraPreset = keyframe?.camera?.preset ?? scene.cameraPreset;
  const hasPhysics = show.keyframes.some((k) => k.transition.curve === 'physics');

  return (
    <>
      <Sky scene={scene} />
      <Ground scene={scene} tier={capabilities.tier} />
      {scene.ground !== 'none' && <LaunchPad count={count} />}
      <Fireworks scene={scene} colors={look.colors} />
      {player && (
        <Drones
          sim={player.sim}
          look={look}
          spacing={compiled?.spacing ?? 0.5}
          power={physics?.effect === 'drop' ? 0.3 : 1}
          pushToy={pushToy}
          airframes={capabilities.tier.name !== 'low' && count <= AIRFRAME_LIMIT}
        />
      )}
      {player && compiled && hasPhysics && (
        <Suspense fallback={null}>
          <PhysicsMoments
            sim={player.sim}
            moment={physics}
            from={compiled.frames[index - 1] ?? compiled.frames[compiled.frames.length - 1] ?? compiled.ground}
            settings={scene.physics}
          />
        </Suspense>
      )}
      {cameraPreset === 'walk' ? (
        <WalkControls enabled={interactive} />
      ) : (
        <CameraRig preset={cameraPreset} autoOrbit={scene.autoOrbit} interactive={interactive} reducedMotion={reducedMotion} />
      )}
      <PostFX scene={scene} bloomScale={capabilities.tier.bloomScale} />
    </>
  );
}
