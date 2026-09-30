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
if (localStorage.getItem("dimmakoTema") === "escuro") document.body.classList.add("dark-theme");

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
        : `<div class="post-media-item"><img src="${escapeHTML(item.src)}" alt="Imagem de ${escapeHTML(post.name)}"></div>`).join("");
    if (items.length === 1) return `<div class="post-carousel"><div class="post-media-track">${mediaItems}</div></div>`;
    const dots = items.map((item, index) => `<button class="${index === 0 ? "active" : ""}" type="button" data-carousel-to="${index}" aria-label="Ver mídia ${index + 1}"></button>`).join("");
    return `<div class="post-carousel" data-carousel-index="0" data-carousel-count="${items.length}"><button class="post-carousel-control previous" type="button" data-carousel-step="-1" aria-label="Mídia anterior"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg></button><div class="post-media-track">${mediaItems}</div><button class="post-carousel-control next" type="button" data-carousel-step="1" aria-label="Próxima mídia"><svg viewBox="0 0 24 24"><path d="m9 18 6-6 6-6"/></svg></button><div class="post-carousel-dots">${dots}</div></div>`;
}

function renderPosts(filter = "") {
    const search = filter.toLowerCase();
    const visible = posts.filter(post => (activeCategory === "Todos" || post.category === activeCategory) && (post.name + post.text + post.category).toLowerCase().includes(search));
    document.getElementById("posts").innerHTML = visible.length ? visible.map((post, idx) => {
        const postId = post.id !== undefined ? post.id : idx;
        return `<article class="post" data-post-id="${postId}"><div class="post-head"><div class="avatar">${escapeHTML(initials(post.name))}</div><div><strong>${escapeHTML(post.name)}</strong><time>${escapeHTML(post.time)} · ${escapeHTML(post.category)}</time></div></div>${post.title ? `<h3 class="product-title">${escapeHTML(post.title)}</h3>` : ""}${mediaMarkup(post)}${post.price ? `<div class="product-price">${formatKwanza(post.price)}</div>` : ""}<p>${escapeHTML(post.text)}</p>${post.delivery ? `<div class="delivery-rates"><div>Dentro do município<strong>${formatKwanza(post.delivery.municipality)}</strong></div><div>Fora do município<strong>${formatKwanza(post.delivery.outsideMunicipality)}</strong></div><div>Fora de Luanda<strong>${formatKwanza(post.delivery.outsideLuanda)}</strong></div></div>` : ""}<div class="post-actions"><div class="post-engagement"><button type="button"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.3l7.8-7.8 1-1.1a5.5 5.5 0 0 0 0-7.8z"></path></svg> ${post.likes} Curtidas</button><button type="button"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> ${post.comments} Comentários</button><button type="button"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg> Compartilhar</button></div><button class="btn-buy" type="button" data-buy-id="${postId}">Comprar</button></div></article>`;
    }).join("") : `<div class="empty">${search ? "Nenhuma publicação encontrada." : "Ainda não há publicações."}</div>`;
    document.getElementById("postCount").textContent = `${visible.length} publicação${visible.length === 1 ? "" : "ções"}`;

    document.querySelectorAll(".btn-buy").forEach(button => {
        button.addEventListener("click", event => {
            event.stopPropagation();
            const bid = button.dataset.buyId;
            const post = posts.find((p, idx) => (p.id !== undefined ? String(p.id) : String(idx)) === bid);
            if (post) openBuyModal(post);
        });
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
        el.innerHTML = `<img src="${foto}" alt="${escapeHTML(nome)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`;
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

    const tipoUsuario = session && session.tipo ? session.tipo.toLowerCase() : "vendedor";
    const ehVendedor = tipoUsuario === "vendedor";

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
        posts.splice(0, posts.length, ...saved);
        nextPostId = Number(localStorage.getItem("dimmakoNextPostId") || posts.length + 1) || 1;
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

function obterEstiloMapa(escuro) {
    if (escuro) {
        return `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/navigation-night?token=${MAPLIBRE_KEY}`;
    } else {
        return `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/streets?token=${MAPLIBRE_KEY}`;
    }
}

function atualizarEstiloMapa(escuro) {
    if (!mapInstance) return;
    try {
        const novoEstilo = obterEstiloMapa(escuro);
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
    activeCategory = button.dataset.category;
    document.querySelectorAll("#filterTrack button").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    renderPosts(document.getElementById("postSearch").value);
}));
document.getElementById("filterPrev").addEventListener("click", () => document.getElementById("filterTrack").scrollBy({ left: -260, behavior: "smooth" }));
document.getElementById("filterNext").addEventListener("click", () => document.getElementById("filterTrack").scrollBy({ left: 260, behavior: "smooth" }));
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
    chatAberto = false;
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
    document.querySelector(".chat-panel").classList.remove("mobile-open", "is-conversation");
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
    { name: "Benguela", coordinates: [13.405, -12.576], type: "Cidade" },
    { name: "Lobito", coordinates: [13.536, -12.364], type: "Cidade" },
    { name: "Huambo", coordinates: [15.739, -12.776], type: "Cidade" },
    { name: "Lubango", coordinates: [13.492, -14.917], type: "Cidade" },
    { name: "Malanje", coordinates: [16.341, -9.540], type: "Cidade" },
    { name: "Cabinda", coordinates: [12.190, -5.550], type: "Cidade" },
    { name: "Soyo", coordinates: [12.368, -6.134], type: "Cidade" }
];

function initializeMap() {
    const canvas = document.getElementById("mapCanvas");
    if (!canvas || !window.maplibregl) {
        if (canvas) canvas.innerHTML = '<p style="padding:24px;color:#7c8087">Não foi possível carregar o mapa. Verifique a ligação e tente novamente.</p>';
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

    mapInstance.on("style.load", () => {
        mapInstance.resize();
    });
}

function searchMapPlace(value) {
    const query = value.trim().toLocaleLowerCase("pt-BR");
    if (!query || !mapInstance) return;
    const place = mapPlaces.find(item => item.name.toLocaleLowerCase("pt-BR").includes(query));
    if (!place) return;
    mapInstance.flyTo({
        center: place.coordinates,
        zoom: 13,
        duration: 1200,
        essential: true
    });
    const marker = mapMarkers.find(item => item.placeName === place.name.toLocaleLowerCase("pt-BR"));
    if (marker && marker.togglePopup) marker.togglePopup();
}

function loadSettings() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem("dimmaPreferencias") || "{}"); } catch (error) { saved = {}; }
    document.querySelectorAll("[data-setting]").forEach(input => {
        if (Object.prototype.hasOwnProperty.call(saved, input.dataset.setting)) input.checked = saved[input.dataset.setting];
    });
    aplicarTema(localStorage.getItem("dimmakoTema") === "escuro");
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
}

