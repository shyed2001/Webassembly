import wasmFactory from './prime_library.js';
const statusDiv = document.getElementById('status');
let wasmModule = null;

statusDiv.textContent = 'Connecting to coordinator...';
// Remember to use your actual IP address here if testing on other devices
// const socket = new WebSocket('ws://localhost:8080'); 
// 192.168.59.244
//192.168.1.107
const socket = new WebSocket('ws://192.168.1.107:8080'); 
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
        
        const functionToCall = `worker_func_${task.taskId}`;
        
        statusDiv.textContent = `Executing C++ for task #${task.taskId}...`;
        
        const primeCount = wasmModule.ccall(
            functionToCall,
            'number',
            ['number', 'number'],
            [task.start, task.end]
        );
        
        socket.send(JSON.stringify({ type: 'result', taskId: task.taskId, count: primeCount }));
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
