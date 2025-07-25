/** stats.js
 * This file is part of the Prime Distributed Project, which collects and displays client system information.
 * Gathers client system information that is accessible from the browser.
 * @returns {object} An object containing system stats.
 */
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

