// Initialisiere die Karte und setze Startposition und Zoomstufe
const map = L.map('map').setView([48.2583, 13.0333], 10);

// Merke dir die Startposition und Zoom für späteres Zurücksetzen
const startPosition = [48.2583, 13.0333];
const startZoom = 10;

// Lade die OpenStreetMap-Kacheln in die Karte
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap-Mitwirkende'
}).addTo(map);

// Globale Variablen vorbereiten
let currentLayer;    // für die geladenen Straßen (GeoJSON)
let searchResults = []; // für die Suchergebnisse aus Nominatim
let marker;          // für gesetzte Marker auf der Karte
let filterVisible = true;  // Status, ob Filterbox sichtbar ist
let legendVisible = false; // Status, ob Legendenbox sichtbar ist
let searchVisible = true;  // Status, ob Suchfeld sichtbar ist

// Funktion: Suchbereich ein- oder ausblenden
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

// Funktion: Filterbereich ein- oder ausblenden
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


// Funktion: aktuellen Standort des Benutzers finden
function locateUser() {
  if (!navigator.geolocation) {
    alert("Dein Browser unterstützt keine Standortabfrage.");
    return;
  }

  navigator.geolocation.getCurrentPosition(position => {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;

    // Karte auf Benutzerposition zentrieren
    map.setView([lat, lon], 14);

    // Marker setzen mit Popup "Dein aktueller Standort"
    L.marker([lat, lon]).addTo(map)
      .bindPopup("📍 Dein aktueller Standort")
      .openPopup();

  }, error => {
    alert("Standort konnte nicht ermittelt werden.");
    console.error(error);
  });
}

// Funktion: zufälligen Punkt auf Land finden
async function findRandomLandPoint() {
  const maxTries = 10;
  let tries = 0;

  const loadingOverlay = document.getElementById('loadingOverlay');
  loadingOverlay.style.display = "flex";

  while (tries < maxTries) {
    // Ladeanzeige aktualisieren
    loadingOverlay.innerHTML = `
      <div id="loadingSpinner"></div>
      Suche zufälligen Punkt...<br>🔁 Versuch ${tries + 1} von ${maxTries}
    `;

    // Zufällige Koordinaten erzeugen
    const lat = Math.random() * 170 - 85;  // -85 bis +85 (Breitengrad)
    const lon = Math.random() * 360 - 180; // -180 bis +180 (Längengrad)

    try {
      // Reverse-Geocoding (Adresse anhand von Koordinaten abfragen)
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
      const response = await fetch(url, { headers: { 'Accept-Language': 'de' } });
      const data = await response.json();

      if (data.address && data.address.country) {
        // Wenn ein Land gefunden wurde, Marker setzen

        if (marker) {
          map.removeLayer(marker);
        }

        map.setView([lat, lon], 8); // auf Punkt zoomen

        marker = L.marker([lat, lon]).addTo(map);
        marker.bindPopup(`
          🎯 <strong>Zufälliger Punkt gefunden!</strong><br><br>
          📍 <strong>Koordinaten:</strong> ${lat.toFixed(5)}, ${lon.toFixed(5)}<br>
          🏳️ <strong>Land:</strong> ${data.address.country}
        `).openPopup();

        loadingOverlay.style.display = "none";
        return;
      }
    } catch (err) {
      console.error("Fehler bei Reverse-Geocoding:", err);
    }

    tries++;
  }

  // Nach maxTries kein Land gefunden
  loadingOverlay.style.display = "none";
  alert("Kein Land gefunden. Bitte erneut versuchen.");
}

// Funktion: kleine grüne Erfolgsmeldung anzeigen
function showSuccessMessage(text) {
  const successDiv = document.createElement("div");
  successDiv.style.position = "fixed";
  successDiv.style.top = "20px";
  successDiv.style.left = "50%";
  successDiv.style.transform = "translateX(-50%)";
  successDiv.style.background = "#28a745";
  successDiv.style.color = "white";
  successDiv.style.padding = "10px 20px";
  successDiv.style.borderRadius = "6px";
  successDiv.style.fontFamily = "sans-serif";
  successDiv.style.fontSize = "16px";
  successDiv.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";
  successDiv.style.zIndex = 5000;
  successDiv.innerText = text;
  document.body.appendChild(successDiv);

  // Erfolgsmeldung verschwindet nach 2,5 Sekunden
  setTimeout(() => {
    successDiv.remove();
  }, 2500);
}
// Funktion: Springe zu bestimmten Koordinaten (aus Eingabefeld)
function goToCoordinates() {
  const input = document.getElementById('coordInput').value.trim();
  
  // Eingabe prüfen: muss ein Komma enthalten
  if (!input.includes(",")) {
    alert("Bitte Koordinaten im Format: Breite, Länge eingeben!");
    return;
  }

  const parts = input.split(",");
  if (parts.length !== 2) {
    alert("Bitte genau zwei Werte eingeben: Breite und Länge, getrennt durch Komma.");
    return;
  }

  // Breiten- und Längengrad extrahieren und in Zahlen umwandeln
  const lat = parseFloat(parts[0]);
  const lon = parseFloat(parts[1]);

  if (isNaN(lat) || isNaN(lon)) {
    alert("Ungültige Zahlenangabe. Bitte überprüfe die Koordinaten.");
    return;
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    alert("Ungültige Werte: Breite muss zwischen -90 und 90, Länge zwischen -180 und 180 liegen.");
    return;
  }

  // Karte auf eingegebene Koordinaten verschieben
  map.setView([lat, lon], 14);

  // Vorherigen Marker löschen und neuen Marker setzen
  if (marker) {
    map.removeLayer(marker);
  }
  marker = L.marker([lat, lon]).addTo(map);
}

