// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// Import the functions you need from the SDKs you need

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDr-orOBsuz81ywZpFDrijMAJSXjw07FGo",
  authDomain: "yourtube-90889.firebaseapp.com",
  projectId: "yourtube-90889",
  storageBucket: "yourtube-90889.firebasestorage.app",
  messagingSenderId: "1026036629034",
  appId: "1:1026036629034:web:c130a916f1319b305a0d53",
  measurementId: "G-3EX2BGV7E4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase

const auth = getAuth(app);
const provider = new GoogleAuthProvider();
export { auth, provider };
