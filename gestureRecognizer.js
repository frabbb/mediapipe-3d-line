import {
  GestureRecognizer,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

import p5 from "p5";

let line = [];
let angle = 0;
let lineDrawn = false;
let video;
let videoSize;
let axesH, axesW;
let font;
let landmarks;
let gestureRecognizer = undefined;
let handsLandmarks = [];
let hands = [];
let lastVideoTime = -1;
let sk;

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
  max: 30,
  easing: 0.2,
};

async function createGestureRecognizer() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );
  gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
      delegate: "GPU",
    },
    runningMode: "IMAGE",
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

  createGestureRecognizer();
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

  if (gestureRecognizer && video) {
    const video = document.querySelector("video");

    let startTimeMs = performance.now();

    if (video.currentTime !== lastVideoTime && video.currentTime) {
      handsLandmarks = gestureRecognizer.recognize(video);
      lastVideoTime = video.currentTime;
    }
  }

  sk.push();
  sk.translate(-sk.width / 2, -sk.height / 2);
  drawHands();
  sk.pop();

  angle = angle + speed.current;

  const drawPoint =
    hands[handsRef.right]?.origin || hands[handsRef.left]?.origin;

  if (drawPoint) {
    if (lineDrawn) {
      line = [];
      lineDrawn = false;
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

    // speed.target = sk.map(
    //   drawPoint.x,
    //   100 * 0.1,
    //   sk.width * 0.9,
    //   speed.max,
    //   speed.min,
    //   true
    // );
  } else if (hands[handsRef.right]?.points.length) {
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

function drawHands() {
  if (!handsLandmarks.landmarks) return;

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

const Hand = class {
  constructor(data, type) {
    this.points = [];
    this.touching = false;
    this.disconnectedFor = 0;
    this.origin = null;
    this.type = type;

    this.draw(data);
  }

  draw(data) {
    const indexFinger = data[4];
    const thumb = data[8];

    const dist = sk.dist(indexFinger.x, indexFinger.y, thumb.x, thumb.y);

    if (dist < 0.05) {
      this.touching = true;
      this.disconnectedFor = 0;
    } else if (dist < 0.2) {
      this.disconnectedFor++;
      if (this.disconnectedFor >= 5) {
        this.touching = false;
      }
    } else {
      this.touching = false;
    }

    data.map((point, index) => {
      const coords = {
        x: sk.width - point.x * videoSize.w + (videoSize.w - sk.width) / 2,
        y: point.y * videoSize.h - (videoSize.h - sk.height) / 2,
        z: point.z,
      };

      if (!this.points[index]) {
        const newPoint = new Point(coords, index, this.type);
        this.points.push(newPoint);
      } else {
        this.points[index].draw(coords, this.touching);
      }
    });

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
    this.size = 20;
    this.hand = hand;
  }

  draw(coords, touching = false) {
    this.targetPos = coords;

    Object.entries(this.targetPos).map(
      ([key, value]) => (this.pos[key] += (value - this.pos[key]) * this.easing)
    );

    sk.strokeWeight(0);

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
  }
};
