
(() => {
    const firebaseConfig = window.__DIMMAKO_FIREBASE_CONFIG__;
    if (!firebaseConfig) throw new Error("A configuração Firebase não foi carregada.");

    if (!window.firebase) throw new Error("Firebase SDK não foi carregado.");

    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
    const auth = app.auth();
    const db = app.firestore();
    auth.useDeviceLanguage();
    const appCheckKey = firebaseConfig.appCheckSiteKey
        || document.querySelector('meta[name="firebase-app-check-site-key"]')?.content.trim();
    if (!appCheckKey) {
        console.warn("[Dimmako] App Check não está configurado. Configure uma site key no Firebase Console antes de ativar a aplicação em produção.");
    }
    const appCheckReady = appCheckKey
        ? firebase.appCheck().activate(
            new firebase.appCheck.ReCaptchaEnterpriseProvider(appCheckKey),
            true
        )
        : Promise.resolve();

    window.dimmakoFirebase = Object.freeze({
        app,
        auth,
        db,
        ready: Promise.all([
            auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL),
            appCheckReady
        ])
    });
})();