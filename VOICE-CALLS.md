# Chamadas de voz

## Implementação

As chamadas usam Firebase Authentication, Cloud Firestore e WebRTC. A sinalização contém a oferta/resposta SDP e candidatos ICE; o áudio é transmitido diretamente pela ligação WebRTC e não é guardado no Firestore. Os convites ficam numa subcoleção privada do perfil do destinatário. As regras verificam a identidade autenticada, a participação na conversa, o papel de cada participante e as transições de estado.

A captura do Console confirma que existe um Realtime Database, mas a raiz está vazia (`null`). O código da aplicação não o inicializa nem o usa: as mensagens e a sinalização de chamadas usam Cloud Firestore, e não foi criado um serviço de sinalização separado. As regras de Storage continuam a negar acesso porque o projeto usa URLs ImgBB para imagens.

Nas capturas partilhadas, E-mail/palavra-passe, Smartphone, Google, Apple e Anónimo aparecem ativos; Facebook não aparece configurado. As regras de chamadas recusam sessões anónimas, embora o chat existente continue a aceitar os utilizadores autenticados conforme as regras atuais. A página App Check ainda não mostra uma aplicação registada, e a configuração do cliente não tem uma site key. Estes serviços não são necessários para a sinalização WebRTC, mas devem ser verificados separadamente antes da produção.

## Publicar as regras

As regras estão em `firestore.rules` e já são referenciadas por `firebase.json`. O utilizador confirmou que publicou as regras no Firebase Console. Para futuras alterações, depois de instalar e autenticar o Firebase CLI para o projeto correto, publique-as com:

```powershell
firebase deploy --only firestore:rules
```

Antes da publicação, teste as regras com o Firebase Emulator Suite, em particular: criação atómica da chamada e convite, recusa/cancelamento/expiração, resposta, candidatos ICE e tentativas de utilizadores que não pertencem à conversa. Não substitua as regras no Console por regras públicas.

## Testar localmente

1. Sirva `home.html` por `http://localhost` com Live Server. O navegador permite acesso ao microfone em `localhost`; uma origem HTTP numa rede local não é considerada segura por muitos navegadores.
2. Autorize `localhost` nos domínios de autenticação Firebase e confirme que os dois utilizadores têm perfis públicos verificados e uma conversa Firestore entre si.
3. Abra a aplicação em dois perfis de navegador/dispositivos com contas diferentes, permita o acesso ao microfone em ambos, abra a mesma conversa e teste atender, recusar, silenciar e desligar.
4. Para testar em dispositivos físicos ou publicar, use um endereço HTTPS. Em produção, adicione o domínio HTTPS aos domínios autorizados do Firebase Authentication.

## STUN e TURN

O cliente inclui servidores STUN públicos para ligações diretas. STUN não garante conectividade em todas as redes; para redes com NAT/firewall restritivo, configure um serviço TURN e um endpoint HTTPS que devolva credenciais temporárias.

Antes de carregar `src/js/voice-calls.js`, o alojamento pode definir `window.__DIMMAKO_TURN_CREDENTIALS_URL__` para esse endpoint. O cliente envia um Firebase ID token no cabeçalho `Authorization: Bearer ...` e espera uma resposta neste formato:

```json
{
  "iceServers": [
    {
      "urls": ["turn:turn.example.net:3478"],
      "username": "credencial-temporaria",
      "credential": "segredo-temporario"
    }
  ]
}
```

O endpoint deve validar o Firebase ID token, permitir apenas a origem da aplicação, gerar credenciais TURN de curta duração e nunca devolver credenciais permanentes. O endpoint e o servidor TURN ainda não estão configurados neste repositório. Sem TURN, chamadas entre algumas redes podem falhar.

## Dependências e limites conhecidos

- O browser não consegue ler ficheiros `.env` nem variáveis do servidor. Por isso, `scripts/build-vercel.js` lê `process.env` durante o build e gera `dist/src/js/firebase-config.js`, que é servido junto da aplicação; o ficheiro de configuração local `src/js/firebase-config.js` continua ignorado pelo Git. Em desenvolvimento, use a configuração local já existente ou obtenha as variáveis do projeto ligado com `vercel env pull .env.local` e gere o site estático com `node --env-file=.env.local scripts/build-vercel.js` (Node.js 20.6 ou superior).
- Na Vercel, configure em Project Settings > Environment Variables as variáveis obrigatórias `DIMMAKO_FIREBASE_API_KEY`, `DIMMAKO_FIREBASE_AUTH_DOMAIN`, `DIMMAKO_FIREBASE_PROJECT_ID`, `DIMMAKO_FIREBASE_APP_ID` e `DIMMAKO_IMGBB_API_KEY`. Para compatibilidade com nomes já usados no painel, `ID_DO_PROJETO_FIREBASE_DIMMAKO` também pode fornecer o project ID e `ID_DO_APLICATIVO_FIREBASE_DIMMAKO` o app ID. `DIMMAKO_FIREBASE_APPCHECK_SITE_KEY` é opcional até registares App Check e decidires ativá-lo. `DIMMAKO_ARCGIS_API_KEY` é opcional; sem ela, o mapa usa OpenFreeMap/Carto e os estilos específicos ArcGIS não ficam disponíveis. `DIMMAKO_FIREBASE_STORAGE_BUCKET`, `DIMMAKO_FIREBASE_MESSAGING_SENDER_ID` e `DIMMAKO_FIREBASE_MEASUREMENT_ID` também são opcionais. Configure os ambientes Production e Preview e faça um novo deploy após alterar os valores. O build informa os nomes das variáveis obrigatórias em falta, sem revelar os respetivos valores.
- O ficheiro `.env.example` enumera nomes sem valores; mantenha os valores reais em `.env.local` (ignorado pelo Git) ou nas definições da Vercel. Os valores Web do Firebase, a chave de site App Check e as chaves ArcGIS/ImgBB incorporadas no JavaScript enviado ao browser são visíveis ao público: restrinja as chaves a APIs e origens autorizadas, aplique quotas e monitorize o uso. A chave ImgBB não pode ser mantida confidencial num upload direto do cliente; para isso, mova os uploads para um backend autenticado. A segurança Firebase continua a depender das regras do Firestore, da configuração de Authentication e da aplicação de App Check no Console.
- No Firebase Authentication, ative cada método pretendido. Se Facebook estiver desativado, o botão agora informa que é necessário ativá-lo em Authentication > Método de login. Apple também requer os dados OAuth do Apple Developer. Autorize o domínio usado pelo Live Server.
- Não foram adicionadas dependências npm nem um backend independente.
- O Firebase CLI/Emulator não estava disponível neste ambiente. O utilizador confirmou que publicou as regras no Console, mas ainda não foi possível compilá-las ou testá-las no Emulator.
- O App Check precisa de uma site key válida no ambiente de build e de configuração correspondente no Firebase Console antes de exigir App Check em produção.
- Chamadas recebidas dependem da ligação ativa ao Firestore; não há notificações push para utilizadores offline.
- Os candidatos ICE são removidos quando um cliente observa o estado terminal. Se ambos os clientes fecharem abruptamente antes da limpeza, os documentos temporários podem persistir até um participante voltar a ligar.
- Confirme e rode credenciais de serviços de terceiros que tenham sido partilhadas em texto ou expostas no JavaScript. Chaves privadas não devem ser colocadas no frontend; para uploads ImgBB, use um proxy/backend se a chave tiver de permanecer confidencial.
