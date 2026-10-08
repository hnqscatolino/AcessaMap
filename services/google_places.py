import httpx
from urllib.parse import quote

from config import GOOGLE_PLACES_API_KEY


BASE_URL = "https://places.googleapis.com/v1"


def criar_headers(campos):
    if not GOOGLE_PLACES_API_KEY:
        raise RuntimeError(
            "Chave da Google Places API não configurada"
        )

    return {
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": campos,
        "Content-Type": "application/json"
    }


# ==========================================
# PESQUISAR ESTABELECIMENTOS
# ==========================================

async def pesquisar_google(termo):

    headers = criar_headers(
        "places.id,"
        "places.displayName,"
        "places.formattedAddress,"
        "places.location,"
        "places.primaryType"
    )

    dados = {
        "textQuery": f"{termo}, Distrito Federal, Brasil",
        "languageCode": "pt-BR",
        "pageSize": 15
    }

    async with httpx.AsyncClient(timeout=10) as client:

        resposta = await client.post(
            f"{BASE_URL}/places:searchText",
            json=dados,
            headers=headers
        )

        resposta.raise_for_status()

        return resposta.json().get("places", [])


# ==========================================
# CONSULTAR ACESSIBILIDADE
# ==========================================

async def consultar_acessibilidade_google(place_id):

    headers = criar_headers(
        "id,accessibilityOptions"
    )

    place_id_seguro = quote(place_id, safe="")

    async with httpx.AsyncClient(timeout=10) as client:

        resposta = await client.get(
            f"{BASE_URL}/places/{place_id_seguro}",
            headers=headers
        )

        resposta.raise_for_status()

        dados = resposta.json()

    acessibilidade = dados.get(
        "accessibilityOptions", {}
    )

    return {
        "entrada_acessivel": acessibilidade.get(
            "wheelchairAccessibleEntrance"
        ),

        "banheiro_acessivel": acessibilidade.get(
            "wheelchairAccessibleRestroom"
        ),

        "estacionamento_acessivel": acessibilidade.get(
            "wheelchairAccessibleParking"
        ),

        "assentos_acessiveis": acessibilidade.get(
            "wheelchairAccessibleSeating"
        ),

        "rampa": None,
        "elevador": None,
        "piso_tatil": None,

        "fonte": "Google Places"
    }