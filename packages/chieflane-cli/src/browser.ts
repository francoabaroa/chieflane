import { execa } from "execa";
import { getShellHealthUrl } from "./local-shell";

type BrowserHealthPayload = {
  ok?: unknown;
  service?: unknown;
};

export async function openBrowser(url: string) {
  if (process.platform === "darwin") {
    const result = await execa("open", [url], { reject: false });
    return result.exitCode === 0;
  }

  if (process.platform === "win32") {
    const result = await execa("cmd", ["/c", "start", "", url], {
      reject: false,
      shell: true,
    });
    return result.exitCode === 0;
  }

  const result = await execa("xdg-open", [url], { reject: false });
  return result.exitCode === 0;
}

export async function browserCheck(url: string) {
  const root = await fetch(url);
  const health = await fetch(getShellHealthUrl(url));
  const healthBody = (await health.json().catch(() => null)) as BrowserHealthPayload | null;
  const healthPayloadOk =
    healthBody?.ok === true && healthBody?.service === "chieflane";

  return {
    rootOk: root.ok,
    rootStatus: root.status,
    healthOk: health.ok && healthPayloadOk,
    healthStatus: health.status,
    healthPayloadOk,
  };
}
