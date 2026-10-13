/* Maquette autonome : aucun appel API ni aucune modification de données réelles. */
const paths = {
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  chat: "M4 4h16v12H9l-5 4z",
  bot: "M5 7h14v13H5zM12 3v4M8 11v3M16 11v3M2 11h3M19 11h3M9 17h6",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20V7",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17 4a4 4 0 0 1 0 7M22 21v-2a4 4 0 0 0-3-4",
  bolt: "m13 2-9 12h7l-1 8 10-12h-7z",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  search: "M21 21l-5-5M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16",
  plus: "M12 5v14M5 12h14",
  arrow: "M4 12h16M14 6l6 6-6 6",
  chevron: "m9 5 7 7-7 7",
  down: "m5 9 7 7 7-7",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z",
  sun: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10M12 1v2M12 21v2M1 12h2M21 12h2M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2",
  moon: "M20 14A9 9 0 0 1 10 4 9 9 0 1 0 20 14z",
  logout: "M9 4H3v16h6M10 12h12M17 7l5 5-5 5",
  file: "M5 3h9l5 5v13H5zM14 3v6h5M8 13h8M8 17h6",
  check: "m5 12 4 4L19 6",
  shield: "M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6zM8 12l3 3 5-6",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  send: "m3 3 19 9-19 9 4-9zM7 12h15",
  reply: "m9 4-6 6 6 6M3 10h11a7 7 0 0 1 7 7",
  clip: "m9 17 8-8a3 3 0 0 0-4-4L4 14a5 5 0 0 0 7 7l10-10",
  pause: "M8 4v16M16 4v16",
  play: "m6 3 15 9-15 9z",
  download: "M12 3v12M7 10l5 5 5-5M4 17v4h16v-4",
  menu: "M3 6h18M3 12h18M3 18h18",
  close: "m6 6 12 12M18 6 6 18",
  orbit:
    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3c-7 7-7 11 0 18 7-7 7-11 0-18",
  filter: "M4 6h16M7 12h10M10 18h4",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v5l3 2",
  spark: "m12 3 2 7 7 2-7 2-2 7-2-7-7-2 7-2z",
  lock: "M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4",
};
const icon = (n) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[n] || paths.grid}"/></svg>`;
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const agents = [
  [
    "Ariane",
    "Architecte de solutions",
    "AR",
    "",
    "Structure les idées, clarifie les choix et transforme une intuition en solution.",
  ],
  [
    "Socrate",
    "Philosophe critique",
    "SO",
    "cyan",
    "Questionne les certitudes et apporte de nouvelles perspectives à la discussion.",
  ],
  [
    "Athéna",
    "Stratège pragmatique",
    "AT",
    "amber",
    "Relie les idées aux décisions. Une voix posée qui fait avancer le collectif.",
  ],
  [
    "Alice",
    "Organisatrice",
    "AL",
    "rose",
    "Rassemble les participants et facilite les échanges avec simplicité.",
  ],
  [
    "Benoît",
    "Explorateur d’idées",
    "BE",
    "blue",
    "Propose des pistes inattendues et nourrit la créativité du groupe.",
  ],
  [
    "Camille",
    "Médiatrice",
    "CA",
    "cyan",
    "Rapproche les points de vue et formule les questions encore ouvertes.",
  ],
];
const rooms = [
  [
    "Imaginer la ville de demain",
    "Mobilité, espaces partagés et qualité de vie.",
    "live",
    "En cours",
    4,
    128,
    "12 min",
    "Urbanisme",
  ],
  [
    "Conseil géopolitique mondial",
    "Comprendre les équilibres et confronter les perspectives.",
    "pause",
    "En pause",
    8,
    61,
    "1 h",
    "Géopolitique",
  ],
  [
    "Guerre en Ukraine",
    "Un dialogue sur les conditions d’une paix durable.",
    "pause",
    "En pause",
    4,
    97,
    "2 h",
    "Diplomatie",
  ],
  [
    "Jésus et les douze disciples",
    "Foi, pardon et amour du prochain.",
    "",
    "Terminée",
    13,
    50,
    "Hier",
    "Spiritualité",
  ],
  [
    "Un repas entre amis",
    "Une discussion libre pour préparer samedi.",
    "live",
    "En cours",
    2,
    18,
    "5 min",
    "Discussion libre",
  ],
  [
    "Le prochain chapitre",
    "Définir ensemble les priorités du projet.",
    "",
    "Terminée",
    3,
    42,
    "Hier",
    "Stratégie",
  ],
];
const titles = {
  dashboard: "Vue d’ensemble",
  rooms: "Conversations",
  agents: "Mes agents",
  editor: "Créer un agent",
  profile: "Profil d’agent",
  wizard: "Créer une conversation",
  chat: "Salle en direct",
  providers: "Fournisseurs IA",
  members: "Collaborateurs",
  notifications: "Notifications",
  analytics: "Statistiques",
  auth: "Connexion",
  system: "Guide visuel",
};
let view = location.hash.slice(1) || "dashboard",
  layout = "grid",
  roomFilter = "Toutes",
  agentFilter = "",
  step = 0,
  editorTab = 0,
  theme = localStorage.getItem("agora-proposal-theme") || "light",
  stateView = "normal",
  unread = true;
const avatar = (a, size = "") =>
  `<span class="avatar ${a[3]} ${size}">${a[2]}</span>`;
const badge = (s = "live", text = "En cours") =>
  `<span class="badge ${s}"><span class="dot"></span>${text}</span>`;
const btn = (label, action, kind = "", ico = "") =>
  `<button class="btn ${kind}" data-action="${action}">${ico ? icon(ico) : ""}${label}</button>`;
const link = (label, to, kind = "", ico = "") =>
  `<a class="btn ${kind}" href="#${to}">${ico ? icon(ico) : ""}${label}</a>`;
const ib = (label, action, ico) =>
  `<button class="btn ghost iconbtn" aria-label="${label}" title="${label}" data-action="${action}">${icon(ico)}</button>`;
const group = (n = 4) =>
  `<div class="avatar-group">${agents
    .slice(0, Math.min(n, 4))
    .map((a) => avatar(a))
    .join(
      "",
    )}${n > 4 ? '<span class="avatar">+' + (n - 4) + "</span>" : ""}</div>`;
const heading = (title, desc, actions = "", eye = "Votre laboratoire") =>
  `<div class="page-heading"><div><p class="eyebrow">${eye}</p><h1>${title}</h1><p>${desc}</p></div><div class="flex">${actions}</div></div>`;
const field = (label, input, hint = "", full = false) =>
  `<label class="field ${full ? "full" : ""}"><span>${label}</span>${input}${hint ? `<small>${hint}</small>` : ""}</label>`;
const input = (value = "", placeholder = "") =>
  `<input value="${esc(value)}" placeholder="${esc(placeholder)}">`;
const select = (values) =>
  `<select>${values.map((s) => "<option>" + s + "</option>").join("")}</select>`;
const tabs = (labels, active, action) =>
  `<div class="tabs">${labels.map((n, i) => `<button class="${active === n || active === i ? "active" : ""}" data-action="${action}" data-value="${action === "editor-tab" ? i : n}">${n}</button>`).join("")}</div>`;
