import '@tensorflow/tfjs-backend-webgl';
import * as tf from '@tensorflow/tfjs-core';
import * as poseDetection from '@tensorflow-models/pose-detection';

import DeviationCalculator from './deviationCalulator.js';
import PostureClassifier from './postureClassifier.js';

let detector;
let deviationCalc = null;
let classifier = null;
let referenceKeypoints = null;
let liveKeypoints = null;
let width = 0;
let height = 0;
const video = document.getElementById('offscreen-video');

async function init() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
  width = video.videoWidth;
  height = video.videoHeight;

  await new Promise((resolve) => {
    video.onloadedmetadata = resolve;
  });
  await video.play();

  await tf.setBackend('webgl');
  await tf.ready();
  
  const detectorConfig = {
    modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
    enableSmoothing: true
  };

  detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, detectorConfig);

  await setupEventListeners();
  deviationCalc = new DeviationCalculator(width, height);
  classifier = new PostureClassifier();
  await classifier.loadModel();

  startIntervalTask();
  startPoseMonitoring();
}

async function detect() {
  const poses = await detector.estimatePoses(video);
  if (poses.length > 0) {
    liveKeypoints = poses[0].keypoints;
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
          referenceKeypoints = calibratedPose[0].keypoints;

          // Create a response object
          const referenceKeypointsObj = {
            timestamp: new Date().toISOString(),
            status: "Active",
            payload: referenceKeypoints
          };

          // Now sendResponse will work because 'return true' kept the channel open
          sendResponse(referenceKeypointsObj);
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
    detect();
    console.log("Success: Background image frame captured at " + new Date().toLocaleTimeString());
  }, 1000);
}

async function startPoseMonitoring() {
  setInterval(() => {
    const deviation = deviationCalc.calculateDeviations(referenceKeypoints, liveKeypoints); // This can be null if the keypoints are invalid
    const status = classifier.classify(deviation); // ["Good", "Bad", "Unknown"]
    chrome.runtime.sendMessage({ type: 'ICON_SET', status: status });
  }, 5000);
}

init();