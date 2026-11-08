import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const publicPath = fileURLToPath(new URL("./public/", import.meta.url));
const PORT = Number(process.env.PORT) || 8080;

logging.set_level(logging.WARN);
// Keep the proxy away from the server's own network. ALLOW_LOCAL=1 is only for local testing.
wisp.options.allow_private_ips = process.env.ALLOW_LOCAL === "1";
wisp.options.allow_loopback_ips = process.env.ALLOW_LOCAL === "1";

const app = Fastify({
  logger: false,
  serverFactory: (handler) =>
    createServer()
      .on("request", handler)
      .on("upgrade", (req, socket, head) => {
        if (req.url.endsWith("/wisp/")) wisp.routeRequest(req, socket, head);
        else socket.end();
      }),
});

app.register(fastifyStatic, { root: publicPath, decorateReply: true });

// Our own UV config wins over the one bundled in the package.
app.get("/uv/uv.config.js", (req, reply) => reply.sendFile("uv/uv.config.js", publicPath));
app.register(fastifyStatic, { root: uvPath, prefix: "/uv/", decorateReply: false });
app.register(fastifyStatic, { root: epoxyPath, prefix: "/epoxy/", decorateReply: false });
app.register(fastifyStatic, { root: baremuxPath, prefix: "/baremux/", decorateReply: false });

// Site icons for shortcut and game tiles, fetched server-side so the page stays same-origin.
const iconCache = new Map();
app.get("/api/icon", async (req, reply) => {
  const domain = String(req.query.domain || "").toLowerCase();
  if (!/^[a-z0-9.-]{1,253}$/.test(domain)) return reply.code(400).send("bad domain");
  let icon = iconCache.get(domain);
  if (!icon) {
    try {
      const res = await fetch(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      icon = { type: res.headers.get("content-type") || "image/png", body: Buffer.from(await res.arrayBuffer()) };
      if (iconCache.size > 500) iconCache.delete(iconCache.keys().next().value);
      iconCache.set(domain, icon);
    } catch {
      return reply.code(404).send("no icon");
    }
  }
  return reply.header("cache-control", "public, max-age=86400").type(icon.type).send(icon.body);
});

app.setNotFoundHandler((req, reply) => reply.code(404).type("text/html").sendFile("404.html"));

function shutdown() {
  console.log("Shutting down Ember...");
  app.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

app.listen({ port: PORT, host: "0.0.0.0" }).then(() => {
  console.log(`🔥 Ember is running on http://localhost:${PORT}`);
});
