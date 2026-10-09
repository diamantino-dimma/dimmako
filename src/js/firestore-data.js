(() => {
    const MAX_DOCUMENT_BYTES = 900 * 1024;

    function getUserDataReference(uid, collectionName, documentId) {
        if (!/^[A-Za-z0-9_-]{1,120}$/.test(collectionName)
            || !/^[A-Za-z0-9_-]{1,120}$/.test(documentId)) {
            throw new Error("O identificador dos dados Firebase é inválido.");
        }
        return window.dimmakoFirebase.db.collection("profiles").doc(uid)
            .collection(collectionName).doc(documentId);
    }

    function ensureDocumentSize(value) {
        const serialized = JSON.stringify(value);
        if (serialized === undefined || value === null) {
            throw new Error("Um registo vazio ou inválido foi preservado localmente e não foi sincronizado.");
        }
        if (new TextEncoder().encode(serialized).length > MAX_DOCUMENT_BYTES) {
            throw new Error("Este registo excede o limite seguro de tamanho do Firestore e não foi sincronizado.");
        }
        return serialized;
    }

    async function savePrivateRecord(documentId, value, user = window.dimmakoFirebase?.auth.currentUser) {
        if (!user) throw new Error("É necessário iniciar sessão para guardar os dados no Firebase.");
        ensureDocumentSize(value);
        await getUserDataReference(user.uid, "privateData", documentId).set({
            value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }

    async function importPrivateRecord(documentId, value, user = window.dimmakoFirebase?.auth.currentUser) {
        if (!user) throw new Error("É necessário iniciar sessão para importar os dados para o Firebase.");
        ensureDocumentSize(value);
        const reference = getUserDataReference(user.uid, "privateData", documentId);
        const existing = await reference.get();
        if (!existing.exists) {
            await reference.set({
                value,
                importedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    }

    async function importSales(records, user = window.dimmakoFirebase?.auth.currentUser) {
        if (!user || !Array.isArray(records)) return;
        const collection = window.dimmakoFirebase.db.collection("profiles").doc(user.uid).collection("sales");
        for (let index = 0; index < records.length; index += 1) {
            const record = records[index];
            if (!record || typeof record !== "object" || Array.isArray(record)) {
                throw new Error(`O registo de venda ${index + 1} tem um formato inválido e foi preservado localmente.`);
            }
            const originalId = record && record.id !== undefined ? String(record.id) : String(index);
            const documentId = `legacy_${index}_${encodeURIComponent(originalId).replace(/%/g, "_")}`.slice(0, 120);
            ensureDocumentSize(record);
            const reference = collection.doc(documentId);
            const existing = await reference.get();
            if (!existing.exists) {
                await reference.set({
                    legacyRecord: record,
                    importedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        }
    }

    window.dimmakoFirestoreData = Object.freeze({
        savePrivateRecord,
        importPrivateRecord,
        importSales
    });
})();
