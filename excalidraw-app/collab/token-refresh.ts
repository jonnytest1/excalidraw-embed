interface OAuthResponse {
  access_token: string;
  expires_in: number;
  user_id: string;
  refresh_token: string;
}

declare global {
  interface Window {
    token: Promise<OAuthResponse>;
    startAuth: Function;
  }
}

export class TokenRefresh {
  currentToken: OAuthResponse | null = null;

  validTo: number | null = null;
  tokenPr = window.token;
  constructor() {
    if (!this.tokenPr) {
      const t = localStorage.getItem("token");
      if (t) {
        const oktenObj = JSON.parse(t);
        this.currentToken = {
          refresh_token: oktenObj.token,
        } as OAuthResponse;
        this.validTo = oktenObj.valid_to;
        this.tokenPr = this.refreshToken().catch((e) => {
          debugger;
          throw e;
        });
      }
    }

    this.tokenPr.then((token) => {
      this.currentToken = token;
      if (token.expires_in) {
        this.validTo = Date.now() + (token.expires_in ?? 1000) * 1000;
      }
      setInterval(() => {
        this.refreshToken();
      }, (token.expires_in ?? 1000) * 0.9 * 1000);
    });
  }
  async refreshToken() {
    const clientId =
      "AMu4lC3URJ9lSW5qQM31jvprpYavfCFnQbB3bMmvYoCIg2rrDxFC2q1QKFo0GcdE";
    const secret =
      "2dFfaHxYFdz6XAVoseIVXBDa8HqXOuFJ5vNIlBuzbl2LhhOQA95zPk5wmRFk3zm3";

    const resp = await fetch(
      "https://nextcloud/index.php/apps/oauth2/api/v1/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `client_id=${clientId}&client_secret=${secret}&grant_type=refresh_token&refresh_token=${
          this.currentToken!.refresh_token
        }&redirect_uri=${encodeURIComponent("https://excalidraw")}`,
      },
    );
    if (resp.status === 500) {
      window.startAuth();
    }
    const response = await resp.text();
    try {
      const respBody = JSON.parse(response) as OAuthResponse;
      this.currentToken = respBody;
      this.validTo = Date.now() + (respBody.expires_in ?? 1000) * 1000;
      console.log("resolve token");
      localStorage.setItem(
        "token",
        JSON.stringify({
          token: respBody.refresh_token,
          valid_to: Date.now() + respBody.expires_in * 1000,
        }),
      );

      return respBody;
    } catch (e) {
      debugger;
      throw e;
    }
  }

  getToken() {
    if (this.validTo && this.validTo < Date.now()) {
      debugger;
    }
    return this.currentToken!.access_token;
  }

  getUser() {
    return this.currentToken!.user_id;
  }
}
