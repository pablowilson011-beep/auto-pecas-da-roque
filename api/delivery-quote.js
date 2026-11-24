
async function geocode(address, key) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${encodeURIComponent(key)}`;
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok || data.status !== 'OK' || !data.results?.length) {
    throw new Error('Não foi possível localizar um dos endereços. Confira o endereço e o CEP.');
  }

  return data.results[0].geometry.location;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;

  if (!key) {
    return res.status(503).json({
      error: 'Adicione GOOGLE_MAPS_API_KEY nas variáveis da Vercel.'
    });
  }

  const originAddress = String(req.body?.originAddress || '').trim();
  const destinationAddress = String(req.body?.destinationAddress || '').trim();

  if (originAddress.length < 12 || destinationAddress.length < 12) {
    return res.status(400).json({
      error: 'Informe os endereços completos da loja e do destino.'
    });
  }

  try {
    const [origin, destination] = await Promise.all([
      geocode(originAddress, key),
      geocode(destinationAddress, key)
    ]);

    const routeResponse = await fetch(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration'
        },
        body: JSON.stringify({
          origin: {
            location: {
              latLng: {
                latitude: origin.lat,
                longitude: origin.lng
              }
            }
          },
          destination: {
            location: {
              latLng: {
                latitude: destination.lat,
                longitude: destination.lng
              }
            }
          },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
          units: 'METRIC'
        })
      }
    );

    const routeData = await routeResponse.json();
    const route = routeData.routes?.[0];

    if (!routeResponse.ok || !route) {
      throw new Error('Não foi encontrada uma rota válida.');
    }

    return res.status(200).json({
      distanceMeters: route.distanceMeters,
      durationSeconds: Number(String(route.duration || '0s').replace('s', '')) || 0
    });

  } catch (error) {
    return res.status(400).json({
      error: error.message || 'Erro ao calcular a rota.'
    });
  }
};
