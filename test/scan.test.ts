import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scan } from "../src/scan.js";
import { createFixture } from "./helpers/fixture.js";

describe("scan performance", () => {
  let fixture: Awaited<ReturnType<typeof createFixture>>;

  beforeAll(async () => {
    const body = Array.from({ length: 120 }, (_, i) => `export const v${i} = ${i};`).join("\n");
    const files: Record<string, string> = { "README.md": "# Big repo", "tsconfig.json": "{}" };
    for (let i = 0; i < 5000; i++) {
      const dir = `packages/pkg${i % 50}/src/mod${Math.floor(i / 50) % 10}`;
      files[i % 4 === 0 ? `${dir}/file${i}.test.ts` : `${dir}/file${i}.ts`] = body;
    }
    fixture = await createFixture(files);
  }, 60_000);

  afterAll(() => fixture.cleanup());

  it("scores a 5,000-file repo in under 10 seconds", async () => {
    const result = await scan(fixture.root);
    expect(result.fileCount).toBe(5002);
    expect(result.durationMs).toBeLessThan(10_000);
    console.log(`5,000-file scan: ${result.durationMs} ms`);
  });
});
