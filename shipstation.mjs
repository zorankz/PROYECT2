import dotenv from 'dotenv';
import { ShipEngine } from 'shipengine';

dotenv.config();

const shipengine = new ShipEngine(process.env.SHIPENGINE_API_KEY);

export default (app) => {
  app.post('/crear-etiqueta', async (req, res) => {
    try {
      const { address_to } = req.body;

      if (!address_to) {
        return res.status(400).json({ error: 'Falta dirección del destinatario (address_to).' });
      }

      const shipTo = {
        name: address_to.name || "Destinatario",
        addressLine1: address_to.street1 || "123 Main St",
        addressLine2: address_to.street2 || "",
        cityLocality: address_to.city || "Ciudad",
        stateProvince: address_to.state || "CA",
        postalCode: address_to.zip || "90001",
        countryCode: "US",
        addressResidentialIndicator: "yes"
      };

      const shipFrom = {
        name: "DS Document Solutions",
        companyName: "DSDocs",
        phone: "+18435555555",
        addressLine1: "10825 Dorchester Rd",
        cityLocality: "Summerville",
        stateProvince: "SC",
        postalCode: "29485",
        countryCode: "US",
        addressResidentialIndicator: "no"
      };

      const packages = [
        {
          weight: { value: 1, unit: "ounce" },
          dimensions: {
            length: 6,
            width: 4,
            height: 1,
            unit: "inch"
          },
          packageCode: "package"
        }
      ];

      console.log("\uD83D\uDE9A Datos enviados a ShipEngine:", JSON.stringify({
        shipTo,
        shipFrom,
        serviceCode: "usps_first_class_mail",
        packageCode: "package",
        confirmation: "none",
        packages
      }, null, 2));

      const shipment = await shipengine.createLabelFromShipmentDetails({
        shipment: {
          shipTo,
          shipFrom,
          serviceCode: "usps_first_class_mail",
          packageCode: "package",
          confirmation: "none",
          packages
        }
      });

      res.json({
        tracking_number: shipment.trackingNumber,
        etiqueta_pdf: shipment.labelDownload.pdf,
        carrier: shipment.carrierCode,
        costo: shipment.shipmentCost.amount
      });

    } catch (err) {
      console.error("\u274C Error al generar la etiqueta:", err.message);
      res.status(500).json({ error: 'Error interno creando etiqueta.' });
    }
  });
};
