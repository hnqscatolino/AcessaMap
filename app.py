from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
import json

app = FastAPI()

templates = Jinja2Templates(directory="templates")

app.mount(
    "/static",
    StaticFiles(directory="static"),
    name="static"
)


def carregar_locais():
    with open(
        "data/locais.json",
        "r",
        encoding="utf-8"
    ) as arquivo:

        return json.load(arquivo)


# TELA DE ENTRADA
@app.get("/", response_class=HTMLResponse)
def inicio(request: Request):

    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={}
    )


# TELA PRINCIPAL
@app.get("/mapa", response_class=HTMLResponse)
def pagina_mapa(
    request: Request,
    perfil: list[str] = Query(default=[])
):

    perfis_validos = [
        "cadeirante",
        "cego",
        "tea"
    ]

    if len(perfil) == 0:
        raise HTTPException(
            status_code=400,
            detail="Selecione pelo menos uma necessidade"
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
            "perfis": perfil
        }
    )


@app.get("/api/locais")
def listar_locais():
    return carregar_locais()


@app.get("/api/local/{id}")
def buscar_local(id: int):

    locais = carregar_locais()

    for local in locais:

        if local["id"] == id:
            return local

    raise HTTPException(
        status_code=404,
        detail="Local não encontrado"
    )


if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        "app:app",
        host="127.0.0.1",
        port=8000,
        reload=True
    )