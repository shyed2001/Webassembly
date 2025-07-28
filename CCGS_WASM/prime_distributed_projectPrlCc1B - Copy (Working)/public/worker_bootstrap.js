import wasmFactory from './prime_library.js';

self.onmessage = async (event) => {
    const { workerId, start, end } = event.data;
    
    // Load the WASM module
    const wasmModule = await wasmFactory();

    // The name of the C++ function to call, e.g., "worker_func_0"
    const functionToCall = `worker_func_${workerId}`;

    // Call the assigned C++ function from our library
    const primeCount = wasmModule.ccall(
        functionToCall,
        'number',
        ['number', 'number'],
        [start, end]
    );

    // Send the result back to the main thread
    self.postMessage({ workerId, count: primeCount });
};
