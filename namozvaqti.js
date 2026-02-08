document.addEventListener('DOMContentLoaded', () => {

    const API_URL_BASE = 'https://api.aladhan.com/v1/';
    const locationSelector = document.getElementById('location-selector');

    // --- RAMAZON VAQTLARI ANIQ MA'LUMOTLARI (2026-yil) ---
    const RAMADAN_YEAR = 2026;
    
    // JS Date obyektida oylar 0 dan boshlanadi (1=Fevral, 2=Mart)
    const RAMADAN_START_MONTH_JS = 1; 
    const RAMADAN_START_DAY = 18;     // 18-Fevral
    
    const RAMADAN_END_MONTH_JS = 2;   
    const RAMADAN_END_DAY = 19;       // 19-Mart

    const RAMADAN_START_DATE = new Date(RAMADAN_YEAR, RAMADAN_START_MONTH_JS, RAMADAN_START_DAY); 
    const RAMADAN_END_DATE = new Date(RAMADAN_YEAR, RAMADAN_END_MONTH_JS, RAMADAN_END_DAY);   

    // --- VILOYATLAR RO'YXATI ---
    const UZBEK_CITIES = [
        { name: "Toshkent", value: "Tashkent" },
        { name: "Samarqand", value: "Samarkand" },
        { name: "Buxoro", value: "Bukhara" },
        { name: "Andijon", value: "Andijan" },
        { name: "Namangan", value: "Namangan" },
        { name: "Farg'ona", value: "Fergana" },
        { name: "Xiva", value: "Khiva" },
        { name: "Termiz", value: "Termez" },
        { name: "Qarshi", value: "Karshi" },
        { name: "Nukus", value: "Nukus" },
        { name: "Jizzax", value: "Jizzakh" },
        { name: "Urganch", value: "Urgench" }
    ];

    const STATIC_PRAYER_TIMES = {
        Fajr: "06:04", Sunrise: "07:27", Dhuhr: "12:12", Asr: "15:14",       
        Maghrib: "16:58", Isha: "18:19", Imsak: "05:45"      
    };

    let lastNotifiedPrayer = ''; 
    let notificationPermission = Notification.permission;
    const audioAlert = new Audio('https://www.soundjay.com/buttons/beep-01a.mp3'); 

    // --- DARHOL ISHGA TUSHIRISH ---
    // Majburiy obuna qismi olib tashlandi, asosiy kontent ko'rsatiladi
    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.classList.remove('hidden');
    
    initMainFunctions();
    requestNotificationPermission();

    // Xabarnoma so'rash funksiyasi
    function requestNotificationPermission() {
        if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                notificationPermission = permission;
            });
        }
    }

    // ASOSIY FUNKSIYALARNI ISHGA TUSHIRISH
    function initMainFunctions() {
        populateSelectors(); 
        setupEventListeners();
        
        const yearSelector = document.getElementById('year-selector');
        const initialYear = yearSelector ? (yearSelector.value || RAMADAN_YEAR) : RAMADAN_YEAR;
        
        generateRamadanCalendar(initialYear);
        fetchPrayerTimes(); 
        setInterval(updateCountdown, 1000); 
    }

    function populateSelectors() {
        if (locationSelector) {
            UZBEK_CITIES.forEach(city => {
                const option = document.createElement('option');
                option.value = city.value;
                option.textContent = city.name;
                if (city.value === 'Samarkand') { option.selected = true; }
                locationSelector.appendChild(option);
            });
        }

        const yearSelector = document.getElementById('year-selector');
        if (yearSelector) {
            for (let year = 2025; year <= 2050; year++) {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                if (year === RAMADAN_YEAR) { option.selected = true; }
                yearSelector.appendChild(option);
            }
        }
    }

    function setupEventListeners() {
        const yearSelector = document.getElementById('year-selector');
        if (yearSelector) {
            yearSelector.addEventListener('change', (e) => {
                generateRamadanCalendar(e.target.value);
            });
        }
        if (locationSelector) {
            locationSelector.addEventListener('change', () => {
                 fetchPrayerTimes(); 
                 const yearVal = document.getElementById('year-selector')?.value || RAMADAN_YEAR;
                 generateRamadanCalendar(yearVal);
            });
        }
    }

    async function generateRamadanCalendar(year) {
        const calendarBody = document.querySelector('#ramadan-calendar tbody');
        if (!calendarBody) return;
        
        calendarBody.innerHTML = '';
        
        if (parseInt(year) !== RAMADAN_YEAR) {
            calendarBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">${year}-yil Ramazon taqvimi hali e'lon qilinmagan.</td></tr>`;
            if(document.getElementById('start-date')) document.getElementById('start-date').textContent = '---';
            if(document.getElementById('end-date')) document.getElementById('end-date').textContent = '---';
            if(document.getElementById('fast-days')) document.getElementById('fast-days').textContent = '---';
            return;
        }
        
        const locationValue = locationSelector.value;
        const startDay = new Date(RAMADAN_START_DATE);
        const endDay = new Date(RAMADAN_END_DATE);
        const daysInRamadan = Math.round((endDay - startDay) / (1000 * 60 * 60 * 24)) + 1;
        const options = { month: 'long', day: 'numeric' };
        
        if(document.getElementById('start-date')) document.getElementById('start-date').textContent = startDay.toLocaleDateString('uz-UZ', options);
        if(document.getElementById('end-date')) document.getElementById('end-date').textContent = endDay.toLocaleDateString('uz-UZ', options); 
        if(document.getElementById('fast-days')) document.getElementById('fast-days').textContent = daysInRamadan;

        for (let i = 0; i < daysInRamadan; i++) {
            const currentDate = new Date(startDay);
            currentDate.setDate(startDay.getDate() + i);

            const dateISO = currentDate.toLocaleDateString('en-CA');
            const dailyAPI = `${API_URL_BASE}timingsByCity/${dateISO}?city=${locationValue}&country=Uzbekistan&method=1`; 

            let iftorTime = STATIC_PRAYER_TIMES.Maghrib;
            let imsakTime = STATIC_PRAYER_TIMES.Imsak;
            
            try {
                const response = await fetch(dailyAPI);
                const data = await response.json();
                if (data.code === 200) {
                    const timings = data.data.timings;
                    iftorTime = timings.Maghrib ? timings.Maghrib.substring(0, 5) : STATIC_PRAYER_TIMES.Maghrib;
                    imsakTime = timings.Imsak ? timings.Imsak.substring(0, 5) : STATIC_PRAYER_TIMES.Imsak;
                }
            } catch (e) {
                console.warn("Statik vaqt ishlatilmoqda.");
            }

            let izoh = '';
            if (i + 1 === daysInRamadan) { izoh = '🌙 Ramazon Hayiti kuni'; }
            else if (i + 1 === 27) { izoh = '🌟 Qadr kechasi (Afzal)'; }
            else if (i + 1 >= daysInRamadan - 9 && (i + 1) % 2 !== 0) { izoh = 'Laylatul Qadr (Taxmin)'; }

            const formattedDate = currentDate.toLocaleDateString('uz-UZ', options); 
            const row = calendarBody.insertRow();
            row.innerHTML = `
                <td>${i + 1}-kun</td>
                <td>${formattedDate}</td>
                <td>${imsakTime}</td>
                <td>${iftorTime}</td>
                <td class="${izoh ? 'special-day' : ''}">${izoh}</td>
            `;
        }
    }

    async function fetchPrayerTimes() {
        if (!locationSelector) return;
        const locationName = locationSelector.options[locationSelector.selectedIndex].textContent;
        const locationValue = locationSelector.value;
        const cityDisplay = document.getElementById('current-city-name');
        if (cityDisplay) cityDisplay.textContent = `(${locationName})`;

        const date = new Date().toLocaleDateString('en-CA');
        const API_URL = `${API_URL_BASE}timingsByCity/${date}?city=${locationValue}&country=Uzbekistan&method=1`; 

        try {
            const response = await fetch(API_URL);
            const data = await response.json();
            if (data.code === 200) {
                const timings = data.data.timings;
                window.prayerTimings = {
                    Fajr: timings.Fajr.substring(0, 5),
                    Sunrise: timings.Sunrise.substring(0, 5),
                    Dhuhr: timings.Dhuhr.substring(0, 5),
                    Asr: timings.Asr.substring(0, 5),
                    Maghrib: timings.Maghrib.substring(0, 5),
                    Isha: timings.Isha.substring(0, 5),
                    Imsak: timings.Imsak.substring(0, 5)
                };
                updatePrayerTimesUI(window.prayerTimings);
            }
        } catch (e) {
            window.prayerTimings = STATIC_PRAYER_TIMES;
            updatePrayerTimesUI(STATIC_PRAYER_TIMES);
        }
    }

    function updatePrayerTimesUI(timings) {
        const updateText = (selector, val) => {
            const el = document.querySelector(selector);
            if (el) el.textContent = val;
        };
        updateText('[data-time="Imsak"]', timings.Imsak);
        updateText('[data-time="Fajr"]', timings.Fajr); 
        updateText('[data-time="Sunrise"]', timings.Sunrise); 
        updateText('[data-time="Dhuhr"]', timings.Dhuhr);
        updateText('[data-time="Asr"]', timings.Asr);
        updateText('[data-time="Maghrib"]', timings.Maghrib); 
        updateText('[data-time="Isha"]', timings.Isha);
    }

    function formatTime(diff) {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function updateCountdown() {
        if (!window.prayerTimings) return;

        const now = new Date();
        const times = window.prayerTimings;
        const IS_RAMADAN = now >= RAMADAN_START_DATE && now <= RAMADAN_END_DATE; 

        const iftarCard = document.getElementById('iftar-countdown-card');
        if (iftarCard) {
            IS_RAMADAN ? iftarCard.classList.remove('hidden-timer') : iftarCard.classList.add('hidden-timer');
        }

        const prayerKeys = ["Imsak", "Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
        const dailyPrayers = prayerKeys.map(key => {
            const [h, m] = times[key].split(':');
            return { name: key, time: new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(h), parseInt(m), 0) };
        });

        let nextPrayer = dailyPrayers.find(p => p.time.getTime() - now.getTime() > 0);
        
        if (!nextPrayer) {
            const tomorrowImsak = new Date(dailyPrayers[0].time);
            tomorrowImsak.setDate(tomorrowImsak.getDate() + 1);
            nextPrayer = { name: 'Imsak', time: tomorrowImsak };
        }
        
        const countdownEl = document.getElementById('next-prayer-countdown');
        if (countdownEl) countdownEl.textContent = formatTime(nextPrayer.time.getTime() - now.getTime());
        
        // Jadvallarni belgilash
        document.querySelectorAll('#prayer-times-body tr').forEach(row => row.classList.remove('current-prayer'));
        const nextRow = document.querySelector(`#prayer-times-body td[data-time="${nextPrayer.name}"]`)?.closest('tr');
        if (nextRow) nextRow.classList.add('current-prayer');

        if (IS_RAMADAN) {
            const [iftarH, iftarM] = times.Maghrib.split(':');
            let iftarTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(iftarH), parseInt(iftarM), 0);
            if (iftarTime.getTime() - now.getTime() < 0) iftarTime.setDate(iftarTime.getDate() + 1);
            
            const iftarCountdownEl = document.getElementById('iftar-countdown');
            if (iftarCountdownEl) iftarCountdownEl.textContent = formatTime(iftarTime.getTime() - now.getTime());
        }
    }
});
