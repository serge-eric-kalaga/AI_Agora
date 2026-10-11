# from sqlalchemy_utils import create_database, database_exists
# from api.database import engine
from api import createApp, SETTINGS


import os


log_dir_file = f"{os.getcwd()}/logs/app.log"
static_dir = f"{os.getcwd()}/static"
if not os.path.exists(static_dir):
    os.makedirs(static_dir)
if not os.path.exists(f"{os.getcwd()}/logs"):
    os.makedirs(f"{os.getcwd()}/logs")
with open(log_dir_file, "w") as f:
    f.write("")


app = createApp(SETTINGS())

if __name__ == "__main___":
    import uvicorn

    uvicorn.run(
        app, port=80, host="0.0.0.0"
    )  # , proxy_headers=True)#, root_path="/backend_template" )
