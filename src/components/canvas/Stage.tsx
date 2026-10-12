'use client';

import { type RootState, useFrame, useThree } from '@react-three/fiber';
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Color, type WebGPURenderer } from 'three/webgpu';
import { FIREWORK_SHELLS, averageColor, burstLight, createSceneLight } from '@/engine/materials/lighting';
import { type PhysicsMoment, ShowPlayer } from '@/engine/playback/ShowPlayer';
import { fleetLimits, prefersReducedMotion } from '@/engine/renderer/capabilities';
import { rendererCapabilities } from '@/engine/renderer/createRenderer';
import { createSimulator } from '@/engine/sim/createSimulator';
import type { Capabilities, Show } from '@/engine/types';
import { useCompiledShow } from '@/hooks/useCompiledShow';
import { CameraRig, ViewOffset } from './CameraRig';
import { Drones } from './Drones';
import { Fireworks, Ground, LaunchPad, Sky, VenueLights } from './Environment';
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
  /** Shift the picture left by this many pixels to clear a panel on the right. */
  offsetX?: number;
  /** A lower fleet ceiling than the device tier's (found by the frame-rate watchdog). */
  maxDrones?: number | null;
  /** The device could not hold a smooth frame rate with `count` drones. */
  onOverload?: (count: number) => void;
  onTime?: (time: number, index: number, duration: number) => void;
  onStatus?: (status: 'loading' | 'ready' | 'error', error: string | null) => void;
  onReady?: (handle: ShowHandle | null) => void;
  onEnd?: () => void;
}

const UI_TICK_MS = 100;
/** Frame-rate watchdog: average over this window once the show is flying; below the floor, ask for a smaller fleet. */
const WATCHDOG = { seconds: 4, minFps: 24 };

/** Everything inside the canvas: environment, drones, camera, post-FX, and the player that drives them. */
export function Stage({
  show,
  playing,
  loop = true,
  speed = 1,
  seek = null,
  interactive = true,
  pushToy = false,
  offsetX = 0,
  maxDrones = null,
  onOverload,
  onTime,
  onStatus,
  onReady,
  onEnd,
}: StageProps) {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const getState = useThree((s) => s.get);
  const capabilities = useMemo(() => rendererCapabilities(gl), [gl]);
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);
  const count = fleetLimits(capabilities, maxDrones).clamp(show.droneCount);
  const { compiled, show: compiledShow, status, error } = useCompiledShow(show, count);

  const [player, setPlayer] = useState<ShowPlayer | null>(null);
  const [index, setIndex] = useState(0);
  const [physics, setPhysics] = useState<PhysicsMoment | null>(null);
  const callbacks = useRef({ onTime, onEnd, onOverload });
  const lastTick = useRef({ at: 0, index: -1 });

  useEffect(() => {
    callbacks.current = { onTime, onEnd, onOverload };
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

  // Only act on fly-to / seek requests made while this stage is mounted (the store may hold an older one).
  const handledSeek = useRef(seek?.nonce ?? 0);
  /** A not-yet-handled request to fly to a formation that this compile contains. */
  const pendingFlight = () => {
    if (!seek || seek.nonce === handledSeek.current || seek.keyframe === undefined) return undefined;
    const wanted = show.keyframes[seek.keyframe];
    return wanted && compiledShow?.keyframes[seek.keyframe]?.id === wanted.id ? seek.keyframe : undefined;
  };

  // A new compile and the flight it was made for are handed to the player together, so adding a
  // formation starts exactly one flight (never "re-form the old one, then fly to the new one").
  useEffect(() => {
    if (!loaded) return;
    const flyTo = pendingFlight();
    if (flyTo !== undefined) handledSeek.current = seek!.nonce;
    player.load(compiledShow, compiled, flyTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs per compile; the seek is read, not tracked
  }, [loaded, player, compiled, compiledShow]);

  useEffect(() => {
    if (!player || !loaded) return;
    player.loop = loop;
    player.setTimeScale(speed);
    if (playing) player.play();
    else player.pause();
  }, [player, loaded, playing, loop, speed, compiled]);

  useEffect(() => player?.refresh(show), [player, show]);

  // Requests that need no new compile: clicking an existing formation, or scrubbing the timeline.
  useEffect(() => {
    if (!player || !loaded || !seek || seek.nonce === handledSeek.current) return;
    if (seek.keyframe !== undefined) {
      const flyTo = pendingFlight();
      if (flyTo === undefined) return; // its formation is still being generated; the compile will bring it
      player.flyTo(flyTo);
    } else if (seek.t !== undefined) player.seek(seek.t); // a time is scrubbed to, like film
    handledSeek.current = seek.nonce;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- acts on new requests only
  }, [player, loaded, seek]);

  // Light the show throws on the ground: the fleet's average colour, and firework flashes in step with the bursts.
  const light = useMemo(() => createSceneLight(), []);
  const fleetColor = useMemo(() => new Color(), []);
  useEffect(() => {
    const frame = compiled?.frames[index];
    if (frame) averageColor(frame.colors, fleetColor);
  }, [compiled, index, fleetColor]);
  const burstColor = useMemo(() => new Color(show.scene.fireworks.palette === 'show' ? show.look.colors[0] : '#ffe2b0'), [show.scene.fireworks.palette, show.look.colors]);

  const watchdog = useRef({ frames: 0, time: 0, reported: 0 });
  useFrame(({ clock }, dt) => {
    player?.update(gl, dt);
    const dimmed = physics?.effect === 'drop' ? 0.3 : 1;
    light.fleet.value.copy(fleetColor).multiplyScalar(scene.venue.glow * 2 * dimmed);
    const shells = Math.ceil(scene.fireworks.intensity * FIREWORK_SHELLS);
    light.burst.value.copy(burstColor).multiplyScalar(burstLight(clock.elapsedTime, shells));
    // Measure only while the show is actually flying; report once per fleet size.
    const w = watchdog.current;
    if (!loaded || !playing || w.reported === count || dt > 0.5) return;
    w.frames++;
    w.time += dt;
    if (w.time < WATCHDOG.seconds) return;
    if (w.frames / w.time < WATCHDOG.minFps) callbacks.current.onOverload?.(count);
    watchdog.current = { frames: 0, time: 0, reported: count };
  });

  const scene = show.scene;
  const keyframe = show.keyframes[index];
  const look = { ...show.look, ...keyframe?.look };
  const cameraPreset = keyframe?.camera?.preset ?? scene.cameraPreset;
  const hasPhysics = show.keyframes.some((k) => k.transition.curve === 'physics');

  return (
    <>
      <Sky scene={scene} />
      <Ground scene={scene} tier={capabilities.tier} count={count} light={light} />
      {scene.ground !== 'none' && <LaunchPad count={count} />}
      <Fireworks scene={scene} colors={look.colors} />
      <VenueLights scene={scene} colors={look.colors} />
      {player && (
        <Drones
          player={player}
          look={look}
          spacing={compiled?.spacing ?? 0.5}
          power={physics?.effect === 'drop' ? 0.3 : 1}
          pushToy={pushToy}
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
      <ViewOffset pixels={offsetX} />
      <PostFX scene={scene} bloomScale={capabilities.tier.bloomScale} />
    </>
  );
}
