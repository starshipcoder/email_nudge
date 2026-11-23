// Gmail vers le suivi Easy Way (spec : hephaistos, notes/spec-crm-2026-11-21.md, § 3.11 A ; tâche INT-EW-65).
// Tourne dans le compte Google du fondateur, toutes les 15 minutes. Il lit Gmail (lecture seule) et n'écrit que
// les e-mails échangés avec une adresse déjà inscrite dans email_nudge : une adresse inconnue n'est jamais écrite.
// Écrit dans Firestore (projet contact-on-map-flutter, base email-nudge) par l'API REST, avec le jeton du fondateur :
//   crm_messages/{idGmail} : { user_id, cle, sens: 'recu' | 'envoye', le, sujet, extrait (500 caractères), fil, source: 'gmail' }
//   crm_fiches/{cle}       : a_repondu_le sur un e-mail reçu ; desinscrit sur une réponse « STOP ».
// Pour l'arrêter : Déclencheurs, supprimer celui de « passe ». Rien n'est envoyé, rien n'est supprimé dans Gmail.

var PROJET = 'contact-on-map-flutter';
var BASE = 'email-nudge';
var RACINE = 'https://firestore.googleapis.com/v1/projects/' + PROJET + '/databases/' + BASE + '/documents';
var PREMIER_PASSAGE_JOURS = 90;
var PAGE = 100;
// Une passe s'arrête avant la limite de 6 minutes d'Apps Script, et reprend à la même page au passage suivant.
var BUDGET_MS = 4 * 60 * 1000;
// Recouvrement d'une heure : un e-mail daté avant sa remise n'est pas perdu ; l'identifiant Gmail garde l'unicité.
var RECOUVREMENT_MS = 3600 * 1000;

// À lancer une fois à la main : crée le déclencheur toutes les 15 minutes, puis fait une première passe.
function installer() {
  ScriptApp.getProjectTriggers().forEach(function (d) { if (d.getHandlerFunction() === 'passe') ScriptApp.deleteTrigger(d); });
  ScriptApp.newTrigger('passe').timeBased().everyMinutes(15).create();
  passe();
}

function appel(methode, chemin, corps) {
  var options = { method: methode, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'x-goog-user-project': PROJET }, muteHttpExceptions: true, contentType: 'application/json' };
  if (corps) options.payload = JSON.stringify(corps);
  var r = UrlFetchApp.fetch(chemin.indexOf('https://') === 0 ? chemin : RACINE + chemin, options);
  if (r.getResponseCode() >= 300) throw new Error('Firestore ' + r.getResponseCode() + ' sur ' + chemin.split('?')[0]);
  return JSON.parse(r.getContentText() || '{}');
}

// Les adresses inscrites : le nom des documents de users, sans aucun champ.
function adressesConnues() {
  var connues = {};
  var jeton = '';
  do {
    var r = appel('get', '/users?pageSize=300&mask.fieldPaths=__name__' + (jeton ? '&pageToken=' + encodeURIComponent(jeton) : ''));
    (r.documents || []).forEach(function (d) { connues[decodeURIComponent(d.name.split('/').pop()).toLowerCase()] = true; });
    jeton = r.nextPageToken || '';
  } while (jeton);
  return connues;
}

// La même clé que le programme du Mac : sha256 de l'adresse, 24 premiers caractères hexadécimaux.
function cleUtilisateur(adresse) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, adresse, Utilities.Charset.UTF_8)
    .map(function (o) { return ('0' + (o & 0xff).toString(16)).slice(-2); }).join('').slice(0, 24);
}

function adresses(champ) {
  return (String(champ || '').match(/[\w.%+-]+@[\w-]+(?:\.[\w-]+)+/g) || []).map(function (a) { return a.toLowerCase(); });
}

// Les champs d'un document, ou null s'il n'existe pas.
function lireDoc(chemin) {
  var r = UrlFetchApp.fetch(RACINE + chemin, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'x-goog-user-project': PROJET }, muteHttpExceptions: true });
  if (r.getResponseCode() === 404) return null;
  if (r.getResponseCode() >= 300) throw new Error('Firestore ' + r.getResponseCode() + ' sur ' + chemin);
  return JSON.parse(r.getContentText()).fields || {};
}

