
/* =========================================
   ACESSAMAP - GOOGLE MAPS + GOOGLE PLACES
========================================= */

// VARIÁVEIS
let mapaGoogle = null;
let MarcadorGoogle = null;
let marcadores = [];
let buscaAtual = 0;
let selecaoAtual = 0;

// ELEMENTOS HTML
const campoPesquisa = document.getElementById("campo-pesquisa");
const botaoPesquisar = document.getElementById("botao-pesquisar");
const dadosLocal = document.getElementById("dados-local");


// =========================================
// INICIAR GOOGLE MAPS
// =========================================

window.iniciarMapaGoogle = async function () {
    try {
        const { Map } = await google.maps.importLibrary("maps");

        const { AdvancedMarkerElement } =
            await google.maps.importLibrary("marker");

        MarcadorGoogle = AdvancedMarkerElement;

        mapaGoogle = new Map(
            document.getElementById("mapa"),
            {
                center: {
                    lat: -15.793889,
                    lng: -47.882778
                },
                zoom: 11,
                mapId: "DEMO_MAP_ID",
                mapTypeControl: true,
                streetViewControl: true,
                fullscreenControl: true,
                zoomControl: true
            }
        );

        console.log("AcessaMap: Google Maps carregado!");

    } catch (erro) {
        console.error("Erro ao carregar Google Maps:", erro);

        dadosLocal.textContent =
            "Erro ao carregar o mapa. Verifique o console.";
    }
};


// =========================================
// PROTEGER TEXTOS DA API
// =========================================

