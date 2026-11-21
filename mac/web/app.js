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

const TYPES = { essai_j2: 'Fin d’essai', resiliation: 'Résiliation', onboarding: 'Onboarding abandonné', gros: 'Gros utilisateur', campagne_relance: 'Relance de campagne', libre: 'Message' };
const ORDRE = ['essai_j2', 'resiliation', 'onboarding', 'gros', 'campagne_relance', 'libre'];
const resteAvant = (d) => { if (!d) return ''; const h = Math.round((new Date(d) - Date.now()) / 3600000); return h < 0 ? 'échéance passée' : h < 48 ? `il reste ${h} h` : `il reste ${Math.round(h / 24)} j`; };

async function aujourdhui() {
  const { actions } = await api('aujourdhui');
  const groupes = ORDRE.map((type) => [type, actions.filter((a) => a.type === type)]).filter(([, l]) => l.length);
  vue.innerHTML = `<div class="outils"><h1><span class="grand">${actions.length}</span> action${actions.length > 1 ? 's' : ''} ${actions.length > 1 ? 'restent' : 'reste'}</h1>
      <button id="preparer">Préparer maintenant</button><span class="message" id="msg-preparer"></span></div>
    ${groupes.length ? groupes.map(([type, liste]) => `<div class="carte"><h2>${TYPES[type] ?? type} (${liste.length})</h2><table><tbody>
      ${liste.map((a) => `<tr data-action="${echapper(a.id)}"><td>${echapper(a.sujet)}</td><td>${echapper(a.langue ?? '')}${a.variante ? ` · ${echapper(a.variante)}` : ''}</td><td>${resteAvant(a.echeance)}</td></tr>`).join('')}
      </tbody></table></div>`).join('') : '<div class="carte"><p class="doux">Rien à faire pour l’instant. Les rappels de fin d’essai et les e-mails aux résiliés arrivent ici à chaque passe, toutes les heures.</p></div>'}`;
  vue.querySelectorAll('[data-action]').forEach((tr) => tr.addEventListener('click', () => { location.hash = `action-${encodeURIComponent(tr.dataset.action)}`; }));
  document.getElementById('preparer').addEventListener('click', async () => {
    const msg = document.getElementById('msg-preparer');
    try { const r = await api('preparer', {}); msg.textContent = r.raison ? r.raison : `${r.creees} nouvelle(s), ${r.expirees} expirée(s)`; if (r.creees || r.expirees) setTimeout(aujourdhui, 800); }
    catch (e) { msg.className = 'message erreur'; msg.textContent = e.message; }
  });
}

async function uneAction(id) {
  const a = await api(`action?id=${encodeURIComponent(id)}`);
  const ouverte = ['prete', 'reportee'].includes(a.statut);
  vue.innerHTML = `<a href="#aujourdhui" class="doux">← Aujourd'hui</a>
    <h1>${TYPES[a.type] ?? a.type} <span class="puce">${echapper(a.statut)}</span></h1>
    <div class="carte"><dl class="grille"><dt>Pour</dt><dd><a href="#fiche-${encodeURIComponent(a.user_id)}">${echapper(a.user_id)}</a></dd>
      <dt>Échéance</dt><dd>${dateHeure(a.echeance)} (${resteAvant(a.echeance)})</dd><dt>Langue</dt><dd>${echapper(a.langue ?? '')}${a.variante ? ` · ${echapper(a.variante)}` : ''}</dd></dl></div>
    <div class="carte"><h2>Le texte</h2>
      <input type="text" id="sujet" value="${echapper(a.sujet)}" ${ouverte ? '' : 'disabled'}>
      <textarea id="corps" rows="16" ${ouverte ? '' : 'disabled'}>${echapper(a.corps)}</textarea>
      <p class="doux">Le pied « répondez STOP » est ajouté à l’envoi.</p>
      ${ouverte ? `<div class="outils"><button id="enregistrer">Enregistrer le texte</button><button id="essai">M’envoyer un essai</button>
        <button id="envoyer" class="choisi">Envoyer</button><button id="reporter">Plus tard</button><button id="ignorer">Ignorer</button></div>` : ''}
      <p class="message" id="msg-action"></p></div>`;
  if (!ouverte) return;
  const msg = document.getElementById('msg-action');
  const dire = (texte, erreur = false) => { msg.className = erreur ? 'message erreur' : 'message'; msg.textContent = texte; };
  const STATUTS = { envoye: 'Envoyé.', a_blanc: 'À blanc : noté dans le journal, rien n’est parti.', bloquee: 'Bloqué', erreur: 'Erreur' };
  document.getElementById('enregistrer').addEventListener('click', async () => {
    try { await api('action', { id: a.id, op: 'texte', sujet: document.getElementById('sujet').value, corps: document.getElementById('corps').value }); dire('Texte enregistré.'); }
    catch (e) { dire(e.message, true); }
  });
  const envoyer = async (canal) => {
    try { const r = await api('envoyer', { actionId: a.id, canal }); dire(`${STATUTS[r.statut] ?? r.statut}${r.raison ? ` : ${r.raison}` : ''}`, ['bloquee', 'erreur'].includes(r.statut)); if (canal === 'email' && ['envoye', 'a_blanc'].includes(r.statut)) setTimeout(() => uneAction(a.id), 1200); }
    catch (e) { dire(e.message, true); }
  };
  document.getElementById('essai').addEventListener('click', () => envoyer('test_moi'));
  let confirme = false;
  document.getElementById('envoyer').addEventListener('click', (e) => {
    if (!confirme) { confirme = true; e.target.textContent = 'Confirmer l’envoi'; return; }
    envoyer('email');
  });
  document.getElementById('reporter').addEventListener('click', async () => { await api('action', { id: a.id, op: 'reporter' }); location.hash = 'aujourdhui'; });
  document.getElementById('ignorer').addEventListener('click', async () => { await api('action', { id: a.id, op: 'ignorer' }); location.hash = 'aujourdhui'; });
}

