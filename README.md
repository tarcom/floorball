# Floorball-taktik

Animerede taktiksekvenser til et motionsfloorballhold. Banen ses ovenfra,
spillerne er farvede prikker, og en konkret situation spilles igennem med
tekst til hvert trin — og oplæsning, hvis man vil have den.

Alle scener er bygget på **6 mod 6**: målmand, center, to backs og to wings.
Vi forsvarer altid målet til venstre og angriber mod højre, i hver eneste
scene, så billedet er til at genkende.

**Live:** https://aogj.com/floorball

## Kør lokalt

```powershell
python -m http.server 8765 --directory site
# -> http://127.0.0.1:8765
```

Der er ingen build og ingen afhængigheder — fire JS-filer og et stylesheet.
PHP og MySQL bruges ikke; hosten hos one.com kan sagtens servere det, men
siden har ikke brug for en server til noget.

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
spillernavne, keyframes i forkert rækkefølge, spillere uden for banen,
mærkater der peger på ingenting, og prikker der lægger sig oven på
hinanden i mere end et sekund. Afslutter med kode 1 ved fejl.

## Deploy

```bash
python deploy.py
```

Lægger `site/` op i `/floorball/` over FTP og stempler `?v=<hash>` på css og
js, fordi one.com ligger bag en Varnish der ellers serverer forældede filer
i timevis. Loginoplysninger står i `.ftp-credentials`, som ikke er i git:

```
FTP_HOST=...
FTP_USER=...
FTP_PASS=...
```

## Filer

| Fil | Ansvar |
|---|---|
| `site/court.js` | Banens geometri og al tegning. Kender ikke til tid. |
| `site/engine.js` | Tidslinje, interpolation af keyframes, afspiller, oplæsning. |
| `site/scenes.js` | **Alt indhold.** Det er her man skriver taktik. |
| `site/app.js` | Menu, knapper, tegnerækkefølge. |
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

Vores mål står ved x = 2,85. Vi angriber mod høje x. "Venstre" og "højre"
er set i angrebsretningen, så venstre back (B1) står ved lave y.

På en telefon i højformat drejes banen 90 grader, så vi angriber opad. Det
er en ægte rotation, ikke et spejlbillede — venstre bliver ved med at være
venstre.

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
element for konstant fart — brug det til lange sprint, ellers ser det ud som
om spilleren tøver undervejs.

Modstanderens spillere hedder `aMV`, `aB1`, `aB2`, `aC`, `aW1`, `aW2` når
der refereres til dem fra `ball` eller `events`. De tegnes uden bogstav, så
øjet holder fast i vores eget hold.

To keyframes tæt på hinanden med forskellig position giver et hårdt klip.
Det bruges til at spille den samme situation igennem to gange med to udfald
— se `bully` og `bag-om-maalet`.

### events

```js
{ t: 2, until: 5, type: 'zone',   poly: [[7,7],[12,7],[12,13],[7,13]], color: '#2563eb', label: 'Boksen' }
{ t: 2, until: 4, type: 'arrow',  from: [24,5], to: [30,4], label: 'Løb', dash: true }
{ t: 2, until: 4, type: 'marker', at: [20,10], label: 'Bully' }
```

`from`, `to` og `at` må også være et spiller-id i stedet for koordinater,
så følger de spilleren. Udelades `until`, forsvinder mærket efter ca. to
sekunder.

### steps

`t` er det sekund, teksten skal skifte på. `focus: ['C','W1']` sætter en
pulserende ring om de nævnte spillere — brug det når en scene forklarer
pladser frem for et forløb.

Teksten er samtidig manuskriptet til oplæsningen. Vil man have en anden
formulering læst op end den, der står på skærmen, sættes `speech: '...'`.

## Voice-over

Oplæsningen bruger browserens indbyggede talesyntese (`speechSynthesis`)
med `lang="da-DK"`. Ingen lydfiler, ingen serverkode, ingen udgift — men
kvaliteten afhænger af, hvilken dansk stemme der er installeret på
enheden. Er der ingen, siger siden det.

"Vent på tale" holder animationen stille ved hvert trinskift, til
oplæsningen er færdig. Der er en sikkerhedstimeout, så afspilningen aldrig
hænger fast, hvis lyden fejler.

Skal der senere lægges rigtige indtalinger på, er der allerede plads til
det: sæt `audio: 'lyd/krydsloeb-3.mp3'` på et trin, så afspilles filen i
stedet for den syntetiske stemme. Koden skal ikke ændres.

## Banemarkeringer

Tegnet efter de officielle mål på 40 × 20 m: mållinje 2,85 m fra kortsiden,
målområde 5 × 4 m, målfelt 2,5 × 1 m, hjørneradius 1 m. Det er en
illustration til at forklare taktik med — ikke en opmålingstegning, og
bullypunkternes placering er vejledende.

De to lodrette stiplede hjælpelinjer deler banen i egen zone, midterbane og
angrebszone. **De findes ikke på en rigtig bane.** Der er hverken offside
eller blå linjer i floorball; de er der kun, så man kan tale om, hvor på
banen man er. De kan slås fra på siden.
