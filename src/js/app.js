const IMGBB_API_KEY = "54f74233160a60cb0afa306af55108e1";
const MAPLIBRE_KEY = "AAPTad4pDzvT0P2JYUFzm5-996A..QAeKAQT8o6PDE02yixDy4z0mSzhSt1tmVxvs2CVZV_Oi9-lOcF1pcIyEJ8nvpnarvRdn3TwUjlS2kGDdzNiCYQJk2i0USJnICLm3lANnq3e2ytyRAjTd3MMdYMtP70U9Z-A3k1RnzoqxsCAAuYACxKr7tuHVe6-Hlc5J8Y3AJh1kCyB46DXNmBbEpXEfxZ89S2inymLOYSlVF7GQZd83wyQAQWVnj7nQlkayHd0CqxY3AYGCAdyzAT1_KVaPo0C0";
const friendsData = [];
let activeFriend = null;
let activeCategory = "Todos";
let posts = [];
const draftMedia = Array(4).fill(null);
let nextPostId = 1;
let currentView = "inicio";
let chatAberto = false;
let openCommentsPostId = null;
if (localStorage.getItem("dimmakoTema") !== "claro") document.body.classList.add("dark-theme");

const initials = name => name.split(" ").map(part => part[0]).slice(0, 2).join("").toUpperCase();
const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const formatKwanza = value => `Kz ${Number(value).toLocaleString("pt-BR")}`;

async function uploadImagemImgBB(ficheiro) {
    const formData = new FormData();
    formData.append("image", ficheiro);
    try {
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: "POST",
            body: formData
        });
        const json = await res.json();
        if (json && json.success && json.data && json.data.url) return json.data.url;
        return null;
    } catch (err) {
        console.error("Falha ImgBB:", err);
        return null;
    }
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
        button.addEventListener("click", event => {
            event.stopPropagation();
            const bid = button.dataset.buyId;
            const post = posts.find((p, idx) => (p.id !== undefined ? String(p.id) : String(idx)) === bid);
            if (!post) return;

            const vendedor = friendsData.some(item => item.name === post.name)
                ? post.name
                : null;

            if (vendedor) {
                openChat(vendedor);
                return;
            }

            friendsData.unshift({ name: post.name, company: "", username: "", lastMessage: "Olá, quero falar sobre o produto." });
            guardarAmigos();
            renderFriends();
            openChat(post.name);
            document.getElementById("messages").innerHTML = `<div class="message mine">Olá, quero falar sobre o produto.</div>`;
            mostrarToast(`Agora podes conversar com ${post.name}.`, "sucesso");
        });
    });
    actualizarBadges();
}

function obterIdentificadorInteracao() {
    try {
        const session = JSON.parse(localStorage.getItem("dimmakoSessaoActual") || "null");
        return session?.identificador || session?.email || session?.nome || "visitante-local";
    } catch (error) {
        return "visitante-local";
    }
}

