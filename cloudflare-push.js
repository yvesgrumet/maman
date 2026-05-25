// Variables d'environnement Cloudflare :
//   PUSH_SECRET       → 'famille-maman-2024'
//   VAPID_PUBLIC_KEY  → clé publique base64url
//   VAPID_PRIVATE_KEY → clé privée base64url (pkcs8)

export default {
  async fetch(request,env){
    if(request.method==='OPTIONS')return new Response(null,{headers:cors()});
    if(request.method!=='POST')return new Response('Method not allowed',{status:405});
    if(request.headers.get('X-Push-Secret')!==env.PUSH_SECRET)
      return new Response('Unauthorized',{status:401,headers:cors()});

    let body;
    try{body=await request.json();}
    catch{return new Response('Invalid JSON',{status:400,headers:cors()});}

    const{title,body:notifBody,subs}=body;
    if(!subs||!subs.length)return Response.json({sent:0,total:0},{headers:cors()});

    const results=await Promise.allSettled(
      subs.map(sub=>sendWebPush(sub,{title,body:notifBody},env))
    );
    const sent=results.filter(r=>r.status==='fulfilled').length;
    return Response.json({sent,total:subs.length},{headers:cors()});
  }
};

function cors(){
  return{
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Methods':'POST,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type,X-Push-Secret'
  };
}

function fromB64u(s){
  const pad='='.repeat((4-s.length%4)%4);
  return Uint8Array.from(atob((s+pad).replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
}

function toB64u(buf){
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}

function concat(...arrs){
  const out=new Uint8Array(arrs.reduce((n,a)=>n+a.length,0));
  let i=0;
  for(const a of arrs){out.set(a,i);i+=a.length;}
  return out;
}

async function hkdf(salt,ikm,info,len){
  const key=await crypto.subtle.importKey('raw',ikm,'HKDF',false,['deriveBits']);
  return new Uint8Array(
    await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},key,len*8)
  );
}

async function vapidJwt(endpoint,pubB64u,privB64u){
  const aud=new URL(endpoint).origin;
  const hdr={typ:'JWT',alg:'ES256'};
  const pay={aud,exp:Math.floor(Date.now()/1000)+43200,sub:'mailto:suivi-maman@grumet.fr'};
  const enc=o=>btoa(JSON.stringify(o)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const msg=`${enc(hdr)}.${enc(pay)}`;
  const privKey=await crypto.subtle.importKey(
    'pkcs8',fromB64u(privB64u).buffer,
    {name:'ECDSA',namedCurve:'P-256'},false,['sign']
  );
  const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},privKey,new TextEncoder().encode(msg));
  return`${msg}.${toB64u(sig)}`;
}

async function encryptPayload(plaintext,ua_pub_b64u,auth_b64u){
  const enc=new TextEncoder();
  const ua_pub=fromB64u(ua_pub_b64u);
  const auth=fromB64u(auth_b64u);
  const ua_key=await crypto.subtle.importKey('raw',ua_pub,{name:'ECDH',namedCurve:'P-256'},false,[]);
  const as_kp=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const as_pub=new Uint8Array(await crypto.subtle.exportKey('raw',as_kp.publicKey));
  const ecdh=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:ua_key},as_kp.privateKey,256));
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const info1=concat(enc.encode('WebPush: info\0'),ua_pub,as_pub);
  const ikm=await hkdf(auth,ecdh,info1,32);
  const cek=await hkdf(salt,ikm,enc.encode('Content-Encoding: aes128gcm\0'),16);
  const nonce=await hkdf(salt,ikm,enc.encode('Content-Encoding: nonce\0'),12);
  const aes=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']);
  const ct=new Uint8Array(await crypto.subtle.encrypt(
    {name:'AES-GCM',iv:nonce},aes,
    concat(enc.encode(plaintext),new Uint8Array([2]))
  ));
  const result=new Uint8Array(16+4+1+65+ct.length);
  result.set(salt,0);
  new DataView(result.buffer).setUint32(16,4096,false);
  result[20]=65;
  result.set(as_pub,21);
  result.set(ct,86);
  return result;
}

async function sendWebPush(sub,{title,body},env){
  const encrypted=await encryptPayload(JSON.stringify({title,body}),sub.p256dh,sub.auth);
  const jwt=await vapidJwt(sub.endpoint,env.VAPID_PUBLIC_KEY,env.VAPID_PRIVATE_KEY);
  const resp=await fetch(sub.endpoint,{
    method:'POST',
    headers:{
      'Authorization':`vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
      'Content-Type':'application/octet-stream',
      'Content-Encoding':'aes128gcm',
      'TTL':'86400'
    },
    body:encrypted
  });
  if(!resp.ok){const err=await resp.text();throw new Error(`${resp.status}: ${err}`);}
}
