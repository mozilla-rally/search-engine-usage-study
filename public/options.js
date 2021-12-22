const RUNNING = "running";
const PAUSED = "paused";

function changeState(state) {
    console.debug("state:", state);
    if (state === RUNNING) {
        document.getElementById("status").textContent = "RUNNING";
        document.getElementById("toggleEnabled").checked = true;
        document.getElementById("status").classList.remove("bg-red-500");
        document.getElementById("status").classList.add("bg-green-500");
    } else if (state === PAUSED || state === undefined) {
        document.getElementById("status").textContent = "PAUSED";
        document.getElementById("toggleEnabled").checked = false;
        document.getElementById("status").classList.remove("bg-green-500");
        document.getElementById("status").classList.add("bg-red-500");
    } else {
        console.error("Unknown state:", state);
    }
}

// Update UI to current state.
browser.storage.local.get("state").then(storage => changeState(storage.state));

// Listen for state changes.
browser.storage.onChanged.addListener((changes) => {
    if (changes.state) {
        changeState(changes.state.newValue);
    }
});

document.getElementById("toggleEnabled").addEventListener("click", async event => {
    if (event.target.checked === true) {
        browser.runtime.sendMessage({ type: "rally-sdk.change-state", data: { state: "resume" } });
    } else {
        browser.runtime.sendMessage({ type: "rally-sdk.change-state", data: { state: "pause" } });
    }
});

document.getElementById("download").addEventListener("click", async () => {
    // Get all data from local storage.
    // TODO we can pull this from glean more directly in the future.
    const storage = await browser.storage.local.get(null);

    const serpVisitPing = [];

    for (const [key, value] of Object.entries(storage)) {
        if (key.startsWith("serpVisitPing")) {
            const ping = JSON.parse(value);
            const result = {};
            for (const [_type, kv] of Object.entries(ping.metrics)) {
                console.debug("CSV export discarding type:", _type, "for value:", kv);
                Object.assign(result, kv);
            }
            serpVisitPing.push(result);
            await browser.storage.local.remove(key);
        }
    }

    if (!(serpVisitPing)) {
        throw new Error("No test data present to export, yet");
    }

    console.debug("Converting enrollment JSON to CSV:", serpVisitPing);

    exportDataAsCsv(serpVisitPing, "serpVisitPing");
});

function exportDataAsCsv(data, name) {
    // Extract all keys from the first object present, to use as CSV headers.
    // TODO if we want to bundle different types of pings in the same CSV, then we should iterate over all objects.
    // TODO if not, then we should figure out how to bundle different types of pings into different CSVs.
    const headerSet = new Set();
    for (const header of Object.keys(data[0])) {
        headerSet.add(header);
    }
    const headers = Array.from(headerSet);

    let csvData = "";

    // Print one line with each header.
    for (const [i, header] of headers.entries()) {
        csvData += `${header}`;
        if (i == headers.length - 1) {
            csvData += `\n`;
        } else {
            csvData += `,`;
        }
    }

    // Print the value for each measurement, in the same order as the headers on the first line.
    for (const ping of data) {
        for (const [i, header] of headers.entries()) {
            const value = ping[header];
            csvData += JSON.stringify(value);
            if (i == headers.length - 1) {
                csvData += `\n`;
            } else {
                csvData += `,`;
            }
        }
    }

    const dataUrl = (`data:text/csv,${encodeURIComponent(csvData)}`);

    const downloadLink = document.getElementById("downloadLink");
    downloadLink.setAttribute("href", dataUrl);
    downloadLink.setAttribute("download", `search-engine-usage-${name}.csv`);
    downloadLink.click();
}
