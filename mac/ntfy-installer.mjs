// Une fois : tire le sujet ntfy d'Iris CRM, le copie dans le presse-papiers (jamais affiché), et envoie une notification
// d'essai. Le fondateur colle ensuite le sujet dans l'app ntfy du téléphone (« + », s'abonner, serveur ntfy.sh).
// Usage : node mac/ntfy-installer.mjs [--essai]   (--essai : renvoie seulement une notification d'essai)
import { execFileSync } from 'node:child_process';
import { creerSujet, envoyerNtfy, lireSujet } from './notif.mjs';

const essaiSeul = process.argv.includes('--essai');
const sujet = essaiSeul ? lireSujet() : creerSujet();
if (!sujet) { console.log('Pas de sujet : lancer sans --essai d’abord.'); process.exit(1); }
if (!essaiSeul) {
  execFileSync('pbcopy', { input: sujet });
  console.log('Sujet ntfy créé et copié dans le presse-papiers (il n’est pas affiché).');
}
const r = await envoyerNtfy({ titre: 'Iris CRM', texte: 'Notification d’essai : Iris CRM te préviendra ici.', sujet });
console.log(r.envoye ? 'Notification d’essai envoyée.' : `Notification refusée : ${r.raison}`);
