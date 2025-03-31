 // Config
 const config = {
    apiKey: '3fede2422f27e35802be5a6b329d98e2',
    units: 'metric',
    lang: 'es',
    cacheDuration: 30 * 60 * 1000, // 30 minutes cache
    maxHistoryItems: 5
};

// State
let state = {
    currentCity: null,
    isCelsius: true,
    weatherCache: {},
    searchHistory: JSON.parse(localStorage.getItem('weatherSearchHistory')) || [],
    tempChart: null
};

// DOM Elements
const elements = {
    cityInput: document.getElementById('cityInput'),
    searchButton: document.getElementById('searchButton'),
    searchHistory: document.getElementById('searchHistory'),
    location: document.getElementById('location'),
    currentDate: document.getElementById('currentDate'),
    weatherIcon: document.getElementById('weatherIcon'),
    weatherDescription: document.getElementById('weatherDescription'),
    currentTemp: document.getElementById('currentTemp'),
    minTemp: document.getElementById('minTemp'),
    maxTemp: document.getElementById('maxTemp'),
    humidity: document.getElementById('humidity'),
    windSpeed: document.getElementById('windSpeed'),
    sunrise: document.getElementById('sunrise'),
    sunset: document.getElementById('sunset'),
    forecast: document.getElementById('forecast'),
    loading: document.getElementById('loading'),
    error: document.getElementById('error'),
    unitToggle: document.getElementById('unitToggle'),
    unitText: document.getElementById('unitText'),
    darkModeToggle: document.getElementById('darkModeToggle'),
    tempChart: document.getElementById('tempChart'),
    aqiValue: document.getElementById('aqiValue'),
    uvIndicator: document.getElementById('uvIndicator')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateSearchHistoryDisplay();
    setupEventListeners();
    checkDarkMode();
    getLocation();
});

// Setup Event Listeners
function setupEventListeners() {
    elements.cityInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            searchWeather();
        } else if (elements.cityInput.value.length > 0) {
            showSearchHistory();
        }
    });
    
    elements.cityInput.addEventListener('focus', () => {
        if (state.searchHistory.length > 0) {
            showSearchHistory();
        }
    });
    
    elements.cityInput.addEventListener('blur', () => {
        setTimeout(() => {
            elements.searchHistory.classList.remove('active');
        }, 200);
    });
    
    elements.searchButton.addEventListener('click', searchWeather);
    elements.unitToggle.addEventListener('click', toggleUnits);
    elements.darkModeToggle.addEventListener('click', toggleDarkMode);
}

// Show search history
function showSearchHistory() {
    if (state.searchHistory.length > 0) {
        elements.searchHistory.classList.add('active');
        updateSearchHistoryDisplay();
    }
}

// Update search history display
function updateSearchHistoryDisplay() {
    if (state.searchHistory.length === 0) return;
    
    elements.searchHistory.innerHTML = state.searchHistory.map(city => `
        <div class="search-history-item" onclick="selectHistoryItem('${city}')">
            <i class="fas fa-history"></i>
            <span>${city}</span>
        </div>
    `).join('');
}

// Select item from history
function selectHistoryItem(city) {
    elements.cityInput.value = city;
    searchWeather();
    elements.searchHistory.classList.remove('active');
}

// Dark Mode Check
function checkDarkMode() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark');
        elements.darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        document.body.classList.remove('dark');
        elements.darkModeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }
}

// Toggle Dark Mode
function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem('darkMode', isDark);
    
    elements.darkModeToggle.innerHTML = isDark ? 
        '<i class="fas fa-sun"></i>' : 
        '<i class="fas fa-moon"></i>';
    
    // Update chart if exists
    if (state.tempChart) {
        updateTempChart(state.weatherCache[state.currentCity].forecast);
    }
}

// Toggle Units
function toggleUnits() {
    state.isCelsius = !state.isCelsius;
    elements.unitText.textContent = state.isCelsius ? '°C' : '°F';
    
    if (state.currentCity) {
        displayWeatherData(state.weatherCache[state.currentCity]);
    }
}

// Convert temperature based on current unit
function convertTemp(temp) {
    return state.isCelsius ? temp : (temp * 9/5) + 32;
}

