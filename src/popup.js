const video = document.getElementById('popup-video');
const canvas = document.getElementById('popup-canvas');
const ctx = canvas.getContext('2d');
const btn = document.getElementById('toggle-btn');
let isTracking = false;

// 1. Request camera immediately to grant permission to the extension origin
navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
  video.srcObject = stream;
  video.onloadedmetadata = () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  };
}).catch(console.error);

// 2. Button to start MoveNet
btn.onclick = () => {
  isTracking = !isTracking;
  btn.innerText = isTracking ? "Stop MoveNet" : "Start MoveNet";
  if (!isTracking) ctx.clearRect(0, 0, canvas.width, canvas.height);
};

// 3. Receive Pose Data from the Offscreen Document
chrome.runtime.onMessage.addListener((message) => {
  console.log("Test variables: ", message);
  if (message.type === 'POSE_DATA' && isTracking) {
    console.log("Test variables: ", message.data.keypoints);
    drawPose(message.data.keypoints);
  }
});

function drawPose(keypoints) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  keypoints.forEach(kp => {
    if (kp.score > 0.5) {
      ctx.fillStyle = 'lime';
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, 4, 0, 2 * Math.PI);
      ctx.fill();
    }
  });
}