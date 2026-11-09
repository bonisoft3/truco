// The platform this app's tests run against: omnishell where mise puts it,
// under its own test config (pronto's docs/monorepo.md).
import "@bonisoft3/omnishell/interpreter/vendor/ses.umd.min.js";
export { baseUrl } from "@bonisoft3/omnishell/base-url.ts";
export { batched } from "@bonisoft3/omnishell/interpreter/batched-store.js";
export { ensureSes, evaluateRole } from "@bonisoft3/omnishell/interpreter/jessie.js";
// Imported once the harness has set the clock screen.js reads at evaluation.
export const loadScreen = () => import("@bonisoft3/omnishell/interpreter/screen.js");
export { FuelLimitExceededError, FuelMeter } from "@bonisoft3/omnishell/test/fuel-meter.ts";
export { describe, expect, it } from "@bonisoft3/omnishell/test/harness.ts";
export { OutboxSimulator } from "@bonisoft3/omnishell/test/outbox-simulator.ts";
export { parseMessage } from "@bonisoft3/omnishell/interpreter/vendor/messages.js";
export { assert, mountApp, type Mounted, only } from "@bonisoft3/omnishell/test/screen-harness.ts";
export { extractRegions, generateCoveringArrayFrames, generateIsolatedFrames, generatePairwiseFrames } from "@bonisoft3/omnishell/test/storybook-injector.ts";
export { type Machine, walk } from "@bonisoft3/omnishell/test/mecha-battery.ts";
export { executeMecha } from "@bonisoft3/omnishell/test/mecha-local.ts";
