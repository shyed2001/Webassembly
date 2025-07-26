@echo off
echo --- Building C++ Worker Library for WASM (with BigInt support) ---

set CXX_SOURCES=cpp_src\prime_worker.cpp

set EXPORTED_FUNCTIONS="['_count_primes_in_range']"

emcc %CXX_SOURCES% ^
    -O3 ^
    -s WASM=1 ^
    -s MODULARIZE=1 ^
    -s EXPORT_ES6=1 ^
    -s EXPORTED_FUNCTIONS=%EXPORTED_FUNCTIONS% ^
    -s EXPORTED_RUNTIME_METHODS="['ccall']" ^
    -sWASM_BIGINT ^
    -o public/prime_library.js

echo --- Build Complete. Library is in public/prime_library.js ---