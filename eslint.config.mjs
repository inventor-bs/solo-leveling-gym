import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import importPlugin from "eslint-plugin-import";
import prettierConfig from "eslint-config-prettier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "src/infra/db/migrations/**",
      "src/infra/db/local.db",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    plugins: { import: importPlugin },
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/core",
              from: "./src/infra",
              message: "core/ must not know infra/ exists. Use ports/ instead.",
            },
            {
              target: "./src/core",
              from: "./src/server",
              message: "core/ must not import server/.",
            },
            {
              target: "./src/core",
              from: "./src/app-services",
              message: "Dependencies flow into core/, never out of it.",
            },
            {
              target: "./src/core",
              from: "./src/ui",
              message: "core/ is pure domain logic and knows nothing about UI.",
            },
            {
              target: "./src/core",
              from: "./src/app",
              message: "core/ must not import Next.js routes.",
            },
            {
              target: "./src/ports",
              from: "./src/infra",
              message:
                "ports/ only contains interfaces. infra/ implements them, not the other way around.",
            },
          ],
        },
      ],
    },
  },
  // core/ must stay free of framework, I/O, and non-deterministic calls —
  // that is what makes every rule in it a fast, deterministic unit test.
  {
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "next/*",
            "react",
            "react-dom",
            "drizzle-orm",
            "drizzle-orm/*",
            "@libsql/*",
            "@/infra/*",
            "@/server/*",
            "@/app-services/*",
            "@/ui/*",
            "@/app/*",
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: "core/ must not read wall-clock time. Use ClockPort.",
        },
        {
          selector:
            "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: "core/ must not generate randomness. Use RngPort.",
        },
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env']",
          message:
            "core/ must not read process.env. Accept configuration via parameters.",
        },
      ],
    },
  },
  {
    files: ["src/**/*.test.ts"],
    rules: {
      "no-restricted-syntax": "off",
      "no-restricted-imports": "off",
    },
  },
  // Must stay last: disables stylistic rules that would fight Prettier.
  prettierConfig,
];

export default eslintConfig;