function obterNomeEmpresaPublicacao(post) {
    if (post.companyName) return post.companyName;
    try {
        const contas = JSON.parse(localStorage.getItem("dimmakoContas") || "[]");
        const conta = contas.find(item =>
            (post.authorId && [item.identificador, item.email, item.emailEmpresa].includes(post.authorId)) ||
            [item.nome, item.nomeCompleto].includes(post.authorName || post.name)
        );
        return conta?.nomeEmpresa || post.name || "Empresa";
    } catch (error) {
        return post.name || "Empresa";
    }
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
        const nomeEl = card.querySelector(".post-head strong");
        if (avatar) avatar.textContent = initials(nomeEmpresa);
        if (nomeEl) nomeEl.textContent = nomeEmpresa;
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
        const ratingButton = event.target.closest("[data-post-rating]");
        if (ratingButton) {
            const post = obterPostPorId(ratingButton.dataset.postId);
            if (!post) return;
            if (!Array.isArray(post.ratings)) post.ratings = [];
            const userId = obterIdentificadorInteracao();
            const existingRating = post.ratings.find(rating => rating.userId === userId);
            if (existingRating) existingRating.stars = Number(ratingButton.dataset.postRating);
            else post.ratings.push({ userId, stars: Number(ratingButton.dataset.postRating) });
            guardarEAtualizarPublicacoes();
            openCommentsPostId = post.id;
            renderPosts(document.getElementById("postSearch").value);
            return;
        }
        const botao = event.target.closest("[data-post-action]");
        if (!botao) return;
        const post = obterPostPorId(botao.dataset.postId);
        if (!post) return;

        if (botao.dataset.postAction === "like") {
            if (!Array.isArray(post.likedBy)) post.likedBy = [];
            const viewer = obterIdentificadorInteracao();
            if (post.likedBy.includes(viewer)) return;
            post.likedBy.push(viewer);
            post.likes = (Number(post.likes) || 0) + 1;
            guardarEAtualizarPublicacoes();
        } else if (botao.dataset.postAction === "comments") {
            openCommentsPostId = String(openCommentsPostId) === String(post.id) ? null : post.id;
            renderPosts(document.getElementById("postSearch").value);
            if (openCommentsPostId !== null) document.querySelector(`[data-post-comment-form="${CSS.escape(String(post.id))}"] input`)?.focus();
        } else if (botao.dataset.postAction === "share") {
            await partilharPublicacao(post);
        }
    });

    container.addEventListener("submit", event => {
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
        if (!Array.isArray(post.commentList)) post.commentList = [];
        let session = null;
        try { session = JSON.parse(localStorage.getItem("dimmakoSessaoActual") || "null"); } catch (error) { session = null; }
        post.commentList.push({ name: String(session?.nome || session?.nomeEmpresa || "Utilizador").slice(0, 80), text: texto, time: new Date().toISOString() });
        post.comments = post.commentList.length;
        openCommentsPostId = null;
        guardarEAtualizarPublicacoes();
    });
}
function renderFriends(filter = "") { const visible = friendsData.filter(friend => friend.name.toLowerCase().includes(filter.toLowerCase())); document.getElementById("friends").innerHTML = visible.length ? visible.map(friend => `<button class="friend ${activeFriend === friend.name ? "selected" : ""}" data-friend="${escapeHTML(friend.name)}"><div class="avatar-wrap"><div class="avatar">${escapeHTML(initials(friend.name))}</div></div><div class="friend-info"><strong>${escapeHTML(friend.name)}</strong><span>${escapeHTML(friend.lastMessage || "Ainda sem mensagens")}</span></div></button>`).join("") : `<div class="empty">${filter ? "Nenhum amigo encontrado." : "Sua lista de amigos ainda está vazia."}</div>`; document.querySelectorAll(".friend").forEach(button => button.addEventListener("click", () => openChat(button.dataset.friend))) }
function openChat(name) { const friend = friendsData.find(item => item.name === name); if (!friend) return; activeFriend = name; document.getElementById("chatName").textContent = friend.name; document.getElementById("chatAvatar").textContent = initials(friend.name); document.getElementById("messages").replaceChildren(); document.getElementById("conversation").classList.add("open"); document.querySelector(".chat-panel").classList.add("is-conversation"); renderFriends(document.getElementById("friendSearch").value) }
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
    localStorage.setItem("dimmakoAmigos", JSON.stringify(friendsData));
    actualizarBadges();
}

