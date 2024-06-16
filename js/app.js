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
// Inicializando Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app(); // Si ya está inicializado, utilizar la instancia existente
}
const db = firebase.firestore();

// Creando un mapa Leaflet y ajustándolo a la vista mundial
var map = L.map('map').fitWorld();
// Capa de mosaico de OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
}).addTo(map);

// Control para seguir la ubicación actual del usuario
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
// Observador de Firebase para las zonas de peligro
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
                alarmStoppedZones.delete(id);
            }
        }
    });
});

// Creando un ícono personalizado de Leaflet para el marcador del mapa
var arrowIcon = L.divIcon({
    className: 'arrow-icon-container',
    html: '<div class="arrow-icon"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
});

// Creando un elemento de audio HTML para reproducir un sonido
var audio = new Audio('https://cdn.pixabay.com/audio/2022/03/09/audio_fb0098c6da.mp3');
var currentlyPlaying = false; // Variable para rastrear si el audio está reproduciéndose actualmente
var dangerZones = []; // Array para almacenar marcadores de zonas de peligro
var addingDangerZone = false; // Bandera para el modo de agregar zona de peligro
var firstLocationFound = false; // Bandera para la primera ubicación encontrada
var currentLatLng = null; // Variable para almacenar la latitud y longitud actuales
var tracking = false; // Variable para rastrear si el seguimiento de ubicación está activo

