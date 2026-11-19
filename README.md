# 🚗 MoneyCount • PWA Kalkulačka nákladů cesty & Kniha jízd

Moderní, rychlá a offline **Progressive Web App (PWA)** pro přesný výpočet nákladů na cestu autem, férové rozpočítání ceny mezi řidiče a cestující podle ujetých km, generování QR plateb a osobní knihu jízd s ročními statistikami.

![MoneyCount Preview](icons/icon.svg)

---

## ✨ Hlavní funkce (verze 3.0)

- ⚡ **Okamžitý výpočet v reálném čase**:
  - **Vzdálenost v km** (včetně tlačítek `+20`, `+50`, `+100` km a přepínače `Tam a zpět 2×`).
  - **Průměrná spotřeba vozu** (l / 100 km) s plynulým posuvníkem a předvolbami (*Úsporné*, *Běžné*, *SUV/Město*).
  - **Cena za litr paliva** (Kč / l) s rychlými volbami pro Natural 95, Naftu, LPG a Elektro.
  - Podpora české desetinné čárky i tečky ve všech číselných polích.
- 👥 **Řidič a cestující s individuálním rozdělením**:
  - Nastavení **jména řidiče** a volba, zda se řidič **podílí na nákladech** (nebo celou cestu hradí spolucestující).
  - Tři režimy rozpočítání:
    - **Podle ujetých km**: Každý cestující může mít vlastní počet km (např. trasa má 50 km, ale jeden člověk jede jen 30 km – aplikace mu automaticky a férově přiřadí poměrnou část).
    - **Rovným dílem**: Náklady se dělí stejným dílem mezi všechny účastníky.
    - **Vlastní částka**: Možnost ručně zadat libovolnou částku pro jednotlivé osoby.
  - Vizuální kontrola: Systém kontroluje, zda součet všech podílů přesně sedí na 100 % celkové ceny.
- 📱 **QR Platba na míru (SPAYD)**:
  - Generování českého bankovního standardu QR plateb přímo v zařízení (funguje i 100% offline).
  - **Výběr příjemce**: QR kód lze vygenerovat pro celou jízdu i pro každého konkrétního cestujícího zvlášť (s jeho přesnou částkou a jménem v poznámce).
  - Automatický převod běžného čísla účtu (např. `123456789/0800`) na validní mezinárodní IBAN.
- 📖 **Osobní Kniha jízd**:
  - Ukládání uskutečněných cest s datem, cílem cesty, spotřebou, cenou a podrobným rozpisem účastníků.
  - **Sledování plateb**: Možnost u každého spolucestujícího jedním kliknutím označit, zda již zaplatil (`Zaplaceno ✓` / `K platbě ⏳`).
  - Možnost zpětného vyvolání QR kódu pro nezaplacené jízdy i opětovného načtení trasy do kalkulačky.
- 📊 **Roční statistiky & Přehled spolucestujících**:
  - Filtrování podle roku (např. *2026*, *2025*, *Všechny roky*).
  - **Kompletní bilance za rok**: Celkem projeté peníze (Kč), ujeté kilometry, spotřeba paliva a počet jízd.
  - **Žebříček / Bilance lidí**: Přehled o tom, kolik kdo v daném roce celkem najel km, kolik celkem projezdil a kolik zbývá doplatit.
- 💾 **Záloha a export dat**:
  - **Záloha do JSON**: Stažení kompletní zálohy knihy jízd do souboru a možnost jejího obnovení.
  - **Export do Excelu (CSV)**: Přehledná tabulka otevřitelná v Microsoft Excelu, Apple Numbers či Google Sheets (včetně české diakritiky UTF-8).
- 📴 **100% Offline podpora a automatická aktualizace (PWA)**:
  - Service Worker (`sw.js`) s automatickou detekcí nových verzí a okamžitým nasazením.
  - Možnost instalace přímo na plochu mobilu či počítače.

---

## 🚀 Jak aplikaci spustit lokálně

V kořenovém adresáři stačí spustit jakýkoliv lokální webový server:

```bash
# Pomocí Pythonu:
python3 -m http.server 8080

# Nebo pomocí Node.js:
npx serve
```

A otevřít v prohlížeči: [http://localhost:8080](http://localhost:8080).

---

## 📲 Jak nainstalovat jako aplikaci do telefonu

### iOS (iPhone / iPad):
1. Otevřete odkaz v prohlížeči **Safari**.
2. Klikněte na ikonu **Sdílet** (čtverec se šipkou nahoru).
3. Zvolte **Přidat na plochu** (*Add to Home Screen*).

### Android:
1. Otevřete odkaz v prohlížeči **Chrome**.
2. V pravém horním rohu aplikace klikněte na ikonu instalace, nebo v menu zvolte **Nainstalovat aplikaci**.
