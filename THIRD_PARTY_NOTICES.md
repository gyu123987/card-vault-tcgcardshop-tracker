# Third-party materials

The app UI includes **Fredoka One Regular**, copyright 2011 Milena Brandao, distributed under the SIL Open Font License 1.1. The unmodified font and its license are in `public/fonts/`. This is the open font used for the UI and reconstructed card text; it is separate from extracted game artwork.

Game artwork, descriptions, frames, icons, layouts and catalog data are retrieved from each user's locally installed copy of TCG Card Shop Simulator. They are not part of the source distribution. `public/assets/`, `data/` and screenshots under `docs/` are ignored by Git. Do not attach those directories to releases or publish extracted files separately.

Python extraction dependencies are installed from PyPI using `tools/requirements-assets.txt`; they are not vendored in this source repository. The portable Windows release bundles them, retaining package metadata and license files under `runtime/python/Lib/site-packages`. Their own licenses apply. It also bundles unmodified official Node.js and Python runtimes, with their license files under `runtime/node` and `runtime/python`. See the build script for pinned versions and official download URLs.

This project is an unofficial local companion. A source-code license has not yet been selected by the project owner; publishing a repository alone does not grant a general license to reuse its code.
