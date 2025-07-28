// coordinator_server.js
// This is the main coordinator server for the distributed prime number computation project.
// It manages worker connections, task assignments, and results collection.
// The server uses WebSockets to communicate with workers and a director.
// It handles task distribution, worker management, and result aggregation.

import { WebSocketServer, WebSocket } from 'ws';
import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---
const wss = new WebSocketServer({ port: 8080, host: '0.0.0.0' });
console.log('Coordinator server running on ws://192.168.1.100:8080');

const N = 51200000; // The upper limit for prime number computation
// The total number of tasks to distribute among workers.
const TOTAL_TASKS = 2048; // 1024
// With the new worker architecture, we can use more responsive timeout values.
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const TASK_TIMEOUT = 180000;      // 3 minutes - A worker must send a 'stillWorking' or 'result' message within this time.
const STATE_FILE = path.join(process.cwd(), 'computation_state.json');

// --- STATE VARIABLES ---
let directorSocket = null;
const workers = new Map();
let taskQueue = [];
let results = new Array(TOTAL_TASKS).fill(null);
let isRunning = false;
let computationStartTime = null;

// --- BIGINT-SAFE JSON REPLACER ---
function bigIntReplacer(key, value) {
    return typeof value === 'bigint' ? value.toString() : value;
}

// --- STATE MANAGEMENT ---
function saveState() {
    try {
        const state = { isRunning, computationStartTime, results, taskQueue };
        const stateString = JSON.stringify(state, bigIntReplacer);
        fs.writeFileSync(STATE_FILE, stateString, 'utf8');
    } catch (err) {
        console.error('Error saving state:', err);
    }
}

function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const stateString = fs.readFileSync(STATE_FILE, 'utf8');
            const state = JSON.parse(stateString);
            isRunning = state.isRunning;
            computationStartTime = state.computationStartTime;
            results = state.results;
            taskQueue = state.taskQueue;
            console.log(`[State] Computation state loaded from ${STATE_FILE}`);
        } else {
            console.log('[State] No previous state file found. Starting fresh.');
            initializeTasks();
        }
    } catch (err) {
        console.error('Error loading state, starting fresh:', err);
        initializeTasks();
    }
}

// --- DIRECTOR COMMUNICATION ---
const logToDirector = (message) => {
    if (directorSocket && directorSocket.readyState === WebSocket.OPEN) {
        directorSocket.send(JSON.stringify({ type: 'log', message: `[${new Date().toLocaleTimeString()}] ${message}` }));
    }
};

const updateDirectorProgress = (taskId, count, totalCompleted) => {
    if (directorSocket && directorSocket.readyState === WebSocket.OPEN) {
        directorSocket.send(JSON.stringify({ type: 'progress', taskId, count: count.toString(), totalCompleted }));
    }
};

const updateDirectorWorkerInfo = (workerId, workerInfo) => {
    if (directorSocket && directorSocket.readyState === WebSocket.OPEN) {
        const message = JSON.stringify({ type: 'workerUpdate', workerId, workerInfo }, bigIntReplacer);
        directorSocket.send(message);
    }
};

// --- CORE LOGIC ---
function initializeTasks() {
    taskQueue.length = 0;
    results = new Array(TOTAL_TASKS).fill(null);
    const chunkSize = Math.floor(N / TOTAL_TASKS);
    for (let i = 0; i < TOTAL_TASKS; i++) {
        const start = i * chunkSize + 1;
        const end = (i === TOTAL_TASKS - 1) ? N : (i + 1) * chunkSize;
        taskQueue.push({ taskId: i, start: (i === 0 ? 2 : start), end });
    }
    console.log(`[Coordinator] Task queue initialized.`);
}

function assignTaskToAvailableWorker() {
    if (!isRunning || taskQueue.length === 0) return;
    for (const [workerId, workerData] of workers.entries()) {
        if (workerData.ws.readyState === WebSocket.OPEN && !workerData.isBusy) {
            const task = taskQueue.shift();
            if (task) {
                workerData.isBusy = true;
                workerData.assignedTask = task;
                workerData.taskAssignedTime = Date.now();
                workerData.ws.send(JSON.stringify({ type: 'task', task }));
                logToDirector(`Assigned task ${task.taskId} to worker ${workerId.substring(0, 8)}...`);
                updateDirectorWorkerInfo(workerId, { ...workerData, status: 'Busy', currentTask: task.taskId });
                saveState();
                return;
            }
        }
    }
}

