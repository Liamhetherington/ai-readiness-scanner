import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Version from package.json; resolves the same from src/ (tests) and dist/ (published). */
export function packageVersion(): string {
  const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
  return (JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string }).version;
}