// Comprobando si el agente de usuario es Android y mostrando el mensaje de instalación
if (navigator.userAgent.includes("Android")) {
    // Evento para mostrar el botón de instalación
    window.addEventListener("beforeinstallprompt", e => {
        e.preventDefault(); // Evitando el comportamiento predeterminado
        showInstallButton(); // Mostrando el botón de instalación
    });
}
// Función para mostrar el botón de instalación
function showInstallButton() {
    const installButton = document.getElementById('install-button');
    installButton.style.display = 'block'; // Mostrando el botón de instalación

    // Evento para hacer clic en el botón de instalación
    installButton.addEventListener('click', e => {
        deferredPrompt.prompt(); // Solicitando la instalación
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

// Función para agregar una zona de peligro a Firebase
function addDangerZone(lat, lng, radius) {
    db.collection("dangerZones").add({
        lat: lat,
        lng: lng,
        radius: radius
    })
        .then(function (docRef) {
            console.log("Zona peligrosa guardada", docRef.id);

            circle.on('click', function () {
                showCommentsForZone(docRef.id);
            });
        })
        .catch(function (error) {
            console.error("error al guardar zona", error);
        });
}

// Función para cargar una zona de peligro desde Firebase
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

    // Evento al arrastrar el marcador
    dragMarker.on('drag', function (e) {
        circle.setLatLng(e.target.getLatLng());
    });

    // Evento al hacer clic en el círculo
    circle.on('click', function () {
        showCommentsForZone(id);
    });

    dangerZones.push({ circle: circle, marker: dragMarker, id: id });
}

// Función para manejar la ubicación encontrada
function onLocationFound(e) {
    var latlng = e.latlng;
    currentLatLng = latlng;
    marker.setLatLng(latlng);

    if (firstLocationFound && tracking) {
        map.setView(latlng, map.getZoom());
    } else if (!firstLocationFound) {
        map.setView(latlng, 16);
        firstLocationFound = true;
    }

    var inDangerZone = dangerZones.some(zone => {
        var distance = map.distance(latlng, zone.circle.getLatLng());
        var radius = zone.circle.getRadius();
        var dangerLevel = getDangerLevel(distance, radius);

        // Cambiar el volumen del audio y activar la vibración según el nivel de peligro
        if (dangerLevel === 'high') {
            setAudioVolume(1.0);
            triggerVibration();
        } else if (dangerLevel === 'medium') {
            setAudioVolume(0.6);
        } else if (dangerLevel === 'low') {
            setAudioVolume(0.3);
        } else {
            setAudioVolume(0.0);
            stopVibration();
        }

        return distance <= radius;
    });

    // Reproducir el audio si se encuentra en una zona de peligro
    if (inDangerZone) {
        if (!currentlyPlaying) {
            audio.loop = true;
            audio.play();
            currentlyPlaying = true;
            document.getElementById('stop-alarm-btn').style.display = 'block';
        }
    } else {
        // Detener el audio si no se encuentra en una zona de peligro
        if (currentlyPlaying) {
            audio.pause();
            audio.currentTime = 0;
            currentlyPlaying = false;
            stopVibration();
        }
    }
}

// Opciones para la solicitud de geolocalización
const opcionesDeSolicitud = {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 5000
};
// Evento cuando se encuentra la ubicación
map.on('locationfound', onLocationFound);
// Función para manejar errores de geolocalización
function handleError(error) {
    console.error('Error al obtener la geolocalización:', error);
}
// Obtener la ubicación del usuario si el navegador lo permite
if (navigator.geolocation) {
    navigator.geolocation.watchPosition(function (position) {
        onLocationFound({
            latlng: {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            }
        });
    }, handleError, opcionesDeSolicitud);
} else {
    console.error('La geolocalización no es soportada por este navegador.');
}
// Función para manejar el evento de orientación del dispositivo
function handleOrientation(event) {
    var alpha = event.alpha;
    var arrow = document.querySelector('.arrow-icon');
    if (arrow) {
        arrow.style.transform = 'rotate(' + alpha + 'deg)';
    }
}
window.addEventListener("deviceorientation", handleOrientation, false);



// Evento para cambiar al modo de agregar zona de peligro
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

// Evento para confirmar la creación de una nueva zona de peligro
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

// Función para calcular el nivel de peligro según la distancia y el radio
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

// Función para ajustar el volumen del audio
function setAudioVolume(volume) {
    audio.volume = volume;
}
// Función para activar la vibración
function triggerVibration() {
    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
    }
}
// Función para detener la vibración
function stopVibration() {
    if (navigator.vibrate) {
        navigator.vibrate(0);
    }
}

// Evento para enviar un comentario sobre una zona de peligro
document.getElementById('comment-form').addEventListener('submit', function (event) {
    event.preventDefault();

    const comment = document.getElementById('comment').value;
    const zoneId = event.target.dataset.zoneId;
    const user = auth.currentUser;

    if (!zoneId) {
        alert("Por favor, selecciona una zona roja para comentar.");
        return;
    }

    db.collection("comments").add({
        userId: user.uid,
        userPhoto: user.photoURL,
        userName: user.displayName,
        comment: comment,
        zoneId: zoneId,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
        .then(function (docRef) {
            console.log("Comentario guardado con ID: ", docRef.id);
            showCommentsForZone(zoneId);
        })
        .catch(function (error) {
            console.error("Error al guardar comentario: ", error);
        });

    document.getElementById('comment-form').reset();
});

// Función para mostrar los comentarios de una zona de peligro
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
                const userPhoto = document.createElement('img');
                userPhoto.src = data.userPhoto;
                userPhoto.alt = data.userName;
                commentItem.appendChild(userPhoto);

                const userName = document.createElement('span');
                userName.textContent = data.userName;
                commentItem.appendChild(userName);
                commentsList.appendChild(commentItem);
            });
        })
        .catch(function (error) {
            console.error("Error al cargar comentarios: ", error);
        });

    document.getElementById('comment-form').dataset.zoneId = zoneId;
}

// Observador de autenticación de Firebase
const auth = firebase.auth();

auth.onAuthStateChanged((user) => {
    if (user) {
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
            userPhoto.src = 'default-avatar.png';
        }
    } else {
        window.location.href = 'login.html'; // Redirigir al usuario a la página de inicio de sesión
    }
});

// Marcador en el centro del mapa
var marker = L.marker(map.getCenter(), { icon: arrowIcon }).addTo(map);