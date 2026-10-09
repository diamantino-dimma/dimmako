const elemento = document.getElementById("espcaoload");
const email = document.getElementById("email");
const switchTypeUser = document.getElementById("switchTypeUser");
const espacoOptionAuth = document.getElementById("espacoOptionAuth");
let listElementNone = [espacoOptionAuth, elemento];
let cadastroEmProcesso = false;
let cadastroViaProvedor = false;
let utilizadorProvedorPendente = null;
let provedorCadastroPendente = "";

// Tema escuro por padrão (sincroniza com a preferência escolhida na home)
if (localStorage.getItem("dimmakoTema") !== "claro") document.body.classList.add("dark-theme");

// Armazenamento em memória das fotos/logótipos carregados
window.empresaFotoBase64 = null;
window.clienteFotoBase64 = null;
window.empresaFotoFicheiro = null;
window.clienteFotoFicheiro = null;
window.empresaFotoPreview = null;
window.clienteFotoPreview = null;

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

    const icon = document.createElement("span");
    icon.className = "toast-icone";
    icon.innerHTML = icone;
    const texto = document.createElement("span");
    texto.className = "toast-texto";
    texto.textContent = String(mensagem);
    toast.append(icon, texto);
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = "toastOut 0.3s forwards";
        setTimeout(() => {
            if (toast.parentElement) toast.parentElement.removeChild(toast);
        }, 300);
    }, duracao);
}

async function uploadImagemImgBB(ficheiro) {
    if (!window.dimmakoMedia) throw new Error("O serviço de envio de imagens não foi carregado.");
    try {
        return await window.dimmakoMedia.uploadToImgBB(ficheiro);
    } catch (cause) {
        const error = new Error(cause.message || "Não foi possível enviar a imagem para o ImgBB.");
        error.code = "dimmako/imgbb-upload-failed";
        throw error;
    }
}

// ---- Sanitização e validação ----
function sanitizarTexto(valor) {
    return String(valor || "").normalize("NFC").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
}

function ehEmailValido(valor) {
    return valor.length <= 254 && /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,63}$/i.test(valor);
}

function ehTelefoneValido(valor) {
    return /^\+?[\d\s().-]+$/.test(valor) && valor.replace(/\D/g, "").length >= 9 && valor.replace(/\D/g, "").length <= 15;
}

function ehEmailOuTelefoneValido(valor) {
    return ehEmailValido(valor) || ehTelefoneValido(valor);
}

function marcarValidacao(campo, valido) {
    if (!campo) return;
    campo.classList.toggle("is-invalid", !valido);
    campo.classList.toggle("is-valid", valido);
    campo.setAttribute("aria-invalid", String(!valido));
    const mensagem = campo.parentElement.querySelector(`[data-validation-for="${campo.id}"]`);
    if (mensagem) mensagem.hidden = valido;
}

function definirErroCampo(campo, valido, mensagemErro) {
    if (!campo) return valido;
    let mensagem = campo.parentElement.querySelector(`[data-validation-for="${campo.id}"]`);
    if (!mensagem) {
        mensagem = document.createElement("small");
        mensagem.className = "field-validation-message";
        mensagem.dataset.validationFor = campo.id;
        mensagem.id = `${campo.id}Error`;
        mensagem.setAttribute("role", "alert");
        campo.insertAdjacentElement("afterend", mensagem);
    }
    mensagem.textContent = valido ? "" : mensagemErro;
    mensagem.hidden = valido;
    campo.setAttribute("aria-describedby", mensagem.id);
    marcarValidacao(campo, valido);
    return valido;
}

function dataNascimentoValida() {
    const dia = Number(document.getElementById("dia")?.value);
    const mes = Number(document.getElementById("mes")?.value);
    const ano = Number(document.getElementById("ano")?.value);
    if (!dia || !mes || !ano) return false;
    const nascimento = new Date(ano, mes - 1, dia);
    if (nascimento.getFullYear() !== ano || nascimento.getMonth() !== mes - 1 || nascimento.getDate() !== dia) return false;
    const hoje = new Date();
    let idade = hoje.getFullYear() - ano;
    if (hoje.getMonth() < mes - 1 || (hoje.getMonth() === mes - 1 && hoje.getDate() < dia)) idade--;
    return idade >= 18 && idade <= 120;
}

function validarDataNascimento(mostrarErro = true) {
    const valido = dataNascimentoValida();
    const grupo = document.querySelector(".dataEspace");
    if (!grupo) return valido;

    grupo.querySelectorAll('[data-validation-for="dia"], [data-validation-for="mes"], [data-validation-for="ano"]').forEach(mensagem => mensagem.remove());
    let mensagem = grupo.querySelector('[data-validation-for="dataNascimento"]');
    if (!mensagem) {
        mensagem = document.createElement("small");
        mensagem.className = "field-validation-message";
        mensagem.dataset.validationFor = "dataNascimento";
        mensagem.id = "dataNascimentoError";
        mensagem.setAttribute("role", "alert");
        grupo.appendChild(mensagem);
    }
    mensagem.textContent = "Deve ter pelo menos 18 anos de idade.";
    mensagem.hidden = valido || !mostrarErro;

    ["dia", "mes", "ano"].forEach(id => {
        const campo = document.getElementById(id);
        if (!campo) return;
        campo.classList.toggle("is-invalid", !valido);
        campo.classList.toggle("is-valid", valido);
        campo.setAttribute("aria-invalid", String(!valido));
        campo.setAttribute("aria-describedby", mensagem.id);
    });
    return valido;
}

