
import wasmFactory from './prime_library.js';
const statusDiv = document.getElementById('status');
let wasmModule = null;

statusDiv.textContent = 'Connecting to coordinator...';
const socket = new WebSocket('ws://localhost:8080');

socket.onopen = () => {
    statusDiv.textContent = '✅ Connected. Awaiting tasks.';
    socket.send(JSON.stringify({ type: 'registerWorker' }));
};

socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'task') {
        const { task } = data;
        statusDiv.textContent = `Computing task #${task.taskId}...`;

        if (!wasmModule) wasmModule = await wasmFactory();
        
        const primeCount = wasmModule.ccall(`worker_func_${task.taskId}`, 'number', ['number', 'number'], [task.start, task.end]);
        
        socket.send(JSON.stringify({ type: 'result', taskId: task.taskId, count: primeCount }));
        statusDiv.textContent = '✅ Task complete. Awaiting next task.';
    }
};

socket.onclose = () => {
    statusDiv.textContent = '❌ Disconnected from coordinator.';
};