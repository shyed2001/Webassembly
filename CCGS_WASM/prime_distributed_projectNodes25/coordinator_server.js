// coordinator_server.js
import { WebSocketServer } from 'ws';

// Explicitly bind to '0.0.0.0' to accept connections from all network interfaces,
// including those coming through the local network or any tunnels.
const wss = new WebSocketServer({ port: 8080});
console.log('Coordinator server running on ws://0.0.0.0:8080');
console.log('Ensure Windows Firewall allows connections on port 8080.'); // Reminder for local IP setup

const N = 400000000; // Total range for prime computation
const TOTAL_TASKS = 10; // Number of tasks to divide the computation into

let directorSocket = null; // Stores the WebSocket connection for the Director client
// Using a Map to store worker objects, keyed by their unique workerId
const workers = new Map(); 
const taskQueue = []; // Queue of tasks to be assigned to workers
let results = []; // Stores results from completed tasks, indexed by taskId
let isRunning = false; // Flag to indicate if computation is currently active
let computationStartTime = null; // Timestamp when computation starts

/**
 * Sends a log message to the Director client.
 * @param {string} message - The message to log.
 */
function logToDirector(message) {
    if (directorSocket && directorSocket.readyState === directorSocket.OPEN) {
        directorSocket.send(JSON.stringify({ type: 'log', message: `[${new Date().toLocaleTimeString()}] ${message}` }));
    }
}

/**
 * Sends progress updates to the Director client.
 * @param {number} taskId - The ID of the task that completed.
 * @param {BigInt} count - The prime count for the completed task (as BigInt).
 * @param {number} totalCompleted - The total number of tasks completed so far.
 */
function updateDirectorProgress(taskId, count, totalCompleted) {
    if (directorSocket && directorSocket.readyState === directorSocket.OPEN) {
        // Convert BigInt count to string for JSON serialization
        directorSocket.send(JSON.stringify({ type: 'progress', taskId, count: count.toString(), totalCompleted }));
    }
}

/**
 * Sends updates about a specific worker's status and stats to the Director.
 * @param {string} workerId - The ID of the worker.
 * @param {object} workerInfo - Object containing worker details (status, currentTask, stats, etc.).
 */
function updateDirectorWorkerInfo(workerId, workerInfo) {
    if (directorSocket && directorSocket.readyState === WebSocket.OPEN) { // Ensure directorSocket is open
        // Ensure primesFound is converted to string for JSON serialization
        const infoToSend = { ...workerInfo }; // Create a copy to modify
        if (infoToSend.stats && typeof infoToSend.stats.primesFound === 'bigint') {
            infoToSend.stats.primesFound = infoToSend.stats.primesFound.toString();
        }
        directorSocket.send(JSON.stringify({ type: 'workerUpdate', workerId, workerInfo: infoToSend }));
    } else {
        console.warn(`[Coordinator] Cannot send workerUpdate for ${workerId}: Director not connected or socket closed.`);
    }
}

/**
 * Notifies the Director client when all tasks are complete.
 * @param {BigInt} totalPrimes - The final sum of primes from all tasks (as BigInt).
 */
function notifyDirectorComplete(totalPrimes) {
    if (directorSocket && directorSocket.readyState === directorSocket.OPEN) {
        // Convert BigInt totalPrimes to string for JSON serialization
        directorSocket.send(JSON.stringify({ type: 'complete', totalPrimes: totalPrimes.toString() }));
    }
}

/**
 * Initializes the task queue by dividing the total computation range (N)
 * into TOTAL_TASKS chunks.
 */
function initializeTasks() {
    taskQueue.length = 0;
    // results array will store BigInts
    results = new Array(TOTAL_TASKS).fill(null); 
    const chunkSize = Math.floor(N / TOTAL_TASKS);

    for (let i = 0; i < TOTAL_TASKS; i++) {
        const start = i * chunkSize + 1;
        // Adjust start for task 0 to avoid checking 1 (not prime)
        const effectiveStart = (i === 0 && start === 1) ? 2 : start; 
        // Ensure the last task covers up to N
        const end = (i === TOTAL_TASKS - 1) ? N : (i + 1) * chunkSize; 
        taskQueue.push({ taskId: i, start: effectiveStart, end });
    }
    logToDirector(`Task queue created with ${taskQueue.length} tasks.`);
    console.log(`[Coordinator] Task queue initialized: ${taskQueue.length} tasks.`);
}

/**
 * Assigns a task from the queue to an available (not busy) worker.
 */
