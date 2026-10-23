#!/bin/sh
# US-41.2 / F2 (#63): rebuilds src/analysis/dds31/ from DDS v3.1.0 at a pinned commit, single-threaded.
# Needs emscripten (EMSCRIPTEN_VERSION below) and .reference-solvers/dds at COMMIT
# (git clone --depth 1 --branch v3.1.0 https://github.com/dds-bridge/dds.git .reference-solvers/dds).
# Run from the repository root, outside the sandbox: sh scripts/solver/build-dds31.sh
# The threaded build (pthreads, COOP/COEP) is #82.
set -eu
COMMIT=fe6a6581a13535779eda5d9141aa704b3f6c8965
EMSCRIPTEN_VERSION=5.0.7
SRC=.reference-solvers/dds
OUT=src/analysis/dds31
test "$(git -C "$SRC" rev-parse HEAD)" = "$COMMIT" || { echo "DDS must be at $COMMIT (v3.1.0)" >&2; exit 1; }
emcc --version | head -n1 | grep -q " $EMSCRIPTEN_VERSION[ -]" || { echo "emscripten $EMSCRIPTEN_VERSION required" >&2; exit 1; }
mkdir -p "$OUT"
# STANDALONE_WASM: no Emscripten JS loader, so no fetch/XHR or worker code ships (LR-3c, #37).
# SetMaxThreads(1) in bv_init keeps DDS on one solver context; nothing links pthreads.
SOURCES=$(find "$SRC/library/src" -name '*.cpp' | grep -v -i test | LC_ALL=C sort)
INCLUDES=$(find "$SRC/library/src" -type d | LC_ALL=C sort | sed 's|^|-I |')
# shellcheck disable=SC2086
emcc -std=c++20 -O3 -fexceptions -fwasm-exceptions $INCLUDES -I "$SRC" scripts/solver/dds31-bindings.cc $SOURCES \
  -o "$OUT/dds31.wasm" -sSTANDALONE_WASM=1 --no-entry -sALLOW_MEMORY_GROWTH=1 -sSTACK_SIZE=1048576 -sINITIAL_MEMORY=67108864 \
  -sEXPORTED_FUNCTIONS=_bv_init,_bv_table,_bv_solve,_malloc,_free -ffile-prefix-map="$PWD"=. -fdebug-prefix-map="$PWD"=.
cp "$SRC/LICENSE" "$OUT/LICENSE"
printf '%s\n' "dds-bridge/dds v3.1.0 $COMMIT, emscripten $EMSCRIPTEN_VERSION, single-threaded" > "$OUT/VERSION"
