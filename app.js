/**
 * MoneyCount - Kalkulačka nákladů cesty a Kniha jízd (PWA)
 * Verze: 3.2 (Oprava zarovnání kurzoru a zadávání čísel na mobilu iOS/Android)
 */

(function () {
  'use strict';

  const APP_VERSION = '3.2';
  const STORAGE_KEY = 'moneycount_data_v3';

  const DEFAULT_STATE = {
    // Trasa a vozidlo
    distance: 120,
    isRoundTrip: false,
    consumption: 6.5,
    fuelPrice: 36.50,
    extraVignette: 0,
    extraParking: 0,
    extraWear: 0,
    bankIban: '',
    qrNote: 'Cesta autem',

    // Řidič
    driverName: 'Já (řidič)',
    driverIncludesCost: true,

    // Režim rozpočítání: 'km' (podle ujetých km), 'equal' (rovným dílem), 'manual' (vlastní částka)
    splitMode: 'km',

    // Cestující (pole objektů)
    passengers: [
      { id: 'p1', name: 'Petr', distance: 120, customAmount: null },
      { id: 'p2', name: 'Jana', distance: 120, customAmount: null },
      { id: 'p3', name: 'Michal', distance: 60, customAmount: null }
    ],

    // Uložené šablony tras
    savedTrips: [],

    // Kniha jízd (Záznamy o provedených cestách)
    logbook: []
  };

  let state = { ...DEFAULT_STATE };
  let deferredPrompt = null;
  let activeTab = 'calc'; // 'calc' | 'logbook'
  let selectedLogbookYear = 'all'; // 'all' | '2026' etc.
  let qrSelectedTarget = 'all'; // 'all' | 'driver' | passenger id

  // --- Helper pro převod textu s čárkou i tečkou na číslo ---
  function parseLocaleFloat(val) {
    if (val === null || val === undefined) return 0;
    const str = String(val).trim().replace(/\s+/g, '').replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }

  // --- Helper pro formátování čísla do vstupu s českou čárkou ---
  function formatInputVal(num, decimals = null) {
    if (num === null || num === undefined || isNaN(num) || num === 0) return '0';
    if (decimals !== null) {
      return num.toFixed(decimals).replace('.', ',');
    }
    return String(num).replace('.', ',');
  }

  // --- Formátování peněz ---
  function formatMoney(amount, isDecimalAllowed = false) {
    if (isNaN(amount) || amount === 0) return '0';
    if (!isDecimalAllowed || Math.abs(amount) >= 1000) {
      return Math.round(amount).toLocaleString('cs-CZ');
    }
    if (amount % 1 !== 0) {
      return amount.toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    }
    return Math.round(amount).toLocaleString('cs-CZ');
  }

  function formatNumber(num, decimals = 1) {
    if (isNaN(num)) return '0';
    return Number(num).toLocaleString('cs-CZ', {
      minimumFractionDigits: num % 1 === 0 ? 0 : 1,
      maximumFractionDigits: decimals
    });
  }

  function formatDateCs(isoDateStr) {
    if (!isoDateStr) return '';
    const parts = isoDateStr.split('-');
    if (parts.length === 3) {
      return `${parseInt(parts[2], 10)}. ${parseInt(parts[1], 10)}. ${parts[0]}`;
    }
    return isoDateStr;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // --- Haptic Feedback Helper ---
  function triggerHaptic() {
    if (navigator.vibrate) {
      navigator.vibrate(12);
    }
  }

  // --- DOM Elements Cache ---
  const el = {
    // Tabs & Views
    tabBtnCalc: document.getElementById('tabBtnCalc'),
    tabBtnLogbook: document.getElementById('tabBtnLogbook'),
    viewCalculator: document.getElementById('viewCalculator'),
    viewLogbook: document.getElementById('viewLogbook'),
    logbookCountBadge: document.getElementById('logbookCountBadge'),

    // Hero
    heroBadgeLabel: document.getElementById('heroBadgeLabel'),
    resPerPerson: document.getElementById('resPerPerson'),
    resTotalCost: document.getElementById('resTotalCost'),
    resFuelLiters: document.getElementById('resFuelLiters'),
    resPerKm: document.getElementById('resPerKm'),
    shareBtn: document.getElementById('shareBtn'),
    openQrBtn: document.getElementById('openQrBtn'),
    openLogTripModalBtn: document.getElementById('openLogTripModalBtn'),
    installBtn: document.getElementById('installBtn'),
    resetBtn: document.getElementById('resetBtn'),

    // Inputs
    distanceInput: document.getElementById('distanceInput'),
    roundTripBtn: document.getElementById('roundTripBtn'),
    consumptionInput: document.getElementById('consumptionInput'),
    consumptionRange: document.getElementById('consumptionRange'),
    fuelPriceInput: document.getElementById('fuelPriceInput'),
    passengersInput: document.getElementById('passengersInput'),
    passengerMinus: document.getElementById('passengerMinus'),
    passengerPlus: document.getElementById('passengerPlus'),
    passengersVisual: document.getElementById('passengersVisual'),
    extraVignette: document.getElementById('extraVignette'),
    extraParking: document.getElementById('extraParking'),
    extraWear: document.getElementById('extraWear'),
    extraCostsBadge: document.getElementById('extraCostsBadge'),

    // Driver & Split
    driverNameInput: document.getElementById('driverNameInput'),
    driverIncludesCostToggle: document.getElementById('driverIncludesCostToggle'),
    driverCostDisplay: document.getElementById('driverCostDisplay'),
    passengersCountLabel: document.getElementById('passengersCountLabel'),
    addPassengerBtn: document.getElementById('addPassengerBtn'),
    passengersList: document.getElementById('passengersList'),
    splitSummaryBar: document.getElementById('splitSummaryBar'),
    splitSummaryText: document.getElementById('splitSummaryText'),

    // Saved Templates
    saveTripBtn: document.getElementById('saveTripBtn'),
    savedTripsList: document.getElementById('savedTripsList'),

    // Logbook Tab
    logbookYearPills: document.getElementById('logbookYearPills'),
    newTripFromLogbookBtn: document.getElementById('newTripFromLogbookBtn'),
    statsPeriodTitle: document.getElementById('statsPeriodTitle'),
    statYearCost: document.getElementById('statYearCost'),
    statYearKm: document.getElementById('statYearKm'),
    statYearFuel: document.getElementById('statYearFuel'),
    statYearTrips: document.getElementById('statYearTrips'),
    peopleStatsContainer: document.getElementById('peopleStatsContainer'),
    logbookTripsContainer: document.getElementById('logbookTripsContainer'),
    exportJsonBtn: document.getElementById('exportJsonBtn'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    importJsonBtn: document.getElementById('importJsonBtn'),
    importFileInput: document.getElementById('importFileInput'),
    clearLogbookBtn: document.getElementById('clearLogbookBtn'),

    // Modal: Zápis do Knihy jízd
    logTripModal: document.getElementById('logTripModal'),
    closeLogTripModal: document.getElementById('closeLogTripModal'),
    dismissLogTripBtn: document.getElementById('dismissLogTripBtn'),
    confirmSaveLogTripBtn: document.getElementById('confirmSaveLogTripBtn'),
    logTripTitleInput: document.getElementById('logTripTitleInput'),
    logTripDateInput: document.getElementById('logTripDateInput'),
    logTripNoteInput: document.getElementById('logTripNoteInput'),
    logPreviewDistance: document.getElementById('logPreviewDistance'),
    logPreviewCost: document.getElementById('logPreviewCost'),
    logPreviewPeopleList: document.getElementById('logPreviewPeopleList'),

    // Modal: QR Platba
    qrModal: document.getElementById('qrModal'),
    closeQrModal: document.getElementById('closeQrModal'),
    dismissQrModalBtn: document.getElementById('dismissQrModalBtn'),
    qrPersonChips: document.getElementById('qrPersonChips'),
    qrCanvas: document.getElementById('qrCanvas'),
    qrAmountDisplay: document.getElementById('qrAmountDisplay'),
    qrForPersonLabel: document.getElementById('qrForPersonLabel'),
    bankIbanInput: document.getElementById('bankIbanInput'),
    qrNoteInput: document.getElementById('qrNoteInput'),
    copySpaydStringBtn: document.getElementById('copySpaydStringBtn'),

    // Toast & Reload
    toast: document.getElementById('toast'),
    forceUpdateAppBtn: document.getElementById('forceUpdateAppBtn')
  };

  // --- Init ---
  function init() {
    loadSavedState();
    registerServiceWorker();
    setupPwaInstall();
    bindEvents();
    renderAll(true);
  }

  // --- LocalStorage & Migrace ---
  function loadSavedState() {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        raw = localStorage.getItem('moneycount_data_v2') || localStorage.getItem('moneycount_data_v1');
      }
      if (raw) {
        const parsed = JSON.parse(raw);
        state = { ...DEFAULT_STATE, ...parsed };

        // Zpětná kompatibilita: pokud bylo `passengers` číslo, vygenerujeme pole
        if (typeof state.passengers === 'number' || !Array.isArray(state.passengers)) {
          const count = Math.max(1, parseInt(state.passengers, 10) || 4);
          state.passengers = [];
          const passCount = state.driverIncludesCost ? Math.max(1, count - 1) : count;
          for (let i = 1; i <= passCount; i++) {
            state.passengers.push({
              id: 'p_' + Date.now() + '_' + i,
              name: `Cestující ${i}`,
              distance: state.distance,
              customAmount: null
            });
          }
        }

        if (!Array.isArray(state.logbook)) {
          state.logbook = [];
        }
      }
    } catch (e) {
      console.warn('Nelze načíst stav z localStorage:', e);
      state = { ...DEFAULT_STATE };
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Nelze uložit stav do localStorage:', e);
    }
  }

  // --- Service Worker ---
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });

      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('./sw.js?v=' + APP_VERSION)
          .then((reg) => {
            reg.update();

            document.addEventListener('visibilitychange', () => {
              if (document.visibilityState === 'visible') {
                reg.update();
              }
            });

            setInterval(() => {
              reg.update();
            }, 60 * 1000);

            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                    showToast('Aktualizuji na novou verzi...');
                  }
                });
              }
            });
          })
          .catch((err) => {
            console.warn('SW registrace selhala:', err);
          });
      });
    }
  }

  function setupPwaInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (el.installBtn) el.installBtn.classList.remove('hidden');
    });

    if (el.installBtn) {
      el.installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          showToast('Aplikace byla úspěšně nainstalována!');
        }
        deferredPrompt = null;
        el.installBtn.classList.add('hidden');
      });
    }

    window.addEventListener('appinstalled', () => {
      if (el.installBtn) el.installBtn.classList.add('hidden');
      deferredPrompt = null;
    });
  }

  // --- Výpočty nákladů a rozdělení ---
  function calculate() {
    const distanceVal = Math.max(0, parseLocaleFloat(state.distance));
    const effectiveDistance = state.isRoundTrip ? distanceVal * 2 : distanceVal;
    const consumption = Math.max(0, parseLocaleFloat(state.consumption));
    const fuelPrice = Math.max(0, parseLocaleFloat(state.fuelPrice));

    // Palivo
    const fuelLiters = (effectiveDistance * consumption) / 100;
    const fuelCost = fuelLiters * fuelPrice;

    // Extra náklady
    const extraVignette = Math.max(0, parseLocaleFloat(state.extraVignette));
    const extraParking = Math.max(0, parseLocaleFloat(state.extraParking));
    const extraWear = Math.max(0, parseLocaleFloat(state.extraWear));
    const wearTotal = extraWear * effectiveDistance;
    const extraTotal = extraVignette + extraParking + wearTotal;

    // Celková cena
    const totalCost = fuelCost + extraTotal;
    const perKm = effectiveDistance > 0 ? (totalCost / effectiveDistance) : 0;

    // Rozdělení mezi řidiče a cestující
    const split = calculateSplit(totalCost, effectiveDistance);

    return {
      distanceVal,
      effectiveDistance,
      consumption,
      fuelPrice,
      fuelLiters,
      fuelCost,
      extraTotal,
      totalCost,
      perKm,
      split
    };
  }

  function calculateSplit(totalCost, carDistance) {
    const driver = {
      name: (state.driverName || 'Řidič').trim(),
      includesCost: !!state.driverIncludesCost,
      distance: carDistance,
      amount: 0
    };

    const passengers = (state.passengers || []).map((p, idx) => {
      const dist = p.distance !== undefined && p.distance !== null ? Math.min(carDistance, Math.max(0, parseLocaleFloat(p.distance))) : carDistance;
      return {
        id: p.id || 'p_' + idx,
        name: (p.name || `Cestující ${idx + 1}`).trim(),
        distance: dist,
        amount: 0,
        customAmount: p.customAmount !== null && p.customAmount !== undefined ? parseLocaleFloat(p.customAmount) : null
      };
    });

    if (totalCost <= 0) {
      return { driver, passengers, totalAllocated: 0, diff: 0 };
    }

    // Seznam platících účastníků
    const paying = [];
    if (driver.includesCost) {
      paying.push({ isDriver: true, distance: carDistance, id: 'driver' });
    }
    passengers.forEach((p, idx) => {
      paying.push({ isDriver: false, index: idx, distance: p.distance, id: p.id, customAmount: p.customAmount });
    });

    if (paying.length === 0) {
      return { driver, passengers, totalAllocated: 0, diff: totalCost };
    }

    if (state.splitMode === 'equal') {
      // Rovným dílem
      const count = paying.length;
      const baseShare = Math.round(totalCost / count);
      let assigned = 0;

      paying.forEach((part, i) => {
        const share = (i === count - 1) ? (Math.round(totalCost) - assigned) : baseShare;
        assigned += share;
        if (part.isDriver) {
          driver.amount = share;
        } else {
          passengers[part.index].amount = share;
        }
      });
    } else if (state.splitMode === 'km') {
      // Podle ujetých km (vážený součet osobo-kilometrů)
      const totalPersonKm = paying.reduce((sum, p) => sum + p.distance, 0);

      if (totalPersonKm <= 0) {
        // Fallback rovným dílem
        const count = paying.length;
        const baseShare = Math.round(totalCost / count);
        paying.forEach((part) => {
          if (part.isDriver) driver.amount = baseShare;
          else passengers[part.index].amount = baseShare;
        });
      } else {
        const shares = paying.map((part) => {
          const exact = (part.distance / totalPersonKm) * totalCost;
          const rounded = Math.round(exact);
          return { part, exact, rounded };
        });

        const currentSum = shares.reduce((sum, s) => sum + s.rounded, 0);
        let diff = Math.round(totalCost) - currentSum;

        // Rozděl haléřový zaokrouhlovací zbytek podle největší odchylky
        if (diff !== 0) {
          const sorted = [...shares].sort((a, b) => (b.exact - b.rounded) - (a.exact - a.rounded));
          const step = diff > 0 ? 1 : -1;
          let d = Math.abs(diff);
          let i = 0;
          while (d > 0 && i < sorted.length) {
            sorted[i].rounded += step;
            d--;
            i = (i + 1) % sorted.length;
          }
        }

        shares.forEach((s) => {
          if (s.part.isDriver) {
            driver.amount = s.rounded;
          } else {
            passengers[s.part.index].amount = s.rounded;
          }
        });
      }
    } else if (state.splitMode === 'manual') {
      // Vlastní částky
      passengers.forEach((p) => {
        p.amount = p.customAmount !== null ? Math.round(p.customAmount) : 0;
      });

      const passengersSum = passengers.reduce((sum, p) => sum + p.amount, 0);
      if (driver.includesCost) {
        driver.amount = Math.max(0, Math.round(totalCost) - passengersSum);
      } else {
        driver.amount = 0;
      }
    }

    const totalAllocated = (driver.amount || 0) + passengers.reduce((sum, p) => sum + (p.amount || 0), 0);
    const diff = Math.round(totalCost) - totalAllocated;

    return {
      driver,
      passengers,
      totalAllocated,
      diff
    };
  }

  // --- Renderování UI ---
  function renderAll(forceInputs = false) {
    if (forceInputs) {
      if (el.distanceInput) el.distanceInput.value = formatInputVal(state.distance);
      if (el.consumptionInput) el.consumptionInput.value = formatInputVal(state.consumption, 1);
      if (el.consumptionRange) el.consumptionRange.value = parseLocaleFloat(state.consumption);
      if (el.fuelPriceInput) el.fuelPriceInput.value = formatInputVal(state.fuelPrice, 2);
      if (el.extraVignette) el.extraVignette.value = state.extraVignette ? formatInputVal(state.extraVignette) : '0';
      if (el.extraParking) el.extraParking.value = state.extraParking ? formatInputVal(state.extraParking) : '0';
      if (el.extraWear) el.extraWear.value = state.extraWear ? formatInputVal(state.extraWear) : '0';
      if (el.driverNameInput) el.driverNameInput.value = state.driverName || 'Já (řidič)';
      if (el.driverIncludesCostToggle) el.driverIncludesCostToggle.checked = !!state.driverIncludesCost;
    } else {
      if (el.consumptionRange && document.activeElement !== el.consumptionRange) {
        el.consumptionRange.value = parseLocaleFloat(state.consumption);
      }
    }

    // Synchronizace počítadla cestujících ve stepperu
    const totalPeople = (state.driverIncludesCost ? 1 : 0) + (state.passengers ? state.passengers.length : 0);
    if (el.passengersInput) {
      el.passengersInput.value = totalPeople;
    }

    // Toggle tam a zpět
    if (el.roundTripBtn) {
      el.roundTripBtn.setAttribute('aria-pressed', state.isRoundTrip ? 'true' : 'false');
    }

    // Výpočet
    const results = calculate();

    // Hero Karta
    if (el.resTotalCost) el.resTotalCost.textContent = formatMoney(results.totalCost);
    if (el.resFuelLiters) el.resFuelLiters.textContent = formatNumber(results.fuelLiters, 1);
    if (el.resPerKm) el.resPerKm.textContent = formatNumber(results.perKm, 2);

    // Hlavní částka v Hero kartě
    if (el.resPerPerson) {
      if (results.split.passengers.length > 0) {
        // Pokud mají všichni stejnou částku, zobrazíme ji, jinak průměr nebo rozsah
        const firstShare = results.split.passengers[0].amount;
        const allSame = results.split.passengers.every((p) => p.amount === firstShare);
        if (allSame && (!results.split.driver.includesCost || results.split.driver.amount === firstShare)) {
          el.resPerPerson.textContent = formatMoney(firstShare);
          if (el.heroBadgeLabel) el.heroBadgeLabel.textContent = 'Cena za jednoho';
        } else {
          el.resPerPerson.textContent = formatMoney(firstShare);
          if (el.heroBadgeLabel) el.heroBadgeLabel.textContent = 'Rozpis na osobu od';
        }
      } else {
        el.resPerPerson.textContent = formatMoney(results.totalCost);
        if (el.heroBadgeLabel) el.heroBadgeLabel.textContent = 'Celá cesta pro řidiče';
      }
    }

    // Extra badge
    if (el.extraCostsBadge) {
      el.extraCostsBadge.textContent = results.extraTotal > 0 ? `+${formatMoney(results.extraTotal)} Kč` : '+0 Kč';
    }

    // Palivové presety highlight
    const currentPrice = parseLocaleFloat(state.fuelPrice);
    document.querySelectorAll('.fuel-chip').forEach((btn) => {
      const chipPrice = parseFloat(btn.dataset.price);
      if (Math.abs(chipPrice - currentPrice) < 0.05) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    // Režim rozpočítání pills
    document.querySelectorAll('.split-pill').forEach((btn) => {
      if (btn.dataset.splitMode === state.splitMode) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    // Řidič
    if (el.driverCostDisplay) {
      if (!state.driverIncludesCost) {
        el.driverCostDisplay.textContent = '0 Kč (neplatí)';
        el.driverCostDisplay.style.opacity = '0.6';
      } else {
        el.driverCostDisplay.textContent = `${formatMoney(results.split.driver.amount)} Kč`;
        el.driverCostDisplay.style.opacity = '1';
      }
    }

    // Cestující seznam
    renderPassengersList(results);

    // Šablony tras
    renderSavedTrips();

    // Kniha jízd a statistiky
    renderLogbook();

    // Uložení stavu
    saveState();
  }

  // --- Renderování seznamu cestujících ---
  function renderPassengersList(results) {
    if (!el.passengersList) return;

    const carDist = results.effectiveDistance;
    const passengers = state.passengers || [];

    if (el.passengersCountLabel) {
      el.passengersCountLabel.textContent = `Spolucestující (${passengers.length})`;
    }

    // Pokud uživatel zrovna píše do některého z inputů uvnitř seznamu cestujících,
    // nepřekreslujeme celý DOM (jinak by ztratil focus a klávesnici), pouze aktualizujeme data
    const activeEl = document.activeElement;
    const isEditingInsideList = el.passengersList.contains(activeEl);
    const existingCards = el.passengersList.querySelectorAll('.passenger-card');

    if (isEditingInsideList && existingCards.length === passengers.length) {
      passengers.forEach((p, idx) => {
        const splitInfo = results.split.passengers[idx] || { amount: 0, distance: carDist };
        const card = existingCards[idx];
        if (!card) return;

        const tag = card.querySelector('.passenger-amount-tag');
        if (tag) tag.textContent = `${formatMoney(splitInfo.amount)} Kč`;

        const nameInput = card.querySelector('.passenger-name-input');
        if (nameInput && nameInput !== activeEl) nameInput.value = p.name;

        const distInput = card.querySelector('.passenger-dist-input');
        if (distInput && distInput !== activeEl) distInput.value = formatInputVal(splitInfo.distance);

        const customInput = card.querySelector('.passenger-custom-amount-input');
        if (customInput && customInput !== activeEl) {
          customInput.value = formatInputVal(p.customAmount !== null ? p.customAmount : splitInfo.amount);
        }
      });
      return;
    }

    el.passengersList.innerHTML = '';

    passengers.forEach((p, idx) => {
      const splitInfo = results.split.passengers[idx] || { amount: 0, distance: carDist };
      const card = document.createElement('div');
      card.className = 'passenger-card';

      const initial = (p.name && p.name.trim().length > 0) ? p.name.trim()[0].toUpperCase() : `${idx + 1}`;

      card.innerHTML = `
        <div class="passenger-header-row">
          <div class="passenger-user-info">
            <div class="passenger-avatar-circle">${initial}</div>
            <input type="text" class="passenger-name-input" data-idx="${idx}" value="${escapeHtml(p.name)}" placeholder="Jméno" />
          </div>
          <div class="passenger-meta-right">
            <div class="passenger-amount-tag">${formatMoney(splitInfo.amount)} Kč</div>
            <div class="passenger-buttons-wrap">
              <button type="button" class="passenger-action-icon-btn btn-qr-action" data-idx="${idx}" title="QR Platba pro ${escapeHtml(p.name)}" aria-label="QR platba">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/></svg>
              </button>
              <button type="button" class="passenger-action-icon-btn btn-share-person" data-idx="${idx}" title="Sdílet rozpis pro ${escapeHtml(p.name)}" aria-label="Sdílet">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
              </button>
              <button type="button" class="passenger-action-icon-btn btn-del-action" data-idx="${idx}" title="Odebrat cestujícího" aria-label="Smazat">
                &times;
              </button>
            </div>
          </div>
        </div>

        <div class="passenger-controls-row">
          ${state.splitMode === 'manual' ? `
            <div class="passenger-dist-box-wrap">
              <span class="passenger-sub-label">Vlastní částka:</span>
              <div class="passenger-km-box">
                <input type="text" class="passenger-km-input passenger-custom-amount-input" data-idx="${idx}" value="${formatInputVal(p.customAmount !== null ? p.customAmount : splitInfo.amount)}" inputmode="decimal" />
                <span class="passenger-km-suffix">Kč</span>
              </div>
            </div>
          ` : `
            <div class="passenger-dist-box-wrap">
              <span class="passenger-sub-label">Ujeto:</span>
              <div class="passenger-km-box">
                <input type="text" class="passenger-km-input passenger-dist-input" data-idx="${idx}" value="${formatInputVal(splitInfo.distance)}" inputmode="decimal" />
                <span class="passenger-km-suffix">km</span>
              </div>
            </div>
            <div class="passenger-quick-chips">
              <button type="button" class="chip-xs set-full-dist-btn" data-idx="${idx}" title="Nastavit celou trasu">Celá (${carDist} km)</button>
              <button type="button" class="chip-xs set-half-dist-btn" data-idx="${idx}" title="Nastavit polovinu trasy">1/2 (${Math.round(carDist / 2)} km)</button>
            </div>
          `}
        </div>
      `;

      // Eventy pro kartu cestujícího
      const nameInput = card.querySelector('.passenger-name-input');
      nameInput.addEventListener('input', (e) => {
        state.passengers[idx].name = e.target.value;
        saveState();
      });

      const distInput = card.querySelector('.passenger-dist-input');
      if (distInput) {
        distInput.addEventListener('focus', () => {
          setTimeout(() => {
            try {
              distInput.select();
              distInput.setSelectionRange(0, distInput.value.length);
            } catch (e) {}
          }, 50);
        });
        distInput.addEventListener('input', (e) => {
          let val = parseLocaleFloat(e.target.value);
          state.passengers[idx].distance = val;
          renderAll(false);
        });
      }

      const customInput = card.querySelector('.passenger-custom-amount-input');
      if (customInput) {
        customInput.addEventListener('focus', () => {
          setTimeout(() => {
            try {
              customInput.select();
              customInput.setSelectionRange(0, customInput.value.length);
            } catch (e) {}
          }, 50);
        });
        customInput.addEventListener('input', (e) => {
          let val = parseLocaleFloat(e.target.value);
          state.passengers[idx].customAmount = val;
          renderAll(false);
        });
      }

      const kmBox = card.querySelector('.passenger-km-box');
      if (kmBox) {
        kmBox.addEventListener('click', (e) => {
          const inp = kmBox.querySelector('input');
          if (inp && e.target !== inp) {
            inp.focus();
          }
        });
      }

      const fullBtn = card.querySelector('.set-full-dist-btn');
      if (fullBtn) {
        fullBtn.addEventListener('click', () => {
          state.passengers[idx].distance = carDist;
          triggerHaptic();
          renderAll(false);
        });
      }

      const halfBtn = card.querySelector('.set-half-dist-btn');
      if (halfBtn) {
        halfBtn.addEventListener('click', () => {
          state.passengers[idx].distance = Math.round(carDist / 2);
          triggerHaptic();
          renderAll(false);
        });
      }

      const qrBtn = card.querySelector('.btn-qr-action');
      qrBtn.addEventListener('click', () => {
        qrSelectedTarget = p.id;
        triggerHaptic();
        updateAndShowQrModal();
      });

      const sharePersonBtn = card.querySelector('.btn-share-person');
      sharePersonBtn.addEventListener('click', () => {
        sharePassengerPayment(p, splitInfo.amount, splitInfo.distance, results);
      });

      const delBtn = card.querySelector('.btn-del-action');
      delBtn.addEventListener('click', () => {
        state.passengers.splice(idx, 1);
        triggerHaptic();
        renderAll(false);
        showToast('Cestující byl odebrán.');
      });

      el.passengersList.appendChild(card);
    });

    // Stav rozdělení (Audit sedění částky)
    if (el.splitSummaryBar && el.splitSummaryText) {
      const diff = results.split.diff;
      if (Math.abs(diff) <= 1) {
        el.splitSummaryBar.classList.remove('has-diff');
        el.splitSummaryText.textContent = `✓ Vše rozděleno (celkem ${formatMoney(results.split.totalAllocated)} Kč sedí na korunu)`;
      } else if (diff > 0) {
        el.splitSummaryBar.classList.add('has-diff');
        el.splitSummaryText.textContent = `Zbývá rozdělit: ${formatMoney(diff)} Kč`;
      } else {
        el.splitSummaryBar.classList.add('has-diff');
        el.splitSummaryText.textContent = `Přečerpáno o: ${formatMoney(Math.abs(diff))} Kč`;
      }
    }

    // Tečky v souhrnu
    if (el.passengersVisual) {
      el.passengersVisual.innerHTML = '';
      const totalParticipants = (state.driverIncludesCost ? 1 : 0) + passengers.length;
      for (let i = 1; i <= Math.min(totalParticipants, 10); i++) {
        const dot = document.createElement('div');
        dot.className = 'passenger-dot';
        dot.textContent = i;
        el.passengersVisual.appendChild(dot);
      }
    }
  }

  // --- Sdílení platby pro konkrétního cestujícího ---
  async function sharePassengerPayment(passenger, amount, distance, results) {
    triggerHaptic();
    const iban = normalizeToIban(state.bankIban);
    const textLines = [
      `🚗 Platba za cestu (${results.effectiveDistance} km celkem)`,
      `👤 Pro: ${passenger.name}`,
      `🛣️ Ujeto: ${distance} km`,
      `💰 Částka k úhradě: ${formatMoney(amount)} Kč`
    ];

    if (state.bankIban) {
      textLines.push(`🏦 Číslo účtu / IBAN: ${state.bankIban}`);
    }
    textLines.push(`📝 Zpráva pro příjemce: Cesta autem - ${passenger.name}`);

    const shareText = textLines.join('\n');

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Rozpis platby: ${passenger.name}`,
          text: shareText
        });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      showToast(`📋 Rozpis pro ${passenger.name} byl zkopírován do schránky!`);
    } catch (e) {
      showToast('Nelze zkopírovat rozpis.');
    }
  }

  // --- Kniha jízd a statistiky (Tab 2) ---
  function renderLogbook() {
    const logbook = state.logbook || [];

    // Aktualizace badge s počtem jízd
    if (el.logbookCountBadge) {
      el.logbookCountBadge.textContent = logbook.length;
      if (logbook.length > 0) {
        el.logbookCountBadge.classList.remove('hidden');
      } else {
        el.logbookCountBadge.classList.add('hidden');
      }
    }

    // Získání dostupných let
    const currentYearStr = new Date().getFullYear().toString();
    const yearsSet = new Set([currentYearStr]);
    logbook.forEach((trip) => {
      if (trip.date) {
        const y = trip.date.slice(0, 4);
        if (y) yearsSet.add(y);
      }
    });

    const yearsList = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));

    // Render year pills
    if (el.logbookYearPills) {
      el.logbookYearPills.innerHTML = '';
      
      const allPill = document.createElement('button');
      allPill.type = 'button';
      allPill.className = `year-pill ${selectedLogbookYear === 'all' ? 'active' : ''}`;
      allPill.textContent = 'Všechny roky';
      allPill.addEventListener('click', () => {
        selectedLogbookYear = 'all';
        triggerHaptic();
        renderLogbook();
      });
      el.logbookYearPills.appendChild(allPill);

      yearsList.forEach((yr) => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = `year-pill ${selectedLogbookYear === yr ? 'active' : ''}`;
        pill.textContent = yr;
        pill.addEventListener('click', () => {
          selectedLogbookYear = yr;
          triggerHaptic();
          renderLogbook();
        });
        el.logbookYearPills.appendChild(pill);
      });
    }

    // Filtrování jízd
    const filteredTrips = logbook.filter((t) => {
      if (selectedLogbookYear === 'all') return true;
      return t.date && t.date.startsWith(selectedLogbookYear);
    });

    // Titulek období
    if (el.statsPeriodTitle) {
      el.statsPeriodTitle.textContent = selectedLogbookYear === 'all' ? 'Kompletní bilance za všechna léta' : `Bilance za rok ${selectedLogbookYear}`;
    }

    // Statistické souhrny
    const totalCost = filteredTrips.reduce((sum, t) => sum + (t.totalCost || 0), 0);
    const totalKm = filteredTrips.reduce((sum, t) => sum + (t.effectiveDistance || t.distance || 0), 0);
    const totalFuel = filteredTrips.reduce((sum, t) => sum + (t.fuelLiters || 0), 0);
    const totalTripsCount = filteredTrips.length;

    if (el.statYearCost) el.statYearCost.textContent = `${formatMoney(totalCost)} Kč`;
    if (el.statYearKm) el.statYearKm.textContent = `${formatNumber(totalKm, 0)} km`;
    if (el.statYearFuel) el.statYearFuel.textContent = `${formatNumber(totalFuel, 1)} l`;
    if (el.statYearTrips) el.statYearTrips.textContent = `${totalTripsCount}`;

    // Agregace lidí ("kolik kdo projezdil a zaplatil")
    renderPeopleStats(filteredTrips);

    // Seznam jízd
    renderLogbookTripsList(filteredTrips);
  }

  function renderPeopleStats(trips) {
    if (!el.peopleStatsContainer) return;
    el.peopleStatsContainer.innerHTML = '';

    if (trips.length === 0) {
      el.peopleStatsContainer.innerHTML = '<p class="empty-trips-msg">V tomto období nejsou zaznamenané žádné jízdy.</p>';
      return;
    }

    const peopleMap = new Map();

    trips.forEach((trip) => {
      // Cestující
      (trip.passengers || []).forEach((p) => {
        const name = (p.name || 'Cestující').trim();
        if (!peopleMap.has(name)) {
          peopleMap.set(name, {
            name,
            distance: 0,
            totalAmount: 0,
            paidAmount: 0,
            unpaidAmount: 0,
            tripsCount: 0,
            isDriver: false
          });
        }
        const record = peopleMap.get(name);
        record.distance += Number(p.distance) || 0;
        record.totalAmount += Number(p.amount) || 0;
        if (p.isPaid) {
          record.paidAmount += Number(p.amount) || 0;
        } else {
          record.unpaidAmount += Number(p.amount) || 0;
        }
        record.tripsCount += 1;
      });

      // Řidič
      if (trip.driver && trip.driver.amount > 0) {
        const name = (trip.driver.name || 'Řidič').trim();
        if (!peopleMap.has(name)) {
          peopleMap.set(name, {
            name,
            distance: 0,
            totalAmount: 0,
            paidAmount: 0,
            unpaidAmount: 0,
            tripsCount: 0,
            isDriver: true
          });
        }
        const record = peopleMap.get(name);
        record.distance += Number(trip.driver.distance || trip.effectiveDistance) || 0;
        record.totalAmount += Number(trip.driver.amount) || 0;
        record.paidAmount += Number(trip.driver.amount) || 0; // Řidič hradí sám
        record.tripsCount += 1;
      }
    });

    const peopleList = Array.from(peopleMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);

    if (peopleList.length === 0) {
      el.peopleStatsContainer.innerHTML = '<p class="empty-trips-msg">Žádné osoby v záznamech.</p>';
      return;
    }

    peopleList.forEach((person) => {
      const card = document.createElement('div');
      card.className = 'person-stat-card';

      const initial = person.name.length > 0 ? person.name[0].toUpperCase() : '?';
      const hasDebt = person.unpaidAmount > 0;

      card.innerHTML = `
        <div class="person-stat-profile">
          <div class="passenger-avatar-circle">${initial}</div>
          <div>
            <div class="person-stat-name">${escapeHtml(person.name)} ${person.isDriver ? '<span class="driver-badge">ŘIDIČ</span>' : ''}</div>
            <div class="person-stat-trips-count">${person.tripsCount} ${person.tripsCount === 1 ? 'jízda' : (person.tripsCount < 5 ? 'jízdy' : 'jízd')}</div>
          </div>
        </div>

        <div class="person-stat-numbers">
          <div class="person-stat-km-col">
            <span class="person-stat-label-xs">Ujeto</span>
            <span class="person-stat-val-bold">${formatNumber(person.distance, 0)} km</span>
          </div>
          <div class="person-stat-cost-col">
            <span class="person-stat-label-xs">Celkem</span>
            <span class="person-stat-val-bold">${formatMoney(person.totalAmount)} Kč</span>
          </div>
          <div>
            ${hasDebt ? `
              <span class="person-stat-status-badge has-debt" title="Zbývá uhradit ${formatMoney(person.unpaidAmount)} Kč">
                Dluh ${formatMoney(person.unpaidAmount)} Kč
              </span>
            ` : `
              <span class="person-stat-status-badge paid-ok">
                Vše zaplaceno ✓
              </span>
            `}
          </div>
        </div>
      `;

      el.peopleStatsContainer.appendChild(card);
    });
  }

  function renderLogbookTripsList(trips) {
    if (!el.logbookTripsContainer) return;
    el.logbookTripsContainer.innerHTML = '';

    if (trips.length === 0) {
      el.logbookTripsContainer.innerHTML = '<p class="empty-trips-msg">V tomto období nemáte zapsanou žádnou jízdu.</p>';
      return;
    }

    trips.forEach((trip) => {
      const card = document.createElement('div');
      card.className = 'logbook-trip-card';

      const dist = trip.effectiveDistance || trip.distance;
      const formattedDate = formatDateCs(trip.date);

      let passengersHtml = '';
      if (trip.passengers && trip.passengers.length > 0) {
        passengersHtml = trip.passengers.map((p, pIdx) => {
          const isPaid = !!p.isPaid;
          return `
            <div class="trip-person-row">
              <span class="trip-person-name">
                ${escapeHtml(p.name)} (${p.distance} km)
              </span>
              <div class="trip-person-right">
                <span class="trip-person-amount">${formatMoney(p.amount)} Kč</span>
                <button type="button" class="paid-toggle-btn ${isPaid ? 'is-paid' : 'is-unpaid'}" data-trip-id="${trip.id}" data-p-idx="${pIdx}" title="Kliknutím přepnete stav platby">
                  ${isPaid ? 'Zaplaceno ✓' : 'K platbě ⏳'}
                </button>
              </div>
            </div>
          `;
        }).join('');
      }

      let driverHtml = '';
      if (trip.driver && trip.driver.amount > 0) {
        driverHtml = `
          <div class="trip-person-row" style="opacity: 0.85;">
            <span class="trip-person-name">
              ${escapeHtml(trip.driver.name)} (řidič)
            </span>
            <div class="trip-person-right">
              <span class="trip-person-amount">${formatMoney(trip.driver.amount)} Kč</span>
              <span class="paid-toggle-btn is-paid">Uhrazeno</span>
            </div>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="trip-card-header">
          <div class="trip-card-title-group">
            <div class="trip-card-title">${escapeHtml(trip.title || `Jízda ${dist} km`)}</div>
            <div class="trip-card-meta">
              📅 ${formattedDate} • 🛣️ ${dist} km ${trip.isRoundTrip ? '(tam a zpět)' : ''} • ⛽ ${formatNumber(trip.consumption, 1)} l/100km
            </div>
            ${trip.note ? `<div class="trip-card-meta" style="color:var(--text-dim);">📝 ${escapeHtml(trip.note)}</div>` : ''}
          </div>
          <div class="trip-card-cost-total">${formatMoney(trip.totalCost)} Kč</div>
        </div>

        <div class="trip-people-list">
          ${passengersHtml}
          ${driverHtml}
        </div>

        <div class="trip-card-footer-actions">
          <button type="button" class="btn-text-action load-trip-btn" data-trip-id="${trip.id}">
            Načíst do kalkulačky
          </button>
          <button type="button" class="btn-text-action qr-trip-btn" data-trip-id="${trip.id}">
            QR Platba
          </button>
          <button type="button" class="trip-delete-btn del-logbook-trip-btn" data-trip-id="${trip.id}" title="Smazat ze záznamů">
            &times;
          </button>
        </div>
      `;

      // Event: Přepnutí stavu zaplaceno
      card.querySelectorAll('.paid-toggle-btn[data-trip-id]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const tripId = btn.dataset.tripId;
          const pIdx = parseInt(btn.dataset.pIdx, 10);
          const t = state.logbook.find((item) => String(item.id) === String(tripId));
          if (t && t.passengers && t.passengers[pIdx]) {
            t.passengers[pIdx].isPaid = !t.passengers[pIdx].isPaid;
            triggerHaptic();
            saveState();
            renderLogbook();
            showToast(`${t.passengers[pIdx].name}: ${t.passengers[pIdx].isPaid ? 'Označeno jako Zaplaceno' : 'Označeno jako Nezaplaceno'}`);
          }
        });
      });

      // Event: Načíst trasu do kalkulačky
      const loadBtn = card.querySelector('.load-trip-btn');
      loadBtn.addEventListener('click', () => {
        state.distance = trip.distance;
        state.isRoundTrip = !!trip.isRoundTrip;
        state.consumption = trip.consumption;
        state.fuelPrice = trip.fuelPrice || state.fuelPrice;
        if (trip.driver) {
          state.driverName = trip.driver.name;
          state.driverIncludesCost = trip.driver.includesCost;
        }
        if (trip.passengers && Array.isArray(trip.passengers)) {
          state.passengers = trip.passengers.map((p) => ({
            id: p.id || 'p_' + Date.now(),
            name: p.name,
            distance: p.distance,
            customAmount: null
          }));
        }
        triggerHaptic();
        switchTab('calc');
        renderAll(true);
        showToast(`Trasa "${trip.title}" byla načtena do kalkulačky.`);
      });

      // Event: QR Platba ze záznamu
      const qrTripBtn = card.querySelector('.qr-trip-btn');
      qrTripBtn.addEventListener('click', () => {
        qrSelectedTarget = 'all';
        triggerHaptic();
        updateAndShowQrModal();
      });

      // Event: Smazat záznam
      const delBtn = card.querySelector('.del-logbook-trip-btn');
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Opravdu chcete smazat jízdu "${trip.title}" z knihy jízd?`)) {
          state.logbook = state.logbook.filter((item) => String(item.id) !== String(trip.id));
          triggerHaptic();
          saveState();
          renderLogbook();
          showToast('Záznam byl smazán.');
        }
      });

      el.logbookTripsContainer.appendChild(card);
    });
  }

  // --- Zápis aktuální jízdy do Knihy jízd ---
  function openSaveToLogbookModal() {
    const res = calculate();
    const today = new Date().toISOString().slice(0, 10);
    const defaultTitle = `Cesta ${res.effectiveDistance} km`;

    if (el.logTripTitleInput) el.logTripTitleInput.value = defaultTitle;
    if (el.logTripDateInput) el.logTripDateInput.value = today;
    if (el.logTripNoteInput) el.logTripNoteInput.value = '';

    if (el.logPreviewDistance) el.logPreviewDistance.textContent = `${res.effectiveDistance} km`;
    if (el.logPreviewCost) el.logPreviewCost.textContent = `${formatMoney(res.totalCost)} Kč`;

    if (el.logPreviewPeopleList) {
      el.logPreviewPeopleList.innerHTML = '';
      if (res.split.driver.includesCost && res.split.driver.amount > 0) {
        const row = document.createElement('div');
        row.className = 'log-preview-person-row';
        row.innerHTML = `<span>${escapeHtml(res.split.driver.name)} (řidič)</span><strong>${formatMoney(res.split.driver.amount)} Kč</strong>`;
        el.logPreviewPeopleList.appendChild(row);
      }
      res.split.passengers.forEach((p) => {
        const row = document.createElement('div');
        row.className = 'log-preview-person-row';
        row.innerHTML = `<span>${escapeHtml(p.name)} (${p.distance} km)</span><strong>${formatMoney(p.amount)} Kč</strong>`;
        el.logPreviewPeopleList.appendChild(row);
      });
    }

    if (el.logTripModal) {
      el.logTripModal.classList.remove('hidden');
    }
  }

  function closeLogTripModal() {
    if (el.logTripModal) {
      el.logTripModal.classList.add('hidden');
    }
  }

  function confirmSaveToLogbook() {
    const res = calculate();
    const title = el.logTripTitleInput ? (el.logTripTitleInput.value.trim() || `Cesta ${res.effectiveDistance} km`) : `Cesta ${res.effectiveDistance} km`;
    const date = el.logTripDateInput ? (el.logTripDateInput.value || new Date().toISOString().slice(0, 10)) : new Date().toISOString().slice(0, 10);
    const note = el.logTripNoteInput ? el.logTripNoteInput.value.trim() : '';

    const newEntry = {
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      date,
      title,
      note,
      distance: state.distance,
      isRoundTrip: !!state.isRoundTrip,
      effectiveDistance: res.effectiveDistance,
      consumption: state.consumption,
      fuelPrice: state.fuelPrice,
      fuelLiters: res.fuelLiters,
      totalCost: res.totalCost,
      driver: {
        name: res.split.driver.name,
        includesCost: res.split.driver.includesCost,
        distance: res.split.driver.distance,
        amount: res.split.driver.amount
      },
      passengers: res.split.passengers.map((p) => ({
        id: p.id,
        name: p.name,
        distance: p.distance,
        amount: p.amount,
        isPaid: false
      }))
    };

    if (!Array.isArray(state.logbook)) {
      state.logbook = [];
    }
    state.logbook.unshift(newEntry);
    saveState();
    closeLogTripModal();
    triggerHaptic();
    renderAll(false);
    showToast(`Jízda "${title}" byla zapsána do Knihy jízd!`);
  }

  // --- Export a Import Knihy jízd ---
  function exportLogbookJson() {
    triggerHaptic();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state.logbook || [], null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `kniha-jizd-zaloha-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Záloha byla stažena jako JSON.');
  }

  function exportLogbookCsv() {
    triggerHaptic();
    const logbook = state.logbook || [];
    if (logbook.length === 0) {
      showToast('Kniha jízd je prázdná, není co exportovat.');
      return;
    }

    const headers = ['Datum', 'Trasa', 'Vzdálenost (km)', 'Spotřeba (l/100km)', 'Cena paliva (Kč/l)', 'Celková cena (Kč)', 'Řidič', 'Cestující a částky', 'Stav plateb', 'Poznámka'];
    const rows = logbook.map((trip) => {
      const passInfo = (trip.passengers || []).map((p) => `${p.name}: ${p.amount} Kč (${p.distance} km)`).join(' | ');
      const passPaid = (trip.passengers || []).map((p) => `${p.name}: ${p.isPaid ? 'Zaplaceno' : 'Nezaplaceno'}`).join(' | ');
      const driverInfo = trip.driver ? `${trip.driver.name} (${trip.driver.amount} Kč)` : '';

      return [
        `"${trip.date}"`,
        `"${(trip.title || '').replace(/"/g, '""')}"`,
        trip.effectiveDistance || trip.distance,
        trip.consumption,
        trip.fuelPrice,
        trip.totalCost,
        `"${driverInfo.replace(/"/g, '""')}"`,
        `"${passInfo.replace(/"/g, '""')}"`,
        `"${passPaid.replace(/"/g, '""')}"`,
        `"${(trip.note || '').replace(/"/g, '""')}"`
      ].join(';');
    });

    const csvContent = '\uFEFF' + headers.join(';') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', url);
    downloadAnchor.setAttribute('download', `kniha-jizd-excel-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
    showToast('Export do Excelu (CSV) dokončen.');
  }

  function importLogbookJson(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (Array.isArray(imported)) {
          if (confirm(`Nalezeno ${imported.length} záznamů jízd. Chcete je připojit ke stávající knize jízd?`)) {
            state.logbook = [...imported, ...(state.logbook || [])];
            saveState();
            renderLogbook();
            showToast(`Úspěšně importováno ${imported.length} jízd!`);
          }
        } else {
          showToast('Soubor nemá platný formát JSON knihy jízd.');
        }
      } catch (err) {
        showToast('Chyba při čtení souboru: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // --- Šablony tras (původní savedTrips) ---
  function renderSavedTrips() {
    if (!el.savedTripsList) return;
    el.savedTripsList.innerHTML = '';

    if (!state.savedTrips || state.savedTrips.length === 0) {
      el.savedTripsList.innerHTML = '<p class="empty-trips-msg">Zatím nemáte uloženou žádnou šablonu trasy.</p>';
      return;
    }

    state.savedTrips.forEach((trip, idx) => {
      const item = document.createElement('div');
      item.className = 'trip-item';
      item.innerHTML = `
        <div style="flex:1;">
          <div class="trip-info-title">${escapeHtml(trip.name)}</div>
          <div class="trip-info-meta">
            ${trip.distance} km ${trip.isRoundTrip ? '(tam a zpět)' : ''} • ${formatInputVal(trip.consumption)} l/100km
          </div>
        </div>
        <div class="trip-price-tag">
          ${formatMoney(trip.totalCost || trip.perPerson)} Kč
        </div>
        <button type="button" class="trip-delete-btn" title="Smazat šablonu" aria-label="Smazat">&times;</button>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('trip-delete-btn')) return;
        state.distance = trip.distance;
        state.isRoundTrip = trip.isRoundTrip || false;
        state.consumption = trip.consumption;
        if (trip.fuelPrice) state.fuelPrice = trip.fuelPrice;
        triggerHaptic();
        renderAll(true);
        showToast(`Šablona "${trip.name}" načtena.`);
      });

      const delBtn = item.querySelector('.trip-delete-btn');
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.savedTrips.splice(idx, 1);
        renderSavedTrips();
        saveState();
        showToast('Šablona byla smazána.');
      });

      el.savedTripsList.appendChild(item);
    });
  }

  // --- Tab Přepínač ---
  function switchTab(tabName) {
    activeTab = tabName;
    if (tabName === 'calc') {
      if (el.tabBtnCalc) el.tabBtnCalc.classList.add('active');
      if (el.tabBtnLogbook) el.tabBtnLogbook.classList.remove('active');
      if (el.viewCalculator) el.viewCalculator.classList.remove('hidden');
      if (el.viewLogbook) el.viewLogbook.classList.add('hidden');
    } else {
      if (el.tabBtnCalc) el.tabBtnCalc.classList.remove('active');
      if (el.tabBtnLogbook) el.tabBtnLogbook.classList.add('active');
      if (el.viewCalculator) el.viewCalculator.classList.add('hidden');
      if (el.viewLogbook) el.viewLogbook.classList.remove('hidden');
      renderLogbook();
    }
  }

  // --- QR Platba a SPAYD ---
  function normalizeToIban(accountStr) {
    const raw = (accountStr || '').trim().replace(/\s+/g, '');
    if (!raw) return '';

    if (/^[A-Z]{2}[0-9]{2}[A-Z0-9]{12,30}$/i.test(raw)) {
      return raw.toUpperCase();
    }

    const match = raw.match(/^(?:(\d{1,6})-)?(\d{1,10})\/(\d{4})$/);
    if (match) {
      const prefix = (match[1] || '').padStart(6, '0');
      const number = match[2].padStart(10, '0');
      const bankCode = match[3];
      const bban = bankCode + prefix + number;
      const numStr = bban + '123500';

      let remainder = 0;
      for (let i = 0; i < numStr.length; i++) {
        remainder = (remainder * 10 + parseInt(numStr[i], 10)) % 97;
      }
      const checkDigits = String(98 - remainder).padStart(2, '0');
      return `CZ${checkDigits}${bban}`;
    }

    return raw;
  }

  function generateSpaydString(iban, amount, msg) {
    const cleanAmount = Math.round(amount * 100) / 100;
    const sanitizedMsg = (msg || 'Cesta autem').replace(/[\*\r\n]/g, ' ').substring(0, 60);
    let str = `SPD*1.0*ACC:${iban}*AM:${cleanAmount.toFixed(2)}*CC:CZK*`;
    if (sanitizedMsg) {
      str += `MSG:${sanitizedMsg}*`;
    }
    return str;
  }

  function updateAndShowQrModal() {
    if (!el.qrModal) return;
    el.qrModal.classList.remove('hidden');
    renderQrModalContent();
  }

  function closeQrModal() {
    if (el.qrModal) el.qrModal.classList.add('hidden');
  }

  function renderQrModalContent() {
    const res = calculate();
    const split = res.split;

    // Render chips pro volbu osoby
    if (el.qrPersonChips) {
      el.qrPersonChips.innerHTML = '';

      const allBtn = document.createElement('button');
      allBtn.type = 'button';
      allBtn.className = `qr-person-chip ${qrSelectedTarget === 'all' ? 'active' : ''}`;
      allBtn.textContent = `Celá jízda (${formatMoney(res.totalCost)} Kč)`;
      allBtn.addEventListener('click', () => {
        qrSelectedTarget = 'all';
        triggerHaptic();
        renderQrModalContent();
      });
      el.qrPersonChips.appendChild(allBtn);

      if (split.driver.includesCost && split.driver.amount > 0) {
        const driverBtn = document.createElement('button');
        driverBtn.type = 'button';
        driverBtn.className = `qr-person-chip ${qrSelectedTarget === 'driver' ? 'active' : ''}`;
        driverBtn.textContent = `${split.driver.name} (${formatMoney(split.driver.amount)} Kč)`;
        driverBtn.addEventListener('click', () => {
          qrSelectedTarget = 'driver';
          triggerHaptic();
          renderQrModalContent();
        });
        el.qrPersonChips.appendChild(driverBtn);
      }

      split.passengers.forEach((p) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `qr-person-chip ${qrSelectedTarget === p.id ? 'active' : ''}`;
        chip.textContent = `${p.name} (${formatMoney(p.amount)} Kč)`;
        chip.addEventListener('click', () => {
          qrSelectedTarget = p.id;
          triggerHaptic();
          renderQrModalContent();
        });
        el.qrPersonChips.appendChild(chip);
      });
    }

    // Určení částky a jména
    let targetAmount = res.totalCost;
    let targetLabel = 'celou jízdu';
    let targetNote = state.qrNote || 'Cesta autem';

    if (qrSelectedTarget === 'driver') {
      targetAmount = split.driver.amount;
      targetLabel = `pro: ${split.driver.name}`;
      targetNote = `Cesta autem - ${split.driver.name}`;
    } else if (qrSelectedTarget !== 'all') {
      const p = split.passengers.find((item) => item.id === qrSelectedTarget);
      if (p) {
        targetAmount = p.amount;
        targetLabel = `pro: ${p.name}`;
        targetNote = `Cesta autem - ${p.name}`;
      }
    }

    if (el.qrAmountDisplay) el.qrAmountDisplay.textContent = formatMoney(targetAmount);
    if (el.qrForPersonLabel) el.qrForPersonLabel.textContent = targetLabel;
    if (el.qrNoteInput && document.activeElement !== el.qrNoteInput) {
      el.qrNoteInput.value = targetNote;
    }

    // Canvas render
    renderQrCode(targetAmount, targetNote);
  }

  function renderQrCode(amount, note) {
    const iban = normalizeToIban(state.bankIban);
    if (!el.qrCanvas) return;

    if (!iban) {
      const ctx = el.qrCanvas.getContext('2d');
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, el.qrCanvas.width, el.qrCanvas.height);
      ctx.fillStyle = '#64748b';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Zadejte číslo účtu', el.qrCanvas.width / 2, el.qrCanvas.height / 2 - 10);
      ctx.fillText('pro vygenerování QR platby', el.qrCanvas.width / 2, el.qrCanvas.height / 2 + 15);
      return;
    }

    const spaydString = generateSpaydString(iban, amount, note);
    if (window.renderQRCodeToCanvas) {
      window.renderQRCodeToCanvas(el.qrCanvas, spaydString);
    }
  }

  // --- Toast ---
  let toastTimer = null;
  function showToast(message) {
    if (!el.toast) return;
    el.toast.textContent = message;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.classList.remove('show');
    }, 2800);
  }

  // --- Pomocník pro desetinná čísla ---
  function handleDecimalInput(inputElement, stateKey, onBlurDecimals = null) {
    if (!inputElement) return;

    // Kliknutí na okolní wrapper zaměří přímo input
    const wrapper = inputElement.closest('.input-wrapper');
    if (wrapper) {
      wrapper.addEventListener('click', (e) => {
        if (e.target !== inputElement) {
          inputElement.focus();
        }
      });
    }

    // Automatický výběr celého čísla při zaměření (focus)
    // Zabraňuje nutnosti mazat stávající hodnotu a řeší iOS caret
    inputElement.addEventListener('focus', () => {
      setTimeout(() => {
        try {
          inputElement.select();
          inputElement.setSelectionRange(0, inputElement.value.length);
        } catch (e) {}
      }, 50);
    });

    inputElement.addEventListener('input', (e) => {
      let raw = e.target.value;
      let sanitized = raw.replace(/[^0-9.,]/g, '');

      const parts = sanitized.split(/[,.]/);
      if (parts.length > 2) {
        const sep = sanitized.indexOf(',') !== -1 && sanitized.indexOf(',') < sanitized.indexOf('.') ? ',' : (sanitized.indexOf(',') !== -1 ? ',' : '.');
        sanitized = parts[0] + sep + parts.slice(1).join('');
      }

      if (raw !== sanitized) {
        e.target.value = sanitized;
      }

      state[stateKey] = parseLocaleFloat(sanitized);
      renderAll(false);
    });

    inputElement.addEventListener('blur', (e) => {
      const val = parseLocaleFloat(e.target.value);
      if (val > 0) {
        e.target.value = formatInputVal(val, onBlurDecimals);
      } else {
        e.target.value = '0';
      }
      state[stateKey] = val;
      renderAll(false);
    });
  }

  // --- Event Bindings ---
  function bindEvents() {
    // 1. Navigační taby
    el.tabBtnCalc?.addEventListener('click', () => {
      triggerHaptic();
      switchTab('calc');
    });
    el.tabBtnLogbook?.addEventListener('click', () => {
      triggerHaptic();
      switchTab('logbook');
    });

    // 2. Vzdálenost
    handleDecimalInput(el.distanceInput, 'distance', null);

    el.roundTripBtn?.addEventListener('click', () => {
      state.isRoundTrip = !state.isRoundTrip;
      triggerHaptic();
      renderAll(false);
    });

    document.querySelectorAll('[data-quick-distance]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const add = parseInt(btn.dataset.quickDistance, 10);
        state.distance = Math.max(1, parseLocaleFloat(state.distance) + add);
        if (el.distanceInput) el.distanceInput.value = formatInputVal(state.distance);
        triggerHaptic();
        renderAll(false);
      });
    });

    // 3. Spotřeba
    handleDecimalInput(el.consumptionInput, 'consumption', 1);

    el.consumptionRange?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) || 0;
      state.consumption = val;
      if (el.consumptionInput) el.consumptionInput.value = formatInputVal(val, 1);
      renderAll(false);
    });

    document.querySelectorAll('[data-set-consumption]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = parseFloat(btn.dataset.setConsumption);
        state.consumption = val;
        if (el.consumptionInput) el.consumptionInput.value = formatInputVal(val, 1);
        if (el.consumptionRange) el.consumptionRange.value = val;
        triggerHaptic();
        renderAll(false);
      });
    });

    // 4. Cena paliva
    handleDecimalInput(el.fuelPriceInput, 'fuelPrice', 2);

    document.querySelectorAll('.fuel-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const price = parseFloat(btn.dataset.price);
        state.fuelPrice = price;
        if (el.fuelPriceInput) el.fuelPriceInput.value = formatInputVal(price, 2);
        triggerHaptic();
        renderAll(false);
      });
    });

    // 5. Řidič
    el.driverNameInput?.addEventListener('input', (e) => {
      state.driverName = e.target.value;
      saveState();
    });

    el.driverIncludesCostToggle?.addEventListener('change', (e) => {
      state.driverIncludesCost = e.target.checked;
      triggerHaptic();
      renderAll(false);
    });

    // 6. Režimy rozpočítání (Pills)
    document.querySelectorAll('.split-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.splitMode = btn.dataset.splitMode;
        triggerHaptic();
        renderAll(false);
      });
    });

    // 7. Cestující - Stepper rychlé změny počtu
    el.passengerMinus?.addEventListener('click', () => {
      if (state.passengers && state.passengers.length > 0) {
        state.passengers.pop();
        triggerHaptic();
        renderAll(false);
      }
    });

    el.passengerPlus?.addEventListener('click', () => {
      addPassenger();
      triggerHaptic();
      renderAll(false);
    });

    el.addPassengerBtn?.addEventListener('click', () => {
      addPassenger();
      triggerHaptic();
      renderAll(false);
      showToast('Cestující byl přidán.');
    });

    // 8. Doplňkové poplatky
    handleDecimalInput(el.extraVignette, 'extraVignette', null);
    handleDecimalInput(el.extraParking, 'extraParking', null);
    handleDecimalInput(el.extraWear, 'extraWear', null);

    // 9. Reset button
    el.resetBtn?.addEventListener('click', () => {
      if (confirm('Chcete obnovit výchozí hodnoty kalkulačky? (Kniha jízd a uložené trasy zůstanou zachovány)')) {
        const logbookBackup = state.logbook;
        const savedTripsBackup = state.savedTrips;
        const savedIban = state.bankIban;
        state = {
          ...DEFAULT_STATE,
          logbook: logbookBackup,
          savedTrips: savedTripsBackup,
          bankIban: savedIban
        };
        triggerHaptic();
        renderAll(true);
        showToast('Výchozí hodnoty byly obnoveny.');
      }
    });

    // 10. Uložit šablonu trasy
    el.saveTripBtn?.addEventListener('click', () => {
      const results = calculate();
      const defaultName = `Cesta ${results.effectiveDistance} km`;
      const name = prompt('Zadejte název šablony (např. Cesta do Brna, Hory, Práce):', defaultName);
      if (name && name.trim()) {
        if (!state.savedTrips) state.savedTrips = [];
        state.savedTrips.unshift({
          id: Date.now(),
          name: name.trim(),
          distance: state.distance,
          isRoundTrip: state.isRoundTrip,
          consumption: state.consumption,
          fuelPrice: state.fuelPrice,
          totalCost: results.totalCost
        });
        saveState();
        renderSavedTrips();
        triggerHaptic();
        showToast(`Šablona "${name.trim()}" uložena!`);
      }
    });

    // 11. Sdílet celkový rozpis
    el.shareBtn?.addEventListener('click', async () => {
      triggerHaptic();
      const res = calculate();
      const split = res.split;
      const textLines = [
        '🚗 Rozpis nákladů na cestu (MoneyCount)',
        `🛣️ Vzdálenost: ${res.effectiveDistance} km ${state.isRoundTrip ? '(tam a zpět)' : ''}`,
        `⛽ Spotřeba: ${formatNumber(res.consumption, 1)} l/100km (${formatNumber(res.fuelLiters, 1)} l paliva)`,
        `💰 Celková cena cesty: ${formatMoney(res.totalCost)} Kč`,
        ''
      ];

      if (split.driver.includesCost && split.driver.amount > 0) {
        textLines.push(`👉 ${split.driver.name} (řidič): ${formatMoney(split.driver.amount)} Kč`);
      }

      split.passengers.forEach((p) => {
        textLines.push(`👉 ${p.name} (${p.distance} km): ${formatMoney(p.amount)} Kč`);
      });

      if (state.bankIban) {
        textLines.push(`\n🏦 Účet pro platbu: ${state.bankIban}`);
      }

      const shareText = textLines.join('\n');

      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Rozpis nákladů na cestu',
            text: shareText
          });
          return;
        } catch (err) {
          if (err.name === 'AbortError') return;
        }
      }

      try {
        await navigator.clipboard.writeText(shareText);
        showToast('📋 Rozpis byl zkopírován do schránky!');
      } catch (err) {
        showToast('Nelze zkopírovat rozpis.');
      }
    });

    // 12. Modál Knihy jízd
    el.openLogTripModalBtn?.addEventListener('click', () => {
      triggerHaptic();
      openSaveToLogbookModal();
    });

    el.newTripFromLogbookBtn?.addEventListener('click', () => {
      triggerHaptic();
      openSaveToLogbookModal();
    });

    el.closeLogTripModal?.addEventListener('click', closeLogTripModal);
    el.dismissLogTripBtn?.addEventListener('click', closeLogTripModal);
    el.confirmSaveLogTripBtn?.addEventListener('click', confirmSaveToLogbook);
    el.logTripModal?.addEventListener('click', (e) => {
      if (e.target === el.logTripModal) closeLogTripModal();
    });

    // 13. Modál QR Platby
    el.openQrBtn?.addEventListener('click', () => {
      qrSelectedTarget = 'all';
      triggerHaptic();
      updateAndShowQrModal();
    });

    el.closeQrModal?.addEventListener('click', closeQrModal);
    el.dismissQrModalBtn?.addEventListener('click', closeQrModal);
    el.qrModal?.addEventListener('click', (e) => {
      if (e.target === el.qrModal) closeQrModal();
    });

    el.bankIbanInput?.addEventListener('input', (e) => {
      state.bankIban = e.target.value;
      saveState();
      renderQrModalContent();
    });

    el.qrNoteInput?.addEventListener('input', (e) => {
      state.qrNote = e.target.value;
      saveState();
      renderQrModalContent();
    });

    el.copySpaydStringBtn?.addEventListener('click', async () => {
      const res = calculate();
      let targetAmount = res.totalCost;
      let targetNote = state.qrNote || 'Cesta autem';

      if (qrSelectedTarget === 'driver') {
        targetAmount = res.split.driver.amount;
        targetNote = `Cesta autem - ${res.split.driver.name}`;
      } else if (qrSelectedTarget !== 'all') {
        const p = res.split.passengers.find((item) => item.id === qrSelectedTarget);
        if (p) {
          targetAmount = p.amount;
          targetNote = `Cesta autem - ${p.name}`;
        }
      }

      const iban = normalizeToIban(state.bankIban);
      const text = `Platba za cestu: ${formatMoney(targetAmount)} Kč\nÚčet: ${state.bankIban || iban}\nZpráva: ${targetNote}`;
      try {
        await navigator.clipboard.writeText(text);
        showToast('Platební údaje zkopírovány do schránky!');
      } catch (e) {
        showToast('Kopírování selhalo.');
      }
    });

    // 14. Export & Import & Mazání
    el.exportJsonBtn?.addEventListener('click', exportLogbookJson);
    el.exportCsvBtn?.addEventListener('click', exportLogbookCsv);
    el.importJsonBtn?.addEventListener('click', () => {
      if (el.importFileInput) el.importFileInput.click();
    });
    el.importFileInput?.addEventListener('change', importLogbookJson);

    el.clearLogbookBtn?.addEventListener('click', () => {
      if (confirm('POZOR: Opravdu chcete smazat VŠECHNY záznamy v knize jízd? Tuto akci nelze vrátit zpět.')) {
        state.logbook = [];
        triggerHaptic();
        saveState();
        renderLogbook();
        showToast('Kniha jízd byla vymazána.');
      }
    });

    // 15. Vynutit aktualizaci aplikace
    el.forceUpdateAppBtn?.addEventListener('click', async () => {
      triggerHaptic();
      showToast('Stahuji nejnovější verzi...');
      if ('caches' in window) {
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        } catch (e) {}
      }
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) await reg.update();
        } catch (e) {}
      }
      setTimeout(() => {
        window.location.reload();
      }, 400);
    });
  }

  function addPassenger() {
    if (!state.passengers) state.passengers = [];
    const nextIdx = state.passengers.length + 1;
    const effDist = state.isRoundTrip ? (state.distance * 2) : state.distance;
    state.passengers.push({
      id: 'p_' + Date.now() + '_' + nextIdx,
      name: `Cestující ${nextIdx}`,
      distance: effDist,
      customAmount: null
    });
  }

  // Spuštění po načtení DOMu
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
