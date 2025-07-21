@echo off

:: Write C source file
echo #include ^<stdio.h^> > test.c
echo int main() ^{ >> test.c
echo     printf("Hello from WASM!\n"); >> test.c
echo     return 0; >> test.c
echo ^} >> test.c

:: Set Emscripten environment (update this path if needed)
call "E:\WebAsswmblyDevelopment\WASM_Emscripten_SDK\emsdk\emsdk_env.bat"

:: Compile the C code to WebAssembly and HTML
call emcc test.c -o test.html

:: Run using emrun
call emrun test.html
