# Security review — 7 November 2026

Reviewed the local WiNDS Notes workspace through v55 and prepared v56 fixes. This is a source review with targeted local tests. Live Google authorization, Cloud Console settings, hosting configuration, and a physical iPad were outside the verification scope.

The review covered the custom browser code, Google authorization and storage, notebook sharing and revisions, backend and relay, development server, service worker, deployment files, tests, bundled dependencies, and existing release archives. The inventory included 645 non-archive files and 31 existing ZIP archives containing 5,588 entries. Vendored binary assets were checked against the published package, rather than manually audited as executable source.

## Verified findings and fixes

| Finding | Severity and conditions | v56 result |
| --- | --- | --- |
| Development server accepted arbitrary Host headers and served private project files | Medium. While the local server is running, a DNS rebinding attack could read project files through the browser. A synthetic dotfile returned HTTP 200 under an attacker Host header. | Rejects unexpected hosts and origins, hidden files, credential file extensions, and symlinks into private or external paths. The same canary requests return HTTP 403. |
| Drive response size was checked after buffering | Medium availability risk. A shared file with a very large response and no Content-Length could exhaust browser memory before the advertised limit was enforced. | Browser fetch streams are byte-counted while reading and cancelled above 100 MB. The same reader covers private workspaces, backup restoration, shared content, and JSON metadata. Writing/account guards run between reads. The compatibility path for response objects without streams retains its post-read limit. |
| Backend asset checks did not resolve symlinks | Low, with a deployment prerequisite. A symlink planted in an allowed asset directory could expose a private file outside that directory. | Checks both the requested path and its resolved target against the public asset policy. Canary targets outside the site and private paths are blocked. |

Additional hardening adds backend frame blocking, a limited Content Security Policy for objects, base URLs and forms, an explicit PDF scripting-disable option, and Git ignore rules for private key and encrypted-session file extensions. The backend CSP is intentionally limited. It is not a complete script-source policy.

## Checks completed

- Google OAuth uses PKCE and state validation. Backend sessions use HttpOnly cookies, Secure on HTTPS, SameSite=Lax, encrypted storage, and explicit account selection. Existing tests cover logout, cross-account requests, revocation and refresh races.
- The live relay checks authenticated account and folder permissions, origin, packet size, rate and stream limits. Browser and shared-file data use native object validation. The review did not establish a working cross-account read or script-injection exploit in those paths.
- Pattern scans found no private keys or recognizable live Google/GitHub/AWS credentials in the checked files and archive entries. This is a pattern scan, not proof that every possible credential format is absent. The Google browser API key and OAuth client ID are intentional public configuration.
- Mozilla PDF.js 6.5.438 matches the official npm package. The tarball integrity was verified, and 205 vendored files match exactly. The only unmapped asset was a macOS .DS_Store file. The bundled version is newer than the patched versions listed in the reviewed advisories. [PDF.js releases](https://github.com/mozilla/pdf.js/releases) · [Published advisories](https://github.com/mozilla/pdf.js/security/advisories)
- There are no npm application dependencies declared in package.json. The bundled PDF runtime was verified separately.
- Targeted HTTP tests reproduced the old development-server behavior and verified the patched behavior. Stream tests cover oversized bodies, split UTF-8 characters and input-resumption cancellation. The full project checks and the two-account browser test were run after the fixes.

## Items needing deployment or account verification

- Verify the Google browser key's website and API restrictions in Google Cloud Console. Source code cannot establish those settings. [Google Picker key restrictions](https://developers.google.com/workspace/drive/picker/guides/web-picker)
- This machine reports Node.js 24.2.0, which predates later published Node security updates. Use a current patched supported Node release for backend hosting. The live host's runtime version was not verified. [Node security releases](https://nodejs.org/en/blog/vulnerability)
- Static GitHub Pages mode retains short-lived Drive access tokens in browser storage to support reopening tabs. An origin-level script compromise could read those tokens. Backend mode protects the persistent session cookie with HttpOnly, although the running app still receives short-lived Google access credentials.
- Notebook data remains locally available after sign-out and is not application-encrypted. Device/browser users with access to that profile can access local notebook storage.
- The new backend framing headers apply when running the Node server. GitHub Pages needs hosting support for equivalent response headers. A complete Google-compatible script CSP and live OAuth/Picker tests remain deployment work.
- Large files, retained Drive revisions and complex image/PDF input can still require substantial memory and processing within the supported limits. This review does not establish resistance to every resource-exhaustion input.

Deploy the complete v56 release together. Older ZIP releases retain their original code. Confirm Google sign-in, Picker, shared editing and PDF import on the deployed origin after updating.
