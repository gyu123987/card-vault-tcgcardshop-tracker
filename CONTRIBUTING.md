# Contributing

Open an issue or pull request with a focused change and relevant validation. The source is currently unlicensed; public visibility does not grant a general license to reuse it. Third-party dependencies retain their own licenses.

Run `npm test` and `python -m unittest discover -s tests -p test_asset_setup.py`. For a UI change, check both desktop and narrow layouts. Tests must use fixtures or temporary app-data directories, never write into real game saves.

Never commit extracted game assets, save files, local catalog/history/drafts, unapproved screenshots showing game art or private state, API keys or packaged binaries. Retrieve game content locally from a legally installed game.

## Releases

1. Merge reviewed source changes into `main`.
2. Set `package.json` to a new version and merge that change.
3. Tag that commit `v<version>` and push the tag.
4. The Windows release workflow tests the source, builds the launcher and bundled app, and publishes a ZIP plus SHA-256 checksum.

Merging a PR alone does not update installed apps. The launcher checks the latest published release, offers its download page, and continues offline if GitHub is unavailable. Download and extract the new ZIP, close the old launcher, then run the new EXE. Personal data remains in `%LOCALAPPDATA%\CardVault`; it is not inside the release folder. No GitHub token is embedded or required by end users. Automatic replacement/install is intentionally not performed.

Manual workflow runs produce downloadable build artifacts without publishing a release. The package is currently unsigned. Report reproducible setup problems with Windows/game versions and a redacted error; do not upload your save or extracted artwork.
