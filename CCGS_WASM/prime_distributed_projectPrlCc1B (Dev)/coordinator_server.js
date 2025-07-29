import { WebSocketServer, WebSocket } from 'ws';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process'; // We still need exec for the restart command
// ⬇️ *** IMPORT THE CONFIGURATION *** ⬇️
import { config } from './public/config.js';

// --- CONFIGURATION ---
//const wss = new WebSocketServer({ port: 8080, host: '0.0.0.0' });
// console.log('Coordinator server running on ws://192.168.1.108:8080');
 // WiFi 192.168.0.113
 // Ethernet 192.168.6.15
//console.log('Coordinator server running on ws://192.168.0.113:8080');
//const N = 10000000000; // Total number to compute primes up to. Why: Large enough for significant computation. Data: Integer value.
// const N = 1000000000; // For testing purposes, you can reduce this
// Why: Smaller range for quicker tests. Data: Integer value.
// const N = 10000000; // For testing purposes, you can reduce this
// const TOTAL_TASKS = 10000; //2048; // Total number of tasks to split the computation into. Why: Balance between granularity and overhead. Data: Integer value.
// const HEARTBEAT_INTERVAL = 30000;
//const TASK_TIMEOUT = 180000;
const wss = new WebSocketServer({ port: config.WEBSOCKET_PORT, host: '0.0.0.0' });
console.log(`Coordinator server running on ${config.WEBSOCKET_URL}`);

const N = config.N;
const TOTAL_TASKS = config.TOTAL_TASKS;
const HEARTBEAT_INTERVAL = config.HEARTBEAT_INTERVAL;
const TASK_TIMEOUT = config.TASK_TIMEOUT;
const STATE_FILE = path.join(process.cwd(), 'computation_state.json');
const TASK_LOG_FILE = path.join(process.cwd(), 'task_log.csv');
const WORKER_LOG_FILE = path.join(process.cwd(), 'worker_log.csv');
// Why: Configuration allows for easy adjustments without code changes. Data: Integer values for N, TOTAL_TASKS, HEARTBEAT_INTERVAL, TASK_TIMEOUT.

// --- STATE VARIABLES ---
let directorSocket = null;
const workers = new Map();
let taskQueue = [];
let results = new Array(TOTAL_TASKS).fill(null);
let isRunning = false;
let computationStartTime = null;

// --- LOGGING ---
// Initialize CSV files with headers if they don't exist
if (!fs.existsSync(TASK_LOG_FILE)) {
    fs.writeFileSync(TASK_LOG_FILE, 'Timestamp,TaskID,WorkerID,Status,Duration(ms)\n');
}
if (!fs.existsSync(WORKER_LOG_FILE)) {
    fs.writeFileSync(WORKER_LOG_FILE, 'Timestamp,WorkerID,IPAddress,CPU_Cores,Browser,Status\n');
}

const logTaskEvent = (taskId, workerId, status, duration = '') => {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp},${taskId},${workerId},${status},${duration}\n`;
    fs.appendFileSync(TASK_LOG_FILE, logEntry);
};

const logWorkerEvent = (workerId, ip, cpu, browser, status) => {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp},${workerId},${ip},${cpu},"${browser}",${status}\n`;
    fs.appendFileSync(WORKER_LOG_FILE, logEntry);
};

// --- (Functions: bigIntReplacer, saveState remain the same) ---
function bigIntReplacer(key, value) { return typeof value === 'bigint' ? value.toString() : value; }
function saveState() {
    try {
        const state = { N, TOTAL_TASKS, isRunning, computationStartTime, results, taskQueue };
        const stateString = JSON.stringify(state, bigIntReplacer);
        fs.writeFileSync(STATE_FILE, stateString, 'utf8');
    } catch (err) { console.error('Error saving state:', err); }
}

