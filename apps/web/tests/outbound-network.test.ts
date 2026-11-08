import assert from "node:assert/strict";
import type { Server } from "node:net";
import { createServer } from "node:http";
import { createServer as createTcpServer } from "node:net";
import { once } from "node:events";
import { test } from "node:test";
import { fetch, getGlobalDispatcher, setGlobalDispatcher } from "undici";
import { OutboundDispatcher, bypassProxy } from "../src/lib/network/dispatcher";

/** Bind a loopback fixture and return its address. */
async function listen(server: Server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return address.port;
}

// Omitting the chosen proxy would attempt public DNS and fail, not return this tunnel response.
test("configured external fetch traverses proxy tunnel without exposing proxy credentials to target", async () => {
  const proxy = createServer();
  const requests: string[] = [];
  proxy.on("connect", (request, socket) => {
    requests.push(request.url || "");
    assert.equal(request.headers["proxy-authorization"], "Basic dXNlcjpzZWNyZXQ=");
    socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    socket.once("data", (bytes) => {
      assert.ok(!bytes.toString().toLowerCase().includes("proxy-authorization"));
      socket.end("HTTP/1.1 200 OK\r\nContent-Length: 7\r\nConnection: close\r\n\r\nproxied");
    });
  });
  const port = await listen(proxy);
  const dispatcher = new OutboundDispatcher(async () => ({ proxyUrl: `http://user:secret@127.0.0.1:${port}`, bypassOrigins: [] }), []);
  const previous = getGlobalDispatcher();
  setGlobalDispatcher(dispatcher);
  try {
    const response = await globalThis.fetch("http://external.invalid/example");
    assert.equal(await response.text(), "proxied");
    assert.deepEqual(requests, ["external.invalid:80"]);
  } finally {
    setGlobalDispatcher(previous);
    await dispatcher.close();
    proxy.close();
  }
});

// SOCKS5 credentials travel in RFC 1929 and the hostname is resolved by the proxy, not the server.
test("configured SOCKS5 proxy receives credentials and tunnels the remote host", async () => {
  const proxy = createTcpServer();
  const observed: string[] = [];
  proxy.on("connection", (socket) => {
    socket.once("data", (greeting) => {
      assert.deepEqual([...greeting], [5, 2, 2, 0]);
      socket.write(Buffer.from([5, 2]));
      socket.once("data", (auth) => {
        const usernameLength = auth[1] ?? 0;
        observed.push(`${auth.subarray(2, 2 + usernameLength).toString()}:${auth.subarray(3 + usernameLength).toString()}`);
        socket.write(Buffer.from([1, 0]));
        socket.once("data", (connect) => {
          const hostLength = connect[4] ?? 0;
          const host = connect.subarray(5, 5 + hostLength).toString();
          observed.push(`${host}:${connect.readUInt16BE(5 + hostLength)}`);
          socket.write(Buffer.from([5, 0, 0, 1, 0, 0, 0, 0, 0, 0]));
          socket.once("data", (request) => {
            observed.push(request.toString().split("\r\n")[0] ?? "");
            socket.end("HTTP/1.1 200 OK\r\nContent-Length: 7\r\nConnection: close\r\n\r\nproxied");
          });
        });
      });
    });
  });
  const port = await listen(proxy);
  const dispatcher = new OutboundDispatcher(async () => ({ proxyUrl: `socks5h://user:secret@127.0.0.1:${port}`, bypassOrigins: [] }), []);
  try {
    const response = await fetch("http://external.invalid/example", { dispatcher });
    assert.equal(await response.text(), "proxied");
    assert.deepEqual(observed, ["user:secret", "external.invalid:80", "GET /example HTTP/1.1"]);
  } finally {
    await dispatcher.close();
    proxy.close();
  }
});

test("local traffic bypasses unavailable configuration and reaches its direct origin", async () => {
  const origin = createServer((_request, response) => response.end("direct"));
  const port = await listen(origin);
  const dispatcher = new OutboundDispatcher(async () => { throw new Error("unavailable"); }, []);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/direct`, { dispatcher });
    assert.equal(await response.text(), "direct");
  } finally {
    await dispatcher.close();
    origin.close();
  }
});

test("external requests fail closed when active proxy configuration cannot be retrieved", async () => {
  const dispatcher = new OutboundDispatcher(async () => { throw new Error("credentials-must-not-leak"); }, []);
  try {
    await assert.rejects(fetch("https://external.invalid", { dispatcher }), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.ok(!String(error.cause).includes("credentials-must-not-leak"));
      return true;
    });
  } finally {
    await dispatcher.close();
  }
});

test("bypass does not accidentally include public FQDNs", () => {
  for (const url of ["http://localhost:8000", "http://[::1]", "http://192.168.1.1", "http://meilisearch:7700"]) {
    assert.equal(bypassProxy(new URL(url), []), true);
  }
  assert.equal(bypassProxy(new URL("https://api.github.com"), []), false);
});
