FROM python:3.14-bookworm

WORKDIR /app

RUN pip install --upgrade pip && pip install uv

COPY pyproject.toml uv.lock ./

# Installer uniquement les dépendances sans construire le projet
RUN uv sync --frozen --no-install-project

# Copier le code source
COPY . .

# Installer le projet maintenant que api/ existe
RUN uv sync --frozen

EXPOSE 80

CMD ["uv", "run", "uvicorn", "run:app", "--host", "0.0.0.0", "--port", "80", "--reload"]