// --- REFINED: loadState with Automatic Recovery ---
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

            if (isRunning) {
                console.log('[Recovery] System was running. Checking for incomplete tasks...');
                let recoveredCount = 0;
                results.forEach((result, taskId) => {
                    if (result === null && !taskQueue.some(task => task.taskId === taskId)) {
                        const chunkSize = Math.floor(N / TOTAL_TASKS);
                        const start = taskId * chunkSize + 1;
                        const end = (taskId === TOTAL_TASKS - 1) ? N : (taskId + 1) * chunkSize;
                        taskQueue.unshift({ taskId: taskId, start: (taskId === 0 ? 2 : start), end });
                        recoveredCount++;
                    }
                });
                if (recoveredCount > 0) {
                    console.log(`[Recovery] Re-queued ${recoveredCount} in-flight tasks.`);
                    saveState();
                }
            }
        } else {
            console.log('[State] No previous state file found. Starting fresh.');
            initializeTasks();
        }
    } catch (err) {
        console.error('Error loading state, starting fresh:', err);
        initializeTasks();
    }
}


// --- (Functions: logToDirector, updateDirectorProgress, etc. remain the same) ---
const logToDirector = (message) => { if (directorSocket && directorSocket.readyState === WebSocket.OPEN) { directorSocket.send(JSON.stringify({ type: 'log', message: `[${new Date().toLocaleTimeString()}] ${message}` })); } };
const updateDirectorProgress = (taskId, count, totalCompleted) => { if (directorSocket && directorSocket.readyState === WebSocket.OPEN) { directorSocket.send(JSON.stringify({ type: 'progress', taskId, count: count.toString(), totalCompleted })); } };
const updateDirectorWorkerInfo = (workerId, workerInfo) => { if (directorSocket && directorSocket.readyState === WebSocket.OPEN) { const message = JSON.stringify({ type: 'workerUpdate', workerId, workerInfo }, bigIntReplacer); directorSocket.send(message); } };


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
    saveState();
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
                logToDirector(`Assigned task ${task.taskId} to worker ${workerId}`);
                updateDirectorWorkerInfo(workerId, { ...workerData, status: 'Busy', currentTask: task.taskId, ipAddress: workerData.ipAddress });
                logTaskEvent(task.taskId, workerId, 'Assigned');
                saveState();
                return;
            }
        }
    }
}

