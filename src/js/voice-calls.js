(() => {
    const CALL_TIMEOUT_MS = 45_000;
    const RECONNECT_TIMEOUT_MS = 12_000;
    const CALL_TERMINAL_STATES = new Set(["rejected", "cancelled", "ended", "failed", "expired"]);
    const CALL_STATE_LABELS = {
        requestingMicrophone: "A solicitar acesso ao microfone...",
        calling: "A chamar...",
        incoming: "Chamada de voz recebida",
        connecting: "A estabelecer ligação...",
        active: "Chamada em curso",
        reconnecting: "A tentar restabelecer a ligação...",
        answeredElsewhere: "A chamada foi atendida noutro dispositivo",
        rejected: "Chamada recusada",
        cancelled: "Chamada cancelada",
        ended: "Chamada terminada",
        failed: "Falha na ligação",
        expired: "Chamada não atendida",
        microphoneDenied: "Não foi possível aceder ao microfone"
    };
    const publicStunServers = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
    let signedInUser = null;
    let unsubscribeInvitations = null;
    let incomingCall = null;
    let loadingIncomingId = null;
    let activeCall = null;
    let reconnectTimer = null;
    let durationTimer = null;
    let answeringCall = false;
    let uiBound = false;
    let previousFocus = null;
    let previousBodyOverflow = "";

    const db = () => window.dimmakoFirebase?.db;
    const stateLabel = state => CALL_STATE_LABELS[state] || "Estado da chamada desconhecido";

    function setStatus(message) {
        const status = document.getElementById("voiceCallStatus");
        if (status) status.textContent = message;
    }

    function startDurationTimer(call) {
        clearInterval(durationTimer);
        call.connected = true;
        call.connectedAt = Date.now();
        const duration = document.getElementById("voiceCallDuration");
        if (!duration) return;
        duration.hidden = false;
        const update = () => {
            const elapsed = Math.floor((Date.now() - call.connectedAt) / 1000);
            duration.textContent = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
        };
        update();
        durationTimer = window.setInterval(update, 1000);
    }

    async function flushPendingLocalCandidates(call) {
        call.signalReady = true;
        const candidates = call.pendingLocalCandidates.splice(0);
        for (const candidate of candidates) {
            await candidateCollection(call).add(candidate);
        }
    }

    function setDialogVisible(visible) {
        const dialog = document.getElementById("voiceCallModal");
        if (!dialog) return;
        const wasVisible = dialog.classList.contains("open");
        if (visible && !wasVisible) {
            previousFocus = document.activeElement;
            previousBodyOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
        }
        dialog.classList.toggle("open", visible);
        dialog.setAttribute("aria-hidden", String(!visible));
        if (visible && !wasVisible) {
            window.setTimeout(() => dialog.querySelector("button:not([hidden]):not(:disabled)")?.focus(), 0);
        } else if (!visible && wasVisible) {
            document.body.style.overflow = previousBodyOverflow;
            previousFocus?.focus?.();
            previousFocus = null;
        }
    }
    function initials(name) {
        return String(name || "").trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();
    }

    function setPerson(name, photo) {
        const avatar = document.getElementById("voiceCallAvatar");
        const title = document.getElementById("voiceCallName");
        if (title) title.textContent = name;
        if (!avatar) return;
        avatar.replaceChildren();
        if (typeof photo === "string" && /^https:\/\/i\.ibb\.co\/[^\s]+$/i.test(photo)) {
            const image = document.createElement("img");
            image.src = photo;
            image.alt = "";
            image.decoding = "async";
            image.referrerPolicy = "no-referrer";
            image.addEventListener("error", () => {
                avatar.textContent = initials(name);
            }, { once: true });
            avatar.appendChild(image);
        } else {
            avatar.textContent = initials(name);
        }
    }

    function setActions(mode) {
        document.querySelectorAll("[data-voice-action]").forEach(button => {
            button.hidden = !button.dataset.voiceAction.split(" ").includes(mode);
            button.disabled = mode === "incoming" && button.id === "voiceAcceptButton" && answeringCall;
            button.removeAttribute("aria-pressed");
        });
        const muteButton = document.getElementById("voiceMuteButton");
        if (muteButton && mode !== "active") muteButton.textContent = "Silenciar microfone";
    }

    function showCall(mode, name, photo, status) {
        setPerson(name, photo);
        setStatus(stateLabel(status));
        setActions(mode);
        setDialogVisible(true);
    }

    function showTerminalStatus(state, name, photo) {
        setPerson(name, photo);
        setStatus(stateLabel(state));
        setActions("terminal");
        setDialogVisible(true);
        window.setTimeout(() => {
            if (!activeCall && !incomingCall) setDialogVisible(false);
        }, 2500);
    }

    function showError(error, message) {
        console.error(message, error);
        window.mostrarToast?.(message, "erro");
    }

    async function loadVerifiedProfile(uid) {
        const snapshot = await db().collection("publicProfiles").doc(uid).get();
        if (!snapshot.exists) throw new Error("O perfil público do participante não está disponível.");
        const profile = snapshot.data();
        const name = profile.nome || profile.nomeEmpresa;
        if (profile.uid !== uid || profile.verified !== true || typeof name !== "string" || !name.trim()) {
            throw new Error("Não foi possível validar o perfil do participante.");
        }
        return { name: name.trim(), photo: profile.foto || "" };
    }

    async function getIceServers() {
        const servers = [...publicStunServers];
        const endpoint = window.__DIMMAKO_TURN_CREDENTIALS_URL__;
        if (!endpoint) {
            console.warn("[Dimmako] TURN não configurado; chamadas em redes restritivas podem não ligar.");
            return servers;
        }
        if (new URL(endpoint, window.location.href).protocol !== "https:") {
            throw new Error("O endpoint de credenciais TURN deve usar HTTPS.");
        }

        const token = await signedInUser.getIdToken();
        const response = await fetch(endpoint, {
            headers: { Authorization: `Bearer ${token}` },
            credentials: "omit",
            cache: "no-store"
        });
        if (!response.ok) throw new Error("Não foi possível obter credenciais temporárias para o servidor TURN.");
        const configuration = await response.json();
        if (!Array.isArray(configuration.iceServers) || configuration.iceServers.length === 0) {
            throw new Error("O servidor TURN não devolveu servidores ICE válidos.");
        }
        return [...servers, ...configuration.iceServers];
    }

    function candidateData(candidate) {
        return {
            candidate: candidate.candidate,
            sdpMid: candidate.sdpMid,
            sdpMLineIndex: candidate.sdpMLineIndex,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
    }

    function candidateCollection(call) {
        const collectionName = call.role === "caller" ? "callerCandidates" : "calleeCandidates";
        return call.reference.collection(collectionName);
    }

    function remoteCandidateCollection(call) {
        const collectionName = call.role === "caller" ? "calleeCandidates" : "callerCandidates";
        return call.reference.collection(collectionName);
    }

    async function addRemoteCandidate(call, snapshot) {
        if (call.closed) return;
        const data = snapshot.data();
        const candidate = new RTCIceCandidate({
            candidate: data.candidate,
            sdpMid: data.sdpMid,
            sdpMLineIndex: data.sdpMLineIndex
        });
        if (!call.peerConnection.remoteDescription) {
            call.pendingCandidates.push(candidate);
            return;
        }
        await call.peerConnection.addIceCandidate(candidate);
    }

    async function flushPendingCandidates(call) {
        const candidates = call.pendingCandidates.splice(0);
        for (const candidate of candidates) {
            await call.peerConnection.addIceCandidate(candidate);
        }
    }

    function listenForRemoteCandidates(call) {
        call.unsubscribeCandidates = remoteCandidateCollection(call).onSnapshot(snapshot => {
            snapshot.docChanges().filter(change => change.type === "added")
                .forEach(change => addRemoteCandidate(call, change.doc).catch(error => {
                    if (!call.closed) showError(error, "Não foi possível processar os candidatos ICE da chamada.");
                }));
        }, error => {
            if (!call.closed) showError(error, "Falha ao receber a sinalização ICE.");
        });
    }

    function subscribeToCall(call) {
        call.unsubscribeCall = call.reference.onSnapshot(snapshot => {
            if (call.closed || !snapshot.exists) {
                if (!call.closed) finishCallLocally(call, "failed");
                return;
            }
            const data = snapshot.data();
            if (CALL_TERMINAL_STATES.has(data.status)) {
                showTerminalStatus(data.status, call.remote.name, call.remote.photo);
                cleanupCall(call).catch(error => showError(error, "Não foi possível limpar os dados temporários da chamada."));
                return;
            }
            if (call.role === "caller" && data.status === "connecting" && data.answer && !call.remoteDescriptionSet) {
                call.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
                    .then(async () => {
                        call.remoteDescriptionSet = true;
                        await flushPendingCandidates(call);
                    })
                    .catch(error => failCall(call, error, "Não foi possível aplicar a resposta WebRTC."));
            }
            if (data.status === "connecting" || data.status === "active") {
                const connected = call.peerConnection.connectionState === "connected";
                setStatus(stateLabel(connected ? "active" : "connecting"));
                setActions(connected ? "active" : "connecting");
            }
        }, error => {
            if (!call.closed) failCall(call, error, "Falha ao acompanhar o estado da chamada.");
        });
    }

    async function createPeerConnection(call) {
        const peerConnection = new RTCPeerConnection({ iceServers: await getIceServers() });
        call.peerConnection = peerConnection;
        call.localStream.getTracks().forEach(track => peerConnection.addTrack(track, call.localStream));
        peerConnection.ontrack = event => {
            const audio = document.getElementById("voiceCallRemoteAudio");
            const stream = event.streams && event.streams[0];
            if (audio && stream) {
                audio.srcObject = stream;
                audio.play().catch(error => {
                    console.warn("[Dimmako] A reprodução automática do áudio remoto foi bloqueada.", error);
                    setStatus("Toque para permitir a reprodução do áudio.");
                    audio.controls = true;
                });
            }
        };
        peerConnection.onicecandidate = event => {
            if (!event.candidate || call.closed) return;
            const candidate = candidateData(event.candidate);
            if (!call.signalReady) {
                call.pendingLocalCandidates.push(candidate);
                return;
            }
            candidateCollection(call).add(candidate).catch(error => {
                if (!call.closed) failCall(call, error, "Não foi possível publicar um candidato ICE.");
            });
        };
        peerConnection.onconnectionstatechange = () => {
            if (call.closed) return;
            if (peerConnection.connectionState === "connected") {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
                clearTimeout(call.timeout);
                call.timeout = null;
                if (!call.connected) startDurationTimer(call);
                setStatus(stateLabel("active"));
                setActions("active");
                if (!call.activeSignaled) {
                    call.activeSignaled = true;
                    call.reference.update({
                        status: "active",
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }).catch(error => failCall(call, error, "Não foi possível guardar o estado da chamada."));
                }
            } else if (peerConnection.connectionState === "disconnected") {
                setStatus(stateLabel("reconnecting"));
                setActions("connecting");
                clearTimeout(reconnectTimer);
                reconnectTimer = window.setTimeout(() => {
                    if (!call.closed && peerConnection.connectionState === "disconnected") {
                        failCall(call, new Error("A ligação não foi restabelecida."), "A ligação foi interrompida.");
                    }
                }, RECONNECT_TIMEOUT_MS);
            } else if (peerConnection.connectionState === "connecting" && call.connected) {
                setStatus(stateLabel("reconnecting"));
                setActions("connecting");
                clearTimeout(reconnectTimer);
                reconnectTimer = window.setTimeout(() => {
                    if (!call.closed && peerConnection.connectionState === "connecting") {
                        failCall(call, new Error("A ligação não foi restabelecida."), "A ligação foi interrompida.");
                    }
                }, RECONNECT_TIMEOUT_MS);
            } else if (peerConnection.connectionState === "failed") {
                failCall(call, new Error("A ligação WebRTC falhou."), "A ligação WebRTC falhou.");
            }
        };
        return peerConnection;
    }

    function newCallContext(reference, role, remote) {
        return {
            reference,
            role,
            remote,
            peerConnection: null,
            localStream: null,
            signalReady: false,
            pendingLocalCandidates: [],
            pendingCandidates: [],
            remoteDescriptionSet: false,
            unsubscribeCall: null,
            unsubscribeCandidates: null,
            timeout: null,
            closed: false,
            terminalHandled: false,
            connected: false,
            activeSignaled: false
        };
    }

    async function cleanupUnansweredCall(reference, remote) {
        const call = newCallContext(reference, "callee", remote);
        call.signalReady = true;
        await cleanupCall(call);
    }

    function setCallTimeout(call) {
        if (call.connected) return;
        call.timeout = window.setTimeout(() => {
            if (call.closed) return;
            call.reference.get().then(snapshot => {
                if (!snapshot.exists) return finishCallLocally(call, "failed");
                const status = snapshot.data().status;
                if (status === "ringing") return endCall(call, "expired");
                if (status === "connecting") return endCall(call, "failed");
            }).catch(error => failCall(call, error, "Não foi possível verificar o tempo limite da chamada."));
        }, CALL_TIMEOUT_MS);
    }

    async function startOutgoingCall(conversationId, friend) {
        if (!signedInUser || !db()) throw new Error("É necessário iniciar sessão para fazer uma chamada.");
        if (activeCall || incomingCall) throw new Error("Já existe uma chamada ativa ou recebida.");
        if (!conversationId || !friend?.uid || friend.uid === signedInUser.uid) {
            throw new Error("Selecione um participante válido para iniciar a chamada.");
        }
        const conversationSnapshot = await db().collection("conversations").doc(conversationId).get();
        const participantUids = conversationSnapshot.exists ? conversationSnapshot.data().participantUids : null;
        if (!Array.isArray(participantUids)
            || !participantUids.includes(signedInUser.uid)
            || !participantUids.includes(friend.uid)
            || participantUids.length !== 2) {
            throw new Error("A sua conta não está autorizada nesta conversa.");
        }

        const remote = await loadVerifiedProfile(friend.uid);
        const callId = db().collection("calls").doc().id;
        const reference = db().collection("calls").doc(callId);
        const call = newCallContext(reference, "caller", remote);
        activeCall = call;
        showCall("setup", remote.name, remote.photo, "requestingMicrophone");

        try {
            if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
                throw new Error("As chamadas requerem um navegador compatível e HTTPS (ou localhost).");
            }
            call.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            if (call.closed) {
                call.localStream.getTracks().forEach(track => track.stop());
                return;
            }
            const peerConnection = await createPeerConnection(call);
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            const callData = {
                conversationId,
                participantUids,
                callerUid: signedInUser.uid,
                calleeUid: friend.uid,
                status: "ringing",
                offer: { type: offer.type, sdp: offer.sdp },
                answer: null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                expiresAt: firebase.firestore.Timestamp.fromDate(new Date(Date.now() + CALL_TIMEOUT_MS))
            };
            const invitation = db().collection("profiles").doc(friend.uid)
                .collection("callInvitations").doc(callId);
            const batch = db().batch();
            batch.set(reference, callData);
            batch.set(invitation, {
                callId,
                callerUid: signedInUser.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await batch.commit();

            showCall("calling", remote.name, remote.photo, "calling");
            await flushPendingLocalCandidates(call);
            subscribeToCall(call);
            listenForRemoteCandidates(call);
            setCallTimeout(call);
        } catch (error) {
            if (call.signalReady && !call.closed) await endCall(call, "failed");
            else await cleanupCall(call, false);
            if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
                showTerminalStatus("microphoneDenied", remote.name, remote.photo);
            } else {
                setDialogVisible(false);
            }
            showError(error, "Não foi possível iniciar a chamada.");
        }
    }

    async function receiveInvitation(invitationSnapshot) {
        const invitation = invitationSnapshot.data();
        const reference = db().collection("calls").doc(invitation.callId);
        const callSnapshot = await reference.get();
        if (!callSnapshot.exists) {
            await invitationSnapshot.ref.delete();
            return;
        }
        const data = callSnapshot.data();
        if (data.calleeUid !== signedInUser.uid || !data.participantUids?.includes(signedInUser.uid)) {
            throw new Error("O convite de chamada não corresponde ao utilizador autenticado.");
        }
        if (data.status !== "ringing") {
            await invitationSnapshot.ref.delete();
            if (CALL_TERMINAL_STATES.has(data.status)) {
                const caller = await loadVerifiedProfile(data.callerUid);
                await cleanupUnansweredCall(reference, caller);
            }
            return;
        }
        if (data.expiresAt?.toDate && data.expiresAt.toDate().getTime() <= Date.now()) {
            await reference.update({
                status: "expired",
                offer: null,
                answer: null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await invitationSnapshot.ref.delete();
            const caller = await loadVerifiedProfile(data.callerUid);
            await cleanupUnansweredCall(reference, caller);
            return;
        }
        if (incomingCall?.callId === invitation.callId || loadingIncomingId === invitation.callId) return;
        if (incomingCall || activeCall || loadingIncomingId) {
            await reference.update({
                status: "rejected",
                offer: null,
                answer: null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await invitationSnapshot.ref.delete();
            return;
        }
        loadingIncomingId = invitation.callId;
        try {
            const caller = await loadVerifiedProfile(data.callerUid);
            incomingCall = {
                callId: invitation.callId,
                reference,
                invitationReference: invitationSnapshot.ref,
                data,
                caller,
                unsubscribeCall: null,
                timeout: null
            };
            incomingCall.unsubscribeCall = reference.onSnapshot(callSnapshot => {
                if (!incomingCall || incomingCall.callId !== invitation.callId || !callSnapshot.exists) return;
                const updatedCall = callSnapshot.data();
                if (CALL_TERMINAL_STATES.has(updatedCall.status)) {
                    const ended = incomingCall;
                    incomingCall = null;
                    clearTimeout(ended.timeout);
                    ended.unsubscribeCall?.();
                    ended.invitationReference.delete().catch(error => showError(error, "Não foi possível limpar o convite da chamada."));
                    showTerminalStatus(updatedCall.status, caller.name, caller.photo);
                    cleanupUnansweredCall(reference, caller)
                        .catch(error => showError(error, "Não foi possível limpar os candidatos ICE da chamada."));
                } else if ((updatedCall.status === "connecting" || updatedCall.status === "active")
                    && !incomingCall.accepting) {
                    const answered = incomingCall;
                    incomingCall = null;
                    clearTimeout(answered.timeout);
                    answered.unsubscribeCall?.();
                    answered.invitationReference.delete()
                        .catch(error => showError(error, "Não foi possível limpar o convite atendido noutro dispositivo."));
                    showTerminalStatus("answeredElsewhere", caller.name, caller.photo);
                }
            }, error => showError(error, "Não foi possível acompanhar a chamada recebida."));
            const expiry = data.expiresAt?.toDate?.().getTime() || (Date.now() + CALL_TIMEOUT_MS);
            incomingCall.timeout = window.setTimeout(async () => {
                if (incomingCall?.callId !== invitation.callId) return;
                try {
                    const latest = await reference.get();
                    if (latest.exists && latest.data().status === "ringing") {
                        await reference.update({
                            status: "expired",
                            offer: null,
                            answer: null,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    }
                } catch (error) {
                    showError(error, "Não foi possível expirar a chamada não atendida.");
                }
            }, Math.max(0, expiry - Date.now()));
            showCall("incoming", caller.name, caller.photo, "incoming");
        } finally {
            loadingIncomingId = null;
        }
    }

    async function answerIncomingCall() {
        const pending = incomingCall;
        if (!pending || activeCall || !signedInUser || answeringCall) return;
        answeringCall = true;
        let call = null;
        let microphoneRequested = false;
        let answerDescription = null;
        let answerPublished = false;
        setStatus(stateLabel("requestingMicrophone"));
        setActions("connecting");
        try {
            if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
                throw new Error("As chamadas requerem um navegador compatível e HTTPS (ou localhost).");
            }
            const snapshot = await pending.reference.get();
            if (!snapshot.exists || snapshot.data().status !== "ringing") {
                incomingCall = null;
                pending.unsubscribeCall?.();
                clearTimeout(pending.timeout);
                setDialogVisible(false);
                throw new Error("A chamada já foi cancelada ou terminou.");
            }
            const data = snapshot.data();
            if (data.expiresAt?.toDate && data.expiresAt.toDate().getTime() <= Date.now()) {
                await pending.reference.update({
                    status: "expired",
                    offer: null,
                    answer: null,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                incomingCall = null;
                setDialogVisible(false);
                return;
            }
            microphoneRequested = true;
            const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            const snapshotAfterPermission = await pending.reference.get();
            if (!snapshotAfterPermission.exists || snapshotAfterPermission.data().status !== "ringing") {
                localStream.getTracks().forEach(track => track.stop());
                incomingCall = null;
                pending.unsubscribeCall?.();
                clearTimeout(pending.timeout);
                setDialogVisible(false);
                throw new Error("A chamada já foi cancelada ou terminou.");
            }
            call = newCallContext(pending.reference, "callee", pending.caller);
            activeCall = call;
            call.localStream = localStream;
            const peerConnection = await createPeerConnection(call);
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            call.remoteDescriptionSet = true;
            await flushPendingCandidates(call);
            listenForRemoteCandidates(call);
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            answerDescription = { type: answer.type, sdp: answer.sdp };
            const beforeAnswer = await pending.reference.get();
            if (!beforeAnswer.exists || beforeAnswer.data().status !== "ringing") {
                const state = beforeAnswer.exists ? beforeAnswer.data().status : "failed";
                pending.unsubscribeCall?.();
                clearTimeout(pending.timeout);
                incomingCall = null;
                await cleanupCall(call, false);
                pending.invitationReference.delete()
                    .catch(error => showError(error, "Não foi possível limpar o convite já atendido."));
                showTerminalStatus(
                    state === "connecting" || state === "active" ? "answeredElsewhere" : state,
                    pending.caller.name,
                    pending.caller.photo
                );
                return;
            }
            pending.accepting = true;
            await db().runTransaction(async transaction => {
                const latest = await transaction.get(pending.reference);
                if (!latest.exists || latest.data().status !== "ringing") {
                    throw new Error("A chamada já foi atendida ou terminou.");
                }
                transaction.update(pending.reference, {
                    answer: answerDescription,
                    status: "connecting",
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
            answerPublished = true;
            await flushPendingLocalCandidates(call);
            pending.unsubscribeCall?.();
            clearTimeout(pending.timeout);
            incomingCall = null;
            subscribeToCall(call);
            showCall("connecting", pending.caller.name, pending.caller.photo, "connecting");
            setCallTimeout(call);
            pending.invitationReference.delete().catch(error => showError(error, "Não foi possível limpar o convite atendido."));
        } catch (error) {
            const failedCall = activeCall?.reference === pending.reference ? activeCall : null;
            let callState = "ringing";
            if (failedCall) {
                try {
                    const latest = await pending.reference.get();
                    callState = latest.exists ? latest.data().status : "failed";
                    if (latest.exists && !answerPublished
                        && latest.data().answer?.sdp === answerDescription?.sdp) {
                        answerPublished = true;
                    }
                    if (callState === "connecting" || callState === "active") {
                        if (answerPublished) {
                            await pending.reference.update({
                                status: "failed",
                                offer: null,
                                answer: null,
                                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                            });
                            callState = "failed";
                        } else {
                            callState = "answeredElsewhere";
                        }
                    }
                } catch (stateError) {
                    console.error("Não foi possível terminar a chamada após uma falha ao atender.", stateError);
                }
                const terminal = CALL_TERMINAL_STATES.has(callState);
                const answeredElsewhere = callState === "answeredElsewhere";
                if (terminal || answeredElsewhere) {
                    pending.unsubscribeCall?.();
                    clearTimeout(pending.timeout);
                    incomingCall = null;
                    failedCall.signalReady = terminal;
                }
                await cleanupCall(failedCall, terminal);
                if (terminal || answeredElsewhere) showTerminalStatus(callState, pending.caller.name, pending.caller.photo);
            }
            if (incomingCall) {
                showCall("incoming", pending.caller.name, pending.caller.photo,
                    microphoneRequested && !call ? "microphoneDenied" : "failed");
            }
            showError(error, "Não foi possível atender a chamada.");
        } finally {
            answeringCall = false;
            if (incomingCall) setActions("incoming");
        }
    }

    async function rejectIncomingCall() {
        const pending = incomingCall;
        if (!pending || !signedInUser) return;
        try {
            await pending.reference.update({
                status: "rejected",
                offer: null,
                answer: null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            incomingCall = null;
            pending.unsubscribeCall?.();
            clearTimeout(pending.timeout);
            pending.invitationReference.delete().catch(error => showError(error, "Não foi possível limpar o convite recusado."));
            await cleanupUnansweredCall(pending.reference, pending.caller);
            showTerminalStatus("rejected", pending.caller.name, pending.caller.photo);
        } catch (error) {
            showError(error, "Não foi possível recusar a chamada.");
        }
    }

    async function deleteCandidates(call, collectionName) {
        const snapshot = await call.reference.collection(collectionName).get();
        for (let offset = 0; offset < snapshot.docs.length; offset += 450) {
            const batch = db().batch();
            snapshot.docs.slice(offset, offset + 450).forEach(document => batch.delete(document.ref));
            await batch.commit();
        }
    }

    async function cleanupCall(call, removeCandidates = true) {
        if (!call || call.closed) return;
        call.closed = true;
        clearTimeout(call.timeout);
        clearTimeout(reconnectTimer);
        clearInterval(durationTimer);
        durationTimer = null;
        reconnectTimer = null;
        call.unsubscribeCall?.();
        call.unsubscribeCandidates?.();
        call.peerConnection?.getSenders().forEach(sender => sender.track?.stop());
        call.peerConnection?.getReceivers().forEach(receiver => receiver.track?.stop());
        call.peerConnection?.close();
        call.localStream?.getTracks().forEach(track => track.stop());
        const audio = document.getElementById("voiceCallRemoteAudio");
        if (audio) {
            audio.pause();
            audio.srcObject = null;
            audio.controls = false;
        }
        if (activeCall === call) activeCall = null;
        const duration = document.getElementById("voiceCallDuration");
        if (duration) {
            duration.hidden = true;
            duration.textContent = "00:00";
        }
        if (call.reference && call.signalReady && removeCandidates) {
            await Promise.all([
                deleteCandidates(call, "callerCandidates"),
                deleteCandidates(call, "calleeCandidates")
            ]);
        }
    }

    async function finishCallLocally(call, status) {
        if (!call || call.terminalHandled) return;
        call.terminalHandled = true;
        showTerminalStatus(status, call.remote.name, call.remote.photo);
        await cleanupCall(call);
    }

    async function endCall(call, status) {
        if (!call || call.closed) return;
        let terminalStateSaved = false;
        try {
            await call.reference.update({
                status,
                offer: null,
                answer: null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            terminalStateSaved = true;
            showTerminalStatus(status, call.remote.name, call.remote.photo);
        } catch (error) {
            showError(error, "Não foi possível atualizar o estado da chamada.");
        } finally {
            await cleanupCall(call, terminalStateSaved);
        }
    }

    async function failCall(call, error, message) {
        if (!call || call.closed || call.terminalHandled) return;
        call.terminalHandled = true;
        showError(error, message);
        await endCall(call, "failed");
    }

    function toggleMicrophone(button) {
        const tracks = activeCall?.localStream?.getAudioTracks() || [];
        if (!tracks.length) return;
        const enabled = !tracks[0].enabled;
        tracks.forEach(track => { track.enabled = enabled; });
        button.setAttribute("aria-pressed", String(!enabled));
        button.textContent = enabled ? "Silenciar microfone" : "Ativar microfone";
    }

    function bindUi() {
        if (uiBound) return;
        uiBound = true;
        document.getElementById("voiceAcceptButton")?.addEventListener("click", answerIncomingCall);
        document.getElementById("voiceRejectButton")?.addEventListener("click", rejectIncomingCall);
        document.getElementById("voiceMuteButton")?.addEventListener("click", event => toggleMicrophone(event.currentTarget));
        document.getElementById("voiceEndButton")?.addEventListener("click", () => {
            if (activeCall) endCall(activeCall, activeCall.connected ? "ended" : "cancelled");
            else if (incomingCall) rejectIncomingCall();
        });
        document.getElementById("voiceCallModal")?.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                event.preventDefault();
                return;
            }
            if (event.key !== "Tab") return;
            const dialog = document.getElementById("voiceCallModal");
            const controls = [...dialog.querySelectorAll("button:not([hidden]):not(:disabled), audio[controls]")];
            if (!controls.length) {
                event.preventDefault();
                return;
            }
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });
    }

    function initialize(user) {
        bindUi();
        if (!user) return;
        if (signedInUser?.uid === user.uid && unsubscribeInvitations) return;
        unsubscribeInvitations?.();
        if (activeCall) cleanupCall(activeCall).catch(error => showError(error, "Não foi possível terminar a sessão anterior."));
        signedInUser = user;
        unsubscribeInvitations = db().collection("profiles").doc(user.uid)
            .collection("callInvitations")
            .onSnapshot(snapshot => {
                snapshot.docChanges().filter(change => change.type !== "removed").forEach(change => {
                    receiveInvitation(change.doc).catch(error => showError(error, "Não foi possível validar a chamada recebida."));
                });
            }, error => showError(error, "Não foi possível receber chamadas neste dispositivo."));
    }

    window.dimmakoVoiceCalls = Object.freeze({
        initialize,
        startOutgoingCall
    });
})();
