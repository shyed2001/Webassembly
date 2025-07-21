// public/client.js (Improved Version)
import wasmFactory from './prime_library.js';

const log = (message) => document.getElementById('log').textContent += message + '\n';
const directorBtn = document.getElementById('director-btn');

let isDirector = false;
let wasmModule = null;
const peers = {}; // { peerId: { connection, dataChannel, isBusy } }
const N = 100_000_000;
const TOTAL_TASKS = 10;
let taskQueue = [];
let results = [];
let totalPrimes = 0;
let startTime = 0;

// Connect to the signaling server (same as before)
const socket = new WebSocket('ws://localhost:8080');
socket.onopen = () => log('✅ Connected to signaling server.');
// ... The rest of the WebSocket and WebRTC signaling logic remains the same ...

// --- Role Selection & Task Initialization ---
directorBtn.onclick = () => {
    isDirector = true;
    directorBtn.disabled = true;
    startTime = performance.now();
    log('👑 You are the Director. Initializing tasks...');

    // Create the queue of all 10 tasks
    const chunkSize = Math.floor(N / TOTAL_TASKS);
    for (let i = 0; i < TOTAL_TASKS; i++) {
        const start = i * chunkSize + 1;
        const end = (i === TOTAL_TASKS - 1) ? N : (i + 1) * chunkSize;
        taskQueue.push({ taskId: i, start, end });
    }
    log(`Task queue created with ${taskQueue.length} tasks.`);
};

// --- Main Director Logic ---
function assignTaskToAvailableWorker() {
    if (taskQueue.length === 0) return; // No tasks left

    for (const peerId in peers) {
        const peer = peers[peerId];
        if (peer && !peer.isBusy) {
            const task = taskQueue.shift(); // Get the next task from the queue
            if (task) {
                peer.isBusy = true;
                peer.dataChannel.send(JSON.stringify(task));
                log(`Assigning task ${task.taskId} to a worker...`);
            }
            break; // Stop after assigning one task
        }
    }
}

// --- WebRTC Data Channel Handling ---
function setupDataChannel(peerId, dataChannel) {
    peers[peerId].dataChannel = dataChannel;
    peers[peerId].isBusy = false;

    dataChannel.onopen = () => {
        log(`Data channel open with a new worker. Trying to assign a task.`);
        assignTaskToAvailableWorker();
    };

    dataChannel.onmessage = (event) => {
        const result = JSON.parse(event.data);
        totalPrimes += result.count;
        results[result.taskId] = result.count;
        log(`Received result for task ${result.taskId}. Count: ${result.count}`);
        
        peers[peerId].isBusy = false; // Mark this worker as free
        
        if (taskQueue.length > 0) {
            assignTaskToAvailableWorker(); // Assign the next task
        } else if (results.filter(r => r !== undefined).length === TOTAL_TASKS) {
            // All tasks are done
            const duration = ((performance.now() - startTime) / 1000).toFixed(2);
            log(`\n🎉 --- ALL TASKS COMPLETE --- 🎉`);
            log(`Total primes found: ${totalPrimes.toLocaleString()}`);
            log(`Time taken: ${duration} seconds.`);
        }
    };
}

// --- Worker Logic ---
async function handleTask(event) {
    const task = JSON.parse(event.data);
    log(`Received task for worker function ${task.taskId}`);

    // Load WASM if not already loaded
    if (!wasmModule) wasmModule = await wasmFactory();
    
    // Call the specific C++ function based on the task's ID
    const primeCount = wasmModule.ccall(`worker_func_${task.taskId}`, 'number', ['number', 'number'], [task.start, task.end]);
    
    // Send the result back, including the taskId
    event.target.send(JSON.stringify({ type: 'result', taskId: task.taskId, count: primeCount }));
}

// Simplified WebRTC connection setup function
async function createPeerConnection(peerId) {
    // ... same as before ...
    if (isDirector) {
        const dataChannel = peerConnection.createDataChannel('tasks');
        setupDataChannel(peerId, dataChannel); // Use the new setup function
    } else {
        peerConnection.ondatachannel = event => {
            const dataChannel = event.channel;
            dataChannel.onmessage = handleTask;
        };
    }
    // ... rest of the signaling logic ...
}