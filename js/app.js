let deferredPrompt;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallButton();
});

function showInstallButton() {
  const installButton = document.getElementById('install-button');
  installButton.style.display = 'block';

  installButton.addEventListener('click', e => {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(choiceResult => {
      if (choiceResult.outcome === 'accepted') {
        console.log('Usuario aceptó la instalación');
      } else {
        console.log('Usuario canceló la instalación');
      }
      deferredPrompt = null;
    });
  });
}

var map = L.map('map').fitWorld();
var arrowIcon = L.divIcon({
    className: 'arrow-icon-container',
    html: '<div class="arrow-icon"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
});
var audio = new Audio('https://cdn.pixabay.com/audio/2022/03/09/audio_fb0098c6da.mp3');
var currentlyPlaying = false;
var dangerZones = [];
var addingDangerZone = false;
var firstLocationFound = false;
var currentLatLng = null;
var tracking = false;

// Verificar si es Android y mostrar el mensaje de instalación
if (navigator.userAgent.includes("Android")) {
    window.addEventListener("beforeinstallprompt", e => {
      // Evitar que Chrome 67 y versiones anteriores muestren automáticamente la notificación
      e.preventDefault();
      // Mostrar la notificación
      deferredPrompt = e;
      // Opcional: mostrar un botón o mensaje personalizado
      showInstallButton();
    });
  }
  
  function showInstallButton() {
    const installButton = document.getElementById('install-button');
    installButton.style.display = 'block';
  
    installButton.addEventListener('click', e => {
      // Mostrar la ventana de instalación
      deferredPrompt.prompt();
  
      // Esperar a que el usuario responda a la instalación
      deferredPrompt.userChoice.then(choiceResult => {
        if (choiceResult.outcome === 'accepted') {
          console.log('Usuario aceptó la instalación');
        } else {
          console.log('Usuario canceló la instalación');
        }
        deferredPrompt = null;
      });
    });
  }
  



// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCU-sQ1l2fZ6eu-2n9cADaTY8IssrSS5mg",
    authDomain: "caminoseguro-39b7c.firebaseapp.com",
    projectId: "caminoseguro-39b7c",
    storageBucket: "caminoseguro-39b7c.appspot.com",
    messagingSenderId: "855535521945",
    appId: "1:855535521945:web:06c70bfc861c428d00e808",
    measurementId: "G-ZGB3PHMWDD"
};

// Inicializar Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app(); // Si ya está inicializado, usar la instancia existente
}
const db = firebase.firestore();


L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
}).addTo(map);

var marker = L.marker(map.getCenter(), { icon: arrowIcon }).addTo(map);

function addDangerZone(lat, lng, radius) {
    // Guardar la zona peligrosa en Firestore
    db.collection("dangerZones").add({
        lat: lat,
        lng: lng,
        radius: radius
    })
    .then(function(docRef) {
        console.log("Zona peligrosa guardada", docRef.id);
        
        circle.on('click', function () {
            showCommentsForZone(docRef.id);
        });
    })
    .catch(function(error) {
        console.error("error al guardar zona", error);
    });
}

function loadDangerZone(lat, lng, radius, id) {
    var circle = L.circle([lat, lng], {
        color: 'red',
        fillColor: '#f03',
        fillOpacity: 0.2,
        radius: radius
    }).addTo(map);

    var dragMarker = L.marker([lat, lng], {
        draggable: true,
        icon: L.divIcon({ className: 'hidden-marker' })
    }).addTo(map);

    dragMarker.on('drag', function (e) {
        circle.setLatLng(e.target.getLatLng());
    });

    circle.on('click', function () {
        showCommentsForZone(id);
    });

    dangerZones.push({ circle: circle, marker: dragMarker, id: id });
}

