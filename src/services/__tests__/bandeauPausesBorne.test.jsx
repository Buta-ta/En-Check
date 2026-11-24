// ═══════════════════════════════════════════════════════════════════════════
// ☕ LE BANDEAU DE LA BORNE — il décore, il ne bloque jamais
//
// La borne sert à pointer. Un employé qui arrive doit pouvoir le faire même
// si ce bandeau tombe en panne, même si la fonction n'existe pas encore en
// base (déploiement partiel), même si le réseau clignote.
//
// Et sur un écran que tout le monde voit : un prénom et une initiale, rien
// de plus. Le fondateur l'a tranché (option b, 25/11).
// ═══════════════════════════════════════════════════════════════════════════
import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
//  On teste la logique pure (lib) et le rendu pur (composant), jamais le
//  conteneur : il importe `supabase`, qui exige un .env absent en CI.
import { dureeCourte, chargerPausesBandeau } from '../../lib/bandeauPauses'
import ListePausesBandeau from '../../components/ListePausesBandeau'

describe('☕ Durée affichée', () => {
  it('écrit « 1:51 » sans les secondes', () => {
    const debut = new Date('2026-11-23T10:00:00Z').getTime()
    expect(dureeCourte('2026-11-23T10:00:00Z', debut + 111 * 60000)).toBe('1:51')
  })

  it('n’affiche jamais une durée négative', () => {
    //  Une horloge de tablette décalée ne doit pas écrire « -3:12 ».
    const debut = new Date('2026-11-23T10:00:00Z').getTime()
    expect(dureeCourte('2026-11-23T10:00:00Z', debut - 60000)).toBe('0:00')
  })

  it('renvoie null sur une date illisible plutôt que « NaN:NaN »', () => {
    expect(dureeCourte('pas une date')).toBeNull()
  })
})

describe('☕ Ce qui s’affiche', () => {
  it('affiche le prénom et l’initiale', () => {
    const html = renderToStaticMarkup(
      <ListePausesBandeau
        pauses={[{ affichage: 'Merveille B.', debut: '2026-11-23T10:00:00Z', duree_minutes: 12 }]}
        instant={new Date('2026-11-23T10:12:00Z').getTime()}
      />
    )
    expect(html).toContain('Merveille B.')
    expect(html).toContain('0:12')
  })

  it('ne rend rien quand personne n’est en pause', () => {
    expect(renderToStaticMarkup(<ListePausesBandeau pauses={[]} />)).toBe('')
  })

  it('ne laisse filtrer ni matricule ni identifiant', () => {
    //  Contrat de `encheck_pauses_bandeau` : ces trois colonnes n'existent
    //  pas dans sa sortie. Si le composant les lisait, il n'afficherait rien
    //  — mais autant vérifier qu'aucune donnée sensible ne fuit par le HTML.
    const html = renderToStaticMarkup(
      <ListePausesBandeau
        pauses={[{
          affichage: 'Merveille B.', debut: '2026-11-23T10:00:00Z',
          //  Champs qu'une version future du serveur pourrait renvoyer par
          //  erreur : le composant ne doit pas les peindre.
          employe_id: 'abc-uuid', matricule: 'ENN-0002', nom: 'BAMBA',
        }]}
        instant={new Date('2026-11-23T10:12:00Z').getTime()}
      />
    )
    expect(html).not.toContain('ENN-0002')
    expect(html).not.toContain('abc-uuid')
    expect(html).not.toContain('BAMBA')
  })
})

describe('🚨 LE BANDEAU NE DOIT JAMAIS CASSER LA BORNE', () => {
  it('renvoie une liste vide si la fonction n’existe pas côté serveur', async () => {
    //  Cas réel : la migration n'est pas encore appliquée.
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST202', message: 'function not found' },
      }),
    }
    await expect(chargerPausesBandeau('ent-1', client)).resolves.toEqual([])
  })

  it('renvoie une liste vide sur une exception réseau', async () => {
    //  Une promesse rejetée non protégée ferait tomber l'écran entier — et
    //  l'employé ne pourrait plus pointer.
    const client = { rpc: vi.fn().mockRejectedValue(new Error('réseau coupé')) }
    await expect(chargerPausesBandeau('ent-1', client)).resolves.toEqual([])
  })

  it('ne contacte pas le serveur sans entreprise installée', async () => {
    const client = { rpc: vi.fn() }
    await expect(chargerPausesBandeau(null, client)).resolves.toEqual([])
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('transmet les lignes telles quelles quand tout va bien', async () => {
    const lignes = [{ affichage: 'A. B.', debut: '2026-11-23T10:00:00Z' }]
    const client = { rpc: vi.fn().mockResolvedValue({ data: lignes, error: null }) }
    await expect(chargerPausesBandeau('ent-1', client)).resolves.toEqual(lignes)
  })
})
