import type { ScanResult } from "../scan.js";
import type { OutputFormat } from "../types.js";
import { renderJson } from "./json.js";
import { renderMarkdown } from "./markdown.js";
import type { ReportOptions } from "./shared.js";
import { renderTerminal } from "./terminal.js";

export interface RenderOptions extends ReportOptions {
  color: boolean;
  width?: number;
}

export function render(result: ScanResult, format: OutputFormat, options: RenderOptions): string {
  switch (format) {
    case "json":
      return renderJson(result, options);
    case "md":
      return renderMarkdown(result, options);
    case "terminal":
      return renderTerminal(result, options);
  }
}
