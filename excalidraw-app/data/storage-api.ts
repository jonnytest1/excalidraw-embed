import type { Socket } from "socket.io-client";
import type {
  ExcalidrawElement,
  FileId,
} from "../../packages/element/src/types";
import type { AppState, BinaryFileData } from "../../packages/excalidraw/types";
import type { SyncableExcalidrawElement } from "./index";
import type Portal from "../collab/Portal";

export interface StorageApi {
  // load attachements
  loadFiles(
    prefix: string,
    decryptionKey: string,
    filesIds: readonly FileId[],
  ): Promise<{
    loadedFiles: BinaryFileData[];
    erroredFiles: Map<FileId, true>;
  }>;

  load(
    roomId: string,
    roomKey: string,
    socket: Socket | null,
  ): Promise<readonly SyncableExcalidrawElement[] | null>;

  save(
    portal: Portal,
    elements: readonly SyncableExcalidrawElement[],
    appState: AppState,
  ): Promise<SyncableExcalidrawElement[] | null>;

  // save attachements
  saveFiles(opts: {
    prefix: string;
    files: Map<FileId, BinaryFileData>;
    encryptionKey: string;
  }): Promise<{ savedFiles: FileId[]; erroredFiles: FileId[] }>;

  allowUnload(portal: Portal, elements: readonly ExcalidrawElement[]): boolean;

  storageApi(): unknown;
}
