// La page de suivi : une vue par onglet, tout passe par l'API du serveur local.
const vue = document.getElementById('vue');
const ETATS = { essai: 'Essai en cours', payant: 'Payant', parti: 'Parti', gratuit: 'Gratuit' };
const FILTRES = [['', 'Tous'], ['essai', 'Essai en cours'], ['payants', 'Payants'], ['partis', 'Partis'], ['onboarding', 'Onboarding non fini'], ['tests', 'Tests']];

const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const date = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');
const dateHeure = (d) => (d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

async function api(chemin, corps) {
  const options = corps ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-crm': '1' }, body: JSON.stringify(corps) } : {};
  const reponse = await fetch(`/api/${chemin}`, options);
  const donnees = await reponse.json();
  if (!reponse.ok) throw new Error(donnees.erreur ?? 'Erreur');
  return donnees;
}

async function copier(texte, bouton) {
  try { await navigator.clipboard.writeText(texte); bouton.textContent = 'Copié'; } catch { bouton.textContent = 'Copie refusée'; }
  setTimeout(() => { bouton.textContent = 'Copier'; }, 1500);
}

async function bandeau() {
  const b = document.getElementById('bandeau');
  try {
    const r = await api('reglages');
    const [classe, texte] = r.envois_coupes ? ['coupes', 'Envois coupés'] : r.a_blanc ? ['blanc', 'À blanc : rien ne part vraiment'] : ['actifs', 'Envois actifs'];
    b.className = `bandeau ${classe}`;
    b.textContent = texte;
  } catch {
    b.className = 'bandeau coupes';
    b.textContent = 'Base injoignable';
  }
}

async function aujourdhui() {
  const { actions } = await api('aujourdhui');
  vue.innerHTML = `<h1><span class="grand">${actions.length}</span> action${actions.length > 1 ? 's' : ''} ${actions.length > 1 ? 'restent' : 'reste'}</h1>
    <div class="carte"><p class="doux">${actions.length ? '' : 'Rien à faire pour l’instant. Les rappels de fin d’essai, les e-mails aux résiliés et les relances arriveront ici quand leur préparation sera en place.'}</p></div>`;
}

const recherche = { q: '', filtre: '' };
async function utilisateurs() {
  vue.innerHTML = `<h1>Utilisateurs</h1>
    <div class="outils"><input type="search" id="q" placeholder="E-mail, prénom ou identifiant RevenueCat" value="${echapper(recherche.q)}">
    ${FILTRES.map(([cle, nom]) => `<button data-filtre="${cle}" class="${recherche.filtre === cle ? 'choisi' : ''}">${nom}</button>`).join('')}
    <button id="recharger">Recharger</button></div>
    <p class="doux" id="compte">Chargement…</p><div class="carte" style="overflow-x:auto"><table><thead><tr>
    <th>Inscrit le</th><th>E-mail</th><th>Prénom</th><th>État</th><th>Rôle</th><th>Tournées</th><th>Langue</th></tr></thead><tbody id="lignes"></tbody></table></div>`;
  const remplir = async (frais = false) => {
    const params = new URLSearchParams({ q: recherche.q, filtre: recherche.filtre, ...(frais ? { frais: '1' } : {}) });
    const { total, trouves, lignes } = await api(`utilisateurs?${params}`);
    document.getElementById('compte').textContent = `${trouves} sur ${total} inscrits${trouves > lignes.length ? ` (les ${lignes.length} plus récents affichés)` : ''}`;
    document.getElementById('lignes').innerHTML = lignes.map((l) => `<tr data-id="${echapper(l.id)}">
      <td>${date(l.inscrit_le)}</td><td>${echapper(l.email)}${l.test ? ' <span class="puce">test</span>' : ''}</td><td>${echapper(l.prenom)}</td>
      <td><span class="puce ${l.etat}">${ETATS[l.etat]}</span></td><td>${echapper(l.role)}</td><td>${l.tournees}</td><td>${echapper(l.langue)}</td></tr>`).join('');
  };
  let minuterie;
  document.getElementById('q').addEventListener('input', (e) => { recherche.q = e.target.value; clearTimeout(minuterie); minuterie = setTimeout(() => remplir(), 250); });
  vue.querySelectorAll('[data-filtre]').forEach((b) => b.addEventListener('click', () => { recherche.filtre = b.dataset.filtre; utilisateurs(); }));
  document.getElementById('recharger').addEventListener('click', () => remplir(true));
  document.getElementById('lignes').addEventListener('click', (e) => { const tr = e.target.closest('tr'); if (tr) location.hash = `fiche-${encodeURIComponent(tr.dataset.id)}`; });
  await remplir();
}

async function fiche(id) {
  const f = await api(`fiche?id=${encodeURIComponent(id)}`);
  const faits = [['Inscrit le', date(f.inscrit_le)], ['État', ETATS[f.etat]], ['Formule', f.formule || '—'], ['Essai', f.essai_debut ? `du ${date(f.essai_debut)} au ${date(f.essai_fin)}` : '—'],
    ['Parti le', date(f.parti_le)], ['Langue', f.langue || '—'], ['Rôle', f.role || '—'], ['Besoins', (f.besoins ?? []).join(', ') || '—'],
    ['Onboarding', f.onboarding_fini ? 'fini' : 'non fini'], ['Paywall passé', f.paywall_passe ? 'oui' : 'non'], ['Tournées', f.tournees], ['Contacts', f.contacts], ['Visites', f.visites], ['Dernier signe', dateHeure(f.dernier_signe)]];
  const wa = f.telephone ? `https://wa.me/${f.telephone.replace(/[^\d]/g, '')}` : '';
  vue.innerHTML = `<a href="#utilisateurs" class="doux">← Utilisateurs</a>
    <h1>${echapper(f.prenom || f.email)} <span class="puce ${f.etat}">${ETATS[f.etat]}</span>${f.test ? ' <span class="puce">test</span>' : ''}</h1>
    <div class="carte"><h2>Coordonnées</h2><dl class="grille">
      <dt>E-mail</dt><dd>${echapper(f.email)} <button data-copier="${echapper(f.email)}">Copier</button></dd>
      <dt>Téléphone</dt><dd>${f.telephone ? `${echapper(f.telephone)} <button data-copier="${echapper(f.telephone)}">Copier</button> <a class="bouton" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>` : '—'}</dd>
      <dt>Prénom</dt><dd><input type="text" id="prenom" value="${echapper(f.prenom)}" maxlength="60" placeholder="À retrouver"> <span class="message" id="msg-prenom"></span></dd>
      <dt>Identifiant RevenueCat</dt><dd>${f.rc ? `<code>${echapper(f.rc)}</code> <button data-copier="${echapper(f.rc)}">Copier</button>` : '—'}</dd>
    </dl></div>
    <div class="carte"><h2>Faits</h2><dl class="grille">${faits.map(([k, v]) => `<dt>${k}</dt><dd>${echapper(v)}</dd>`).join('')}</dl></div>`;
  vue.querySelectorAll('[data-copier]').forEach((b) => b.addEventListener('click', () => copier(b.dataset.copier, b)));
  const champ = document.getElementById('prenom');
  const msg = document.getElementById('msg-prenom');
  champ.addEventListener('change', async () => {
    try { champ.value = (await api('prenom', { id: f.id, prenom: champ.value })).prenom; msg.className = 'message'; msg.textContent = 'Enregistré'; }
    catch (e) { msg.className = 'message erreur'; msg.textContent = e.message; }
  });
}

async function journal() {
  const { lignes } = await api('journal');
  vue.innerHTML = `<h1>Journal</h1><div class="carte">${lignes.length ? `<table><thead><tr><th>Quand</th><th>Quoi</th><th>Identifiant RevenueCat</th></tr></thead><tbody>
    ${lignes.map((l) => `<tr><td>${dateHeure(l.le)}</td><td>${echapper(l.quoi)}</td><td>${echapper(l.rc ?? '')}</td></tr>`).join('')}</tbody></table>` : '<p class="doux">Rien encore.</p>'}</div>`;
}

async function reglages() {
  const r = await api('reglages');
  vue.innerHTML = `<h1>Réglages</h1>
    <div class="carte"><h2>Envois</h2>
      <p>${r.envois_coupes ? 'Tous les envois sont <strong>coupés</strong>.' : 'Les envois sont ouverts.'}</p>
      <div class="outils"><button id="coupe" class="${r.envois_coupes ? '' : 'danger'}">${r.envois_coupes ? 'Rétablir les envois' : 'Couper tous les envois'}</button></div></div>
    <div class="carte"><h2>Mode à blanc</h2><p>${r.a_blanc ? 'À blanc : tout se passe comme un envoi, sauf l’envoi lui-même.' : 'Les envois partent vraiment.'}</p>
      <div class="outils"><button id="blanc">${r.a_blanc ? 'Passer en envois réels' : 'Repasser à blanc'}</button></div></div>`;
  const coupe = document.getElementById('coupe');
  let confirme = false;
  coupe.addEventListener('click', async () => {
    if (r.envois_coupes && !confirme) { confirme = true; coupe.textContent = 'Confirmer : rétablir les envois'; return; }
    await api('reglages', { cle: 'envois_coupes', valeur: !r.envois_coupes }); await bandeau(); reglages();
  });
  document.getElementById('blanc').addEventListener('click', async () => { await api('reglages', { cle: 'a_blanc', valeur: !r.a_blanc }); await bandeau(); reglages(); });
}

async function afficher() {
  const cle = location.hash.slice(1) || 'aujourdhui';
  const nom = cle.startsWith('fiche-') ? 'utilisateurs' : cle;
  document.querySelectorAll('[data-vue]').forEach((a) => a.classList.toggle('actif', a.dataset.vue === nom));
  vue.innerHTML = '<p class="doux">Chargement…</p>';
  try {
    if (cle.startsWith('fiche-')) await fiche(decodeURIComponent(cle.slice(6)));
    else await ({ aujourdhui, utilisateurs, journal, reglages }[cle] ?? aujourdhui)();
  } catch (e) {
    vue.innerHTML = `<div class="carte"><p class="message erreur">${echapper(e.message)}</p><p class="doux">Si la base ne répond pas, la connexion Google du Mac a peut-être expiré : <code>gcloud auth application-default login</code>.</p></div>`;
  }
}

window.addEventListener('hashchange', afficher);
bandeau();
afficher();
