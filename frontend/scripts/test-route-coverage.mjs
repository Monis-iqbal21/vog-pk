import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { navigation, footerGroups } from "../src/config/navigation.js";
import { products } from "../src/data/products.js";
import { getProductPath } from "../src/lib/products.js";

const flatten = (items) => items.flatMap((item) => item.href ? [item.href] : flatten(item.children ?? []));
const routes = new Set([
  ...flatten(navigation),
  ...footerGroups.flatMap((group) => flatten(group.links)),
  ...products.filter((product) => product.active).map(getProductPath),
  "/cart", "/checkout", "/order-confirmation/ROUTE-COVERAGE",
]);
const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const value = server.address().port;
    server.close(() => resolve(value));
  });
});
const frontendDir = fileURLToPath(new URL("..", import.meta.url));
const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const child = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: frontendDir,
  env: { ...process.env, VOG_CATALOG_MODE: "static" },
  stdio: ["ignore", "ignore", "pipe"],
});
let stderr = "";
child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr = (stderr + chunk).slice(-4000); });
const origin = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let i = 0; i < 60 && !ready; i++) {
    if (child.exitCode !== null) throw new Error(`Next server exited early: ${stderr}`);
    try { ready = (await fetch(origin)).status === 200; } catch { await delay(500); }
  }
  assert.equal(ready, true, `Next server did not become ready: ${stderr}`);
  const queue = [...routes], failures = [];
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const route = queue.shift();
      try {
        const response = await fetch(new URL(route, origin), { redirect: "manual" });
        if (response.status !== 200) failures.push(`${route}: HTTP ${response.status}`);
      } catch (error) { failures.push(`${route}: ${error.message}`); }
    }
  }));
  assert.deepEqual(failures, [], `Route failures:\n${failures.join("\n")}`);
  console.log(`PASS: ${routes.size} navbar/footer, ${products.filter((product) => product.active).length} product detail, cart, checkout and confirmation routes returned HTTP 200.`);
} finally {
  child.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(5000)]);
}
