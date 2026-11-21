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
var MAX_FILS = 200;

// À lancer une fois à la main : crée le déclencheur toutes les 15 minutes, puis fait une première passe.
function installer() {
  ScriptApp.getProjectTriggers().forEach(function (d) { if (d.getHandlerFunction() === 'passe') ScriptApp.deleteTrigger(d); });
  ScriptApp.newTrigger('passe').timeBased().everyMinutes(15).create();
  passe();
}

function appel(methode, chemin, corps) {
  var options = { method: methode, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true, contentType: 'application/json' };
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

function ecrireDoc(chemin, champs) {
  var fields = {};
  var masque = [];
  Object.keys(champs).forEach(function (k) {
    var v = champs[k];
    fields[k] = v instanceof Date ? { timestampValue: v.toISOString() } : typeof v === 'boolean' ? { booleanValue: v } : { stringValue: String(v) };
    masque.push('updateMask.fieldPaths=' + encodeURIComponent(k));
  });
  appel('patch', chemin + '?' + masque.join('&'), { fields: fields });
}

function passe() {
  var verrou = LockService.getScriptLock();
  if (!verrou.tryLock(1000)) return;
  try {
    var proprietes = PropertiesService.getScriptProperties();
    var depuis = Number(proprietes.getProperty('derniere_passe') || 0) || (Date.now() - PREMIER_PASSAGE_JOURS * 86400000);
    var debut = Date.now();
    var moi = Session.getEffectiveUser().getEmail().toLowerCase();
    var connues = adressesConnues();
    // Une minute de recouvrement : l'identifiant Gmail garde l'unicité.
    var fils = GmailApp.search('after:' + Math.floor((depuis - 60000) / 1000), 0, MAX_FILS);
    var ecrits = 0;
    fils.forEach(function (fil) {
      fil.getMessages().forEach(function (m) {
        if (m.getDate().getTime() < depuis - 60000) return;
        var de = adresses(m.getFrom());
        var envoye = de.indexOf(moi) >= 0;
        var autres = envoye ? adresses(m.getTo() + ',' + m.getCc()) : de;
        autres.filter(function (a) { return connues[a] && a !== moi; }).forEach(function (a) {
          var cle = cleUtilisateur(a);
          var texte = m.getPlainBody() || '';
          ecrireDoc('/crm_messages/' + m.getId() + '_' + cle, { user_id: a, cle: cle, sens: envoye ? 'envoye' : 'recu', le: m.getDate(),
            sujet: m.getSubject().slice(0, 200), extrait: texte.replace(/\s+/g, ' ').trim().slice(0, 500), fil: fil.getId(), source: 'gmail' });
          ecrits += 1;
          if (!envoye) {
            var fiche = { user_id: a, a_repondu_le: m.getDate(), maj_le: new Date() };
            // « STOP » en réponse, ou un e-mail dont le sujet est STOP (le lien de désinscription) : désinscrit.
            var premiere = texte.trim().split('\n')[0] || '';
            if (/^\s*stop\b/i.test(premiere) || /^\s*stop\s*$/i.test(m.getSubject())) { fiche.desinscrit = true; fiche.desinscrit_le = new Date(); }
            ecrireDoc('/crm_fiches/' + cle, fiche);
          }
        });
      });
    });
    proprietes.setProperty('derniere_passe', String(debut));
    console.log('passe : ' + fils.length + ' fil(s) lus, ' + ecrits + ' message(s) écrits');
  } finally {
    verrou.releaseLock();
  }
}
