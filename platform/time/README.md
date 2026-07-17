# Sovereign Time Authority

This plane defines how Foundation Intelligence obtains, distributes, verifies, survives loss of, and reasons about time.

## Authority boundary

The project owns source policy, source diversity, acceptable uncertainty, host quarantine, internal distribution, holdover, application clock semantics, evidence, and recovery. Public NTP/NTS servers, GNSS, oscillators, Linux clocks, and chrony are replaceable mechanisms. The project does not physically own UTC, satellite constellations, radio spectrum, upstream networks, public PKI, oscillator fabrication, or internet transit.

## Surviving topology

- At least four sources.
- At least three independent source operators.
- At least two network paths.
- At least two NTS-authenticated sources.
- No more than one unauthenticated network source.
- A local oscillator or equivalent holdover source.
- Three internal time servers across three failure domains.
- Ordinary workloads query internal servers only.
- Orphan/holdover election maintains coherent internal time during upstream loss.

NTS authenticates source identity and packet integrity; it does not eliminate delay attacks or prove physical UTC correctness. Source diversity and bounded root distance remain necessary.

## Clock semantics

- Monotonic time is required for durations, timeouts, retry delays, and elapsed-time measurements.
- Wall-clock time is used for human chronology and expiry only with recorded uncertainty.
- Database ordering, release sequence, and event identity may not be derived solely from wall-clock timestamps.
- Lease duration and certificate validity checks must include the maximum admitted clock-error budget.
- Runtime backward steps are forbidden. Large corrections quarantine the host instead of silently rewriting chronology.

## Initial mechanism

Use chrony on three internal servers. Each server consumes diversified external sources plus a local holdover source, peers with the other internal servers, exports measurements, and can enter orphan mode during upstream loss. Clients consume only the three internal servers.

## Rejected directions

- One cloud metadata clock or provider time service as authority.
- One public NTP pool as the sole source.
- GNSS as the sole source.
- Unauthenticated NTP as the normal source set.
- PTP grandmaster as sole authority without independent validation.
- Backward clock steps on running production nodes.
- Wall clock for durations, lock expiry, ordering, or retry intervals.
- Time servers holding release or recovery keys.
- Boot that requires public DNS, internet reachability, or a live public CA.

## Production evidence

Production admission must be generated from live chrony tracking/source output, source certificates, source/operator/path inventory, oscillator drift measurements, boot-without-network tests, quarantine tests, leap status, root distance, and signed operator evidence. The checked-in inventory is a design fixture, not proof of a deployed time plane.

## Destructive laboratory

1. Deploy three internal servers in independent domains.
2. Configure two NTS sources from independent operators and paths, one independent comparison source, and one holdover oscillator.
3. Measure offset, root distance, and oscillator drift for seven days.
4. Remove one source, one operator, one network path, and then all external sources.
5. Demonstrate coherent 24-hour holdover and bounded uncertainty.
6. Inject a false source and prove majority selection rejects it.
7. Introduce a large local offset and prove the host quarantines.
8. Boot without public DNS and internet access.
9. Test certificate, lease, release-expiry, database, and log behavior near the admitted error boundary.
10. Rebuild the time plane from offline configuration and cached trust material, then sign the evidence with two operators.