function assignTaskToAvailableWorker() {
    if (taskQueue.length === 0) {
        console.log('[Coordinator] No tasks in queue to assign.');
        return;
    }

    for (const [workerId, workerData] of workers.entries()) {
        if (!workerData.isBusy) {
            const task = taskQueue.shift();
            if (task) {
                workerData.isBusy = true;
                workerData.assignedTask = task;
                workerData.ws.send(JSON.stringify({ type: 'task', task }));
                logToDirector(`Assigned task ${task.taskId} to worker ${workerId.substring(0, 8)}...`);
                console.log(`[Coordinator] Assigned task ${task.taskId} to worker ${workerId}.`);
                
                updateDirectorWorkerInfo(workerId, { 
                    status: 'Busy', 
                    currentTask: task.taskId,
                    stats: workerData.stats,
                    browserInfo: workerData.browserInfo
                });
                return;
            } else {
                console.log('[Coordinator] Task queue became empty during assignment loop.');
                break;
            }
        }
    }
    // If no workers are available and tasks remain
    if (taskQueue.length > 0 && Array.from(workers.values()).every(w => w.isBusy)) {
        console.log(`[Coordinator] All workers are busy. ${taskQueue.length} tasks still in queue.`);
        logToDirector(`All workers busy. ${taskQueue.length} tasks remaining.`);
    }
}

