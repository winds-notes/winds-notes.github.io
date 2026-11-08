# Synchronization performance — v33

The default pen/Artist size and shape-outline width are now 7. Existing objects keep their stored width. The 2.5-second local-save/cloud-idle interval, 2.4-second ink composition and palm guards, non-passive Touch Events, and missing-pointer recovery remain unchanged. This release improves Drive request ordering while keeping storage, serialization and network work outside input handlers.

## Faster work ordering

Automatic sync checks the open shared notebook first. Its pending changes are saved durably and published as immutable edit files before its normal history lookup. A lost/ambiguous upload reply forces history reconciliation before retry, avoiding duplicate files or strokes. The private workspace then checks the latest remote version before uploading. This read-before-write protection is retained.

Other shared notebooks rotate one per cycle instead of all delaying the next private check. Discovery runs about once per minute, with newly discovered notebooks queued for bounded background opening. Explicit **Sync notebooks now** still checks all shared notebooks. Inactive shared notebooks can take longer than the open notebook; all remain automatically synchronized. Shared discovery errors have separate retry backoff.

## See what completed

Open **Google Drive → Sync details**. The panel shows:

- Drive-only mode or enabled live previews.
- The last successful private-workspace check.
- The last received notebook change and successful upload, including shared notebooks.
- Duration of the last completed synchronization cycle.

Times belong to this tab and account and reset when the account session changes. They are runtime-only information, not telemetry. A cycle duration excludes the initial writing pause and does not measure end-to-end delivery between devices. A received live preview is temporary; successful Drive uploads are the durable path. Other notebooks may still have pending work.

## Controlled comparison

The comparison ran the v32 and v33 cloud modules with separate simulated devices and no BroadcastChannel. Each Drive request took 350 ms. Six unrelated shared-notebook metadata checks were represented as guarded delayed work, while both devices viewed a private notebook. Local saving still waited 2.5 seconds. Three starting phases were measured:

| Poll phase | v32 retrieval | v33 retrieval |
| --- | --- | --- |
| 0 ms | 6.00 s | 3.85 s |
| 250 ms | 5.75 s | 3.60 s |
| 750 ms | 7.80 s | 4.10 s |

These are model results for the request-order improvement, not a guarantee of 3–5 seconds on Google Drive. A small library with no unrelated shared checks has fewer avoidable requests and may see less improvement. The reported nine-second delay has not been measured on the user's devices. Actual network/Google latency, full-workspace size, initial history loading, continued writing and suspended tabs still matter.

The public site checked during this work served v32, with one-second Drive polling and the optional server/live-preview flags disabled. v33 is prepared locally and must be deployed to change that site. Faster temporary visual delivery requires deploying the prepared [live-preview backend](REALTIME_SYNC.md); uploading static files alone does not enable it.

## Useful next feature

Personal brush presets would let a user recall a material, color, width and flow together. They could be selected outside the drawing path and scoped as preferences, while saved strokes retain their own settings. This is a possible follow-up, not included in v33; the added feature in this release is Sync details.
