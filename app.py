from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles

from pathlib import Path

import asyncio
import json
import httpx

from config import MAP_PROVIDER, GOOGLE_PLACES_API_KEY, GOOGLE_MAPS_BROWSER_KEY

from services.google_places import (
    pesquisar_google,
    consultar_acessibilidade_google
)


# =========================================================
# CONFIGURAÇÃO
# =========================================================

app = FastAPI()

BASE_DIR = Path(__file__).resolve().parent


templates = Jinja2Templates(
    directory=BASE_DIR / "templates"
)


app.mount(
    "/static",
    StaticFiles(
        directory=BASE_DIR / "static"
    ),
    name="static"
)


BRASILIA_LAT = -15.793889
BRASILIA_LON = -47.882778


HEADERS = {
    "User-Agent": "AcessaMap/1.0 projeto educacional"
}


# =========================================================
# JSON DO ACESSAMAP
# =========================================================

def carregar_locais():

    caminho = (
        BASE_DIR
        / "data"
        / "locais.json"
    )

    with open(
        caminho,
        "r",
        encoding="utf-8"
    ) as arquivo:

        return json.load(arquivo)


# =========================================================
# CONVERTER TAGS DE ACESSIBILIDADE
# =========================================================

def converter_sim_nao(valor):

    if valor is None:
        return None


    valor = str(valor).lower()


    if valor in [
        "yes",
        "designated"
    ]:
        return True


    if valor == "no":
        return False


    return None


# =========================================================
# ACESSIBILIDADE
# =========================================================

def extrair_acessibilidade(tags):

    tags = tags or {}


    entrada = converter_sim_nao(
        tags.get("wheelchair")
    )


    banheiro = converter_sim_nao(
        tags.get("toilets:wheelchair")
    )


    rampa = converter_sim_nao(

        tags.get("ramp:wheelchair")

        or

        tags.get("ramp")

    )


    elevador = converter_sim_nao(
        tags.get("elevator")
    )


    piso_tatil = converter_sim_nao(
        tags.get("tactile_paving")
    )


    return {

        "entrada_acessivel":
            entrada,

        "rampa":
            rampa,

        "elevador":
            elevador,

        "banheiro_acessivel":
            banheiro,

        "piso_tatil":
            piso_tatil

    }


# =========================================================
# BUSCA PELO NOMINATIM
# =========================================================

async def buscar_nominatim(
    client,
    pesquisa
):

    try:

        resposta = await client.get(

            "https://nominatim.openstreetmap.org/search",

            params={

                "q":
                    f"{pesquisa}, Distrito Federal, Brasil",

                "format":
                    "jsonv2",

                "addressdetails":
                    1,

                "extratags":
                    1,

                "namedetails":
                    1,

                "limit":
                    20,

                "countrycodes":
                    "br"
            },

            headers=HEADERS,

            timeout=7.0
        )


        if resposta.status_code != 200:
            return []


        dados = resposta.json()


    except Exception:

        return []


    locais = []


    for item in dados:

        endereco = (
            item.get("address", {})
            or {}
        )


        estado = endereco.get(
            "state",
            ""
        )


        display_name = item.get(
            "display_name",
            ""
        )


        # Evitar resultados fora do DF
        if (
            "Distrito Federal" not in estado

            and

            "Distrito Federal"
            not in display_name

            and

            "Brasília"
            not in display_name

            and

            "Brasilia"
            not in display_name
        ):

            continue


        extras = (
            item.get("extratags", {})
            or {}
        )


        nomes = (
            item.get("namedetails", {})
            or {}
        )


        nome = (

            nomes.get("name")

            or

            item.get("name")

            or

            pesquisa
        )


        locais.append({

            "id":
                (
                    f"{item.get('osm_type')}-"
                    f"{item.get('osm_id')}"
                ),

            "osm_id":
                item.get("osm_id"),

            "osm_type":
                item.get("osm_type"),

            "nome":
                nome,

            "endereco":
                display_name,

            "latitude":
                float(item["lat"]),

            "longitude":
                float(item["lon"]),

            "tipo":
                item.get("type"),

            "categoria":
                item.get("category"),

            "acessibilidade":
                extrair_acessibilidade(
                    extras
                ),

            "fonte":
                "OpenStreetMap"
        })


    return locais


