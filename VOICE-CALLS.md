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

- A configuração Firebase específica do projeto e a chave ImgBB ficam no ficheiro local ignorado `src/js/firebase-config.js`. Para preparar outro clone, copie `src/js/firebase-config.example.js` para esse nome e preencha os valores no Firebase Console/ImgBB; não publique o ficheiro local.
- No Firebase Authentication, ative cada método pretendido. Se Facebook estiver desativado, o botão agora informa que é necessário ativá-lo em Authentication > Método de login. Apple também requer os dados OAuth do Apple Developer. Autorize o domínio usado pelo Live Server.
- Não foram adicionadas dependências npm nem um backend independente.
- O Firebase CLI/Emulator não estava disponível neste ambiente. O utilizador confirmou que publicou as regras no Console, mas ainda não foi possível compilá-las ou testá-las no Emulator.
- O App Check não está configurado no cliente atual. Registe a aplicação e configure a site key no Firebase Console antes de exigir App Check em produção.
- Chamadas recebidas dependem da ligação ativa ao Firestore; não há notificações push para utilizadores offline.
- Os candidatos ICE são removidos quando um cliente observa o estado terminal. Se ambos os clientes fecharem abruptamente antes da limpeza, os documentos temporários podem persistir até um participante voltar a ligar.
- Confirme e rode credenciais de serviços de terceiros que tenham sido partilhadas em texto ou expostas no JavaScript. Chaves privadas não devem ser colocadas no frontend; para uploads ImgBB, use um proxy/backend se a chave tiver de permanecer confidencial.
