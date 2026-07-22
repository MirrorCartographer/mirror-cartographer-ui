# FIA owned build worker

Run one job:

```bash
node platform/build-worker/worker.mjs path/to/job.json
```

The worker accepts `fia.worker-job.v1`, strips hosted-provider identity variables, fixes locale and time inputs, rejects path escapes and symlinks, executes one command with a bounded timeout, inventories declared outputs, and emits `fia.worker-receipt.v1` with a content digest.

Run the adversarial test suite:

```bash
node --test platform/build-worker/worker.test.mjs
```

The worker remains a process-isolation prototype. It does not claim container, VM, kernel, network, CPU, or memory isolation. Add those gates before accepting untrusted build inputs.
