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
var trazarRutaMode = false;
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
    var bbox = calculateBbox(lat, lng, radius);
    db.collection("dangerZones").add({
        lat: lat,
        lng: lng,
        radius: radius,
        bbox: bbox.join(',')
    })
        .then(function (docRef) {
            console.log("Zona peligrosa guardada", docRef.id);

            
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
        const commentForm = document.getElementById('comment-form');
        commentForm.dataset.zoneId = id;
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
        origin.lat = position.coords.latitude
        origin.lng = position.coords.longitude
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

var modal = document.getElementById('modal');
var openRadio = document.getElementById('add-danger-zone-btn');

openRadio.addEventListener('click', function() {
    modal.style.display = 'block';
});

document.getElementById('submitButton').addEventListener('click',function name() {
    var modal = document.getElementById('modal');
    modal.style.display = 'none';
})

// Evento para cambiar al modo de agregar zona de peligro
document.getElementById('add-danger-zone-btn').addEventListener('click', function () {
    addingDangerZone = !addingDangerZone;
    var confirmBtn = document.getElementById('confirm-zone-btn');
    var pin = document.getElementById('center-pin');

    if (addingDangerZone) {
        
        this.textContent = 'Cancelar';
        confirmBtn.style.display = 'block';
        pin.style.display = 'block';
    } else {
        
        confirmBtn.style.display = 'none';
        pin.style.display = 'none';
    }
});

// Evento para cambiar al modo de TRAZAR RUTA
document.getElementById('ruta-btn').addEventListener('click', function () {
    var pin = document.getElementById('center-pin');
    pin.style.display = "block"
});





// Evento para confirmar la creación de una nueva zona de peligro
document.getElementById('confirm-zone-btn').addEventListener('click', function () {
    var radius = parseInt(document.getElementById('numberInput').value, 10);
    var center = map.getCenter();
    addDangerZone(center.lat, center.lng, radius);
    document.getElementById('add-danger-zone-btn').innerHTML = '<i class="fas fa-plus"></i>';
    document.getElementById('center-pin').style.display = 'none';
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
    document.getElementById('map').style.height = '67%';
    document.getElementById('bottom-right-buttons').style.bottom = '43%';
    document.getElementById('commentPanel').style.display = 'block'
    
    const commentsList = document.getElementById('comments-list');
    commentsList.innerHTML = ''; // Limpiar la lista de comentarios antes de agregar nuevos

    db.collection("comments").where("zoneId", "==", zoneId).orderBy("timestamp", "desc").get()
        .then((querySnapshot) => {
            querySnapshot.forEach((doc) => {
                const data = doc.data();

                // Crear el elemento div para el comentario
                const commentDiv = document.createElement('div');
                commentDiv.className = 'comment';
                
                // Foto del usuario
                const userPhoto = document.createElement('img');
                userPhoto.className = 'comment-avatar';
                userPhoto.src = data.userPhoto; // Asignar la URL de la foto del usuario
                userPhoto.alt = data.userName; // Altura de la foto del usuario
                commentDiv.appendChild(userPhoto);

                // Detalles del comentario
                const commentDetails = document.createElement('div');
                commentDetails.className = 'comment-details';

                // Nombre del usuario
                const userName = document.createElement('p');
                userName.className = 'comment-author';
                userName.textContent = data.userName;
                commentDetails.appendChild(userName);

                // Texto del comentario
                const commentText = document.createElement('p');
                commentText.className = 'comment-text';
                commentText.textContent = data.comment;
                commentDetails.appendChild(commentText);

                // Fecha y hora del comentario
                const commentTime = document.createElement('p');
                commentTime.className = 'comment-time';
                // Suponiendo que `data.timestamp` es un objeto de fecha válido
                const timestamp = data.timestamp.toDate();
                commentTime.textContent = `${timestamp.getDate()} de ${getMonthName(timestamp.getMonth())}, ${timestamp.getFullYear()} - ${timestamp.getHours()}:${timestamp.getMinutes()}`;
                commentDetails.appendChild(commentTime);

                // Agregar detalles del comentario al div del comentario
                commentDiv.appendChild(commentDetails);

                // Agregar el comentario al contenedor de la lista de comentarios
                commentsList.appendChild(commentDiv);
            });
        })
        .catch(function (error) {
            console.error("Error al cargar comentarios: ", error);
        });
}

// Función auxiliar para obtener el nombre del mes
function getMonthName(monthIndex) {
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return months[monthIndex];
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

var menuButton = document.getElementById('menuButton');
    var drawer = document.getElementById('drawer');

    menuButton.addEventListener('click', function() {
        drawer.classList.toggle('open');
    });

    window.addEventListener('click', function(event) {
        if (!drawer.contains(event.target) && !menuButton.contains(event.target)) {
            drawer.classList.remove('open');
        }
    });


    window.addEventListener('click', function(event) {
        var commentPanel = document.getElementById('commentPanel');
        var map = document.getElementById('map');
        var bottomRightButtons = document.getElementById('bottom-right-buttons');
    
        // Verificar si el clic ocurrió fuera del panel de comentarios y del botón de comentarios
        if (event.target !== commentPanel && !commentPanel.contains(event.target) &&
            event.target !== map && !map.contains(event.target) &&
            event.target !== bottomRightButtons && !bottomRightButtons.contains(event.target)) {
            commentPanel.style.display = 'none'; // Ocultar el panel de comentarios
            map.style.height = '100%'; // Ajustar el tamaño del mapa nuevamente
            bottomRightButtons.style.bottom = '0'; // Ajustar la posición de los botones inferiores
        }
    });

mapboxgl.accessToken = 'pk.eyJ1IjoiZWx0d2l4MjkiLCJhIjoiY2x4aGU3dm1zMWU2OTJpcHJvbGx5OXFnZSJ9.tZlLjt-B6nCsd3RauWqptw';

// Configurar la plataforma HERE
const platform = new H.service.Platform({
    'apikey': 'Zy8akTt65_i5F5S0_2dkgs4-hMpJz1Za9rVdfTvFYAc'
});

const searchService = platform.getSearchService();

// Definir coordenadas de origen y destino
var origin = { lat: -6.769300, lng: -79.843934 };
const destination = { lat: -6.771431, lng: -79.843295 };

// Definir las áreas a evitar (ejemplo de un bbox en Tiergarten park)
var avoidAreas = '';


/*Función para geocodificar una dirección
function geocodeAddress(address) {
    return new Promise((resolve, reject) => {
        searchService.geocode({
            'q': address
        }, result => {
            const location = result.items[0].position;
            const { lat, lng } = location;
            resolve({ lat, lng });
        }, error => {
            console.error(`Error fetching geocoding data for ${address}:`, error);
            reject(error);
        });
    });
}

// Usar Promise.all para geocodificar ambas direcciones
Promise.all([
    geocodeAddress(originAddress),
    geocodeAddress(destinationAddress)
]).then(([origin, destination]) => {
    // Crear parámetros de ruta
    const routingParameters = {
        'routingMode': 'fast',
        'transportMode': 'pedestrian',
        'origin': `${origin.lat},${origin.lng}`,
        'destination': `${destination.lat},${destination.lng}`,
        'return': 'polyline',
    };

    const onResult = function(result) {
        if (result.routes.length) {
            const lineStrings = [];
            result.routes[0].sections.forEach((section) => {
                lineStrings.push(H.geo.LineString.fromFlexiblePolyline(section.polyline));
            });

            // Convertir las polilíneas de HERE a una polilínea de Leaflet
            const routeLine = L.polyline(lineStrings.map(lineString => {
                return lineString.getLatLngAltArray().reduce((acc, cur, idx, arr) => {
                    if (idx % 3 === 0) {
                        acc.push([arr[idx], arr[idx + 1]]);
                    }
                    return acc;
                }, []);
            }), {
                color: 'blue',
                weight: 4
            });

            // Agregar marcadores de inicio y fin
            const startMarker = L.marker([origin.lat, origin.lng]);
            const endMarker = L.marker([destination.lat, destination.lng]);

            // Agregar los elementos al mapa
            routeLine.addTo(map);
            startMarker.addTo(map);
            endMarker.addTo(map);

            // Ajustar vista del mapa para incluir la ruta
            map.fitBounds(routeLine.getBounds());
        }
    };

    const router = platform.getRoutingService(null, 8);

    router.calculateRoute(routingParameters, onResult, function(error) {
        alert(error.message);
    });

}).catch(error => {
    console.error('Error fetching coordinates:', error);
});*/
// Crear parámetros de ruta


const onResult = function(result) {
    if (result.routes.length) {
        var center = map.getCenter()
        const lineStrings = [];
        result.routes[0].sections.forEach((section) => {
            lineStrings.push(H.geo.LineString.fromFlexiblePolyline(section.polyline));
        });

        // Convertir las polilíneas de HERE a una polilínea de Leaflet
        const routeLine = L.polyline(lineStrings.map(lineString => {
            return lineString.getLatLngAltArray().reduce((acc, cur, idx, arr) => {
                if (idx % 3 === 0) {
                    acc.push([arr[idx], arr[idx + 1]]);
                }
                return acc;
            }, []);
        }), {
            color: 'blue',
            weight: 4
        });

        // Agregar marcadores de inicio y fin
        
        const startMarker = L.marker([origin.lat, origin.lng]);
        const endMarker = L.marker([center.lat, center.lng]);

        // Agregar los elementos al mapa
        routeLine.addTo(map);
        startMarker.addTo(map);
        endMarker.addTo(map);

        // Ajustar vista del mapa para incluir la ruta
        map.fitBounds(routeLine.getBounds());
    }
};

const router = platform.getRoutingService(null, 8);



function calculateBbox(lat, lng, radius) {
    // Convertir el radio de metros a grados (aproximadamente)
    const radiusInDegrees = radius / 111000; // Aproximadamente 111,000 metros por grado de latitud

    // Calcular el bbox
    const bbox = [
        lng - radiusInDegrees,
        lat - radiusInDegrees,
        lng + radiusInDegrees,
        lat + radiusInDegrees
    ];

    return bbox;
}

async function obtenerBboxDangerZone(callback) {
    try {
        const bboxArray = [];
    
        // Consultar colección dangerZone y establecer un listener
        db.collection('dangerZones').onSnapshot((querySnapshot) => {
          bboxArray.length = 0; // Limpiar el array actual
          
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            const bbox = data.bbox; // Suponiendo que bbox es un array en el formato [minLat, minLng, maxLat, maxLng]
            
            // Convertir bbox a formato compatible con HERE Maps
            bboxArray.push(bbox);
          });
    
          // Llamar al callback con el nuevo array de bbox
          callback(bboxArray);
        });
    
      } catch (error) {
        console.error('Error al obtener bbox de Firestore:', error);
        throw error;
      }
  }

  function convertirBboxAFormatoTexto(bboxArray) {
    const areasText = bboxArray.map(bbox => {
        return `bbox:${bbox}`;
    }).join('|');
    
    return areasText;
}

var areasBbox = [];

const logoutButton = document.getElementById('logout-btn');

logoutButton.addEventListener('click', function() {
    firebase.auth().signOut().then(function() {
        // Cerrar sesión exitoso, redirigir o hacer otras acciones necesarias
        console.log('Se cerró sesión correctamente');
    }).catch(function(error) {
        // Manejar errores aquí
        console.error('Error al intentar cerrar sesión', error);
    });
});

function trazarRuta(){
    
    obtenerBboxDangerZone((bboxAreas) => {
        var center = map.getCenter();
        areasBbox=bboxAreas;
        const textoFormato = convertirBboxAFormatoTexto(areasBbox);
        avoidAreas = textoFormato
        const routingParameters = {
            'routingMode': 'fast',
            'transportMode': 'pedestrian',
            'origin': `${origin.lat},${origin.lng}`,
            'destination': `${center.lat},${center.lng}`,
            'return': 'polyline',
            'avoid[areas]': `${avoidAreas}` // Áreas a evitar
        };
        console.log(origin.lat, origin.lng);
        router.calculateRoute(routingParameters, onResult, function(error) {
            alert(error.message);
        });
        console.log(textoFormato)
        console.log(bboxAreas); // Aquí puedes trabajar con bboxAreas dentro de este callback
    });
}

document.getElementById('ruta-btn').addEventListener('click', function () {
    var center = map.getCenter();
    console.log(center);
    
});
document.getElementById('destino-btn').addEventListener('click', function () {
    trazarRuta();
    var pin = document.getElementById("center-pin")
    pin.style.display = 'none';
});
