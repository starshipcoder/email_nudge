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
    // La santé de la dernière passe (audit du 22/11) : une passe en échec ou trop ancienne se voit ici.
    const sante = await api('sante').catch(() => ({}));
    const vieille = !sante.le || Date.now() - new Date(sante.le).getTime() > 2 * 3600000;
    const souci = vieille ? 'pas de passe depuis plus de 2 h' : sante.ok === false ? (sante.problemes ?? []).join(', ') : '';
    b.className = `bandeau ${souci ? 'coupes' : classe}`;
    b.textContent = `${texte} · ${souci ? `Attention : ${souci}` : `dernière passe ${dateHeure(sante.le)}`}`;
  } catch {
    b.className = 'bandeau coupes';
    b.textContent = 'Base injoignable';
  }
}

const TYPES = { essai_j2: 'Fin d’essai', resiliation: 'Résiliation', essai_annule: 'Essai annulé', onboarding: 'Onboarding abandonné', bienvenue: 'Bienvenue', gros: 'Gros utilisateur', campagne_relance: 'Relance de campagne', bug_corrige: 'Bug corrigé', demande_avis: 'Demande d’avis', libre: 'Message' };
const ORDRE = ['essai_j2', 'resiliation', 'essai_annule', 'bug_corrige', 'demande_avis', 'bienvenue', 'onboarding', 'gros', 'campagne_relance', 'libre'];
const resteAvant = (d) => { if (!d) return ''; const h = Math.round((new Date(d) - Date.now()) / 3600000); return h < 0 ? 'échéance passée' : h < 48 ? `il reste ${h} h` : `il reste ${Math.round(h / 24)} j`; };

async function aujourdhui() {
  const [{ actions, reponses = [] }, reglagesActuels] = await Promise.all([api('aujourdhui'), api('reglages').catch(() => ({}))]);
  const enEssai = new Set(reglagesActuels.en_essai ?? []);
  const groupes = ORDRE.map((type) => [type, actions.filter((a) => a.type === type)]).filter(([, l]) => l.length);
  vue.innerHTML = `<div class="outils"><h1><span class="grand">${actions.length}</span> action${actions.length > 1 ? 's' : ''} ${actions.length > 1 ? 'restent' : 'reste'}</h1>
      <button id="preparer">Préparer maintenant</button><span class="message" id="msg-preparer"></span></div>
    ${reponses.length ? `<div class="carte"><h2>Réponses à lire (${reponses.length})</h2><table><tbody>
      ${reponses.map((m) => `<tr><td><a href="#fiche-${encodeURIComponent(m.user_id ?? '')}">${echapper(m.user_id ?? '')}</a></td><td>${echapper(m.extrait)}</td><td>${dateHeure(m.le)}</td>
        <td><button data-lu="${echapper(m.id)}">Lu</button></td></tr>`).join('')}</tbody></table></div>` : ''}
    ${groupes.length ? groupes.map(([type, liste]) => `<div class="carte"><h2>${TYPES[type] ?? type} (${liste.length})${enEssai.has(type) ? ' <span class="puce">En essai : ne part pas</span>' : ''}</h2><table><tbody>
      ${liste.map((a) => `<tr data-action="${echapper(a.id)}"><td>${echapper(a.sujet)}</td><td>${echapper(a.langue ?? '')}${a.variante ? ` · ${echapper(a.variante)}` : ''}</td><td>${resteAvant(a.echeance)}</td></tr>`).join('')}
      </tbody></table></div>`).join('') : '<div class="carte"><p class="doux">Rien à faire pour l’instant. Les rappels de fin d’essai et les e-mails aux résiliés arrivent ici à chaque passe, toutes les heures.</p></div>'}`;
  vue.querySelectorAll('[data-action]').forEach((tr) => tr.addEventListener('click', () => { location.hash = `action-${encodeURIComponent(tr.dataset.action)}`; }));
  vue.querySelectorAll('[data-lu]').forEach((b) => b.addEventListener('click', async () => { await api('reponse-lue', { id: b.dataset.lu }); aujourdhui(); }));
  document.getElementById('preparer').addEventListener('click', async () => {
    const msg = document.getElementById('msg-preparer');
    try { const r = await api('preparer', {}); msg.textContent = r.raison ? r.raison : `${r.creees} nouvelle(s), ${r.expirees} expirée(s)`; if (r.creees || r.expirees) setTimeout(aujourdhui, 800); }
    catch (e) { msg.className = 'message erreur'; msg.textContent = e.message; }
  });
}

// Le dossier d'une personne : ce qui ressort de son usage, sa réponse au questionnaire, une piste de question.
function carteDossier(resume, { question = true } = {}) {
  if (!resume) return '<div class="carte"><h2>Dossier</h2><p class="doux">Pas de dossier : pas d’identifiant RevenueCat, ou la base Mixpanel du Mac est absente.</p></div>';
  const max = Math.max(1, ...resume.semaines);
  const barres = resume.semaines.map((n) => `<span class="barre-semaine h${Math.round((n / max) * 4)}" title="${n} jour(s) actif(s)"></span>`).join('');
  const aJour = resume.a_jour ?? { texte: 'Date des données inconnue (dossier d’avant le 22/11).', en_retard: true };
  return `<div class="carte"><h2>Dossier</h2><p class="${aJour.en_retard ? 'message erreur' : 'doux'}">${echapper(aJour.texte)}</p>
    <ul>${resume.faits.map((f) => `<li>${echapper(f)}</li>`).join('')}</ul>
    <p class="doux">Jours actifs par semaine, 12 dernières semaines :</p><div class="semaines">${barres}</div>
    ${question ? `<p><strong>Question à lui poser :</strong> ${echapper(resume.question)}</p>` : ''}</div>`;
}

