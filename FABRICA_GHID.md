# Fabrica ta 24/7 de site-uri — GHID SCURT (fără bătăi de cap)

Ce este: pe laptopul tău rulează acum o „fabrică" care generează site-uri singură,
din comenzi puse într-o coadă. Tu doar dai comanda. Ea lucrează non-stop.

==================================================================
1) CUM PUI O COMANDĂ NOUĂ (generezi un site)
==================================================================
Deschide Explorer, du-te în folderul WebsiteAgent, dă dublu-click pe:

        factory-add.bat

Ți se deschide o fereastră unde scrii ce site vrei, de exemplu:
        "Site premium pentru un restaurant vegan din Cluj"

Apasă Enter. Gata. Fabrica îl va construi singură (durează câteva minute).

Alternativ, din linia de comandă:
        factory-add.bat "Site pentru un salon de înfrumusețare din Iași"

==================================================================
2) CUM VEI COMANDA PRIN „CHATURILE TALE DE AI" (workerii conectați)
==================================================================
Toate conturile tale de AI sunt acum muncitori în fabrică, prin API-urile
lor oficiale (varianta sigură — nu se automatizează interfața web, nu riști
ban). Sunt conectați și răspund live:

  ✅ Google Gemini      (cheie prezentă)
  ✅ OpenAI ChatGPT     (cheie prezentă)
  ✅ xAI Grok           (cheie prezentă — dar contul tău nou nu are credite;
                         cumpără pe console.x.ai ca să lucreze)
  ✅ DeepSeek           (cheie prezentă)
  ✅ Cerebras           (cheie prezentă)
  ✅ OpenRouter         (cheie prezentă — adaugă credite pe openrouter.ai)
  ⚫ Anthropic Claude   (LIPEȘTE cheia — vezi secțiunea 4)

Ca să vorbești cu toți muncitorii dintr-o dată, deschide o comandă în
folderul WebsiteAgent și scrie:
        node chat-worker.mjs "Scrie un slogan pentru un salon de masaj"

Ca să întrebi unul singur:
        node chat-worker.mjs --worker gemini "slogan pentru salon masaj"
        node chat-worker.mjs --list      (arată cine e conectat)

==================================================================
3) CUM PORNEȘTE SINGURĂ (fără să faci tu nimic)
==================================================================
La fiecare logare pe Windows, fabrica pornește automat (e în Startup).
Nu trebuie să deschizi nimic.

Ca s-o pornești manual acum: dă dublu-click pe  factory-start.bat
Ca s-o oprești: încheie procesul „node" din Task Manager, sau închide laptopul.

Unde vezi ce lucrează:  logs/factory.log  (se actualizează live)

==================================================================
4) CE TREBUIE SĂ COMPLETEZI TU (doar dacă vrei mai mult)
==================================================================
Deschide fișierul  WebsiteAgent\.env  cu un editor de text și:

  a) Pentru Claude (Anthropic): pune cheia ta de la console.anthropic.com
     după  ANTHROPIC_API_KEY=   (acum e gol, deci e dezactivat)

  b) Pentru xAI / OpenRouter: au chei, dar conturile lor au nevoie de credite
     cumpărate pe console.x.ai  și  openrouter.ai/settings/credits

Restul cheilor sunt deja puse și funcționează.

==================================================================
5) CE A RĂMAS DE FĂCUT PENTRU „24/7 DUPĂ REBOOT" (o singură setare)
==================================================================
Acum fabrica pornește la LOGARE. Dar dacă laptopul se închide/restartează,
cineva trebuie să se logheze ca ea să reînceapă. Pentru adevăratul 24/7 fără
niciun gest, setează „autologon" (logare automată la pornire):

  - Apasă  Windows + R, scrie  netplwiz  , Enter
  - Debifează „Trebuie să introducă numele și parola"
  - Apply → introdu parola ta o dată
  (Sau: Windows+R → regedit → setează AutoAdminLogon=1 în
   HKLM\Software\Microsoft\Windows NT\CurrentVersion\Winlogon)

ATENȚIE: dacă laptopul hibernează când închizi capacul, fabrica se oprește.
Pentru 24/7 real, ține-l la curent și setează „La închiderea capacului → Nu se
face nimic" (Setări → Sistem → Alimentare → Când se închide capacul).

==================================================================
6) FIȘIERELE CREATE / MODIFICATE PENTRU TINE
==================================================================
  run-factory.mjs     → watchdog-ul 24/7 (repornește fabrica dacă moare)
  factory-start.bat   → pornește fabrica (folosit de Startup)
  factory-add.bat     → adaugă o comandă în coadă (tu doar scrii ce vrei)
  chat-worker.mjs     → vorbește cu toate conturile tale de AI deodată
  Startup/WebsiteAgent-Factory.lnk → fabrica pornește la logare
  docs/orders.json    → coada de comenzi (ORD-001, ORD-TEST, ORD-002...)

Generările ies în:  output/<runId>/site/   (index.html + styles.css + assets)

Gata. Nu trebuie să știi programare. Dai comanda, fabrica lucrează.