// Event listener for new WebSocket connections to the server
wss.on('connection', ws => {
    ws.type = 'unknown'; 

    ws.on('message', message => {
        const data = JSON.parse(message);
        
        switch (data.type) {
            case 'registerDirector':
                if (directorSocket && directorSocket.readyState === WebSocket.OPEN) {
                    console.log('Existing Director detected. Closing old connection.');
                    logToDirector('Another Director connected. This Director instance will take control.');
                    directorSocket.close();
                }
                directorSocket = ws;
                ws.type = 'director';
                console.log('Director has connected.');
                logToDirector('👑 You are the Director. Ready to start.');
                
                workers.forEach((workerData, workerId) => {
                    updateDirectorWorkerInfo(workerId, {
                        status: workerData.isBusy ? 'Busy' : 'Idle',
                        currentTask: workerData.assignedTask ? workerData.assignedTask.taskId : null,
                        stats: workerData.stats,
                        browserInfo: workerData.browserInfo 
                    });
                });
                logToDirector(`Currently ${workers.size} workers connected.`);
                break;

            case 'registerWorker':
                const workerId = data.workerId;
                if (!workerId) {
                    console.error('Worker registration without ID received.');
                    ws.close();
                    return;
                }
                
                if (workers.has(workerId)) {
                    console.log(`Worker ${workerId} re-registered. Updating WebSocket object.`);
                    const existingWorkerData = workers.get(workerId);
                    existingWorkerData.ws = ws; 
                    ws.workerId = workerId; 
                    ws.type = 'worker'; 
                    logToDirector(`Worker ${workerId} reconnected.`);
                    updateDirectorWorkerInfo(workerId, { 
                        status: existingWorkerData.isBusy ? 'Busy' : 'Idle', 
                        currentTask: existingWorkerData.assignedTask ? existingWorkerData.assignedTask.taskId : null, 
                        stats: existingWorkerData.stats,
                        browserInfo: existingWorkerData.browserInfo
                    });
                } else {
                    workers.set(workerId, { 
                        ws: ws, 
                        isBusy: false, 
                        assignedTask: null, 
                        // Initialize primesFound as BigInt 0n
                        stats: { tasksCompleted: 0, primesFound: 0n, lastTaskTime: null }, 
                        browserInfo: data.browserInfo || 'Unknown Browser/OS' 
                    });
                    ws.workerId = workerId; 
                    ws.type = 'worker'; 

                    console.log(`Worker ${workerId} registered. Total workers: ${workers.size}`);
                    logToDirector(`Worker ${workerId} connected. Total workers: ${workers.size}`);
                    
                    updateDirectorWorkerInfo(workerId, { 
                        status: 'Idle', 
                        currentTask: null, 
                        stats: workers.get(workerId).stats,
                        browserInfo: workers.get(workerId).browserInfo
                    });
                }

                if (isRunning && taskQueue.length > 0) { 
                    console.log(`[Coordinator] Worker ${workerId} registered while running, attempting to assign task.`);
                    assignTaskToAvailableWorker();
                } else if (isRunning && taskQueue.length === 0) {
                    console.log(`[Coordinator] Worker ${workerId} registered, but no tasks left.`);
                }
                break;

            case 'startComputation':
                if (isRunning) {
                    logToDirector('Computation is already running.');
                    console.log('[Coordinator] Start computation requested, but already running.');
                    return;
                }
                computationStartTime = Date.now();
                console.log('Director started the computation.');
                logToDirector(`Starting new computation at ${new Date(computationStartTime).toLocaleTimeString()}...`);
                isRunning = true;
                initializeTasks();
                console.log(`[Coordinator] Attempting to assign initial tasks to ${workers.size} workers.`);
                Array.from(workers.values()).forEach(workerData => assignTaskToAvailableWorker()); 
                
                if (taskQueue.length > 0) {
                    logToDirector(`Not all tasks assigned initially. ${taskQueue.length} tasks remaining.`);
                } else {
                    logToDirector('All initial tasks assigned.');
                }
                break;
            
            case 'result':
                const resultWorkerId = data.workerId;
                const workerData = workers.get(resultWorkerId);

                if (!workerData) {
                    console.warn(`[Coordinator] Result from unknown worker ID: ${resultWorkerId}`);
                    return;
                }

                workerData.isBusy = false;
                const completedTask = workerData.assignedTask;
                workerData.assignedTask = null;

                // Convert received count string back to BigInt
                const primeCount = BigInt(data.count); 
                results[data.taskId] = primeCount; // Store the result (as BigInt)

                // Update worker's stats (BigInt addition)
                workerData.stats.tasksCompleted++;
                workerData.stats.primesFound += primeCount; 
                workerData.stats.lastTaskTime = Date.now();

                const completedTotal = results.filter(r => r !== null).length;
                console.log(`[Coordinator] Task ${data.taskId} completed by worker ${resultWorkerId}. Total completed: ${completedTotal}`);
                logToDirector(`Worker ${resultWorkerId.substring(0, 8)}... completed task ${data.taskId} (${primeCount.toLocaleString()} primes).`);
                updateDirectorProgress(data.taskId, primeCount, completedTotal); // primeCount is BigInt here

                updateDirectorWorkerInfo(resultWorkerId, { 
                    status: 'Idle', 
                    currentTask: null, 
                    stats: workerData.stats,
                    browserInfo: workerData.browserInfo
                });

                if (completedTotal === TOTAL_TASKS) {
                    // Sum results (which are BigInts) using 0n as initial value for BigInt sum
                    const totalPrimes = results.reduce((sum, count) => sum + count, 0n); 
                    notifyDirectorComplete(totalPrimes);
                    isRunning = false;
                    const computationEndTime = Date.now();
                    const duration = (computationEndTime - computationStartTime) / 1000;
                    logToDirector(`Computation finished in ${duration.toFixed(2)} seconds.`);
                    console.log(`[Coordinator] ALL TASKS COMPLETE. Final Total: ${totalPrimes}. Duration: ${duration.toFixed(2)}s`);
                } else {
                    assignTaskToAvailableWorker();
                }
                break;

            case 'error':
                const errorWorkerId = data.workerId;
                const errorWorkerData = workers.get(errorWorkerId);

                if (!errorWorkerData) {
                    console.warn(`[Coordinator] Error from unknown worker ID: ${errorWorkerId}`);
                    return;
                }

                errorWorkerData.isBusy = false; 
                const failedTask = errorWorkerData.assignedTask;
                errorWorkerData.assignedTask = null;

                console.log(`[Coordinator] Worker ${errorWorkerId} reported an error on task ${failedTask ? failedTask.taskId : 'unknown'}. Re-queuing.`);
                logToDirector(`Worker ${errorWorkerId.substring(0, 8)}... crashed on task ${failedTask ? failedTask.taskId : 'unknown'}. Error: ${data.message}. Re-queuing...`);
                
                updateDirectorWorkerInfo(errorWorkerId, { 
                    status: 'Error', 
                    currentTask: null, 
                    stats: errorWorkerData.stats,
                    browserInfo: errorWorkerData.browserInfo
                });

                if (failedTask) {
                    taskQueue.unshift(failedTask);
                    assignTaskToAvailableWorker();
                }
                break;
        }
    });

    ws.on('close', () => {
        const disconnectedWorkerId = ws.workerId; // Get workerId directly if available

        if (ws.type === 'director') {
            console.log('Director disconnected.');
            logToDirector('Director disconnected. No further updates will be sent.');
            directorSocket = null;
        } else if (ws.type === 'worker' && disconnectedWorkerId) {
            const disconnectedWorkerData = workers.get(disconnectedWorkerId);
            workers.delete(disconnectedWorkerId);
            console.log(`Worker ${disconnectedWorkerId} disconnected. Total workers: ${workers.size}`);
            logToDirector(`Worker ${disconnectedWorkerId.substring(0, 8)}... disconnected. Total workers: ${workers.size}`);

            if (directorSocket && directorSocket.readyState === WebSocket.OPEN) {
                directorSocket.send(JSON.stringify({ type: 'workerRemoved', workerId: disconnectedWorkerId }));
            }

            if (disconnectedWorkerData && disconnectedWorkerData.assignedTask) {
                console.log(`Worker ${disconnectedWorkerId} was holding task ${disconnectedWorkerData.assignedTask.taskId}. Returning it to the queue.`);
                logToDirector(`Worker ${disconnectedWorkerId.substring(0, 8)}... disconnected with task ${disconnectedWorkerData.assignedTask.taskId}. Re-queuing...`);
                taskQueue.unshift(disconnectedWorkerData.assignedTask);
                assignTaskToAvailableWorker();
            }
        }
    });
});