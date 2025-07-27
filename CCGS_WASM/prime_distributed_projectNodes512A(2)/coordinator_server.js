// coordinator_server.js
// This is the main coordinator server for the distributed prime number computation project.


// It manages worker connections, task assignments, and results collection.// The server uses WebSockets to communicate with workers and a director.
// It handles task distribution, worker management, and result aggregation.
// The server is designed to run on a Windows machine with a specific IP address.


// coordinator_server.js
import { WebSocketServer, WebSocket } from 'ws';

// Explicitly bind to '0.0.0.0' to accept connections from all network interfaces
const wss = new WebSocketServer({ port: 8080, host: '0.0.0.0' });
console.log('Coordinator server running on ws://192.168.1.100:8080');
console.log('Ensure Windows Firewall allows connections on port 8080.');

const N = 5120000000;
const TOTAL_TASKS = 512;
const HEARTBEAT_INTERVAL = 30000; // Check worker health every 30 seconds
const TASK_TIMEOUT = 240000;      // Re-queue task if not done in 4 minutes

let directorSocket = null;
const workers = new Map();
const taskQueue = [];
let results = [];
let isRunning = false;
let computationStartTime = null;

function logToDirector(message) {
    if (directorSocket && directorSocket.readyState === WebSocket.OPEN) {
        directorSocket.send(JSON.stringify({ type: 'log', message: `[${new Date().toLocaleTimeString()}] ${message}` }));
    }
}

function updateDirectorProgress(taskId, count, totalCompleted) {
    if (directorSocket && directorSocket.readyState === WebSocket.OPEN) {
        directorSocket.send(JSON.stringify({ type: 'progress', taskId, count: count.toString(), totalCompleted }));
    }
}

function updateDirectorWorkerInfo(workerId, workerInfo) {
    if (directorSocket && directorSocket.readyState === WebSocket.OPEN) {
        const infoToSend = JSON.parse(JSON.stringify(workerInfo, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));
        directorSocket.send(JSON.stringify({ type: 'workerUpdate', workerId, workerInfo: infoToSend }));
    }
}

function notifyDirectorComplete(totalPrimes) {
    if (directorSocket && directorSocket.readyState === WebSocket.OPEN) {
        directorSocket.send(JSON.stringify({ type: 'complete', totalPrimes: totalPrimes.toString() }));
    }
}

function initializeTasks() {
    taskQueue.length = 0;
    results = new Array(TOTAL_TASKS).fill(null);
    const chunkSize = Math.floor(N / TOTAL_TASKS);

    for (let i = 0; i < TOTAL_TASKS; i++) {
        const start = i * chunkSize + 1;
        const effectiveStart = (i === 0 && start === 1) ? 2 : start;
        const end = (i === TOTAL_TASKS - 1) ? N : (i + 1) * chunkSize;
        taskQueue.push({ taskId: i, start: effectiveStart, end });
    }
    logToDirector(`Task queue created with ${taskQueue.length} tasks.`);
    console.log(`[Coordinator] Task queue initialized: ${taskQueue.length} tasks.`);
}

function assignTaskToAvailableWorker() {
    if (taskQueue.length === 0) return;

    for (const [workerId, workerData] of workers.entries()) {
        if (workerData.ws.readyState === WebSocket.OPEN && !workerData.isBusy) {
            const task = taskQueue.shift();
            if (task) {
                workerData.isBusy = true;
                workerData.assignedTask = task;
                workerData.taskAssignedTime = Date.now(); // Start timeout timer
                workerData.ws.send(JSON.stringify({ type: 'task', task }));
                logToDirector(`Assigned task ${task.taskId} to worker ${workerId.substring(0, 8)}...`);
                updateDirectorWorkerInfo(workerId, {
                    status: 'Busy',
                    currentTask: task.taskId,
                    stats: workerData.stats,
                    browserInfo: workerData.browserInfo
                });
                return; // Assign one task at a time
            }
        }
    }
}

