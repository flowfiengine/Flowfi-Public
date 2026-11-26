// node examples/token.mjs <mint>   (Builder plan and above)
import { FlowFi, FlowFiError } from "flowfi";

const flowfi = new FlowFi();
try {
  const read = await flowfi.token(process.argv[2]);
  console.log("Security check:", read.signals.securityCheck.firewall);
  console.log("Buy share (1h):", read.signals.capitalFlow.buyShare1h);
  console.log("Peak since first detection:", read.outcome?.peakMultiple ?? "-");
} catch (err) {
  if (err instanceof FlowFiError && err.code === "plan_required") console.log("Token reads start on Builder:", err.upgradeUrl);
  else throw err;
}
