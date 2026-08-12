# CLAUDE.md — floorball

Animeret floorball-taktik til et motionshold. Se `README.md` for
koordinatsystem, sceneformat og deploy — det er den fulde dokumentation.

## Kommandoer

```powershell
python -m http.server 8765 --directory site   # kør lokalt
node check.js                                 # kontrollér scenedata
python deploy.py                              # -> aogj.com/floorball
```

**Kør `node check.js` hver gang `site/scenes.js` er rettet.** Scenerne er
håndskrevne koordinater, og de fejl der opstår — et forkert spillernavn,
keyframes i omvendt rækkefølge, to prikker oven på hinanden — er næsten
usynlige, hvis man bare kigger på animationen.

`?t=4.6#krydsloeb` hopper til sekund 4,6 og holder pause. Brug den til at
kontrollere en scene billede for billede i stedet for at vente på den.

## Ting der ikke må laves om uden grund

- **Vi forsvarer altid til venstre og angriber mod højre.** I hver eneste
  scene. Hele pointen er, at holdet kan genkende billedet uden at orientere
  sig forfra hver gang.
- **Modstanderen tegnes uden bogstav.** Halverer rodet på skærmen og holder
  øjet på vores eget hold.
- **De stiplede zonelinjer findes ikke på en rigtig bane.** Der er hverken
  offside eller blå linjer i floorball. De er en hjælp til at tale om banen,
  og det skal blive ved med at stå på siden.
- **Mærkater tegnes i et lag efter spillerne** (`labels` i `app.js`).
  Tegnes de sammen med pilene, lægger prikkerne sig oven på teksten.
- **Bolden ligger 0,85 m foran den, der fører den** (`stickOffset` i
  `engine.js`), ellers forsvinder den ind under spillerprikken.

## Indhold frem for kode

Motoren er færdig. Næsten alt arbejde herfra er at skrive nye scener i
`site/scenes.js` — teksten er lige så vigtig som bevægelserne, og den er
samtidig manuskript til oplæsningen. Skriv til en voksen der har spillet
i mange år, men aldrig har fået taktikken forklaret.
