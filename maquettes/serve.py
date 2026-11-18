#!/usr/bin/env python3
"""Serveur des maquettes — sert le dépôt à la racine et remappe /fonts/.

Pourquoi ce fichier : `tokens.css` déclare ses polices en `/fonts/...`, chemin
que seul Vite sait servir (il monte `public/` à la racine). En statique, on
remappe donc `/fonts/x` → `/public/fonts/x`. Rien d'autre n'est modifié : la
maquette charge les vrais `tokens.css` et `charte.css` du produit, donc elle ne
peut pas dériver de la charte.

Usage : python3 maquettes/serve.py [port]
"""
import http.server
import os
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4173


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=RACINE, **k)

    def do_GET(self):
        # La preview s'ouvre sur la racine : on l'envoie droit sur le catalogue.
        if self.path in ("/", "/index.html"):
            self.send_response(302)
            self.send_header("Location", "/maquettes/")
            self.end_headers()
            return
        super().do_GET()

    def translate_path(self, path):
        if path.startswith("/fonts/"):
            path = "/public/fonts/" + path[len("/fonts/"):]
        return super().translate_path(path)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s\n" % (fmt % args))


class Serveur(http.server.ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    with Serveur(("0.0.0.0", PORT), Handler) as httpd:
        print(f"maquettes prêtes sur 0.0.0.0:{PORT} — /maquettes/", flush=True)
        httpd.serve_forever()
