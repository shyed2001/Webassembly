// File: /public/worker.js
// This script controls the worker page, which performs the actual prime number calculations.

import { config } from './config.js';
import { getClientInfo } from './stats.js';

// --- UI Element Selections ---
const statusDiv = document.getElementById('status');
const workerIdSpan = document.getElementById('worker-id');
const tasksCompletedSpan = document.getElementById('tasks-completed');
const primesFoundSpan = document.getElementById('primes-found');

// --- State Variables ---
let workerId = localStorage.getItem('workerId');
if (!workerId) {
    workerId = 'worker-' + Date.now().toString(36) + Math.random().toString(36).substring(2);
    localStorage.setItem('workerId', workerId);
}
workerIdSpan.textContent = workerId;

let workerSocket;
const computationWorker = new Worker('./computation_worker.js', { type: 'module' });
let myTasksCompleted = 0;
let myPrimesFound = 0n;

function connectWorkerSocket() {
    statusDiv.textContent = 'Connecting to coordinator...';
    workerSocket = new WebSocket(config.WEBSOCKET_URL);

    // --- WebSocket Event Handlers ---

    workerSocket.onopen = () => {
        statusDiv.textContent = '✅ Connected. Awaiting tasks.';
        const clientInfo = getClientInfo();
        workerSocket.send(JSON.stringify({
            type: 'registerWorker',
            workerId: workerId,
            browserInfo: clientInfo.browserInfo,
            cpuCores: clientInfo.cpuCores,
        }));
    };

    // ⬇️ *** THIS IS THE FIX *** ⬇️
    // The server sends a 'ping' every 30 seconds. We must respond with a 'pong'
    // to let the server know this worker is still alive and responsive.
    workerSocket.addEventListener('ping', () => {
        workerSocket.pong();
    });

    workerSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type !== 'task') return;

        const { task } = data;
        statusDiv.textContent = `Computing task #${task.taskId}...`;
        computationWorker.postMessage({ task });
    };

    computationWorker.onmessage = (e) => {
        const { type, taskId, count, message } = e.data;
        if (type === 'error') {
            console.error(`Error in computation worker for task ${taskId}:`, message);
            statusDiv.textContent = `❌ Error on task #${taskId}. Reporting to server.`;
            workerSocket.send(JSON.stringify({ type: 'error', workerId, taskId, message }));
        } else if (type === 'result') {
            myTasksCompleted++;
            myPrimesFound += BigInt(count);
            tasksCompletedSpan.textContent = myTasksCompleted;
            primesFoundSpan.textContent = myPrimesFound.toLocaleString();
            workerSocket.send(JSON.stringify({ type: 'result', workerId, taskId, count }));
            statusDiv.textContent = '✅ Task complete. Awaiting next task.';
        }
    };

    workerSocket.onclose = () => {
        statusDiv.textContent = '❌ Disconnected. Reconnecting in 5 seconds...';
        setTimeout(connectWorkerSocket, 5000);
    };

    workerSocket.onerror = (err) => {
        console.error('WebSocket Error:', err);
        statusDiv.textContent = '❌ Connection Error.';
        workerSocket.close();
    };
}

// --- Initial Execution ---
connectWorkerSocket();