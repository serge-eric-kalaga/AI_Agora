"""Point d'entrée ASGI utilisé par Uvicorn et les conteneurs."""

from api import create_app

app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("run:app", host="0.0.0.0", port=8000, reload=True)
