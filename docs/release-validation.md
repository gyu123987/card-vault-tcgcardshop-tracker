# Windows 0.1.0 validation

Validated on the development Windows PC using a fresh extraction of the portable ZIP and a new, isolated `CARD_VAULT_HOME` directory. No developer Node/Python executable was used by the packaged launcher. This is not a separate clean Windows VM or a claim of compatibility with every setup.

- Launcher starts and detects the installed Steam game and default save directory.
- First-run Retrieve action exports 6,872 variants and 435 images, with zero reported extraction errors.
- Open action starts bundled Node on loopback and opens the default browser.
- Collection loads counts, prices and reconstructed artwork from the retrieved cache.
- A new draft can be built, saved and recovered after reloading.
- Four copies per card and the 50-card deck limit disable further additions.
- Deselect/reassign variants works; nested card preview opens at the top and returns to the original selector.
- A full 50-card draft saves and produces a game deck code. Importing that code into the actual game has not been tested in this run.
- Owned-threshold filtering, clickable collection tags, viewport-bounded filter/grade popovers, and graded candidate-copy forecasts were checked in the browser.
- 54 Node tests and 2 Python setup tests pass.
- ZIP audit excludes game assets, private app data and Python bytecode caches. Source files in the final ZIP are checked against the workspace.

Windows screenshot capture for the native launcher timed out; its controls, progress log and Open/Retrieve actions were verified through Windows accessibility and keyboard input. Browser rendering was visually inspected. The package is unsigned.

GitHub-hosted Windows tests and the clean package build passed. The v0.1.0 tag successfully published the ZIP and SHA-256 file. The actual published download passed checksum verification and a private-content audit. The offline/no-release update path was exercised without preventing local use. A notification for a newer-than-installed version requires a future release to validate end to end.
