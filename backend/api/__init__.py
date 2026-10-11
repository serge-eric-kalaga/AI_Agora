from api.configs import SETTINGS
from pydantic_settings import BaseSettings
from fastapi import FastAPI


def createApp(config: SETTINGS) -> FastAPI:
    from api.configs.config import Setting
    import werkzeug.exceptions as werkexcept
    from fastapi import Request, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.exceptions import RequestValidationError
    from fastapi.responses import JSONResponse, StreamingResponse
    from starlette.exceptions import HTTPException as starletteHTTPException
    from api.services.mail import send_app_exception_to_admin

    from api.services import socket
    from api.utility.lifespan import LifeSpan
    from api.configs.logging import logDebug, logInfo, logError
    from api.views import user_router, auth_router, healthcheck_router

    Setting = config
    app = FastAPI(
        title=Setting.APP_NAME,
        lifespan=LifeSpan,
    )
    app.include_router(auth_router, prefix="/api/v1/auth")
    app.include_router(user_router, prefix="/api/v1/user")
    app.include_router(healthcheck_router, prefix="/api/v1/healthcheck")

    # ----PROMETHEUS------
    from prometheus_fastapi_instrumentator import Instrumentator

    Instrumentator().instrument(app, metric_namespace="api").expose(app, tags=["OTHER"])

    # ----mount socket------
    sm = socket.socketio.ASGIApp(socket.server, socketio_path="socket.io")
    app.mount("/ws", sm)
    app.sio = socket.server

    # ------get request from any webpage---------
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # --------add logger for each an every request--------
    @app.middleware("http")
    async def loggingRequest(request: Request, call_next):

        do_not_log = False
        if request.url.path not in [
            "/api/v1/healthcheck/",
            "/metrics",
            "/ws/socket.io/",
        ]:
            do_not_log = True

        if not do_not_log:
            logDebug(
                "-------------------------------------------------------------------------"
            )
            logInfo(f"{request.method}, {request.url}, {request.client.host}")
        response: StreamingResponse = await call_next(request)

        if not do_not_log:
            logInfo(f"{response.status_code}")
        return response

    @app.exception_handler(werkexcept.HTTPException)
    def handleWerkZeugException(req, exc):
        logError(exc)
        if exc.status_code == 500:
            send_app_exception_to_admin(
                error_message=exc,
                error_type="Internal Server Error",
            )
        return JSONResponse(
            content={
                "status": -1,
                "status_code": exc.code,
                "message": f"{exc.description}",
            },
            status_code=exc.code,
        )

    @app.exception_handler(HTTPException)
    def handleHTTPException(req, exc):
        logError(exc)
        if exc.status_code == 500:
            send_app_exception_to_admin(
                error_message=exc,
                error_type="Internal Server Error",
            )
        return JSONResponse(
            content={
                "status": -1,
                "status_code": exc.status_code,
                "message": f"{exc.detail}",
            },
            status_code=exc.status_code,
        )

    @app.exception_handler(RequestValidationError)
    def handleValidationErrorException(req, exc):
        logError(exc)
        return JSONResponse(
            content={"status": -1, "status_code": 400, "message": f"{exc}"},
            status_code=400,
        )

    @app.exception_handler(starletteHTTPException)
    def handleStarletteException(req, exc):
        logError(exc)
        if exc.status_code == 500:
            send_app_exception_to_admin(
                error_message=exc,
                error_type="Internal Server Error",
            )
        return JSONResponse(
            content={
                "status": -1,
                "status_code": exc.status_code,
                "message": f"{exc.detail}",
            },
            status_code=exc.status_code,
        )

    @app.exception_handler(Exception)
    def handleException(req, exc):
        logError(exc)
        send_app_exception_to_admin(
            error_message=exc,
            error_type="Internal Server Error",
        )
        return JSONResponse(
            content={"status": -1, "status_code": 500, "message": f"{exc}"},
            status_code=500,
        )

    # ----------------init db------------------
    from api.database import init_database, engine

    init_database(engine)
    return app