setInterval(() => {
    workers.forEach((workerData, workerId) => {
        const ws = workerData.ws;
        if (ws.isAlive === false) {
            console.log(`[Heartbeat] Terminating unresponsive worker: ${workerId}`);
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });

    if (isRunning) {
        workers.forEach((workerData, workerId) => {
            if (workerData.isBusy && (Date.now() - workerData.taskAssignedTime > TASK_TIMEOUT)) {
                logToDirector(`Worker ${workerId} timed out on task ${workerData.assignedTask.taskId}. Re-queuing.`);
                console.log(`[Timeout] Worker ${workerId} timed out.`);
                logTaskEvent(workerData.assignedTask.taskId, workerId, 'Timeout');
                if (workerData.assignedTask) taskQueue.unshift(workerData.assignedTask);
                workerData.isBusy = false;
                workerData.assignedTask = null;
                workerData.taskAssignedTime = null;
                updateDirectorWorkerInfo(workerId, { ...workerData, status: 'Idle (Timed Out)', currentTask: null, ipAddress: workerData.ipAddress });
                saveState();
                assignTaskToAvailableWorker();
            }
        });
    }
}, HEARTBEAT_INTERVAL);

wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
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
                    nValue: N,
                    totalTasks: TOTAL_TASKS,
                    isRunning: isRunning,
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
                    browserInfo: data.browserInfo || 'Unknown',
                    cpuCores: data.cpuCores || 'N/A',
                    ipAddress: clientIp,
                    status: 'Idle',
                    currentTask: null
                };
                workers.set(workerId, newWorkerData);
                logToDirector(`Worker ${workerId} at ${clientIp} connected.`);
                logWorkerEvent(workerId, clientIp, newWorkerData.cpuCores, newWorkerData.browserInfo, 'Connected');
                updateDirectorWorkerInfo(workerId, newWorkerData);
                assignTaskToAvailableWorker();
                break;

          case 'startComputation':
                if (fs.existsSync(STATE_FILE)) {
                    logToDirector('Clearing previous state for a new computation.');
                    fs.unlinkSync(STATE_FILE); // Delete the old state file
                }
                isRunning = true;
                computationStartTime = Date.now();
                initializeTasks();
                // Clear old logs for a new run
                fs.writeFileSync(TASK_LOG_FILE, 'Timestamp,TaskID,WorkerID,Status,Duration(ms)\n');
                logToDirector(`Starting new computation...`);
                saveState();
                workers.forEach((w, id) => assignTaskToAvailableWorker());
                break;

            case 'pauseComputation':
                if (isRunning) {
                    isRunning = false;
                    logToDirector('⏸️ Computation paused.');
                    saveState();
                }
                break;

            case 'resumeComputation':
                if (!isRunning) {
                    isRunning = true;
                    logToDirector('▶️ Computation resumed.');
                    saveState();
                    // Re-assign tasks to all available workers
                    assignTaskToAvailableWorker(); 
                }
                break;
            
            case 'restartServer':
                logToDirector('🔄 Server restart initiated...');
                // Use PM2's programmatic restart command
                exec('pm2 restart coordinator', (error, stdout, stderr) => {
                    if (error) {
                        console.error(`exec error: ${error}`);
                        logToDirector(`Error restarting server: ${error.message}`);
                        return;
                    }
                    console.log(`stdout: ${stdout}`);
                    console.error(`stderr: ${stderr}`);
                });
                break;


            case 'terminateWorker':
                const workerToTerminate = workers.get(data.workerId);
                if (workerToTerminate) {
                    logToDirector(`Director is terminating worker ${data.workerId}`);
                    workerToTerminate.ws.terminate(); // Forcefully close the connection
                }
                break;

            case 'stillWorking':
                const activeWorker = workers.get(data.workerId);
                if (activeWorker && activeWorker.isBusy) {
                    activeWorker.taskAssignedTime = Date.now();
                    if(data.memory) {
                       activeWorker.stats.memory = data.memory;
                       updateDirectorWorkerInfo(data.workerId, activeWorker);
                    }
                }
                break;

            case 'result':
                const worker = workers.get(data.workerId);
                if (!worker || !worker.assignedTask || worker.assignedTask.taskId !== data.taskId) return;

                const taskDuration = Date.now() - worker.taskAssignedTime;
                logTaskEvent(data.taskId, data.workerId, 'Completed', taskDuration);
                
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
                updateDirectorWorkerInfo(data.workerId, { ...worker, status: 'Idle', currentTask: null, ipAddress: worker.ipAddress });
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
                
                logToDirector(`Worker ${data.workerId}... error on task ${errorWorker.assignedTask.taskId}. Re-queuing.`);
                logTaskEvent(errorWorker.assignedTask.taskId, data.workerId, 'Error');
                taskQueue.unshift(errorWorker.assignedTask);
                errorWorker.isBusy = false;
                errorWorker.assignedTask = null;
                updateDirectorWorkerInfo(data.workerId, { ...errorWorker, status: 'Error', currentTask: null, ipAddress: errorWorker.ipAddress });
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
            if (workerData) {
                logWorkerEvent(ws.workerId, workerData.ipAddress, workerData.cpuCores, workerData.browserInfo, 'Disconnected');
                if (workerData.assignedTask) {
                    logToDirector(`Worker ${ws.workerId} disconnected. Re-queuing task ${workerData.assignedTask.taskId}.`);
                    logTaskEvent(workerData.assignedTask.taskId, ws.workerId, 'Disconnected_Requeued');
                    taskQueue.unshift(workerData.assignedTask);
                    saveState();
                }
                workers.delete(ws.workerId);
                if (directorSocket) directorSocket.send(JSON.stringify({ type: 'workerRemoved', workerId: ws.workerId }));
                assignTaskToAvailableWorker();
            }
        }
    });
});

// --- INITIALIZATION ---
loadState();