const recherche = { q: '', filtre: '' };
async function utilisateurs() {
  vue.innerHTML = `<h1>Utilisateurs</h1>
    <div class="outils"><input type="search" id="q" placeholder="E-mail, prénom ou identifiant RevenueCat" value="${echapper(recherche.q)}">
    ${FILTRES.map(([cle, nom]) => `<button data-filtre="${cle}" class="${recherche.filtre === cle ? 'choisi' : ''}">${nom}</button>`).join('')}
    <button id="recharger">Recharger</button></div>
    <p class="doux" id="compte">Chargement…</p><div class="carte defile"><table><thead><tr>
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
    <div class="carte"><h2>E-mails</h2><p id="etat-desinscription" class="doux">…</p>
      <div class="outils"><button id="desinscrire" class="danger" hidden>Désinscrire</button></div></div>
    <div class="carte"><h2>Faits</h2><dl class="grille">${faits.map(([k, v]) => `<dt>${k}</dt><dd>${echapper(v)}</dd>`).join('')}</dl></div>`;
  vue.querySelectorAll('[data-copier]').forEach((b) => b.addEventListener('click', () => copier(b.dataset.copier, b)));
  const etatDesinscription = document.getElementById('etat-desinscription');
  const boutonDesinscrire = document.getElementById('desinscrire');
  const { desinscrit } = await api(`desinscrit?id=${encodeURIComponent(f.id)}`);
  etatDesinscription.textContent = desinscrit ? 'Désinscrit : plus aucun e-mail ne partira.' : 'Reçoit les e-mails d’Easy Way.';
  boutonDesinscrire.hidden = desinscrit;
  let confirmeDesinscription = false;
  boutonDesinscrire.addEventListener('click', async () => {
    if (!confirmeDesinscription) { confirmeDesinscription = true; boutonDesinscrire.textContent = 'Confirmer : désinscrire pour de bon'; return; }
    await api('desinscrire', { id: f.id });
    etatDesinscription.textContent = 'Désinscrit : plus aucun e-mail ne partira.';
    boutonDesinscrire.hidden = true;
  });
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
      <div class="outils"><button id="blanc">${r.a_blanc ? 'Passer en envois réels' : 'Repasser à blanc'}</button></div></div>
    <div class="carte"><h2>Expéditeur</h2><dl class="grille">
      ${[['expediteur', 'Expéditeur', 'Prénom d’Easy Way <adresse@domaine-de-l-app>'], ['repondre_a', 'Réponses à', 'ton adresse'], ['adresse_test', 'Adresse de test', 'reçoit les essais et les utilisateurs de test'], ['signature', 'Signature', 'Prénom, créateur d’Easy Way']]
        .map(([cle, nom, aide]) => `<dt>${nom}</dt><dd><input type="text" data-reglage="${cle}" value="${echapper(r[cle] ?? '')}" placeholder="${aide}"> <span class="message" data-msg="${cle}"></span></dd>`).join('')}
      <dt>Plafond par jour</dt><dd><input type="text" data-reglage="plafond_jour" value="${r.plafond_jour ?? 90}" class="petit"> <span class="message" data-msg="plafond_jour"></span></dd>
    </dl><p class="doux">Sans les trois adresses, aucun e-mail ne part ; sans signature, rien n’est préparé.</p></div>`;
  vue.querySelectorAll('[data-reglage]').forEach((champ) => champ.addEventListener('change', async () => {
    const cle = champ.dataset.reglage;
    const msg = vue.querySelector(`[data-msg="${cle}"]`);
    try { await api('reglages', { cle, valeur: cle === 'plafond_jour' ? Number(champ.value) : champ.value }); msg.className = 'message'; msg.textContent = 'Enregistré'; }
    catch (e) { msg.className = 'message erreur'; msg.textContent = e.message; }
  }));
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
  const nom = cle.startsWith('fiche-') ? 'utilisateurs' : cle.startsWith('action-') ? 'aujourdhui' : cle;
  document.querySelectorAll('[data-vue]').forEach((a) => a.classList.toggle('actif', a.dataset.vue === nom));
  vue.innerHTML = '<p class="doux">Chargement…</p>';
  try {
    if (cle.startsWith('fiche-')) await fiche(decodeURIComponent(cle.slice(6)));
    else if (cle.startsWith('action-')) await uneAction(decodeURIComponent(cle.slice(7)));
    else await ({ aujourdhui, utilisateurs, journal, reglages }[cle] ?? aujourdhui)();
  } catch (e) {
    vue.innerHTML = `<div class="carte"><p class="message erreur">${echapper(e.message)}</p><p class="doux">Si la base ne répond pas, la connexion Google du Mac a peut-être expiré : <code>gcloud auth application-default login</code>.</p></div>`;
  }
}

window.addEventListener('hashchange', afficher);
bandeau();
afficher();
