const MAPLIBRE_KEY = window.__DIMMAKO_FIREBASE_CONFIG__?.arcgisApiKey || "";
const friendsData = [];
let activeFriend = null;
let activeConversationId = null;
let unsubscribeConversationMessages = null;
let unsubscribeConversations = null;
let unsubscribePublicProfiles = null;
let unsubscribePosts = null;
let unsubscribePostsAuth = null;
let unsubscribeNotifications = null;
let publicProfiles = [];
let notifications = [];
let activeCategory = "Todos";
let posts = [];
const draftMedia = Array(4).fill(null);
let nextPostId = 1;
let currentView = "inicio";
let chatAberto = false;
let openCommentsPostId = null;
let salesHistory = null;
const localStateSyncTimes = new Map();
const localStateSyncTimers = new Map();
if (localStorage.getItem("dimmakoTema") !== "claro") document.body.classList.add("dark-theme");

const initials = name => name.split(" ").map(part => part[0]).slice(0, 2).join("").toUpperCase();
const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const formatKwanza = value => `Kz ${Number(value).toLocaleString("pt-BR")}`;

async function uploadImagemImgBB(ficheiro) {
    if (!window.dimmakoMedia) throw new Error("O serviço de envio de imagens não foi carregado.");
    return window.dimmakoMedia.uploadToImgBB(ficheiro);
}

async function imagemComAssinaturaValida(ficheiro) {
    return window.dimmakoMedia?.signatureIsValid(ficheiro) || false;
}

function marcarCampo(el, valido) {
    if (!el) return;
    el.classList.toggle("is-valid", valido);
    el.classList.toggle("is-invalid", !valido);
}

function validarCampoProduto(el) {
    if (!el) return true;
    const valor = (el.value || "").trim();
    let ok = true;
    if (el.id === "productName") ok = valor.length >= 2;
    else if (el.id === "productCategory") ok = valor !== "";
    else if (el.id === "productPrice" || el.id === "deliveryMunicipality" || el.id === "deliveryOutsideMunicipality" || el.id === "deliveryOutsideLuanda") ok = valor !== "" && Number(valor) >= 0;
    else if (el.id === "productDescription") ok = valor.length >= 8;
    else if (el.id === "buyCustomerName") ok = valor.length >= 2;
    else if (el.id === "buyCustomerPhone") ok = /^[+]?[\d\s]{9,15}$/.test(valor);
    else if (el.id === "buyDeliveryAddress") ok = valor.length >= 5;
    else if (el.id === "buyDeliveryZone") ok = valor !== "";
    else if (el.id === "profileNameInput") ok = valor.length >= 2;
    else if (el.type === "file") return true;
    else if (el.required) ok = el.checkValidity();
    marcarCampo(el, ok);
    return ok;
}

function configurarValidacaoHome() {
    const ids = ["productName", "productCategory", "productPrice", "productDescription", "deliveryMunicipality", "deliveryOutsideMunicipality", "deliveryOutsideLuanda", "buyCustomerName", "buyCustomerPhone", "buyDeliveryAddress", "buyDeliveryZone", "profileNameInput"];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("input", () => validarCampoProduto(el));
        el.addEventListener("change", () => validarCampoProduto(el));
    });
}

function mediaMarkup(post) {
    const items = post.media?.length ? post.media : (post.image ? [{ type: "image", src: post.image }] : []);
    if (!items.length) return "";
    const mediaItems = items.map(item => item.type === "video"
        ? `<div class="post-media-item"><video src="${escapeHTML(item.src)}" controls playsinline preload="metadata"></video></div>`
        : `<div class="post-media-item"><img src="${escapeHTML(item.src)}" alt="Imagem de ${escapeHTML(post.name)}" loading="lazy" decoding="async" onload="this.classList.add('carregada')" onerror="this.style.display='none';this.closest('.post-media-item').classList.add('sem-imagem')"></div>`).join("");
    if (items.length === 1) return `<div class="post-carousel"><div class="post-media-track">${mediaItems}</div></div>`;
    const dots = items.map((item, index) => `<button class="${index === 0 ? "active" : ""}" type="button" data-carousel-to="${index}" aria-label="Ver mídia ${index + 1}"></button>`).join("");
    return `<div class="post-carousel" data-carousel-index="0" data-carousel-count="${items.length}"><button class="post-carousel-control previous" type="button" data-carousel-step="-1" aria-label="Mídia anterior"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg></button><div class="post-media-track">${mediaItems}</div><button class="post-carousel-control next" type="button" data-carousel-step="1" aria-label="Próxima mídia"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m10 6 6 6-6 6"/></svg></button><div class="post-carousel-dots">${dots}</div></div>`;
}

function renderPosts(filter = "") {
    const search = filter.toLowerCase();
    const visible = posts.filter(post => (activeCategory === "Todos" || post.category === activeCategory) && (post.name + post.text + post.category).toLowerCase().includes(search));
    document.getElementById("posts").innerHTML = visible.length ? visible.map((post, idx) => {
        const postId = post.id !== undefined ? post.id : idx;
        return `<article class="post" data-post-id="${postId}"><div class="post-head"><div class="avatar">${escapeHTML(initials(post.name))}</div><div><strong>${escapeHTML(post.name)}</strong><time>${escapeHTML(post.time)} · ${escapeHTML(post.category)}</time></div></div>${post.title ? `<h3 class="product-title">${escapeHTML(post.title)}</h3>` : ""}${mediaMarkup(post)}${post.price ? `<div class="product-price">${formatKwanza(post.price)}</div>` : ""}<p>${escapeHTML(post.text)}</p>${post.delivery ? `<div class="delivery-rates"><div>Dentro do município<strong>${formatKwanza(post.delivery.municipality)}</strong></div><div>Fora do município<strong>${formatKwanza(post.delivery.outsideMunicipality)}</strong></div><div>Fora de Luanda<strong>${formatKwanza(post.delivery.outsideLuanda)}</strong></div></div>` : ""}<div class="post-actions"><div class="post-engagement"><button type="button"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg><span>${post.likes} Curtidas</span></button><button type="button"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg><span>${post.comments} Comentários</span></button><button type="button"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg><span>Compartilhar</span></button></div><button class="btn-buy" type="button" data-buy-id="${postId}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg><span>Comprar</span></button></div></article>`;
    }).join("") : `<div class="empty">${search ? "Nenhuma publicação encontrada." : "Ainda não há publicações."}</div>`;
    document.getElementById("postCount").textContent = `${visible.length} publicação${visible.length === 1 ? "" : "ções"}`;
    document.querySelectorAll("#posts .post").forEach(card => {
        card.id = `post-${card.dataset.postId}`;
    });
    melhorarCardsPublicacao();

    document.querySelectorAll(".btn-buy").forEach(button => {
        button.addEventListener("click", async event => {
            event.stopPropagation();
            const bid = button.dataset.buyId;
            const post = posts.find((p, idx) => (p.id !== undefined ? String(p.id) : String(idx)) === bid);
            if (!post) return;
            if (!post.authorId) {
                mostrarToast("O vendedor desta publicação ainda não tem um perfil Firebase associado.", "erro");
                return;
            }
            await iniciarConversaAmigo(post.authorId);
        });
    });
    actualizarBadges();
}

function obterIdentificadorInteracao() {
    return window.dimmakoFirebase?.auth.currentUser?.uid || null;
}

function obterNomeEmpresaPublicacao(post) {
    return post.companyName || post.authorName || post.name || "Empresa";
}

function obterAvaliacoesPublicacao(post) {
    return Array.isArray(post.ratings) ? post.ratings : [];
}

function calcularResumoAvaliacao(post) {
    const ratings = obterAvaliacoesPublicacao(post);
    const total = ratings.reduce((sum, rating) => sum + (Number(rating.stars) || 0), 0);
    return { average: ratings.length ? total / ratings.length : 0, count: ratings.length };
}

function obterPostPorId(id) {
    return posts.find((post, index) => String(post.id !== undefined ? post.id : index) === String(id));
}

function melhorarCardsPublicacao() {
    document.querySelectorAll("#posts .post").forEach(card => {
        const post = obterPostPorId(card.dataset.postId);
        const botoes = card.querySelectorAll(".post-engagement button");
        if (!post || botoes.length < 3) return;

        const curtido = Array.isArray(post.likedBy) && post.likedBy.includes(obterIdentificadorInteracao());
        const totalComentarios = Array.isArray(post.commentList) ? post.commentList.length : Number(post.comments) || 0;
        const nomeEmpresa = obterNomeEmpresaPublicacao(post);
        const avatar = card.querySelector(".post-head .avatar");
        const nomeEl = card.querySelector(".post-head strong, .post-head [data-open-seller-profile]");
        if (avatar) avatar.textContent = initials(nomeEmpresa);
        if (nomeEl && post.authorId) {
            if (nomeEl.tagName !== "BUTTON") {
                const profileLink = document.createElement("button");
                profileLink.type = "button";
                profileLink.className = "seller-profile-link";
                profileLink.dataset.openSellerProfile = post.authorId;
                nomeEl.replaceWith(profileLink);
                profileLink.textContent = nomeEmpresa;
            } else {
                nomeEl.textContent = nomeEmpresa;
            }
        } else if (nomeEl) {
            nomeEl.textContent = nomeEmpresa;
        }
        const acoes = ["like", "comments", "share"];
        botoes.forEach((botao, indice) => {
            botao.dataset.postAction = acoes[indice];
            botao.dataset.postId = card.dataset.postId;
            botao.setAttribute("aria-label", ["Curtir publicação", "Ver comentários", "Partilhar publicação"][indice]);
        });
        botoes[0].classList.toggle("is-liked", curtido);
        botoes[0].setAttribute("aria-pressed", String(curtido));
        botoes[0].querySelector("span").textContent = `${Number(post.likes) || 0} Curtidas`;
        botoes[1].querySelector("span").textContent = `${totalComentarios} Comentários`;

        if (String(openCommentsPostId) === String(card.dataset.postId)) {
            const panel = document.createElement("section");
            panel.className = "post-comments";
            panel.setAttribute("aria-label", "Comentários e avaliação do produto");
            const ratings = obterAvaliacoesPublicacao(post);
            const resumo = calcularResumoAvaliacao(post);
            const viewer = obterIdentificadorInteracao();
            const minhaAvaliacao = ratings.find(rating => rating.userId === viewer)?.stars || 0;
            const ratingMarkup = Array.from({ length: 5 }, (_, index) => {
                const stars = index + 1;
                return `<button class="rating-star${stars <= minhaAvaliacao ? " is-selected" : ""}" type="button" data-post-rating="${stars}" data-post-id="${escapeHTML(card.dataset.postId)}" aria-label="Avaliar com ${stars} ${stars === 1 ? "estrela" : "estrelas"}" aria-pressed="${stars === minhaAvaliacao}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8l-6.2 3.3L7 14.2 2 9.3l6.9-1L12 2Z"/></svg></button>`;
            }).join("");
            const commentsMarkup = (post.commentList || []).map(comment =>
                `<article class="post-comment"><strong>${escapeHTML(comment.name || "Utilizador")}</strong><p>${escapeHTML(comment.text || "")}</p></article>`
            ).join("");
            panel.innerHTML = `<div class="post-rating"><div><strong>Avalie este produto</strong><span class="rating-summary">${resumo.count ? `${resumo.average.toFixed(1)} de 5 · ${resumo.count} ${resumo.count === 1 ? "avaliação" : "avaliações"}` : "Ainda sem avaliações"}</span></div><div class="rating-stars" role="group" aria-label="Classificar produto de 1 a 5 estrelas">${ratingMarkup}</div></div><div class="post-comment-list">${commentsMarkup || `<p class="post-comments-empty">Ainda não há comentários.</p>`}</div>`;
            const form = document.createElement("form");
            form.className = "post-comment-form";
            form.dataset.postCommentForm = card.dataset.postId;
            const input = document.createElement("input");
            input.type = "text";
            input.name = "comment";
            input.maxLength = 500;
            input.placeholder = "Escreva um comentário...";
            input.setAttribute("aria-label", "Escreva um comentário");
            input.required = true;
            const submit = document.createElement("button");
            submit.type = "submit";
            submit.textContent = "Enviar";
            form.append(input, submit);
            panel.append(form);
            card.querySelector(".post-actions").before(panel);
        }
    });
}

function posicionarFiltrosMobile() {
    const filtros = document.getElementById("filterCarousel");
    const areaPesquisa = document.querySelector(".search-area");
    const feed = document.getElementById("pageHome");
    const publicacoes = document.getElementById("posts");
    if (!filtros || !areaPesquisa || !feed || !publicacoes) return;

    const mobile = window.matchMedia("(max-width: 768px)").matches;
    if (mobile) {
        areaPesquisa.insertBefore(filtros, document.getElementById("publishPost"));
        areaPesquisa.classList.add("search-area-with-filters");
    } else {
        feed.insertBefore(filtros, publicacoes);
        areaPesquisa.classList.remove("search-area-with-filters");
    }
}

function configurarPosicaoFiltrosMobile() {
    const breakpoint = window.matchMedia("(max-width: 768px)");
    const atualizar = () => window.requestAnimationFrame(posicionarFiltrosMobile);
    atualizar();
    breakpoint.addEventListener("change", atualizar);
    window.addEventListener("resize", atualizar, { passive: true });
    window.addEventListener("load", atualizar, { once: true });
}

function guardarEAtualizarPublicacoes() {
    guardarPublicacoes();
    const user = window.dimmakoFirebase?.auth.currentUser;
    if (user && window.dimmakoFirestoreData) {
        window.dimmakoFirestoreData.savePrivateRecord("legacy_publications", posts, user)
            .catch(error => {
                console.error("Não foi possível guardar a cópia privada das publicações legadas.", error);
                mostrarToast(error.message || "Não foi possível sincronizar o histórico local.", "erro");
            });
    }
    renderPosts(document.getElementById("postSearch").value);
}

async function partilharPublicacao(post) {
    const link = new URL(`home.html#post-${encodeURIComponent(post.id)}`, window.location.href).href;
    const dados = { title: post.title || "Publicação Dimmako", text: post.text, url: link };
    try {
        if (navigator.share) {
            await navigator.share(dados);
        } else if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(link);
            mostrarToast("Ligação da publicação copiada.", "sucesso");
        } else {
            const campo = document.createElement("textarea");
            campo.value = link;
            campo.style.position = "fixed";
            campo.style.opacity = "0";
            document.body.appendChild(campo);
            campo.select();
            const copiado = document.execCommand("copy");
            campo.remove();
            mostrarToast(copiado ? "Ligação da publicação copiada." : link, copiado ? "sucesso" : "info");
        }
    } catch (error) {
        if (error.name !== "AbortError") mostrarToast("Não foi possível partilhar esta publicação.", "erro");
    }
}

