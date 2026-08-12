# Floorball-taktik · VHG

Animerede taktiksekvenser til VHG's floorball-seniorhold. Banen ses ovenfra,
spillerne er farvede prikker, og en konkret situation spilles igennem med tekst
til hvert trin — og oplæsning, hvis man vil have den.

Alle scener er bygget på **6 mod 6**: målmand, center, to backs og to wings.
Vi forsvarer altid målet til venstre og angriber mod højre, i hver eneste scene,
så billedet er til at genkende.

**Live:** https://www.vhg.dk/floorball/

Siden er et **selvstændigt projekt**, selvom den bor i en undermappe på vhg.dk.
Den er for stor til at ligge i `vhg`-repoet, og den har sin egen deploy.

## Sider

| Fil | Indhold |
|---|---|
| `site/index.html` | Taktikkerne. Al interaktion foregår her. |
| `site/regler.html` | De regler der reelt bliver diskuteret, med regelnumre og links til de officielle kilder. |
| `site/om.html` | Hvad siden er, hvordan banen læses, forbehold og kontakt. |

## Kør lokalt

Kommentarfeltet kræver PHP. Windows har ikke PHP, så brug WSL:

```powershell
wsl -e bash -lc "cd /mnt/c/projects/floorball/site && php -S 0.0.0.0:8766 -t ."
# -> http://127.0.0.1:8766
```

Uden PHP virker resten fint — kommentarerne fejler bare stille:

```powershell
python -m http.server 8765 --directory site
```

Nyttige URL'er under arbejdet:

| URL | Hvad |
|---|---|
| `/#krydsloeb` | åbner en bestemt scene direkte |
| `/?t=4.6#krydsloeb` | hopper til sekund 4,6 og holder pause |

## Kontrollér scenedata

```powershell
node check.js
```

Kør den hver gang `site/scenes.js` er rettet. Den fanger tastefejl i
spillernavne, keyframes i forkert rækkefølge, spillere uden for banen, mærkater
der peger på ingenting, og prikker der lægger sig oven på hinanden. Afslutter
med kode 1 ved fejl.

## Deploy

```bash
python deploy.py
```

Uploader `site/` til `public_html/floorball/` på `ftp.vhg.dk` og stempler
`?v=<hash>` på css og js, så browsere ikke sidder med en halvgammel kopi.
Loginoplysninger står i `.ftp-credentials`, som ikke er i git:

```
FTP_HOST=ftp.vhg.dk
FTP_USER=allan@vhg.dk
FTP_PASS=...        # samme som FTP_PASSWORD-hemmeligheden i vhg-repoet
```

> **⚠️ `floorball/**` skal stå i exclude-listen i vhg-repoet.**
> `vhg/.github/workflows/deploy-ftp.yml` deployer hele `public_html/` og
> **sletter alt der ikke er ekskluderet**. Uden linjen forsvinder hele denne
> side — inklusive kommentardatabasen — ved næste push til `vhg`.
> Linjen er tilføjet, men tjek den, hvis siden en dag er væk.

`deploy.py` sletter aldrig noget på serveren og springer `data/`-mapper over,
fordi `site/api/data/comments.sqlite` kun findes derovre.

## Filer

| Fil | Ansvar |
|---|---|
| `site/court.js` | Banens geometri og al tegning. Kender ikke til tid. |
| `site/engine.js` | Tidslinje, interpolation af keyframes, afspiller, oplæsning. |
| `site/scenes.js` | **Alt taktisk indhold.** Det er her man skriver taktik. |
| `site/app.js` | Menu, knapper, tegnerækkefølge, kommentarer. |
| `site/api/comments.php` | Kommentarer pr. scene: SQLite + mailnotifikation. |
| `check.js` | Kontrol af scenedata. |

## Koordinatsystem

Banen er 40 × 20 meter, og alt i `scenes.js` er angivet i meter.

```
 y=0   venstre side
   ┌──────────────────────────────────┐
   │ [vores mål]            [deres]   │   x=0 vores kortside
   └──────────────────────────────────┘   x=40 deres kortside
 y=20  højre side
```

Vores mål står ved x = 2,85. Vi angriber mod høje x. "Venstre" og "højre" er set
i angrebsretningen, så venstre back (B1) står ved lave y.

På en telefon i højformat drejes banen 90 grader, så vi angriber opad. Det er en
ægte rotation, ikke et spejlbillede — venstre bliver ved med at være venstre.

## Sådan skriver man en ny scene

Kopiér en eksisterende scene i `site/scenes.js` og ret tallene.

```js
{
  id: 'min-scene',              // bruges i URL'en som #min-scene
  category: 'Angreb',           // Grundlag | Forsvar | Angreb
  title: 'Overskrift',
  summary: 'En linje der forklarer hvornår situationen opstår.',
  duration: 12,                 // sekunder
  points: ['Kernepunkt', '...'],

  home: {
    MV: [[0, 5, 10], [12, 5.5, 10]],           // [tid, x, y]
    C:  [[0, 26, 10], [3, 30, 10, 'l']],       // 'l' = konstant fart
    B1: [], B2: [], W1: [], W2: [],
  },
  away: { MV: [], B1: [], B2: [], C: [], W1: [], W2: [] },

  ball: [[0, 'C'], [3, 'C'], [3.6, 'W1']],     // id = ligger på hans stav
  events: [ ... ],
  steps: [ { t: 0, text: 'Hvad der sker og hvorfor.' } ],
}
```

