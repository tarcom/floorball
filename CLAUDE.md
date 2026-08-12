# CLAUDE.md — floorball

Animeret floorball-taktik til VHG's seniorhold. Se `README.md` for
koordinatsystem, sceneformat og deploy — det er den fulde dokumentation.

Selvstændigt projekt, men bor på **vhg.dk/floorball/**. Det er ikke en del af
`C:\projects\vhg`-repoet og skal ikke flyttes derind.

## Kommandoer

```powershell
wsl -e bash -lc "cd /mnt/c/projects/floorball/site && php -S 0.0.0.0:8766 -t ."
node check.js                                 # kontrollér scenedata
python deploy.py                              # -> vhg.dk/floorball/
```

PHP findes ikke på Windows-siden, og kommentarfeltet kræver det. Kører du bare
`python -m http.server`, fejler kommentarerne stille — resten virker.

**Kør `node check.js` hver gang `site/scenes.js` er rettet.** Scenerne er
håndskrevne koordinater, og de fejl der opstår — et forkert spillernavn,
keyframes i omvendt rækkefølge, to prikker oven på hinanden — er næsten
usynlige, hvis man bare kigger på animationen.

`?t=4.6#krydsloeb` hopper til sekund 4,6 og holder pause. Brug den til at
kontrollere en scene billede for billede i stedet for at vente på den.

## ⚠️ Det der kan slette hele siden

`vhg`-repoets GitHub Action deployer hele `public_html/` og **sletter alt der
ikke står i `exclude`-listen** i `.github/workflows/deploy-ftp.yml`. Linjen
`floorball/**` skal blive stående der. Uden den forsvinder siden — inklusive
`api/data/comments.sqlite`, som kun findes på serveren — ved næste push til
`vhg`.

`deploy.py` sletter til gengæld aldrig noget og springer `data/`-mapper over.

## Ting der ikke må laves om uden grund

- **Vi forsvarer altid til venstre og angriber mod højre.** I hver eneste scene.
  Hele pointen er, at holdet kan genkende billedet uden at orientere sig forfra
  hver gang. På smal skærm drejes banen 90 grader (angreb opad) — det er en ægte
  rotation, ikke et spejlbillede.
- **Modstanderen tegnes uden bogstav.** Halverer rodet på skærmen og holder øjet
  på vores eget hold.
- **De stiplede zonelinjer findes ikke på en rigtig bane.** Der er hverken
  offside eller blå linjer i floorball. Det skal blive ved med at stå på siden.
- **Mærkater tegnes i et lag efter spillerne** (`labels` i `app.js`). Tegnes de
  sammen med pilene, lægger prikkerne sig oven på teksten.
- **Bolden ligger 0,85 m foran den, der fører den** (`stickOffset` i
  `engine.js`), ellers forsvinder den ind under spillerprikken.
- **Vent-på-tale spørger `Speaker.busy` hvert billede** — det må ikke laves om
  til callbacks igen. `speechSynthesis.cancel()` udløser den *forrige*
  oplæsnings `end`-event asynkront, og den slap tidligere den nye pause fri.
  Derfor virkede funktionen kun nogle gange. `token`-tælleren i `Speaker` gør
  forældede events uskadelige.
- **Scenen kører ikke i ring.** Den stopper ved enden, og brugeren starter selv
  igen.
- **Ingen udvisningsscener.** Vi har ingen dommer og spiller fair play, så
  over- og undertal er bevidst fjernet.

## Regelsiden

`site/regler.html` citerer regelnumre fra *Spilleregler for floorball*
(Floorball Danmark, gældende 1. juli 2022). **Gæt aldrig et regelnummer** —
sidens eneste værdi er, at man kan slå efter. Hent PDF'en og verificér:

```bash
curl -sSL -A "Mozilla/5.0" -o regler.pdf \
  "https://floorball.dk/wp-content/uploads/2022/09/Spilleregler-pr.-1.-juli-2022_ink.-forside.pdf"
```

(WebFetch giver 403 på den — brug curl med en browser-UA.)

Bemærk at afsnit 507 er frislag og 605 er mindre holdstraf. Flere forseelser
findes i begge lister med *forskellige* numre — fx er hånd/arm på bolden 605.14,
ikke 507.14.

## Indhold frem for kode

Motoren er færdig. Næsten alt arbejde herfra er at skrive nye scener i
`site/scenes.js` — teksten er lige så vigtig som bevægelserne, og den er
samtidig manuskript til oplæsningen. Skriv til en voksen der har spillet i mange
år, men aldrig har fået taktikken forklaret.

Tonen må gerne være let. Det er et motionshold der drikker en øl efter træning,
ikke en eliteklub — men vittigheden skal aldrig gå ud over, om pointen er klar.