function configurarInteracoesPublicacao() {
    const container = document.getElementById("posts");
    container.addEventListener("click", async event => {
        const sellerLink = event.target.closest("[data-open-seller-profile]");
        if (sellerLink) {
            await openPublicSellerProfile(sellerLink.dataset.openSellerProfile);
            return;
        }
        const ratingButton = event.target.closest("[data-post-rating]");
        if (ratingButton) {
            const post = obterPostPorId(ratingButton.dataset.postId);
            const user = window.dimmakoFirebase?.auth.currentUser;
            if (!post || !user) return;
            if (!Array.isArray(post.ratings)) post.ratings = [];
            const stars = Number(ratingButton.dataset.postRating);
            const ratingReference = window.dimmakoFirebase.db.collection("posts").doc(String(post.id))
                .collection("ratings").doc(user.uid);
            const batch = window.dimmakoFirebase.db.batch();
            batch.set(ratingReference, {
                uid: user.uid,
                stars,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            batch.set(ratingReference.collection("history").doc(), {
                uid: user.uid,
                stars,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            batch.commit().then(() => {
                    const existingRating = post.ratings.find(rating => rating.userId === user.uid);
                    if (existingRating) existingRating.stars = stars;
                    else post.ratings.push({ userId: user.uid, stars });
                    openCommentsPostId = post.id;
                    renderPosts(document.getElementById("postSearch").value);
                })
                .catch(error => {
                    console.error("Não foi possível guardar a avaliação no Firestore.", error);
                    mostrarToast("A avaliação não foi guardada. Tente novamente.", "erro");
                });
            return;
        }
        const botao = event.target.closest("[data-post-action]");
        if (!botao) return;
        const post = obterPostPorId(botao.dataset.postId);
        if (!post) return;

        if (botao.dataset.postAction === "like") {
            const user = window.dimmakoFirebase?.auth.currentUser;
            if (!user) return;
            const postRef = window.dimmakoFirebase.db.collection("posts").doc(String(post.id));
            const likeRef = postRef.collection("likes").doc(user.uid);
            try {
                const created = await window.dimmakoFirebase.db.runTransaction(async transaction => {
                    const existing = await transaction.get(likeRef);
                    if (existing.exists) return false;
                    transaction.set(likeRef, {
                        uid: user.uid,
                        name: obterNomeUtilizadorAutenticado(user),
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    transaction.update(postRef, { likes: firebase.firestore.FieldValue.increment(1) });
                    const notificationRef = criarNotificacao(
                        window.dimmakoFirebase.db.collection("profiles").doc(post.authorId),
                        user
                    );
                    if (notificationRef) {
                        transaction.set(notificationRef, {
                            type: "like",
                            actorUid: user.uid,
                            actorName: obterNomeUtilizadorAutenticado(user),
                            postId: String(post.id),
                            conversationId: "",
                            messageId: "",
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            read: false
                        });
                    }
                    return true;
                });
                if (!created) {
                    mostrarToast("Você já curtiu esta publicação.", "info");
                    return;
                }
                post.likes = (Number(post.likes) || 0) + 1;
                post.likedBy = [user.uid];
                renderPosts(document.getElementById("postSearch").value);
            } catch (error) {
                console.error("Não foi possível guardar a curtida no Firestore.", error);
                mostrarToast("A curtida não foi guardada. Tente novamente.", "erro");
            }
        } else if (botao.dataset.postAction === "comments") {
            openCommentsPostId = String(openCommentsPostId) === String(post.id) ? null : post.id;
            if (openCommentsPostId !== null) await carregarInteracoesPost(post);
            renderPosts(document.getElementById("postSearch").value);
            if (openCommentsPostId !== null) document.querySelector(`[data-post-comment-form="${CSS.escape(String(post.id))}"] input`)?.focus();
        } else if (botao.dataset.postAction === "share") {
            await partilharPublicacao(post);
        }
    });

    container.addEventListener("submit", async event => {
        const form = event.target.closest("[data-post-comment-form]");
        if (!form) return;
        event.preventDefault();
        const input = form.elements.comment;
        const texto = input.value.normalize("NFC").replace(/[\u0000-\u001F\u007F]/g, "").trim();
        if (!texto || texto.length > 500) {
            input.setCustomValidity("O comentário deve ter entre 1 e 500 caracteres.");
            input.reportValidity();
            return;
        }
        input.setCustomValidity("");
        const post = obterPostPorId(form.dataset.postCommentForm);
        if (!post) return;
        const user = window.dimmakoFirebase?.auth.currentUser;
        if (!user) {
            mostrarToast("Entre na sua conta para comentar.", "erro");
            return;
        }
        const postRef = window.dimmakoFirebase.db.collection("posts").doc(String(post.id));
        const commentRef = postRef.collection("comments").doc();
        const nome = obterNomeUtilizadorAutenticado(user);
        const batch = window.dimmakoFirebase.db.batch();
        batch.set(commentRef, {
            authorUid: user.uid,
            name: nome,
            text: texto,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        batch.update(postRef, {
            comments: firebase.firestore.FieldValue.increment(1),
            lastCommentId: commentRef.id
        });
        const notificationRef = criarNotificacao(
            window.dimmakoFirebase.db.collection("profiles").doc(post.authorId),
            user
        );
        if (notificationRef) {
            batch.set(notificationRef, {
                type: "comment",
                actorUid: user.uid,
                actorName: nome,
                postId: String(post.id),
                conversationId: "",
                messageId: "",
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                read: false
            });
        }
        try {
            await batch.commit();
            if (!Array.isArray(post.commentList)) post.commentList = [];
            post.commentList.push({ name: nome, text: texto });
            post.comments = (Number(post.comments) || 0) + 1;
            input.value = "";
            await carregarInteracoesPost(post);
            renderPosts(document.getElementById("postSearch").value);
        } catch (error) {
            console.error("Não foi possível guardar o comentário no Firestore.", error);
            mostrarToast("O comentário não foi guardado. Tente novamente.", "erro");
        }
    });
}

async function carregarInteracoesPost(post) {
    const reference = window.dimmakoFirebase.db.collection("posts").doc(String(post.id));
    const user = window.dimmakoFirebase.auth.currentUser;
    try {
        const [comments, ratings, ownLike] = await Promise.all([
            reference.collection("comments").orderBy("createdAt", "asc").get(),
            reference.collection("ratings").get(),
            user ? reference.collection("likes").doc(user.uid).get() : Promise.resolve(null)
        ]);
        post.commentList = comments.docs.map(document => document.data());
        post.ratings = ratings.docs.map(document => ({
            userId: document.id,
            stars: document.data().stars
        }));
        post.likedBy = ownLike?.exists ? [user.uid] : [];
        post.comments = Number(post.comments) || post.commentList.length;
    } catch (error) {
        console.error("Não foi possível carregar curtidas e comentários do Firestore.", error);
        mostrarToast("Não foi possível carregar os comentários desta publicação.", "erro");
    }
}
function renderFriends(filter = "") {
    const visible = friendsData.filter(friend => friend.name.toLowerCase().includes(filter.toLowerCase()));
    const container = document.getElementById("friends");
    container.innerHTML = visible.length ? visible.map(friend => {
        const avatar = friend.foto
            ? `<img src="${escapeHTML(friend.foto)}" alt="" decoding="async" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
            : escapeHTML(initials(friend.name));
        return `<button class="friend ${activeFriend === friend.uid ? "selected" : ""}" data-friend="${escapeHTML(friend.uid)}"><div class="avatar-wrap"><div class="avatar">${avatar}</div></div><div class="friend-info"><strong>${escapeHTML(friend.name)}</strong><span>${escapeHTML(friend.lastMessage || "Ainda sem mensagens")}</span></div></button>`;
    }).join("") : `<div class="empty">${filter ? "Nenhum amigo encontrado." : "Sua lista de amigos ainda está vazia."}</div>`;
    container.querySelectorAll(".friend").forEach(button => button.addEventListener("click", () => openChat(button.dataset.friend)));
}

function openChat(uid) {
    const friend = friendsData.find(item => item.uid === uid);
    const user = window.dimmakoFirebase?.auth.currentUser;
    if (!friend || !user) return;
    const participants = [user.uid, friend.uid].sort();
    activeFriend = friend.uid;
    activeConversationId = friend.conversationId || participants.join("_");
    document.getElementById("chatName").textContent = friend.name;
    aplicarAvatar("chatAvatar", friend.foto, friend.name);
    document.getElementById("messages").replaceChildren();
    document.getElementById("conversation").classList.add("open");
    document.querySelector(".chat-panel").classList.add("is-conversation");
    if (unsubscribeConversationMessages) unsubscribeConversationMessages();
    unsubscribeConversationMessages = window.dimmakoFirebase.db.collection("conversations")
        .doc(activeConversationId).collection("messages")
        .orderBy("createdAt", "desc").limit(100)
        .onSnapshot(snapshot => {
            const messages = document.getElementById("messages");
            messages.innerHTML = snapshot.docs.slice().reverse().map(doc => {
                const message = doc.data();
                const ownMessage = message.senderId === user.uid;
                return `<div class="message ${ownMessage ? "mine" : ""}">${escapeHTML(message.text || "")}</div>`;
            }).join("");
            const latestMessage = snapshot.docs[snapshot.docs.length - 1]?.data();
            const friend = friendsData.find(item => item.uid === uid);
            if (friend && latestMessage) {
                friend.lastMessage = latestMessage.text;
                renderFriends(document.getElementById("friendSearch").value);
            }

            function obterNomeAmigoAtivo() {
                return friendsData.find(friend => friend.uid === activeFriend)?.name || "Amigo";
            }
            messages.scrollTop = messages.scrollHeight;
        }, error => {
            console.error("Não foi possível sincronizar as mensagens.", error);
            mostrarToast("Não foi possível carregar esta conversa. Verifique as regras do Firestore.", "erro");
        });
    renderFriends(document.getElementById("friendSearch").value);
}
function mostrarToast(mensagem, tipo = "info", duracao = 3500) {
    let container = document.getElementById("dimmakoToastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "dimmakoToastContainer";
        container.className = "toast-container";
        document.body.appendChild(container);
    }
    const svgIcons = {
        info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
        sucesso: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
        erro: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`
    };
    const toast = document.createElement("div");
    toast.className = `toast toast-${tipo}`;
    const icone = svgIcons[tipo] || svgIcons.info;
    toast.innerHTML = `<span class="toast-icone">${icone}</span><span class="toast-texto">${escapeHTML(mensagem)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = "toastOut 0.3s forwards";
        setTimeout(() => {
            if (toast.parentElement) toast.parentElement.removeChild(toast);
        }, 300);
    }, duracao);
}
window.mostrarToast = mostrarToast;

function aplicarAvatar(elemId, foto, nome) {
    const el = document.getElementById(elemId);
    if (!el) return;
    if (foto) {
        el.innerHTML = `<img src="${foto}" alt="${escapeHTML(nome)}" decoding="async" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`;
    } else {
        el.textContent = initials(nome);
    }
}

function setupSession() {
    let session = null;
    try {
        session = JSON.parse(localStorage.getItem("dimmakoSessaoActual") || "null");
    } catch (error) {
        session = null;
    }
    const name = session && (session.nome || session.nomeCompleto || session.nomeEmpresa)
        ? (session.nome || session.nomeCompleto || session.nomeEmpresa)
        : "Visitante";
    const type = session && session.tipo
        ? (session.tipo === "vendedor" ? (session.nomeEmpresa ? `Vendedor • ${session.nomeEmpresa}` : "Vendedor") : "Cliente")
        : "Sem sessão";
    document.getElementById("userName").textContent = name;
    document.getElementById("mobileUserName").textContent = name;
    document.getElementById("userType").textContent = type;

    const foto = session && session.foto ? session.foto : null;
    aplicarAvatar("avatar", foto, name);
    aplicarAvatar("mobileAvatar", foto, name);
    aplicarAvatar("profileAvatar", foto, name);

    aplicarPermissoesUsuario();
    if (window.dimmakoFirebase?.auth.currentUser) {
        window.dimmakoVoiceCalls?.initialize(window.dimmakoFirebase.auth.currentUser);
    }
    if (window.dimmakoFirebase?.auth.currentUser?.uid === session?.uid) carregarAmigos();
}

function aplicarPermissoesUsuario() {
    let session = null;
    try {
        session = JSON.parse(localStorage.getItem("dimmakoSessaoActual") || "null");
    } catch (error) {
        session = null;
    }

    const tipoUsuario = session && session.tipo ? session.tipo.toLowerCase() : "";
    const ehVendedor = tipoUsuario === "vendedor";

    const btnConfirmarVenda = document.getElementById("confirmSaleButton");
    if (btnConfirmarVenda) {
        btnConfirmarVenda.style.display = ehVendedor ? "inline-flex" : "none";
    }

    // 1. Botão de Publicar no Topbar / Feed (Desktop)
    const btnPublicarTopo = document.getElementById("publishPost");
    if (btnPublicarTopo) {
        if (ehVendedor) {
            btnPublicarTopo.style.display = "flex";
        } else {
            btnPublicarTopo.style.display = "none";
        }
    }

    // 2. Botão Vendas no Menu Lateral (Desktop)
    const btnVendasSidebar = document.querySelector('.nav button[data-view="vendas"]');
    if (btnVendasSidebar) {
        if (ehVendedor) {
            btnVendasSidebar.style.display = "flex";
        } else {
            btnVendasSidebar.style.display = "none";
        }
    }

    // 3. Botão Vendas no Menu Mobile
    const btnVendasMobile = document.querySelector('.mobile-nav button[data-mobile-view="vendas"]');
    if (btnVendasMobile) {
        if (ehVendedor) {
            btnVendasMobile.style.display = "flex";
        } else {
            btnVendasMobile.style.display = "none";
        }
    }

    // 4. Atualizar botão flutuante mobile
    atualizarBotaoPublicarMobile();
}

function guardarAmigos() {
    renderFriends(document.getElementById("friendSearch")?.value || "");
    actualizarBadges();
}

function actualizarBadges() {
    const contadores = {
        inicio: posts.length,
        chat: friendsData.filter(item => item.lastMessage).length,
        vendas: getSalesHistoryData().length,
        notificacoes: notifications.filter(item => !item.read).length
    };
    document.querySelectorAll(".nav-badge").forEach(badge => {
        const valor = contadores[badge.dataset.badge] || 0;
        if (valor > 0) {
            badge.textContent = valor > 99 ? "99+" : String(valor);
            badge.classList.add("show");
        } else {
            badge.textContent = "";
            badge.classList.remove("show");
        }
    });
    const markReadButton = document.getElementById("markNotificationsRead");
    if (markReadButton) markReadButton.disabled = !notifications.some(item => !item.read);
}

function carregarNotificacoes(user) {
    if (unsubscribeNotifications) return;
    unsubscribeNotifications = window.dimmakoFirebase.db.collection("profiles").doc(user.uid)
        .collection("notifications").orderBy("createdAt", "desc")
        .onSnapshot(snapshot => {
            notifications = snapshot.docs.map(document => ({ ...document.data(), id: document.id }));
            renderNotifications();
            actualizarBadges();
        }, error => {
            unsubscribeNotifications = null;
            console.error("Não foi possível sincronizar as notificações do Firebase.", error);
            mostrarToast("Não foi possível carregar as notificações. Verifique as regras do Firestore.", "erro");
        });
}

function renderNotifications() {
    const list = document.getElementById("notificationList");
    if (!list) return;
    if (!notifications.length) {
        list.innerHTML = `<div class="empty">Você ainda não tem notificações.</div>`;
        return;
    }
    list.innerHTML = notifications.map(item => {
        const verb = item.type === "like" ? "curtiu uma publicação sua"
            : item.type === "comment" ? "comentou numa publicação sua"
                : "enviou-lhe uma mensagem";
        const date = item.createdAt?.toDate?.();
        const time = date ? new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(date) : "Agora";
        return `<button class="notification-item${item.read ? "" : " unread"}" type="button"
            data-notification-id="${escapeHTML(item.id)}">
            <strong>${escapeHTML(item.actorName || "Utilizador")} ${verb}</strong>
            <span>${escapeHTML(time)}</span>
        </button>`;
    }).join("");
}

function criarNotificacao(reference, user) {
    if (!reference || !user || reference.id === user.uid) return null;
    return reference.collection("notifications").doc();
}

function obterNomeUtilizadorAutenticado(user) {
    try {
        const session = JSON.parse(localStorage.getItem("dimmakoSessaoActual") || "null");
        if (session?.uid === user.uid) {
            return String(session.nomeEmpresa || session.nome || session.nomeCompleto || user.displayName || "Utilizador").slice(0, 100);
        }
    } catch (error) {
        console.error("Não foi possível ler o nome de apresentação local.", error);
    }
    return String(user.displayName || "Utilizador").slice(0, 100);
}

async function marcarNotificacaoLida(notificationId) {
    const user = window.dimmakoFirebase?.auth.currentUser;
    if (!user || !notificationId) return;
    await window.dimmakoFirebase.db.collection("profiles").doc(user.uid)
        .collection("notifications").doc(notificationId).update({
            read: true,
            readAt: firebase.firestore.FieldValue.serverTimestamp()
        });
}

function carregarAmigos() {
    const user = window.dimmakoFirebase?.auth.currentUser;
    if (!user || unsubscribeConversations) return;

    if (!unsubscribePublicProfiles) {
        unsubscribePublicProfiles = window.dimmakoFirebase.db.collection("publicProfiles")
            .where("visible", "==", true)
            .where("verified", "==", true)
            .onSnapshot(snapshot => {
            publicProfiles = snapshot.docs.map(doc => ({ ...doc.data(), documentId: doc.id }))
                .filter(profile => profile.uid === profile.documentId
                    && profile.uid !== user.uid
                    && profile.verified === true
                    && ["cliente", "vendedor"].includes(profile.tipo)
                    && typeof (profile.nome || profile.nomeEmpresa) === "string"
                    && (profile.nome || profile.nomeEmpresa).trim().length > 0)
                .map(({ documentId, ...profile }) => profile);
            renderListaAmigosDisponiveis(document.getElementById("addFriendSearchInput")?.value || "");
            }, error => {
                unsubscribePublicProfiles = null;
                console.error("Não foi possível carregar o diretório público de utilizadores.", error);
                mostrarToast("Não foi possível carregar os utilizadores. Verifique as regras do Firestore.", "erro");
            });
    }

    unsubscribeConversations = window.dimmakoFirebase.db.collection("conversations")
        .where("participantUids", "array-contains", user.uid)
        .onSnapshot(async snapshot => {
            try {
                const friends = await Promise.all(snapshot.docs.map(async conversation => {
                    const otherUid = conversation.data().participantUids.find(uid => uid !== user.uid);
                    if (!otherUid) return null;
                    const profile = publicProfiles.find(item => item.uid === otherUid)
                        || (await window.dimmakoFirebase.db.collection("publicProfiles").doc(otherUid).get()).data();
                    return profile && profile.uid === otherUid
                        && profile.verified === true
                        && ["cliente", "vendedor"].includes(profile.tipo)
                        && (profile.nome || profile.nomeEmpresa) ? {
                        uid: profile.uid,
                        name: profile.nome || profile.nomeEmpresa || "Utilizador",
                        company: profile.nomeEmpresa || "",
                        username: profile.uid,
                        foto: profile.foto || "",
                        conversationId: conversation.id
                    } : null;
                }));
                friendsData.splice(0, friendsData.length, ...friends.filter(Boolean));
                renderFriends(document.getElementById("friendSearch")?.value || "");
                actualizarBadges();
            } catch (error) {
                console.error("Não foi possível carregar as conversas do Firebase.", error);
                mostrarToast("Não foi possível carregar as conversas. Tente novamente.", "erro");
            }
        }, error => {
            unsubscribeConversations = null;
            console.error("Falha na sincronização das conversas.", error);
            mostrarToast("Não foi possível sincronizar as conversas. Verifique as regras do Firestore.", "erro");
        });
}

function guardarPublicacoes() {
    localStorage.setItem("dimmakoPublicacoes", JSON.stringify(posts));
    localStorage.setItem("dimmakoNextPostId", String(nextPostId));
}

function carregarPublicacoes() {
    try {
        const saved = JSON.parse(localStorage.getItem("dimmakoPublicacoes") || "[]");
        saved.forEach((post, index) => {
            if (post.id === undefined || post.id === null) post.id = index + 1;
            post.likes = Number(post.likes) || 0;
            post.likedBy = Array.isArray(post.likedBy) ? post.likedBy : [];
            post.commentList = Array.isArray(post.commentList) ? post.commentList : [];
            post.comments = Math.max(Number(post.comments) || 0, post.commentList.length);
        });
        posts.splice(0, posts.length, ...saved);
        nextPostId = Math.max(Number(localStorage.getItem("dimmakoNextPostId")) || 1, ...posts.map(post => Number(post.id) + 1));
    } catch (error) {
        console.error("Não foi possível ler as publicações antigas guardadas neste dispositivo.", error);
        mostrarToast("O histórico local de publicações está danificado e foi mantido sem alterações.", "erro", 6000);
    }

    if (unsubscribePostsAuth || !window.dimmakoFirebase) return;
    unsubscribePostsAuth = window.dimmakoFirebase.auth.onAuthStateChanged(user => {
        if (!user) return;
        carregarAmigos();
        carregarNotificacoes(user);
        (async () => {
            try {
                const migrationWarnings = await migrarDadosLocaisParaFirebase(user);
                if (migrationWarnings.length) {
                    mostrarToast(migrationWarnings.join(" "), "info", 7000);
                }
                await carregarHistoricoVendasFirebase(user);
                await carregarPreferenciasFirebase(user);
            } catch (error) {
                console.error("Não foi possível migrar todos os dados locais para o Firebase.", error);
                mostrarToast(error.message || "A sincronização de dados locais falhou. Os dados deste dispositivo foram mantidos.", "erro", 6500);
            }
            if (unsubscribePosts) return;
            unsubscribePosts = window.dimmakoFirebase.db.collection("posts")
                .orderBy("createdAt", "desc")
                .limit(100)
                .onSnapshot(snapshot => {
                    posts.splice(0, posts.length, ...snapshot.docs.map(document => {
                        const post = document.data();
                        const cached = posts.find(item => String(item.id) === document.id);
                        const createdAt = post.createdAt?.toDate?.();
                        return {
                            ...post,
                            id: document.id,
                            time: createdAt
                                ? new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(createdAt)
                                : "agora",
                            likes: Number(post.likes) || 0,
                            comments: Number(post.comments) || 0,
                            likedBy: cached?.likedBy || [],
                            commentList: cached?.commentList || [],
                            ratings: cached?.ratings || []
                        };
                    }));
                    renderPosts(document.getElementById("postSearch")?.value || "");
                    actualizarBadges();
                }, error => {
                    unsubscribePosts = null;
                    console.error("Não foi possível sincronizar as publicações do Firestore.", error);
                    mostrarToast("Não foi possível carregar publicações do Firebase. Verifique as regras do Firestore.", "erro");
                });
        })();
    });
}

async function migrarDadosLocaisParaFirebase(user) {
    const dataService = window.dimmakoFirestoreData;
    if (!dataService) throw new Error("O serviço de persistência Firebase não foi carregado.");
    const warnings = [];
    const localSessionMatchesUser = sessaoLocalPertenceA(user);
    if (!localSessionMatchesUser && localStorage.getItem("dimmakoSessaoActual")) {
        warnings.push("A sessão local não corresponde à conta atual; dados privados sem proprietário verificável foram mantidos neste dispositivo.");
    }

    for (const key of [
        "dimmaPreferencias",
        "dimmakoTema",
        "dimmakoLocalizacaoPartilhada",
        "dimmakoMinhaLocalizacao",
        "dimmakoPartilhaLocalizacao"
    ]) {
        const stored = localStorage.getItem(key);
        if (stored === null) continue;
        if (key === "dimmaPreferencias" && !localSessionMatchesUser) {
            warnings.push("As preferências locais não foram associadas à conta atual porque o proprietário não pôde ser confirmado.");
            continue;
        }
        if (key.startsWith("dimmakoLocalizacao") || key === "dimmakoPartilhaLocalizacao") {
            if (!localSessionMatchesUser) {
                warnings.push("As localizações antigas não foram associadas à conta atual porque o proprietário local não pôde ser confirmado.");
                continue;
            }
        }
        let value;
        try {
            value = JSON.parse(stored);
        } catch (error) {
            throw new Error(`Os dados locais "${key}" não puderam ser lidos; o conteúdo original foi preservado.`);
        }
        await dataService.importPrivateRecord(`legacy_${key}`, value, user);
    }

    const legacySales = localStorage.getItem("dimmakoHistoricoVendas");
    if (legacySales !== null) {
        if (!localSessionMatchesUser) {
            warnings.push("O histórico de vendas local não foi associado à conta atual porque o proprietário local não pôde ser confirmado.");
        } else {
        let records;
        try {
            records = JSON.parse(legacySales);
        } catch (error) {
            throw new Error("O histórico de vendas local não pôde ser lido; o conteúdo original foi preservado.");
        }
        if (!Array.isArray(records)) throw new Error("O histórico de vendas local tem um formato inválido e foi preservado.");
        await dataService.importSales(records, user);
        }
    }

    const legacyPosts = localStorage.getItem("dimmakoPublicacoes");
    if (legacyPosts === null) return warnings;
    let records;
    try {
        records = JSON.parse(legacyPosts);
    } catch (error) {
        throw new Error("As publicações locais não puderam ser lidas; o conteúdo original foi preservado.");
    }
    if (!Array.isArray(records)) throw new Error("As publicações locais têm um formato inválido e foram preservadas.");

    let skippedUnverifiedPosts = 0;
    for (let index = 0; index < records.length; index += 1) {
        const candidate = records[index];
        const ownerMatches = candidate && (candidate.authorId === user.uid
            || (user.email && String(candidate.authorId || "").toLowerCase() === user.email.toLowerCase()));
        if (!ownerMatches) {
            skippedUnverifiedPosts += 1;
            continue;
        }
        const legacyPost = await prepararPublicacaoLegada(candidate);
        await dataService.importPrivateRecord(`legacy_post_${index}`, legacyPost, user);
        if (!publicacaoLegadaValida(legacyPost)) continue;

        const reference = window.dimmakoFirebase.db.collection("posts")
            .doc(`legacy_${user.uid}_${index}`);
        const existing = await reference.get();
        if (existing.exists) continue;
        await reference.set({
            authorId: user.uid,
            name: String(legacyPost.companyName || legacyPost.authorName || legacyPost.name || "Vendedor").slice(0, 100),
            authorName: String(legacyPost.authorName || legacyPost.name || "Vendedor").slice(0, 100),
            companyName: String(legacyPost.companyName || legacyPost.name || "Vendedor").slice(0, 100),
            category: String(legacyPost.category || "Comércio Geral").slice(0, 80),
            title: String(legacyPost.title || legacyPost.name || "Produto").slice(0, 120),
            text: String(legacyPost.text || legacyPost.description || "Publicação migrada do histórico local.").slice(0, 2000),
            price: Math.max(0, Number(legacyPost.price) || 0),
            delivery: {
                municipality: Math.max(0, Number(legacyPost.delivery?.municipality) || 0),
                outsideMunicipality: Math.max(0, Number(legacyPost.delivery?.outsideMunicipality) || 0),
                outsideLuanda: Math.max(0, Number(legacyPost.delivery?.outsideLuanda) || 0)
            },
            media: legacyPost.media.filter(item => window.dimmakoMedia.isImgBBUrl(item.src)).slice(0, 4),
            likes: Math.max(0, Math.floor(Number(legacyPost.likes) || 0)),
            comments: Math.max(0, Math.floor(Number(legacyPost.comments) || 0)),
            available: legacyPost.available !== false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
    if (skippedUnverifiedPosts) {
        warnings.push(`${skippedUnverifiedPosts} publicação(ões) locais sem proprietário verificável foram mantidas neste dispositivo e não foram atribuídas a esta conta.`);
    }
    return warnings;
}

async function prepararPublicacaoLegada(record) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
        throw new Error("Uma publicação local tem um formato inválido e foi mantida no dispositivo.");
    }
    const post = JSON.parse(JSON.stringify(record));
    const legacyMedia = Array.isArray(post.media)
        ? post.media
        : post.image ? [{ type: "image", src: post.image }] : [];
    post.media = [];
    for (const item of legacyMedia) {
        let source = item && (item.src || item.url);
        if (typeof source !== "string") continue;
        if (source.startsWith("data:")) {
            const response = await fetch(source);
            if (!response.ok) throw new Error("Uma imagem antiga não pôde ser preparada para o ImgBB.");
            source = await uploadImagemImgBB(await response.blob());
        } else if (source.startsWith("blob:")) {
            throw new Error("Uma publicação contém uma imagem temporária que não pode ser recuperada. O original local foi mantido.");
        }
        if (window.dimmakoMedia.isImgBBUrl(source)) post.media.push({ type: "image", src: source });
    }
    if (post.image !== undefined) {
        const imageUrl = typeof post.image === "string" && window.dimmakoMedia.isImgBBUrl(post.image)
            ? post.image
            : post.media[0]?.src;
        if (imageUrl) post.image = imageUrl;
        else delete post.image;
    }
    return post;
}

function publicacaoLegadaValida(post) {
    return Array.isArray(post.media)
        && post.media.length > 0
        && String(post.title || post.name || "").trim().length >= 2
        && String(post.text || post.description || "").trim().length >= 8
        && String(post.category || "Comércio Geral").trim().length > 0;
}

async function carregarHistoricoVendasFirebase(user) {
    const collection = window.dimmakoFirebase.db.collection("profiles").doc(user.uid).collection("sales");
    const snapshot = await collection.get();
    salesHistory = snapshot.docs.map(document => {
        const data = document.data();
        return data.legacyRecord || { ...data, id: document.id };
    });
    renderSalesHistory();
    actualizarBadges();
}

async function carregarPreferenciasFirebase(user) {
    const reference = window.dimmakoFirebase.db.collection("profiles").doc(user.uid)
        .collection("privateData").doc("preferences");
    const snapshot = await reference.get();
    let values;
    if (snapshot.exists && snapshot.data().value) {
        values = snapshot.data().value;
    } else {
        let localPreferences = {};
        if (sessaoLocalPertenceA(user)) {
            try {
                localPreferences = JSON.parse(localStorage.getItem("dimmaPreferencias") || "{}");
            } catch (error) {
                throw new Error("As preferências locais não puderam ser lidas e foram preservadas.");
            }
        }
        values = { ...localPreferences, darkTheme: localStorage.getItem("dimmakoTema") !== "claro" };
        await window.dimmakoFirestoreData.savePrivateRecord("preferences", values, user);
    }
    const publicProfileSetting = document.querySelector('[data-setting="publicProfile"]');
    if (typeof values.publicProfile !== "boolean" && publicProfileSetting) {
        values.publicProfile = publicProfileSetting.checked;
    }
    document.querySelectorAll("[data-setting]").forEach(input => {
        if (Object.prototype.hasOwnProperty.call(values, input.dataset.setting)) {
            input.checked = Boolean(values[input.dataset.setting]);
        }
    });
    if (typeof values.darkTheme === "boolean") aplicarTema(values.darkTheme);
    if (typeof values.publicProfile === "boolean") await atualizarVisibilidadePerfil(user, values.publicProfile);
    const localSettings = { ...values };
    delete localSettings.darkTheme;
    localStorage.setItem("dimmaPreferencias", JSON.stringify(localSettings));
}

function sessaoLocalPertenceA(user) {
    try {
        const session = JSON.parse(localStorage.getItem("dimmakoSessaoActual") || "null");
        return Boolean(session && (
            session.uid === user.uid
            || (user.email && String(session.identificador || session.email || "").toLowerCase() === user.email.toLowerCase())
        ));
    } catch (error) {
        console.error("Não foi possível confirmar o proprietário dos dados locais.", error);
        return false;
    }
}

async function atualizarVisibilidadePerfil(user, visible) {
    const db = window.dimmakoFirebase.db;
    const privateProfile = await db.collection("profiles").doc(user.uid).get();
    if (!privateProfile.exists) throw new Error("O perfil Firebase não foi encontrado para atualizar a visibilidade.");
    const profile = privateProfile.data();
    await db.collection("publicProfiles").doc(user.uid).set({
        uid: user.uid,
        tipo: profile.tipo,
        nome: profile.nome || "Utilizador",
        nomeEmpresa: profile.nomeEmpresa || "",
        categoria: profile.categoria || "",
        descricao: profile.descricao || "",
        foto: profile.foto || null,
        visible: Boolean(visible),
        verified: true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

async function persistirPreferenciasFirebase(values) {
    localStorage.setItem("dimmaPreferencias", JSON.stringify(values));
    const user = window.dimmakoFirebase?.auth.currentUser;
    if (!user || !window.dimmakoFirestoreData) throw new Error("Inicie sessão antes de guardar preferências.");
    await window.dimmakoFirestoreData.savePrivateRecord("preferences", {
        ...values,
        darkTheme: document.body.classList.contains("dark-theme")
    }, user);
    if (Object.prototype.hasOwnProperty.call(values, "publicProfile")) {
        await atualizarVisibilidadePerfil(user, values.publicProfile);
    }
}

function atualizarBotaoPublicarMobile() {
    const btn = document.getElementById("mobilePublish");
    if (!btn) return;

    let session = null;
    try {
        session = JSON.parse(localStorage.getItem("dimmakoSessaoActual") || "null");
    } catch (error) {
        session = null;
    }
    const tipoUsuario = session && session.tipo ? session.tipo.toLowerCase() : "vendedor";
    const ehVendedor = tipoUsuario === "vendedor";

    if (chatAberto) {
        // No chat, tanto vendedor quanto cliente podem adicionar amigos
        btn.style.display = "flex";
        btn.classList.remove("fab-hidden");
        btn.setAttribute("aria-label", "Adicionar amigo");
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg><span>Adicionar Amigo</span>`;
        return;
    }

    // Fora do chat:
    if (!ehVendedor) {
        // Cliente nunca visualiza o botão de publicar
        btn.style.display = "none";
        btn.classList.add("fab-hidden");
        return;
    }

    // Para vendedor fora do chat:
    const telasSemFab = ["mapa", "vendas", "historico", "configuracoes", "perfil", "notificacoes"];
    if (telasSemFab.includes(currentView)) {
        btn.style.display = "none";
        btn.classList.add("fab-hidden");
    } else {
        btn.style.display = "flex";
        btn.classList.remove("fab-hidden");
        btn.setAttribute("aria-label", "Publicar");
        btn.innerHTML = `<strong>+</strong><span>Publicar</span>`;
    }
}

function obterEstiloMapa(escuro, tipoMapa = estiloMapaActual || "normal") {
    if (!MAPLIBRE_KEY) {
        return escuro
            ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
            : "https://tiles.openfreemap.org/styles/liberty";
    }
    const tema = escuro ? "navigation-night" : "streets";
    const mapas = {
        normal: escuro ? `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/navigation-night?token=${MAPLIBRE_KEY}` : `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/streets?token=${MAPLIBRE_KEY}`,
        hibrido: `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/hybrid?token=${MAPLIBRE_KEY}`,
        "3d": `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/${tema}?token=${MAPLIBRE_KEY}`
    };
    return mapas[tipoMapa] || mapas.normal;
}

function atualizarEstiloMapa(escuro) {
    if (!mapInstance) return;
    try {
        const novoEstilo = obterEstiloMapa(escuro, estiloMapaActual);
        mapInstance.setStyle(novoEstilo);
    } catch (e) {
        console.error("Erro ao alternar estilo do mapa:", e);
    }
}

function aplicarTema(escuro) {
    document.body.classList.toggle("dark-theme", !!escuro);
    const sw = document.getElementById("themeSwitch");
    if (sw) sw.checked = !!escuro;
    localStorage.setItem("dimmakoTema", escuro ? "escuro" : "claro");
    atualizarEstiloMapa(!!escuro);
}

document.getElementById("postSearch").addEventListener("input", event => renderPosts(event.target.value));
document.getElementById("friendSearch").addEventListener("input", event => renderFriends(event.target.value));
document.querySelectorAll("#filterTrack button").forEach(button => button.addEventListener("click", () => {
    const buttons = document.querySelectorAll("#filterTrack button");
    buttons.forEach(item => {
        const selected = item === button;
        item.classList.toggle("active", selected);
        item.setAttribute("aria-pressed", String(selected));
        item.disabled = !selected;
    });
    activeCategory = button.dataset.category;
    renderPosts(document.getElementById("postSearch").value);
}));
document.getElementById("filterPrev").addEventListener("click", () => document.getElementById("filterTrack").scrollBy({ left: -260, behavior: "smooth" }));
document.getElementById("filterNext").addEventListener("click", () => document.getElementById("filterTrack").scrollBy({ left: 260, behavior: "smooth" }));
/* ===================== GEOLOCALIZAÇÃO POR GPS ===================== */
const CHAVE_LOCALIZACAO_PARTILHADA = "dimmakoLocalizacaoPartilhada";
const CHAVE_LOCALIZACAO_USUARIO = "dimmakoMinhaLocalizacao";
let watchLocalizacaoId = null;
let ultimaPosicao = null;
let marcadorPartilha = null;
let marcadorUsuario = null;
let estiloMapaActual = "normal";

function obterLocalizacaoGPS() {
    return new Promise(resolver => {
        if (!("geolocation" in navigator)) {
            resolver(null);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            posicao => {
                const dados = {
                    latitude: posicao.coords.latitude,
                    longitude: posicao.coords.longitude,
                    direcao: posicao.coords.heading,
                    precisao: posicao.coords.accuracy,
                    timestamp: posicao.timestamp,
                    origem: "gps"
                };
                localStorage.setItem(CHAVE_LOCALIZACAO_USUARIO, JSON.stringify(dados));
                sincronizarEstadoLocalFirebase(CHAVE_LOCALIZACAO_USUARIO, "location_owner");
                resolver(dados);
            },
            () => resolver(null),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    });
}

async function obterLocalizacaoAtual() {
    return await obterLocalizacaoGPS();
}

function lerLocalizacaoPartilhada() {
    try {
        const guardada = JSON.parse(localStorage.getItem(CHAVE_LOCALIZACAO_PARTILHADA) || "null");
        if (!guardada || guardada.origem === "ip" || typeof guardada.latitude !== "number" || typeof guardada.longitude !== "number") return null;
        return guardada;
    } catch (erro) {
        return null;
    }
}

function guardarLocalizacaoPartilhada(dados) {
    if (!dados || typeof dados.latitude !== "number" || typeof dados.longitude !== "number") return;
    const payload = {
        ...dados,
        timestamp: dados.timestamp || Date.now(),
        origem: dados.origem || "gps",
        destinatario: activeFriend || "usuario"
    };
    localStorage.setItem(CHAVE_LOCALIZACAO_PARTILHADA, JSON.stringify(payload));
    sincronizarEstadoLocalFirebase(CHAVE_LOCALIZACAO_PARTILHADA, "location_shared");
}

function definirPosicao(dados) {
    ultimaPosicao = {
        latitude: dados.latitude,
        longitude: dados.longitude,
        direcao: dados.direcao != null && !Number.isNaN(dados.direcao) ? dados.direcao : null,
        precisao: dados.precisao != null && !Number.isNaN(dados.precisao) ? dados.precisao : null,
        timestamp: dados.timestamp || Date.now(),
        origem: dados.origem || "gps",
        cidade: dados.cidade || ""
    };
    localStorage.setItem(CHAVE_LOCALIZACAO_USUARIO, JSON.stringify(ultimaPosicao));
    sincronizarEstadoLocalFirebase(CHAVE_LOCALIZACAO_USUARIO, "location_owner");
    actualizarOrigemLocalizacao();
}

/* Indicador visível no mapa: localização por GPS, mapa ou partilha */
const ORIGENS_LOCALIZACAO = {
    gps: {
        classe: "gps",
        texto: posicao => posicao.precisao != null
            ? `GPS · precisão ±${Math.round(posicao.precisao)} m`
            : "GPS · localização real"
    },
    mapa: {
        classe: "mapa",
        texto: () => "Definida por si no mapa"
    },
    partilhada: {
        classe: "partilhada",
        texto: () => "Localização partilhada"
    }
};

function actualizarOrigemLocalizacao() {
    const chip = document.getElementById("mapOrigin");
    if (!chip) return;
    if (!ultimaPosicao) {
        chip.hidden = true;
        return;
    }
    const origem = ORIGENS_LOCALIZACAO[ultimaPosicao.origem] || ORIGENS_LOCALIZACAO.gps;
    chip.className = `map-origin ${origem.classe}`;
    chip.hidden = false;
    const texto = chip.querySelector(".map-origin-texto");
    if (texto) texto.textContent = origem.texto(ultimaPosicao);
}

function detalharOrigemLocalizacao() {
    if (!ultimaPosicao) return;
    switch (ultimaPosicao.origem) {
        case "mapa":
            mostrarToast("Localização que você marcou manualmente no mapa.", "info", 4500);
            break;
        case "partilhada":
            mostrarToast("Está a visualizar uma localização partilhada por um contacto.", "info", 5000);
            break;
        default:
            mostrarToast(`Localização real via GPS${ultimaPosicao.precisao != null ? ` · precisão ±${Math.round(ultimaPosicao.precisao)} m` : ""}.`, "sucesso", 4500);
    }
}
const chipOrigem = document.getElementById("mapOrigin");
if (chipOrigem) {
    chipOrigem.addEventListener("click", event => {
        event.stopPropagation();
        detalharOrigemLocalizacao();
    });
}

const ICONE_PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>';
const ICONE_PARAR = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>';

function obterNomeSessao() {
    try {
        const sessao = JSON.parse(localStorage.getItem("dimmakoSessaoActual") || "null");
        return sessao && (sessao.nome || sessao.nomeCompleto || sessao.nomeEmpresa)
            ? (sessao.nome || sessao.nomeCompleto || sessao.nomeEmpresa)
            : "Utilizador";
    } catch (erro) {
        return "Utilizador";
    }
}

function enviarLocalizacaoBackend(dados) {
    const payload = {
        tipo: "localizacao.tempo.real",
        canal: `dimmako.localizacao.${(activeFriend || "desconhecido").toLowerCase().replace(/[^a-z0-9]+/g, ".")}`,
        remetente: obterNomeSessao(),
        destinatario: activeFriend,
        latitude: dados.latitude,
        longitude: dados.longitude,
        direcao: dados.direcao,
        precisaoMetros: dados.precisao,
        timestamp: dados.timestamp
    };
    console.log("[WebSocket] Enviando localização →", JSON.stringify(payload));
    try {
        localStorage.setItem("dimmakoPartilhaLocalizacao", JSON.stringify(payload));
        sincronizarEstadoLocalFirebase("dimmakoPartilhaLocalizacao", "location_share_payload");
        guardarLocalizacaoPartilhada(payload);
    } catch (erro) { }
}

function actualizarCartoesLocalizacao() {
    document.querySelectorAll(".loc-card-coords").forEach(elemento => {
        elemento.textContent = ultimaPosicao
            ? `${ultimaPosicao.latitude.toFixed(5)}, ${ultimaPosicao.longitude.toFixed(5)}`
            : "A obter…";
    });
    document.querySelectorAll(".loc-card-live").forEach(elemento => {
        const activo = watchLocalizacaoId !== null;
        elemento.classList.toggle("is-off", !activo);
        const texto = elemento.querySelector(".loc-card-live-texto");
        if (texto) texto.textContent = activo ? "Ao vivo" : "Parado";
    });
}

function sincronizarMapaPrincipal() {
    if (!mapInstance) return;

    const localizacaoPartilhada = lerLocalizacaoPartilhada();
    const pontoAlvo = localizacaoPartilhada && localizacaoPartilhada.latitude && localizacaoPartilhada.longitude
        ? localizacaoPartilhada
        : ultimaPosicao;

    if (!pontoAlvo) return;

    const { latitude, longitude } = pontoAlvo;
    const popupHTML = `<div style="padding:4px 2px;"><strong style="font-size:14px;color:${localizacaoPartilhada ? '#f59e0b' : '#2563eb'};">${escapeHTML(localizacaoPartilhada ? obterNomeAmigoAtivo() : obterNomeSessao())}</strong><br><span style="font-size:12px;opacity:0.8;">${localizacaoPartilhada ? "Localização partilhada · Ao vivo" : "Localização em tempo real · Ao vivo"}</span></div>`;

    if (!marcadorPartilha && window.maplibregl) {
        marcadorPartilha = new maplibregl.Marker({ color: localizacaoPartilhada ? "#f59e0b" : "#2563eb" })
            .setLngLat([longitude, latitude])
            .setPopup(new maplibregl.Popup({ offset: 24 }).setHTML(popupHTML))
            .addTo(mapInstance);
        if (marcadorPartilha.getElement()) marcadorPartilha.getElement().classList.add("live-marker");
    } else if (marcadorPartilha) {
        marcadorPartilha.setLngLat([longitude, latitude]);
        marcadorPartilha.setPopup(new maplibregl.Popup({ offset: 24 }).setHTML(popupHTML));
    }

    const paginaMapa = document.getElementById("telaMap");
    if (paginaMapa && paginaMapa.classList.contains("is-active")) {
        mapInstance.flyTo({ center: [longitude, latitude], zoom: Math.max(mapInstance.getZoom(), 15), essential: true });
    }
}

function criarCartaoLocalizacao() {
    const cartao = document.createElement("div");
    cartao.className = "message mine location-card";
    cartao.innerHTML = `<button type="button" class="loc-card-btn" aria-label="Ver localização em tempo real no mapa">
        <span class="loc-card-head">${ICONE_PIN}<span>Localização em tempo real</span><span class="loc-card-live"><span class="pulse-dot"></span><span class="loc-card-live-texto">Ao vivo</span></span></span>
        <span class="loc-card-coords">${ultimaPosicao ? `${ultimaPosicao.latitude.toFixed(5)}, ${ultimaPosicao.longitude.toFixed(5)}` : "A obter…"}</span>
        <span class="loc-card-hint">Toque para ver no mapa</span>
    </button>`;
    cartao.querySelector(".loc-card-btn").addEventListener("click", verLocalizacaoNoMapa);
    return cartao;
}

function definirBotaoPartilha(activo) {
    const botao = document.getElementById("shareLocation");
    if (!botao) return;
    botao.classList.toggle("is-sharing", activo);
    botao.setAttribute("aria-pressed", String(activo));
    const icone = botao.querySelector(".share-location-icon");
    if (icone) icone.outerHTML = (activo ? ICONE_PARAR : ICONE_PIN).replace("<svg ", '<svg class="share-location-icon" ');
    const rotulo = botao.querySelector(".share-location-label");
    if (rotulo) rotulo.textContent = activo ? "Parar Partilha" : "Partilhar Localização";
}

function pararPartilhaLocalizacao() {
    if (watchLocalizacaoId !== null) {
        navigator.geolocation.clearWatch(watchLocalizacaoId);
        watchLocalizacaoId = null;
    }
    if (marcadorPartilha) {
        marcadorPartilha.remove();
        marcadorPartilha = null;
    }
    definirBotaoPartilha(false);
    actualizarCartoesLocalizacao();
    mostrarToast("Partilha de localização parada.", "info");
}

function iniciarPartilhaLocalizacao() {
    mostrarToast("A obter a localização GPS real…", "info", 2000);
    watchLocalizacaoId = navigator.geolocation.watchPosition(posicao => {
        const coordenadas = posicao.coords;
        if (!Number.isFinite(coordenadas.latitude) || !Number.isFinite(coordenadas.longitude)) {
            mostrarToast("O GPS devolveu coordenadas inválidas. Tente novamente.", "erro");
            return;
        }
        definirPosicao({
            latitude: coordenadas.latitude,
            longitude: coordenadas.longitude,
            direcao: coordenadas.heading,
            precisao: coordenadas.accuracy,
            timestamp: posicao.timestamp,
            origem: "gps"
        });
        enviarLocalizacaoBackend(ultimaPosicao);
        actualizarCartoesLocalizacao();
        sincronizarMapaPrincipal();
    }, erro => {
        const mensagens = {
            1: "Permissão de localização negada. Ative a localização do navegador e tente novamente.",
            2: "A localização GPS não está disponível neste momento. Verifique o sinal do dispositivo.",
            3: "O GPS demorou demasiado tempo a responder. Tente novamente com melhor sinal."
        };
        mostrarToast(mensagens[erro.code] || "Não foi possível obter a localização real do dispositivo.", "erro");
        pararPartilhaLocalizacao();
    }, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
    });
    definirBotaoPartilha(true);
    const mensagens = document.getElementById("messages");
    if (mensagens) {
        mensagens.appendChild(criarCartaoLocalizacao());
        mensagens.scrollTop = mensagens.scrollHeight;
    }
    const amigo = friendsData.find(item => item.uid === activeFriend);
    if (amigo) amigo.lastMessage = "Localização em tempo real";
    guardarAmigos();
}

function partilharLocalizacao() {
    if (watchLocalizacaoId !== null) {
        pararPartilhaLocalizacao();
        return;
    }
    if (!activeFriend) {
        mostrarToast("Seleccione um amigo para partilhar a localização.", "info");
        return;
    }
    if (!("geolocation" in navigator)) {
        mostrarToast("Este navegador não suporta geolocalização.", "erro");
        return;
    }
    iniciarPartilhaLocalizacao();
}
document.getElementById("shareLocation").addEventListener("click", partilharLocalizacao);

function carregarUltimaPosicaoGuardada() {
    if (ultimaPosicao) return;
    try {
        const guardada = lerLocalizacaoPartilhada();
        if (guardada && typeof guardada.latitude === "number" && typeof guardada.longitude === "number") {
            definirPosicao({
                latitude: guardada.latitude,
                longitude: guardada.longitude,
                direcao: guardada.direcao,
                precisao: guardada.precisao != null ? guardada.precisao : guardada.precisaoMetros,
                timestamp: guardada.timestamp,
                origem: guardada.origem || "gps"
            });
        }
    } catch (erro) { }
}

/* ===================== VER PARTILHA NA ABA DO MAPA ===================== */
function verLocalizacaoNoMapa() {
    const partilhada = lerLocalizacaoPartilhada();
    if (partilhada && Number.isFinite(partilhada.latitude) && Number.isFinite(partilhada.longitude)) {
        ultimaPosicao = { ...partilhada, origem: partilhada.origem || "partilhada" };
        actualizarOrigemLocalizacao();
        TrocarPagina("mapa");
        window.setTimeout(() => {
            if (!mapInstance) initializeMap();
            window.setTimeout(() => {
                sincronizarMapaPrincipal();
                if (mapInstance) {
                    mapInstance.flyTo({
                        center: [partilhada.longitude, partilhada.latitude],
                        zoom: 15,
                        essential: true
                    });
                }
            }, 180);
        }, 70);
        return;
    }

    carregarUltimaPosicaoGuardada();
    TrocarPagina("mapa");
    window.setTimeout(() => {
        if (!mapInstance) initializeMap();
        window.setTimeout(() => {
            if (!ultimaPosicao) {
                mostrarToast("A obter a localização partilhada…", "info", 2000);
                obterLocalizacaoAtual().then(posicao => {
                    if (posicao) {
                        definirPosicao(posicao);
                        sincronizarMapaPrincipal();
                    }
                });
                return;
            }
            sincronizarMapaPrincipal();
        }, 150);
    }, 70);
}

function adicionarTerreno() {
    if (!mapInstance) return;
    if (!mapInstance.getSource("dimmako-dem")) {
        try {
            mapInstance.addSource("dimmako-dem", {
                type: "raster-dem",
                tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/tiles/{z}/{x}/{y}.png"],
                tileSize: 256,
                maxzoom: 15
            });
        } catch (erro) {
            console.error("Terreno 3D não disponível:", erro);
            return;
        }
    }
    mapInstance.setTerrain({ source: "dimmako-dem", exaggeration: 1.5 });
}

/* ===================== BOTÃO "A MINHA LOCALIZAÇÃO" (GPS OU IP) ===================== */
function setupMapLocate() {
    const botao = document.getElementById("mapLocate");
    if (!botao) return;
    botao.addEventListener("click", async () => {
        if (!mapInstance) return;
        mostrarToast("A localizar…", "info", 1500);
        const posicao = await obterLocalizacaoAtual();
        if (posicao && mapInstance) {
            definirPosicao(posicao);
            if (!marcadorUsuario && window.maplibregl) {
                marcadorUsuario = new maplibregl.Marker({ color: "#16a34a" })
                    .setLngLat([posicao.longitude, posicao.latitude])
                    .addTo(mapInstance);
                if (marcadorUsuario.getElement()) marcadorUsuario.getElement().classList.add("live-marker");
            } else if (marcadorUsuario) {
                marcadorUsuario.setLngLat([posicao.longitude, posicao.latitude]);
            }
            mapInstance.flyTo({ center: [posicao.longitude, posicao.latitude], zoom: 14, essential: true });
            mostrarToast("Localização real obtida via GPS.", "sucesso", 2800);
        } else {
            mostrarToast("Não foi possível obter a localização GPS. Ative a permissão de localização do navegador e tente novamente.", "erro", 5000);
        }
    });
}

/* ===================== DEFINIR LOCALIZAÇÃO POR CLIQUE NO MAPA (CORRIGIR POSIÇÃO) ===================== */
let modoDefinirLocalizacao = false;

function sairModoDefinir() {
    modoDefinirLocalizacao = false;
    const botao = document.getElementById("mapSetLocation");
    if (botao) {
        botao.classList.remove("active");
        botao.setAttribute("aria-pressed", "false");
    }
    const canvas = document.getElementById("mapCanvas");
    if (canvas) canvas.classList.remove("definindo");
}

function setupMapSetLocation() {
    const botao = document.getElementById("mapSetLocation");
    if (!botao) return;
    botao.addEventListener("click", () => {
        if (!mapInstance) {
            initializeMap();
            return;
        }
        if (modoDefinirLocalizacao) {
            sairModoDefinir();
            mostrarToast("Modo de correcção de localização desligado.", "info");
            return;
        }
        modoDefinirLocalizacao = true;
        botao.classList.add("active");
        botao.setAttribute("aria-pressed", "true");
        document.getElementById("mapCanvas").classList.add("definindo");
        mostrarToast("Toque no mapa exactamente onde você está (ex.: Kilamba Kixa).", "info", 5500);
        const aoClicar = event => {
            const ponto = [event.lngLat.lng, event.lngLat.lat];
            definirPosicao({
                latitude: event.lngLat.lat,
                longitude: event.lngLat.lng,
                direcao: null,
                precisao: 5,
                timestamp: Date.now(),
                origem: "mapa"
            });
            if (!marcadorUsuario && window.maplibregl) {
                marcadorUsuario = new maplibregl.Marker({ color: "#16a34a" })
                    .setLngLat(ponto)
                    .addTo(mapInstance);
                if (marcadorUsuario.getElement()) marcadorUsuario.getElement().classList.add("live-marker");
            } else if (marcadorUsuario) {
                marcadorUsuario.setLngLat(ponto);
            }
            mapInstance.flyTo({ center: ponto, zoom: Math.max(mapInstance.getZoom(), 15), essential: true });
            mostrarToast("A sua localização foi definida no mapa.", "sucesso");
            mapInstance.off("click", aoClicar);
            sairModoDefinir();
        };
        mapInstance.on("click", aoClicar);
    });
}

/* ===================== CHAMADA E MENU DA CONVERSA ===================== */
document.getElementById("callButton").addEventListener("click", () => {
    const friend = friendsData.find(item => item.uid === activeFriend);
    if (!friend || !activeConversationId) {
        mostrarToast("Seleccione uma conversa antes de iniciar a chamada.", "info");
        return;
    }
    const button = document.getElementById("callButton");
    if (!window.dimmakoVoiceCalls) {
        mostrarToast("O serviço de chamadas não foi carregado.", "erro");
        return;
    }
    button.disabled = true;
    window.dimmakoVoiceCalls.startOutgoingCall(activeConversationId, friend)
        .catch(error => mostrarToast(error.message || "Não foi possível iniciar a chamada.", "erro"))
        .finally(() => { button.disabled = false; });
});

function configurarMenuChat() {
    const botao = document.getElementById("chatMenu");
    const menu = document.getElementById("chatMenuList");
    if (!botao || !menu) return;
    const fechar = () => {
        menu.classList.remove("open");
        botao.setAttribute("aria-expanded", "false");
    };
    botao.addEventListener("click", event => {
        event.stopPropagation();
        const aberto = menu.classList.toggle("open");
        botao.setAttribute("aria-expanded", String(aberto));
    });
    menu.addEventListener("click", event => {
        const item = event.target.closest("button[data-acao]");
        if (!item) return;
        const acao = item.dataset.acao;
        fechar();
        if (acao === "excluir") excluirAmigo();
        else if (acao === "limpar") limparConversa();
        else if (acao === "denunciar") denunciarAmigo();
    });
    document.addEventListener("click", fechar);
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            fechar();
        }
    });
}

function excluirAmigo() {
    if (!activeFriend) {
        mostrarToast("Seleccione um amigo.", "info");
        return;
    }
    mostrarToast("A remoção segura de conversas ainda não está configurada.", "info");
}

function limparConversa() {
    if (!activeFriend) {
        mostrarToast("Seleccione um amigo.", "info");
        return;
    }
    mostrarToast("As mensagens partilhadas não podem ser apagadas localmente.", "info");
}

function denunciarAmigo() {
    if (!activeFriend) {
        mostrarToast("Seleccione um amigo.", "info");
        return;
    }
    mostrarToast("O envio de denúncias ainda não está ligado a um serviço seguro.", "info", 4500);
}
configurarMenuChat();
document.getElementById("chatBack").addEventListener("click", () => {
    if (unsubscribeConversationMessages) unsubscribeConversationMessages();
    unsubscribeConversationMessages = null;
    activeConversationId = null;
    activeFriend = null;
    document.querySelector(".chat-panel").classList.remove("is-conversation");
    document.getElementById("conversation").classList.remove("open");
});
document.getElementById("messageForm").addEventListener("submit", async event => {
    event.preventDefault();
    const input = document.getElementById("messageInput");
    const user = window.dimmakoFirebase?.auth.currentUser;
    const texto = input.value.normalize("NFC").replace(/[\u0000-\u001F\u007F]/g, "").trim();
    if (!texto || !activeFriend || !activeConversationId) return;
    if (texto.length > 2000 || !user) {
        mostrarToast("A mensagem deve ter até 2.000 caracteres e uma sessão ativa.", "erro");
        return;
    }

    try {
        await window.dimmakoFirebase.ready;
        const db = window.dimmakoFirebase.db;
        const batch = db.batch();
        const messageRef = db.collection("conversations").doc(activeConversationId)
            .collection("messages").doc();
        batch.set(messageRef, {
                senderId: user.uid,
                text: texto,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        const notificationsEnabled = document.querySelector('[data-setting="messageNotifications"]')?.checked !== false;
        if (notificationsEnabled && activeFriend !== user.uid) {
            const notificationRef = db.collection("profiles").doc(activeFriend).collection("notifications").doc();
            batch.set(notificationRef, {
                type: "message",
                actorUid: user.uid,
                actorName: obterNomeUtilizadorAutenticado(user),
                postId: "",
                conversationId: activeConversationId,
                messageId: messageRef.id,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                read: false
            });
        }
        await batch.commit();
        input.value = "";
    } catch (error) {
        console.error("Não foi possível enviar a mensagem pelo Firebase.", error);
        mostrarToast("A mensagem não foi enviada. Verifique a ligação e tente novamente.", "erro");
    }
});
document.getElementById("btnSair").addEventListener("click", async () => {
    try {
        await window.dimmakoFirebase.ready;
        await window.dimmakoFirebase.auth.signOut();
        localStorage.removeItem("dimmakoSessaoActual");
        window.location.replace("index.html");
    } catch (error) {
        console.error("Não foi possível terminar a sessão Firebase.", error);
        mostrarToast("Não foi possível sair da conta. Tente novamente.", "erro");
    }
});
document.getElementById("mobilePublish").addEventListener("click", () => {
    if (chatAberto) {
        abrirModalAmigo();
    } else {
        let session = null;
        try {
            session = JSON.parse(localStorage.getItem("dimmakoSessaoActual") || "null");
        } catch (error) { }
        if (session && session.tipo === "cliente") {
            return;
        }
        openPublishModal();
    }
});
document.getElementById("mobileChat").addEventListener("click", () => {
    const panel = document.querySelector(".chat-panel");
    panel.classList.add("mobile-open");
    panel.classList.remove("is-conversation");
    document.getElementById("conversation").classList.remove("open");
    chatAberto = true;
    atualizarBotaoPublicarMobile();
    renderFriends();
});
document.getElementById("mobileChatClose").addEventListener("click", () => {
    document.querySelector(".chat-panel").classList.remove("mobile-open", "is-conversation");
    document.getElementById("conversation").classList.remove("open");
    chatAberto = false;
    atualizarBotaoPublicarMobile();
});
setupSession();
carregarAmigos();
carregarPublicacoes();
renderPosts();
renderFriends();
actualizarBadges();


const pageTargets = {
    inicio: "pageHome",
    mapa: "telaMap",
    notificacoes: "pageNotifications",
    vendas: "pageVendas",
    historico: "pageHistorico",
    configuracoes: "pageConfiguracoes",
    perfil: "pagePerfil"
};
let mapInstance = null;
let mapMarkers = [];

function TrocarPagina(view) {
    let session = null;
    try {
        session = JSON.parse(localStorage.getItem("dimmakoSessaoActual") || "null");
    } catch (error) { }
    const ehCliente = session && session.tipo === "cliente";

    // Se for cliente e tentar aceder a vendas, redireciona para início
    if (ehCliente && view === "vendas") {
        view = "inicio";
    }

    currentView = view;
    const contentArea = document.querySelector(".content");
    contentArea?.classList.toggle("home-view", view === "inicio");
    contentArea?.classList.toggle("profile-view", view === "perfil");
    const targetId = pageTargets[view] || pageTargets.inicio;
    document.querySelector(".search-area").style.display = view === "inicio" ? "" : "none";
    document.querySelectorAll(".page-screen").forEach(section => {
        section.classList.toggle("is-active", section.id === targetId);
    });
    document.querySelectorAll(".nav button[data-view]").forEach(button => {
        button.classList.toggle("active", button.dataset.view === view);
    });
    document.querySelectorAll(".mobile-nav button[data-mobile-view]").forEach(button => {
        button.classList.toggle("active", button.dataset.mobileView === view);
    });
    const chatPanel = document.querySelector(".chat-panel");
    if (chatPanel.classList.contains("mobile-open")) {
        chatPanel.classList.remove("mobile-open", "is-conversation");
        document.getElementById("conversation").classList.remove("open");
        chatAberto = false;
    }
    atualizarBotaoPublicarMobile();
    if (view === "mapa") window.setTimeout(initializeMap, 80);
    if (view === "historico") renderSalesHistory();
    if (view === "vendas" && !ehCliente) renderSales();
}

const salesPeriods = {
    day: { label: "Hoje", revenue: "Kz 0", orders: "0", average: "Kz 0", pending: "0", total: "0 pedidos", labels: ["08h", "10h", "12h", "14h", "16h", "18h", "20h", "22h"], values: [0, 0, 0, 0, 0, 0, 0, 0] },
    week: { label: "Esta semana", revenue: "Kz 0", orders: "0", average: "Kz 0", pending: "0", total: "0 pedidos", labels: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"], values: [0, 0, 0, 0, 0, 0, 0] },
    month: { label: "Este mês", revenue: "Kz 0", orders: "0", average: "Kz 0", pending: "0", total: "0 pedidos", labels: ["Sem 1", "Sem 2", "Sem 3", "Sem 4"], values: [0, 0, 0, 0] },
    year: { label: "Este ano", revenue: "Kz 0", orders: "0", average: "Kz 0", pending: "0", total: "0 pedidos", labels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"], values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }
};

function renderSales(period = "day") {
    const data = salesPeriods[period] || salesPeriods.day;
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const yearStart = new Date(today.getFullYear(), 0, 1);
    const getSaleDate = sale => {
        const value = sale.createdAt?.toDate?.() || sale.createdAt || sale.date;
        if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
        if (typeof value !== "string") return null;
        if (value.toLowerCase() === "hoje") return new Date(today);
        if (value.toLowerCase() === "ontem") {
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            return yesterday;
        }
        const localDate = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (localDate) return new Date(Number(localDate[3]), Number(localDate[2]) - 1, Number(localDate[1]));
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };
    const datedSales = getSalesHistoryData().map(sale => ({ sale, date: getSaleDate(sale) }));
    const inPeriod = datedSales.filter(({ date }) => {
        if (!date) return false;
        if (period === "day") return date.toDateString() === today.toDateString();
        if (period === "week") return date >= monday && date < new Date(monday.getTime() + 7 * 86400000);
        if (period === "month") return date >= monthStart && date < new Date(today.getFullYear(), today.getMonth() + 1, 1);
        return date >= yearStart && date < new Date(today.getFullYear() + 1, 0, 1);
    });
    const labels = data.labels.slice();
    const values = Array(labels.length).fill(0);
    inPeriod.forEach(({ sale, date }) => {
        if ((sale.status || "concluido").toLowerCase() !== "concluido") return;
        let index = 0;
        if (period === "day") index = Math.max(0, Math.min(7, Math.floor(date.getHours() / 2) - 4));
        else if (period === "week") index = (date.getDay() + 6) % 7;
        else if (period === "month") index = Math.min(3, Math.floor((date.getDate() - 1) / 7));
        else index = date.getMonth();
        values[index] += Number(sale.price) || 0;
    });
    const completed = inPeriod.filter(({ sale }) => (sale.status || "concluido").toLowerCase() === "concluido");
    const revenue = completed.reduce((sum, { sale }) => sum + (Number(sale.price) || 0), 0);
    const pending = inPeriod.filter(({ sale }) => (sale.status || "").toLowerCase() === "pendente").length;
    const maximum = Math.max(...values, 0);
    const chartValues = values.map(value => maximum ? Math.max(4, Math.round(value / maximum * 100)) : 0);
    document.getElementById("salesPeriodLabel").textContent = data.label;
    document.getElementById("salesRevenue").textContent = formatKwanza(revenue);
    document.getElementById("salesOrders").textContent = String(inPeriod.length);
    document.getElementById("salesAverage").textContent = formatKwanza(completed.length ? revenue / completed.length : 0);
    document.getElementById("salesPending").textContent = String(pending);
    document.getElementById("chartTotal").textContent = `${inPeriod.length} pedido${inPeriod.length === 1 ? "" : "s"}`;
    document.querySelectorAll(".period-switch button").forEach(button => button.classList.toggle("active", button.dataset.period === period));
    document.getElementById("salesChart").innerHTML = chartValues.map((value, index) => `<div class="chart-column"><div class="chart-bar" style="height:${value}%" title="${labels[index]}: ${formatKwanza(values[index])}"></div><span>${labels[index]}</span></div>`).join("");
}

const mapPlaces = [
    { name: "Luanda", coordinates: [13.289, -8.839], type: "Capital" },
    { name: "Kilamba Kixa", coordinates: [13.184, -13.386], type: "Município · Luanda" },
    { name: "Viana", coordinates: [13.166, -13.406], type: "Município · Luanda" },
    { name: "Samba", coordinates: [13.345, -14.578], type: "Município · Luanda" },
    { name: "Talatona", coordinates: [13.368, -13.618], type: "Município · Luanda" },
    { name: "Benguela", coordinates: [13.405, -12.576], type: "Cidade" },
    { name: "Lobito", coordinates: [13.536, -12.364], type: "Cidade" },
    { name: "Huambo", coordinates: [15.739, -12.776], type: "Cidade" },
    { name: "Lubango", coordinates: [13.492, -14.917], type: "Cidade" },
    { name: "Malanje", coordinates: [16.341, -9.540], type: "Cidade" },
    { name: "Cabinda", coordinates: [12.190, -5.550], type: "Cidade" },
    { name: "Soyo", coordinates: [12.368, -6.134], type: "Cidade" },
    { name: "Namibe", coordinates: [14.876, 13.788], type: "Cidade" },
    { name: "Kuito", coordinates: [-12.383, 16.935], type: "Cidade" },
    { name: "Sumbe", coordinates: [-6.025, 14.207], type: "Cidade" },
    { name: "Mbanza Kongo", coordinates: [-6.090, 12.280], type: "Cidade" },
    { name: "Uíge", coordinates: [-7.607, 15.050], type: "Cidade" },
    { name: "Moxico", coordinates: [-11.450, 15.190], type: "Cidade" },
    { name: "Dunda", coordinates: [-8.820, 20.100], type: "Cidade" },
    { name: "Saurimo", coordinates: [-10.417, 22.650], type: "Cidade" },
    { name: "Gouveia", coordinates: [-11.870, -16.483], type: "Cidade" },
    { name: "Balo", coordinates: [-11.080, 13.420], type: "Cidade" }
];

function preencherDatalistaMapa() {
    const datalist = document.getElementById("mapSearchOptions");
    if (!datalist) return;
    datalist.innerHTML = mapPlaces.map(place => `<option value="${escapeHTML(place.name)}"></option>`).join("");
}
preencherDatalistaMapa();

function initializeMap() {
    const canvas = document.getElementById("mapCanvas");
    if (!canvas || !window.maplibregl) {
        if (canvas && !canvas.querySelector(".map-erro")) {
            canvas.insertAdjacentHTML("afterbegin", '<p class="map-erro" style="padding:24px;color:#7c8087;margin:0">Não foi possível carregar o mapa. Verifique a ligação e tente novamente.</p>');
        }
        return;
    }
    if (mapInstance) {
        mapInstance.resize();
        return;
    }

    const isDark = document.body.classList.contains("dark-theme");
    const initialStyle = obterEstiloMapa(isDark);
    const fallbackStyle = isDark
        ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        : "https://tiles.openfreemap.org/styles/liberty";

    mapInstance = new maplibregl.Map({
        container: canvas,
        style: initialStyle,
        center: [13.289, -8.839],
        zoom: 12,
        pitch: 85,
        bearing: -18,
        attributionControl: false,
        antialias: true
    });

    mapInstance.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");

    let usedFallback = false;
    mapInstance.on("error", () => {
        if (usedFallback) return;
        usedFallback = true;
        mapInstance.setStyle(fallbackStyle);
    });

    mapInstance.on("load", () => {
        mapMarkers = mapPlaces.map(place => {
            const popupHTML = `<div style="padding:4px 2px;"><strong style="font-size:14px;color:#de6706;">${escapeHTML(place.name)}</strong><br><span style="font-size:12px;opacity:0.8;">${escapeHTML(place.type)} · Angola</span></div>`;
            const marker = new maplibregl.Marker({ color: "#de6706" })
                .setLngLat(place.coordinates)
                .setPopup(new maplibregl.Popup({ offset: 20 }).setHTML(popupHTML))
                .addTo(mapInstance);
            marker.placeName = place.name.toLocaleLowerCase("pt-BR");
            return marker;
        });
        mapInstance.resize();
    });

    // Só centraliza automaticamente quando o GPS do dispositivo fornece coordenadas.
    obterLocalizacaoAtual().then(posicao => {
        if (!mapInstance) return;
        if (!posicao) {
            mostrarToast("Ative a permissão de localização para mostrar a sua posição real no mapa.", "info", 5000);
            return;
        }
        definirPosicao(posicao);
        const aplicar = () => {
            mapInstance.flyTo({ center: [posicao.longitude, posicao.latitude], zoom: 13, essential: true });
            if (!marcadorUsuario && window.maplibregl) {
                marcadorUsuario = new maplibregl.Marker({ color: "#16a34a" })
                    .setLngLat([posicao.longitude, posicao.latitude])
                    .addTo(mapInstance);
                if (marcadorUsuario.getElement()) marcadorUsuario.getElement().classList.add("live-marker");
            }
        };
        if (mapInstance.loaded()) aplicar();
        else mapInstance.once("load", aplicar);
    });

    mapInstance.on("style.load", () => {
        if (estiloMapaActual === "3d") adicionarTerreno();
        mapInstance.resize();
    });
}

let marcadorPesquisa = null;
let pesquistandoLocalidade = false;

function removerMarcadorPesquisa() {
    if (marcadorPesquisa) {
        marcadorPesquisa.remove();
        marcadorPesquisa = null;
    }
}

function marcarLocalNoMapa(nome, tipo, [lng, lat]) {
    if (!mapInstance || !window.maplibregl) return;
    const popupHTML = `<div style="padding:4px 2px;"><strong style="font-size:14px;color:#de6706;">${escapeHTML(nome)}</strong><br><span style="font-size:12px;opacity:0.8;">${escapeHTML(tipo)} · Angola</span></div>`;
    removerMarcadorPesquisa();
    marcadorPesquisa = new maplibregl.Marker({ color: "#de6706" })
        .setLngLat([lng, lat])
        .setPopup(new maplibregl.Popup({ offset: 20, closeOnClick: false }).setHTML(popupHTML))
        .addTo(mapInstance);
    marcadorPesquisa.togglePopup();
}

async function pesquisarLocalidadeRemota(query) {
    // Geocodificação OpenStreetMap Nominatim (gratuita, sem chave de API)
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ao&q=${encodeURIComponent(query)}`;
    const resposta = await fetch(url, { headers: { "Accept-Language": "pt" } });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const resultados = await resposta.json();
    if (!resultados.length) return null;
    return { lat: parseFloat(resultados[0].lat), lon: parseFloat(resultados[0].lon) };
}

async function searchMapPlace(value) {
    const query = value.trim();
    if (!query || !mapInstance) return;
    if (query.length < 3) return;
    const minusc = query.toLocaleLowerCase("pt-BR");

    // 1) Coincidência local (instantânea, sem rede)
    const local = mapPlaces.find(item => item.name.toLocaleLowerCase("pt-BR") === minusc)
        || mapPlaces.find(item => item.name.toLocaleLowerCase("pt-BR").includes(minusc));
    if (local) {
        removerMarcadorPesquisa();
        mapInstance.flyTo({ center: local.coordinates, zoom: 14, duration: 1200, essential: true });
        const marker = mapMarkers.find(item => item.placeName === local.name.toLocaleLowerCase("pt-BR"));
        if (marker && marker.togglePopup) marker.togglePopup();
        return;
    }

    // 2) Geocodificação remota (qualquer localidade de Angola)
    if (pesquistandoLocalidade) return;
    pesquistandoLocalidade = true;
    mostrarToast(`A pesquisar "${query}"…`, "info", 1800);
    try {
        const remoto = await pesquisarLocalidadeRemota(query);
        if (!remoto) {
            mostrarToast(`Localidade "${query}" não encontrada.`, "erro");
            return;
        }
        mapInstance.flyTo({ center: [remoto.lon, remoto.lat], zoom: 14, duration: 1500, essential: true });
        marcarLocalNoMapa(query, "Localidade", [remoto.lon, remoto.lat]);
        mostrarToast(`${query} encontrada.`, "sucesso", 2500);
    } catch (erro) {
        console.error("Erro ao pesquisar localidade:", erro);
        mostrarToast("Não foi possível pesquisar a localidade. Verifique a ligação.", "erro");
    } finally {
        pesquistandoLocalidade = false;
    }
}

function loadSettings() {
    let saved = {};
    try {
        saved = JSON.parse(localStorage.getItem("dimmaPreferencias") || "{}");
    } catch (error) {
        console.error("Não foi possível ler as preferências guardadas neste dispositivo.", error);
        mostrarToast("As preferências locais estão danificadas e foram mantidas.", "erro");
    }
    document.querySelectorAll("[data-setting]").forEach(input => {
        if (Object.prototype.hasOwnProperty.call(saved, input.dataset.setting)) input.checked = saved[input.dataset.setting];
    });
    aplicarTema(localStorage.getItem("dimmakoTema") !== "claro");
}

let activeHistoryFilter = "todos";
let historySearchTerm = "";

function getSalesHistoryData() {
    if (Array.isArray(salesHistory)) return salesHistory;
    const user = window.dimmakoFirebase?.auth.currentUser;
    if (!user) return [];
    try {
        if (!sessaoLocalPertenceA(user)) return [];
        return JSON.parse(localStorage.getItem("dimmakoHistoricoVendas") || "[]");
    } catch (error) {
        console.error("Não foi possível ler o histórico de vendas local.", error);
        return [];
    }
}

function sincronizarEstadoLocalFirebase(localKey, recordId) {
    const user = window.dimmakoFirebase?.auth.currentUser;
    if (!user || !window.dimmakoFirestoreData) return;
    const persist = () => {
        localStateSyncTimers.delete(recordId);
        const raw = localStorage.getItem(localKey);
        if (raw === null) return;
        let value;
        try {
            value = JSON.parse(raw);
        } catch (error) {
            console.error(`Não foi possível ler o registo local "${localKey}" para sincronização.`, error);
            mostrarToast("Um registo local não pôde ser sincronizado e foi mantido neste dispositivo.", "erro");
            return;
        }
        localStateSyncTimes.set(recordId, Date.now());
        window.dimmakoFirestoreData.savePrivateRecord(recordId, value, user).catch(error => {
            console.error(`Não foi possível sincronizar "${localKey}" com o Firebase.`, error);
            mostrarToast(error.message || "Não foi possível guardar os dados no Firebase.", "erro");
        });
    };
    const remaining = 60000 - (Date.now() - (localStateSyncTimes.get(recordId) || 0));
    if (remaining <= 0) {
        persist();
    } else if (!localStateSyncTimers.has(recordId)) {
        localStateSyncTimers.set(recordId, window.setTimeout(persist, remaining));
    }
}

function renderSalesHistory() {
    const raw = getSalesHistoryData();
    const totalRevenue = raw.filter(item => (item.status || "concluido") === "concluido").reduce((sum, item) => sum + (Number(item.price) || 0), 0);
    const completedCount = raw.filter(item => (item.status || "concluido") === "concluido").length;
    const pendingCount = raw.filter(item => item.status === "pendente").length;

    if (document.getElementById("historyTotalRevenue")) document.getElementById("historyTotalRevenue").textContent = formatKwanza(totalRevenue);
    if (document.getElementById("historyOrdersCount")) document.getElementById("historyOrdersCount").textContent = String(raw.length);
    if (document.getElementById("historyCompletedCount")) document.getElementById("historyCompletedCount").textContent = String(completedCount);
    if (document.getElementById("historyPendingCount")) document.getElementById("historyPendingCount").textContent = String(pendingCount);

    const filtered = raw.filter(item => {
        const status = (item.status || "concluido").toLowerCase();
        const matchesFilter = activeHistoryFilter === "todos" || status === activeHistoryFilter;
        const search = historySearchTerm.toLowerCase();
        const matchesSearch = !search ||
            (item.id && String(item.id).toLowerCase().includes(search)) ||
            (item.customer && item.customer.toLowerCase().includes(search)) ||
            (item.product && item.product.toLowerCase().includes(search));
        return matchesFilter && matchesSearch;
    });

    if (document.getElementById("historyCountLabel")) document.getElementById("historyCountLabel").textContent = `${filtered.length} pedido${filtered.length === 1 ? "" : "s"}`;

    const tables = [document.getElementById("historyRows"), document.getElementById("salesHistoryRows")].filter(Boolean);
    if (!tables.length) return;

    if (!filtered.length) {
        const message = `<tr><td colspan="5" style="text-align:center;padding:28px 16px;color:var(--muted)">${historySearchTerm || activeHistoryFilter !== "todos" ? "Nenhum pedido encontrado para este filtro." : "Nenhuma venda registrada ainda no seu histórico."}</td></tr>`;
        tables.forEach(table => { table.innerHTML = message; });
        return;
    }

    const markup = filtered.map(order => {
        const status = (order.status || "concluido").toLowerCase();
        const statusClass = status === "pendente" ? "pending" : (status === "cancelado" ? "cancelled" : "");
        const statusLabel = status === "pendente" ? "Pendente" : (status === "cancelado" ? "Cancelado" : "Concluído");
        return `<tr>
                    <td><strong>#${escapeHTML(order.id || "0000")}</strong></td>
                    <td>${escapeHTML(order.customer || "Cliente")}</td>
                    <td>${escapeHTML(order.date || "Hoje")}</td>
                    <td><strong>${formatKwanza(order.price || 0)}</strong></td>
                    <td><span class="sale-status ${statusClass}">${statusLabel}</span></td>
                </tr>`;
    }).join("");
    tables.forEach(table => { table.innerHTML = markup; });
    actualizarBadges();
}

async function markNotificationsRead() {
    const user = window.dimmakoFirebase?.auth.currentUser;
    const unread = notifications.filter(item => !item.read);
    if (!user || !unread.length) return;
    try {
        const collection = window.dimmakoFirebase.db.collection("profiles").doc(user.uid).collection("notifications");
        for (let offset = 0; offset < unread.length; offset += 450) {
            const batch = window.dimmakoFirebase.db.batch();
            unread.slice(offset, offset + 450).forEach(item => {
                batch.update(collection.doc(item.id), {
                    read: true,
                    readAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
            await batch.commit();
        }
    } catch (error) {
        console.error("Não foi possível marcar todas as notificações como lidas.", error);
        mostrarToast("Não foi possível atualizar as notificações. Tente novamente.", "erro");
    }
}

function bindPages() {
    document.querySelectorAll(".nav button[data-view]").forEach(button => button.addEventListener("click", () => TrocarPagina(button.dataset.view)));
    document.querySelectorAll(".mobile-nav button[data-mobile-view]").forEach(button => {
        if (button.dataset.mobileView !== "chat") button.addEventListener("click", () => TrocarPagina(button.dataset.mobileView));
    });
    document.querySelector(".mobile-notifications").addEventListener("click", () => TrocarPagina("notificacoes"));
    document.querySelector(".profile-mini").addEventListener("click", () => TrocarPagina("perfil"));
    document.querySelector(".profile-mini").style.cursor = "pointer";
    document.querySelector(".mobile-account-user").addEventListener("click", () => TrocarPagina("perfil"));
    document.querySelector(".mobile-account-user").style.cursor = "pointer";
    document.querySelectorAll(".period-switch button").forEach(button => button.addEventListener("click", () => renderSales(button.dataset.period)));
    document.querySelectorAll(".history-filters button").forEach(button => {
        button.addEventListener("click", () => {
            activeHistoryFilter = button.dataset.historyFilter;
            document.querySelectorAll(".history-filters button").forEach(b => b.classList.remove("active"));
            button.classList.add("active");
            renderSalesHistory();
        });
    });
    const historySearchInput = document.getElementById("historySearch");
    if (historySearchInput) {
        historySearchInput.addEventListener("input", e => {
            historySearchTerm = e.target.value.trim();
            renderSalesHistory();
        });
    }
    document.getElementById("mapSearch").addEventListener("input", event => {
        const query = event.target.value.trim();
        if (query.length < 3 || !mapInstance) return;
        const minusc = query.toLocaleLowerCase("pt-BR");
        const local = mapPlaces.find(item => item.name.toLocaleLowerCase("pt-BR") === minusc);
        if (local) searchMapPlace(local.name);
    });
    document.getElementById("mapSearch").addEventListener("change", event => searchMapPlace(event.target.value));
    document.getElementById("mapSearch").addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            searchMapPlace(event.target.value);
        }
    });
    document.getElementById("markNotificationsRead").addEventListener("click", markNotificationsRead);
    document.getElementById("notificationList").addEventListener("click", event => {
        const item = event.target.closest("[data-notification-id]");
        if (!item) return;
        marcarNotificacaoLida(item.dataset.notificationId).catch(error => {
            console.error("Não foi possível marcar a notificação como lida.", error);
            mostrarToast("A notificação não foi atualizada. Tente novamente.", "erro");
        });
    });
    document.querySelectorAll("[data-setting]").forEach(input => {
        input.addEventListener("change", async () => {
            const values = Object.fromEntries(Array.from(document.querySelectorAll("[data-setting]"), item => [item.dataset.setting, item.checked]));
            try {
                await persistirPreferenciasFirebase(values);
            } catch (error) {
                console.error("Não foi possível guardar as preferências no Firebase.", error);
                mostrarToast(error.message || "A alteração não foi guardada no Firebase.", "erro");
                return;
            }
            const feedback = document.getElementById("settingsFeedback");
            if (feedback) {
                feedback.textContent = "Alteração guardada.";
                setTimeout(() => { if (feedback.textContent === "Alteração guardada.") feedback.textContent = ""; }, 2000);
            }
        });
    });
    document.getElementById("themeSwitch").addEventListener("change", event => {
        aplicarTema(event.target.checked);
        const values = Object.fromEntries(Array.from(document.querySelectorAll("[data-setting]"), item => [item.dataset.setting, item.checked]));
        persistirPreferenciasFirebase(values).catch(error => {
            console.error("Não foi possível guardar o tema no Firebase.", error);
            mostrarToast(error.message || "O tema não foi guardado no Firebase.", "erro");
        });
    });
    document.getElementById("saveSettings").addEventListener("click", async () => {
        const values = Object.fromEntries(Array.from(document.querySelectorAll("[data-setting]"), input => [input.dataset.setting, input.checked]));
        try {
            await persistirPreferenciasFirebase(values);
        } catch (error) {
            console.error("Não foi possível guardar as preferências no Firebase.", error);
            mostrarToast(error.message || "As preferências não foram guardadas.", "erro");
            return;
        }
        const feedback = document.getElementById("settingsFeedback");
        if (feedback) {
            feedback.textContent = "Preferências guardadas com sucesso.";
            setTimeout(() => { if (feedback.textContent === "Preferências guardadas com sucesso.") feedback.textContent = ""; }, 3000);
        }
    });
    document.getElementById("saveProfile").addEventListener("click", async () => {
        const name = document.getElementById("profileNameInput").value.trim();
        const user = window.dimmakoFirebase?.auth.currentUser;
        if (!name || name.length > 100 || !user) {
            mostrarToast("Introduza um nome válido e confirme que a sessão está ativa.", "erro");
            return;
        }

        try {
            await window.dimmakoFirebase.ready;
            const profileUpdate = {
                nome: name,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            const privateProfile = await window.dimmakoFirebase.db.collection("profiles").doc(user.uid).get();
            if (!privateProfile.exists) throw new Error("O perfil autenticado não foi encontrado no Firestore.");
            const profileData = privateProfile.data();
            const batch = window.dimmakoFirebase.db.batch();
            batch.update(window.dimmakoFirebase.db.collection("profiles").doc(user.uid), profileUpdate);
            batch.set(window.dimmakoFirebase.db.collection("publicProfiles").doc(user.uid), {
                uid: user.uid,
                tipo: profileData.tipo,
                nome: name,
                nomeEmpresa: profileData.nomeEmpresa || "",
                categoria: profileData.categoria || "",
                descricao: profileData.descricao || "",
                foto: profileData.foto || null,
                visible: document.querySelector('[data-setting="publicProfile"]')?.checked !== false,
                verified: true,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await batch.commit();
            const session = JSON.parse(localStorage.getItem("dimmakoSessaoActual") || "{}");
            session.nome = name;
            localStorage.setItem("dimmakoSessaoActual", JSON.stringify(session));
            document.getElementById("userName").textContent = name;
            document.getElementById("mobileUserName").textContent = name;
            document.getElementById("profileName").textContent = name;
            document.getElementById("avatar").textContent = initials(name);
            document.getElementById("mobileAvatar").textContent = initials(name);
            document.getElementById("profileAvatar").textContent = initials(name);
            mostrarToast("Perfil atualizado com segurança.", "sucesso");
        } catch (error) {
            console.error("Não foi possível atualizar o perfil no Firebase.", error);
            mostrarToast("Não foi possível guardar o perfil. Verifique a ligação e tente novamente.", "erro");
        }
    });
    document.getElementById("profileSettings").addEventListener("click", () => TrocarPagina("configuracoes"));
}

function setCarouselIndex(carousel, index) {
    const count = Number(carousel.dataset.carouselCount);
    const nextIndex = (index + count) % count;
    carousel.dataset.carouselIndex = String(nextIndex);
    carousel.querySelector(".post-media-track").style.transform = `translateX(-${nextIndex * 100}%)`;
    carousel.querySelectorAll(".post-carousel-dots button").forEach((dot, dotIndex) => dot.classList.toggle("active", dotIndex === nextIndex));
}

function setupPostCarousels() {
    const container = document.getElementById("posts");
    let dragStart = null;
    container.addEventListener("click", event => {
        const control = event.target.closest("[data-carousel-step], [data-carousel-to]");
        if (!control) return;
        const carousel = control.closest(".post-carousel");
        const current = Number(carousel.dataset.carouselIndex || 0);
        const next = control.hasAttribute("data-carousel-to") ? Number(control.dataset.carouselTo) : current + Number(control.dataset.carouselStep);
        setCarouselIndex(carousel, next);
    });
    container.addEventListener("pointerdown", event => {
        const carousel = event.target.closest(".post-carousel[data-carousel-count]");
        if (carousel) dragStart = { carousel, x: event.clientX };
    });
    container.addEventListener("pointerup", event => {
        if (!dragStart) return;
        const distance = event.clientX - dragStart.x;
        if (Math.abs(distance) > 45) {
            const current = Number(dragStart.carousel.dataset.carouselIndex || 0);
            setCarouselIndex(dragStart.carousel, current + (distance < 0 ? 1 : -1));
        }
        dragStart = null;
    });
    container.addEventListener("pointercancel", () => { dragStart = null; });
}

function updatePublishValidation() {
    const form = document.getElementById("productForm");
    const hasMedia = draftMedia.some(Boolean);
    const valid = form.checkValidity() && hasMedia;
    const button = document.getElementById("confirmPublish");
    const feedback = document.getElementById("publishFeedback");
    button.disabled = !valid;
    if (!form.checkValidity()) {
        feedback.textContent = "Preencha todos os campos obrigatórios com valores válidos.";
        feedback.style.color = "var(--muted)";
    } else if (!hasMedia) {
        feedback.textContent = "Adicione pelo menos uma imagem ou vídeo do produto.";
        feedback.style.color = "var(--muted)";
    } else {
        feedback.textContent = "";
    }
}

async function setDraftMedia(slot, file) {
    const feedback = document.getElementById("publishFeedback");
    const card = document.querySelector(`[data-media-slot="${slot}"]`);
    const preview = card.querySelector("[data-media-preview]");
    const input = card.querySelector("[data-media-input]");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
        feedback.textContent = "Selecione apenas imagens JPG, PNG, WebP ou GIF.";
        feedback.style.color = "#b43a27";
        input.value = "";
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        feedback.textContent = "Cada imagem pode ter no máximo 10 MB.";
        feedback.style.color = "#b43a27";
        input.value = "";
        return;
    }
    preview.hidden = false;
    preview.innerHTML = `<span style="display:flex;align-items:center;justify-content:center;height:100%;font-size:12px;color:var(--muted)">A enviar...</span>`;
    card.classList.add("has-media");

    let imageUrl;
    try {
        imageUrl = await uploadImagemImgBB(file);
    } catch (error) {
        console.error("Falha ao enviar mídia para o ImgBB.", error);
        preview.replaceChildren();
        preview.hidden = true;
        card.classList.remove("has-media");
        input.value = "";
        draftMedia[slot] = null;
        mostrarToast(error.message || "O envio para o ImgBB falhou. Tente novamente.", "erro");
        updatePublishValidation();
        return;
    }
    draftMedia[slot] = { type: "image", src: imageUrl, url: imageUrl };
    preview.innerHTML = `<img src="${escapeHTML(imageUrl)}" alt="Pré-visualização do produto" decoding="async">`;
    card.querySelector(".media-upload-trigger span").textContent = "Imagem enviada";

    updatePublishValidation();
}

function resetProductDraft() {
    draftMedia.forEach(item => {
        if (item?.url && String(item.url).startsWith("blob:")) URL.revokeObjectURL(item.url);
    });
    draftMedia.fill(null);
    const form = document.getElementById("productForm");
    form.reset();
    document.querySelectorAll("[data-media-slot]").forEach(card => {
        card.classList.remove("has-media");
        card.querySelector("[data-media-input]").value = "";
        card.querySelector("[data-media-preview]").replaceChildren();
        card.querySelector("[data-media-preview]").hidden = true;
        card.querySelector(".media-upload-trigger span").textContent = "Imagem ou vídeo";
    });
    updatePublishValidation();
}

function openPublishModal() {
    const modal = document.getElementById("publishModal");
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    updatePublishValidation();
    window.setTimeout(() => document.getElementById("productName").focus(), 0);
}

function closePublishModal(resetDraft = false) {
    const modal = document.getElementById("publishModal");
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (resetDraft) resetProductDraft();
}

function setupProductPublisher() {
    const modal = document.getElementById("publishModal");
    const form = document.getElementById("productForm");
    document.getElementById("publishPost").addEventListener("click", event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        openPublishModal();
    }, true);
    document.getElementById("closePublishModal").addEventListener("click", () => closePublishModal());
    document.getElementById("cancelPublish").addEventListener("click", () => closePublishModal(true));
    modal.addEventListener("click", event => { if (event.target === modal) closePublishModal(); });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && modal.classList.contains("open")) closePublishModal();
    });
    document.querySelectorAll("[data-media-input]").forEach(input => input.addEventListener("change", () => setDraftMedia(Number(input.dataset.mediaInput), input.files[0])));
    document.querySelectorAll("[data-remove-media]").forEach(button => button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const slot = Number(button.dataset.removeMedia);
        draftMedia[slot] = null;
        const card = button.closest(".media-upload-card");
        card.classList.remove("has-media");
        card.querySelector("[data-media-input]").value = "";
        card.querySelector("[data-media-preview]").replaceChildren();
        card.querySelector("[data-media-preview]").hidden = true;
        card.querySelector(".media-upload-trigger span").textContent = "Imagem ou vídeo";
        updatePublishValidation();
    }));
    form.addEventListener("input", () => {
        Array.from(form.querySelectorAll("input, select, textarea")).forEach(validarCampoProduto);
        updatePublishValidation();
    });
    form.addEventListener("change", () => {
        Array.from(form.querySelectorAll("input, select, textarea")).forEach(validarCampoProduto);
        updatePublishValidation();
    });
    form.addEventListener("submit", async event => {
        event.preventDefault();
        updatePublishValidation();
        if (!form.checkValidity() || !draftMedia.some(Boolean)) {
            form.reportValidity();
            return;
        }
        const semLink = draftMedia.filter(Boolean).some(item => !item.src && !item.url);
        if (semLink) {
            mostrarToast("Aguarde o envio da mídia para o ImgBB.", "erro");
            return;
        }
        const user = window.dimmakoFirebase?.auth.currentUser;
        if (!user) {
            mostrarToast("A sessão expirou. Entre novamente para publicar.", "erro");
            return;
        }
        const name = document.getElementById("productName").value.trim();
        const media = draftMedia.filter(Boolean).map(item => ({ type: "image", src: item.src || item.url }));
        let session = null;
        try { session = JSON.parse(localStorage.getItem("dimmakoSessaoActual") || "null"); } catch (error) { session = null; }
        const postData = {
            authorId: user.uid,
            name: session?.nome || document.getElementById("userName").textContent,
            authorName: session?.nome || session?.nomeCompleto || document.getElementById("userName").textContent,
            companyName: session?.nomeEmpresa || "",
            category: document.getElementById("productCategory").value,
            text: document.getElementById("productDescription").value.trim(),
            title: name,
            price: Number(document.getElementById("productPrice").value),
            delivery: {
                municipality: Number(document.getElementById("deliveryMunicipality").value),
                outsideMunicipality: Number(document.getElementById("deliveryOutsideMunicipality").value),
                outsideLuanda: Number(document.getElementById("deliveryOutsideLuanda").value)
            },
            media,
            likes: 0,
            comments: 0,
            available: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        try {
            await window.dimmakoFirebase.ready;
            const profile = await window.dimmakoFirebase.db.collection("profiles").doc(user.uid).get();
            if (!profile.exists || profile.data().tipo !== "vendedor") {
                mostrarToast("Apenas um perfil de vendedor válido pode publicar produtos.", "erro");
                return;
            }
            const publication = await window.dimmakoFirebase.db.collection("posts").add(postData);
            posts.unshift({ ...postData, id: publication.id, time: "agora", ratings: [], likedBy: [], commentList: [] });
        } catch (error) {
            console.error("Não foi possível guardar a publicação no Firestore.", error);
            mostrarToast("A publicação não foi guardada no Firebase. Verifique as regras e tente novamente.", "erro");
            return;
        }
        draftMedia.fill(null);
        activeCategory = "Todos";
        document.querySelectorAll("#filterTrack button").forEach(button => {
            const selected = button.dataset.category === "Todos";
            button.classList.toggle("active", selected);
            button.setAttribute("aria-pressed", String(selected));
            button.disabled = false;
        });
        document.getElementById("postSearch").value = "";
        renderPosts();
        closePublishModal(true);
        mostrarToast("Publicação criada com imagens do ImgBB.", "sucesso");
    });
}

function setupPostCarousels() {
    const container = document.getElementById("posts");
    let dragStart = null;
    container.addEventListener("click", event => {
        const control = event.target.closest("[data-carousel-step], [data-carousel-to]");
        if (!control) return;
        const carousel = control.closest(".post-carousel");
        const current = Number(carousel.dataset.carouselIndex || 0);
        const next = control.hasAttribute("data-carousel-to") ? Number(control.dataset.carouselTo) : current + Number(control.dataset.carouselStep);
        setCarouselIndex(carousel, next);
    });
    container.addEventListener("pointerdown", event => {
        const carousel = event.target.closest(".post-carousel[data-carousel-count]");
        if (carousel) dragStart = { carousel, x: event.clientX };
    });
    container.addEventListener("pointerup", event => {
        if (!dragStart) return;
        const distance = event.clientX - dragStart.x;
        if (Math.abs(distance) > 45) setCarouselIndex(dragStart.carousel, Number(dragStart.carousel.dataset.carouselIndex || 0) + (distance < 0 ? 1 : -1));
        dragStart = null;
    });
    container.addEventListener("pointercancel", () => { dragStart = null; });
}

function setCarouselIndex(carousel, index) {
    const count = Number(carousel.dataset.carouselCount);
    const nextIndex = (index + count) % count;
    carousel.dataset.carouselIndex = String(nextIndex);
    carousel.querySelector(".post-media-track").style.transform = `translateX(-${nextIndex * 100}%)`;
    carousel.querySelectorAll(".post-carousel-dots button").forEach((dot, dotIndex) => dot.classList.toggle("active", dotIndex === nextIndex));
}

function obterDirectorioUtilizadores() {
    const currentUid = window.dimmakoFirebase?.auth.currentUser?.uid;
    return publicProfiles
        .filter(profile => profile.uid
            && profile.uid !== currentUid
            && profile.visible === true
            && profile.verified === true
            && ["cliente", "vendedor"].includes(profile.tipo)
            && typeof (profile.nome || profile.nomeEmpresa) === "string"
            && (profile.nome || profile.nomeEmpresa).trim().length > 0)
        .map(profile => ({
            uid: profile.uid,
            name: profile.nome || profile.nomeEmpresa || "Utilizador",
            company: profile.nomeEmpresa || "",
            username: profile.uid,
            foto: profile.foto || ""
        }));
}

async function openPublicSellerProfile(uid) {
    const user = window.dimmakoFirebase?.auth.currentUser;
    const modal = document.getElementById("sellerProfileModal");
    if (!user || !uid || uid === user.uid || !modal) return;
    const summary = document.getElementById("sellerProfileSummary");
    const productsContainer = document.getElementById("sellerProfileProducts");
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    summary.innerHTML = `<p class="empty">A carregar perfil...</p>`;
    productsContainer.replaceChildren();

    try {
        await window.dimmakoFirebase.ready;
        const profileSnapshot = await window.dimmakoFirebase.db.collection("publicProfiles").doc(uid).get();
        if (!profileSnapshot.exists) throw new Error("Este perfil público não existe.");
        const profile = profileSnapshot.data();
        if (profile.uid !== uid || profile.verified !== true || profile.tipo !== "vendedor" || profile.visible !== true) {
            throw new Error("Este perfil de vendedor não está disponível publicamente.");
        }

        const productSnapshot = await window.dimmakoFirebase.db.collection("posts")
            .where("authorId", "==", uid)
            .get();
        const products = productSnapshot.docs.map(document => ({
            ...document.data(),
            id: document.id,
            available: document.data().available !== false
        })).sort((left, right) => {
            const leftDate = left.createdAt?.toDate?.().getTime() || 0;
            const rightDate = right.createdAt?.toDate?.().getTime() || 0;
            return rightDate - leftDate;
        });
        const nomeEmpresa = profile.nomeEmpresa || profile.nome || "Vendedor";
        summary.innerHTML = `
            <div class="avatar">${profile.foto
                ? `<img src="${escapeHTML(profile.foto)}" alt="" decoding="async" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
                : escapeHTML(initials(nomeEmpresa))}</div>
            <div>
                <h3>${escapeHTML(nomeEmpresa)}</h3>
                <p>${escapeHTML(profile.categoria || "Vendedor")}</p>
                <p>${escapeHTML(profile.descricao || "Este vendedor ainda não adicionou uma descrição.")}</p>
                <p id="sellerProfileAvailableCount">${products.filter(product => product.available).length} produto(s) disponíveis · ${products.length} publicados</p>
                <button class="screen-action" type="button" data-seller-profile-chat="${escapeHTML(uid)}">Conversar com vendedor</button>
            </div>`;
        document.getElementById("sellerProfileProductCount").textContent =
            `${products.length} produto${products.length === 1 ? "" : "s"}`;

        if (!products.length) {
            productsContainer.innerHTML = `<div class="empty">Este vendedor ainda não publicou produtos.</div>`;
            return;
        }
        productsContainer.innerHTML = products.map(product => {
            const available = product.available;
            const image = product.media?.find(item => item.type === "image" && window.dimmakoMedia.isImgBBUrl(item.src));
            const isOwner = user.uid === uid;
            return `<article class="seller-product-card" data-seller-product="${escapeHTML(product.id)}" data-available="${String(available)}">
                ${image ? `<img src="${escapeHTML(image.src)}" alt="${escapeHTML(product.title || "Produto")}" loading="lazy" style="width:100%;height:200px;object-fit:cover">` : ""}
                <div class="seller-product-card-content">
                    <span class="seller-product-status${available ? "" : " unavailable"}">${available ? "Disponível" : "Indisponível"}</span>
                    <h4>${escapeHTML(product.title || "Produto")}</h4>
                    <p>${escapeHTML(product.text || "")}</p>
                    <strong>${formatKwanza(product.price || 0)}</strong>
                    ${isOwner ? `<button class="seller-product-availability" type="button"
                        data-product-availability="${escapeHTML(product.id)}"
                        data-available="${String(available)}">${available ? "Marcar indisponível" : "Marcar disponível"}</button>` : ""}
                </div>
            </article>`;
        }).join("");
    } catch (error) {
        console.error("Não foi possível abrir o perfil público do vendedor.", error);
        summary.innerHTML = `<p class="empty">${escapeHTML(error.message || "Não foi possível carregar este perfil.")}</p>`;
        document.getElementById("sellerProfileProductCount").textContent = "Perfil indisponível";
    }
}

function setupSellerProfile() {
    const modal = document.getElementById("sellerProfileModal");
    document.getElementById("closeSellerProfile").addEventListener("click", () => {
        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    });
    modal.addEventListener("click", event => {
        if (event.target === modal) {
            modal.classList.remove("open");
            modal.setAttribute("aria-hidden", "true");
            document.body.style.overflow = "";
        }
    });
    modal.addEventListener("click", async event => {
        const chatButton = event.target.closest("[data-seller-profile-chat]");
        if (chatButton) {
            modal.classList.remove("open");
            modal.setAttribute("aria-hidden", "true");
            document.body.style.overflow = "";
            await iniciarConversaAmigo(chatButton.dataset.sellerProfileChat);
            return;
        }
        const availabilityButton = event.target.closest("[data-product-availability]");
        if (!availabilityButton) return;
        const user = window.dimmakoFirebase?.auth.currentUser;
        const productId = availabilityButton.dataset.productAvailability;
        const nextAvailability = availabilityButton.dataset.available !== "true";
        if (!user || !productId) return;
        availabilityButton.disabled = true;
        try {
            await window.dimmakoFirebase.db.collection("posts").doc(productId).update({
                available: nextAvailability,
                availabilityUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            const card = availabilityButton.closest(".seller-product-card");
            const status = card.querySelector(".seller-product-status");
            status.textContent = nextAvailability ? "Disponível" : "Indisponível";
            status.classList.toggle("unavailable", !nextAvailability);
            availabilityButton.dataset.available = String(nextAvailability);
            card.dataset.available = String(nextAvailability);
            availabilityButton.textContent = nextAvailability ? "Marcar indisponível" : "Marcar disponível";
            const availableCount = document.querySelectorAll('#sellerProfileProducts .seller-product-card[data-available="true"]').length;
            const totalCount = document.querySelectorAll("#sellerProfileProducts .seller-product-card").length;
            document.getElementById("sellerProfileAvailableCount").textContent =
                `${availableCount} produto(s) disponíveis · ${totalCount} publicados`;
            mostrarToast("Disponibilidade atualizada. O histórico do produto foi mantido.", "sucesso");
        } catch (error) {
            console.error("Não foi possível atualizar a disponibilidade do produto.", error);
            mostrarToast("Não foi possível atualizar o produto. Tente novamente.", "erro");
        } finally {
            availabilityButton.disabled = false;
        }
    });
}

function renderListaAmigosDisponiveis(filtro = "") {
    const lista = document.getElementById("addFriendList");
    const query = filtro.trim().toLowerCase();
    const amigosUids = new Set(friendsData.map(item => item.uid));
    const visiveis = obterDirectorioUtilizadores().filter(pessoa => {
        const texto = `${pessoa.name} ${pessoa.company} ${pessoa.username}`.toLowerCase();
        return (!query || texto.includes(query)) && !amigosUids.has(pessoa.uid);
    });
    if (!visiveis.length) {
        lista.innerHTML = `<div class="empty">${query ? "Nenhum utilizador encontrado." : "Não há novos contactos para adicionar."}</div>`;
        return;
    }
    lista.innerHTML = visiveis.map(pessoa => `
                <div class="amigo-resultado">
                    <div class="avatar">${pessoa.foto ? `<img src="${escapeHTML(pessoa.foto)}" alt="" decoding="async" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : escapeHTML(initials(pessoa.name))}</div>
                    <div>
                        <strong>${escapeHTML(pessoa.name)}</strong>
                        <span>${escapeHTML(pessoa.company || pessoa.username)}</span>
                    </div>
                    ${pessoa.tipo === "vendedor" ? `<button type="button" data-open-directory-profile="${escapeHTML(pessoa.uid)}">Perfil</button>` : ""}
                    <button type="button" data-add-friend="${escapeHTML(pessoa.uid)}">Conversar</button>
                </div>
            `).join("");
    lista.querySelectorAll("[data-open-directory-profile]").forEach(button => {
        button.addEventListener("click", () => {
            fecharModalAmigo();
            openPublicSellerProfile(button.dataset.openDirectoryProfile);
        });
    });
    lista.querySelectorAll("[data-add-friend]").forEach(button => {
        button.addEventListener("click", () => iniciarConversaAmigo(button.dataset.addFriend));
    });
}

async function iniciarConversaAmigo(uid) {
    const user = window.dimmakoFirebase?.auth.currentUser;
    if (!user || !uid || user.uid === uid) {
        mostrarToast("Não foi possível iniciar a conversa com este utilizador.", "erro");
        return;
    }

    try {
        await window.dimmakoFirebase.ready;
        let profile = publicProfiles.find(item => item.uid === uid);
        if (!profile) {
            const profileSnapshot = await window.dimmakoFirebase.db.collection("publicProfiles").doc(uid).get();
            profile = profileSnapshot.exists ? profileSnapshot.data() : null;
        }
        if (!profile || profile.uid !== uid || profile.verified !== true || !["cliente", "vendedor"].includes(profile.tipo)) {
            throw new Error("Este utilizador não tem um perfil Firebase válido.");
        }
        const participantUids = [user.uid, uid].sort();
        const conversationId = participantUids.join("_");
        const reference = window.dimmakoFirebase.db.collection("conversations").doc(conversationId);
        const existing = await reference.get();
        if (!existing.exists) {
            await reference.set({
                participantUids,
                createdBy: user.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        if (!friendsData.some(friend => friend.uid === uid)) {
            friendsData.push({
                uid,
                name: profile.nome || profile.nomeEmpresa || "Utilizador",
                company: profile.nomeEmpresa || "",
                username: uid,
                foto: profile.foto || "",
                conversationId
            });
        }
        fecharModalAmigo();
        const panel = document.querySelector(".chat-panel");
        panel.classList.add("mobile-open");
        chatAberto = true;
        atualizarBotaoPublicarMobile();
        renderFriends();
        openChat(uid);
    } catch (error) {
        console.error("Não foi possível criar a conversa no Firebase.", error);
        mostrarToast("Não foi possível iniciar a conversa. Verifique as regras do Firestore.", "erro");
    }
}

function abrirModalAmigo() {
    const modal = document.getElementById("addFriendModal");
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    renderListaAmigosDisponiveis(document.getElementById("addFriendSearchInput").value);
    window.setTimeout(() => document.getElementById("addFriendSearchInput").focus(), 0);
}

function fecharModalAmigo() {
    const modal = document.getElementById("addFriendModal");
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

function setupAddFriendModal() {
    const modal = document.getElementById("addFriendModal");
    const search = document.getElementById("addFriendSearchInput");
    document.getElementById("closeAddFriendModal").addEventListener("click", fecharModalAmigo);
    modal.addEventListener("click", event => { if (event.target === modal) fecharModalAmigo(); });
    search.addEventListener("input", () => renderListaAmigosDisponiveis(search.value));
    search.addEventListener("change", () => renderListaAmigosDisponiveis(search.value));
}

function setupProfilePhoto() {
    const input = document.getElementById("profilePhotoInput");
    document.getElementById("btnFotoPerfil").addEventListener("click", () => input.click());
    input.addEventListener("change", async () => {
        const ficheiro = input.files && input.files[0];
        if (!ficheiro) return;
        const tiposPermitidos = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        const user = window.dimmakoFirebase?.auth.currentUser;
        if (!tiposPermitidos.includes(ficheiro.type) || ficheiro.size <= 0 || ficheiro.size > 10 * 1024 * 1024) {
            mostrarToast("Use uma imagem JPG, PNG, WebP ou GIF até 10 MB.", "erro");
            input.value = "";
            return;
        }
        if (!user) {
            mostrarToast("A sessão expirou. Entre novamente para alterar a foto.", "erro");
            return;
        }
        if (!await imagemComAssinaturaValida(ficheiro)) {
            mostrarToast("O ficheiro não parece ser uma imagem válida.", "erro");
            input.value = "";
            return;
        }

        mostrarToast("A enviar foto de perfil para o ImgBB...", "info");
        try {
            await window.dimmakoFirebase.ready;
            const url = await uploadImagemImgBB(ficheiro);
            const privateProfile = await window.dimmakoFirebase.db.collection("profiles").doc(user.uid).get();
            if (!privateProfile.exists) throw new Error("O perfil autenticado não foi encontrado no Firestore.");
            const profileData = privateProfile.data();
            const timestamp = firebase.firestore.FieldValue.serverTimestamp();
            const profileUpdate = {
                foto: url,
                updatedAt: timestamp
            };
            const batch = window.dimmakoFirebase.db.batch();
            batch.update(window.dimmakoFirebase.db.collection("profiles").doc(user.uid), profileUpdate);
            batch.set(window.dimmakoFirebase.db.collection("publicProfiles").doc(user.uid), {
                uid: user.uid,
                tipo: profileData.tipo,
                nome: profileData.nome || "Utilizador",
                nomeEmpresa: profileData.nomeEmpresa || "",
                categoria: profileData.categoria || "",
                descricao: profileData.descricao || "",
                foto: url,
                visible: document.querySelector('[data-setting="publicProfile"]')?.checked !== false,
                verified: true,
                updatedAt: timestamp
            });
            await batch.commit();
            const session = JSON.parse(localStorage.getItem("dimmakoSessaoActual") || "{}");
            session.foto = url;
            localStorage.setItem("dimmakoSessaoActual", JSON.stringify(session));
            const nome = document.getElementById("userName").textContent;
            aplicarAvatar("avatar", url, nome);
            aplicarAvatar("mobileAvatar", url, nome);
            aplicarAvatar("profileAvatar", url, nome);
            mostrarToast("Foto de perfil atualizada.", "sucesso");
        } catch (error) {
            console.error("Não foi possível enviar a foto de perfil para o ImgBB ou atualizar o perfil.", error);
            mostrarToast(error.message || "Não foi possível guardar a foto. Verifique a ligação e tente novamente.", "erro");
        } finally {
            input.value = "";
        }
    });
}

function setupMapStyleSwitch() {
    const botoes = document.querySelectorAll(".map-style-switch button");
    if (!botoes.length) return;
    botoes.forEach(button => button.addEventListener("click", () => {
        botoes.forEach(item => {
            item.classList.remove("active");
            item.setAttribute("aria-pressed", "false");
        });
        button.classList.add("active");
        button.setAttribute("aria-pressed", "true");
        estiloMapaActual = button.dataset.mapStyle || "normal";

        const isDark = document.body.classList.contains("dark-theme");
        if (!mapInstance) return;

        const proximoEstilo = obterEstiloMapa(isDark, estiloMapaActual);
        mapInstance.setStyle(proximoEstilo);

        if (estiloMapaActual === "3d") {
            mapInstance.easeTo({ pitch: 60, bearing: -18, duration: 600 });
            adicionarTerreno();
        } else if (estiloMapaActual === "hibrido") {
            mapInstance.easeTo({ pitch: 0, bearing: 0, duration: 600 });
            mapInstance.setTerrain(null);
        } else {
            mapInstance.easeTo({ pitch: 0, bearing: 0, duration: 600 });
            mapInstance.setTerrain(null);
        }
    }));
}

function setupMapFullscreen() {
    const btn = document.getElementById("mapFullscreen");
    const tela = document.getElementById("telaMap");
    if (!btn || !tela) return;

    const iconeExpandir = '<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />';
    const iconeReduzir = '<path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5" />';

    const actualizarBotao = () => {
        const activo = tela.classList.contains("map-fullscreen");
        btn.setAttribute("aria-label", activo ? "Sair do ecrã inteiro" : "Ver mapa em ecrã inteiro");
        btn.setAttribute("aria-pressed", String(activo));
        const rotulo = btn.querySelector("span");
        if (rotulo) rotulo.textContent = activo ? "Sair" : "Ecrã inteiro";
        const svg = btn.querySelector("svg");
        if (svg) svg.innerHTML = activo ? iconeReduzir : iconeExpandir;
        if (mapInstance) {
            mapInstance.resize();
            window.setTimeout(() => { if (mapInstance) mapInstance.resize(); }, 80);
        }
    };

    btn.addEventListener("click", () => {
        tela.classList.toggle("map-fullscreen");
        actualizarBotao();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && tela.classList.contains("map-fullscreen")) {
            tela.classList.remove("map-fullscreen");
            actualizarBotao();
        }
    });
}

function initializeScreens() {
    document.querySelector(".content")?.classList.add("home-view");
    const session = JSON.parse(localStorage.getItem("dimmakoSessaoActual") || "null");
    const profileName = session && (session.nome || session.nomeCompleto || session.nomeEmpresa)
        ? (session.nome || session.nomeCompleto || session.nomeEmpresa)
        : "Utilizador Dimma";
    const profileType = session && session.tipo === "vendedor"
        ? (session.categoria ? `Vendedor • ${session.categoria}` : "Vendedor Dimma")
        : (session && session.tipo === "cliente" ? "Cliente Dimma" : "Membro Dimma");
    const profileEmail = session && (session.identificador || session.emailEmpresa)
        ? (session.identificador || session.emailEmpresa)
        : "";

    document.getElementById("profileName").textContent = profileName;
    document.getElementById("profileNameInput").value = session && session.nome ? session.nome : profileName;
    document.getElementById("profileEmailInput").value = profileEmail;
    document.getElementById("profileType").textContent = profileType;

    const companyField = document.getElementById("profileCompanyField");
    const companyInput = document.getElementById("profileCompanyInput");
    if (companyField && companyInput) {
        if (session && session.nomeEmpresa) {
            companyField.style.display = "block";
            companyInput.value = session.nomeEmpresa;
        } else {
            companyField.style.display = "none";
        }
    }

    const bioField = document.getElementById("profileBioField");
    const bioInput = document.getElementById("profileBioInput");
    if (bioField && bioInput) {
        if (session && (session.descricao || session.descriptionBus)) {
            bioField.style.display = "block";
            bioInput.value = session.descricao || session.descriptionBus;
        } else {
            bioField.style.display = "none";
        }
    }

    const foto = session && session.foto ? session.foto : null;
    aplicarAvatar("profileAvatar", foto, profileName);
    aplicarAvatar("avatar", foto, profileName);
    aplicarAvatar("mobileAvatar", foto, profileName);

    renderSales();
    renderSalesHistory();
    loadSettings();
    setupPostCarousels();
    configurarPosicaoFiltrosMobile();
    configurarInteracoesPublicacao();
    setupProductPublisher();
    setupAddFriendModal();
    setupSellerProfile();
    setupProfilePhoto();
    setupMapFullscreen();
    setupMapStyleSwitch();
    setupMapLocate();
    setupMapSetLocation();
    configurarValidacaoHome();
    aplicarPermissoesUsuario();
    bindPages();
    atualizarBotaoPublicarMobile();
}

initializeScreens();
