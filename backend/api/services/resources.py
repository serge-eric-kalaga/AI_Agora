"""Lecture bornée de documents et consultation de sources publiques avec DNS épinglé."""

import hashlib
import ipaddress
import re
import socket
from html.parser import HTMLParser
from io import BytesIO
from urllib.parse import urljoin

import httpx
from pypdf import PdfReader
from sqlalchemy.orm import Session

from api.database.models import AgentDefinition, Room
from api.errors import DomainError

MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_SOURCE_BYTES = 1024 * 1024
MAX_TEXT_CHARACTERS = 200_000


def extract_document(data: bytes, filename: str) -> str:
    if len(data) > MAX_FILE_BYTES:
        raise DomainError("document_too_large", "Le document dépasse 5 Mo.", 413)
    if filename.casefold().endswith(".pdf"):
        try:
            if not data.startswith(b"%PDF-"):
                raise ValueError("Signature PDF invalide")
            reader = PdfReader(BytesIO(data), strict=True)
            if reader.is_encrypted or len(reader.pages) > 100:
                raise ValueError("PDF chiffré ou trop long")
            chunks: list[str] = []
            size = 0
            for page in reader.pages:
                # Les contenus décompressés peuvent être beaucoup plus grands que le fichier.
                stream = page.get_contents()
                if stream and len(stream.get_data()) > 2 * 1024 * 1024:
                    raise ValueError("Page trop complexe")
                text = page.extract_text() or ""
                size += len(text)
                if size > MAX_TEXT_CHARACTERS:
                    raise ValueError("Texte trop long")
                chunks.append(text)
            content = "\n\n".join(chunks)
        except Exception as exc:
            raise DomainError(
                "invalid_pdf",
                "Le PDF doit contenir du texte lisible, ne pas être chiffré et comporter au plus 100 pages.",
                422,
            ) from exc
    elif filename.casefold().endswith((".txt", ".md")):
        try:
            content = data.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise DomainError(
                "invalid_text_encoding", "Le texte doit être encodé en UTF-8.", 422
            ) from exc
    else:
        raise DomainError(
            "unsupported_document", "Choisissez un fichier PDF, TXT ou Markdown.", 422
        )
    content = content.replace("\x00", "").strip()
    if not content or len(content) > MAX_TEXT_CHARACTERS:
        raise DomainError(
            "invalid_document_text",
            "Le document doit contenir entre 1 et 200 000 caractères lisibles ; les PDF scannés nécessitent une transcription.",
            422,
        )
    return content


class VisibleText(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.hidden = 0
        self.parts: list[str] = []
        self.title_parts: list[str] = []
        self.in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "noscript", "svg"}:
            self.hidden += 1
        if tag == "title":
            self.in_title = True

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript", "svg"}:
            self.hidden = max(0, self.hidden - 1)
        if tag == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if not self.hidden:
            if self.in_title:
                self.title_parts.append(data)
            elif data.strip():
                self.parts.append(data.strip())


def public_destination(raw: str) -> tuple[httpx.URL, str]:
    """Résout une fois et rejette toute réponse DNS contenant une adresse privée."""
    try:
        if len(raw) > 2000:
            raise ValueError("URL trop longue")
        url = httpx.URL(raw)
        if (
            url.scheme not in {"http", "https"}
            or not url.host
            or url.userinfo
            or url.port not in {None, 80, 443}
        ):
            raise ValueError("URL invalide")
        addresses = sorted(
            {
                str(row[4][0])
                for row in socket.getaddrinfo(
                    url.host,
                    url.port or (443 if url.scheme == "https" else 80),
                    type=socket.SOCK_STREAM,
                )
            }
        )
        if not addresses or any(
            not ipaddress.ip_address(address).is_global for address in addresses
        ):
            raise ValueError("Adresse non publique")
        return url, addresses[0]
    except (ValueError, socket.gaierror, httpx.InvalidURL) as exc:
        raise DomainError(
            "unsafe_source_url",
            "La source doit utiliser une URL publique HTTP ou HTTPS sur un port standard, sans identifiants.",
            422,
        ) from exc


