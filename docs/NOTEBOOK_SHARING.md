# Share one notebook with another Google account

On **My notebooks**, open a notebook's three-dot **Actions** menu, choose **Share notebook…**, enter the collaborator's Google account email and select **Share and send invitation**. The recipient gets editing access: both accounts can view and edit that notebook. Delete remains a separate menu item.

Google sends the Drive invitation with a WiNDS app link in its message. The recipient opens that app link and signs in with the invited account. **Open shared link** on the homepage also accepts the WiNDS link. Signing in does not merge the accounts' private libraries. Shared notebooks show a Shared label. The app also checks for accessible shared notebooks periodically, so discovery in an already-open library can take up to a minute; the invitation link opens directly.

Sign in with the invited account and choose **My notebooks → Open shared from Drive**. The Google Drive dialog lists the shared notebooks WiNDS Notes can already access. Select **Open notebook** beside its name. If the notebook is missing from the list, choose **Choose from Google Drive** and select the shared WiNDS folder or its `Notebook.json` file. Select the additional item if prompted. WiNDS Notes opens the original shared notebook and syncs edits to its existing Drive folder.

## What is shared

Sharing creates one dedicated Drive folder with a `Notebook.json` file. Only the folder receives the named user's `writer` permission. The existing private `WiNDS Notes Workspace.json` and unrelated notebooks are never granted access. No public/anyone permission is created. Other collaborators cannot invite more accounts through the app unless Drive reports `capabilities.canShare`.

The owner can manage or revoke access in that notebook's folder in Google Drive. **Remove from my library** hides the local shared notebook for this account; it does not delete other collaborators' notes or revoke their permissions. Previously downloaded/offline copies cannot be retroactively erased.

The existing `drive.file` scope is retained. Each recipient must be allowed to sign in to the OAuth app and must grant its requested permissions; Google's Testing/test-user restrictions still apply. Organizational Drive policies can also block external sharing. The feature is prepared and tested with mocked Google responses; live Google permission propagation, notification delivery and recipient app authorization still require verification on the deployed OAuth project. If Google does not authorize a shared resource for the app, the app must report the failure rather than expanding scopes or bypassing permissions.

## Editing and recovery

After idle local saving, the app saves outgoing changes locally, reads the current `Notebook.json`, and merges edits by ID before updating that file in Drive. Drive retains each app write as a revision. If two saves overlap, a later sync reads both retained versions and writes their merged edits to the same file. The app periodically prunes older app revisions after it verifies that a newer retained revision contains their edits. Drive may require the owner to clean up versions if an editor cannot remove them.

After upgrading, each editor should refresh, open the original notebook, and let automatic sync run. This migrates older edit files and v54 edit records that their account can still read. Both accounts need Editor access to `Notebook.json`.

Changes to the same object or metadata are ordered by edit timestamp and ID; the last ordered change takes effect. This is eventual synchronization, not a live cursor/character collaboration service or a conflict-free editor for simultaneous changes to the same object. It retains the existing writing-idle safeguards and can take longer on slow connections. Edit history retains earlier values.

Remote page changes invalidate obsolete whole-page undo snapshots so undo cannot erase someone else's new marks. Safe local stroke append undo/redo remains available. Metadata-only sync keeps the existing history. Existing private notebook undo/redo and the Pencil event handlers are unchanged.

Native `.winds-notes` exports remain version 1 and omit collaboration metadata, pending operations and Drive IDs. Importing an exported notebook creates an independent private copy. Account database keys are unchanged. A local notebook ID collision on joining preserves the pre-existing notebook as a separate private copy.

History replay is bounded to 10,000 edit batches, and individual shared documents/uploads are limited to 100 MB. For a notebook that reaches the history limit, export it, import a fresh private copy and share that copy as a new notebook. Initial history replay and large images do not carry a latency guarantee.

## Deploy

Publish the complete release together. The v55 shared sync uses `index.html`, `notebook-sharing.js` and the v55 service worker. The optional Picker uses the key in `google-config.js`. The same feature works on the optional Node host.

Validation covers invitations scoped to one notebook, two independent simulated Google accounts, concurrent added strokes/pages, retry/reload recovery, input deferral, private-backup isolation, safe undo and malformed data. A physical iPad/Apple Pencil and real Google accounts remain deployment/device checks.

## Priority synchronization

Automatic sync checks the currently open shared notebook before private backup and other notebooks. Its durably queued immutable edit batches publish before its normal history poll. An uncertain upload reply is reconciled before another upload attempt. Other shared notebooks rotate one per automatic cycle; new invitations are discovered about once a minute and queued for bounded background opening. Manual Sync notebooks now still checks all shared notebooks. All work retains the existing writing-idle and account guards. See `SYNC_PERFORMANCE.md` for timing limits.


## Recover “File not found” or missing app authorization

A Drive 404 can mean a missing file **or an account/app that lacks access**. The local update opens an access-recovery dialog showing the active Google email and offers:

- **Check access in Google Drive:** open the exact shared folder with the invited account. Ask the owner to grant editor access if needed. If it was deleted, restore it in Drive or use a new sharing copy.
- **Choose shared folder / Choose notebook file:** Google Picker requests access to the specific Drive item. A recipient may need to select the folder and then its `Notebook.json`. After selection, WiNDS Notes briefly retries a failed read of the selected item. If Drive still denies access, the dialog identifies whether the folder or an individual file could not be read.
- **Retry opening notebook:** retry the original invitation after correcting access. Cached failures are cleared; notebook data and pending local edits are retained.
- **Share a new independent copy:** available for an existing local notebook whose sharing failed. It saves a copy with fresh IDs and no old sharing metadata, then asks for an email to create a fresh invitation. The previous notebook and its Drive permissions remain intact; this does not restore the old collaboration history.

Every sharing request now includes `supportsAllDrives=true`, and listings include `includeItemsFromAllDrives=true`. The app checks the current account again after asynchronous authorization. Cancelling or switching accounts disposes the picker and prevents the old request from opening data in another workspace.

### Google Picker configuration for opening from Drive and recovering access

1. Open the Google Cloud project that owns the OAuth Web client in `google-config.js` and **enable Google Picker API**. Drive API must remain enabled.
2. Create a **public browser API key** in that same project. Apply website/referrer restrictions for your deployed origin(s) and the Google Picker origin `https://docs.google.com/*`, following Google's current [Picker setup guide](https://developers.google.com/workspace/drive/picker/guides/web-picker). Restrict API use to Google Picker API (and Drive API if required by your installation).
3. Put that public key in `window.WINDS_GOOGLE_PICKER_API_KEY` in `google-config.js`, then upload the updated file with the app. This is a browser key, **not an OAuth client secret**. In server mode set the public `WINDS_GOOGLE_PICKER_API_KEY` environment variable instead, or keep it in the public configuration file; the server forwards it.
4. The Picker App ID is derived from the numeric project prefix of your OAuth client ID. Use the same project for both. Keep the OAuth audience/test-user settings valid for both collaborators.
5. Open the invitation using its invited account, choose **Authorize this notebook**, select the shown resource, and retry. If Google Drive itself denies access, the owner must correct that permission; Picker cannot grant another person's folder permission.

The key must belong to the Cloud project for your deployment. Without it, the app explains the missing configuration. Real recipient authorization still needs testing with the deployed Google project.

The underlying Google guidance is [Drive error recovery](https://developers.google.com/workspace/drive/api/guides/handle-errors#notFound) and [per-file authorization scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).