// Ereignis: Klick auf Karte → Marker mit Koordinaten setzen
map.on('click', function(e) {
  const { lat, lng } = e.latlng;

  // Vorherigen Marker löschen
  if (marker) {
    map.removeLayer(marker);
  }

  // Neuen Marker setzen
  marker = L.marker([lat, lng]).addTo(map);

  const coords = `${lat.toFixed(14)}, ${lng.toFixed(14)}`; // sehr genau!

  // Popup mit Koordinaten + Kopierbutton
  const popupContent = `
    <div style="display: flex; align-items: center; gap: 5px;">
      <span id="coordText">${coords}</span>
      <button onclick="copyCoordinates()" title="Kopieren" style="background:none; border:none; cursor:pointer;">📋</button>
    </div>
  `;

  marker.bindPopup(popupContent).openPopup();
});

// Funktion: Koordinaten aus Popup kopieren
function copyCoordinates() {
  const coordText = document.getElementById('coordText').innerText;
  navigator.clipboard.writeText(coordText).then(() => {
    alert("Koordinaten kopiert!");
  }).catch(err => {
    console.error("Fehler beim Kopieren:", err);
  });
}
// Funktion: Legendenbox ein- oder ausblenden
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

// Funktion: Alle Marker und Straßen entfernen
function clearMarkers() {
  // Straßenlayer entfernen
  if (currentLayer) {
    map.removeLayer(currentLayer);
    currentLayer = null;
  }
  // Einzelnen Marker entfernen
  if (marker) {
    map.removeLayer(marker);
    marker = null;
  }
}