def fetch_source(raw: str) -> tuple[str, str, str]:
    """Épingle l'IP validée et conserve Host/SNI ; revalide chaque redirection."""
    try:
        with httpx.Client(timeout=15, follow_redirects=False, trust_env=False) as client:
            for _ in range(4):
                url, address = public_destination(raw)
                host = url.netloc.decode("ascii")
                pinned = url.copy_with(host=address)
                with client.stream(
                    "GET",
                    pinned,
                    headers={
                        "Host": host,
                        "User-Agent": "AI-Agora/1.0",
                        "Accept": "text/html,text/plain,application/pdf",
                    },
                    extensions={"sni_hostname": url.host},
                ) as response:
                    if response.is_redirect:
                        location = response.headers.get("location")
                        if not location:
                            raise ValueError("Redirection sans destination")
                        raw = urljoin(str(url), location)
                        continue
                    response.raise_for_status()
                    data = bytearray()
                    for chunk in response.iter_bytes():
                        data.extend(chunk)
                        if len(data) > MAX_SOURCE_BYTES:
                            raise DomainError("source_too_large", "La source dépasse 1 Mo.", 413)
                    mime = response.headers.get("content-type", "").split(";")[0]
                    if mime == "application/pdf":
                        text = extract_document(bytes(data), "source.pdf")
                        title = url.host
                    elif mime in {"text/html", "application/xhtml+xml"}:
                        parser = VisibleText()
                        parser.feed(
                            bytes(data).decode(response.encoding or "utf-8", errors="replace")
                        )
                        text = "\n".join(parser.parts)
                        title = " ".join(parser.title_parts) or url.host
                    elif mime == "text/plain":
                        text = bytes(data).decode(response.encoding or "utf-8", errors="replace")
                        title = url.host
                    else:
                        raise DomainError(
                            "unsupported_source",
                            "La source doit être une page HTML, un texte ou un PDF.",
                            422,
                        )
                    if not text.strip() or len(text) > MAX_TEXT_CHARACTERS:
                        raise ValueError("Source vide ou trop longue")
                    return str(url), title[:200], text.replace("\x00", "").strip()
        raise ValueError("Trop de redirections")
    except (httpx.HTTPError, ValueError) as exc:
        raise DomainError(
            "source_unreachable",
            "La source n'a pas pu être consultée. Vérifiez son adresse ou importez son texte.",
            422,
        ) from exc


def resource_digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def relevant_excerpt(content: str, query: str, limit: int = 1500) -> str:
    """Classe les paragraphes sans embeddings ni appel supplémentaire au modèle."""
    words = {word for word in re.findall(r"\w+", query.casefold()) if len(word) > 3}
    paragraphs = [content[index : index + 700] for index in range(0, len(content), 700)]
    ranked = sorted(
        enumerate(paragraphs),
        key=lambda pair: (-sum(word in pair[1].casefold() for word in words), pair[0]),
    )
    return "\n[…]\n".join(part for _, part in sorted(ranked[:2]))[:limit]


def resource_context(
    db: Session, room: Room, agent: AgentDefinition, query: str
) -> tuple[list[dict[str, str]], dict[str, str]]:
    """Les outils autorisés par le profil ET la salle définissent les données accessibles."""
    from sqlalchemy import select

    from api.database.models import RoomResource

    allowed = set(room.tools) & set(agent.tools)
    kinds = (["document"] if "files" in allowed else []) + (["source"] if "web" in allowed else [])
    if not kinds:
        return [], {}
    resources = db.scalars(
        select(RoomResource)
        .where(RoomResource.room_id == room.id, RoomResource.kind.in_(kinds))
        .order_by(RoomResource.created_at.desc())
        .limit(20)
    ).all()
    words = {word for word in re.findall(r"\w+", query.casefold()) if len(word) > 3}
    ranked = sorted(
        resources, key=lambda resource: -sum(word in resource.content.casefold() for word in words)
    )[:3]
    entries: list[dict[str, str]] = []
    links: dict[str, str] = {}
    for index, resource in enumerate(ranked, 1):
        label = f"S{index}"
        links[label] = (
            f"/api/backend/workspaces/{room.workspace_id}/rooms/{room.id}/resources/{resource.id}/download"
        )
        entries.append(
            {
                "reference": f"[{label}]",
                "titre": resource.title,
                "url": resource.url or "Document joint",
                "consulte_le": resource.created_at.isoformat(),
                "extrait": relevant_excerpt(resource.content, query),
            }
        )
    return entries, links


def resolve_citations(content: str, links: dict[str, str]) -> str:
    """Lier uniquement les identifiants de source effectivement fournis à ce tour."""

    def citation(match: re.Match[str]) -> str:
        label = match.group(1)
        return f"[{label}]({links[label]})" if label in links else ""

    return re.sub(r"\[(S\d+)\](?:\([^\n)]*\))?", citation, content)
