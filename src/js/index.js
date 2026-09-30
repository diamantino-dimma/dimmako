const elemento = document.getElementById("espcaoload");
const email = document.getElementById("email");
const switchTypeUser = document.getElementById("switchTypeUser");
const espacoOptionAuth = document.getElementById("espacoOptionAuth");
let listElementNone = [espacoOptionAuth, elemento];

// Armazenamento em memória das fotos/logótipos carregados
window.empresaFotoBase64 = null;
window.clienteFotoBase64 = null;

// Ícones SVG exclusivos para Toasts (sem emojis)
const SVGS_TOAST = {
    info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
    sucesso: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
    erro: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`
};

// ---- Sistema de Toast Notifications com ícones SVG ----
function mostrarToast(mensagem, tipo = "info", duracao = 3500) {
    const container = document.getElementById("dimmakoToastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${tipo}`;
    const icone = SVGS_TOAST[tipo] || SVGS_TOAST.info;

    toast.innerHTML = `<span class="toast-icone">${icone}</span><span class="toast-texto">${mensagem}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = "toastOut 0.3s forwards";
        setTimeout(() => {
            if (toast.parentElement) toast.parentElement.removeChild(toast);
        }, 300);
    }, duracao);
}

// ---- Integração API ImgBB para upload garantido ----
const IMGBB_API_KEY = "54f74233160a60cb0afa306af55108e1";

async function uploadImagemImgBB(ficheiro) {
    const formData = new FormData();
    formData.append("image", ficheiro);
    try {
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: "POST",
            body: formData
        });
        const json = await res.json();
        if (json && json.success && json.data && json.data.url) {
            return json.data.url;
        }
        console.error("Erro na resposta do ImgBB:", json);
        return null;
    } catch (err) {
        console.error("Falha de rede ao conectar com o ImgBB:", err);
        return null;
    }
}

// ---- Sanitização e validação ----
function sanitizarTexto(valor) {
    return (valor || "").replace(/[<>]/g, "").trim();
}

function ehEmailValido(valor) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}

function ehTelefoneValido(valor) {
    return /^[+]?[\d\s]{9,15}$/.test(valor);
}

function ehEmailOuTelefoneValido(valor) {
    return ehEmailValido(valor) || ehTelefoneValido(valor);
}

function marcarValidacao(campo, valido) {
    if (!campo) return;
    if (valido) {
        campo.classList.remove("is-invalid");
        campo.classList.add("is-valid");
    } else {
        campo.classList.remove("is-valid");
        campo.classList.add("is-invalid");
    }
}

// ---- Verificação dos 4 Requisitos de Senha com Feedback em Tempo Real ----
function verificarRequisitosSenha(valor, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return false;

    const str = valor || "";
    // 1- Números 1 e 9 (pelo menos um dígito de 0 a 9 / 1 a 9)
    const reqNum = /[0-9]/.test(str);
    // 2- Letras A,Z e a,z (pelo menos uma maiúscula e uma minúscula)
    const reqLet = /[a-z]/.test(str) && /[A-Z]/.test(str);
    // 3- Carateres especiais #$&/)€{[{]}];
    const reqEsp = /[#$&/)€{\[\]};!@%*?_~^<>,.+=|\\-]/.test(str);
    // 4- Caracteres 8 (mínimo 8 caracteres)
    const reqLen = str.length >= 8;

    const checks = {
        num: reqNum,
        let: reqLet,
        esp: reqEsp,
        len: reqLen
    };

    const iconCheck = `<polyline points="20 6 9 17 4 12"></polyline>`;
    const iconCircle = `<circle cx="12" cy="12" r="9"></circle>`;

    Object.entries(checks).forEach(([tipo, valido]) => {
        const el = container.querySelector(`[data-req="${tipo}"]`);
        if (el) {
            el.classList.toggle("valido", valido);
            const svg = el.querySelector("svg");
            if (svg) {
                svg.innerHTML = valido ? iconCheck : iconCircle;
            }
        }
    });

    return reqNum && reqLet && reqEsp && reqLen;
}

function configurarRequisitosSenhas() {
    const pares = [
        { inputId: "senhaVendedor", containerId: "req_senhaVendedor" },
        { inputId: "senhaCliente", containerId: "req_senhaCliente" }
    ];

    pares.forEach(({ inputId, containerId }) => {
        const input = document.getElementById(inputId);
        if (input) {
            const verificar = () => verificarRequisitosSenha(input.value, containerId);
            input.addEventListener("input", verificar);
            input.addEventListener("change", verificar);
            verificar();
        }
    });
}

function configurarValidacaoEmTempoReal() {
    const validadores = {
        email: val => ehEmailOuTelefoneValido(val.trim()),
        loginIdentificador: val => val.trim().length > 0,
        loginSenha: val => val.length >= 6,
        nomeCompletoVendedor: val => val.trim().length >= 3,
        paisVendedor: val => val.trim().length >= 2,
        biVendedor: val => val.trim().length >= 6,
        senhaVendedor: val => verificarRequisitosSenha(val, "req_senhaVendedor"),
        confirmarSenhaVendedor: val => {
            const s = document.getElementById("senhaVendedor")?.value || "";
            return val.length >= 8 && val === s;
        },
        nomeEmpresa: val => val.trim().length >= 2,
        emailEmpresa: val => ehEmailValido(val.trim()),
        telefoneEmpresa: val => ehTelefoneValido(val.trim()),
        descriptionBus: val => val.trim().length >= 5,
        nomeCliente: val => val.trim().length >= 2,
        emailCliente: val => ehEmailOuTelefoneValido(val.trim()),
        senhaCliente: val => verificarRequisitosSenha(val, "req_senhaCliente"),
        confirmarSenhaCliente: val => {
            const s = document.getElementById("senhaCliente")?.value || "";
            return val.length >= 8 && val === s;
        }
    };

    Object.entries(validadores).forEach(([id, fn]) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("input", () => {
                marcarValidacao(el, fn(el.value));
            });
            el.addEventListener("change", () => {
                marcarValidacao(el, fn(el.value));
            });
        }
    });

    // Validação em tempo real para selects no evento onchange
    ["dia", "mes", "ano", "sexoVendedor"].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("change", () => {
                marcarValidacao(el, el.value !== "");
            });
        }
    });
}

function popularSelectsNascimento() {
    const elDia = document.getElementById("dia");
    const elMes = document.getElementById("mes");
    const elAno = document.getElementById("ano");
    const elSexo = document.getElementById("sexoVendedor");

    if (elDia && elDia.options.length <= 1) {
        elDia.innerHTML = '<option value="">Dia</option>';
        for (let d = 1; d <= 31; d++) {
            const num = d < 10 ? `0${d}` : `${d}`;
            elDia.innerHTML += `<option value="${num}">${num}</option>`;
        }
    }

    if (elMes && elMes.options.length <= 1) {
        const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        elMes.innerHTML = '<option value="">Mês</option>';
        meses.forEach((m, idx) => {
            elMes.innerHTML += `<option value="${idx + 1}">${m}</option>`;
        });
    }

    if (elAno && elAno.options.length <= 1) {
        elAno.innerHTML = '<option value="">Ano</option>';
        const anoMaximo = new Date().getFullYear() - 18;
        for (let a = anoMaximo; a >= 1940; a--) {
            elAno.innerHTML += `<option value="${a}">${a}</option>`;
        }
    }

    if (elSexo && elSexo.options.length <= 1) {
        elSexo.innerHTML = `
                    <option value="">Sexo</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Feminino">Feminino</option>
                    <option value="Outro">Outro</option>
                `;
    }
}

function confirmarEmail() {
    const valor = sanitizarTexto(email.value);
    if (!valor) {
        mostrarToast("Por favor, indique o seu email ou telefone.", "erro");
        return;
    }
    if (!ehEmailOuTelefoneValido(valor)) {
        mostrarToast("Introduza um email ou número de telefone válido.", "erro");
        return;
    }
    elemento.style.display = "flex";
    setTimeout(() => {
        listElementNone.forEach((element) => {
            element.style.display = "none";
        });
        switchTypeUser.style.animation = "slideLeft 0.5s linear";
        switchTypeUser.style.display = "flex";
    }, 800);
}

function irParaPasso(idAtual, idProximo, passoAtualId, passoProximoId) {
    const atual = document.getElementById(idAtual);
    const proximo = document.getElementById(idProximo);

    if (atual) atual.style.display = "none";
    if (proximo) {
        proximo.style.animation = "slideLeft 0.5s linear";
        proximo.style.display = "flex";
    }

    if (passoAtualId) {
        const passoAtual = document.getElementById(passoAtualId);
        passoAtual.style.background = "#de6706";
        passoAtual.style.color = "white";
    }
    if (passoProximoId) {
        const passoProximo = document.getElementById(passoProximoId);
        passoProximo.style.background = "#de6706";
        passoProximo.style.color = "white";
    }
}

function voltarPasso(idAtual, idAnterior, passoAtualId) {
    const atual = document.getElementById(idAtual);
    const anterior = document.getElementById(idAnterior);

    if (atual) atual.style.display = "none";
    if (anterior) {
        anterior.style.animation = "slideLeft 0.5s linear";
        anterior.style.display = "flex";
    }
    if (passoAtualId) {
        const passoAtual = document.getElementById(passoAtualId);
        passoAtual.style.background = "#f2b888";
        passoAtual.style.color = "rgb(222, 112, 33)";
    }
}

function selecionarUnico(botao) {
    const irmaos = botao.parentElement.querySelectorAll("button");
    irmaos.forEach((b) => b.classList.remove("seleccionado"));
    botao.classList.add("seleccionado");
}

function alternarSeleccao(botao) {
    botao.classList.toggle("seleccionado");
}

async function mostrarPreview(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    const ficheiro = input.files && input.files[0];

    if (!ficheiro) return;

    if (!ficheiro.type.startsWith("image/")) {
        mostrarToast("Por favor, seleccione apenas ficheiros de imagem (JPG, PNG, etc.).", "erro");
        input.value = "";
        return;
    }
    const tamanhoMaximoMB = 10;
    if (ficheiro.size > tamanhoMaximoMB * 1024 * 1024) {
        mostrarToast("A imagem deve ter no máximo " + tamanhoMaximoMB + "MB.", "erro");
        input.value = "";
        return;
    }

    const backupHTML = preview.innerHTML;
    preview.innerHTML = `<div class="spinner" style="width:26px;height:26px;border-width:3px;margin:auto;"></div>`;
    mostrarToast("A carregar imagem para o servidor...", "info", 2000);

    const urlRemota = await uploadImagemImgBB(ficheiro);
    if (urlRemota) {
        preview.innerHTML = `<img src="${urlRemota}" alt="Foto" style="width:100%;height:100%;object-fit:cover;border-radius:100%;">`;
        if (inputId === "logotipoEmpresa") {
            window.empresaFotoBase64 = urlRemota;
        } else if (inputId === "fotoPerfilCliente") {
            window.clienteFotoBase64 = urlRemota;
        }
        mostrarToast("Imagem enviada com sucesso!", "sucesso");
    } else {
        preview.innerHTML = backupHTML;
        input.value = "";
        mostrarToast("Não foi possível carregar a imagem para o ImgBB. Tente novamente.", "erro");
    }
}

function avancarPasso2Vendedor() {
    const nomeCompleto = sanitizarTexto(document.getElementById("nomeCompletoVendedor").value);
    const pais = sanitizarTexto(document.getElementById("paisVendedor").value);
    const bi = sanitizarTexto(document.getElementById("biVendedor").value);
    const senha = document.getElementById("senhaVendedor").value;
    const confirmarSenha = document.getElementById("confirmarSenhaVendedor").value;

    if (!nomeCompleto || !pais || !bi) {
        mostrarToast("Preencha o nome completo, o país e o número do BI.", "erro");
        return;
    }
    if (!senha || !confirmarSenha) {
        mostrarToast("Defina uma senha e confirme-a.", "erro");
        return;
    }
    if (senha.length < 6) {
        mostrarToast("A senha deve ter pelo menos 6 caracteres.", "erro");
        return;
    }
    if (senha !== confirmarSenha) {
        mostrarToast("As senhas não coincidem.", "erro");
        return;
    }

    irParaPasso("divPasso2", "divPasso3", "passo2", "passo3");
}

function avancarPasso3Vendedor() {
    const nomeEmpresa = sanitizarTexto(document.getElementById("nomeEmpresa").value);
    const emailEmpresa = sanitizarTexto(document.getElementById("emailEmpresa").value);
    const telefoneEmpresa = sanitizarTexto(document.getElementById("telefoneEmpresa").value);

    if (!nomeEmpresa || !emailEmpresa || !telefoneEmpresa) {
        mostrarToast("Preencha o nome da empresa, o email e o telefone.", "erro");
        return;
    }
    if (!ehEmailValido(emailEmpresa)) {
        mostrarToast("Introduza um email válido para a empresa.", "erro");
        return;
    }
    if (!ehTelefoneValido(telefoneEmpresa)) {
        mostrarToast("Introduza um número de telefone válido.", "erro");
        return;
    }

    irParaPasso("divPasso3", "divPasso4", "passo3", "passo4");
}

function obterContas() {
    try {
        return JSON.parse(localStorage.getItem("dimmakoContas")) || [];
    } catch (e) {
        return [];
    }
}

function guardarContaCompleta(conta) {
    if (!conta || !conta.identificador) return;
    const contas = obterContas().filter(c => c.identificador !== conta.identificador);
    contas.push(conta);
    localStorage.setItem("dimmakoContas", JSON.stringify(contas));
    localStorage.setItem("dimmakoSessaoActual", JSON.stringify(conta));
}

function finalizarCadastroVendedor() {
    const passo4 = document.getElementById("passo4");
    if (passo4) {
        passo4.style.background = "#de6706";
        passo4.style.color = "white";
    }

    elemento.style.display = "flex";

    const nomeCompleto = sanitizarTexto(document.getElementById("nomeCompletoVendedor").value);
    const pais = sanitizarTexto(document.getElementById("paisVendedor").value);
    const sexo = document.getElementById("sexoVendedor").value;
    const bi = sanitizarTexto(document.getElementById("biVendedor").value);
    const dia = document.getElementById("dia").value;
    const mes = document.getElementById("mes").value;
    const ano = document.getElementById("ano").value;
    const nomeEmpresa = sanitizarTexto(document.getElementById("nomeEmpresa").value);
    const emailEmpresa = sanitizarTexto(document.getElementById("emailEmpresa").value);
    const telefoneEmpresa = sanitizarTexto(document.getElementById("telefoneEmpresa").value);
    const categoriaBtn = document.querySelector("#categoriasNegocio button.seleccionado");
    const categoria = categoriaBtn ? categoriaBtn.textContent.trim() : "Comércio Geral";
    const formasPagamento = Array.from(document.querySelectorAll("#formasPay button.seleccionado")).map(b => b.title || b.textContent.trim());
    const descricao = sanitizarTexto(document.getElementById("descriptionBus").value);
    const senha = document.getElementById("senhaVendedor").value;
    const foto = window.empresaFotoBase64 || null;

    const conta = {
        tipo: "vendedor",
        identificador: (email.value || emailEmpresa || "").trim().toLowerCase(),
        senha: senha,
        nome: nomeCompleto || nomeEmpresa,
        nomeCompleto: nomeCompleto,
        nomeEmpresa: nomeEmpresa,
        emailEmpresa: emailEmpresa,
        telefoneEmpresa: telefoneEmpresa,
        pais: pais,
        sexo: sexo,
        bi: bi,
        dataNasc: `${dia}/${mes}/${ano}`,
        categoria: categoria,
        formasPagamento: formasPagamento,
        descricao: descricao,
        foto: foto
    };

    guardarContaCompleta(conta);

    setTimeout(() => {
        elemento.style.display = "none";
        mostrarToast("Cadastro concluído com sucesso! A entrar na Dimmako...", "sucesso");
        setTimeout(() => {
            window.location.href = "home.html";
        }, 1000);
    }, 1200);
}

function irParaCliente() {
    const emailVal = sanitizarTexto(email.value);
    if (emailVal) {
        const elEmailCliente = document.getElementById("emailCliente");
        if (elEmailCliente && !elEmailCliente.value) {
            elEmailCliente.value = emailVal;
        }
    }
    irParaPasso('divPasso1', 'divCliente1');
}

function cadastrarCliente() {
    const nome = sanitizarTexto(document.getElementById("nomeCliente").value);
    const emailCliente = sanitizarTexto(document.getElementById("emailCliente").value).toLowerCase();
    const senha = document.getElementById("senhaCliente").value;
    const confirmarSenha = document.getElementById("confirmarSenhaCliente").value;

    if (!nome || nome.length < 2) {
        mostrarToast("Por favor, introduza o seu nome completo.", "erro");
        return;
    }
    if (!emailCliente || !ehEmailOuTelefoneValido(emailCliente)) {
        mostrarToast("Por favor, introduza um email ou telefone válido.", "erro");
        return;
    }
    if (!senha || !confirmarSenha) {
        mostrarToast("Preencha a senha e a confirmação de senha.", "erro");
        return;
    }
    if (senha.length < 6) {
        mostrarToast("A senha deve ter pelo menos 6 caracteres.", "erro");
        return;
    }
    if (senha !== confirmarSenha) {
        mostrarToast("As senhas não coincidem.", "erro");
        return;
    }

    const conta = {
        tipo: "cliente",
        identificador: emailCliente,
        email: emailCliente,
        senha: senha,
        nome: nome,
        nomeCompleto: nome,
        foto: window.clienteFotoBase64 || null
    };

    guardarContaCompleta(conta);

    elemento.style.display = "flex";
    setTimeout(() => {
        elemento.style.display = "none";
        mostrarToast("Cadastro de cliente concluído com sucesso! A entrar na Dimmako...", "sucesso");
        setTimeout(() => {
            window.location.href = "home.html";
        }, 800);
    }, 1000);
}

function continuarComProvedor(provedor) {
    elemento.style.display = "flex";
    setTimeout(() => {
        elemento.style.display = "none";
        const emailProvedor = (email.value || "").trim().toLowerCase() || `${provedor.toLowerCase()}user@dimmako.ao`;
        email.value = emailProvedor;

        const nomeProvedor = `${provedor} User`;
        const elNomeCliente = document.getElementById("nomeCliente");
        const elEmailCliente = document.getElementById("emailCliente");
        const elNomeVendedor = document.getElementById("nomeCompletoVendedor");
        const elEmailEmpresa = document.getElementById("emailEmpresa");

        if (elNomeCliente) elNomeCliente.value = nomeProvedor;
        if (elEmailCliente) elEmailCliente.value = emailProvedor;
        if (elNomeVendedor) elNomeVendedor.value = nomeProvedor;
        if (elEmailEmpresa) elEmailEmpresa.value = emailProvedor;

        listElementNone.forEach((element) => {
            element.style.display = "none";
        });
        switchTypeUser.style.animation = "slideLeft 0.5s linear";
        switchTypeUser.style.display = "flex";
        mostrarToast(`Conectado com ${provedor}! Escolha como pretende utilizar a plataforma.`, "info");
    }, 600);
}

function abrirLogin() {
    espacoOptionAuth.style.display = "none";
    switchTypeUser.style.display = "none";
    const divLogin = document.getElementById("divLogin");
    divLogin.style.animation = "slideLeft 0.5s linear";
    divLogin.style.display = "flex";
}

function fecharLogin() {
    document.getElementById("divLogin").style.display = "none";
    espacoOptionAuth.style.display = "flex";
}

function fazerLogin() {
    const identificador = sanitizarTexto(document.getElementById("loginIdentificador").value).toLowerCase();
    const senha = document.getElementById("loginSenha").value;

    if (!identificador || !senha) {
        mostrarToast("Preencha o email/telefone e a senha.", "erro");
        return;
    }

    elemento.style.display = "flex";
    setTimeout(() => {
        elemento.style.display = "none";

        const conta = obterContas().find(c => c.identificador === identificador && c.senha === senha);

        if (!conta) {
            mostrarToast("Dados incorrectos ou conta não encontrada. Verifique as credenciais.", "erro");
            return;
        }

        localStorage.setItem("dimmakoSessaoActual", JSON.stringify(conta));

        const saudacao = conta.nome || conta.nomeEmpresa || (conta.tipo === "vendedor" ? "Vendedor" : "Cliente");
        mostrarToast(`Bem-vindo de volta, ${saudacao}! A entrar...`, "sucesso");

        setTimeout(() => {
            window.location.href = "home.html";
        }, 1000);
    }, 1000);
}

// Inicialização na carga da página
document.addEventListener("DOMContentLoaded", () => {
    popularSelectsNascimento();
    configurarValidacaoEmTempoReal();
});