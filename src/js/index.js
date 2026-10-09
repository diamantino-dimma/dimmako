const elemento = document.getElementById("espcaoload");
const email = document.getElementById("email");
const switchTypeUser = document.getElementById("switchTypeUser");
const espacoOptionAuth = document.getElementById("espacoOptionAuth");
let listElementNone = [espacoOptionAuth, elemento];
let cadastroEmProcesso = false;

// Tema escuro por padrão (sincroniza com a preferência escolhida na home)
if (localStorage.getItem("dimmakoTema") !== "claro") document.body.classList.add("dark-theme");

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
            valido = dataNascimentoValida();
            erro = "Indique uma data real e confirme que tem pelo menos 18 anos.";
            break;
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
    if (ids.some(id => ["dia", "mes", "ano"].includes(id)) && !dataNascimentoValida()) {
        ["dia", "mes", "ano"].forEach(id => definirErroCampo(document.getElementById(id), false, "Indique uma data real e confirme que tem pelo menos 18 anos."));
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
    const ids = ["nomeCompletoVendedor", "dia", "mes", "ano", "sexoVendedor", "biVendedor", "senhaVendedor", "confirmarSenhaVendedor"];
    if (!validarCampos(ids)) {
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
    if (cadastroEmProcesso) return;
    const ids = ["nomeCompletoVendedor", "dia", "mes", "ano", "sexoVendedor", "biVendedor", "senhaVendedor", "confirmarSenhaVendedor", "nomeEmpresa", "emailEmpresa", "telefoneEmpresa", "categoriaNegocio", "descriptionBus", "logotipoEmpresa"];
    if (!validarCampos(ids)) {
        mostrarToast("Corrija os campos assinalados antes de concluir o cadastro.", "erro");
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
    const categoriaBtn = document.querySelector("#categoriasNegocio button.seleccionado");
    const categoria = categoriaBtn ? categoriaBtn.textContent.trim() : "Comércio Geral";
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
        sexo: sexo,
        bi: bi,
        dataNasc: `${dia}/${mes}/${ano}`,
        categoria: categoria,
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
    if (cadastroEmProcesso) return;
    if (!validarCampos(["nomeCliente", "emailCliente", "senhaCliente", "confirmarSenhaCliente", "fotoPerfilCliente"])) {
        mostrarToast("Corrija os campos assinalados antes de concluir o cadastro.", "erro");
        return;
    }
    cadastroEmProcesso = true;
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
    document.getElementById("loginIdentificador").value = identificador;
    if (!validarCampos(["loginIdentificador", "loginSenha"])) {
        mostrarToast("Introduza um email ou telefone válido e a sua senha.", "erro");
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