// Funktion: Karte auf Startposition und Startzoom zurücksetzen
function resetMap() {
  clearMarkers(); // Alles löschen
  map.setView(startPosition, startZoom); // Startansicht wiederherstellen
}
// Funktion: Ort oder Stadt suchen
async function searchLocation() {
  const input = document.getElementById('searchInput').value.trim(); // Eingegebenen Text holen
  const results = document.getElementById('results'); // Dropdown-Menü für Ergebnisse

  if (!input) {
    alert("Bitte gib einen Ort oder eine Stadt ein.");
    return;
  }

  // Baue die Nominatim-Such-URL
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(input)}`;

  try {
    const response = await fetch(url, { headers: { 'Accept-Language': 'de' } });
    const data = await response.json();

    if (data.length === 0) {
      alert("Kein Ort gefunden.");
      return;
    }

    searchResults = data; // Speichere Suchergebnisse
    results.innerHTML = ""; // Dropdown leeren

    if (data.length === 1) {
      // Wenn nur ein Treffer: Karte direkt auf diesen Ort zentrieren
      centerMap(data[0]);
      results.style.display = "none";
    } else {
      // Mehrere Treffer: Liste anzeigen
      data.forEach((place, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.text = place.display_name;
        results.appendChild(option);
      });
      results.style.display = "block";
    }
  } catch (error) {
    console.error("Fehler bei der Suche:", error);
    alert("Fehler bei der Suche. Bitte versuche es später nochmal.");
  }
}

// Funktion: Ort aus der Ergebnisliste auswählen
function selectLocation() {
  const results = document.getElementById('results');
  const selectedIndex = results.value; // Index vom ausgewählten Ort
  const selectedPlace = searchResults[selectedIndex];
  if (selectedPlace) {
    centerMap(selectedPlace);
  }
}

// Funktion: Karte auf gewählten Ort zentrieren
function centerMap(place) {
  const lat = parseFloat(place.lat);
  const lon = parseFloat(place.lon);

  map.setView([lat, lon], 12); // Zoome auf den gefundenen Ort

  // Vorhandenen Marker entfernen und neuen setzen
  if (marker) {
    map.removeLayer(marker);
  }
  marker = L.marker([lat, lon]).addTo(map);
}

// Funktion: Suchfeld und Suchergebnisse zurücksetzen
function clearSearch() {
  document.getElementById('searchInput').value = ""; // Textfeld leeren
  const results = document.getElementById('results');
  results.style.display = "none"; // Dropdown verstecken
  results.innerHTML = "";

  if (marker) {
    map.removeLayer(marker); // Falls Marker durch Suche gesetzt wurde, entfernen
    marker = null;
  }
}
// Funktion: Hole die ausgewählten Oberflächenarten aus dem Filter
function getSelectedSurfaces() {
  return Array.from(document.querySelectorAll('#filter input[type=checkbox]:checked'))
              .map(cb => cb.value); // Werte der angehakten Checkboxen als Array
}

// Funktion: Baue eine Overpass-API-Abfrage basierend auf ausgewählten Oberflächen
function buildOverpassQuery(selectedSurfaces) {
  if (selectedSurfaces.length === 0) return null; // Wenn keine Oberfläche ausgewählt ist, abbrechen

  // Begrenze die Abfrage auf den aktuell sichtbaren Kartenausschnitt
  const bbox = map.getBounds();
  const south = bbox.getSouth();
  const west = bbox.getWest();
  const north = bbox.getNorth();
  const east = bbox.getEast();

  const knownSurfaces = selectedSurfaces.filter(s => s !== "unbekannt");
  const includeUnknown = selectedSurfaces.includes("unbekannt");

  let queryParts = [];

  // Straßen mit bekannten Oberflächen anfragen
  if (knownSurfaces.length > 0) {
    const surfaceFilter = knownSurfaces.join('|'); // z.B. asphalt|gravel|unpaved
    queryParts.push(`way["highway"]["surface"~"${surfaceFilter}"](${south},${west},${north},${east});`);
  }

  // Straßen ohne surface-Tag (unbekannte Oberfläche) anfragen
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

// Funktion: Lade Straßendaten von Overpass API und zeichne sie auf der Karte
async function loadData() {
  const loadingOverlay = document.getElementById('loadingOverlay');

  const currentZoom = map.getZoom();
  if (currentZoom < 13) {
    alert("Bitte näher heranzoomen! Mindest-Zoomstufe für Datenabruf: 13");
    return;
  }

  loadingOverlay.style.display = "flex"; // Ladeoverlay anzeigen

  const surfaces = getSelectedSurfaces();
  const query = buildOverpassQuery(surfaces);

  if (!query) {
    alert("Bitte mindestens eine Oberfläche auswählen.");
    loadingOverlay.style.display = "none";
    return;
  }

  // Zwei Overpass-Server als Backup (falls einer nicht geht)
  const servers = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter"
  ];

  let data = null;

  // Probiere die Server der Reihe nach
  for (let server of servers) {
    try {
      const response = await fetch(server, {
        method: "POST",
        body: query,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }
      });
      const text = await response.text();
      data = JSON.parse(text);
      break; // Erfolgreich, also abbrechen
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

  // Vorhandene Layer entfernen
  if (currentLayer) map.removeLayer(currentLayer);

  // Neue Straßen zeichnen
  currentLayer = L.geoJSON(geojson, {
    style: feature => ({
      color: surfaceColor(feature.properties.surface),
      weight: 3
    })
  }).addTo(map);

  loadingOverlay.style.display = "none"; // Ladeoverlay ausblenden
}

// Funktion: Konvertiere Overpass-Daten in GeoJSON-Format
function overpassToGeoJSON(data) {
  const features = data.elements
    .filter(el => el.type === 'way' && el.geometry) // Nur "way"-Elemente mit Geometrie
    .map(way => ({
      type: "Feature",
      properties: {
        id: way.id,
        surface: way.tags?.surface || 'unbekannt' // Oberfläche merken, sonst "unbekannt"
      },
      geometry: {
        type: "LineString",
        coordinates: way.geometry.map(p => [p.lon, p.lat]) // Koordinaten umdrehen [lon, lat]
      }
    }));
  
  return {
    type: "FeatureCollection",
    features: features
  };
}

// Funktion: Gib Farbe zurück je nach Oberfläche
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
  return colors[type] || "blue"; // Fallback-Farbe blau
}

// Funktion: Zoomlevel-Anzeige unten rechts aktualisieren
function updateZoomLevel() {
  const zoomDisplay = document.getElementById('zoomLevel');
  zoomDisplay.innerText = "Zoom: " + map.getZoom();
}

// Event: Wenn Zoom geändert wird → Zoomlevel aktualisieren
map.on('zoomend', updateZoomLevel);

// Beim ersten Laden: Fokus auf Suchfeld und Zoomlevel setzen
window.onload = () => {
  document.getElementById('searchInput').focus();
  updateZoomLevel();
};
