// This script runs in a separate, background Web Worker thread.
// It has no access to the DOM or the 'window' object.
// file prime_distributed_projectPrlCc1B%20V5%2810K%29/public/computation_worker.js
// Import the Emscripten-generated module. 'self' is the global scope in a worker.
import wasmFactory from './prime_library.js';
let wasmModule = null;

// Listen for messages from the main thread (worker.html)
self.onmessage = async (event) => {
    const { task } = event.data;

    try {
        // Load WASM module once
        if (!wasmModule) {
            self.postMessage({ type: 'status', message: `Loading WASM Module for task #${task.taskId}...` });
            wasmModule = await wasmFactory();
        }
        
        const functionToCall = 'count_primes_in_range';
        
        // --- Cooperative Sub-chunking Logic ---
        const rangeStart = BigInt(task.start);
        const rangeEnd = BigInt(task.end);
        const chunkSize = 100000n; // Process 100,000 numbers per chunk.
        let currentStart = rangeStart;
        let totalPrimesInTask = 0n;

        while (currentStart <= rangeEnd) {
            const currentEnd = (currentStart + chunkSize - 1n < rangeEnd) ? currentStart + chunkSize - 1n : rangeEnd;
            
            // Post status update back to the main thread
            self.postMessage({ type: 'status', message: `Computing task #${task.taskId} (chunk: ${currentStart.toLocaleString()} to ${currentEnd.toLocaleString()})...` });

            const chunkPrimeCount = wasmModule.ccall(
                functionToCall,
                'bigint', 
                ['bigint', 'bigint'], 
                [currentStart, currentEnd] 
            );

            totalPrimesInTask += chunkPrimeCount;
            currentStart += chunkSize;

            // Report progress back to the main thread.
            self.postMessage({ type: 'stillWorking', taskId: task.taskId });
            
            // This is now optional but still good practice within a long-running worker.
            await new Promise(resolve => setTimeout(resolve, 0)); 
        }
        // --- End of Sub-chunking Logic ---

        // Send the final result back to the main thread
        self.postMessage({ 
            type: 'result', 
            taskId: task.taskId, 
            count: totalPrimesInTask.toString() 
        });

    } catch (error) {
        console.error(`Error in computation worker for task ${task.taskId}:`, error);
        // Send error details back to the main thread
        self.postMessage({ 
            type: 'error', 
            taskId: task.taskId, 
            message: error.message 
        });
    }
};