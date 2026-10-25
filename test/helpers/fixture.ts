import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Writes a throwaway repo to a temp dir. Fixtures that contain .gitignore'd
 * files are built at test time, because git would refuse to commit those files.
 */
export async function createFixture(files: Record<string, string>): Promise<{
  root: string;
  cleanup: () => Promise<void>;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "ai-readiness-"));
  for (const [file, content] of Object.entries(files)) {
    const abs = path.join(root, file);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content);
  }
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
}
