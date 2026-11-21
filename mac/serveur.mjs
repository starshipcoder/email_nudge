// La page de suivi des utilisateurs, servie sur le Mac seulement (127.0.0.1).
// Usage : node mac/serveur.mjs [--port 4810]
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clientFirestore } from './firestore.mjs';
import { filtrer, suivi } from './suivi.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const FICHIERS = new Set(['/index.html', '/app.js', '/style.css']);

// Seules les requêtes adressées à localhost passent (contre une page web qui viserait le Mac par un autre nom).
export function hoteAutorise(hote, port) {
  return [`127.0.0.1:${port}`, `localhost:${port}`].includes(String(hote ?? ''));
}

// Une écriture doit venir de la page elle-même.
export function ecritureAutorisee(req, port) {
  const origine = req.headers.origin;
  return req.headers['x-crm'] === '1' && (!origine || hoteAutorise(origine.replace(/^http:\/\//, ''), port));
}

function json(res, code, corps) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(corps));
}

async function lireCorps(req) {
  let texte = '';
  for await (const morceau of req) {
    texte += morceau;
    if (texte.length > 20000) throw new Error('Requête trop longue.');
  }
  return texte ? JSON.parse(texte) : {};
}

export function application(s, { port }) {
  return async (req, res) => {
    try {
      if (!hoteAutorise(req.headers.host, port)) return json(res, 403, { erreur: 'Hôte refusé.' });
      const url = new URL(req.url, `http://localhost:${port}`);
      if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
        const nom = url.pathname === '/' ? '/index.html' : url.pathname;
        if (!FICHIERS.has(nom)) return json(res, 404, { erreur: 'Introuvable.' });
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(nom)], 'Cache-Control': 'no-store',
          'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'", 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' });
        return res.end(await readFile(path.join(ICI, 'web', nom.slice(1))));
      }
      if (req.method === 'POST' && !ecritureAutorisee(req, port)) return json(res, 403, { erreur: 'Écriture refusée.' });
      const route = `${req.method} ${url.pathname}`;
      if (route === 'GET /api/utilisateurs') {
        const tous = await s.utilisateurs({ frais: url.searchParams.get('frais') === '1' });
        const lignes = filtrer(tous, { q: url.searchParams.get('q') ?? '', filtre: url.searchParams.get('filtre') ?? '' });
        return json(res, 200, { total: tous.length, lignes: lignes.slice(0, 300), trouves: lignes.length });
      }
      if (route === 'GET /api/fiche') {
        const f = await s.fiche(url.searchParams.get('id') ?? '');
        return f ? json(res, 200, f) : json(res, 404, { erreur: 'Inscrit introuvable.' });
      }
      if (route === 'POST /api/prenom') {
        const { id, prenom } = await lireCorps(req);
        return json(res, 200, { prenom: await s.changerPrenom(id, prenom) });
      }
      if (route === 'GET /api/reglages') return json(res, 200, await s.reglages());
      if (route === 'POST /api/reglages') {
        const { cle, valeur } = await lireCorps(req);
        return json(res, 200, await s.changerReglage(cle, valeur));
      }
      if (route === 'GET /api/journal') return json(res, 200, { lignes: await s.journal() });
      if (route === 'GET /api/aujourdhui') return json(res, 200, { actions: await s.aujourdhui() });
      return json(res, 404, { erreur: 'Introuvable.' });
    } catch (erreur) {
      return json(res, 400, { erreur: erreur.message });
    }
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--port');
  const port = i > 0 ? Number(process.argv[i + 1]) : 4810;
  http.createServer(application(suivi(clientFirestore()), { port })).listen(port, '127.0.0.1', () => {
    console.log(`Suivi Easy Way : http://localhost:${port}`);
  });
}
