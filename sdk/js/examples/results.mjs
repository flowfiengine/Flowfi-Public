// node examples/results.mjs   (with FLOWFI_API_KEY=ffi_... in your environment)
import { FlowFi } from "flowfi";

const flowfi = new FlowFi();
const { funnel, recent } = await flowfi.results({ limit: 10 });

console.log(`Caught ${funnel.caught} -> LIVE ${funnel.live} -> 2x+ ${funnel.reached2x} -> 10x+ ${funnel.reached10x}`);
for (const r of recent) console.log(`${r.symbol}: peak ${r.peakMultiple ?? "-"}x from FlowFi's first detection`);
