"""Documents, sources publiques, permissions d'outils et références réelles."""

from io import BytesIO
from uuid import UUID, uuid4

import httpx
import pytest
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject
from sqlalchemy import select

from api.database import SessionLocal
from api.database.models import (
    AgentDefinition,
    ProviderConnection,
    ProviderKind,
    Room,
    User,
)
from api.errors import DomainError
from api.services.resources import (
    extract_document,
    fetch_source,
    public_destination,
    resolve_citations,
    resource_context,
)


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1",
        "http://10.0.0.1",
        "http://169.254.169.254",
        "http://[::1]",
        "file:///etc/passwd",
        "https://login:secret@example.com",
        "https://example.com:8443",
    ],
)
def test_private_or_credentialed_sources_are_rejected(monkeypatch, url):
    monkeypatch.setattr(
        "api.services.resources.socket.getaddrinfo",
        lambda *a, **k: [(0, 0, 0, "", ("127.0.0.1", 443))],
    )
    with pytest.raises(DomainError):
        public_destination(url)


def test_public_source_pins_dns_and_revalidates_redirects(monkeypatch):
    monkeypatch.setattr(
        "api.services.resources.socket.getaddrinfo",
        lambda host, *a, **k: [
            (0, 0, 0, "", ("93.184.216.34" if host == "example.com" else "127.0.0.1", 443))
        ],
    )
    captured = []

    def transport(request):
        captured.append(request)
        assert request.url.host == "93.184.216.34"
        assert request.headers["host"] == "example.com"
        assert request.extensions["sni_hostname"] == "example.com"
        if request.url.path == "/redirect":
            return httpx.Response(302, headers={"location": "http://localhost/private"})
        return httpx.Response(
            200,
            headers={"content-type": "text/html"},
            text="<title>Source test</title><script>secret instruction</script><p>Rendez-vous au parc à neuf heures.</p>",
        )

    original = httpx.Client
    monkeypatch.setattr(
        "api.services.resources.httpx.Client",
        lambda **kw: original(transport=httpx.MockTransport(transport), **kw),
    )
    url, title, content = fetch_source("https://example.com/article")
    assert url == "https://example.com/article" and title == "Source test"
    assert "secret instruction" not in content
    with pytest.raises(DomainError):
        fetch_source("https://example.com/redirect")
    assert len(captured) == 2


def test_pdf_text_is_extracted_and_malformed_pdf_rejected():
    writer = PdfWriter()
    page = writer.add_blank_page(width=200, height=200)
    page[NameObject("/Resources")] = DictionaryObject(
        {
            NameObject("/Font"): DictionaryObject(
                {
                    NameObject("/F1"): DictionaryObject(
                        {
                            NameObject("/Type"): NameObject("/Font"),
                            NameObject("/Subtype"): NameObject("/Type1"),
                            NameObject("/BaseFont"): NameObject("/Helvetica"),
                        }
                    )
                }
            )
        }
    )
    stream = DecodedStreamObject()
    stream.set_data(b"BT /F1 12 Tf 10 10 Td (Rendez-vous dimanche a neuf heures.) Tj ET")
    page[NameObject("/Contents")] = writer._add_object(stream)
    output = BytesIO()
    writer.write(output)
    assert "Rendez-vous dimanche" in extract_document(output.getvalue(), "programme.pdf")
    with pytest.raises(DomainError):
        extract_document(b"not a pdf", "programme.pdf")
    with pytest.raises(DomainError):
        extract_document(b"\xff", "programme.txt")


def test_resources_import_read_dedup_and_effective_permissions(client, account):
    with SessionLocal() as db:
        owner = db.scalar(select(User))
        wid = UUID(account["workspaceId"])
        room = Room(
            workspace_id=wid,
            created_by_id=owner.id,
            name="Sources",
            topic="Promenade",
            budget_limit=5,
            max_duration_minutes=60,
            tools=["files", "web"],
        )
        provider = ProviderConnection(workspace_id=wid, name="Local", kind=ProviderKind.LOCAL)
        db.add_all([room, provider])
        db.flush()
        agent = AgentDefinition(
            workspace_id=wid,
            provider_id=provider.id,
            name="Alice",
            role="Organisatrice",
            model="mini",
            system_prompt="Tu es Alice.",
            tools=[],
        )
        db.add(agent)
        db.commit()
        rid = room.id
        aid = agent.id
    root = f"/api/v1/workspaces/{wid}/rooms/{rid}/resources"
    file = {"file": ("programme.txt", b"Rendez-vous au parc dimanche a neuf heures.", "text/plain")}
    imported = client.post(root + "/documents", headers=account["headers"], files=file)
    assert imported.status_code == 200, imported.text
    resource = imported.json()
    assert (
        client.post(root + "/documents", headers=account["headers"], files=file).json()["id"]
        == resource["id"]
    )
    assert len(client.get(root, headers=account["headers"]).json()["items"]) == 1
    assert (
        client.get(root + "/" + resource["id"], headers=account["headers"])
        .json()["content"]
        .startswith("Rendez-vous")
    )
    assert (
        client.get(root + "/" + resource["id"] + "/download", headers=account["headers"]).content
        == file["file"][1]
    )
    assert client.get(root + "/" + str(uuid4()), headers=account["headers"]).status_code == 404
    other = client.post(
        "/api/v1/auth/register",
        json={
            "email": "lecteur@agora.example.com",
            "username": "lecteur",
            "password": "AutreCompteSecret2026!",
        },
    ).json()
    assert (
        client.get(root, headers={"Authorization": "Bearer " + other["accessToken"]}).status_code
        == 404
    )
    with SessionLocal() as db:
        room = db.get(Room, rid)
        agent = db.get(AgentDefinition, aid)
        assert resource_context(db, room, agent, "rendez-vous")[0] == []
        agent.tools = ["files"]
        db.commit()
        sources, links = resource_context(db, room, agent, "rendez-vous")
        assert sources[0]["reference"] == "[S1]" and "neuf heures" in sources[0]["extrait"]
        assert resource["id"] in links["S1"]
        resolved = resolve_citations("Dimanche [S1], autre [S9].", links)
        assert "[S9]" not in resolved and "/download" in resolved
        room.tools = []
        db.commit()
        assert resource_context(db, room, agent, "rendez-vous")[0] == []
