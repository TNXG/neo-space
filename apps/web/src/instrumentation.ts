/** Install the Node HTTP dispatcher before Next handles server-side fetches; browser traffic is unchanged. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Node-only undici/crypto cannot be statically imported into Next's Edge instrumentation bundle.
    const { registerOutboundNetwork } = await import("./lib/network/server");
    registerOutboundNetwork();
  }
}