function validarFicheiroImagem(input) {
    const ficheiro = input?.files?.[0];
    if (!ficheiro) return true;
    return ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(ficheiro.type) && ficheiro.size > 0 && ficheiro.size <= 10 * 1024 * 1024;
}

async function imagemComAssinaturaValida(ficheiro) {
    const bytes = new Uint8Array(await ficheiro.slice(0, 12).arrayBuffer());
    const comecaPor = valores => valores.every((valor, indice) => bytes[indice] === valor);
    if (ficheiro.type === "image/jpeg") return comecaPor([0xff, 0xd8, 0xff]);
    if (ficheiro.type === "image/png") return comecaPor([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (ficheiro.type === "image/gif") return String.fromCharCode(...bytes.slice(0, 6)).match(/^GIF8[79]a$/) !== null;
    if (ficheiro.type === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    return false;
}

function validarCampoCadastro(id, mostrarErro = true) {
    const campo = document.getElementById(id);
    if (!campo) return true;
    const valor = campo.type === "password" ? campo.value : sanitizarTexto(campo.value);
    let valido = false;
    let erro = "Verifique este campo.";
    switch (id) {
        case "email":
        case "emailCliente":
        case "loginIdentificador":
            valido = ehEmailOuTelefoneValido(valor);
            erro = "Introduza um email ou telefone válido.";
            break;
        case "nomeCompletoVendedor":
        case "nomeCliente":
            valido = valor.length >= 2 && valor.length <= 80 && /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u.test(valor);
            erro = "Use um nome válido, entre 2 e 80 caracteres.";
            break;
        case "biVendedor":
            valido = /^[\p{L}\d-]{6,30}$/u.test(valor);
            erro = "O BI deve ter entre 6 e 30 letras ou números.";
            break;
        case "senhaVendedor":
        case "senhaCliente":
            valido = verificarRequisitosSenha(valor, id === "senhaVendedor" ? "req_senhaVendedor" : "req_senhaCliente") && valor.length <= 128;
            erro = "A senha deve cumprir os requisitos indicados e ter no máximo 128 caracteres.";
            break;
        case "confirmarSenhaVendedor":
        case "confirmarSenhaCliente":
            valido = valor.length > 0 && valor === document.getElementById(id === "confirmarSenhaVendedor" ? "senhaVendedor" : "senhaCliente")?.value;
            erro = "As palavras-passe não coincidem.";
            break;
        case "nomeEmpresa":
            valido = valor.length >= 2 && valor.length <= 100;
            erro = "O nome da empresa deve ter entre 2 e 100 caracteres.";
            break;
        case "emailEmpresa":
            valido = ehEmailValido(valor);
            erro = "Introduza um email empresarial válido.";
            break;
        case "telefoneEmpresa":
            valido = ehTelefoneValido(valor);
            erro = "Introduza um telefone com 9 a 15 dígitos.";
            break;
        case "descriptionBus":
            valido = valor.length >= 10 && valor.length <= 500;
            erro = "A descrição deve ter entre 10 e 500 caracteres.";
            break;
        case "loginSenha":
            valido = campo.value.length >= 1 && campo.value.length <= 128;
            erro = "Introduza a sua senha (máximo de 128 caracteres).";
            break;
        case "dia":
        case "mes":
        case "ano":
            return validarDataNascimento(mostrarErro);
        case "sexoVendedor":
            valido = ["Masculino", "Feminino", "Outro"].includes(valor);
            erro = "Selecione uma opção válida.";
            break;
        case "logotipoEmpresa":
        case "fotoPerfilCliente":
            valido = validarFicheiroImagem(campo);
            erro = "Use uma imagem JPG, PNG, WebP ou GIF até 10 MB.";
            break;
    }
    if (mostrarErro) definirErroCampo(campo, valido, erro);
    return valido;
}

function validarCampos(ids) {
    const resultados = ids.map(id => validarCampoCadastro(id, true));
    const categorias = document.querySelectorAll("#categoriasNegocio button.seleccionado");
    if (ids.includes("categoriaNegocio") && categorias.length !== 1) {
        mostrarToast("Selecione uma categoria para o seu negócio.", "erro");
        return false;
    }
    return resultados.every(Boolean);
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
    const ids = ["email", "nomeCompletoVendedor", "biVendedor", "senhaVendedor", "confirmarSenhaVendedor", "nomeEmpresa", "emailEmpresa", "telefoneEmpresa", "descriptionBus", "nomeCliente", "emailCliente", "senhaCliente", "confirmarSenhaCliente", "loginIdentificador", "loginSenha", "dia", "mes", "ano", "sexoVendedor", "logotipoEmpresa", "fotoPerfilCliente"];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const atualizar = () => {
                if (el.type === "password") verificarRequisitosSenha(el.value, id === "senhaVendedor" ? "req_senhaVendedor" : "req_senhaCliente");
                if (el.dataset.validationTouched === "true") validarCampoCadastro(id);
            };
            el.addEventListener("input", atualizar);
            el.addEventListener("change", () => {
                el.dataset.validationTouched = "true";
                validarCampoCadastro(id);
            });
            el.addEventListener("blur", () => {
                if (el.type !== "password" && el.type !== "file") el.value = sanitizarTexto(el.value);
                el.dataset.validationTouched = "true";
                validarCampoCadastro(id);
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
    email.value = valor;
    if (!ehEmailValido(valor.toLowerCase())) {
        definirErroCampo(email, false, "Use um email válido. O acesso por telefone ainda não está configurado.");
        mostrarToast("Introduza um endereço de email válido para continuar com email e senha.", "erro");
        email.focus();
        return;
    }
    if (!validarCampos(["email"])) return;
    elemento.style.display = "flex";
    setTimeout(() => {
        listElementNone.forEach((element) => {
            element.style.display = "none";
        });
        switchTypeUser.style.animation = "slideLeft 0.5s linear";
        switchTypeUser.style.display = "flex";
    }, 800);
}

let transicaoPassoAtiva = false;

function executarTransicaoPasso(atualizarPasso) {
    if (transicaoPassoAtiva) return;
    transicaoPassoAtiva = true;
    elemento.style.display = "flex";
    window.setTimeout(() => {
        try {
            atualizarPasso();
        } finally {
            elemento.style.display = "none";
            transicaoPassoAtiva = false;
        }
    }, 420);
}

function irParaPasso(idAtual, idProximo, passoAtualId, passoProximoId) {
    const atual = document.getElementById(idAtual);
    const proximo = document.getElementById(idProximo);

    executarTransicaoPasso(() => {
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
    });
}

function voltarPasso(idAtual, idAnterior, passoAtualId) {
    const atual = document.getElementById(idAtual);
    const anterior = document.getElementById(idAnterior);

    executarTransicaoPasso(() => {
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
    });
}

function selecionarUnico(botao) {
    const irmaos = botao.parentElement.querySelectorAll("button");
    irmaos.forEach((b) => {
        b.classList.remove("seleccionado");
        b.setAttribute("aria-pressed", "false");
    });
    botao.classList.add("seleccionado");
    botao.setAttribute("aria-pressed", "true");
}

function alternarSeleccao(botao) {
    botao.classList.toggle("seleccionado");
}

async function mostrarPreview(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    const ficheiro = input.files && input.files[0];

    if (!ficheiro) return;

    if (!validarFicheiroImagem(input)) {
        definirErroCampo(input, false, "Use uma imagem JPG, PNG, WebP ou GIF até 10 MB.");
        mostrarToast("Use uma imagem JPG, PNG, WebP ou GIF até 10 MB.", "erro");
        input.value = "";
        return;
    }
    if (!await imagemComAssinaturaValida(ficheiro)) {
        definirErroCampo(input, false, "O conteúdo do ficheiro não corresponde a uma imagem válida.");
        mostrarToast("O ficheiro selecionado não é uma imagem válida.", "erro");
        input.value = "";
        return;
    }
    definirErroCampo(input, true, "");
    const imagemEmpresa = inputId === "logotipoEmpresa";
    const previewAnterior = imagemEmpresa ? window.empresaFotoPreview : window.clienteFotoPreview;
    if (previewAnterior) URL.revokeObjectURL(previewAnterior);
    const previewLocal = URL.createObjectURL(ficheiro);
    preview.innerHTML = `<img src="${previewLocal}" alt="Pré-visualização da imagem" style="width:100%;height:100%;object-fit:cover;border-radius:100%;">`;
    if (imagemEmpresa) {
        window.empresaFotoFicheiro = ficheiro;
        window.empresaFotoPreview = previewLocal;
    } else {
        window.clienteFotoFicheiro = ficheiro;
        window.clienteFotoPreview = previewLocal;
    }
    mostrarToast("Imagem selecionada. Será enviada com segurança ao concluir o cadastro.", "info");
}

function preencherValor(id, valor) {
    const campo = document.getElementById(id);
    if (!campo || typeof valor !== "string" || !valor.trim()) return;
    campo.value = valor.trim();
    campo.dataset.validationTouched = "false";
    campo.classList.remove("is-invalid", "is-valid");
    campo.removeAttribute("aria-invalid");
    const mensagem = campo.parentElement?.querySelector(`[data-validation-for="${id}"]`);
    if (mensagem) mensagem.remove();
}

function prepararFormularioDeProvedor(utilizador) {
    const nome = sanitizarTexto(utilizador.displayName || "");
    const enderecoEmail = sanitizarTexto(utilizador.email || "").toLowerCase();
    preencherValor("email", enderecoEmail);
    preencherValor("nomeCompletoVendedor", nome);
    preencherValor("nomeCliente", nome);
    preencherValor("emailCliente", enderecoEmail);
    preencherValor("emailEmpresa", enderecoEmail);

    const emailCliente = document.getElementById("emailCliente");
    if (emailCliente) {
        emailCliente.readOnly = Boolean(enderecoEmail);
        emailCliente.setAttribute("aria-readonly", String(Boolean(enderecoEmail)));
    }
    const emailInicial = document.getElementById("email");
    if (emailInicial) emailInicial.readOnly = Boolean(enderecoEmail);

    const senhaIds = ["senhaVendedor", "confirmarSenhaVendedor", "senhaCliente", "confirmarSenhaCliente"];
    senhaIds.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) {
            campo.required = !cadastroViaProvedor;
            campo.hidden = cadastroViaProvedor;
        }
    });
    ["req_senhaVendedor", "req_senhaCliente"].forEach(id => {
        const requisitos = document.getElementById(id);
        if (requisitos) requisitos.hidden = cadastroViaProvedor;
    });
    const aviso = document.getElementById("providerAccountNotice");
    if (aviso) aviso.hidden = !cadastroViaProvedor;
    const botaoVendedor = document.getElementById("completeSellerRegistration");
    const botaoCliente = document.getElementById("completeCustomerRegistration");
    if (botaoVendedor) botaoVendedor.textContent = cadastroViaProvedor ? "Confirmar dados e criar conta" : "Concluir cadastro";
    if (botaoCliente) botaoCliente.textContent = cadastroViaProvedor ? "Confirmar dados e criar conta" : "Cadastrar";
}

function mostrarEscolhaTipoConta(utilizador, provedor) {
    cadastroViaProvedor = true;
    utilizadorProvedorPendente = utilizador;
    provedorCadastroPendente = provedor || "";
    prepararFormularioDeProvedor(utilizador);
    document.getElementById("divLogin").style.display = "none";
    espacoOptionAuth.style.display = "none";
    switchTypeUser.style.display = "flex";
    document.querySelectorAll("#switchTypeUser > div").forEach(passo => {
        passo.style.display = passo.id === "passoCreateAccount" || passo.id === "divPasso1" ? "flex" : "none";
    });
    document.querySelectorAll("#passoCreateAccount > div").forEach(passo => {
        passo.style.background = "#f2b888";
        passo.style.color = "rgb(222, 112, 33)";
    });
    elemento.style.display = "none";
}

function prepararContaViaProvedor() {
    const utilizador = utilizadorProvedorPendente || window.dimmakoFirebase?.auth.currentUser;
    if (!utilizador) throw new Error("A sessão do provedor expirou. Entre novamente com a sua conta.");
    if (utilizador.email) {
        const emailConfirmado = sanitizarTexto(utilizador.email).toLowerCase();
        const campoEmail = document.getElementById("email");
        const campoEmailCliente = document.getElementById("emailCliente");
        if (campoEmail && campoEmail.value.trim().toLowerCase() !== emailConfirmado) {
            throw new Error("O email de cadastro deve corresponder ao email confirmado pelo provedor.");
        }
        if (campoEmailCliente && campoEmailCliente.value.trim().toLowerCase() !== emailConfirmado) {
            throw new Error("O email do perfil deve corresponder ao email confirmado pelo provedor.");
        }
    }
    return utilizador;
}

function validarCredenciaisCadastro(ids) {
    const campos = cadastroViaProvedor
        ? ids.filter(id => !["senhaVendedor", "confirmarSenhaVendedor", "senhaCliente", "confirmarSenhaCliente"].includes(id))
        : ids;
    return validarCampos(campos);
}

function avancarPasso2Vendedor() {
    const ids = ["nomeCompletoVendedor", "dia", "mes", "ano", "sexoVendedor", "biVendedor", "senhaVendedor", "confirmarSenhaVendedor"];
    if (!validarCredenciaisCadastro(ids)) {
        mostrarToast("Corrija os campos assinalados antes de continuar.", "erro");
        return;
    }

    irParaPasso("divPasso2", "divPasso3", "passo2", "passo3");
}

function avancarPasso3Vendedor() {
    const ids = ["nomeEmpresa", "emailEmpresa", "telefoneEmpresa", "categoriaNegocio"];
    if (!validarCampos(ids)) {
        mostrarToast("Corrija os campos e selecione uma categoria para continuar.", "erro");
        return;
    }

    irParaPasso("divPasso3", "divPasso4", "passo3", "passo4");
}

function obterContas() {
    try {
        const contas = JSON.parse(localStorage.getItem("dimmakoContas") || "[]");
        return Array.isArray(contas) ? contas.map(conta => {
            const { senha, password, ...perfilSeguro } = conta;
            return perfilSeguro;
        }) : [];
    } catch (e) {
        return [];
    }
}

function obterErroFirebase(error, provedor = "") {
    if (error?.code === "dimmako/imgbb-upload-failed") return error.message;
    const nomesProvedores = {
        Google: "Google",
        Facebook: "Facebook",
        Apple: "Apple",
        Email: "email e senha"
    };
    const nomeProvedor = nomesProvedores[provedor] || "este método";
    const mensagens = {
        "auth/email-already-in-use": "Este email já tem uma conta. Entre ou recupere o acesso.",
        "auth/invalid-email": "O email introduzido não é válido.",
        "auth/weak-password": "A senha não cumpre os requisitos de segurança.",
        "auth/invalid-credential": "Email ou senha incorretos.",
        "auth/user-not-found": "Email ou senha incorretos.",
        "auth/wrong-password": "Email ou senha incorretos.",
        "auth/too-many-requests": "Muitas tentativas. Aguarde e tente novamente.",
        "auth/network-request-failed": "Sem ligação ao serviço de autenticação. Tente novamente.",
        "auth/account-exists-with-different-credential": "Este email já está associado a outro método de acesso. Entre com esse método primeiro.",
        "auth/credential-already-in-use": "Esta conta de provedor já está associada a outra conta Dimmako.",
        "auth/invalid-oauth-client-id": "A configuração OAuth deste provedor está incompleta no Firebase Console.",
        "auth/invalid-apple-credential": "A configuração de Sign in with Apple está inválida. Verifique o Service ID, Team ID e chave no Firebase.",
        "auth/invalid-api-key": "A chave da aplicação Firebase é inválida. Confira a configuração Firebase local.",
        "auth/app-not-authorized": "Esta aplicação não está autorizada para este projeto Firebase. Confira o domínio e a configuração da aplicação.",
        "auth/invalid-continue-uri": "O endereço de retorno da autenticação é inválido. Confira os domínios autorizados no Firebase Authentication.",
        "auth/unauthorized-continue-uri": "O endereço de retorno não está autorizado. Adicione o domínio aos domínios autorizados do Firebase Authentication.",
        "auth/invalid-oauth-provider": `O provedor ${nomeProvedor} não foi reconhecido pela configuração OAuth do Firebase.`,
        "auth/unauthorized-domain": "Este domínio não está autorizado no Firebase Authentication. Adicione-o aos domínios autorizados do projeto.",
        "auth/operation-not-allowed": `O acesso por ${nomeProvedor} está desativado. Ative esse provedor em Firebase Console > Authentication > Método de login.`,
        "auth/popup-blocked": "O navegador bloqueou a janela de autenticação.",
        "auth/popup-closed-by-user": "A janela de autenticação foi fechada.",
        "auth/cancelled-popup-request": "O pedido de autenticação foi cancelado.",
        "auth/web-storage-unsupported": "O navegador bloqueou o armazenamento necessário para autenticar. Permita cookies e armazenamento do site.",
        "permission-denied": "O Firestore recusou o acesso. Confirme as regras de segurança publicadas."
    };
    if (mensagens[error?.code]) return mensagens[error.code];
    if (error?.code) {
        return `O Firebase devolveu o erro "${error.code}" ao autenticar com ${nomeProvedor}. Verifique o provedor, os domínios autorizados e a configuração OAuth no Console do Firebase.`;
    }
    if (!window.dimmakoFirebase) {
        return "O Firebase não foi inicializado. Confira a configuração local e se os scripts do Firebase carregaram.";
    }
    return `Não foi possível autenticar com ${nomeProvedor}. Verifique a ligação e consulte o Console do Firebase para o detalhe do erro.`;
}

function obterEmailFirebase(valor) {
    const emailFirebase = sanitizarTexto(valor).toLowerCase();
    if (!ehEmailValido(emailFirebase)) {
        throw new Error("Para usar email e senha, introduza um endereço de email válido. O acesso por telefone exige Phone Authentication e reCAPTCHA configurados no Firebase.");
    }
    return emailFirebase;
}

function criarPerfilLocalSeguro(perfil) {
    return {
        uid: perfil.uid,
        tipo: perfil.tipo,
        identificador: perfil.identificador,
        email: perfil.email || "",
        nome: perfil.nome || "Utilizador",
        nomeCompleto: perfil.nomeCompleto || perfil.nome || "",
        nomeEmpresa: perfil.nomeEmpresa || "",
        categoria: perfil.categoria || "",
        descricao: perfil.descricao || "",
        foto: perfil.foto || null
    };
}

async function guardarContaCompleta(conta, utilizadorFirebase = window.dimmakoFirebase?.auth.currentUser) {
    if (!conta || !utilizadorFirebase) throw new Error("É necessário autenticar no Firebase antes de guardar o perfil.");
    const emailFirebase = utilizadorFirebase.email || "";
    const perfil = {
        uid: utilizadorFirebase.uid,
        tipo: conta.tipo === "vendedor" ? "vendedor" : "cliente",
        identificador: emailFirebase || utilizadorFirebase.uid,
        email: emailFirebase || undefined,
        nome: sanitizarTexto(conta.nome || conta.nomeCompleto || conta.nomeEmpresa || utilizadorFirebase.displayName || "Utilizador"),
        nomeCompleto: sanitizarTexto(conta.nomeCompleto || conta.nome || utilizadorFirebase.displayName || ""),
        nomeEmpresa: sanitizarTexto(conta.nomeEmpresa || ""),
        emailEmpresa: sanitizarTexto(conta.emailEmpresa || ""),
        telefoneEmpresa: sanitizarTexto(conta.telefoneEmpresa || ""),
        sexo: sanitizarTexto(conta.sexo || ""),
        bi: sanitizarTexto(conta.bi || ""),
        dataNasc: sanitizarTexto(conta.dataNasc || ""),
        categoria: sanitizarTexto(conta.categoria || ""),
        descricao: sanitizarTexto(conta.descricao || ""),
        foto: window.dimmakoMedia?.isImgBBUrl(conta.foto) ? conta.foto.slice(0, 2048) : null
    };
    const perfilFirestore = Object.fromEntries(Object.entries(perfil).filter(([, valor]) => valor !== undefined));
    const referencia = window.dimmakoFirebase.db.collection("profiles").doc(utilizadorFirebase.uid);
    const existente = await referencia.get();
    const dadosGravacao = {
        ...perfilFirestore,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!existente.exists) dadosGravacao.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    const perfilPublico = {
        uid: utilizadorFirebase.uid,
        tipo: perfilFirestore.tipo,
        nome: perfilFirestore.nome,
        nomeEmpresa: perfilFirestore.nomeEmpresa,
        categoria: perfilFirestore.categoria,
        descricao: perfilFirestore.descricao,
        foto: perfilFirestore.foto,
        visible: true,
        verified: true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const batch = window.dimmakoFirebase.db.batch();
    batch.set(referencia, dadosGravacao, { merge: true });
    batch.set(window.dimmakoFirebase.db.collection("publicProfiles").doc(utilizadorFirebase.uid), perfilPublico, { merge: true });
    await batch.commit();

    const perfilLocal = criarPerfilLocalSeguro(perfilFirestore);
    const contas = obterContas().filter(item => item.uid !== utilizadorFirebase.uid && item.identificador !== perfilLocal.identificador);
    contas.push(perfilLocal);
    localStorage.setItem("dimmakoContas", JSON.stringify(contas));
    localStorage.setItem("dimmakoSessaoActual", JSON.stringify(perfilLocal));
    return perfilLocal;
}

function limparCredenciaisLegadas() {
    const contasSeguras = obterContas();
    localStorage.setItem("dimmakoContas", JSON.stringify(contasSeguras));
    try {
        const sessao = JSON.parse(localStorage.getItem("dimmakoSessaoActual") || "null");
        if (sessao && (sessao.senha || sessao.password)) {
            delete sessao.senha;
            delete sessao.password;
            localStorage.setItem("dimmakoSessaoActual", JSON.stringify(sessao));
        }
    } catch (error) {
        localStorage.removeItem("dimmakoSessaoActual");
    }
}

async function finalizarCadastroVendedor() {
    if (cadastroEmProcesso) return;
    const ids = ["nomeCompletoVendedor", "dia", "mes", "ano", "sexoVendedor", "biVendedor", "senhaVendedor", "confirmarSenhaVendedor", "nomeEmpresa", "emailEmpresa", "telefoneEmpresa", "categoriaNegocio", "descriptionBus", "logotipoEmpresa"];
    if (!validarCredenciaisCadastro(ids)) {
        mostrarToast("Corrija os campos assinalados antes de concluir o cadastro.", "erro");
        return;
    }
    if (cadastroViaProvedor && !validarCampos(["email"])) {
        mostrarToast("Confirme o email recebido do provedor antes de concluir o cadastro.", "erro");
        return;
    }
    cadastroEmProcesso = true;
    const passo4 = document.getElementById("passo4");
    if (passo4) {
        passo4.style.background = "#de6706";
        passo4.style.color = "white";
    }

    elemento.style.display = "flex";

    const nomeCompleto = sanitizarTexto(document.getElementById("nomeCompletoVendedor").value);
    const sexo = document.getElementById("sexoVendedor").value;
    const bi = sanitizarTexto(document.getElementById("biVendedor").value);
    const dia = document.getElementById("dia").value;
    const mes = document.getElementById("mes").value;
    const ano = document.getElementById("ano").value;
    const nomeEmpresa = sanitizarTexto(document.getElementById("nomeEmpresa").value);
    const emailEmpresa = sanitizarTexto(document.getElementById("emailEmpresa").value);
    const telefoneEmpresa = sanitizarTexto(document.getElementById("telefoneEmpresa").value);
    const emailAuth = cadastroViaProvedor
        ? (utilizadorProvedorPendente || window.dimmakoFirebase?.auth.currentUser)?.email
        : (ehEmailValido(email.value.trim()) ? email.value.trim().toLowerCase() : emailEmpresa.toLowerCase());
    const categoriaBtn = document.querySelector("#categoriasNegocio button.seleccionado");
    const categoria = categoriaBtn ? categoriaBtn.textContent.trim() : "Comércio Geral";
    const descricao = sanitizarTexto(document.getElementById("descriptionBus").value);
    const foto = window.empresaFotoBase64 || null;

    const conta = {
        tipo: "vendedor",
        identificador: emailAuth,
        email: emailAuth,
        nome: nomeCompleto || nomeEmpresa,
        nomeCompleto: nomeCompleto,
        nomeEmpresa: nomeEmpresa,
        emailEmpresa: emailEmpresa,
        telefoneEmpresa: telefoneEmpresa,
        sexo: sexo,
        bi: bi,
        dataNasc: `${dia}/${mes}/${ano}`,
        categoria: categoria,
        descricao: descricao,
        foto: foto
    };

    try {
        if (!window.dimmakoFirebase) throw new Error("Firebase não está inicializado.");
        await window.dimmakoFirebase.ready;
        const viaProvedor = cadastroViaProvedor;
        let utilizador = null;
        if (viaProvedor) {
            utilizador = prepararContaViaProvedor();
        } else {
            const credencial = await window.dimmakoFirebase.auth.createUserWithEmailAndPassword(emailAuth, document.getElementById("senhaVendedor").value);
            utilizador = credencial.user;
        }
        if (window.empresaFotoFicheiro) conta.foto = await uploadImagemImgBB(window.empresaFotoFicheiro);
        await guardarContaCompleta(conta, utilizador);
        sessionStorage.removeItem("dimmakoProvedorAuthPendente");
        cadastroViaProvedor = false;
        utilizadorProvedorPendente = null;
        provedorCadastroPendente = "";
        elemento.style.display = "none";
        mostrarToast(viaProvedor
            ? "Dados confirmados! A entrar na Dimmako..."
            : "Cadastro concluído com sucesso! A entrar na Dimmako...", "sucesso");
        setTimeout(() => {
            window.location.href = "home.html";
        }, 1000);
    } catch (error) {
        elemento.style.display = "none";
        cadastroEmProcesso = false;
        mostrarToast(obterErroFirebase(error, provedorCadastroPendente), "erro", 5000);
    }
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

async function cadastrarCliente() {
    if (cadastroEmProcesso) return;
    if (!validarCredenciaisCadastro(["nomeCliente", "emailCliente", "senhaCliente", "confirmarSenhaCliente", "fotoPerfilCliente"])) {
        mostrarToast("Corrija os campos assinalados antes de concluir o cadastro.", "erro");
        return;
    }
    if (cadastroViaProvedor && !validarCampos(["email"])) {
        mostrarToast("Confirme o email recebido do provedor antes de concluir o cadastro.", "erro");
        return;
    }
    const nome = sanitizarTexto(document.getElementById("nomeCliente").value);
    const emailCliente = cadastroViaProvedor
        ? (utilizadorProvedorPendente || window.dimmakoFirebase?.auth.currentUser)?.email
        : sanitizarTexto(document.getElementById("emailCliente").value).toLowerCase();
    if (!ehEmailValido(emailCliente)) {
        mostrarToast("O Firebase está configurado para email e senha. Acesso por telefone requer Phone Authentication e reCAPTCHA ativos.", "erro", 6000);
        return;
    }

    const conta = {
        tipo: "cliente",
        identificador: emailCliente,
        email: emailCliente,
        nome: nome,
        nomeCompleto: nome,
        foto: window.clienteFotoBase64 || null
    };

    cadastroEmProcesso = true;
    elemento.style.display = "flex";
    try {
        await window.dimmakoFirebase.ready;
        const viaProvedor = cadastroViaProvedor;
        let utilizador = null;
        if (viaProvedor) {
            utilizador = prepararContaViaProvedor();
        } else {
            const credencial = await window.dimmakoFirebase.auth.createUserWithEmailAndPassword(
                emailCliente,
                document.getElementById("senhaCliente").value
            );
            utilizador = credencial.user;
        }
        if (window.clienteFotoFicheiro) conta.foto = await uploadImagemImgBB(window.clienteFotoFicheiro);
        await guardarContaCompleta(conta, utilizador);
        sessionStorage.removeItem("dimmakoProvedorAuthPendente");
        cadastroViaProvedor = false;
        utilizadorProvedorPendente = null;
        provedorCadastroPendente = "";
        elemento.style.display = "none";
        mostrarToast(viaProvedor
            ? "Dados confirmados! A entrar na Dimmako..."
            : "Cadastro de cliente concluído com sucesso! A entrar na Dimmako...", "sucesso");
        setTimeout(() => {
            window.location.href = "home.html";
        }, 800);
    } catch (error) {
        elemento.style.display = "none";
        cadastroEmProcesso = false;
        mostrarToast(obterErroFirebase(error, provedorCadastroPendente), "erro", 5000);
    }
}

async function continuarComProvedor(provedor) {
    if (provedor === "Email") {
        const campoEmail = document.getElementById("email");
        if (!campoEmail) return;
        if (!ehEmailOuTelefoneValido(sanitizarTexto(campoEmail.value))) {
            campoEmail.focus();
            mostrarToast("Introduza um email válido e confirme para criar uma conta, ou use Entrar se já tiver conta.", "info");
            return;
        }
        confirmarEmail();
        return;
    }

    const criadores = {
        Google: () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: "select_account" });
            return provider;
        },
        Apple: () => {
            const provider = new firebase.auth.OAuthProvider("apple.com");
            provider.addScope("email");
            provider.addScope("name");
            return provider;
        }
    };
    if (!criadores[provedor]) {
        mostrarToast("Este método de acesso não é suportado.", "erro");
        return;
    }
    if (!window.dimmakoFirebase?.auth) {
        mostrarToast(obterErroFirebase(null, provedor), "erro", 6000);
        return;
    }

    elemento.style.display = "flex";
    try {
        await window.dimmakoFirebase.ready;
        const auth = window.dimmakoFirebase.auth;
        const provider = criadores[provedor]();
        sessionStorage.setItem("dimmakoProvedorAuthPendente", provedor);
        try {
            const resultado = await auth.signInWithPopup(provider);
            await finalizarAcessoProvedor(resultado.user, provedor);
        } catch (error) {
            if (error.code === "auth/popup-blocked") {
                await auth.signInWithRedirect(provider);
                return;
            }
            sessionStorage.removeItem("dimmakoProvedorAuthPendente");
            throw error;
        }
    } catch (error) {
        elemento.style.display = "none";
        sessionStorage.removeItem("dimmakoProvedorAuthPendente");
        console.error(`Falha na autenticação pelo provedor ${provedor}.`, error);
        mostrarToast(obterErroFirebase(error, provedor), "erro", 6000);
    }
}

function obterNomeProvedor(utilizador) {
    const providerId = utilizador.providerData?.map(provider => provider.providerId)
        .find(id => id === "google.com" || id === "apple.com");
    return providerId === "apple.com" ? "Apple" : "Google";
}

async function finalizarAcessoProvedor(utilizador, provedor = obterNomeProvedor(utilizador)) {
    const profileRef = window.dimmakoFirebase.db.collection("profiles").doc(utilizador.uid);
    const profileSnapshot = await profileRef.get();
    if (profileSnapshot.exists) {
        await guardarContaCompleta(profileSnapshot.data(), utilizador);
        sessionStorage.removeItem("dimmakoProvedorAuthPendente");
        window.location.replace("home.html");
        return;
    }
    mostrarEscolhaTipoConta(utilizador, provedor);
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

async function fazerLogin() {
    const identificador = sanitizarTexto(document.getElementById("loginIdentificador").value).toLowerCase();
    const senha = document.getElementById("loginSenha").value;
    document.getElementById("loginIdentificador").value = identificador;
    if (!validarCampos(["loginIdentificador", "loginSenha"])) {
        mostrarToast("Introduza um email ou telefone válido e a sua senha.", "erro");
        return;
    }

    if (!ehEmailValido(identificador)) {
        mostrarToast("O Firebase está configurado para email e senha. Acesso por telefone requer Phone Authentication e reCAPTCHA ativos.", "erro", 6000);
        return;
    }

    elemento.style.display = "flex";
    try {
        await window.dimmakoFirebase.ready;
        const credencial = await window.dimmakoFirebase.auth.signInWithEmailAndPassword(identificador, senha);
        const snapshot = await window.dimmakoFirebase.db.collection("profiles").doc(credencial.user.uid).get();
        const perfilLegado = obterContas().find(conta => conta.identificador === identificador);
        const profile = snapshot.exists ? snapshot.data() : {
            ...(perfilLegado || {}),
            tipo: perfilLegado?.tipo || "cliente",
            identificador,
            email: credencial.user.email,
            nome: perfilLegado?.nome || credencial.user.displayName || "Utilizador",
            nomeCompleto: perfilLegado?.nomeCompleto || credencial.user.displayName || "Utilizador"
        };
        await guardarContaCompleta(profile, credencial.user);
        elemento.style.display = "none";
        const saudacao = profile.nome || profile.nomeEmpresa || "Utilizador";
        mostrarToast(`Bem-vindo de volta, ${saudacao}! A entrar...`, "sucesso");
        setTimeout(() => {
            window.location.href = "home.html";
        }, 1000);
    } catch (error) {
        elemento.style.display = "none";
        mostrarToast(obterErroFirebase(error), "erro", 5000);
    }
}

// Inicialização na carga da página
document.addEventListener("DOMContentLoaded", () => {
    limparCredenciaisLegadas();
    popularSelectsNascimento();
    configurarValidacaoEmTempoReal();
    email?.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            confirmarEmail();
        }
    });
    if (window.dimmakoFirebase) {
        window.dimmakoFirebase.ready
            .then(() => window.dimmakoFirebase.auth.getRedirectResult())
            .then(resultado => {
                if (!resultado?.user) {
                    const provedorPendente = sessionStorage.getItem("dimmakoProvedorAuthPendente");
                    const utilizadorAtual = window.dimmakoFirebase.auth.currentUser;
                    if (provedorPendente && utilizadorAtual) {
                        return finalizarAcessoProvedor(utilizadorAtual, provedorPendente);
                    }
                    return;
                }
                elemento.style.display = "flex";
                return finalizarAcessoProvedor(
                    resultado.user,
                    sessionStorage.getItem("dimmakoProvedorAuthPendente") || obterNomeProvedor(resultado.user)
                );
            })
            .catch(error => {
                elemento.style.display = "none";
                console.error("Falha ao concluir o acesso por redirecionamento do provedor.", error);
                mostrarToast(obterErroFirebase(error, sessionStorage.getItem("dimmakoProvedorAuthPendente") || ""), "erro", 6000);
                sessionStorage.removeItem("dimmakoProvedorAuthPendente");
            });
    }
});