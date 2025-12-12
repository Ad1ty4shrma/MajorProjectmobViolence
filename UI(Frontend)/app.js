const API_BASE_URL = "http://localhost:5000"; // Adjust if backend is elsewhere

const videoInput = document.getElementById("videoInput");
const uploadBtn = document.getElementById("uploadBtn");
const analyzeBtn = document.getElementById("analyzeBtn");
const fileNameLabel = document.getElementById("fileName");
const loader = document.getElementById("loader");
const errorText = document.getElementById("errorText");
const resultCard = document.getElementById("resultCard");
const resultLabel = document.getElementById("resultLabel");
const resultProb = document.getElementById("resultProb");
const logList = document.getElementById("logList");
const liveStatusBadge = document.getElementById("liveStatusBadge");
const liveStatusText = document.getElementById("liveStatusText");
const lastPredictionTime = document.getElementById("lastPredictionTime");

let selectedFile = null;

// Helpers
function setLoading(isLoading) {
    loader.hidden = !isLoading;
    analyzeBtn.disabled = isLoading || !selectedFile;
    uploadBtn.disabled = isLoading;
}

function showError(msg) {
    errorText.hidden = false;
    errorText.textContent = msg;
}

function clearError() {
    errorText.hidden = true;
    errorText.textContent = "";
}

function addLogEntry(label, prob) {
    const time = new Date().toLocaleTimeString();
    const isViolent = label === "violent";

    // If first entry, clear "No alerts yet"
    const emptyMsg = logList.querySelector(".log-empty");
    if (emptyMsg) {
        emptyMsg.remove();
    }

    const item = document.createElement("div");
    item.className = "log-item";

    const left = document.createElement("div");
    left.className = "log-label";

    const dot = document.createElement("span");
    dot.className = "dot " + (isViolent ? "dot-violent" : "dot-safe");

    const text = document.createElement("span");
    text.className = isViolent ? "log-label-violent" : "log-label-safe";
    text.textContent = isViolent
        ? `Violence detected (${prob.toFixed(2)})`
        : `Safe (${prob.toFixed(2)})`;

    left.appendChild(dot);
    left.appendChild(text);

    const timeElem = document.createElement("span");
    timeElem.className = "log-time";
    timeElem.textContent = time;

    item.appendChild(left);
    item.appendChild(timeElem);

    logList.prepend(item);
}

function updateLiveStatus(label, prob) {
    const isViolent = label === "violent";
    const dot = liveStatusBadge.querySelector(".dot");

    dot.classList.remove("dot-safe", "dot-violent");
    dot.classList.add(isViolent ? "dot-violent" : "dot-safe");

    liveStatusText.textContent = isViolent
        ? `Violence (${prob.toFixed(2)})`
        : `Safe (${prob.toFixed(2)})`;

    lastPredictionTime.textContent = new Date().toLocaleTimeString();
}

// Event handlers

uploadBtn.addEventListener("click", () => {
    videoInput.click();
});

videoInput.addEventListener("change", (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
        selectedFile = null;
        fileNameLabel.textContent = "No file selected";
        analyzeBtn.disabled = true;
        return;
    }

    selectedFile = files[0];
    fileNameLabel.textContent = selectedFile.name;
    analyzeBtn.disabled = false;
    clearError();
});

analyzeBtn.addEventListener("click", async () => {
    if (!selectedFile) {
        showError("Please select a video file first.");
        return;
    }

    clearError();
    setLoading(true);

    const formData = new FormData();
    formData.append("video", selectedFile);

    try {
        const res = await fetch(`${API_BASE_URL}/predict_clip`, {
            method: "POST",
            body: formData,
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText || "Server error");
        }

        const data = await res.json();
        const prob = data.probability;
        const label = data.label;

        // Update result card
        resultCard.hidden = false;
        resultLabel.textContent = label === "violent" ? "Violent" : "Non-violent";
        resultProb.textContent = prob.toFixed(3);

        // Update live status and logs
        updateLiveStatus(label, prob);
        addLogEntry(label, prob);
    } catch (err) {
        console.error(err);
        showError("Failed to analyze video. Check backend and try again.");
    } finally {
        setLoading(false);
    }
});
