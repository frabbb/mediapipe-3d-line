import {
  HandLandmarker,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

import p5 from "p5";

import { clamp, map } from "./utils";

let line = [];
let angle = 0;
let lineDrawn = false;
let video;
let videoSize;
let axesH, axesW;
let font;
let handLandmarker = undefined;
let handsLandmarks = [];
let hands = [];
let lastVideoTime = -1;
let sk;

let settingsEl = document.querySelector(".settings");
let rangeEl = document.querySelector(".range");
let speedEl = document.querySelector(".value");
let showSettings = false;

let draw = {
  current: undefined,
  target: undefined,
  easing: 0.5,
};

const handsRef = {
  left: 1,
  right: 0,
};

let speed = {
  default: 5,
  target: 5,
  current: 5,
  min: 0,
  max: 50,
  easing: 0.2,
};

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
  sk.createCanvas(sk.windowWidth, sk.windowHeight, sk.WEBGL);
  axesH = sk.height / 3;
  axesW = sk.min(sk.width / 2, axesH);

  sk.angleMode(sk.DEGREES);
  sk.imageMode(sk.CENTER);
  sk.textFont(font);
  sk.textSize(16);
  sk.textAlign(sk.CENTER);

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

  sk.push();

  if (handLandmarker && video) {
    const video = document.querySelector("video");

    let startTimeMs = performance.now();

    if (video.currentTime !== lastVideoTime && video.currentTime) {
      handsLandmarks = handLandmarker.detectForVideo(video, startTimeMs);
      lastVideoTime = video.currentTime;
    }
  }

  sk.push();
  sk.translate(-sk.width / 2, -sk.height / 2);
  drawHands();
  sk.pop();

  if (
    ([
      // hands[handsRef.right]?.openPalmCounter,
      hands[handsRef.left]?.openPalmCounter,
    ].includes(30) &&
      !showSettings) ||
    ([
      // hands[handsRef.right]?.openPalmCounter,
      hands[handsRef.left]?.openPalmCounter,
    ].every((v) => !v) &&
      showSettings)
  ) {
    toggleSettings();
  }

  if (showSettings) {
    const point = hands[handsRef.left]?.points[0];
    // hands[handsRef.right]?.points[0] ||

    speed.target = Math.round(
      map(point.pos.x, 100, window.innerWidth - 100, speed.min, speed.max, true)
    );

    rangeEl.style.width = `${(speed.target / speed.max) * 100}%`;
    speedEl.innerHTML = speed.target;
  }

  angle = angle + speed.current;

  const drawPoint = hands[handsRef.right]?.origin;
  // || hands[handsRef.left]?.origin;

  if (drawPoint && !showSettings) {
    if (lineDrawn) {
      line = [];
      lineDrawn = false;
      draw.current = undefined;
      draw.target = undefined;
    }

    draw.target = drawPoint;

    if (!draw.current) {
      draw.current = draw.target;
    } else {
      for (const [key, value] of Object.entries(draw.current)) {
        draw.current[key] = value + (draw.target[key] - value) * draw.easing;
      }
    }

    let x = (draw.current.x - sk.width / 2) * sk.cos(angle);
    let y = draw.current.y - sk.height / 2;
    let z = (draw.current.x - sk.width / 2) * sk.sin(angle);

    line.push([x, y, z]);
  } else if (
    hands[handsRef.right]?.points.length ||
    hands[handsRef.left]?.points.length
  ) {
    lineDrawn = !!line.length;
  }

  speed.current += (speed.target - speed.current) * speed.easing;

  angle = angle + speed.current;

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

  sk.stroke(255, 255, 255, 200);
  sk.line(axesW, 0, 0, -axesW, 0, 0);
  sk.line(0, axesH, 0, 0, -axesH, 0);
  sk.pop();
};

function toggleSettings() {
  showSettings = !showSettings;
  settingsEl.classList.toggle("open");
}

function drawHands() {
  if (!handsLandmarks.landmarks?.length) {
    Object.values(hands).forEach((hand) => {
      hand.openPalmCounter = clamp(hand.openPalmCounter - 1, 0, 30);
    });
    return;
  }

  handsLandmarks.landmarks.forEach((handData, index) => {
    const type = handsLandmarks.handednesses[index][0].index;

    const hand = hands[type];

    if (!hand) {
      hands[type] = new Hand(handData, type);
    } else {
      hand.draw(handData);
    }
  });
}