Bevægelsen glider blødt ind og ud mellem to keyframes. Sæt `'l'` som fjerde
element for konstant fart — brug det til lange sprint, ellers ser det ud som om
spilleren tøver undervejs.

Modstanderens spillere hedder `aMV`, `aB1`, `aB2`, `aC`, `aW1`, `aW2` når der
refereres til dem fra `ball` eller `events`. De tegnes uden bogstav, så øjet
holder fast i vores eget hold.

To keyframes tæt på hinanden med forskellig position giver et hårdt klip. Det
bruges til at spille den samme situation igennem to gange med to udfald — se
`bully` og `bag-om-maalet`.

### events

```js
{ t: 2, until: 5, type: 'zone',   poly: [[7,7],[12,7],[12,13],[7,13]], color: '#1A73C9', label: 'Boksen' }
{ t: 2, until: 4, type: 'arrow',  from: [24,5], to: [30,4], label: 'Løb', dash: true }
{ t: 2, until: 4, type: 'marker', at: [20,10], label: 'Bully' }
```

`from`, `to` og `at` må også være et spiller-id i stedet for koordinater, så
følger de spilleren. `labelAt: [x, y]` placerer mærkaten et bestemt sted, hvis
den automatiske placering lander oven i noget. Udelades `until`, forsvinder
mærket efter ca. to sekunder.

### steps

`t` er det sekund, teksten skal skifte på. `focus: ['C','W1']` sætter en
pulserende ring om de nævnte spillere — brug det når en scene forklarer pladser
frem for et forløb.

Teksten er samtidig manuskriptet til oplæsningen. Vil man have en anden
formulering læst op end den, der står på skærmen, sættes `speech: '...'`.

## Afspilning

- Scenen **stopper ved enden** og starter ikke forfra af sig selv. Play-knappen
  bliver til ↻ og starter forfra.
- **⏮/⏭** springer et trin frem eller tilbage og afspiller præcis det ene trin,
  hvorefter der holdes pause. Piletasterne gør det samme, mellemrum er play/pause.
- Hakkene på tidslinjen viser hvor trinnene ligger.

## Voice-over

Oplæsningen bruger browserens indbyggede talesyntese (`speechSynthesis`) med
`lang="da-DK"`. Ingen lydfiler, ingen serverkode, ingen udgift — men kvaliteten
afhænger af, hvilken dansk stemme der er installeret på enheden. Er der ingen,
siger siden det.

**"Vent på tale"** holder afspilningen tilbage ved *slutningen* af et trin, hvis
oplæsningen ikke er nået i mål. Den venter altså ikke i starten — så ville
billedet stå stille mens der blev talt. Det er styret af `Speaker.busy`, som
afspilleren spørger hvert billede; en tidligere version brugte callbacks, og den
virkede kun nogle gange, fordi `speechSynthesis.cancel()` udløser den *forrige*
oplæsnings `end`-event asynkront.

Skal der senere lægges rigtige indtalinger på, er der allerede plads til det:
sæt `audio: 'lyd/krydsloeb-3.mp3'` på et trin, så afspilles filen i stedet for
den syntetiske stemme. Koden skal ikke ændres.

## Kommentarer

`site/api/comments.php` gemmer kommentarer pr. scene i SQLite
(`site/api/data/comments.sqlite`, oprettes automatisk) og sender en mail til
Allan, når der kommer en ny. Ingen login, ingen redigering — sletning sker ved
at åbne databasen manuelt.

Spærrer mod misbrug: skjult honningkrukke-felt, mindst 20 sekunder mellem to
kommentarer fra samme IP, og højst 8 i timen. Scene-id skal matche
`[a-z0-9-]{1,40}`.

Modtager og afsender står som konstanter øverst i filen. Afsenderen skal blive
på `no-reply@vhg.dk` — mails fra en fremmed afsenderadresse bliver afvist.

## Banemarkeringer

Tegnet efter de officielle mål på 40 × 20 m: mållinje 2,85 m fra kortsiden,
målfelt 5 × 4 m, målvogterfelt 2,5 × 1 m, hjørneradius 1 m. Betegnelserne følger
den danske regelbog — **målfeltet er det største** af de to rektangler, og
målvogterfeltet er det lille indeni.

Det er en illustration til at forklare taktik med — ikke en opmålingstegning, og
bullypunkternes placering er vejledende.

De to lodrette stiplede hjælpelinjer deler banen i egen zone, midterbane og
angrebszone. **De findes ikke på en rigtig bane.** Der er hverken offside eller
blå linjer i floorball; de er der kun, så man kan tale om, hvor på banen man er.
De kan slås fra på siden.
