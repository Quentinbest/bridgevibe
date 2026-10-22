#!/bin/sh
# US-41.2 / F2: rebuilds src/analysis/macroxue/ from macroxue/bridge-solver at a pinned commit.
# Needs emscripten (EMSCRIPTEN_VERSION below; macroxue notes 6.0.5-6.0.10 are broken) and .reference-solvers/bridge-solver at COMMIT.
# Run from the repository root, outside the sandbox: sh scripts/solver/build-macroxue.sh
set -eu
COMMIT=630705d97bc9205b7310ce6cecafbfb031b289e6
EMSCRIPTEN_VERSION=5.0.7
SRC=.reference-solvers/bridge-solver
OUT=src/analysis/macroxue
test "$(git -C "$SRC" rev-parse HEAD)" = "$COMMIT" || { echo "macroxue must be at $COMMIT" >&2; exit 1; }
emcc --version | head -n1 | grep -q " $EMSCRIPTEN_VERSION[ -]" || { echo "emscripten $EMSCRIPTEN_VERSION required" >&2; exit 1; }
mkdir -p "$OUT"
# No SIMD and no PGO: one binary for every browser, reproducible from source alone.
# STANDALONE_WASM: no Emscripten JS loader, so no fetch/XHR fallbacks ship (LR-3c, #37); the adapter
# instantiates the bytes itself and stubs the WASI imports.
rm -f "$OUT/solver.mjs"
emcc -std=c++17 -O3 -I "$SRC" scripts/solver/macroxue-bindings.cc "$SRC/solver.cc" -o "$OUT/solver.wasm" \
  -sSTANDALONE_WASM=1 --no-entry -sALLOW_MEMORY_GROWTH=1 -sEXPORTED_FUNCTIONS=_bv_table,_bv_position,_malloc,_free \
  -ffile-prefix-map="$PWD"=. -fdebug-prefix-map="$PWD"=.
cp "$SRC/LICENSE-MIT" "$SRC/LICENSE-APACHE" "$OUT/"
printf '%s\n' "macroxue/bridge-solver $COMMIT, emscripten $EMSCRIPTEN_VERSION" > "$OUT/VERSION"
