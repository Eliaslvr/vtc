// ==========================
// MAPBOX INITIALISATION
// ==========================
let map;
let startMarker = null;
let endMarker = null;
let routeGeoJSON = null;

// Récupération du token Mapbox depuis ton backend (SECURISÉ)
fetch("/api/mapbox/token")
    .then(res => res.json())
    .then(data => {
        mapboxgl.accessToken = data.token;
        initMap();
    })
    .catch(() => {
        showError("Impossible de charger le service cartographique.");
    });

function initMap() {
    map = new mapboxgl.Map({
        container: 'map',
        style: "mapbox://styles/mapbox/streets-v12",
        center: [2.3522, 48.8566],
        zoom: 12
    });
}

// ==========================
// FONCTIONS UI
// ==========================

function showError(msg) {
    const box = document.getElementById("errorMessage");
    box.innerText = msg;
    box.style.display = "block";

    setTimeout(() => {
        box.style.display = "none";
    }, 4000);
}

function showBookingForm() {
    document.getElementById("simulatorContainer").style.display = "none";
    document.getElementById("bookingForm").style.display = "block";

    // Remettre le prix final
    document.getElementById("finalPrice").innerText =
        document.getElementById("priceAmount").innerText;
}

function backToSimulator() {
    document.getElementById("bookingForm").style.display = "none";
    document.getElementById("simulatorContainer").style.display = "block";
}

function newBooking() {
    location.reload();
}

// ==========================
// DETECTION POSITION ACTUELLE
// ==========================

function useMyLocation() {
    if (!navigator.geolocation) {
        showError("La géolocalisation n'est pas supportée.");
        return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        try {
            const res = await fetch(`/api/mapbox/reverse-geocode?lat=${lat}&lon=${lon}`);
            const data = await res.json();

            if (data.features?.length > 0) {
                document.getElementById("pickup").value = data.features[0].place_name;
                map.flyTo({ center: [lon, lat], zoom: 14 });
            }
        } catch (e) {
            showError("Impossible d’obtenir votre adresse actuelle.");
        }
    });
}

// ==========================
// CALCUL DU PRIX
// ==========================

async function calculatePrice() {
    const pickup = document.getElementById("pickup").value.trim();
    const destination = document.getElementById("destination").value.trim();

    if (!pickup || !destination) {
        showError("Veuillez entrer une adresse de départ et une destination.");
        return;
    }

    document.getElementById("loading").style.display = "block";

    try {
        const start = await geocode(pickup);
        const end = await geocode(destination);

        if (!start || !end) {
            showError("Adresse introuvable.");
            document.getElementById("loading").style.display = "none";
            return;
        }

        // PLACE MARKERS
        placeMarkers(start, end);

        // ROUTE
        const route = await getRoute(start, end);
        displayRoute(route);

        const distanceKm = route.distance / 1000;
        const durationMin = Math.round(route.duration / 60);

        // PRICE CALC
        const serviceType = document.getElementById("serviceType").value;

        const prices = {
            standard: 1.50,
            premium: 2.00
        };

        const basePrice = prices[serviceType] * distanceKm + 5;

        document.getElementById("priceAmount").innerText = basePrice.toFixed(2) + " €";

        document.getElementById("distance").innerText = distanceKm.toFixed(2) + " km";
        document.getElementById("duration").innerText = durationMin + " min";

        document.getElementById("serviceTypeDisplay").innerText =
            serviceType === "standard" ? "Citadine" : "Van";

        // Stocker pour réservation
        window.currentRide = {
            distance: distanceKm.toFixed(2) + " km",
            duration: durationMin + " min",
            price: basePrice.toFixed(2) + " €",
            pickup,
            destination,
            serviceType,
            passengers: document.getElementById("passengers").value
        };

        document.getElementById("priceDisplay").style.display = "block";
    } catch (e) {
        showError("Erreur lors du calcul de l'itinéraire.");
    }

    document.getElementById("loading").style.display = "none";
}

// ==========================
// GEOCODAGE
// ==========================

async function geocode(address) {
    const res = await fetch(`/api/mapbox/geocode?query=${encodeURIComponent(address)}`);
    const data = await res.json();
    if (!data.features || data.features.length === 0) return null;
    return data.features[0].geometry.coordinates;
}

// ==========================
// ROUTE MAPBOX
// ==========================

async function getRoute(start, end) {
    const res = await fetch(`/api/mapbox/directions?start=${start}&end=${end}`);
    const data = await res.json();

    return data.routes[0];
}

function placeMarkers(start, end) {
    if (startMarker) startMarker.remove();
    if (endMarker) endMarker.remove();

    startMarker = new mapboxgl.Marker({ color: "green" })
        .setLngLat(start)
        .addTo(map);

    endMarker = new mapboxgl.Marker({ color: "red" })
        .setLngLat(end)
        .addTo(map);
}

function displayRoute(route) {
    if (map.getSource("route")) {
        map.removeLayer("route");
        map.removeSource("route");
    }

    map.addSource("route", {
        type: "geojson",
        data: {
            type: "Feature",
            geometry: route.geometry,
        }
    });

    map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-width": 5, "line-color": "#667eea" }
    });

    const bounds = new mapboxgl.LngLatBounds();
    route.geometry.coordinates.forEach(c => bounds.extend(c));
    map.fitBounds(bounds, { padding: 50 });
}

// ==========================
// ENVOI DE LA RÉSERVATION
// ==========================

document.getElementById("reservationForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const body = {
        ...window.currentRide,
        date: document.getElementById("date").value,
        time: document.getElementById("time").value,
        name: document.getElementById("name").value,
        phone: document.getElementById("phone").value,
        email: document.getElementById("email").value,
        notes: document.getElementById("notes").value,
    };

    const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    const data = await res.json();

    if (!data.success) {
        showError(data.message || "Erreur lors de la réservation.");
        return;
    }

    // AFFICHAGE CONFIRMATION
    document.getElementById("bookingForm").style.display = "none";
    document.getElementById("confirmation").style.display = "block";

    document.getElementById("bookingDetails").innerHTML = `
        <p><strong>Date :</strong> ${body.date}</p>
        <p><strong>Heure :</strong> ${body.time}</p>
        <p><strong>Départ :</strong> ${body.pickup}</p>
        <p><strong>Destination :</strong> ${body.destination}</p>
        <p><strong>Prix :</strong> ${body.price}</p>
    `;
});