function escaparHTML(texto) {
    return String(texto ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// =========================================
// LIMPAR MARCADORES
// =========================================

function limparMarcadores() {
    marcadores.forEach(marcador => {
        marcador.map = null;
    });

    marcadores = [];
}


// =========================================
// PESQUISAR LOCAIS
// =========================================

async function pesquisarLocais() {

    const pesquisa = campoPesquisa.value.trim();

    if (pesquisa.length < 2) {
        alert("Digite pelo menos 2 caracteres.");
        return;
    }

    if (!mapaGoogle || !MarcadorGoogle) {
        dadosLocal.textContent = "O mapa ainda está carregando.";
        return;
    }

    if (botaoPesquisar.disabled) return;

    const numeroBusca = ++buscaAtual;
    ++selecaoAtual;

    botaoPesquisar.disabled = true;
    botaoPesquisar.textContent = "Buscando...";

    dadosLocal.innerHTML = `
        <div class="estado-painel">
            <div class="carregando"></div>
            <p>Pesquisando estabelecimentos...</p>
        </div>
    `;

    try {
        const resposta = await fetch(
            `/api/google/buscar-locais?q=${encodeURIComponent(pesquisa)}`
        );

        if (!resposta.ok) {
            throw new Error("Erro HTTP: " + resposta.status);
        }

        const locais = await resposta.json();

        if (numeroBusca !== buscaAtual) return;

        limparMarcadores();

        if (locais.length === 0) {
            dadosLocal.innerHTML = `
                <p class="mensagem-inicial">
                    Nenhum estabelecimento encontrado.
                </p>
            `;
            return;
        }

        mostrarLocais(locais);

    } catch (erro) {
        console.error("Erro na pesquisa:", erro);

        if (numeroBusca === buscaAtual) {
            limparMarcadores();
            dadosLocal.innerHTML = `
                <p class="mensagem-inicial">
                    Não foi possível pesquisar.
                    Tente novamente.
                </p>
            `;
        }

    } finally {
        if (numeroBusca === buscaAtual) {
            botaoPesquisar.disabled = false;
            botaoPesquisar.textContent = "Buscar";
        }
    }
}


// =========================================
// MOSTRAR MARCADORES NO MAPA
// =========================================

function mostrarLocais(locais) {

    const limites = new google.maps.LatLngBounds();
    let quantidade = 0;
    let primeiraPosicao = null;

    for (const local of locais) {

        const latitude = Number(local.latitude);
        const longitude = Number(local.longitude);

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {
            continue;
        }

        const posicao = {
            lat: latitude,
            lng: longitude
        };

        const marcador = new MarcadorGoogle({
            map: mapaGoogle,
            position: posicao,
            title: local.nome || "Estabelecimento"
        });

        marcador.addListener("click", () => {
            mostrarInformacoes(local);
        });

        marcadores.push(marcador);
        limites.extend(posicao);

        primeiraPosicao ??= posicao;
        quantidade++;
    }

    if (quantidade === 0) {
        dadosLocal.textContent =
            "Não encontramos coordenadas válidas.";
        return;
    }

    if (quantidade === 1) {
        mapaGoogle.setCenter(primeiraPosicao);
        mapaGoogle.setZoom(16);
    } else {
        mapaGoogle.fitBounds(limites, 45);
    }

    dadosLocal.innerHTML = `
        <div class="resultado-pesquisa">
            <strong>
                ${quantidade} estabelecimento(s) encontrado(s)
            </strong>

            <span>
                Clique em um marcador para visualizar
                as informações de acessibilidade.
            </span>
        </div>
    `;
}


// =========================================
// CRIAR CARDS DE ACESSIBILIDADE
// =========================================

function criarCard(icone, titulo, valor) {

    let classe = "acessibilidade-desconhecido";
    let descricao = "Não informado";
    let simbolo = "?";

    if (valor === true) {
        classe = "acessibilidade-sim";
        descricao = "Disponível";
        simbolo = "✓";
    }

    if (valor === false) {
        classe = "acessibilidade-nao";
        descricao = "Não disponível";
        simbolo = "✕";
    }

    return `
        <div class="acessibilidade-card ${classe}">

            <div class="acessibilidade-icone">
                ${icone}
            </div>

            <div class="acessibilidade-texto">
                <strong>${titulo}</strong>
                <span>${descricao}</span>
            </div>

            <div class="acessibilidade-status"
                 aria-label="${descricao}">
                ${simbolo}
            </div>

        </div>
    `;
}


// =========================================
// MOSTRAR INFORMAÇÕES AO CLICAR
// =========================================

async function mostrarInformacoes(local) {

    const placeId = local.google_place_id;

    if (!placeId) {
        dadosLocal.textContent =
            "Este local não possui um ID do Google.";
        return;
    }

    const numeroSelecao = ++selecaoAtual;

    const nome = escaparHTML(local.nome || "Local");
    const endereco = escaparHTML(
        local.endereco || "Endereço não informado"
    );

    dadosLocal.innerHTML = `
        <div class="local-detalhes">

            <div class="local-cabecalho">
                <span class="local-pin">📍</span>

                <div>
                    <h3 class="nome-local">${nome}</h3>
                    <span class="local-tipo">
                        ${escaparHTML(local.tipo || "Estabelecimento")}
                    </span>
                </div>
            </div>

            <p class="endereco-local">${endereco}</p>

            <div class="estado-painel">
                <div class="carregando"></div>
                <p>Consultando acessibilidade...</p>
            </div>

        </div>
    `;

    try {
        const resposta = await fetch(
            `/api/google/local/${encodeURIComponent(placeId)}/acessibilidade`
        );

        if (!resposta.ok) {
            throw new Error(
                "Erro ao consultar detalhes: " + resposta.status
            );
        }

        const dados = await resposta.json();

        if (numeroSelecao !== selecaoAtual) return;

        dadosLocal.innerHTML = `
            <div class="local-detalhes">

                <div class="local-cabecalho">
                    <span class="local-pin">📍</span>

                    <div>
                        <h3 class="nome-local">${nome}</h3>
                        <span class="local-tipo">
                            ${escaparHTML(local.tipo || "Estabelecimento")}
                        </span>
                    </div>
                </div>

                <p class="endereco-local">
                    ${endereco}
                </p>

                <div class="titulo-acessibilidade">
                    <strong>Acessibilidade</strong>
                    <span>
                        Informações disponíveis sobre este local
                    </span>
                </div>

                ${criarCard(
                    "♿",
                    "Entrada acessível",
                    dados.entrada_acessivel
                )}

                ${criarCard(
                    "🚻",
                    "Banheiro acessível",
                    dados.banheiro_acessivel
                )}

                ${criarCard(
                    "🅿️",
                    "Estacionamento acessível",
                    dados.estacionamento_acessivel
                )}

                ${criarCard(
                    "🪑",
                    "Assentos acessíveis",
                    dados.assentos_acessiveis
                )}

                ${criarCard(
                    "↗️",
                    "Rampa",
                    dados.rampa
                )}

                ${criarCard(
                    "🛗",
                    "Elevador",
                    dados.elevador
                )}

                ${criarCard(
                    "👁️",
                    "Piso tátil",
                    dados.piso_tatil
                )}

                <div class="legenda-status">

                    <div>
                        <span class="bolinha bolinha-verde"></span>
                        Disponível
                    </div>

                    <div>
                        <span class="bolinha bolinha-vermelha"></span>
                        Não disponível
                    </div>

                    <div>
                        <span class="bolinha bolinha-branca"></span>
                        Não informado
                    </div>

                </div>

                <div class="fonte-informacao">
                    Fonte: Google Places.
                    Alguns dados podem estar indisponíveis.
                </div>

            </div>
        `;

    } catch (erro) {
        console.error("Erro na acessibilidade:", erro);

        if (numeroSelecao === selecaoAtual) {
            dadosLocal.innerHTML = `
                <div class="local-detalhes">
                    <h3 class="nome-local">${nome}</h3>
                    <p class="endereco-local">${endereco}</p>

                    <p class="mensagem-inicial">
                        Não foi possível consultar
                        a acessibilidade deste local.
                    </p>
                </div>
            `;
        }
    }
}


// =========================================
// EVENTOS
// =========================================

botaoPesquisar.addEventListener(
    "click",
    pesquisarLocais
);

campoPesquisa.addEventListener(
    "keydown",
    evento => {
        if (evento.key === "Enter") {
            pesquisarLocais();
        }
    }
);


// =========================================
// FECHAR POP-UP DA IA
// =========================================

const fecharAgente = document.getElementById("fechar-agente");

if (fecharAgente) {
    fecharAgente.addEventListener("click", () => {
        document.querySelector(".agente-ia").open = false;
    });
}
