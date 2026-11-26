// Removes the previous build output (works on Windows, macOS and Linux).
import { rmSync } from "node:fs";
rmSync(new URL("../dist", import.meta.url), { recursive: true, force: true });
