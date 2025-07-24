@echo off
echo --- Building C++ Worker Library for WASM (with BigInt support) ---

set CXX_SOURCES=^
 cpp_src\worker_func_0.cpp ^
 cpp_src\worker_func_1.cpp ^
 cpp_src\worker_func_2.cpp ^
 cpp_src\worker_func_3.cpp ^
 cpp_src\worker_func_4.cpp ^
 cpp_src\worker_func_5.cpp ^
 cpp_src\worker_func_6.cpp ^
 cpp_src\worker_func_7.cpp ^
 cpp_src\worker_func_8.cpp ^
 cpp_src\worker_func_9.cpp

set EXPORTED_FUNCTIONS="['_worker_func_0','_worker_func_1','_worker_func_2','_worker_func_3','_worker_func_4','_worker_func_5','_worker_func_6','_worker_func_7','_worker_func_8','_worker_func_9']"

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

REM --- Building C++ Worker Library for WASM ---
@echo off
echo --- Building C++ Worker Library for WASM ---



::
REM

goto :EOF

:CommentBlock

:: Comment all lines below 

REM This script must be run from an Emscripten command prompt.

REM We explicitly list all .cpp files because cmd.exe does not expand the wildcard *.
set CXX_SOURCES=^
 cpp_src\worker_func_0.cpp ^
 cpp_src\worker_func_1.cpp ^
 cpp_src\worker_func_2.cpp ^
 cpp_src\worker_func_3.cpp ^
 cpp_src\worker_func_4.cpp ^
 cpp_src\worker_func_5.cpp ^
 cpp_src\worker_func_6.cpp ^
 cpp_src\worker_func_7.cpp ^
 cpp_src\worker_func_8.cpp ^
 cpp_src\worker_func_9.cpp

REM Define the list of all C++ functions to export.
set EXPORTED_FUNCTIONS="['_worker_func_0','_worker_func_1','_worker_func_2','_worker_func_3','_worker_func_4','_worker_func_5','_worker_func_6','_worker_func_7','_worker_func_8','_worker_func_9']"

REM Compile all the specified .cpp files into a single WASM module.
emcc %CXX_SOURCES% ^
  -O3 ^
  -s WASM=1 ^
  -s MODULARIZE=1 ^
  -s EXPORT_ES6=1 ^
  -s EXPORTED_FUNCTIONS=%EXPORTED_FUNCTIONS% ^
  -s EXPORTED_RUNTIME_METHODS="['ccall']" ^
  -o public/prime_library.js

echo --- Build Complete. Library is in public/prime_library.js ---