// --- HEARTBEAT & TIMEOUT INTERVAL ---
setInterval(() => {
    wss.clients.forEach(ws => {
        if (ws.isAlive === false) {
            console.log(`[Heartbeat] Terminating unresponsive worker: ${ws.workerId}`);
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });

    if (isRunning) {
        workers.forEach((workerData, workerId) => {
            if (workerData.isBusy && (Date.now() - workerData.taskAssignedTime > TASK_TIMEOUT)) {
                logToDirector(`Worker ${workerId.substring(0, 8)} timed out on task ${workerData.assignedTask.taskId}. Re-queuing.`);
                console.log(`[Timeout] Worker ${workerId} timed out.`);
                if (workerData.assignedTask) taskQueue.unshift(workerData.assignedTask);
                workerData.isBusy = false;
                workerData.assignedTask = null;
                workerData.taskAssignedTime = null;
                updateDirectorWorkerInfo(workerId, { ...workerData, status: 'Idle (Timed Out)', currentTask: null });
                saveState();
                assignTaskToAvailableWorker();
            }
        });
    }
}, HEARTBEAT_INTERVAL);

// --- WEBSOCKET CONNECTION HANDLING ---
wss.on('connection', ws => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', message => {
        const data = JSON.parse(message);
        switch (data.type) {
            case 'registerDirector':
                directorSocket = ws;
                ws.type = 'director';
                logToDirector('👑 Director connected. Syncing state...');
                const statePayload = {
                    type: 'fullState',
                    results: results,
                    workers: Array.from(workers.entries()).map(([id, worker]) => {
                        const { ws, ...workerInfo } = worker;
                        return [id, workerInfo];
                    })
                };
                directorSocket.send(JSON.stringify(statePayload, bigIntReplacer));
                break;

            case 'registerWorker':
                const workerId = data.workerId;
                if (!workerId) return ws.close();
                ws.workerId = workerId;
                ws.type = 'worker';
                const newWorkerData = {
                    ws, isBusy: false, assignedTask: null, taskAssignedTime: null,
                    stats: { tasksCompleted: 0, primesFound: 0n, lastTaskTime: null },
                    browserInfo: data.browserInfo || 'Unknown', status: 'Idle', currentTask: null
                };
                workers.set(workerId, newWorkerData);
                logToDirector(`Worker ${workerId.substring(0, 8)} connected. Total: ${workers.size}`);
                updateDirectorWorkerInfo(workerId, newWorkerData);
                assignTaskToAvailableWorker();
                break;

            case 'startComputation':
                if (isRunning) return logToDirector('Computation already running.');
                isRunning = true;
                computationStartTime = Date.now();
                initializeTasks();
                workers.forEach(worker => {
                    worker.stats = { tasksCompleted: 0, primesFound: 0n, lastTaskTime: null };
                });
                logToDirector(`Starting new computation...`);
                saveState();
                workers.forEach(() => assignTaskToAvailableWorker());
                break;
            
            // --- NEW: Handle progress updates from workers ---
            case 'stillWorking':
                const activeWorker = workers.get(data.workerId);
                if (activeWorker && activeWorker.isBusy) {
                    // Reset the timeout timer because we know the worker is alive.
                    activeWorker.taskAssignedTime = Date.now();
                }
                break;

            case 'result':
                const worker = workers.get(data.workerId);
                if (!worker || !worker.assignedTask || worker.assignedTask.taskId !== data.taskId) return;

                const primeCount = BigInt(data.count);
                results[data.taskId] = primeCount.toString();
                worker.stats.tasksCompleted++;
                worker.stats.primesFound += primeCount;
                worker.stats.lastTaskTime = Date.now();
                worker.isBusy = false;
                worker.assignedTask = null;
                worker.taskAssignedTime = null;
                const completedTotal = results.filter(r => r !== null).length;
                
                updateDirectorProgress(data.taskId, primeCount, completedTotal);
                updateDirectorWorkerInfo(data.workerId, { ...worker, status: 'Idle', currentTask: null });
                saveState();

                if (completedTotal === TOTAL_TASKS) {
                    isRunning = false;
                    saveState();
                    const totalPrimes = results.reduce((sum, count) => sum + BigInt(count || 0), 0n);
                    logToDirector(`🎉 ALL TASKS COMPLETE! Final Total: ${totalPrimes.toLocaleString()}`);
                } else {
                    assignTaskToAvailableWorker();
                }
                break;
            
            case 'error':
                const errorWorker = workers.get(data.workerId);
                if (!errorWorker || !errorWorker.assignedTask) return;
                
                logToDirector(`Worker ${data.workerId.substring(0,8)}... error on task ${errorWorker.assignedTask.taskId}. Re-queuing.`);
                taskQueue.unshift(errorWorker.assignedTask);
                errorWorker.isBusy = false;
                errorWorker.assignedTask = null;
                updateDirectorWorkerInfo(data.workerId, { ...errorWorker, status: 'Error', currentTask: null });
                saveState();
                assignTaskToAvailableWorker();
                break;
        }
    });

    ws.on('close', () => {
        if (ws.type === 'director') {
            directorSocket = null;
            console.log('Director disconnected.');
        } else if (ws.type === 'worker' && ws.workerId) {
            const workerData = workers.get(ws.workerId);
            if (workerData && workerData.assignedTask) {
                logToDirector(`Worker ${ws.workerId.substring(0, 8)} disconnected. Re-queuing task ${workerData.assignedTask.taskId}.`);
                taskQueue.unshift(workerData.assignedTask);
                saveState();
            }
            workers.delete(ws.workerId);
            if (directorSocket) directorSocket.send(JSON.stringify({ type: 'workerRemoved', workerId: ws.workerId }));
            assignTaskToAvailableWorker();
        }
    });
});

// --- INITIALIZATION ---
loadState();