// Format temperature with unit
function formatTemp(temp) {
    return `${Math.round(convertTemp(temp))}${state.isCelsius ? '°C' : '°F'}`;
}

// Format time
function formatTime(date) {
    return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

// Get user location
function getLocation() {
    elements.loading.style.display = 'flex';
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                getWeatherByCoords(position.coords.latitude, position.coords.longitude);
            },
            error => {
                console.error("Error getting location:", error);
                getWeatherByCity('Mexico'); // Default city if location fails
            }
        );
    } else {
        getWeatherByCity('Mexico'); // Default city if geolocation not supported
    }
}

// Search weather by city
function searchWeather() {
    const city = elements.cityInput.value.trim();
    if (!city) return;
    
    getWeatherByCity(city);
}

// Get weather by city name
async function getWeatherByCity(city) {
    elements.loading.style.display = 'flex';
    elements.error.classList.add('hidden');
    
    // Check cache first
    if (state.weatherCache[city] && 
        Date.now() - state.weatherCache[city].timestamp < config.cacheDuration) {
        displayWeatherData(state.weatherCache[city]);
        addToSearchHistory(city);
        return;
    }
    
    try {
        // Current weather
        const currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${config.apiKey}&units=${config.units}&lang=${config.lang}`;
        const currentResponse = await fetch(currentUrl);
        const currentData = await currentResponse.json();
        
        if (currentData.cod !== 200) {
            throw new Error(currentData.message || 'Ciudad no encontrada');
        }
        
        // Forecast
        const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${config.apiKey}&units=${config.units}&lang=${config.lang}`;
        const forecastResponse = await fetch(forecastUrl);
        const forecastData = await forecastResponse.json();
        
        if (forecastData.cod !== '200') {
            throw new Error(forecastData.message || 'Error al obtener pronóstico');
        }
        
        // Process data
        const weatherData = {
            current: processCurrentWeather(currentData),
            forecast: processForecastData(forecastData),
            timestamp: Date.now()
        };
        
        // Update cache and state
        state.weatherCache[city] = weatherData;
        state.currentCity = city;
        
        // Display data
        displayWeatherData(weatherData);
        addToSearchHistory(city);
        
    } catch (error) {
        showError(error.message);
    }
}

