// client.js (Improved Version)
import wasmFactory from './prime_library.js';

const log = (message) => document.getElementById('log').textContent += message + '\n';
const directorBtn = document.getElementById('director-btn');
const statusDiv = document.getElementById('status');

let wasmModule = null;
let isDirector = false;
let peerConnections = {};
let taskQueue = [];
let results = [];
let totalPrimes = 0;
let startTime = 0;

const N = 100_000_000;
const TOTAL_TASKS = 10;

log('Connecting to signaling server...');
const socket = new WebSocket('ws://localhost:8080');

// --- Main Connection and Role Assignment Logic ---
socket.onopen = () => {
    log('✅ Connected to signaling server. Determining role...');
    // The server will automatically tell us if a director exists.
};

socket.onmessage = async (event) => {
    const message = JSON.parse(event.data);

    switch (message.type) {
        case 'directorExists':
            // The server told us a director is already active. We are a worker.
            becomeWorker();
            break;
        case 'offer':
            // WebRTC signaling from the Director
            await handleOffer(message.offer, message.from);
            break;
        // ... other WebRTC cases like 'answer', 'candidate' ...
    }
};

function becomeDirector() {
    isDirector = true;
    directorBtn.style.display = 'none'; // Hide the button
    statusDiv.textContent = '👑 You are the Director. Waiting for workers to connect.';
    startTime = performance.now();
    
    // Announce to the server that we are the director
    socket.send(JSON.stringify({ type: 'iamDirector' }));

    // Create the task queue
    const chunkSize = Math.floor(N / TOTAL_TASKS);
    for (let i = 0; i < TOTAL_TASKS; i++) {
        const start = i * chunkSize + 1;
        const end = (i === TOTAL_TASKS - 1) ? N : (i + 1) * chunkSize;
        taskQueue.push({ taskId: i, start, end });
    }
    log(`Task queue created with ${taskQueue.length} tasks.`);
}

function becomeWorker() {
    isDirector = false;
    directorBtn.style.display = 'none'; // Hide the button
    statusDiv.textContent = '💪 You are a Worker. Awaiting tasks from the Director.';
    // Worker logic is passive, it just waits for WebRTC offers and data channels.
}

directorBtn.onclick = becomeDirector;

// --- Worker Logic ---
async function handleTask(event) {
    const task = JSON.parse(event.data);
    log(`Received task for worker function ${task.taskId}`);
    if (!wasmModule) wasmModule = await wasmFactory();
    
    const primeCount = wasmModule.ccall(`worker_func_${task.taskId}`, 'number', ['number', 'number'], [task.start, task.end]);
    
    event.target.send(JSON.stringify({ type: 'result', taskId: task.taskId, count: primeCount }));
}

// ... All other Director and WebRTC functions (assignTaskToAvailableWorker, createPeerConnection, etc.) remain the same...