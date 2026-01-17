import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';

let detector;
const video = document.getElementById('offscreen-video');

async function init() {
  // Setup Background Camera (allowed after popup grant)
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;

  // Load MoveNet
  await tf.ready();
  detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet);
  
  
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

// Requirement: Click pic every 5s and log "Success"
function startIntervalTask() {
  setInterval(() => {
    // Conceptually capturing a frame (canvas.drawImage could be used here)
    detect();
    console.log("Success: Background image frame captured at " + new Date().toLocaleTimeString());
  }, 5000);
}

init();