# =========================================================
# BUSCA PELO PHOTON
# Complementa o Nominatim e ajuda com erros de digitação
# =========================================================

async def buscar_photon(
    client,
    pesquisa
):

    try:

        resposta = await client.get(

            "https://photon.komoot.io/api",

            params={

                "q":
                    pesquisa,

                "lat":
                    BRASILIA_LAT,

                "lon":
                    BRASILIA_LON,

                "zoom":
                    10,

                "location_bias_scale":
                    0.1,

                "limit":
                    20,

                "lang":
                    "pt",

                # Área aproximada do DF
                "bbox":
                    "-48.30,-16.10,-47.25,-15.45"
            },

            timeout=4.0
        )


        if resposta.status_code != 200:
            return []


        dados = resposta.json()


    except Exception:

        return []


    locais = []


    for feature in dados.get(
        "features",
        []
    ):

        propriedades = (
            feature.get(
                "properties",
                {}
            )
            or {}
        )


        geometria = (
            feature.get(
                "geometry",
                {}
            )
            or {}
        )


        coordenadas = geometria.get(
            "coordinates",
            []
        )


        if len(coordenadas) < 2:
            continue


        longitude = float(
            coordenadas[0]
        )

        latitude = float(
            coordenadas[1]
        )


        nome = propriedades.get(
            "name"
        )


        if not nome:
            continue


        osm_id = propriedades.get(
            "osm_id"
        )


        osm_type = propriedades.get(
            "osm_type"
        )


        # Montar endereço
        partes = []


        rua = propriedades.get(
            "street"
        )


        numero = propriedades.get(
            "housenumber"
        )


        if rua:

            if numero:
                partes.append(
                    f"{rua}, {numero}"
                )

            else:
                partes.append(
                    rua
                )


        bairro = (

            propriedades.get(
                "district"
            )

            or

            propriedades.get(
                "locality"
            )

        )


        if bairro:
            partes.append(
                bairro
            )


        cidade = propriedades.get(
            "city"
        )


        if cidade:
            partes.append(
                cidade
            )


        estado = propriedades.get(
            "state"
        )


        if estado:
            partes.append(
                estado
            )


        endereco = ", ".join(
            dict.fromkeys(partes)
        )


        locais.append({

            "id":
                f"{osm_type}-{osm_id}",

            "osm_id":
                osm_id,

            "osm_type":
                osm_type,

            "nome":
                nome,

            "endereco":
                endereco,

            "latitude":
                latitude,

            "longitude":
                longitude,

            "tipo":
                propriedades.get(
                    "osm_value"
                ),

            "categoria":
                propriedades.get(
                    "osm_key"
                ),

            # Photon ajuda principalmente
            # a encontrar o lugar.
            # Acessibilidade fica desconhecida
            # quando ele não fornece tags.
            "acessibilidade": {

                "entrada_acessivel":
                    None,

                "rampa":
                    None,

                "elevador":
                    None,

                "banheiro_acessivel":
                    None,

                "piso_tatil":
                    None
            },

            "fonte":
                "OpenStreetMap"
        })


    return locais


# =========================================================
# JUNTAR RESULTADOS
# =========================================================

def juntar_resultados(
    nominatim,
    photon
):

    resultado = {}



    # Nominatim entra primeiro porque
    # possui mais dados de acessibilidade
    for local in nominatim:

        resultado[
            local["id"]
        ] = local


    # Photon adiciona os locais que
    # Nominatim não encontrou
    for local in photon:

        chave = local["id"]


        if chave not in resultado:

            resultado[
                chave
            ] = local


    return list(
        resultado.values()
    )[:30]


# =========================================================
# TELA INICIAL
# =========================================================

@app.get(
    "/",
    response_class=HTMLResponse
)
def inicio(
    request: Request
):

    return templates.TemplateResponse(

        request=request,

        name="index.html",

        context={}
    )


# =========================================================
# TELA DO MAPA
# =========================================================

@app.get(
    "/mapa",
    response_class=HTMLResponse
)
def pagina_mapa(

    request: Request,

    perfil: list[str] = Query(
        default=[]
    )

):

    perfis_validos = [
        "cadeirante",
        "cego",
        "tea"
    ]


    if len(perfil) == 0:

        raise HTTPException(

            status_code=400,

            detail=(
                "Selecione pelo menos "
                "uma necessidade"
            )
        )


    for item in perfil:

        if item not in perfis_validos:

            raise HTTPException(

                status_code=400,

                detail="Perfil inválido"
            )


    return templates.TemplateResponse(
    request=request,
    name="mapa.html",
    context={
        "perfis": perfil,
        "chave_mapa": GOOGLE_MAPS_BROWSER_KEY
    }
)


