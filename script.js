// Karte initialisieren
const map = L.map('map').setView([48.2583, 13.0333], 10);
const startPosition = [48.2583, 13.0333];
const startZoom = 10;

// TileLayer von OpenStreetMap hinzufügen
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap-Mitwirkende'
}).addTo(map);

// Variablen
let currentLayer;
let searchResults = [];
let marker;
let filterVisible = true;
let legendVisible = false;
let searchVisible = true;

// -------------------------------------------
// Suchbereich ein-/ausblenden
function toggleSearchArea() {
  const searchArea = document.getElementById('searchArea');
  if (searchVisible) {
    searchArea.classList.add('hidden');
    setTimeout(() => searchArea.style.display = 'none', 300);
  } else {
    searchArea.style.display = 'flex';
    setTimeout(() => searchArea.classList.remove('hidden'), 10);
  }
  searchVisible = !searchVisible;
}

// Karte: Klick für Marker mit kopierbaren Koordinaten
map.on('click', function(e) {
  const { lat, lng } = e.latlng;

  // Entferne alten Marker, falls vorhanden
  if (marker) {
    map.removeLayer(marker);
  }

  marker = L.marker([lat, lng]).addTo(map);

  const coords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

  const popupContent = `
    <div style="display: flex; align-items: center; gap: 5px;">
      <span id="coordText">${coords}</span>
      <button onclick="copyCoordinates()" title="Koordinaten kopieren" style="background:none; border:none; cursor:pointer;">📋</button>
    </div>
  `;

  marker.bindPopup(popupContent).openPopup();
});

// Funktion zum Kopieren der Koordinaten
function copyCoordinates() {
  const coordText = document.getElementById('coordText').innerText;
  navigator.clipboard.writeText(coordText)
    .then(() => {
      alert("Koordinaten kopiert!");
    })
    .catch(err => {
      console.error("Fehler beim Kopieren:", err);
    });
}


// Filterbox ein-/ausblenden
function toggleFilter() {
  const filter = document.getElementById('filter');
  if (filterVisible) {
    filter.classList.add('hidden');
    setTimeout(() => filter.style.display = 'none', 300);
  } else {
    filter.style.display = 'block';
    setTimeout(() => filter.classList.remove('hidden'), 10);
  }
  filterVisible = !filterVisible;
}

// Legendenbox ein-/ausblenden
function toggleLegend() {
  const legend = document.getElementById('legendBox');
  if (legendVisible) {
    legend.classList.add('hidden');
    setTimeout(() => legend.style.display = 'none', 300);
  } else {
    legend.style.display = 'block';
    setTimeout(() => legend.classList.remove('hidden'), 10);
  }
  legendVisible = !legendVisible;
}

// -------------------------------------------
// Nutzer-Standort bestimmen
function locateUser() {
  if (!navigator.geolocation) {
    alert("Dein Browser unterstützt keine Standortabfrage.");
    return;
  }

  navigator.geolocation.getCurrentPosition(position => {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;

    map.setView([lat, lon], 14);

    L.marker([lat, lon]).addTo(map)
      .bindPopup("📍 Dein aktueller Standort")
      .openPopup();
  }, error => {
    alert("Standort konnte nicht ermittelt werden.");
    console.error(error);
  });
}

// -------------------------------------------
// Zufälligen Punkt auf Land finden
async function findRandomLandPoint() {
  const maxTries = 10;
  let tries = 0;

  const loadingOverlay = document.getElementById('loadingOverlay');
  loadingOverlay.style.display = "flex";

  while (tries < maxTries) {
    loadingOverlay.innerHTML = `
      <div id="loadingSpinner"></div>
      Suche zufälligen Punkt...<br>🔁 Versuch ${tries + 1} von ${maxTries}
    `;

    const lat = Math.random() * 170 - 85;
    const lon = Math.random() * 360 - 180;

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
      const response = await fetch(url, { headers: { 'Accept-Language': 'de' } });
      const data = await response.json();

      if (data.address && data.address.country) {
        if (marker) map.removeLayer(marker);

        map.setView([lat, lon], 8);
        marker = L.marker([lat, lon]).addTo(map);
        marker.bindPopup(`
          🎯 <strong>Zufälliger Punkt gefunden!</strong><br><br>
          📍 <strong>Koordinaten:</strong> ${lat.toFixed(5)}, ${lon.toFixed(5)}<br>
          🏳️ <strong>Land:</strong> ${data.address.country}
        `).openPopup();

        loadingOverlay.innerHTML = `<div id="loadingSpinner"></div>Lädt Daten...`;
        loadingOverlay.style.display = "none";
        return;
      }
    } catch (err) {
      console.error("Fehler bei Reverse-Geocoding:", err);
    }

    tries++;
  }

  loadingOverlay.innerHTML = `<div id="loadingSpinner"></div>Lädt Daten...`;
  loadingOverlay.style.display = "none";
  alert("Kein Land gefunden. Bitte erneut versuchen.");
}