// --- HEARTBEAT AND TIMEOUT LOGIC ---
setInterval(() => {
    // 1. Check for unresponsive connections
    wss.clients.forEach(ws => {
        if (ws.isAlive === false) {
            console.log(`[Heartbeat] Terminating unresponsive worker: ${ws.workerId}`);
            return ws.terminate(); // This will trigger the 'close' event for cleanup
        }
        ws.isAlive = false;
        ws.ping();
    });

    // 2. Check for stuck tasks on responsive workers
    if (isRunning) {
        workers.forEach((workerData, workerId) => {
            if (workerData.isBusy && (Date.now() - workerData.taskAssignedTime > TASK_TIMEOUT)) {
                logToDirector(`Worker ${workerId.substring(0, 8)} timed out on task ${workerData.assignedTask.taskId}. Re-queuing...`);
                console.log(`[Timeout] Worker ${workerId} timed out. Re-queuing task.`);

                const failedTask = workerData.assignedTask;
                if (failedTask) {
                    taskQueue.unshift(failedTask);
                }

                // Reset worker state
                workerData.isBusy = false;
                workerData.assignedTask = null;
                workerData.taskAssignedTime = null;
                updateDirectorWorkerInfo(workerId, {
                    status: 'Idle (Timed Out)',
                    currentTask: null,
                    stats: workerData.stats,
                    browserInfo: workerData.browserInfo
                });

                assignTaskToAvailableWorker();
            }
        });
    }
}, HEARTBEAT_INTERVAL);


wss.on('connection', ws => {
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });

    ws.on('message', message => {
        const data = JSON.parse(message);
        switch (data.type) {
            case 'registerDirector':
                if (directorSocket && directorSocket.readyState === WebSocket.OPEN) directorSocket.close();
                directorSocket = ws;
                ws.type = 'director';
                logToDirector('👑 You are the Director. Ready to start.');
                workers.forEach((workerData, workerId) => updateDirectorWorkerInfo(workerId, workerData));
                logToDirector(`Currently ${workers.size} workers connected.`);
                break;

            case 'registerWorker':
                const workerId = data.workerId;
                if (!workerId) return ws.close();

                workers.set(workerId, {
                    ws: ws,
                    isBusy: false,
                    assignedTask: null,
                    taskAssignedTime: null,
                    stats: { tasksCompleted: 0, primesFound: 0n, lastTaskTime: null },
                    browserInfo: data.browserInfo || 'Unknown'
                });
                ws.workerId = workerId;
                ws.type = 'worker';

                logToDirector(`Worker ${workerId.substring(0, 8)}... connected. Total workers: ${workers.size}`);
                updateDirectorWorkerInfo(workerId, workers.get(workerId));

                if (isRunning) assignTaskToAvailableWorker();
                break;

            case 'startComputation':
                if (isRunning) return logToDirector('Computation is already running.');
                
                computationStartTime = Date.now();
                isRunning = true;
                initializeTasks();
                logToDirector(`Starting new computation with ${TOTAL_TASKS} tasks...`);
                workers.forEach(() => assignTaskToAvailableWorker());
                break;

            case 'result':
                const worker = workers.get(data.workerId);
                if (!worker) return;

                const primeCount = BigInt(data.count);
                results[data.taskId] = primeCount;

                // Update worker stats
                worker.stats.tasksCompleted++;
                worker.stats.primesFound += primeCount;
                worker.stats.lastTaskTime = Date.now();
                worker.isBusy = false;
                worker.assignedTask = null;
                worker.taskAssignedTime = null;

                const completedTotal = results.filter(r => r !== null).length;
                updateDirectorProgress(data.taskId, primeCount, completedTotal);
                updateDirectorWorkerInfo(data.workerId, worker);

                if (completedTotal === TOTAL_TASKS) {
                    const totalPrimes = results.reduce((sum, count) => sum + (count || 0n), 0n);
                    notifyDirectorComplete(totalPrimes);
                    isRunning = false;
                    const duration = (Date.now() - computationStartTime) / 1000;
                    logToDirector(`Computation finished in ${duration.toFixed(2)} seconds.`);
                } else {
                    assignTaskToAvailableWorker();
                }
                break;

            case 'error':
                const errorWorker = workers.get(data.workerId);
                if (!errorWorker) return;

                if (errorWorker.assignedTask) {
                    taskQueue.unshift(errorWorker.assignedTask);
                }
                errorWorker.isBusy = false;
                errorWorker.assignedTask = null;
                logToDirector(`Worker ${data.workerId.substring(0,8)}... reported an error. Task re-queued.`);
                updateDirectorWorkerInfo(data.workerId, { ...errorWorker, status: 'Error', currentTask: null });
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
                logToDirector(`Worker ${ws.workerId.substring(0, 8)}... disconnected. Re-queuing task ${workerData.assignedTask.taskId}.`);
                taskQueue.unshift(workerData.assignedTask);
            }
            workers.delete(ws.workerId);
            if (directorSocket) {
                directorSocket.send(JSON.stringify({ type: 'workerRemoved', workerId: ws.workerId }));
            }
            assignTaskToAvailableWorker();
        }
    });
});


