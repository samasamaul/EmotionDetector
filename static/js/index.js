const video = document.getElementById('video');

var socket = io.connect('http://127.0.0.1:5000');
socket.on('connect', function () {
  console.log("Socket connected!");
});

socket.on('disconnect', function () {
  console.log("Socket disconnected");
});

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

Promise.all([
  faceapi.loadFaceLandmarkModel("http://127.0.0.1:5000/static/models/"),
  faceapi.loadFaceRecognitionModel("http://127.0.0.1:5000/static/models/"),
  faceapi.loadTinyFaceDetectorModel("http://127.0.0.1:5000/static/models/"),
  faceapi.loadFaceExpressionModel("http://127.0.0.1:5000/static/models/"),
])
  .then(startVideo)
  .catch(err => console.error("Error loading models:", err));

function startVideo() {
  console.log("Access");
  navigator.getUserMedia(
    { video: {} },
    stream => {
      console.log("Video stream started");
      video.srcObject = stream;
    },
    err => {
      console.error("Error accessing camera:", err);
    }
  );
}

video.addEventListener('play', () => {
    const canvas = faceapi.createCanvasFromMedia(video);
    document.body.append(canvas);
    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(canvas, displaySize);

    setInterval(async () => {
        const detections = await faceapi
            .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceExpressions();

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (detections.length > 0) {
            const resizedDetections = faceapi.resizeResults(detections, displaySize);

            faceapi.draw.drawDetections(canvas, resizedDetections);
            faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
            // faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

            resizedDetections.forEach(detection => {
                const box = detection.detection.box;
                const expressions = detection.expressions;
                const dominantExpression = getDominantExpression(expressions);
                const emoji = getEmojiForExpression(dominantExpression.name);

                ctx.font = '20px Arial';
                ctx.fillText(emoji, box.x + box.width / 2 - 10, box.y - 10);

                socket.emit('my event', { data: dominantExpression });
            });
        }
    }, 500);
});


function getDominantExpression(expressions) {
  let maxExpression = { name: '', score: -Infinity };

  for (const [expression, score] of Object.entries(expressions)) {
    if (score > maxExpression.score) {
      maxExpression = { name: expression, score: score };
    }
  }

  return maxExpression;
}

function getEmojiForExpression(expression) {
  const emojiMap = {
    'Datar': '😐',
    'Senang': '😁',
    'Sedih': '😢',
    'Marah': '😡',
    'Takut': '😨',
    'Jijik': '🤢',
    'Terkejut': '😲'
  };

  return emojiMap[expression] || '🤷‍♂️';
}