// node examples/early-radar.mjs   (with FLOWFI_API_KEY=ffi_... in your environment)
import { FlowFi } from "flowfi";

const flowfi = new FlowFi(); // reads FLOWFI_API_KEY
const radar = await flowfi.earlyRadar();

for (const p of radar.projects) {
  console.log(`${p.symbol.padEnd(10)} $${Math.round(p.marketCapUsd ?? 0).toLocaleString()} MC  ${p.buys1h ?? 0} buys/1h  firewall: ${p.firewall}`);
}
if (radar.delayNote) console.log(radar.delayNote);