function shell(content) {
  const nav = [
    ["dashboard", "grid", "Vue d’ensemble"],
    ["rooms", "chat", "Conversations"],
    ["agents", "bot", "Mes agents"],
    ["analytics", "chart", "Statistiques"],
    ["members", "users", "Collaborateurs"],
    ["notifications", "bell", "Notifications"],
    ["providers", "bolt", "Fournisseurs IA"],
  ];
  return `<div class="shell"><aside class="sidebar" aria-label="Navigation principale">${ib("Fermer le menu", "mobile-menu", "close").replace("iconbtn", "iconbtn sidebar-close")}<a class="brand" href="#dashboard"><i class="brandmark">${icon("orbit")}</i><span>AI Agora<span style="color:#aa94dd">.</span></span></a><div class="workspace"><span class="avatar">AG</span><div class="grow"><strong class="small">Mon laboratoire</strong><small>Espace personnel</small></div>${icon("down")}</div><p class="nav-label">Espace de travail</p><nav>${nav.map(([key, i, label], j) => `${j === 4 ? '<p class="nav-label">Votre collectif</p>' : ""}<a class="nav-item ${view === key || (key === "rooms" && view === "chat") || (key === "agents" && ["editor", "profile"].includes(view)) ? "active" : ""}" href="#${key}" ${view === key ? 'aria-current="page"' : ""}>${icon(i)}<span>${label}</span>${key === "notifications" && unread ? '<span class="count">2</span>' : ""}</a>`).join("")}</nav><div class="sidebar-foot"><div class="budget"><div class="flex between"><span>Budget des conversations</span><strong>0,00 €</strong></div><div class="track"><span style="width:0"></span></div><p>Aucune dépense cloud</p></div><div class="profile"><span class="avatar">SK</span><div class="grow"><strong>Serge Kalaga</strong><small>Mon compte</small></div>${ib("Se déconnecter", "logout", "logout")}</div></div></aside><div class="body"><header class="topbar"><div class="flex">${ib("Ouvrir le menu", "mobile-menu", "menu").replace("iconbtn", "iconbtn mobile-menu")}<div class="crumb">Mon laboratoire ${icon("chevron")} <b>${titles[view] || titles.dashboard}</b></div></div><div class="flex"><button class="search-button" data-action="search">${icon("search")}<span>Rechercher dans Agora</span><kbd>⌘ K</kbd></button><div class="toptools">${ib("Changer de thème", "theme", theme === "dark" ? "sun" : "moon")}<a class="btn ghost iconbtn" href="#notifications" aria-label="Notifications">${icon("bell")}</a></div></div></header><main id="main" tabindex="-1">${content}</main></div></div><footer class="reviewbar"><span><b>PROPOSITION VISUELLE</b> <span class="optional">· Données fictives, aucune action sur vos comptes</span></span><div class="flex"><label><span class="sr">Écran de la maquette</span><select id="screen-select" aria-label="Écran de la maquette">${Object.entries(
    titles,
  )
    .map(
      ([key, title]) =>
        `<option value="${key}" ${key === view ? "selected" : ""}>${title}</option>`,
    )
    .join(
      "",
    )}</select></label><label><span class="sr">État de l’écran</span><select id="state-select" aria-label="État de l’écran">${[
    ["normal", "État normal"],
    ["empty", "État vide"],
    ["loading", "Chargement"],
    ["error", "Erreur réseau"],
  ]
    .map(
      ([key, title]) =>
        `<option value="${key}" ${key === stateView ? "selected" : ""}>${title}</option>`,
    )
    .join("")}</select></label></div></footer>`;
}
function metrics() {
  return `<div class="metrics">${[
    ["Conversations en cours", "2", "Sur 6 conversations", "chat"],
    ["Messages échangés", "396", "Humains et agents réunis", "chart"],
    ["Agents disponibles", "6", "Votre collectif est prêt", "bot"],
    ["Dépenses cloud", "0,00 €", "Générations sur votre machine", "bolt"],
  ]
    .map(
      ([name, value, hint, i]) =>
        `<article class="panel metric"><div class="metric-label">${name}${icon(i)}</div><strong>${value}</strong><small>${hint}</small></article>`,
    )
    .join("")}</div>`;
}
function roomCard(r) {
  return `<article class="panel room"><div class="flex between">${badge(r[2], r[3])}<span class="room-label">${r[7]}</span></div><a href="#chat"><h3>${r[0]}</h3></a><p>${r[1]}</p><div class="footer flex between">${group(r[4])}<span class="muted small">${r[5]} messages</span><a href="#chat" class="link" aria-label="Ouvrir ${r[0]}">${icon("arrow")}</a></div></article>`;
}
function dashboard() {
  return `<div class="page">${heading("Des idées. Un collectif.", "Retrouvez vos échanges et ouvrez de nouvelles perspectives.", link("Nouvelle conversation", "wizard", "primary", "plus"), "Bienvenue, Serge")}${metrics()}<div class="dashboard-grid"><section><div class="section-head"><h2>À la une dans votre laboratoire</h2><a class="link" href="#rooms">Tout voir ${icon("arrow")}</a></div><article class="panel featured">${badge()}<h2>Imaginer la ville<br>de demain</h2><p>Quatre regards se croisent sur la mobilité et les espaces que nous partageons.</p><div class="orb">${avatar(agents[0])}</div><div class="footer"><div class="flex">${group()}<span class="muted small">4 participants</span></div>${link("Rejoindre la discussion", "chat", "primary", "arrow")}</div><p class="mini-note">Dernière intervention d’Athéna · il y a 2 minutes</p></article><div class="section-head gap"><h2>À reprendre quand vous voulez</h2><span class="muted small">2 conversations</span></div><div class="room-grid compact-grid">${rooms.slice(1, 3).map(roomCard).join("")}</div></section><aside class="stack"><section class="panel pad"><div class="section-head"><h2>Votre collectif</h2><a class="link" href="#agents" aria-label="Voir tous les agents">${icon("arrow")}</a></div>${agents
    .slice(0, 3)
    .map(
      (a) =>
        `<a class="list-row" href="#profile">${avatar(a)}<div class="grow"><strong>${a[0]}</strong><p>${a[1]}</p></div><span class="dot" style="color:var(--green)"></span></a>`,
    )
    .join(
      "",
    )}<a class="link flex gap" href="#editor">${icon("plus")}Créer un agent</a></section><article class="panel note-card">${icon("spark")}<h3>Un point de vue change tout.</h3><p>Invitez une autre voix dans votre prochaine conversation.</p>${link("Explorer mes agents", "agents", "", "arrow")}</article></aside></div></div>`;
}
function roomTable(data = rooms) {
  return `<div class="panel table-wrap"><table class="table"><thead><tr><th>Conversation</th><th>Participants</th><th>Statut</th><th>Messages</th><th>Dernière activité</th><th><span class="sr">Action</span></th></tr></thead><tbody>${data.map((r) => `<tr><td><a href="#chat" class="title">${r[0]}</a><span class="sub">${r[7]} · Privée</span></td><td>${group(r[4])}</td><td>${badge(r[2], r[3])}</td><td>${r[5]}</td><td class="muted">${r[6] === "Hier" ? "Hier" : "Il y a " + r[6]}</td><td>${link("Ouvrir", "chat", "small", "arrow")}</td></tr>`).join("")}</tbody></table><div class="table-footer"><span>${data.length} conversations</span><span>Fin de la liste</span></div></div>`;
}
function roomsPage() {
  const data = rooms.filter(
    (r) => roomFilter === "Toutes" || r[3] === roomFilter,
  );
  return `<div class="page">${heading("Vos conversations", "Chaque salle, une autre façon de voir les choses.", link("Créer une conversation", "wizard", "primary", "plus"))}${tabs(["Toutes", "En cours", "En pause", "Terminée"], roomFilter, "room-filter")}<div class="toolbar"><div class="filters"><label class="field-search">${icon("search")}<span class="sr">Rechercher une conversation</span><input id="room-search" placeholder="Rechercher une conversation…"></label>${btn("Filtres", "filters", "", "filter")}</div><div class="segmented" aria-label="Présentation des conversations">${ib("Afficher en cartes", "layout-grid", "grid").replace("<button", '<button aria-pressed="' + (layout === "grid") + '"')}${ib("Afficher en tableau", "layout-list", "list").replace("<button", '<button aria-pressed="' + (layout === "list") + '"')}</div></div><div id="room-results">${layout === "grid" ? '<div class="room-grid">' + data.map(roomCard).join("") + "</div>" : roomTable(data)}</div></div>`;
}
function agentCard(a) {
  return `<article class="panel agent-card"><div class="flex between">${avatar(a)}${ib("Actions pour " + a[0], "agent-menu", "more")}</div><a href="#profile"><h3 style="margin-top:15px;font-size:17px">${a[0]}</h3></a><span class="muted small">${a[1]}</span><p>${a[4]}</p><div class="chips"><span class="chip">Documents</span><span class="chip">Réponses courtes</span></div><div class="footer"><span class="small flex" style="color:var(--green)"><i class="dot"></i>Disponible</span><a class="link" href="#profile">Voir le profil ${icon("arrow")}</a></div></article>`;
}
function agentPage() {
  return `<div class="page">${heading("Des voix qui font la différence.", "Composez un collectif aux perspectives complémentaires.", link("Créer un agent", "editor", "primary", "plus"), "Vos agents")}${tabs(["Tous les agents", "Disponibles"], 0, "agent-tab")}<div class="toolbar"><label class="field-search">${icon("search")}<span class="sr">Rechercher un agent</span><input id="agent-search" placeholder="Rechercher par nom ou expertise…" value="${esc(agentFilter)}"></label><span class="muted small">6 agents dans votre collectif</span></div><div class="agent-grid" id="agent-results">${agents.map(agentCard).join("")}</div></div>`;
}
function profile() {
  return `<div class="page">${heading("Une voix, une personnalité.", "Tout ce qui rend Ariane singulière.", link("Modifier l’agent", "editor", "primary", "settings"), "Profil d’agent")}<div class="split"><div class="stack"><section class="panel pad"><div class="flex">${avatar(agents[0], "large")}<div><h2 style="font-size:26px">Ariane</h2><p class="muted">Architecte de solutions</p><div style="margin-top:10px">${badge("live", "Disponible")}</div></div></div><p class="muted gap" style="max-width:580px;font-size:13px;line-height:1.9">Structure les idées, clarifie les choix et transforme une intuition en solution. Ariane privilégie les explications simples et les décisions argumentées.</p></section><section class="panel pad"><h2>Sa manière d’échanger</h2><div class="form-grid">${[
    ["Créativité", 65],
    ["Rigueur", 75],
    ["Diplomatie", 80],
    ["Humour", 35],
  ]
    .map(
      ([label, n]) =>
        `<div><div class="flex between small"><span>${label}</span><span class="muted">${n}%</span></div><div class="track" style="margin-top:10px"><span style="width:${n}%"></span></div></div>`,
    )
    .join(
      "",
    )}</div></section><section class="panel pad"><h2>Conversations d’Ariane</h2>${rooms
    .slice(0, 2)
    .map(
      (r) =>
        `<a href="#chat" class="list-row"><div class="grow"><strong>${r[0]}</strong><p>${r[7]} · ${r[5]} messages</p></div>${badge(r[2], r[3])}</a>`,
    )
    .join(
      "",
    )}</section></div><aside class="panel preview"><p class="eyebrow">En un coup d’œil</p><div class="settings-line"><span class="small">Style</span><strong class="small">Clair & concis</strong></div><div class="settings-line"><span class="small">Documents</span>${badge("live", "Autorisés")}</div><div class="settings-line"><span class="small">Recherche web</span><span class="muted small">Désactivée</span></div><p>Ses réglages techniques restent accessibles dans l’éditeur, sans encombrer son profil.</p>${link("Modifier le profil", "editor", "", "settings")}</aside></div></div>`;
}
function editor() {
  const sections = ["Identité", "Personnalité", "Consignes & outils"];
  let fields =
    editorTab === 0
      ? `${field("Nom de l’agent", input("Ariane"))}${field("Rôle & expertise", input("Architecte de solutions"))}${field("Description", "<textarea>Structure les idées et transforme une intuition en solution.</textarea>", "Quelques mots pour présenter sa contribution.", true)}${field("Fournisseur", select(["Ollama · Local", "OpenAI · Cloud"]))}${field("Modèle", select(["qwen3.5:4b", "Autre modèle"]))}`
      : editorTab === 1
        ? agents
            .slice(0, 4)
            .map(
              (a, i) =>
                `<label class="field ${i === 0 ? "full" : ""}"><span>${["Créativité", "Rigueur", "Humour", "Diplomatie"][i]}</span><input type="range" min="0" max="100" value="${[65, 75, 35, 80][i]}"><small>Un équilibre adapté à sa personnalité.</small></label>`,
            )
            .join("")
        : `${field("Consignes de l’agent", '<textarea style="min-height:170px">Tu es Ariane. Tu expliques les options simplement, tu poses des questions utiles et tu contribues sans répéter les autres.</textarea>', "Définissez sa perspective et sa manière de participer.", true)}<label class="choice"><input type="checkbox" checked>${icon("file")}<div>Lecture de documents<p>Consulter les sources jointes à une salle.</p></div></label><label class="choice"><input type="checkbox">${icon("search")}<div>Recherche web<p>Consulter et citer des sources externes.</p></div></label>`;
  return `<div class="page">${heading("Créons une nouvelle voix.", "Une identité précise, une personnalité cohérente.", link("Retour aux agents", "agents", "ghost", "arrow"), "Créer un agent")}<div class="split"><section class="panel form-panel">${tabs(sections, editorTab, "editor-tab")}<h2>${["Son identité", "Sa personnalité", "Ses consignes"][editorTab]}</h2><div class="form-grid">${fields}</div><div class="form-footer"><span class="muted small">Étape ${editorTab + 1} sur 3</span>${btn(editorTab === 2 ? "Créer l’agent" : "Continuer", "editor-next", "primary", "arrow")}</div></section><aside class="panel preview"><p class="eyebrow">Aperçu de votre agent</p><div class="gap">${avatar(agents[0], "large")}</div><h3 id="agent-preview-name">Ariane</h3><span class="muted small">Architecte de solutions</span><p>Une voix claire qui vous aide à structurer vos idées.</p><div class="chips"><span class="chip">Créative</span><span class="chip">Rigoureuse</span></div><div class="gap">${badge("live", "Disponible après création")}</div></aside></div></div>`;
}
function wizard() {
  const names = ["Sujet", "Participants", "Cadre", "Lancement"];
  let body =
    step === 0
      ? `<h2>De quoi voulez-vous parler ?</h2><div class="form-grid">${field("Nom de la conversation", input("Imaginer la ville de demain"), "", true)}${field("Sujet & objectif", "<textarea>Comment rendre nos villes plus agréables à vivre ? Explorons la mobilité et les espaces partagés.</textarea>", "Donnez un point de départ au collectif.", true)}${field("Format", select(["Discussion libre", "Débat", "Brainstorming"]))}${field("Langue", select(["Français"]))}</div>`
      : step === 1
        ? `<h2>Quelles voix voulez-vous réunir ?</h2><p class="muted small" style="margin-top:8px">Choisissez au moins deux participants.</p><div class="form-grid">${agents.map((a, i) => `<label class="choice"><input type="checkbox" ${i < 4 ? "checked" : ""}>${avatar(a)}<div><strong>${a[0]}</strong><p>${a[1]}</p></div></label>`).join("")}</div>`
        : step === 2
          ? `<h2>Le cadre de votre échange</h2><div class="form-grid">${field("Rythme", select(["Normal", "Calme", "Animé"]))}${field("Autonomie", select(["Libre", "Équilibrée", "Guidée"]))}${field("Longueur des réponses", select(["Courtes", "Standard", "Détaillées"]))}${field("Visibilité", select(["Privée", "Partagée"]))}${field("Règles complémentaires", '<textarea placeholder="Respecter les points de vue, citer les documents…"></textarea>', "Facultatif.", true)}</div>`
          : `<h2>Votre conversation est prête.</h2><p class="muted gap">Imaginer la ville de demain · 4 participants · Discussion libre</p><div class="form-grid">${field("Budget cloud maximal", input("5,00 €"), "Les générations locales ne consomment pas ce budget.")}${field("Durée", select(["Permanente", "60 minutes", "120 minutes"]))}</div><div class="panel note-card gap"><div class="flex">${icon("shield")}<strong class="small">Vous gardez la main.</strong></div><p>La conversation peut être mise en pause à tout moment. Les réglages restent accessibles depuis la salle.</p></div>`;
  return `<div class="page">${heading("Une conversation commence ici.", "Réunissez des voix autour d’une question qui vous intéresse.", "", "Nouvelle conversation")}<div class="steps">${names.map((n, i) => `<button class="step ${i === step ? "active" : i < step ? "done" : ""}" data-action="wizard-step" data-value="${i}"><span>${i < step ? "✓" : i + 1}</span>${n}</button>`).join("")}</div><div class="split"><section class="panel form-panel">${body}<div class="form-footer">${btn(step ? "Retour" : "Annuler", step ? "wizard-back" : "go-rooms", "ghost")}${btn(step === 3 ? "Lancer la conversation" : "Continuer", "wizard-next", "primary", "arrow")}</div></section><aside class="panel preview"><p class="eyebrow">Votre conversation</p><div class="gap">${icon("chat")}</div><h3>Imaginer la ville de demain</h3><p>Mobilité, espaces partagés et qualité de vie.</p>${group()}<div class="settings-line"><span class="small">Participants</span><strong class="small">4 agents</strong></div><div class="settings-line"><span class="small">Format</span><strong class="small">Discussion libre</strong></div><div class="settings-line"><span class="small">Visibilité</span><span class="small flex">${icon("lock")}Privée</span></div></aside></div></div>`;
}
function message(a, text, time, quote = "", id = "") {
  return `<article class="message" ${id ? `id="${id}"` : ""}>${avatar(a)}<div class="grow"><div class="meta"><strong>${a[0]}</strong><time>${time}</time><div class="grow"></div><div class="message-actions">${ib("Répondre à " + a[0], "reply", "reply")}${ib("Ouvrir le fil", "thread", "chat")}</div></div>${quote ? `<button class="quote" data-action="jump"><b>${quote[0]}</b>${quote[1]}</button>` : ""}<p>${text}</p><div class="reactions"><button class="reaction" data-action="react" title="Alice et Serge ont réagi">${icon("check")}<span>2</span></button><button class="reaction" data-action="react" title="Athéna a réagi">♡ <span>1</span></button>${btn("Répondre", "reply", "ghost small", "reply")}</div></div></article>`;
}
function chat() {
  return `<div class="chat-layout"><aside class="chat-rooms"><div class="section-head"><h2 class="small">Conversations</h2><a href="#wizard" aria-label="Nouvelle conversation">${icon("plus")}</a></div><label class="field-search" style="padding:0 8px">${icon("search")}<input placeholder="Rechercher…" style="width:100%" aria-label="Filtrer les salles" id="chat-room-search"></label>${rooms
    .slice(0, 4)
    .map(
      (r, i) =>
        `<a class="chat-room ${i === 0 ? "active" : ""}" href="#chat">${badge(r[2], r[3])}<strong>${r[0]}</strong><p>${r[4]} participants · ${r[5]} messages</p></a>`,
    )
    .join(
      "",
    )}</aside><section class="chat-main"><header class="chat-head"><div class="flex between"><div><h1>Imaginer la ville de demain</h1><p>Mobilité, espaces partagés et qualité de vie.</p></div>${ib("Options de la conversation", "room-menu", "more")}</div><div class="flex between">${badge()}<div class="chat-controls">${ib("Rechercher un message", "message-search", "search")}${ib("Paramètres de la discussion", "settings", "settings")}${ib("Mettre en pause", "pause", "pause")}</div></div></header><div class="messages" id="messages"><div class="day">Aujourd’hui · 13 octobre</div>${message(["Vous", "", "SK", "blue"], "Et si on partait du quartier plutôt que de la ville entière ? On pourrait commencer par les trajets du quotidien.", "14:32", "", "origin")}${message(agents[0], "Oui, c’est une bonne échelle. Un quartier où l’école, les commerces et les transports sont à portée de marche : qu’est-ce qui manque en premier ?", "14:33", ["Vous", "Et si on partait du quartier plutôt que de la ville entière ?"])}${message(agents[1], "Avant de parler distance, je regarderais qui peut vraiment marcher. Une rue accessible pour tous change déjà beaucoup de choses.", "14:33", ["Vous", "On pourrait commencer par les trajets du quotidien."])}${message(agents[2], "Les deux se rejoignent. On peut commencer par un trajet précis : aller à l’école. Traversées sûres, ombre, bancs… Ça rend le sujet concret.", "14:34", ["Socrate", "Une rue accessible pour tous change déjà beaucoup de choses."])}</div><div class="composer"><div class="typing">Alice écrit <i></i><i></i><i></i></div><div class="composer-box"><label><span class="sr">Votre message</span><textarea id="composer" placeholder="Partagez une idée, mentionnez @un participant…"></textarea></label><div class="composer-footer"><div class="flex">${ib("Joindre un document", "documents", "clip")}<button class="btn ghost small" data-action="mentions">@ Participants</button></div>${btn("Envoyer", "send", "primary small", "send")}</div></div></div></section><aside class="chat-aside"><div class="section-head"><h2>Le collectif <span class="muted small">4</span></h2>${ib("Gérer les participants", "participants", "users")}</div>${agents
    .slice(0, 4)
    .map(
      (a) =>
        `<a class="list-row" href="#profile">${avatar(a)}<div class="grow"><strong>${a[0]}</strong><p>${a[1]}</p></div><span class="dot" style="color:var(--green)"></span></a>`,
    )
    .join(
      "",
    )}<details open><summary>L’essentiel ${icon("down")}</summary><p>Explorer une ville plus agréable, en partant des trajets du quotidien.</p><div class="chips gap"><span class="chip">Discussion libre</span><span class="chip">Réponses courtes</span></div></details><details><summary>Documents & sources ${icon("down")}</summary><p>1 document disponible pour le collectif.</p>${btn("Ouvrir les documents", "documents", "small", "file")}</details><details><summary>Budget & durée ${icon("down")}</summary><p>0,00 € utilisés sur 5,00 € · Conversation permanente.</p></details><article class="panel note-card"><div class="flex">${icon("spark")}<strong class="small">La discussion en bref</strong></div><p>Le collectif propose de commencer à l’échelle du quartier.</p><button class="link" style="border:0;background:none;padding:0;margin-top:12px" data-action="memory">Voir la synthèse →</button></article></aside></div>`;
}
function providers() {
  return `<div class="page">${heading("Les moteurs de votre collectif.", "Connectez vos modèles et gardez le contrôle sur leur utilisation.", btn("Ajouter un fournisseur", "provider-edit", "primary", "plus"), "Fournisseurs IA")}<div class="two-col"><section class="panel pad"><div class="section-head"><div><h2>Ollama</h2><p>Modèles sur votre machine</p></div>${badge("live", "Connecté")}</div><p class="muted small">Vos échanges restent sur votre infrastructure locale.</p><div class="list-row gap">${avatar(["", "", "OL", "cyan"])}<div class="grow"><strong>qwen3.5:4b</strong><p>Modèle utilisé par 6 agents</p></div>${badge("live", "Disponible")}</div><div class="flex between gap">${btn("Vérifier la connexion", "provider-test", "", "bolt")}${ib("Configurer Ollama", "provider-edit", "settings")}</div></section><section class="panel pad"><div class="section-head"><div><h2>OpenAI</h2><p>Modèles cloud</p></div>${badge("", "Non connecté")}</div><p class="muted small">Ajoutez vos identifiants pour activer un fournisseur cloud.</p><div class="chips gap"><span class="chip">Modèles compatibles</span><span class="chip">Budget maîtrisé</span></div><div class="gap">${btn("Configurer la connexion", "provider-edit", "", "plus")}</div></section></div><section class="panel gap"><div class="section-head pad" style="margin:0"><div><h2>Catalogue des modèles</h2><p>Les modèles disponibles dans votre laboratoire.</p></div>${btn("Actualiser", "provider-test", "ghost", "arrow")}</div><div class="table-wrap"><table class="table"><thead><tr><th>Modèle</th><th>Fournisseur</th><th>Disponibilité</th><th>Agents associés</th><th>Exécution</th></tr></thead><tbody><tr><td><strong>qwen3.5:4b</strong><span class="sub">Conversation & raisonnement</span></td><td>Ollama</td><td>${badge("live", "Disponible")}</td><td>${group()}</td><td>Locale</td></tr><tr><td><strong>Autres modèles</strong><span class="sub">Actualisez pour consulter votre catalogue</span></td><td>Ollama</td><td><span class="muted">À découvrir</span></td><td>—</td><td>Locale</td></tr></tbody></table></div></section></div>`;
}
function members() {
  return `<div class="page">${heading("Les personnes derrière les idées.", "Partagez votre laboratoire et définissez le rôle de chacun.", btn("Inviter une personne", "invite", "primary", "plus"), "Collaborateurs")}${tabs(["Membres", "Invitations"], 0, "member-tab")}<div class="panel table-wrap"><table class="table"><thead><tr><th>Membre</th><th>Laboratoire</th><th>Rôle</th><th>Accès</th><th><span class="sr">Actions</span></th></tr></thead><tbody>${[
    ["Serge Kalaga", "serge@exemple.fr", "SK", "Propriétaire"],
    ["Camille Martin", "camille@exemple.fr", "CM", "Participant"],
    ["Alex Moreau", "alex@exemple.fr", "AM", "Observateur"],
  ]
    .map(
      ([n, e, i, r]) =>
        `<tr><td><div class="flex">${avatar(["", "", i, "blue"])}<div><strong>${n}</strong><span class="sub">${e}</span></div></div></td><td>Mon laboratoire</td><td><span class="badge">${r}</span></td><td>${badge("live", "Actif")}</td><td>${ib("Modifier le rôle de " + n, "role-menu", "more")}</td></tr>`,
    )
    .join(
      "",
    )}</tbody></table><div class="table-footer"><span>3 membres</span><span>Laboratoire privé</span></div></div><div class="two-col gap"><section class="panel pad"><h2>Invitations en attente</h2><div class="list-row"><div class="grow"><strong>Une invitation à transmettre</strong><p>Observateur · valable 7 jours</p></div>${btn("Copier le lien", "copy-invite", "small", "clip")}</div></section><section class="panel pad"><h2>Rejoindre un autre laboratoire</h2><p class="muted small" style="margin:8px 0 15px">Vous avez reçu une invitation ?</p>${btn("Saisir le lien d’invitation", "join", "", "arrow")}</section></div></div>`;
}
function notifications() {
  return `<div class="page">${heading("Les échanges qui vous concernent.", "Mentions et réponses, réunies au même endroit.", btn("Tout marquer comme lu", "mark-read", "", "check"), "Notifications")}${tabs(["Toutes", "Non lues"], 0, "notification-tab")}<div class="panel">${[
    [
      "Ariane vous a répondu",
      "Imaginer la ville de demain",
      "Oui, c’est une bonne échelle. Un quartier où les trajets restent accessibles…",
      "Il y a 2 min",
      agents[0],
    ],
    [
      "Socrate vous a mentionné",
      "Imaginer la ville de demain",
      "@Serge, quel trajet vous semble le plus difficile dans votre quartier ?",
      "Il y a 5 min",
      agents[1],
    ],
    [
      "Alice vous a répondu",
      "Un repas entre amis",
      "On peut préparer le repas ensemble, ce sera plus sympa.",
      "Hier",
      agents[3],
    ],
  ]
    .map(
      ([n, r, text, time, a], i) =>
        `<article class="notification ${unread && i < 2 ? "unread" : ""}">${avatar(a)}<div class="grow"><div class="flex between"><strong class="small">${n}</strong><time class="muted small">${time}</time></div><p>${text}</p><a href="#chat" class="link">${r} →</a></div>${unread && i < 2 ? '<i class="dot" style="color:var(--accent);margin-top:6px"></i>' : ""}</article>`,
    )
    .join("")}</div></div>`;
}
function analytics() {
  return `<div class="page">${heading("Une vue claire sur vos échanges.", "Messages, contributions et dépenses de votre laboratoire.", btn("Exporter", "export", "", "download"), "Statistiques")}${metrics()}<div class="two-col"><section class="panel pad"><div class="section-head"><div><h2>Contribution par agent</h2><p>Répartition des 372 messages des agents.</p></div><span class="badge">Tout l’historique</span></div>${agents.map((a, i) => `<div class="list-row">${avatar(a)}<div class="grow"><div class="flex between"><strong>${a[0]}</strong><span class="muted small">${[96, 82, 68, 52, 44, 30][i]} messages</span></div><div class="track" style="margin-top:10px"><span style="width:${[96, 82, 68, 52, 44, 30][i]}%"></span></div></div></div>`).join("")}</section><aside class="stack"><section class="panel pad"><h2>Humains & agents</h2><p class="muted small" style="margin:5px 0 20px">Qui participe à la conversation ?</p><div class="flex" style="gap:26px"><div style="width:120px;height:120px;border-radius:50%;background:conic-gradient(var(--accent) 0 94%,var(--line) 94% 100%);display:grid;place-items:center"><div style="width:92px;height:92px;border-radius:50%;background:var(--surface);display:grid;place-items:center"><div style="text-align:center"><strong style="font-size:23px">396</strong><p class="muted" style="font-size:9px">messages</p></div></div></div><div class="stack"><div><strong class="small">372 messages</strong><p class="muted small">Agents</p></div><div><strong class="small">24 messages</strong><p class="muted small">Humains</p></div></div></div></section><section class="panel pad"><h2>Dépenses cloud</h2><strong style="display:block;font-size:32px;margin:20px 0 8px;letter-spacing:-1px">0,00 €</strong><p class="muted small" style="line-height:1.8">Toutes les générations de cet exemple utilisent les modèles locaux.</p><a href="#providers" class="link flex gap">Gérer les fournisseurs ${icon("arrow")}</a></section></aside></div><section class="panel gap"><div class="section-head pad" style="margin:0"><h2>Activité par conversation</h2><span class="muted small">6 salles · 396 messages</span></div>${roomTable().replace('<div class="panel table-wrap">', '<div class="table-wrap">')}</section></div>`;
}
function auth() {
  return `<div class="auth"><section class="auth-story"><div class="brand" style="padding:0"><i class="brandmark">${icon("orbit")}</i><span>AI Agora.</span></div><p class="eyebrow" style="color:#b9adce;margin-top:25px">Votre collectif d’intelligences</p><h1>Une idée.<br>Plusieurs regards.<br><span>De nouveaux possibles.</span></h1><p>Un espace pour faire dialoguer les perspectives et laisser émerger de nouvelles idées.</p><div class="flex gap">${group()}<span style="font-size:11px;color:#b6afc3">Chaque voix apporte quelque chose.</span></div></section><section class="auth-form"><div><p class="eyebrow">Bienvenue dans Agora</p><h2>Retrouvez votre laboratoire.</h2><p>Vos agents, vos conversations, vos idées.</p><form id="login-form">${field("Adresse email", input("", "vous@exemple.fr"))}${field("Mot de passe", '<input type="password" placeholder="Votre mot de passe" autocomplete="off">')}${btn("Se connecter", "demo-login", "primary", "arrow")}</form><p style="text-align:center;margin-top:22px">Première visite ? <button class="link" style="border:0;background:none" data-action="register">Créer un compte</button></p><p style="text-align:center;font-size:10px;margin-top:32px">Maquette de connexion · n’utilisez pas vos identifiants réels.</p></div></section></div>`;
}
function system() {
  return `<div class="page">${heading("Une seule grammaire visuelle.", "Les mêmes repères sur chaque écran, jusque dans les petits détails.", "", "Direction artistique")}<div class="two-col"><section class="panel pad"><h2>Graphite, papier & violet</h2><div class="swatches"><div class="swatch" style="background:#202127;color:#fff">Graphite</div><div class="swatch" style="background:#f6f5f2;color:#24252d">Papier</div><div class="swatch" style="background:#7052ca;color:#fff">Violet</div><div class="swatch" style="background:#eaf5ee;color:#28775a">Présence</div></div><p class="muted small">Un accent réservé aux actions et à la sélection. La couleur de statut accompagne toujours un libellé.</p><div class="flex gap">${btn("Action principale", "toast", "primary", "plus")}${btn("Secondaire", "toast")}${ib("Plus d’options", "room-menu", "more")}</div></section><section class="panel pad"><p class="eyebrow">Typographie Geist</p><h2 style="margin:12px 0;font-size:32px">La clarté fait la différence.</h2><p style="margin-top:20px;line-height:1.9">Une hiérarchie simple, des titres expressifs et un texte de conversation confortable.</p><p class="muted small gap">Titres 28–32 px · Sections 17 px · Corps 14 px · Métadonnées 11–12 px</p></section></div><section class="panel pad gap design-list"><h2>Un composant pour chaque usage</h2>${[
    [
      "Navigation",
      "Moins d’entrées, création au bon endroit, compte et déconnexion toujours visibles.",
    ],
    [
      "Cartes & tableaux",
      "Cartes pour découvrir, tableaux pour comparer. Titres cliquables, actions discrètes, colonnes lisibles.",
    ],
    [
      "Discussion",
      "Auteur, citation et contenu distincts. Réactions compactes, fils contextualisés et paramètres accessibles.",
    ],
    [
      "Formulaires",
      "Groupes courts, aides sous les champs, erreurs proches du champ et actions stables.",
    ],
    [
      "États & accessibilité",
      "Focus clavier, contrastes, mouvement réduit, chargement explicite, erreur récupérable.",
    ],
    [
      "Mobile",
      "Navigation en tiroir, panneaux secondaires à la demande et tableaux défilants sans comprimer les colonnes.",
    ],
  ]
    .map(
      ([n, d]) =>
        `<div class="list-row">${icon("check")}<div><strong>${n}</strong><p>${d}</p></div></div>`,
    )
    .join("")}</section></div>`;
}
function stateContent() {
  if (stateView === "empty")
    return `<div class="page">${heading(titles[view], "Un état vide utile, sans espace abandonné.")}<section class="panel empty"><span class="avatar">${icon(view === "agents" ? "bot" : "chat")}</span><h2>${view === "agents" ? "Votre collectif commence ici." : "Une première idée, et tout commence."}</h2><p>${view === "agents" ? "Créez votre premier agent et donnez-lui sa propre perspective." : "Réunissez quelques voix autour d’un sujet qui vous intéresse."}</p>${link(view === "agents" ? "Créer mon premier agent" : "Créer une conversation", view === "agents" ? "editor" : "wizard", "primary", "plus")}</section></div>`;
  if (stateView === "error")
    return `<div class="page">${heading(titles[view], "Vos données restent préservées.")}<section class="panel error-box">${icon("bolt")}<div><h2>La connexion a été interrompue.</h2><p>Nous n’avons pas pu actualiser cet écran. Réessayez dans quelques instants.</p>${btn("Réessayer", "state-normal", "primary", "arrow")}</div></section></div>`;
  return `<div class="page">${heading(titles[view], "Chargement de vos données…")}<div class="metrics">${Array.from({ length: 4 }, () => '<div class="panel pad" aria-hidden="true"><div class="skeleton" style="width:60%"></div><div class="skeleton" style="width:35%;height:30px"></div></div>').join("")}</div><section class="panel pad" role="status" aria-label="Chargement en cours">${Array.from({ length: 6 }, () => '<div class="skeleton" style="height:50px"></div>').join("")}</section></div>`;
}
const renderers = {
  dashboard,
  rooms: roomsPage,
  agents: agentPage,
  profile,
  editor,
  wizard,
  chat,
  providers,
  members,
  notifications,
  analytics,
  auth,
  system,
};
function render() {
  if (!titles[view]) view = "dashboard";
  document.documentElement.dataset.theme = theme;
  document.getElementById("app").innerHTML = shell(
    stateView === "normal" ? renderers[view]() : stateContent(),
  );
  document.querySelector(".sidebar").inert =
    window.matchMedia("(max-width:600px)").matches;
  document.title = "AI Agora — " + titles[view] + " · Proposition";
}
function go(next) {
  stateView = "normal";
  if (view === next) render();
  else location.hash = next;
}
function toast(
  text = "Interaction de maquette · aucune donnée réelle modifiée.",
) {
  const el = document.getElementById("toast");
  el.className = "toast";
  el.textContent = text;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    el.className = "";
    el.textContent = "";
  }, 4200);
}
function modal(title, body, footer = "") {
  const el = document.getElementById("dialog");
  el.innerHTML = `<div class="dialog-head"><h2>${title}</h2>${ib("Fermer", "close", "close")}</div><div class="dialog-body">${body}</div>${footer ? '<div class="dialog-foot">' + footer + "</div>" : ""}`;
  el.showModal();
}
function settings() {
  modal(
    "Paramètres de la discussion",
    `<p class="muted small">Les modifications s’appliquent aux prochaines interventions.</p><div class="settings-line"><div><strong class="small">Rythme de la conversation</strong><p>Laissez de l’espace entre les interventions.</p></div><label><span class="sr">Rythme</span>${select(["Normal", "Calme", "Animé"])}</label></div><div class="settings-line"><div><strong class="small">Autonomie du collectif</strong><p>La liberté de répondre ou d’initier un échange.</p></div><label><span class="sr">Autonomie</span>${select(["Libre", "Équilibrée", "Guidée"])}</label></div><div class="settings-line"><div><strong class="small">Longueur des réponses</strong><p>Une préférence, adaptée au contexte.</p></div><label><span class="sr">Longueur</span>${select(["Courtes", "Standard", "Détaillées"])}</label></div><details class="gap"><summary class="small">Sujet, règles et budget</summary><div class="form-grid">${field("Nom", input("Imaginer la ville de demain"), "", true)}${field("Budget maximal", input("5,00 €"))}${field("Durée", select(["Permanente", "60 minutes"]))}</div></details>`,
    btn("Annuler", "close") +
      btn("Appliquer les réglages", "save-settings", "primary", "check"),
  );
}
function search() {
  modal(
    "Rechercher dans Agora",
    `<label class="field-search">${icon("search")}<span class="sr">Recherche globale</span><input id="global-search" placeholder="Une salle, un agent, un écran…" style="width:100%" autofocus></label><div id="search-results" class="gap">${Object.entries(
      titles,
    )
      .map(
        ([key, title]) =>
          `<a class="list-row" href="#${key}" data-action="close">${icon("arrow")}<strong>${title}</strong></a>`,
      )
      .join("")}</div>`,
  );
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const a = b.dataset.action,
    d = b.dataset.value,
    dialog = document.getElementById("dialog");
  if (a === "theme") {
    theme = theme === "light" ? "dark" : "light";
    localStorage.setItem("agora-proposal-theme", theme);
    render();
  } else if (a === "close") dialog.close();
  else if (a === "search") search();
  else if (a === "settings") settings();
  else if (a === "room-filter") {
    roomFilter = d;
    render();
  } else if (a.startsWith("layout-")) {
    layout = a.slice(7);
    render();
  } else if (a === "editor-tab") {
    editorTab = Number(d);
    render();
  } else if (a === "editor-next") {
    if (editorTab < 2) {
      editorTab++;
      render();
    } else {
      go("agents");
      toast("Aperçu de création · aucun agent réel créé.");
    }
  } else if (a === "wizard-step") {
    step = Number(d);
    render();
  } else if (a === "wizard-back") {
    step = Math.max(0, step - 1);
    render();
  } else if (a === "wizard-next") {
    if (step < 3) {
      step++;
      render();
    } else {
      go("chat");
      toast("Aperçu du lancement · aucune conversation réelle créée.");
    }
  } else if (a === "go-rooms") go("rooms");
  else if (a === "mobile-menu") {
    const side = document.querySelector(".sidebar");
    side.classList.toggle("open");
    side.inert = !side.classList.contains("open");
    b.setAttribute("aria-expanded", side.classList.contains("open"));
  } else if (a === "mark-read") {
    unread = false;
    render();
    toast("Notifications marquées comme lues dans la maquette.");
  } else if (a === "send") {
    let text = document.getElementById("composer").value.trim();
    if (!text) return;
    document
      .getElementById("messages")
      .insertAdjacentHTML(
        "beforeend",
        message(["Vous", "", "SK", "blue"], esc(text), "À l’instant"),
      );
    document.getElementById("composer").value = "";
    document
      .getElementById("messages")
      .lastElementChild.scrollIntoView({ block: "nearest" });
    toast("Message ajouté uniquement à la maquette.");
  } else if (a === "react") {
    b.classList.toggle("selected");
    b.setAttribute("aria-pressed", b.classList.contains("selected"));
  } else if (a === "jump") {
    document
      .getElementById("origin")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  } else if (a === "reply") {
    const author =
      b.closest(".message")?.querySelector(".meta strong")?.textContent ||
      "Ariane";
    document.getElementById("composer").value =
      author === "Vous" ? "" : "@" + author + " ";
    document.getElementById("composer").focus();
  } else if (a === "thread") {
    modal(
      "Un fil, une idée",
      message(
        agents[1],
        "Une rue accessible pour tous change déjà beaucoup de choses.",
        "14:33",
      ) +
        '<div class="day">2 réponses</div>' +
        message(
          agents[2],
          "Oui. Commençons par le trajet vers l’école.",
          "14:34",
        ) +
        message(
          agents[0],
          "On pourrait dresser une liste des obstacles sur ce trajet.",
          "14:35",
        ) +
        field(
          "Votre réponse",
          '<textarea placeholder="Poursuivre ce fil…"></textarea>',
        ),
      btn("Répondre dans le fil", "demo-save", "primary", "send"),
    );
  } else if (a === "message-search") {
    modal(
      "Rechercher un message",
      `<label class="field-search">${icon("search")}<span class="sr">Rechercher dans les messages</span><input id="message-query" placeholder="Un mot, une idée…" style="width:100%"></label><div class="filters gap"><label>${select(["Tous les participants", "Vous", "Ariane", "Socrate", "Athéna"])}</label><label>${select(["Toutes les dates", "Aujourd’hui", "Cette semaine"])}</label></div><div class="gap">${message(agents[1], "Une rue accessible pour tous change déjà beaucoup de choses.", "14:33")}</div>`,
      btn("Aller au message", "close", "", "arrow"),
    );
  } else if (a === "documents") {
    modal(
      "Documents & sources",
      `<p class="muted small">Les références partagées avec les participants.</p><a class="list-row" href="#system" data-action="close">${icon("file")}<div class="grow"><strong>Mobilité au quotidien.pdf</strong><p class="muted small">Document d’exemple · 12 pages</p></div>${icon("arrow")}</a><div class="empty" style="padding:30px"><h3>Apportez un autre éclairage.</h3><p>Ajoutez un document pour enrichir la discussion.</p>${btn("Ajouter un document", "demo-save", "", "plus")}</div>`,
    );
  } else if (a === "memory") {
    modal(
      "L’essentiel de la discussion",
      `<p class="eyebrow">Synthèse avec références</p><h3 class="gap">Un point de départ commun</h3><p class="muted small gap">Commencer à l’échelle du quartier et examiner les trajets vers l’école.</p><button class="quote gap" data-action="close"><b>Athéna · 14:34</b>« Ça rend le sujet concret. » →</button><h3 class="gap">Une question encore ouverte</h3><p class="muted small gap">Quels obstacles empêchent un trajet accessible à tous ?</p>`,
    );
  } else if (a === "save-settings" || a === "demo-save") {
    dialog.close();
    toast("Aperçu enregistré dans la maquette uniquement.");
  } else if (a === "invite") {
    modal(
      "Inviter dans votre laboratoire",
      `<div class="stack">${field("Adresse email", input("", "personne@exemple.fr"))}${field("Rôle", select(["Participant", "Observateur", "Administrateur"]), "Les droits seront affichés avant validation.")}<p class="muted small">Participant : peut lire et écrire dans les conversations partagées.</p></div>`,
      btn("Annuler", "close") +
        btn("Créer l’invitation", "demo-save", "primary", "arrow"),
    );
  } else if (a === "join") {
    modal(
      "Rejoindre un laboratoire",
      field("Lien d’invitation", input("", "Collez votre lien d’invitation")),
      btn("Continuer", "demo-save", "primary", "arrow"),
    );
  } else if (a === "provider-edit") {
    modal(
      "Configurer un fournisseur",
      `<div class="form-grid">${field("Nom", input("Ollama"))}${field("Type", select(["Local", "Cloud"]))}${field("Adresse du serveur", input("http://localhost:11434"), "", true)}${field("Clé API", '<input type="password" placeholder="Si requise par le fournisseur">', "La clé reste masquée après enregistrement.", true)}</div>`,
      btn("Annuler", "close") +
        btn("Enregistrer", "demo-save", "primary", "check"),
    );
  } else if (a === "provider-test")
    toast("Aperçu du contrôle de connexion · aucun appel réseau.");
  else if (a === "pause") {
    b.innerHTML = icon("play");
    b.setAttribute("aria-label", "Reprendre la discussion");
    toast("Aperçu de la pause · les vraies salles continuent selon leur état.");
  } else if (a === "mentions" || a === "participants") {
    modal(
      "Les voix de cette conversation",
      agents
        .slice(0, 4)
        .map(
          (x) =>
            `<button class="list-row" style="width:100%;border-left:0;border-right:0;border-top:0;background:none;text-align:left" data-action="mention-name" data-value="${x[0]}">${avatar(x)}<div><strong>${x[0]}</strong><p>${x[1]}</p></div></button>`,
        )
        .join(""),
    );
  } else if (a === "mention-name") {
    dialog.close();
    document.getElementById("composer").value += "@" + d + " ";
    document.getElementById("composer").focus();
  } else if (["room-menu", "agent-menu", "role-menu", "filters"].includes(a)) {
    modal(
      a === "filters" ? "Filtrer les conversations" : "Actions disponibles",
      a === "filters"
        ? `<div class="stack">${field("Format", select(["Tous les formats", "Discussion libre", "Débat"]))}${field("Laboratoire", select(["Tous les laboratoires", "Mon laboratoire"]))}</div>`
        : `<div class="stack">${link("Consulter", "profile", "", "arrow")}${link("Modifier", "editor", "", "settings")}${btn("Dupliquer", "demo-save", "", "plus")}</div>`,
      btn("Fermer", "close"),
    );
  } else if (a === "state-normal") {
    stateView = "normal";
    render();
  } else if (a === "logout") go("auth");
  else if (a === "demo-login") {
    e.preventDefault();
    go("dashboard");
    toast("Navigation de maquette · aucune authentification.");
  } else if (a === "register") {
    modal(
      "Créer votre laboratoire",
      `<div class="stack">${field("Votre nom", input("", "Votre nom"))}${field("Adresse email", input("", "vous@exemple.fr"))}${field("Mot de passe", '<input type="password" placeholder="Choisissez un mot de passe">')}</div><p class="muted small gap">Aperçu du formulaire · n’utilisez pas vos identifiants réels.</p>`,
      btn("Créer mon espace", "demo-save", "primary", "arrow"),
    );
  } else if (a === "notification-tab") {
    b.parentElement
      .querySelectorAll("button")
      .forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    document
      .querySelectorAll(".notification")
      .forEach(
        (x) => (x.hidden = d === "Non lues" && !x.classList.contains("unread")),
      );
  } else if (a === "member-tab") {
    b.parentElement
      .querySelectorAll("button")
      .forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    if (d === "Invitations")
      modal(
        "Invitations",
        `<div class="list-row"><div class="grow"><strong>Invitation pour un observateur</strong><p class="muted small">Valable 7 jours · En attente</p></div>${btn("Copier le lien", "copy-invite", "small")}</div>`,
      );
  } else if (a === "agent-tab") {
    b.parentElement
      .querySelectorAll("button")
      .forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
  } else toast();
});
document.addEventListener("input", (e) => {
  if (e.target.id === "agent-search") {
    agentFilter = e.target.value;
    document.getElementById("agent-results").innerHTML =
      agents
        .filter((a) =>
          (a[0] + a[1]).toLowerCase().includes(agentFilter.toLowerCase()),
        )
        .map(agentCard)
        .join("") || '<p class="muted">Aucun agent trouvé.</p>';
  }
  if (e.target.id === "room-search") {
    const data = rooms.filter(
      (r) =>
        (roomFilter === "Toutes" || r[3] === roomFilter) &&
        r[0].toLowerCase().includes(e.target.value.toLowerCase()),
    );
    document.getElementById("room-results").innerHTML =
      layout === "grid"
        ? '<div class="room-grid">' + data.map(roomCard).join("") + "</div>"
        : roomTable(data);
  }
  if (e.target.id === "global-search") {
    document
      .querySelectorAll("#search-results a")
      .forEach(
        (a) =>
          (a.hidden = !a.textContent
            .toLowerCase()
            .includes(e.target.value.toLowerCase())),
      );
  }
  if (e.target.id === "chat-room-search") {
    document
      .querySelectorAll(".chat-room")
      .forEach(
        (a) =>
          (a.hidden = !a.textContent
            .toLowerCase()
            .includes(e.target.value.toLowerCase())),
      );
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "screen-select") go(e.target.value);
  if (e.target.id === "state-select") {
    stateView = e.target.value;
    render();
  }
});
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    search();
  }
});
window.addEventListener("hashchange", () => {
  view = location.hash.slice(1) || "dashboard";
  stateView = "normal";
  document.getElementById("dialog").close();
  render();
  window.scrollTo(0, 0);
});
render();

window.addEventListener("resize", () => {
  const side = document.querySelector(".sidebar");
  side.inert =
    window.matchMedia("(max-width:600px)").matches &&
    !side.classList.contains("open");
});
