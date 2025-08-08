// In: prime_distributed_projectPrlCc1B V5(10K)/coordinator_server.js
// FINAL VERSION: Includes CSV logging, worker control, and enhanced state management.

// In: prime_distributed_projectPrlCc1B V5(10K)/coordinator_server.js

// Add Node.js 'cluster' module at the top
import { WebSocketServer, WebSocket } from 'ws';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';// We still need exec for the restart command


// --- CONFIGURATION ---
// const wss = new WebSocketServer({ port: 8080, host: '0.0.0.0' });
const wss = new WebSocketServer({ port: 8080, host: '127.0.0.1', path: '/ws' });
console.log('Coordinator server running on ws://127.0.0.1:8080/ws');
// console.log('Coordinator server running on ws://0.0.0.0:8080  ', wss.options.host, wss.options.port);
// console.log('Coordinator server running on ws://192.168.1.108:8080');
 // WiFi 192.168.0.113
 // Ethernet 192.168.6.15
//console.log('Coordinator server running on ws://192.168.0.113:8080');
// console.log('Coordinator server running on ws://DESKTOP-NAF9NIA:8080');
// console.log('Coordinator server running on ws://0.0.0.0:8080  ', wss.options.host, wss.options.port);

const N = 2500000000; // Total number to compute primes up to. Why: Large enough for significant computation. Data: Integer value.
// const N = 1000000000; // For testing purposes, you can reduce this
// Why: Smaller range for quicker tests. Data: Integer value.
// const N = 10000000; // For testing purposes, you can reduce this
const TOTAL_TASKS = 25000; //100000 // 10000 //2048; // Total number of tasks to split the computation into. Why: Balance between granularity and overhead. Data: Integer value.
const HEARTBEAT_INTERVAL = 30000;
const TASK_TIMEOUT = 180000;
const STATE_FILE = path.join(process.cwd(), 'computation_state.json');
const TASK_LOG_FILE = path.join(process.cwd(), 'task_log.csv');
const WORKER_LOG_FILE = path.join(process.cwd(), 'worker_log.csv');

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
    
    //const clientIp = req.socket.remoteAddress;
    //const clientIp = req.headers['x-real-ip'] || req.socket.remoteAddress;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', message => {
        console.log(`[Debug] Received message: ${message}`); 
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
                // VVVV --- ADD THIS LINE --- VVVV
            if (directorSocket) directorSocket.send(JSON.stringify({ type: 'computationStateChanged', isRunning: true }));
            // ^^^^ ----------------------- ^^^^
                break;

            case 'pauseComputation':
                if (isRunning) {
                    isRunning = false;
                    logToDirector('⏸️ Computation paused.');
                    saveState();
                                    // VVVV --- ADD THIS LINE --- VVVV
                if (directorSocket) directorSocket.send(JSON.stringify({ type: 'computationStateChanged', isRunning: false }));
                // ^^^^ ----------------------- ^^^^
                }
                break;

            case 'resumeComputation':
                if (!isRunning) {
                    isRunning = true;
                    logToDirector('▶️ Computation resumed.');
                    saveState();

                                    // VVVV --- ADD THIS LINE --- VVVV
                if (directorSocket) directorSocket.send(JSON.stringify({ type: 'computationStateChanged', isRunning: true }));
                // ^^^^ ----------------------- ^^^^
                    // Re-assign tasks to all available workers
                    assignTaskToAvailableWorker(); 
                    
                }
                break;
            
            case 'restartServer':
                logToDirector('🔄 Server restart initiated...');
                // Use PM2's programmatic restart command
//exec('pm2 restart coordinator', (error, stdout, stderr) => {
 exec('sudo pm2 restart coordinator', (error, stdout, stderr) => {                   
                    if (error) {
                        console.error(`exec error: ${error}`);
                        logToDirector(`Error restarting server: ${error.message}`);
                        return;
                    }
                    console.log(`stdout: ${stdout}`);
                    console.error(`stderr: ${stderr}`);
                });
                break;

        // VVVV --- ADD THIS NEW CASE --- VVVV
            // ... (all your other cases) ...

            // VVVV --- FIND YOUR 'clearState' CASE AND ADD A LOG --- VVVV
// In: coordinator_server.js
// Find the `switch (data.type)` block...

            // ... (previous cases like 'restartServer')

            // VVVV --- REPLACE your old 'clearState' case with this one --- VVVV
            case 'clearState':
                logToDirector('Received command to clear state. Resetting server memory and deleting file...');

                // 1. Delete the state file if it exists
                try {
                    if (fs.existsSync(STATE_FILE)) {
                        fs.unlinkSync(STATE_FILE);
                        console.log(`[State] Deleted computation_state.json by director's command.`);
                    }
                } catch (err) {
                    console.error('Error deleting state file:', err);
                    logToDirector(`❌ Error deleting state file: ${err.message}`);
                }

                // 2. Reset the server's in-memory state variables
                isRunning = false;
                computationStartTime = null;
                results = new Array(TOTAL_TASKS).fill(null);
                taskQueue = []; // Clear the task queue
                initializeTasks(); // Re-create the full task queue
                
                // 3. Immediately push the fresh, empty state back to the director's UI
                if (directorSocket && directorSocket.readyState === WebSocket.OPEN) {
                    logToDirector('✅ Server state cleared. Pushing clean state to UI.');
                    const statePayload = {
                        type: 'fullState',
                        nValue: N,
                        totalTasks: TOTAL_TASKS,
                        isRunning: isRunning,
                        results: results,
                        workers: Array.from(workers.entries()).map(([id, worker]) => {
                             // Reset individual worker stats for the UI as well
                            worker.stats.tasksCompleted = 0;
                            worker.stats.primesFound = 0n;
                            const { ws, ...workerInfo } = worker;
                            return [id, workerInfo];
                        })
                    };
                    directorSocket.send(JSON.stringify(statePayload, bigIntReplacer));
                }
                break;
            // ^^^^ --- END OF REPLACEMENT --- ^^^^
            // ^^^^ --------------------------------------------------- ^^^^
            
            // ... (rest of your cases) ...
        // ^^^^ --- END OF NEW CASE --- ^^^^
        
            case 'terminateWorker':
                const workerToTerminate = workers.get(data.workerId);
                if (workerToTerminate) {
                    logToDirector(`Director is terminating worker ${data.workerId}`);
                    workerToTerminate.ws.terminate(); // Forcefully close the connection
                }
                break;

// In: coordinator_server.js
// Inside the ws.on('message', ...) switch statement

            // ... (after the 'terminateWorker' case)

            case 'memoryUpdate':
                const memWorker = workers.get(data.workerId);
                if (memWorker) {
                    // Add the memory info to the worker's data
                    memWorker.memory = data.memory;
                    // Send the updated worker info to the director
                    updateDirectorWorkerInfo(data.workerId, memWorker);
                }
                break;

            // case 'stillWorking':
            // ... (rest of your cases)


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