/** Seek to a time, or to the start of a keyframe's transition (the player knows the real timings). */
export type SeekRequest = { t?: number; keyframe?: number; nonce: number };

/** Transport state. Only `speed` and `loop` are persisted (they are preferences); never part of undo history. */
export interface PlaybackSlice {
  playback: {
    playing: boolean;
    loop: boolean;
    /** Playback rate multiplier (GSAP timeScale). */
    speed: number;
    /** Playhead in seconds, mirrored from the player at a low rate for the UI. */
    time: number;
    duration: number;
    /** Index of the keyframe on stage. */
    index: number;
    /** A seek request for the player; `nonce` makes repeated seeks to the same time distinct. */
    seek: SeekRequest | null;
    /** Flight statistics of the transition on stage: peak speed (m/s), closest approach (m), unresolved conflicts. */
    stats: { peakSpeed: number; minSeparation: number; conflicts: number } | null;
  };
}

export const initialPlaybackSlice = (): PlaybackSlice => ({
  playback: { playing: true, loop: true, speed: 1, time: 0, duration: 0, index: 0, seek: null, stats: null },
});