// This code sets up a WebSocket server that listens for connections from workers and a director.
// It manages task distribution, worker health checks, and result aggregation.  
/*
Instructions
Stop All Current Processes:

Stop your Node.js server (Ctrl+C in its terminal).

Stop your Python HTTP server (Ctrl+C in its terminal).

Replace the File:

Open your project folder.

Delete the contents of your existing coordinator_server.js file.

Copy and paste the entire corrected code block from above into coordinator_server.js.

Save the file.

Restart Everything:

Start your Node.js server again: node coordinator_server.js

Start your Python HTTP server again: python -m http.server 8008 --bind 0.0.0.0

Hard-refresh your director.html tab and all worker.html tabs.

After following these steps, your system will be much more robust and will no longer get stuck.
*/




/*
import { WebSocketServer, WebSocket } from 'ws';

const wss = new WebSocketServer({ port: 8080, host: '0.0.0.0' });
console.log('Coordinator server running on ws://0.0.0.0:8080');
console.log('Ensure Windows Firewall allows connections on port 8080.');

const N = 5120000000;
const TOTAL_TASKS = 512;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const TASK_TIMEOUT = 120000; // 2 minutes

let directorSocket = null;
const workers = new Map();
const taskQueue = [];
let results = [];
let isRunning = false;
let computationStartTime = null;

function logToDirector(message) {
    if (directorSocket && directorSocket.readyState === WebSocket.OPEN) {
        directorSocket.send(JSON.stringify({ type: 'log', message: `[${new Date().toLocaleTimeString()}] ${message}` }));
    }
}

function updateDirectorProgress(taskId, count, totalCompleted) {
    if (directorSocket && directorSocket.readyState === WebSocket.OPEN) {
        directorSocket.send(JSON.stringify({ type: 'progress', taskId, count: count.toString(), totalCompleted }));
    }
}

function updateDirectorWorkerInfo(workerId, workerInfo) {
    if (directorSocket && directorSocket.readyState === WebSocket.OPEN) {
        const infoToSend = JSON.parse(JSON.stringify(workerInfo, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));
        directorSocket.send(JSON.stringify({ type: 'workerUpdate', workerId, workerInfo: infoToSend }));
    } else {
        console.warn(`[Coordinator] Cannot send workerUpdate for ${workerId}: Director not connected.`);
    }
}

function notifyDirectorComplete(totalPrimes) {
    if (directorSocket && directorSocket.readyState === WebSocket.OPEN) {
        directorSocket.send(JSON.stringify({ type: 'complete', totalPrimes: totalPrimes.toString() }));
    }
}

function initializeTasks() {
    taskQueue.length = 0;
    results = new Array(TOTAL_TASKS).fill(null);
    const chunkSize = Math.floor(N / TOTAL_TASKS);

    for (let i = 0; i < TOTAL_TASKS; i++) {
        const start = i * chunkSize + 1;
        const effectiveStart = (i === 0 && start === 1) ? 2 : start;
        const end = (i === TOTAL_TASKS - 1) ? N : (i + 1) * chunkSize;
        taskQueue.push({ taskId: i, start: effectiveStart, end });
    }
    logToDirector(`Task queue created with ${taskQueue.length} tasks.`);
    console.log(`[Coordinator] Task queue initialized: ${taskQueue.length} tasks.`);
}

function assignTaskToAvailableWorker() {
    if (taskQueue.length === 0) return;

    for (const [workerId, workerData] of workers.entries()) {
        if (!workerData.isBusy) {
            const task = taskQueue.shift();
            if (task) {
                workerData.isBusy = true;
                workerData.assignedTask = task;
                workerData.taskAssignedTime = Date.now(); // Start timeout timer
                workerData.ws.send(JSON.stringify({ type: 'task', task }));
                logToDirector(`Assigned task ${task.taskId} to worker ${workerId.substring(0, 8)}...`);
                updateDirectorWorkerInfo(workerId, {
                    status: 'Busy',
                    currentTask: task.taskId,
                    stats: workerData.stats,
                    browserInfo: workerData.browserInfo
                });
                return;
            }
        }
    }
}

// *** NEW: Heartbeat and Timeout Logic ***
setInterval(() => {
    wss.clients.forEach(ws => {
        if (ws.isAlive === false) {
            console.log(`[Heartbeat] Terminating unresponsive worker: ${ws.workerId}`);
            return ws.terminate(); // This will trigger the 'close' event
        }
        ws.isAlive = false;
        ws.ping();
    });

    // Check for stuck tasks
    if (isRunning) {
        workers.forEach((workerData, workerId) => {
            if (workerData.isBusy && (Date.now() - workerData.taskAssignedTime > TASK_TIMEOUT)) {
                logToDirector(`Worker ${workerId.substring(0, 8)} timed out on task ${workerData.assignedTask.taskId}. Re-queuing...`);
                console.log(`[Timeout] Worker ${workerId} timed out. Re-queuing task.`);

                const failedTask = workerData.assignedTask;
                if (failedTask) {
                    taskQueue.unshift(failedTask);
                }

                // Reset worker state without disconnecting
                workerData.isBusy = false;
                workerData.assignedTask = null;
                workerData.taskAssignedTime = null;
                updateDirectorWorkerInfo(workerId, {
                    status: 'Idle (Timed Out)',
                    currentTask: null,
                    stats: workerData.stats,
                    browserInfo: workerData.browserInfo
                });

                assignTaskToAvailableWorker(); // Try to assign a new task
            }
        });
    }
}, HEARTBEAT_INTERVAL);

wss.on('connection', ws => {
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });

    ws.on('message', message => {
        const data = JSON.parse(message);
        switch (data.type) {
            case 'registerDirector':
                if (directorSocket && directorSocket.readyState === WebSocket.OPEN) {
                    directorSocket.close();
                }
                directorSocket = ws;
                ws.type = 'director';
                logToDirector('👑 You are the Director. Ready to start.');
                logToDirector(`Currently ${workers.size} workers connected.`);
                break;
            case 'registerWorker':
                const workerId = data.workerId;
                if (!workerId) return ws.close();

                workers.set(workerId, {
                    ws: ws,
                    isBusy: false,
                    assignedTask: null,
                    taskAssignedTime: null,
                    stats: { tasksCompleted: 0, primesFound: 0n, lastTaskTime: null },
                    browserInfo: data.browserInfo || 'Unknown'
                });
                ws.workerId = workerId;
                ws.type = 'worker';

                logToDirector(`Worker ${workerId.substring(0, 8)}... connected. Total workers: ${workers.size}`);
                updateDirectorWorkerInfo(workerId, workers.get(workerId));

                if (isRunning && taskQueue.length > 0) {
                    assignTaskToAvailableWorker();
                }
                break;
            case 'startComputation':
                if (isRunning) {
                    logToDirector('Computation is already running.');
                    return;
                }
                computationStartTime = Date.now();
                isRunning = true;
                initializeTasks();
                workers.forEach(() => assignTaskToAvailableWorker());
                break;
            case 'result':
                const worker = workers.get(data.workerId);
                if (!worker) return;

                const primeCount = BigInt(data.count);
                results[data.taskId] = primeCount;
                worker.stats.tasksCompleted++;
                worker.stats.primesFound += primeCount;
                worker.stats.lastTaskTime = Date.now();
                worker.isBusy = false;
                worker.assignedTask = null;
                worker.taskAssignedTime = null;

                const completedTotal = results.filter(r => r !== null).length;
                updateDirectorProgress(data.taskId, primeCount, completedTotal);
                updateDirectorWorkerInfo(data.workerId, worker);

                if (completedTotal === TOTAL_TASKS) {
                    const totalPrimes = results.reduce((sum, count) => sum + (count || 0n), 0n);
                    notifyDirectorComplete(totalPrimes);
                    isRunning = false;
                    const duration = (Date.now() - computationStartTime) / 1000;
                    logToDirector(`Computation finished in ${duration.toFixed(2)} seconds.`);
                } else {
                    assignTaskToAvailableWorker();
                }
                break;
            case 'error':
                 const errorWorker = workers.get(data.workerId);
                if (!errorWorker) return;

                if (errorWorker.assignedTask) {
                    taskQueue.unshift(errorWorker.assignedTask);
                }
                errorWorker.isBusy = false;
                errorWorker.assignedTask = null;
                logToDirector(`Worker ${data.workerId.substring(0,8)}... reported an error. Task re-queued.`);
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
                logToDirector(`Worker ${ws.workerId.substring(0, 8)}... disconnected. Re-queuing task ${workerData.assignedTask.taskId}.`);
                taskQueue.unshift(workerData.assignedTask);
            }
            workers.delete(ws.workerId);
            if (directorSocket) {
                directorSocket.send(JSON.stringify({ type: 'workerRemoved', workerId: ws.workerId }));
            }
            assignTaskToAvailableWorker();
        }
    });
});

*/