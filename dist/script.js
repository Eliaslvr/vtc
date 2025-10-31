const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Configuration des tarifs
const RATES = {
    standard: { perKm: 1.50, label: 'Standard' },
    premium: { perKm: 2.00, label: 'Premium' },
    business: { perKm: 2.50, label: 'Business' }
};
const BASE_FARE = 5.00;

// Variables globales pour stocker les données
let calculatedPrice = 0;
let tripData = {};
let map = null;
let markers = [];

// Définir la date minimum à aujourd'hui et initialiser la carte
document.addEventListener('DOMContentLoaded', function() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').setAttribute('min', today);
    
    // Initialiser la carte Mapbox
    if (MAPBOX_TOKEN === 'YOUR_MAPBOX_ACCESS_TOKEN_HERE') {
        showError('⚠️ Veuillez configurer votre clé API Mapbox dans le code');
        return;
    }
    
    mapboxgl.accessToken = MAPBOX_TOKEN;
    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [2.3522, 48.8566], // Paris par défaut
        zoom: 10
    });

    // Ajouter les contrôles de navigation
    map.addControl(new mapboxgl.NavigationControl());
});

// Fonction pour utiliser la géolocalisation
function useMyLocation() {
    if (!navigator.geolocation) {
        showError("La géolocalisation n'est pas supportée par votre navigateur");
        return;
    }

    showLoading(true);
    navigator.geolocation.getCurrentPosition(
        async function(position) {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
            try {
                // Utiliser l'API de géocodage inverse Mapbox
                const response = await fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${MAPBOX_TOKEN}`
                );
                const data = await response.json();
                
                if (data.features && data.features.length > 0) {
                    const address = data.features[0].place_name;
                    document.getElementById('pickup').value = address;
                    
                    // Centrer la carte sur la position
                    map.flyTo({ center: [lon, lat], zoom: 13 });
                    
                    // Ajouter un marqueur
                    addMarker([lon, lat], '📍 Départ', 'pickup');
                    
                    showLoading(false);
                    showError("✅ Position actuelle détectée!", false);
                }
            } catch (error) {
                showLoading(false);
                showError("Erreur lors de la récupération de l'adresse");
            }
        },
        function(error) {
            showLoading(false);
            showError("Impossible d'obtenir votre position. Veuillez vérifier vos paramètres de géolocalisation.");
        }
    );
}

// Fonction pour calculer le prix avec Mapbox Directions API
async function calculatePrice() {
    const pickup = document.getElementById('pickup').value.trim();
    const destination = document.getElementById('destination').value.trim();
    const serviceType = document.getElementById('serviceType').value;

    if (!pickup || !destination) {
        showError("Veuillez renseigner les adresses de départ et d'arrivée");
        return;
    }

    showLoading(true);
    hideError();

    try {
        // Géocoder les adresses avec Mapbox
        const pickupCoords = await geocodeAddress(pickup);
        const destCoords = await geocodeAddress(destination);

        if (!pickupCoords || !destCoords) {
            throw new Error("Impossible de localiser une ou plusieurs adresses");
        }

        // Obtenir l'itinéraire avec Mapbox Directions API
        const routeData = await getRoute(pickupCoords, destCoords);
        
        if (!routeData) {
            throw new Error("Impossible de calculer l'itinéraire");
        }

        const distance = routeData.distance / 1000; // Convertir en km
        const durationMinutes = Math.round(routeData.duration / 60);

        // Calculer le prix
        const rate = RATES[serviceType];
        const price = BASE_FARE + (distance * rate.perKm);

        // Stocker les données
        calculatedPrice = price;
        tripData = {
            pickup,
            destination,
            distance,
            duration: durationMinutes,
            serviceType,
            price
        };

        // Afficher l'itinéraire sur la carte
        displayRoute(routeData.geometry, pickupCoords, destCoords);

        // Afficher les informations du trajet
        document.getElementById('routeDistance').textContent = distance.toFixed(1) + ' km';
        document.getElementById('routeDuration').textContent = durationMinutes + ' min';
        document.getElementById('routeInfo').classList.add('show');

        // Afficher le résultat
        displayPrice(price, distance, durationMinutes, rate.label);
        showLoading(false);

    } catch (error) {
        showLoading(false);
        showError(error.message || "Erreur lors du calcul. Vérifiez les adresses saisies.");
    }
}

// Fonction de géocodage avec Mapbox
async function geocodeAddress(address) {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
        const coords = data.features[0].center;
        return { lon: coords[0], lat: coords[1] };
    }
    return null;
}

// Obtenir l'itinéraire avec Mapbox Directions API
async function getRoute(start, end) {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start.lon},${start.lat};${end.lon},${end.lat}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
        return {
            distance: data.routes[0].distance,
            duration: data.routes[0].duration,
            geometry: data.routes[0].geometry
        };
    }
    return null;
}

// Ajouter un marqueur sur la carte
function addMarker(coords, label, type) {
    // Supprimer les anciens marqueurs du même type
    markers = markers.filter(marker => {
        if (marker.type === type) {
            marker.marker.remove();
            return false;
        }
        return true;
    });

    // Créer un nouveau marqueur
    const color = type === 'pickup' ? '#667eea' : '#28a745';
    const el = document.createElement('div');
    el.style.backgroundColor = color;
    el.style.width = '30px';
    el.style.height = '30px';
    el.style.borderRadius = '50%';
    el.style.border = '3px solid white';
    el.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';

    const marker = new mapboxgl.Marker(el)
        .setLngLat(coords)
        .setPopup(new mapboxgl.Popup().setText(label))
        .addTo(map);

    markers.push({ marker, type });
}

// Afficher l'itinéraire sur la carte
function displayRoute(geometry, start, end) {
    // Supprimer l'itinéraire précédent s'il existe
    if (map.getSource('route')) {
        map.removeLayer('route');
        map.removeSource('route');
    }

    // Ajouter l'itinéraire
    map.addSource('route', {
        type: 'geojson',
        data: {
            type: 'Feature',
            properties: {},
            geometry: geometry
        }
    });

    map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
            'line-join': 'round',
            'line-cap': 'round'
        },
        paint: {
            'line-color': '#667eea',
            'line-width': 5,
            'line-opacity': 0.8
        }
    });

    // Ajouter les marqueurs
    addMarker([start.lon, start.lat], '📍 Départ', 'pickup');
    addMarker([end.lon, end.lat], '🎯 Arrivée', 'destination');

    // Ajuster la vue pour afficher tout l'itinéraire
    const coordinates = geometry.coordinates;
    const bounds = coordinates.reduce((bounds, coord) => {
        return bounds.extend(coord);
    }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

    map.fitBounds(bounds, { padding: 80 });
}

// Formule de Haversine pour calculer la distance (fallback si API échoue)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    // Ajouter 20% pour tenir compte des routes (pas à vol d'oiseau)
    return distance * 1.2;
}

// Afficher le prix calculé
function displayPrice(price, distance, duration, serviceLabel) {
    document.getElementById('priceAmount').textContent = price.toFixed(2) + '€';
    document.getElementById('distance').textContent = distance.toFixed(1) + ' km';
    document.getElementById('duration').textContent = duration + ' min';
    document.getElementById('serviceTypeDisplay').textContent = serviceLabel;
    document.getElementById('priceDisplay').classList.add('show');
}

// Afficher le formulaire de réservation
function showBookingForm() {
    document.getElementById('simulatorContainer').style.display = 'none';
    document.getElementById('bookingForm').style.display = 'block';
    document.getElementById('finalPrice').textContent = calculatedPrice.toFixed(2) + '€';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Retour au simulateur
function backToSimulator() {
    document.getElementById('bookingForm').style.display = 'none';
    document.getElementById('simulatorContainer').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Soumettre la réservation
document.getElementById('reservationForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const formData = {
        ...tripData,
        date: document.getElementById('date').value,
        time: document.getElementById('time').value,
        name: document.getElementById('name').value,
        phone: document.getElementById('phone').value,
        email: document.getElementById('email').value,
        notes: document.getElementById('notes').value,
        passengers: document.getElementById('passengers').value
    };

    // Afficher la confirmation
    displayConfirmation(formData);
});

// Afficher la confirmation
function displayConfirmation(data) {
    const serviceLabel = RATES[data.serviceType].label;
    
    const detailsHTML = `
        <p><strong>🚗 Service:</strong> ${serviceLabel}</p>
        <p><strong>📍 Départ:</strong> ${data.pickup}</p>
        <p><strong>🎯 Destination:</strong> ${data.destination}</p>
        <p><strong>📅 Date:</strong> ${formatDate(data.date)}</p>
        <p><strong>🕐 Heure:</strong> ${data.time}</p>
        <p><strong>👥 Passagers:</strong> ${data.passengers}</p>
        <p><strong>📏 Distance:</strong> ${data.distance.toFixed(1)} km</p>
        <p><strong>⏱️ Durée estimée:</strong> ${data.duration} minutes</p>
        <p><strong>💰 Prix total:</strong> ${data.price.toFixed(2)}€</p>
        <p><strong>👤 Nom:</strong> ${data.name}</p>
        <p><strong>📞 Téléphone:</strong> ${data.phone}</p>
        ${data.email ? `<p><strong>✉️ Email:</strong> ${data.email}</p>` : ''}
        ${data.notes ? `<p><strong>📝 Notes:</strong> ${data.notes}</p>` : ''}
    `;

    document.getElementById('bookingDetails').innerHTML = detailsHTML;
    document.getElementById('bookingForm').style.display = 'none';
    document.getElementById('confirmation').classList.add('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Nouvelle réservation
function newBooking() {
    document.getElementById('confirmation').classList.remove('show');
    document.getElementById('simulatorContainer').style.display = 'block';
    document.getElementById('priceDisplay').classList.remove('show');
    document.getElementById('simulatorForm').reset();
    document.getElementById('reservationForm').reset();
    calculatedPrice = 0;
    tripData = {};
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Fonctions utilitaires
function showLoading(show) {
    document.getElementById('loading').classList.toggle('show', show);
    document.getElementById('calculateBtn').disabled = show;
}

function showError(message, isError = true) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = message;
    errorEl.style.background = isError ? '#f8d7da' : '#d4edda';
    errorEl.style.color = isError ? '#721c24' : '#155724';
    errorEl.classList.add('show');
    setTimeout(() => errorEl.classList.remove('show'), 5000);
}

function hideError() {
    document.getElementById('errorMessage').classList.remove('show');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}