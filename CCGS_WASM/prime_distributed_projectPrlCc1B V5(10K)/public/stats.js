/** stats.js
 * This file is part of the Prime Distributed Project, which collects and displays client system information.
 * Gathers client system information that is accessible from the browser.
 * @returns {object} An object containing system stats.
 */

// In: prime_distributed_projectPrlCc1B - Copy/public/stats.js

/**
 * Gathers client system information that is accessible from the browser.
 * @returns {object} An object containing system stats.
 */
export function getClientInfo() {
    const userAgent = navigator.userAgent || 'N/A';
    let browser = "Unknown Browser";
    let os = "Unknown OS";

    if (userAgent.includes("Firefox")) browser = "Firefox";
    else if (userAgent.includes("SamsungBrowser")) browser = "Samsung Browser";
    else if (userAgent.includes("Opera") || userAgent.includes("Opr")) browser = "Opera";
    else if (userAgent.includes("Edge")) browser = "Edge";
    else if (userAgent.includes("Chrome")) browser = "Chrome";
    else if (userAgent.includes("Safari")) browser = "Safari";

    if (userAgent.includes("Windows")) os = "Windows";
    else if (userAgent.includes("Android")) os = "Android";
    else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) os = "iOS";
    else if (userAgent.includes("Mac")) os = "macOS";
    else if (userAgent.includes("Linux")) os = "Linux";

    return {
        cpuCores: navigator.hardwareConcurrency || 'N/A',
        browserInfo: `${browser} on ${os}`
    };
}

/*
export function getClientInfo() {
    // Note: Some values might not be available in all browsers or situations.
    return {
        // navigator.hardwareConcurrency is the best way to estimate CPU cores.
        cpuCores: navigator.hardwareConcurrency || 'N/A',

        // navigator.deviceMemory gives an approximate RAM value in GB.
        deviceMemory: navigator.deviceMemory || 'N/A',

        // The User Agent string contains detailed Browser and OS info.
        userAgent: navigator.userAgent || 'N/A',
        
        // Screen resolution can also be a useful metric.
        screenResolution: `${window.screen.width}x${window.screen.height}`
    };
}
*/
