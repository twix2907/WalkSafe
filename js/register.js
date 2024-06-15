// Inicialización de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCU-sQ1l2fZ6eu-2n9cADaTY8IssrSS5mg",
    authDomain: "caminoseguro-39b7c.firebaseapp.com",
    projectId: "caminoseguro-39b7c",
    storageBucket: "caminoseguro-39b7c.appspot.com",
    messagingSenderId: "855535521945",
    appId: "1:855535521945:web:06c70bfc861c428d00e808",
    measurementId: "G-ZGB3PHMWDD"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app(); // Si ya está inicializado, usar la instancia existente
}

const auth = firebase.auth();
const storage = firebase.storage();

// Paso 1: Registro con correo y contraseña
document.getElementById('register-form-step1').addEventListener('submit', function (event) {
    event.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const errorMessageStep1 = document.getElementById('error-message-step1');

    if (password !== confirmPassword) {
        errorMessageStep1.textContent = "Las contraseñas no coinciden.";
        return;
    }

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            console.log("Usuario registrado:", user);

            // Mostrar el siguiente paso
            document.getElementById('step1').style.display = 'none';
            document.getElementById('step2').style.display = 'block';
        })
        .catch((error) => {
            const errorCode = error.code;
            const errorMsg = error.message;
            errorMessageStep1.textContent = errorMsg;
        });
});

// Paso 2: Configuración del perfil
document.getElementById('register-form-step2').addEventListener('submit', function (event) {
    event.preventDefault();

    const user = auth.currentUser;
    const username = document.getElementById('username').value;
    const profilePicture = document.getElementById('profile-picture').files[0];
    const errorMessageStep2 = document.getElementById('error-message-step2');

    if (user) {
        if (profilePicture) {
            const storageRef = storage.ref();
            const profilePicRef = storageRef.child('profilePictures/' + user.uid + '/' + profilePicture.name);

            profilePicRef.put(profilePicture).then((snapshot) => {
                snapshot.ref.getDownloadURL().then((downloadURL) => {
                    user.updateProfile({
                        displayName: username,
                        photoURL: downloadURL
                    }).then(() => {
                        console.log("Perfil actualizado:", user);
                        window.location.href = "index.html"; // Redirige a la página principal después del registro
                    }).catch((error) => {
                        errorMessageStep2.textContent = error.message;
                    });
                });
            }).catch((error) => {
                errorMessageStep2.textContent = error.message;
            });
        } else {
            user.updateProfile({
                displayName: username
            }).then(() => {
                console.log("Perfil actualizado:", user);
                window.location.href = "index.html"; // Redirige a la página principal después del registro
            }).catch((error) => {
                errorMessageStep2.textContent = error.message;
            });
        }
    } else {
        errorMessageStep2.textContent = "No se pudo obtener el usuario.";
    }
});
