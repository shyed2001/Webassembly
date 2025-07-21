#!/bin/bash
echo "--- Building C++ Worker Library for WASM ---"
# Ensure Emscripten SDK is active (e.g., source ./emsdk_env.sh)

# Define the list of all C++ functions we need to export to JavaScript.
# The leading underscore is required by Emscripten.
EXPORTED_FUNCTIONS="[ \
'_worker_func_0', \
'_worker_func_1', \
'_worker_func_2', \
'_worker_func_3', \
'_worker_func_4', \
'_worker_func_5', \
'_worker_func_6', \
'_worker_func_7', \
'_worker_func_8', \
'_worker_func_9' \
]"

# Compile all .cpp files from the cpp_src directory into a single WASM module.
# The output will be placed in the public/ directory.
emcc cpp_src/*.cpp \
  -O3 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s EXPORTED_FUNCTIONS="${EXPORTED_FUNCTIONS}" \
  -s EXPORTED_RUNTIME_METHODS='["ccall"]' \
  -o public/prime_library.js

echo "--- Build Complete. Library is in public/prime_library.js ---"