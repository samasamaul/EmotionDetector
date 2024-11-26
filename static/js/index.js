const video = document.getElementById('video');
const saveFaceBtn = document.getElementById('saveFaceBtn');
const viewFacesBtn = document.getElementById('viewFacesBtn');
const clearFacesBtn = document.getElementById('clearFacesBtn');
const savedFacesContainer = document.getElementById('savedFacesContainer');

var socket = io.connect('http://127.0.0.1:5000');
socket.on('connect', function() {
  console.log("Socket connected!");
});

socket.on('disconnect', function() {
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
  console.log("access");
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

let lastDetections = null;
let canvas = null;

function calculateLandmarkDistance(landmark1, landmark2) {
  let totalDistance = 0;
  for (let i = 0; i < landmark1.length; i++) {
    const dx = landmark1[i].x - landmark2[i].x;
    const dy = landmark1[i].y - landmark2[i].y;
    totalDistance += Math.sqrt(dx * dx + dy * dy);
  }
  return totalDistance / landmark1.length;
}

function matchFace(currentLandmarks) {
  const savedFaces = JSON.parse(localStorage.getItem('faceStructures')) || [];
  const MATCH_THRESHOLD = 40; 
  const CONFIDENCE_THRESHOLD = 0.7; 

  let bestMatch = null;
  let lowestDistance = Infinity;

  for (const savedFace of savedFaces) {
    const landmarkTypes = ['jaw', 'nose', 'mouth', 'leftEye', 'rightEye'];
    let totalDistance = 0;
    let matchConfidence = 0;

    landmarkTypes.forEach(type => {
      const savedLandmarks = savedFace.landmarks[type];
      const currentTypeLandmarks = currentLandmarks[type];
      
      const distance = calculateLandmarkDistance(savedLandmarks, currentTypeLandmarks);
      totalDistance += distance;
    });

    const averageDistance = totalDistance / landmarkTypes.length;

    matchConfidence = 1 - (averageDistance / MATCH_THRESHOLD);

    if (averageDistance < MATCH_THRESHOLD && 
        matchConfidence > CONFIDENCE_THRESHOLD && 
        averageDistance < lowestDistance) {
      bestMatch = savedFace;
      lowestDistance = averageDistance;
    }
  }

  return bestMatch ? bestMatch.name : null;
}

video.addEventListener('play', () => {
  canvas = faceapi.createCanvasFromMedia(video);
  document.body.append(canvas);
  const displaySize = { width: video.width, height: video.height };
  faceapi.matchDimensions(canvas, displaySize);

  setInterval(async () => {
    const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions();

    lastDetections = detections; 

    if (detections.length > 0) {
        const expressions = detections[0].expressions;
        const dominantExpression = getDominantExpression(expressions);

        socket.emit('my event', { data: dominantExpression });

        const dominantEmoji = getEmojiForExpression(dominantExpression.name);

        const emotionLabel = document.getElementById('emotionLabel');
        
        const currentLandmarks = {
            jaw: detections[0].landmarks.getJawOutline().map(point => ({
                x: point.x,
                y: point.y
            })),
            nose: detections[0].landmarks.getNose().map(point => ({
                x: point.x,
                y: point.y
            })),
            mouth: detections[0].landmarks.getMouth().map(point => ({
                x: point.x,
                y: point.y
            })),
            leftEye: detections[0].landmarks.getLeftEye().map(point => ({
                x: point.x,
                y: point.y
            })),
            rightEye: detections[0].landmarks.getRightEye().map(point => ({
                x: point.x,
                y: point.y
            }))
        };

        const matchedName = matchFace(currentLandmarks);

        emotionLabel.textContent = `${dominantEmoji} ${matchedName ? `${matchedName}` : ''}`;

        // Gambar hasil deteksi
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
        faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

        // Tambahkan teks di kiri atas kotak wajah
        const ctx = canvas.getContext('2d');
        ctx.font = '16px Arial';
        ctx.fillStyle = 'red';
        ctx.fillText(`ID: ${matchedName ? matchedName : 'Unknown'}`, resizedDetections[0].detection.box.x, resizedDetections[0].detection.box.y - 10);
    } else {
        const emotionLabel = document.getElementById('emotionLabel');
        emotionLabel.textContent = " ";
    }
}, 500);
});

function saveStructureToLocalStorage() {
  if (!lastDetections || lastDetections.length === 0) {
    alert('Tidak ada wajah terdeteksi');
    return;
  }

  const personName = prompt('Masukkan nama untuk struktur wajah ini:');
  
  if (!personName || personName.trim() === '') {
    alert('Nama tidak boleh kosong');
    return;
  }

  const MAX_SAVED_FACES = 100;
  const MAX_CAPTURES_PER_PERSON = 5;
  const faceDetection = lastDetections[0];

  const imageDataURL = canvas.toDataURL('image/jpg');

  const faceStructure = {
    name: personName.trim(),
    // timestamp: new Date().toISOString(),
    landmarks: {
      jaw: faceDetection.landmarks.getJawOutline().map(point => ({
        x: point.x,
        y: point.y
      })),
      nose: faceDetection.landmarks.getNose().map(point => ({
        x: point.x,
        y: point.y
      })),
      mouth: faceDetection.landmarks.getMouth().map(point => ({
        x: point.x,
        y: point.y
      })),
      leftEye: faceDetection.landmarks.getLeftEye().map(point => ({
        x: point.x,
        y: point.y
      })),
      rightEye: faceDetection.landmarks.getRightEye().map(point => ({
        x: point.x,
        y: point.y
      }))
    },
    expressions: faceDetection.expressions,
    image: imageDataURL
  };

  const savedFaces = JSON.parse(localStorage.getItem('faceStructures')) || [];
  
  const existingPersonFaces = savedFaces.filter(face => face.name === personName);
  
  if (existingPersonFaces.length >= MAX_CAPTURES_PER_PERSON) {
    const indexToRemove = savedFaces.indexOf(existingPersonFaces[0]);
    savedFaces.splice(indexToRemove, 1);
  }

  if (savedFaces.length >= MAX_SAVED_FACES) {
    savedFaces.shift(); 
  }

  savedFaces.push(faceStructure);
  localStorage.setItem('faceStructures', JSON.stringify(savedFaces));

  alert(`Struktur wajah untuk ${personName} berhasil disimpan! (Capture ${existingPersonFaces.length + 1}/${MAX_CAPTURES_PER_PERSON})`);
}

function displaySavedFaces() {
  const savedFaces = JSON.parse(localStorage.getItem('faceStructures')) || [];
  savedFacesContainer.innerHTML = ''; 

  if (savedFaces.length === 0) {
    savedFacesContainer.innerHTML = '<p>Tidak ada wajah tersimpan</p>';
    return;
  }

  savedFaces.forEach((face, index) => {
    const faceItem = document.createElement('div');
    faceItem.classList.add('saved-face-item');
    
    const img = document.createElement('img');
    img.src = face.image;
    img.style.maxWidth = '150px';
    
    const details = document.createElement('div');
    details.innerHTML = `
      <p>Nama: ${face.name}</p>
      `;
      // <p>Ekspresi Dominan: ${getDominantExpression(face.expressions).name}</p>
      // <p>Timestamp: ${new Date(face.timestamp).toLocaleString()}</p>

    faceItem.appendChild(img);
    faceItem.appendChild(details);
    savedFacesContainer.appendChild(faceItem);
  });
}

function clearSavedFaces() {
  if (confirm('Apakah Anda yakin ingin menghapus semua wajah tersimpan?')) {
    localStorage.removeItem('faceStructures');
    savedFacesContainer.innerHTML = '';
    alert('Semua wajah telah dihapus');
  }
}

saveFaceBtn.addEventListener('click', saveStructureToLocalStorage);
viewFacesBtn.addEventListener('click', displaySavedFaces);
clearFacesBtn.addEventListener('click', clearSavedFaces);

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