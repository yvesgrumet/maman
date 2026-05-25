// ════════════════════════════════════════════════════════════════
// CLOUDFLARE WORKER — Push notifications Suivi Maman
// ════════════════════════════════════════════════════════════════
// Variables d'environnement à configurer dans Cloudflare :
//   FIREBASE_SERVICE_ACCOUNT  → contenu du fichier JSON du compte de service Firebase
//   PUSH_SECRET               → mot de passe secret (ex: "famille2024")
// ════════════════════════════════════════════════════════════════

export default {
  async fetch(request, env) {
    // CORS preflight
    if(request.method==='OPTIONS'){
      return new Response(null,{headers:{
        'Access-Control-Allow-Origin':'*',
        'Access-Control-Allow-Methods':'POST,OPTIONS',
        'Access-Control-Allow-Headers':'Content-Type,X-Push-Secret'
      }});
    }
    if(request.method!=='POST')return new Response('Method not allowed',{status:405});

    // Vérification du mot de passe secret
    const secret=request.headers.get('X-Push-Secret');
    if(secret!==env.PUSH_SECRET)return new Response('Unauthorized',{status:401,headers:{'Access-Control-Allow-Origin':'*'}});

    let body;
    try{body=await request.json();}
    catch{return new Response('Invalid JSON',{status:400,headers:{'Access-Control-Allow-Origin':'*'}});}

    const {title,notifBody,icon,tokens}=body;
    if(!tokens||!tokens.length)return Response.json({sent:0},{headers:{'Access-Control-Allow-Origin':'*'}});

    // Obtenir un token OAuth Firebase
    let accessToken;
    try{accessToken=await getFirebaseAccessToken(env.FIREBASE_SERVICE_ACCOUNT);}
    catch(e){return new Response('Firebase auth error: '+e.message,{status:500,headers:{'Access-Control-Allow-Origin':'*'}});}

    // Envoyer à chaque token FCM
    const results=await Promise.allSettled(
      tokens.map(token=>sendFCM(token,{title,body:notifBody,icon},accessToken))
    );

    const sent=results.filter(r=>r.status==='fulfilled').length;
    return Response.json({sent,total:tokens.length},{headers:{'Access-Control-Allow-Origin':'*'}});
  }
};

async function getFirebaseAccessToken(serviceAccountJson){
  const sa=JSON.parse(serviceAccountJson);
  const now=Math.floor(Date.now()/1000);

  const header={alg:'RS256',typ:'JWT'};
  const payload={
    iss:sa.client_email,
    scope:'https://www.googleapis.com/auth/cloud-platform',
    aud:'https://oauth2.googleapis.com/token',
    iat:now,
    exp:now+3600
  };

  const enc=obj=>btoa(JSON.stringify(obj)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const signingInput=enc(header)+'.'+enc(payload);

  const pemContents=sa.private_key.replace(/-----BEGIN PRIVATE KEY-----/,'')
    .replace(/-----END PRIVATE KEY-----/,'').replace(/\s/g,'');
  const binaryKey=Uint8Array.from(atob(pemContents),c=>c.charCodeAt(0));

  const cryptoKey=await crypto.subtle.importKey(
    'pkcs8',binaryKey.buffer,
    {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},
    false,['sign']
  );

  const signature=await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',cryptoKey,new TextEncoder().encode(signingInput)
  );

  const sigB64=btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');

  const jwt=`${signingInput}.${sigB64}`;

  const tokenResp=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  const tokenData=await tokenResp.json();
  if(!tokenData.access_token)throw new Error(JSON.stringify(tokenData));
  return tokenData.access_token;
}

async function sendFCM(token,{title,body,icon},accessToken){
  const resp=await fetch('https://fcm.googleapis.com/v1/projects/suivi-maman/messages:send',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':'Bearer '+accessToken
    },
    body:JSON.stringify({
      message:{
        token,
        notification:{title,body},
        webpush:{
          notification:{
            title,body,
            icon:icon||'https://yvesgrumet.github.io/maman/icone-famille.png',
            badge:'https://yvesgrumet.github.io/maman/icone-famille.png',
            renotify:true,
            tag:'suivi-maman',
            vibrate:[200,100,200]
          },
          fcm_options:{link:'https://yvesgrumet.github.io/maman/'}
        }
      }
    })
  });
  if(!resp.ok){const err=await resp.text();throw new Error(err);}
}
