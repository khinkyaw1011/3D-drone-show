'use client';

import { Canvas } from '@react-three/fiber';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { PCFShadowMap } from 'three';
import { isMobileDevice } from '@/engine/renderer/capabilities';
import { createRenderer } from '@/engine/renderer/createRenderer';
import { cn } from '@/lib/utils';
import { Stage, type StageProps } from './Stage';

export type { ShowHandle } from './Stage';

interface ShowCanvasProps extends StageProps {
  className?: string;
  /** Pause rendering entirely (off-screen, hidden tab handled automatically). */
  paused?: boolean;
  /** Keep the drawing buffer readable for PNG / video capture. */
  children?: ReactNode;
}

/**
 * The one canvas every surface shares (landing, studio, viewer).
 * WebGPU first with automatic WebGL2 fallback; append `?webgl` to the URL to force the fallback.
 */
export default function ShowCanvas({ className, paused = false, children, ...stage }: ShowCanvasProps) {
  const mobile = useMemo(() => isMobileDevice(), []);
  const forceWebGL = useMemo(() => new URLSearchParams(window.location.search).has('webgl'), []);
  const [visible, setVisible] = useState(true);

  // Do not burn battery on a hidden tab.
  useEffect(() => {
    const onVisibility = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return (
    <div className={cn('absolute inset-0 touch-none', className)}>
      <Canvas
        gl={(props) => createRenderer({ canvas: props.canvas as HTMLCanvasElement, forceWebGL })}
        dpr={mobile ? [1, 1.5] : [1, 2]}
        camera={{ fov: 50, near: 0.3, far: 1200, position: [0, 1.7, 40] }}
        frameloop={paused || !visible ? 'never' : 'always'}
        // R3F asks for PCFSoftShadowMap, which the WebGPU renderer no longer has; nothing here casts shadows.
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = false;
          gl.shadowMap.type = PCFShadowMap;
        }}
      >
        <Stage {...stage} />
        {children}
      </Canvas>
    </div>
  );
}