// -------------------------------------------
// Straßen laden anhand der Filterauswahl
async function loadData() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  
  loadingOverlay.innerHTML = `
    <div id="loadingSpinner"></div>
    Lädt Straßendaten...
  `;
  loadingOverlay.style.display = "flex";

  const currentZoom = map.getZoom();
  if (currentZoom < 13) {
    alert("Bitte näher heranzoomen! Mindest-Zoomstufe für Datenabruf: 13");
    loadingOverlay.style.display = "none";
    return;
  }

  const surfaces = getSelectedSurfaces();
  const query = buildOverpassQuery(surfaces);

  if (!query) {
    alert("Bitte mindestens eine Oberfläche auswählen.");
    loadingOverlay.style.display = "none";
    return;
  }

  const servers = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter"
  ];

  let data = null;

  for (let server of servers) {
    try {
      const response = await fetch(server, {
        method: "POST",
        body: query,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }
      });
      const text = await response.text();
      data = JSON.parse(text);
      break;
    } catch (error) {
      console.error("Fehler bei Server:", server, error);
    }
  }

  if (!data) {
    alert("Fehler: Keine gültigen Daten von Overpass-Server erhalten.");
    loadingOverlay.style.display = "none";
    return;
  }

  const geojson = overpassToGeoJSON(data);

  if (currentLayer) map.removeLayer(currentLayer);

  currentLayer = L.geoJSON(geojson, {
    style: feature => ({
      color: surfaceColor(feature.properties.surface),
      weight: 3
    })
  }).addTo(map);

  loadingOverlay.innerHTML = `<div id="loadingSpinner"></div>Lädt Daten...`;
  loadingOverlay.style.display = "none";
}

// -------------------------------------------
// Hilfsfunktionen für Overpass-Abfrage

function getSelectedSurfaces() {
  return Array.from(document.querySelectorAll('#filter input[type=checkbox]:checked'))
              .map(cb => cb.value);
}

function buildOverpassQuery(selectedSurfaces) {
  if (selectedSurfaces.length === 0) return null;

  const bbox = map.getBounds();
  const south = bbox.getSouth();
  const west = bbox.getWest();
  const north = bbox.getNorth();
  const east = bbox.getEast();

  const knownSurfaces = selectedSurfaces.filter(s => s !== "unbekannt");
  const includeUnknown = selectedSurfaces.includes("unbekannt");

  let queryParts = [];

  if (knownSurfaces.length > 0) {
    const surfaceFilter = knownSurfaces.join('|');
    queryParts.push(`way["highway"]["surface"~"${surfaceFilter}"](${south},${west},${north},${east});`);
  }

  if (includeUnknown) {
    queryParts.push(`way["highway"]["surface"!~"."](${south},${west},${north},${east});`);
  }

  return `
    [out:json][timeout:25];
    (
      ${queryParts.join('\n')}
    );
    out geom;
  `;
}

function overpassToGeoJSON(data) {
  const features = data.elements
    .filter(el => el.type === 'way' && el.geometry)
    .map(way => ({
      type: "Feature",
      properties: {
        id: way.id,
        surface: way.tags?.surface || 'unbekannt'
      },
      geometry: {
        type: "LineString",
        coordinates: way.geometry.map(p => [p.lon, p.lat])
      }
    }));

  return {
    type: "FeatureCollection",
    features: features
  };
}

function surfaceColor(type) {
  const colors = {
    asphalt: "black",
    gravel: "brown",
    unpaved: "gray",
    dirt: "saddlebrown",
    paved: "green",
    compacted: "orange",
    unbekannt: "blue",
    grass: "lightgreen",
    ground: "burlywood",
    sand: "khaki",
    mud: "peru",
    wood: "tan",
    concrete: "lightgray",
    "concrete:plates": "lightgray",
    cobblestone: "darkgray",
    "cobblestone:flattened": "darkgray",
    paving_stones: "darkgray",
    sett: "darkgray",
    metal: "silver",
    woodchips: "sienna",
    ice: "lightblue",
    snow: "whitesmoke",
    pebblestone: "lightgray"
  };
  return colors[type] || "blue";
}

// -------------------------------------------
// Zoomlevel aktualisieren
function updateZoomLevel() {
  const zoomDisplay = document.getElementById('zoomLevel');
  zoomDisplay.innerText = "Zoom: " + map.getZoom();
}
map.on('zoomend', updateZoomLevel);

// -------------------------------------------
// Beim Laden der Seite
window.onload = () => {
  document.getElementById('searchInput').focus();
  updateZoomLevel();
};
