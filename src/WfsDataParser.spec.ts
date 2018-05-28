import 'isomorphic-fetch';

import WfsDataParser from './WfsDataParser';

it('WfsDataParser is defined', () => {
  expect(WfsDataParser).toBeDefined();
});

describe('WfsDataParser implements DataParser', () => {

  beforeEach(() => {
    fetch.resetMocks();
  });

  it('readData is defined', () => {
    const wfsParser = new WfsDataParser();
    expect(wfsParser.readData).toBeDefined();
  });

  describe('#readData implementation', () => {

    it('rejects promise if errornous DescribeFeatureType response has been returned', () => {
      fetch.mockResponseOnce(JSON.stringify({ data: '12345' }));

      const wfsParser = new WfsDataParser();
      const resultPromise = wfsParser.readData({
        url: '//foo.bar',
        version: '2.0.0',
        typeName: 'TEST:TEST'
      });

      const onFullFilled = null;
      const onRejected = (error: any) => {
        expect(error.startsWith('Error while parsing DescribeFeatureType')).toBe(true);
      };
      resultPromise.then(onFullFilled, onRejected);
    });

    it('Fetches DataSchema via describeFeatureType', () => {

      const describeFeatureTypeRespnse = `<?xml version="1.0" encoding="UTF-8"?>
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

      fetch.mockResponseOnce(describeFeatureTypeRespnse);

      const wfsParser = new WfsDataParser();
      const resultPromise = wfsParser.readData({
        url: '//ows.terrestris.de/geoserver/osm/wfs',
        version: '2.0.0',
        typeName: 'osm:osm-country-borders'
      });

      const onFullFilled = (result: any) => {
        expect(result).toBeDefined();
        expect(result.schema.type).toEqual('object');
        expect(typeof result.schema.properties).toBe('object');
        expect(result.schema.properties.osm_id).toEqual({
          type: 'xsd:long'
        });
      };

      resultPromise.then(onFullFilled);

    });
  });

});
