importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:"AIzaSyB7Pq9t4T_dqG_xzf8829yKXe-RX4_rMhs",
  authDomain:"suivi-maman.firebaseapp.com",
  databaseURL:"https://suivi-maman-default-rtdb.firebaseio.com",
  projectId:"suivi-maman",
  storageBucket:"suivi-maman.firebasestorage.app",
  messagingSenderId:"464641073360",
  appId:"1:464641073360:web:327a3738757cdfc7fa7ed5"
});

firebase.messaging().onBackgroundMessage(payload=>{
  const title=payload.notification?.title||'💛 Suivi Maman';
  const body=payload.notification?.body||'Nouvelle activité';
  self.registration.showNotification(title,{
    body,
    icon:payload.notification?.icon||'/maman/icone-famille.png',
    badge:'/maman/icone-famille.png',
    tag:'suivi-maman',
    renotify:true,
    vibrate:[200,100,200],
    data:{url:'https://yvesgrumet.github.io/maman/'}
  });
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(
    clients.matchAll({type:'window'}).then(list=>{
      for(const c of list){if(c.url.includes('/maman/')&&'focus' in c)return c.focus();}
      if(clients.openWindow)return clients.openWindow('https://yvesgrumet.github.io/maman/');
    })
  );
});
