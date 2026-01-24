import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';

let detector;
const video = document.getElementById('offscreen-video');

async function init() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;

  await new Promise((resolve) => {
  video.onloadedmetadata = resolve;
  });
  await video.play();

  await tf.ready();
  const detectorConfig = {
  // 1. Switch to Thunder for higher accuracy
  modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
  // 2. Enable temporal smoothing for less jitter
  enableSmoothing: true
};

  detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, detectorConfig);
  
  await setupEventListeners();
  startIntervalTask();
}

async function detect() {
  const poses = await detector.estimatePoses(video);
  if (poses.length > 0) {
    // Broadcast data to the entire extension (like the popup)
    chrome.runtime.sendMessage({ type: 'POSE_DATA', data: poses[0] });
  }
  requestAnimationFrame(detect);
}

async function setupEventListeners() {
  // Remove 'async' from the listener declaration
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
    if (request.action === "getReferenceKeypoints") {
      // Create an internal async IIFE or call an async function
      (async () => {
        try {
          const calibratedPose = await detector.estimatePoses(video);
          
          const referenceKeypoints = {
            timestamp: new Date().toISOString(),
            status: "Active",
            payload: calibratedPose[0].keypoints
          };
          
          // Now sendResponse will work because 'return true' kept the channel open
          sendResponse(referenceKeypoints);
        } catch (error) {
          console.error("Pose estimation failed:", error);
          sendResponse({ status: "Error", error: error.message });
        }
      })();

      // CRITICAL: Return true synchronously to keep the channel open
      return true; 
    }
  });
}

// Requirement: Click pic every 5s and log "Success"
function startIntervalTask() {
  setInterval(() => {
    // Conceptually capturing a frame (canvas.drawImage could be used here)
    detect();
    console.log("Success: Background image frame captured at " + new Date().toLocaleTimeString());
  }, 1000);
}

init();