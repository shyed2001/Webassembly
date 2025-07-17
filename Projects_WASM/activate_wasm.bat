@echo off
pushd "E:\WebAsswmblyDevelopment\WASM_Emscripten_SDK\emsdk"
call emsdk activate latest
call emsdk_env.bat
popd


::
REM

goto :EOF

:CommentBlock
This is a block comment
It explains the purpose of the script
and provides additional details
@echo off
set ORIG_DIR=%cd%
cd /d "E:\WebAsswmblyDevelopment\WASM_Emscripten_SDK\emsdk"
call emsdk activate latest
call emsdk_env.bat
cd /d "%ORIG_DIR%"
