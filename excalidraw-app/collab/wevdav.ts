import { s } from "../build/assets/Tableau10-B-NsZVaP";

function xmlEscape(str: string) {
  const p = document.createElement("p");
  p.textContent = str;
  return p.innerHTML;
}

export class StatusError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export class WebDav {
  constructor(private base: string) {
    if (!this.base.endsWith("/")) {
      this.base += "/";
    }
  }

  async store(
    auth: string,
    data: string | Blob,
    path: string,
    opts: { createFolders?: boolean } = {},
  ) {
    if (path.startsWith("/")) {
      throw new Error("path needs to be relative");
    }
    if (typeof data === "string") {
      data = new Blob([data], { type: "text/plain" });
    }
    const url = new URL(`./${path}`, this.base);

    const resp = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${auth}`,
        "Content-Type": "application/octet-stream",
        "X-Metadata-Meta": "JohnDoe",
      },
      credentials: "include",
      body: data /* Request for file names*/ /* Request for file sizes*/,
    });
    const rdata = await resp.text();
    if (resp.status > 300) {
      if (resp.status === 404 && opts?.createFolders) {
        const folder = new URL(".", url).href.replace(this.base, "");
        debugger;
        await this.createFolder(auth, folder);
        await this.store(auth, data, path, { ...opts, createFolders: false });
        return;
      }
      debugger;
      throw new Error(rdata);
    }
  }

  async createFolder(auth: string, path: string) {
    if (path.startsWith("/")) {
      throw new Error("path needs to be relative");
    }
    const url = new URL(path, this.base);
    await fetch(url, {
      method: "MKCOL", // Create the folder
      headers: {
        Authorization: `Bearer ${auth}`,
      },
    });
  }

  async list(auth: string, path = "") {
    if (path.startsWith("/")) {
      throw new Error("path needs to be relative");
    }
    const url = new URL(path, `${this.base}`);
    const resp = await fetch(url, {
      method: "PROPFIND",
      headers: {
        Authorization: `Bearer ${auth}`,
        //"OCS-APIRequest": "true",
        "Content-Type": "application/xml",
        Depth: "3",
      },
      credentials: "include",
      body: `<?xml version="1.0" encoding="UTF-8"?>
            <d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
                <d:prop>
                    <d:displayname />
                    <d:getcontentlength />
                    <d:getcontenttype/>
                    <d:resourcetype/>
                    <oc:customTag/>
                </d:prop>
            </d:propfind>` /* Request for file names*/ /* Request for file sizes*/,
    });
    const data = await resp.text();
    const xml = new DOMParser().parseFromString(data, "text/xml");
    const entries = xml.documentElement.getElementsByTagName("d:response");

    const files: Array<{
      name: String;
      link: string;
      meta?: string;
    }> = [];

    for (const entry of entries) {
      if (entry.getElementsByTagName("d:collection").length === 0) {
        files.push({
          name: entry.getElementsByTagName("d:displayname")[0].textContent!,
          link: entry.getElementsByTagName("d:href")[0].textContent!,
          meta:
            entry.getElementsByTagName("oc:customTag")[0]?.textContent ??
            undefined,
        });
      }
    }
    return files;
  }
  async get(auth: string, path: string, type?: "text"): Promise<string>;
  async get(auth: string, path: string, type: "blob"): Promise<Blob>;
  async get(auth: string, path: string, type: "text" | "blob" = "text") {
    const url = new URL(path, `${this.base}/`);

    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${auth}`,
        //"OCS-APIRequest": "true",
        "Content-Type": "application/xml",
      },
      credentials:
        "include" /* Request for file names*/ /* Request for file sizes*/,
    });
    if (resp.status !== 200) {
      const data = await resp.text();
      throw new StatusError(resp.status, data);
    }
    if (type === "text") {
      const data = await resp.text();
      return data;
    } else if (type === "blob") {
      return resp.blob();
    }
    throw new Error("invalid type");
  }

  async setProp(auth: string, path: string, meta: string) {
    if (path.startsWith("/")) {
      throw new Error("path needs to be relative");
    }

    const url = new URL(`./${path}`, this.base);

    const propXml = `<?xml version="1.0"?>
        <D:propertyupdate xmlns:D="DAV:" xmlns:oc="http://owncloud.org/ns">
            <D:set>
                <D:prop>
                    <oc:customTag>${xmlEscape(meta)}</oc:customTag>
                </D:prop>
            </D:set>
        </D:propertyupdate>`;

    const resp = await fetch(url, {
      method: "PROPPATCH",
      headers: {
        Authorization: `Bearer ${auth}`,
        "Content-Type": "application/xml",
      },
      credentials: "include",
      body: propXml /* Request for file names*/ /* Request for file sizes*/,
    });
    const data = await resp.text();
    if (resp.status > 300) {
      debugger;
      throw new Error(data);
    }
  }
}