# =========================================================
# API DO JSON
# =========================================================

@app.get(
    "/api/locais"
)
def listar_locais():

    return carregar_locais()


@app.get(
    "/api/local/{id}"
)
def buscar_local(
    id: int
):

    locais = carregar_locais()


    for local in locais:

        if local["id"] == id:
            return local


    raise HTTPException(

        status_code=404,

        detail="Local não encontrado"
    )


# =========================================================
# PESQUISA
# =========================================================

@app.get(
    "/api/buscar-locais"
)
async def buscar_locais(

    q: str = Query(
        ...,
        min_length=2
    )

):

    pesquisa = q.strip()


    async with httpx.AsyncClient() as client:

        # As duas pesquisas acontecem
        # simultaneamente.
        resultado_nominatim, resultado_photon = (
            await asyncio.gather(

                buscar_nominatim(
                    client,
                    pesquisa
                ),

                buscar_photon(
                    client,
                    pesquisa
                )
            )
        )


    return juntar_resultados(

        resultado_nominatim,

        resultado_photon
    )


# =========================================================
# STATUS DAS APIS
# =========================================================

@app.get("/api/status")
def status_apis():

    return {
        "projeto": "AcessaMap",
        "provedor": MAP_PROVIDER,
        "google_configurado": bool(GOOGLE_PLACES_API_KEY),
        "google_ativo": (
            MAP_PROVIDER == "google"
            and bool(GOOGLE_PLACES_API_KEY)
        )
    }


# =========================================================
# VERIFICAR SE O GOOGLE ESTÁ ATIVO
# =========================================================

def verificar_google():

    if MAP_PROVIDER != "google":
        raise HTTPException(
            status_code=503,
            detail="Google Places ainda não ativado"
        )

    if not GOOGLE_PLACES_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Chave da API do Google não configurada"
        )


# =========================================================
# PESQUISA DO GOOGLE PLACES
# =========================================================

@app.get("/api/google/buscar-locais")
async def buscar_locais_google(
    q: str = Query(..., min_length=2, max_length=120)
):

    verificar_google()

    try:
        resultados = await pesquisar_google(q.strip())

    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail="Falha na consulta ao Google Places"
        )

    locais = []

    for lugar in resultados:

        localizacao = lugar.get("location", {})

        place_id = lugar.get("id")

        if not place_id:
            continue

        locais.append({
            "id": f"google-{place_id}",

            "google_place_id": place_id,

            "nome": lugar.get(
                "displayName", {}
            ).get("text", "Local sem nome"),

            "endereco": lugar.get(
                "formattedAddress",
                "Endereço não informado"
            ),

            "latitude": localizacao.get("latitude"),

            "longitude": localizacao.get("longitude"),

            "tipo": lugar.get("primaryType"),

            "fonte": "Google Places",

            "acessibilidade": {
                "entrada_acessivel": None,
                "rampa": None,
                "elevador": None,
                "banheiro_acessivel": None,
                "piso_tatil": None
            }
        })

    return locais


# =========================================================
# DETALHES DE ACESSIBILIDADE GOOGLE
# =========================================================

@app.get(
    "/api/google/local/{place_id}/acessibilidade"
)
async def acessibilidade_google(place_id: str):

    verificar_google()

    try:
        resultado = await consultar_acessibilidade_google(
            place_id
        )

        return resultado

    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail="Falha ao consultar acessibilidade"
        )



@app.get("/mapa-google", response_class=HTMLResponse)
def pagina_mapa_google(
    request: Request,
    perfil: list[str] = Query(default=[])
):
    return templates.TemplateResponse(
        request=request,
        name="mapa_google.html",
        context={
            "perfis": perfil,
            "chave_mapa": GOOGLE_MAPS_BROWSER_KEY
        }
    )


# =========================================================
# EXECUTAR
# =========================================================

if __name__ == "__main__":

    import uvicorn


    uvicorn.run(

        "app:app",

        host="127.0.0.1",

        port=8000,

        reload=True
    )