// Get weather by coordinates
async function getWeatherByCoords(lat, lon) {
    elements.loading.style.display = 'flex';
    elements.error.classList.add('hidden');
    
    try {
        // Current weather
        const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${config.apiKey}&units=${config.units}&lang=${config.lang}`;
        const currentResponse = await fetch(currentUrl);
        const currentData = await currentResponse.json();
        
        // Air Quality (needs separate API call)
        const aqiUrl = `http://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${config.apiKey}`;
        const aqiResponse = await fetch(aqiUrl);
        const aqiData = await aqiResponse.json();
        
        // Forecast
        const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${config.apiKey}&units=${config.units}&lang=${config.lang}`;
        const forecastResponse = await fetch(forecastUrl);
        const forecastData = await forecastResponse.json();
        
        // Process data
        const weatherData = {
            current: processCurrentWeather(currentData),
            forecast: processForecastData(forecastData),
            airQuality: processAirQualityData(aqiData),
            timestamp: Date.now()
        };
        
        // Update cache and state
        const city = currentData.name;
        state.weatherCache[city] = weatherData;
        state.currentCity = city;
        
        // Display data
        displayWeatherData(weatherData);
        addToSearchHistory(city);
        
    } catch (error) {
        showError(error.message);
    }
}

// Process current weather data
function processCurrentWeather(data) {
    return {
        city: data.name,
        country: data.sys.country,
        temp: data.main.temp,
        feelsLike: data.main.feels_like,
        minTemp: data.main.temp_min,
        maxTemp: data.main.temp_max,
        humidity: data.main.humidity,
        windSpeed: data.wind.speed,
        description: data.weather[0].description,
        icon: data.weather[0].icon,
        date: new Date(data.dt * 1000),
        sunrise: new Date(data.sys.sunrise * 1000),
        sunset: new Date(data.sys.sunset * 1000),
        pressure: data.main.pressure,
        visibility: data.visibility / 1000, // Convert to km
        clouds: data.clouds.all
    };
}

// Process air quality data
function processAirQualityData(data) {
    const aqi = data.list[0].main.aqi;
    let aqiText = '';
    let aqiClass = '';
    
    switch(aqi) {
        case 1: aqiText = 'Buena'; aqiClass = 'aqi-good'; break;
        case 2: aqiText = 'Moderada'; aqiClass = 'aqi-moderate'; break;
        case 3: aqiText = 'Regular'; aqiClass = 'aqi-moderate'; break;
        case 4: aqiText = 'Pobre'; aqiClass = 'aqi-poor'; break;
        case 5: aqiText = 'Muy Pobre'; aqiClass = 'aqi-poor'; break;
        default: aqiText = 'Desconocida'; aqiClass = 'aqi-moderate';
    }
    
    return {
        aqi,
        text: aqiText,
        class: aqiClass,
        components: data.list[0].components
    };
}

// Process forecast data
function processForecastData(data) {
    // Group by day
    const dailyForecasts = {};
    data.list.forEach(item => {
        const date = new Date(item.dt * 1000);
        const dayKey = date.toLocaleDateString();
        
        if (!dailyForecasts[dayKey]) {
            dailyForecasts[dayKey] = {
                date: date,
                temps: [],
                icons: {},
                descriptions: []
            };
        }
        
        dailyForecasts[dayKey].temps.push(item.main.temp);
        dailyForecasts[dayKey].descriptions.push(item.weather[0].description);
        
        // Count icon occurrences to find most common
        const icon = item.weather[0].icon;
        dailyForecasts[dayKey].icons[icon] = (dailyForecasts[dayKey].icons[icon] || 0) + 1;
    });
    
    // Process each day
    return Object.values(dailyForecasts).map(day => {
        // Find most common icon
        let mostCommonIcon = '';
        let maxCount = 0;
        for (const [icon, count] of Object.entries(day.icons)) {
            if (count > maxCount) {
                mostCommonIcon = icon;
                maxCount = count;
            }
        }
        
        return {
            date: day.date,
            minTemp: Math.min(...day.temps),
            maxTemp: Math.max(...day.temps),
            icon: mostCommonIcon,
            description: day.descriptions[0] // Just use first description for simplicity
        };
    }).slice(1, 6); // Get next 5 days (skip today)
}

const weatherIconMap = {
    "01d": "wi-day-sunny",
    "01n": "wi-night-clear",
    "02d": "wi-day-cloudy",
    "02n": "wi-night-alt-cloudy",
    "03d": "wi-cloud",
    "03n": "wi-cloud",
    "04d": "wi-cloudy",
    "04n": "wi-cloudy",
    "09d": "wi-showers",
    "09n": "wi-showers",
    "10d": "wi-day-rain",
    "10n": "wi-night-alt-rain",
    "11d": "wi-thunderstorm",
    "11n": "wi-thunderstorm",
    "13d": "wi-snow",
    "13n": "wi-snow",
    "50d": "wi-fog",
    "50n": "wi-fog"
};

// Display weather data 
function displayWeatherData(data) {
    elements.loading.style.display = 'none';
    elements.error.classList.add('hidden');
    
    // Current weather
    const current = data.current;
    elements.location.textContent = `${current.city}, ${current.country}`;
    elements.currentDate.textContent = current.date.toLocaleDateString('es', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    }); 
    elements.currentTemp.textContent = Math.round(convertTemp(current.temp));
    elements.minTemp.textContent = formatTemp(current.minTemp);
    elements.maxTemp.textContent = formatTemp(current.maxTemp);
    elements.humidity.textContent = `${current.humidity}%`;
    elements.windSpeed.textContent = `${Math.round(current.windSpeed * 3.6)} km/h`;
    elements.sunrise.textContent = formatTime(current.sunrise);
    elements.sunset.textContent = formatTime(current.sunset);
    
    // Weather icon
    const iconClass = weatherIconMap[current.icon] || "wi-na"; // Default to "not available" icon
    elements.weatherIcon.innerHTML = `
        <i class="wi ${iconClass}" style="font-size: 4rem; color: var(--primary);"></i>
        <p style="margin-top: 0.5rem; font-size: 1rem; color: var(--dark);">
            ${current.description.charAt(0).toUpperCase() + current.description.slice(1)}
        </p>
    `;
    
    // Forecast
    elements.forecast.innerHTML = data.forecast.map(day => {
        const forecastIconClass = weatherIconMap[day.icon] || "wi-na";
        return `
            <div class="forecast-card fade-in">
                <div class="forecast-day">${day.date.toLocaleDateString('es', { weekday: 'short' })}</div>
                <div class="forecast-date">${day.date.toLocaleDateString('es', { day: 'numeric', month: 'short' })}</div>
                <div class="forecast-icon">
                    <i class="wi ${forecastIconClass}" style="font-size: 2rem; color: var(--primary);"></i>
                    <p style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--dark);">
                        ${day.description.charAt(0).toUpperCase() + day.description.slice(1)}
                    </p>
                </div>
                <div class="forecast-temps">
                    <span class="forecast-min">${formatTemp(day.minTemp)}</span>
                    <span>/</span>
                    <span class="forecast-max">${formatTemp(day.maxTemp)}</span>
                </div>
            </div>
        `;
    }).join('');
    
    // Update chart
    updateTempChart(data.forecast);
    
    // Update input field
    elements.cityInput.value = current.city;
}

// Update temperature chart
function updateTempChart(forecastData) {
    const ctx = elements.tempChart.getContext('2d');
    
    // Destroy previous chart if exists
    if (state.tempChart) {
        state.tempChart.destroy();
    }
    
    const labels = forecastData.map(day => 
        day.date.toLocaleDateString('es', { weekday: 'short' })
    );
    
    const minTemps = forecastData.map(day => convertTemp(day.minTemp));
    const maxTemps = forecastData.map(day => convertTemp(day.maxTemp));
    
    const textColor = document.body.classList.contains('dark') ? '#e2e8f0' : '#1e293b';
    const gridColor = document.body.classList.contains('dark') ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const bgColor = document.body.classList.contains('dark') ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255, 255, 255, 0.5)';
    
    state.tempChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Mínima',
                    data: minTemps,
                    borderColor: '#4f46e5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#4f46e5',
                    pointBorderColor: '#fff',
                    pointHoverRadius: 6,
                    pointRadius: 4
                },
                {
                    label: 'Máxima',
                    data: maxTemps,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#ef4444',
                    pointBorderColor: '#fff',
                    pointHoverRadius: 6,
                    pointRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: textColor,
                        font: {
                            weight: '600'
                        },
                        usePointStyle: true,
                        padding: 20
                    }
                },
                tooltip: {
                    backgroundColor: bgColor,
                    borderColor: document.body.classList.contains('dark') ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    borderWidth: 1,
                    titleColor: textColor,
                    bodyColor: textColor,
                    padding: 12,
                    usePointStyle: true,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${Math.round(context.raw)}${state.isCelsius ? '°C' : '°F'}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: gridColor,
                        drawBorder: false
                    },
                    ticks: {
                        color: textColor,
                        font: {
                            weight: '500'
                        }
                    }
                },
                y: {
                    grid: {
                        color: gridColor,
                        drawBorder: false
                    },
                    ticks: {
                        color: textColor,
                        font: {
                            weight: '500'
                        },
                        callback: function(value) {
                            return value + (state.isCelsius ? '°C' : '°F');
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

// Show error message
function showError(message) {
    elements.loading.style.display = 'none';
    elements.error.classList.remove('hidden');
    elements.error.textContent = `Error: ${message}`;
}

// Add to search history
function addToSearchHistory(city) {
    // Remove if already exists
    state.searchHistory = state.searchHistory.filter(item => 
        item.toLowerCase() !== city.toLowerCase()
    );
    
    // Add to beginning
    state.searchHistory.unshift(city);
    
    // Limit history size
    if (state.searchHistory.length > config.maxHistoryItems) {
        state.searchHistory.pop();
    }
    
    // Save to localStorage
    localStorage.setItem('weatherSearchHistory', JSON.stringify(state.searchHistory));
    
    // Update display
    updateSearchHistoryDisplay();
}