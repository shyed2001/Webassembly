import wasmFactory from './prime_library.js';
const statusDiv = document.getElementById('status');
let wasmModule = null;

statusDiv.textContent = 'Connecting to coordinator...';

// Correctly constructs the WebSocket URL based on the current page's host.
const socket = new WebSocket(`ws://${window.location.host}`); 

socket.onopen = () => {
    statusDiv.textContent = '✅ Connected. Awaiting tasks.';
    socket.send(JSON.stringify({ type: 'registerWorker' }));
};

socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    if (data.type !== 'task') return;

    const { task } = data;
    statusDiv.textContent = `Computing task #${task.taskId}...`;

    try {
        if (!wasmModule) {
            statusDiv.textContent = `Loading WASM Module for task #${task.taskId}...`;
            wasmModule = await wasmFactory();
        }
        
        // This logic assumes you have multiple exported functions in your wasm module,
        // which might not be the case.  If you have a single `count_primes_in_range`
        // function, you should use that instead. I will assume the provided `worker_bootstrap.js`
        // is the more up-to-date implementation, which means you might have a single
        // wasm function. If you're using a single prime counting function, replace
        // the line below with: const functionToCall = 'count_primes_in_range';
        const functionToCall = `worker_func_${task.taskId}`; 
        
        statusDiv.textContent = `Executing C++ for task #${task.taskId}...`;
        
        // Convert the string numbers from the JSON message into BigInts
        const startBigInt = BigInt(task.start);
        const endBigInt = BigInt(task.end);

        // Tell ccall to expect and return a 'bigint'
        const primeCount = wasmModule.ccall(
            functionToCall,
            'bigint', // Return type
            ['bigint', 'bigint'], // Argument types
            [startBigInt, endBigInt] // Arguments
        );
        
        // Convert the BigInt result back to a string for JSON
        socket.send(JSON.stringify({ type: 'result', taskId: task.taskId, count: primeCount.toString() }));
        statusDiv.textContent = '✅ Task complete. Awaiting next task.';

    } catch (error) {
        console.error(`Error executing task ${task.taskId}:`, error);
        statusDiv.textContent = `❌ Error on task #${task.taskId}. Reporting to server.`;
        
        socket.send(JSON.stringify({ type: 'error', taskId: task.taskId, message: error.message }));
    }
};

socket.onclose = () => {
    statusDiv.textContent = '❌ Disconnected from coordinator. Please refresh the page to reconnect.';
};