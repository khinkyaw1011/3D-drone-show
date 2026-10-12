import { del, get, set } from 'idb-keyval';
import { nanoid } from 'nanoid';
import { useSyncExternalStore } from 'react';
import { FileMissingError } from '@/engine/formations/files';

/**
 * Files a show uses from the visitor's device (models, large artwork).
 *
 * A web page is never told a file's path, so "linking" works like this:
 *  - where the browser supports it (Chromium), we keep the file's *handle*: a permanent
 *    reference to that file on disk. Nothing is copied, and edits to the file are picked up;
 *  - elsewhere (Safari, Firefox) we keep a copy in IndexedDB, which has no practical size limit.
 * Either way the show itself (zustand `persist`, localStorage) stores only a small id and name.
 * If the file cannot be read later (moved, deleted, permission lapsed, another device), the
 * formation reports it as missing and the visitor is offered to locate it again.
 */
interface LinkedFile {
  name: string;
  size: number;
  handle?: FileSystemFileHandle;
  blob?: Blob;
}

/** Permission methods of the File System Access API (not in TypeScript's DOM types yet). */
type PermissionedHandle = FileSystemFileHandle & {
  queryPermission(options: { mode: 'read' }): Promise<PermissionState>;
  requestPermission(options: { mode: 'read' }): Promise<PermissionState>;
};
type PickerWindow = Window & {
  showOpenFilePicker?: (options: { types: { description: string; accept: Record<string, string[]> }[]; multiple: false }) => Promise<FileSystemFileHandle[]>;
};

const key = (id: string) => `skyloom-file:${id}`;

export interface PickedFile {
  file: File;
  handle?: FileSystemFileHandle;
}

/** Ask the visitor for a file, keeping a handle to it when the browser can give one. */
export async function pickFile(accept: Record<string, string[]>, description: string): Promise<PickedFile | null> {
  const picker = (window as PickerWindow).showOpenFilePicker;
  if (picker) {
    try {
      const [handle] = await picker.call(window, { types: [{ description, accept }], multiple: false });
      return { file: await handle.getFile(), handle };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return null; // cancelled
      // Any other failure (blocked in an iframe, policy): fall through to the plain input.
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = Object.values(accept).flat().join(',');
    input.onchange = () => resolve(input.files?.[0] ? { file: input.files[0] } : null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/** Remember a file for later sessions; returns the id formations refer to it by. */
export async function linkFile({ file, handle }: PickedFile, id = nanoid(10)): Promise<string> {
  const record: LinkedFile = handle ? { name: file.name, size: file.size, handle } : { name: file.name, size: file.size, blob: file };
  await set(key(id), record);
  setMissing(id, null);
  return id;
}

/** Bytes of a linked file, read fresh from disk. Throws `FileMissingError` when it cannot be read. */
export async function readLinkedFile(id: string, name: string): Promise<ArrayBuffer> {
  const fail = (reason: 'missing' | 'permission') => {
    setMissing(id, { id, name, reason });
    return new FileMissingError(id, name, reason);
  };
  const record = await get<LinkedFile>(key(id)).catch(() => undefined);
  if (!record) throw fail('missing');
  try {
    if (record.handle) {
      const handle = record.handle as PermissionedHandle;
      // After a browser restart the permission is back to "ask"; asking needs a click (see `relinkFile`).
      if ((await handle.queryPermission({ mode: 'read' })) !== 'granted') throw fail('permission');
      const bytes = await (await handle.getFile()).arrayBuffer();
      setMissing(id, null);
      return bytes;
    }
    if (!record.blob) throw fail('missing');
    const bytes = await record.blob.arrayBuffer();
    setMissing(id, null);
    return bytes;
  } catch (error) {
    throw error instanceof FileMissingError ? error : fail('missing');
  }
}

/**
 * Make a missing file readable again. Must be called from a click. First asks the browser to
 * allow the file it already knows; if that file is really gone, the visitor picks where it is now.
 */
export async function relinkFile(id: string, accept: Record<string, string[]>, description: string): Promise<boolean> {
  const record = await get<LinkedFile>(key(id)).catch(() => undefined);
  const handle = record?.handle as PermissionedHandle | undefined;
  if (handle) {
    try {
      if ((await handle.requestPermission({ mode: 'read' })) === 'granted') {
        await handle.getFile(); // throws if the file was moved or deleted
        setMissing(id, null);
        return true;
      }
    } catch {
      // gone: ask where it is now
    }
  }
  const picked = await pickFile(accept, description);
  if (!picked) return false;
  await linkFile(picked, id);
  return true;
}

export const forgetFile = (id: string) => del(key(id));

// --- which linked files could not be read (drives the "locate file" prompt) ----------------

export interface MissingFile {
  id: string;
  name: string;
  reason: 'missing' | 'permission';
}

let missing: MissingFile[] = [];
/** Bumped whenever a file becomes readable again, so the show recompiles with it. */
let version = 0;
const listeners = new Set<() => void>();

function setMissing(id: string, entry: MissingFile | null) {
  const had = missing.some((m) => m.id === id);
  if (!entry && !had) return;
  if (entry && had) return;
  missing = entry ? [...missing, entry] : missing.filter((m) => m.id !== id);
  if (!entry) version++;
  listeners.forEach((notify) => notify());
}

const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => void listeners.delete(notify);
};
const NONE: MissingFile[] = [];

export const linkedFilesVersion = () => version;
export const useMissingFiles = () => useSyncExternalStore(subscribe, () => missing, () => NONE);
export const useLinkedFilesVersion = () => useSyncExternalStore(subscribe, () => version, () => 0);

export const MODEL_ACCEPT = { 'model/gltf-binary': ['.glb'] };
export const SVG_ACCEPT = { 'image/svg+xml': ['.svg'] };
