// Service Worker — Suivi Maman
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyB7Pq9t4T_dqG_xzf8829yKXe-RX4_rMhs",
  authDomain: "suivi-maman.firebaseapp.com",
  databaseURL: "https://suivi-maman-default-rtdb.firebaseio.com",
  projectId: "suivi-maman",
  storageBucket: "suivi-maman.firebasestorage.app",
  messagingSenderId: "464641073360",
  appId: "1:464641073360:web:327a3738757cdfc7fa7ed5"
});

const messaging = firebase.messaging();

// Notification en arrière-plan
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification;
  self.registration.showNotification(title || '💛 Suivi Maman', {
    body: body || 'Nouvelle mise à jour',
    icon: icon || '/icon-famille.png',
    badge: '/icon-famille.png',
    vibrate: [200, 100, 200],
    tag: 'maman-notification',
    renotify: true
  });
});