function actualizarBadges() {
    const contadores = {
        inicio: posts.length,
        chat: friendsData.filter(item => item.lastMessage).length,
        vendas: getSalesHistoryData().length,
        notificacoes: document.querySelectorAll(".notification-item.unread").length
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
}

function carregarAmigos() {
    try {
        const saved = JSON.parse(localStorage.getItem("dimmakoAmigos") || "[]");
        friendsData.splice(0, friendsData.length, ...saved);
    } catch (e) { }
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
    } catch (e) { }
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
/* ===================== GEOLOCALIZAÇÃO (GPS + IP VIA IPINFO.IO) ===================== */
const IPINFO_TOKEN = "78bd5d6e5a8a22";
const CHAVE_LOCALIZACAO_PARTILHADA = "dimmakoLocalizacaoPartilhada";
const CHAVE_LOCALIZACAO_USUARIO = "dimmakoMinhaLocalizacao";
let watchLocalizacaoId = null;
let ultimaPosicao = null;
let marcadorPartilha = null;
let marcadorUsuario = null;
let estiloMapaActual = "normal";

async function obterLocalizacaoPorIP() {
    try {
        const resposta = await fetch(`https://ipinfo.io/json?token=${IPINFO_TOKEN}`);
        if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
        const dados = await resposta.json();
        console.log("[IPinfo] Dados recebidos:", dados);
        if (dados.loc) {
            const [lat, lng] = dados.loc.split(",").map(coord => parseFloat(coord));
            if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
                const localizacao = {
                    latitude: lat,
                    longitude: lng,
                    cidade: dados.city || "",
                    regiao: dados.region || "",
                    pais: dados.country || "",
                    origem: "ip"
                };
                localStorage.setItem(CHAVE_LOCALIZACAO_USUARIO, JSON.stringify(localizacao));
                return localizacao;
            }
        }
        return null;
    } catch (erro) {
        console.error("Erro ao procurar localização por IP:", erro);
        return null;
    }
}

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
                resolver(dados);
            },
            () => resolver(null),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    });
}

function lerLocalizacaoManual() {
    try {
        const guardada = JSON.parse(localStorage.getItem(CHAVE_LOCALIZACAO_USUARIO) || "null");
        if (guardada && guardada.origem === "mapa" && Number.isFinite(guardada.latitude) && Number.isFinite(guardada.longitude)) {
            return guardada;
        }
        return null;
    } catch (erro) {
        return null;
    }
}

async function obterLocalizacaoAtual() {
    const gps = await obterLocalizacaoGPS();
    if (gps) return gps;
    const manual = lerLocalizacaoManual();
    if (manual) return manual;
    return await obterLocalizacaoPorIP();
}

