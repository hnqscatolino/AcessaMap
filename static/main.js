const mapa = L.map("mapa").setView(
    [-15.793889, -47.882778],
    11
);

L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        attribution: "&copy; OpenStreetMap contributors"
    }
).addTo(mapa);