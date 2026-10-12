import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // React Three Fiber drives three.js objects imperatively: cameras, uniforms and player
    // state from hooks are mutated every frame by design. The React Compiler immutability
    // rule cannot model that, so it is off for the canvas layer only.
    files: ["src/components/canvas/**"],
    rules: { "react-hooks/immutability": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored Draco decoder for compressed .glb models (copied from three.js).
    "public/draco/**",
  ]),
]);

export default eslintConfig;
