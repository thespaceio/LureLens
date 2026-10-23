import { createHash } from "crypto"
import { readdirSync, readFileSync, statSync, writeFileSync } from "fs"
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

// Files in dist/ that the offline cache should not hold.
const SKIP_PRECACHE = new Set(["service-worker.js", "_redirects", "og-image.png", "favicon-16.png"])

/**
 * After the build, write the list of every built file and a build hash into
 * dist/service-worker.js, so the game works offline from the first visit and
 * each release replaces the previous cache.
 */
function precacheServiceWorker(): Plugin {
  let outDir = "dist"
  return {
    name: "lurelens-precache-service-worker",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const files: string[] = []
      const walk = (dir: string) => {
        for (const name of readdirSync(dir).sort()) {
          const full = path.join(dir, name)
          if (statSync(full).isDirectory()) walk(full)
          else files.push(path.relative(outDir, full).split(path.sep).join("/"))
        }
      }
      walk(outDir)
      const precache = files.filter(f => !SKIP_PRECACHE.has(f))
      const hash = createHash("sha256")
      for (const f of precache) hash.update(f).update(readFileSync(path.join(outDir, f)))
      const buildId = hash.digest("hex").slice(0, 12)

      const swPath = path.join(outDir, "service-worker.js")
      const sw = readFileSync(swPath, "utf8")
      const list = JSON.stringify(["./", ...precache.map(f => `./${f}`)])
      const out = sw
        .replace(/\/\*__BUILD_ID__\*\/ '[^']*'/, `'${buildId}'`)
        .replace(/\/\*__PRECACHE__\*\/ \[[^\]]*\]/, list)
      if (out === sw || out.includes("__PRECACHE__") || out.includes("__BUILD_ID__")) {
        throw new Error("precacheServiceWorker: placeholders not found in service-worker.js")
      }
      writeFileSync(swPath, out)
    },
  }
}

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf8")) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  base: './',
  define: {
    // Shown in the About page and added to mistake reports.
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    // The email bank is bundled into the main chunk on purpose (works offline).
    chunkSizeWarningLimit: 700,
  },
  plugins: [react(), precacheServiceWorker()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
