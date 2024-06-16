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

document.getElementById('login-form').addEventListener('submit', function (event) {
    event.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Inicio de sesión exitoso
            const user = userCredential.user;
            console.log("login exitoso", user);
            // Redirigir al usuario a la página principal o mostrar un mensaje de éxito
            window.location.href = "index.html"; // Redirige a la página principal después del inicio de sesión
        })
        .catch((error) => {
            const errorCode = error.code;
            const errorMsg = error.message;
            errorMessage.textContent = errorMsg;
        });
});
