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
const width = 640;
const height = 480;
let stream = null;
const video = document.getElementById('offscreen-video');

async function init() {
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

  cameraListener();
  startIntervalTask();
  startPoseMonitoring();
}

function cameraListener() {
  chrome.runtime.onMessage.addListener(async (message) => {
    if (message.target !== 'offscreen') return;

    if (message.action === 'START_CAMERA') {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;

      //Without this, the video dimensions are 0 and 0
      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          resolve();
        };
      });

      deviationCalc.setWidth(video.videoWidth);
      deviationCalc.setHeight(video.videoHeight);

      await video.play();
    }

    if (message.action === 'STOP_CAMERA') {
      if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        stream = null;
        video.srcObject = null;
        console.log("Camera hardware released.");
      }
    }
  });
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


function startIntervalTask() {
  setInterval(() => { if(stream){detect();} }, 1000);
}

async function startPoseMonitoring() {
  setInterval(() => {
    if(!stream){return;}
    const deviation = deviationCalc.calculateDeviations(referenceKeypoints, liveKeypoints); // This can be null if the keypoints are invalid
    const deviationArray = deviationCalc.getDeviationArray(deviation);
    console.log("Deviation Array: ", deviationArray);
    const status = classifier.classify(deviationArray); // ["Good", "Bad", "Unknown"]
    console.log("Status: ", status);
    chrome.runtime.sendMessage({ type: 'ICON_SET', status: status });
  }, 5000);
}

init();