import { FileManager } from "../data/FileManager";

import { TokenRefresh } from "./token-refresh";
import { WebDav } from "./wevdav";

import type { StorageApi } from "../data/storage-api";
import type { ImportedDataState } from "../../packages/excalidraw/data/types";
import type { FileId } from "../../packages/element/src/types";
import type { SyncableExcalidrawElement } from "../data";
import type { BinaryFileData, DataURL } from "../../packages/excalidraw/types";

const tokenRefresh = new TokenRefresh();

const webdavPr = tokenRefresh.tokenPr
  .then((tokenr) => {
    return tokenr.user_id;
  })
  .then((user) => {
    if (!user) {
      throw new Error("no user");
    }
    return new WebDav(
      `https://nextcloud/remote.php/dav/files/${user}/excalidraw-files/`,
    );
  });

const url = new URL(location.href);
const file = url.searchParams.get("file");

const mainFile = `${file?.split(".")[0]}.excalidraw`;
const attachementFolder = file?.split(".")[0];

const metaDataPr = webdavPr.then(async (webdav) => {
  try {
    const metadata = await webdav.list(
      tokenRefresh.getToken(),
      `${attachementFolder}/`,
    );
    return Object.fromEntries(metadata.map((m) => [m.name.split(".")[0], m]));
  } catch (e) {
    debugger;
  }
});

function dataUrlToBlob(dataUrl: string) {
  // Extract the base64 encoded data from the Data URL
  const base64Data = dataUrl.split(",")[1];

  // Decode the base64 string into binary data
  const binaryData = atob(base64Data);

  // Convert binary data to a Uint8Array
  const uint8Array = new Uint8Array(binaryData.length);
  for (let i = 0; i < binaryData.length; i++) {
    uint8Array[i] = binaryData.charCodeAt(i);
  }

  // Create a Blob from the Uint8Array
  return new Blob([uint8Array], { type: dataUrl.split(";")[0].slice(5) }); // Extract MIME type from the Data URL
}

function blobToDataUrl(blob: Blob) {
  return new Promise((res) => {
    const reader = new FileReader();
    reader.onloadend = function () {
      const dataUrl = reader.result; // This is the Data URL
      res(dataUrl); // You can use this Data URL to display the file in an <img> tag or elsewhere
    };

    reader.readAsDataURL(blob);
  });
}

const mimeTypeMap = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/bmp": ".bmp",
  "image/x-icon": ".ico",
  "image/svg+xml": ".svg",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/jfif": ".jfif",
  "text/html": ".html",
  "text/plain": ".txt",
  "text/css": ".css",
  "text/csv": ".csv",
  "application/octet-stream": ".bin",
};

export const webdavStorageApi: StorageApi = {
  isSaved(portal, elements) {
    debugger;
    return false;
  },
  async load(roomId, roomKey, socket) {
    try {
      const webdav = await webdavPr;
      const file = await webdav.get(
        tokenRefresh.getToken(),
        `${encodeURIComponent(mainFile!)}`,
      );
      const data: ImportedDataState = JSON.parse(file);
      return (data.elements as Array<SyncableExcalidrawElement>) ?? [];
    } catch (e) {
      debugger;
      throw e;
    }
  },
  async loadFiles(prefix, decryptionKey, filesIds) {
    const webdav = await webdavPr;
    /*const files = await webdav.list(
      tokenRefresh.getToken(),
      `${attachementFolder}`,
    );*/
    const loadedFiles: Array<BinaryFileData> = [];
    const erroredFiles = new Map<FileId, true>();
    const content = await Promise.all(
      filesIds.map(async (file) => {
        try {
          const fileCOntent = await webdav.get(
            tokenRefresh.getToken(),
            `${attachementFolder}/${file}.png`,
            "blob",
          );
          const meta = await metaDataPr;
          const fileMeta = meta[file];

          const dataUrl = await blobToDataUrl(fileCOntent);

          debugger;
          let metaObj: Partial<BinaryFileData> = {};

          try {
            metaObj = JSON.parse(fileMeta.meta ?? "{}");
          } catch (e) {
            console.error(e);
          }

          loadedFiles.push({
            ...(metaObj as BinaryFileData),
            dataURL: dataUrl as DataURL,
            id: file,
          });
        } catch (e) {
          debugger;
          erroredFiles.set(file as FileId, true);
        }
      }),
    );

    return {
      erroredFiles,
      loadedFiles,
    };
  },
  async save(portal, elements, appState) {
    try {
      const data = JSON.stringify({
        elements,
        // appState,
        source: location.href,
        file,
        type: "excalidraw",
        version: 2,
      } as ImportedDataState);

      const webdav = await webdavPr;
      await webdav.store(tokenRefresh.getToken(), data, `${mainFile}`);
      return [...elements];
    } catch (e) {
      if (
        e &&
        "message" in (e as Error) &&
        (e as Error).message?.includes("No public access to this resource")
      ) {
      }
    }
  },
  async saveFiles(opts) {
    const errored: Array<FileId> = [];
    const saved: Array<FileId> = [];
    if (!opts.files.size) {
      return { erroredFiles: errored, savedFiles: saved };
    }
    const webdav = await webdavPr;

    await Promise.all(
      [...opts.files.entries()].map(async ([file, data]) => {
        try {
          debugger;
          const fileBlob = dataUrlToBlob(data.dataURL);

          const fileEnding = mimeTypeMap[data.mimeType] ?? ".raw";
          const filePath = `${attachementFolder}/${file}${fileEnding}`;
          await webdav.store(tokenRefresh.getToken(), fileBlob, filePath, {
            createFolders: true,
          });
          const meta = JSON.stringify({
            created: data.created,
            mimeType: data.mimeType,
            version: data.version,
            id: data.id,
          });
          await webdav.setProp(tokenRefresh.getToken(), filePath, meta);
          saved.push(file);
        } catch (e) {
          errored.push(file);
        }
      }),
    );

    return { erroredFiles: errored, savedFiles: saved };
  },
  storageApi() {
    return null;
  },
};