// Les questions tirées de l'usage (EW-46) : la question en français pour le fondateur, l'événement qui la fonde, et un
// bouton qui la met dans l'e-mail (sur une action) ou la copie (sur la fiche), dans la langue de la personne.
function carteQuestions(questions, { titre = 'Questions tirées de son usage', bouton = 'Copier' } = {}) {
  if (!questions?.length) return '';
  return `<div class="carte"><h2>${echapper(titre)}</h2><table><tbody>
    ${questions.map((q, i) => `<tr><td>${echapper(q.texte_fr)}${q.texte !== q.texte_fr ? `<br><span class="doux">${echapper(q.texte)}</span>` : ''}</td>
      <td class="doux">${echapper(q.appui?.evenement ?? '')} : ${echapper(q.appui?.n ?? '')}</td>
      <td><button data-question="${i}">${echapper(bouton)}</button></td></tr>`).join('')}</tbody></table></div>`;
}

async function uneAction(id) {
  const [a, reglagesActuels] = await Promise.all([api(`action?id=${encodeURIComponent(id)}`), api('reglages').catch(() => ({}))]);
  const ouverte = ['prete', 'reportee'].includes(a.statut);
  const essai = (reglagesActuels.en_essai ?? []).includes(a.type);
  vue.innerHTML = `<a href="#aujourdhui" class="doux">← Aujourd'hui</a>
    <h1>${TYPES[a.type] ?? a.type} <span class="puce">${echapper(a.statut)}</span>${essai ? ' <span class="puce">En essai</span>' : ''}</h1>
    ${essai ? '<div class="carte"><p class="message">En essai : cet e-mail ne part pas à la personne. « M’envoyer un essai » marche. Pour l’envoyer, rends cette sorte aux utilisateurs dans les Réglages.</p></div>' : ''}
    <div class="carte"><dl class="grille"><dt>Pour</dt><dd><a href="#fiche-${encodeURIComponent(a.user_id)}">${echapper(a.user_id)}</a></dd>
      <dt>Échéance</dt><dd>${dateHeure(a.echeance)} (${resteAvant(a.echeance)})</dd><dt>Langue</dt><dd>${echapper(NOMS_LANGUES[a.langue] ?? a.langue ?? '')}${a.langue_source ? ` (${echapper(SOURCES_LANGUE[a.langue_source] ?? a.langue_source)}${a.pays ? ` : ${echapper(a.pays)}` : ''})` : ''}${a.variante ? ` · ${echapper(a.variante)}` : ''}</dd></dl></div>
    ${a.a_verifier ? `<div class="carte"><p class="message erreur">À vérifier avant l’envoi : ${echapper(a.a_verifier)}.</p>${ouverte ? '<div class="outils"><button id="verifie">C’est vérifié, le texte peut partir</button></div>' : ''}</div>` : ''}
    ${a.derniere_erreur ? `<div class="carte"><p class="message erreur">Le dernier envoi a échoué, rien n’est parti : ${echapper(a.derniere_erreur)}. Tu peux réessayer.</p></div>` : ''}
    <div id="dossier-action"></div>
    ${ouverte ? carteQuestions(a.questions, { bouton: 'Copier dans l’e-mail' }) : ''}
    <div class="carte"><h2>Le texte</h2>
      <input type="text" id="sujet" value="${echapper(a.sujet)}" ${ouverte ? '' : 'disabled'}>
      <textarea id="corps" rows="16" ${ouverte ? '' : 'disabled'}>${echapper(a.corps)}</textarea>
      <p class="doux">À l’envoi, la ligne WhatsApp est ajoutée à la fin, dans sa langue, si ton numéro est réglé.</p>
      ${ouverte ? `<div class="outils"><button id="enregistrer">Enregistrer le texte</button>${['resiliation', 'essai_annule'].includes(a.type) ? '<button id="rebrouillon">Refaire le brouillon depuis le dossier</button>' : ''}<button id="essai">M’envoyer un essai</button>
        <button id="envoyer" class="choisi"${essai ? ' disabled title="En essai : ne part pas aux utilisateurs"' : ''}>Envoyer à la personne</button><button id="reporter">Plus tard</button><button id="ignorer">Ignorer</button></div>` : ''}
      <p class="message" id="msg-action"></p></div>
    ${a.traduction_fr ? `<div class="carte"><h2>Traduction en français, pour relire</h2>
      <input type="text" value="${echapper(a.traduction_fr.sujet)}" readonly>
      <textarea rows="16" readonly>${echapper(a.traduction_fr.corps)}</textarea>
      <p class="doux">Seul le texte du dessus part. Pour changer un e-mail dans une autre langue, demande-le en session : les deux textes sont corrigés ensemble.</p></div>` : ''}`;
  const zoneDossier = document.getElementById('dossier-action');
  // La question de départ du dossier ne vaut pas pour qui reste : les questions d'un gros utilisateur sont à part.
  if (a.resume) zoneDossier.innerHTML = carteDossier(a.resume, { question: !['gros', 'onboarding'].includes(a.type) });
  else api(`dossier?id=${encodeURIComponent(a.user_id)}`).then((r) => { zoneDossier.innerHTML = carteDossier(r.resume); }).catch(() => {});
  if (!ouverte) return;
  const msg = document.getElementById('msg-action');
  document.getElementById('verifie')?.addEventListener('click', async () => {
    try { await api('action', { id: a.id, op: 'verifie' }); await uneAction(a.id); } catch (e) { msg.className = 'message erreur'; msg.textContent = e.message; }
  });
  document.getElementById('rebrouillon')?.addEventListener('click', async () => {
    try { await api('rebrouillon', { id: a.id }); await uneAction(a.id); document.getElementById('msg-action').textContent = 'Brouillon refait depuis le dossier : relis-le avant d’envoyer.'; }
    catch (e) { dire(e.message, true); }
  });
  const dire = (texte, erreur = false) => { msg.className = erreur ? 'message erreur' : 'message'; msg.textContent = texte; };
  // Une question ajoutée là où est le curseur dans le texte (à la fin sinon), en ligne de liste comme les autres.
  vue.querySelectorAll('[data-question]').forEach((b) => b.addEventListener('click', () => {
    const q = a.questions[Number(b.dataset.question)]; const zone = document.getElementById('corps');
    const ici = zone.selectionStart ?? zone.value.length;
    const avant = zone.value.slice(0, ici); const ligne = `${avant && !avant.endsWith('\n') ? '\n' : ''}- ${q.texte}\n`;
    zone.value = `${avant}${ligne}${zone.value.slice(ici)}`;
    zone.focus(); zone.selectionStart = zone.selectionEnd = ici + ligne.length;
    dire('Question ajoutée au texte : il est enregistré à l’envoi.');
  }));
  const STATUTS = { envoye: 'Envoyé.', a_blanc: 'À blanc : noté dans le journal, rien n’est parti.', bloquee: 'Bloqué', erreur: 'Erreur' };
  document.getElementById('enregistrer').addEventListener('click', async () => {
    try { await api('action', { id: a.id, op: 'texte', sujet: document.getElementById('sujet').value, corps: document.getElementById('corps').value }); dire('Texte enregistré.'); }
    catch (e) { dire(e.message, true); }
  });
  // Le texte affiché, enregistré avant un envoi s'il a changé : ce qu'on voit est ce qui part.
  const garderTexte = async () => {
    const sujet = document.getElementById('sujet').value; const corps = document.getElementById('corps').value;
    if (sujet === a.sujet && corps === a.corps) return true;
    if (!sujet.trim() || !corps.trim()) { dire('Le sujet et le texte ne peuvent pas être vides.', true); return false; }
    await api('action', { id: a.id, op: 'texte', sujet, corps }); a.sujet = sujet; a.corps = corps;
    return true;
  };
  const envoyer = async (canal) => {
    try { const r = await api('envoyer', { actionId: a.id, canal }); dire(`${STATUTS[r.statut] ?? r.statut}${r.raison ? ` : ${r.raison}` : ''}`, ['bloquee', 'erreur'].includes(r.statut)); if (canal === 'email' && ['envoye', 'a_blanc'].includes(r.statut)) setTimeout(() => uneAction(a.id), 1200); }
    catch (e) { dire(e.message, true); }
  };
  document.getElementById('essai').addEventListener('click', async () => { try { if (await garderTexte()) await envoyer('test_moi'); } catch (e) { dire(e.message, true); } });
  // Un clic : le texte affiché est enregistré s'il a changé, puis 5 secondes pour annuler avant que l'e-mail parte.
  const bouton = document.getElementById('envoyer');
  let compte = null;
  const arreter = () => { clearInterval(compte); compte = null; bouton.textContent = 'Envoyer à la personne'; bouton.classList.remove('danger'); };
  bouton.textContent = 'Envoyer à la personne';
  bouton.addEventListener('click', async () => {
    if (compte) { arreter(); dire('Annulé : rien n’est parti.'); return; }
    try { if (!(await garderTexte())) return; } catch (e) { dire(e.message, true); return; }
    let reste = 5;
    bouton.classList.add('danger');
    const montrer = () => { bouton.textContent = `Annuler (${reste})`; dire(`L’e-mail part dans ${reste} seconde${reste > 1 ? 's' : ''}. Clique sur « Annuler » pour l’arrêter.`); };
    montrer();
    compte = setInterval(() => {
      reste -= 1;
      if (reste > 0) return montrer();
      arreter(); bouton.disabled = true; dire('Envoi en cours…');
      envoyer('email').finally(() => { bouton.disabled = false; });
    }, 1000);
  });
  document.getElementById('reporter').addEventListener('click', async () => { await api('action', { id: a.id, op: 'reporter' }); location.hash = 'aujourdhui'; });
  document.getElementById('ignorer').addEventListener('click', async () => { await api('action', { id: a.id, op: 'ignorer' }); location.hash = 'aujourdhui'; });
}

