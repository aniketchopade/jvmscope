import type { JvmScopeApi } from "@jvmscope/preload";

declare global {
  interface Window {
    jvmscope: JvmScopeApi;
  }
}

export {};