function onLocationFound(e) {
    var latlng = e.latlng;
    currentLatLng = latlng;
    marker.setLatLng(latlng);

    if (firstLocationFound && tracking) {
        map.setView(latlng, map.getZoom());
    } else if (!firstLocationFound) {
        map.setView(latlng, 16); // Cambia el valor 16 al nivel de zoom deseado
        firstLocationFound = true;
    }

    var inDangerZone = dangerZones.some(zone => {
        var distance = map.distance(latlng, zone.circle.getLatLng());
        var radius = zone.circle.getRadius();
        
        // Calcular la membresía difusa
        var dangerLevel = getDangerLevel(distance, radius);
        
        // Ajustar el volumen del audio según el nivel de peligrosidad
        if (dangerLevel === 'high') {
            setAudioVolume(1.0); // 100%
            triggerVibration();
        } else if (dangerLevel === 'medium') {
            setAudioVolume(0.6); // 60%
        } else if (dangerLevel === 'low') {
            setAudioVolume(0.3); // 30%
        } else {
            setAudioVolume(0.0); // 0%
            stopVibration();
        }

        return distance <= radius;
    });

    if (inDangerZone) {
        if (!currentlyPlaying) {
            audio.loop = true;
            audio.play();
            currentlyPlaying = true;
        }
    } else {
        if (currentlyPlaying) {
            audio.pause();
            audio.currentTime = 0;
            currentlyPlaying = false;
            stopVibration();
        }
    }
}
const opcionesDeSolicitud = {
    enableHighAccuracy: true, // Alta precisión
    maximumAge: 0, // No queremos caché
    timeout: 5000 // Esperar solo 5 segundos
};

map.on('locationfound', onLocationFound);
L.control.locate().addTo(map);

window.addEventListener('deviceorientation', function (event) {
    var alpha = event.alpha;
    var arrow = document.querySelector('.arrow-icon');
    if (arrow) {
        arrow.style.transform = 'rotate(' + alpha + 'deg)';
    }
}, false);

document.getElementById('add-danger-zone-btn').addEventListener('click', function () {
    addingDangerZone = !addingDangerZone;
    var confirmBtn = document.getElementById('confirm-zone-btn');
    var pin = document.getElementById('center-pin');

    if (addingDangerZone) {
        document.getElementById('radius-input-container').style.display = 'block';
        this.textContent = 'Cancelar';
        confirmBtn.style.display = 'block';
        pin.style.display = 'block';
    } else {
        document.getElementById('radius-input-container').style.display = 'none';
        this.textContent = 'Nueva zona roja';
        confirmBtn.style.display = 'none';
        pin.style.display = 'none';
    }
});

document.getElementById('confirm-zone-btn').addEventListener('click', function () {
    var radius = parseInt(document.getElementById('radius-input').value, 10);
    var center = map.getCenter();
    addDangerZone(center.lat, center.lng, radius);

    document.getElementById('confirm-zone-btn').style.display = 'none';
    document.getElementById('center-pin').style.display = 'none';
    document.getElementById('radius-input-container').style.display = 'none';
    document.getElementById('add-danger-zone-btn').textContent = 'Nueva zona roja';
    addingDangerZone = false;
});

var locateControl = L.control({ position: 'bottomright' });

locateControl.onAdd = function (map) {
    var div = L.DomUtil.create('div', 'locate-btn');
    div.innerHTML = '<i class="fas fa-location-arrow"></i>';
    div.title = 'Seguir ubicación actual';
    div.onclick = function () {
        tracking = !tracking;
        div.classList.toggle('active', tracking);

        if (tracking && currentLatLng) {
            map.setView(currentLatLng, map.getZoom());
        }
    };
    return div;
};

locateControl.addTo(map);

