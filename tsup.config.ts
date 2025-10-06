import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
  },
  sourcemap: true,
  clean: true,
  format: ["esm"],
  platform: "node",
  target: "node18",
  shims: false,

  // Optimizations for commodity hardware
  splitting: false, // Reduce memory usage during build
  minify: process.env.NODE_ENV === "production",
  treeshake: true,

  // Bundle size optimizations
  external: [
    // Keep heavy dependencies external to reduce memory footprint
    "@modelcontextprotocol/sdk",

    // Tree-sitter dependencies must remain external (contain WASM files)
    "web-tree-sitter",
    "tree-sitter-javascript",
    "tree-sitter-typescript",
    "tree-sitter-python",
    "tree-sitter-c",
    "tree-sitter-cpp",
    "tree-sitter-c-sharp",
    "tree-sitter-rust",
    "tree-sitter-go",
    "tree-sitter-java",
  ],

  // Type generation
  dts: {
    resolve: true,
  },

  // Ensure executable permissions for CLI
  onSuccess: async () => {
    if (process.platform !== "win32") {
      const { chmod } = await import("fs/promises");
      await chmod("./dist/index.js", 0o755);
    }
  },
});
