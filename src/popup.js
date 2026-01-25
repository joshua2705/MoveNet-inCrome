const video = document.getElementById('popup-video');
const canvas = document.getElementById('popup-canvas');
const ctx = canvas.getContext('2d');
const btn = document.getElementById('toggle-btn');
const calibrateBtn = document.getElementById('calibrate-btn');
const statusText = document.getElementById('status-text');
let isTracking = false;
let isCalibrated = false;
let referenceKeypoints = null;

async function init() {

  statusText.textContent = 'Calibrate to start';
  btn.disabled = false;

  // 1. Request camera immediately to grant permission to the extension origin
  await navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    };
  }).catch(error => { statusText.textContent = `Error: ${error.message}` });


  // Load saved reference if exists
  chrome.storage.local.get(['referenceKeypoints'], (result) => {
    if (result.referenceKeypoints) {
      referenceKeypoints = result.referenceKeypoints;
      btn.disabled = false;
      statusText.textContent = 'Reference loaded. Ready to monitor.';
    }
  });

  // Load listeners
  setupEventListeners();

}

function setupEventListeners() {
  calibrateBtn.addEventListener('click', calibrate);
  btn.addEventListener('click', startMonitoring);

  // Listen for live posture check requests from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'POSE_DATA' && isTracking) {
    console.log("Test variables: ", message.data.keypoints);
    drawPose(message.data.keypoints);
  }
});

}

init();

//Monitoring listener
function startMonitoring() {
  isTracking = !isTracking;
  btn.innerText = isTracking ? "Stop MoveNet" : "Start MoveNet";
  btn.style.backgroundColor = isTracking ? "#fd6359ff" : "#74f578ff";
  if (!isTracking) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// calibrate function
async function calibrate() {
  try {
    calibrateBtn.disabled = true;
    statusText.textContent = 'Calibrating... Sit in good posture!';

    // Wait 2 seconds for user to adjust
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Capture reference pose
    referenceKeypoints = await fetchReferenceKeypoints();

    if (!hasValidUpperBodyPose(referenceKeypoints)) {
      throw new Error('Could not detect upper body. Please ensure your face and shoulders are visible.');
    }

    // Save reference
    chrome.storage.local.set({ referenceKeypoints });

    statusText.textContent = 'Calibration complete! You can now start monitoring.';
    calibrateBtn.disabled = false;

    // Notify background of recalibration
    chrome.runtime.sendMessage({ action: 'recalibrate' });

  } catch (error) {
    statusText.textContent = `Error: ${error.message}`;
    calibrateBtn.disabled = false;
  }
}


async function fetchReferenceKeypoints() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: "getReferenceKeypoints",
      target: "offscreen"
    });

    if (response) {
      console.log("Data received from offscreen:", response);
      return response.payload;
    } else {
      console.warn("No response received. Is the offscreen document open?", response);
    }
  } catch (error) {
    console.error("Messaging error:", error);
  }
}

function hasValidUpperBodyPose(keypoints) {

  console.log("Keypoints received:", keypoints);

  const requiredKeypoints = [0, 3, 4, 5, 6]; // nose, ears, shoulders
  return requiredKeypoints.every(idx => keypoints[idx].score > 0.3);
}


// 4. Receive Pose Data from the Offscreen Document
function drawPose(keypoints) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  keypoints.forEach(kp => {
    if (kp.score > 0.3) {
      // Calculate the mirrored X coordinate
      const mirroredX = canvas.width - kp.x;

      ctx.fillStyle = 'lime';
      ctx.beginPath();

      // Use mirroredX instead of kp.x
      ctx.arc(mirroredX, kp.y, 4, 0, 2 * Math.PI);

      ctx.fill();
    }
  });
}