// ======================================================
// ACESSAMAP - MAIN.JS
// ======================================================


// ======================================================
// MAPA
// ======================================================

const mapa = L.map("mapa").setView(
    [-15.793889, -47.882778],
    11
);


L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        attribution: "&copy; OpenStreetMap contributors"
    }
).addTo(mapa);


// ======================================================
// VARIÁVEIS
// ======================================================

let locaisEncontrados = [];
let marcadores = [];
let localSelecionado = null;


// ======================================================
// ELEMENTOS DA TELA
// ======================================================

const campoPesquisa =
    document.getElementById("campo-pesquisa");

const botaoPesquisar =
    document.getElementById("botao-pesquisar");

const dadosLocal =
    document.getElementById("dados-local");


// ======================================================
// PROTEGER TEXTO RECEBIDO DA API
// ======================================================

function escaparHTML(texto) {

    if (
        texto === null ||
        texto === undefined
    ) {
        return "";
    }

    return String(texto)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// ======================================================
// PESQUISAR LOCAIS
// ======================================================

async function pesquisarLocais() {

    const pesquisa =
        campoPesquisa.value.trim();


    if (pesquisa.length < 2) {

        alert(
            "Digite pelo menos 2 caracteres."
        );

        return;
    }


    botaoPesquisar.disabled = true;
    botaoPesquisar.textContent = "Buscando...";

    localSelecionado = null;


    dadosLocal.innerHTML = `
        <div class="estado-painel">
            <div class="carregando"></div>

            <p>
                Pesquisando locais...
            </p>
        </div>
    `;


    try {

        const resposta = await fetch(
            `/api/buscar-locais?q=${encodeURIComponent(pesquisa)}`
        );


        if (!resposta.ok) {

            throw new Error(
                "Erro ao pesquisar locais"
            );
        }


        const dados =
            await resposta.json();


        // ----------------------------------------------
        // REMOVER POSSÍVEIS DUPLICADOS
        // ----------------------------------------------

        const ids = new Set();


        locaisEncontrados =
            dados.filter(local => {

                if (ids.has(local.id)) {
                    return false;
                }

                ids.add(local.id);

                return true;
            });


        // ----------------------------------------------
        // NENHUM RESULTADO
        // ----------------------------------------------

        if (
            locaisEncontrados.length === 0
        ) {

            limparMarcadores();


            dadosLocal.innerHTML = `
                <div class="estado-painel">

                    <span class="estado-icone">
                        📍
                    </span>

                    <p>
                        Nenhum local encontrado
                        no Distrito Federal.
                    </p>

                </div>
            `;

            return;
        }


        // ----------------------------------------------
        // MOSTRAR RESULTADOS
        // ----------------------------------------------

        mostrarLocais(
            locaisEncontrados
        );


        dadosLocal.innerHTML = `
            <div class="resultado-pesquisa">

                <strong>
                    ${locaisEncontrados.length}
                    resultado(s) encontrado(s)
                </strong>

                <span>
                    Clique em um marcador do mapa
                    para visualizar as informações
                    de acessibilidade.
                </span>

            </div>
        `;


    } catch (erro) {

        console.error(
            "Erro na pesquisa:",
            erro
        );


        limparMarcadores();


        dadosLocal.innerHTML = `
            <div class="estado-painel">

                <span class="estado-icone">
                    ⚠️
                </span>

                <p>
                    Não foi possível realizar
                    a pesquisa.
                </p>

            </div>
        `;


    } finally {

        botaoPesquisar.disabled = false;
        botaoPesquisar.textContent = "Buscar";
    }
}


// ======================================================
// MOSTRAR LOCAIS NO MAPA
// ======================================================

function mostrarLocais(locais) {

    limparMarcadores();


    if (locais.length === 0) {
        return;
    }


    const grupoMarcadores =
        L.featureGroup();


    locais.forEach(local => {

        const latitude =
            Number(local.latitude);

        const longitude =
            Number(local.longitude);


        if (
            Number.isNaN(latitude) ||
            Number.isNaN(longitude)
        ) {
            return;
        }


        const marcador =
            L.marker([
                latitude,
                longitude
            ]);


        marcador.addTo(mapa);

        grupoMarcadores.addLayer(
            marcador
        );


        // Nome ao passar o mouse
        marcador.bindTooltip(
            escaparHTML(local.nome),
            {
                direction: "top",
                offset: [0, -8]
            }
        );


        // Clique no marcador
        marcador.on(
            "click",
            () => {

                mostrarInformacoes(
                    local
                );

            }
        );


        marcadores.push(
            marcador
        );
    });


    // Ajusta mapa aos resultados
    if (marcadores.length > 0) {

        mapa.fitBounds(
            grupoMarcadores.getBounds(),
            {
                padding: [45, 45],
                maxZoom: 16
            }
        );
    }
}


// ======================================================
// LIMPAR MARCADORES
// ======================================================

function limparMarcadores() {

    marcadores.forEach(
        marcador => {

            mapa.removeLayer(
                marcador
            );

        }
    );


    marcadores = [];
}


// ======================================================
// CARD DE ACESSIBILIDADE
// ======================================================

function criarInformacao(
    icone,
    titulo,
    valor
) {

    // ==================================================
    // SIM
    // ==================================================

    if (valor === true) {

        return `
            <div class="
                acessibilidade-card
                acessibilidade-sim
            ">

                <div class="acessibilidade-icone">
                    ${icone}
                </div>


                <div class="acessibilidade-texto">

                    <strong>
                        ${titulo}
                    </strong>

                    <span>
                        Disponível
                    </span>

                </div>


                <div
                    class="acessibilidade-status"
                    title="Disponível"
                >
                    ✓
                </div>

            </div>
        `;
    }


    // ==================================================
    // NÃO
    // ==================================================

    if (valor === false) {

        return `
            <div class="
                acessibilidade-card
                acessibilidade-nao
            ">

                <div class="acessibilidade-icone">
                    ${icone}
                </div>


                <div class="acessibilidade-texto">

                    <strong>
                        ${titulo}
                    </strong>

                    <span>
                        Não disponível
                    </span>

                </div>


                <div
                    class="acessibilidade-status"
                    title="Não disponível"
                >
                    ✕
                </div>

            </div>
        `;
    }


    // ==================================================
    // NÃO INFORMADO
    // ==================================================

    return `
        <div class="
            acessibilidade-card
            acessibilidade-desconhecido
        ">

            <div class="acessibilidade-icone">
                ${icone}
            </div>


            <div class="acessibilidade-texto">

                <strong>
                    ${titulo}
                </strong>

                <span>
                    Não informado
                </span>

            </div>


            <div
                class="acessibilidade-status"
                title="Não informado"
            >
                ?
            </div>

        </div>
    `;
}


// ======================================================
// MOSTRAR TODAS AS INFORMAÇÕES DO LOCAL
// ======================================================

function mostrarInformacoes(local) {

    localSelecionado =
        local;


    const acessibilidade =
        local.acessibilidade || {};


    dadosLocal.innerHTML = `

        <div class="local-detalhes">


            <!-- NOME -->
            <div class="local-cabecalho">

                <span class="local-pin">
                    📍
                </span>

                <div>

                    <h3 class="nome-local">

                        ${escaparHTML(
                            local.nome ||
                            "Local"
                        )}

                    </h3>

                    <span class="local-tipo">

                        ${escaparHTML(
                            local.tipo ||
                            "Estabelecimento"
                        )}

                    </span>

                </div>

            </div>


            <!-- ENDEREÇO -->
            <p class="endereco-local">

                ${escaparHTML(
                    local.endereco ||
                    "Endereço não informado"
                )}

            </p>


            <!-- TÍTULO -->
            <div class="titulo-acessibilidade">

                <strong>
                    Acessibilidade
                </strong>

                <span>
                    Informações disponíveis sobre este local
                </span>

            </div>


            <!-- ENTRADA ACESSÍVEL -->
            ${criarInformacao(

                "♿",

                "Entrada acessível",

                acessibilidade
                    .entrada_acessivel

            )}


            <!-- RAMPA -->
            ${criarInformacao(

                "↗",

                "Rampa de acesso",

                acessibilidade
                    .rampa

            )}


            <!-- ELEVADOR -->
            ${criarInformacao(

                "🛗",

                "Elevador",

                acessibilidade
                    .elevador

            )}


            <!-- BANHEIRO -->
            ${criarInformacao(

                "🚻",

                "Banheiro acessível",

                acessibilidade
                    .banheiro_acessivel

            )}


            <!-- PISO TÁTIL -->
            ${criarInformacao(

                "👁",

                "Piso tátil",

                acessibilidade
                    .piso_tatil

            )}


            <!-- LEGENDA -->
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


            <!-- FONTE -->
            <div class="fonte-informacao">

                Fonte dos dados:

                <strong>
                    ${escaparHTML(
                        local.fonte ||
                        "OpenStreetMap"
                    )}
                </strong>

            </div>

        </div>
    `;
}


// ======================================================
// EVENTOS
// ======================================================


// Botão Buscar
botaoPesquisar.addEventListener(
    "click",
    pesquisarLocais
);


// Enter no campo
campoPesquisa.addEventListener(
    "keydown",
    evento => {

        if (evento.key === "Enter") {

            pesquisarLocais();
        }

    }
);