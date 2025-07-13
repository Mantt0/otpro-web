// sw.js

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:    "AIzaSyAtSVJILdFOyfJgorHB1jjBCq7LC_XeNF4",
  authDomain:"otpro-86f2e.firebaseapp.com",
  databaseURL:"https://otpro-86f2e-default-rtdb.firebaseio.com",
  projectId: "otpro-86f2e",
  storageBucket:"otpro-86f2e.appspot.com",
  messagingSenderId:"39918992594",
  appId:     "1:39918992594:web:d414a30438c3b37d2e810b",
  measurementId:"G-EWKPHP18J7"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const { title, body, icon } = payload.notification;
  self.registration.showNotification(title, { body, icon });
});