const recherche = { q: '', filtre: '', tout: false };
async function utilisateurs() {
  vue.innerHTML = `<h1>Utilisateurs</h1>
    <div class="outils"><input type="search" id="q" placeholder="E-mail, prénom ou identifiant RevenueCat" value="${echapper(recherche.q)}">
    ${FILTRES.map(([cle, nom]) => `<button data-filtre="${cle}" class="${recherche.filtre === cle ? 'choisi' : ''}">${nom}</button>`).join('')}
    <button id="tout" class="${recherche.tout ? 'choisi' : ''}">${recherche.tout ? 'Les 50 plus récents' : 'Tout afficher'}</button>
    <button id="recharger">Recharger</button></div>
    <p class="doux" id="compte">Chargement…</p><div class="carte defile"><table><thead><tr>
    <th>Inscrit le</th><th>E-mail</th><th>Prénom</th><th>État</th><th>Rôle</th><th>Tournées</th><th>Langue</th></tr></thead><tbody id="lignes"></tbody></table></div>`;
  const remplir = async (frais = false) => {
    const params = new URLSearchParams({ q: recherche.q, filtre: recherche.filtre, ...(recherche.tout ? { tout: '1' } : {}), ...(frais ? { frais: '1' } : {}) });
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
  document.getElementById('tout').addEventListener('click', () => { recherche.tout = !recherche.tout; utilisateurs(); });
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
      <dt>Langue des e-mails</dt><dd><span id="langue-texte" class="doux">…</span>
        <select id="langue-choix"><option value="">automatique</option>${Object.entries(NOMS_LANGUES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <span class="message" id="msg-langue"></span></dd>
      <dt>Identifiant RevenueCat</dt><dd>${f.rc ? `<code>${echapper(f.rc)}</code> <button data-copier="${echapper(f.rc)}">Copier</button>` : '—'}</dd>
    </dl></div>
    <div class="carte"><h2>E-mails</h2><p id="etat-desinscription" class="doux">…</p>
      <div class="outils"><button id="desinscrire" class="danger" hidden>Désinscrire</button></div></div>
    <div id="dossier-fiche"></div>
    <div class="carte"><h2>Échanges</h2>
      <div class="outils"><button id="a-repondu">A répondu</button><button id="wa-recu">Réponse WhatsApp</button><span class="message" id="msg-fil"></span></div>
      <div id="wa-zone" hidden><textarea id="wa-texte" rows="3" placeholder="Coller la réponse reçue sur WhatsApp"></textarea>
        <div class="outils"><button id="wa-noter" class="choisi">Noter la réponse</button></div></div>
      <div id="fil" class="doux">…</div></div>
    <div class="carte"><h2>Faits</h2><dl class="grille">${faits.map(([k, v]) => `<dt>${k}</dt><dd>${echapper(v)}</dd>`).join('')}</dl></div>`;
  vue.querySelectorAll('[data-copier]').forEach((b) => b.addEventListener('click', () => copier(b.dataset.copier, b)));
  const SOURCES = { gmail: 'Gmail', whatsapp: 'WhatsApp' };
  const remplirFil = async () => {
    const { lignes } = await api(`fil?id=${encodeURIComponent(f.id)}`);
    document.getElementById('fil').innerHTML = lignes.length ? `<table><tbody>${lignes.map((l) => `<tr><td>${dateHeure(l.le)}</td><td>${l.sens === 'recu' ? 'reçu' : 'envoyé'} · ${echapper(SOURCES[l.source] ?? l.source)}</td>
      <td><strong>${echapper(l.sujet)}</strong><br>${echapper(l.extrait)}</td></tr>`).join('')}</tbody></table>` : 'Aucun échange noté.';
  };
  const msgFil = document.getElementById('msg-fil');
  document.getElementById('a-repondu').addEventListener('click', async () => { await api('repondu', { id: f.id }); msgFil.textContent = 'Noté : a répondu.'; });
  document.getElementById('wa-recu').addEventListener('click', () => { document.getElementById('wa-zone').hidden = false; });
  document.getElementById('wa-noter').addEventListener('click', async () => {
    try { await api('message', { id: f.id, sens: 'recu', source: 'whatsapp', extrait: document.getElementById('wa-texte').value }); document.getElementById('wa-zone').hidden = true; msgFil.textContent = 'Réponse notée.'; await remplirFil(); }
    catch (e) { msgFil.className = 'message erreur'; msgFil.textContent = e.message; }
  });
  vue.querySelector('a.bouton[href^="https://wa.me/"]')?.addEventListener('click', () => { api('message', { id: f.id, sens: 'envoye', source: 'whatsapp' }).then(remplirFil).catch(() => {}); });
  remplirFil().catch(() => { document.getElementById('fil').textContent = 'Fil illisible.'; });
  const choixLangue = document.getElementById('langue-choix');
  const lireDossierFiche = () => api(`dossier?id=${encodeURIComponent(f.id)}`).then((r) => {
    const zone = document.getElementById('dossier-fiche');
    zone.innerHTML = carteDossier(r.resume, { question: !r.gros }) + (r.questions?.length >= 3
      ? carteQuestions(r.questions, { titre: r.gros ? 'Gros utilisateur : questions tirées de son usage' : 'Questions tirées de son usage', bouton: 'Copier' }) : '');
    zone.querySelectorAll('[data-question]').forEach((b) => b.addEventListener('click', () => copier(r.questions[Number(b.dataset.question)].texte, b)));
    document.getElementById('langue-texte').textContent = r.langue?.texte ?? '';
    choixLangue.value = r.langue?.choix ?? '';
  }).catch(() => {});
  lireDossierFiche();
  choixLangue.addEventListener('change', async () => {
    const msg = document.getElementById('msg-langue');
    try { await api('langue', { id: f.id, langue: choixLangue.value }); msg.className = 'message'; msg.textContent = 'Enregistré : vaut pour les prochaines actions'; lireDossierFiche(); }
    catch (e) { msg.className = 'message erreur'; msg.textContent = e.message; }
  });
  const etatDesinscription = document.getElementById('etat-desinscription');
  const boutonDesinscrire = document.getElementById('desinscrire');
  const { desinscrit, plainte, rebond } = await api(`desinscrit?id=${encodeURIComponent(f.id)}`);
  etatDesinscription.textContent = desinscrit ? `Désinscrit${plainte ? ' après une plainte pour courrier indésirable' : ''} : plus aucun e-mail ne partira.`
    : rebond ? 'Adresse en rebond : un e-mail n’a pas été reçu, plus aucun ne partira.' : 'Reçoit les e-mails d’Easy Way.';
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
    <div class="carte"><h2>Notifications sur le téléphone</h2><p>${r.notif_telephone === false ? 'Coupées.' : 'Ouvertes : une action à relire, une réponse ou une passe en échec sonnent par ntfy, sans aucune adresse ni nom.'}</p>
      <div class="outils"><button id="notif">${r.notif_telephone === false ? 'Rouvrir les notifications' : 'Couper les notifications'}</button></div></div>
    <div class="carte"><h2>Les e-mails automatiques</h2>
      <p class="doux">En essai : l’e-mail se prépare dans Aujourd’hui sur de vraies personnes et « M’envoyer un essai » marche, mais il ne part pas aux utilisateurs et ne sonne pas sur le téléphone. Rends-le aux utilisateurs quand le texte te va.</p>
      <table><tbody>${(r.sortes_auto ?? []).map((type) => { const essai = (r.en_essai ?? []).includes(type); return `<tr><td>${TYPES[type] ?? type}</td>
        <td>${essai ? '<span class="puce">En essai</span>' : 'Part aux utilisateurs'}</td>
        <td><button data-sorte="${type}" data-essai="${essai ? '0' : '1'}">${essai ? 'Rendre aux utilisateurs' : 'Mettre en essai'}</button></td></tr>`; }).join('')}</tbody></table>
      ${r.texte_bienvenue ? `<h3>Le texte de la bienvenue (en français ; les autres langues disent la même chose)</h3><p><strong>${echapper(r.texte_bienvenue.sujet)}</strong></p><pre class="texte">${echapper(r.texte_bienvenue.corps)}</pre>` : ''}
      <p class="doux">Pas de lien de désinscription dans l’e-mail (ta décision du 22/11) : la personne se retire en répondant STOP. Pas de bouton « Se désabonner » non plus (ta réponse du 24/11).</p></div>
    <div class="carte"><h2>Expéditeur</h2><dl class="grille">
      ${[['expediteur', 'Expéditeur', 'Prénom d’Easy Way <adresse@domaine-de-l-app>'], ['repondre_a', 'Réponses à', 'ton adresse'], ['adresse_test', 'Adresse de test', 'reçoit les essais et les utilisateurs de test'], ['signature', 'Signature', 'Prénom, créateur d’Easy Way']]
        .map(([cle, nom, aide]) => `<dt>${nom}</dt><dd><input type="text" data-reglage="${cle}" value="${echapper(r[cle] ?? '')}" placeholder="${aide}"> <span class="message" data-msg="${cle}"></span></dd>`).join('')}
      <dt>WhatsApp</dt><dd><input type="text" data-reglage="whatsapp" value="${r.whatsapp ? `+${echapper(r.whatsapp)}` : ''}" placeholder="+33 6 12 34 56 78"> <span class="message" data-msg="whatsapp"></span>
        <p class="doux">Ajoute à la fin de chaque e-mail « WhatsApp : 06 … » en français, « WhatsApp: +33 6 … 🇫🇷 » dans les autres langues. Vide : pas de ligne. Le numéro est visible par chaque destinataire.</p></dd>
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
  document.getElementById('notif').addEventListener('click', async () => { await api('reglages', { cle: 'notif_telephone', valeur: r.notif_telephone === false }); reglages(); });
  // Un clic à la fois : les boutons se grisent pendant l'appel, deux changements ne s'écrasent pas.
  vue.querySelectorAll('[data-sorte]').forEach((b) => b.addEventListener('click', async () => { vue.querySelectorAll('[data-sorte]').forEach((x) => { x.disabled = true; }); await api('reglages', { cle: 'en_essai', valeur: { type: b.dataset.sorte, essai: b.dataset.essai === '1' } }); reglages(); }));
  document.getElementById('blanc').addEventListener('click', async () => { await api('reglages', { cle: 'a_blanc', valeur: !r.a_blanc }); await bandeau(); reglages(); });
}


const FILTRES_CAMPAGNE = [['essais', 'Essais en cours'], ['payants', 'Payants'], ['actifs_30j', 'Payants, essais et actifs sur 30 jours']];
const STATUTS_CAMPAGNE = { brouillon: 'Brouillon', preparee: 'Préparée', en_cours: 'En cours', close: 'Close' };
const NOMS_LANGUES = { fr: 'français', en: 'anglais', de: 'allemand', es: 'espagnol', it: 'italien', pt: 'portugais' };
const SOURCES_LANGUE = { choix: 'choisie à la main', app: "d'après l'app", pays: "d'après le pays", 'pays ambigu': 'pays à plusieurs langues, à choisir', 'défaut': 'par défaut' };
const STATUTS_MEMBRE = { a_envoyer: 'À envoyer', envoye: 'Envoyé', repondu: 'A répondu', relance: 'Relancé', exclu: 'Exclu' };
const MODELE_BETA = { nom: 'Bêta-testeurs', filtre: 'actifs_30j', langue: 'fr', relance_apres_jours: 5,
  sujet: 'Tester les nouveautés d’Easy Way avant tout le monde ?',
  corps: 'Bonjour,\n\nJe cherche quelques personnes pour essayer les nouvelles versions d’Easy Way avant leur sortie et me dire ce qui ne va pas.\n\nConcrètement : une version de test de temps en temps, et vos remarques par e-mail ou WhatsApp. Aucune obligation, vous arrêtez quand vous voulez.\n\nCela vous intéresse ? Répondez simplement « oui ».\n\n{{signature}}',
  relance_sujet: 'Re : Tester les nouveautés d’Easy Way avant tout le monde ?',
  relance_corps: 'Bonjour,\n\nJe me permets une seule relance : je cherche encore quelques testeurs pour les prochaines versions d’Easy Way. Si cela vous intéresse, répondez « oui ». Sinon, pas besoin de répondre.\n\n{{signature}}' };

async function listeCampagnes() {
  const { campagnes } = await api('campagnes');
  vue.innerHTML = `<div class="outils"><h1>Campagnes</h1><button id="nouvelle" class="choisi">Nouvelle campagne</button></div>
    <p class="doux">Écrire à un groupe d’utilisateurs de l’app, noter qui répond, relancer les autres. Un nom qui commence par TEST ne vise que les utilisateurs de test.</p>
    <div class="carte">${campagnes.length ? `<table><thead><tr><th>Nom</th><th>Statut</th><th>Membres</th><th>Envoyés</th><th>Répondus</th><th>Relancés</th></tr></thead><tbody>
      ${campagnes.map((c) => `<tr data-campagne="${echapper(c.id)}"><td>${echapper(c.nom)}</td><td><span class="puce">${STATUTS_CAMPAGNE[c.statut] ?? c.statut}</span></td>
        <td>${c.nb_membres}</td><td>${c.nb_envoyes}</td><td>${c.nb_repondus}</td><td>${c.nb_relances}</td></tr>`).join('')}</tbody></table>` : '<p class="doux">Aucune campagne.</p>'}</div>`;
  vue.querySelectorAll('[data-campagne]').forEach((tr) => tr.addEventListener('click', () => { location.hash = `campagne-${tr.dataset.campagne}`; }));
  document.getElementById('nouvelle').addEventListener('click', async () => {
    const { id } = await api('campagne', { op: 'creer', champs: MODELE_BETA });
    location.hash = `campagne-${id}`;
  });
}

function formulaireCampagne(c) {
  return `<div class="carte"><h2>La campagne</h2><dl class="grille">
    <dt>Nom</dt><dd><input type="text" data-champ="nom" value="${echapper(c.nom)}" maxlength="80"></dd>
    <dt>Qui</dt><dd>${FILTRES_CAMPAGNE.map(([cle, nom]) => `<label><input type="radio" name="filtre" value="${cle}" ${c.filtre === cle ? 'checked' : ''}> ${nom}</label>`).join(' ')}</dd>
    <dt>Langue</dt><dd>${[['fr', 'Français'], ['en', 'Anglais (tout sauf fr)']].map(([cle, nom]) => `<label><input type="radio" name="langue" value="${cle}" ${c.langue === cle ? 'checked' : ''}> ${nom}</label>`).join(' ')}</dd>
    <dt>Sujet</dt><dd><input type="text" data-champ="sujet" value="${echapper(c.sujet)}" class="large"></dd>
    <dt>Texte</dt><dd><textarea data-champ="corps" rows="12">${echapper(c.corps)}</textarea></dd>
    <dt>Relance après</dt><dd><input type="text" data-champ="relance_apres_jours" value="${c.relance_apres_jours ?? ''}" class="petit"> jours (vide : pas de relance ; 3 à 30)</dd>
    <dt>Sujet de relance</dt><dd><input type="text" data-champ="relance_sujet" value="${echapper(c.relance_sujet ?? '')}" class="large"></dd>
    <dt>Texte de relance</dt><dd><textarea data-champ="relance_corps" rows="7">${echapper(c.relance_corps ?? '')}</textarea></dd>
    <dt>Hypothèse</dt><dd><textarea data-champ="hypothese" rows="2" placeholder="Ce qu’on attend de cette campagne">${echapper(c.hypothese ?? '')}</textarea></dd>
    <dt>Mesure</dt><dd><input type="text" data-champ="mesure" value="${echapper(c.mesure ?? '')}" class="large" placeholder="par exemple : la part qui répond dans les 7 jours"></dd>
    <dt>Seuil</dt><dd><input type="text" data-champ="seuil" value="${echapper(c.seuil ?? '')}" class="large" placeholder="par exemple : garder si au moins 5 réponses sur 50, arrêter à la première plainte"></dd>
    <dt>Date de lecture</dt><dd><input type="text" data-champ="lecture" value="${echapper(c.lecture ?? '')}" class="petit" placeholder="2027-01-31"></dd>
  </dl><p class="doux">{{signature}} prend la signature des réglages. L’hypothèse, la mesure, le seuil et la date sont obligatoires pour préparer, sauf pour une campagne TEST.</p>
  <div class="outils"><button id="enregistrer">Enregistrer</button><button id="apercu">Voir qui est concerné</button>
    <button id="preparer-campagne" class="choisi">Préparer</button><button id="clore" class="danger">Abandonner</button></div>
  <p class="message" id="msg-campagne"></p></div>`;
}

async function uneCampagne(id) {
  const c = await api(`campagne?id=${encodeURIComponent(id)}`);
  const brouillon = c.statut === 'brouillon';
  vue.innerHTML = `<a href="#campagnes" class="doux">← Campagnes</a>
    <h1>${echapper(c.nom)} <span class="puce">${STATUTS_CAMPAGNE[c.statut] ?? c.statut}</span></h1>
    ${brouillon ? formulaireCampagne(c) : `${c.hypothese ? `<div class="carte"><h2>Hypothèse</h2><p>${echapper(c.hypothese)}</p><dl class="grille"><dt>Mesure</dt><dd>${echapper(c.mesure)}</dd><dt>Seuil</dt><dd>${echapper(c.seuil)}</dd><dt>Lecture</dt><dd>${echapper(c.lecture)}</dd>
      <dt>Aujourd’hui</dt><dd>${c.nb_repondus ?? 0} réponse(s) sur ${c.nb_envoyes ?? 0} envoyé(s)</dd></dl></div>` : ''}<div class="carte"><h2>${echapper(c.rendu?.sujet ?? c.sujet)}</h2><pre class="texte">${echapper(c.rendu?.corps ?? c.corps)}</pre>
      <p class="doux">${c.relance_apres_jours ? `Relance ${c.relance_apres_jours} jours après l’envoi, dans Aujourd’hui, pour qui n’a pas répondu.` : 'Pas de relance.'}</p>
      ${c.statut !== 'close' ? '<div class="outils"><button id="envoyer-campagne" class="choisi">Envoyer les prêtes</button><button id="clore" class="danger">Clore</button></div>' : ''}
      <p class="message" id="msg-campagne"></p></div>
      <div class="carte defile"><h2>Membres (${c.membres.length})</h2><table><thead><tr><th>E-mail</th><th>Statut</th><th>Envoyé le</th><th>Répondu le</th><th>Relancé le</th><th></th></tr></thead><tbody>
      ${c.membres.map((m) => `<tr><td><a href="#fiche-${encodeURIComponent(m.user_id)}">${echapper(m.user_id)}</a></td><td>${STATUTS_MEMBRE[m.statut] ?? m.statut}${m.raison_exclusion ? ` (${echapper(m.raison_exclusion)})` : ''}</td>
        <td>${dateHeure(m.envoye_le)}</td><td>${dateHeure(m.repondu_le)}</td><td>${dateHeure(m.relance_le)}</td>
        <td>${['envoye', 'relance', 'a_envoyer'].includes(m.statut) && c.statut !== 'close' ? `<button data-repondu="${echapper(m.user_id)}">A répondu</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`}`;
  const msg = document.getElementById('msg-campagne');
  const dire = (texte, erreur = false) => { if (msg) { msg.className = erreur ? 'message erreur' : 'message'; msg.textContent = texte; } };
  const geste = async (op, extra = {}) => { try { return await api('campagne', { op, id: c.id, ...extra }); } catch (e) { dire(e.message, true); return null; } };
  const lire = () => ({ ...Object.fromEntries([...vue.querySelectorAll('[data-champ]')].map((ch) => [ch.dataset.champ, ch.value])),
    filtre: vue.querySelector('[name=filtre]:checked')?.value, langue: vue.querySelector('[name=langue]:checked')?.value });
  const clore = document.getElementById('clore');
  let confirmeClore = false;
  clore?.addEventListener('click', async () => {
    if (!confirmeClore) { confirmeClore = true; clore.textContent = 'Confirmer'; return; }
    if (await geste('clore')) uneCampagne(c.id);
  });
  if (brouillon) {
    const enregistrer = async () => (await geste('modifier', { champs: lire() })) !== null;
    document.getElementById('enregistrer').addEventListener('click', async () => { if (await enregistrer()) dire('Enregistré.'); });
    document.getElementById('apercu').addEventListener('click', async () => {
      if (!(await enregistrer())) return;
      try { const { membres } = await api(`campagne/apercu?id=${encodeURIComponent(c.id)}`); dire(`${membres} personne${membres > 1 ? 's' : ''} concernée${membres > 1 ? 's' : ''}.`); } catch (e) { dire(e.message, true); }
    });
    const prep = document.getElementById('preparer-campagne');
    let confirmePrep = false;
    prep.addEventListener('click', async () => {
      if (!(await enregistrer())) return;
      if (!confirmePrep) { confirmePrep = true; prep.textContent = 'Confirmer : figer les membres'; return; }
      if (await geste('preparer')) uneCampagne(c.id);
    });
    return;
  }
  const envoyer = document.getElementById('envoyer-campagne');
  let confirmeEnvoi = false;
  envoyer?.addEventListener('click', async () => {
    if (!confirmeEnvoi) { confirmeEnvoi = true; envoyer.textContent = 'Confirmer l’envoi'; return; }
    const r = await geste('envoyer');
    if (r) { await uneCampagne(c.id); dire(`${r.envoyes} envoyé(s), ${r.bloques} bloqué(s), ${r.restants} restant(s)${r.restants ? ' : relancer l’envoi plus tard (plafond du jour, écart de 72 h ou envois coupés)' : ''}.`); }
  });
  vue.querySelectorAll('[data-repondu]').forEach((b) => b.addEventListener('click', async () => { if (await geste('repondu', { userId: b.dataset.repondu })) uneCampagne(c.id); }));
}

const PLATEFORMES = { ios: 'iPhone', android: 'Android' };
async function listeBugs() {
  const { retours, versions, erreur } = await api('bugs');
  const enVente = ['ios', 'android'].map((p) => `${PLATEFORMES[p]} : ${versions[p] ? `${echapper(versions[p].version)} (vue le ${date(versions[p].vue_le)})` : 'pas encore lue'}`).join(' · ');
  const etat = (r) => {
    if (!r.note) return '';
    if (r.note.action_id) return `<a href="#action-${encodeURIComponent(r.note.action_id)}">action préparée</a>`;
    if (!r.user_id) return 'personne inconnue : à prévenir à la main';
    return `attend la ${echapper(r.note.version_corrigee)} en vente`;
  };
  vue.innerHTML = `<h1>Bugs signalés</h1>
    <p class="doux">Les « Signaler un bug » des 90 derniers jours, lus dans Sentry. Noter le titre public (ce que la personne lira) et la version qui corrige : quand cette version est en vente sur son store, « Bug corrigé » arrive dans Aujourd’hui. En vente : ${enVente}.</p>
    ${erreur ? `<p class="message erreur">${echapper(erreur)}</p>` : ''}
    <div class="carte defile">${retours.length ? `<table><thead><tr><th>Le</th><th>Retour</th><th>Qui</th><th>Vu en</th><th>Titre public</th><th>Corrigé en</th><th>Tâche</th><th></th></tr></thead><tbody>
      ${retours.map((r) => `<tr data-retour="${echapper(r.id)}"><td>${date(r.le)}<br><span class="doux">n° ${echapper(r.id)}</span></td><td>${echapper(String(r.texte).slice(0, 400))}</td>
        <td>${r.user_id ? `<a href="#fiche-${encodeURIComponent(r.user_id)}">${echapper(r.user_id)}</a>` : `<span class="doux">${r.contact ? echapper(r.contact) : 'inconnu'}</span>`}<br><span class="doux">${PLATEFORMES[r.plateforme] ?? ''}</span></td>
        <td>${echapper(r.version_vue ?? '')}</td>
        <td><input type="text" data-b="titre" value="${echapper(r.note?.titre ?? '')}" placeholder="la carte qui restait blanche" ${r.note?.action_id ? 'disabled' : ''}></td>
        <td><input type="text" data-b="version_corrigee" class="petit" value="${echapper(r.note?.version_corrigee ?? '')}" placeholder="7.6.9" ${r.note?.action_id ? 'disabled' : ''}></td>
        <td><input type="text" data-b="bug_ew" class="petit" value="${echapper(r.note?.bug_ew ?? '')}" placeholder="BUG-EW-" ${r.note?.action_id ? 'disabled' : ''}></td>
        <td>${r.note?.action_id ? '' : '<button data-noter>Noter</button>'} <span class="message">${etat(r)}</span></td></tr>`).join('')}</tbody></table>` : '<p class="doux">Aucun retour sur 90 jours.</p>'}</div>`;
  vue.querySelectorAll('[data-noter]').forEach((b) => b.addEventListener('click', async () => {
    const tr = b.closest('tr');
    const champ = (k) => tr.querySelector(`[data-b="${k}"]`).value;
    const msg = tr.querySelector('.message');
    try { await api('bug', { id: tr.dataset.retour, titre: champ('titre'), version_corrigee: champ('version_corrigee'), bug_ew: champ('bug_ew') }); msg.className = 'message'; msg.textContent = 'Noté'; }
    catch (e) { msg.className = 'message erreur'; msg.textContent = e.message; }
  }));
}

async function afficher() {
  const cle = location.hash.slice(1) || 'aujourdhui';
  const nom = cle.startsWith('fiche-') ? 'utilisateurs' : cle.startsWith('action-') ? 'aujourdhui' : cle.startsWith('campagne-') ? 'campagnes' : cle;
  document.querySelectorAll('[data-vue]').forEach((a) => a.classList.toggle('actif', a.dataset.vue === nom));
  vue.innerHTML = '<p class="doux">Chargement…</p>';
  try {
    if (cle.startsWith('fiche-')) await fiche(decodeURIComponent(cle.slice(6)));
    else if (cle.startsWith('action-')) await uneAction(decodeURIComponent(cle.slice(7)));
    else if (cle.startsWith('campagne-')) await uneCampagne(decodeURIComponent(cle.slice(9)));
    else await ({ aujourdhui, utilisateurs, campagnes: listeCampagnes, bugs: listeBugs, journal, reglages }[cle] ?? aujourdhui)();
  } catch (e) {
    vue.innerHTML = `<div class="carte"><p class="message erreur">${echapper(e.message)}</p><p class="doux">Si la base ne répond pas, la connexion Google du Mac a peut-être expiré : <code>gcloud auth application-default login</code>.</p></div>`;
  }
}

window.addEventListener('hashchange', afficher);
bandeau();
afficher();
