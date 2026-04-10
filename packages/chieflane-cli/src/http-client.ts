import http from "node:http";
import https from "node:https";

export type HttpTextResponse = {
  status: number;
  ok: boolean;
  text: string;
  headers: http.IncomingHttpHeaders;
};

export type HttpJsonResponse<T> = HttpTextResponse & {
  json: T | null;
  parseError?: string;
};

type RequestTextOptions = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  followRedirects?: boolean;
  maxRedirects?: number;
};

async function requestTextOnce(
  urlText: string,
  options: RequestTextOptions,
  redirectsRemaining: number
): Promise<HttpTextResponse> {
  const url = new URL(urlText);
  const isHttps = url.protocol === "https:";
  const transport = isHttps ? https : http;
  const agent = isHttps
    ? new https.Agent({ keepAlive: false })
    : new http.Agent({ keepAlive: false });
  const body =
    options.body == null
      ? undefined
      : typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body);
  const method = options.method ?? (body == null ? "GET" : "POST");

  return await new Promise<HttpTextResponse>((resolve, reject) => {
    const req = transport.request(
      url,
      {
        method,
        headers: {
          connection: "close",
          accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
          ...(body == null
            ? {}
            : {
                "content-type": "application/json",
                "content-length": String(Buffer.byteLength(body)),
              }),
          ...(options.headers ?? {}),
        },
        agent,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        res.on("end", () => {
          agent.destroy();
          const status = res.statusCode ?? 0;
          const location = res.headers.location;
          if (
            redirectsRemaining > 0 &&
            status >= 300 &&
            status < 400 &&
            typeof location === "string" &&
            location.length > 0
          ) {
            const redirectUrl = new URL(location, url).toString();
            const followMethod =
              status === 307 || status === 308 || method === "GET"
                ? method
                : "GET";
            const redirectOptions: RequestTextOptions = {
              ...options,
              method: followMethod,
              body:
                followMethod === method || body == null ? options.body : undefined,
            };
            requestTextOnce(
              redirectUrl,
              redirectOptions,
              redirectsRemaining - 1
            ).then(resolve, reject);
            return;
          }

          resolve({
            status,
            ok: status >= 200 && status < 300,
            text: Buffer.concat(chunks).toString("utf8"),
            headers: res.headers,
          });
        });
      }
    );

    req.setTimeout(options.timeoutMs ?? 10_000, () => {
      req.destroy(new Error("request timed out"));
      agent.destroy();
    });

    req.on("error", (error) => {
      agent.destroy();
      reject(error);
    });

    if (body != null) {
      req.write(body);
    }
    req.end();
  });
}

export async function requestText(
  urlText: string,
  options: RequestTextOptions = {}
): Promise<HttpTextResponse> {
  return requestTextOnce(
    urlText,
    options,
    options.followRedirects === true ? options.maxRedirects ?? 5 : 0
  );
}

export async function requestJson<T>(
  urlText: string,
  options: Parameters<typeof requestText>[1] = {}
): Promise<HttpJsonResponse<T>> {
  const response = await requestText(urlText, options);
  if (!response.text.trim()) {
    return {
      ...response,
      json: null,
    };
  }

  try {
    return {
      ...response,
      json: JSON.parse(response.text) as T,
    };
  } catch (error) {
    return {
      ...response,
      json: null,
      parseError: error instanceof Error ? error.message : String(error),
    };
  }
}
