
// File Path: prime_distributed_projectPrlCc1B V5(10K)/public/worker.js
// Filename: worker.js

import wasmFactory from './prime_library.js';
const statusDiv = document.getElementById('status');
let wasmModule = null;

statusDiv.textContent = 'Connecting to coordinator...';

// const socket = new WebSocket('ws://localhost:8080'); // Remember to use your IP 
//192.168.1.107 Lan Ethernet
//192.168.59.244
//192.168.1.106 WiFi
// https://xn05c0cs-8080.asse.devtunnels.ms/
// const socket = new WebSocket('ws://xn05c0cs-8080.asse.devtunnels.ms:8080');
// Remember to use your actual IP address here if testing on other devices
//const socket = new WebSocket('ws://192.168.0.113:8080'); 
// const socket = new WebSocket('ws://DESKTOP-NAF9NIA:8080');
// const socket = new WebSocket('ws://91.99.238.128:8080');
  //const socket = new WebSocket('ws://ccgsc-demo.digitalbd.org/ws'); // Your server URL
    const socket = new WebSocket('wss://ccgsc-demo.digitalbd.org/ws'); // Your server URL
// const socket = new WebSocket('ws://<your-ip-address>:8080');
//const socket = new WebSocket('ws://192.168.1.108:8080');

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



/*

import wasmFactory from './prime_library.js';
const statusDiv = document.getElementById('status');
let wasmModule = null;

statusDiv.textContent = 'Connecting to coordinator...';
// Remember to use your actual IP address here if testing on other devices
// const socket = new WebSocket('ws://localhost:8080'); 
// 192.168.59.244
//192.168.1.107
//192.168.1.106
// const socket = new WebSocket('wss://xn05c0cs-8080.asse.devtunnels.ms:8080'); 
const socket = new WebSocket('ws://192.168.1.106:8080'); 
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

*/