function markNotificationsRead() {
    document.querySelectorAll(".notification-item.unread").forEach(item => item.classList.remove("unread"));
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
    document.getElementById("mapSearch").addEventListener("input", event => searchMapPlace(event.target.value));
    document.getElementById("mapSearch").addEventListener("keydown", event => { if (event.key === "Enter") searchMapPlace(event.target.value); });
    document.getElementById("markNotificationsRead").addEventListener("click", markNotificationsRead);
    document.querySelectorAll(".notification-item").forEach(item => item.addEventListener("click", () => item.classList.remove("unread")));
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
    mostrarToast("A enviar imagem para o ImgBB...", "info", 2000);
    const urlRemota = await uploadImagemImgBB(file);
    if (!urlRemota) {
        preview.replaceChildren();
        preview.hidden = true;
        card.classList.remove("has-media");
        input.value = "";
        draftMedia[slot] = null;
        mostrarToast("O envio para o ImgBB falhou. Tente novamente.", "erro");
        updatePublishValidation();
        return;
    }
    draftMedia[slot] = { type: "image", src: urlRemota, url: urlRemota };
    preview.innerHTML = `<img src="${escapeHTML(urlRemota)}" alt="Pré-visualização do produto">`;
    card.querySelector(".media-upload-trigger span").textContent = "Imagem enviada";
    mostrarToast("Imagem publicada no ImgBB.", "sucesso");
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
        posts.unshift({
            id: nextPostId++,
            name: document.getElementById("userName").textContent,
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
            comments: 0
        });
        draftMedia.fill(null);
        activeCategory = "Todos";
        document.querySelectorAll("#filterTrack button").forEach(button => button.classList.toggle("active", button.dataset.category === "Todos"));
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

let currentBuyingPost = null;

function openBuyModal(post) {
    currentBuyingPost = post;
    const modal = document.getElementById("buyModal");
    const session = JSON.parse(localStorage.getItem("dimmakoSessaoActual") || "null");

    document.getElementById("buyProductTitle").textContent = post.title || post.name || "Produto";
    document.getElementById("buySellerName").textContent = post.name || "Vendedor";
    document.getElementById("buyProductPrice").textContent = formatKwanza(post.price || 0);

    const customerInput = document.getElementById("buyCustomerName");
    if (session && session.nome && (!customerInput.value || customerInput.value === "Visitante")) {
        customerInput.value = session.nome;
    }

    updateBuyTotals();

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closeBuyModal() {
    const modal = document.getElementById("buyModal");
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    currentBuyingPost = null;
    document.getElementById("buyForm").reset();
    document.getElementById("buyFeedback").textContent = "";
}

function updateBuyTotals() {
    if (!currentBuyingPost) return;
    const zone = document.getElementById("buyDeliveryZone").value;
    const price = Number(currentBuyingPost.price) || 0;
    let deliveryFee = 0;
    if (currentBuyingPost.delivery) {
        deliveryFee = Number(currentBuyingPost.delivery[zone]) || 0;
    }
    const grandTotal = price + deliveryFee;
    document.getElementById("buyDeliveryRate").textContent = formatKwanza(deliveryFee);
    document.getElementById("buyGrandTotal").textContent = formatKwanza(grandTotal);
}

function setupBuyModal() {
    document.getElementById("buyDeliveryZone").addEventListener("change", updateBuyTotals);
    document.getElementById("closeBuyModal").addEventListener("click", closeBuyModal);
    document.getElementById("cancelBuyModal").addEventListener("click", closeBuyModal);
    document.getElementById("buyModal").addEventListener("click", event => {
        if (event.target === document.getElementById("buyModal")) closeBuyModal();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && document.getElementById("buyModal").classList.contains("open")) closeBuyModal();
    });
    document.getElementById("buyForm").addEventListener("input", event => validarCampoProduto(event.target));
    document.getElementById("buyForm").addEventListener("change", event => validarCampoProduto(event.target));
    document.getElementById("buyForm").addEventListener("submit", event => {
        event.preventDefault();
        if (!currentBuyingPost) return;

        const customerName = document.getElementById("buyCustomerName").value.trim();
        const customerPhone = document.getElementById("buyCustomerPhone").value.trim();
        const customerAddress = document.getElementById("buyDeliveryAddress").value.trim();
        const zone = document.getElementById("buyDeliveryZone").value;

        const price = Number(currentBuyingPost.price) || 0;
        let deliveryFee = 0;
        if (currentBuyingPost.delivery) {
            deliveryFee = Number(currentBuyingPost.delivery[zone]) || 0;
        }
        const grandTotal = price + deliveryFee;

        const orderId = "PED-" + Math.floor(10000 + Math.random() * 90000);
        const now = new Date();
        const formattedDate = `${now.getDate().toString().padStart(2, "0")} ${now.toLocaleString("pt-PT", { month: "short" })} ${now.getFullYear()}`;

        const newOrder = {
            id: orderId,
            customer: customerName,
            phone: customerPhone,
            address: customerAddress,
            product: currentBuyingPost.title || currentBuyingPost.name,
            date: formattedDate,
            price: grandTotal,
            status: "pendente"
        };

        const orders = getSalesHistoryData();
        orders.unshift(newOrder);
        localStorage.setItem("dimmakoHistoricoVendas", JSON.stringify(orders));

        renderSalesHistory();

        const completedRevenue = orders.filter(o => o.status === "concluido").reduce((s, o) => s + (Number(o.price) || 0), 0);
        const pendingOrders = orders.filter(o => o.status === "pendente").length;
        salesPeriods.day.orders = String(orders.length);
        salesPeriods.day.total = `${orders.length} pedido${orders.length === 1 ? "" : "s"}`;
        salesPeriods.day.pending = String(pendingOrders);
        salesPeriods.day.revenue = formatKwanza(completedRevenue);
        renderSales("day");

        closeBuyModal();
        mostrarToast(`Pedido #${orderId} gerado com sucesso. Total: ${formatKwanza(grandTotal)}.`, "sucesso", 4500);
    });
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
                    <div class="avatar">${pessoa.foto ? `<img src="${escapeHTML(pessoa.foto)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : escapeHTML(initials(pessoa.name))}</div>
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

function setupMapPitchControls() {
    const ajustar = delta => {
        if (!mapInstance) return;
        const pitch = Math.max(0, Math.min(85, (mapInstance.getPitch() || 0) + delta));
        mapInstance.easeTo({ pitch, duration: 400 });
    };
    document.getElementById("mapPitchDown").addEventListener("click", () => ajustar(-12));
    document.getElementById("mapPitchUp").addEventListener("click", () => ajustar(12));
    document.getElementById("mapResetView").addEventListener("click", () => {
        if (!mapInstance) return;
        mapInstance.easeTo({ pitch: 62, bearing: -18, zoom: Math.max(mapInstance.getZoom(), 12), duration: 700 });
    });
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
    setupProductPublisher();
    setupBuyModal();
    setupAddFriendModal();
    setupMapPitchControls();
    setupProfilePhoto();
    configurarValidacaoHome();
    aplicarPermissoesUsuario();
    bindPages();
    atualizarBotaoPublicarMobile();
}

initializeScreens();
