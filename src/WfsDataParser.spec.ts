import { describe, expect, it, vi } from 'vitest';
import WfsDataParser from './WfsDataParser';

const fetchMock = vi.fn();
global.fetch = fetchMock;

const createFetchResponse = (data) => {
  return {
    json: () => new Promise((resolve) => resolve(JSON.parse(data))),
    text: () => new Promise((resolve) => resolve(data))
  };
};

it('WfsDataParser is defined', () => {
  expect(WfsDataParser).toBeDefined();
});

describe('WfsDataParser implements DataParser', () => {

  it('readData is defined', () => {
    const wfsParser = new WfsDataParser();
    expect(wfsParser.readData).toBeDefined();
  });

  describe('#readData implementation', () => {

    it('rejects promise if errornous DescribeFeatureType / WFS response has been returned', () => {
      fetchMock.mockResolvedValue(createFetchResponse(JSON.stringify({ data: '12345' })));

      const wfsParser = new WfsDataParser();
      const resultPromise = wfsParser.readData({
        url: '//foo.bar',
        requestParams: {
          version: '2.0.0',
          typeNames: 'TEST:TEST'
        }
      });

      const onFullFilled = null;
      const onRejected = (error: any) => {
        expect(error.startsWith('Error while parsing DescribeFeatureType')).toBe(true);
      };
      resultPromise
        .then(onFullFilled, onRejected)
        .catch(error => {/** */});
    });

    it('fetches dataSchema via WFS-DescribeFeatureType and exampleFeatures via WFS-GetFeature', () => {
      const describeFeatureTypeResponse = `<?xml version="1.0" encoding="UTF-8"?>
        <xsd:schema xmlns:gml="http://www.opengis.net/gml/3.2"
        xmlns:osm="http://terrestris" xmlns:wfs="http://www.opengis.net/wfs/2.0"
        xmlns:xsd="http://www.w3.org/2001/XMLSchema"
        elementFormDefault="qualified" targetNamespace="http://terrestris">
        <xsd:import namespace="http://www.opengis.net/gml/3.2"
        schemaLocation="http://ows.terrestris.de:80/geoserver/schemas/gml/3.2.1/gml.xsd"/>
        <xsd:complexType name="osm-country-bordersType">
          <xsd:complexContent>
            <xsd:extension base="gml:AbstractFeatureType">
              <xsd:sequence>
                <xsd:element maxOccurs="1" minOccurs="1" name="id" nillable="false" type="xsd:int"/>
                <xsd:element maxOccurs="1" minOccurs="0" name="osm_id" nillable="true" type="xsd:long"/>
                <xsd:element maxOccurs="1" minOccurs="0" name="type" nillable="true" type="xsd:string"/>
                <xsd:element maxOccurs="1" minOccurs="0" name="admin_level" nillable="true" type="xsd:int"/>
                <xsd:element
                  maxOccurs="1" minOccurs="0" name="geometry" nillable="true" type="gml:GeometryPropertyType"/>
              </xsd:sequence>
            </xsd:extension>
          </xsd:complexContent>
        </xsd:complexType>
        <xsd:element
        name="osm-country-borders" substitutionGroup="gml:AbstractFeature" type="osm:osm-country-bordersType"/>
      </xsd:schema>`;

      const getFeatureResponse = {
        type: 'FeatureCollection',
        totalFeatures: 2,
        features: [{
          type: 'Feature',
          id: 'osm-busstops.fid-4dec2e09_163976bf70d_-73ac',
          geometry: {
            type: 'Point',
            coordinates: [568249.50975093, 6720390.38378923]
          },
          geometry_name: 'geometry',
          properties: {
            osm_id: 29073854
          }
        }, {
          type: 'Feature',
          id: 'osm-busstops.fid-4dec2e09_163976bf70d_-73ab',
          geometry: {
            type: 'Point',
            coordinates: [981048.0170072, 7001258.45667367]
          },
          geometry_name: 'geometry',
          properties: {
            osm_id: 29077474
          }
        }]
      };

      // mock responses of WFS DescribeFeatureType and WFS GetFeature
      fetchMock.mockResolvedValueOnce(createFetchResponse(describeFeatureTypeResponse));
      fetchMock.mockResolvedValueOnce(createFetchResponse(JSON.stringify(getFeatureResponse)));

      const wfsParser = new WfsDataParser();
      const resultPromise = wfsParser.readData({
        url: '//ows.terrestris.de/geoserver/osm/wfs',
        requestParams: {
          version: '2.0.0',
          typeNames: 'osm:osm-country-borders',
          count: 1
        }
      });

      const onFullFilled = (result: any) => {
        expect(result).toBeDefined();
        expect(result.schema.type).toEqual('object');
        expect(typeof result.schema.properties).toBe('object');
        expect(result.schema.properties.osm_id).toEqual({
          type: 'number'
        });
        expect(result.schema.properties.admin_level).toEqual({
          type: 'number'
        });

        expect(result.exampleFeatures).toEqual(getFeatureResponse);
      };

      resultPromise.then(onFullFilled);
    });
  });

  describe('#generateRequestParamString', () => {
    it('is defined', () => {
      const wfsParser = new WfsDataParser();
      expect(wfsParser.generateRequestParamString).toBeDefined();
    });

    it('returns a requestString from an object', () => {
      const requestString = 'LAYER=OSM-WMS&VERSION=1.3.0&SERVICE=WMS&REQUEST=getLegendGraphic&FORMAT=image%2Fpng';
      const params = {
        LAYER: 'OSM-WMS',
        VERSION: '1.3.0',
        SERVICE: 'WMS',
        REQUEST: 'getLegendGraphic',
        FORMAT: 'image/png'
      };
      const wfsParser = new WfsDataParser();
      const got = wfsParser.generateRequestParamString(params);
      expect(got).toBe(requestString);
    });
  });

  describe('#mapXsdTypeToJsonDataType', () => {
    it('is defined', () => {
      const wfsParser = new WfsDataParser();
      expect(wfsParser.mapXsdTypeToJsonDataType).toBeDefined();
    });

    it('maps XSD types to JSON schema datatypes correctly', () => {
      const wfsParser = new WfsDataParser();

      const typeMapping = {
        'xsd:string': 'string',
        'xsd:boolean': 'boolean',
        'xsd:byte': 'number',
        'xsd:decimal': 'number',
        'xsd:int': 'number',
        'xsd:integer': 'number',
        'xsd:long': 'number',
        'xsd:negativeInteger': 'number',
        'xsd:nonNegativeInteger': 'number',
        'xsd:nonPositiveInteger': 'number',
        'xsd:positiveInteger': 'number',
        'xsd:short': 'number',
        'xsd:unsignedLong': 'number',
        'xsd:unsignedInt': 'number',
        'xsd:unsignedShort': 'number',
        'xsd:unsignedByte': 'number'
      };

      Object.keys(typeMapping).forEach(xsdType => {
        const expectedJsonSchemaType = typeMapping[xsdType];
        expect(wfsParser.mapXsdTypeToJsonDataType(xsdType)).toEqual(expectedJsonSchemaType);
      });

    });
  });

});
