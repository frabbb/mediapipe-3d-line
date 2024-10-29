import {
  HandLandmarker,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

import p5 from "p5";

let line = [];
let angle = 0;
let lineDrawn = false;
let video;
let videoSize;
let axesH, axesW;
let hands = [];
let font;
let landmarks;

let handLandmarker = undefined;
let lastVideoTime = -1;

let canvas;
let sk;

let touching = false;
let disconnected = 0;

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

new p5((instance) => (sk = instance));

sk.preload = () => {
  font = sk.loadFont("/mediapipe-3d-line/assets/SpaceMono-Regular.ttf");
};

sk.setup = () => {
  canvas = sk.createCanvas(sk.windowWidth, sk.windowHeight, sk.WEBGL);
  axesH = sk.height / 3;
  axesW = sk.min(sk.width / 2, axesH);

  sk.angleMode(sk.DEGREES);
  sk.imageMode(sk.CENTER);
  sk.textFont(font);
  sk.textSize(16);
  sk.textAlign(sk.CENTER);

  sk.stroke("black");
  sk.strokeWeight(2);

  video = sk.createCapture(sk.VIDEO);

  createHandLandmarker();
};

sk.draw = () => {
  sk.clear();

  videoSize = {
    w:
      sk.width > sk.height
        ? sk.width
        : (sk.height / video.height) * video.width,
    h:
      sk.height > sk.width
        ? sk.height
        : (sk.width / video.width) * video.height,
  };

  // sk.image(video, 0, 0, videoSize.w, videoSize.h);

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

  angle = angle + 75;

  if (point) {
    if (lineDrawn) {
      line = [];
      lineDrawn = false;
    }

    let x = (point.x - sk.width / 2) * sk.cos(angle);
    let y = point.y - sk.height / 2;
    let z = (point.x - sk.width / 2) * sk.sin(angle);

    line.push([x, y, z]);
  } else if (landmarks?.length) {
    lineDrawn = !!line.length;
  }

  if (angle == 360) {
    angle = 0;
  }
  sk.rotateY(angle);
  sk.stroke(255);

  sk.strokeWeight(5);
  sk.beginShape();
  sk.noFill();

  for (let i = 0; i < line.length; i++) {
    let [x, y, z] = line[i];
    sk.vertex(x, y, z);
  }

  sk.endShape();

  sk.line(axesW, 0, 0, -axesW, 0, 0);
  sk.line(0, axesH, 0, 0, -axesH, 0);
  sk.pop();
};

let points = [];

function drawKeypoints() {
  if (!hands.landmarks) return;
  landmarks = hands.landmarks;

  for (const hand of landmarks) {
    const indexFinger = hand[4];
    const thumb = hand[8];

    const dist = sk.dist(indexFinger.x, indexFinger.y, thumb.x, thumb.y);

    if (dist < 0.05) {
      touching = true;
      disconnected = 0;
    } else if (dist < 0.2) {
      disconnected++;
      if (disconnected >= 40) {
        touching = false;
      }
    } else {
      touching = false;
    }

    hand.map((point, index) => {
      const coords = {
        x: sk.width - point.x * videoSize.w + (videoSize.w - sk.width) / 2,
        y: point.y * videoSize.h - (videoSize.h - sk.height) / 2,
        z: point.z,
      };

      if (!points[index]) {
        const newPoint = new Point(coords, index);
        points.push(newPoint);
      } else {
        points[index].draw(coords, touching);
      }
    });

    if (touching && points[8]) {
      return {
        x: (points[4].pos.x + points[8].pos.x) / 2,
        y: (points[4].pos.y + points[4].pos.y) / 2,
      };
    }
  }
}

const Point = class {
  constructor(coords, index) {
    this.targetPos = coords;
    this.pos = coords;
    this.index = index;
    this.easing = 0.1;
    this.size = 20;

    // this.draw(coords);
  }

  draw(coords, touching = false) {
    this.targetPos = coords;

    Object.entries(this.targetPos).map(
      ([key, value]) => (this.pos[key] += (value - this.pos[key]) * this.easing)
    );

    this.size = sk.map(this.pos.z, -0.1, 0, 50, 20, true);

    sk.strokeWeight(0);

    sk.fill(0, 0, 0);

    if (touching) {
      sk.fill(0, 255, 0);
    }

    sk.ellipse(this.pos.x, this.pos.y, this.size, this.size);
    sk.fill(255);
    sk.text(this.index, this.pos.x, this.pos.y);
  }
};
