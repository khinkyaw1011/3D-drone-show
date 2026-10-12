'use client';

import { useSyncExternalStore } from 'react';

const noop = () => () => {};

/** False on the server and during hydration, true afterwards: gate UI that depends on persisted client state. */
export const useHydrated = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