function getDangerLevel(distance, radius) {
    var lowDanger = {
        membership: function (dist) {
            if (dist >= radius * 2 / 3) {
                return 1;
            } else if (dist > radius / 3 && dist < radius * 2 / 3) {
                return (dist - radius / 3) / (radius / 3);
            } else {
                return 0;
            }
        }
    };
    
    var mediumDanger = {
        membership: function (dist) {
            if (dist > radius / 3 && dist < radius * 2 / 3) {
                return (dist - radius / 3) / (radius / 3);
            } else if (dist >= radius * 2 / 3 && dist < radius) {
                return (radius - dist) / (radius / 3);
            } else {
                return 0;
            }
        }
    };

    var highDanger = {
        membership: function (dist) {
            if (dist <= radius / 3) {
                return 1;
            } else if (dist > radius / 3 && dist < radius * 2 / 3) {
                return (radius * 2 / 3 - dist) / (radius / 3);
            } else {
                return 0;
            }
        }
    };

    var lowMembership = lowDanger.membership(distance);
    var mediumMembership = mediumDanger.membership(distance);
    var highMembership = highDanger.membership(distance);

    if (highMembership >= mediumMembership && highMembership >= lowMembership) {
        return 'high';
    } else if (mediumMembership >= lowMembership) {
        return 'medium';
    } else {
        return 'low';
    }
}

function setAudioVolume(volume) {
    audio.volume = volume;
}

function triggerVibration() {
    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
    }
}

function stopVibration() {
    if (navigator.vibrate) {
        navigator.vibrate(0);
    }
}

// Configurar la escucha en tiempo real para las zonas peligrosas
db.collection("dangerZones").onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
            var data = change.doc.data();
            loadDangerZone(data.lat, data.lng, data.radius, change.doc.id);
        } else if (change.type === "removed") {
            var id = change.doc.id;
            var zoneIndex = dangerZones.findIndex(zone => zone.id === id);
            if (zoneIndex !== -1) {
                var zone = dangerZones[zoneIndex];
                map.removeLayer(zone.circle);
                map.removeLayer(zone.marker);
                dangerZones.splice(zoneIndex, 1);
            }
        }
    });
});

function showCommentsForZone(zoneId) {
    const commentsList = document.getElementById('comments-list');
    commentsList.innerHTML = '';

    db.collection("comments").where("zoneId", "==", zoneId).orderBy("timestamp", "desc").get()
    .then((querySnapshot) => {
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const commentItem = document.createElement('li');
            commentItem.className = 'list-group-item';
            commentItem.textContent = data.comment;
            // Mostrar la foto y el nombre del usuario
            const userPhoto = document.createElement('img');
            userPhoto.src = data.userPhoto;
            userPhoto.alt = data.userName;
            commentItem.appendChild(userPhoto);

            const userName = document.createElement('span');
            userName.textContent = data.userName;
            commentItem.appendChild(userName);
            commentsList.appendChild(commentItem);
             // Obtener información del usuario
             const userId = data.userId; 
        });
    })
    .catch(function(error) {
        console.error("Error al cargar comentarios: ", error);
    });

    // Actualizar el formulario para asociar el comentario con la zona roja
    document.getElementById('comment-form').dataset.zoneId = zoneId;
}

document.getElementById('comment-form').addEventListener('submit', function (event) {
    event.preventDefault();

    const comment = document.getElementById('comment').value;
    const zoneId = event.target.dataset.zoneId;
    const user = auth.currentUser;

    if (!zoneId) {
        alert("Por favor, selecciona una zona roja para comentar.");
        return;
    }

    // Guardar el comentario en Firestore
    db.collection("comments").add({
        userId: user.uid,
        userPhoto: user.photoURL,
        userName: user.displayName,
        comment: comment,
        zoneId: zoneId,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(function(docRef) {
        console.log("Comentario guardado con ID: ", docRef.id);
        showCommentsForZone(zoneId); // Recargar los comentarios para la zona actual
    })
    .catch(function(error) {
        console.error("Error al guardar comentario: ", error);
    });

    document.getElementById('comment-form').reset();
});

const auth = firebase.auth();


auth.onAuthStateChanged((user) => {
    if (user) {
        // El usuario está autenticado
        const userName = document.getElementById('user-name');
        const userPhoto = document.getElementById('user-photo');

        if (user.displayName) {
            userName.textContent = user.displayName;
        } else {
            userName.textContent = 'Usuario';
        }

        if (user.photoURL) {
            userPhoto.src = user.photoURL;
        } else {
            userPhoto.src = 'default-avatar.png'; // Ruta a una imagen predeterminada
        }
    } else {
        // No hay usuario autenticado, redirigir al login
        window.location.href = 'login.html';
    }
});
