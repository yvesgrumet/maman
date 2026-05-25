self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil(clients.claim()));

self.addEventListener('push',event=>{
  const data=event.data?.json()||{};
  const title=data.title||'💛 Suivi Maman';
  const body=data.body||'Nouvelle activité';
  try{if('setAppBadge' in self.navigator)self.navigator.setAppBadge(1);}catch(e){}
  event.waitUntil(
    self.registration.showNotification(title,{
      body,
      icon:'https://yvesgrumet.github.io/maman/icone-maman.png',
      badge:'https://yvesgrumet.github.io/maman/icone-maman.png',
      tag:'suivi-maman',
      renotify:true,
      vibrate:[200,100,200],
      data:{url:'https://yvesgrumet.github.io/maman/'}
    })
  );
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
