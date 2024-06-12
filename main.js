import {
  HandLandmarker,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

let Line = [];
let angle = 0;
let rotationXstart;
let rotationYstart;
let rotationZstart;
let lineDrawn = false;
let video;
let axesH, axesW;
let hands = [];

let handLandmarker = undefined;
let lastVideoTime = -1;

let canvas;

async function createHandLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 1,
  });
}

new p5((sk) => {
  sk.setup = () => {
    canvas = sk.createCanvas(sk.windowWidth, sk.windowHeight, sk.WEBGL);
    axesH = sk.height / 3;
    axesW = sk.min(sk.width / 2, axesH);

    sk.angleMode(sk.DEGREES);
    sk.imageMode(sk.CENTER);

    sk.stroke("black");
    sk.strokeWeight(2);

    video = sk.createCapture(sk.VIDEO, { flipped: true });

    createHandLandmarker();
  };

  sk.draw = () => {
    sk.clear();
    sk.push();

    if (handLandmarker && video) {
      const video = document.querySelector("video");

      let startTimeMs = performance.now();

      if (video.currentTime !== lastVideoTime && video.currentTime) {
        hands = handLandmarker.detectForVideo(video, startTimeMs);
        lastVideoTime = video.currentTime;
      }
    }

    sk.push();
    sk.translate(-sk.width / 2, -sk.height / 2);
    const point = drawKeypoints();
    sk.pop();

    if (point) {
      if (lineDrawn) {
        Line = [];
        lineDrawn = false;
      }

      angle = angle + 2;

      let x = (point.x - sk.width / 2) * sk.cos(angle);
      let y = point.y - sk.height / 2;
      let z = (point.x - sk.width / 2) * sk.sin(angle);

      Line.push([x, y, z]);

      rotationXstart = sk.rotationX;
      rotationYstart = sk.rotationY;
      rotationZstart = sk.rotationZ;
    } else {
      lineDrawn = !!Line.length;

      angle += 0.5;

      sk.rotateX(sk.rotationX - rotationXstart);
      sk.rotateY(sk.rotationY - rotationYstart);
      sk.rotateZ(sk.rotationZ - rotationZstart);
    }

    if (angle == 360) {
      angle = 0;
    }
    sk.rotateY(angle);
    sk.beginShape();
    sk.noFill();

    for (let i = 0; i < Line.length; i++) {
      let [x, y, z] = Line[i];
      sk.vertex(x, y, z);
    }

    sk.endShape();

    sk.strokeWeight(1);
    sk.line(axesW, 0, 0, -axesW, 0, 0);
    sk.line(0, axesH, 0, 0, -axesH, 0);
    sk.pop();
  };

  function drawKeypoints() {
    if (!hands.landmarks) return;

    for (const landmarks of hands.landmarks) {
      const indexFinger = landmarks[4];
      const thumb = landmarks[8];
      for (const point of landmarks) {
        // sk.ellipse(point.x * sk.width, point.y * sk.height, 10, 10);
      }
      if (sk.dist(indexFinger.x, indexFinger.y, thumb.x, thumb.y) < 0.1) {
        return {
          x: ((indexFinger.x + thumb.x) / 2) * sk.width,
          y: ((indexFinger.y + thumb.y) / 2) * sk.height,
        };
      }
    }
  }
});
