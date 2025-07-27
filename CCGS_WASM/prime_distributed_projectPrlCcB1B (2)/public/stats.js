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