function ecrireDoc(chemin, champs) {
  var fields = {};
  var masque = [];
  Object.keys(champs).forEach(function (k) {
    var v = champs[k];
    fields[k] = Object.prototype.toString.call(v) === '[object Date]' ? { timestampValue: v.toISOString() } : typeof v === 'boolean' ? { booleanValue: v } : { stringValue: String(v) };
    masque.push('updateMask.fieldPaths=' + encodeURIComponent(k));
  });
  appel('patch', chemin + '?' + masque.join('&'), { fields: fields });
}

function passe() {
  var verrou = LockService.getScriptLock();
  if (!verrou.tryLock(1000)) return;
  try {
    var proprietes = PropertiesService.getScriptProperties();
    var premiere = !proprietes.getProperty('derniere_passe');
    // Une passe interrompue reprend avec la même borne et à la page où elle s'est arrêtée.
    var depuis = Number(proprietes.getProperty('reprise_depuis') || proprietes.getProperty('derniere_passe') || 0) || (Date.now() - PREMIER_PASSAGE_JOURS * 86400000);
    var debut = Number(proprietes.getProperty('reprise_debut') || 0) || Date.now();
    var page = Number(proprietes.getProperty('reprise_page') || 0);
    var depart = Date.now();
    var moi = Session.getEffectiveUser().getEmail().toLowerCase();
    var connues = adressesConnues();
    var requete = 'after:' + Math.floor((depuis - RECOUVREMENT_MS) / 1000) + ' -in:spam -in:trash';
    var lus = 0; var ecrits = 0; var fini = false; var reponses = {};
    while (Date.now() - depart < BUDGET_MS) {
      var fils = GmailApp.search(requete, page * PAGE, PAGE);
      if (!fils.length) { fini = true; break; }
      lus += fils.length;
      fils.forEach(function (fil) {
        fil.getMessages().forEach(function (m) {
          if (m.getDate().getTime() < depuis - RECOUVREMENT_MS) return;
          var de = adresses(m.getFrom());
          var envoye = de.indexOf(moi) >= 0;
          var autres = envoye ? adresses(m.getTo() + ',' + m.getCc()) : de;
          autres.filter(function (a) { return connues[a] && a !== moi; }).forEach(function (a) {
            var cle = cleUtilisateur(a);
            var texte = m.getPlainBody() || '';
            var message = { user_id: a, cle: cle, sens: envoye ? 'envoye' : 'recu', le: m.getDate(),
              sujet: m.getSubject().slice(0, 200), extrait: texte.replace(/\s+/g, ' ').trim().slice(0, 500), fil: fil.getId(), source: 'gmail' };
            // La première passe remonte l'historique : déjà lu, il n'arrive pas dans « Réponses à lire ».
            if (premiere && !envoye) message.lu = true;
            ecrireDoc('/crm_messages/' + m.getId() + '_' + cle, message);
            ecrits += 1;
            if (envoye) return;
            var r = reponses[cle] || (reponses[cle] = { user_id: a, le: m.getDate(), stop: false });
            if (m.getDate() > r.le) r.le = m.getDate();
            // « STOP » en première ligne d'une réponse, ou en sujet : désinscrit.
            var ligne = texte.trim().split('\n')[0] || '';
            if (/^\s*stop\b/i.test(ligne) || /^\s*stop\s*$/i.test(m.getSubject())) r.stop = true;
          });
        });
      });
      page += 1;
    }
    // « A répondu le » ne recule jamais : la date la plus récente de la passe, si elle est après celle de la fiche.
    Object.keys(reponses).forEach(function (cle) {
      var r = reponses[cle];
      var fiche = lireDoc('/crm_fiches/' + cle);
      var avant = fiche && fiche.a_repondu_le && fiche.a_repondu_le.timestampValue ? new Date(fiche.a_repondu_le.timestampValue) : null;
      var champs = { user_id: r.user_id, maj_le: new Date() };
      if (!avant || r.le > avant) champs.a_repondu_le = r.le;
      if (r.stop) { champs.desinscrit = true; champs.desinscrit_le = new Date(); }
      ecrireDoc('/crm_fiches/' + cle, champs);
    });
    if (fini) {
      proprietes.setProperty('derniere_passe', String(debut));
      ['reprise_depuis', 'reprise_debut', 'reprise_page'].forEach(function (k) { proprietes.deleteProperty(k); });
    } else {
      proprietes.setProperties({ reprise_depuis: String(depuis), reprise_debut: String(debut), reprise_page: String(page) });
    }
    console.log('passe : ' + lus + ' fil(s) lus, ' + ecrits + ' message(s) écrits' + (fini ? '' : ', à suivre page ' + page));
  } finally {
    verrou.releaseLock();
  }
}
