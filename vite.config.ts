import { cloudflare } from "@cloudflare/vite-plugin";
import basicSsl from "@vitejs/plugin-basic-ssl";
import vue from "@vitejs/plugin-vue";
import * as vueCompiler from "@vue/compiler-sfc";
import { defineConfig } from "vite";

export default defineConfig(({ command, mode }) => {
  const development = command === "serve" && mode !== "test";

  return {
    plugins: [
      vue({ compiler: vueCompiler }),
      ...(development ? [basicSsl()] : []),
      ...(mode === "test" ? [] : [cloudflare()]),
    ],
    server: development ? { https: true } : undefined,
  };
});
