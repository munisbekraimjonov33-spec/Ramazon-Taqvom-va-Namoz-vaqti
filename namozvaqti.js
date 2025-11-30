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

    // --- VILOYATLAR RO'YXATI (o'zgarishsiz) ---\
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

    // --- NAMOS VAQTLARI ANIQ MA'LUMOTLARI (Statik Baza - o'zgarishsiz) ---
    const STATIC_PRAYER_TIMES = {
        Fajr: "06:04", Sunrise: "07:27", Dhuhr: "12:12", Asr: "15:14",       
        Maghrib: "16:58", Isha: "18:19", Imsak: "05:45"      
    };

    // --- NAMOS ESLATMАSI UCHUN O'ZGURVCHILAR (o'zgarishsiz) ---
    let lastNotifiedPrayer = ''; 
    let notificationPermission = Notification.permission;
    const audioAlert = new Audio('https://www.soundjay.com/buttons/beep-01a.mp3'); 


    // --- MODALNI BOSHQARISH ---
    const modal = document.getElementById('subscription-modal');
    const mainContent = document.getElementById('main-content');
    const verifyButton = document.getElementById('verify-subscription');
    const telegramLink = document.querySelector('.btn-telegram');
    
    // Obunani tekshirish funksiyasi (24 soatlik tekshiruv)
    function checkSubscriptionStatus() {
        const lastVerifiedTime = localStorage.getItem('lastVerifiedTime');
        const now = new Date().getTime();
        // Obuna 24 soat (86400000 millisekund) davomida amal qiladi
        const VALID_DURATION = 86400000; 

        if (lastVerifiedTime && (now - lastVerifiedTime < VALID_DURATION)) {
            return true;
        }
        // Obuna muddati tugagan yoki hech qachon qilinmagan bo'lsa, o'chiramiz
        localStorage.removeItem('lastVerifiedTime');
        localStorage.removeItem('hasClickedTelegram');
        return false;
    }
    
    let hasClickedTelegram = localStorage.getItem('hasClickedTelegram') === 'true'; 
    let isSubscribed = checkSubscriptionStatus(); 

    // Saytga kirish/bloklash mantig'i 
    if (!isSubscribed) {
        modal.classList.remove('hidden');
        mainContent.classList.add('hidden');
        if (!hasClickedTelegram) {
            verifyButton.disabled = true;
            verifyButton.textContent = "2. Obuna bo'lish uchun Telegramga o'ting";
        }
    } else {
        modal.classList.add('hidden');
        mainContent.classList.remove('hidden');
        initMainFunctions();
    }

    // Telegram linkini bosish hodisasi 
    telegramLink.addEventListener('click', () => {
        if (!hasClickedTelegram) {
            localStorage.setItem('hasClickedTelegram', 'true');
            hasClickedTelegram = true;
            
            verifyButton.textContent = "2. Iltimos, 5 soniya kuting...";
            verifyButton.disabled = true;

            setTimeout(() => {
                verifyButton.disabled = false;
                verifyButton.textContent = "2. Obunani Tasdiqlash"; 
            }, 5000); 
        }
    });

    // Tekshirish tugmasini bosish hodisasi
    verifyButton.addEventListener('click', () => {
        if (verifyButton.disabled) {
            alert("Iltimos, avval '1. Telegramga O'tish' tugmasini bosing va 5 soniya kuting.");
            return;
        }

        if (hasClickedTelegram) {
            // Obunani tasdiqlash vaqti va holatini saqlash
            localStorage.setItem('lastVerifiedTime', new Date().getTime());
            
            modal.classList.add('hidden');
            mainContent.classList.remove('hidden');
            initMainFunctions();
            requestNotificationPermission(); 
            alert("Xush kelibsiz! Saytdan foydalanishingiz mumkin. (24 soat amal qiladi)");
        }
    });
    
    // Xabarnoma so'rash funksiyasi (o'zgarishsiz)
    function requestNotificationPermission() {
        if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                notificationPermission = permission;
                if (permission === 'granted') {
                    new Notification("Eslatma: Namoz vaqtlari eslatmasini yoqdingiz", {
                        body: "Namoz vaqti kelganda sizni ogohlantiramiz!"
                    });
                }
            });
        }
    }

    // ASOSIY FUNKSIYALARNI ISHGA TUSHIRISH (o'zgarishsiz)
    function initMainFunctions() {
        populateSelectors(); 
        setupEventListeners();
        
        const initialYear = document.getElementById('year-selector').value || RAMADAN_YEAR;
        generateRamadanCalendar(initialYear);
        fetchPrayerTimes(); 
        setInterval(updateCountdown, 1000); 
    }

    // SELECTORLARNI TO'LDIRISH (o'zgarishsiz)
    function populateSelectors() {
        UZBEK_CITIES.forEach(city => {
            const option = document.createElement('option');
            option.value = city.value;
            option.textContent = city.name;
            if (city.value === 'Samarkand') { option.selected = true; }
            locationSelector.appendChild(option);
        });

        const yearSelector = document.getElementById('year-selector');
        for (let year = 2025; year <= 2050; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === RAMADAN_YEAR) { option.selected = true; }
            yearSelector.appendChild(option);
        }
    }

    function setupEventListeners() {
        document.getElementById('year-selector').addEventListener('change', (e) => {
            generateRamadanCalendar(e.target.value);
        });
        locationSelector.addEventListener('change', () => {
             fetchPrayerTimes(); 
             generateRamadanCalendar(document.getElementById('year-selector').value);
        });
    }

    // --- RAMAZON TAQVIMINI GENERATSIYA QILISH ---
    async function generateRamadanCalendar(year) {
        const calendarBody = document.querySelector('#ramadan-calendar tbody');
        calendarBody.innerHTML = '';
        
        if (parseInt(year) !== RAMADAN_YEAR) {
            calendarBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">${year}-yil Ramazon taqvimi hali e'lon qilinmagan.</td></tr>`;
            document.getElementById('start-date').textContent = '---';
            document.getElementById('end-date').textContent = '---';
            document.getElementById('fast-days').textContent = '---';
            return;
        }
        
        const locationValue = locationSelector.value;
        
        const startDay = new Date(RAMADAN_START_DATE);
        const endDay = new Date(RAMADAN_END_DATE);
        
        const daysInRamadan = Math.round((endDay - startDay) / (1000 * 60 * 60 * 24)) + 1;

        // Boshlanish va tugash sanalarini Oy va Kun bilan formatlash
        const options = { month: 'long', day: 'numeric' };
        
        document.getElementById('start-date').textContent = startDay.toLocaleDateString('uz-UZ', options);
        document.getElementById('end-date').textContent = endDay.toLocaleDateString('uz-UZ', options); 
        document.getElementById('fast-days').textContent = daysInRamadan;


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
                console.warn(`Ramazon vaqti yuklanmadi (${dateISO}). Statik vaqtlar ishlatilmoqda.`);
            }

            let izoh = '';
            if (i + 1 === daysInRamadan) { izoh = '🌙 Ramazon Hayiti kuni'; }
            else if (i + 1 === 27) { izoh = '🌟 Qadr kechasi (Afzal)'; }
            else if (i + 1 >= daysInRamadan - 9 && (i + 1) % 2 !== 0) { izoh = 'Laylatul Qadr (Taxmin)'; }

            // Talab qilingan format: "Fevral 18" (Oy Kun) ko'rinishi
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
        window.currentHijriMonth = 9; 
    }

    // --- Qolgan funksiyalar (fetchPrayerTimes, updatePrayerTimesUI, updateCountdown) o'zgarishsiz qoladi ---
    async function fetchPrayerTimes() {
        const locationName = locationSelector.options[locationSelector.selectedIndex].textContent;
        const locationValue = locationSelector.value;
        document.getElementById('current-city-name').textContent = `(${locationName})`;

        const date = new Date().toLocaleDateString('en-CA');
        const API_URL = `${API_URL_BASE}timingsByCity/${date}?city=${locationValue}&country=Uzbekistan&method=1`; 

        try {
            const response = await fetch(API_URL);
            const data = await response.json();
            
            if (data.code === 200) {
                const timings = data.data.timings;
                const apiTimings = {
                    Fajr: timings.Fajr.substring(0, 5),
                    Sunrise: timings.Sunrise.substring(0, 5),
                    Dhuhr: timings.Dhuhr.substring(0, 5),
                    Asr: timings.Asr.substring(0, 5),
                    Maghrib: timings.Maghrib.substring(0, 5),
                    Isha: timings.Isha.substring(0, 5),
                    Imsak: timings.Imsak.substring(0, 5)
                };
                
                window.prayerTimings = apiTimings;
                updatePrayerTimesUI(apiTimings);
                window.currentHijriMonth = parseInt(data.data.date.hijri.month.number);
            } else {
                 throw new Error("API xatosi: Vaqtlar yuklanmadi.");
            }
        } catch (e) {
            console.error("API xato, statik vaqtlar ishlatilmoqda:", e);
            window.prayerTimings = STATIC_PRAYER_TIMES;
            updatePrayerTimesUI(STATIC_PRAYER_TIMES);
            window.currentHijriMonth = 0; 
        }
    }

    function updatePrayerTimesUI(timings) {
        document.querySelector('[data-time="Imsak"]').textContent = timings.Imsak;
        document.querySelector('[data-time="Fajr"]').textContent = timings.Fajr; 
        document.querySelector('[data-time="Sunrise"]').textContent = timings.Sunrise; 
        document.querySelector('[data-time="Dhuhr"]').textContent = timings.Dhuhr;
        document.querySelector('[data-time="Asr"]').textContent = timings.Asr;
        document.querySelector('[data-time="Maghrib"]').textContent = timings.Maghrib; 
        document.querySelector('[data-time="Isha"]').textContent = timings.Isha;
    }

    function formatTime(diff) {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function sendPrayerAlert(prayerName) {
        if (notificationPermission === 'granted') {
            const bodyText = `Ey birodar, namoz vaqti bo'ldi! ${prayerName} namozini o'qing.`;
            new Notification(`🕌 Namoz Vaqti Keldi!`, {
                body: bodyText,
                icon: 'https://img.icons8.com/color/48/mosque.png' 
            });
        }
        audioAlert.play();
    }


    function updateCountdown() {
        if (!window.prayerTimings) return;

        const now = new Date();
        const times = window.prayerTimings;
        
        const IS_RAMADAN = now >= RAMADAN_START_DATE && now <= RAMADAN_END_DATE; 

        const iftarCard = document.getElementById('iftar-countdown-card');
        if (IS_RAMADAN) {
            iftarCard.classList.remove('hidden-timer');
        } else {
            iftarCard.classList.add('hidden-timer');
        }

        const prayerKeys = ["Imsak", "Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
        
        const dailyPrayers = prayerKeys.map(key => {
            const timeStr = times[key];
            const [h, m] = timeStr.split(':');
            let dateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(h), parseInt(m), 0);
            return { name: key, time: dateObj };
        });

        let nextPrayerTime = null;
        let nextPrayerName = null;
        let foundNext = false;
        
        for (const prayer of dailyPrayers) {
            const diff = prayer.time.getTime() - now.getTime();
            
            if (diff >= -60000 && diff < 60000 && lastNotifiedPrayer !== prayer.name) { 
                sendPrayerAlert(
                    prayer.name === 'Imsak' ? 'Saharlik tugashi' : 
                    (prayer.name === 'Maghrib' ? 'Iftorlik/Shom' : prayer.name)
                );
                lastNotifiedPrayer = prayer.name;
            }

            if (diff > 1000 && !foundNext) { 
                nextPrayerTime = prayer.time;
                nextPrayerName = prayer.name;
                foundNext = true;
                if (lastNotifiedPrayer === prayer.name) {
                     lastNotifiedPrayer = ''; 
                }
            }
        }
        
        if (!nextPrayerTime) {
            const tomorrowImsak = new Date(dailyPrayers[0].time);
            tomorrowImsak.setDate(tomorrowImsak.getDate() + 1);
            nextPrayerTime = tomorrowImsak;
            nextPrayerName = 'Imsak';
        }
        
        const timeDifference = nextPrayerTime.getTime() - now.getTime();
        document.getElementById('next-prayer-countdown').textContent = formatTime(timeDifference);
        
        document.querySelectorAll('#prayer-times-body tr').forEach(row => row.classList.remove('current-prayer'));
        const nextRow = document.querySelector(`#prayer-times-body td[data-time="${nextPrayerName}"]`).closest('tr');
        if (nextRow) {
            nextRow.classList.add('current-prayer');
        }

        if (IS_RAMADAN) {
            const iftarTimeStr = times.Maghrib; 
            const [iftarH, iftarM] = iftarTimeStr.split(':');
            let iftarTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(iftarH), parseInt(iftarM), 0);
             
            if (iftarTime.getTime() - now.getTime() < 1000) {
                iftarTime.setDate(iftarTime.getDate() + 1);
            }
             
            const iftarDifference = iftarTime.getTime() - now.getTime();
            document.getElementById('iftar-countdown').textContent = formatTime(iftarDifference);
        }
    }
});