function lerLocalizacaoPartilhada() {
    try {
        const guardada = JSON.parse(localStorage.getItem(CHAVE_LOCALIZACAO_PARTILHADA) || "null");
        if (!guardada || typeof guardada.latitude !== "number" || typeof guardada.longitude !== "number") return null;
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
    actualizarOrigemLocalizacao();
}

/* Indicador visível no mapa: de onde vem a localização (GPS, IP da operadora, mapa ou partilha) */
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
    ip: {
        classe: "ip",
        texto: posicao => posicao.cidade
            ? `IP da operadora · ${posicao.cidade} (aproximada)`
            : "IP da operadora · localização aproximada"
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
        case "ip":
            mostrarToast("Localização aproximada, obtida pela rede da operadora (IP). Pode não ser o seu local exacto — use «Definir no mapa» para corrigir.", "info", 7000);
            break;
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
    const popupHTML = `<div style="padding:4px 2px;"><strong style="font-size:14px;color:${localizacaoPartilhada ? '#f59e0b' : '#2563eb'};">${escapeHTML(localizacaoPartilhada ? (activeFriend || "Amigo") : obterNomeSessao())}</strong><br><span style="font-size:12px;opacity:0.8;">${localizacaoPartilhada ? "Localização partilhada · Ao vivo" : "Localização em tempo real · Ao vivo"}</span></div>`;

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
    const amigo = friendsData.find(item => item.name === activeFriend);
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
            mostrarToast(posicao.origem === "gps"
                ? "Localização obtida via GPS."
                : `Localização aproximada por IP (${posicao.cidade || "via IP"}).`, "sucesso", 2800);
        } else {
            mostrarToast("Não foi possível obter a localização.", "erro");
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
    if (!activeFriend) {
        mostrarToast("Seleccione um amigo para ligar.", "info");
        return;
    }
    mostrarToast(`A iniciar chamada com ${activeFriend}…`, "info", 3000);
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
    const indice = friendsData.findIndex(item => item.name === activeFriend);
    if (indice > -1) {
        friendsData.splice(indice, 1);
        guardarAmigos();
    }
    activeFriend = null;
    document.querySelector(".chat-panel").classList.remove("is-conversation");
    document.getElementById("conversation").classList.remove("open");
    renderFriends(document.getElementById("friendSearch").value);
    mostrarToast("Amigo excluído.", "sucesso");
}

function limparConversa() {
    if (!activeFriend) {
        mostrarToast("Seleccione um amigo.", "info");
        return;
    }
    document.getElementById("messages").replaceChildren();
    mostrarToast("Conversa limpa.", "sucesso");
}

function denunciarAmigo() {
    if (!activeFriend) {
        mostrarToast("Seleccione um amigo.", "info");
        return;
    }
    mostrarToast(`Denúncia contra ${activeFriend} enviada. A equipa vai analisar a conversa.`, "sucesso", 4500);
}
configurarMenuChat();
document.getElementById("chatBack").addEventListener("click", () => {
    activeFriend = null;
    document.querySelector(".chat-panel").classList.remove("is-conversation");
    document.getElementById("conversation").classList.remove("open");
});
document.getElementById("messageForm").addEventListener("submit", event => {
    event.preventDefault();
    const input = document.getElementById("messageInput");
    if (!input.value.trim() || !activeFriend) return;
    const texto = input.value.trim();
    document.getElementById("messages").insertAdjacentHTML("beforeend", `<div class="message mine">${escapeHTML(texto)}</div>`);
    const friend = friendsData.find(item => item.name === activeFriend);
    if (friend) friend.lastMessage = texto;
    guardarAmigos();
    input.value = "";
});
document.getElementById("btnSair").addEventListener("click", () => {
    localStorage.removeItem("dimmakoSessaoActual");
    window.location.href = "index.html";
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
    document.getElementById("salesPeriodLabel").textContent = data.label;
    document.getElementById("salesRevenue").textContent = data.revenue;
    document.getElementById("salesOrders").textContent = data.orders;
    document.getElementById("salesAverage").textContent = data.average;
    document.getElementById("salesPending").textContent = data.pending;
    document.getElementById("chartTotal").textContent = data.total;
    document.querySelectorAll(".period-switch button").forEach(button => button.classList.toggle("active", button.dataset.period === period));
    document.getElementById("salesChart").innerHTML = data.values.map((value, index) => `<div class="chart-column"><div class="chart-bar" style="height:${value}%" title="${data.labels[index]}: ${value}"></div><span>${data.labels[index]}</span></div>`).join("");
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

    // Centraliza no utilizador: GPS ou, em fallback, IP (ipinfo.io)
    obterLocalizacaoAtual().then(posicao => {
        if (!posicao || !mapInstance) return;
        definirPosicao(posicao);
        if (posicao.origem === "ip") {
            mostrarToast("Sem permissão de GPS: o mapa mostra a localização aproximada da operadora. Use «Definir no mapa» para corrigir.", "info", 7000);
        }
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
    try { saved = JSON.parse(localStorage.getItem("dimmaPreferencias") || "{}"); } catch (error) { saved = {}; }
    document.querySelectorAll("[data-setting]").forEach(input => {
        if (Object.prototype.hasOwnProperty.call(saved, input.dataset.setting)) input.checked = saved[input.dataset.setting];
    });
    aplicarTema(localStorage.getItem("dimmakoTema") !== "claro");
}

let activeHistoryFilter = "todos";
let historySearchTerm = "";

function getSalesHistoryData() {
    try {
        return JSON.parse(localStorage.getItem("dimmakoHistoricoVendas") || "[]");
    } catch (e) {
        return [];
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

    const tbody = document.getElementById("historyRows");
    if (!tbody) return;

    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:28px 16px;color:var(--muted)">${historySearchTerm || activeHistoryFilter !== "todos" ? "Nenhum pedido encontrado para este filtro." : "Nenhuma venda registrada ainda no seu histórico."}</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(order => {
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
    actualizarBadges();
}

function markNotificationsRead() {
    document.querySelectorAll(".notification-item.unread").forEach(item => item.classList.remove("unread"));
    actualizarBadges();
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
    document.querySelectorAll(".notification-item").forEach(item => item.addEventListener("click", () => {
        item.classList.remove("unread");
        actualizarBadges();
    }));
    document.querySelectorAll("[data-setting]").forEach(input => {
        input.addEventListener("change", () => {
            const values = Object.fromEntries(Array.from(document.querySelectorAll("[data-setting]"), item => [item.dataset.setting, item.checked]));
            localStorage.setItem("dimmaPreferencias", JSON.stringify(values));
            const feedback = document.getElementById("settingsFeedback");
            if (feedback) {
                feedback.textContent = "Alteração guardada.";
                setTimeout(() => { if (feedback.textContent === "Alteração guardada.") feedback.textContent = ""; }, 2000);
            }
        });
    });
    document.getElementById("themeSwitch").addEventListener("change", event => {
        aplicarTema(event.target.checked);

    });
    document.getElementById("saveSettings").addEventListener("click", () => {
        const values = Object.fromEntries(Array.from(document.querySelectorAll("[data-setting]"), input => [input.dataset.setting, input.checked]));
        localStorage.setItem("dimmaPreferencias", JSON.stringify(values));
        const feedback = document.getElementById("settingsFeedback");
        if (feedback) {
            feedback.textContent = "Preferências guardadas com sucesso.";
            setTimeout(() => { if (feedback.textContent === "Preferências guardadas com sucesso.") feedback.textContent = ""; }, 3000);
        }
    });
    document.getElementById("saveProfile").addEventListener("click", () => {
        const name = document.getElementById("profileNameInput").value.trim();
        if (!name) return;
        document.getElementById("userName").textContent = name;
        document.getElementById("mobileUserName").textContent = name;
        document.getElementById("profileName").textContent = name;
        document.getElementById("avatar").textContent = initials(name);
        document.getElementById("mobileAvatar").textContent = initials(name);
        document.getElementById("profileAvatar").textContent = initials(name);
        try {
            const session = JSON.parse(localStorage.getItem("dimmakoSessaoActual") || "{}");
            session.nome = name;
            localStorage.setItem("dimmakoSessaoActual", JSON.stringify(session));
        } catch (error) { }
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
    if (!file.type.startsWith("image/")) {
        feedback.textContent = "Seleccione apenas imagens. O ImgBB não aceita vídeo.";
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

    const urlRemota = await uploadImagemImgBB(file);
    if (!urlRemota) {
        preview.replaceChildren();
        preview.hidden = true;
        card.classList.remove("has-media");
        input.value = "";
        draftMedia[slot] = null;
        mostrarToast("O envio falhou. Tente novamente.", "erro");
        updatePublishValidation();
        return;
    }
    draftMedia[slot] = { type: "image", src: urlRemota, url: urlRemota };
    preview.innerHTML = `<img src="${escapeHTML(urlRemota)}" alt="Pré-visualização do produto" decoding="async">`;
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
    form.addEventListener("submit", event => {
        event.preventDefault();
        updatePublishValidation();
        if (!form.checkValidity() || !draftMedia.some(Boolean)) {
            form.reportValidity();
            return;
        }
        const semLink = draftMedia.filter(Boolean).some(item => !item.src && !item.url);
        if (semLink) {
            mostrarToast("Aguarde o envio das imagens para o ImgBB.", "erro");
            return;
        }
        const name = document.getElementById("productName").value.trim();
        const media = draftMedia.filter(Boolean).map(item => ({ type: item.type || "image", src: item.src || item.url }));
        let session = null;
        try { session = JSON.parse(localStorage.getItem("dimmakoSessaoActual") || "null"); } catch (error) { session = null; }
        posts.unshift({
            id: nextPostId++,
            name: document.getElementById("userName").textContent,
            authorName: session?.nome || session?.nomeCompleto || document.getElementById("userName").textContent,
            authorId: session?.identificador || session?.email || session?.emailEmpresa || "",
            companyName: session?.nomeEmpresa || "",
            category: document.getElementById("productCategory").value,
            time: "agora",
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
            ratings: []
        });
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
        guardarPublicacoes();
        closePublishModal(true);
        mostrarToast("Publicação criada com as imagens do ImgBB.", "sucesso");
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
    let contas = [];
    try { contas = JSON.parse(localStorage.getItem("dimmakoContas") || "[]"); } catch (e) { contas = []; }
    let session = null;
    try { session = JSON.parse(localStorage.getItem("dimmakoSessaoActual") || "null"); } catch (e) { session = null; }
    const demo = [
        { nome: "Ana Silva", nomeEmpresa: "Ana Moda", identificador: "ana.silva", tipo: "vendedor" },
        { nome: "Carlos Neto", nomeEmpresa: "Neto Construções", identificador: "carlos.neto", tipo: "vendedor" },
        { nome: "Marta Dias", nomeEmpresa: "", identificador: "marta.dias", tipo: "cliente" },
        { nome: "João Ferreira", nomeEmpresa: "Tech Luanda", identificador: "joao.ferreira", tipo: "vendedor" },
        { nome: "Lúcia Mendes", nomeEmpresa: "Sabores de Angola", identificador: "lucia.mendes", tipo: "vendedor" }
    ];
    const mapa = new Map();
    [...demo, ...contas].forEach(conta => {
        const nome = conta.nome || conta.nomeCompleto || conta.nomeEmpresa || conta.identificador;
        const chave = (conta.identificador || nome || "").toLowerCase();
        if (!chave) return;
        if (session && session.identificador && chave === String(session.identificador).toLowerCase()) return;
        mapa.set(chave, {
            name: nome,
            company: conta.nomeEmpresa || "",
            username: conta.identificador || nome,
            foto: conta.foto || ""
        });
    });
    return Array.from(mapa.values());
}

function renderListaAmigosDisponiveis(filtro = "") {
    const lista = document.getElementById("addFriendList");
    const query = filtro.trim().toLowerCase();
    const amigosNomes = new Set(friendsData.map(item => item.name.toLowerCase()));
    const visiveis = obterDirectorioUtilizadores().filter(pessoa => {
        const texto = `${pessoa.name} ${pessoa.company} ${pessoa.username}`.toLowerCase();
        return (!query || texto.includes(query)) && !amigosNomes.has(pessoa.name.toLowerCase());
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
                    <button type="button" data-add-friend="${escapeHTML(pessoa.name)}" data-company="${escapeHTML(pessoa.company)}" data-username="${escapeHTML(pessoa.username)}">Conversar</button>
                </div>
            `).join("");
    lista.querySelectorAll("[data-add-friend]").forEach(button => {
        button.addEventListener("click", () => iniciarConversaAmigo(button.dataset.addFriend, button.dataset.company, button.dataset.username));
    });
}

function iniciarConversaAmigo(nome, empresa, username) {
    if (!friendsData.some(item => item.name === nome)) {
        friendsData.unshift({ name: nome, company: empresa, username, lastMessage: "Olá, quero conversar." });
        guardarAmigos();
    }
    fecharModalAmigo();
    const panel = document.querySelector(".chat-panel");
    panel.classList.add("mobile-open");
    chatAberto = true;
    atualizarBotaoPublicarMobile();
    renderFriends();
    openChat(nome);
    document.getElementById("messages").innerHTML = `<div class="message mine">Olá, quero conversar.</div>`;
    mostrarToast(`Agora podes conversar com ${nome}.`, "sucesso");
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
        if (!ficheiro.type.startsWith("image/")) {
            mostrarToast("Seleccione uma imagem de perfil.", "erro");
            input.value = "";
            return;
        }
        mostrarToast("A enviar foto de perfil para o ImgBB...", "info");
        const url = await uploadImagemImgBB(ficheiro);
        if (!url) {
            mostrarToast("Não foi possível enviar a foto para o ImgBB.", "erro");
            input.value = "";
            return;
        }
        try {
            const session = JSON.parse(localStorage.getItem("dimmakoSessaoActual") || "{}");
            session.foto = url;
            localStorage.setItem("dimmakoSessaoActual", JSON.stringify(session));
            const contas = JSON.parse(localStorage.getItem("dimmakoContas") || "[]");
            const idx = contas.findIndex(c => c.identificador === session.identificador);
            if (idx >= 0) {
                contas[idx].foto = url;
                localStorage.setItem("dimmakoContas", JSON.stringify(contas));
            }
        } catch (e) { }
        const nome = document.getElementById("userName").textContent;
        aplicarAvatar("avatar", url, nome);
        aplicarAvatar("mobileAvatar", url, nome);
        aplicarAvatar("profileAvatar", url, nome);
        mostrarToast("Foto de perfil actualizada.", "sucesso");
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
