/** Transport state. Never persisted and never part of undo history. */
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
    seek: { t: number; nonce: number } | null;
  };
}

export const initialPlaybackSlice = (): PlaybackSlice => ({
  playback: { playing: true, loop: true, speed: 1, time: 0, duration: 0, index: 0, seek: null },
});