function isFingerExtended(points, tolerance = 0.2) {
  const vectors = [];
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    vectors.push({ dx, dy });
  }

  for (let i = 0; i < vectors.length - 1; i++) {
    const angle = Math.abs(
      Math.atan2(vectors[i + 1].dy, vectors[i + 1].dx) -
        Math.atan2(vectors[i].dy, vectors[i].dx)
    );

    if (angle > tolerance) return false;
  }

  return true;
}

function triangleArea(a, b, c) {
  return Math.abs(
    0.5 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y))
  );
}

const Hand = class {
  constructor(data, type) {
    this.points = [];
    this.touching = false;
    this.indexThumbCounter = 0;
    this.openPalmCounter = 0;
    this.origin = null;
    this.type = type;

    this.draw(data);
  }

  draw(data) {
    const indexFinger = data[4];
    const thumb = data[8];
    const thumbIndexDist = sk.dist(
      indexFinger.x,
      indexFinger.y,
      thumb.x,
      thumb.y
    );

    if (thumbIndexDist < 0.05) {
      this.indexThumbCounter++;
    } else if (thumbIndexDist < 0.2) {
      this.indexThumbCounter--;
    } else {
      this.indexThumbCounter = 0;
    }

    this.indexThumbCounter = clamp(this.indexThumbCounter, 0, 15);

    this.touching =
      this.indexThumbCounter === 15
        ? true
        : this.indexThumbCounter === 0
        ? false
        : this.touching;

    let openPalm = !this.touching;

    const palmHeight = sk.dist(
      ...Object.values(data[0]),
      ...Object.values(data[17])
    );
    const palmPoints = [0, 5, 17];

    const palmArea = triangleArea(
      data[palmPoints[0]],
      data[palmPoints[1]],
      data[palmPoints[2]]
    );

    const palmExtended = ((palmHeight * palmHeight * 0.5) / 2) * 0.7 < palmArea;

    openPalm = openPalm && palmExtended;

    for (let f = 5; f < data.length; f += 4) {
      const fingerPoints = [data[f], data[f + 1], data[f + 2], data[f + 3]];

      const fingerExtended = isFingerExtended(fingerPoints);

      openPalm = openPalm && fingerExtended;
    }

    this.openPalmCounter = clamp(
      this.openPalmCounter + (openPalm ? 1 : -1),
      0,
      30
    );

    function mapCoords(point) {
      return {
        x: sk.width - point.x * videoSize.w + (videoSize.w - sk.width) / 2,
        y: point.y * videoSize.h - (videoSize.h - sk.height) / 2,
        z: 0,
      };
    }

    let increment = 1;

    for (let f = 0; f < data.length; f += increment) {
      if (f === 1) {
        increment = 4;
      }

      sk.beginShape();
      for (let i = f; i < f + increment; i++) {
        let point = data[i];
        const coords = mapCoords(point);

        if (!this.points[i]) {
          const newPoint = new Point(coords, i, this.type);
          this.points[i] = newPoint;
        } else {
          this.points[i].update(coords);
        }

        sk.vertex(...Object.values(coords));

        sk.strokeWeight(10);
        sk.stroke(openPalm ? 0 : 255, 255, openPalm ? 0 : 255);
        sk.noFill();
      }

      if (f === 0) {
        const palmPoints = [0, 1, 5, 9, 13, 17, 0];

        palmPoints.forEach((p) =>
          sk.vertex(...Object.values(mapCoords(data[p])))
        );
      }

      sk.endShape();
    }

    for (let p = 0; p < data.length; p++) {
      this.points[p].draw(this.touching);
    }

    this.origin = this.touching
      ? {
          x: (this.points[4].pos.x + this.points[8].pos.x) / 2,
          y: (this.points[4].pos.y + this.points[4].pos.y) / 2,
        }
      : null;
  }
};

const Point = class {
  constructor(coords, index, hand) {
    this.targetPos = coords;
    this.pos = coords;
    this.index = index;
    this.easing = 1;
    this.size = 15;
    this.hand = hand;
  }

  update(coords) {
    this.targetPos = coords;
  }

  draw(touching = false) {
    Object.entries(this.targetPos).map(
      ([key, value]) => (this.pos[key] += (value - this.pos[key]) * this.easing)
    );

    sk.strokeWeight(10);

    sk.fill(
      this.hand === handsRef.right ? 255 : 0,
      0,
      this.hand === handsRef.left ? 255 : 0
    );

    if (touching && [8, 4].includes(this.index)) {
      sk.fill(0, 255, 0);
    }

    sk.ellipse(this.pos.x, this.pos.y, this.size, this.size);
    sk.fill(255);
    // sk.text(Math.round(this.pos.z * 100) / 100, this.pos.x, this.pos.y);
    // sk.text(this.index, this.pos.x, this.pos.y);
  }
};