/*


// In: prime_distributed_projectPrlCc1B - Copy/coordinator_server.js
// FINAL VERSION: Includes CSV logging, worker control, and enhanced state management.

const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const PORT = 8080;
const STATE_FILE = './coordinator_state.json';
const TASK_TIMEOUT = 60000; // 60 seconds
const HEARTBEAT_INTERVAL = 15000; // 15 seconds

const wss = new WebSocket.Server({ port: PORT });
console.log(`Coordinator WebSocket server started on port ${PORT}`);

let N;
let tasks = [];
let taskQueue = [];
let workers = new Map(); // Using Map for better performance
let director = null;
let isRunning = false;
let startTime = null;
let taskSize;

// Load previous state if it exists
const loadState = () => {
    if (fs.existsSync(STATE_FILE)) {
        try {
            const state = JSON.parse(fs.readFileSync(STATE_FILE));
            N = state.N;
            tasks = state.tasks;
            taskQueue = state.taskQueue;
            isRunning = state.isRunning || false;
            startTime = state.startTime;
            taskSize = state.taskSize;
            console.log("✅ Previous state loaded successfully.");
            logToDirector("✅ Previous state loaded successfully.");
        } catch (error) {
            console.error("🚨 Error loading state:", error);
        }
    }
};

// Save current state to a file
const saveState = () => {
    try {
        const state = {
            N,
            tasks,
            taskQueue,
            isRunning,
            startTime,
            taskSize,
            workers: Array.from(workers.values()).map(w => ({ // Don't save WebSocket object
                id: w.id,
                isBusy: w.isBusy,
                assignedTask: w.assignedTask,
                taskAssignedTime: w.taskAssignedTime,
                stats: w.stats,
                ipAddress: w.ipAddress
            }))
        };
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (error) {
        console.error("🚨 Error saving state:", error);
    }
};

const broadcast = (data) => {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
};

const logToDirector = (message) => {
    if (director && director.readyState === WebSocket.OPEN) {
        director.send(JSON.stringify({ type: 'log', message }));
    }
};

const updateDirectorFullState = () => {
    if (director && director.readyState === WebSocket.OPEN) {
        const state = {
            N,
            tasks,
            isRunning,
            taskSize,
            workers: Array.from(workers.values()).map(w => ({
                id: w.id,
                isBusy: w.isBusy,
                assignedTask: w.assignedTask,
                stats: w.stats,
                ipAddress: w.ipAddress,
                status: w.status
            }))
        };
        director.send(JSON.stringify({ type: 'full-state', state }));
    }
};

const updateDirectorWorkerInfo = (workerId, workerData) => {
    if (director && director.readyState === WebSocket.OPEN) {
        director.send(JSON.stringify({
            type: 'worker-update',
            workerId,
            workerData: {
                id: workerId,
                isBusy: workerData.isBusy,
                assignedTask: workerData.assignedTask,
                stats: workerData.stats,
                ipAddress: workerData.ipAddress,
                status: workerData.status
            }
        }));
    }
};


const assignTaskToAvailableWorker = () => {
    if (!isRunning || taskQueue.length === 0) return;

    for (const [workerId, workerData] of workers.entries()) {
        if (!workerData.isBusy) {
            const task = taskQueue.shift();
            if (task) {
                workerData.isBusy = true;
                workerData.assignedTask = task;
                workerData.taskAssignedTime = Date.now();
                workerData.status = `Working on Task ${task.taskId}`;

                console.log(`Assigning task ${task.taskId} to worker ${workerId}`);
                logToDirector(`Assigning task ${task.taskId} to worker ${workerId}`);
                workerData.ws.send(JSON.stringify({ type: 'task', task }));
                updateDirectorWorkerInfo(workerId, workerData);
                saveState();
                break; // Assign one task at a time
            }
        }
    }
};


wss.on('connection', (ws, req) => {
    const ipAddress = req.socket.remoteAddress;
    ws.isAlive = true; // Heartbeat flag

    ws.on('pong', () => {
        // *** DIAGNOSTIC LOGGING ***
        console.log(`[Heartbeat] Received pong from a client.`);
        ws.isAlive = true;
    });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'register-director') {
                director = ws;
                console.log("👑 Director connected.");
                logToDirector("👑 Director connected. Syncing state...");
                updateDirectorFullState();
                return;
            }

            // All other messages should be from workers
            const workerId = ws.id; // Get worker ID after it has been assigned
            if (!workerId && data.type !== 'register-worker') {
                console.log("Received message from unregistered worker. Ignoring.");
                return;
            }
            const workerData = workers.get(workerId);

            switch (data.type) {
                case 'register-worker':
                    const newWorkerId = `worker-${uuidv4()}`;
                    ws.id = newWorkerId;
                    const newWorkerData = {
                        id: newWorkerId,
                        ws: ws,
                        isBusy: false,
                        assignedTask: null,
                        taskAssignedTime: null,
                        stats: { tasksDone: 0, primesFound: 0, cpu: 0, mem: 0, cores: data.cores, browser: data.browser, os: data.os },
                        ipAddress: ipAddress,
                        status: "Idle"
                    };
                    workers.set(newWorkerId, newWorkerData);
                    console.log(`Worker ${newWorkerId} at ${ipAddress} connected.`);
                    logToDirector(`Worker ${newWorkerId} at ${ipAddress} connected.`);
                    updateDirectorWorkerInfo(newWorkerId, newWorkerData);
                    assignTaskToAvailableWorker();
                    break;
                
                case 'task-result':
                    if (workerData && workerData.isBusy) {
                        const { taskId, primes, timeTaken } = data.result;
                        console.log(`Received result for task ${taskId} from worker ${workerId}. Primes found: ${primes.length}. Time: ${timeTaken}ms.`);
                        logToDirector(`Result for task ${taskId} from ${workerId} received.`);

                        // Update task status in the main tasks array
                        const taskIndex = tasks.findIndex(t => t.taskId === taskId);
                        if (taskIndex !== -1) {
                            tasks[taskIndex].status = 'Completed';
                            tasks[taskIndex].result = primes;
                            tasks[taskIndex].workerId = workerId;
                            tasks[taskIndex].timeTaken = timeTaken;
                        }

                        // Update worker state
                        workerData.isBusy = false;
                        workerData.assignedTask = null;
                        workerData.taskAssignedTime = null;
                        workerData.stats.tasksDone += 1;
                        workerData.stats.primesFound += primes.length;
                        workerData.status = "Idle";

                        updateDirectorWorkerInfo(workerId, workerData);
                        saveState();
                        assignTaskToAvailableWorker();
                    }
                    break;
                
                case 'worker-stats':
                     if (workerData) {
                        workerData.stats.cpu = data.stats.cpu;
                        workerData.stats.mem = data.stats.mem;
                        updateDirectorWorkerInfo(workerId, workerData);
                    }
                    break;
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        const workerId = ws.id;
        if (workerId) {
            const workerData = workers.get(workerId);
            if(workerData) {
                 if (workerData.isBusy && workerData.assignedTask) {
                    console.log(`Worker ${workerId} disconnected with active task ${workerData.assignedTask.taskId}. Re-queuing.`);
                    logToDirector(`Worker ${workerId} disconnected with active task. Re-queuing.`);
                    taskQueue.unshift(workerData.assignedTask);
                }
                workers.delete(workerId);
                console.log(`Worker ${workerId} disconnected.`);
                logToDirector(`Worker ${workerId} disconnected.`);
                broadcast({ type: 'worker-disconnected', id: workerId });
                saveState();
            }
           
        } else if (ws === director) {
            console.log("👑 Director disconnected.");
            director = null;
        }
    });
});

// Heartbeat and Timeout check
setInterval(() => {
    // *** DIAGNOSTIC LOGGING ***
    console.log(`[Heartbeat] Running check. Total workers: ${workers.size}`);
    workers.forEach((workerData, workerId) => {
        const ws = workerData.ws;
        // Check if the worker is alive
        if (ws.isAlive === false) {
             // *** DIAGNOSTIC LOGGING ***
            console.log(`[Heartbeat] Terminating unresponsive worker: ${workerId}`);
            return ws.terminate(); // This will trigger the 'close' event for cleanup
        }
        
        // Assume it's not alive for the next interval, until a pong proves otherwise
        ws.isAlive = false;
        // *** DIAGNOSTIC LOGGING ***
        console.log(`[Heartbeat] Sending ping to ${workerId}`);
        ws.ping(() => {}); // Send ping
    });

    // Check for task timeouts
    if (isRunning) {
        workers.forEach((workerData, workerId) => {
            if (workerData.isBusy && (Date.now() - workerData.taskAssignedTime > TASK_TIMEOUT)) {
                console.log(`[Timeout] Worker ${workerId} timed out on task ${workerData.assignedTask.taskId}.`);
                logToDirector(`Worker ${workerId} timed out on task ${workerData.assignedTask.taskId}. Re-queuing.`);

                if (workerData.assignedTask) {
                    taskQueue.unshift(workerData.assignedTask);
                }
                
                // Reset worker state
                workerData.isBusy = false;
                workerData.assignedTask = null;
                workerData.taskAssignedTime = null;
                workerData.status = 'Idle (Timed Out)';
                
                updateDirectorWorkerInfo(workerId, workerData);
                saveState();
                assignTaskToAvailableWorker();
            }
        });
    }
}, HEARTBEAT_INTERVAL);


loadState();
*/