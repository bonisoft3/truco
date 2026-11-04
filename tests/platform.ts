// The platform this app's tests run against: omnishell and pronto at the
// releases .mise.toml installs, by their mirrors' raw URLs. apps/deno.json maps
// both to the checkout in the monorepo.
import "https://raw.githubusercontent.com/bonisoft3/omnishell/v0.21.7/interpreter/vendor/ses.umd.min.js";
export { default as ses } from "https://raw.githubusercontent.com/bonisoft3/omnishell/v0.21.7/interpreter/vendor/ses.umd.min.js" with { type: "text" };
export { baseUrl } from "https://raw.githubusercontent.com/bonisoft3/omnishell/v0.21.7/base-url.ts";
export { instrument } from "https://raw.githubusercontent.com/bonisoft3/omnishell/v0.21.7/instrument.ts";
export { batched } from "https://raw.githubusercontent.com/bonisoft3/omnishell/v0.21.7/interpreter/batched-store.js";
export { ensureSes, evaluateRole } from "https://raw.githubusercontent.com/bonisoft3/omnishell/v0.21.7/interpreter/jessie.js";
// Imported once the harness has set the clock screen.js reads at evaluation.
export const loadScreen = () => import("https://raw.githubusercontent.com/bonisoft3/omnishell/v0.21.7/interpreter/screen.js");
export { FuelLimitExceededError, FuelMeter } from "https://raw.githubusercontent.com/bonisoft3/omnishell/v0.21.7/test/fuel-meter.ts";
export { describe, expect, it } from "https://raw.githubusercontent.com/bonisoft3/omnishell/v0.21.7/test/harness.ts";
export { OutboxSimulator } from "https://raw.githubusercontent.com/bonisoft3/omnishell/v0.21.7/test/outbox-simulator.ts";
export { parseMessage } from "https://raw.githubusercontent.com/bonisoft3/omnishell/v0.21.7/interpreter/vendor/messages.js";
export { assert, mountApp, type Mounted, only } from "https://raw.githubusercontent.com/bonisoft3/omnishell/v0.21.7/test/screen-harness.ts";
export { extractRegions, generateCoveringArrayFrames, generateIsolatedFrames, generatePairwiseFrames } from "https://raw.githubusercontent.com/bonisoft3/omnishell/v0.21.7/test/storybook-injector.ts";
export { readCheckInputs } from "https://raw.githubusercontent.com/bonisoft3/pronto/v1.0.10/check-inputs.ts";
export { walk } from "https://raw.githubusercontent.com/bonisoft3/pronto/v1.0.10/hybrid-battery.ts";
export { executeHybrid } from "https://raw.githubusercontent.com/bonisoft3/pronto/v1.0.10/hybrid-local.ts";
export { compileHybrid, type HybridMachine } from "https://raw.githubusercontent.com/bonisoft3/pronto/v1.0.10/hybrid.ts";
