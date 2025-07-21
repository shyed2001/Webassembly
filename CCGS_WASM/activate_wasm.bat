::@echo off

pushd "E:\WebAsswmblyDevelopment\WASM_Emscripten_SDK\emsdk"

:: Update the emsdk repo
call git pull

:: Install the latest version if not already installed
call emsdk install latest

:: Activate the latest version (sets it as default)
call emsdk activate latest

:: Set up environment variables for this session
call emsdk_env.bat
@echo Done
popd

:: The End

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
